import crypto from 'crypto';
import { cmsRepository } from '../repositories/cmsRepository';

export type MetaStandardEventName = 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase';

export interface MetaCapiEventInput {
  eventName: MetaStandardEventName;
  eventId: string;
  eventSourceUrl?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  email?: string;
  phone?: string;
  customData?: {
    currency?: string;
    value?: number;
    content_ids?: string[];
    content_name?: string;
    content_type?: string;
    num_items?: number;
    order_id?: string;
  };
}

function sha256Normalized(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export async function dispatchMetaCapiEvent(input: MetaCapiEventInput): Promise<{
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  eventsReceived?: number;
}> {
  try {
    const settings = await cmsRepository.getStoreSettings();
    const pixelId = settings.metaBusiness?.pixelId?.trim();
    const capiEnabled = Boolean(settings.metaBusiness?.capiEnabled);
    const accessToken = (process.env.META_CONVERSIONS_API_TOKEN || '').trim();

    if (!capiEnabled || !pixelId) {
      return { sent: false, skipped: true, reason: 'Meta Conversions API not enabled or Pixel ID missing.' };
    }
    if (!accessToken) {
      return { sent: false, skipped: true, reason: 'META_CONVERSIONS_API_TOKEN is not configured in server environment.' };
    }

    const userData: Record<string, any> = {};
    if (input.email && input.email.includes('@')) {
      userData.em = [sha256Normalized(input.email)];
    }
    if (input.phone) {
      const digits = input.phone.replace(/\D/g, '');
      if (digits.length >= 10) {
        userData.ph = [sha256Normalized(digits.length === 10 ? `91${digits}` : digits)];
      }
    }
    if (input.clientIpAddress) {
      userData.client_ip_address = input.clientIpAddress;
    }
    if (input.clientUserAgent) {
      userData.client_user_agent = input.clientUserAgent;
    }

    const eventPayload: Record<string, any> = {
      event_name: input.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: input.eventId,
      action_source: 'website',
      event_source_url: input.eventSourceUrl || process.env.APP_URL || 'https://thetoriwearstore.in',
      user_data: userData,
    };

    if (input.customData && Object.keys(input.customData).length > 0) {
      eventPayload.custom_data = {
        currency: input.customData.currency || 'INR',
        ...input.customData,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [eventPayload] }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { sent: false, reason: json?.error?.message || `HTTP ${res.status}` };
    }

    return { sent: true, eventsReceived: Number(json?.events_received || 1) };
  } catch (err: any) {
    return { sent: false, reason: err?.message || 'Meta CAPI network failure' };
  }
}
