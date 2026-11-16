export type PlatformRole = 
  | 'SUPER_ADMIN'
  | 'PARTNER'
  | 'STAFF';

export type StaffDepartment = 
  | 'Executive Leadership'
  | 'Design & Creative'
  | 'Production & Quality'
  | 'Store & Operations'
  | 'Inventory & Warehouse'
  | 'Marketing & Growth'
  | 'Finance & Accounts'
  | 'Customer Support'
  | 'Logistics & Dispatch';

export type ModuleName = 
  | 'dashboard'
  | 'products'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'customerSupport'
  | 'marketing'
  | 'catalog'
  | 'shipping'
  | 'finance'
  | 'reports'
  | 'communication'
  | 'meetings'
  | 'aiDesignLab'
  | 'website'
  | 'staff'
  | 'security'
  | 'settings'
  | 'superAdmin';

export type PermissionAction = 'view' | 'create' | 'edit' | 'approve' | 'export' | 'delete';

export type GranularPermissions = Record<ModuleName, PermissionAction[]>;

export type AdminAccessTier = 'STANDARD_PARTNER' | 'ELEVATED_PARTNER' | 'FULL_ADMIN' | 'SUPER_ADMIN';

export interface ActiveSession {
  sessionId: string;
  ipAddress: string;
  device: string;
  browser: string;
  location: string;
  loginTime: string;
  lastActivity: string;
  isCurrent?: boolean;
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  employeeId?: string;
  role: PlatformRole;
  adminAccessTier?: AdminAccessTier;
  designation?: string;
  department?: StaffDepartment;
  accountStatus: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DEACTIVATED' | 'INACTIVE';
  ownershipPercentage?: number;
  profitSharePercentage?: number;
  avatarUrl?: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  lastLogin: string;
  lastPasswordChange?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  permissions: GranularPermissions;
  activeSessions: ActiveSession[];
}

export interface ApprovalRequest {
  id: string;
  type: 
    | 'EXPENSE'
    | 'REFUND'
    | 'PRICE_CHANGE'
    | 'PRODUCT_CREATION'
    | 'INVENTORY_ADJUSTMENT'
    | 'FINANCIAL_TRANSACTION'
    | 'MARKETING_EXPENDITURE'
    | 'PARTNER_TRANSACTION';
  title: string;
  description: string;
  amount?: number;
  dataPayload?: any;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'VOIDED';
  submittedBy: {
    userId: string;
    name: string;
    role: PlatformRole;
  };
  submittedAt: string;
  reviewedBy?: {
    userId: string;
    name: string;
    role: PlatformRole;
  };
  reviewedAt?: string;
  reviewComment?: string;
  voidedBy?: {
    userId: string;
    name: string;
  };
  voidedAt?: string;
  voidReason?: string;
}

export interface SecurityPolicyConfig {
  requireTwoFactorForStaff: boolean;
  requireTwoFactorForPartners: boolean;
  minPasswordLength: number;
  requireSpecialChar: boolean;
  sessionTimeoutMinutes: number;
  maxFailedLoginsBeforeLock: number;
  lockoutDurationMinutes: number;
  allowScreenSharingInMeetings: boolean;
  enforceE2EEncryptionInPrivateChat: boolean;
  allowCrossDepartmentChat: boolean;
}

export interface PlatformAuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: PlatformRole;
  module: ModuleName | 'security' | 'auth' | 'approvals' | 'partners';
  action: string;
  recordAffected: string;
  previousValue?: string;
  newValue?: string;
  ipAddress: string;
  device?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface ChatAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: 'image' | 'document' | 'file';
}

export interface ChatMessageReaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface ChatMessage {
  id: string;
  channelId?: string;
  directRecipientId?: string;
  senderId: string;
  senderName: string;
  senderRole: PlatformRole;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  isEncrypted?: boolean;
  encryptedPayload?: string;
  attachments?: ChatAttachment[];
  reactions?: ChatMessageReaction[];
  readBy?: string[];
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  type: 'PUBLIC' | 'PARTNERS_ONLY' | 'DEPARTMENT' | 'ANNOUNCEMENT';
  allowedRoles?: PlatformRole[];
  allowedDepartments?: StaffDepartment[];
  memberIds?: string[];
  isE2EE?: boolean;
  createdAt: string;
  lastMessage?: {
    senderName: string;
    snippet: string;
    timestamp: string;
  };
}

export interface VideoMeeting {
  id: string;
  title: string;
  agenda: string;
  description: string;
  scheduledStartTime: string;
  scheduledEndTime?: string;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  createdBy: {
    userId: string;
    name: string;
    role: PlatformRole;
  };
  participantIds: string[];
  activeCallParticipants?: {
    userId: string;
    name: string;
    role: PlatformRole;
    isMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing: boolean;
    joinedAt: string;
  }[];
  meetingRoomCode: string;
  createdAt: string;
}
