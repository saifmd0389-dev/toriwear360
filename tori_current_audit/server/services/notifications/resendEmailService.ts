import crypto from 'crypto';
import { getPrismaClient } from '../../db/prisma';
import { getProviderCredentials } from '../integrationVault';

export interface EmailProviderStatus {
  provider: string;
  configured: boolean;
  fromAddressConfigured: boolean;
  fromAddress: string;
  webhookSecretConfigured: boolean;
  missingVars: string[];
  missing: string[];
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
  idempotencyKey: string;
  deliveryId?: string;
  tags?: Array<{ name: string; value: string }>;
  retryDelayMs?: number;
}

export interface SendEmailResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  configMissing?: boolean;
  attempts: number;
  rawResponse?: unknown;
}

export async function getEmailProviderStatus(): Promise<EmailProviderStatus> {
  const requestedProvider = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  const gmailVault = await getProviderCredentials('gmail');
  const resendVault = await getProviderCredentials('resend');
  const resendApiKey = String(process.env.RESEND_API_KEY || resendVault.apiKey || resendVault.resendApiKey || '').trim();
  const resendFrom = String(process.env.EMAIL_FROM_ADDRESS || resendVault.fromAddress || '').trim();
  const gmailConfigured = Boolean(gmailVault.clientId && gmailVault.clientSecret && gmailVault.refreshToken && gmailVault.userEmail);
  const resendConfigured = Boolean(resendApiKey && resendFrom);
  const provider = requestedProvider === 'gmail' || requestedProvider === 'resend'
    ? requestedProvider
    : resendConfigured ? 'resend' : gmailConfigured ? 'gmail' : 'resend';

  if (provider === 'gmail') {
    const missingVars: string[] = [];
    if (!gmailVault.clientId) missingVars.push('Gmail clientId');
    if (!gmailVault.clientSecret) missingVars.push('Gmail clientSecret');
    if (!gmailVault.refreshToken) missingVars.push('Gmail refreshToken');
    if (!gmailVault.userEmail) missingVars.push('Gmail userEmail');
    return { provider, configured: missingVars.length === 0, fromAddressConfigured: Boolean(gmailVault.userEmail), fromAddress: String(gmailVault.userEmail || ''), webhookSecretConfigured: false, missingVars, missing: missingVars };
  }

  const webhookSecret = String(process.env.EMAIL_WEBHOOK_SECRET || resendVault.webhookSecret || '').trim();
  const missingVars: string[] = [];
  if (!resendApiKey) missingVars.push('RESEND_API_KEY');
  if (!resendFrom) missingVars.push('EMAIL_FROM_ADDRESS');
  return { provider, configured: Boolean(resendApiKey && resendFrom), fromAddressConfigured: Boolean(resendFrom), fromAddress: resendFrom, webhookSecretConfigured: Boolean(webhookSecret), missingVars, missing: missingVars };
}

export function buildEarlyAccessEmailTemplates(params: {
  type: 'CONFIRMATION' | 'LAUNCH';
  appUrl: string;
  unsubscribeUrl: string;
  subject?: string;
  headline?: string;
  bodyText?: string;
  couponCode?: string | null;
  couponActive?: boolean;
}): { subject: string; html: string; text: string } {
  const appUrl = (params.appUrl || 'https://toriwear.com').replace(/\/+$/, '');
  const unsubscribeUrl = params.unsubscribeUrl;
  const safeUnsubscribeHtml = unsubscribeUrl.replace(/"/g, '&quot;');

  const couponSectionHtml =
    params.couponActive && params.couponCode
      ? `<div style="margin:24px 0;padding:16px 20px;border:1px dashed #ef4444;border-radius:12px;background:#160b0e;text-align:center;">
          <div style="font-size:11px;letter-spacing:2px;color:#fca5a5;text-transform:uppercase;font-weight:700;">Early Access Benefit Code</div>
          <div style="margin-top:8px;font-size:24px;letter-spacing:4px;font-weight:900;color:#ffffff;font-family:monospace;">${params.couponCode}</div>
          <div style="margin-top:6px;font-size:12px;color:#d4d4d8;">Subject to active store eligibility, minimum order rules, and per-user limits at checkout.</div>
        </div>`
      : '';

  const couponSectionText =
    params.couponActive && params.couponCode
      ? `\nEarly Access Code: ${params.couponCode} (subject to active eligibility, minimum order, and per-user limits at checkout)\n`
      : '';

  if (params.type === 'CONFIRMATION') {
    const subject = params.subject || 'You’re on the TORIWEAR Priority Access List';
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07070b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07070b;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#111118;border:1px solid #27272a;border-radius:16px;padding:32px;">
          <tr>
            <td>
              <div style="font-size:11px;letter-spacing:3px;color:#ef4444;font-weight:700;text-transform:uppercase;">TORIWEAR PRIORITY ACCESS</div>
              <h1 style="margin:12px 0 8px;font-size:26px;line-height:1.2;color:#ffffff;font-weight:800;">YOUR SPOT IN THE VAULT IS CONFIRMED.</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#a1a1aa;">
                You’ve been registered for the upcoming 240 GSM heavyweight anime streetwear drop. We will message you only for the drop unlock and any priority access notices you consented to receive.
              </p>
              ${couponSectionHtml}
              <div style="margin:24px 0;">
                <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;border-radius:10px;letter-spacing:1px;text-transform:uppercase;">Visit TORIWEAR</a>
              </div>
              <hr style="border:none;border-top:1px solid #27272a;margin:24px 0;" />
              <p style="margin:0;font-size:11px;line-height:1.6;color:#71717a;">
                You received this confirmation because you subscribed on TORIWEAR.<br/>
                Don’t want email drop alerts? <a href="${safeUnsubscribeHtml}" style="color:#a1a1aa;text-decoration:underline;">Unsubscribe from email alerts</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = `TORIWEAR PRIORITY ACCESS — CONFIRMED\n\nYou’re registered for our upcoming 240 GSM heavyweight anime streetwear drop.\n${couponSectionText}\nVisit TORIWEAR: ${appUrl}\n\nUnsubscribe from email alerts anytime: ${unsubscribeUrl}`;
    return { subject, html, text };
  }

  const subject = params.subject || 'THE TORIWEAR VAULT IS NOW LIVE';
  const headline = params.headline || 'THE VAULT HAS UNLOCKED.';
  const bodyCopy =
    params.bodyText ||
    'Our new 240 GSM combed cotton anime streetwear drop is now live. Priority access members get first pick before sizes sell out.';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07070b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07070b;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#111118;border:1px solid #27272a;border-radius:16px;padding:32px;">
          <tr>
            <td>
              <div style="font-size:11px;letter-spacing:3px;color:#ef4444;font-weight:700;text-transform:uppercase;">TORIWEAR DROP ALERT</div>
              <h1 style="margin:12px 0 8px;font-size:26px;line-height:1.2;color:#ffffff;font-weight:800;">${headline.replace(/</g, '&lt;')}</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#d4d4d8;">
                ${bodyCopy.replace(/</g, '&lt;').replace(/\n/g, '<br/>')}
              </p>
              ${couponSectionHtml}
              <div style="margin:24px 0;">
                <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;border-radius:10px;letter-spacing:1px;text-transform:uppercase;">Shop The Drop Now</a>
              </div>
              <hr style="border:none;border-top:1px solid #27272a;margin:24px 0;" />
              <p style="margin:0;font-size:11px;line-height:1.6;color:#71717a;">
                You received this launch notification because you opted in to TORIWEAR Early Access alerts.<br/>
                <a href="${safeUnsubscribeHtml}" style="color:#a1a1aa;text-decoration:underline;">Unsubscribe instantly</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${headline}\n\n${bodyCopy}\n${couponSectionText}\nShop now: ${appUrl}\n\nUnsubscribe instantly: ${unsubscribeUrl}`;
  return { subject, html, text };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getGmailAccessToken(credentials: Record<string, string>): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: credentials.clientId || '', client_secret: credentials.clientSecret || '', refresh_token: credentials.refreshToken || '', grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(12000),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error('Gmail OAuth token refresh failed. Check the OAuth client and refresh token.');
  return String(payload.access_token);
}

function gmailHeader(value: string): string {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function base64Mime(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n').trim();
}

async function sendViaGmail(input: SendEmailInput, credentials: Record<string, string>): Promise<{ id: string; response: unknown }> {
  const accessToken = await getGmailAccessToken(credentials);
  const boundary = `tori_${crypto.randomBytes(12).toString('hex')}`;
  const from = gmailHeader(credentials.userEmail || '');
  const to = gmailHeader(input.to);
  const subject = `=?UTF-8?B?${Buffer.from(gmailHeader(input.subject), 'utf8').toString('base64')}?=`;
  const headers = [
    `From: ${from}`, `To: ${to}`, `Subject: ${subject}`, 'MIME-Version: 1.0',
    `List-Unsubscribe: <${gmailHeader(input.unsubscribeUrl)}>`, 'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    `X-Entity-Ref-ID: ${gmailHeader(input.idempotencyKey)}`, `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (credentials.replyTo) headers.push(`Reply-To: ${gmailHeader(credentials.replyTo)}`);
  const mime = `${headers.join('\r\n')}\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Mime(input.text)}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Mime(input.html)}\r\n--${boundary}--`;
  const raw = Buffer.from(mime, 'utf8').toString('base64url');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }), signal: AbortSignal.timeout(15000),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id) throw new Error(`Gmail send failed (HTTP ${response.status}). Check send scope and sender mailbox.`);
  return { id: String(payload.id), response: { id: payload.id, threadId: payload.threadId, status: response.status } };
}

export async function sendAccountSecurityEmail(input: { to: string; subject: string; html: string; text: string }): Promise<{ success: boolean; error?: string; providerMessageId?: string }> {
  try {
    const status = await getEmailProviderStatus();
    if (!status.configured) return { success: false, error: `${status.provider} is not configured: ${status.missingVars.join(', ')}` };
    if (status.provider === 'gmail') {
      const vault = await getProviderCredentials('gmail');
      const sent = await sendViaGmail({ to: input.to, subject: input.subject, html: input.html, text: input.text, unsubscribeUrl: '', idempotencyKey: `security:${crypto.randomUUID()}` }, vault);
      return { success: true, providerMessageId: sent.id };
    }
    const vault = await getProviderCredentials('resend');
    const apiKey = String(process.env.RESEND_API_KEY || vault.apiKey || vault.resendApiKey || '').trim();
    const from = String(process.env.EMAIL_FROM_ADDRESS || vault.fromAddress || '').trim();
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html, text: input.text }) , signal: AbortSignal.timeout(15000) });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.id) return { success: false, error: `Transactional email provider returned HTTP ${response.status}.` };
    return { success: true, providerMessageId: String(payload.id) };
  } catch (error: any) { return { success: false, error: error?.message || 'Transactional email delivery failed.' }; }
}

export async function sendResendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const status = await getEmailProviderStatus();
  const vault = await getProviderCredentials('resend');
  const gmailVault = status.provider === 'gmail' ? await getProviderCredentials('gmail') : {};
  const prisma = getPrismaClient();

  if (!status.configured) {
    const errorMsg = `${status.provider === 'gmail' ? 'Gmail' : 'Resend'} email provider is not configured (missing: ${status.missingVars.join(', ')}).`;
    if (input.deliveryId && prisma?.notificationDelivery) {
      await prisma.notificationDelivery
        .update({
          where: { id: input.deliveryId },
          data: {
            status: 'FAILED',
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date(),
            failureReason: errorMsg,
          },
        })
        .catch(() => {});
    }
    return { success: false, error: errorMsg, configMissing: true, attempts: 0 };
  }

  const apiKey = String(process.env.RESEND_API_KEY || vault.apiKey || vault.resendApiKey || '').trim();
  const fromAddress = String(process.env.EMAIL_FROM_ADDRESS || vault.fromAddress || '').trim();
  const replyTo = String(process.env.EMAIL_REPLY_TO || vault.replyTo || '').trim() || undefined;
  const maxAttempts = status.provider === 'gmail' ? 1 : 3;
  const baseDelay = typeof input.retryDelayMs === 'number' ? input.retryDelayMs : 300;

  let attempts = 0;
  let lastError = 'Email delivery failed';
  let lastRaw: unknown = undefined;

  for (let i = 0; i < maxAttempts; i++) {
    attempts += 1;
    if (input.deliveryId && prisma?.notificationDelivery) {
      await prisma.notificationDelivery
        .update({
          where: { id: input.deliveryId },
          data: {
            status: 'SENDING',
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date(),
          },
        })
        .catch(() => {});
    }

    try {
      let providerMessageId = '';
      let providerResponse: any = {};
      let providerStatus = 200;
      if (status.provider === 'gmail') {
        const sent = await sendViaGmail(input, gmailVault);
        providerMessageId = sent.id; providerResponse = sent.response;
      } else {
        const payload: Record<string, any> = {
          from: fromAddress, to: [input.to], subject: input.subject, html: input.html, text: input.text,
          headers: { 'List-Unsubscribe': `<${input.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click', 'X-Entity-Ref-ID': input.idempotencyKey },
        };
        if (replyTo) payload.reply_to = replyTo;
        if (input.tags && input.tags.length > 0) payload.tags = input.tags;
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey },
          body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
        });
        providerStatus = resp.status;
        const rawText = await resp.text();
        try { providerResponse = rawText ? JSON.parse(rawText) : {}; } catch { providerResponse = { message: rawText }; }
        if (resp.ok && providerResponse?.id) providerMessageId = String(providerResponse.id);
        else { lastError = providerResponse?.message || providerResponse?.error?.message || `Resend API returned HTTP ${providerStatus}`; lastRaw = providerResponse; }
      }
      lastRaw = providerResponse;

      if (providerMessageId) {
        if (input.deliveryId && prisma?.notificationDelivery) {
          await prisma.notificationDelivery
            .update({
              where: { id: input.deliveryId },
              data: {
                status: 'SENT',
                providerMessageId,
                sentAt: new Date(),
                failureReason: null,
                providerResponseJson: JSON.stringify(providerResponse),
              },
            })
            .catch(() => {});
        }
        return {
          success: true,
          providerMessageId,
          attempts,
          rawResponse: providerResponse,
        };
      }

      const retryable = providerStatus === 429 || providerStatus >= 500;
      if (!retryable || i === maxAttempts - 1) {
        break;
      }
      if (baseDelay > 0) {
        await sleep(baseDelay * Math.pow(2, i));
      }
    } catch (err: any) {
      lastError = err?.message || 'Network error calling Resend API';
      if (i === maxAttempts - 1) break;
      if (baseDelay > 0) {
        await sleep(baseDelay * Math.pow(2, i));
      }
    }
  }

  if (input.deliveryId && prisma?.notificationDelivery) {
    await prisma.notificationDelivery
      .update({
        where: { id: input.deliveryId },
        data: {
          status: 'FAILED',
          failureReason: lastError,
          providerResponseJson:
            lastRaw !== undefined ? JSON.stringify(lastRaw).slice(0, 2000) : undefined,
        },
      })
      .catch(() => {});
  }

  return {
    success: false,
    error: lastError,
    attempts,
    rawResponse: lastRaw,
  };
}

/**
 * Verifies Svix webhook signature used by Resend (`svix-id`, `svix-timestamp`, `svix-signature`).
 */
export function verifyResendWebhookSignature(params: {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
  secret: string;
  toleranceSeconds?: number;
}): { valid: boolean; reason?: string } {
  const secret = String(params.secret || '').trim();
  if (!secret) {
    return { valid: false, reason: 'EMAIL_WEBHOOK_SECRET is not configured.' };
  }

  const getHeader = (name: string): string => {
    const val = params.headers[name] ?? params.headers[name.toLowerCase()];
    return Array.isArray(val) ? String(val[0] || '') : String(val || '');
  };

  const svixId = getHeader('svix-id').trim();
  const svixTimestamp = getHeader('svix-timestamp').trim();
  const svixSignature = getHeader('svix-signature').trim();

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { valid: false, reason: 'Missing required Svix webhook headers.' };
  }

  const tsNum = Number(svixTimestamp);
  const tolerance = params.toleranceSeconds ?? 300;
  if (!Number.isFinite(tsNum) || Math.abs(Math.floor(Date.now() / 1000) - tsNum) > tolerance) {
    return { valid: false, reason: 'Webhook timestamp outside allowed tolerance window.' };
  }

  const keyBytes = secret.startsWith('whsec_')
    ? Buffer.from(secret.slice(6), 'base64')
    : Buffer.from(secret, 'utf8');

  const signedContent = `${svixId}.${svixTimestamp}.${params.rawBody}`;
  const expectedSig = crypto
    .createHmac('sha256', keyBytes)
    .update(signedContent)
    .digest('base64');

  const signatures = svixSignature
    .split(/\s+/)
    .map((part) => {
      const idx = part.indexOf(',');
      return idx !== -1 ? { version: part.slice(0, idx), sig: part.slice(idx + 1) } : null;
    })
    .filter((entry): entry is { version: string; sig: string } => Boolean(entry && entry.version === 'v1'));

  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  for (const entry of signatures) {
    const providedBuf = Buffer.from(entry.sig, 'utf8');
    if (
      providedBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return { valid: true };
    }
  }

  return { valid: false, reason: 'Invalid webhook HMAC signature.' };
}
