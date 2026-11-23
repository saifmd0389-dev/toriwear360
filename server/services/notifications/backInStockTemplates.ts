import { normalizeOrderPhoneToE164, sanitizeTrackingUrl } from './orderWhatsAppTemplates';

export interface BackInStockNotificationPayload {
  subscriptionId: string;
  customerName?: string | null;
  productId: string;
  productName: string;
  productSlug?: string | null;
  productImage?: string | null;
  variantId: string;
  sku?: string | null;
  size: string;
  color: string;
  availableQuantity?: number;
}

export interface BackInStockWhatsAppTemplateConfig {
  configured: boolean;
  templateName: string | null;
  templateLang: string;
  envVarName: string;
  bodyParameters: string[];
  missingReason?: string;
}

export interface BackInStockEmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface BackInStockWebsiteContent {
  title: string;
  message: string;
  actionUrl: string;
}

export function normalizeBackInStockPhoneToE164(phone?: string | null): string | null {
  return normalizeOrderPhoneToE164(phone);
}

export function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function resolveSiteBaseUrl(): string {
  const raw = String(process.env.SITE_URL || process.env.APP_URL || 'https://thetoriwearstore.in').trim();
  const safe = sanitizeTrackingUrl(raw);
  return (safe || 'https://thetoriwearstore.in').replace(/\/+$/, '');
}

export function buildBackInStockProductUrl(payload: {
  productId: string;
  productSlug?: string | null;
  size?: string | null;
  color?: string | null;
}): string {
  const base = resolveSiteBaseUrl();
  const slugOrId = encodeURIComponent(String(payload.productSlug || payload.productId || '').trim());
  const params = new URLSearchParams();
  if (payload.size) params.set('size', String(payload.size).trim());
  if (payload.color) params.set('color', String(payload.color).trim());
  const qs = params.toString();
  const candidate = `${base}/product/${slugOrId}${qs ? `?${qs}` : ''}`;
  return sanitizeTrackingUrl(candidate) || `${base}/`;
}

export function buildBackInStockRelativeActionUrl(payload: {
  productId: string;
  productSlug?: string | null;
  size?: string | null;
  color?: string | null;
}): string {
  const slugOrId = encodeURIComponent(String(payload.productSlug || payload.productId || '').trim());
  const params = new URLSearchParams();
  if (payload.size) params.set('size', String(payload.size).trim());
  if (payload.color) params.set('color', String(payload.color).trim());
  const qs = params.toString();
  return `/product/${slugOrId}${qs ? `?${qs}` : ''}`;
}

function sanitizeTemplateParam(value: unknown, fallback: string): string {
  const clean = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return clean ? clean.slice(0, 120) : fallback;
}

/**
 * Resolves the Meta-approved WhatsApp Back-in-Stock template from environment variables.
 * NEVER uses hardcoded template names or falls back to Early Access / Order templates.
 *
 * Expected Meta Utility template body variables:
 *   {{1}} Customer Name
 *   {{2}} Product Name
 *   {{3}} Exact Variant (Size / Color)
 *   {{4}} Direct Product Link
 */
export function resolveBackInStockWhatsAppTemplate(
  payload: BackInStockNotificationPayload
): BackInStockWhatsAppTemplateConfig {
  const envVarName = 'WHATSAPP_BACK_IN_STOCK_TEMPLATE_NAME';
  const templateName = String(process.env.WHATSAPP_BACK_IN_STOCK_TEMPLATE_NAME || '').trim() || null;
  const templateLang =
    String(process.env.WHATSAPP_BACK_IN_STOCK_TEMPLATE_LANG || process.env.WHATSAPP_TEMPLATE_LANG || 'en').trim() || 'en';

  const customerName = sanitizeTemplateParam(payload.customerName, 'Toriwear Member');
  const productName = sanitizeTemplateParam(payload.productName, 'Toriwear Drop');
  const variantLabel = sanitizeTemplateParam(
    `Size ${payload.size}${payload.color ? ` · ${payload.color}` : ''}`,
    `Size ${payload.size}`
  );
  const productUrl = sanitizeTemplateParam(buildBackInStockProductUrl(payload), resolveSiteBaseUrl());

  if (!templateName) {
    return {
      configured: false,
      templateName: null,
      templateLang,
      envVarName,
      bodyParameters: [customerName, productName, variantLabel, productUrl],
      missingReason: `Meta WhatsApp template not configured. Set ${envVarName} to your Meta-approved back-in-stock template name.`,
    };
  }

  return {
    configured: true,
    templateName,
    templateLang,
    envVarName,
    bodyParameters: [customerName, productName, variantLabel, productUrl],
  };
}

export function getBackInStockWhatsAppTemplateHealth(): {
  whatsappCredentialsConfigured: boolean;
  templateConfigured: boolean;
  templateName: string | null;
  templateLang: string;
  envVarName: string;
} {
  const token = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const templateName = String(process.env.WHATSAPP_BACK_IN_STOCK_TEMPLATE_NAME || '').trim() || null;
  const templateLang =
    String(process.env.WHATSAPP_BACK_IN_STOCK_TEMPLATE_LANG || process.env.WHATSAPP_TEMPLATE_LANG || 'en').trim() || 'en';

  return {
    whatsappCredentialsConfigured: Boolean(token && phoneNumberId),
    templateConfigured: Boolean(templateName),
    templateName,
    templateLang,
    envVarName: 'WHATSAPP_BACK_IN_STOCK_TEMPLATE_NAME',
  };
}

export function buildBackInStockWebsiteNotification(
  payload: BackInStockNotificationPayload
): BackInStockWebsiteContent {
  const productName = String(payload.productName || 'Toriwear Drop').trim();
  const size = String(payload.size || '').trim();
  const color = String(payload.color || '').trim();
  const variantDesc = color ? `Size ${size} · ${color}` : `Size ${size}`;

  return {
    title: `Back in Stock: ${productName}`,
    message: `Your waitlisted ${productName} (${variantDesc}) is back in stock now. Grab yours before it sells out again.`,
    actionUrl: buildBackInStockRelativeActionUrl(payload),
  };
}

export function buildBackInStockEmail(payload: BackInStockNotificationPayload): BackInStockEmailContent {
  const safeName = escapeHtml(payload.customerName || 'Toriwear Member');
  const safeProduct = escapeHtml(payload.productName || 'Toriwear Piece');
  const safeSize = escapeHtml(payload.size);
  const safeColor = escapeHtml(payload.color || 'Original');
  const safeSku = payload.sku ? escapeHtml(payload.sku) : '';
  const productUrl = buildBackInStockProductUrl(payload);
  const safeUrl = escapeHtml(productUrl);
  const safeImageUrl = sanitizeTrackingUrl(payload.productImage || undefined);

  const subject = `Back in Stock: ${String(payload.productName || 'Toriwear Drop').replace(/[\r\n]/g, ' ').trim()} (Size ${String(payload.size).replace(/[\r\n]/g, ' ').trim()} · ${String(payload.color || 'Original').replace(/[\r\n]/g, ' ').trim()})`;

  const imageBlock = safeImageUrl
    ? `<div style="margin:0 0 20px;text-align:center;">
         <img src="${escapeHtml(safeImageUrl)}" alt="${safeProduct}" style="max-width:220px;width:100%;height:auto;border-radius:10px;border:1px solid #262626;display:inline-block;" />
       </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#070709;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#070709;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#111116;border:1px solid #24242c;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #24242c;background-color:#0c0c10;">
              <div style="font-size:20px;font-weight:900;letter-spacing:0.14em;color:#ffffff;">TORIWEAR</div>
              <div style="font-size:11px;letter-spacing:0.18em;color:#ff2028;margin-top:4px;font-weight:700;text-transform:uppercase;">BACK IN STOCK ALERT</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 14px;font-size:15px;color:#e5e5e5;">Hi ${safeName},</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#b8b8c2;">
                Good news — the exact Tori-Wear piece you asked to be notified about is back in stock.
              </p>
              ${imageBlock}
              <div style="background-color:#181820;border:1px solid #2b2b36;border-radius:10px;padding:16px 18px;margin-bottom:22px;">
                <div style="font-size:16px;font-weight:700;color:#ffffff;margin-bottom:8px;">${safeProduct}</div>
                <div style="font-size:13px;color:#d4d4dc;line-height:1.6;">
                  <strong>Size:</strong> ${safeSize}<br />
                  <strong>Color:</strong> ${safeColor}${safeSku ? `<br /><strong>SKU:</strong> ${safeSku}` : ''}
                </div>
              </div>
              <div style="text-align:center;margin:24px 0 8px;">
                <a href="${safeUrl}" style="display:inline-block;background-color:#e11b23;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;padding:14px 28px;border-radius:8px;">
                  Shop Your Size Now
                </a>
              </div>
              <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#8e8e9c;">
                Limited restock quantities are available on a first-come, first-served basis.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;border-top:1px solid #24242c;background-color:#0c0c10;font-size:11px;color:#7a7a88;">
              You received this one-time backup email because you requested a restock alert on TORIWEAR for ${safeProduct} (${safeSize} / ${safeColor}).
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `TORIWEAR — BACK IN STOCK ALERT`,
    ``,
    `Hi ${payload.customerName || 'Toriwear Member'},`,
    ``,
    `Good news — your waitlisted Tori-Wear piece is back in stock:`,
    `Product: ${payload.productName}`,
    `Size: ${payload.size}`,
    `Color: ${payload.color || 'Original'}`,
    payload.sku ? `SKU: ${payload.sku}` : null,
    ``,
    `Shop now: ${productUrl}`,
    ``,
    `You received this one-time backup email because you requested a restock alert for this exact variant on TORIWEAR.`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  return { subject, html, text };
}
