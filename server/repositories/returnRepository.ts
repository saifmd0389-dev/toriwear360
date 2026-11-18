import fs from 'fs';
import path from 'path';
import { getPrismaClient } from '../db/prisma';
import { resolveSecureStorePath } from '../utils/storageHelper';

const STORE_PATH = resolveSecureStorePath('returns-store.json');
export const RETURN_PROOFS_DIR = path.join(path.dirname(STORE_PATH), 'return-proofs');

export type ReturnRequestStatus =
  | 'RETURN_REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PICKUP_SCHEDULED'
  | 'IN_TRANSIT'
  | 'RETURNED_TO_WAREHOUSE'
  | 'REFUND_PROCESSING'
  | 'REFUNDED'
  | 'CLOSED';

export interface ReturnItemRecord {
  id: string;
  orderItemId: string;
  productId: string;
  variantId?: string;
  productName: string;
  sku?: string;
  size: string;
  color?: string;
  quantity: number;
  unitPrice: number;
  refundAmount: number;
  restocked: boolean;
  restockedAt?: string;
}

export interface ReturnHistoryEntry {
  id: string;
  fromStatus?: string;
  toStatus: string;
  note?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  createdAt: string;
}

export interface ReturnRequestRecord {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  requestType: 'RETURN' | 'EXCHANGE';
  reason: string;
  comments?: string;
  proofFiles: string[];
  status: ReturnRequestStatus;
  rejectionReason?: string;
  courierPartner?: string;
  awbNumber?: string;
  pickupScheduledAt?: string;
  receivedAt?: string;
  restockedAt?: string;
  refundAmount: number;
  refundMethod?: 'RAZORPAY' | 'BANK_UPI_MANUAL' | 'TORI_CREDIT' | 'EXCHANGE' | string;
  refundId?: string;
  refundStatus?: string;
  refundReference?: string;
  refundedAt?: string;
  adminNotes?: string;
  items: ReturnItemRecord[];
  history: ReturnHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export class ReturnRepository {
  private returns = new Map<string, ReturnRequestRecord>();
  private initialized = false;

  constructor() {
    this.ensureLoaded();
  }

  private ensureLoaded() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      if (!fs.existsSync(RETURN_PROOFS_DIR)) {
        fs.mkdirSync(RETURN_PROOFS_DIR, { recursive: true });
      }
      if (fs.existsSync(STORE_PATH)) {
        const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
        if (Array.isArray(parsed)) {
          for (const rec of parsed) {
            if (rec?.id) {
              this.returns.set(rec.id, rec);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[ReturnRepo] Failed to load returns store:', err);
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const list = Array.from(this.returns.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const tmp = `${STORE_PATH}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf-8');
      fs.renameSync(tmp, STORE_PATH);
    } catch (err) {
      console.error('[ReturnRepo] Failed to save returns store:', err);
    }
  }

  private async syncToPrisma(rec: ReturnRequestRecord) {
    const prisma = getPrismaClient();
    if (!prisma?.returnRequest) return;
    try {
      const orderExists = await prisma.order.findUnique({ where: { id: rec.orderId } });
      if (!orderExists) return;

      await prisma.returnRequest.upsert({
        where: { id: rec.id },
        create: {
          id: rec.id,
          returnNumber: rec.returnNumber,
          orderId: rec.orderId,
          orderNumber: rec.orderNumber,
          customerId: rec.customerId || null,
          customerName: rec.customerName,
          customerEmail: rec.customerEmail,
          customerPhone: rec.customerPhone,
          requestType: rec.requestType,
          reason: rec.reason,
          comments: rec.comments || null,
          proofFilesJson: JSON.stringify(rec.proofFiles || []),
          status: rec.status as any,
          rejectionReason: rec.rejectionReason || null,
          courierPartner: rec.courierPartner || null,
          awbNumber: rec.awbNumber || null,
          pickupScheduledAt: rec.pickupScheduledAt ? new Date(rec.pickupScheduledAt) : null,
          receivedAt: rec.receivedAt ? new Date(rec.receivedAt) : null,
          restockedAt: rec.restockedAt ? new Date(rec.restockedAt) : null,
          refundAmount: Number(rec.refundAmount || 0),
          refundMethod: rec.refundMethod || null,
          refundId: rec.refundId || null,
          refundStatus: rec.refundStatus || null,
          refundReference: rec.refundReference || null,
          refundedAt: rec.refundedAt ? new Date(rec.refundedAt) : null,
          adminNotes: rec.adminNotes || null,
          items: {
            create: rec.items.map((it) => ({
              id: it.id,
              orderItemId: it.orderItemId,
              productId: it.productId,
              variantId: it.variantId || null,
              productName: it.productName,
              sku: it.sku || null,
              size: it.size,
              color: it.color || null,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              refundAmount: it.refundAmount,
              restocked: Boolean(it.restocked),
              restockedAt: it.restockedAt ? new Date(it.restockedAt) : null,
            })),
          },
        },
        update: {
          status: rec.status as any,
          rejectionReason: rec.rejectionReason || null,
          courierPartner: rec.courierPartner || null,
          awbNumber: rec.awbNumber || null,
          pickupScheduledAt: rec.pickupScheduledAt ? new Date(rec.pickupScheduledAt) : null,
          receivedAt: rec.receivedAt ? new Date(rec.receivedAt) : null,
          restockedAt: rec.restockedAt ? new Date(rec.restockedAt) : null,
          refundAmount: Number(rec.refundAmount || 0),
          refundMethod: rec.refundMethod || null,
          refundId: rec.refundId || null,
          refundStatus: rec.refundStatus || null,
          refundReference: rec.refundReference || null,
          refundedAt: rec.refundedAt ? new Date(rec.refundedAt) : null,
          adminNotes: rec.adminNotes || null,
        },
      });
    } catch (err) {
      console.warn('[ReturnRepo] Prisma sync note:', (err as any)?.message || err);
    }
  }

  async findById(idOrNumber: string): Promise<ReturnRequestRecord | null> {
    this.ensureLoaded();
    if (this.returns.has(idOrNumber)) return this.returns.get(idOrNumber)!;
    const clean = idOrNumber.trim().toUpperCase();
    for (const r of this.returns.values()) {
      if (r.returnNumber.toUpperCase() === clean) return r;
    }
    return null;
  }

  async listByOrderId(orderId: string): Promise<ReturnRequestRecord[]> {
    this.ensureLoaded();
    return Array.from(this.returns.values())
      .filter((r) => r.orderId === orderId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async listByCustomer(filter: { customerId?: string; email?: string; phone?: string }): Promise<ReturnRequestRecord[]> {
    this.ensureLoaded();
    const cleanEmail = filter.email?.trim().toLowerCase();
    const cleanPhone = filter.phone?.replace(/\D/g, '');
    return Array.from(this.returns.values())
      .filter((r) => {
        if (filter.customerId && r.customerId && r.customerId === filter.customerId) return true;
        if (cleanEmail && r.customerEmail.toLowerCase() === cleanEmail) return true;
        if (cleanPhone && cleanPhone.length >= 6 && r.customerPhone.replace(/\D/g, '').endsWith(cleanPhone.slice(-10))) return true;
        return false;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async findByProofFilename(filename: string): Promise<ReturnRequestRecord | null> {
    this.ensureLoaded();
    for (const r of this.returns.values()) {
      if (Array.isArray(r.proofFiles) && r.proofFiles.includes(filename)) {
        return r;
      }
    }
    return null;
  }

  async listAll(filter?: { status?: string; search?: string }): Promise<ReturnRequestRecord[]> {
    this.ensureLoaded();
    let list = Array.from(this.returns.values());
    if (filter?.status && filter.status !== 'ALL') {
      const st = filter.status.toUpperCase();
      list = list.filter((r) => r.status === st);
    }
    if (filter?.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.returnNumber.toLowerCase().includes(q) ||
          r.orderNumber.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.customerEmail.toLowerCase().includes(q) ||
          r.customerPhone.includes(q) ||
          (r.awbNumber && r.awbNumber.toLowerCase().includes(q)) ||
          (r.refundId && r.refundId.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async save(rec: ReturnRequestRecord): Promise<ReturnRequestRecord> {
    this.ensureLoaded();
    rec.updatedAt = new Date().toISOString();
    this.returns.set(rec.id, rec);
    this.saveToDisk();
    await this.syncToPrisma(rec);
    return rec;
  }
}

export const returnRepository = new ReturnRepository();
