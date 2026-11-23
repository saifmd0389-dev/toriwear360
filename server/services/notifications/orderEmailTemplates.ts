import { OrderRecord } from '../../repositories/orderRepository';
import {
  OrderNotificationContext,
  OrderNotificationEventType,
  assessOrderCancellationRefund,
  formatInrAmount,
  sanitizeTrackingUrl,
} from './orderWhatsAppTemplates';

export interface BuiltOrderEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSafeAppUrl(): string {
  const raw = String(process.env.APP_URL || process.env.SITE_URL || 'https://thetoriwearstore.in').trim();
  const safe = sanitizeTrackingUrl(raw) || 'https://thetoriwearstore.in';
  return safe.replace(/\/+$/, '');
}

function formatPaymentMethodLabel(order: OrderRecord): string {
  const method = String(order.paymentMethod || '').toUpperCase();
  if (method === 'COD') return 'Cash on Delivery (COD)';
  if (method === 'UPI') return 'UPI (Prepaid)';
  if (method === 'CARD' || method === 'CREDIT_CARD' || method === 'DEBIT_CARD') return 'Card (Prepaid)';
  if (method === 'NET_BANKING' || method === 'NETBANKING') return 'Net Banking (Prepaid)';
  return `${method || 'Online'} (${String(order.paymentStatus || '').toUpperCase() === 'PAID' ? 'Paid' : 'Prepaid'})`;
}

function buildItemsTableHtml(order: OrderRecord): string {
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) return '';

  const rows = items
    .map(
      (it) => `<tr>
        <td style="padding:10px 8px;border-bottom:1px solid #27272a;font-size:13px;color:#f4f4f5;">
          <div style="font-weight:700;color:#ffffff;">${escapeHtml(it.productName)}</div>
          <div style="font-size:11px;color:#a1a1aa;margin-top:2px;">Size: ${escapeHtml(it.size)}${it.color ? ` • ${escapeHtml(it.color)}` : ''}</div>
        </td>
        <td align="center" style="padding:10px 8px;border-bottom:1px solid #27272a;font-size:13px;color:#d4d4d8;">${Number(it.quantity || 1)}</td>
        <td align="right" style="padding:10px 8px;border-bottom:1px solid #27272a;font-size:13px;font-weight:700;color:#ffffff;">${escapeHtml(formatInrAmount(it.totalPrice))}</td>
      </tr>`
    )
    .join('');

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
    <thead>
      <tr>
        <th align="left" style="padding:8px;border-bottom:1px solid #3f3f46;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;">Item</th>
        <th align="center" style="padding:8px;border-bottom:1px solid #3f3f46;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;">Qty</th>
        <th align="right" style="padding:8px;border-bottom:1px solid #3f3f46;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildTotalsHtml(order: OrderRecord): string {
  const discountRow =
    Number(order.discount || 0) > 0
      ? `<tr>
          <td style="padding:4px 0;font-size:13px;color:#a1a1aa;">Discount${order.discountCode ? ` (${escapeHtml(order.discountCode)})` : ''}</td>
          <td align="right" style="padding:4px 0;font-size:13px;color:#4ade80;">-${escapeHtml(formatInrAmount(order.discount))}</td>
        </tr>`
      : '';

  const shippingLabel = Number(order.shippingFee || 0) > 0 ? formatInrAmount(order.shippingFee) : 'FREE';

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0 20px;border-top:1px solid #27272a;padding-top:12px;">
    <tr>
      <td style="padding:4px 0;font-size:13px;color:#a1a1aa;">Subtotal</td>
      <td align="right" style="padding:4px 0;font-size:13px;color:#e4e4e7;">${escapeHtml(formatInrAmount(order.subtotal))}</td>
    </tr>
    ${discountRow}
    <tr>
      <td style="padding:4px 0;font-size:13px;color:#a1a1aa;">Shipping</td>
      <td align="right" style="padding:4px 0;font-size:13px;color:#e4e4e7;">${escapeHtml(shippingLabel)}</td>
    </tr>
    <tr>
      <td style="padding:10px 0 4px;font-size:15px;font-weight:800;color:#ffffff;border-top:1px solid #27272a;">Total</td>
      <td align="right" style="padding:10px 0 4px;font-size:16px;font-weight:800;color:#ff2028;border-top:1px solid #27272a;">${escapeHtml(formatInrAmount(order.total))}</td>
    </tr>
    <tr>
      <td style="padding:2px 0;font-size:12px;color:#a1a1aa;">Payment Method</td>
      <td align="right" style="padding:2px 0;font-size:12px;color:#d4d4d8;">${escapeHtml(formatPaymentMethodLabel(order))}</td>
    </tr>
  </table>`;
}

function buildItemsText(order: OrderRecord): string {
  const items = Array.isArray(order.items) ? order.items : [];
  const lines = items.map(
    (it) =>
      `- ${it.productName} (${it.size}${it.color ? `, ${it.color}` : ''}) x${it.quantity || 1} — ${formatInrAmount(it.totalPrice)}`
  );
  lines.push(`Subtotal: ${formatInrAmount(order.subtotal)}`);
  if (Number(order.discount || 0) > 0) {
    lines.push(`Discount${order.discountCode ? ` (${order.discountCode})` : ''}: -${formatInrAmount(order.discount)}`);
  }
  lines.push(`Shipping: ${Number(order.shippingFee || 0) > 0 ? formatInrAmount(order.shippingFee) : 'FREE'}`);
  lines.push(`Total: ${formatInrAmount(order.total)}`);
  lines.push(`Payment Method: ${formatPaymentMethodLabel(order)}`);
  return lines.join('\n');
}

function buildAddressHtml(order: OrderRecord): string {
  const addr = order.shippingAddress;
  if (!addr || (!addr.addressLine1 && !addr.city)) return '';
  const parts = [
    addr.fullName || order.customerName,
    addr.addressLine1,
    addr.addressLine2,
    [addr.city, addr.state, addr.pincode].filter(Boolean).join(', '),
    addr.country || 'India',
  ].filter(Boolean);

  return `<div style="margin:16px 0;padding:14px 16px;background:#181822;border:1px solid #27272a;border-radius:10px;">
    <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#a1a1aa;font-weight:700;margin-bottom:6px;">Delivery Address</div>
    <div style="font-size:13px;line-height:1.5;color:#e4e4e7;">${parts.map(escapeHtml).join('<br/>')}</div>
  </div>`;
}

function wrapEmailLayout(params: {
  badge: string;
  headline: string;
  intro: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  orderNumber: string;
}): string {
  const safeCtaUrl = sanitizeTrackingUrl(params.ctaUrl);
  const ctaHtml =
    params.ctaLabel && safeCtaUrl
      ? `<div style="margin:24px 0;">
          <a href="${escapeHtml(safeCtaUrl)}" style="display:inline-block;padding:12px 24px;background:#ff2028;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;border-radius:10px;letter-spacing:1px;text-transform:uppercase;">${escapeHtml(params.ctaLabel)}</a>
        </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07070b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07070b;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background:#111118;border:1px solid #27272a;border-radius:16px;padding:30px;">
          <tr>
            <td>
              <div style="font-size:11px;letter-spacing:3px;color:#ff2028;font-weight:800;text-transform:uppercase;">TORIWEAR • ${escapeHtml(params.badge)}</div>
              <h1 style="margin:10px 0 8px;font-size:24px;line-height:1.25;color:#ffffff;font-weight:800;">${escapeHtml(params.headline)}</h1>
              <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#d4d4d8;">${escapeHtml(params.intro)}</p>
              <div style="display:inline-block;padding:8px 14px;background:#181822;border:1px solid #27272a;border-radius:8px;font-size:12px;color:#e4e4e7;margin-bottom:8px;">
                Order ID: <strong style="color:#ffffff;font-family:monospace;">${escapeHtml(params.orderNumber)}</strong>
              </div>
              ${params.bodyHtml}
              ${ctaHtml}
              <hr style="border:none;border-top:1px solid #27272a;margin:24px 0;" />
              <p style="margin:0;font-size:11px;line-height:1.6;color:#71717a;">
                This is a transactional service email regarding your TORIWEAR order ${escapeHtml(params.orderNumber)}.<br/>
                Need help? Reply to this email or contact our support team.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildOrderTransactionalEmail(
  eventType: OrderNotificationEventType,
  context: OrderNotificationContext
): BuiltOrderEmail {
  const { order } = context;
  const appUrl = getSafeAppUrl();
  const orderNumber = order.orderNumber || order.id;
  const customerName = order.customerName || 'Customer';
  const courierPartner = context.courierPartner || order.courierPartner || 'TORIWEAR Logistics Partner';
  const trackingNumber = context.trackingNumber || order.awbNumber || order.courierTrackingNumber || '';
  const trackingUrl = sanitizeTrackingUrl(context.trackingUrl);

  switch (eventType) {
    case 'ORDER_CONFIRMED': {
      const isCod = String(order.paymentMethod || '').toUpperCase() === 'COD';
      const subject = `Order Confirmed: ${orderNumber} — TORIWEAR`;
      const intro = isCod
        ? `Hi ${customerName}, your Cash on Delivery order has been confirmed and is now being prepared for dispatch. Please keep ${formatInrAmount(order.total)} ready at delivery.`
        : `Hi ${customerName}, thank you! Your payment has been verified and your TORIWEAR order is confirmed.`;

      const bodyHtml = `${buildItemsTableHtml(order)}${buildTotalsHtml(order)}${buildAddressHtml(order)}`;
      const html = wrapEmailLayout({
        badge: 'ORDER CONFIRMED',
        headline: 'YOUR ORDER IS CONFIRMED.',
        intro,
        bodyHtml,
        ctaLabel: 'Track Your Order',
        ctaUrl: `${appUrl}/track-order`,
        orderNumber,
      });

      const text = [
        `TORIWEAR — ORDER CONFIRMED (${orderNumber})`,
        '',
        intro,
        '',
        buildItemsText(order),
        '',
        `Track your order: ${appUrl}/track-order`,
      ].join('\n');

      return { subject, html, text };
    }

    case 'ORDER_CANCELLED': {
      const reason = context.cancellationReason || order.cancellationReason || 'Cancelled per request';
      const refund = assessOrderCancellationRefund(order);
      const subject = `Order Cancelled: ${orderNumber} — TORIWEAR`;
      const intro = `Hi ${customerName}, your TORIWEAR order ${orderNumber} has been cancelled.`;

      const cancellationBoxHtml = `<div style="margin:16px 0;padding:16px;background:#1a1114;border:1px solid #7f1d1d;border-radius:12px;">
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#fca5a5;font-weight:700;">Cancellation & Refund Details</div>
        <p style="margin:8px 0 6px;font-size:13px;color:#f4f4f5;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
        <p style="margin:6px 0 4px;font-size:13px;color:#f4f4f5;"><strong>Refund Status:</strong> ${escapeHtml(refund.shortLabel)}</p>
        <p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:#d4d4d8;">${escapeHtml(refund.emailSummary)}</p>
      </div>`;

      const bodyHtml = `${cancellationBoxHtml}${buildItemsTableHtml(order)}${buildTotalsHtml(order)}`;
      const html = wrapEmailLayout({
        badge: 'ORDER CANCELLED',
        headline: 'YOUR ORDER HAS BEEN CANCELLED.',
        intro,
        bodyHtml,
        ctaLabel: 'Visit TORIWEAR',
        ctaUrl: appUrl,
        orderNumber,
      });

      const text = [
        `TORIWEAR — ORDER CANCELLED (${orderNumber})`,
        '',
        intro,
        `Reason: ${reason}`,
        `Refund Status: ${refund.shortLabel}`,
        refund.emailSummary,
        '',
        buildItemsText(order),
      ].join('\n');

      return { subject, html, text };
    }

    case 'ORDER_SHIPPED': {
      const subject = `Order Shipped: ${orderNumber} — TORIWEAR`;
      const intro = `Hi ${customerName}, your TORIWEAR order has been dispatched and is on its way to you.`;

      const trackingBoxHtml = `<div style="margin:16px 0;padding:16px;background:#131922;border:1px solid #273449;border-radius:12px;">
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#93c5fd;font-weight:700;">Shipment Tracking</div>
        <p style="margin:8px 0 4px;font-size:13px;color:#f4f4f5;"><strong>Courier Partner:</strong> ${escapeHtml(courierPartner)}</p>
        ${trackingNumber ? `<p style="margin:4px 0 4px;font-size:13px;color:#f4f4f5;"><strong>Tracking / AWB Number:</strong> <span style="font-family:monospace;">${escapeHtml(trackingNumber)}</span></p>` : ''}
        ${trackingUrl ? `<p style="margin:6px 0 0;font-size:12px;color:#93c5fd;word-break:break-all;">Tracking Link: <a href="${escapeHtml(trackingUrl)}" style="color:#93c5fd;">${escapeHtml(trackingUrl)}</a></p>` : ''}
      </div>`;

      const bodyHtml = `${trackingBoxHtml}${buildItemsTableHtml(order)}${buildAddressHtml(order)}`;
      const html = wrapEmailLayout({
        badge: 'ORDER SHIPPED',
        headline: 'YOUR ORDER IS ON THE MOVE.',
        intro,
        bodyHtml,
        ctaLabel: trackingUrl ? 'Track Shipment Live' : 'Track Your Order',
        ctaUrl: trackingUrl || `${appUrl}/track-order`,
        orderNumber,
      });

      const text = [
        `TORIWEAR — ORDER SHIPPED (${orderNumber})`,
        '',
        intro,
        `Courier Partner: ${courierPartner}`,
        trackingNumber ? `Tracking / AWB Number: ${trackingNumber}` : '',
        trackingUrl ? `Tracking URL: ${trackingUrl}` : `Track Order: ${appUrl}/track-order`,
        '',
        buildItemsText(order),
      ]
        .filter(Boolean)
        .join('\n');

      return { subject, html, text };
    }

    case 'ORDER_OUT_FOR_DELIVERY': {
      const isCod = String(order.paymentMethod || '').toUpperCase() === 'COD' && String(order.paymentStatus || '').toUpperCase() !== 'PAID';
      const subject = `Out for Delivery: ${orderNumber} — TORIWEAR`;
      const intro = isCod
        ? `Hi ${customerName}, your TORIWEAR order is out for delivery today! Please keep ${formatInrAmount(order.total)} ready for Cash on Delivery.`
        : `Hi ${customerName}, great news — your TORIWEAR order is out for delivery today!`;

      const trackingBoxHtml = `<div style="margin:16px 0;padding:16px;background:#1a1710;border:1px solid #78350f;border-radius:12px;">
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#fcd34d;font-weight:700;">Out for Delivery</div>
        <p style="margin:8px 0 4px;font-size:13px;color:#f4f4f5;"><strong>Courier Partner:</strong> ${escapeHtml(courierPartner)}</p>
        ${trackingNumber ? `<p style="margin:4px 0 4px;font-size:13px;color:#f4f4f5;"><strong>Tracking / AWB Number:</strong> <span style="font-family:monospace;">${escapeHtml(trackingNumber)}</span></p>` : ''}
        ${trackingUrl ? `<p style="margin:6px 0 0;font-size:12px;color:#fcd34d;word-break:break-all;">Tracking Link: <a href="${escapeHtml(trackingUrl)}" style="color:#fcd34d;">${escapeHtml(trackingUrl)}</a></p>` : ''}
      </div>`;

      const bodyHtml = `${trackingBoxHtml}${buildAddressHtml(order)}`;
      const html = wrapEmailLayout({
        badge: 'OUT FOR DELIVERY',
        headline: 'ARRIVING AT YOUR DOORSTEP TODAY.',
        intro,
        bodyHtml,
        ctaLabel: trackingUrl ? 'Track Delivery Live' : 'Track Your Order',
        ctaUrl: trackingUrl || `${appUrl}/track-order`,
        orderNumber,
      });

      const text = [
        `TORIWEAR — OUT FOR DELIVERY (${orderNumber})`,
        '',
        intro,
        `Courier Partner: ${courierPartner}`,
        trackingNumber ? `Tracking / AWB Number: ${trackingNumber}` : '',
        trackingUrl ? `Tracking URL: ${trackingUrl}` : `Track Order: ${appUrl}/track-order`,
      ]
        .filter(Boolean)
        .join('\n');

      return { subject, html, text };
    }

    case 'ORDER_DELIVERED': {
      const subject = `Order Delivered: ${orderNumber} — TORIWEAR`;
      const intro = `Hi ${customerName}, your TORIWEAR order ${orderNumber} has been delivered. We hope you love your new drop!`;

      const deliveredBoxHtml = `<div style="margin:16px 0;padding:16px;background:#0f1c15;border:1px solid #166534;border-radius:12px;">
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#86efac;font-weight:700;">Delivered Successfully</div>
        <p style="margin:8px 0 0;font-size:13px;color:#e4e4e7;">Delivered via <strong>${escapeHtml(courierPartner)}</strong>${trackingNumber ? ` (AWB: <span style="font-family:monospace;">${escapeHtml(trackingNumber)}</span>)` : ''}.</p>
      </div>`;

      const bodyHtml = `${deliveredBoxHtml}${buildItemsTableHtml(order)}${buildTotalsHtml(order)}`;
      const html = wrapEmailLayout({
        badge: 'ORDER DELIVERED',
        headline: 'YOUR DROP HAS ARRIVED.',
        intro,
        bodyHtml,
        ctaLabel: 'Shop More Drops',
        ctaUrl: appUrl,
        orderNumber,
      });

      const text = [
        `TORIWEAR — ORDER DELIVERED (${orderNumber})`,
        '',
        intro,
        `Courier Partner: ${courierPartner}`,
        trackingNumber ? `Tracking / AWB Number: ${trackingNumber}` : '',
        '',
        buildItemsText(order),
      ]
        .filter(Boolean)
        .join('\n');

      return { subject, html, text };
    }
  }
}
