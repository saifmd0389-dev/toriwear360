import crypto from 'crypto';
import { getPrismaClient } from '../../db/prisma';

export interface WhatsAppProviderStatus {
  configured: boolean;
  templateConfigured: boolean;
  webhookVerifyConfigured: boolean;
  appSecretConfigured: boolean;
  defaultTemplateName: string;
  defaultTemplateLang: string;
  missingVars: string[];
}

export interface SendWhatsAppTemplateInput {
  toE164: string;
  templateName?: string;
  templateLang?: string;
  allowDefaultTemplateFallback?: boolean;
  bodyParameters?: string[];
  buttonUrlSuffix?: string;
  deliveryId?: string;
  retryDelayMs?: number;
}

export interface SendWhatsAppResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  configMissing?: boolean;
  attempts: number;
  rawResponse?: unknown;
}

export function getWhatsAppProviderStatus(): WhatsAppProviderStatus {
  const accessToken = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const defaultTemplateName = String(process.env.WHATSAPP_TEMPLATE_NAME || '').trim();
  const defaultTemplateLang = String(process.env.WHATSAPP_TEMPLATE_LANG || 'en').trim() || 'en';
  const verifyToken = String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '').trim();
  const appSecret = String(process.env.WHATSAPP_APP_SECRET || '').trim();

  const missingVars: string[] = [];
  if (!accessToken) missingVars.push('WHATSAPP_ACCESS_TOKEN');
  if (!phoneNumberId) missingVars.push('WHATSAPP_PHONE_NUMBER_ID');

  return {
    configured: Boolean(accessToken) && Boolean(phoneNumberId),
    templateConfigured: Boolean(defaultTemplateName),
    webhookVerifyConfigured: Boolean(verifyToken),
    appSecretConfigured: Boolean(appSecret),
    defaultTemplateName,
    defaultTemplateLang,
    missingVars,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendWhatsAppTemplateMessage(
  input: SendWhatsAppTemplateInput
): Promise<SendWhatsAppResult> {
  const status = getWhatsAppProviderStatus();
  const prisma = getPrismaClient();

  if (!status.configured) {
    const errorMsg = `Meta WhatsApp Cloud API is not configured (missing: ${status.missingVars.join(', ')}).`;
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

  const allowFallback = input.allowDefaultTemplateFallback !== false;
  const templateName = String(
    input.templateName || (allowFallback ? status.defaultTemplateName : '') || ''
  ).trim();
  const templateLang = String(input.templateLang || status.defaultTemplateLang || 'en').trim() || 'en';

  if (!templateName) {
    const errorMsg = allowFallback
      ? 'WhatsApp approved template name is required (WHATSAPP_TEMPLATE_NAME or campaign template).'
      : 'WhatsApp approved template name is not configured for this notification event.';
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

  const accessToken = String(process.env.WHATSAPP_ACCESS_TOKEN).trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID).trim();
  const recipientDigits = String(input.toE164 || '').replace(/[^\d]/g, '');

  if (!recipientDigits || recipientDigits.length < 7) {
    const invalidPhoneErr = 'Invalid E.164 WhatsApp recipient number.';
    if (input.deliveryId && prisma?.notificationDelivery) {
      await prisma.notificationDelivery
        .update({
          where: { id: input.deliveryId },
          data: {
            status: 'FAILED',
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date(),
            failureReason: invalidPhoneErr,
          },
        })
        .catch(() => {});
    }
    return {
      success: false,
      error: invalidPhoneErr,
      attempts: 0,
    };
  }

  const components: any[] = [];
  if (Array.isArray(input.bodyParameters) && input.bodyParameters.length > 0) {
    components.push({
      type: 'body',
      parameters: input.bodyParameters.map((val) => ({
        type: 'text',
        text: String(val),
      })),
    });
  }
  if (input.buttonUrlSuffix) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: String(input.buttonUrlSuffix) }],
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientDigits,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang },
      ...(components.length > 0 ? { components } : {}),
    },
  };

  const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`;
  const maxAttempts = 3;
  const baseDelay = typeof input.retryDelayMs === 'number' ? input.retryDelayMs : 300;

  let attempts = 0;
  let lastError = 'WhatsApp Cloud API delivery failed';
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
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const rawText = await resp.text();
      let parsed: any = rawText;
      try {
        parsed = rawText ? JSON.parse(rawText) : {};
      } catch {}
      lastRaw = parsed;

      const msgId = parsed?.messages?.[0]?.id;
      if (resp.ok && msgId) {
        if (input.deliveryId && prisma?.notificationDelivery) {
          await prisma.notificationDelivery
            .update({
              where: { id: input.deliveryId },
              data: {
                status: 'SENT',
                providerMessageId: String(msgId),
                sentAt: new Date(),
                failureReason: null,
                providerResponseJson: JSON.stringify({ id: msgId, status: resp.status }),
              },
            })
            .catch(() => {});
        }
        return {
          success: true,
          providerMessageId: String(msgId),
          attempts,
          rawResponse: parsed,
        };
      }

      lastError =
        parsed?.error?.error_user_msg ||
        parsed?.error?.message ||
        `Meta Graph API returned HTTP ${resp.status}`;

      const retryable = resp.status === 429 || resp.status >= 500;
      if (!retryable || i === maxAttempts - 1) {
        break;
      }
      if (baseDelay > 0) {
        await sleep(baseDelay * Math.pow(2, i));
      }
    } catch (err: any) {
      lastError = err?.message || 'Network error calling Meta Graph API';
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
 * Verifies Meta WhatsApp Cloud API X-Hub-Signature-256 HMAC signature against raw request body.
 */
export function verifyMetaWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string;
  appSecret: string;
}): { valid: boolean; reason?: string } {
  const appSecret = String(params.appSecret || '').trim();
  if (!appSecret) {
    return { valid: false, reason: 'WHATSAPP_APP_SECRET is not configured.' };
  }

  const header = String(params.signatureHeader || '').trim();
  if (!header.startsWith('sha256=')) {
    return { valid: false, reason: 'Missing or invalid X-Hub-Signature-256 header.' };
  }

  const providedHex = header.slice(7).trim();
  const expectedHex = crypto
    .createHmac('sha256', appSecret)
    .update(params.rawBody, 'utf8')
    .digest('hex');

  const providedBuf = Buffer.from(providedHex, 'hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');

  if (
    providedBuf.length === 0 ||
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return { valid: false, reason: 'WhatsApp webhook HMAC signature verification failed.' };
  }

  return { valid: true };
}
