import { OrderRecord } from '../../repositories/orderRepository';

export type OrderNotificationEventType =
  | 'ORDER_CONFIRMED'
  | 'ORDER_CANCELLED'
  | 'ORDER_SHIPPED'
  | 'ORDER_OUT_FOR_DELIVERY'
  | 'ORDER_DELIVERED';

export interface OrderNotificationContext {
  order: OrderRecord;
  cancellationReason?: string;
  courierPartner?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

export interface OrderWhatsAppTemplateSpec {
  eventType: OrderNotificationEventType;
  nameEnvVar: string;
  langEnvVar: string;
  metaCategory: 'UTILITY';
  variableDescriptions: string[];
}

export const ORDER_WHATSAPP_TEMPLATE_SPECS: Record<
  OrderNotificationEventType,
  OrderWhatsAppTemplateSpec
> = {
  ORDER_CONFIRMED: {
    eventType: 'ORDER_CONFIRMED',
    nameEnvVar: 'WHATSAPP_ORDER_CONFIRM_TEMPLATE_NAME',
    langEnvVar: 'WHATSAPP_ORDER_CONFIRM_TEMPLATE_LANG',
    metaCategory: 'UTILITY',
    variableDescriptions: [
      '{{1}} Customer first/full name',
      '{{2}} Order number (e.g. TORI-20261122-8K42)',
      '{{3}} Order total formatted in INR (e.g. ₹1,299)',
      '{{4}} Payment summary (e.g. Cash on Delivery or Paid via UPI)',
    ],
  },
  ORDER_CANCELLED: {
    eventType: 'ORDER_CANCELLED',
    nameEnvVar: 'WHATSAPP_ORDER_CANCEL_TEMPLATE_NAME',
    langEnvVar: 'WHATSAPP_ORDER_CANCEL_TEMPLATE_LANG',
    metaCategory: 'UTILITY',
    variableDescriptions: [
      '{{1}} Customer first/full name',
      '{{2}} Order number',
      '{{3}} Cancellation reason',
      '{{4}} Accurate refund status summary (never claims completed unless confirmed)',
    ],
  },
  ORDER_SHIPPED: {
    eventType: 'ORDER_SHIPPED',
    nameEnvVar: 'WHATSAPP_ORDER_SHIPPED_TEMPLATE_NAME',
    langEnvVar: 'WHATSAPP_ORDER_SHIPPED_TEMPLATE_LANG',
    metaCategory: 'UTILITY',
    variableDescriptions: [
      '{{1}} Customer first/full name',
      '{{2}} Order number',
      '{{3}} Courier partner name',
      '{{4}} AWB / tracking number',
      '{{5}} Tracking URL (or storefront tracking link)',
    ],
  },
  ORDER_OUT_FOR_DELIVERY: {
    eventType: 'ORDER_OUT_FOR_DELIVERY',
    nameEnvVar: 'WHATSAPP_ORDER_OUT_FOR_DELIVERY_TEMPLATE_NAME',
    langEnvVar: 'WHATSAPP_ORDER_OUT_FOR_DELIVERY_TEMPLATE_LANG',
    metaCategory: 'UTILITY',
    variableDescriptions: [
      '{{1}} Customer first/full name',
      '{{2}} Order number',
      '{{3}} Courier partner name',
      '{{4}} AWB / tracking number',
      '{{5}} Tracking URL (or storefront tracking link)',
    ],
  },
  ORDER_DELIVERED: {
    eventType: 'ORDER_DELIVERED',
    nameEnvVar: 'WHATSAPP_ORDER_DELIVERED_TEMPLATE_NAME',
    langEnvVar: 'WHATSAPP_ORDER_DELIVERED_TEMPLATE_LANG',
    metaCategory: 'UTILITY',
    variableDescriptions: [
      '{{1}} Customer first/full name',
      '{{2}} Order number',
      '{{3}} Order total formatted in INR',
    ],
  },
};

export interface RefundAssessment {
  code: 'NO_CHARGE_COD' | 'NO_CHARGE_UNPAID' | 'REFUND_COMPLETED' | 'PARTIAL_REFUND_COMPLETED' | 'REFUND_PENDING_PROCESSING';
  shortLabel: string;
  whatsappSummary: string;
  emailSummary: string;
}

export function formatInrAmount(amount: number): string {
  const num = Number(amount || 0);
  if (!Number.isFinite(num)) return '₹0';
  return `₹${Math.round(num).toLocaleString('en-IN')}`;
}

/**
 * Computes strictly truthful refund copy for cancelled orders.
 * NEVER claims a refund has been completed unless payment/refund state confirms completion.
 */
export function assessOrderCancellationRefund(order: OrderRecord): RefundAssessment {
  const payMethod = String(order.paymentMethod || '').toUpperCase();
  const payStatus = String(order.paymentStatus || '').toUpperCase();
  const refundStatus = String(order.refundStatus || '').toUpperCase();
  const refundAmt = typeof order.refundAmount === 'number' && order.refundAmount > 0
    ? order.refundAmount
    : order.total;

  if (payStatus === 'REFUNDED' || refundStatus === 'REFUND_COMPLETED') {
    return {
      code: 'REFUND_COMPLETED',
      shortLabel: 'Refund Completed',
      whatsappSummary: `Refund of ${formatInrAmount(refundAmt)} has been completed to your original payment method.`,
      emailSummary: `Your refund of ${formatInrAmount(refundAmt)} has been confirmed as completed to your original payment method.`,
    };
  }

  if (refundStatus === 'PARTIAL_REFUND_COMPLETED') {
    return {
      code: 'PARTIAL_REFUND_COMPLETED',
      shortLabel: 'Partial Refund Processed',
      whatsappSummary: `A partial refund of ${formatInrAmount(refundAmt)} has been processed to your original payment method.`,
      emailSummary: `A partial refund of ${formatInrAmount(refundAmt)} has been processed to your original payment method. Please contact support if you have questions regarding the remaining balance.`,
    };
  }

  if (payStatus === 'PAID' || refundStatus === 'REFUND_INITIATED') {
    return {
      code: 'REFUND_PENDING_PROCESSING',
      shortLabel: 'Refund Initiated / Pending Confirmation',
      whatsappSummary: `Your prepaid payment of ${formatInrAmount(order.total)} is queued for refund processing (typically 5–7 business days once confirmed by the payment gateway).`,
      emailSummary: `Because this order was paid online (${formatInrAmount(order.total)}), a refund request has been queued for processing. Please note that the refund is not yet completed—once confirmed by our payment processor, funds typically reflect in 5–7 business days.`,
    };
  }

  if (payMethod === 'COD') {
    return {
      code: 'NO_CHARGE_COD',
      shortLabel: 'Not Applicable (Cash on Delivery)',
      whatsappSummary: 'No payment was collected (Cash on Delivery), so no refund is required.',
      emailSummary: 'This order was placed with Cash on Delivery (COD). No payment was collected, so no refund is required.',
    };
  }

  return {
    code: 'NO_CHARGE_UNPAID',
    shortLabel: 'No Payment Captured',
    whatsappSummary: 'No online payment was captured for this order, so no refund is required.',
    emailSummary: 'No online payment was captured for this order, so no refund is required. If any temporary bank hold appears, it will automatically release per your bank’s schedule.',
  };
}

/**
 * Normalizes Indian & international phone numbers to strict E.164 format (e.g. +919876543210).
 * Defaults valid 10-digit Indian mobile numbers to +91.
 * Returns null if the number is malformed or empty.
 */
export function normalizeOrderPhoneToE164(raw: string | null | undefined, defaultCountryCode = '91'): string | null {
  const input = String(raw || '').trim();
  if (!input) return null;

  let cleaned = input.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
    if (/^(\d)\1+$/.test(digits)) return null;
    return `+${digits}`;
  }

  if (!/^\d+$/.test(cleaned)) return null;

  // Strip single leading trunk 0 on Indian numbers (e.g. 09876543210 -> 9876543210)
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }

  // 10-digit local Indian number -> +91XXXXXXXXXX
  if (cleaned.length === 10) {
    if (/^0+$/.test(cleaned) || /^(\d)\1{9}$/.test(cleaned)) return null;
    return `+${defaultCountryCode}${cleaned}`;
  }

  // 12-digit Indian number with 91 prefix -> +91XXXXXXXXXX
  if (cleaned.length === 12 && cleaned.startsWith(defaultCountryCode)) {
    const subscriberPart = cleaned.slice(defaultCountryCode.length);
    if (/^0+$/.test(subscriberPart) || /^(\d)\1{9}$/.test(subscriberPart)) return null;
    return `+${cleaned}`;
  }

  // Generic international digits (11-15 digits, non-zero start)
  if (/^[1-9]\d{10,14}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return null;
}

export function sanitizeTemplateParam(val: string | undefined | null, fallback: string, maxLen = 180): string {
  const clean = String(val || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!clean) return fallback;
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean;
}

export function sanitizeTrackingUrl(rawUrl?: string | null): string | undefined {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {}
  return undefined;
}

export interface ResolvedOrderWhatsAppTemplate {
  configured: boolean;
  envVarName: string;
  langEnvVarName: string;
  templateName?: string;
  templateLang?: string;
  bodyParameters: string[];
  reason?: string;
}

export function resolveOrderWhatsAppTemplate(
  eventType: OrderNotificationEventType,
  context: OrderNotificationContext
): ResolvedOrderWhatsAppTemplate {
  const spec = ORDER_WHATSAPP_TEMPLATE_SPECS[eventType];
  const templateName = String(process.env[spec.nameEnvVar] || '').trim();
  const templateLang =
    String(process.env[spec.langEnvVar] || process.env.WHATSAPP_TEMPLATE_LANG || 'en').trim() || 'en';

  const { order } = context;
  const customerName = sanitizeTemplateParam(order.customerName, 'Customer', 60);
  const orderNumber = sanitizeTemplateParam(order.orderNumber, order.id, 40);
  const totalFormatted = formatInrAmount(order.total);
  const appUrl = String(process.env.APP_URL || process.env.SITE_URL || 'https://thetoriwearstore.in')
    .trim()
    .replace(/\/+$/, '');

  const courierPartner = sanitizeTemplateParam(
    context.courierPartner || order.courierPartner,
    'TORIWEAR Logistics Partner',
    60
  );
  const trackingNumber = sanitizeTemplateParam(
    context.trackingNumber || order.awbNumber || order.courierTrackingNumber,
    'Pending assignment',
    60
  );
  const safeTrackUrl =
    sanitizeTrackingUrl(context.trackingUrl) || `${appUrl}/track-order`;

  let bodyParameters: string[] = [];

  switch (eventType) {
    case 'ORDER_CONFIRMED': {
      const isCod = String(order.paymentMethod || '').toUpperCase() === 'COD';
      const paymentSummary = isCod
        ? 'Cash on Delivery (Pay at doorstep)'
        : `Paid via ${sanitizeTemplateParam(order.paymentMethod, 'Online Payment', 30)}`;
      bodyParameters = [customerName, orderNumber, totalFormatted, paymentSummary];
      break;
    }
    case 'ORDER_CANCELLED': {
      const reason = sanitizeTemplateParam(
        context.cancellationReason || order.cancellationReason,
        'Order cancelled',
        120
      );
      const refund = assessOrderCancellationRefund(order);
      bodyParameters = [
        customerName,
        orderNumber,
        reason,
        sanitizeTemplateParam(refund.whatsappSummary, refund.shortLabel, 180),
      ];
      break;
    }
    case 'ORDER_SHIPPED':
    case 'ORDER_OUT_FOR_DELIVERY': {
      bodyParameters = [
        customerName,
        orderNumber,
        courierPartner,
        trackingNumber,
        safeTrackUrl,
      ];
      break;
    }
    case 'ORDER_DELIVERED': {
      bodyParameters = [customerName, orderNumber, totalFormatted];
      break;
    }
  }

  if (!templateName) {
    return {
      configured: false,
      envVarName: spec.nameEnvVar,
      langEnvVarName: spec.langEnvVar,
      bodyParameters,
      reason: `WhatsApp order template for ${eventType} is not configured (${spec.nameEnvVar} is empty).`,
    };
  }

  return {
    configured: true,
    envVarName: spec.nameEnvVar,
    langEnvVarName: spec.langEnvVar,
    templateName,
    templateLang,
    bodyParameters,
  };
}

export function getOrderWhatsAppTemplateConfigStatus(): Record<
  OrderNotificationEventType,
  { configured: boolean; envVar: string; langEnvVar: string; templateName: string; templateLang: string }
> {
  const result = {} as Record<
    OrderNotificationEventType,
    { configured: boolean; envVar: string; langEnvVar: string; templateName: string; templateLang: string }
  >;
  (Object.keys(ORDER_WHATSAPP_TEMPLATE_SPECS) as OrderNotificationEventType[]).forEach((eventType) => {
    const spec = ORDER_WHATSAPP_TEMPLATE_SPECS[eventType];
    const templateName = String(process.env[spec.nameEnvVar] || '').trim();
    const templateLang =
      String(process.env[spec.langEnvVar] || process.env.WHATSAPP_TEMPLATE_LANG || 'en').trim() || 'en';
    result[eventType] = {
      configured: Boolean(templateName),
      envVar: spec.nameEnvVar,
      langEnvVar: spec.langEnvVar,
      templateName,
      templateLang,
    };
  });
  return result;
}
