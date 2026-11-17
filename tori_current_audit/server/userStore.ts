import fs from 'fs';
import {
  PlatformUser,
  GranularPermissions,
  SecurityPolicyConfig,
  ActiveSession,
  ModuleName,
  PermissionAction,
  AdminAccessTier,
} from './rbacTypes';
import { auditStore } from './auditStore';
import { resolveSecureStorePath } from './utils/storageHelper';
import { getPrismaClient } from './db/prisma';

const ALL_MODULES: ModuleName[] = [
  'dashboard',
  'products',
  'inventory',
  'orders',
  'customers',
  'customerSupport',
  'marketing',
  'catalog',
  'shipping',
  'finance',
  'reports',
  'communication',
  'meetings',
  'aiDesignLab',
  'website',
  'staff',
  'security',
  'settings',
  'superAdmin',
];

const ALL_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'approve', 'export', 'delete'];

const PARTNER_PERMISSIONS_STORE_PATH = resolveSecureStorePath(
  '.partner-permissions.json',
  'public/generated-assets/.partner-permissions.json'
);
const PARTNER_PERMISSIONS_DB_KEY = 'platform.partner_permissions_overrides';

export const FULL_SUPER_ADMIN_PERMISSIONS: GranularPermissions = {
  dashboard: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  products: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  inventory: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  orders: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  customers: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  customerSupport: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  marketing: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  catalog: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  shipping: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  finance: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  reports: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  communication: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  meetings: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  aiDesignLab: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  website: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  staff: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  security: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  settings: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  superAdmin: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
};

export const FULL_ADMIN_PARTNER_PERMISSIONS: GranularPermissions = {
  dashboard: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  products: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  inventory: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  orders: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  customers: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  customerSupport: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  marketing: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  catalog: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  shipping: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  finance: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  reports: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  communication: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  meetings: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  aiDesignLab: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  website: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  staff: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  security: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  settings: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
  superAdmin: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
};

export const PARTNER_PERMISSIONS: GranularPermissions = {
  dashboard: ['view', 'export'],
  products: ['view', 'create', 'edit', 'approve', 'export'],
  inventory: ['view', 'create', 'edit', 'approve', 'export'],
  orders: ['view', 'create', 'edit', 'approve', 'export'],
  customers: ['view', 'edit', 'export'],
  customerSupport: ['view', 'edit', 'export'],
  marketing: ['view', 'create', 'edit', 'approve', 'export'],
  catalog: ['view', 'create', 'edit', 'approve', 'export'],
  shipping: ['view', 'edit', 'export'],
  finance: ['view', 'create', 'edit', 'approve', 'export'],
  reports: ['view', 'export'],
  communication: ['view', 'create', 'edit', 'approve', 'export'],
  meetings: ['view', 'create', 'edit', 'approve', 'export'],
  aiDesignLab: ['view', 'create', 'edit', 'approve', 'export'],
  website: ['view', 'edit'],
  staff: [],
  security: [],
  settings: [],
  superAdmin: [], // Restricted governance modules require explicit Super Admin grant
};

export const EXEC_VIEW_ONLY_PARTNER_PERMISSIONS: GranularPermissions = ALL_MODULES.reduce(
  (acc, mod) => {
    acc[mod] = ['view'];
    return acc;
  },
  {} as GranularPermissions
);

export const DEFAULT_STAFF_PERMISSIONS: GranularPermissions = {
  dashboard: ['view'],
  products: ['view'],
  inventory: ['view'],
  orders: ['view'],
  customers: ['view'],
  customerSupport: ['view'],
  marketing: ['view'],
  catalog: ['view'],
  shipping: ['view'],
  finance: [],
  reports: ['view'],
  communication: ['view', 'create'],
  meetings: ['view'],
  aiDesignLab: ['view'],
  website: [],
  staff: [],
  security: [],
  settings: [],
  superAdmin: [],
};

export function normalizeGranularPermissions(
  raw?: Partial<Record<string, unknown>> | null,
  fallback: GranularPermissions = PARTNER_PERMISSIONS
): GranularPermissions {
  const result = {} as GranularPermissions;
  for (const mod of ALL_MODULES) {
    const rawList = raw && Array.isArray(raw[mod]) ? (raw[mod] as unknown[]) : fallback[mod] || [];
    const cleaned = Array.from(
      new Set(
        rawList.filter(
          (a): a is PermissionAction => typeof a === 'string' && ALL_ACTIONS.includes(a as PermissionAction)
        )
      )
    );
    result[mod] = cleaned;
  }
  return result;
}

export function computeAdminAccessTier(
  user: Pick<PlatformUser, 'role' | 'id' | 'email' | 'permissions'>
): AdminAccessTier {
  if (user.role === 'SUPER_ADMIN' || user.id === 'usr-saif' || user.email?.toLowerCase() === 'admin@toriwear.com') {
    return 'SUPER_ADMIN';
  }
  const perms = user.permissions;
  const hasSuperAdminFull =
    Boolean(perms?.superAdmin?.includes('edit')) &&
    Boolean(perms?.staff?.includes('edit')) &&
    Boolean(perms?.security?.includes('edit')) &&
    Boolean(perms?.settings?.includes('edit'));
  if (hasSuperAdminFull) {
    return 'FULL_ADMIN';
  }
  const hasAnyElevated =
    (perms?.superAdmin?.length || 0) > 0 ||
    (perms?.staff?.length || 0) > 0 ||
    (perms?.security?.length || 0) > 0 ||
    (perms?.settings?.length || 0) > 0;
  return hasAnyElevated ? 'ELEVATED_PARTNER' : 'STANDARD_PARTNER';
}

interface PartnerPermissionOverrideRecord {
  permissions: GranularPermissions;
  adminAccessTier: AdminAccessTier;
  updatedAt: string;
  updatedBy: string;
}

class UserStore {
  private users: PlatformUser[] = [];
  private partnerPermissionOverrides = new Map<string, PartnerPermissionOverrideRecord>();
  private securityPolicies: SecurityPolicyConfig = {
    requireTwoFactorForStaff: false,
    requireTwoFactorForPartners: false,
    minPasswordLength: 10,
    requireSpecialChar: true,
    sessionTimeoutMinutes: 60,
    maxFailedLoginsBeforeLock: 5,
    lockoutDurationMinutes: 15,
    allowScreenSharingInMeetings: true,
    enforceE2EEncryptionInPrivateChat: true,
    allowCrossDepartmentChat: true,
  };

  constructor() {
    this.loadPermissionsFromDisk();
    this.seedUsers();
  }

  private loadPermissionsFromDisk() {
    try {
      if (!fs.existsSync(PARTNER_PERMISSIONS_STORE_PATH)) return;
      const raw = fs.readFileSync(PARTNER_PERMISSIONS_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      for (const [partnerId, rec] of Object.entries<any>(parsed)) {
        if (!partnerId || partnerId === 'usr-saif' || !rec || typeof rec !== 'object') continue;
        const normalizedPerms = normalizeGranularPermissions(rec.permissions, PARTNER_PERMISSIONS);
        const tier: AdminAccessTier = rec.adminAccessTier || computeAdminAccessTier({
          id: partnerId,
          role: 'PARTNER',
          email: '',
          permissions: normalizedPerms,
        });
        this.partnerPermissionOverrides.set(partnerId, {
          permissions: normalizedPerms,
          adminAccessTier: tier,
          updatedAt: rec.updatedAt || new Date().toISOString(),
          updatedBy: rec.updatedBy || 'usr-saif',
        });
      }
    } catch (err) {
      console.warn('[USER_STORE] Failed to read partner permissions override file:', err);
    }
  }

  private applyOverridesToUsers() {
    for (const user of this.users) {
      if (this.isRootSuperAdmin(user)) {
        user.permissions = normalizeGranularPermissions(FULL_SUPER_ADMIN_PERMISSIONS, FULL_SUPER_ADMIN_PERMISSIONS);
        user.adminAccessTier = 'SUPER_ADMIN';
        continue;
      }
      if (user.role === 'PARTNER') {
        const override = this.partnerPermissionOverrides.get(user.id) || this.partnerPermissionOverrides.get(user.email.toLowerCase());
        if (override) {
          user.permissions = normalizeGranularPermissions(override.permissions, PARTNER_PERMISSIONS);
          user.adminAccessTier = override.adminAccessTier || computeAdminAccessTier(user);
        } else {
          user.permissions = normalizeGranularPermissions(user.permissions, PARTNER_PERMISSIONS);
          user.adminAccessTier = computeAdminAccessTier(user);
        }
      }
    }
  }

  private persistPermissionsOverrides() {
    const payload: Record<string, PartnerPermissionOverrideRecord> = {};
    for (const [key, val] of this.partnerPermissionOverrides.entries()) {
      payload[key] = val;
    }
    const serialized = JSON.stringify(payload, null, 2);
    try {
      const tmpPath = `${PARTNER_PERMISSIONS_STORE_PATH}.tmp`;
      fs.writeFileSync(tmpPath, serialized, 'utf-8');
      fs.renameSync(tmpPath, PARTNER_PERMISSIONS_STORE_PATH);
    } catch (err) {
      console.warn('[USER_STORE] Failed to persist partner permissions to disk:', err);
    }

    const prisma = getPrismaClient();
    if (prisma?.websiteSetting) {
      prisma.websiteSetting
        .upsert({
          where: { key: PARTNER_PERMISSIONS_DB_KEY },
          create: {
            key: PARTNER_PERMISSIONS_DB_KEY,
            value: serialized,
            group: 'GENERAL',
            isPublic: false,
            description: 'Super Admin granular partner permission overrides',
          },
          update: { value: serialized },
        })
        .catch((err: unknown) => {
          console.warn('[USER_STORE] Failed to persist partner permissions to MySQL:', err);
        });
    }
  }

  public async hydratePermissionsFromDb(): Promise<void> {
    try {
      const prisma = getPrismaClient();
      if (!prisma?.websiteSetting) return;
      const row = await prisma.websiteSetting.findUnique({
        where: { key: PARTNER_PERMISSIONS_DB_KEY },
      });
      if (!row?.value) {
        if (this.partnerPermissionOverrides.size > 0) {
          this.persistPermissionsOverrides();
        }
        return;
      }
      const parsed = JSON.parse(row.value);
      if (!parsed || typeof parsed !== 'object') return;
      for (const [partnerId, rec] of Object.entries<any>(parsed)) {
        if (!partnerId || partnerId === 'usr-saif' || !rec || typeof rec !== 'object') continue;
        const normalizedPerms = normalizeGranularPermissions(rec.permissions, PARTNER_PERMISSIONS);
        const tier: AdminAccessTier =
          rec.adminAccessTier ||
          computeAdminAccessTier({
            id: partnerId,
            role: 'PARTNER',
            email: '',
            permissions: normalizedPerms,
          });
        this.partnerPermissionOverrides.set(partnerId, {
          permissions: normalizedPerms,
          adminAccessTier: tier,
          updatedAt: rec.updatedAt || new Date().toISOString(),
          updatedBy: rec.updatedBy || 'usr-saif',
        });
      }
      this.applyOverridesToUsers();
    } catch (err) {
      console.warn('[USER_STORE] Failed to hydrate partner permissions from MySQL:', err);
    }
  }

  private seedUsers() {
    const now = new Date().toISOString();

    const initialSessions: ActiveSession[] = [
      {
        sessionId: 'sess-saif-primary',
        ipAddress: '103.21.144.12',
        device: 'MacBook Pro 16" (macOS Sonoma)',
        browser: 'Google Chrome 128.0',
        location: 'Bengaluru, India',
        loginTime: 'Today at 08:30 AM IST',
        lastActivity: 'Active Now',
        isCurrent: true,
      },
      {
        sessionId: 'sess-saif-mobile',
        ipAddress: '103.21.144.18',
        device: 'iPhone 15 Pro Max (iOS 18)',
        browser: 'Safari Mobile 18.0',
        location: 'Bengaluru, India',
        loginTime: 'Yesterday at 09:12 PM IST',
        lastActivity: '3 hours ago',
        isCurrent: false,
      }
    ];

    this.users = [
      // 1. SUPER ADMIN & PARTNER 1: Mohammed Saif
      {
        id: 'usr-saif',
        name: 'Mohammed Saif',
        email: 'admin@toriwear.com',
        phone: '+91 98450 12091',
        employeeId: 'TORI-EMP-001',
        role: 'SUPER_ADMIN',
        designation: 'Founder & Super Admin',
        department: 'Executive Leadership',
        accountStatus: 'ACTIVE',
        ownershipPercentage: 25,
        profitSharePercentage: 25,
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
        twoFactorEnabled: false,
        lastLogin: 'Today at 08:30 AM IST',
        createdBy: 'SYSTEM_GENESIS',
        createdAt: '2025-04-01T00:00:00.000Z',
        updatedAt: now,
        permissions: FULL_SUPER_ADMIN_PERMISSIONS,
        activeSessions: initialSessions,
      },

      // 2. PARTNER 2: Simranjeet Singh
      {
        id: 'usr-simranjeet',
        name: 'Simranjeet Singh',
        email: 'simranjeet@toriwear.com',
        phone: '+91 98201 44810',
        employeeId: 'TORI-EMP-002',
        role: 'PARTNER',
        designation: 'Operations & Production Partner',
        department: 'Production & Quality',
        accountStatus: 'ACTIVE',
        ownershipPercentage: 25,
        profitSharePercentage: 25,
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        twoFactorEnabled: false,
        lastLogin: 'Today at 09:15 AM IST',
        createdBy: 'usr-saif',
        createdAt: '2025-04-01T00:00:00.000Z',
        updatedAt: now,
        permissions: PARTNER_PERMISSIONS,
        activeSessions: [
          {
            sessionId: 'sess-simran-1',
            ipAddress: '49.207.210.45',
            device: 'Dell XPS 15 (Windows 11)',
            browser: 'Chrome 128.0',
            location: 'Tirupur, India',
            loginTime: 'Today at 09:15 AM IST',
            lastActivity: '15 mins ago',
            isCurrent: false,
          }
        ],
      },

      // 3. PARTNER 3: Lokesh Kottala
      {
        id: 'usr-lokesh',
        name: 'Lokesh Kottala',
        email: 'lokesh@toriwear.com',
        phone: '+91 97112 88203',
        employeeId: 'TORI-EMP-003',
        role: 'PARTNER',
        designation: 'Creative & Brand Art Director',
        department: 'Design & Creative',
        accountStatus: 'ACTIVE',
        ownershipPercentage: 25,
        profitSharePercentage: 25,
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
        twoFactorEnabled: false,
        lastLogin: 'Today at 10:02 AM IST',
        createdBy: 'usr-saif',
        createdAt: '2025-04-01T00:00:00.000Z',
        updatedAt: now,
        permissions: PARTNER_PERMISSIONS,
        activeSessions: [
          {
            sessionId: 'sess-lokesh-1',
            ipAddress: '122.161.49.88',
            device: 'Apple iMac 24" M3',
            browser: 'Safari 18.0',
            location: 'Bengaluru, India',
            loginTime: 'Today at 10:02 AM IST',
            lastActivity: 'Just now',
            isCurrent: false,
          }
        ],
      },

      // 4. PARTNER 4: Nagesh M
      {
        id: 'usr-nagesh',
        name: 'Nagesh M',
        email: 'nagesh@toriwear.com',
        phone: '+91 99304 77192',
        employeeId: 'TORI-EMP-004',
        role: 'PARTNER',
        designation: 'Growth & Retail Distribution Partner',
        department: 'Marketing & Growth',
        accountStatus: 'ACTIVE',
        ownershipPercentage: 25,
        profitSharePercentage: 25,
        avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80',
        twoFactorEnabled: false,
        lastLogin: 'Today at 08:45 AM IST',
        createdBy: 'usr-saif',
        createdAt: '2025-04-01T00:00:00.000Z',
        updatedAt: now,
        permissions: PARTNER_PERMISSIONS,
        activeSessions: [
          {
            sessionId: 'sess-nagesh-1',
            ipAddress: '157.48.91.22',
            device: 'ThinkPad X1 Carbon',
            browser: 'Firefox Developer 130',
            location: 'Mumbai, India',
            loginTime: 'Today at 08:45 AM IST',
            lastActivity: '40 mins ago',
            isCurrent: false,
          }
        ],
      },

      // 5. STAFF: Ananya Sharma
      {
        id: 'usr-ananya',
        name: 'Ananya Sharma',
        email: 'ananya.operations@toriwear.com',
        phone: '+91 98451 22819',
        employeeId: 'TORI-STAFF-101',
        role: 'STAFF',
        designation: 'Store Operations Manager',
        department: 'Store & Operations',
        accountStatus: 'ACTIVE',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
        twoFactorEnabled: false,
        lastLogin: 'Today at 09:30 AM IST',
        createdBy: 'usr-saif',
        createdAt: '2025-05-15T00:00:00.000Z',
        updatedAt: now,
        permissions: {
          ...DEFAULT_STAFF_PERMISSIONS,
          dashboard: ['view'],
          orders: ['view', 'create', 'edit', 'approve', 'export'],
          customers: ['view', 'edit', 'export'],
          customerSupport: ['view', 'edit', 'export'],
          catalog: ['view', 'export'],
          shipping: ['view', 'edit', 'approve', 'export'],
          communication: ['view', 'create', 'edit'],
          meetings: ['view', 'create'],
        },
        activeSessions: [
          {
            sessionId: 'sess-ananya-1',
            ipAddress: '106.51.78.11',
            device: 'MacBook Air M2',
            browser: 'Chrome 128.0',
            location: 'Bengaluru, India',
            loginTime: 'Today at 09:30 AM IST',
            lastActivity: 'Active now',
            isCurrent: false,
          }
        ],
      },

      // 6. STAFF: Vikram Mehta
      {
        id: 'usr-vikram',
        name: 'Vikram Mehta',
        email: 'vikram.inventory@toriwear.com',
        phone: '+91 98711 55029',
        employeeId: 'TORI-STAFF-102',
        role: 'STAFF',
        designation: 'Warehouse & Inventory Lead',
        department: 'Inventory & Warehouse',
        accountStatus: 'ACTIVE',
        avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
        twoFactorEnabled: false,
        lastLogin: 'Yesterday at 04:30 PM IST',
        createdBy: 'usr-simranjeet',
        createdAt: '2025-06-01T00:00:00.000Z',
        updatedAt: now,
        permissions: {
          ...DEFAULT_STAFF_PERMISSIONS,
          dashboard: ['view'],
          inventory: ['view', 'create', 'edit', 'export'],
          products: ['view', 'export'],
          shipping: ['view', 'edit'],
          communication: ['view', 'create'],
          meetings: ['view'],
        },
        activeSessions: [],
      },

      // 7. STAFF: Priya Patel
      {
        id: 'usr-priya',
        name: 'Priya Patel',
        email: 'priya.marketing@toriwear.com',
        phone: '+91 99201 88301',
        employeeId: 'TORI-STAFF-103',
        role: 'STAFF',
        designation: 'Growth & Ads Specialist',
        department: 'Marketing & Growth',
        accountStatus: 'ACTIVE',
        avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80',
        twoFactorEnabled: false,
        lastLogin: 'Today at 07:15 AM IST',
        createdBy: 'usr-nagesh',
        createdAt: '2025-06-10T00:00:00.000Z',
        updatedAt: now,
        permissions: {
          ...DEFAULT_STAFF_PERMISSIONS,
          dashboard: ['view'],
          marketing: ['view', 'create', 'edit', 'export'],
          customers: ['view', 'export'],
          catalog: ['view', 'export'],
          communication: ['view', 'create'],
          meetings: ['view', 'create'],
          aiDesignLab: ['view', 'create', 'edit'],
        },
        activeSessions: [],
      },

      // 8. STAFF: Rahul Varma
      {
        id: 'usr-rahul',
        name: 'Rahul Varma',
        email: 'rahul.qc@toriwear.com',
        phone: '+91 97890 11203',
        employeeId: 'TORI-STAFF-104',
        role: 'STAFF',
        designation: 'Print QA & Fabric Inspector',
        department: 'Production & Quality',
        accountStatus: 'ACTIVE',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        twoFactorEnabled: false,
        lastLogin: '2 days ago',
        createdBy: 'usr-simranjeet',
        createdAt: '2025-07-01T00:00:00.000Z',
        updatedAt: now,
        permissions: {
          ...DEFAULT_STAFF_PERMISSIONS,
          dashboard: ['view'],
          products: ['view'],
          inventory: ['view', 'edit'],
          communication: ['view', 'create'],
          meetings: ['view'],
        },
        activeSessions: [],
      }
    ];

    this.applyOverridesToUsers();
  }

  // --- Readers ---

  private enrichUserView(user: PlatformUser): PlatformUser {
    return {
      ...user,
      adminAccessTier: user.adminAccessTier || computeAdminAccessTier(user),
    };
  }

  public getAllUsers(): PlatformUser[] {
    return this.users.map(u => this.enrichUserView(u));
  }

  public getPartners(): PlatformUser[] {
    return this.users
      .filter(u => u.role === 'PARTNER' || (u.role === 'SUPER_ADMIN' && u.ownershipPercentage))
      .map(u => this.enrichUserView(u));
  }

  public getStaff(): PlatformUser[] {
    return this.users.filter(u => u.role === 'STAFF').map(u => this.enrichUserView(u));
  }

  public getUserById(id: string): PlatformUser | undefined {
    const found = this.users.find(u => u.id === id);
    return found ? this.enrichUserView(found) : undefined;
  }

  public getUserByEmail(email: string): PlatformUser | undefined {
    const found = this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    return found ? this.enrichUserView(found) : undefined;
  }

  public getSecurityPolicies(): SecurityPolicyConfig {
    return { ...this.securityPolicies };
  }

  // --- Super Admin Protection & Capability Helpers ---

  public isRootSuperAdmin(user?: Pick<PlatformUser, 'id' | 'role' | 'email'> | null): boolean {
    if (!user) return false;
    return (
      user.role === 'SUPER_ADMIN' ||
      user.id === 'usr-saif' ||
      user.email?.toLowerCase() === 'admin@toriwear.com'
    );
  }

  public isSuperAdminUser(userId: string): boolean {
    const user = this.users.find(u => u.id === userId);
    return this.isRootSuperAdmin(user);
  }

  public hasAdminCapability(
    user: PlatformUser | undefined,
    moduleName: ModuleName,
    action: PermissionAction = 'view'
  ): boolean {
    if (!user) return false;
    if (this.isRootSuperAdmin(user)) return true;
    if (user.accountStatus !== 'ACTIVE') return false;
    return Boolean(user.permissions?.[moduleName]?.includes(action));
  }

  // --- Partner Management (Super Admin Exclusive) ---

  public createPartner(params: {
    name: string;
    email: string;
    phone?: string;
    roleDesignation: string;
    department?: string;
    actor: PlatformUser;
  }): { success: boolean; partner?: PlatformUser; error?: string } {
    if (params.actor.role !== 'SUPER_ADMIN') {
      return { success: false, error: 'Authorization violation: Only Super Admin can create partner accounts.' };
    }

    if (this.getUserByEmail(params.email)) {
      return { success: false, error: 'An account with this email address already exists.' };
    }

    const newPartner: PlatformUser = {
      id: `usr-ptr-${Date.now()}`,
      name: params.name,
      email: params.email.toLowerCase(),
      phone: params.phone,
      employeeId: `TORI-PTR-${Date.now().toString().slice(-4)}`,
      role: 'PARTNER',
      designation: params.roleDesignation,
      department: (params.department as any) || 'Executive Leadership',
      accountStatus: 'ACTIVE',
      ownershipPercentage: 25,
      profitSharePercentage: 25,
      twoFactorEnabled: this.securityPolicies.requireTwoFactorForPartners,
      lastLogin: 'Never',
      createdBy: params.actor.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      permissions: { ...PARTNER_PERMISSIONS },
      activeSessions: [],
    };

    this.users.push(newPartner);

    auditStore.record({
      userId: params.actor.id,
      userName: params.actor.name,
      userRole: params.actor.role,
      module: 'partners',
      action: 'PARTNER_CREATED',
      recordAffected: `${newPartner.name} (${newPartner.email})`,
      newValue: `Role: PARTNER (25% Equal Structure), Created by ${params.actor.name}`,
      ipAddress: '103.21.144.12',
      severity: 'CRITICAL',
    });

    return { success: true, partner: newPartner };
  }

  public updatePartner(partnerId: string, updates: Partial<PlatformUser>, actor: PlatformUser): { success: boolean; error?: string } {
    if (!this.isRootSuperAdmin(actor)) {
      return { success: false, error: 'Authorization violation: Only Super Admin can modify partner credentials or permissions.' };
    }

    const partner = this.users.find(u => u.id === partnerId);
    if (!partner) {
      return { success: false, error: 'Partner not found.' };
    }

    // Protection rule: Never allow deactivating or stripping the Super Admin account
    if (this.isRootSuperAdmin(partner) && (updates.accountStatus === 'SUSPENDED' || updates.role && updates.role !== 'SUPER_ADMIN')) {
      return { success: false, error: 'Super Admin protection rule: Super Admin account cannot be deactivated or downgraded.' };
    }

    const safeUpdates: Partial<PlatformUser> = { ...updates };
    if (safeUpdates.permissions) {
      safeUpdates.permissions = normalizeGranularPermissions(safeUpdates.permissions, PARTNER_PERMISSIONS);
    }

    const oldStatus = partner.accountStatus;
    Object.assign(partner, {
      ...safeUpdates,
      updatedAt: new Date().toISOString(),
    });

    if (partner.role === 'PARTNER' && safeUpdates.permissions) {
      const tier = computeAdminAccessTier(partner);
      partner.adminAccessTier = tier;
      this.partnerPermissionOverrides.set(partner.id, {
        permissions: partner.permissions,
        adminAccessTier: tier,
        updatedAt: partner.updatedAt,
        updatedBy: actor.id,
      });
      this.persistPermissionsOverrides();
    }

    auditStore.record({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      module: 'partners',
      action: 'PARTNER_UPDATED',
      recordAffected: `${partner.name} (${partner.email})`,
      previousValue: `Status: ${oldStatus}`,
      newValue: `Updated fields: ${Object.keys(safeUpdates).join(', ')}`,
      ipAddress: '103.21.144.12',
      severity: 'WARNING',
    });

    return { success: true };
  }

  public updatePartnerPermissions(
    partnerId: string,
    rawPermissions: Partial<GranularPermissions> | undefined,
    requestedTier: AdminAccessTier | undefined,
    actor: PlatformUser,
    preset?: 'FULL_ADMIN' | 'STANDARD_PARTNER' | 'EXEC_VIEW_ONLY'
  ): { success: boolean; partner?: PlatformUser; error?: string; statusCode?: number } {
    if (!this.isRootSuperAdmin(actor)) {
      return {
        success: false,
        statusCode: 403,
        error: 'Authorization violation: Only Super Admin (Mohammed Saif) can grant or modify partner admin access.',
      };
    }

    const partner = this.users.find(u => u.id === partnerId);
    if (!partner) {
      return { success: false, statusCode: 404, error: 'Partner account not found.' };
    }

    if (this.isRootSuperAdmin(partner)) {
      return {
        success: false,
        statusCode: 403,
        error: 'Super Admin protection rule: Mohammed Saif root account permissions are immutable.',
      };
    }

    if (partner.role !== 'PARTNER') {
      return { success: false, statusCode: 400, error: 'Target user is not a Partner account.' };
    }

    const basePermissions =
      preset === 'FULL_ADMIN'
        ? FULL_ADMIN_PARTNER_PERMISSIONS
        : preset === 'STANDARD_PARTNER'
          ? PARTNER_PERMISSIONS
          : preset === 'EXEC_VIEW_ONLY'
            ? EXEC_VIEW_ONLY_PARTNER_PERMISSIONS
            : normalizeGranularPermissions(rawPermissions, partner.permissions || PARTNER_PERMISSIONS);

    const normalized = normalizeGranularPermissions(basePermissions, PARTNER_PERMISSIONS);
    const previousTier = partner.adminAccessTier || computeAdminAccessTier(partner);
    const nextTier =
      preset === 'FULL_ADMIN'
        ? 'FULL_ADMIN'
        : preset === 'STANDARD_PARTNER'
          ? 'STANDARD_PARTNER'
          : preset === 'EXEC_VIEW_ONLY'
            ? 'ELEVATED_PARTNER'
            : requestedTier && requestedTier !== 'SUPER_ADMIN'
              ? requestedTier
              : computeAdminAccessTier({ ...partner, permissions: normalized });

    const nowIso = new Date().toISOString();
    partner.permissions = normalized;
    partner.adminAccessTier = nextTier;
    partner.updatedAt = nowIso;

    this.partnerPermissionOverrides.set(partner.id, {
      permissions: normalized,
      adminAccessTier: nextTier,
      updatedAt: nowIso,
      updatedBy: actor.id,
    });
    this.persistPermissionsOverrides();

    const enabledModules = Object.entries(normalized)
      .filter(([, acts]) => acts.length > 0)
      .map(([mod]) => mod);

    auditStore.record({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      module: 'partners',
      action: 'PARTNER_PERMISSIONS_UPDATED',
      recordAffected: `${partner.name} (${partner.email})`,
      previousValue: `Tier: ${previousTier}`,
      newValue: `Tier: ${nextTier} | Unlocked Modules (${enabledModules.length}): ${enabledModules.join(', ')}`,
      ipAddress: '103.21.144.12',
      severity: 'CRITICAL',
    });

    return { success: true, partner: this.enrichUserView(partner) };
  }

  public deactivatePartner(partnerId: string, actor: PlatformUser): { success: boolean; error?: string } {
    if (actor.role !== 'SUPER_ADMIN') {
      return { success: false, error: 'Authorization violation: Only Super Admin can deactivate a partner.' };
    }

    if (partnerId === 'usr-saif') {
      return { success: false, error: 'Super Admin protection rule: Mohammed Saif Super Admin account cannot be deactivated.' };
    }

    const partner = this.getUserById(partnerId);
    if (!partner) return { success: false, error: 'Partner not found.' };

    partner.accountStatus = 'SUSPENDED';
    partner.activeSessions = [];
    partner.updatedAt = new Date().toISOString();

    auditStore.record({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      module: 'partners',
      action: 'PARTNER_DEACTIVATED',
      recordAffected: `${partner.name} (${partner.email})`,
      newValue: 'Status: SUSPENDED, all active sessions revoked',
      ipAddress: '103.21.144.12',
      severity: 'CRITICAL',
    });

    return { success: true };
  }

  // --- Staff Management (Super Admin & Authorized Partners) ---

  public createStaff(params: {
    name: string;
    email: string;
    phone?: string;
    department: any;
    designation: string;
    permissions?: GranularPermissions;
    actor: PlatformUser;
  }): { success: boolean; staff?: PlatformUser; error?: string } {
    // Only Super Admin and Partners can create staff
    if (params.actor.role !== 'SUPER_ADMIN' && params.actor.role !== 'PARTNER') {
      return { success: false, error: 'Authorization violation: Only Super Admin or Partners can create staff members.' };
    }

    if (this.getUserByEmail(params.email)) {
      return { success: false, error: 'An account with this email address already exists.' };
    }

    const newStaff: PlatformUser = {
      id: `usr-stf-${Date.now()}`,
      name: params.name,
      email: params.email.toLowerCase(),
      phone: params.phone,
      employeeId: `TORI-STAFF-${Math.floor(100 + Math.random() * 900)}`,
      role: 'STAFF',
      designation: params.designation,
      department: params.department,
      accountStatus: 'ACTIVE',
      twoFactorEnabled: this.securityPolicies.requireTwoFactorForStaff,
      lastLogin: 'Never',
      createdBy: params.actor.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      permissions: params.permissions || { ...DEFAULT_STAFF_PERMISSIONS },
      activeSessions: [],
    };

    this.users.push(newStaff);

    auditStore.record({
      userId: params.actor.id,
      userName: params.actor.name,
      userRole: params.actor.role,
      module: 'staff' as any,
      action: 'STAFF_CREATED',
      recordAffected: `${newStaff.name} (${newStaff.email}) - ${newStaff.designation}`,
      newValue: `Department: ${newStaff.department}, Created by ${params.actor.name}`,
      ipAddress: '103.21.144.12',
      severity: 'INFO',
    });

    return { success: true, staff: newStaff };
  }

  public updateStaff(staffId: string, updates: Partial<PlatformUser>, actor: PlatformUser): { success: boolean; error?: string } {
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'PARTNER') {
      return { success: false, error: 'Authorization violation: Only Super Admin or Partners can update staff accounts.' };
    }

    const staff = this.getUserById(staffId);
    if (!staff || staff.role !== 'STAFF') {
      return { success: false, error: 'Staff account not found.' };
    }

    Object.assign(staff, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    auditStore.record({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      module: 'staff' as any,
      action: 'STAFF_UPDATED',
      recordAffected: `${staff.name} (${staff.email})`,
      newValue: `Fields updated: ${Object.keys(updates).join(', ')}`,
      ipAddress: '103.21.144.12',
      severity: 'INFO',
    });

    return { success: true };
  }

  public deactivateStaff(staffId: string, actor: PlatformUser): { success: boolean; error?: string } {
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'PARTNER') {
      return { success: false, error: 'Authorization violation: Only Super Admin or Partners can deactivate staff.' };
    }

    const staff = this.getUserById(staffId);
    if (!staff || staff.role !== 'STAFF') {
      return { success: false, error: 'Staff account not found.' };
    }

    staff.accountStatus = 'SUSPENDED';
    staff.activeSessions = [];
    staff.updatedAt = new Date().toISOString();

    auditStore.record({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      module: 'staff' as any,
      action: 'STAFF_SUSPENDED',
      recordAffected: `${staff.name} (${staff.email})`,
      newValue: 'Account suspended and sessions terminated',
      ipAddress: '103.21.144.12',
      severity: 'WARNING',
    });

    return { success: true };
  }

  // --- Session & Security Policies (Super Admin & Elevated Authorized Partners) ---

  public forceLogoutUser(userId: string, actor: PlatformUser): { success: boolean; error?: string; statusCode?: number } {
    const isRoot = this.isRootSuperAdmin(actor);
    const hasElevatedSecurity =
      actor.role === 'PARTNER' &&
      (this.hasAdminCapability(actor, 'superAdmin', 'edit') || this.hasAdminCapability(actor, 'security', 'edit'));

    if (!isRoot && !hasElevatedSecurity) {
      return { success: false, statusCode: 403, error: 'Authorization violation: Super Admin or elevated security access required to terminate user sessions.' };
    }

    const target = this.users.find(u => u.id === userId);
    if (!target) return { success: false, statusCode: 404, error: 'User not found.' };

    if (!isRoot && (this.isRootSuperAdmin(target) || (target.role === 'PARTNER' && target.id !== actor.id))) {
      return {
        success: false,
        statusCode: 403,
        error: 'Protection rule: Partners cannot terminate sessions for Mohammed Saif (Super Admin) or fellow Partners.',
      };
    }

    target.activeSessions = [];
    target.updatedAt = new Date().toISOString();

    auditStore.record({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      module: 'security',
      action: 'SESSIONS_TERMINATED',
      recordAffected: `${target.name} (${target.email})`,
      newValue: 'All active sessions and tokens invalidated immediately',
      ipAddress: '103.21.144.12',
      severity: 'WARNING',
    });

    return { success: true };
  }

  public resetUser2FA(userId: string, actor: PlatformUser): { success: boolean; error?: string; statusCode?: number } {
    const isRoot = this.isRootSuperAdmin(actor);
    const hasElevatedSecurity =
      actor.role === 'PARTNER' &&
      (this.hasAdminCapability(actor, 'superAdmin', 'edit') || this.hasAdminCapability(actor, 'security', 'edit'));

    if (!isRoot && !hasElevatedSecurity) {
      return { success: false, statusCode: 403, error: 'Authorization violation: Super Admin or elevated security access required to reset two-factor authentication.' };
    }

    const target = this.users.find(u => u.id === userId);
    if (!target) return { success: false, statusCode: 404, error: 'User not found.' };

    if (!isRoot && (this.isRootSuperAdmin(target) || (target.role === 'PARTNER' && target.id !== actor.id))) {
      return {
        success: false,
        statusCode: 403,
        error: 'Protection rule: Partners cannot reset 2FA for Mohammed Saif (Super Admin) or fellow Partners.',
      };
    }

    target.twoFactorEnabled = false;
    target.updatedAt = new Date().toISOString();

    auditStore.record({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      module: 'security',
      action: '2FA_RESET',
      recordAffected: `${target.name} (${target.email})`,
      newValue: '2FA TOTP disabled for recovery re-enrollment',
      ipAddress: '103.21.144.12',
      severity: 'CRITICAL',
    });

    return { success: true };
  }

  public updateSecurityPolicies(updates: Partial<SecurityPolicyConfig>, actor: PlatformUser): { success: boolean; error?: string; statusCode?: number } {
    const isRoot = this.isRootSuperAdmin(actor);
    const hasElevatedSecurity =
      actor.role === 'PARTNER' &&
      (this.hasAdminCapability(actor, 'superAdmin', 'edit') || this.hasAdminCapability(actor, 'security', 'edit'));

    if (!isRoot && !hasElevatedSecurity) {
      return { success: false, statusCode: 403, error: 'Authorization violation: Super Admin or elevated security access required to update enterprise security policies.' };
    }

    Object.assign(this.securityPolicies, updates);

    auditStore.record({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      module: 'security',
      action: 'SECURITY_POLICIES_UPDATED',
      recordAffected: 'Enterprise Platform Security Matrix',
      newValue: JSON.stringify(updates),
      ipAddress: '103.21.144.12',
      severity: 'CRITICAL',
    });

    return { success: true };
  }

  public upsertUserFromDb(dbUser: {
    id: string;
    email: string;
    name: string;
    role: string;
    department?: string | null;
    employeeId?: string | null;
    avatarUrl?: string | null;
    accountStatus?: string | null;
    twoFactorEnabled?: boolean;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
  }): PlatformUser {
    const existing =
      this.users.find((u) => u.id === dbUser.id) ||
      this.users.find((u) => u.email.toLowerCase() === dbUser.email.toLowerCase());

    if (existing) {
      if (dbUser.employeeId && !existing.employeeId) existing.employeeId = dbUser.employeeId;
      if (dbUser.name) existing.name = dbUser.name;
      if (dbUser.department) existing.department = dbUser.department as PlatformUser['department'];
      if (dbUser.accountStatus) existing.accountStatus = dbUser.accountStatus as PlatformUser['accountStatus'];
      if (typeof dbUser.twoFactorEnabled === 'boolean') existing.twoFactorEnabled = dbUser.twoFactorEnabled;
      this.applyOverridesToUsers();
      return this.enrichUserView(existing);
    }

    const roleUpper = String(dbUser.role || 'STAFF').toUpperCase();
    const mappedRole: PlatformUser['role'] =
      roleUpper === 'SUPER_ADMIN'
        ? 'SUPER_ADMIN'
        : roleUpper === 'PARTNER'
          ? 'PARTNER'
          : 'STAFF';

    const override =
      mappedRole === 'PARTNER'
        ? this.partnerPermissionOverrides.get(dbUser.id) ||
          this.partnerPermissionOverrides.get(dbUser.email.toLowerCase())
        : undefined;

    const permissions: GranularPermissions =
      mappedRole === 'SUPER_ADMIN'
        ? FULL_SUPER_ADMIN_PERMISSIONS
        : mappedRole === 'PARTNER'
          ? override?.permissions || PARTNER_PERMISSIONS
          : DEFAULT_STAFF_PERMISSIONS;

    const nowIso = new Date().toISOString();
    const record: PlatformUser = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: mappedRole,
      designation: roleUpper.replace(/_/g, ' '),
      department: (dbUser.department as PlatformUser['department']) || 'Store & Operations',
      employeeId: dbUser.employeeId || undefined,
      avatarUrl: dbUser.avatarUrl || undefined,
      accountStatus: (dbUser.accountStatus as PlatformUser['accountStatus']) || 'ACTIVE',
      twoFactorEnabled: Boolean(dbUser.twoFactorEnabled),
      lastLogin: dbUser.lastLoginAt ? new Date(dbUser.lastLoginAt).toISOString() : 'Never',
      createdBy: 'DATABASE',
      createdAt: dbUser.createdAt ? new Date(dbUser.createdAt).toISOString() : nowIso,
      updatedAt: dbUser.updatedAt ? new Date(dbUser.updatedAt).toISOString() : nowIso,
      permissions: normalizeGranularPermissions(permissions, PARTNER_PERMISSIONS),
      activeSessions: [],
    };
    record.adminAccessTier = override?.adminAccessTier || computeAdminAccessTier(record);

    this.users.push(record);
    return this.enrichUserView(record);
  }
}

export const userStore = new UserStore();
