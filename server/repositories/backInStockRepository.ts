import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getPrismaClient } from '../db/prisma';
import { resolveSecureStorePath } from '../utils/storageHelper';

export type BackInStockSubscriptionStatus = 'ACTIVE' | 'NOTIFIED' | 'PARTIAL_FAILURE' | 'CANCELLED';
export type WhatsAppChannelStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'SKIPPED';
export type WebsiteChannelStatus = 'PENDING' | 'DELIVERED' | 'READ' | 'FAILED' | 'SKIPPED';
export type BrowserPushChannelStatus = 'PENDING' | 'DELIVERED' | 'FAILED' | 'SKIPPED' | 'UNSUPPORTED';
export type EmailChannelStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'SKIPPED';

export interface BackInStockSubscriptionRecord {
  id: string;
  productId: string;
  productName: string;
  productSlug: string | null;
  productImage: string | null;
  variantId: string;
  sku: string | null;
  size: string;
  color: string;
  customerId: string | null;
  customerName: string | null;
  phoneE164: string | null;
  email: string | null;
  whatsappConsent: boolean;
  whatsappConsentAt: Date | null;
  websiteEnabled: boolean;
  browserPushEnabled: boolean;
  emailBackupEnabled: boolean;
  status: BackInStockSubscriptionStatus;
  whatsappStatus: WhatsAppChannelStatus;
  websiteStatus: WebsiteChannelStatus;
  browserPushStatus: BrowserPushChannelStatus;
  emailStatus: EmailChannelStatus;
  lastRestockBatchId: string | null;
  lastFailureSummary: string | null;
  notifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerNotificationRecord {
  id: string;
  customerId: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  subscriptionId: string | null;
  type: string;
  title: string;
  message: string;
  productId: string | null;
  productSlug: string | null;
  productName: string | null;
  productImage: string | null;
  variantId: string | null;
  size: string | null;
  color: string | null;
  actionUrl: string | null;
  isRead: boolean;
  readAt: Date | null;
  browserPushStatus: BrowserPushChannelStatus;
  browserPushedAt: Date | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackInStockDeliveryRecord {
  id: string;
  subscriptionId: string;
  eventType: string;
  channel: 'WHATSAPP' | 'EMAIL';
  recipientMask: string;
  providerName: string;
  providerMessageId: string | null;
  idempotencyKey: string;
  status: 'PENDING' | 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'CANCELLED';
  attemptCount: number;
  lastAttemptAt: Date | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failureReason: string | null;
  providerResponseJson: string | null;
  metadataJson: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function getSubscriptionsFallbackPath(): string {
  return resolveSecureStorePath('back-in-stock-subscriptions.json', '.back-in-stock-subscriptions.json');
}

function getCustomerNotificationsFallbackPath(): string {
  return resolveSecureStorePath('customer-notifications.json', '.customer-notifications.json');
}

function getDeliveriesFallbackPath(): string {
  return resolveSecureStorePath('back-in-stock-deliveries.json', '.back-in-stock-deliveries.json');
}

function toDateOrNull(val: any): Date | null {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function atomicWriteJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}

function normalizeSubscription(raw: any): BackInStockSubscriptionRecord {
  return {
    id: String(raw.id),
    productId: String(raw.productId),
    productName: String(raw.productName || ''),
    productSlug: raw.productSlug ? String(raw.productSlug) : null,
    productImage: raw.productImage ? String(raw.productImage) : null,
    variantId: String(raw.variantId),
    sku: raw.sku ? String(raw.sku) : null,
    size: String(raw.size || ''),
    color: String(raw.color || ''),
    customerId: raw.customerId ? String(raw.customerId) : null,
    customerName: raw.customerName ? String(raw.customerName) : null,
    phoneE164: raw.phoneE164 ? String(raw.phoneE164) : null,
    email: raw.email ? String(raw.email).toLowerCase() : null,
    whatsappConsent: Boolean(raw.whatsappConsent),
    whatsappConsentAt: toDateOrNull(raw.whatsappConsentAt),
    websiteEnabled: raw.websiteEnabled !== false,
    browserPushEnabled: Boolean(raw.browserPushEnabled),
    emailBackupEnabled: Boolean(raw.emailBackupEnabled),
    status: (raw.status || 'ACTIVE') as BackInStockSubscriptionStatus,
    whatsappStatus: (raw.whatsappStatus || 'PENDING') as WhatsAppChannelStatus,
    websiteStatus: (raw.websiteStatus || 'PENDING') as WebsiteChannelStatus,
    browserPushStatus: (raw.browserPushStatus || 'SKIPPED') as BrowserPushChannelStatus,
    emailStatus: (raw.emailStatus || 'PENDING') as EmailChannelStatus,
    lastRestockBatchId: raw.lastRestockBatchId ? String(raw.lastRestockBatchId) : null,
    lastFailureSummary: raw.lastFailureSummary ? String(raw.lastFailureSummary) : null,
    notifiedAt: toDateOrNull(raw.notifiedAt),
    createdAt: toDateOrNull(raw.createdAt) || new Date(),
    updatedAt: toDateOrNull(raw.updatedAt) || new Date(),
  };
}

function normalizeCustomerNotification(raw: any): CustomerNotificationRecord {
  return {
    id: String(raw.id),
    customerId: raw.customerId ? String(raw.customerId) : null,
    customerEmail: raw.customerEmail ? String(raw.customerEmail).toLowerCase() : null,
    customerPhone: raw.customerPhone ? String(raw.customerPhone) : null,
    subscriptionId: raw.subscriptionId ? String(raw.subscriptionId) : null,
    type: String(raw.type || 'BACK_IN_STOCK'),
    title: String(raw.title || ''),
    message: String(raw.message || ''),
    productId: raw.productId ? String(raw.productId) : null,
    productSlug: raw.productSlug ? String(raw.productSlug) : null,
    productName: raw.productName ? String(raw.productName) : null,
    productImage: raw.productImage ? String(raw.productImage) : null,
    variantId: raw.variantId ? String(raw.variantId) : null,
    size: raw.size ? String(raw.size) : null,
    color: raw.color ? String(raw.color) : null,
    actionUrl: raw.actionUrl ? String(raw.actionUrl) : null,
    isRead: Boolean(raw.isRead),
    readAt: toDateOrNull(raw.readAt),
    browserPushStatus: (raw.browserPushStatus || 'SKIPPED') as BrowserPushChannelStatus,
    browserPushedAt: toDateOrNull(raw.browserPushedAt),
    idempotencyKey: String(raw.idempotencyKey),
    createdAt: toDateOrNull(raw.createdAt) || new Date(),
    updatedAt: toDateOrNull(raw.updatedAt) || new Date(),
  };
}

function normalizeDelivery(raw: any): BackInStockDeliveryRecord {
  return {
    id: String(raw.id),
    subscriptionId: String(raw.subscriptionId || ''),
    eventType: String(raw.eventType || 'BACK_IN_STOCK'),
    channel: (raw.channel === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL') as 'WHATSAPP' | 'EMAIL',
    recipientMask: String(raw.recipientMask || '***'),
    providerName: String(raw.providerName || ''),
    providerMessageId: raw.providerMessageId ? String(raw.providerMessageId) : null,
    idempotencyKey: String(raw.idempotencyKey),
    status: raw.status || 'PENDING',
    attemptCount: Number(raw.attemptCount || 0),
    lastAttemptAt: toDateOrNull(raw.lastAttemptAt),
    sentAt: toDateOrNull(raw.sentAt),
    deliveredAt: toDateOrNull(raw.deliveredAt),
    readAt: toDateOrNull(raw.readAt),
    failureReason: raw.failureReason ? String(raw.failureReason) : null,
    providerResponseJson: raw.providerResponseJson ? String(raw.providerResponseJson) : null,
    metadataJson: raw.metadataJson ? String(raw.metadataJson) : null,
    createdAt: toDateOrNull(raw.createdAt) || new Date(),
    updatedAt: toDateOrNull(raw.updatedAt) || new Date(),
  };
}

class FallbackJsonTable<T extends { id: string }> {
  private map = new Map<string, T>();
  private loaded = false;
  private loadedPath: string | null = null;

  constructor(
    private getPath: () => string,
    private normalize: (raw: any) => T
  ) {}

  private ensureLoaded() {
    const filePath = this.getPath();
    if (this.loaded && this.loadedPath === filePath) return;
    this.map.clear();
    this.loaded = true;
    this.loadedPath = filePath;
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(parsed)) {
          for (const row of parsed) {
            if (row?.id) {
              this.map.set(String(row.id), this.normalize(row));
            }
          }
        }
      }
    } catch {}
  }

  private persist() {
    try {
      atomicWriteJson(this.getPath(), Array.from(this.map.values()));
    } catch {}
  }

  all(): T[] {
    this.ensureLoaded();
    return Array.from(this.map.values());
  }

  get(id: string): T | null {
    this.ensureLoaded();
    return this.map.get(id) || null;
  }

  set(record: T): T {
    this.ensureLoaded();
    this.map.set(record.id, record);
    this.persist();
    return record;
  }

  clear() {
    this.map.clear();
    this.loaded = true;
    this.loadedPath = this.getPath();
    this.persist();
  }
}

const fallbackSubscriptions = new FallbackJsonTable<BackInStockSubscriptionRecord>(
  getSubscriptionsFallbackPath,
  normalizeSubscription
);
const fallbackCustomerNotifications = new FallbackJsonTable<CustomerNotificationRecord>(
  getCustomerNotificationsFallbackPath,
  normalizeCustomerNotification
);
const fallbackDeliveries = new FallbackJsonTable<BackInStockDeliveryRecord>(
  getDeliveriesFallbackPath,
  normalizeDelivery
);

function getPrismaBackInStockDelegate(prisma: any) {
  return prisma && prisma.backInStockSubscription ? prisma.backInStockSubscription : null;
}

function getPrismaCustomerNotificationDelegate(prisma: any) {
  return prisma && prisma.customerNotification ? prisma.customerNotification : null;
}

function getPrismaDeliveryDelegate(prisma: any) {
  return prisma && prisma.notificationDelivery ? prisma.notificationDelivery : null;
}

export const backInStockRepository = {
  async findActiveDuplicate(params: {
    variantId: string;
    customerId?: string | null;
    phoneE164?: string | null;
    email?: string | null;
  }): Promise<BackInStockSubscriptionRecord | null> {
    const cleanVariantId = String(params.variantId || '').trim();
    const cleanCustomerId = params.customerId ? String(params.customerId).trim() : null;
    const cleanPhone = params.phoneE164 ? String(params.phoneE164).trim() : null;
    const cleanEmail = params.email ? String(params.email).trim().toLowerCase() : null;

    const orClauses: any[] = [];
    if (cleanCustomerId) orClauses.push({ customerId: cleanCustomerId });
    if (cleanPhone) orClauses.push({ phoneE164: cleanPhone });
    if (cleanEmail) orClauses.push({ email: cleanEmail });
    if (orClauses.length === 0) return null;

    const prisma = getPrismaClient();
    const delegate = getPrismaBackInStockDelegate(prisma);
    if (delegate) {
      try {
        const found = await delegate.findFirst({
          where: {
            variantId: cleanVariantId,
            status: 'ACTIVE',
            OR: orClauses,
          },
          orderBy: { createdAt: 'desc' },
        });
        if (found) return normalizeSubscription(found);
        return null;
      } catch (err: any) {
        console.warn('[BACK-IN-STOCK] Prisma findActiveDuplicate fallback:', err?.message || err);
      }
    }

    const match = fallbackSubscriptions
      .all()
      .filter((s) => s.variantId === cleanVariantId && s.status === 'ACTIVE')
      .find(
        (s) =>
          (cleanCustomerId && s.customerId === cleanCustomerId) ||
          (cleanPhone && s.phoneE164 === cleanPhone) ||
          (cleanEmail && s.email === cleanEmail)
      );
    return match || null;
  },

  async createSubscription(
    data: Omit<BackInStockSubscriptionRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<BackInStockSubscriptionRecord> {
    const now = new Date();
    const record: BackInStockSubscriptionRecord = normalizeSubscription({
      ...data,
      id: data.id || `bis_${crypto.randomBytes(10).toString('hex')}`,
      createdAt: now,
      updatedAt: now,
    });

    const prisma = getPrismaClient();
    const delegate = getPrismaBackInStockDelegate(prisma);
    if (delegate) {
      try {
        const created = await delegate.create({
          data: {
            id: record.id,
            productId: record.productId,
            productName: record.productName,
            productSlug: record.productSlug,
            productImage: record.productImage,
            variantId: record.variantId,
            sku: record.sku,
            size: record.size,
            color: record.color,
            customerId: record.customerId,
            customerName: record.customerName,
            phoneE164: record.phoneE164,
            email: record.email,
            whatsappConsent: record.whatsappConsent,
            whatsappConsentAt: record.whatsappConsentAt,
            websiteEnabled: record.websiteEnabled,
            browserPushEnabled: record.browserPushEnabled,
            emailBackupEnabled: record.emailBackupEnabled,
            status: record.status,
            whatsappStatus: record.whatsappStatus,
            websiteStatus: record.websiteStatus,
            browserPushStatus: record.browserPushStatus,
            emailStatus: record.emailStatus,
            lastRestockBatchId: record.lastRestockBatchId,
            lastFailureSummary: record.lastFailureSummary,
            notifiedAt: record.notifiedAt,
          },
        });
        return normalizeSubscription(created);
      } catch (err: any) {
        console.warn('[BACK-IN-STOCK] Prisma createSubscription fallback:', err?.message || err);
      }
    }

    return fallbackSubscriptions.set(record);
  },

  async updateSubscription(
    id: string,
    patch: Partial<Omit<BackInStockSubscriptionRecord, 'id' | 'createdAt'>>
  ): Promise<BackInStockSubscriptionRecord | null> {
    const prisma = getPrismaClient();
    const delegate = getPrismaBackInStockDelegate(prisma);
    if (delegate) {
      try {
        const updated = await delegate.update({
          where: { id },
          data: { ...patch, updatedAt: new Date() },
        });
        return normalizeSubscription(updated);
      } catch (err: any) {
        console.warn('[BACK-IN-STOCK] Prisma updateSubscription fallback:', err?.message || err);
      }
    }

    const existing = fallbackSubscriptions.get(id);
    if (!existing) return null;
    const updated = normalizeSubscription({
      ...existing,
      ...patch,
      updatedAt: new Date(),
    });
    return fallbackSubscriptions.set(updated);
  },

  async findSubscriptionById(id: string): Promise<BackInStockSubscriptionRecord | null> {
    const prisma = getPrismaClient();
    const delegate = getPrismaBackInStockDelegate(prisma);
    if (delegate) {
      try {
        const found = await delegate.findUnique({ where: { id } });
        return found ? normalizeSubscription(found) : null;
      } catch (err: any) {
        console.warn('[BACK-IN-STOCK] Prisma findSubscriptionById fallback:', err?.message || err);
      }
    }
    return fallbackSubscriptions.get(id);
  },

  async findActiveByVariantId(variantId: string): Promise<BackInStockSubscriptionRecord[]> {
    const cleanVariantId = String(variantId || '').trim();
    const prisma = getPrismaClient();
    const delegate = getPrismaBackInStockDelegate(prisma);
    if (delegate) {
      try {
        const rows = await delegate.findMany({
          where: { variantId: cleanVariantId, status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
        });
        return rows.map(normalizeSubscription);
      } catch (err: any) {
        console.warn('[BACK-IN-STOCK] Prisma findActiveByVariantId fallback:', err?.message || err);
      }
    }

    return fallbackSubscriptions
      .all()
      .filter((s) => s.variantId === cleanVariantId && s.status === 'ACTIVE')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  async listSubscriptions(filter?: {
    status?: string;
    productId?: string;
    variantId?: string;
    customerId?: string;
    customerEmail?: string;
    customerPhone?: string;
    limit?: number;
  }): Promise<BackInStockSubscriptionRecord[]> {
    const prisma = getPrismaClient();
    const delegate = getPrismaBackInStockDelegate(prisma);
    if (delegate) {
      try {
        const where: any = {};
        if (filter?.status && filter.status !== 'ALL') where.status = filter.status;
        if (filter?.productId) where.productId = filter.productId;
        if (filter?.variantId) where.variantId = filter.variantId;
        const customerOr: any[] = [];
        if (filter?.customerId) customerOr.push({ customerId: filter.customerId });
        if (filter?.customerEmail) customerOr.push({ email: filter.customerEmail.toLowerCase() });
        if (filter?.customerPhone) customerOr.push({ phoneE164: filter.customerPhone });
        if (customerOr.length > 0) where.OR = customerOr;

        const rows = await delegate.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: filter?.limit || 250,
        });
        return rows.map(normalizeSubscription);
      } catch (err: any) {
        console.warn('[BACK-IN-STOCK] Prisma listSubscriptions fallback:', err?.message || err);
      }
    }

    let rows = fallbackSubscriptions.all();
    if (filter?.status && filter.status !== 'ALL') {
      rows = rows.filter((s) => s.status === filter.status);
    }
    if (filter?.productId) rows = rows.filter((s) => s.productId === filter.productId);
    if (filter?.variantId) rows = rows.filter((s) => s.variantId === filter.variantId);
    if (filter?.customerId || filter?.customerEmail || filter?.customerPhone) {
      const emailLower = filter.customerEmail?.toLowerCase();
      rows = rows.filter(
        (s) =>
          (filter.customerId && s.customerId === filter.customerId) ||
          (emailLower && s.email === emailLower) ||
          (filter.customerPhone && s.phoneE164 === filter.customerPhone)
      );
    }
    return rows
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, filter?.limit || 250);
  },

  async revokeWhatsAppConsentByPhone(phoneE164: string): Promise<number> {
    const cleanPhone = String(phoneE164 || '').trim();
    if (!cleanPhone) return 0;

    let count = 0;
    const prisma = getPrismaClient();
    const delegate = getPrismaBackInStockDelegate(prisma);
    if (delegate) {
      try {
        const res = await delegate.updateMany({
          where: { phoneE164: cleanPhone, whatsappConsent: true },
          data: { whatsappConsent: false, updatedAt: new Date() },
        });
        count = Number(res?.count || 0);
        return count;
      } catch (err: any) {
        console.warn('[BACK-IN-STOCK] Prisma revokeWhatsAppConsentByPhone fallback:', err?.message || err);
      }
    }

    for (const sub of fallbackSubscriptions.all()) {
      if (sub.phoneE164 === cleanPhone && sub.whatsappConsent) {
        fallbackSubscriptions.set({
          ...sub,
          whatsappConsent: false,
          updatedAt: new Date(),
        });
        count += 1;
      }
    }
    return count;
  },

  // ---------------------------------------------------------------------------
  // Customer Website Notifications Inbox (Durable — persists while offline)
  // ---------------------------------------------------------------------------
  async createCustomerNotificationUnique(
    data: Omit<CustomerNotificationRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<{ record: CustomerNotificationRecord; created: boolean }> {
    const prisma = getPrismaClient();
    const delegate = getPrismaCustomerNotificationDelegate(prisma);
    if (delegate) {
      try {
        const existing = await delegate.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
        if (existing) {
          return { record: normalizeCustomerNotification(existing), created: false };
        }
        const created = await delegate.create({
          data: {
            id: data.id || `cnotif_${crypto.randomBytes(10).toString('hex')}`,
            customerId: data.customerId,
            customerEmail: data.customerEmail ? data.customerEmail.toLowerCase() : null,
            customerPhone: data.customerPhone,
            subscriptionId: data.subscriptionId,
            type: data.type || 'BACK_IN_STOCK',
            title: data.title,
            message: data.message,
            productId: data.productId,
            productSlug: data.productSlug,
            productName: data.productName,
            productImage: data.productImage,
            variantId: data.variantId,
            size: data.size,
            color: data.color,
            actionUrl: data.actionUrl,
            isRead: Boolean(data.isRead),
            readAt: data.readAt,
            browserPushStatus: data.browserPushStatus || 'SKIPPED',
            browserPushedAt: data.browserPushedAt,
            idempotencyKey: data.idempotencyKey,
          },
        });
        return { record: normalizeCustomerNotification(created), created: true };
      } catch (err: any) {
        if (err?.code === 'P2002') {
          const existing = await delegate.findUnique({ where: { idempotencyKey: data.idempotencyKey } }).catch(() => null);
          if (existing) return { record: normalizeCustomerNotification(existing), created: false };
        }
        console.warn('[BACK-IN-STOCK] Prisma createCustomerNotificationUnique fallback:', err?.message || err);
      }
    }

    const existingFallback = fallbackCustomerNotifications
      .all()
      .find((n) => n.idempotencyKey === data.idempotencyKey);
    if (existingFallback) {
      return { record: existingFallback, created: false };
    }
    const now = new Date();
    const record = normalizeCustomerNotification({
      ...data,
      id: data.id || `cnotif_${crypto.randomBytes(10).toString('hex')}`,
      createdAt: now,
      updatedAt: now,
    });
    fallbackCustomerNotifications.set(record);
    return { record, created: true };
  },

  async findCustomerNotificationById(id: string): Promise<CustomerNotificationRecord | null> {
    const prisma = getPrismaClient();
    const delegate = getPrismaCustomerNotificationDelegate(prisma);
    if (delegate) {
      try {
        const found = await delegate.findUnique({ where: { id } });
        return found ? normalizeCustomerNotification(found) : null;
      } catch (err: any) {
        console.warn('[BACK-IN-STOCK] Prisma findCustomerNotificationById fallback:', err?.message || err);
      }
    }
    return fallbackCustomerNotifications.get(id);
  },

  async listCustomerNotifications(identity: {
    customerId?: string | null;
    email?: string | null;
    phoneE164?: string | null;
    limit?: number;
  }): Promise<CustomerNotificationRecord[]> {
    const orClauses: any[] = [];
    if (identity.customerId) orClauses.push({ customerId: String(identity.customerId) });
    if (identity.email) orClauses.push({ customerEmail: String(identity.email).toLowerCase() });
    if (identity.phoneE164) orClauses.push({ customerPhone: String(identity.phoneE164) });
    if (orClauses.length === 0) return [];

    const prisma = getPrismaClient();
    const delegate = getPrismaCustomerNotificationDelegate(prisma);
    if (delegate) {
      try {
        const rows = await delegate.findMany({
          where: { OR: orClauses },
          orderBy: { createdAt: 'desc' },
          take: identity.limit || 50,
        });
        return rows.map(normalizeCustomerNotification);
      } catch (err: any) {
        console.warn('[BACK-IN-STOCK] Prisma listCustomerNotifications fallback:', err?.message || err);
      }
    }

    const emailLower = identity.email ? String(identity.email).toLowerCase() : null;
    return fallbackCustomerNotifications
      .all()
      .filter(
        (n) =>
          (identity.customerId && n.customerId === identity.customerId) ||
          (emailLower && n.customerEmail === emailLower) ||
          (identity.phoneE164 && n.customerPhone === identity.phoneE164)
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, identity.limit || 50);
  },

  async markCustomerNotificationRead(id: string): Promise<CustomerNotificationRecord | null> {
    const now = new Date();
    const prisma = getPrismaClient();
    const delegate = getPrismaCustomerNotificationDelegate(prisma);
    let updated: CustomerNotificationRecord | null = null;

    if (delegate) {
      try {
        const row = await delegate.update({
          where: { id },
          data: { isRead: true, readAt: now, updatedAt: now },
        });
        updated = normalizeCustomerNotification(row);
      } catch (err: any) {
        console.warn('[BACK-IN-STOCK] Prisma markCustomerNotificationRead fallback:', err?.message || err);
      }
    }

    if (!updated) {
      const existing = fallbackCustomerNotifications.get(id);
      if (!existing) return null;
      updated = normalizeCustomerNotification({ ...existing, isRead: true, readAt: now, updatedAt: now });
      fallbackCustomerNotifications.set(updated);
    }

    // Reflect website read state on parent subscription
    if (updated.subscriptionId) {
      await this.updateSubscription(updated.subscriptionId, { websiteStatus: 'READ' }).catch(() => {});
    }
    return updated;
  },

  async markAllCustomerNotificationsRead(identity: {
    customerId?: string | null;
    email?: string | null;
    phoneE164?: string | null;
  }): Promise<number> {
    const list = await this.listCustomerNotifications({ ...identity, limit: 200 });
    let count = 0;
    for (const notif of list) {
      if (!notif.isRead) {
        const res = await this.markCustomerNotificationRead(notif.id);
        if (res) count += 1;
      }
    }
    return count;
  },

  async updateBrowserPushStatus(
    notificationId: string,
    status: BrowserPushChannelStatus
  ): Promise<CustomerNotificationRecord | null> {
    const now = new Date();
    const prisma = getPrismaClient();
    const delegate = getPrismaCustomerNotificationDelegate(prisma);
    let updated: CustomerNotificationRecord | null = null;

    if (delegate) {
      try {
        const row = await delegate.update({
          where: { id: notificationId },
          data: {
            browserPushStatus: status,
            browserPushedAt: status === 'DELIVERED' ? now : undefined,
            updatedAt: now,
          },
        });
        updated = normalizeCustomerNotification(row);
      } catch (err: any) {
        console.warn('[BACK-IN-STOCK] Prisma updateBrowserPushStatus fallback:', err?.message || err);
      }
    }

    if (!updated) {
      const existing = fallbackCustomerNotifications.get(notificationId);
      if (!existing) return null;
      updated = normalizeCustomerNotification({
        ...existing,
        browserPushStatus: status,
        browserPushedAt: status === 'DELIVERED' ? now : existing.browserPushedAt,
        updatedAt: now,
      });
      fallbackCustomerNotifications.set(updated);
    }

    // Independently update parent subscription's browserPushStatus without touching WhatsApp/Website/Email
    if (updated.subscriptionId) {
      await this.updateSubscription(updated.subscriptionId, { browserPushStatus: status }).catch(() => {});
    }
    return updated;
  },

  // ---------------------------------------------------------------------------
  // Durable External Channel Deliveries (WhatsApp & Email)
  // ---------------------------------------------------------------------------
  async findDeliveryByIdempotencyKey(idempotencyKey: string): Promise<BackInStockDeliveryRecord | null> {
    const prisma = getPrismaClient();
    const delegate = getPrismaDeliveryDelegate(prisma);
    if (delegate) {
      try {
        const found = await delegate.findUnique({ where: { idempotencyKey } });
        return found ? normalizeDelivery(found) : null;
      } catch (err: any) {
        console.warn('[BACK-IN-STOCK] Prisma findDeliveryByIdempotencyKey fallback:', err?.message || err);
      }
    }
    return fallbackDeliveries.all().find((d) => d.idempotencyKey === idempotencyKey) || null;
  },

  async createDelivery(
    data: Omit<BackInStockDeliveryRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<BackInStockDeliveryRecord> {
    const now = new Date();
    const record = normalizeDelivery({
      ...data,
      id: data.id || `bisdel_${crypto.randomBytes(10).toString('hex')}`,
      createdAt: now,
      updatedAt: now,
    });

    const prisma = getPrismaClient();
    const delegate = getPrismaDeliveryDelegate(prisma);
    if (delegate) {
      try {
        const created = await delegate.create({
          data: {
            id: record.id,
            subscriberId: null,
            campaignId: null,
            orderId: null,
            subscriptionId: record.subscriptionId,
            eventType: record.eventType,
            channel: record.channel,
            recipientMask: record.recipientMask,
            providerName: record.providerName,
            providerMessageId: record.providerMessageId,
            idempotencyKey: record.idempotencyKey,
            status: record.status,
            attemptCount: record.attemptCount,
            lastAttemptAt: record.lastAttemptAt,
            sentAt: record.sentAt,
            deliveredAt: record.deliveredAt,
            readAt: record.readAt,
            failureReason: record.failureReason,
            providerResponseJson: record.providerResponseJson,
            metadataJson: record.metadataJson,
          },
        });
        return normalizeDelivery(created);
      } catch (err: any) {
        console.warn('[BACK-IN-STOCK] Prisma createDelivery fallback:', err?.message || err);
      }
    }

    return fallbackDeliveries.set(record);
  },

  async updateDelivery(
    id: string,
    patch: Partial<Omit<BackInStockDeliveryRecord, 'id' | 'createdAt'>>
  ): Promise<BackInStockDeliveryRecord | null> {
    const prisma = getPrismaClient();
    const delegate = getPrismaDeliveryDelegate(prisma);
    if (delegate) {
      try {
        const updated = await delegate.update({
          where: { id },
          data: { ...patch, updatedAt: new Date() },
        });
        return normalizeDelivery(updated);
      } catch (err: any) {
        console.warn('[BACK-IN-STOCK] Prisma updateDelivery fallback:', err?.message || err);
      }
    }

    const existing = fallbackDeliveries.get(id);
    if (!existing) return null;
    const updated = normalizeDelivery({ ...existing, ...patch, updatedAt: new Date() });
    return fallbackDeliveries.set(updated);
  },

  async listDeliveriesBySubscriptionIds(subscriptionIds: string[]): Promise<BackInStockDeliveryRecord[]> {
    if (subscriptionIds.length === 0) return [];
    const prisma = getPrismaClient();
    const delegate = getPrismaDeliveryDelegate(prisma);
    if (delegate) {
      try {
        const rows = await delegate.findMany({
          where: { subscriptionId: { in: subscriptionIds } },
          orderBy: { createdAt: 'desc' },
        });
        return rows.map(normalizeDelivery);
      } catch (err: any) {
        console.warn('[BACK-IN-STOCK] Prisma listDeliveriesBySubscriptionIds fallback:', err?.message || err);
      }
    }
    const set = new Set(subscriptionIds);
    return fallbackDeliveries
      .all()
      .filter((d) => set.has(d.subscriptionId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async syncWebhookDeliveryStatusToSubscription(
    subscriptionId: string,
    channel: 'WHATSAPP' | 'EMAIL',
    status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
    failureReason?: string | null
  ): Promise<void> {
    if (!subscriptionId) return;
    if (channel === 'WHATSAPP') {
      await this.updateSubscription(subscriptionId, {
        whatsappStatus: status,
        ...(status === 'FAILED' && failureReason ? { lastFailureSummary: `WhatsApp: ${failureReason}` } : {}),
      }).catch(() => {});
    } else if (channel === 'EMAIL') {
      const emailStatus: EmailChannelStatus = status === 'READ' ? 'DELIVERED' : status;
      await this.updateSubscription(subscriptionId, {
        emailStatus,
        ...(status === 'FAILED' && failureReason ? { lastFailureSummary: `Email: ${failureReason}` } : {}),
      }).catch(() => {});
    }
  },

  resetFallbackStoreForTests() {
    fallbackSubscriptions.clear();
    fallbackCustomerNotifications.clear();
    fallbackDeliveries.clear();
  },
};
