declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
    __TORI_RUNTIME_CONFIG__?: {
      adminPath?: string;
      metaPixelId?: string;
      metaDomainVerification?: string;
      metaCapiEnabled?: boolean;
    };
  }
}

let initializedPixelId: string | null = null;

function createEventId(prefix = 'tori'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function initMetaPixel(explicitPixelId?: string): string | null {
  if (typeof window === 'undefined') return null;
  const pixelId = (explicitPixelId || window.__TORI_RUNTIME_CONFIG__?.metaPixelId || '').trim();
  if (!pixelId || !/^\d{5,30}$/.test(pixelId)) return null;

  if (initializedPixelId === pixelId && typeof window.fbq === 'function') {
    return pixelId;
  }

  if (typeof window.fbq !== 'function') {
    const n: any = function (...args: any[]) {
      if (n.callMethod) {
        n.callMethod.apply(n, args);
      } else {
        n.queue.push(args);
      }
    };
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    window.fbq = n;

    const existingScript = document.querySelector('script[src*="connect.facebook.net/en_US/fbevents.js"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);
    }
  }

  try {
    window.fbq?.('init', pixelId);
    window.fbq?.('track', 'PageView');
    initializedPixelId = pixelId;
  } catch {}

  return pixelId;
}

export interface MetaTrackPayload {
  contentIds?: string[];
  contentName?: string;
  contentCategory?: string;
  value?: number;
  currency?: string;
  numItems?: number;
  orderId?: string;
  userData?: {
    email?: string;
    phone?: string;
  };
}

export async function trackMetaEvent(
  eventName: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase',
  payload: MetaTrackPayload
) {
  if (typeof window === 'undefined') return;
  const eventId = createEventId(eventName.toLowerCase());
  const pixelId = initMetaPixel();

  const customData: Record<string, any> = {
    currency: payload.currency || 'INR',
    value: Number(payload.value || 0),
    ...(payload.contentIds && payload.contentIds.length > 0 ? { content_ids: payload.contentIds, content_type: 'product' } : {}),
    ...(payload.contentName ? { content_name: payload.contentName } : {}),
    ...(payload.contentCategory ? { content_category: payload.contentCategory } : {}),
    ...(payload.numItems !== undefined ? { num_items: payload.numItems } : {}),
    ...(payload.orderId ? { order_id: payload.orderId } : {}),
  };

  if (pixelId && typeof window.fbq === 'function') {
    try {
      window.fbq('track', eventName, customData, { eventID: eventId });
    } catch {}
  }

  // Server-side Conversions API relay (only dispatches server-side if CAPI token + enabled)
  try {
    await fetch('/api/v1/store/meta/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        eventId,
        eventSourceUrl: window.location.href,
        userData: payload.userData || {},
        customData,
      }),
    });
  } catch {
    // Non-blocking telemetry
  }
}
