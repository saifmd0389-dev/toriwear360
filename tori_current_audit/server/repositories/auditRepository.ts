import { getPrismaClient } from '../db/prisma';

export interface AuditLogRecord {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  module: string;
  action: string;
  recordAffected: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  timestamp: Date;
}

export class AuditRepository {
  private logs: AuditLogRecord[] = [];

  async record(entry: Omit<AuditLogRecord, 'id' | 'timestamp'>): Promise<AuditLogRecord> {
    const item: AuditLogRecord = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp: new Date(),
      ipAddress: entry.ipAddress || '127.0.0.1',
      ...entry,
    };

    this.logs.unshift(item);
    if (this.logs.length > 2000) {
      this.logs.pop();
    }

    const prisma = getPrismaClient();
    if (prisma?.auditLog) {
      try {
        // Resolve user FK safely if it exists in users table
        let validUserId: string | null = null;
        if (entry.userId && !['ANONYMOUS', 'SYSTEM', 'CUSTOMER', 'WEBHOOK'].includes(entry.userId)) {
          const u = await prisma.user.findUnique({ where: { id: entry.userId }, select: { id: true } }).catch(() => null);
          if (u) validUserId = u.id;
        }

        const created = await prisma.auditLog.create({
          data: {
            id: item.id,
            userId: validUserId,
            userName: entry.userName,
            userRole: entry.userRole,
            module: entry.module,
            action: entry.action,
            recordAffected: entry.recordAffected,
            oldValue: entry.oldValue || null,
            newValue: entry.newValue || null,
            ipAddress: item.ipAddress || null,
            severity: (['INFO', 'WARNING', 'CRITICAL'].includes(entry.severity) ? entry.severity : 'INFO') as any,
            timestamp: item.timestamp,
          },
        });
        item.id = created.id;
      } catch (err) {
        console.warn('[AuditRepo] Prisma record warning:', err);
      }
    }

    return item;
  }

  async getAll(filter?: { module?: string; severity?: string; limit?: number }): Promise<AuditLogRecord[]> {
    const prisma = getPrismaClient();
    if (prisma?.auditLog) {
      try {
        const where: any = {};
        if (filter?.module && filter.module !== 'ALL') {
          where.module = filter.module;
        }
        if (filter?.severity && filter.severity !== 'ALL') {
          where.severity = filter.severity;
        }
        const rows = await prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: filter?.limit || 100,
        });
        if (rows.length > 0) {
          return rows.map((r: any) => ({
            id: r.id,
            userId: r.userId || 'SYSTEM',
            userName: r.userName || 'System',
            userRole: r.userRole || 'SYSTEM',
            module: r.module,
            action: r.action,
            recordAffected: r.recordAffected || '',
            oldValue: r.oldValue || undefined,
            newValue: r.newValue || undefined,
            ipAddress: r.ipAddress || undefined,
            severity: r.severity as 'INFO' | 'WARNING' | 'CRITICAL',
            timestamp: new Date(r.timestamp),
          }));
        }
      } catch (err) {
        console.warn('[AuditRepo] Prisma getAll warning:', err);
      }
    }

    let result = this.logs;
    if (filter?.module && filter.module !== 'ALL') {
      result = result.filter((l) => l.module === filter.module);
    }
    if (filter?.severity && filter.severity !== 'ALL') {
      result = result.filter((l) => l.severity === filter.severity);
    }
    return result.slice(0, filter?.limit || 100);
  }
}

export const auditRepository = new AuditRepository();
