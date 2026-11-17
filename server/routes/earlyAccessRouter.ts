import { Router, Request, Response, NextFunction } from 'express';
import { requireStaffPermission } from '../middleware/authMiddleware';
import { auditRepository } from '../repositories/auditRepository';
import {
  DatabaseUnavailableError,
  exportSubscribersCsvAdmin,
  getAdminEarlyAccessStats,
  listSubscribersAdmin,
  registerSubscriber,
  unsubscribeByToken,
  ValidationError,
} from '../services/earlyAccessService';
import {
  confirmAndDispatchCampaign,
  createDraftCampaign,
  handleResendWebhook,
  handleWhatsAppWebhook,
  listCampaignsAdmin,
  listDeliveriesAdmin,
  retryFailedCampaignDeliveries,
  sendTestCampaignNotification,
} from '../services/notifications/campaignOrchestrator';
import { getEmailProviderStatus } from '../services/notifications/resendEmailService';
import { getWhatsAppProviderStatus } from '../services/notifications/whatsappCloudService';

export const earlyAccessRouter = Router();

function createIpRateLimiter(windowMs: number, maxRequests: number, keyPrefix: string) {
  const hits = new Map<string, number[]>();
  const timer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [k, timestamps] of hits.entries()) {
      const fresh = timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) hits.delete(k);
      else hits.set(k, fresh);
    }
  }, Math.max(30000, windowMs));
  timer.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace('::ffff:', '');
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const cutoff = now - windowMs;
    const recent = (hits.get(key) || []).filter((t) => t > cutoff);
    if (recent.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        error: 'Too many requests. Please wait a few minutes before trying again.',
      });
    }
    recent.push(now);
    hits.set(key, recent);
    return next();
  };
}

const registerLimiter = createIpRateLimiter(15 * 60 * 1000, 20, 'early_access_reg');
const unsubscribeLimiter = createIpRateLimiter(15 * 60 * 1000, 40, 'early_access_unsub');

function handleServiceError(res: Response, err: any, extra?: Record<string, unknown>) {
  if (err instanceof DatabaseUnavailableError || err?.code === 'DATABASE_UNAVAILABLE') {
    return res.status(503).json({
      success: false,
      code: 'DATABASE_UNAVAILABLE',
      error: err.message,
      ...(extra || {}),
    });
  }
  if (err instanceof ValidationError || err?.code === 'VALIDATION_ERROR') {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      error: err.message,
      ...(extra || {}),
    });
  }
  console.error('[EARLY-ACCESS-API]', err?.message || err);
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    error: err?.message || 'Unexpected server error.',
    ...(extra || {}),
  });
}

// ============================================================================
// 1. PUBLIC EARLY ACCESS REGISTRATION & PREFERENCES
// ============================================================================
earlyAccessRouter.post('/v1/early-access/register', registerLimiter, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const result = await registerSubscriber({
      email: body.email,
      whatsappNumber: body.whatsappNumber,
      channel: body.channel,
      emailConsent: body.emailConsent,
      whatsappConsent: body.whatsappConsent,
      registrationSource: body.registrationSource || 'MAINTENANCE_SCREEN',
      metadata: body.metadata,
    });

    return res.status(result.duplicate && !result.updated ? 200 : 201).json({
      success: true,
      duplicate: result.duplicate,
      updated: result.updated,
      subscriber: result.subscriber,
      coupon: result.coupon,
      confirmationDeliveries: result.confirmationDeliveries,
      message: result.duplicate
        ? result.updated
          ? 'Your priority access preferences have been updated.'
          : 'You are already registered on the TORIWEAR Priority Access list.'
        : 'You are registered on the TORIWEAR Priority Access list.',
    });
  } catch (err: any) {
    return handleServiceError(res, err);
  }
});

earlyAccessRouter.post('/v1/early-access/newsletter', registerLimiter, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const result = await registerSubscriber({
      email: body.email,
      whatsappNumber: body.whatsappNumber,
      channel: body.channel || (body.whatsappNumber ? 'BOTH' : 'EMAIL'),
      emailConsent: body.emailConsent,
      whatsappConsent: body.whatsappConsent,
      registrationSource: body.registrationSource || 'NEWSLETTER_SIGNUP',
      metadata: body.metadata,
    });

    return res.status(result.duplicate && !result.updated ? 200 : 201).json({
      success: true,
      duplicate: result.duplicate,
      updated: result.updated,
      subscriber: result.subscriber,
      coupon: result.coupon,
      confirmationDeliveries: result.confirmationDeliveries,
      message: result.duplicate
        ? 'Your subscription preferences are verified.'
        : 'Welcome to the TORIWEAR Access List.',
    });
  } catch (err: any) {
    return handleServiceError(res, err);
  }
});

earlyAccessRouter.post('/v1/early-access/preferences', registerLimiter, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const result = await registerSubscriber({
      email: body.email,
      whatsappNumber: body.whatsappNumber,
      channel: body.channel,
      emailConsent: body.emailConsent,
      whatsappConsent: body.whatsappConsent,
      registrationSource: body.registrationSource || 'PREFERENCE_UPDATE',
      skipAutoConfirmation: true,
    });

    return res.json({
      success: true,
      updated: result.updated,
      subscriber: result.subscriber,
      message: 'Notification preferences saved.',
    });
  } catch (err: any) {
    return handleServiceError(res, err);
  }
});

// ============================================================================
// 2. PUBLIC SIGNED UNSUBSCRIBE / OPT-OUT (GET + RFC 8058 ONE-CLICK POST)
// ============================================================================
function renderUnsubscribeHtml(title: string, message: string, isError = false): string {
  const accent = isError ? '#ef4444' : '#10b981';
  const safeTitle = title.replace(/</g, '&lt;');
  const safeMessage = message.replace(/</g, '&lt;');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle} — TORIWEAR</title></head>
<body style="margin:0;background:#07070b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;">
  <div style="max-width:460px;width:100%;background:#111118;border:1px solid #27272a;border-radius:16px;padding:32px;text-align:center;">
    <div style="font-size:11px;letter-spacing:3px;color:${accent};font-weight:700;text-transform:uppercase;">TORIWEAR PREFERENCES</div>
    <h1 style="margin:12px 0 10px;font-size:22px;color:#ffffff;">${safeTitle}</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a1a1aa;">${safeMessage}</p>
    <a href="/" style="display:inline-block;padding:10px 20px;background:#27272a;color:#ffffff;text-decoration:none;border-radius:10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Return to TORIWEAR</a>
  </div>
</body>
</html>`;
}

async function handleUnsubscribeRequest(req: Request, res: Response) {
  try {
    const token = String(req.query.token || req.body?.token || '').trim();
    const rawChannel = String(req.query.channel || req.body?.channel || 'all').toLowerCase();
    const channel: 'email' | 'whatsapp' | 'all' =
      rawChannel === 'email' || rawChannel === 'whatsapp' ? rawChannel : 'all';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;

    if (!token) {
      if (req.headers.accept?.includes('application/json') || req.method === 'POST') {
        return res.status(400).json({ success: false, error: 'Unsubscribe token is required.' });
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).send(renderUnsubscribeHtml('Invalid Link', 'Missing unsubscribe verification token.', true));
    }

    const result = await unsubscribeByToken(token, channel, reason);
    const wantsJson =
      req.headers.accept?.includes('application/json') ||
      req.headers['content-type']?.includes('application/json');

    if (!result.success) {
      if (wantsJson || req.method === 'POST') {
        return res.status(400).json(result);
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).send(renderUnsubscribeHtml('Invalid or Expired Link', result.error || 'Could not verify unsubscribe request.', true));
    }

    if (wantsJson) {
      return res.json({
        success: true,
        channel: result.channel,
        subscriber: result.subscriber,
        message: 'You have been unsubscribed from TORIWEAR alerts.',
      });
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(
      renderUnsubscribeHtml(
        'Unsubscribed Successfully',
        `Your ${channel === 'all' ? 'Email & WhatsApp' : channel} launch alert preference has been opted out.`
      )
    );
  } catch (err: any) {
    return handleServiceError(res, err);
  }
}

earlyAccessRouter.get('/v1/early-access/unsubscribe', unsubscribeLimiter, handleUnsubscribeRequest);
earlyAccessRouter.post('/v1/early-access/unsubscribe', unsubscribeLimiter, handleUnsubscribeRequest);

// ============================================================================
// 3. PROVIDER WEBHOOKS (RESEND & META WHATSAPP CLOUD API)
// ============================================================================
earlyAccessRouter.post('/v1/webhooks/resend', async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body || {});
    const outcome = await handleResendWebhook({
      rawBody,
      headers: req.headers,
      body: req.body,
    });
    return res.status(outcome.statusCode).json(outcome.payload);
  } catch (err: any) {
    return handleServiceError(res, err);
  }
});

earlyAccessRouter.get('/v1/webhooks/whatsapp', (req: Request, res: Response) => {
  const mode = String(req.query['hub.mode'] || '');
  const verifyToken = String(req.query['hub.verify_token'] || '');
  const challenge = String(req.query['hub.challenge'] || '');
  const expectedToken = String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '').trim();

  if (mode === 'subscribe' && expectedToken && verifyToken === expectedToken) {
    return res.status(200).send(challenge);
  }
  return res.status(403).json({
    success: false,
    error: 'WhatsApp webhook verification failed.',
  });
});

earlyAccessRouter.post('/v1/webhooks/whatsapp', async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body || {});
    const sigHeader = String(req.headers['x-hub-signature-256'] || '');
    const outcome = await handleWhatsAppWebhook({
      rawBody,
      signatureHeader: sigHeader,
      body: req.body,
    });
    return res.status(outcome.statusCode).json(outcome.payload);
  } catch (err: any) {
    return handleServiceError(res, err);
  }
});

// ============================================================================
// 4. ADMIN EARLY ACCESS & LAUNCH CAMPAIGN ENDPOINTS
// ============================================================================
earlyAccessRouter.get(
  '/v1/admin/early-access/stats',
  requireStaffPermission('marketing.view'),
  async (_req: Request, res: Response) => {
    const providers = {
      email: getEmailProviderStatus(),
      whatsapp: getWhatsAppProviderStatus(),
    };
    try {
      const stats = await getAdminEarlyAccessStats();
      return res.json({
        success: true,
        dbReady: true,
        providers,
        data: stats,
      });
    } catch (err: any) {
      return handleServiceError(res, err, { dbReady: false, providers });
    }
  }
);

earlyAccessRouter.get(
  '/v1/admin/early-access/subscribers',
  requireStaffPermission('marketing.view'),
  async (req: Request, res: Response) => {
    try {
      const data = await listSubscribersAdmin({
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        channel: typeof req.query.channel === 'string' ? req.query.channel : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
        dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 25,
      });
      return res.json({ success: true, data });
    } catch (err: any) {
      return handleServiceError(res, err);
    }
  }
);

earlyAccessRouter.get(
  '/v1/admin/early-access/subscribers/export',
  requireStaffPermission('marketing.view'),
  async (req: Request, res: Response) => {
    try {
      const csv = await exportSubscribersCsvAdmin({
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        channel: typeof req.query.channel === 'string' ? req.query.channel : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
      });

      await auditRepository
        .record({
          userId: req.user?.id || 'system',
          userName: req.user?.name || 'System',
          userRole: req.user?.role as any,
          module: 'marketing',
          action: 'EARLY_ACCESS_SUBSCRIBERS_EXPORTED',
          recordAffected: 'early_access_subscribers',
          ipAddress: (req.ip || req.socket.remoteAddress || '').replace('::ffff:', ''),
          severity: 'INFO',
        })
        .catch(() => {});

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="toriwear-early-access-subscribers.csv"');
      return res.send(csv);
    } catch (err: any) {
      return handleServiceError(res, err);
    }
  }
);

earlyAccessRouter.get(
  '/v1/admin/early-access/campaigns',
  requireStaffPermission('marketing.view'),
  async (_req: Request, res: Response) => {
    try {
      const campaigns = await listCampaignsAdmin();
      return res.json({ success: true, data: campaigns });
    } catch (err: any) {
      return handleServiceError(res, err);
    }
  }
);

earlyAccessRouter.post(
  '/v1/admin/early-access/campaigns',
  requireStaffPermission('marketing.create'),
  async (req: Request, res: Response) => {
    try {
      const campaign = await createDraftCampaign(req.body || {}, req.user?.id);
      await auditRepository
        .record({
          userId: req.user?.id || 'system',
          userName: req.user?.name || 'System',
          userRole: req.user?.role as any,
          module: 'marketing',
          action: 'EARLY_ACCESS_CAMPAIGN_DRAFTED',
          recordAffected: campaign.id,
          newValue: `${campaign.name} (${campaign.channels})`,
          severity: 'INFO',
        })
        .catch(() => {});
      return res.status(201).json({ success: true, data: campaign });
    } catch (err: any) {
      return handleServiceError(res, err);
    }
  }
);

earlyAccessRouter.post(
  '/v1/admin/early-access/campaigns/:id/test',
  requireStaffPermission('marketing.edit'),
  async (req: Request, res: Response) => {
    try {
      const campaignId = String(req.params.id || '');
      const result = await sendTestCampaignNotification({
        campaignId,
        testEmail: req.body?.testEmail,
        testWhatsappNumber: req.body?.testWhatsappNumber,
        actorUserId: req.user?.id,
      });
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return handleServiceError(res, err);
    }
  }
);

earlyAccessRouter.post(
  '/v1/admin/early-access/campaigns/:id/confirm-send',
  requireStaffPermission('marketing.edit'),
  async (req: Request, res: Response) => {
    try {
      const campaignId = String(req.params.id || '');
      const result = await confirmAndDispatchCampaign({
        campaignId,
        confirmSend: req.body?.confirmSend === true,
        actorUserId: req.user?.id,
      });
      await auditRepository
        .record({
          userId: req.user?.id || 'system',
          userName: req.user?.name || 'System',
          userRole: req.user?.role as any,
          module: 'marketing',
          action: 'EARLY_ACCESS_CAMPAIGN_CONFIRMED_SEND',
          recordAffected: campaignId,
          newValue: `queued=${result.queuedCount}`,
          severity: 'WARNING',
        })
        .catch(() => {});
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return handleServiceError(res, err);
    }
  }
);

earlyAccessRouter.post(
  '/v1/admin/early-access/campaigns/:id/retry-failed',
  requireStaffPermission('marketing.edit'),
  async (req: Request, res: Response) => {
    try {
      const campaignId = String(req.params.id || '');
      const result = await retryFailedCampaignDeliveries({ campaignId });
      await auditRepository
        .record({
          userId: req.user?.id || 'system',
          userName: req.user?.name || 'System',
          userRole: req.user?.role as any,
          module: 'marketing',
          action: 'EARLY_ACCESS_CAMPAIGN_RETRY_FAILED',
          recordAffected: campaignId,
          newValue: `retried=${result.retriedCount}`,
          severity: 'INFO',
        })
        .catch(() => {});
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return handleServiceError(res, err);
    }
  }
);

earlyAccessRouter.get(
  '/v1/admin/early-access/deliveries',
  requireStaffPermission('marketing.view'),
  async (req: Request, res: Response) => {
    try {
      const data = await listDeliveriesAdmin({
        campaignId: typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        channel: typeof req.query.channel === 'string' ? req.query.channel : undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 30,
      });
      return res.json({ success: true, data });
    } catch (err: any) {
      return handleServiceError(res, err);
    }
  }
);
