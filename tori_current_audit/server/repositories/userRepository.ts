import { getPrismaClient } from '../db/prisma';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  name: string;
  avatarUrl?: string;
  role: string;
  department?: string;
  employeeId?: string;
  isActive: boolean;
  accountStatus: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DEACTIVATED' | 'LOCKED';
  mustChangePasswordOnFirstLogin: boolean;
  failedLoginAttempts: number;
  lockoutUntil?: Date | null;
  lastPasswordChange: Date;
  lastLoginAt?: Date | null;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRecord {
  id: string;
  sessionToken: string;
  userId: string;
  ipAddress: string;
  userAgent?: string;
  device?: string;
  browser?: string;
  location?: string;
  isValid: boolean;
  expiresAt: Date;
  lastActiveAt: Date;
  createdAt: Date;
}

export class UserRepository {
  private fallbackUsers = new Map<string, UserRecord>();
  private fallbackSessions = new Map<string, SessionRecord>();

  constructor() {
    // Seed demo identities only in non-production environments.
    if (process.env.NODE_ENV !== 'production') this.seedFallbackUsers();
  }

  private seedFallbackUsers() {
    const defaultUsers: Partial<UserRecord>[] = [
      {
        id: 'usr-saif',
        email: 'saif@toriwear.com',
        name: 'Mohammed Saif',
        role: 'SUPER_ADMIN',
        department: 'Founders Office & Brand Direction',
        employeeId: 'TORI-001',
        isActive: true,
        accountStatus: 'ACTIVE',
        mustChangePasswordOnFirstLogin: false,
        failedLoginAttempts: 0,
        twoFactorEnabled: false,
      },
      {
        id: 'usr-simranjeet',
        email: 'simranjeet@toriwear.com',
        name: 'Simranjeet Singh',
        role: 'PARTNER',
        department: 'Production & Supply Chain',
        employeeId: 'TORI-002',
        isActive: true,
        accountStatus: 'ACTIVE',
        mustChangePasswordOnFirstLogin: false,
        failedLoginAttempts: 0,
        twoFactorEnabled: false,
      },
      {
        id: 'usr-lokesh',
        email: 'lokesh@toriwear.com',
        name: 'Lokesh Sharma',
        role: 'PARTNER',
        department: 'Creative & Anime Concept Art',
        employeeId: 'TORI-003',
        isActive: true,
        accountStatus: 'ACTIVE',
        mustChangePasswordOnFirstLogin: false,
        failedLoginAttempts: 0,
        twoFactorEnabled: false,
      },
      {
        id: 'usr-nagesh',
        email: 'nagesh@toriwear.com',
        name: 'Nagesh Rao',
        role: 'PARTNER',
        department: 'E-commerce & Growth Marketing',
        employeeId: 'TORI-004',
        isActive: true,
        accountStatus: 'ACTIVE',
        mustChangePasswordOnFirstLogin: false,
        failedLoginAttempts: 0,
        twoFactorEnabled: false,
      },
      {
        id: 'usr-ananya',
        email: 'ananya@toriwear.com',
        name: 'Ananya Roy',
        role: 'STORE_MANAGER',
        department: 'Store Operations',
        employeeId: 'TORI-STF-01',
        isActive: true,
        accountStatus: 'ACTIVE',
        mustChangePasswordOnFirstLogin: false,
        failedLoginAttempts: 0,
      },
      {
        id: 'usr-vikram',
        email: 'vikram@toriwear.com',
        name: 'Vikram Mehta',
        role: 'INVENTORY_MANAGER',
        department: 'Warehouse & Stock',
        employeeId: 'TORI-STF-02',
        isActive: true,
        accountStatus: 'ACTIVE',
        mustChangePasswordOnFirstLogin: false,
        failedLoginAttempts: 0,
      },
    ];

    const now = new Date();
    for (const u of defaultUsers) {
      this.fallbackUsers.set(u.id!, {
        id: u.id!,
        email: u.email!,
        passwordHash: '',
        salt: '',
        name: u.name!,
        role: u.role!,
        department: u.department,
        employeeId: u.employeeId,
        isActive: u.isActive ?? true,
        accountStatus: u.accountStatus ?? 'ACTIVE',
        mustChangePasswordOnFirstLogin: u.mustChangePasswordOnFirstLogin ?? false,
        failedLoginAttempts: 0,
        lastPasswordChange: now,
        twoFactorEnabled: u.twoFactorEnabled ?? false,
        twoFactorSecret: u.twoFactorSecret,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  async findById(id: string): Promise<UserRecord | null> {
    const prisma = getPrismaClient();
    if (prisma?.user) {
      try {
        const found = await prisma.user.findUnique({ where: { id } });
        if (found) return found as UserRecord;
      } catch (err) {
        console.error('[REPO] Error querying user by ID:', err);
      }
    }
    return process.env.NODE_ENV === 'production' ? null : (this.fallbackUsers.get(id) || null);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const prisma = getPrismaClient();
    const cleanEmail = email.trim().toLowerCase();
    if (prisma?.user) {
      try {
        const found = await prisma.user.findUnique({ where: { email: cleanEmail } });
        if (found) return found as UserRecord;
      } catch (err) {
        console.error('[REPO] Error querying user by email:', err);
      }
    }
    if (process.env.NODE_ENV !== 'production') {
      for (const user of this.fallbackUsers.values()) {
        if (user.email.toLowerCase() === cleanEmail) return user;
      }
    }
    return null;
  }

  async findByIdentifier(identifier: string): Promise<UserRecord | null> {
    const clean = identifier.trim().toLowerCase();
    const userByEmail = await this.findByEmail(clean);
    if (userByEmail) return userByEmail;

    const userById = await this.findById(identifier.trim());
    if (userById) return userById;

    const prisma = getPrismaClient();
    if (prisma?.user) {
      try {
        const byEmp = await prisma.user.findFirst({
          where: { employeeId: identifier.trim() },
        });
        if (byEmp) return byEmp as UserRecord;
      } catch (err) {
        console.error('[REPO] Error querying user by employeeId:', err);
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      for (const user of this.fallbackUsers.values()) {
        if (user.employeeId?.toLowerCase() === clean) return user;
      }
    }
    return null;
  }

  async getAll(): Promise<UserRecord[]> {
    const prisma = getPrismaClient();
    if (prisma?.user) {
      try {
        return (await prisma.user.findMany()) as UserRecord[];
      } catch (err) {
        console.error('[REPO] Error querying all users:', err);
      }
    }
    return process.env.NODE_ENV === 'production' ? [] : Array.from(this.fallbackUsers.values());
  }

  async createSession(session: SessionRecord): Promise<SessionRecord> {
    const prisma = getPrismaClient();
    if (prisma?.session) {
      try {
        await prisma.session.create({
          data: {
            id: session.id,
            token: session.sessionToken,
            userId: session.userId,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            device: session.device,
            browser: session.browser,
            location: session.location,
            isValid: session.isValid,
            expiresAt: session.expiresAt,
            lastActiveAt: session.lastActiveAt,
            createdAt: session.createdAt,
          },
        });
        this.fallbackSessions.set(session.sessionToken, session);
        return session;
      } catch (err) {
        console.error('[REPO] Error saving session to database:', err);
      }
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Persistent database session storage is required in production.');
    }
    this.fallbackSessions.set(session.sessionToken, session);
    return session;
  }

  async findSessionByToken(token: string): Promise<SessionRecord | null> {
    const prisma = getPrismaClient();
    if (prisma?.session) {
      try {
        const found = await prisma.session.findUnique({ where: { token } });
        if (found && found.isValid && found.expiresAt > new Date()) {
          const rec: SessionRecord = {
            id: found.id,
            sessionToken: found.token,
            userId: found.userId || '',
            ipAddress: found.ipAddress || '',
            userAgent: found.userAgent || undefined,
            device: found.device || undefined,
            browser: found.browser || undefined,
            location: found.location || undefined,
            isValid: found.isValid,
            expiresAt: found.expiresAt,
            lastActiveAt: found.lastActiveAt,
            createdAt: found.createdAt,
          };
          this.fallbackSessions.set(token, rec);
          return rec;
        }
      } catch (err: any) {
        if (err?.code !== 'P2021') {
          console.warn('[REPO] Note querying session in database, using fallback:', err?.message || err);
        }
      }
    }
    if (process.env.NODE_ENV === 'production') return null;
    const mem = this.fallbackSessions.get(token);
    if (mem && mem.isValid && mem.expiresAt.getTime() > Date.now()) {
      return mem;
    }
    return null;
  }

  async revokeSession(token: string): Promise<void> {
    const prisma = getPrismaClient();
    if (prisma?.session) {
      try {
        await prisma.session.updateMany({
          where: { token },
          data: { isValid: false },
        });
      } catch (err) {
        console.error('[REPO] Error revoking session:', err);
        if (process.env.NODE_ENV === 'production') throw new Error('Could not revoke production session in persistent storage.');
      }
    }
    if (process.env.NODE_ENV === 'production' && !prisma?.session) {
      throw new Error('Persistent database session storage is required to revoke production sessions.');
    }
    const mem = this.fallbackSessions.get(token);
    if (mem) {
      mem.isValid = false;
    }
  }

  async updateFailedAttempts(userId: string, attempts: number, lockoutUntil?: Date | null): Promise<void> {
    const prisma = getPrismaClient();
    if (process.env.NODE_ENV === 'production') {
      if (!prisma?.user) throw new Error('Persistent database is required for production authentication.');
      await prisma.user.update({ where: { id: userId }, data: { failedLoginAttempts: attempts, lockoutUntil: lockoutUntil ?? null } });
      return;
    }
    const user = this.fallbackUsers.get(userId);
    if (user) {
      user.failedLoginAttempts = attempts;
      user.lockoutUntil = lockoutUntil;
    }
  }
}

export const userRepository = new UserRepository();
