import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService';
import { authStore } from '../authStore';

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
    req.user = {
      id: sessionData.user.id,
      email: sessionData.user.email,
      name: sessionData.user.name,
      role: sessionData.user.role,
      department: sessionData.user.department,
    };
    req.sessionToken = token;
    return next();
  }

  // 2. Try persistent authStore session validation (PostgreSQL + secure store backed)
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

/**
 * isProductionMode: checks if app is running in production
 */
export function isProductionMode(): boolean {
  return process.env.NODE_ENV === 'production';
}
