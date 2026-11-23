import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getPrismaClient } from '../../db/prisma';
import { orderRepository, OrderRecord } from '../../repositories/orderRepository';
import { shippingRepository } from '../../repositories/shippingRepository';
import { logisticsPartnerRepository } from '../../repositories/logisticsPartnerRepository';
import { resolveSecureStorePath } from '../../utils/storageHelper';
import { sendResendEmail, SendEmailResult } from './resendEmailService';
import { sendWhatsAppTemplateMessage, SendWhatsAppResult } from './whatsappCloudService';
import { buildOrderTransactionalEmail } from './orderEmailTemplates';
import {
  OrderNotificationContext,
  OrderNotificationEventType,
  normalizeOrderPhoneToE164,
  resolveOrderWhatsAppTemplate,
  sanitizeTrackingUrl,
} from './orderWhatsAppTemplates';

export type OrderNotificationChannel = 'EMAIL' | 'WHATSAPP';

export interface OrderDeliveryRecord {
  id: string;
  orderId: string;
  eventType: OrderNotificationEventType;
  channel: OrderNotificationChannel;
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

export interface ChannelDispatchOutcome {
  channel: OrderNotificationChannel;
  attempted: boolean;
  sent: boolean;
  skippedDuplicate?: boolean;
  skippedNoConsent?: boolean;
  skippedInvalidRecipient?: boolean;
  configMissing?: boolean;
  deliveryId?: string;
  idempotencyKey?: string;
  providerMessageId?: string;
  error?: string;
}

export interface OrderNotificationDispatchResult {
  orderId: string;
  orderNumber: string;
  eventType: OrderNotificationEventType;
  skippedBySetting?: boolean;
  email: ChannelDispatchOutcome;
  whatsapp: ChannelDispatchOutcome;
}

const FALLBACK_DELIVERIES_PATH = resolveSecureStorePath(
  'order-notification-deliveries.json',
  '.order-notification-deliveries.json'
);

const idempotencyLocks = new Map<string, Promise<void>>();
const pendingDispatches = new Set<Promise<unknown>>();

async function acquireIdempotencyLock(key: string): Promise<() => void> {
  while (idempotencyLocks.has(key)) {
    await idempotencyLocks.get(key);
  }
  let release!: () => void;
  const p = new Promise<void>((resolve) => {
    release = resolve;
  });
  idempotencyLocks.set(key, p);
  return () => {
    idempotencyLocks.delete(key);
    release();
  };
}

export function buildOrderNotificationIdempotencyKey(
  orderId: string,
  eventType: OrderNotificationEventType,
  channel: OrderNotificationChannel
): string {
  return `order:${String(orderId).trim()}:${eventType}:${channel}`;
}

function maskEmail(email: string): string {
  const clean = String(email || '').trim().toLowerCase();
  const [local, domain] = clean.split('@');
  if (!local || !domain) return '***';
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (digits.length < 4) return '***';
  return `+${digits.slice(0, 2)}****${digits.slice(-4)}`;
}

function isValidEmail(email?: string | null): boolean {
  const clean = String(email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
}

// -----------------------------------------------------------------------------
// Durable Local Fallback Store (used only when Prisma / MySQL is unavailable)
// -----------------------------------------------------------------------------
class FallbackDeliveryStore {
  private map = new Map<string, OrderDeliveryRecord>();
  private loaded = false;

  private load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (fs.existsSync(FALLBACK_DELIVERIES_PATH)) {
        const raw = fs.readFileSync(FALLBACK_DELIVERIES_PATH, 'utf-8');
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (item?.id) {
              this.map.set(item.id, {
                ...item,
                lastAttemptAt: item.lastAttemptAt ? new Date(item.lastAttemptAt) : null,
                sentAt: item.sentAt ? new Date(item.sentAt) : null,
                deliveredAt: item.deliveredAt ? new Date(item.deliveredAt) : null,
                readAt: item.readAt ? new Date(item.readAt) : null,
                createdAt: new Date(item.createdAt || Date.now()),
                updatedAt: new Date(item.updatedAt || Date.now()),
              });
            }
          }
        }
      }
    } catch {}
  }

  private persist() {
    try {
      const dir = path.dirname(FALLBACK_DELIVERIES_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tmp = `${FALLBACK_DELIVERIES_PATH}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(Array.from(this.map.values()), null, 2), 'utf-8');
      fs.renameSync(tmp, FALLBACK_DELIVERIES_PATH);
    } catch {}
  }

  findByIdempotencyKey(key: string): OrderDeliveryRecord | null {
    this.load();
    for (const rec of this.map.values()) {
      if (rec.idempotencyKey === key) return { ...rec };
    }
    return null;
  }

  findById(id: string): OrderDeliveryRecord | null {
    this.load();
    const rec = this.map.get(id);
    return rec ? { ...rec } : null;
  }

  listByOrderId(orderId: string): OrderDeliveryRecord[] {
    this.load();
    const out: OrderDeliveryRecord[] = [];
    for (const rec of this.map.values()) {
      if (rec.orderId === orderId) out.push({ ...rec });
    }
    return out.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  createUnique(rec: OrderDeliveryRecord): { created: boolean; record: OrderDeliveryRecord } {
    this.load();
    const existing = this.findByIdempotencyKey(rec.idempotencyKey);
    if (existing) return { created: false, record: existing };
    this.map.set(rec.id, { ...rec });
    this.persist();
    return { created: true, record: { ...rec } };
  }

  update(id: string, patch: Partial<OrderDeliveryRecord>): OrderDeliveryRecord | null {
    this.load();
    const existing = this.map.get(id);
    if (!existing) return null;
    const merged: OrderDeliveryRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.map.set(id, merged);
    this.persist();
    return { ...merged };
  }

  reset() {
    this.map.clear();
    this.loaded = true;
    try {
      if (fs.existsSync(FALLBACK_DELIVERIES_PATH)) {
        fs.unlinkSync(FALLBACK_DELIVERIES_PATH);
      }
    } catch {}
  }
}

const fallbackStore = new FallbackDeliveryStore();

export function resetFallbackOrderDeliveriesForTests(): void {
  fallbackStore.reset();
}

function mapPrismaDelivery(row: any): OrderDeliveryRecord {
  return {
    id: row.id,
    orderId: row.orderId || '',
    eventType: row.eventType as OrderNotificationEventType,
    channel: row.channel as OrderNotificationChannel,
    recipientMask: row.recipientMask,
    providerName: row.providerName,
    providerMessageId: row.providerMessageId ?? null,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    attemptCount: Number(row.attemptCount || 0),
    lastAttemptAt: row.lastAttemptAt ? new Date(row.lastAttemptAt) : null,
    sentAt: row.sentAt ? new Date(row.sentAt) : null,
    deliveredAt: row.deliveredAt ? new Date(row.deliveredAt) : null,
    readAt: row.readAt ? new Date(row.readAt) : null,
    failureReason: row.failureReason ?? null,
    providerResponseJson: row.providerResponseJson ?? null,
    metadataJson: row.metadataJson ?? null,
    createdAt: new Date(row.createdAt || Date.now()),
    updatedAt: new Date(row.updatedAt || Date.now()),
  };
}

async function claimDeliveryRecord(params: {
  orderId: string;
  eventType: OrderNotificationEventType;
  channel: OrderNotificationChannel;
  recipientMask: string;
  providerName: string;
  idempotencyKey: string;
  metadataJson: string;
}): Promise<{ claimed: boolean; delivery: OrderDeliveryRecord; storage: 'prisma' | 'fallback' }> {
  const prisma = getPrismaClient();
  const id = `odel-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date();

  if (prisma?.notificationDelivery) {
    try {
      const existing = await prisma.notificationDelivery.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) {
        return { claimed: false, delivery: mapPrismaDelivery(existing), storage: 'prisma' };
      }

      const created = await prisma.notificationDelivery.create({
        data: {
          id,
          subscriberId: null,
          campaignId: null,
          orderId: params.orderId,
          eventType: params.eventType,
          channel: params.channel,
          recipientMask: params.recipientMask,
          providerName: params.providerName,
          idempotencyKey: params.idempotencyKey,
          status: 'PENDING',
          attemptCount: 0,
          metadataJson: params.metadataJson,
        },
      });
      return { claimed: true, delivery: mapPrismaDelivery(created), storage: 'prisma' };
    } catch (err: any) {
      // Unique constraint violation (P2002) means another worker already claimed this idempotencyKey
      if (err?.code === 'P2002') {
        const raced = await prisma.notificationDelivery
          .findUnique({ where: { idempotencyKey: params.idempotencyKey } })
          .catch(() => null);
        if (raced) {
          return { claimed: false, delivery: mapPrismaDelivery(raced), storage: 'prisma' };
        }
        return {
          claimed: false,
          delivery: {
            id,
            orderId: params.orderId,
            eventType: params.eventType,
            channel: params.channel,
            recipientMask: params.recipientMask,
            providerName: params.providerName,
            providerMessageId: null,
            idempotencyKey: params.idempotencyKey,
            status: 'SENT',
            attemptCount: 1,
            lastAttemptAt: now,
            sentAt: now,
            deliveredAt: null,
            readAt: null,
            failureReason: null,
            providerResponseJson: null,
            metadataJson: params.metadataJson,
            createdAt: now,
            updatedAt: now,
          },
          storage: 'prisma',
        };
      }
      // Fall through to local fallback store only when Prisma query failed due to offline DB
      console.warn('[OrderNotificationService] Prisma delivery write fallback note:', err?.message || err);
    }
  }

  const fallbackRes = fallbackStore.createUnique({
    id,
    orderId: params.orderId,
    eventType: params.eventType,
    channel: params.channel,
    recipientMask: params.recipientMask,
    providerName: params.providerName,
    providerMessageId: null,
    idempotencyKey: params.idempotencyKey,
    status: 'PENDING',
    attemptCount: 0,
    lastAttemptAt: null,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    failureReason: null,
    providerResponseJson: null,
    metadataJson: params.metadataJson,
    createdAt: now,
    updatedAt: now,
  });

  return {
    claimed: fallbackRes.created,
    delivery: fallbackRes.record,
    storage: 'fallback',
  };
}

async function persistDeliveryStatus(
  storage: 'prisma' | 'fallback',
  deliveryId: string,
  patch: Partial<OrderDeliveryRecord>,
  incrementAttempt = false
): Promise<void> {
  if (storage === 'prisma') {
    const prisma = getPrismaClient();
    if (prisma?.notificationDelivery) {
      await prisma.notificationDelivery
        .update({
          where: { id: deliveryId },
          data: {
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(patch.providerMessageId !== undefined ? { providerMessageId: patch.providerMessageId } : {}),
            ...(patch.lastAttemptAt !== undefined ? { lastAttemptAt: patch.lastAttemptAt } : {}),
            ...(patch.sentAt !== undefined ? { sentAt: patch.sentAt } : {}),
            ...(patch.failureReason !== undefined ? { failureReason: patch.failureReason } : {}),
            ...(patch.providerResponseJson !== undefined ? { providerResponseJson: patch.providerResponseJson } : {}),
            ...(incrementAttempt ? { attemptCount: { increment: 1 } } : {}),
          },
        })
        .catch(() => {});
    }
    return;
  }

  const current = fallbackStore.findById(deliveryId);
  if (!current) return;
  fallbackStore.update(deliveryId, {
    ...patch,
    attemptCount: incrementAttempt ? (current.attemptCount || 0) + 1 : (patch.attemptCount ?? current.attemptCount),
  });
}

async function isNumberOptedOutViaStop(e164: string): Promise<boolean> {
  const prisma = getPrismaClient();
  if (!prisma?.earlyAccessSubscriber) return false;
  try {
    const sub = await prisma.earlyAccessSubscriber.findUnique({
      where: { whatsappNumber: e164 },
    });
    if (
      sub &&
      sub.whatsappConsent === false &&
      typeof sub.unsubscribeReason === 'string' &&
      sub.unsubscribeReason.startsWith('WhatsApp inbound keyword:')
    ) {
      return true;
    }
  } catch {}
  return false;
}

export async function resolveOrderTrackingDetails(
  order: OrderRecord,
  explicit?: { courierPartner?: string; trackingNumber?: string; trackingUrl?: string }
): Promise<{ courierPartner?: string; trackingNumber?: string; trackingUrl?: string }> {
  const shipment = await shippingRepository.findByOrderId(order.id).catch(() => null);
  const courierPartner =
    explicit?.courierPartner ||
    order.courierPartner ||
    shipment?.carrier ||
    undefined;
  const trackingNumber =
    explicit?.trackingNumber ||
    order.awbNumber ||
    order.courierTrackingNumber ||
    shipment?.awbCode ||
    shipment?.trackingNumber ||
    undefined;

  let trackingUrl = sanitizeTrackingUrl(explicit?.trackingUrl) || sanitizeTrackingUrl(shipment?.trackingUrl);

  if (!trackingUrl && trackingNumber) {
    try {
      const partners = await logisticsPartnerRepository.getAll();
      const needle = String(courierPartner || shipment?.carrier || '').toLowerCase();
      const matched =
        partners.find(
          (p) =>
            p.trackingUrlTemplate &&
            (p.carrierKey.toLowerCase() === needle ||
              p.name.toLowerCase() === needle ||
              needle.includes(p.carrierKey.toLowerCase()) ||
              p.id.toLowerCase() === needle)
        ) ||
        partners.find((p) => p.carrierKey === 'SHIPROCKET' && p.trackingUrlTemplate);

      if (matched?.trackingUrlTemplate) {
        trackingUrl = sanitizeTrackingUrl(
          matched.trackingUrlTemplate.replace('{awb}', encodeURIComponent(trackingNumber))
        );
      }
    } catch {}
  }

  return { courierPartner, trackingNumber, trackingUrl };
}

export async function shouldSendDispatchNotification(): Promise<boolean> {
  try {
    const settings = await logisticsPartnerRepository.getSettings();
    return settings.notifyCustomerOnDispatch !== false;
  } catch {
    return true;
  }
}

async function executeEmailChannel(params: {
  order: OrderRecord;
  eventType: OrderNotificationEventType;
  context: OrderNotificationContext;
  existingDelivery?: { id: string; storage: 'prisma' | 'fallback'; idempotencyKey: string };
  retryDelayMs?: number;
}): Promise<ChannelDispatchOutcome> {
  const email = String(params.order.customerEmail || '').trim();
  if (!isValidEmail(email)) {
    return {
      channel: 'EMAIL',
      attempted: false,
      sent: false,
      skippedInvalidRecipient: true,
      error: 'Order does not have a valid customer email address.',
    };
  }

  const idempotencyKey =
    params.existingDelivery?.idempotencyKey ||
    buildOrderNotificationIdempotencyKey(params.order.id, params.eventType, 'EMAIL');

  const releaseLock = await acquireIdempotencyLock(idempotencyKey);
  try {
    let deliveryId: string;
    let storage: 'prisma' | 'fallback';

    if (params.existingDelivery) {
      deliveryId = params.existingDelivery.id;
      storage = params.existingDelivery.storage;
    } else {
      const metadata = JSON.stringify({
        orderNumber: params.order.orderNumber,
        cancellationReason: params.context.cancellationReason || params.order.cancellationReason || null,
        courierPartner: params.context.courierPartner || params.order.courierPartner || null,
        trackingNumber: params.context.trackingNumber || params.order.awbNumber || params.order.courierTrackingNumber || null,
        trackingUrl: params.context.trackingUrl || null,
      });

      const claim = await claimDeliveryRecord({
        orderId: params.order.id,
        eventType: params.eventType,
        channel: 'EMAIL',
        recipientMask: maskEmail(email),
        providerName: 'RESEND',
        idempotencyKey,
        metadataJson: metadata,
      });

      if (!claim.claimed) {
        return {
          channel: 'EMAIL',
          attempted: false,
          sent: false,
          skippedDuplicate: true,
          deliveryId: claim.delivery.id,
          idempotencyKey,
          providerMessageId: claim.delivery.providerMessageId || undefined,
        };
      }
      deliveryId = claim.delivery.id;
      storage = claim.storage;
    }

    const built = buildOrderTransactionalEmail(params.eventType, params.context);

    // sendResendEmail automatically updates Prisma when storage === 'prisma';
    // for fallback storage, we sync status explicitly after provider response.
    const sendRes: SendEmailResult = await sendResendEmail({
      to: email,
      subject: built.subject,
      html: built.html,
      text: built.text,
      idempotencyKey,
      deliveryId: storage === 'prisma' ? deliveryId : undefined,
      tags: [
        { name: 'event', value: params.eventType },
        { name: 'order', value: String(params.order.orderNumber || params.order.id).replace(/[^a-zA-Z0-9_-]/g, '_') },
      ],
      retryDelayMs: params.retryDelayMs,
    });

    if (storage === 'fallback') {
      if (sendRes.success && sendRes.providerMessageId) {
        await persistDeliveryStatus(
          'fallback',
          deliveryId,
          {
            status: 'SENT',
            providerMessageId: sendRes.providerMessageId,
            sentAt: new Date(),
            lastAttemptAt: new Date(),
            failureReason: null,
            providerResponseJson:
              sendRes.rawResponse !== undefined ? JSON.stringify(sendRes.rawResponse).slice(0, 2000) : null,
            attemptCount: Math.max(1, sendRes.attempts),
          },
          false
        );
      } else {
        await persistDeliveryStatus(
          'fallback',
          deliveryId,
          {
            status: 'FAILED',
            lastAttemptAt: new Date(),
            failureReason: sendRes.error || 'Email delivery failed',
            providerResponseJson:
              sendRes.rawResponse !== undefined ? JSON.stringify(sendRes.rawResponse).slice(0, 2000) : null,
          },
          true
        );
      }
    }

    return {
      channel: 'EMAIL',
      attempted: true,
      sent: Boolean(sendRes.success && sendRes.providerMessageId),
      configMissing: sendRes.configMissing,
      deliveryId,
      idempotencyKey,
      providerMessageId: sendRes.providerMessageId,
      error: sendRes.error,
    };
  } finally {
    releaseLock();
  }
}

async function executeWhatsAppChannel(params: {
  order: OrderRecord;
  eventType: OrderNotificationEventType;
  context: OrderNotificationContext;
  existingDelivery?: { id: string; storage: 'prisma' | 'fallback'; idempotencyKey: string };
  retryDelayMs?: number;
}): Promise<ChannelDispatchOutcome> {
  // Strict consent enforcement: NEVER send WhatsApp without explicit order opt-in
  if (params.order.whatsappOptIn !== true) {
    return {
      channel: 'WHATSAPP',
      attempted: false,
      sent: false,
      skippedNoConsent: true,
    };
  }

  const rawPhone =
    params.order.whatsappNumber ||
    params.order.customerPhone ||
    params.order.shippingAddress?.phone;
  const toE164 = normalizeOrderPhoneToE164(rawPhone);
  if (!toE164) {
    return {
      channel: 'WHATSAPP',
      attempted: false,
      sent: false,
      skippedInvalidRecipient: true,
      error: 'Customer mobile number could not be normalized to valid E.164 format.',
    };
  }

  // Respect inbound STOP opt-out even if order had whatsappOptIn previously
  if (await isNumberOptedOutViaStop(toE164)) {
    return {
      channel: 'WHATSAPP',
      attempted: false,
      sent: false,
      skippedNoConsent: true,
      error: 'Recipient previously opted out of WhatsApp updates via STOP.',
    };
  }

  const idempotencyKey =
    params.existingDelivery?.idempotencyKey ||
    buildOrderNotificationIdempotencyKey(params.order.id, params.eventType, 'WHATSAPP');

  const releaseLock = await acquireIdempotencyLock(idempotencyKey);
  try {
    let deliveryId: string;
    let storage: 'prisma' | 'fallback';

    if (params.existingDelivery) {
      deliveryId = params.existingDelivery.id;
      storage = params.existingDelivery.storage;
    } else {
      const metadata = JSON.stringify({
        orderNumber: params.order.orderNumber,
        cancellationReason: params.context.cancellationReason || params.order.cancellationReason || null,
        courierPartner: params.context.courierPartner || params.order.courierPartner || null,
        trackingNumber: params.context.trackingNumber || params.order.awbNumber || params.order.courierTrackingNumber || null,
        trackingUrl: params.context.trackingUrl || null,
      });

      const claim = await claimDeliveryRecord({
        orderId: params.order.id,
        eventType: params.eventType,
        channel: 'WHATSAPP',
        recipientMask: maskPhone(toE164),
        providerName: 'META_WHATSAPP_CLOUD',
        idempotencyKey,
        metadataJson: metadata,
      });

      if (!claim.claimed) {
        return {
          channel: 'WHATSAPP',
          attempted: false,
          sent: false,
          skippedDuplicate: true,
          deliveryId: claim.delivery.id,
          idempotencyKey,
          providerMessageId: claim.delivery.providerMessageId || undefined,
        };
      }
      deliveryId = claim.delivery.id;
      storage = claim.storage;
    }

    const templateSpec = resolveOrderWhatsAppTemplate(params.eventType, params.context);
    if (!templateSpec.configured || !templateSpec.templateName) {
      // Record configuration failure durably and DO NOT attempt an invalid send to Meta API
      const reason =
        templateSpec.reason ||
        `WhatsApp template env var ${templateSpec.envVarName} is not configured.`;
      await persistDeliveryStatus(
        storage,
        deliveryId,
        {
          status: 'FAILED',
          lastAttemptAt: new Date(),
          failureReason: reason,
        },
        true
      );
      return {
        channel: 'WHATSAPP',
        attempted: false,
        sent: false,
        configMissing: true,
        deliveryId,
        idempotencyKey,
        error: reason,
      };
    }

    const waRes: SendWhatsAppResult = await sendWhatsAppTemplateMessage({
      toE164,
      templateName: templateSpec.templateName,
      templateLang: templateSpec.templateLang,
      allowDefaultTemplateFallback: false,
      bodyParameters: templateSpec.bodyParameters,
      deliveryId: storage === 'prisma' ? deliveryId : undefined,
      retryDelayMs: params.retryDelayMs,
    });

    if (storage === 'fallback') {
      if (waRes.success && waRes.providerMessageId) {
        await persistDeliveryStatus(
          'fallback',
          deliveryId,
          {
            status: 'SENT',
            providerMessageId: waRes.providerMessageId,
            sentAt: new Date(),
            lastAttemptAt: new Date(),
            failureReason: null,
            providerResponseJson:
              waRes.rawResponse !== undefined ? JSON.stringify(waRes.rawResponse).slice(0, 2000) : null,
            attemptCount: Math.max(1, waRes.attempts),
          },
          false
        );
      } else {
        await persistDeliveryStatus(
          'fallback',
          deliveryId,
          {
            status: 'FAILED',
            lastAttemptAt: new Date(),
            failureReason: waRes.error || 'WhatsApp Cloud API delivery failed',
            providerResponseJson:
              waRes.rawResponse !== undefined ? JSON.stringify(waRes.rawResponse).slice(0, 2000) : null,
          },
          true
        );
      }
    }

    return {
      channel: 'WHATSAPP',
      attempted: true,
      sent: Boolean(waRes.success && waRes.providerMessageId),
      configMissing: waRes.configMissing,
      deliveryId,
      idempotencyKey,
      providerMessageId: waRes.providerMessageId,
      error: waRes.error,
    };
  } finally {
    releaseLock();
  }
}

/**
 * Dispatches transactional Email (always, when email is valid) and WhatsApp (only when explicit consent exists)
 * for a committed order lifecycle event.
 * Never throws; captures all provider failures safely in NotificationDelivery records.
 */
export async function dispatchOrderNotification(
  eventType: OrderNotificationEventType,
  context: OrderNotificationContext,
  options?: { retryDelayMs?: number; respectDispatchSetting?: boolean }
): Promise<OrderNotificationDispatchResult> {
  const { order } = context;

  // Respect notifyCustomerOnDispatch setting for ORDER_SHIPPED events
  if (eventType === 'ORDER_SHIPPED' && options?.respectDispatchSetting !== false) {
    const allowed = await shouldSendDispatchNotification();
    if (!allowed) {
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        eventType,
        skippedBySetting: true,
        email: { channel: 'EMAIL', attempted: false, sent: false },
        whatsapp: { channel: 'WHATSAPP', attempted: false, sent: false },
      };
    }
  }

  // Enrich tracking info whenever shipping/delivery event fires
  let enrichedContext = context;
  if (
    eventType === 'ORDER_SHIPPED' ||
    eventType === 'ORDER_OUT_FOR_DELIVERY' ||
    eventType === 'ORDER_DELIVERED'
  ) {
    const tracking = await resolveOrderTrackingDetails(order, {
      courierPartner: context.courierPartner,
      trackingNumber: context.trackingNumber,
      trackingUrl: context.trackingUrl,
    });
    enrichedContext = {
      ...context,
      courierPartner: tracking.courierPartner,
      trackingNumber: tracking.trackingNumber,
      trackingUrl: tracking.trackingUrl,
    };
  }

  const [emailOutcome, whatsappOutcome] = await Promise.all([
    executeEmailChannel({
      order,
      eventType,
      context: enrichedContext,
      retryDelayMs: options?.retryDelayMs,
    }).catch((err: any): ChannelDispatchOutcome => ({
      channel: 'EMAIL',
      attempted: true,
      sent: false,
      error: err?.message || 'Unexpected email dispatch error',
    })),
    executeWhatsAppChannel({
      order,
      eventType,
      context: enrichedContext,
      retryDelayMs: options?.retryDelayMs,
    }).catch((err: any): ChannelDispatchOutcome => ({
      channel: 'WHATSAPP',
      attempted: true,
      sent: false,
      error: err?.message || 'Unexpected WhatsApp dispatch error',
    })),
  ]);

  if (!emailOutcome.sent && !emailOutcome.skippedDuplicate && emailOutcome.error) {
    console.warn(
      `[OrderNotifications] EMAIL ${eventType} for ${order.orderNumber} did not send: ${emailOutcome.error}`
    );
  }
  if (
    !whatsappOutcome.sent &&
    !whatsappOutcome.skippedDuplicate &&
    !whatsappOutcome.skippedNoConsent &&
    whatsappOutcome.error
  ) {
    console.warn(
      `[OrderNotifications] WHATSAPP ${eventType} for ${order.orderNumber} did not send: ${whatsappOutcome.error}`
    );
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    eventType,
    email: emailOutcome,
    whatsapp: whatsappOutcome,
  };
}

/**
 * Non-blocking post-commit trigger used by order, payment, cancellation, and shipping flows.
 * Guarantees provider failures can NEVER roll back or delay core commerce commits.
 */
export function dispatchOrderNotificationSafe(
  eventType: OrderNotificationEventType,
  context: OrderNotificationContext,
  options?: { retryDelayMs?: number; respectDispatchSetting?: boolean }
): void {
  const task = Promise.resolve()
    .then(() => dispatchOrderNotification(eventType, context, options))
    .catch((err: any) => {
      console.warn(
        `[OrderNotifications] Non-blocking ${eventType} dispatch warning for order ${context.order?.orderNumber || context.order?.id}:`,
        err?.message || err
      );
    });

  pendingDispatches.add(task);
  task.finally(() => {
    pendingDispatches.delete(task);
  });
}

export async function waitForPendingOrderNotifications(): Promise<void> {
  while (pendingDispatches.size > 0) {
    await Promise.allSettled(Array.from(pendingDispatches));
  }
}

export async function getOrderNotificationDeliveries(orderId: string): Promise<OrderDeliveryRecord[]> {
  const prisma = getPrismaClient();
  if (prisma?.notificationDelivery) {
    try {
      const rows = await prisma.notificationDelivery.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map(mapPrismaDelivery);
    } catch {}
  }
  return fallbackStore.listByOrderId(orderId);
}

/**
 * Safely retries a single FAILED order notification delivery using the same idempotencyKey.
 * Refuses to retry deliveries that are already SENT, DELIVERED, READ, SENDING, or CANCELLED.
 */
export async function retryFailedOrderNotification(
  deliveryId: string,
  options?: { retryDelayMs?: number }
): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  outcome?: ChannelDispatchOutcome;
}> {
  const prisma = getPrismaClient();
  let delivery: OrderDeliveryRecord | null = null;
  let storage: 'prisma' | 'fallback' = 'fallback';

  if (prisma?.notificationDelivery) {
    try {
      const row = await prisma.notificationDelivery.findUnique({ where: { id: deliveryId } });
      if (row) {
        delivery = mapPrismaDelivery(row);
        storage = 'prisma';
      }
    } catch {}
  }
  if (!delivery) {
    delivery = fallbackStore.findById(deliveryId);
    storage = 'fallback';
  }

  if (!delivery) {
    return { success: false, reason: 'Notification delivery record not found.' };
  }

  if (delivery.status !== 'FAILED') {
    return {
      success: false,
      skipped: true,
      reason: `Cannot retry delivery in "${delivery.status}" status (only FAILED deliveries can be retried).`,
    };
  }

  if (!delivery.orderId) {
    return { success: false, reason: 'Delivery record is not associated with an order.' };
  }

  const order = await orderRepository.findById(delivery.orderId);
  if (!order) {
    return { success: false, reason: 'Associated order could not be found.' };
  }

  let parsedMeta: Record<string, any> = {};
  if (delivery.metadataJson) {
    try {
      parsedMeta = JSON.parse(delivery.metadataJson) || {};
    } catch {}
  }

  const tracking = await resolveOrderTrackingDetails(order, {
    courierPartner: parsedMeta.courierPartner || undefined,
    trackingNumber: parsedMeta.trackingNumber || undefined,
    trackingUrl: parsedMeta.trackingUrl || undefined,
  });

  const context: OrderNotificationContext = {
    order,
    cancellationReason: parsedMeta.cancellationReason || order.cancellationReason,
    courierPartner: tracking.courierPartner,
    trackingNumber: tracking.trackingNumber,
    trackingUrl: tracking.trackingUrl,
  };

  const existingDelivery = {
    id: delivery.id,
    storage,
    idempotencyKey: delivery.idempotencyKey,
  };

  const outcome =
    delivery.channel === 'EMAIL'
      ? await executeEmailChannel({
          order,
          eventType: delivery.eventType,
          context,
          existingDelivery,
          retryDelayMs: options?.retryDelayMs,
        })
      : await executeWhatsAppChannel({
          order,
          eventType: delivery.eventType,
          context,
          existingDelivery,
          retryDelayMs: options?.retryDelayMs,
        });

  return {
    success: outcome.sent,
    reason: outcome.error,
    outcome,
  };
}

export async function retryFailedOrderNotificationsForOrder(
  orderId: string,
  options?: { retryDelayMs?: number }
): Promise<{
  orderId: string;
  retriedCount: number;
  succeededCount: number;
  results: Array<{ deliveryId: string; channel: OrderNotificationChannel; success: boolean; reason?: string }>;
}> {
  const deliveries = await getOrderNotificationDeliveries(orderId);
  const failed = deliveries.filter((d) => d.status === 'FAILED');
  const results: Array<{ deliveryId: string; channel: OrderNotificationChannel; success: boolean; reason?: string }> = [];

  for (const del of failed) {
    const res = await retryFailedOrderNotification(del.id, options);
    results.push({
      deliveryId: del.id,
      channel: del.channel,
      success: res.success,
      reason: res.reason,
    });
  }

  return {
    orderId,
    retriedCount: failed.length,
    succeededCount: results.filter((r) => r.success).length,
    results,
  };
}
