import { Router, Request, Response, NextFunction } from 'express';
import { userStore } from './userStore';
import { auditStore } from './auditStore';
import { approvalStore } from './approvalStore';
import { communicationStore } from './communicationStore';
import { authStore } from './authStore';
import { PlatformUser } from './rbacTypes';
import { productRepository } from './repositories/productRepository';
import { userService } from './services/userService';

export const platformRouter = Router();

const authRateBuckets = new Map<string, { count: number; resetAt: number }>();
function authRateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown').slice(0, 80);
    const key = `${req.path}:${ip}`; const now = Date.now();
    let bucket = authRateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) { bucket = { count: 0, resetAt: now + windowMs }; authRateBuckets.set(key, bucket); }
    bucket.count += 1;
    if (bucket.count > maxRequests) return res.status(429).json({ success: false, error: 'Too many requests. Please wait and try again.' });
    if (authRateBuckets.size > 5000) for (const [k, v] of authRateBuckets) if (v.resetAt <= now) authRateBuckets.delete(k);
    next();
  };
}
const passwordResetLimiter = authRateLimit(5, 15 * 60 * 1000);
const accountActivationLimiter = authRateLimit(8, 15 * 60 * 1000);

function getSessionToken(req: Request): string | undefined {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return req.headers['x-session-token'] as string | undefined;
}

const UNAUTHENTICATED_ACTOR: PlatformUser = {
  id: 'usr-unauthenticated',
  email: 'unauthenticated@toriwear.com',
  name: 'Unauthenticated Guest',
  role: 'STAFF',
  department: 'Customer Support',
  accountStatus: 'DEACTIVATED',
  twoFactorEnabled: false,
  createdBy: 'SYSTEM',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  permissions: {
    dashboard: [],
    products: [],
    inventory: [],
    orders: [],
    customers: [],
    customerSupport: [],
    marketing: [],
    catalog: [],
    shipping: [],
    finance: [],
    reports: [],
    communication: [],
    meetings: [],
    aiDesignLab: [],
    website: [],
    staff: [],
    security: [],
    settings: [],
    superAdmin: [],
  },
  activeSessions: [],
};

// Helper to extract actor strictly from validated session token (persistent PG + authStore)
async function getActorAsync(req: Request): Promise<PlatformUser> {
  const token = getSessionToken(req);
  if (token) {
    const user = await authStore.getUserByTokenAsync(token);
    if (user && user.role !== ('CUSTOMER' as any)) return user;
    const session = await userService.validateSession(token);
    if (session && session.user.role !== 'CUSTOMER') {
      const mapped = userStore.getUserById(session.user.id);
      if (mapped) return mapped;
    }
  }
  return UNAUTHENTICATED_ACTOR;
}

function getActor(req: Request): PlatformUser {
  if ((req as any)._platformActor) {
    return (req as any)._platformActor as PlatformUser;
  }
  // Protected production routes must use the actor resolved by the async
  // persistent-session guard above; do not fall back to process-memory tokens.
  if (process.env.NODE_ENV === 'production') return UNAUTHENTICATED_ACTOR;
  const token = getSessionToken(req);
  if (token) {
    const user = authStore.getUserByToken(token);
    if (user) return user;
  }
  return UNAUTHENTICATED_ACTOR;
}

// ----------------------------------------------------
// 0. PLATFORM AUTHORIZATION MIDDLEWARE GUARD
// ----------------------------------------------------
const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/signin',
  '/auth/verify-2fa',
  '/auth/2fa/verify',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/activate-account',
];

platformRouter.use(async (req: Request, res: Response, next) => {
  // Allow strictly whitelisted public unauthenticated authentication routes
  if (PUBLIC_AUTH_PATHS.some(p => req.path === p || req.path.startsWith('/auth/login') || req.path.startsWith('/auth/verify-2fa') || req.path.startsWith('/auth/2fa/verify') || req.path.startsWith('/auth/forgot-password') || req.path.startsWith('/auth/reset-password') || req.path.startsWith('/auth/activate-account'))) {
    return next();
  }

  // /auth/me handles its own 401 response if unauthenticated
  if (req.path === '/auth/me' || req.path === '/auth/current-user') {
    const actor = await getActorAsync(req);
    (req as any)._platformActor = actor;
    return next();
  }

  const actor = await getActorAsync(req);
  if (actor.id === 'usr-unauthenticated') {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHENTICATED',
      error: 'Authentication required. Valid session required.',
    });
  }

  (req as any)._platformActor = actor;
  next();
});

// ----------------------------------------------------
// 1. AUTHENTICATION & CREDENTIALS SYSTEM
// ----------------------------------------------------

// Primary secure login with Email or User/Staff ID
platformRouter.post(['/auth/login', '/auth/signin'], async (req: Request, res: Response) => {
  const identifier = req.body.identifier || req.body.email || req.body.username || req.body.userId;
  const password = req.body.password;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: 'Email/User ID and password are required.' });
  }

  const clientInfo = {
    ip: (req.ip || req.socket.remoteAddress || '103.21.144.12').replace('::ffff:', ''),
    userAgent: req.headers['user-agent'] as string,
  };

  const result = await authStore.authenticate(identifier, password, clientInfo);
  if (!result.success) {
    return res.status(401).json(result);
  }

  return res.json(result);
});

// Verify 2FA challenge code (RFC 6238 TOTP or single-use recovery code)
platformRouter.post(['/auth/verify-2fa', '/auth/2fa/verify'], async (req: Request, res: Response) => {
  const tempToken = req.body.tempToken || req.body.token || req.body.challengeToken;
  const rawCode = req.body.code || req.body.twoFactorCode || req.body.passcode || req.body.otp || req.body.recoveryCode;

  if (!tempToken || !rawCode) {
    return res.status(400).json({ success: false, error: '2FA challenge token and verification code are required.' });
  }

  const cleanCode = String(rawCode).trim().replace(/[\s-]/g, '');
  const rawClientTs = req.body.clientTimestamp || req.body.timestamp || (req.headers['x-client-timestamp'] ? Number(req.headers['x-client-timestamp']) : undefined);

  const clientInfo = {
    ip: (req.ip || req.socket.remoteAddress || '103.21.144.12').replace('::ffff:', ''),
    userAgent: req.headers['user-agent'] as string,
    clientTimestamp: typeof rawClientTs === 'number' && !isNaN(rawClientTs) ? rawClientTs : undefined,
  };

  const result = await authStore.verify2FA(tempToken, cleanCode, clientInfo);
  if (!result.success) {
    return res.status(401).json(result);
  }

  return res.json(result);
});

// Logout and invalidate session
platformRouter.post('/auth/logout', (req: Request, res: Response) => {
  const token = getSessionToken(req);
  if (token) {
    authStore.revokeSession(token);
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// Current Authenticated User & Session Verification
platformRouter.get('/auth/me', async (req: Request, res: Response) => {
  const actor = await getActorAsync(req);
  if (actor && actor.id !== 'usr-unauthenticated') {
    await authStore.loadUser2FASetting(actor.id);
    const refreshed = userStore.getUserById(actor.id) || actor;
    return res.json({
      success: true,
      authenticated: true,
      user: refreshed,
    });
  }

  return res.status(401).json({
    success: false,
    authenticated: false,
    error: 'Not authenticated. Valid session required.',
  });
});

platformRouter.get('/auth/current-user', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.id === 'usr-unauthenticated') {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated.',
    });
  }
  return res.json({
    success: true,
    user: actor,
    allPartners: userStore.getPartners(),
  });
});

// Forgot Password - Issue secure single-use reset token
platformRouter.post('/auth/forgot-password', passwordResetLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email address is required.' });
  }

  const result = await authStore.createPasswordResetToken(email);
  return res.json(result);
});

// Reset Password with Cryptographic Token
platformRouter.post('/auth/reset-password', passwordResetLimiter, async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ success: false, error: 'Reset token and new password are required.' });
  }

  const result = await authStore.resetPasswordWithToken(token, newPassword);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// Change Password for Authenticated User
platformRouter.post('/auth/change-password', (req: Request, res: Response) => {
  const actor = getActor(req);
  const token = getSessionToken(req);
  const { currentPassword, newPassword, logoutOtherSessions } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Current password and new password are required.' });
  }

  const result = authStore.changePassword(
    actor.id,
    currentPassword,
    newPassword,
    Boolean(logoutOtherSessions),
    token
  );

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// Active Sessions List
platformRouter.get('/auth/sessions', (req: Request, res: Response) => {
  const actor = getActor(req);
  return res.json({
    success: true,
    sessions: actor.activeSessions || [],
  });
});

// Revoke Specific Session
platformRouter.post('/auth/sessions/:sessionId/revoke', (req: Request, res: Response) => {
  const actor = getActor(req);
  const { sessionId } = req.params;

  actor.activeSessions = (actor.activeSessions || []).filter((s) => s.sessionId !== sessionId);
  auditStore.record({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    module: 'auth',
    action: 'SESSION_REVOKED_BY_USER',
    recordAffected: actor.email,
    newValue: `Session ${sessionId} terminated by user`,
    ipAddress: (req.ip || '103.21.144.12').replace('::ffff:', ''),
    severity: 'INFO',
  });

  return res.json({ success: true });
});

// Revoke All Other Sessions
platformRouter.post('/auth/sessions/revoke-others', (req: Request, res: Response) => {
  const actor = getActor(req);
  const token = getSessionToken(req);

  authStore.revokeAllUserSessions(actor.id, token);
  return res.json({ success: true, message: 'All other active sessions have been terminated.' });
});

// Two-Factor Authentication Setup / Enrollment: Start
const ENROLL_START_PATHS = [
  '/auth/setup-2fa',
  '/auth/enroll',
  '/auth/enrol',
  '/auth/2fa/enroll',
  '/auth/2fa/setup',
  '/auth/enroll-2fa',
];

platformRouter.post(ENROLL_START_PATHS, async (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.id === 'usr-unauthenticated') {
    return res.status(401).json({ success: false, code: 'UNAUTHENTICATED', error: 'Active authenticated session required to initiate 2FA enrollment.' });
  }

  const result = await authStore.start2FASetup(actor.id);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.json(result);
});

// Two-Factor Authentication Setup / Enrollment: Confirm & Activate
const ENROLL_CONFIRM_PATHS = [
  '/auth/confirm-2fa',
  '/auth/confirm-enrollment',
  '/auth/confirm-enrolment',
  '/auth/2fa/confirm',
  '/auth/enroll/confirm',
  '/auth/2fa/verify-enrollment',
];

platformRouter.post(ENROLL_CONFIRM_PATHS, async (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.id === 'usr-unauthenticated') {
    return res.status(401).json({ success: false, code: 'UNAUTHENTICATED', error: 'Active authenticated session required to confirm 2FA enrollment.' });
  }

  const rawCode = req.body.code || req.body.twoFactorCode || req.body.otp || req.body.passcode;
  const cleanCode = rawCode ? String(rawCode).trim().replace(/[\s-]/g, '') : '';

  if (!cleanCode || !/^\d{6}$/.test(cleanCode)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid 6-digit verification code.' });
  }

  const clientInfo = {
    ip: (req.ip || req.socket.remoteAddress || '103.21.144.12').replace('::ffff:', ''),
    userAgent: req.headers['user-agent'] as string,
  };

  const result = await authStore.confirm2FASetup(actor.id, cleanCode, clientInfo);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json({
    success: true,
    message: 'Two-factor authentication verified and enabled successfully.',
    recoveryCodes: result.recoveryCodes,
    sessionToken: result.sessionToken,
    user: result.user,
  });
});

platformRouter.post('/auth/disable-2fa', async (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.id === 'usr-unauthenticated') {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  const { currentPassword } = req.body;
  const result = await authStore.disable2FA(actor.id, currentPassword);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json({ success: true, message: 'Two-factor authentication disabled.' });
});

// User Account Invitation Link
platformRouter.post('/auth/invite-user', accountActivationLimiter, async (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'PARTNER') {
    return res.status(403).json({ success: false, error: 'Only Super Admin or Partners can issue user invitations.' });
  }

  const { userId } = req.body;
  try {
    const invite = process.env.NODE_ENV === 'production'
      ? await authStore.createInvitationTokenPersistent(userId)
      : authStore.createInvitationToken(userId);
    return res.json({ success: true, ...invite });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Unable to issue invitation.' });
  }
});

// Activate Account from Invitation Link
platformRouter.post('/auth/activate-account', accountActivationLimiter, async (req: Request, res: Response) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ success: false, error: 'Activation token and password are required.' });
  }

  const result = process.env.NODE_ENV === 'production'
    ? await authStore.activateAccountWithPersistentToken(token, password)
    : authStore.activateAccountWithToken(token, password);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// Switch active user (strictly Super Admin in non-production only)
platformRouter.post('/auth/switch-user', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (process.env.NODE_ENV === 'production' || actor.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      error: 'User switching requires Super Admin authority and is disabled in production.',
    });
  }
  const { userId } = req.body;
  const target = userStore.getUserById(userId);
  if (!target) {
    return res.status(404).json({ success: false, error: 'User account not found.' });
  }

  auditStore.record({
    userId: target.id,
    userName: target.name,
    userRole: target.role,
    module: 'auth',
    action: 'SESSION_SWITCHED',
    recordAffected: `${target.name} (${target.role})`,
    newValue: `Active session perspective switched to ${target.email}`,
    ipAddress: (req.ip || '103.21.144.12').replace('::ffff:', ''),
    severity: 'INFO',
  });

  return res.json({
    success: true,
    user: target,
  });
});

// ----------------------------------------------------
// 2. USER MANAGEMENT: PARTNERS & STAFF
// ----------------------------------------------------

// List all platform users
platformRouter.get('/users', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'PARTNER') {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      error: 'Access Denied: Only Super Admin or Partners can list platform staff and partner accounts.',
    });
  }
  const { role, department } = req.query;
  let users = userStore.getAllUsers();

  if (role && typeof role === 'string' && role !== 'ALL') {
    users = users.filter(u => u.role === role);
  }
  if (department && typeof department === 'string' && department !== 'ALL') {
    users = users.filter(u => u.department === department);
  }

  return res.json({
    success: true,
    users,
    partners: userStore.getPartners(),
    staff: userStore.getStaff(),
  });
});

// --- Partner Management (Super Admin Mohammed Saif Only) ---

platformRouter.post('/users/partners', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: Only Super Admin (Mohammed Saif) can create partner accounts.',
    });
  }

  const { name, email, phone, roleDesignation, department } = req.body;
  if (!name || !email || !roleDesignation) {
    return res.status(400).json({ success: false, error: 'Missing required partner fields (name, email, roleDesignation).' });
  }

  const result = userStore.createPartner({
    name,
    email,
    phone,
    roleDesignation,
    department,
    actor,
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.status(201).json(result);
});

platformRouter.put('/users/partners/:id', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: Only Super Admin (Mohammed Saif) can modify partner accounts.',
    });
  }

  const partnerId = String(req.params.id || '');
  const updates = req.body;

  const result = userStore.updatePartner(partnerId, updates, actor);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json({ success: true, partner: userStore.getUserById(partnerId) });
});

platformRouter.put('/users/partners/:id/permissions', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (!userStore.isRootSuperAdmin(actor)) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      error: 'Access Denied: Only Super Admin (Mohammed Saif) can grant or revoke partner admin access.',
    });
  }

  const partnerId = String(req.params.id || '');
  const { permissions, adminAccessTier, preset } = req.body || {};

  const result = userStore.updatePartnerPermissions(
    partnerId,
    permissions,
    adminAccessTier,
    actor,
    preset === 'FULL_ADMIN' || preset === 'STANDARD_PARTNER' || preset === 'EXEC_VIEW_ONLY'
      ? preset
      : undefined
  );

  if (!result.success) {
    return res.status(result.statusCode || 400).json({
      success: false,
      error: result.error,
    });
  }

  return res.json({
    success: true,
    partner: result.partner,
    message: `Updated admin access permissions for ${result.partner?.name || 'partner'}.`,
  });
});

platformRouter.post('/users/partners/:id/deactivate', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: Only Super Admin (Mohammed Saif) can deactivate partner accounts.',
    });
  }

  const partnerId = String(req.params.id || '');
  const result = userStore.deactivatePartner(partnerId, actor);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json({ success: true, partner: userStore.getUserById(partnerId) });
});

// --- Staff Management (Super Admin & Authorized Partners) ---

platformRouter.post('/users/staff', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'PARTNER') {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: Only Super Admin or Partners can create staff accounts.',
    });
  }

  const { name, email, phone, department, designation, permissions } = req.body;
  if (!name || !email || !department || !designation) {
    return res.status(400).json({ success: false, error: 'Missing required staff fields.' });
  }

  const result = userStore.createStaff({
    name,
    email,
    phone,
    department,
    designation,
    permissions,
    actor,
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.status(201).json(result);
});

platformRouter.put('/users/staff/:id', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'PARTNER') {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: Only Super Admin or Partners can edit staff accounts.',
    });
  }

  const staffId = String(req.params.id || '');
  const result = userStore.updateStaff(staffId, req.body, actor);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json({ success: true, staff: userStore.getUserById(staffId) });
});

platformRouter.post('/users/staff/:id/deactivate', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'PARTNER') {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: Only Super Admin or Partners can deactivate staff accounts.',
    });
  }

  const staffId = String(req.params.id || '');
  const result = userStore.deactivateStaff(staffId, actor);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json({ success: true, staff: userStore.getUserById(staffId) });
});

// --- Super Admin Control Center Operations (Super Admin + Elevated Authorized Partners) ---

function canManageTargetCredentials(actor: PlatformUser, targetUserId: string): { allowed: boolean; reason?: string } {
  if (userStore.isRootSuperAdmin(actor)) return { allowed: true };
  if (actor.id === targetUserId) return { allowed: true };

  const target = userStore.getUserById(targetUserId);
  if (!target) return { allowed: false, reason: 'Target account not found.' };

  if (userStore.isRootSuperAdmin(target) || target.role === 'PARTNER') {
    return {
      allowed: false,
      reason: 'Protection rule: Only Mohammed Saif (Super Admin) can manage Super Admin or fellow Partner credentials and sessions.',
    };
  }

  const hasElevatedAccess =
    actor.role === 'PARTNER' &&
    (userStore.hasAdminCapability(actor, 'superAdmin', 'edit') ||
      userStore.hasAdminCapability(actor, 'staff', 'edit') ||
      userStore.hasAdminCapability(actor, 'security', 'edit'));

  if (!hasElevatedAccess) {
    return {
      allowed: false,
      reason: 'Access Denied: Super Admin Control Center or elevated Partner admin privilege required.',
    };
  }

  return { allowed: true };
}

platformRouter.post('/users/:id/force-logout', (req: Request, res: Response) => {
  const actor = getActor(req);
  const targetUserId = String(req.params.id || '');
  const result = userStore.forceLogoutUser(targetUserId, actor);
  if (!result.success) {
    return res.status(result.statusCode || 400).json({ success: false, error: result.error });
  }

  return res.json({ success: true, message: 'User active sessions revoked and forced to logout.' });
});

platformRouter.post('/users/:id/reset-2fa', async (req: Request, res: Response) => {
  const actor = getActor(req);
  const targetUserId = String(req.params.id || '');
  const result = userStore.resetUser2FA(targetUserId, actor);
  if (!result.success) {
    return res.status(result.statusCode || 400).json({ success: false, error: result.error });
  }

  await authStore.disable2FA(targetUserId).catch(() => {});

  return res.json({ success: true, message: 'Two-factor authentication reset successfully.' });
});

// Direct Password Management for Super Admin & Elevated Partners (staff/self only)
platformRouter.post('/users/:id/admin-set-password', async (req: Request, res: Response) => {
  const actor = getActor(req);
  const targetUserId = String(req.params.id || '');
  const check = canManageTargetCredentials(actor, targetUserId);
  if (!check.allowed) {
    return res.status(403).json({
      success: false,
      error: check.reason || 'Access Denied: Super Admin privilege required to manage partner/staff passwords.',
    });
  }

  const { newPassword, requireChangeOnNextLogin } = req.body;
  const result = await authStore.adminResetUserPassword(
    targetUserId,
    newPassword,
    requireChangeOnNextLogin ?? false,
    actor
  );

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// Reissue Single-Use Recovery Codes for Super Admin & Elevated Partners (staff/self only)
platformRouter.post('/users/:id/admin-reissue-recovery-codes', async (req: Request, res: Response) => {
  const actor = getActor(req);
  const targetUserId = String(req.params.id || '');
  const check = canManageTargetCredentials(actor, targetUserId);
  if (!check.allowed) {
    return res.status(403).json({
      success: false,
      error: check.reason || 'Access Denied: Super Admin privilege required to reissue recovery codes.',
    });
  }

  const result = await authStore.adminReissueRecoveryCodes(targetUserId, actor);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// View Credential & Recovery Codes Details
platformRouter.get('/users/:id/credential-details', async (req: Request, res: Response) => {
  const actor = getActor(req);
  const targetUserId = String(req.params.id || '');
  const check = canManageTargetCredentials(actor, targetUserId);
  if (!check.allowed) {
    return res.status(403).json({
      success: false,
      error: check.reason || 'Access Denied: Super Admin privilege required to view partner/staff credential details.',
    });
  }

  const result = await authStore.getUserCredentialDetails(targetUserId);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

platformRouter.get('/security/policies', (req: Request, res: Response) => {
  const actor = getActor(req);
  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'PARTNER') {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      error: 'Access Denied: Security policies require Super Admin or Partner authority.',
    });
  }
  return res.json({
    success: true,
    policies: userStore.getSecurityPolicies(),
  });
});

platformRouter.put('/security/policies', (req: Request, res: Response) => {
  const actor = getActor(req);
  const result = userStore.updateSecurityPolicies(req.body, actor);
  if (!result.success) {
    return res.status(result.statusCode || 400).json({ success: false, error: result.error });
  }

  return res.json({
    success: true,
    policies: userStore.getSecurityPolicies(),
  });
});

// ----------------------------------------------------
// 3. IMMUTABLE AUDIT LOGS
// ----------------------------------------------------

platformRouter.get('/audit-logs', (req: Request, res: Response) => {
  const actor = getActor(req);
  // Ordinary staff cannot view the complete security audit trail
  if (actor.role === 'STAFF') {
    const hasAuditPerm = actor.permissions?.reports?.includes('view');
    if (!hasAuditPerm) {
      return res.status(403).json({ success: false, error: 'Access Denied: Insufficient permissions to view enterprise audit log.' });
    }
  }

  const { module, role, severity, search, limit } = req.query;
  const logs = auditStore.getLogs({
    module: typeof module === 'string' ? module : undefined,
    role: typeof role === 'string' ? role : undefined,
    severity: typeof severity === 'string' ? severity : undefined,
    search: typeof search === 'string' ? search : undefined,
    limit: limit ? parseInt(limit as string, 10) : 250,
  });

  return res.json({
    success: true,
    count: logs.length,
    logs,
  });
});

// ----------------------------------------------------
// 4. STAFF APPROVAL WORKFLOW
// ----------------------------------------------------

platformRouter.get('/approvals', async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const reviewProducts = await productRepository.getAll({ status: 'REVIEW' });
    for (const prod of reviewProducts) {
      approvalStore.syncProductReviewRequest({
        product: prod,
        actor: actor.id !== 'usr-unauthenticated' ? actor : { id: 'usr-system', name: 'Catalog Workflow', role: 'STAFF' },
      });
    }
  } catch (err) {
    console.warn('[APPROVALS] Failed to backfill REVIEW products:', err);
  }

  const items = approvalStore.getAll();
  res.json({
    success: true,
    approvals: items,
  });
});

platformRouter.post('/approvals', (req: Request, res: Response) => {
  const actor = getActor(req);
  const { type, title, description, amount, dataPayload, status } = req.body;

  if (!type || !title || !description) {
    return res.status(400).json({ success: false, error: 'Type, title, and description are required.' });
  }

  const created = approvalStore.createRequest({
    type,
    title,
    description,
    amount,
    dataPayload,
    status: status || 'SUBMITTED',
    actor,
  });

  return res.status(201).json({ success: true, request: created });
});

platformRouter.post('/approvals/:id/review', async (req: Request, res: Response) => {
  const actor = getActor(req);
  const { decision, comment } = req.body;

  if (decision !== 'APPROVED' && decision !== 'REJECTED') {
    return res.status(400).json({ success: false, error: 'Decision must be APPROVED or REJECTED.' });
  }

  const result = approvalStore.reviewRequest(String(req.params.id || ''), decision, comment || '', actor);
  if (!result.success) return res.status(403).json(result);

  let updatedProductStatus: string | undefined;
  if (result.request?.type === 'PRODUCT_CREATION' && result.request.dataPayload?.productId) {
    try {
      const prod = await productRepository.findById(result.request.dataPayload.productId);
      if (prod) {
        prod.status = decision === 'APPROVED' ? 'APPROVED' : 'DRAFT';
        await productRepository.save(prod);
        updatedProductStatus = prod.status;
      }
    } catch (err) {
      console.warn('[APPROVALS] Failed to update linked product status after review:', err);
    }
  }

  return res.json({ ...result, updatedProductStatus });
});

// Void / Reversal (Financial records cannot be deleted; voiding preserves audit integrity)
platformRouter.post('/approvals/:id/void', (req: Request, res: Response) => {
  const actor = getActor(req);
  const { voidReason } = req.body;

  if (!voidReason) {
    return res.status(400).json({ success: false, error: 'A mandatory reason is required to void/reverse a record.' });
  }

  const result = approvalStore.voidRecord(String(req.params.id || ''), voidReason, actor);
  if (!result.success) return res.status(403).json(result);

  return res.json(result);
});

// ----------------------------------------------------
// 5. INTERNAL COMMUNICATION: CHAT & MEETINGS
// ----------------------------------------------------

platformRouter.get('/communication/channels', (req: Request, res: Response) => {
  const actor = getActor(req);
  const channels = communicationStore.getChannelsForUser(actor);
  res.json({
    success: true,
    channels,
  });
});

platformRouter.post('/communication/channels', (req: Request, res: Response) => {
  const actor = getActor(req);
  const { name, description, type, allowedRoles, allowedDepartments, memberIds, isE2EE } = req.body;

  if (!name || !description || !type) {
    return res.status(400).json({ success: false, error: 'Channel name, description, and type are required.' });
  }

  const result = communicationStore.createChannel({
    name,
    description,
    type,
    allowedRoles,
    allowedDepartments,
    memberIds,
    isE2EE,
    actor,
  });

  if (!result.success) return res.status(403).json(result);
  return res.status(201).json(result);
});

platformRouter.get('/communication/messages', (req: Request, res: Response) => {
  const actor = getActor(req);
  const { channelId, directRecipientId, search } = req.query;

  let directPair: { userA: string; userB: string } | undefined = undefined;
  if (directRecipientId && typeof directRecipientId === 'string') {
    directPair = {
      userA: actor.id,
      userB: directRecipientId,
    };
  }

  const messages = communicationStore.getMessages({
    channelId: typeof channelId === 'string' ? channelId : undefined,
    directPair,
    searchQuery: typeof search === 'string' ? search : undefined,
  });

  res.json({
    success: true,
    messages,
  });
});

platformRouter.post('/communication/messages', (req: Request, res: Response) => {
  const actor = getActor(req);
  const { channelId, directRecipientId, content, attachments, isEncrypted, encryptedPayload } = req.body;

  if (!content && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ success: false, error: 'Message content or attachment is required.' });
  }

  const result = communicationStore.postMessage({
    channelId,
    directRecipientId,
    content: content || '',
    attachments,
    isEncrypted,
    encryptedPayload,
    actor,
  });

  if (!result.success) return res.status(400).json(result);
  return res.status(201).json(result);
});

platformRouter.post('/communication/messages/:id/reaction', (req: Request, res: Response) => {
  const actor = getActor(req);
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ success: false, error: 'Emoji is required.' });

  const ok = communicationStore.addReaction(String(req.params.id || ''), emoji, actor);
  return res.json({ success: ok });
});

// Meetings
platformRouter.get('/communication/meetings', (_req: Request, res: Response) => {
  const meetings = communicationStore.getMeetings();
  res.json({
    success: true,
    meetings,
  });
});

platformRouter.post('/communication/meetings', (req: Request, res: Response) => {
  const actor = getActor(req);
  const { title, agenda, description, scheduledStartTime, scheduledEndTime, participantIds } = req.body;

  if (!title || !scheduledStartTime) {
    return res.status(400).json({ success: false, error: 'Title and scheduledStartTime are required.' });
  }

  const result = communicationStore.createMeeting({
    title,
    agenda: agenda || '',
    description: description || '',
    scheduledStartTime,
    scheduledEndTime,
    participantIds: participantIds || [],
    actor,
  });

  return res.status(201).json(result);
});

platformRouter.put('/communication/meetings/:id/status', (req: Request, res: Response) => {
  const actor = getActor(req);
  const { status } = req.body;

  const result = communicationStore.updateMeetingStatus(String(req.params.id || ''), status, actor);
  if (!result.success) return res.status(400).json(result);

  return res.json(result);
});
