import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { AddressInfo } from 'net';

import { setPrismaClientOverrideForTests } from '../server/db/prisma';
import { earlyAccessRouter } from '../server/routes/earlyAccessRouter';
import { apiRouter } from '../server/routes/apiRouter';
import { authStore } from '../server/authStore';
import { userService } from '../server/services/userService';
import { couponRepository } from '../server/repositories/couponRepository';
import { productRepository } from '../server/repositories/productRepository';
import { orderService } from '../server/services/orderService';
import { sendResendEmail } from '../server/services/notifications/resendEmailService';
import { sendWhatsAppTemplateMessage } from '../server/services/notifications/whatsappCloudService';
import {
  buildUnsubscribeUrl,
  createSignedUnsubscribeToken,
  exportSubscribersCsvAdmin,
  registerSubscriber,
} from '../server/services/earlyAccessService';
import {
  confirmAndDispatchCampaign,
  createDraftCampaign,
  retryFailedCampaignDeliveries,
} from '../server/services/notifications/campaignOrchestrator';

// -----------------------------------------------------------------------------
// In-Memory Prisma Test Double (Strictly for automated unit/integration tests)
// -----------------------------------------------------------------------------
class InMemoryPrisma {
  private subscribers = new Map<string, any>();
  private campaigns = new Map<string, any>();
  private deliveries = new Map<string, any>();

  async $queryRaw() {
    return [{ ok: 1 }];
  }

  earlyAccessSubscriber = {
    findFirst: async ({ where }: any) => {
      for (const row of this.subscribers.values()) {
        if (where?.email && row.email === where.email) return { ...row };
        if (where?.whatsappNumber && row.whatsappNumber === where.whatsappNumber) return { ...row };
        if (Array.isArray(where?.OR)) {
          for (const cond of where.OR) {
            if (cond.email && row.email === cond.email) return { ...row };
            if (cond.whatsappNumber && row.whatsappNumber === cond.whatsappNumber) return { ...row };
          }
        }
      }
      return null;
    },
    findUnique: async ({ where }: any) => {
      if (where?.id) return this.subscribers.get(where.id) ? { ...this.subscribers.get(where.id) } : null;
      if (where?.email) {
        for (const r of this.subscribers.values()) if (r.email === where.email) return { ...r };
      }
      if (where?.whatsappNumber) {
        for (const r of this.subscribers.values()) if (r.whatsappNumber === where.whatsappNumber) return { ...r };
      }
      return null;
    },
    create: async ({ data }: any) => {
      const now = new Date();
      const rec = {
        ...data,
        email: data.email ?? null,
        whatsappNumber: data.whatsappNumber ?? null,
        emailConsent: Boolean(data.emailConsent),
        whatsappConsent: Boolean(data.whatsappConsent),
        emailConsentAt: data.emailConsentAt ?? null,
        whatsappConsentAt: data.whatsappConsentAt ?? null,
        couponEligible: data.couponEligible !== false,
        status: data.status || 'ACTIVE',
        createdAt: data.createdAt || now,
        updatedAt: now,
      };
      this.subscribers.set(rec.id, rec);
      return { ...rec };
    },
    update: async ({ where, data }: any) => {
      const cur = this.subscribers.get(where.id);
      if (!cur) throw new Error('Subscriber not found');
      const next = { ...cur, ...data, updatedAt: new Date() };
      this.subscribers.set(where.id, next);
      return { ...next };
    },
    count: async ({ where }: any = {}) => {
      return (await this.earlyAccessSubscriber.findMany({ where })).length;
    },
    findMany: async ({ where, skip = 0, take = 500 }: any = {}) => {
      let rows = Array.from(this.subscribers.values());
      if (where) {
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.emailConsent !== undefined) rows = rows.filter((r) => Boolean(r.emailConsent) === where.emailConsent);
        if (where.whatsappConsent !== undefined) {
          rows = rows.filter((r) => Boolean(r.whatsappConsent) === where.whatsappConsent);
        }
        if (where.preferredChannel) rows = rows.filter((r) => r.preferredChannel === where.preferredChannel);
        if (Array.isArray(where.OR)) {
          rows = rows.filter((r) =>
            where.OR.some((cond: any) => {
              if (cond.email?.contains) return String(r.email || '').includes(cond.email.contains);
              if (cond.whatsappNumber?.contains) return String(r.whatsappNumber || '').includes(cond.whatsappNumber.contains);
              if (cond.registrationSource?.contains) {
                return String(r.registrationSource || '').includes(cond.registrationSource.contains);
              }
              if (cond.emailConsent === true) return Boolean(r.emailConsent);
              if (cond.whatsappConsent === true) return Boolean(r.whatsappConsent);
              return false;
            })
          );
        }
      }
      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return rows.slice(skip, skip + take).map((r) => ({ ...r }));
    },
  };

  notificationCampaign = {
    create: async ({ data }: any) => {
      const now = new Date();
      const rec = {
        totalRecipients: 0,
        sentCount: 0,
        deliveredCount: 0,
        readCount: 0,
        failedCount: 0,
        ...data,
        createdAt: data.createdAt || now,
        updatedAt: now,
      };
      this.campaigns.set(rec.id, rec);
      return { ...rec };
    },
    findUnique: async ({ where }: any) => {
      const rec = this.campaigns.get(where.id);
      return rec ? { ...rec } : null;
    },
    update: async ({ where, data }: any) => {
      const cur = this.campaigns.get(where.id);
      if (!cur) throw new Error('Campaign not found');
      const next = { ...cur, ...data, updatedAt: new Date() };
      this.campaigns.set(where.id, next);
      return { ...next };
    },
    count: async () => this.campaigns.size,
    findMany: async () => {
      return Array.from(this.campaigns.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((c) => ({ ...c }));
    },
  };

  notificationDelivery = {
    create: async ({ data }: any) => {
      const now = new Date();
      const rec = {
        attemptCount: 0,
        status: 'PENDING',
        ...data,
        createdAt: data.createdAt || now,
        updatedAt: now,
      };
      this.deliveries.set(rec.id, rec);
      return { ...rec };
    },
    findFirst: async ({ where }: any) => {
      for (const d of this.deliveries.values()) {
        if (where?.idempotencyKey && d.idempotencyKey === where.idempotencyKey) return { ...d };
        if (where?.providerMessageId && d.providerMessageId === where.providerMessageId) return { ...d };
      }
      return null;
    },
    findUnique: async ({ where }: any) => {
      const d = this.deliveries.get(where.id);
      return d ? { ...d } : null;
    },
    update: async ({ where, data }: any) => {
      const cur = this.deliveries.get(where.id);
      if (!cur) throw new Error('Delivery not found');
      const next: any = { ...cur };
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && 'increment' in (v as any)) {
          next[k] = Number(next[k] || 0) + Number((v as any).increment);
        } else {
          next[k] = v;
        }
      }
      next.updatedAt = new Date();
      this.deliveries.set(where.id, next);
      return { ...next };
    },
    count: async ({ where }: any = {}) => {
      return (await this.notificationDelivery.findMany({ where })).length;
    },
    findMany: async ({ where, skip = 0, take = 500 }: any = {}) => {
      let rows = Array.from(this.deliveries.values());
      if (where) {
        if (where.campaignId !== undefined) rows = rows.filter((r) => r.campaignId === where.campaignId);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.channel) rows = rows.filter((r) => r.channel === where.channel);
        if (where.subscriberId) rows = rows.filter((r) => r.subscriberId === where.subscriberId);
      }
      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return rows.slice(skip, skip + take).map((r) => ({ ...r }));
    },
  };
}

function createTestServer() {
  const app = express();
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );
  app.use('/api', earlyAccessRouter);
  app.use('/api', apiRouter);
  return app;
}

async function withServer(fn: (baseUrl: string) => Promise<void>) {
  const app = createTestServer();
  const server = await new Promise<import('http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function saveCouponStoreSnapshot() {
  const paths = [
    path.join(process.cwd(), 'server', 'data', 'coupons-store.json'),
    path.join(process.cwd(), 'server', 'runtime-data', 'coupons-store.json'),
    path.join(process.cwd(), 'server', 'data', 'coupon-usages-store.json'),
    path.join(process.cwd(), 'server', 'runtime-data', 'coupon-usages-store.json'),
  ];
  const snapshot = new Map<string, string | null>();
  for (const p of paths) {
    snapshot.set(p, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
  }
  return () => {
    for (const [p, content] of snapshot.entries()) {
      if (content === null) {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } else {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, content, 'utf8');
      }
    }
    couponRepository.reloadFromDisk();
  };
}

test('Fail-closed DB unavailable returns 503 for public registration & admin stats (zero fake success)', async () => {
  setPrismaClientOverrideForTests(null);

  await withServer(async (baseUrl) => {
    const regResp = await fetch(`${baseUrl}/api/v1/early-access/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'fan@example.com',
        channel: 'EMAIL',
        emailConsent: true,
        whatsappConsent: false,
      }),
    });
    assert.equal(regResp.status, 503);
    const regJson = await regResp.json();
    assert.equal(regJson.success, false);
    assert.equal(regJson.code, 'DATABASE_UNAVAILABLE');

    const newsResp = await fetch(`${baseUrl}/api/v1/early-access/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'newsletter@example.com',
        emailConsent: true,
      }),
    });
    assert.equal(newsResp.status, 503);
    const newsJson = await newsResp.json();
    assert.equal(newsJson.code, 'DATABASE_UNAVAILABLE');
  });
});

test('Early access registration enforces validation, explicit consent, duplicate merging, and provider delivery logging', async () => {
  const db = new InMemoryPrisma();
  setPrismaClientOverrideForTests(db);

  const prevEnv = { ...process.env };
  process.env.EMAIL_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 're_test_key_placeholder';
  process.env.EMAIL_FROM_ADDRESS = 'TORIWEAR <drops@toriwear.test>';
  process.env.WHATSAPP_ACCESS_TOKEN = 'wa_test_token_placeholder';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '12345678901';
  process.env.WHATSAPP_CONFIRM_TEMPLATE_NAME = 'early_access_confirm';
  process.env.WHATSAPP_TEMPLATE_NAME = 'drop_launch';

  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<{ url: string; init: any }> = [];
  let resendAttempts = 0;

  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    if (url.startsWith('http://127.0.0.1:')) {
      return originalFetch(input, init);
    }
    fetchCalls.push({ url, init });

    if (url === 'https://api.resend.com/emails') {
      resendAttempts += 1;
      if (resendAttempts === 1) {
        return new Response(JSON.stringify({ message: 'Transient error' }), { status: 500 });
      }
      return new Response(JSON.stringify({ id: `re_msg_${resendAttempts}` }), { status: 200 });
    }
    if (url.includes('graph.facebook.com')) {
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.test.001' }] }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  try {
    // Missing consent rejected
    await assert.rejects(
      () =>
        registerSubscriber({
          email: 'noconsent@example.com',
          channel: 'EMAIL',
          emailConsent: false,
        }),
      (err: any) => err.statusCode === 400
    );

    // Invalid email rejected
    await assert.rejects(
      () =>
        registerSubscriber({
          email: 'not-an-email',
          channel: 'EMAIL',
          emailConsent: true,
        }),
      (err: any) => err.statusCode === 400
    );

    // Non-E.164 WhatsApp number rejected
    await assert.rejects(
      () =>
        registerSubscriber({
          whatsappNumber: '9876543210',
          channel: 'WHATSAPP',
          whatsappConsent: true,
        }),
      (err: any) => err.statusCode === 400 && err.message.includes('country code')
    );

    // Valid email registration (also confirms Resend retry works without delay blocking)
    const emailRes = await registerSubscriber({
      email: ' OtakuFan@Example.com ',
      channel: 'EMAIL',
      emailConsent: true,
      registrationSource: 'MAINTENANCE_SCREEN',
    });
    assert.equal(emailRes.duplicate, false);
    assert.equal(emailRes.subscriber.emailConsent, true);
    assert.ok(emailRes.subscriber.emailConsentAt);
    assert.equal(emailRes.coupon.active, false);

    // Registering same email + adding WhatsApp merges cleanly without creating duplicate record
    const mergedRes = await registerSubscriber({
      email: 'otakufan@example.com',
      whatsappNumber: '+919876543210',
      channel: 'BOTH',
      emailConsent: true,
      whatsappConsent: true,
      registrationSource: 'MAINTENANCE_SCREEN',
    });
    assert.equal(mergedRes.duplicate, true);
    assert.equal(mergedRes.updated, true);
    assert.equal(mergedRes.subscriber.id, emailRes.subscriber.id);
    assert.equal(mergedRes.subscriber.whatsappConsent, true);
    assert.equal(await db.earlyAccessSubscriber.count(), 1);

    // Verify Resend call headers & WhatsApp Cloud API call payload
    const resendCall = fetchCalls.find((c) => c.url === 'https://api.resend.com/emails');
    assert.ok(resendCall);
    const resendBody = JSON.parse(resendCall.init.body);
    assert.ok(resendBody.headers['List-Unsubscribe']);
    assert.equal(resendBody.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');

    const waCall = fetchCalls.find((c) => c.url.includes('graph.facebook.com'));
    assert.ok(waCall);
    const waBody = JSON.parse(waCall.init.body);
    assert.equal(waBody.messaging_product, 'whatsapp');
    assert.equal(waBody.type, 'template');
    assert.equal(waBody.to, '919876543210');

    // Missing API key returns explicit failure rather than silent fake success
    delete process.env.RESEND_API_KEY;
    const missingKeyRes = await sendResendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
      text: 'Test',
      unsubscribeUrl: 'https://toriwear.test/unsub',
      idempotencyKey: 'missing-key-test',
    });
    assert.equal(missingKeyRes.success, false);
    assert.equal(missingKeyRes.configMissing, true);

    delete process.env.WHATSAPP_ACCESS_TOKEN;
    const missingWaRes = await sendWhatsAppTemplateMessage({
      toE164: '+919876543210',
      templateName: 'drop_launch',
    });
    assert.equal(missingWaRes.success, false);
    assert.equal(missingWaRes.configMissing, true);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = prevEnv;
    setPrismaClientOverrideForTests(null);
  }
});

test('Signed opt-out, Meta & Resend webhook signatures, monotonic delivery states, and STOP keyword revocation', async () => {
  const db = new InMemoryPrisma();
  setPrismaClientOverrideForTests(db);

  const prevEnv = { ...process.env };
  process.env.UNSUBSCRIBE_TOKEN_SECRET = 'test-unsub-hmac-secret-0123456789';
  process.env.EMAIL_WEBHOOK_SECRET = `whsec_${Buffer.from('svix-test-secret-bytes-123').toString('base64')}`;
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'wa-verify-token-xyz';
  process.env.WHATSAPP_APP_SECRET = 'meta-app-secret-abc';

  try {
    const sub = await db.earlyAccessSubscriber.create({
      data: {
        id: 'sub_webhook_1',
        email: 'webhookuser@example.com',
        whatsappNumber: '+919111222333',
        preferredChannel: 'BOTH',
        emailConsent: true,
        whatsappConsent: true,
        emailConsentAt: new Date(),
        whatsappConsentAt: new Date(),
        registrationSource: 'TEST',
        status: 'ACTIVE',
      },
    });
    const signed = createSignedUnsubscribeToken(sub.id);
    await db.earlyAccessSubscriber.update({
      where: { id: sub.id },
      data: { unsubscribeTokenHash: signed.tokenHash },
    });

    await db.notificationDelivery.create({
      data: {
        id: 'del_email_1',
        subscriberId: sub.id,
        channel: 'EMAIL',
        eventType: 'LAUNCH_CAMPAIGN',
        recipientMask: 'we***@example.com',
        providerName: 'resend',
        providerMessageId: 're_webhook_101',
        idempotencyKey: 'idem-email-1',
        status: 'SENT',
      },
    });
    await db.notificationDelivery.create({
      data: {
        id: 'del_wa_1',
        subscriberId: sub.id,
        channel: 'WHATSAPP',
        eventType: 'LAUNCH_CAMPAIGN',
        recipientMask: '+91•••333',
        providerName: 'meta_whatsapp_cloud',
        providerMessageId: 'wamid.webhook.202',
        idempotencyKey: 'idem-wa-1',
        status: 'SENT',
      },
    });

    await withServer(async (baseUrl) => {
      // 1. Meta webhook GET challenge verification
      const badChallenge = await fetch(
        `${baseUrl}/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123`
      );
      assert.equal(badChallenge.status, 403);

      const goodChallenge = await fetch(
        `${baseUrl}/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wa-verify-token-xyz&hub.challenge=CHALLENGE_OK`
      );
      assert.equal(goodChallenge.status, 200);
      assert.equal(await goodChallenge.text(), 'CHALLENGE_OK');

      // 2. Resend webhook rejects invalid signature
      const badResend = await fetch(`${baseUrl}/api/v1/webhooks/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': 'msg_1',
          'svix-timestamp': String(Math.floor(Date.now() / 1000)),
          'svix-signature': 'v1,invalidsig',
        },
        body: JSON.stringify({ type: 'email.delivered', data: { email_id: 're_webhook_101' } }),
      });
      assert.equal(badResend.status, 401);

      // 3. Valid Resend delivered event -> transitions SENT -> DELIVERED
      const resendPayload = JSON.stringify({
        type: 'email.delivered',
        data: { email_id: 're_webhook_101' },
      });
      const svixId = 'msg_ok_1';
      const svixTs = String(Math.floor(Date.now() / 1000));
      const secretBytes = Buffer.from('svix-test-secret-bytes-123');
      const sig = crypto
        .createHmac('sha256', secretBytes)
        .update(`${svixId}.${svixTs}.${resendPayload}`)
        .digest('base64');

      const goodResend = await fetch(`${baseUrl}/api/v1/webhooks/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': svixId,
          'svix-timestamp': svixTs,
          'svix-signature': `v1,${sig}`,
        },
        body: resendPayload,
      });
      assert.equal(goodResend.status, 200);
      assert.equal((await db.notificationDelivery.findUnique({ where: { id: 'del_email_1' } })).status, 'DELIVERED');

      // 4. Late 'email.sent' event MUST NOT downgrade DELIVERED back to SENT
      const lateSentPayload = JSON.stringify({
        type: 'email.sent',
        data: { email_id: 're_webhook_101' },
      });
      const lateSig = crypto
        .createHmac('sha256', secretBytes)
        .update(`msg_late_2.${svixTs}.${lateSentPayload}`)
        .digest('base64');
      await fetch(`${baseUrl}/api/v1/webhooks/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': 'msg_late_2',
          'svix-timestamp': svixTs,
          'svix-signature': `v1,${lateSig}`,
        },
        body: lateSentPayload,
      });
      assert.equal((await db.notificationDelivery.findUnique({ where: { id: 'del_email_1' } })).status, 'DELIVERED');

      // 5. WhatsApp webhook rejects invalid signature, processes delivered -> read -> inbound STOP opt-out
      const waPayload = JSON.stringify({
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [{ id: 'wamid.webhook.202', status: 'read' }],
                  messages: [{ from: '919111222333', text: { body: 'STOP' } }],
                },
              },
            ],
          },
        ],
      });
      const badWa = await fetch(`${baseUrl}/api/v1/webhooks/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': 'sha256=deadbeef' },
        body: waPayload,
      });
      assert.equal(badWa.status, 401);

      const validWaSig =
        'sha256=' +
        crypto.createHmac('sha256', 'meta-app-secret-abc').update(waPayload).digest('hex');
      const goodWa = await fetch(`${baseUrl}/api/v1/webhooks/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': validWaSig },
        body: waPayload,
      });
      assert.equal(goodWa.status, 200);
      assert.equal((await db.notificationDelivery.findUnique({ where: { id: 'del_wa_1' } })).status, 'READ');

      const afterStop = await db.earlyAccessSubscriber.findUnique({ where: { id: sub.id } });
      assert.equal(afterStop.whatsappConsent, false);
      assert.equal(afterStop.emailConsent, true);

      // 6. Tampered unsubscribe token rejected; genuine signed GET/POST unsubscribes email
      const tamperedRes = await fetch(`${baseUrl}/api/v1/early-access/unsubscribe?token=tampered.token&channel=email`, {
        headers: { Accept: 'application/json' },
      });
      assert.equal(tamperedRes.status, 400);

      const unsubUrl = buildUnsubscribeUrl(signed.token, 'email').replace(/^https?:\/\/[^/]+/, baseUrl);
      const validUnsub = await fetch(unsubUrl, { method: 'POST', headers: { Accept: 'application/json' } });
      assert.equal(validUnsub.status, 200);

      const afterAllOptOut = await db.earlyAccessSubscriber.findUnique({ where: { id: sub.id } });
      assert.equal(afterAllOptOut.emailConsent, false);
      assert.equal(afterAllOptOut.status, 'UNSUBSCRIBED');
    });
  } finally {
    process.env = prevEnv;
    setPrismaClientOverrideForTests(null);
  }
});

test('Admin RBAC, CSV formula neutralization, draft/confirmSend campaign orchestration & retryFailed', async () => {
  const db = new InMemoryPrisma();
  setPrismaClientOverrideForTests(db);

  const prevEnv = { ...process.env };
  process.env.EMAIL_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.EMAIL_FROM_ADDRESS = 'TORIWEAR <drops@toriwear.test>';
  process.env.WHATSAPP_ACCESS_TOKEN = 'wa_test_token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '12345678901';
  process.env.WHATSAPP_TEMPLATE_NAME = 'drop_launch';

  // Stub session validators cleanly for RBAC route tests
  const origValidateSession = userService.validateSession;
  const origLegacyToken = authStore.getUserByTokenAsync;
  userService.validateSession = (async (token: string) => {
    if (token === 'admin-token') {
      return {
        user: {
          id: 'usr-admin-test',
          email: 'admin@toriwear.com',
          name: 'Admin Tester',
          role: 'SUPER_ADMIN',
          department: 'Executive',
        },
      } as any;
    }
    if (token === 'viewer-token') {
      return {
        user: {
          id: 'usr-viewer-test',
          email: 'viewer@toriwear.com',
          name: 'Viewer Tester',
          role: 'VIEWER',
          department: 'Support',
        },
      } as any;
    }
    return null;
  }) as any;
  authStore.getUserByTokenAsync = (async () => null) as any;

  const originalFetch = globalThis.fetch;
  let failOnce = true;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    if (url.startsWith('http://127.0.0.1:')) return originalFetch(input, init);
    if (url === 'https://api.resend.com/emails') {
      if (failOnce) {
        failOnce = false;
        return new Response(JSON.stringify({ message: 'Rate limited' }), { status: 400 });
      }
      return new Response(JSON.stringify({ id: 're_batch_ok' }), { status: 200 });
    }
    if (url.includes('graph.facebook.com')) {
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.batch.ok' }] }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  try {
    await db.earlyAccessSubscriber.create({
      data: {
        id: 'sub_batch_1',
        email: 'vip@example.com',
        whatsappNumber: '+919988776655',
        preferredChannel: 'BOTH',
        emailConsent: true,
        whatsappConsent: true,
        emailConsentAt: new Date(),
        whatsappConsentAt: new Date(),
        registrationSource: '=CMD("evil")',
        status: 'ACTIVE',
      },
    });

    // CSV formula-injection neutralization check
    const csv = await exportSubscribersCsvAdmin({});
    assert.ok(csv.includes('"\'=CMD(""evil"")"'));

    // RBAC check via HTTP server
    await withServer(async (baseUrl) => {
      const unauthStats = await fetch(`${baseUrl}/api/v1/admin/early-access/stats`);
      assert.equal(unauthStats.status, 401);

      const viewerCreate = await fetch(`${baseUrl}/api/v1/admin/early-access/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer viewer-token',
        },
        body: JSON.stringify({ name: 'Unauthorized Drop', channels: 'EMAIL' }),
      });
      assert.equal(viewerCreate.status, 403);

      const adminStats = await fetch(`${baseUrl}/api/v1/admin/early-access/stats`, {
        headers: { Authorization: 'Bearer admin-token' },
      });
      assert.equal(adminStats.status, 200);
      const adminJson = await adminStats.json();
      assert.equal(adminJson.data.activeSubscribers, 1);
    });

    // Draft -> explicit confirmSend required -> partial failure -> retryFailed recovers
    const draft = await createDraftCampaign(
      {
        name: 'Drop 001 Official Launch',
        channels: 'BOTH',
        subject: 'DROP 001 LIVE',
        emailText: 'Vault open.',
        whatsappTemplateName: 'drop_launch',
      },
      'usr-admin-test'
    );

    await assert.rejects(
      () =>
        confirmAndDispatchCampaign({
          campaignId: draft.id,
          confirmSend: false,
        }),
      (err: any) => err.statusCode === 400
    );

    const dispatched = await confirmAndDispatchCampaign({
      campaignId: draft.id,
      confirmSend: true,
      awaitCompletion: true,
      retryDelayMs: 0,
    });
    assert.equal(dispatched.queuedCount, 2);
    assert.equal(dispatched.campaign.failedCount, 1);
    assert.equal(dispatched.campaign.sentCount, 1);

    const retried = await retryFailedCampaignDeliveries({
      campaignId: draft.id,
      awaitCompletion: true,
      retryDelayMs: 0,
    });
    assert.equal(retried.retriedCount, 1);
    assert.equal(retried.campaign.failedCount, 0);
    assert.equal(retried.campaign.sentCount, 2);
  } finally {
    userService.validateSession = origValidateSession;
    authStore.getUserByTokenAsync = origLegacyToken;
    globalThis.fetch = originalFetch;
    process.env = prevEnv;
    setPrismaClientOverrideForTests(null);
  }
});

test('TORI100 coupon safety: inactive by default, shipping/tax excluded, cap/usage/per-user/category rules & orderService integrity', async () => {
  const restoreStore = saveCouponStoreSnapshot();
  try {
    // 1. TORI100 is PAUSED (inactive) by default
    const defaultValidation = await couponRepository.validateWithContext({
      code: 'TORI100',
      subtotal: 2000,
    });
    assert.equal(defaultValidation.valid, false);
    assert.ok(defaultValidation.reason?.toLowerCase().includes('paused') || defaultValidation.reason?.toLowerCase().includes('inactive'));

    // 2. Create isolated temporary 100%-benefit test coupon mimicking configured TORI100 rules
    const tempCoupon = await couponRepository.create(
      {
        code: 'TESTTORI100',
        discountType: 'PERCENTAGE',
        value: 100,
        maxDiscount: 2500,
        minOrderValue: 999,
        usageLimit: 5,
        perUserLimit: 1,
        eligibleCategories: ['Oversized Tees'],
        eligibleProductIds: [],
        excludeShipping: true,
        excludeTax: true,
        startDate: new Date('2025-01-01T00:00:00.000Z'),
        expiryDate: new Date('2030-12-31T23:59:59.000Z'),
        isActive: true,
        description: 'Test TORI100 rules',
      },
      'TEST_SUITE'
    );

    // Below minOrderValue rejected
    const tooLow = await couponRepository.validateWithContext({
      code: tempCoupon.code,
      subtotal: 500,
    });
    assert.equal(tooLow.valid, false);

    // Mixed cart: only eligible category ('Oversized Tees' = 1499) counts; ineligible ('Hoodies' = 1999) ignored
    const mixed = await couponRepository.validateWithContext({
      code: tempCoupon.code,
      subtotal: 3498,
      items: [
        { productId: 'p1', category: 'Oversized Tees', lineTotal: 1499 },
        { productId: 'p2', category: 'Hoodies', lineTotal: 1999 },
      ],
    });
    assert.equal(mixed.valid, true);
    assert.equal(mixed.eligibleSubtotal, 1499);
    assert.equal(mixed.discount, 1499);

    // Max discount cap enforcement (2500 cap on 4000 eligible cart)
    const capped = await couponRepository.validateWithContext({
      code: tempCoupon.code,
      subtotal: 4000,
      items: [{ productId: 'p1', category: 'Oversized Tees', lineTotal: 4000 }],
    });
    assert.equal(capped.valid, true);
    assert.equal(capped.discount, 2500);

    // Record 1 redemption for customer -> second attempt for same customer blocked by perUserLimit = 1
    await couponRepository.recordRedemption({
      code: tempCoupon.code,
      orderId: 'ord-test-1',
      customerId: 'cust-test-1',
      customerEmail: 'buyer@example.com',
      discountAmount: 1499,
    });

    const repeatAttempt = await couponRepository.validateWithContext({
      code: tempCoupon.code,
      subtotal: 1500,
      items: [{ productId: 'p1', category: 'Oversized Tees', lineTotal: 1500 }],
      customerEmail: 'buyer@example.com',
    });
    assert.equal(repeatAttempt.valid, false);
    assert.ok(repeatAttempt.reason?.toLowerCase().includes('per customer') || repeatAttempt.reason?.toLowerCase().includes('redeemed'));

    // Expired coupon rejection
    const expiredCoupon = await couponRepository.create(
      {
        code: 'TESTEXPIRED',
        discountType: 'PERCENTAGE',
        value: 50,
        minOrderValue: 0,
        startDate: new Date('2024-01-01T00:00:00.000Z'),
        expiryDate: new Date('2024-02-01T00:00:00.000Z'),
        isActive: true,
      },
      'TEST_SUITE'
    );
    const expCheck = await couponRepository.validateWithContext({
      code: expiredCoupon.code,
      subtotal: 2000,
    });
    assert.equal(expCheck.valid, false);

    // Verify orderService.calculateQuote excludes shippingFee & tax from coupon discount
    const origFindProduct = productRepository.findById.bind(productRepository);
    (productRepository as any).findById = async (id: string) => {
      if (id === 'test-tee-1') {
        return {
          id: 'test-tee-1',
          name: 'Test Heavyweight Tee',
          price: 1499,
          categoryId: 'Oversized Tees',
          world: 'SHINOBI',
          department: 'MEN',
          images: ['/test.jpg'],
          variants: [{ id: 'var-1', sku: 'TEST-L', size: 'L', price: 1499, stock: 10 }],
        };
      }
      return origFindProduct(id);
    };
    try {
      const quoteRes = await orderService.calculateQuote({
        items: [{ productId: 'test-tee-1', size: 'L', quantity: 1 }],
        couponCode: tempCoupon.code, // customerId/email omitted -> evaluates 100% discount on tee, shipping remains 79
      });
      assert.equal(quoteRes.success, true);
      assert.ok(quoteRes.quote);
      assert.equal(quoteRes.quote.subtotal, 1499);
      assert.equal(quoteRes.quote.discount, 1499);
      assert.equal(quoteRes.quote.shippingFee, 79); // Shipping is NEVER discounted by TORI100
      assert.equal(quoteRes.quote.total, 79);
    } finally {
      (productRepository as any).findById = origFindProduct;
    }
  } finally {
    restoreStore();
  }
});
