import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService';
import { authStore } from '../authStore';
import { userStore } from '../userStore';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions?: any;
  department?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionToken?: string;
    }
  }
}

/**
 * Extracts session token from Authorization: Bearer <token> or x-session-token header
 */
export function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const customHeader = req.headers['x-session-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }
  return null;
}

/**
 * requireAuth middleware
 * CRITICAL RULE: NEVER fallback to Super Admin if session is missing!
 * Unauthenticated requests MUST return 401 Unauthorized.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractSessionToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      code: 'UNAUTHENTICATED',
      error: 'Authentication required. Missing or empty session token.',
    });
    return;
  }

  // 1. Try modern UserService session validation
  const sessionData = await userService.validateSession(token);
  if (sessionData) {
    const storeUser = userStore.getUserById(sessionData.user.id);
    req.user = {
      id: sessionData.user.id,
      email: sessionData.user.email,
      name: sessionData.user.name,
      role: sessionData.user.role,
      permissions: storeUser?.permissions,
      department: sessionData.user.department,
    };
    req.sessionToken = token;
    return next();
  }

  // 2. Try persistent authStore session validation (MySQL + secure store backed)
  const storeUser = await authStore.getUserByTokenAsync(token);
  if (storeUser) {
    req.user = {
      id: storeUser.id,
      email: storeUser.email,
      name: storeUser.name,
      role: storeUser.role,
      permissions: storeUser.permissions,
      department: storeUser.department,
    };
    req.sessionToken = token;
    return next();
  }

  // Explicit rejection: Token is invalid or expired
  res.status(401).json({
    success: false,
    code: 'INVALID_SESSION',
    error: 'Your session has expired or is invalid. Please sign in again.',
  });
}

/**
 * requireRole middleware
 * Verifies that the authenticated user has one of the allowed roles.
 * Unauthorized requests MUST return 403 Forbidden.
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        code: 'UNAUTHENTICATED',
        error: 'Authentication required before checking permissions.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: `Access denied. Role "${req.user.role}" does not have required permissions (${allowedRoles.join(', ')}).`,
      });
      return;
    }

    next();
  };
}

/**
 * requirePermission middleware
 * Verifies that the user has a specific permission code.
 * Super Admin bypasses role checks by design.
 */
export function requirePermission(permissionCode: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        code: 'UNAUTHENTICATED',
        error: 'Authentication required.',
      });
      return;
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const userPerms = req.user.permissions;
    const hasPerm = Array.isArray(userPerms)
      ? userPerms.includes(permissionCode)
      : userPerms && typeof userPerms === 'object'
        ? Boolean((userPerms as Record<string, boolean>)[permissionCode])
        : false;

    if (!hasPerm) {
      res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: `Access denied. Missing required permission: "${permissionCode}".`,
      });
      return;
    }

    next();
  };
}

const ROLE_PERMISSION_FALLBACKS: Record<string, Record<string, string[]>> = {
  STORE_MANAGER: {
    dashboard: ['view'],
    products: ['view', 'create', 'edit'],
    inventory: ['view', 'create', 'edit'],
    orders: ['view', 'create', 'edit', 'approve'],
    customers: ['view', 'create', 'edit'],
    marketing: ['view', 'create', 'edit'],
    catalog: ['view', 'create', 'edit'],
    shipping: ['view', 'create', 'edit'],
    finance: ['view'],
    superAdmin: ['view'],
  },
  INVENTORY_MANAGER: {
    dashboard: ['view'],
    products: ['view', 'create', 'edit'],
    inventory: ['view', 'create', 'edit', 'delete'],
    catalog: ['view', 'edit'],
    orders: ['view'],
  },
  FULFILLMENT_STAFF: {
    dashboard: ['view'],
    orders: ['view', 'edit'],
    shipping: ['view', 'create', 'edit'],
    inventory: ['view'],
  },
  DESIGNER: {
    dashboard: ['view'],
    products: ['view', 'create', 'edit'],
    catalog: ['view'],
    aiDesignLab: ['view', 'create', 'edit'],
  },
  SUPPORT_STAFF: {
    dashboard: ['view'],
    orders: ['view'],
    customers: ['view', 'edit'],
    customerSupport: ['view', 'edit'],
  },
  VIEWER: {
    dashboard: ['view'],
    products: ['view'],
    inventory: ['view'],
    orders: ['view'],
    customers: ['view'],
  },
};

export function hasStaffPermission(user: any, permissionName?: string): boolean {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase();
  if (role === 'CUSTOMER') return false;
  if (role === 'SUPER_ADMIN') return true;
  if (!permissionName) return true;

  const [rawModule, rawAction = 'view'] = permissionName.split('.');
  let targetModule = rawModule;
  let targetAction = rawAction;

  if (rawModule === 'settings') {
    targetModule = 'settings';
  } else if (rawModule === 'payments') {
    targetModule = 'finance';
  } else if (rawModule === 'refunds') {
    targetModule = 'finance';
    targetAction = 'approve';
  }
  if (rawAction === 'archive') {
    targetAction = 'delete';
  }

  const perms = user.permissions;
  if (role === 'PARTNER') {
    if (rawModule === 'settings') {
      return Boolean(
        perms?.settings?.includes(targetAction) || perms?.superAdmin?.includes(targetAction)
      );
    }
    return true;
  }

  if (perms && typeof perms === 'object') {
    const allowed: string[] = perms[targetModule] || [];
    if (allowed.includes(targetAction)) return true;
    if (
      rawModule === 'settings' &&
      (perms.superAdmin?.includes(targetAction) ||
        (rawAction === 'view' && (perms.shipping?.includes('view') || perms.orders?.includes('view'))))
    ) {
      return true;
    }
    if (rawModule === 'refunds' && perms.orders?.includes('approve')) {
      return true;
    }
    return false;
  }

  const roleDefaults = ROLE_PERMISSION_FALLBACKS[role];
  if (roleDefaults) {
    return Boolean(roleDefaults[targetModule]?.includes(targetAction));
  }
  return false;
}

export function requireStaffPermission(permissionName?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = extractSessionToken(req);

    if (token) {
      let resolvedUser: any = null;
      const session = await userService.validateSession(token);
      if (session) {
        const storeUser = userStore.getUserById(session.user.id);
        resolvedUser = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role,
          permissions: storeUser?.permissions,
          department: session.user.department,
        };
      } else {
        const legacyUser = await authStore.getUserByTokenAsync(token);
        if (legacyUser) {
          resolvedUser = {
            id: legacyUser.id,
            email: legacyUser.email,
            name: legacyUser.name,
            role: legacyUser.role,
            permissions: legacyUser.permissions,
            department: legacyUser.department,
          };
        }
      }

      if (resolvedUser) {
        if (!hasStaffPermission(resolvedUser, permissionName)) {
          res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            error: `Access denied: Missing required permission (${permissionName || 'staff'}).`,
          });
          return;
        }
        req.user = resolvedUser;
        req.sessionToken = token;
        return next();
      }
    }

    res.status(401).json({
      success: false,
      code: 'UNAUTHENTICATED',
      error: 'Admin authentication required to perform this operation.',
    });
  };
}

/**
 * isProductionMode: checks if app is running in production
 */
export function isProductionMode(): boolean {
  return process.env.NODE_ENV === 'production';
}
