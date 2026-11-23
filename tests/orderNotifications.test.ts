import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate all fallback JSON stores to a temporary directory BEFORE loading repositories
const tempRuntimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toriwear-order-notif-test-'));
process.env.TORI_RUNTIME_DATA_DIR = tempRuntimeDir;

const { setPrismaClientOverrideForTests } = await import('../server/db/prisma');
const { orderService } = await import('../server/services/orderService');
const { paymentService } = await import('../server/services/paymentService');
const { shippingService } = await import('../server/services/shippingService');
const { orderRepository } = await import('../server/repositories/orderRepository');
const { productRepository } = await import('../server/repositories/productRepository');
const { inventoryRepository } = await import('../server/repositories/inventoryRepository');
const { shippingRepository } = await import('../server/repositories/shippingRepository');
const { logisticsPartnerRepository } = await import('../server/repositories/logisticsPartnerRepository');
const { paymentConfigService } = await import('../server/services/paymentConfigService');
const {
  getEmailProviderStatus,
  sendResendEmail,
} = await import('../server/services/notifications/resendEmailService');
const {
  dispatchOrderNotification,
  getOrderNotificationDeliveries,
  resetFallbackOrderDeliveriesForTests,
  retryFailedOrderNotification,
  waitForPendingOrderNotifications,
} = await import('../server/services/notifications/orderNotificationService');
const {
  assessOrderCancellationRefund,
  normalizeOrderPhoneToE164,
} = await import('../server/services/notifications/orderWhatsAppTemplates');
const { buildOrderTransactionalEmail } = await import('../server/services/notifications/orderEmailTemplates');
const { handleWhatsAppWebhook } = await import('../server/services/notifications/campaignOrchestrator');

test.after(() => {
  try {
    fs.rmSync(tempRuntimeDir, { recursive: true, force: true });
  } catch {}
});

// -----------------------------------------------------------------------------
// In-Memory Prisma Test Double (enforces @unique idempotencyKey like MySQL)
// -----------------------------------------------------------------------------
class InMemoryNotificationPrisma {
  public deliveries = new Map<string, any>();
  public subscribers = new Map<string, any>();

  async $queryRaw() {
    return [{ ok: 1 }];
  }

  earlyAccessSubscriber = {
    findUnique: async ({ where }: any) => {
      if (where?.whatsappNumber) {
        for (const s of this.subscribers.values()) {
          if (s.whatsappNumber === where.whatsappNumber) return { ...s };
        }
      }
      if (where?.id) return this.subscribers.get(where.id) || null;
      return null;
    },
    update: async ({ where, data }: any) => {
      const existing = this.subscribers.get(where.id);
      if (!existing) throw new Error('Not found');
      const updated = { ...existing, ...data, updatedAt: new Date() };
      this.subscribers.set(where.id, updated);
      return { ...updated };
    },
  };

  notificationDelivery = {
    findUnique: async ({ where }: any) => {
      if (where?.id) {
        const rec = this.deliveries.get(where.id);
        return rec ? { ...rec } : null;
      }
      if (where?.idempotencyKey) {
        for (const rec of this.deliveries.values()) {
          if (rec.idempotencyKey === where.idempotencyKey) return { ...rec };
        }
      }
      return null;
    },
    findFirst: async ({ where }: any) => {
      for (const rec of this.deliveries.values()) {
        if (where?.providerMessageId && rec.providerMessageId === where.providerMessageId) {
          return { ...rec };
        }
      }
      return null;
    },
    findMany: async ({ where }: any) => {
      const list: any[] = [];
      for (const rec of this.deliveries.values()) {
        if (where?.orderId && rec.orderId !== where.orderId) continue;
        list.push({ ...rec });
      }
      return list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    create: async ({ data }: any) => {
      for (const rec of this.deliveries.values()) {
        if (rec.idempotencyKey === data.idempotencyKey) {
          const dupErr: any = new Error('Unique constraint failed on idempotencyKey');
          dupErr.code = 'P2002';
          throw dupErr;
        }
      }
      const now = new Date();
      const rec = {
        ...data,
        subscriberId: data.subscriberId ?? null,
        campaignId: data.campaignId ?? null,
        orderId: data.orderId ?? null,
        providerMessageId: data.providerMessageId ?? null,
        attemptCount: data.attemptCount ?? 0,
        lastAttemptAt: data.lastAttemptAt ?? null,
        sentAt: data.sentAt ?? null,
        deliveredAt: data.deliveredAt ?? null,
        readAt: data.readAt ?? null,
        failureReason: data.failureReason ?? null,
        providerResponseJson: data.providerResponseJson ?? null,
        metadataJson: data.metadataJson ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.deliveries.set(rec.id, rec);
      return { ...rec };
    },
    update: async ({ where, data }: any) => {
      const existing = this.deliveries.get(where.id);
      if (!existing) throw new Error('Delivery not found');
      const next = { ...existing, updatedAt: new Date() };
      for (const [k, v] of Object.entries(data)) {
        if (k === 'attemptCount' && v && typeof v === 'object' && 'increment' in (v as any)) {
          next.attemptCount = Number(existing.attemptCount || 0) + Number((v as any).increment || 0);
        } else {
          next[k] = v;
        }
      }
      this.deliveries.set(where.id, next);
      return { ...next };
    },
  };
}

interface CapturedCall {
  url: string;
  headers: Record<string, string>;
  body: any;
}

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function setupEnv(overrides: Record<string, string | undefined> = {}) {
  process.env.USE_MYSQL = 'false';
  process.env.EMAIL_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 're_test_key_12345';
  delete process.env.EMAIL_API_KEY;
  process.env.EMAIL_FROM_ADDRESS = 'TORIWEAR <orders@thetoriwearstore.in>';
  process.env.EMAIL_REPLY_TO = 'support@thetoriwearstore.in';
  process.env.APP_URL = 'https://thetoriwearstore.in';

  process.env.WHATSAPP_ACCESS_TOKEN = 'wa_test_token_12345';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '1009988776655';
  process.env.WHATSAPP_TEMPLATE_NAME = 'toriwear_drop_launch';
  process.env.WHATSAPP_TEMPLATE_LANG = 'en';
  process.env.WHATSAPP_ORDER_CONFIRM_TEMPLATE_NAME = 'toriwear_order_confirmed';
  process.env.WHATSAPP_ORDER_CONFIRM_TEMPLATE_LANG = 'en';
  process.env.WHATSAPP_ORDER_CANCEL_TEMPLATE_NAME = 'toriwear_order_cancelled';
  process.env.WHATSAPP_ORDER_CANCEL_TEMPLATE_LANG = 'en';
  process.env.WHATSAPP_ORDER_SHIPPED_TEMPLATE_NAME = 'toriwear_order_shipped';
  process.env.WHATSAPP_ORDER_SHIPPED_TEMPLATE_LANG = 'en';
  process.env.WHATSAPP_ORDER_OUT_FOR_DELIVERY_TEMPLATE_NAME = 'toriwear_order_ofd';
  process.env.WHATSAPP_ORDER_OUT_FOR_DELIVERY_TEMPLATE_LANG = 'en';
  process.env.WHATSAPP_ORDER_DELIVERED_TEMPLATE_NAME = 'toriwear_order_delivered';
  process.env.WHATSAPP_ORDER_DELIVERED_TEMPLATE_LANG = 'en';
  process.env.WHATSAPP_APP_SECRET = 'wa_test_app_secret';
  process.env.SHIPROCKET_WEBHOOK_TOKEN = 'sr_test_webhook_secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp_test_webhook_secret';

  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function installFetchMock(handler?: (url: string, init: any) => Response | Promise<Response>) {
  const resendCalls: CapturedCall[] = [];
  const whatsappCalls: CapturedCall[] = [];
  let seq = 1;

  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    const headers: Record<string, string> = {};
    if (init?.headers) {
      for (const [k, v] of Object.entries(init.headers)) {
        headers[k.toLowerCase()] = String(v);
      }
    }
    let body: any = undefined;
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }

    if (url.includes('api.resend.com/emails')) {
      resendCalls.push({ url, headers, body });
    } else if (url.includes('graph.facebook.com/')) {
      whatsappCalls.push({ url, headers, body });
    }

    if (handler) {
      return await handler(url, { ...init, parsedBody: body, normalizedHeaders: headers });
    }

    if (url.includes('api.resend.com/emails')) {
      return new Response(JSON.stringify({ id: `re_msg_${seq++}` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('graph.facebook.com/')) {
      return new Response(
        JSON.stringify({
          messaging_product: 'whatsapp',
          messages: [{ id: `wamid.test.${seq++}` }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as any;

  return { resendCalls, whatsappCalls };
}

async function getTestCatalogItem() {
  const products = await productRepository.getAll();
  const product = products.find((p) => Array.isArray(p.variants) && p.variants.length > 0) || products[0];
  assert.ok(product, 'Test catalog must contain at least one product');
  const variant = product.variants?.[0];
  assert.ok(variant, 'Test product must contain at least one variant');
  // Ensure generous stock for test runs
  await inventoryRepository.restoreStock(variant.id, 50, 'Phase 2 notification test seed', `seed-${Date.now()}`);
  return { product, variant };
}

test.afterEach(async () => {
  await waitForPendingOrderNotifications();
  globalThis.fetch = originalFetch;
  setPrismaClientOverrideForTests(null);
  resetFallbackOrderDeliveriesForTests();
  await logisticsPartnerRepository.updateSettings({ notifyCustomerOnDispatch: true });
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

// ============================================================================
// 1. E.164 Phone Normalization & Refund Accuracy Unit Checks
// ============================================================================
test('E.164 phone normalization handles Indian 10-digit, 91-prefixed, international, and rejects malformed', () => {
  assert.equal(normalizeOrderPhoneToE164('9876543210'), '+919876543210');
  assert.equal(normalizeOrderPhoneToE164('09876543210'), '+919876543210');
  assert.equal(normalizeOrderPhoneToE164('98765-43210'), '+919876543210');
  assert.equal(normalizeOrderPhoneToE164('919876543210'), '+919876543210');
  assert.equal(normalizeOrderPhoneToE164('+91 98765 43210'), '+919876543210');
  assert.equal(normalizeOrderPhoneToE164('+1 (415) 555-2671'), '+14155552671');
  assert.equal(normalizeOrderPhoneToE164('12345'), null);
  assert.equal(normalizeOrderPhoneToE164('0000000000'), null);
  assert.equal(normalizeOrderPhoneToE164('not-a-phone'), null);
});

test('Cancellation refund copy is strictly truthful and never falsely claims refund completed', () => {
  const baseOrder: any = {
    id: 'ord-ref-1',
    orderNumber: 'TORI-20261122-REF1',
    total: 1499,
    paymentMethod: 'UPI',
    paymentStatus: 'PAID',
    refundStatus: 'REFUND_INITIATED',
  };

  const pendingRefund = assessOrderCancellationRefund(baseOrder);
  assert.equal(pendingRefund.code, 'REFUND_PENDING_PROCESSING');
  assert.match(pendingRefund.emailSummary, /not yet completed/i);
  assert.doesNotMatch(pendingRefund.whatsappSummary, /has been completed/i);

  const completedRefund = assessOrderCancellationRefund({
    ...baseOrder,
    paymentStatus: 'REFUNDED',
    refundStatus: 'REFUND_COMPLETED',
    refundAmount: 1499,
  });
  assert.equal(completedRefund.code, 'REFUND_COMPLETED');
  assert.match(completedRefund.emailSummary, /completed/i);

  const codRefund = assessOrderCancellationRefund({
    ...baseOrder,
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    refundStatus: 'NOT_APPLICABLE_COD',
  });
  assert.equal(codRefund.code, 'NO_CHARGE_COD');
  assert.match(codRefund.emailSummary, /no refund is required/i);
});

// ============================================================================
// 2. Resend EMAIL_API_KEY Fallback & Optional List-Unsubscribe Headers
// ============================================================================
test('Resend supports EMAIL_API_KEY fallback and omits List-Unsubscribe on transactional emails while keeping it for Early Access', async () => {
  setupEnv({ RESEND_API_KEY: undefined, EMAIL_API_KEY: 're_fallback_alias_key' });
  const { resendCalls } = installFetchMock();

  const status = getEmailProviderStatus();
  assert.equal(status.configured, true);

  // Transactional email (no unsubscribeUrl)
  const txRes = await sendResendEmail({
    to: 'buyer@example.com',
    subject: 'Order Confirmed',
    html: '<p>Confirmed</p>',
    text: 'Confirmed',
    idempotencyKey: 'tx-test-1',
    retryDelayMs: 0,
  });
  assert.equal(txRes.success, true);
  assert.equal(resendCalls.length, 1);
  assert.equal(resendCalls[0].headers.authorization, 'Bearer re_fallback_alias_key');
  assert.equal(resendCalls[0].body.headers['List-Unsubscribe'], undefined);

  // Early Access email (with unsubscribeUrl)
  const eaRes = await sendResendEmail({
    to: 'early@example.com',
    subject: 'Drop Live',
    html: '<p>Live</p>',
    text: 'Live',
    unsubscribeUrl: 'https://thetoriwearstore.in/api/v1/early-access/unsubscribe?token=abc',
    idempotencyKey: 'ea-test-1',
    retryDelayMs: 0,
  });
  assert.equal(eaRes.success, true);
  assert.equal(resendCalls.length, 2);
  assert.ok(resendCalls[1].body.headers['List-Unsubscribe']);
  assert.equal(resendCalls[1].body.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});

// ============================================================================
// 3. COD Order Confirmation & Strict WhatsApp Consent Enforcement
// ============================================================================
test('COD order without WhatsApp consent sends email only (zero WhatsApp calls)', async () => {
  setupEnv();
  const prisma = new InMemoryNotificationPrisma();
  setPrismaClientOverrideForTests(prisma);
  const { resendCalls, whatsappCalls } = installFetchMock();
  const { product, variant } = await getTestCatalogItem();

  const res = await orderService.createOrder(
    {
      customerName: 'Aarav Sharma',
      customerEmail: 'aarav@example.com',
      customerPhone: '9876543210',
      shippingAddress: {
        fullName: 'Aarav Sharma',
        email: 'aarav@example.com',
        phone: '9876543210',
        addressLine1: 'Flat 402, Linking Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400050',
      },
      items: [{ productId: product.id, variantId: variant.id, size: variant.size, quantity: 1 }],
      paymentMethod: 'COD',
      whatsappOptIn: false,
      idempotencyKey: `cod-no-wa-${Date.now()}`,
    },
    '127.0.0.1'
  );

  assert.equal(res.success, true);
  assert.ok(res.order);
  await waitForPendingOrderNotifications();

  assert.equal(resendCalls.length, 1);
  assert.equal(whatsappCalls.length, 0, 'Must NEVER send WhatsApp without explicit consent');
  assert.match(resendCalls[0].body.subject, new RegExp(res.order.orderNumber));

  const deliveries = await getOrderNotificationDeliveries(res.order.id);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].channel, 'EMAIL');
  assert.equal(deliveries[0].status, 'SENT');
});

test('COD order WITH WhatsApp consent sends both Email and E.164-normalized WhatsApp confirmation', async () => {
  setupEnv();
  const prisma = new InMemoryNotificationPrisma();
  setPrismaClientOverrideForTests(prisma);
  const { resendCalls, whatsappCalls } = installFetchMock();
  const { product, variant } = await getTestCatalogItem();

  const res = await orderService.createOrder(
    {
      customerName: 'Riya Verma',
      customerEmail: 'riya@example.com',
      customerPhone: '9820123456',
      shippingAddress: {
        fullName: 'Riya Verma',
        email: 'riya@example.com',
        phone: '9820123456',
        addressLine1: '12B Bandra West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400050',
      },
      items: [{ productId: product.id, variantId: variant.id, size: variant.size, quantity: 1 }],
      paymentMethod: 'COD',
      whatsappOptIn: true,
      idempotencyKey: `cod-with-wa-${Date.now()}`,
    },
    '127.0.0.1'
  );

  assert.equal(res.success, true);
  assert.ok(res.order);
  assert.equal(res.order.whatsappOptIn, true);
  assert.equal(res.order.whatsappNumber, '+919820123456');

  await waitForPendingOrderNotifications();

  assert.equal(resendCalls.length, 1);
  assert.equal(whatsappCalls.length, 1);
  assert.equal(whatsappCalls[0].body.to, '919820123456');
  assert.equal(whatsappCalls[0].body.template.name, 'toriwear_order_confirmed');

  const deliveries = await getOrderNotificationDeliveries(res.order.id);
  assert.equal(deliveries.length, 2);
  assert.ok(deliveries.every((d) => d.status === 'SENT'));
});

// ============================================================================
// 4. Prepaid Orders: No Early Send + Razorpay Verify & Webhook Deduplication
// ============================================================================
test('Prepaid order sends ZERO notifications while PENDING_PAYMENT or payment.failed, and EXACTLY ONE per channel across verifyPayment + payment.captured webhook', async () => {
  setupEnv();
  const prisma = new InMemoryNotificationPrisma();
  setPrismaClientOverrideForTests(prisma);
  const { resendCalls, whatsappCalls } = installFetchMock();
  const { product, variant } = await getTestCatalogItem();

  // Configure active Razorpay test key secret for cryptographic HMAC verification
  const origGetActive = paymentConfigService.getActiveCredentials.bind(paymentConfigService);
  (paymentConfigService as any).getActiveCredentials = () => ({
    enabled: true,
    environment: 'test',
    keyId: 'rzp_test_key123',
    keySecret: 'rzp_test_secret_abc',
    webhookSecret: 'rzp_test_webhook_secret',
  });

  try {
    const createRes = await orderService.createOrder(
      {
        customerName: 'Kabir Sen',
        customerEmail: 'kabir@example.com',
        customerPhone: '9811122233',
        shippingAddress: {
          fullName: 'Kabir Sen',
          email: 'kabir@example.com',
          phone: '9811122233',
          addressLine1: '45 Indiranagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560038',
        },
        items: [{ productId: product.id, variantId: variant.id, size: variant.size, quantity: 1 }],
        paymentMethod: 'UPI',
        whatsappOptIn: true,
        idempotencyKey: `prepaid-dedup-${Date.now()}`,
      },
      '127.0.0.1'
    );

    assert.equal(createRes.success, true);
    const order = createRes.order!;
    assert.equal(order.paymentStatus, 'PENDING_PAYMENT');
    await waitForPendingOrderNotifications();

    // 1. No confirmation sent for unpaid prepaid order
    assert.equal(resendCalls.length, 0);
    assert.equal(whatsappCalls.length, 0);

    // 2. Failed payment webhook must NOT send confirmation
    const failedPayload = {
      event: 'payment.failed',
      event_id: `evt_fail_${Date.now()}`,
      payload: {
        payment: {
          entity: {
            id: `pay_fail_${Date.now()}`,
            notes: { orderNumber: order.orderNumber },
            error_description: 'Insufficient funds',
          },
        },
      },
    };
    const failedRaw = JSON.stringify(failedPayload);
    const failedSig = crypto
      .createHmac('sha256', 'rzp_test_webhook_secret')
      .update(failedRaw)
      .digest('hex');

    const failWhRes = await paymentService.processWebhook('RAZORPAY', failedSig, failedPayload, failedRaw);
    assert.equal(failWhRes.success, true);
    await waitForPendingOrderNotifications();
    assert.equal(resendCalls.length, 0);
    assert.equal(whatsappCalls.length, 0);

    // 3. Valid Razorpay browser signature verification + Razorpay payment.captured webhook race!
    const gwOrderId = `order_rzp_${Date.now()}`;
    const gwPaymentId = `pay_rzp_${Date.now()}`;
    const validSig = crypto
      .createHmac('sha256', 'rzp_test_secret_abc')
      .update(`${gwOrderId}|${gwPaymentId}`)
      .digest('hex');

    const capturedPayload = {
      event: 'payment.captured',
      event_id: `evt_cap_${Date.now()}`,
      payload: {
        payment: {
          entity: {
            id: gwPaymentId,
            order_id: gwOrderId,
            method: 'upi',
            notes: { orderNumber: order.orderNumber },
          },
        },
      },
    };
    const capturedRaw = JSON.stringify(capturedPayload);
    const capturedSig = crypto
      .createHmac('sha256', 'rzp_test_webhook_secret')
      .update(capturedRaw)
      .digest('hex');

    const [verifyRes, webhookRes] = await Promise.all([
      paymentService.verifyPayment(
        {
          orderId: order.id,
          gatewayOrderId: gwOrderId,
          gatewayPaymentId: gwPaymentId,
          gatewaySignature: validSig,
        },
        '127.0.0.1'
      ),
      paymentService.processWebhook('RAZORPAY', capturedSig, capturedPayload, capturedRaw),
    ]);

    assert.equal(verifyRes.success, true);
    assert.equal(webhookRes.success, true);
    await waitForPendingOrderNotifications();

    // Also fire an explicit second dispatch attempt to double-check DB idempotency
    const dupDispatch = await dispatchOrderNotification('ORDER_CONFIRMED', { order });
    assert.equal(dupDispatch.email.skippedDuplicate, true);
    assert.equal(dupDispatch.whatsapp.skippedDuplicate, true);

    assert.equal(resendCalls.length, 1, 'Must send confirmation EMAIL exactly once');
    assert.equal(whatsappCalls.length, 1, 'Must send confirmation WHATSAPP exactly once');
  } finally {
    (paymentConfigService as any).getActiveCredentials = origGetActive;
  }
});

// ============================================================================
// 5. Order Cancellation (Customer/Admin) + Accurate Refund Info + Deduplication
// ============================================================================
test('Paid order cancellation sends ORDER_CANCELLED with accurate pending-refund wording and deduplicates retries', async () => {
  setupEnv();
  const prisma = new InMemoryNotificationPrisma();
  setPrismaClientOverrideForTests(prisma);
  const { resendCalls, whatsappCalls } = installFetchMock();
  const { product, variant } = await getTestCatalogItem();

  const createRes = await orderService.createOrder(
    {
      customerName: 'Neha Patel',
      customerEmail: 'neha@example.com',
      customerPhone: '9898112233',
      shippingAddress: {
        fullName: 'Neha Patel',
        email: 'neha@example.com',
        phone: '9898112233',
        addressLine1: '7 CG Road',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380009',
      },
      items: [{ productId: product.id, variantId: variant.id, size: variant.size, quantity: 1 }],
      paymentMethod: 'UPI',
      whatsappOptIn: true,
      idempotencyKey: `cancel-paid-${Date.now()}`,
    },
    '127.0.0.1'
  );
  const order = createRes.order!;
  // Mark as PAID to simulate a captured prepaid order before cancellation
  await orderRepository.update(order.id, { paymentStatus: 'PAID', fulfillmentStatus: 'CONFIRMED' });

  const cancelRes1 = await orderService.cancelOrder(order.id, 'Changed my size preference', {
    id: 'cust-1',
    name: 'Neha Patel',
    role: 'CUSTOMER',
  });
  assert.equal(cancelRes1.success, true);
  assert.equal(cancelRes1.order?.fulfillmentStatus, 'CANCELLED');
  assert.equal(cancelRes1.order?.refundStatus, 'REFUND_INITIATED');

  // Repeat cancellation must be idempotent and NOT send a second notification
  const cancelRes2 = await orderService.cancelOrder(order.id, 'Changed my size preference', {
    id: 'cust-1',
    name: 'Neha Patel',
    role: 'CUSTOMER',
  });
  assert.equal(cancelRes2.alreadyCancelled, true);

  await waitForPendingOrderNotifications();

  assert.equal(resendCalls.length, 1);
  assert.equal(whatsappCalls.length, 1);
  assert.match(resendCalls[0].body.subject, /Order Cancelled/i);
  assert.match(resendCalls[0].body.text, /not yet completed/i);
  assert.equal(whatsappCalls[0].body.template.name, 'toriwear_order_cancelled');
});

// ============================================================================
// 6. Shipping & Delivery Notifications (Shiprocket Webhook + notifyCustomerOnDispatch)
// ============================================================================
test('Shiprocket webhooks trigger ORDER_SHIPPED, ORDER_OUT_FOR_DELIVERY, and ORDER_DELIVERED with tracking number & URL, and respect notifyCustomerOnDispatch', async () => {
  setupEnv();
  const prisma = new InMemoryNotificationPrisma();
  setPrismaClientOverrideForTests(prisma);
  const { resendCalls, whatsappCalls } = installFetchMock();
  const { product, variant } = await getTestCatalogItem();

  const createRes = await orderService.createOrder(
    {
      customerName: 'Vikram Rao',
      customerEmail: 'vikram@example.com',
      customerPhone: '9845098450',
      shippingAddress: {
        fullName: 'Vikram Rao',
        email: 'vikram@example.com',
        phone: '9845098450',
        addressLine1: '18 Jubilee Hills',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500033',
      },
      items: [{ productId: product.id, variantId: variant.id, size: variant.size, quantity: 1 }],
      paymentMethod: 'COD',
      whatsappOptIn: true,
      idempotencyKey: `ship-flow-${Date.now()}`,
    },
    '127.0.0.1'
  );
  const order = createRes.order!;
  await waitForPendingOrderNotifications();
  // Clear confirmation calls count baseline
  const confirmEmails = resendCalls.length;
  const confirmWa = whatsappCalls.length;
  assert.equal(confirmEmails, 1);
  assert.equal(confirmWa, 1);

  const awb = `SR-AWB-${Date.now()}`;
  await shippingRepository.createShipment({
    id: `shp-${Date.now()}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    carrier: 'SHIPROCKET',
    trackingNumber: awb,
    awbCode: awb,
    trackingUrl: `https://shiprocket.co/tracking/${awb}`,
    status: 'MANIFESTED',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 1. Shiprocket PICKED_UP -> ORDER_SHIPPED
  const whShipped = await shippingService.processShiprocketWebhook('sr_test_webhook_secret', {
    event_id: `sr_pick_${Date.now()}`,
    awb,
    order_id: order.orderNumber,
    current_status: 'PICKED UP',
    courier_name: 'Delhivery Express',
    tracking_url: `https://shiprocket.co/tracking/${awb}`,
    location: 'Mumbai Hub',
  });
  assert.equal(whShipped.success, true);
  await waitForPendingOrderNotifications();

  assert.equal(resendCalls.length, 2);
  assert.equal(whatsappCalls.length, 2);
  assert.match(resendCalls[1].body.subject, /Order Shipped/i);
  assert.ok(resendCalls[1].body.html.includes(awb));
  assert.ok(resendCalls[1].body.html.includes(`https://shiprocket.co/tracking/${awb}`));
  assert.equal(whatsappCalls[1].body.template.name, 'toriwear_order_shipped');

  // 2. Subsequent IN_TRANSIT webhook should NOT duplicate ORDER_SHIPPED
  const whTransit = await shippingService.processShiprocketWebhook('sr_test_webhook_secret', {
    event_id: `sr_transit_${Date.now()}`,
    awb,
    order_id: order.orderNumber,
    current_status: 'IN TRANSIT',
    courier_name: 'Delhivery Express',
    location: 'Pune Hub',
  });
  assert.equal(whTransit.success, true);
  await waitForPendingOrderNotifications();
  assert.equal(resendCalls.length, 2, 'IN TRANSIT after PICKED UP must not resend ORDER_SHIPPED');
  assert.equal(whatsappCalls.length, 2);

  // 3. OUT FOR DELIVERY -> ORDER_OUT_FOR_DELIVERY
  const whOfd = await shippingService.processShiprocketWebhook('sr_test_webhook_secret', {
    event_id: `sr_ofd_${Date.now()}`,
    awb,
    order_id: order.orderNumber,
    current_status: 'OUT FOR DELIVERY',
    courier_name: 'Delhivery Express',
    tracking_url: `https://shiprocket.co/tracking/${awb}`,
    location: 'Hyderabad Local Hub',
  });
  assert.equal(whOfd.success, true);
  await waitForPendingOrderNotifications();
  assert.equal(resendCalls.length, 3);
  assert.equal(whatsappCalls.length, 3);
  assert.match(resendCalls[2].body.subject, /Out for Delivery/i);
  assert.equal(whatsappCalls[2].body.template.name, 'toriwear_order_ofd');

  // 4. DELIVERED -> ORDER_DELIVERED
  const whDeliv = await shippingService.processShiprocketWebhook('sr_test_webhook_secret', {
    event_id: `sr_deliv_${Date.now()}`,
    awb,
    order_id: order.orderNumber,
    current_status: 'DELIVERED',
    courier_name: 'Delhivery Express',
    location: 'Customer Doorstep',
  });
  assert.equal(whDeliv.success, true);
  await waitForPendingOrderNotifications();
  assert.equal(resendCalls.length, 4);
  assert.equal(whatsappCalls.length, 4);
  assert.match(resendCalls[3].body.subject, /Order Delivered/i);
  assert.equal(whatsappCalls[3].body.template.name, 'toriwear_order_delivered');

  // 5. Verify notifyCustomerOnDispatch = false suppresses ORDER_SHIPPED
  await logisticsPartnerRepository.updateSettings({ notifyCustomerOnDispatch: false });
  const order2Res = await orderService.createOrder(
    {
      customerName: 'Ananya Nair',
      customerEmail: 'ananya@example.com',
      customerPhone: '9822334455',
      shippingAddress: {
        fullName: 'Ananya Nair',
        email: 'ananya@example.com',
        phone: '9822334455',
        addressLine1: '10 MG Road',
        city: 'Kochi',
        state: 'Kerala',
        pincode: '682016',
      },
      items: [{ productId: product.id, variantId: variant.id, size: variant.size, quantity: 1 }],
      paymentMethod: 'COD',
      whatsappOptIn: true,
      idempotencyKey: `ship-disabled-${Date.now()}`,
    },
    '127.0.0.1'
  );
  await waitForPendingOrderNotifications();
  const emailsBeforeDisabledShip = resendCalls.length;
  const waBeforeDisabledShip = whatsappCalls.length;

  await orderService.transitionOrderStatus(order2Res.order!.id, 'PROCESSING', { id: 'adm', name: 'Admin', role: 'SUPER_ADMIN' });
  await orderService.transitionOrderStatus(order2Res.order!.id, 'PACKED', { id: 'adm', name: 'Admin', role: 'SUPER_ADMIN' });
  await orderService.transitionOrderStatus(
    order2Res.order!.id,
    'SHIPPED',
    { id: 'adm', name: 'Admin', role: 'SUPER_ADMIN' },
    'Dispatched silently',
    { courierPartner: 'Delhivery', trackingNumber: 'AWB-SILENT-1' }
  );
  await waitForPendingOrderNotifications();

  assert.equal(resendCalls.length, emailsBeforeDisabledShip, 'notifyCustomerOnDispatch=false must skip ORDER_SHIPPED email');
  assert.equal(whatsappCalls.length, waBeforeDisabledShip, 'notifyCustomerOnDispatch=false must skip ORDER_SHIPPED WhatsApp');

  // 6. Shiprocket CANCELLED webhook triggers ORDER_CANCELLED once
  const order3Res = await orderService.createOrder(
    {
      customerName: 'Devika Rao',
      customerEmail: 'devika@example.com',
      customerPhone: '9833445566',
      shippingAddress: {
        fullName: 'Devika Rao',
        email: 'devika@example.com',
        phone: '9833445566',
        addressLine1: '11 Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
      },
      items: [{ productId: product.id, variantId: variant.id, size: variant.size, quantity: 1 }],
      paymentMethod: 'COD',
      whatsappOptIn: true,
      idempotencyKey: `ship-cancel-${Date.now()}`,
    },
    '127.0.0.1'
  );
  await waitForPendingOrderNotifications();
  const emailsBeforeShipCancel = resendCalls.length;
  const waBeforeShipCancel = whatsappCalls.length;

  const cancelAwb = `SR-CAN-${Date.now()}`;
  await shippingRepository.createShipment({
    id: `shp-can-${Date.now()}`,
    orderId: order3Res.order!.id,
    orderNumber: order3Res.order!.orderNumber,
    carrier: 'SHIPROCKET',
    trackingNumber: cancelAwb,
    awbCode: cancelAwb,
    status: 'MANIFESTED',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const whCancel = await shippingService.processShiprocketWebhook('sr_test_webhook_secret', {
    event_id: `sr_can_${Date.now()}`,
    awb: cancelAwb,
    order_id: order3Res.order!.orderNumber,
    current_status: 'CANCELED',
    courier_name: 'Shiprocket',
    location: 'Origin Hub',
  });
  assert.equal(whCancel.success, true);
  await waitForPendingOrderNotifications();

  assert.equal(resendCalls.length, emailsBeforeShipCancel + 1, 'Shiprocket CANCELLED must send ORDER_CANCELLED email');
  assert.equal(whatsappCalls.length, waBeforeShipCancel + 1, 'Shiprocket CANCELLED must send ORDER_CANCELLED WhatsApp');
  assert.match(resendCalls[resendCalls.length - 1].body.subject, /Order Cancelled/i);
});

// ============================================================================
// 7. Unconfigured WhatsApp Template Recording (Never Falls Back to Early Access Template)
// ============================================================================
test('Unconfigured order WhatsApp template records FAILED without calling Meta API or falling back to Early Access template', async () => {
  setupEnv({ WHATSAPP_ORDER_SHIPPED_TEMPLATE_NAME: '' });
  const prisma = new InMemoryNotificationPrisma();
  setPrismaClientOverrideForTests(prisma);
  const { resendCalls, whatsappCalls } = installFetchMock();
  const { product, variant } = await getTestCatalogItem();

  const createRes = await orderService.createOrder(
    {
      customerName: 'Rohan Mehta',
      customerEmail: 'rohan@example.com',
      customerPhone: '9870011223',
      shippingAddress: {
        fullName: 'Rohan Mehta',
        email: 'rohan@example.com',
        phone: '9870011223',
        addressLine1: '22 Park Street',
        city: 'Kolkata',
        state: 'West Bengal',
        pincode: '700016',
      },
      items: [{ productId: product.id, variantId: variant.id, size: variant.size, quantity: 1 }],
      paymentMethod: 'COD',
      whatsappOptIn: true,
      idempotencyKey: `unconf-tpl-${Date.now()}`,
    },
    '127.0.0.1'
  );
  await waitForPendingOrderNotifications();

  const waCallsBeforeShip = whatsappCalls.length;
  const shipDispatch = await dispatchOrderNotification(
    'ORDER_SHIPPED',
    {
      order: createRes.order!,
      courierPartner: 'Shiprocket',
      trackingNumber: 'SR123456',
      trackingUrl: 'https://shiprocket.co/tracking/SR123456',
    },
    { retryDelayMs: 0 }
  );

  assert.equal(shipDispatch.email.sent, true);
  assert.equal(shipDispatch.whatsapp.sent, false);
  assert.equal(shipDispatch.whatsapp.configMissing, true);
  assert.equal(whatsappCalls.length, waCallsBeforeShip, 'Must NOT call Meta API when template env var is unconfigured');
  assert.equal(resendCalls.length, 2);

  const deliveries = await getOrderNotificationDeliveries(createRes.order!.id);
  const waShipDel = deliveries.find((d) => d.eventType === 'ORDER_SHIPPED' && d.channel === 'WHATSAPP');
  assert.ok(waShipDel);
  assert.equal(waShipDel.status, 'FAILED');
  assert.match(waShipDel.failureReason || '', /WHATSAPP_ORDER_SHIPPED_TEMPLATE_NAME/);
});

// ============================================================================
// 8. Provider Failure Isolation + Truthful Status + Safe Retry Without Duplication
// ============================================================================
test('Provider failure never breaks order creation, never marks SENT prematurely, and safe retry delivers once without duplicating sent channels', async () => {
  setupEnv();
  const prisma = new InMemoryNotificationPrisma();
  setPrismaClientOverrideForTests(prisma);

  let failEmail = true;
  const { resendCalls, whatsappCalls } = installFetchMock((url) => {
    if (url.includes('api.resend.com/emails')) {
      if (failEmail) {
        return new Response(JSON.stringify({ message: 'Resend temporary outage' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ id: 're_recovered_999' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.ok.1' }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  });

  const { product, variant } = await getTestCatalogItem();
  const createRes = await orderService.createOrder(
    {
      customerName: 'Meera Iyer',
      customerEmail: 'meera@example.com',
      customerPhone: '9840112233',
      shippingAddress: {
        fullName: 'Meera Iyer',
        email: 'meera@example.com',
        phone: '9840112233',
        addressLine1: '5 Besant Nagar',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600090',
      },
      items: [{ productId: product.id, variantId: variant.id, size: variant.size, quantity: 1 }],
      paymentMethod: 'COD',
      whatsappOptIn: true,
      idempotencyKey: `fail-retry-${Date.now()}`,
    },
    '127.0.0.1'
  );

  // Order MUST succeed even though Resend returned 500!
  assert.equal(createRes.success, true);
  assert.ok(createRes.order);
  await waitForPendingOrderNotifications();

  const deliveries = await getOrderNotificationDeliveries(createRes.order.id);
  const emailDel = deliveries.find((d) => d.channel === 'EMAIL')!;
  const waDel = deliveries.find((d) => d.channel === 'WHATSAPP')!;

  assert.equal(emailDel.status, 'FAILED', 'Failed Resend attempt must be recorded as FAILED, never SENT');
  assert.equal(emailDel.providerMessageId, null);
  assert.match(emailDel.failureReason || '', /Resend temporary outage/i);
  assert.equal(waDel.status, 'SENT');
  assert.equal(whatsappCalls.length, 1);

  // Attempting to retry the already-SENT WhatsApp delivery MUST be refused
  const skipWaRetry = await retryFailedOrderNotification(waDel.id, { retryDelayMs: 0 });
  assert.equal(skipWaRetry.success, false);
  assert.equal(skipWaRetry.skipped, true);
  assert.equal(whatsappCalls.length, 1, 'Already-SENT WhatsApp delivery must never be re-sent');

  // Recover Resend and safely retry ONLY the failed EMAIL delivery
  failEmail = false;
  const emailCallsBeforeRetry = resendCalls.length;
  const retryEmail = await retryFailedOrderNotification(emailDel.id, { retryDelayMs: 0 });
  assert.equal(retryEmail.success, true);
  assert.equal(resendCalls.length, emailCallsBeforeRetry + 1);

  const afterRetryDeliveries = await getOrderNotificationDeliveries(createRes.order.id);
  const updatedEmailDel = afterRetryDeliveries.find((d) => d.id === emailDel.id)!;
  assert.equal(updatedEmailDel.status, 'SENT');
  assert.equal(updatedEmailDel.providerMessageId, 're_recovered_999');

  // Retrying again after recovery MUST be refused
  const secondRetry = await retryFailedOrderNotification(emailDel.id, { retryDelayMs: 0 });
  assert.equal(secondRetry.skipped, true);
});

// ============================================================================
// 9. Email XSS & URL Sanitization + Meta Webhook Delivery Progression for Orders
// ============================================================================
test('Order email templates escape untrusted HTML and block javascript: tracking URLs; Meta webhook updates order deliveries', async () => {
  setupEnv();
  const prisma = new InMemoryNotificationPrisma();
  setPrismaClientOverrideForTests(prisma);
  installFetchMock();

  const built = buildOrderTransactionalEmail('ORDER_SHIPPED', {
    order: {
      id: 'ord-xss-1',
      orderNumber: 'TORI-XSS-01',
      customerName: '<script>alert(1)</script>Arjun',
      customerEmail: 'arjun@example.com',
      customerPhone: '9876543210',
      subtotal: 1099,
      discount: 0,
      tax: 55,
      shippingFee: 0,
      total: 1099,
      currency: 'INR',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      fulfillmentStatus: 'SHIPPED',
      shippingAddress: {
        fullName: 'Arjun',
        phone: '9876543210',
        email: 'arjun@example.com',
        addressLine1: '10 Main St',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
      },
      items: [
        {
          id: 'it-1',
          productId: 'p-1',
          productName: '<b>Last Blood</b>',
          variantId: 'v-1',
          sku: 'LB-M',
          size: 'M',
          color: 'Black',
          unitPrice: 1099,
          quantity: 1,
          totalPrice: 1099,
          image: '',
        },
      ],
      timeline: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    courierPartner: 'Delhivery',
    trackingNumber: 'AWB999',
    trackingUrl: 'javascript:alert(document.cookie)',
  });

  assert.doesNotMatch(built.html, /<script>/i);
  assert.ok(built.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;Arjun'));
  assert.doesNotMatch(built.html, /javascript:/i);

  // Verify Meta webhook updates an order NotificationDelivery (subscriberId: null) monotonically
  const dispatch = await dispatchOrderNotification(
    'ORDER_CONFIRMED',
    {
      order: {
        id: 'ord-meta-wh-1',
        orderNumber: 'TORI-META-01',
        customerName: 'Arjun',
        customerEmail: 'arjun@example.com',
        customerPhone: '9876543210',
        whatsappOptIn: true,
        whatsappNumber: '+919876543210',
        subtotal: 1099,
        discount: 0,
        tax: 55,
        shippingFee: 0,
        total: 1099,
        currency: 'INR',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        fulfillmentStatus: 'CONFIRMED',
        shippingAddress: {
          fullName: 'Arjun',
          phone: '9876543210',
          email: 'arjun@example.com',
          addressLine1: '10 Main St',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411001',
        },
        items: [],
        timeline: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { retryDelayMs: 0 }
  );

  const wamid = dispatch.whatsapp.providerMessageId!;
  assert.ok(wamid);

  const metaBody = {
    entry: [
      {
        changes: [
          {
            value: {
              statuses: [{ id: wamid, status: 'delivered' }],
            },
          },
        ],
      },
    ],
  };
  const rawMeta = JSON.stringify(metaBody);
  const sig =
    'sha256=' +
    crypto.createHmac('sha256', 'wa_test_app_secret').update(rawMeta, 'utf8').digest('hex');

  const whRes = await handleWhatsAppWebhook({
    rawBody: rawMeta,
    signatureHeader: sig,
    body: metaBody,
  });
  assert.equal(whRes.statusCode, 200);
  assert.equal(whRes.payload.updatedCount, 1);

  const updatedDeliveries = await getOrderNotificationDeliveries('ord-meta-wh-1');
  const waRow = updatedDeliveries.find((d) => d.channel === 'WHATSAPP')!;
  assert.equal(waRow.status, 'DELIVERED');
});
