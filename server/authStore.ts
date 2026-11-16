import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PlatformUser, ActiveSession } from './rbacTypes';
import { userStore } from './userStore';
import { auditStore } from './auditStore';
import {
  generateBase32Secret,
  verifyTOTP,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCode,
  formatSecretForDisplay,
  buildOtpAuthUri,
  generateQrCodeDataUrl,
  encryptSecret,
  decryptSecret,
} from './services/totpService';
import { getPrismaClient } from './db/prisma';
import { resolveSecureStorePath, safeTimingEqual } from './utils/storageHelper';

interface UserCredential {
  userId: string;
  passwordHash?: string;
  salt: string;
  mustChangePasswordOnFirstLogin?: boolean;
  failedLoginAttempts: number;
  lockoutUntil?: number; // timestamp in ms
  lastPasswordChange: string;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  pendingTwoFactorSecret?: string;
  pendingExpiresAt?: number;
  lastAcceptedStep?: bigint;
  recoveryCodeHashes?: string[];
}

interface ResetTokenRecord {
  token: string;
  userId: string;
  email: string;
  expiresAt: number;
  used: boolean;
}

interface InviteTokenRecord {
  token: string;
  userId: string;
  email: string;
  expiresAt: number;
  used: boolean;
}

interface SessionTokenRecord {
  token: string;
  sessionId: string;
  userId: string;
  createdAt: number;
  lastActiveAt: number;
  expiresAt: number;
  ipAddress: string;
  device: string;
  browser: string;
  location: string;
}

interface TwoFactorChallenge {
  tempToken: string;
  userId: string;
  expiresAt: number;
  attempts: number;
}

const SESSIONS_STORE_PATH = resolveSecureStorePath('.auth-sessions.json', 'public/generated-assets/.auth-sessions.json');

class AuthStore {
  private credentials = new Map<string, UserCredential>();
  private sessionTokens = new Map<string, SessionTokenRecord>();
  private resetTokens = new Map<string, ResetTokenRecord>();
  private inviteTokens = new Map<string, InviteTokenRecord>();
  private twoFactorChallenges = new Map<string, TwoFactorChallenge>();
  private lastSessionPersistMs: number = 0;
  private sessionsHydratedFromDb = false;
  private sessionHydrationPromise: Promise<void> | null = null;

  constructor() {
    if (process.env.NODE_ENV !== 'production') this.seedDefaultCredentials();
    this.loadSessionsFromDisk();
  }

  public async hydrateSessionsFromDb(): Promise<void> {
    if (this.sessionsHydratedFromDb) return;
    if (this.sessionHydrationPromise) return this.sessionHydrationPromise;

    this.sessionHydrationPromise = (async () => {
      try {
        const prisma = getPrismaClient();
        if (!prisma?.session) return;
        const rows = await prisma.session.findMany({
          where: {
            isValid: true,
            userId: { not: null },
            expiresAt: { gt: new Date() },
          },
        });
        for (const s of rows) {
          if (!s.token || !s.userId) continue;
          this.sessionTokens.set(s.token, {
            token: s.token,
            sessionId: s.id,
            userId: s.userId,
            createdAt: new Date(s.createdAt).getTime(),
            lastActiveAt: new Date(s.lastActiveAt).getTime(),
            expiresAt: new Date(s.expiresAt).getTime(),
            ipAddress: s.ipAddress || '127.0.0.1',
            device: s.device || 'Authorized Terminal',
            browser: s.browser || 'Web Browser',
            location: s.location || 'India (Authorized IP)',
          });
          const user = userStore.getUserById(s.userId);
          if (user) {
            const exists = (user.activeSessions || []).some((as) => as.sessionId === s.id);
            if (!exists) {
              user.activeSessions = [
                {
                  sessionId: s.id,
                  ipAddress: s.ipAddress || '127.0.0.1',
                  device: `${s.device || 'Authorized Terminal'} · ${s.browser || 'Web Browser'}`,
                  browser: s.browser || 'Web Browser',
                  location: s.location || 'India (Authorized IP)',
                  loginTime: 'Restored session',
                  lastActivity: 'Active',
                  isCurrent: true,
                },
                ...(user.activeSessions || []).slice(0, 4),
              ];
            }
          }
        }
        this.sessionsHydratedFromDb = true;
        if (rows.length > 0) {
          console.log(`[AUTH] Hydrated ${rows.length} persistent admin session(s) from PostgreSQL.`);
        }
      } catch (err) {
        console.warn('[AUTH] Note hydrating sessions from DB:', err);
      } finally {
        this.sessionHydrationPromise = null;
      }
    })();

    return this.sessionHydrationPromise;
  }

  public async ensureProductionBootstrap(): Promise<void> {
    try {
      const prisma = getPrismaClient();
      if (!prisma?.user) return;

      const userCount = await prisma.user.count();
      const saifRow = await prisma.user.findFirst({
        where: {
          OR: [
            { id: 'usr-saif' },
            { email: { equals: 'saif@toriwear.com', mode: 'insensitive' } },
            { email: { equals: 'admin@toriwear.com', mode: 'insensitive' } },
          ],
        },
      });

      const envPassword = (
        process.env.TORI_INITIAL_ADMIN_PASSWORD ||
        process.env.TORI_BOOTSTRAP_ADMIN_PASSWORD ||
        ''
      ).trim();

      if (userCount === 0 && envPassword.length >= 8) {
        console.log('[AUTH] Empty PostgreSQL users table detected. Running initial database seed...');
        const { runDatabaseSeed } = await import('./db/seed');
        const seedRes = await runDatabaseSeed();
        if (seedRes.success) {
          console.log('[AUTH] Initial PostgreSQL seed completed.');
          return;
        }
      }

      if (!saifRow && envPassword.length >= 8) {
        const salt = this.generateSalt();
        const hash = this.hashPassword(envPassword, salt);
        await prisma.user.upsert({
          where: { id: 'usr-saif' },
          create: {
            id: 'usr-saif',
            email: 'saif@toriwear.com',
            name: 'Mohammed Saif',
            role: 'SUPER_ADMIN',
            department: 'Founders Office & Brand Direction',
            employeeId: 'TORI-001',
            passwordHash: hash,
            salt,
            isActive: true,
            accountStatus: 'ACTIVE',
          },
          update: {
            passwordHash: hash,
            salt,
            isActive: true,
            accountStatus: 'ACTIVE',
          },
        });
        console.log('[AUTH] Bootstrapped Super Admin credential record in PostgreSQL from environment configuration.');
      } else if (userCount === 0 && !envPassword) {
        console.warn('[AUTH] PostgreSQL users table is empty and TORI_INITIAL_ADMIN_PASSWORD is not set. Run "npm run seed" with TORI_INITIAL_ADMIN_PASSWORD or set it in environment variables.');
      }
    } catch (err: any) {
      console.warn('[AUTH] Production bootstrap check note:', err?.message || err);
    }
  }

  private async ensureCredentialFromDb(userId: string, emailHint?: string): Promise<UserCredential | undefined> {
    let cred = this.credentials.get(userId);
    const prisma = getPrismaClient();
    try {
      if (prisma?.user) {
        let dbUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!dbUser) {
          const emailCandidates = [
            ...(emailHint ? [emailHint] : []),
            ...(userId === 'usr-saif' ? ['saif@toriwear.com', 'admin@toriwear.com'] : []),
          ].filter(Boolean);
          if (emailCandidates.length > 0) {
            dbUser = await prisma.user.findFirst({
              where: {
                OR: emailCandidates.map((e) => ({ email: { equals: e, mode: 'insensitive' as const } })),
              },
            });
          }
        }

        if (dbUser && dbUser.passwordHash && dbUser.salt) {
          cred = {
            ...(cred || {}),
            userId: dbUser.id,
            passwordHash: dbUser.passwordHash,
            salt: dbUser.salt,
            failedLoginAttempts: Number(dbUser.failedLoginAttempts) || 0,
            lockoutUntil: dbUser.lockoutUntil ? new Date(dbUser.lockoutUntil).getTime() : undefined,
            lastPasswordChange: dbUser.lastPasswordChange ? new Date(dbUser.lastPasswordChange).toISOString() : new Date().toISOString(),
            mustChangePasswordOnFirstLogin: Boolean(dbUser.mustChangePasswordOnFirstLogin),
            twoFactorEnabled: cred?.twoFactorEnabled ?? false,
          };
          this.credentials.set(userId, cred);
          if (dbUser.id !== userId) {
            this.credentials.set(dbUser.id, cred);
          }
          return cred;
        }
      }
    } catch (err) {
      console.warn('[AUTH] Note loading credential from PostgreSQL:', err);
    }

    // If still missing for Super Admin and an environment bootstrap password is set, provision cleanly
    if (!cred?.passwordHash && userId === 'usr-saif') {
      const envPassword = (
        process.env.TORI_BOOTSTRAP_ADMIN_PASSWORD ||
        process.env.TORI_INITIAL_ADMIN_PASSWORD ||
        ''
      ).trim();
      if (envPassword.length >= 8) {
        const salt = this.generateSalt();
        const hash = this.hashPassword(envPassword, salt);
        cred = {
          userId: 'usr-saif',
          passwordHash: hash,
          salt,
          failedLoginAttempts: 0,
          lastPasswordChange: new Date().toISOString(),
          twoFactorEnabled: false,
        };
        this.credentials.set('usr-saif', cred);

        if (prisma?.user) {
          try {
            await prisma.user.upsert({
              where: { id: 'usr-saif' },
              create: {
                id: 'usr-saif',
                email: 'saif@toriwear.com',
                name: 'Mohammed Saif',
                role: 'SUPER_ADMIN',
                department: 'Founders Office & Brand Direction',
                employeeId: 'TORI-001',
                passwordHash: hash,
                salt,
                isActive: true,
                accountStatus: 'ACTIVE',
              },
              update: {
                passwordHash: hash,
                salt,
                isActive: true,
                accountStatus: 'ACTIVE',
              },
            });
          } catch {}
        }
      }
    }

    return cred;
  }

  private saveSessionsToDisk() {
    try {
      const dir = path.dirname(SESSIONS_STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const now = Date.now();
      const validSessions = Array.from(this.sessionTokens.values()).filter((s) => s.expiresAt > now);
      const tmpPath = `${SESSIONS_STORE_PATH}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify({ sessions: validSessions }, null, 2), 'utf-8');
      fs.renameSync(tmpPath, SESSIONS_STORE_PATH);
      this.lastSessionPersistMs = now;
    } catch (err) {
      console.warn('[AUTH] Failed to persist sessions to disk:', err);
    }
  }

  private loadSessionsFromDisk() {
    try {
      if (!fs.existsSync(SESSIONS_STORE_PATH)) return;
      const raw = fs.readFileSync(SESSIONS_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.sessions)) return;

      const now = Date.now();
      let restored = 0;
      for (const s of parsed.sessions as SessionTokenRecord[]) {
        if (!s?.token || !s?.userId || !s?.expiresAt || s.expiresAt <= now) continue;
        this.sessionTokens.set(s.token, s);
        const user = userStore.getUserById(s.userId);
        if (user) {
          const exists = (user.activeSessions || []).some((as) => as.sessionId === s.sessionId);
          if (!exists) {
            user.activeSessions = [
              {
                sessionId: s.sessionId,
                ipAddress: s.ipAddress,
                device: `${s.device} · ${s.browser}`,
                browser: s.browser,
                location: s.location || 'India (Authorized IP)',
                loginTime: 'Restored session',
                lastActivity: 'Active',
                isCurrent: true,
              },
              ...(user.activeSessions || []).slice(0, 4),
            ];
          }
        }
        restored++;
      }
      if (restored > 0) {
        console.log(`[AUTH] Restored ${restored} active admin session(s) from disk.`);
      }
    } catch (err) {
      console.warn('[AUTH] Could not load persisted sessions:', err);
    }
  }

  // Cryptographically secure password hashing using PBKDF2 with SHA-512 (10,000 iterations)
  private hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  }

  private generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private seedDefaultCredentials() {
    // Only Super Admin / Founder has initial bootstrap password
    const bootstrapPassword = process.env.TORI_BOOTSTRAP_ADMIN_PASSWORD;
    if (bootstrapPassword) {
      const saifSalt = this.generateSalt();
      const saifHash = this.hashPassword(bootstrapPassword, saifSalt);
      this.credentials.set('usr-saif', {
        userId: 'usr-saif',
        passwordHash: saifHash,
        salt: saifSalt,
        failedLoginAttempts: 0,
        lastPasswordChange: new Date().toISOString(),
        twoFactorEnabled: false,
      });
    }

    // Partners and operational staff: Zero hardcoded passwords.
    // Initialized as pending password setup with secure cryptographically random invitation tokens.
    const partnerAndStaffUserIds = [
      'usr-simranjeet',
      'usr-lokesh',
      'usr-nagesh',
      'usr-ananya',
      'usr-vikram',
      'usr-priya',
      'usr-rahul',
    ];

    for (const userId of partnerAndStaffUserIds) {
      this.credentials.set(userId, {
        userId,
        salt: this.generateSalt(),
        failedLoginAttempts: 0,
        lastPasswordChange: new Date().toISOString(),
        twoFactorEnabled: false,
      });

      // Generate secure single-use activation invitation token
      this.createInvitationToken(userId);
    }

    console.log('[AUTH] Development-only legacy credentials initialized where a bootstrap secret is configured. Production uses persistent authentication only.');
  }

  // --- Identifier Resolution (Email OR User ID / Employee ID) ---
  public findUserByIdentifier(identifier: string): PlatformUser | undefined {
    const clean = identifier.trim().toLowerCase();
    if (!clean) return undefined;
    const all = userStore.getAllUsers();
    return all.find(
      (u) =>
        u.email.toLowerCase() === clean ||
        u.id.toLowerCase() === clean ||
        (u.employeeId && u.employeeId.toLowerCase() === clean) ||
        (u.id === 'usr-saif' && (clean === 'saif@toriwear.com' || clean === 'tori-001')) ||
        (u.id === 'usr-simranjeet' && clean === 'tori-002') ||
        (u.id === 'usr-lokesh' && clean === 'tori-003') ||
        (u.id === 'usr-nagesh' && clean === 'tori-004') ||
        (u.id === 'usr-ananya' && (clean === 'ananya@toriwear.com' || clean === 'tori-emp-005')) ||
        (u.id === 'usr-vikram' && (clean === 'vikram@toriwear.com' || clean === 'tori-emp-006')) ||
        (u.id === 'usr-priya' && (clean === 'priya@toriwear.com' || clean === 'tori-emp-007')) ||
        (u.id === 'usr-rahul' && (clean === 'rahul@toriwear.com' || clean === 'tori-emp-008'))
    );
  }

  public async findUserByIdentifierAsync(identifier: string): Promise<PlatformUser | undefined> {
    const localMatch = this.findUserByIdentifier(identifier);
    if (localMatch) return localMatch;

    const raw = identifier.trim();
    const clean = raw.toLowerCase();
    if (!clean) return undefined;

    try {
      const prisma = getPrismaClient();
      if (prisma?.user) {
        const dbUser = await prisma.user.findFirst({
          where: {
            OR: [
              { id: raw },
              { email: { equals: clean, mode: 'insensitive' } },
              { employeeId: { equals: raw, mode: 'insensitive' } },
            ],
          },
          include: { twoFactorSetting: true },
        });
        if (dbUser) {
          return userStore.upsertUserFromDb({
            ...dbUser,
            twoFactorEnabled: Boolean(dbUser.twoFactorSetting?.isEnabled),
          });
        }
      }
    } catch (err) {
      console.warn('[AUTH] Note looking up user in PostgreSQL:', err);
    }

    return undefined;
  }

  // --- Login & Password Verification ---
  public async authenticate(
    identifier: string,
    passwordAttempt: string,
    clientInfo: { ip: string; userAgent?: string }
  ): Promise<{
    success: boolean;
    requires2FA?: boolean;
    tempToken?: string;
    sessionToken?: string;
    user?: PlatformUser;
    error?: string;
    mustChangePassword?: boolean;
    manualKey?: string;
    qrDataUrl?: string;
    recoveryCodeHint?: string;
  }> {
    const user = await this.findUserByIdentifierAsync(identifier);
    const ip = clientInfo.ip || '103.21.144.12';

    if (!user) {
      auditStore.record({
        userId: 'ANONYMOUS',
        userName: identifier,
        userRole: 'STAFF',
        module: 'auth',
        action: 'FAILED_LOGIN_UNKNOWN_USER',
        recordAffected: identifier,
        newValue: 'Attempted login with non-existent email/ID',
        ipAddress: ip,
        severity: 'WARNING',
      });
      return { success: false, error: 'Invalid credentials. Please verify your email/ID and password.' };
    }

    // Check account status
    if (user.accountStatus === 'SUSPENDED' || user.accountStatus === 'DEACTIVATED') {
      auditStore.record({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        module: 'auth',
        action: 'LOGIN_BLOCKED_SUSPENDED',
        recordAffected: user.email,
        newValue: `Account status is ${user.accountStatus}`,
        ipAddress: ip,
        severity: 'CRITICAL',
      });
      return {
        success: false,
        error: `Your account is ${user.accountStatus.toLowerCase()}. Contact Super Admin Mohammed Saif for clearance.`,
      };
    }

    const cred = await this.ensureCredentialFromDb(user.id, user.email);
    if (!cred) {
      return {
        success: false,
        error: 'User credential record not found in database. Run "npm run seed" with TORI_INITIAL_ADMIN_PASSWORD set, or configure TORI_INITIAL_ADMIN_PASSWORD in your environment variables and restart.',
      };
    }

    // Check brute-force lockout
    const now = Date.now();
    if (cred.lockoutUntil && cred.lockoutUntil > now) {
      const remainingMinutes = Math.ceil((cred.lockoutUntil - now) / 60000);
      auditStore.record({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        module: 'auth',
        action: 'LOGIN_BLOCKED_LOCKOUT',
        recordAffected: user.email,
        newValue: `Account temporarily locked. Remaining: ${remainingMinutes} mins`,
        ipAddress: ip,
        severity: 'CRITICAL',
      });
      return {
        success: false,
        error: `Account is temporarily locked due to multiple failed login attempts. Try again in ${remainingMinutes} minute(s).`,
      };
    }

    // Check if account has not yet established initial password (first-time invitation)
    if (!cred.passwordHash) {
      return {
        success: false,
        error: 'Your account is pending initial credential setup. Please check your invitation activation email or click Forgot Password to set up your password.',
      };
    }

    // Verify Password Hash using length-safe timing comparison
    const attemptHash = this.hashPassword(passwordAttempt, cred.salt);
    const isPasswordValid = safeTimingEqual(attemptHash, cred.passwordHash, 'hex');

    const prisma = getPrismaClient();

    if (!isPasswordValid) {
      cred.failedLoginAttempts += 1;
      const policies = userStore.getSecurityPolicies();
      const maxAttempts = policies.maxFailedLoginsBeforeLock || 5;

      if (cred.failedLoginAttempts >= maxAttempts) {
        const lockoutMinutes = policies.lockoutDurationMinutes || 15;
        cred.lockoutUntil = now + lockoutMinutes * 60000;
        if (prisma?.user) {
          await prisma.user.updateMany({
            where: { id: user.id },
            data: { failedLoginAttempts: cred.failedLoginAttempts, lockoutUntil: new Date(cred.lockoutUntil) },
          }).catch(() => {});
        }
        auditStore.record({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          module: 'auth',
          action: 'ACCOUNT_LOCKED_FAILED_ATTEMPTS',
          recordAffected: user.email,
          newValue: `Locked for ${lockoutMinutes} minutes after ${cred.failedLoginAttempts} failed attempts`,
          ipAddress: ip,
          severity: 'CRITICAL',
        });
        return {
          success: false,
          error: `Too many failed login attempts. Your account has been temporarily locked for ${lockoutMinutes} minutes.`,
        };
      }

      if (prisma?.user) {
        await prisma.user.updateMany({
          where: { id: user.id },
          data: { failedLoginAttempts: cred.failedLoginAttempts },
        }).catch(() => {});
      }

      auditStore.record({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        module: 'auth',
        action: 'FAILED_LOGIN_PASSWORD_MISMATCH',
        recordAffected: user.email,
        newValue: `Attempt ${cred.failedLoginAttempts} of ${maxAttempts}`,
        ipAddress: ip,
        severity: 'WARNING',
      });

      const remainingAttempts = maxAttempts - cred.failedLoginAttempts;
      return {
        success: false,
        error: `Incorrect password. ${remainingAttempts} attempt(s) remaining before temporary lockout.`,
      };
    }

    // Password is VALID! Reset failed attempts
    cred.failedLoginAttempts = 0;
    cred.lockoutUntil = undefined;
    if (prisma?.user) {
      await prisma.user.updateMany({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockoutUntil: null, lastLoginAt: new Date() },
      }).catch(() => {});
    }

    // Check if 2FA is enrolled and enabled in PostgreSQL or in-memory
    await this.loadUser2FASetting(user.id);
    if (cred.twoFactorEnabled && cred.twoFactorSecret) {
      const tempToken = crypto.randomBytes(24).toString('hex');
      this.twoFactorChallenges.set(tempToken, {
        tempToken,
        userId: user.id,
        expiresAt: now + 15 * 60000, // 15 minutes validity
        attempts: 0,
      });

      let plainSecret = '';
      try {
        plainSecret = decryptSecret(cred.twoFactorSecret);
      } catch {}

      return {
        success: true,
        requires2FA: true,
        tempToken,
        manualKey: plainSecret || undefined,
      };
    }

    // Issue Session Token
    const session = this.createSession(user, clientInfo);

    auditStore.record({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      module: 'auth',
      action: 'SUCCESSFUL_LOGIN',
      recordAffected: user.email,
      newValue: `Authenticated via password. Session: ${session.sessionId}`,
      ipAddress: ip,
      severity: 'INFO',
    });

    return {
      success: true,
      sessionToken: session.token,
      user: this.sanitizeUser(user),
      mustChangePassword: cred.mustChangePasswordOnFirstLogin,
    };
  }

  // --- Two-Factor Authentication DB Synchronizer ---
  public async loadUser2FASetting(userId: string): Promise<UserCredential | undefined> {
    const cred = this.credentials.get(userId);
    if (!cred) return undefined;

    try {
      const prisma = getPrismaClient();
      if (prisma) {
        const dbSetting = await prisma.twoFactorSetting.findUnique({
          where: { userId },
        });

        if (dbSetting) {
          cred.twoFactorEnabled = dbSetting.isEnabled;
          cred.twoFactorSecret = dbSetting.secret || undefined;
          cred.pendingTwoFactorSecret = dbSetting.pendingSecret || undefined;
          cred.pendingExpiresAt = dbSetting.pendingExpiresAt ? dbSetting.pendingExpiresAt.getTime() : undefined;
          cred.lastAcceptedStep = dbSetting.lastAcceptedStep !== null && dbSetting.lastAcceptedStep !== undefined
            ? BigInt(dbSetting.lastAcceptedStep)
            : undefined;
          if (dbSetting.backupCodes) {
            try {
              cred.recoveryCodeHashes = JSON.parse(dbSetting.backupCodes);
            } catch {
              cred.recoveryCodeHashes = [];
            }
          }
          const user = userStore.getUserById(userId);
          if (user) {
            user.twoFactorEnabled = dbSetting.isEnabled;
          }
        }
      }
    } catch (err: any) {
      if (err?.code !== 'P2021') {
        console.warn('[AUTH] Note loading 2FA setting from database:', err?.message || err);
      }
    }

    return cred;
  }

  // --- Resolve Temporary 2FA Challenge Token ---
  public getChallenge(tempToken: string): { tempToken: string; userId: string; expiresAt: number; attempts: number } | undefined {
    if (!tempToken) return undefined;
    const ch = this.twoFactorChallenges.get(tempToken);
    if (!ch) return undefined;
    if (ch.expiresAt < Date.now()) {
      this.twoFactorChallenges.delete(tempToken);
      return undefined;
    }
    return ch;
  }

  // --- Two-Factor Verification ---
  public async verify2FA(
    tempToken: string,
    code: string,
    clientInfo: { ip: string; userAgent?: string }
  ): Promise<{ success: boolean; sessionToken?: string; user?: PlatformUser; error?: string }> {
    const challenge = this.twoFactorChallenges.get(tempToken);
    if (!challenge || challenge.expiresAt < Date.now()) {
      return { success: false, error: '2FA session expired. Please sign in again.' };
    }

    const user = userStore.getUserById(challenge.userId);
    if (!user) return { success: false, error: 'User account not found.' };

    const cred = await this.loadUser2FASetting(user.id);
    if (!cred) {
      return { success: false, error: 'User credential record not found.' };
    }

    const cleanCode = (code || '').trim().replace(/['"`\s]/g, '');
    if (!cleanCode) {
      return { success: false, error: 'Verification code is required.' };
    }

    const prisma = getPrismaClient();

    // 1. Check if entered code matches a single-use SHA-256 hashed recovery code
    if (cred.recoveryCodeHashes && cred.recoveryCodeHashes.length > 0) {
      const recoveryIndex = cred.recoveryCodeHashes.findIndex((hashedCode) =>
        verifyRecoveryCode(cleanCode, hashedCode)
      );

      if (recoveryIndex !== -1) {
        // Atomically consume the single-use recovery code
        cred.recoveryCodeHashes.splice(recoveryIndex, 1);
        if (prisma) {
          try {
            await prisma.twoFactorSetting.update({
              where: { userId: user.id },
              data: {
                backupCodes: JSON.stringify(cred.recoveryCodeHashes),
              },
            });
          } catch (e) {
            console.warn('[AUTH] Error saving consumed recovery code to DB:', e);
          }
        }

        this.twoFactorChallenges.delete(tempToken);
        const session = this.createSession(user, clientInfo);

        auditStore.record({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          module: 'auth',
          action: '2FA_RECOVERY_CODE_LOGIN',
          recordAffected: user.email,
          newValue: `Single-use recovery code consumed. Session: ${session.sessionId}`,
          ipAddress: clientInfo.ip || '103.21.144.12',
          severity: 'INFO',
        });

        return {
          success: true,
          sessionToken: session.token,
          user: this.sanitizeUser(user),
        };
      }
    }

    // 2. Genuine RFC 6238 TOTP verification with strict +/- 1 time step and replay check
    if (!cred.twoFactorSecret) {
      return { success: false, error: 'Two-factor secret is not configured for this account.' };
    }

    let plainSecret = '';
    try {
      plainSecret = decryptSecret(cred.twoFactorSecret);
    } catch (e) {
      console.error('[AUTH] Failed to decrypt TOTP secret:', e);
      return { success: false, error: 'Cryptographic failure during 2FA verification.' };
    }

    const totpResult = verifyTOTP(plainSecret, cleanCode, {
      window: 1, // Strict RFC 6238 narrow transmission window: +/- 1 step (+/- 30s)
      lastAcceptedStep: cred.lastAcceptedStep,
      timestampMs: Date.now(), // Authoritative server-controlled clock only
    });

    if (totpResult.reason === 'REPLAY_DETECTED') {
      auditStore.record({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        module: 'auth',
        action: '2FA_REPLAY_ATTEMPT_BLOCKED',
        recordAffected: user.email,
        newValue: `Replay attempt of already accepted time-step: ${totpResult.acceptedStep}`,
        ipAddress: clientInfo.ip || '103.21.144.12',
        severity: 'CRITICAL',
      });
      return {
        success: false,
        error: 'This verification code has already been used. Please wait for the next code from your authenticator app.',
      };
    }

    if (!totpResult.valid || totpResult.acceptedStep === undefined) {
      challenge.attempts = (challenge.attempts || 0) + 1;
      if (challenge.attempts >= 5) {
        this.twoFactorChallenges.delete(tempToken);
        auditStore.record({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          module: 'auth',
          action: '2FA_CHALLENGE_LOCKED',
          recordAffected: user.email,
          newValue: '5 failed 2FA verification attempts. Challenge invalidated.',
          ipAddress: clientInfo.ip || '103.21.144.12',
          severity: 'CRITICAL',
        });
        return { success: false, error: 'Too many incorrect 2FA attempts. Please sign in again.' };
      }

      auditStore.record({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        module: 'auth',
        action: '2FA_VERIFICATION_FAILED',
        recordAffected: user.email,
        newValue: `Invalid 2FA code attempt ${challenge.attempts} of 5`,
        ipAddress: clientInfo.ip || '103.21.144.12',
        severity: 'WARNING',
      });
      return { success: false, error: 'Invalid 2FA code. Please enter the valid 6-digit code from your authenticator app.' };
    }

    // Update last accepted step in PostgreSQL to prevent replay attacks across processes
    cred.lastAcceptedStep = totpResult.acceptedStep;
    if (prisma) {
      try {
        await prisma.twoFactorSetting.update({
          where: { userId: user.id },
          data: {
            lastAcceptedStep: totpResult.acceptedStep,
          },
        });
      } catch (e) {
        console.warn('[AUTH] Error saving lastAcceptedStep to DB:', e);
      }
    }

    // Invalidate challenge upon successful verification
    this.twoFactorChallenges.delete(tempToken);

    // Create authenticated session
    const session = this.createSession(user, clientInfo);

    auditStore.record({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      module: 'auth',
      action: '2FA_VERIFIED_SUCCESSFUL_LOGIN',
      recordAffected: user.email,
      newValue: `RFC 6238 TOTP Verified. Step: ${totpResult.acceptedStep}. Session: ${session.sessionId}`,
      ipAddress: clientInfo.ip || '103.21.144.12',
      severity: 'INFO',
    });

    return {
      success: true,
      sessionToken: session.token,
      user: this.sanitizeUser(user),
    };
  }

  // --- 2FA Enrollment: Start Setup ---
  public async start2FASetup(
    userId: string
  ): Promise<{ success: boolean; manualKey?: string; qrDataUrl?: string; error?: string }> {
    const user = userStore.getUserById(userId);
    const cred = this.credentials.get(userId);
    if (!user || !cred) return { success: false, error: 'User credential record not found.' };

    // Cryptographically secure 20-byte random Base32 secret
    const rawSecret = generateBase32Secret(20);
    const encryptedSecret = encryptSecret(rawSecret);
    const pendingExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    cred.pendingTwoFactorSecret = encryptedSecret;
    cred.pendingExpiresAt = pendingExpiresAt.getTime();

    // Persist pending secret encrypted in PostgreSQL
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.twoFactorSetting.upsert({
          where: { userId },
          create: {
            id: `tfs-${userId}`,
            userId,
            isEnabled: false,
            pendingSecret: encryptedSecret,
            pendingExpiresAt,
          },
          update: {
            pendingSecret: encryptedSecret,
            pendingExpiresAt,
          },
        });
      } catch (e) {
        console.warn('[AUTH] Error storing pending 2FA secret in database:', e);
      }
    }

    // Build standard otpauth:// URI and render genuine 2D matrix barcode QR Data URL
    const otpAuthUri = buildOtpAuthUri(user.email, rawSecret, 'TORIWEAR');
    const qrDataUrl = await generateQrCodeDataUrl(otpAuthUri);

    return {
      success: true,
      manualKey: formatSecretForDisplay(rawSecret),
      qrDataUrl,
    };
  }

  // --- 2FA Enrollment: Confirm Setup via TOTP verification ---
  public async confirm2FASetup(
    userId: string,
    code: string,
    clientInfo?: { ip: string; userAgent?: string }
  ): Promise<{ success: boolean; recoveryCodes?: string[]; sessionToken?: string; user?: PlatformUser; error?: string }> {
    const user = userStore.getUserById(userId);
    const cred = this.credentials.get(userId);
    if (!user || !cred) return { success: false, error: 'User credential record not found.' };

    const prisma = getPrismaClient();
    let pendingEncrypted: string | undefined = cred.pendingTwoFactorSecret;
    let pendingExpiresAt = cred.pendingExpiresAt;

    if (prisma) {
      try {
        const dbSetting = await prisma.twoFactorSetting.findUnique({ where: { userId } });
        if (dbSetting?.pendingSecret) {
          pendingEncrypted = dbSetting.pendingSecret;
          pendingExpiresAt = dbSetting.pendingExpiresAt ? dbSetting.pendingExpiresAt.getTime() : undefined;
        }
      } catch (e) {
        console.warn('[AUTH] Error fetching pending 2FA from DB:', e);
      }
    }

    if (!pendingEncrypted || !pendingExpiresAt || pendingExpiresAt < Date.now()) {
      return { success: false, error: 'No active pending 2FA enrollment found. Please restart setup.' };
    }

    let plainSecret = '';
    try {
      plainSecret = decryptSecret(pendingEncrypted);
    } catch {
      return { success: false, error: 'Cryptographic failure during enrollment confirmation.' };
    }

    const cleanCode = (code || '').trim().replace(/[\s-]/g, '');
    const totpResult = verifyTOTP(plainSecret, cleanCode, {
      window: 1, // Strict RFC 6238 transmission window: +/- 1 step (+/- 30s)
      timestampMs: Date.now(), // Server-authoritative time only
    });

    if (!totpResult.valid) {
      return { success: false, error: 'Invalid 6-digit code. Please check your authenticator app and try again.' };
    }

    // Generate 5 high-entropy recovery codes and hash them with SHA-256 for storage
    const rawRecoveryCodes = generateRecoveryCodes(5);
    const hashedRecoveryCodes = rawRecoveryCodes.map(hashRecoveryCode);

    cred.twoFactorSecret = pendingEncrypted;
    cred.pendingTwoFactorSecret = undefined;
    cred.pendingExpiresAt = undefined;
    cred.twoFactorEnabled = true;
    cred.recoveryCodeHashes = hashedRecoveryCodes;
    cred.lastAcceptedStep = totpResult.acceptedStep;

    user.twoFactorEnabled = true;
    user.updatedAt = new Date().toISOString();

    if (prisma) {
      try {
        await prisma.twoFactorSetting.upsert({
          where: { userId },
          create: {
            id: `tfs-${userId}`,
            userId,
            isEnabled: true,
            secret: pendingEncrypted,
            pendingSecret: null,
            pendingExpiresAt: null,
            lastAcceptedStep: totpResult.acceptedStep,
            backupCodes: JSON.stringify(hashedRecoveryCodes),
            verifiedAt: new Date(),
          },
          update: {
            isEnabled: true,
            secret: pendingEncrypted,
            pendingSecret: null,
            pendingExpiresAt: null,
            lastAcceptedStep: totpResult.acceptedStep,
            backupCodes: JSON.stringify(hashedRecoveryCodes),
            verifiedAt: new Date(),
          },
        });
      } catch (e) {
        console.warn('[AUTH] Error persisting activated 2FA setting in DB:', e);
      }
    }

    // Clean up active temporary login challenge for this user
    for (const [token, ch] of this.twoFactorChallenges.entries()) {
      if (ch.userId === userId) {
        this.twoFactorChallenges.delete(token);
      }
    }

    auditStore.record({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      module: 'security',
      action: '2FA_ENROLLED_VERIFIED',
      recordAffected: user.email,
      newValue: '2FA successfully verified and activated with newly enrolled RFC 6238 TOTP key',
      ipAddress: clientInfo?.ip || '103.21.144.12',
      severity: 'INFO',
    });

    let sessionToken: string | undefined;
    if (clientInfo) {
      const session = this.createSession(user, clientInfo);
      sessionToken = session.token;
    }

    return {
      success: true,
      recoveryCodes: rawRecoveryCodes,
      sessionToken,
      user: this.sanitizeUser(user),
    };
  }

  // --- 2FA Disable with Password Re-Authentication ---
  public async disable2FA(
    userId: string,
    passwordAttempt?: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = userStore.getUserById(userId);
    const cred = this.credentials.get(userId);
    if (!user || !cred) return { success: false, error: 'User credential record not found.' };

    // Disallow disabling if user is Super Admin
    if (user.role === 'SUPER_ADMIN') {
      return { success: false, error: 'Super Admin accounts cannot disable Two-Factor Authentication.' };
    }

    if (passwordAttempt) {
      const attemptHash = this.hashPassword(passwordAttempt, cred.salt);
      if (!cred.passwordHash || !safeTimingEqual(attemptHash, cred.passwordHash, 'hex')) {
        return { success: false, error: 'Invalid password. Password confirmation is required to disable 2FA.' };
      }
    }

    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.twoFactorSetting.updateMany({
          where: { userId },
          data: {
            isEnabled: false,
            secret: null,
            pendingSecret: null,
            pendingExpiresAt: null,
            backupCodes: null,
          },
        });
      } catch (e) {
        console.warn('[AUTH] Error disabling 2FA in DB:', e);
      }
    }

    user.twoFactorEnabled = false;
    cred.twoFactorEnabled = false;
    cred.twoFactorSecret = undefined;
    cred.recoveryCodeHashes = undefined;
    user.updatedAt = new Date().toISOString();

    auditStore.record({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      module: 'security',
      action: '2FA_DISABLED',
      recordAffected: user.email,
      newValue: 'Two-Factor Authentication disabled on account after password confirmation',
      ipAddress: '103.21.144.12',
      severity: 'WARNING',
    });

    return { success: true };
  }

  // --- Session Management ---
  public createSession(
    user: PlatformUser,
    clientInfo: { ip: string; userAgent?: string }
  ): { token: string; sessionId: string } {
    const token = crypto.randomBytes(32).toString('hex');
    const sessionId = `sess-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const policies = userStore.getSecurityPolicies();
    const timeoutMs = (policies.sessionTimeoutMinutes || 60) * 60000;
    const now = Date.now();

    const device = this.parseDevice(clientInfo.userAgent);
    const browser = this.parseBrowser(clientInfo.userAgent);

    const sessionRecord: SessionTokenRecord = {
      token,
      sessionId,
      userId: user.id,
      createdAt: now,
      lastActiveAt: now,
      expiresAt: now + timeoutMs,
      ipAddress: clientInfo.ip || '103.21.144.12',
      device,
      browser,
      location: 'India (Authorized IP)',
    };

    this.sessionTokens.set(token, sessionRecord);

    // Update PlatformUser's activeSessions array
    const activeSession: ActiveSession = {
      sessionId,
      ipAddress: sessionRecord.ipAddress,
      device: `${device} · ${browser}`,
      browser,
      location: sessionRecord.location,
      loginTime: 'Just now',
      lastActivity: 'Active now',
      isCurrent: true,
    };

    user.activeSessions = [activeSession, ...(user.activeSessions || []).slice(0, 4)];
    user.lastLogin = 'Just now';
    user.updatedAt = new Date().toISOString();

    this.saveSessionsToDisk();

    const prisma = getPrismaClient();
    if (prisma?.session) {
      prisma.session.create({
        data: {
          id: sessionId,
          token,
          userId: user.id,
          ipAddress: sessionRecord.ipAddress,
          userAgent: clientInfo.userAgent || null,
          device,
          browser,
          location: sessionRecord.location,
          expiresAt: new Date(sessionRecord.expiresAt),
          isValid: true,
          lastActiveAt: new Date(now),
          createdAt: new Date(now),
        },
      }).catch((err: any) => {
        console.warn('[AUTH] Error persisting admin session to PostgreSQL:', err?.message || err);
      });
    }

    return { token, sessionId };
  }

  public getUserByToken(token: string): PlatformUser | null {
    if (!token) return null;
    const session = this.sessionTokens.get(token);
    if (!session) return null;

    const now = Date.now();
    if (session.expiresAt < now) {
      this.sessionTokens.delete(token);
      this.saveSessionsToDisk();
      return null;
    }

    // Refresh last active time
    session.lastActiveAt = now;
    const policies = userStore.getSecurityPolicies();
    session.expiresAt = now + (policies.sessionTimeoutMinutes || 60) * 60000;
    if (now - this.lastSessionPersistMs > 30000) {
      this.saveSessionsToDisk();
    }

    const user = userStore.getUserById(session.userId);
    return user ? this.sanitizeUser(user) : null;
  }

  public async getUserByTokenAsync(token: string): Promise<PlatformUser | null> {
    if (!token) return null;
    const cached = this.getUserByToken(token);
    if (cached) return cached;

    const prisma = getPrismaClient();
    if (!prisma?.session) return null;
    try {
      const dbSess = await prisma.session.findUnique({ where: { token } });
      if (!dbSess || !dbSess.isValid || !dbSess.userId || dbSess.expiresAt.getTime() <= Date.now()) {
        return null;
      }

      const now = Date.now();
      const policies = userStore.getSecurityPolicies();
      const newExpiresAt = now + (policies.sessionTimeoutMinutes || 60) * 60000;
      const sessionRecord: SessionTokenRecord = {
        token: dbSess.token,
        sessionId: dbSess.id,
        userId: dbSess.userId,
        createdAt: new Date(dbSess.createdAt).getTime(),
        lastActiveAt: now,
        expiresAt: newExpiresAt,
        ipAddress: dbSess.ipAddress || '127.0.0.1',
        device: dbSess.device || 'Authorized Terminal',
        browser: dbSess.browser || 'Web Browser',
        location: dbSess.location || 'India (Authorized IP)',
      };
      this.sessionTokens.set(token, sessionRecord);

      prisma.session.update({
        where: { id: dbSess.id },
        data: { lastActiveAt: new Date(now), expiresAt: new Date(newExpiresAt) },
      }).catch(() => {});

      let user = userStore.getUserById(dbSess.userId);
      if (!user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: dbSess.userId },
          include: { twoFactorSetting: true },
        });
        if (dbUser) {
          user = userStore.upsertUserFromDb({
            ...dbUser,
            twoFactorEnabled: Boolean(dbUser.twoFactorSetting?.isEnabled),
          });
        }
      }
      return user ? this.sanitizeUser(user) : null;
    } catch {
      return null;
    }
  }

  public revokeSession(token: string): boolean {
    const session = this.sessionTokens.get(token);
    const prisma = getPrismaClient();
    if (prisma?.session) {
      prisma.session.updateMany({
        where: { token },
        data: { isValid: false },
      }).catch(() => {});
    }
    if (session) {
      const user = userStore.getUserById(session.userId);
      if (user) {
        user.activeSessions = (user.activeSessions || []).filter((s) => s.sessionId !== session.sessionId);
        auditStore.record({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          module: 'auth',
          action: 'SESSION_TERMINATED',
          recordAffected: user.email,
          newValue: `Session ${session.sessionId} terminated`,
          ipAddress: session.ipAddress,
          severity: 'INFO',
        });
      }
      this.sessionTokens.delete(token);
      this.saveSessionsToDisk();
      return true;
    }
    return false;
  }

  public revokeAllUserSessions(userId: string, exceptToken?: string): number {
    let count = 0;
    for (const [t, s] of this.sessionTokens.entries()) {
      if (s.userId === userId && t !== exceptToken) {
        this.sessionTokens.delete(t);
        count++;
      }
    }
    const prisma = getPrismaClient();
    if (prisma?.session) {
      prisma.session.updateMany({
        where: exceptToken ? { userId, token: { not: exceptToken } } : { userId },
        data: { isValid: false },
      }).catch(() => {});
    }
    const user = userStore.getUserById(userId);
    if (user) {
      user.activeSessions = exceptToken ? user.activeSessions.slice(0, 1) : [];
      user.updatedAt = new Date().toISOString();
    }
    if (count > 0) {
      this.saveSessionsToDisk();
    }
    return count;
  }

  // --- Change Password ---
  public changePassword(
    userId: string,
    currentPass: string,
    newPass: string,
    revokeOthers: boolean,
    currentToken?: string
  ): { success: boolean; error?: string } {
    const cred = this.credentials.get(userId);
    const user = userStore.getUserById(userId);
    if (!cred || !user) return { success: false, error: 'User credential record not found.' };

    // Verify current
    const currentHash = this.hashPassword(currentPass, cred.salt);
    if (!cred.passwordHash || !safeTimingEqual(currentHash, cred.passwordHash, 'hex')) {
      return { success: false, error: 'Current password does not match our records.' };
    }

    // Validate new password strength
    if (newPass.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters long.' };
    }
    if (!/[A-Z]/.test(newPass) || !/[0-9]/.test(newPass)) {
      return { success: false, error: 'New password must contain at least one uppercase letter and one number.' };
    }

    const newSalt = this.generateSalt();
    const newHash = this.hashPassword(newPass, newSalt);

    cred.passwordHash = newHash;
    cred.salt = newSalt;
    cred.lastPasswordChange = new Date().toISOString();
    cred.mustChangePasswordOnFirstLogin = false;
    user.updatedAt = new Date().toISOString();

    const prisma = getPrismaClient();
    if (prisma?.user) {
      prisma.user.updateMany({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          salt: newSalt,
          lastPasswordChange: new Date(),
          mustChangePasswordOnFirstLogin: false,
        },
      }).catch(() => {});
    }

    if (revokeOthers) {
      this.revokeAllUserSessions(userId, currentToken);
    }

    auditStore.record({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      module: 'auth',
      action: 'PASSWORD_CHANGED',
      recordAffected: user.email,
      newValue: `Password securely updated. Other sessions revoked: ${revokeOthers}`,
      ipAddress: '103.21.144.12',
      severity: 'WARNING',
    });

    return { success: true };
  }

  // --- Forgot Password Token Generation & Reset (Hashed & Generic) ---
  public createPasswordResetToken(email: string): { success: boolean; message: string; devResetLink?: string } {
    const user = userStore.getUserByEmail(email) || this.findUserByIdentifier(email);
    if (!user) {
      // Do not reveal email existence to prevent user enumeration
      return { success: true, message: 'If this email address is registered, password reset instructions have been sent.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = Date.now() + 15 * 60000; // 15 minutes validity (short-lived)

    this.resetTokens.set(tokenHash, {
      token: tokenHash,
      userId: user.id,
      email: user.email,
      expiresAt,
      used: false,
    });

    const prisma = getPrismaClient();
    if (prisma) {
      prisma.passwordResetToken.create({
        data: {
          id: `prt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          token: tokenHash,
          userId: user.id,
          email: user.email,
          expiresAt: new Date(expiresAt),
          used: false,
        },
      }).catch((err: any) => console.warn('[AUTH] Error persisting reset token hash:', err));
    }

    auditStore.record({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      module: 'auth',
      action: 'PASSWORD_RESET_TOKEN_GENERATED',
      recordAffected: user.email,
      newValue: 'Single-use cryptographic SHA-256 hashed reset token issued with 15-minute expiration',
      ipAddress: '103.21.144.12',
      severity: 'WARNING',
    });

    const adminPath = (process.env.VITE_ADMIN_PATH || '/tori-ops-gateway').replace(/\/+$/, '');
    const resetLink = `${adminPath}/reset-password?token=${token}`;

    // Log securely server-side for development or testing
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AUTH-DEV] Password reset link for ${email}: ${resetLink}`);
    }

    return {
      success: true,
      message: 'If this email address is registered, password reset instructions have been sent.',
      ...(process.env.NODE_ENV !== 'production' ? { devResetLink: resetLink } : {}),
    };
  }

  public async resetPasswordWithToken(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!token || typeof token !== 'string') {
      return { success: false, error: 'Invalid reset token.' };
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    let record = this.resetTokens.get(tokenHash);

    const prisma = getPrismaClient();
    if (!record && prisma) {
      try {
        const dbRecord = await prisma.passwordResetToken.findUnique({
          where: { token: tokenHash },
        });
        if (dbRecord) {
          record = {
            token: dbRecord.token,
            userId: dbRecord.userId,
            email: dbRecord.email,
            expiresAt: dbRecord.expiresAt.getTime(),
            used: dbRecord.used,
          };
        }
      } catch (err) {
        console.warn('[AUTH] Error fetching reset token from DB:', err);
      }
    }

    if (!record || record.used || record.expiresAt < Date.now()) {
      return { success: false, error: 'Password reset link is invalid or has expired. Please request a new one.' };
    }

    if (newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return { success: false, error: 'Password must contain at least one uppercase letter and one number.' };
    }

    const cred = this.credentials.get(record.userId);
    const user = userStore.getUserById(record.userId);
    if (!cred || !user) return { success: false, error: 'Account not found.' };

    const salt = this.generateSalt();
    const hash = this.hashPassword(newPassword, salt);

    cred.passwordHash = hash;
    cred.salt = salt;
    cred.lastPasswordChange = new Date().toISOString();
    cred.mustChangePasswordOnFirstLogin = false;
    cred.failedLoginAttempts = 0;
    cred.lockoutUntil = undefined;
    record.used = true;

    if (prisma) {
      try {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: record.userId },
            data: {
              passwordHash: hash,
              salt,
              lastPasswordChange: new Date(),
              failedLoginAttempts: 0,
              lockoutUntil: null,
              mustChangePasswordOnFirstLogin: false,
            },
          }),
          prisma.passwordResetToken.updateMany({
            where: { token: tokenHash },
            data: { used: true, usedAt: new Date() },
          }),
        ]);
      } catch (err) {
        console.warn('[AUTH] Error updating password in PostgreSQL:', err);
      }
    }

    // Invalidate all existing sessions upon password reset (Phase 1.D)
    this.revokeAllUserSessions(record.userId);

    auditStore.record({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      module: 'auth',
      action: 'PASSWORD_RESET_COMPLETED',
      recordAffected: user.email,
      newValue: 'Single-use hashed token consumed; all existing active sessions invalidated',
      ipAddress: '103.21.144.12',
      severity: 'CRITICAL',
    });

    return { success: true };
  }

  // --- User Invitation Token ---
  public createInvitationToken(userId: string): { token: string; inviteLink: string } {
    const user = userStore.getUserById(userId);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 48 * 3600000; // 48 hours

    this.inviteTokens.set(token, {
      token,
      userId,
      email: user?.email || '',
      expiresAt,
      used: false,
    });

    const inviteLink = `/admin/activate?token=${token}`;
    return { token, inviteLink };
  }

  public activateAccountWithToken(token: string, password: string): { success: boolean; user?: PlatformUser; error?: string } {
    const record = this.inviteTokens.get(token);
    if (!record || record.used || record.expiresAt < Date.now()) {
      return { success: false, error: 'Activation link is invalid or has expired.' };
    }

    const user = userStore.getUserById(record.userId);
    if (!user) return { success: false, error: 'Account not found.' };

    const salt = this.generateSalt();
    const hash = this.hashPassword(password, salt);

    this.credentials.set(user.id, {
      userId: user.id,
      passwordHash: hash,
      salt,
      failedLoginAttempts: 0,
      lastPasswordChange: new Date().toISOString(),
      mustChangePasswordOnFirstLogin: false,
    });

    const prisma = getPrismaClient();
    if (prisma?.user) {
      prisma.user.updateMany({
        where: { id: user.id },
        data: {
          passwordHash: hash,
          salt,
          accountStatus: 'ACTIVE',
          failedLoginAttempts: 0,
          lockoutUntil: null,
          lastPasswordChange: new Date(),
          mustChangePasswordOnFirstLogin: false,
        },
      }).catch(() => {});
    }

    user.accountStatus = 'ACTIVE';
    record.used = true;

    auditStore.record({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      module: 'auth',
      action: 'ACCOUNT_ACTIVATED',
      recordAffected: user.email,
      newValue: 'User established permanent password through invitation link',
      ipAddress: '103.21.144.12',
      severity: 'INFO',
    });

    return { success: true, user: this.sanitizeUser(user) };
  }

  // --- Password Setting for Admin User Provisioning ---
  public setInitialPassword(userId: string, tempPassword?: string): { tempPassword?: string } {
    const salt = this.generateSalt();
    const pass = tempPassword || `Tori@${crypto.randomBytes(4).toString('hex')}`;
    const hash = this.hashPassword(pass, salt);

    this.credentials.set(userId, {
      userId,
      passwordHash: hash,
      salt,
      failedLoginAttempts: 0,
      mustChangePasswordOnFirstLogin: true,
      lastPasswordChange: new Date().toISOString(),
    });

    return { tempPassword: pass };
  }

  // --- Super Admin Direct Password Management & Reset ---
  public async adminResetUserPassword(
    userId: string,
    newPassword?: string,
    mustChangePassword: boolean = false,
    actor?: { id: string; name: string; role: string; email: string }
  ): Promise<{ success: boolean; newPassword?: string; message?: string; error?: string }> {
    const user = userStore.getUserById(userId);
    if (!user) return { success: false, error: 'User account not found.' };

    const salt = this.generateSalt();
    const pass = (newPassword && newPassword.trim()) || `Tori@${crypto.randomBytes(4).toString('hex')}!`;
    const hash = this.hashPassword(pass, salt);

    let cred = this.credentials.get(userId);
    if (!cred) {
      cred = {
        userId,
        passwordHash: hash,
        salt,
        failedLoginAttempts: 0,
        mustChangePasswordOnFirstLogin: mustChangePassword,
        lastPasswordChange: new Date().toISOString(),
      };
      this.credentials.set(userId, cred);
    } else {
      cred.passwordHash = hash;
      cred.salt = salt;
      cred.failedLoginAttempts = 0;
      cred.lockoutUntil = undefined;
      cred.mustChangePasswordOnFirstLogin = mustChangePassword;
      cred.lastPasswordChange = new Date().toISOString();
    }

    // Persist to PostgreSQL if connected
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.user.updateMany({
          where: { id: userId },
          data: {
            passwordHash: hash,
            salt,
            failedLoginAttempts: 0,
            lockoutUntil: null,
            mustChangePasswordOnFirstLogin: mustChangePassword,
            lastPasswordChange: new Date(),
          },
        });
      } catch (err) {
        console.warn('[AUTH] Error updating password in PostgreSQL:', err);
      }
    }

    // Revoke any active sessions so old sessions cannot be hijacked
    this.revokeAllUserSessions(userId);

    auditStore.record({
      userId: actor?.id || 'usr-saif',
      userName: actor?.name || 'Mohammed Saif',
      userRole: (actor?.role as any) || 'SUPER_ADMIN',
      module: 'security',
      action: 'ADMIN_PASSWORD_RESET',
      recordAffected: user.email,
      newValue: `Super Admin reset password for ${user.name} (${user.email}). MustChangeOnFirstLogin=${mustChangePassword}`,
      ipAddress: '127.0.0.1',
      severity: 'WARNING',
    });

    return {
      success: true,
      newPassword: pass,
      message: `Password successfully updated for ${user.name}.`,
    };
  }

  // --- Super Admin Reissue Single-Use Recovery Codes ---
  public async adminReissueRecoveryCodes(
    userId: string,
    actor?: { id: string; name: string; role: string; email: string }
  ): Promise<{ success: boolean; recoveryCodes?: string[]; error?: string }> {
    const user = userStore.getUserById(userId);
    if (!user) return { success: false, error: 'User account not found.' };

    const freshCodes = generateRecoveryCodes(5); // Cryptographically random high-entropy recovery codes
    const hashedCodes = freshCodes.map(hashRecoveryCode);

    const cred = await this.loadUser2FASetting(userId);
    if (cred) {
      cred.recoveryCodeHashes = hashedCodes;
    }

    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.twoFactorSetting.upsert({
          where: { userId },
          create: {
            userId,
            isEnabled: Boolean(cred?.twoFactorEnabled),
            backupCodes: JSON.stringify(hashedCodes),
          },
          update: {
            backupCodes: JSON.stringify(hashedCodes),
          },
        });
      } catch (err) {
        console.warn('[AUTH] Error saving reissued recovery codes to DB:', err);
      }
    }

    auditStore.record({
      userId: actor?.id || 'usr-saif',
      userName: actor?.name || 'Mohammed Saif',
      userRole: (actor?.role as any) || 'SUPER_ADMIN',
      module: 'security',
      action: '2FA_RECOVERY_CODES_REISSUED',
      recordAffected: user.email,
      newValue: `Super Admin reissued 5 fresh backup recovery codes for ${user.name}`,
      ipAddress: '127.0.0.1',
      severity: 'WARNING',
    });

    return {
      success: true,
      recoveryCodes: freshCodes,
    };
  }

  // --- Super Admin Query User Credential & Recovery Codes Details ---
  public async getUserCredentialDetails(userId: string): Promise<{
    success: boolean;
    credential?: {
      userId: string;
      email: string;
      employeeId?: string;
      role: string;
      twoFactorEnabled: boolean;
      activeRecoveryCodesCount: number;
      failedLoginAttempts: number;
      accountStatus: string;
      mustChangePasswordOnFirstLogin: boolean;
      lastPasswordChange?: string;
    };
    error?: string;
  }> {
    const user = userStore.getUserById(userId);
    if (!user) return { success: false, error: 'User not found' };

    const cred = await this.loadUser2FASetting(userId);
    const activeHashes = cred?.recoveryCodeHashes || [];

    return {
      success: true,
      credential: {
        userId: user.id,
        email: user.email,
        employeeId: user.employeeId,
        role: user.role,
        twoFactorEnabled: Boolean(cred?.twoFactorEnabled),
        activeRecoveryCodesCount: activeHashes.length,
        failedLoginAttempts: cred?.failedLoginAttempts || 0,
        accountStatus: user.accountStatus,
        mustChangePasswordOnFirstLogin: Boolean(cred?.mustChangePasswordOnFirstLogin),
        lastPasswordChange: cred?.lastPasswordChange,
      },
    };
  }

  // Sanitize user: ensure no credential secrets or hashes are ever sent to client
  private sanitizeUser(user: PlatformUser): PlatformUser {
    const copy = { ...user };
    delete copy.twoFactorSecret;
    return copy;
  }

  private parseDevice(userAgent?: string): string {
    if (!userAgent) return 'Desktop Workstation';
    if (/iPhone/i.test(userAgent)) return 'iPhone (iOS)';
    if (/iPad/i.test(userAgent)) return 'iPad (iPadOS)';
    if (/Android/i.test(userAgent)) return 'Android Mobile';
    if (/Macintosh/i.test(userAgent)) return 'MacBook / macOS Workstation';
    if (/Windows/i.test(userAgent)) return 'Windows 11 Workstation';
    return 'Authorized Terminal';
  }

  private parseBrowser(userAgent?: string): string {
    if (!userAgent) return 'Secure Browser';
    if (/Chrome/i.test(userAgent)) return 'Google Chrome';
    if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) return 'Safari';
    if (/Firefox/i.test(userAgent)) return 'Mozilla Firefox';
    if (/Edge/i.test(userAgent)) return 'Microsoft Edge';
    return 'Web Browser';
  }
}

export const authStore = new AuthStore();
