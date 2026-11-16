import { PlatformAuditEntry } from './rbacTypes';

class AuditStore {
  private logs: PlatformAuditEntry[] = [];

  constructor() {
    this.seedInitialLogs();
  }

  private seedInitialLogs() {
    this.logs = [
      {
        id: 'aud-001',
        timestamp: '2026-03-30T10:00:00.000Z',
        userId: 'usr-saif',
        userName: 'Mohammed Saif',
        userRole: 'SUPER_ADMIN',
        module: 'security',
        action: 'PLATFORM_INITIALIZED',
        recordAffected: 'TORIWEAR Internal Business Platform',
        newValue: 'Strict Server-Side RBAC, Four Equal Partners 25% Configured',
        ipAddress: '103.21.144.12',
        device: 'MacBook Pro (macOS 15) Chrome 128',
        severity: 'INFO',
      },
      {
        id: 'aud-002',
        timestamp: '2026-03-30T10:05:00.000Z',
        userId: 'usr-saif',
        userName: 'Mohammed Saif',
        userRole: 'SUPER_ADMIN',
        module: 'partners',
        action: 'PARTNERS_CONFIRMED',
        recordAffected: '4 Equal Partners: Saif, Simranjeet, Lokesh, Nagesh (25% Each)',
        newValue: '100% Total Ownership · 25% Profit/Loss Share Isolated',
        ipAddress: '103.21.144.12',
        device: 'MacBook Pro (macOS 15) Chrome 128',
        severity: 'INFO',
      },
      {
        id: 'aud-003',
        timestamp: '2026-03-30T11:20:00.000Z',
        userId: 'usr-saif',
        userName: 'Mohammed Saif',
        userRole: 'SUPER_ADMIN',
        module: 'security',
        action: 'POLICY_ENFORCED',
        recordAffected: 'Authentication Security Matrix',
        newValue: '2FA TOTP Optional (User ID + Password Auth Active), Session Timeout 60m, AES-256 E2EE Enabled',
        ipAddress: '103.21.144.12',
        device: 'MacBook Pro (macOS 15) Chrome 128',
        severity: 'INFO',
      },
    ];
  }

  public record(entry: Omit<PlatformAuditEntry, 'id' | 'timestamp'>): PlatformAuditEntry {
    const newEntry: PlatformAuditEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    // Append to immutable log
    this.logs.unshift(newEntry);
    console.log(`[AUDIT] [${newEntry.severity}] ${newEntry.action} by ${newEntry.userName} (${newEntry.userRole}) on ${newEntry.module}: ${newEntry.recordAffected}`);
    return newEntry;
  }

  public getLogs(filters?: {
    module?: string;
    role?: string;
    severity?: string;
    search?: string;
    limit?: number;
  }): PlatformAuditEntry[] {
    let result = [...this.logs];

    if (filters?.module && filters.module !== 'ALL') {
      result = result.filter(l => l.module === filters.module);
    }
    if (filters?.role && filters.role !== 'ALL') {
      result = result.filter(l => l.userRole === filters.role);
    }
    if (filters?.severity && filters.severity !== 'ALL') {
      result = result.filter(l => l.severity === filters.severity);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(l => 
        l.action.toLowerCase().includes(q) ||
        l.recordAffected.toLowerCase().includes(q) ||
        l.userName.toLowerCase().includes(q) ||
        (l.previousValue && l.previousValue.toLowerCase().includes(q)) ||
        (l.newValue && l.newValue.toLowerCase().includes(q))
      );
    }

    const limit = filters?.limit || 200;
    return result.slice(0, limit);
  }
}

export const auditStore = new AuditStore();
