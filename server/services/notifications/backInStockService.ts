import crypto from 'crypto';
import {
  backInStockRepository,
  BackInStockSubscriptionRecord,
  BackInStockSubscriptionStatus,
  WhatsAppChannelStatus,
  WebsiteChannelStatus,
  BrowserPushChannelStatus,
  EmailChannelStatus,
} from '../../repositories/backInStockRepository';
import { productRepository } from '../../repositories/productRepository';
import { inventoryRepository } from '../../repositories/inventoryRepository';
import { sendWhatsAppTemplateMessage } from './whatsappCloudService';
import { sendResendEmail } from './resendEmailService';
import {
  buildBackInStockEmail,
  buildBackInStockWebsiteNotification,
  getBackInStockWhatsAppTemplateHealth,
  normalizeBackInStockPhoneToE164,
  resolveBackInStockWhatsAppTemplate,
} from './backInStockTemplates';

export interface SubscribeBackInStockInput {
  productId: string;
  variantId?: string;
  size: string;
  color?: string;
  customerId?: string | null;
  customerName?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsappConsent: boolean;
  websiteEnabled?: boolean;
  browserPushEnabled?: boolean;
  emailBackupEnabled?: boolean;
}

export interface ChannelDispatchResult {
  channel: 'WHATSAPP' | 'WEBSITE' | 'BROWSER_PUSH' | 'EMAIL';
  priority: 1 | 2 | 3;
  attempted: boolean;
  succeeded: boolean;
  status: string;
  skippedDuplicate?: boolean;
  reason?: string;
  providerMessageId?: string | null;
  notificationId?: string | null;
}

export interface BackInStockDispatchSummary {
  subscriptionId: string;
  variantId: string;
  productId: string;
  size: string;
  color: string;
  batchId: string;
  executionOrder: Array<'WHATSAPP' | 'WEBSITE' | 'EMAIL'>;
  whatsapp: ChannelDispatchResult;
  website: ChannelDispatchResult;
  browserPush: ChannelDispatchResult;
  email: ChannelDispatchResult;
  finalStatus: BackInStockSubscriptionStatus;
}

export class BackInStockValidationError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'BackInStockValidationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const subscriptionLocks = new Map<string, Promise<void>>();
const pendingBackInStockJobs = new Set<Promise<unknown>>();

async function withSubscriptionLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  while (subscriptionLocks.has(key)) {
    await subscriptionLocks.get(key);
  }
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  subscriptionLocks.set(key, gate);
  try {
    return await fn();
  } finally {
    subscriptionLocks.delete(key);
    release();
  }
}

function isValidEmail(email?: string | null): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function maskEmail(email?: string | null): string | null {
  if (!email) return null;
  const clean = String(email).trim().toLowerCase();
  const [local, domain] = clean.split('@');
  if (!local || !domain) return '***';
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export function maskPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d]/g, '');
  if (digits.length < 4) return '***';
  return `+${digits.slice(0, 2)}****${digits.slice(-4)}`;
}

function isTerminalSuccessStatus(status: string): boolean {
  return status === 'SENT' || status === 'DELIVERED' || status === 'READ';
}

async function resolveExactVariant(input: {
  productId: string;
  variantId?: string;
  size: string;
  color?: string;
}): Promise<{
  product: any;
  variant: any;
  availableStock: number;
}> {
  const product = await productRepository.findById(String(input.productId || '').trim());
  if (!product) {
    throw new BackInStockValidationError('Selected product was not found.', 404, 'PRODUCT_NOT_FOUND');
  }

  const variants: any[] = Array.isArray(product.variants) ? product.variants : [];
  const requestedVariantId = String(input.variantId || '').trim();
  const requestedSize = String(input.size || '').trim().toUpperCase();
  const requestedColor = String(input.color || '').trim().toLowerCase();

  let matchedVariant: any = null;

  if (requestedVariantId) {
    matchedVariant = variants.find((v) => String(v.id) === requestedVariantId) || null;
  }

  if (!matchedVariant && requestedSize) {
    if (requestedColor) {
      matchedVariant =
        variants.find(
          (v) =>
            String(v.size || '').trim().toUpperCase() === requestedSize &&
            String(v.colorName || v.color || '').trim().toLowerCase() === requestedColor
        ) || null;
    }
    if (!matchedVariant) {
      matchedVariant =
        variants.find((v) => String(v.size || '').trim().toUpperCase() === requestedSize) || null;
    }
  }

  if (!matchedVariant) {
    throw new BackInStockValidationError(
      `Exact variant (${input.size}${input.color ? ` / ${input.color}` : ''}) was not found for this product.`,
      404,
      'VARIANT_NOT_FOUND'
    );
  }

  const invRecord = await inventoryRepository.getByVariantId(matchedVariant.id).catch(() => null);
  const availableStock = invRecord
    ? Number(invRecord.quantityAvailable ?? Math.max(0, Number(invRecord.quantityOnHand || 0) - Number(invRecord.quantityReserved || 0)))
    : Number(matchedVariant.stock ?? 0);

  return {
    product,
    variant: matchedVariant,
    availableStock,
  };
}

/**
 * Subscribe a customer (authenticated or guest) to an EXACT out-of-stock variant.
 * Strict priority:
 *   1. WhatsApp (PRIMARY — requires explicit whatsappConsent === true; never inferred from having a phone number)
 *   2. Website Notification (SECONDARY — automatically enabled when customer identity is available)
 *   3. Email (BACKUP — optional fallback)
 * Never uses SMS.
 */
export async function subscribeToBackInStock(input: SubscribeBackInStockInput): Promise<{
  subscription: BackInStockSubscriptionRecord;
  alreadySubscribed: boolean;
}> {
  const { product, variant, availableStock } = await resolveExactVariant({
    productId: input.productId,
    variantId: input.variantId,
    size: input.size,
    color: input.color,
  });

  if (availableStock > 0) {
    throw new BackInStockValidationError(
      `${product.name} (Size ${variant.size} · ${variant.colorName || variant.color || 'Original'}) is currently in stock and ready to order!`,
      409,
      'VARIANT_ALREADY_IN_STOCK'
    );
  }

  const normalizedPhone = input.phone ? normalizeBackInStockPhoneToE164(input.phone) : null;
  if (input.phone && !normalizedPhone) {
    throw new BackInStockValidationError(
      'Please enter a valid 10-digit mobile number (or include country code) for WhatsApp alerts.',
      400,
      'INVALID_PHONE'
    );
  }

  const cleanEmail = input.email ? String(input.email).trim().toLowerCase() : null;
  if (cleanEmail && !isValidEmail(cleanEmail)) {
    throw new BackInStockValidationError('Please enter a valid backup email address.', 400, 'INVALID_EMAIL');
  }

  // Explicit WhatsApp consent rule: NEVER infer consent from mobile number presence
  const whatsappConsent = input.whatsappConsent === true;
  if (whatsappConsent && !normalizedPhone) {
    throw new BackInStockValidationError(
      'A valid mobile number is required to enable WhatsApp back-in-stock alerts.',
      400,
      'WHATSAPP_PHONE_REQUIRED'
    );
  }

  const hasCustomerAccount = Boolean(input.customerId);
  const websiteEnabled = input.websiteEnabled !== undefined ? Boolean(input.websiteEnabled) : hasCustomerAccount;
  const browserPushEnabled = Boolean(websiteEnabled && input.browserPushEnabled);
  const emailBackupEnabled =
    input.emailBackupEnabled !== undefined ? Boolean(input.emailBackupEnabled && cleanEmail) : Boolean(cleanEmail && !whatsappConsent && !websiteEnabled);

  if (input.emailBackupEnabled && !cleanEmail) {
    throw new BackInStockValidationError(
      'Please provide a valid email address if you enable backup email notifications.',
      400,
      'EMAIL_REQUIRED_FOR_BACKUP'
    );
  }

  // Ensure at least one eligible delivery channel exists
  const hasAnyActiveChannel = Boolean(
    (whatsappConsent && normalizedPhone) ||
      (websiteEnabled && (hasCustomerAccount || normalizedPhone || cleanEmail)) ||
      (emailBackupEnabled && cleanEmail)
  );

  if (!hasAnyActiveChannel) {
    throw new BackInStockValidationError(
      'Please grant WhatsApp consent with your mobile number, sign in for website notifications, or provide a backup email.',
      400,
      'NO_NOTIFICATION_CHANNEL'
    );
  }

  const variantColor = String(variant.colorName || variant.color || input.color || 'Original').trim();
  const primaryImage =
    Array.isArray(product.images) && product.images.length > 0
      ? typeof product.images[0] === 'string'
        ? product.images[0]
        : product.images[0]?.url || null
      : null;

  // Deduplicate active subscriptions for the same exact variant & subscriber
  const existing = await backInStockRepository.findActiveDuplicate({
    variantId: variant.id,
    customerId: input.customerId || null,
    phoneE164: normalizedPhone,
    email: cleanEmail,
  });

  if (existing) {
    const mergedWhatsappConsent = whatsappConsent || existing.whatsappConsent;
    const mergedPhone = normalizedPhone || existing.phoneE164;
    const mergedEmail = cleanEmail || existing.email;
    const mergedWebsiteEnabled = websiteEnabled || existing.websiteEnabled;
    const mergedBrowserPush = browserPushEnabled || existing.browserPushEnabled;
    const mergedEmailBackup = emailBackupEnabled || existing.emailBackupEnabled;

    const updated = await backInStockRepository.updateSubscription(existing.id, {
      customerId: input.customerId || existing.customerId,
      customerName: input.customerName || existing.customerName,
      phoneE164: mergedPhone,
      email: mergedEmail,
      whatsappConsent: Boolean(mergedWhatsappConsent && mergedPhone),
      whatsappConsentAt:
        whatsappConsent && !existing.whatsappConsentAt ? new Date() : existing.whatsappConsentAt,
      websiteEnabled: mergedWebsiteEnabled,
      browserPushEnabled: mergedBrowserPush,
      emailBackupEnabled: Boolean(mergedEmailBackup && mergedEmail),
      whatsappStatus: mergedWhatsappConsent && mergedPhone ? 'PENDING' : 'SKIPPED',
      websiteStatus: mergedWebsiteEnabled ? 'PENDING' : 'SKIPPED',
      browserPushStatus: mergedBrowserPush ? 'PENDING' : 'SKIPPED',
      emailStatus: mergedEmailBackup && mergedEmail ? 'PENDING' : 'SKIPPED',
    });

    return {
      subscription: updated || existing,
      alreadySubscribed: true,
    };
  }

  const created = await backInStockRepository.createSubscription({
    productId: product.id,
    productName: product.name,
    productSlug: product.slug || product.id,
    productImage: primaryImage,
    variantId: variant.id,
    sku: variant.sku || null,
    size: String(variant.size),
    color: variantColor,
    customerId: input.customerId || null,
    customerName: input.customerName || null,
    phoneE164: normalizedPhone,
    email: cleanEmail,
    whatsappConsent,
    whatsappConsentAt: whatsappConsent ? new Date() : null,
    websiteEnabled,
    browserPushEnabled,
    emailBackupEnabled: Boolean(emailBackupEnabled && cleanEmail),
    status: 'ACTIVE',
    whatsappStatus: whatsappConsent && normalizedPhone ? 'PENDING' : 'SKIPPED',
    websiteStatus: websiteEnabled ? 'PENDING' : 'SKIPPED',
    browserPushStatus: browserPushEnabled ? 'PENDING' : 'SKIPPED',
    emailStatus: emailBackupEnabled && cleanEmail ? 'PENDING' : 'SKIPPED',
    lastRestockBatchId: null,
    lastFailureSummary: null,
    notifiedAt: null,
  });

  return {
    subscription: created,
    alreadySubscribed: false,
  };
}

/**
 * Dispatches notifications for a single subscription in STRICT CHANNEL PRIORITY ORDER:
 *   1. WhatsApp (PRIMARY)
 *   2. Website Notification (SECONDARY) + Browser Push pending tracking
 *   3. Email (BACKUP)
 *
 * Each channel executes independently with durable idempotency. Failure in one channel
 * NEVER prevents subsequent eligible channels from delivering.
 * When `onlyFailed === true`, skips any channel already marked SENT/DELIVERED/READ.
 */
async function dispatchSubscriptionChannels(
  subscription: BackInStockSubscriptionRecord,
  options: { batchId: string; onlyFailed?: boolean; availableQuantity?: number }
): Promise<BackInStockDispatchSummary> {
  return withSubscriptionLock(`bis-sub:${subscription.id}`, async () => {
    const fresh = (await backInStockRepository.findSubscriptionById(subscription.id)) || subscription;
    const batchId = fresh.lastRestockBatchId || options.batchId;

    if (!fresh.lastRestockBatchId) {
      await backInStockRepository.updateSubscription(fresh.id, { lastRestockBatchId: batchId });
    }

    const payload = {
      subscriptionId: fresh.id,
      customerName: fresh.customerName,
      productId: fresh.productId,
      productName: fresh.productName,
      productSlug: fresh.productSlug,
      productImage: fresh.productImage,
      variantId: fresh.variantId,
      sku: fresh.sku,
      size: fresh.size,
      color: fresh.color,
      availableQuantity: options.availableQuantity,
    };

    const executionOrder: Array<'WHATSAPP' | 'WEBSITE' | 'EMAIL'> = [];
    const failureNotes: string[] = [];

    // =========================================================================
    // PRIORITY 1: WHATSAPP (PRIMARY)
    // =========================================================================
    let nextWhatsappStatus: WhatsAppChannelStatus = fresh.whatsappStatus;
    let whatsappResult: ChannelDispatchResult = {
      channel: 'WHATSAPP',
      priority: 1,
      attempted: false,
      succeeded: isTerminalSuccessStatus(fresh.whatsappStatus),
      status: fresh.whatsappStatus,
    };

    const shouldAttemptWhatsApp = options.onlyFailed
      ? fresh.whatsappStatus === 'FAILED' && fresh.whatsappConsent && Boolean(fresh.phoneE164)
      : !isTerminalSuccessStatus(fresh.whatsappStatus);

    if (shouldAttemptWhatsApp) {
      if (!fresh.whatsappConsent || !fresh.phoneE164) {
        nextWhatsappStatus = 'SKIPPED';
        whatsappResult = {
          channel: 'WHATSAPP',
          priority: 1,
          attempted: false,
          succeeded: false,
          status: 'SKIPPED',
          reason: !fresh.phoneE164
            ? 'No WhatsApp mobile number provided.'
            : 'Explicit WhatsApp consent not granted or revoked via STOP.',
        };
      } else {
        executionOrder.push('WHATSAPP');
        const waIdemKey = `bis:${fresh.id}:${batchId}:WHATSAPP`;
        const existingDel = await backInStockRepository.findDeliveryByIdempotencyKey(waIdemKey);

        if (existingDel && isTerminalSuccessStatus(existingDel.status)) {
          nextWhatsappStatus = existingDel.status as WhatsAppChannelStatus;
          whatsappResult = {
            channel: 'WHATSAPP',
            priority: 1,
            attempted: false,
            succeeded: true,
            skippedDuplicate: true,
            status: existingDel.status,
            providerMessageId: existingDel.providerMessageId,
          };
        } else {
          const tpl = resolveBackInStockWhatsAppTemplate(payload);
          const recipientMask = maskPhone(fresh.phoneE164) || '***';
          let delivery = existingDel;
          if (!delivery) {
            delivery = await backInStockRepository.createDelivery({
              subscriptionId: fresh.id,
              eventType: 'BACK_IN_STOCK',
              channel: 'WHATSAPP',
              recipientMask,
              providerName: 'meta_whatsapp_cloud',
              providerMessageId: null,
              idempotencyKey: waIdemKey,
              status: 'SENDING',
              attemptCount: 1,
              lastAttemptAt: new Date(),
              sentAt: null,
              deliveredAt: null,
              readAt: null,
              failureReason: null,
              providerResponseJson: null,
              metadataJson: JSON.stringify({
                productId: fresh.productId,
                variantId: fresh.variantId,
                size: fresh.size,
                color: fresh.color,
                batchId,
              }),
            });
          } else {
            delivery =
              (await backInStockRepository.updateDelivery(delivery.id, {
                status: 'SENDING',
                attemptCount: delivery.attemptCount + 1,
                lastAttemptAt: new Date(),
                failureReason: null,
              })) || delivery;
          }

          if (!tpl.configured || !tpl.templateName) {
            const reason = tpl.missingReason || 'WhatsApp back-in-stock template is not configured.';
            await backInStockRepository.updateDelivery(delivery.id, {
              status: 'FAILED',
              failureReason: reason,
            });
            nextWhatsappStatus = 'FAILED';
            failureNotes.push(`WhatsApp: ${reason}`);
            whatsappResult = {
              channel: 'WHATSAPP',
              priority: 1,
              attempted: true,
              succeeded: false,
              status: 'FAILED',
              reason,
            };
          } else {
            const waResp = await sendWhatsAppTemplateMessage({
              toE164: fresh.phoneE164,
              templateName: tpl.templateName,
              templateLang: tpl.templateLang,
              bodyParameters: tpl.bodyParameters,
              allowDefaultTemplateFallback: false,
            });

            if (waResp.success && waResp.providerMessageId) {
              await backInStockRepository.updateDelivery(delivery.id, {
                status: 'SENT',
                providerMessageId: waResp.providerMessageId,
                sentAt: new Date(),
                failureReason: null,
                providerResponseJson: waResp.rawResponse ? JSON.stringify(waResp.rawResponse) : null,
              });
              nextWhatsappStatus = 'SENT';
              whatsappResult = {
                channel: 'WHATSAPP',
                priority: 1,
                attempted: true,
                succeeded: true,
                status: 'SENT',
                providerMessageId: waResp.providerMessageId,
              };
            } else {
              const reason = waResp.error || 'WhatsApp delivery failed.';
              await backInStockRepository.updateDelivery(delivery.id, {
                status: 'FAILED',
                failureReason: reason,
                providerResponseJson: waResp.rawResponse ? JSON.stringify(waResp.rawResponse) : null,
              });
              nextWhatsappStatus = 'FAILED';
              failureNotes.push(`WhatsApp: ${reason}`);
              whatsappResult = {
                channel: 'WHATSAPP',
                priority: 1,
                attempted: true,
                succeeded: false,
                status: 'FAILED',
                reason,
              };
            }
          }
        }
      }
    }

    // =========================================================================
    // PRIORITY 2: WEBSITE NOTIFICATION (SECONDARY) + BROWSER PUSH STATUS
    // =========================================================================
    let nextWebsiteStatus: WebsiteChannelStatus = fresh.websiteStatus;
    let nextBrowserPushStatus: BrowserPushChannelStatus = fresh.browserPushStatus;
    let websiteResult: ChannelDispatchResult = {
      channel: 'WEBSITE',
      priority: 2,
      attempted: false,
      succeeded: isTerminalSuccessStatus(fresh.websiteStatus),
      status: fresh.websiteStatus,
    };
    let browserPushResult: ChannelDispatchResult = {
      channel: 'BROWSER_PUSH',
      priority: 2,
      attempted: false,
      succeeded: fresh.browserPushStatus === 'DELIVERED',
      status: fresh.browserPushStatus,
    };

    const shouldAttemptWebsite = options.onlyFailed
      ? fresh.websiteStatus === 'FAILED' && fresh.websiteEnabled
      : !isTerminalSuccessStatus(fresh.websiteStatus);

    if (shouldAttemptWebsite) {
      if (!fresh.websiteEnabled || (!fresh.customerId && !fresh.email && !fresh.phoneE164)) {
        nextWebsiteStatus = 'SKIPPED';
        nextBrowserPushStatus = 'SKIPPED';
        websiteResult = {
          channel: 'WEBSITE',
          priority: 2,
          attempted: false,
          succeeded: false,
          status: 'SKIPPED',
          reason: 'Website inbox notifications not enabled for this subscription.',
        };
        browserPushResult = {
          channel: 'BROWSER_PUSH',
          priority: 2,
          attempted: false,
          succeeded: false,
          status: 'SKIPPED',
          reason: 'Website inbox disabled.',
        };
      } else {
        executionOrder.push('WEBSITE');
        const webContent = buildBackInStockWebsiteNotification(payload);
        const webIdemKey = `bis:${fresh.id}:${batchId}:WEBSITE`;
        const desiredBrowserStatus: BrowserPushChannelStatus = fresh.browserPushEnabled ? 'PENDING' : 'SKIPPED';

        try {
          const { record, created } = await backInStockRepository.createCustomerNotificationUnique({
            customerId: fresh.customerId,
            customerEmail: fresh.email,
            customerPhone: fresh.phoneE164,
            subscriptionId: fresh.id,
            type: 'BACK_IN_STOCK',
            title: webContent.title,
            message: webContent.message,
            productId: fresh.productId,
            productSlug: fresh.productSlug,
            productName: fresh.productName,
            productImage: fresh.productImage,
            variantId: fresh.variantId,
            size: fresh.size,
            color: fresh.color,
            actionUrl: webContent.actionUrl,
            isRead: false,
            readAt: null,
            browserPushStatus: desiredBrowserStatus,
            browserPushedAt: null,
            idempotencyKey: webIdemKey,
          });

          nextWebsiteStatus = record.isRead ? 'READ' : 'DELIVERED';
          nextBrowserPushStatus = record.browserPushStatus;
          websiteResult = {
            channel: 'WEBSITE',
            priority: 2,
            attempted: created,
            succeeded: true,
            skippedDuplicate: !created,
            status: nextWebsiteStatus,
            notificationId: record.id,
          };
          browserPushResult = {
            channel: 'BROWSER_PUSH',
            priority: 2,
            attempted: false,
            succeeded: nextBrowserPushStatus === 'DELIVERED',
            status: nextBrowserPushStatus,
            notificationId: record.id,
            reason:
              nextBrowserPushStatus === 'PENDING'
                ? 'Queued for browser notification when customer session is active with permission.'
                : 'Browser notification not enabled by customer.',
          };
        } catch (err: any) {
          const reason = err?.message || 'Failed to persist website notification.';
          nextWebsiteStatus = 'FAILED';
          failureNotes.push(`Website: ${reason}`);
          websiteResult = {
            channel: 'WEBSITE',
            priority: 2,
            attempted: true,
            succeeded: false,
            status: 'FAILED',
            reason,
          };
        }
      }
    }

    // =========================================================================
    // PRIORITY 3: EMAIL (BACKUP)
    // =========================================================================
    let nextEmailStatus: EmailChannelStatus = fresh.emailStatus;
    let emailResult: ChannelDispatchResult = {
      channel: 'EMAIL',
      priority: 3,
      attempted: false,
      succeeded: isTerminalSuccessStatus(fresh.emailStatus),
      status: fresh.emailStatus,
    };

    const shouldAttemptEmail = options.onlyFailed
      ? fresh.emailStatus === 'FAILED' && fresh.emailBackupEnabled && isValidEmail(fresh.email)
      : !isTerminalSuccessStatus(fresh.emailStatus);

    if (shouldAttemptEmail) {
      if (!fresh.emailBackupEnabled || !isValidEmail(fresh.email)) {
        nextEmailStatus = 'SKIPPED';
        emailResult = {
          channel: 'EMAIL',
          priority: 3,
          attempted: false,
          succeeded: false,
          status: 'SKIPPED',
          reason: !fresh.emailBackupEnabled
            ? 'Backup email channel not enabled.'
            : 'No valid backup email address provided.',
        };
      } else {
        executionOrder.push('EMAIL');
        const emailIdemKey = `bis:${fresh.id}:${batchId}:EMAIL`;
        const existingDel = await backInStockRepository.findDeliveryByIdempotencyKey(emailIdemKey);

        if (existingDel && isTerminalSuccessStatus(existingDel.status)) {
          nextEmailStatus = (existingDel.status === 'READ' ? 'DELIVERED' : existingDel.status) as EmailChannelStatus;
          emailResult = {
            channel: 'EMAIL',
            priority: 3,
            attempted: false,
            succeeded: true,
            skippedDuplicate: true,
            status: nextEmailStatus,
            providerMessageId: existingDel.providerMessageId,
          };
        } else {
          const recipientMask = maskEmail(fresh.email) || '***';
          let delivery = existingDel;
          if (!delivery) {
            delivery = await backInStockRepository.createDelivery({
              subscriptionId: fresh.id,
              eventType: 'BACK_IN_STOCK',
              channel: 'EMAIL',
              recipientMask,
              providerName: 'resend',
              providerMessageId: null,
              idempotencyKey: emailIdemKey,
              status: 'SENDING',
              attemptCount: 1,
              lastAttemptAt: new Date(),
              sentAt: null,
              deliveredAt: null,
              readAt: null,
              failureReason: null,
              providerResponseJson: null,
              metadataJson: JSON.stringify({
                productId: fresh.productId,
                variantId: fresh.variantId,
                size: fresh.size,
                color: fresh.color,
                batchId,
              }),
            });
          } else {
            delivery =
              (await backInStockRepository.updateDelivery(delivery.id, {
                status: 'SENDING',
                attemptCount: delivery.attemptCount + 1,
                lastAttemptAt: new Date(),
                failureReason: null,
              })) || delivery;
          }

          const emailContent = buildBackInStockEmail(payload);
          const emailResp = await sendResendEmail({
            to: fresh.email!,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
            idempotencyKey: emailIdemKey,
            tags: [
              { name: 'event', value: 'back_in_stock' },
              { name: 'variant_id', value: fresh.variantId },
            ],
          });

          if (emailResp.success && emailResp.providerMessageId) {
            await backInStockRepository.updateDelivery(delivery.id, {
              status: 'SENT',
              providerMessageId: emailResp.providerMessageId,
              sentAt: new Date(),
              failureReason: null,
              providerResponseJson: emailResp.rawResponse ? JSON.stringify(emailResp.rawResponse) : null,
            });
            nextEmailStatus = 'SENT';
            emailResult = {
              channel: 'EMAIL',
              priority: 3,
              attempted: true,
              succeeded: true,
              status: 'SENT',
              providerMessageId: emailResp.providerMessageId,
            };
          } else {
            const reason = emailResp.error || 'Backup email delivery failed.';
            await backInStockRepository.updateDelivery(delivery.id, {
              status: 'FAILED',
              failureReason: reason,
              providerResponseJson: emailResp.rawResponse ? JSON.stringify(emailResp.rawResponse) : null,
            });
            nextEmailStatus = 'FAILED';
            failureNotes.push(`Email: ${reason}`);
            emailResult = {
              channel: 'EMAIL',
              priority: 3,
              attempted: true,
              succeeded: false,
              status: 'FAILED',
              reason,
            };
          }
        }
      }
    }

    // Determine subscription lifecycle status cleanly
    const anyFailed =
      nextWhatsappStatus === 'FAILED' ||
      nextWebsiteStatus === 'FAILED' ||
      nextEmailStatus === 'FAILED';

    const finalStatus: BackInStockSubscriptionStatus = anyFailed ? 'PARTIAL_FAILURE' : 'NOTIFIED';

    await backInStockRepository.updateSubscription(fresh.id, {
      status: finalStatus,
      whatsappStatus: nextWhatsappStatus,
      websiteStatus: nextWebsiteStatus,
      browserPushStatus: nextBrowserPushStatus,
      emailStatus: nextEmailStatus,
      lastRestockBatchId: batchId,
      lastFailureSummary: failureNotes.length > 0 ? failureNotes.join(' | ') : null,
      notifiedAt: fresh.notifiedAt || new Date(),
    });

    return {
      subscriptionId: fresh.id,
      variantId: fresh.variantId,
      productId: fresh.productId,
      size: fresh.size,
      color: fresh.color,
      batchId,
      executionOrder,
      whatsapp: whatsappResult,
      website: websiteResult,
      browserPush: browserPushResult,
      email: emailResult,
      finalStatus,
    };
  });
}

/**
 * Triggered ONLY when an exact variant transitions from out-of-stock (<= 0) to back-in-stock (> 0).
 * Never notifies subscribers of other sizes or colors of the same product.
 */
export async function handleVariantBackInStock(
  variantId: string,
  previousAvailable: number,
  newAvailable: number
): Promise<BackInStockDispatchSummary[]> {
  if (!(previousAvailable <= 0 && newAvailable > 0)) {
    return [];
  }

  const cleanVariantId = String(variantId || '').trim();
  if (!cleanVariantId) return [];

  const activeSubscribers = await backInStockRepository.findActiveByVariantId(cleanVariantId);
  if (activeSubscribers.length === 0) return [];

  const batchId = `rstk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const results: BackInStockDispatchSummary[] = [];

  for (const sub of activeSubscribers) {
    try {
      const summary = await dispatchSubscriptionChannels(sub, {
        batchId,
        onlyFailed: false,
        availableQuantity: newAvailable,
      });
      results.push(summary);
    } catch (err: any) {
      console.error(`[BACK-IN-STOCK] Dispatch error for subscription ${sub.id}:`, err?.message || err);
    }
  }

  return results;
}

/**
 * Non-blocking post-commit wrapper invoked by inventoryRepository on 0 -> >0 stock transitions.
 * Never throws or disrupts stock mutation callers.
 */
export function triggerVariantBackInStockSafe(
  variantId: string,
  previousAvailable: number,
  newAvailable: number
): void {
  if (!(previousAvailable <= 0 && newAvailable > 0)) return;
  const job = handleVariantBackInStock(variantId, previousAvailable, newAvailable).catch((err: any) => {
    console.error(`[BACK-IN-STOCK] Background restock trigger failed for ${variantId}:`, err?.message || err);
  });
  pendingBackInStockJobs.add(job);
  void job.finally(() => {
    pendingBackInStockJobs.delete(job);
  });
}

export async function waitForPendingBackInStockNotifications(): Promise<void> {
  while (pendingBackInStockJobs.size > 0) {
    await Promise.allSettled(Array.from(pendingBackInStockJobs));
  }
}

/**
 * Safely retries ONLY failed channels for a subscription without re-sending already succeeded channels.
 */
export async function retryFailedBackInStockSubscription(
  subscriptionId: string
): Promise<BackInStockDispatchSummary> {
  const sub = await backInStockRepository.findSubscriptionById(subscriptionId);
  if (!sub) {
    throw new BackInStockValidationError('Back-in-stock subscription not found.', 404, 'NOT_FOUND');
  }

  const hasFailed =
    sub.whatsappStatus === 'FAILED' ||
    sub.websiteStatus === 'FAILED' ||
    sub.emailStatus === 'FAILED';

  if (!hasFailed) {
    throw new BackInStockValidationError(
      'No failed notification channels to retry for this subscription.',
      400,
      'NOTHING_TO_RETRY'
    );
  }

  const batchId = sub.lastRestockBatchId || `retry_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  return dispatchSubscriptionChannels(sub, {
    batchId,
    onlyFailed: true,
  });
}

export async function cancelCustomerBackInStockSubscription(
  subscriptionId: string,
  identity: { customerId?: string | null; email?: string | null; phoneE164?: string | null }
): Promise<BackInStockSubscriptionRecord> {
  const sub = await backInStockRepository.findSubscriptionById(subscriptionId);
  if (!sub) {
    throw new BackInStockValidationError('Subscription not found.', 404, 'NOT_FOUND');
  }

  const emailLower = identity.email ? String(identity.email).toLowerCase() : null;
  const owns =
    (identity.customerId && sub.customerId === identity.customerId) ||
    (emailLower && sub.email === emailLower) ||
    (identity.phoneE164 && sub.phoneE164 === identity.phoneE164);

  if (!owns) {
    throw new BackInStockValidationError('You do not have permission to cancel this subscription.', 403, 'FORBIDDEN');
  }

  const updated = await backInStockRepository.updateSubscription(sub.id, {
    status: 'CANCELLED',
  });
  return updated || sub;
}

export async function getAdminBackInStockOverview(filter?: {
  status?: string;
  search?: string;
}) {
  const allSubs = await backInStockRepository.listSubscriptions({ limit: 500 });
  const deliveries = await backInStockRepository.listDeliveriesBySubscriptionIds(allSubs.map((s) => s.id));
  const deliveriesBySub = new Map<string, any[]>();
  for (const d of deliveries) {
    const arr = deliveriesBySub.get(d.subscriptionId) || [];
    arr.push(d);
    deliveriesBySub.set(d.subscriptionId, arr);
  }

  // Enrich with current variant stock
  const stockByVariant = new Map<string, number>();
  const uniqueVariantIds = Array.from(new Set(allSubs.map((s) => s.variantId)));
  await Promise.all(
    uniqueVariantIds.map(async (vId) => {
      const inv = await inventoryRepository.getByVariantId(vId).catch(() => null);
      stockByVariant.set(vId, inv ? Number(inv.quantityAvailable || 0) : 0);
    })
  );

  // Demand summary grouped by exact variant
  const demandMap = new Map<
    string,
    {
      variantId: string;
      productId: string;
      productName: string;
      sku: string | null;
      size: string;
      color: string;
      currentStock: number;
      activeWaitlistCount: number;
      notifiedCount: number;
      failedCount: number;
    }
  >();

  for (const s of allSubs) {
    const entry = demandMap.get(s.variantId) || {
      variantId: s.variantId,
      productId: s.productId,
      productName: s.productName,
      sku: s.sku,
      size: s.size,
      color: s.color,
      currentStock: stockByVariant.get(s.variantId) ?? 0,
      activeWaitlistCount: 0,
      notifiedCount: 0,
      failedCount: 0,
    };
    if (s.status === 'ACTIVE') entry.activeWaitlistCount += 1;
    else if (s.status === 'NOTIFIED') entry.notifiedCount += 1;
    else if (s.status === 'PARTIAL_FAILURE') entry.failedCount += 1;
    demandMap.set(s.variantId, entry);
  }

  let filtered = allSubs;
  if (filter?.status && filter.status !== 'ALL') {
    filtered = filtered.filter((s) => s.status === filter.status);
  }
  if (filter?.search) {
    const q = String(filter.search).trim().toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.productName.toLowerCase().includes(q) ||
        s.size.toLowerCase().includes(q) ||
        s.color.toLowerCase().includes(q) ||
        (s.sku || '').toLowerCase().includes(q) ||
        (s.customerName || '').toLowerCase().includes(q)
    );
  }

  const summary = {
    totalSubscriptions: allSubs.length,
    activeWaitlist: allSubs.filter((s) => s.status === 'ACTIVE').length,
    notifiedCount: allSubs.filter((s) => s.status === 'NOTIFIED').length,
    partialFailureCount: allSubs.filter((s) => s.status === 'PARTIAL_FAILURE').length,
    cancelledCount: allSubs.filter((s) => s.status === 'CANCELLED').length,
    uniqueVariantsDemanded: Array.from(demandMap.values()).filter((d) => d.activeWaitlistCount > 0).length,
    channelStats: {
      whatsappSent: allSubs.filter((s) => isTerminalSuccessStatus(s.whatsappStatus)).length,
      whatsappFailed: allSubs.filter((s) => s.whatsappStatus === 'FAILED').length,
      websiteDelivered: allSubs.filter((s) => isTerminalSuccessStatus(s.websiteStatus)).length,
      browserPushDelivered: allSubs.filter((s) => s.browserPushStatus === 'DELIVERED').length,
      emailSent: allSubs.filter((s) => isTerminalSuccessStatus(s.emailStatus)).length,
      emailFailed: allSubs.filter((s) => s.emailStatus === 'FAILED').length,
    },
    whatsappTemplateHealth: getBackInStockWhatsAppTemplateHealth(),
  };

  const subscriptions = filtered.map((s) => ({
    id: s.id,
    productId: s.productId,
    productName: s.productName,
    productSlug: s.productSlug,
    productImage: s.productImage,
    variantId: s.variantId,
    sku: s.sku,
    size: s.size,
    color: s.color,
    currentStock: stockByVariant.get(s.variantId) ?? 0,
    customerName: s.customerName || 'Guest Shopper',
    phoneMask: maskPhone(s.phoneE164),
    emailMask: maskEmail(s.email),
    whatsappConsent: s.whatsappConsent,
    websiteEnabled: s.websiteEnabled,
    browserPushEnabled: s.browserPushEnabled,
    emailBackupEnabled: s.emailBackupEnabled,
    status: s.status,
    whatsappStatus: s.whatsappStatus,
    websiteStatus: s.websiteStatus,
    browserPushStatus: s.browserPushStatus,
    emailStatus: s.emailStatus,
    lastFailureSummary: s.lastFailureSummary,
    notifiedAt: s.notifiedAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    deliveries: (deliveriesBySub.get(s.id) || []).map((d) => ({
      id: d.id,
      channel: d.channel,
      status: d.status,
      providerName: d.providerName,
      providerMessageId: d.providerMessageId,
      attemptCount: d.attemptCount,
      failureReason: d.failureReason,
      sentAt: d.sentAt,
      deliveredAt: d.deliveredAt,
      readAt: d.readAt,
      updatedAt: d.updatedAt,
    })),
  }));

  return {
    summary,
    variantDemand: Array.from(demandMap.values()).sort(
      (a, b) => b.activeWaitlistCount - a.activeWaitlistCount || b.failedCount - a.failedCount
    ),
    subscriptions,
  };
}

// Register deterministic post-commit restock listener on inventoryRepository
inventoryRepository.setBackInStockTransitionHook((variantId, previousAvailable, newAvailable) => {
  triggerVariantBackInStockSafe(variantId, previousAvailable, newAvailable);
});

