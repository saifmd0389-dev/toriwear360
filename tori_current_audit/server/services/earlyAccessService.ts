import crypto from 'crypto';
import { getPrismaClient } from '../db/prisma';
import {
  buildEarlyAccessEmailTemplates,
  sendResendEmail,
} from './notifications/resendEmailService';
import { sendWhatsAppTemplateMessage } from './notifications/whatsappCloudService';

export class DatabaseUnavailableError extends Error {
  public readonly statusCode = 503;
  public readonly code = 'DATABASE_UNAVAILABLE';
  constructor(message = 'Early Access registration database is temporarily unavailable. Please try again later.') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

export class ValidationError extends Error {
  public readonly statusCode = 400;
  public readonly code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export type EarlyAccessChannel = 'EMAIL' | 'WHATSAPP' | 'BOTH';

export interface RegisterEarlyAccessInput {
  email?: string;
  whatsappNumber?: string;
  channel?: EarlyAccessChannel;
  emailConsent?: boolean;
  whatsappConsent?: boolean;
  registrationSource?: string;
  metadata?: Record<string, unknown>;
  skipAutoConfirmation?: boolean;
}

export interface SubscriberPublicSummary {
  id: string;
  emailMask: string | null;
  whatsappMask: string | null;
  preferredChannel: EarlyAccessChannel;
  emailConsent: boolean;
  emailConsentAt: string | null;
  whatsappConsent: boolean;
  whatsappConsentAt: string | null;
  registrationSource: string;
  status: string;
  couponEligible: boolean;
  createdAt: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export function normalizeEmail(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.length > 190 || !EMAIL_REGEX.test(trimmed)) {
    throw new ValidationError('Please enter a valid email address (e.g. name@example.com).');
  }
  return trimmed;
}

export function normalizeE164Phone(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/[\s\-()]+/g, '');
  if (!cleaned) return null;
  if (!cleaned.startsWith('+')) {
    throw new ValidationError(
      'WhatsApp number must include country code starting with "+" (for example, +919876543210).'
    );
  }
  if (!E164_REGEX.test(cleaned)) {
    throw new ValidationError(
      'WhatsApp number must be a valid international E.164 number (7 to 15 digits with country code, e.g. +919876543210).'
    );
  }
  return cleaned;
}

export function maskEmail(email?: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function maskPhone(phone?: string | null): string | null {
  if (!phone) return null;
  if (phone.length <= 6) return '***';
  const prefix = phone.slice(0, Math.min(3, phone.length - 4));
  const suffix = phone.slice(-4);
  return `${prefix}${'•'.repeat(Math.max(4, phone.length - prefix.length - 4))}${suffix}`;
}

export function getAppBaseUrl(): string {
  return (
    String(process.env.APP_URL || '').trim().replace(/\/+$/, '') ||
    'http://localhost:3000'
  );
}

function getUnsubscribeSecret(): string {
  const configured = String(process.env.UNSUBSCRIBE_TOKEN_SECRET || process.env.SESSION_SECRET || '').trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('UNSUBSCRIBE_TOKEN_SECRET is required in production.');
  }
  return 'toriwear-dev-unsubscribe-secret-local-only';
}

export function hashUnsubscribeToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSignedUnsubscribeToken(subscriberId: string): {
  token: string;
  tokenHash: string;
} {
  const secret = getUnsubscribeSecret();
  const payload = Buffer.from(
    JSON.stringify({
      sid: subscriberId,
      nonce: crypto.randomBytes(12).toString('hex'),
      iat: Date.now(),
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token = `${payload}.${sig}`;
  return {
    token,
    tokenHash: hashUnsubscribeToken(token),
  };
}

export function verifySignedUnsubscribeToken(token: string): { valid: boolean; subscriberId?: string } {
  const clean = String(token || '').trim();
  const dotIdx = clean.indexOf('.');
  if (dotIdx <= 0) return { valid: false };
  const payload = clean.slice(0, dotIdx);
  const sig = clean.slice(dotIdx + 1);

  try {
    const secret = getUnsubscribeSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length === 0 || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { valid: false };
    }
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded?.sid || typeof decoded.sid !== 'string') {
      return { valid: false };
    }
    return { valid: true, subscriberId: decoded.sid };
  } catch {
    return { valid: false };
  }
}

export function buildUnsubscribeUrl(token: string, channel: 'email' | 'whatsapp' | 'all' = 'all'): string {
  const base = getAppBaseUrl();
  return `${base}/api/v1/early-access/unsubscribe?token=${encodeURIComponent(token)}&channel=${channel}`;
}

export async function assertDatabaseReady(): Promise<any> {
  const prisma = getPrismaClient();
  if (!prisma || !prisma.earlyAccessSubscriber) {
    throw new DatabaseUnavailableError(
      'MySQL database is not connected. Early Access registrations are disabled until DATABASE_URL / DB_HOST credentials are configured.'
    );
  }
  if (typeof prisma.$queryRaw === 'function') {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new DatabaseUnavailableError(
        'MySQL database connection check failed. Unable to store registration safely right now.'
      );
    }
  }
  return prisma;
}

export async function isDatabaseReady(): Promise<boolean> {
  try {
    await assertDatabaseReady();
    return true;
  } catch {
    return false;
  }
}

function toPublicSummary(record: any): SubscriberPublicSummary {
  return {
    id: record.id,
    emailMask: maskEmail(record.email),
    whatsappMask: maskPhone(record.whatsappNumber),
    preferredChannel: record.preferredChannel,
    emailConsent: Boolean(record.emailConsent),
    emailConsentAt: record.emailConsentAt ? new Date(record.emailConsentAt).toISOString() : null,
    whatsappConsent: Boolean(record.whatsappConsent),
    whatsappConsentAt: record.whatsappConsentAt ? new Date(record.whatsappConsentAt).toISOString() : null,
    registrationSource: record.registrationSource,
    status: record.status,
    couponEligible: Boolean(record.couponEligible),
    createdAt: new Date(record.createdAt || Date.now()).toISOString(),
  };
}

export async function registerSubscriber(input: RegisterEarlyAccessInput): Promise<{
  subscriber: SubscriberPublicSummary;
  duplicate: boolean;
  updated: boolean;
  coupon: {
    active: boolean;
    eligible: boolean;
    code?: string;
    description?: string;
    minOrderValue?: number;
    maxDiscount?: number;
  };
  confirmationDeliveries: Array<{ channel: 'EMAIL' | 'WHATSAPP'; status: string; error?: string }>;
}> {
  const email = normalizeEmail(input.email);
  const whatsappNumber = normalizeE164Phone(input.whatsappNumber);

  const requestedChannel: EarlyAccessChannel =
    input.channel ||
    (email && whatsappNumber ? 'BOTH' : whatsappNumber ? 'WHATSAPP' : 'EMAIL');

  if (!email && !whatsappNumber) {
    throw new ValidationError('Please enter at least an email address or a WhatsApp number with country code.');
  }

  if (requestedChannel === 'EMAIL' || requestedChannel === 'BOTH') {
    if (!email) {
      throw new ValidationError('Email address is required when Email notification channel is selected.');
    }
    if (input.emailConsent !== true) {
      throw new ValidationError('Explicit consent is required to receive Email drop notifications.');
    }
  }

  if (requestedChannel === 'WHATSAPP' || requestedChannel === 'BOTH') {
    if (!whatsappNumber) {
      throw new ValidationError('WhatsApp number with country code (e.g. +919876543210) is required when WhatsApp channel is selected.');
    }
    if (input.whatsappConsent !== true) {
      throw new ValidationError('Explicit opt-in consent is required to receive WhatsApp drop notifications.');
    }
  }

  // Fail closed if DB is unavailable — never fake success via memory/localStorage!
  const prisma = await assertDatabaseReady();

  // Check duplicate / existing record by email or WhatsApp number
  let existingByEmail = email
    ? await prisma.earlyAccessSubscriber.findUnique({ where: { email } })
    : null;
  let existingByPhone = whatsappNumber
    ? await prisma.earlyAccessSubscriber.findUnique({ where: { whatsappNumber } })
    : null;

  if (existingByEmail && existingByPhone && existingByEmail.id !== existingByPhone.id) {
    throw new ValidationError(
      'This email and WhatsApp number belong to two separate existing registrations. Please update one channel at a time.'
    );
  }

  const existing = existingByEmail || existingByPhone;
  const now = new Date();
  const registrationSource = String(input.registrationSource || 'MAINTENANCE_SCREEN').trim().slice(0, 100);


  let saved: any;
  let duplicate = false;
  let updated = false;
  let unsubscribeTokenRaw = '';

  if (existing) {
    duplicate = true;
    const nextEmail = email ?? existing.email;
    const nextPhone = whatsappNumber ?? existing.whatsappNumber;
    const nextEmailConsent = email && input.emailConsent === true ? true : Boolean(existing.emailConsent);
    const nextWhatsappConsent = whatsappNumber && input.whatsappConsent === true ? true : Boolean(existing.whatsappConsent);

    const nextPreferredChannel: EarlyAccessChannel =
      nextEmailConsent && nextWhatsappConsent
        ? 'BOTH'
        : nextWhatsappConsent && !nextEmailConsent
          ? 'WHATSAPP'
          : nextEmailConsent && !nextWhatsappConsent
            ? 'EMAIL'
            : requestedChannel;

    const needsUpdate =
      nextEmail !== existing.email ||
      nextPhone !== existing.whatsappNumber ||
      nextEmailConsent !== existing.emailConsent ||
      nextWhatsappConsent !== existing.whatsappConsent ||
      existing.status !== 'ACTIVE' ||
      !existing.unsubscribeTokenHash;

    const generated = createSignedUnsubscribeToken(existing.id);
    unsubscribeTokenRaw = generated.token;

    if (needsUpdate) {
      updated = true;
      saved = await prisma.earlyAccessSubscriber.update({
        where: { id: existing.id },
        data: {
          email: nextEmail,
          whatsappNumber: nextPhone,
          preferredChannel: nextPreferredChannel,
          emailConsent: nextEmailConsent,
          emailConsentAt:
            email && input.emailConsent === true && !existing.emailConsentAt
              ? now
              : existing.emailConsentAt,
          whatsappConsent: nextWhatsappConsent,
          whatsappConsentAt:
            whatsappNumber && input.whatsappConsent === true && !existing.whatsappConsentAt
              ? now
              : existing.whatsappConsentAt,
          status: 'ACTIVE',
          unsubscribedAt: null,
          unsubscribeTokenHash: generated.tokenHash,
          couponEligible: false,
          couponCode: null,
          metadataJson: input.metadata ? JSON.stringify(input.metadata).slice(0, 2000) : existing.metadataJson,
        },
      });
    } else {
      saved = existing;
    }
  } else {
    const newId = `eas_${crypto.randomBytes(10).toString('hex')}`;
    const generated = createSignedUnsubscribeToken(newId);
    unsubscribeTokenRaw = generated.token;

    saved = await prisma.earlyAccessSubscriber.create({
      data: {
        id: newId,
        email: email || null,
        whatsappNumber: whatsappNumber || null,
        preferredChannel: requestedChannel,
        emailConsent: Boolean(email && input.emailConsent === true),
        emailConsentAt: email && input.emailConsent === true ? now : null,
        whatsappConsent: Boolean(whatsappNumber && input.whatsappConsent === true),
        whatsappConsentAt: whatsappNumber && input.whatsappConsent === true ? now : null,
        registrationSource,
        status: 'ACTIVE',
        unsubscribeTokenHash: generated.tokenHash,
        couponCode: null,
        couponEligible: false,
        metadataJson: input.metadata ? JSON.stringify(input.metadata).slice(0, 2000) : null,
      },
    });
  }

  console.info(
    `[EARLY-ACCESS] ${duplicate ? (updated ? 'Updated existing' : 'Duplicate') : 'New'} registration (${saved.id}) channel=${saved.preferredChannel} email=${maskEmail(saved.email) || 'none'} wa=${maskPhone(saved.whatsappNumber) || 'none'}`
  );

  // Best-effort confirmation dispatch when newly registered or newly consented to a channel
  const confirmationDeliveries: Array<{ channel: 'EMAIL' | 'WHATSAPP'; status: string; error?: string }> = [];

  const shouldConfirmEmail =
    !input.skipAutoConfirmation &&
    saved.email &&
    saved.emailConsent &&
    unsubscribeTokenRaw &&
    (!duplicate || (updated && email && !existingByEmail?.emailConsent));

  const shouldConfirmWhatsApp =
    !input.skipAutoConfirmation &&
    saved.whatsappNumber &&
    saved.whatsappConsent &&
    (!duplicate || (updated && whatsappNumber && !existingByPhone?.whatsappConsent));

  if (shouldConfirmEmail && saved.email) {
    const unsubUrl = buildUnsubscribeUrl(unsubscribeTokenRaw, 'email');
    const tmpl = buildEarlyAccessEmailTemplates({
      type: 'CONFIRMATION',
      appUrl: getAppBaseUrl(),
      unsubscribeUrl: unsubUrl,
      couponCode: null,
      couponActive: false,
    });
    const idemKey = `confirm-email:${saved.id}:${Math.floor(now.getTime() / 1000)}`;
    const delivery = await prisma.notificationDelivery.create({
      data: {
        id: `del_${crypto.randomBytes(10).toString('hex')}`,
        subscriberId: saved.id,
        campaignId: null,
        eventType: 'REGISTRATION_CONFIRMATION',
        channel: 'EMAIL',
        recipientMask: maskEmail(saved.email) || '***',
        providerName: 'resend',
        idempotencyKey: idemKey,
        status: 'QUEUED',
      },
    });
    const sendRes = await sendResendEmail({
      to: saved.email,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
      unsubscribeUrl: unsubUrl,
      idempotencyKey: idemKey,
      deliveryId: delivery.id,
      tags: [{ name: 'event_type', value: 'registration_confirmation' }],
    });
    confirmationDeliveries.push({
      channel: 'EMAIL',
      status: sendRes.success ? 'SENT' : 'FAILED',
      error: sendRes.error,
    });
  }

  if (shouldConfirmWhatsApp && saved.whatsappNumber) {
    const confirmTemplate =
      String(process.env.WHATSAPP_CONFIRM_TEMPLATE_NAME || process.env.WHATSAPP_TEMPLATE_NAME || '').trim();
    if (confirmTemplate) {
      const idemKey = `confirm-wa:${saved.id}:${Math.floor(now.getTime() / 1000)}`;
      const delivery = await prisma.notificationDelivery.create({
        data: {
          id: `del_${crypto.randomBytes(10).toString('hex')}`,
          subscriberId: saved.id,
          campaignId: null,
          eventType: 'REGISTRATION_CONFIRMATION',
          channel: 'WHATSAPP',
          recipientMask: maskPhone(saved.whatsappNumber) || '***',
          providerName: 'meta_whatsapp_cloud',
          idempotencyKey: idemKey,
          status: 'QUEUED',
        },
      });
      const sendRes = await sendWhatsAppTemplateMessage({
        toE164: saved.whatsappNumber,
        templateName: confirmTemplate,
        templateLang: process.env.WHATSAPP_TEMPLATE_LANG || 'en',
        deliveryId: delivery.id,
      });
      confirmationDeliveries.push({
        channel: 'WHATSAPP',
        status: sendRes.success ? 'SENT' : 'FAILED',
        error: sendRes.error,
      });
    }
  }

  return {
    subscriber: toPublicSummary(saved),
    duplicate,
    updated,
    coupon: { active: false, eligible: false },
    confirmationDeliveries,
  };
}

export async function unsubscribeByToken(
  token: string,
  channel: 'email' | 'whatsapp' | 'all' = 'all',
  reason?: string
): Promise<{
  success: boolean;
  subscriber?: SubscriberPublicSummary;
  channel: string;
  error?: string;
}> {
  const prisma = await assertDatabaseReady();
  const verified = verifySignedUnsubscribeToken(token);
  if (!verified.valid || !verified.subscriberId) {
    return { success: false, channel, error: 'Invalid or expired unsubscribe token.' };
  }

  const tokenHash = hashUnsubscribeToken(token.trim());
  const subscriber = await prisma.earlyAccessSubscriber.findUnique({
    where: { id: verified.subscriberId },
  });

  if (!subscriber || subscriber.unsubscribeTokenHash !== tokenHash) {
    return { success: false, channel, error: 'Unsubscribe link could not be matched or was rotated.' };
  }

  const nextEmailConsent = channel === 'all' || channel === 'email' ? false : Boolean(subscriber.emailConsent);
  const nextWaConsent = channel === 'all' || channel === 'whatsapp' ? false : Boolean(subscriber.whatsappConsent);
  const allRevoked = !nextEmailConsent && !nextWaConsent;

  const updated = await prisma.earlyAccessSubscriber.update({
    where: { id: subscriber.id },
    data: {
      emailConsent: nextEmailConsent,
      whatsappConsent: nextWaConsent,
      status: allRevoked ? 'UNSUBSCRIBED' : 'ACTIVE',
      unsubscribedAt: allRevoked ? new Date() : subscriber.unsubscribedAt,
      unsubscribeReason: reason ? String(reason).slice(0, 300) : `Customer opted out via ${channel} unsubscribe link`,
    },
  });

  console.info(
    `[EARLY-ACCESS] Unsubscribed subscriber=${updated.id} channel=${channel} emailConsent=${updated.emailConsent} waConsent=${updated.whatsappConsent}`
  );

  return {
    success: true,
    channel,
    subscriber: toPublicSummary(updated),
  };
}

export async function getAdminEarlyAccessStats(): Promise<{
  totalSubscribers: number;
  activeSubscribers: number;
  emailConsented: number;
  whatsappConsented: number;
  bothConsented: number;
  unsubscribedCount: number;
  bouncedCount: number;
  deliveryCounts: Record<string, number>;
  campaignCount: number;
}> {
  const prisma = await assertDatabaseReady();
  const [subscribers, deliveries, campaignCount] = await Promise.all([
    prisma.earlyAccessSubscriber.findMany({
      select: {
        status: true,
        emailConsent: true,
        whatsappConsent: true,
      },
    }),
    prisma.notificationDelivery.findMany({
      select: { status: true },
    }),
    prisma.notificationCampaign.count(),
  ]);

  let activeSubscribers = 0;
  let emailConsented = 0;
  let whatsappConsented = 0;
  let bothConsented = 0;
  let unsubscribedCount = 0;
  let bouncedCount = 0;

  for (const s of subscribers) {
    if (s.status === 'ACTIVE') activeSubscribers += 1;
    if (s.status === 'UNSUBSCRIBED') unsubscribedCount += 1;
    if (s.status === 'BOUNCED') bouncedCount += 1;
    if (s.status === 'ACTIVE' && s.emailConsent) emailConsented += 1;
    if (s.status === 'ACTIVE' && s.whatsappConsent) whatsappConsented += 1;
    if (s.status === 'ACTIVE' && s.emailConsent && s.whatsappConsent) bothConsented += 1;
  }

  const deliveryCounts: Record<string, number> = {
    PENDING: 0,
    QUEUED: 0,
    SENDING: 0,
    SENT: 0,
    DELIVERED: 0,
    READ: 0,
    FAILED: 0,
  };
  for (const d of deliveries) {
    const key = String(d.status || 'PENDING');
    deliveryCounts[key] = (deliveryCounts[key] || 0) + 1;
  }

  return {
    totalSubscribers: subscribers.length,
    activeSubscribers,
    emailConsented,
    whatsappConsented,
    bothConsented,
    unsubscribedCount,
    bouncedCount,
    deliveryCounts,
    campaignCount,
  };
}

export async function listSubscribersAdmin(params: {
  search?: string;
  channel?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}): Promise<{
  items: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const prisma = await assertDatabaseReady();
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(params.limit) || 25));

  const where: any = {};
  if (params.status && params.status !== 'ALL') {
    where.status = params.status.toUpperCase();
  }
  if (params.channel && params.channel !== 'ALL') {
    const ch = params.channel.toUpperCase();
    if (ch === 'EMAIL') where.emailConsent = true;
    else if (ch === 'WHATSAPP') where.whatsappConsent = true;
    else if (ch === 'BOTH') where.preferredChannel = 'BOTH';
  }
  if (params.dateFrom || params.dateTo) {
    where.createdAt = {};
    if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
  }
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    where.OR = [
      { email: { contains: q } },
      { whatsappNumber: { contains: q } },
      { registrationSource: { contains: q } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.earlyAccessSubscriber.count({ where }),
    prisma.earlyAccessSubscriber.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        whatsappNumber: true,
        preferredChannel: true,
        emailConsent: true,
        emailConsentAt: true,
        whatsappConsent: true,
        whatsappConsentAt: true,
        registrationSource: true,
        status: true,
        couponCode: true,
        couponEligible: true,
        couponRedeemedAt: true,
        lastNotifiedAt: true,
        unsubscribedAt: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    items: rows,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  // Neutralize CSV formula injection (Excel / Google Sheets =, +, -, @, tab, CR)
  const neutralized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export async function exportSubscribersCsvAdmin(params: {
  search?: string;
  channel?: string;
  status?: string;
}): Promise<string> {
  const res = await listSubscribersAdmin({
    search: params.search,
    channel: params.channel,
    status: params.status,
    page: 1,
    limit: 10000,
  });

  const headers = [
    'ID',
    'Email',
    'WhatsAppNumber',
    'PreferredChannel',
    'EmailConsent',
    'EmailConsentAt',
    'WhatsAppConsent',
    'WhatsAppConsentAt',
    'RegistrationSource',
    'Status',
    'CouponCode',
    'CouponEligible',
    'CreatedAt',
    'LastNotifiedAt',
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of res.items) {
    lines.push(
      [
        row.id,
        row.email || '',
        row.whatsappNumber || '',
        row.preferredChannel,
        row.emailConsent ? 'YES' : 'NO',
        row.emailConsentAt ? new Date(row.emailConsentAt).toISOString() : '',
        row.whatsappConsent ? 'YES' : 'NO',
        row.whatsappConsentAt ? new Date(row.whatsappConsentAt).toISOString() : '',
        row.registrationSource,
        row.status,
        row.couponCode || '',
        row.couponEligible ? 'YES' : 'NO',
        row.createdAt ? new Date(row.createdAt).toISOString() : '',
        row.lastNotifiedAt ? new Date(row.lastNotifiedAt).toISOString() : '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return lines.join('\r\n');
}
