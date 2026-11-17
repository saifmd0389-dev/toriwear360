import fs from 'fs';
import path from 'path';
import { getPrismaClient } from '../db/prisma';
import { resolveSecureStorePath } from '../utils/storageHelper';

const STORE_PATH = resolveSecureStorePath('payments-store.json', 'public/generated-assets/payments-store.json');

export interface PaymentTransactionRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  gateway: 'RAZORPAY' | 'CASHFREE' | 'STRIPE' | 'COD';
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  amount: number;
  amountPaise?: number;
  currency: string;
  status: 'INITIATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
  method: 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'NET_BANKING' | 'WALLET' | 'COD';
  upiVpa?: string;
  bankRefNumber?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  failureReason?: string;
  refundId?: string;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  gatewayFee?: number;
  gatewayTax?: number;
  isSimulated: boolean;
  signatureVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentWebhookRecord {
  id: string;
  gateway: string;
  eventId: string;
  eventType: string;
  payload: any;
  processed: boolean;
  receivedAt: Date;
}

export class PaymentRepository {
  private transactions = new Map<string, PaymentTransactionRecord>();
  private webhooks: PaymentWebhookRecord[] = [];
  private initialized = false;

  constructor() {
    this.ensureLoaded();
  }

  private withPaise(tx: PaymentTransactionRecord): PaymentTransactionRecord & { amountPaise: number } {
    return {
      ...tx,
      amountPaise: tx.amountPaise ?? Math.round((Number(tx.amount) || 0) * 100),
    };
  }

  private ensureLoaded() {
    if (this.initialized) return;
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed) {
          if (Array.isArray(parsed.transactions)) {
            for (const tx of parsed.transactions) {
              this.transactions.set(tx.id, {
                ...tx,
                amountPaise: tx.amountPaise ?? Math.round((Number(tx.amount) || 0) * 100),
                createdAt: new Date(tx.createdAt || Date.now()),
                updatedAt: new Date(tx.updatedAt || Date.now()),
              });
            }
          }
          if (Array.isArray(parsed.webhooks)) {
            this.webhooks = parsed.webhooks.map((w: any) => ({
              ...w,
              receivedAt: new Date(w.receivedAt || Date.now()),
            }));
          }
        }
      }
      this.saveToDisk();
    } catch (err) {
      console.warn('[PaymentRepo] Could not load payments store file:', err);
    }
    this.initialized = true;
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        transactions: Array.from(this.transactions.values()),
        webhooks: this.webhooks.slice(-500),
        lastUpdated: new Date().toISOString(),
      };
      const tempPath = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, STORE_PATH);
    } catch (err) {
      console.error('[PaymentRepo] Failed to persist payments to disk:', err);
    }
  }

  private async mirrorToPrisma(record: PaymentTransactionRecord) {
    const prisma = getPrismaClient();
    if (!prisma?.payment) return;
    try {
      const orderExists = await prisma.order.findUnique({ where: { id: record.orderId }, select: { id: true } });
      if (!orderExists) return;

      const mappedStatus =
        record.status === 'CAPTURED' || record.status === 'AUTHORIZED'
          ? 'PAID'
          : record.status === 'FAILED'
          ? 'FAILED'
          : record.status === 'REFUNDED'
          ? 'REFUNDED'
          : 'PENDING';

      await prisma.payment.upsert({
        where: { paymentNumber: record.id },
        create: {
          id: record.id,
          orderId: record.orderId,
          paymentNumber: record.id,
          provider: record.gateway,
          transactionId: record.gatewayPaymentId || record.gatewayOrderId || null,
          amount: record.amount,
          currency: record.currency || 'INR',
          status: mappedStatus as any,
          paymentMethodType: record.method,
          failureReason: record.failureReason || null,
          capturedAt: mappedStatus === 'PAID' ? record.updatedAt : null,
          refundedAt: mappedStatus === 'REFUNDED' ? record.refundedAt || record.updatedAt : null,
        },
        update: {
          provider: record.gateway,
          transactionId: record.gatewayPaymentId || record.gatewayOrderId || null,
          status: mappedStatus as any,
          paymentMethodType: record.method,
          failureReason: record.failureReason || null,
          capturedAt: mappedStatus === 'PAID' ? record.updatedAt : undefined,
          refundedAt: mappedStatus === 'REFUNDED' ? record.refundedAt || record.updatedAt : undefined,
        },
      });
    } catch (err) {
      console.warn('[PaymentRepo] Prisma mirror warning:', err);
    }
  }

  async createTransaction(record: PaymentTransactionRecord): Promise<PaymentTransactionRecord> {
    this.ensureLoaded();
    const normalized = this.withPaise(record);
    this.transactions.set(normalized.id, normalized);
    this.saveToDisk();
    await this.mirrorToPrisma(normalized);
    return normalized;
  }

  async findById(id: string): Promise<PaymentTransactionRecord | null> {
    this.ensureLoaded();
    const tx = this.transactions.get(id);
    return tx ? this.withPaise(tx) : null;
  }

  async findByOrderId(orderId: string): Promise<PaymentTransactionRecord | null> {
    this.ensureLoaded();
    for (const tx of this.transactions.values()) {
      if (tx.orderId === orderId) return this.withPaise(tx);
    }
    return null;
  }

  async findByGatewayOrderId(gatewayOrderId: string): Promise<PaymentTransactionRecord | null> {
    this.ensureLoaded();
    for (const tx of this.transactions.values()) {
      if (tx.gatewayOrderId === gatewayOrderId) return this.withPaise(tx);
    }
    return null;
  }

  async findByGatewayPaymentId(gatewayPaymentId: string): Promise<PaymentTransactionRecord | null> {
    this.ensureLoaded();
    if (!gatewayPaymentId) return null;
    for (const tx of this.transactions.values()) {
      if (tx.gatewayPaymentId === gatewayPaymentId) return this.withPaise(tx);
    }
    return null;
  }

  async updateTransaction(id: string, updates: Partial<PaymentTransactionRecord>): Promise<PaymentTransactionRecord | null> {
    this.ensureLoaded();
    const existing = this.transactions.get(id);
    if (!existing) return null;
    const merged = this.withPaise({ ...existing, ...updates, updatedAt: new Date() });
    this.transactions.set(id, merged);
    this.saveToDisk();
    await this.mirrorToPrisma(merged);
    return merged;
  }

  async findWebhookByEventId(eventId: string): Promise<PaymentWebhookRecord | null> {
    this.ensureLoaded();
    const cleanId = eventId.trim();
    const prisma = getPrismaClient();
    if (prisma?.paymentWebhook) {
      try {
        const dbHit = await prisma.paymentWebhook.findUnique({ where: { eventId: cleanId } });
        if (dbHit) {
          return {
            id: dbHit.id,
            gateway: dbHit.provider,
            eventId: dbHit.eventId || cleanId,
            eventType: dbHit.eventType,
            payload: JSON.parse(dbHit.payload || '{}'),
            processed: Boolean(dbHit.processed),
            receivedAt: new Date(dbHit.createdAt),
          };
        }
      } catch {}
    }
    return this.webhooks.find((w) => w.eventId === cleanId) || null;
  }

  async logWebhook(webhook: PaymentWebhookRecord): Promise<{ alreadyProcessed: boolean }> {
    this.ensureLoaded();
    const existing = await this.findWebhookByEventId(webhook.eventId);
    if (existing) {
      return { alreadyProcessed: true };
    }
    this.webhooks.push(webhook);
    this.saveToDisk();

    const prisma = getPrismaClient();
    if (prisma?.paymentWebhook) {
      try {
        await prisma.paymentWebhook.create({
          data: {
            id: webhook.id,
            provider: webhook.gateway,
            eventType: webhook.eventType,
            eventId: webhook.eventId,
            payload: typeof webhook.payload === 'string' ? webhook.payload : JSON.stringify(webhook.payload || {}),
            processed: Boolean(webhook.processed),
            processedAt: webhook.processed ? new Date() : null,
          },
        });
      } catch {}
    }
    return { alreadyProcessed: false };
  }

  async getAllTransactions(): Promise<PaymentTransactionRecord[]> {
    this.ensureLoaded();
    return Array.from(this.transactions.values())
      .map((t) => this.withPaise(t))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async queryTransactions(params: {
    search?: string;
    gateway?: string;
    status?: string;
    method?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: PaymentTransactionRecord[]; total: number }> {
    this.ensureLoaded();
    let list = Array.from(this.transactions.values())
      .map((t) => this.withPaise(t))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (params.search) {
      const q = params.search.toLowerCase().trim();
      list = list.filter(
        (tx) =>
          tx.id.toLowerCase().includes(q) ||
          tx.orderNumber.toLowerCase().includes(q) ||
          (tx.gatewayOrderId && tx.gatewayOrderId.toLowerCase().includes(q)) ||
          (tx.gatewayPaymentId && tx.gatewayPaymentId.toLowerCase().includes(q)) ||
          (tx.customerName && tx.customerName.toLowerCase().includes(q)) ||
          (tx.customerEmail && tx.customerEmail.toLowerCase().includes(q))
      );
    }

    if (params.gateway && params.gateway !== 'ALL') {
      list = list.filter((tx) => tx.gateway === params.gateway);
    }

    if (params.status && params.status !== 'ALL') {
      list = list.filter((tx) => tx.status === params.status);
    }

    if (params.method && params.method !== 'ALL') {
      list = list.filter((tx) => tx.method === params.method);
    }

    const total = list.length;
    const offset = params.offset || 0;
    const limit = params.limit || 100;
    const paginated = list.slice(offset, offset + limit);

    return { transactions: paginated, total };
  }

  async getStats(): Promise<{
    grossVolume: number;
    netSettlement: number;
    totalFees: number;
    refundedVolume: number;
    successfulCount: number;
    grossVolumePaise: number;
    netSettlementPaise: number;
    totalFeesPaise: number;
    refundedVolumePaise: number;
    capturedCount: number;
    initiatedCount: number;
    failedCount: number;
    refundedCount: number;
    totalCount: number;
  }> {
    this.ensureLoaded();
    const all = Array.from(this.transactions.values());
    const successful = all.filter((tx) => tx.status === 'CAPTURED' || tx.status === 'AUTHORIZED');
    const initiated = all.filter((tx) => tx.status === 'INITIATED');
    const refunded = all.filter((tx) => tx.status === 'REFUNDED');
    const failed = all.filter((tx) => tx.status === 'FAILED');

    const grossVolume = successful.reduce((sum, tx) => sum + tx.amount, 0);
    const refundedVolume = refunded.reduce((sum, tx) => sum + (tx.refundAmount || tx.amount), 0);
    const totalFees = all.reduce((sum, tx) => sum + (tx.gatewayFee || 0), 0);
    const netSettlement = Math.max(0, grossVolume - totalFees - refundedVolume);

    return {
      grossVolume,
      netSettlement,
      totalFees,
      refundedVolume,
      successfulCount: successful.length,
      grossVolumePaise: Math.round(grossVolume * 100),
      netSettlementPaise: Math.round(netSettlement * 100),
      totalFeesPaise: Math.round(totalFees * 100),
      refundedVolumePaise: Math.round(refundedVolume * 100),
      capturedCount: successful.length,
      initiatedCount: initiated.length,
      failedCount: failed.length,
      refundedCount: refunded.length,
      totalCount: all.length,
    };
  }

  async getAllWebhooks(): Promise<PaymentWebhookRecord[]> {
    this.ensureLoaded();
    return [...this.webhooks];
  }
}

export const paymentRepository = new PaymentRepository();
