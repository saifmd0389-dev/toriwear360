import crypto from 'crypto';
import { couponRepository } from '../../repositories/couponRepository';
import {
  assertDatabaseReady,
  buildUnsubscribeUrl,
  createSignedUnsubscribeToken,
  EarlyAccessChannel,
  getAppBaseUrl,
  hashUnsubscribeToken,
  maskEmail,
  maskPhone,
  normalizeE164Phone,
  normalizeEmail,
  ValidationError,
} from '../earlyAccessService';
import {
  buildEarlyAccessEmailTemplates,
  sendResendEmail,
  verifyResendWebhookSignature,
} from './resendEmailService';
import {
  sendWhatsAppTemplateMessage,
  verifyMetaWebhookSignature,
} from './whatsappCloudService';

export interface CreateCampaignInput {
  name: string;
  campaignType?: string;
  channels: EarlyAccessChannel;
  subject?: string;
  emailHtml?: string;
  emailText?: string;
  whatsappTemplateName?: string;
  whatsappTemplateLang?: string;
  whatsappVariables?: string[];
}

export async function createDraftCampaign(
  input: CreateCampaignInput,
  actorUserId?: string
): Promise<any> {
  const prisma = await assertDatabaseReady();
  const name = String(input.name || '').trim();
  if (!name) {
    throw new ValidationError('Campaign name is required.');
  }
  const channels: EarlyAccessChannel = input.channels || 'BOTH';

  if ((channels === 'EMAIL' || channels === 'BOTH') && !String(input.subject || '').trim()) {
    throw new ValidationError('Email subject is required when Email channel is included.');
  }

  const tmplName =
    String(input.whatsappTemplateName || process.env.WHATSAPP_TEMPLATE_NAME || '').trim() || null;

  const campaign = await prisma.notificationCampaign.create({
    data: {
      id: `camp_${crypto.randomBytes(8).toString('hex')}`,
      name,
      campaignType: String(input.campaignType || 'LAUNCH_ANNOUNCEMENT').trim(),
      subject: input.subject ? String(input.subject).trim() : null,
      emailHtml: input.emailHtml ? String(input.emailHtml) : null,
      emailText: input.emailText ? String(input.emailText) : null,
      whatsappTemplateName: tmplName,
      whatsappTemplateLang:
        String(input.whatsappTemplateLang || process.env.WHATSAPP_TEMPLATE_LANG || 'en').trim() || 'en',
      whatsappVariablesJson: Array.isArray(input.whatsappVariables)
        ? JSON.stringify(input.whatsappVariables.map((v) => String(v)))
        : null,
      channels,
      status: 'DRAFT',
      createdByUserId: actorUserId || null,
    },
  });

  return campaign;
}

export async function listCampaignsAdmin(): Promise<any[]> {
  const prisma = await assertDatabaseReady();
  return prisma.notificationCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function listDeliveriesAdmin(params: {
  campaignId?: string;
  status?: string;
  channel?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: any[]; total: number; page: number; limit: number; totalPages: number }> {
  const prisma = await assertDatabaseReady();
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(params.limit) || 30));

  const where: any = {};
  if (params.campaignId) where.campaignId = params.campaignId;
  if (params.status && params.status !== 'ALL') where.status = params.status.toUpperCase();
  if (params.channel && params.channel !== 'ALL') where.channel = params.channel.toUpperCase();

  const [total, items] = await Promise.all([
    prisma.notificationDelivery.count({ where }),
    prisma.notificationDelivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function sendTestCampaignNotification(params: {
  campaignId: string;
  testEmail?: string;
  testWhatsappNumber?: string;
  actorUserId?: string;
}): Promise<{
  email?: { success: boolean; providerMessageId?: string; error?: string };
  whatsapp?: { success: boolean; providerMessageId?: string; error?: string };
}> {
  const prisma = await assertDatabaseReady();
  const campaign = await prisma.notificationCampaign.findUnique({
    where: { id: params.campaignId },
  });
  if (!campaign) {
    throw new ValidationError('Campaign not found.');
  }

  const testEmail = normalizeEmail(params.testEmail);
  const testPhone = normalizeE164Phone(params.testWhatsappNumber);
  if (!testEmail && !testPhone) {
    throw new ValidationError('Provide a testEmail and/or testWhatsappNumber (+E.164) to send a test notification.');
  }

  const tori100 = await couponRepository.findByCode('TORI100').catch(() => null);
  const couponActive = Boolean(tori100 && tori100.isActive);
  const results: {
    email?: { success: boolean; providerMessageId?: string; error?: string };
    whatsapp?: { success: boolean; providerMessageId?: string; error?: string };
  } = {};

  if (testEmail) {
    const unsubToken = createSignedUnsubscribeToken('test_preview').token;
    const unsubUrl = buildUnsubscribeUrl(unsubToken, 'email');
    const generatedTmpl = buildEarlyAccessEmailTemplates({
      type: 'LAUNCH',
      appUrl: getAppBaseUrl(),
      unsubscribeUrl: unsubUrl,
      subject: `[TEST] ${campaign.subject || 'TORIWEAR Launch Announcement'}`,
      headline: campaign.name,
      bodyText: campaign.emailText || undefined,
      couponCode: couponActive ? 'TORI100' : null,
      couponActive,
    });

    const html = campaign.emailHtml
      ? `${campaign.emailHtml}<p style="font-size:11px;color:#71717a;margin-top:24px;"><a href="${unsubUrl}">Unsubscribe</a></p>`
      : generatedTmpl.html;

    const sendRes = await sendResendEmail({
      to: testEmail,
      subject: generatedTmpl.subject,
      html,
      text: campaign.emailText || generatedTmpl.text,
      unsubscribeUrl: unsubUrl,
      idempotencyKey: `test:${campaign.id}:email:${crypto.randomBytes(6).toString('hex')}`,
      tags: [{ name: 'test_mode', value: 'true' }],
    });
    results.email = {
      success: sendRes.success,
      providerMessageId: sendRes.providerMessageId,
      error: sendRes.error,
    };
  }

  if (testPhone) {
    let vars: string[] = [];
    if (campaign.whatsappVariablesJson) {
      try {
        const parsed = JSON.parse(campaign.whatsappVariablesJson);
        if (Array.isArray(parsed)) vars = parsed.map(String);
      } catch {}
    }

    const sendRes = await sendWhatsAppTemplateMessage({
      toE164: testPhone,
      templateName: campaign.whatsappTemplateName || undefined,
      templateLang: campaign.whatsappTemplateLang || 'en',
      bodyParameters: vars,
    });
    results.whatsapp = {
      success: sendRes.success,
      providerMessageId: sendRes.providerMessageId,
      error: sendRes.error,
    };
  }

  return results;
}

async function ensureSubscriberUnsubscribeToken(prisma: any, subscriber: any): Promise<string> {
  const generated = createSignedUnsubscribeToken(subscriber.id);
  await prisma.earlyAccessSubscriber.update({
    where: { id: subscriber.id },
    data: { unsubscribeTokenHash: generated.tokenHash },
  });
  return generated.token;
}

async function processSingleDelivery(
  prisma: any,
  campaign: any,
  delivery: any,
  subscriber: any,
  couponActive: boolean,
  retryDelayMs?: number
): Promise<'SENT' | 'FAILED' | 'SKIPPED'> {
  if (!subscriber || subscriber.status !== 'ACTIVE') {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'CANCELLED',
        failureReason: `Subscriber status is ${subscriber?.status || 'MISSING'}.`,
      },
    });
    return 'SKIPPED';
  }

  if (delivery.channel === 'EMAIL') {
    if (!subscriber.email || !subscriber.emailConsent) {
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'CANCELLED',
          failureReason: 'Email consent not active or email missing.',
        },
      });
      return 'SKIPPED';
    }

    const unsubToken = await ensureSubscriberUnsubscribeToken(prisma, subscriber);
    const unsubUrl = buildUnsubscribeUrl(unsubToken, 'email');
    const tmpl = buildEarlyAccessEmailTemplates({
      type: 'LAUNCH',
      appUrl: getAppBaseUrl(),
      unsubscribeUrl: unsubUrl,
      subject: campaign.subject || 'THE TORIWEAR VAULT IS NOW LIVE',
      headline: campaign.name,
      bodyText: campaign.emailText || undefined,
      couponCode: couponActive && subscriber.couponEligible ? 'TORI100' : null,
      couponActive: couponActive && Boolean(subscriber.couponEligible),
    });

    const html = campaign.emailHtml
      ? campaign.emailHtml.includes('{{unsubscribe_url}}')
        ? campaign.emailHtml.replace(/\{\{unsubscribe_url\}\}/g, unsubUrl)
        : `${campaign.emailHtml}<hr style="border:none;border-top:1px solid #27272a;margin:24px 0;"/><p style="font-size:11px;color:#71717a;"><a href="${unsubUrl}">Unsubscribe from TORIWEAR emails</a></p>`
      : tmpl.html;

    const res = await sendResendEmail({
      to: subscriber.email,
      subject: tmpl.subject,
      html,
      text: `${campaign.emailText || tmpl.text}\n\nUnsubscribe: ${unsubUrl}`,
      unsubscribeUrl: unsubUrl,
      idempotencyKey: delivery.idempotencyKey,
      deliveryId: delivery.id,
      tags: [{ name: 'campaign_id', value: campaign.id }],
      retryDelayMs,
    });

    if (res.success) {
      await prisma.earlyAccessSubscriber.update({
        where: { id: subscriber.id },
        data: { lastNotifiedAt: new Date() },
      });
      return 'SENT';
    }
    return 'FAILED';
  }

  // WHATSAPP
  if (!subscriber.whatsappNumber || !subscriber.whatsappConsent) {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'CANCELLED',
        failureReason: 'WhatsApp opt-in consent not active or number missing.',
      },
    });
    return 'SKIPPED';
  }

  let bodyParams: string[] = [];
  if (campaign.whatsappVariablesJson) {
    try {
      const parsed = JSON.parse(campaign.whatsappVariablesJson);
      if (Array.isArray(parsed)) bodyParams = parsed.map(String);
    } catch {}
  }

  const res = await sendWhatsAppTemplateMessage({
    toE164: subscriber.whatsappNumber,
    templateName: campaign.whatsappTemplateName || undefined,
    templateLang: campaign.whatsappTemplateLang || 'en',
    bodyParameters: bodyParams,
    deliveryId: delivery.id,
    retryDelayMs,
  });

  if (res.success) {
    await prisma.earlyAccessSubscriber.update({
      where: { id: subscriber.id },
      data: { lastNotifiedAt: new Date() },
    });
    return 'SENT';
  }
  return 'FAILED';
}

export async function refreshCampaignCounters(prisma: any, campaignId: string): Promise<any> {
  const deliveries = await prisma.notificationDelivery.findMany({
    where: { campaignId },
    select: { status: true },
  });

  let sentCount = 0;
  let deliveredCount = 0;
  let failedCount = 0;
  let pendingCount = 0;

  for (const d of deliveries) {
    if (d.status === 'SENT') sentCount += 1;
    else if (d.status === 'DELIVERED' || d.status === 'READ') {
      sentCount += 1;
      deliveredCount += 1;
    } else if (d.status === 'FAILED') failedCount += 1;
    else if (d.status === 'PENDING' || d.status === 'QUEUED' || d.status === 'SENDING') pendingCount += 1;
  }

  const finalStatus =
    pendingCount > 0
      ? 'SENDING'
      : failedCount > 0 && sentCount === 0
        ? 'PARTIAL_FAILURE'
        : failedCount > 0
          ? 'PARTIAL_FAILURE'
          : 'COMPLETED';

  return prisma.notificationCampaign.update({
    where: { id: campaignId },
    data: {
      recipientCount: deliveries.length,
      sentCount,
      deliveredCount,
      failedCount,
      status: finalStatus,
      completedAt: pendingCount === 0 ? new Date() : null,
    },
  });
}

async function runConcurrencyQueue<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      if (current !== undefined) {
        await worker(current);
      }
    }
  });
  await Promise.all(runners);
}

export async function confirmAndDispatchCampaign(params: {
  campaignId: string;
  confirmSend: boolean;
  actorUserId?: string;
  awaitCompletion?: boolean;
  retryDelayMs?: number;
}): Promise<{
  campaign: any;
  queuedCount: number;
}> {
  if (params.confirmSend !== true) {
    throw new ValidationError('Explicit confirmation (confirmSend: true) is required before sending notifications.');
  }

  const prisma = await assertDatabaseReady();
  const campaign = await prisma.notificationCampaign.findUnique({
    where: { id: params.campaignId },
  });
  if (!campaign) {
    throw new ValidationError('Campaign not found.');
  }
  if (campaign.status === 'SENDING') {
    throw new ValidationError('This campaign is already actively dispatching notifications.');
  }
  if (campaign.status === 'COMPLETED') {
    throw new ValidationError('This campaign has already completed. Create a new campaign or use retry-failed if needed.');
  }

  const subscribers = await prisma.earlyAccessSubscriber.findMany({
    where: { status: 'ACTIVE' },
  });

  const wantsEmail = campaign.channels === 'EMAIL' || campaign.channels === 'BOTH';
  const wantsWhatsApp = campaign.channels === 'WHATSAPP' || campaign.channels === 'BOTH';

  const queuedDeliveries: Array<{ delivery: any; subscriber: any }> = [];

  for (const sub of subscribers) {
    if (wantsEmail && sub.email && sub.emailConsent) {
      const idemKey = `${campaign.id}:${sub.id}:EMAIL`;
      const existingDel = await prisma.notificationDelivery.findUnique({
        where: { idempotencyKey: idemKey },
      });
      if (!existingDel) {
        const del = await prisma.notificationDelivery.create({
          data: {
            id: `del_${crypto.randomBytes(10).toString('hex')}`,
            subscriberId: sub.id,
            campaignId: campaign.id,
            eventType: campaign.campaignType || 'LAUNCH_ANNOUNCEMENT',
            channel: 'EMAIL',
            recipientMask: maskEmail(sub.email) || '***',
            providerName: 'resend',
            idempotencyKey: idemKey,
            status: 'QUEUED',
          },
        });
        queuedDeliveries.push({ delivery: del, subscriber: sub });
      }
    }

    if (wantsWhatsApp && sub.whatsappNumber && sub.whatsappConsent) {
      const idemKey = `${campaign.id}:${sub.id}:WHATSAPP`;
      const existingDel = await prisma.notificationDelivery.findUnique({
        where: { idempotencyKey: idemKey },
      });
      if (!existingDel) {
        const del = await prisma.notificationDelivery.create({
          data: {
            id: `del_${crypto.randomBytes(10).toString('hex')}`,
            subscriberId: sub.id,
            campaignId: campaign.id,
            eventType: campaign.campaignType || 'LAUNCH_ANNOUNCEMENT',
            channel: 'WHATSAPP',
            recipientMask: maskPhone(sub.whatsappNumber) || '***',
            providerName: 'meta_whatsapp_cloud',
            idempotencyKey: idemKey,
            status: 'QUEUED',
          },
        });
        queuedDeliveries.push({ delivery: del, subscriber: sub });
      }
    }
  }

  const updatedCampaign = await prisma.notificationCampaign.update({
    where: { id: campaign.id },
    data: {
      status: queuedDeliveries.length > 0 ? 'SENDING' : 'COMPLETED',
      recipientCount: queuedDeliveries.length,
      confirmedByUserId: params.actorUserId || null,
      confirmedAt: new Date(),
      startedAt: new Date(),
      completedAt: queuedDeliveries.length === 0 ? new Date() : null,
    },
  });

  if (queuedDeliveries.length === 0) {
    return { campaign: updatedCampaign, queuedCount: 0 };
  }

  const tori100 = await couponRepository.findByCode('TORI100').catch(() => null);
  const couponActive = Boolean(tori100 && tori100.isActive);

  const dispatchPromise = (async () => {
    try {
      await runConcurrencyQueue(queuedDeliveries, 5, async ({ delivery, subscriber }) => {
        await processSingleDelivery(prisma, updatedCampaign, delivery, subscriber, couponActive, params.retryDelayMs);
      });
      await refreshCampaignCounters(prisma, campaign.id);
    } catch (err: any) {
      console.error(`[CAMPAIGN-WORKER] Batch error for campaign ${campaign.id}:`, err?.message || err);
    }
  })();

  if (params.awaitCompletion) {
    await dispatchPromise;
    const refreshed = await prisma.notificationCampaign.findUnique({ where: { id: campaign.id } });
    return { campaign: refreshed || updatedCampaign, queuedCount: queuedDeliveries.length };
  } else {
    void dispatchPromise;
  }

  return { campaign: updatedCampaign, queuedCount: queuedDeliveries.length };
}

export async function retryFailedCampaignDeliveries(params: {
  campaignId: string;
  awaitCompletion?: boolean;
  retryDelayMs?: number;
}): Promise<{ campaign: any; retriedCount: number }> {
  const prisma = await assertDatabaseReady();
  const campaign = await prisma.notificationCampaign.findUnique({
    where: { id: params.campaignId },
  });
  if (!campaign) {
    throw new ValidationError('Campaign not found.');
  }

  const failedDeliveries = await prisma.notificationDelivery.findMany({
    where: {
      campaignId: campaign.id,
      status: 'FAILED',
    },
  });

  if (failedDeliveries.length === 0) {
    return { campaign, retriedCount: 0 };
  }

  await prisma.notificationCampaign.update({
    where: { id: campaign.id },
    data: { status: 'SENDING', completedAt: null },
  });

  const pairs: Array<{ delivery: any; subscriber: any }> = [];
  for (const del of failedDeliveries) {
    const sub = await prisma.earlyAccessSubscriber.findUnique({
      where: { id: del.subscriberId },
    });
    const updatedDel = await prisma.notificationDelivery.update({
      where: { id: del.id },
      data: { status: 'QUEUED', failureReason: null },
    });
    pairs.push({ delivery: updatedDel, subscriber: sub });
  }

  const tori100 = await couponRepository.findByCode('TORI100').catch(() => null);
  const couponActive = Boolean(tori100 && tori100.isActive);

  const retryPromise = (async () => {
    try {
      await runConcurrencyQueue(pairs, 5, async ({ delivery, subscriber }) => {
        await processSingleDelivery(prisma, campaign, delivery, subscriber, couponActive, params.retryDelayMs);
      });
      await refreshCampaignCounters(prisma, campaign.id);
    } catch (err: any) {
      console.error(`[CAMPAIGN-RETRY] Error retrying failed deliveries for ${campaign.id}:`, err?.message || err);
    }
  })();

  if (params.awaitCompletion) {
    await retryPromise;
    const refreshed = await prisma.notificationCampaign.findUnique({ where: { id: campaign.id } });
    return { campaign: refreshed || campaign, retriedCount: pairs.length };
  } else {
    void retryPromise;
  }

  return { campaign, retriedCount: pairs.length };
}

const DELIVERY_RANK: Record<string, number> = {
  PENDING: 1,
  QUEUED: 2,
  SENDING: 3,
  SENT: 4,
  DELIVERED: 5,
  READ: 6,
};

async function applyMonotonicDeliveryUpdate(params: {
  prisma: any;
  providerMessageId: string;
  targetStatus: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  failureReason?: string;
  rawEvent?: unknown;
}): Promise<boolean> {
  const delivery = await params.prisma.notificationDelivery.findFirst({
    where: { providerMessageId: params.providerMessageId },
  });
  if (!delivery) return false;

  const currentStatus = String(delivery.status || 'PENDING');

  // Monotonic guarantee: never downgrade DELIVERED or READ!
  if (currentStatus === 'DELIVERED' || currentStatus === 'READ') {
    if (params.targetStatus === 'READ' && currentStatus === 'DELIVERED') {
      await params.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'READ', readAt: new Date() },
      });
      return true;
    }
    return false;
  }

  if (params.targetStatus === 'FAILED') {
    await params.prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'FAILED',
        failureReason: params.failureReason || 'Provider reported delivery failure',
        providerResponseJson: params.rawEvent ? JSON.stringify(params.rawEvent).slice(0, 2000) : delivery.providerResponseJson,
      },
    });
  } else {
    const currentRank = DELIVERY_RANK[currentStatus] || 0;
    const nextRank = DELIVERY_RANK[params.targetStatus] || 0;
    if (nextRank <= currentRank) return false;

    await params.prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: params.targetStatus,
        ...(params.targetStatus === 'SENT' ? { sentAt: delivery.sentAt || new Date() } : {}),
        ...(params.targetStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        ...(params.targetStatus === 'READ' ? { deliveredAt: delivery.deliveredAt || new Date(), readAt: new Date() } : {}),
      },
    });
  }

  if (delivery.campaignId) {
    await refreshCampaignCounters(params.prisma, delivery.campaignId);
  }
  if (delivery.subscriptionId) {
    const { backInStockRepository } = await import('../../repositories/backInStockRepository');
    const channel = delivery.channel === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL';
    await backInStockRepository
      .syncWebhookDeliveryStatusToSubscription(
        String(delivery.subscriptionId),
        channel,
        params.targetStatus,
        params.failureReason
      )
      .catch(() => {});
  }
  return true;
}

export async function handleResendWebhook(params: {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
  body: any;
}): Promise<{ statusCode: number; payload: Record<string, unknown> }> {
  const secret = String(process.env.EMAIL_WEBHOOK_SECRET || '').trim();
  const sigCheck = verifyResendWebhookSignature({
    rawBody: params.rawBody,
    headers: params.headers,
    secret,
  });
  if (!sigCheck.valid) {
    return {
      statusCode: 401,
      payload: { success: false, error: sigCheck.reason || 'Unauthorized webhook signature.' },
    };
  }

  const prisma = await assertDatabaseReady();
  const event = params.body || {};
  const eventType = String(event.type || '').toLowerCase();
  const messageId = event?.data?.email_id ? String(event.data.email_id) : null;

  if (!messageId) {
    return { statusCode: 200, payload: { success: true, ignored: true } };
  }

  if (eventType === 'email.sent') {
    await applyMonotonicDeliveryUpdate({ prisma, providerMessageId: messageId, targetStatus: 'SENT', rawEvent: event });
  } else if (eventType === 'email.delivered') {
    await applyMonotonicDeliveryUpdate({ prisma, providerMessageId: messageId, targetStatus: 'DELIVERED', rawEvent: event });
  } else if (eventType === 'email.bounced' || eventType === 'email.delivery_delayed' || eventType === 'email.failed') {
    const reason = event?.data?.bounce?.message || event?.type || 'Email bounced';
    await applyMonotonicDeliveryUpdate({
      prisma,
      providerMessageId: messageId,
      targetStatus: 'FAILED',
      failureReason: String(reason),
      rawEvent: event,
    });
    if (eventType === 'email.bounced') {
      const del = await prisma.notificationDelivery.findFirst({ where: { providerMessageId: messageId } });
      if (del?.subscriberId) {
        await prisma.earlyAccessSubscriber.update({
          where: { id: del.subscriberId },
          data: { status: 'BOUNCED', emailConsent: false },
        }).catch(() => {});
      }
    }
  } else if (eventType === 'email.complained') {
    await applyMonotonicDeliveryUpdate({
      prisma,
      providerMessageId: messageId,
      targetStatus: 'FAILED',
      failureReason: 'Recipient marked message as spam (complained)',
      rawEvent: event,
    });
    const del = await prisma.notificationDelivery.findFirst({ where: { providerMessageId: messageId } });
    if (del?.subscriberId) {
      await prisma.earlyAccessSubscriber.update({
        where: { id: del.subscriberId },
        data: { emailConsent: false, status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
      }).catch(() => {});
    }
  }

  return { statusCode: 200, payload: { success: true, processed: eventType } };
}

const OPT_OUT_KEYWORDS = new Set(['STOP', 'UNSUBSCRIBE', 'CANCEL', 'OPT OUT', 'OPTOUT', 'END', 'QUIT']);

export async function handleWhatsAppWebhook(params: {
  rawBody: string;
  signatureHeader: string;
  body: any;
}): Promise<{ statusCode: number; payload: Record<string, unknown> }> {
  const appSecret = String(process.env.WHATSAPP_APP_SECRET || '').trim();
  const sigCheck = verifyMetaWebhookSignature({
    rawBody: params.rawBody,
    signatureHeader: params.signatureHeader,
    appSecret,
  });
  if (!sigCheck.valid) {
    return {
      statusCode: 401,
      payload: { success: false, error: sigCheck.reason || 'Unauthorized WhatsApp webhook signature.' },
    };
  }

  const prisma = await assertDatabaseReady();
  const entries = Array.isArray(params.body?.entry) ? params.body.entry : [];
  let updatedCount = 0;
  let optOutCount = 0;

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};

      // 1. Outbound delivery statuses (sent -> delivered -> read | failed)
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const st of statuses) {
        const msgId = st?.id ? String(st.id) : null;
        const stName = String(st?.status || '').toLowerCase();
        if (!msgId) continue;

        if (stName === 'sent') {
          if (await applyMonotonicDeliveryUpdate({ prisma, providerMessageId: msgId, targetStatus: 'SENT', rawEvent: st })) updatedCount++;
        } else if (stName === 'delivered') {
          if (await applyMonotonicDeliveryUpdate({ prisma, providerMessageId: msgId, targetStatus: 'DELIVERED', rawEvent: st })) updatedCount++;
        } else if (stName === 'read') {
          if (await applyMonotonicDeliveryUpdate({ prisma, providerMessageId: msgId, targetStatus: 'READ', rawEvent: st })) updatedCount++;
        } else if (stName === 'failed') {
          const errText =
            st?.errors?.[0]?.error_data?.details ||
            st?.errors?.[0]?.title ||
            st?.errors?.[0]?.message ||
            'WhatsApp delivery failed';
          if (
            await applyMonotonicDeliveryUpdate({
              prisma,
              providerMessageId: msgId,
              targetStatus: 'FAILED',
              failureReason: String(errText),
              rawEvent: st,
            })
          ) {
            updatedCount++;
          }
        }
      }

      // 2. Inbound STOP / UNSUBSCRIBE opt-out messages
      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const msg of messages) {
        const fromDigits = String(msg?.from || '').replace(/[^\d]/g, '');
        const textBody = String(msg?.text?.body || msg?.button?.text || '').trim().toUpperCase();
        if (!fromDigits || !OPT_OUT_KEYWORDS.has(textBody)) continue;

        const e164 = `+${fromDigits}`;
        const subscriber = await prisma.earlyAccessSubscriber.findUnique({
          where: { whatsappNumber: e164 },
        });
        if (subscriber) {
          const allRevoked = !subscriber.emailConsent;
          await prisma.earlyAccessSubscriber.update({
            where: { id: subscriber.id },
            data: {
              whatsappConsent: false,
              status: allRevoked ? 'UNSUBSCRIBED' : 'ACTIVE',
              unsubscribedAt: allRevoked ? new Date() : subscriber.unsubscribedAt,
              unsubscribeReason: `WhatsApp inbound keyword: ${textBody}`,
            },
          });
          optOutCount += 1;
          console.info(`[WHATSAPP-WEBHOOK] Revoked WhatsApp consent for ${maskPhone(e164)} via "${textBody}"`);
        }

        // Also revoke transactional WhatsApp opt-in on matching orders so future status alerts respect STOP
        let revokedOther = false;
        if (prisma?.order?.updateMany) {
          const ordRevoke = await prisma.order
            .updateMany({
              where: { whatsappNumber: e164, whatsappOptIn: true },
              data: { whatsappOptIn: false },
            })
            .catch(() => null);
          if (ordRevoke && Number(ordRevoke.count || 0) > 0) {
            revokedOther = true;
            console.info(`[WHATSAPP-WEBHOOK] Revoked order WhatsApp updates for ${maskPhone(e164)} via "${textBody}"`);
          }
        }

        // Also revoke WhatsApp consent on Back-in-Stock subscriptions (both Prisma and local fallback)
        try {
          const { backInStockRepository } = await import('../../repositories/backInStockRepository');
          const bisRevoked = await backInStockRepository.revokeWhatsAppConsentByPhone(e164);
          if (bisRevoked > 0) {
            revokedOther = true;
            console.info(`[WHATSAPP-WEBHOOK] Revoked ${bisRevoked} back-in-stock WhatsApp alert(s) for ${maskPhone(e164)} via "${textBody}"`);
          }
        } catch {}

        if (!subscriber && revokedOther) {
          optOutCount += 1;
        }
      }
    }
  }

  return {
    statusCode: 200,
    payload: { success: true, updatedCount, optOutCount },
  };
}
