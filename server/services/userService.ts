import crypto from 'crypto';
import { userRepository, SessionRecord } from '../repositories/userRepository';
import { auditRepository } from '../repositories/auditRepository';

export class UserService {
  private hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  }

  async authenticate(identifier: string, passwordAttempt: string, ip: string, userAgent?: string) {
    if (!identifier || !passwordAttempt) {
      return { success: false, error: 'Identifier and password are required.' };
    }

    const user = await userRepository.findByIdentifier(identifier);
    if (!user) {
      await auditRepository.record({
        userId: 'ANONYMOUS',
        userName: identifier,
        userRole: 'UNKNOWN',
        module: 'auth',
        action: 'FAILED_LOGIN_UNKNOWN_USER',
        recordAffected: identifier,
        ipAddress: ip,
        severity: 'WARNING',
      });
      return { success: false, error: 'Invalid credentials.' };
    }

    // Check account status
    if (user.accountStatus === 'SUSPENDED' || user.accountStatus === 'DEACTIVATED' || user.accountStatus === 'LOCKED') {
      return { success: false, error: `Account is ${user.accountStatus.toLowerCase()}. Contact administrator.` };
    }

    // Check brute-force lockout
    if (user.lockoutUntil && user.lockoutUntil.getTime() > Date.now()) {
      const remainingMinutes = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      return {
        success: false,
        error: `Account is temporarily locked. Try again in ${remainingMinutes} minute(s).`,
      };
    }

    // Verify hash
    const attemptHash = this.hashPassword(passwordAttempt, user.salt);
    const attemptBuf = Buffer.from(attemptHash, 'hex');
    const userBuf = Buffer.from(user.passwordHash, 'hex');
    const isValid = attemptBuf.length === userBuf.length && crypto.timingSafeEqual(attemptBuf, userBuf);

    if (!isValid) {
      const failed = user.failedLoginAttempts + 1;
      let lockout: Date | null = null;
      if (failed >= 5) {
        lockout = new Date(Date.now() + 15 * 60000); // 15 min lockout
      }
      await userRepository.updateFailedAttempts(user.id, failed, lockout);
      await auditRepository.record({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        module: 'auth',
        action: 'FAILED_LOGIN_PASSWORD_MISMATCH',
        recordAffected: user.email,
        ipAddress: ip,
        severity: failed >= 5 ? 'CRITICAL' : 'WARNING',
      });
      return {
        success: false,
        error: failed >= 5
          ? 'Too many failed login attempts. Account temporarily locked for 15 minutes.'
          : 'Invalid credentials.',
      };
    }

    // Reset failed attempts
    await userRepository.updateFailedAttempts(user.id, 0, null);

    // Issue cryptographic session token
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session: SessionRecord = {
      id: `sess-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      sessionToken: token,
      userId: user.id,
      ipAddress: ip,
      userAgent,
      isValid: true,
      expiresAt,
      lastActiveAt: now,
      createdAt: now,
    };

    await userRepository.createSession(session);

    await auditRepository.record({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      module: 'auth',
      action: 'SUCCESSFUL_LOGIN',
      recordAffected: user.email,
      ipAddress: ip,
      severity: 'INFO',
    });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        accountStatus: user.accountStatus,
      },
    };
  }

  async validateSession(token: string) {
    if (!token) return null;
    const session = await userRepository.findSessionByToken(token);
    if (!session) return null;

    const user = await userRepository.findById(session.userId);
    if (!user || !user.isActive || user.accountStatus !== 'ACTIVE') return null;

    return { session, user };
  }

  async revokeSession(token: string) {
    await userRepository.revokeSession(token);
  }
}

export const userService = new UserService();
