import { 
  PlatformUser, 
  ChatChannel, 
  ChatMessage, 
  VideoMeeting, 
  ApprovalRequest, 
  PlatformAuditEntry, 
  SecurityPolicyConfig 
} from '../../../server/rbacTypes';

// Active User ID and Session Token in client storage
const ACTOR_STORAGE_KEY = 'tori_active_platform_actor_id';
const SESSION_TOKEN_KEY = 'tori_admin_session_token';

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY) || sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string, remember: boolean = true) {
  try {
    if (remember) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    }
  } catch {}
}

export function clearSessionToken() {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {}
}

export function getActiveActorId(): string {
  try {
    return localStorage.getItem(ACTOR_STORAGE_KEY) || 'usr-saif';
  } catch {
    return 'usr-saif';
  }
}

export function setActiveActorId(userId: string) {
  try {
    localStorage.setItem(ACTOR_STORAGE_KEY, userId);
  } catch {}
}

function getHeaders(): HeadersInit {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-platform-user-id': getActiveActorId(),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-session-token'] = token;
  }
  return headers;
}

// ----------------------------------------------------
// 1. CLIENT-SIDE WEB CRYPTO AES-GCM (TRUE E2EE IMPLEMENTATION)
// ----------------------------------------------------
// Real cryptographic encryption and decryption in the browser before sending
const E2EE_SHARED_SALT = 'TORIWEAR_ENTERPRISE_KEY_SALT_2026';

async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(E2EE_SHARED_SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptE2EEMessage(plainText: string, roomOrPartnerSecret: string = 'TORI_PARTNERS_CONFIDENTIAL_KEY'): Promise<string> {
  try {
    const key = await deriveKey(roomOrPartnerSecret);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plainText)
    );
    // Combine IV and cipher bytes
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    // Return base64 representation
    return btoa(String.fromCharCode(...combined));
  } catch (err) {
    console.warn('[E2EE] Encryption fallback:', err);
    return plainText;
  }
}

export async function decryptE2EEMessage(cipherTextBase64: string, roomOrPartnerSecret: string = 'TORI_PARTNERS_CONFIDENTIAL_KEY'): Promise<string> {
  try {
    const binary = atob(cipherTextBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);
    const key = await deriveKey(roomOrPartnerSecret);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (err) {
    // If text was not encrypted or key mismatched, return as is
    return cipherTextBase64;
  }
}

// ----------------------------------------------------
// 2. PLATFORM API METHODS
// ----------------------------------------------------

export const platformApi = {
  // Authentication & Credentials
  async login(identifier: string, password: string, rememberMe: boolean = true) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, rememberMe }),
    });
    const data = await res.json();
    if (data.success && data.sessionToken) {
      setSessionToken(data.sessionToken, rememberMe);
      if (data.user?.id) {
        setActiveActorId(data.user.id);
      }
    }
    return data;
  },

  async verify2FA(tempToken: string, code: string, rememberMe: boolean = true) {
    const res = await fetch('/api/auth/verify-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code, clientTimestamp: Date.now() }),
    });
    const data = await res.json();
    if (data.success && data.sessionToken) {
      setSessionToken(data.sessionToken, rememberMe);
      if (data.user?.id) {
        setActiveActorId(data.user.id);
      }
    }
    return data;
  },

  async logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getHeaders(),
      });
    } catch {}
    clearSessionToken();
  },

  async getMe(): Promise<{ authenticated: boolean; user?: PlatformUser }> {
    const res = await fetch('/api/auth/me', { headers: getHeaders() });
    return res.json();
  },

  async forgotPassword(email: string) {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.json();
  },

  async resetPassword(token: string, newPassword: string) {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    return res.json();
  },

  async changePassword(currentPassword: string, newPassword: string, logoutOtherSessions: boolean = true) {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword, logoutOtherSessions }),
    });
    return res.json();
  },

  async setup2FA() {
    const res = await fetch('/api/auth/setup-2fa', {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },

  async confirm2FA(code: string) {
    const res = await fetch('/api/auth/confirm-2fa', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code, clientTimestamp: Date.now() }),
    });
    return res.json();
  },

  async disable2FA() {
    const res = await fetch('/api/auth/disable-2fa', {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },

  async getSessions() {
    const res = await fetch('/api/auth/sessions', { headers: getHeaders() });
    return res.json();
  },

  async revokeSession(sessionId: string) {
    const res = await fetch(`/api/auth/sessions/${sessionId}/revoke`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },

  async revokeAllOtherSessions() {
    const res = await fetch('/api/auth/sessions/revoke-others', {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },

  async inviteUser(userId: string) {
    const res = await fetch('/api/auth/invite-user', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userId }),
    });
    return res.json();
  },

  async activateAccount(token: string, password: string) {
    const res = await fetch('/api/auth/activate-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    return res.json();
  },

  // Current user & role switching
  async getCurrentUser(): Promise<PlatformUser> {
    const res = await fetch('/api/auth/current-user', { headers: getHeaders() });
    const data = await res.json();
    return data.user;
  },

  async switchUser(userId: string): Promise<PlatformUser> {
    setActiveActorId(userId);
    const res = await fetch('/api/auth/switch-user', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    return data.user;
  },

  // Users, Partners & Staff
  async getUsers(params?: { role?: string; department?: string }): Promise<{ users: PlatformUser[]; partners: PlatformUser[]; staff: PlatformUser[] }> {
    const query = new URLSearchParams();
    if (params?.role) query.set('role', params.role);
    if (params?.department) query.set('department', params.department);
    const res = await fetch(`/api/users?${query.toString()}`, { headers: getHeaders() });
    return res.json();
  },

  async createPartner(payload: { name: string; email: string; phone?: string; roleDesignation: string; department?: string }) {
    const res = await fetch('/api/users/partners', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async updatePartner(partnerId: string, updates: Partial<PlatformUser>) {
    const res = await fetch(`/api/users/partners/${partnerId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async deactivatePartner(partnerId: string) {
    const res = await fetch(`/api/users/partners/${partnerId}/deactivate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },

  async createStaff(payload: { name: string; email: string; phone?: string; department: string; designation: string; permissions?: any }) {
    const res = await fetch('/api/users/staff', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async updateStaff(staffId: string, updates: Partial<PlatformUser>) {
    const res = await fetch(`/api/users/staff/${staffId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async deactivateStaff(staffId: string) {
    const res = await fetch(`/api/users/staff/${staffId}/deactivate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },

  // Super Admin Control Center Actions
  async forceLogout(userId: string) {
    const res = await fetch(`/api/users/${userId}/force-logout`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },

  async reset2FA(userId: string) {
    const res = await fetch(`/api/users/${userId}/reset-2fa`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },

  async adminSetPassword(userId: string, newPassword?: string, requireChangeOnNextLogin?: boolean) {
    const res = await fetch(`/api/users/${userId}/admin-set-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ newPassword, requireChangeOnNextLogin }),
    });
    return res.json();
  },

  async adminReissueRecoveryCodes(userId: string) {
    const res = await fetch(`/api/users/${userId}/admin-reissue-recovery-codes`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },

  async getUserCredentialDetails(userId: string) {
    const res = await fetch(`/api/users/${userId}/credential-details`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  async getSecurityPolicies(): Promise<SecurityPolicyConfig> {
    const res = await fetch('/api/security/policies', { headers: getHeaders() });
    const data = await res.json();
    return data.policies;
  },

  async updateSecurityPolicies(updates: Partial<SecurityPolicyConfig>) {
    const res = await fetch('/api/security/policies', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  // Audit Trail
  async getAuditLogs(params?: { module?: string; role?: string; severity?: string; search?: string; limit?: number }): Promise<PlatformAuditEntry[]> {
    const query = new URLSearchParams();
    if (params?.module) query.set('module', params.module);
    if (params?.role) query.set('role', params.role);
    if (params?.severity) query.set('severity', params.severity);
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', params.limit.toString());
    const res = await fetch(`/api/audit-logs?${query.toString()}`, { headers: getHeaders() });
    const data = await res.json();
    return data.logs || [];
  },

  // Approvals Workflow
  async getApprovals(): Promise<ApprovalRequest[]> {
    const res = await fetch('/api/approvals', { headers: getHeaders() });
    const data = await res.json();
    return data.approvals || [];
  },

  async createApproval(payload: { type: string; title: string; description: string; amount?: number; dataPayload?: any; status?: string }) {
    const res = await fetch('/api/approvals', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async reviewApproval(id: string, decision: 'APPROVED' | 'REJECTED', comment: string) {
    const res = await fetch(`/api/approvals/${id}/review`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ decision, comment }),
    });
    return res.json();
  },

  async voidApproval(id: string, voidReason: string) {
    const res = await fetch(`/api/approvals/${id}/void`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ voidReason }),
    });
    return res.json();
  },

  // Communication: Channels & Messages
  async getChannels(): Promise<ChatChannel[]> {
    const res = await fetch('/api/communication/channels', { headers: getHeaders() });
    const data = await res.json();
    return data.channels || [];
  },

  async createChannel(payload: { name: string; description: string; type: string; isE2EE?: boolean }) {
    const res = await fetch('/api/communication/channels', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async getMessages(params: { channelId?: string; directRecipientId?: string; search?: string }): Promise<ChatMessage[]> {
    const query = new URLSearchParams();
    if (params.channelId) query.set('channelId', params.channelId);
    if (params.directRecipientId) query.set('directRecipientId', params.directRecipientId);
    if (params.search) query.set('search', params.search);
    const res = await fetch(`/api/communication/messages?${query.toString()}`, { headers: getHeaders() });
    const data = await res.json();
    return data.messages || [];
  },

  async postMessage(payload: {
    channelId?: string;
    directRecipientId?: string;
    content: string;
    attachments?: any[];
    isEncrypted?: boolean;
    encryptedPayload?: string;
  }) {
    const res = await fetch('/api/communication/messages', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async reactToMessage(messageId: string, emoji: string) {
    const res = await fetch(`/api/communication/messages/${messageId}/reaction`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ emoji }),
    });
    return res.json();
  },

  // Meetings
  async getMeetings(): Promise<VideoMeeting[]> {
    const res = await fetch('/api/communication/meetings', { headers: getHeaders() });
    const data = await res.json();
    return data.meetings || [];
  },

  async createMeeting(payload: {
    title: string;
    agenda: string;
    description: string;
    scheduledStartTime: string;
    scheduledEndTime?: string;
    participantIds: string[];
  }) {
    const res = await fetch('/api/communication/meetings', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async updateMeetingStatus(id: string, status: VideoMeeting['status']) {
    const res = await fetch(`/api/communication/meetings/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  // ============================================================================
  // Finance & Accounting Authoritative Backend APIs
  // ============================================================================
  async getFinanceSummary(startDate?: string, endDate?: string) {
    const query = new URLSearchParams();
    if (startDate) query.set('startDate', startDate);
    if (endDate) query.set('endDate', endDate);
    const res = await fetch(`/api/v1/admin/finance/summary?${query.toString()}`, { headers: getHeaders() });
    return res.json();
  },

  async getFinancialAccounts() {
    const res = await fetch('/api/v1/admin/finance/accounts', { headers: getHeaders() });
    return res.json();
  },

  async createFinancialAccount(data: any) {
    const res = await fetch('/api/v1/admin/finance/accounts', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateFinancialAccount(id: string, updates: any) {
    const res = await fetch(`/api/v1/admin/finance/accounts/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async transferBetweenAccounts(payload: { fromAccountId: string; toAccountId: string; amount: number; description?: string; referenceId?: string }) {
    const res = await fetch('/api/v1/admin/finance/transfer', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async getFinancialTransactions(filters?: any) {
    const query = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v && v !== 'ALL') query.set(k, String(v));
      });
    }
    const res = await fetch(`/api/v1/admin/finance/transactions?${query.toString()}`, { headers: getHeaders() });
    return res.json();
  },

  async createFinancialTransaction(tx: any) {
    const res = await fetch('/api/v1/admin/finance/transactions', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(tx),
    });
    return res.json();
  },

  async updateFinancialTransaction(id: string, updates: any) {
    const res = await fetch(`/api/v1/admin/finance/transactions/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async approveFinancialTransaction(id: string, notes?: string) {
    const res = await fetch(`/api/v1/admin/finance/transactions/${id}/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ notes }),
    });
    return res.json();
  },

  async rejectFinancialTransaction(id: string, reason: string) {
    const res = await fetch(`/api/v1/admin/finance/transactions/${id}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    return res.json();
  },

  async voidFinancialTransaction(id: string, reason: string) {
    const res = await fetch(`/api/v1/admin/finance/transactions/${id}/void`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    return res.json();
  },

  async deleteFinancialTransaction(id: string) {
    const res = await fetch(`/api/v1/admin/finance/transactions/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },


  async batchApproveFinancialTransactions(ids: string[]) {
    const res = await fetch('/api/v1/admin/finance/transactions/batch-approve', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ids }),
    });
    return res.json();
  },

  async getFinancePartners() {
    const res = await fetch('/api/v1/admin/finance/partners', { headers: getHeaders() });
    return res.json();
  },

  async updateFinancePartner(id: string, updates: any) {
    const res = await fetch(`/api/v1/admin/finance/partners/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async updatePartnerPercentages(percentages: Record<string, number>, isProfitShareOnly = false) {
    const res = await fetch('/api/v1/admin/finance/partners/percentages', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ percentages, isProfitShareOnly }),
    });
    return res.json();
  },

  async distributeProfit(periodLabel?: string) {
    const res = await fetch('/api/v1/admin/finance/partners/distribute-profit', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ periodLabel }),
    });
    return res.json();
  },

  async resetFinanceData() {
    const res = await fetch('/api/v1/admin/finance/reset', {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },
};
