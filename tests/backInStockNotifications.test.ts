import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Isolate all runtime JSON fallback stores BEFORE importing any repositories!
const tempRuntimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tori-bis-test-'));
process.env.TORI_RUNTIME_DATA_DIR = tempRuntimeDir;

const { setPrismaClientOverrideForTests } = await import('../server/db/prisma');
const { productRepository } = await import('../server/repositories/productRepository');
const { inventoryRepository } = await import('../server/repositories/inventoryRepository');
const { backInStockRepository } = await import('../server/repositories/backInStockRepository');
const {
  subscribeToBackInStock,
  handleVariantBackInStock,
  retryFailedBackInStockSubscription,
  getAdminBackInStockOverview,
  waitForPendingBackInStockNotifications,
  BackInStockValidationError,
} = await import('../server/services/notifications/backInStockService');
const { buildBackInStockEmail } = await import('../server/services/notifications/backInStockTemplates');
const { handleWhatsAppWebhook } = await import('../server/services/notifications/campaignOrchestrator');

// Saved env keys to restore cleanly after tests
const ENV_KEYS = [
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_TEMPLATE_NAME',
  'WHATSAPP_BACK_IN_STOCK_TEMPLATE_NAME',
  'WHATSAPP_BACK_IN_STOCK_TEMPLATE_LANG',
  'WHATSAPP_APP_SECRET',
  'RESEND_API_KEY',
  'EMAIL_API_KEY',
  'EMAIL_FROM_ADDRESS',
  'SITE_URL',
];
const savedEnv: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) savedEnv[k] = process.env[k];

const originalFetch = globalThis.fetch;

interface MockFetchCall {
  url: string;
  body: any;
  timestamp: number;
}

const fetchCalls: MockFetchCall[] = [];
let whatsappMode: 'OK' | 'FAIL_500' = 'OK';
let emailMode: 'OK' | 'FAIL_500' = 'OK';

function installMockFetch() {
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    fetchCalls.push({ url, body, timestamp: Date.now() });

    if (url.includes('graph.facebook.com')) {
      if (whatsappMode === 'FAIL_500') {
        return new Response(
          JSON.stringify({ error: { message: 'Simulated Meta 500 error', code: 500 } }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ messages: [{ id: `wamid.bis.${crypto.randomBytes(6).toString('hex')}` }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.includes('api.resend.com')) {
      if (emailMode === 'FAIL_500') {
        return new Response(
          JSON.stringify({ message: 'Simulated Resend 500 failure' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ id: `re_bis_${crypto.randomBytes(6).toString('hex')}` }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Unexpected fetch URL in test' }), { status: 404 });
  }) as typeof fetch;
}

// Create a test product with multiple exact (size, color) variants
async function createTestProductWithVariants(suffix: string) {
  const productId = `prod-bis-${suffix}`;
  const vMediumBlack = `var-${suffix}-m-black`;
  const vLargeBlack = `var-${suffix}-l-black`;
  const vMediumCrimson = `var-${suffix}-m-crimson`;
  const vInStockSmall = `var-${suffix}-s-black`;

  await productRepository.save({
    id: productId,
    catalogNumber: `T-BIS-${suffix}`,
    name: `ShadowRonin Tee ${suffix}`,
    slug: `shadowronin-tee-${suffix}`,
    sku: `SKU-${suffix}`,
    department: 'MEN',
    world: 'DARK SHONEN',
    franchise: 'TORI ORIGINALS',
    universe: 'DARK SHONEN',
    fit: 'Oversized',
    price: 1299,
    originalPrice: 1699,
    gsm: 240,
    fabric: '100% Heavyweight Cotton',
    neck: 'Crew Neck',
    sleeves: 'Drop Shoulder',
    print: 'High-Density Puff',
    description: 'Test product for back-in-stock verification',
    drop: 'DROP 01',
    rating: 4.8,
    reviewsCount: 0,
    features: ['240 GSM Heavyweight Cotton'],
    colors: [
      { name: 'Void Black', hex: '#0a0a0c' },
      { name: 'Crimson', hex: '#c81d25' },
    ],
    sizes: ['S', 'M', 'L'],
    isNewDrop: false,
    isTrending: false,
    isBestseller: false,
    inStock: true,
    stock: 8,
    licenseType: 'ORIGINAL',
    status: 'PUBLISHED',
    images: ['https://thetoriwearstore.in/assets/sample-tee.jpg'],
    variants: [
      { id: vMediumBlack, productId, sku: `SKU-${suffix}-M-BLK`, size: 'M', colorName: 'Void Black', colorHex: '#0a0a0c', price: 1299, originalPrice: 1699, stock: 0, reservedStock: 0, isActive: true },
      { id: vLargeBlack, productId, sku: `SKU-${suffix}-L-BLK`, size: 'L', colorName: 'Void Black', colorHex: '#0a0a0c', price: 1299, originalPrice: 1699, stock: 0, reservedStock: 0, isActive: true },
      { id: vMediumCrimson, productId, sku: `SKU-${suffix}-M-CRM`, size: 'M', colorName: 'Crimson', colorHex: '#c81d25', price: 1299, originalPrice: 1699, stock: 0, reservedStock: 0, isActive: true },
      { id: vInStockSmall, productId, sku: `SKU-${suffix}-S-BLK`, size: 'S', colorName: 'Void Black', colorHex: '#0a0a0c', price: 1299, originalPrice: 1699, stock: 8, reservedStock: 0, isActive: true },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await inventoryRepository.syncProductVariants([
    { id: vMediumBlack, sku: `SKU-${suffix}-M-BLK`, stock: 0, reservedStock: 0 },
    { id: vLargeBlack, sku: `SKU-${suffix}-L-BLK`, stock: 0, reservedStock: 0 },
    { id: vMediumCrimson, sku: `SKU-${suffix}-M-CRM`, stock: 0, reservedStock: 0 },
    { id: vInStockSmall, sku: `SKU-${suffix}-S-BLK`, stock: 8, reservedStock: 0 },
  ]);

  return { productId, vMediumBlack, vLargeBlack, vMediumCrimson, vInStockSmall };
}

describe('Phase 3: Tori-Wear Back-in-Stock Notifications (WhatsApp -> Website -> Email)', () => {
  before(() => {
    setPrismaClientOverrideForTests(null);
    installMockFetch();
  });

  beforeEach(() => {
    fetchCalls.length = 0;
    whatsappMode = 'OK';
    emailMode = 'OK';
    backInStockRepository.resetFallbackStoreForTests();
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-wa-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '10987654321';
    process.env.WHATSAPP_TEMPLATE_NAME = 'early_access_do_not_reuse';
    process.env.WHATSAPP_BACK_IN_STOCK_TEMPLATE_NAME = 'toriwear_back_in_stock_v1';
    process.env.WHATSAPP_BACK_IN_STOCK_TEMPLATE_LANG = 'en';
    process.env.WHATSAPP_APP_SECRET = 'test-meta-secret';
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_API_KEY = '';
    process.env.EMAIL_FROM_ADDRESS = 'TORIWEAR <drops@thetoriwearstore.in>';
    process.env.SITE_URL = 'https://thetoriwearstore.in';
  });

  after(() => {
    globalThis.fetch = originalFetch;
    setPrismaClientOverrideForTests(null);
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
    try {
      fs.rmSync(tempRuntimeDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. Enforces strict priority (WhatsApp PRIMARY -> Website SECONDARY -> Email BACKUP) and fires automatically on 0 -> >0 stock transition', async () => {
    const { productId, vMediumBlack } = await createTestProductWithVariants('priority');

    const { subscription, alreadySubscribed } = await subscribeToBackInStock({
      productId,
      variantId: vMediumBlack,
      size: 'M',
      color: 'Void Black',
      customerId: 'cust-priority-1',
      customerName: 'Aarav',
      phone: '9876543210',
      email: 'aarav@example.com',
      whatsappConsent: true,
      websiteEnabled: true,
      browserPushEnabled: true,
      emailBackupEnabled: true,
    });

    assert.equal(alreadySubscribed, false);
    assert.equal(subscription.status, 'ACTIVE');
    assert.equal(subscription.phoneE164, '+919876543210');

    // Trigger restock through inventoryRepository.setStock (0 -> 5)
    await inventoryRepository.setStock(vMediumBlack, 5, 'ADMIN-1', 'Warehouse restock');
    await waitForPendingBackInStockNotifications();

    const updatedSub = await backInStockRepository.findSubscriptionById(subscription.id);
    assert.ok(updatedSub);
    assert.equal(updatedSub.status, 'NOTIFIED');
    assert.equal(updatedSub.whatsappStatus, 'SENT');
    assert.equal(updatedSub.websiteStatus, 'DELIVERED');
    assert.equal(updatedSub.browserPushStatus, 'PENDING');
    assert.equal(updatedSub.emailStatus, 'SENT');

    // Verify WhatsApp was called BEFORE Resend Email (strict priority)
    assert.equal(fetchCalls.length, 2);
    assert.ok(fetchCalls[0].url.includes('graph.facebook.com'), 'WhatsApp MUST be attempted first');
    assert.ok(fetchCalls[1].url.includes('api.resend.com'), 'Email MUST be attempted after WhatsApp & Website');
    assert.equal(fetchCalls[0].body.template.name, 'toriwear_back_in_stock_v1');

    // Verify durable Website Notification created for offline customer
    const inbox = await backInStockRepository.listCustomerNotifications({ customerId: 'cust-priority-1' });
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].size, 'M');
    assert.equal(inbox[0].color, 'Void Black');
    assert.equal(inbox[0].isRead, false);
    assert.equal(inbox[0].browserPushStatus, 'PENDING');
  });

  it('2. Exact variant matching: restocking Size M / Void Black notifies ONLY Size M / Void Black, NEVER Size L or Crimson', async () => {
    const { productId, vMediumBlack, vLargeBlack, vMediumCrimson } = await createTestProductWithVariants('exact');

    const subMBlack = await subscribeToBackInStock({
      productId,
      variantId: vMediumBlack,
      size: 'M',
      color: 'Void Black',
      customerId: 'cust-m-blk',
      phone: '9811111111',
      whatsappConsent: true,
      websiteEnabled: true,
    });
    const subLBlack = await subscribeToBackInStock({
      productId,
      variantId: vLargeBlack,
      size: 'L',
      color: 'Void Black',
      customerId: 'cust-l-blk',
      phone: '9822222222',
      whatsappConsent: true,
      websiteEnabled: true,
    });
    const subMCrimson = await subscribeToBackInStock({
      productId,
      variantId: vMediumCrimson,
      size: 'M',
      color: 'Crimson',
      customerId: 'cust-m-crm',
      phone: '9833333333',
      whatsappConsent: true,
      websiteEnabled: true,
    });

    // Restock ONLY vMediumBlack via updateStock (+4)
    await inventoryRepository.updateStock(vMediumBlack, 4, 'RESTOCK', 'ADMIN-1', 'Restock M Black');
    await waitForPendingBackInStockNotifications();

    const mBlackAfter = await backInStockRepository.findSubscriptionById(subMBlack.subscription.id);
    const lBlackAfter = await backInStockRepository.findSubscriptionById(subLBlack.subscription.id);
    const mCrimsonAfter = await backInStockRepository.findSubscriptionById(subMCrimson.subscription.id);

    assert.equal(mBlackAfter?.status, 'NOTIFIED');
    assert.equal(lBlackAfter?.status, 'ACTIVE', 'Size L subscriber must NOT be notified');
    assert.equal(mCrimsonAfter?.status, 'ACTIVE', 'Crimson color subscriber must NOT be notified');

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].body.to, '919811111111');
  });

  it('3. Explicit WhatsApp consent enforcement: registered mobile WITHOUT whatsappConsent=true sends ZERO WhatsApp messages', async () => {
    const { productId, vMediumBlack } = await createTestProductWithVariants('noconsent');

    const { subscription } = await subscribeToBackInStock({
      productId,
      variantId: vMediumBlack,
      size: 'M',
      color: 'Void Black',
      customerId: 'cust-noconsent',
      customerName: 'Riya',
      phone: '9844444444', // Registered phone present, but NO consent!
      email: 'riya@example.com',
      whatsappConsent: false,
      websiteEnabled: true,
      emailBackupEnabled: true,
    });

    const summaries = await handleVariantBackInStock(vMediumBlack, 0, 3);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].whatsapp.status, 'SKIPPED');
    assert.equal(summaries[0].website.status, 'DELIVERED');
    assert.equal(summaries[0].email.status, 'SENT');
    assert.equal(summaries[0].finalStatus, 'NOTIFIED');

    // Zero calls to Meta Graph API; only Resend backup email called
    assert.equal(fetchCalls.filter((c) => c.url.includes('graph.facebook.com')).length, 0);
    assert.equal(fetchCalls.filter((c) => c.url.includes('api.resend.com')).length, 1);

    const updated = await backInStockRepository.findSubscriptionById(subscription.id);
    assert.equal(updated?.whatsappStatus, 'SKIPPED');
    assert.equal(updated?.websiteStatus, 'DELIVERED');
    assert.equal(updated?.emailStatus, 'SENT');
  });

  it('4. Missing WhatsApp template or Meta 500 failure records FAILED (never falls back to Early Access template) AND continues Website + Email, then safe retry resends ONLY WhatsApp', async () => {
    const { productId, vMediumBlack } = await createTestProductWithVariants('failretry');

    // Clear back-in-stock template while keeping WHATSAPP_TEMPLATE_NAME set
    process.env.WHATSAPP_BACK_IN_STOCK_TEMPLATE_NAME = '';
    process.env.WHATSAPP_TEMPLATE_NAME = 'early_access_must_not_be_used';

    const { subscription } = await subscribeToBackInStock({
      productId,
      variantId: vMediumBlack,
      size: 'M',
      color: 'Void Black',
      customerId: 'cust-retry',
      customerName: 'Kabir',
      phone: '9855555555',
      email: 'kabir@example.com',
      whatsappConsent: true,
      websiteEnabled: true,
      emailBackupEnabled: true,
    });

    const summaries = await handleVariantBackInStock(vMediumBlack, 0, 6);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].whatsapp.status, 'FAILED');
    assert.equal(summaries[0].website.status, 'DELIVERED', 'Website notification MUST still succeed');
    assert.equal(summaries[0].email.status, 'SENT', 'Backup email MUST still succeed');
    assert.equal(summaries[0].finalStatus, 'PARTIAL_FAILURE');

    // Must NOT have called Meta with Early Access template!
    assert.equal(fetchCalls.filter((c) => c.url.includes('graph.facebook.com')).length, 0);
    assert.equal(fetchCalls.filter((c) => c.url.includes('api.resend.com')).length, 1);

    // Now configure approved back-in-stock template and retry ONLY failed channels
    process.env.WHATSAPP_BACK_IN_STOCK_TEMPLATE_NAME = 'toriwear_back_in_stock_v1';
    fetchCalls.length = 0;

    const retrySummary = await retryFailedBackInStockSubscription(subscription.id);
    assert.equal(retrySummary.whatsapp.status, 'SENT');
    assert.equal(retrySummary.website.attempted, false, 'Already delivered Website notification must NOT be re-sent');
    assert.equal(retrySummary.email.attempted, false, 'Already sent Backup Email must NOT be re-sent');
    assert.equal(retrySummary.finalStatus, 'NOTIFIED');

    assert.equal(fetchCalls.length, 1);
    assert.ok(fetchCalls[0].url.includes('graph.facebook.com'));
    assert.equal(fetchCalls[0].body.template.name, 'toriwear_back_in_stock_v1');

    // Verify still only 1 inbox notification (no duplicate created on retry)
    const inbox = await backInStockRepository.listCustomerNotifications({ customerId: 'cust-retry' });
    assert.equal(inbox.length, 1);
  });

  it('5. Duplicate prevention, in-stock rejection, and no duplicate alerts on subsequent stock bumps (0 -> 5 -> 10)', async () => {
    const { productId, vMediumBlack, vInStockSmall } = await createTestProductWithVariants('dedup');

    // Reject subscribing to already in-stock variant
    await assert.rejects(
      () =>
        subscribeToBackInStock({
          productId,
          variantId: vInStockSmall,
          size: 'S',
          color: 'Void Black',
          phone: '9866666666',
          whatsappConsent: true,
        }),
      (err: any) => err instanceof BackInStockValidationError && err.code === 'VARIANT_ALREADY_IN_STOCK'
    );

    const first = await subscribeToBackInStock({
      productId,
      variantId: vMediumBlack,
      size: 'M',
      color: 'Void Black',
      customerId: 'cust-dedup',
      phone: '9866666666',
      whatsappConsent: true,
      websiteEnabled: true,
    });
    assert.equal(first.alreadySubscribed, false);

    // Duplicate subscription updates cleanly without creating a second row
    const second = await subscribeToBackInStock({
      productId,
      variantId: vMediumBlack,
      size: 'M',
      color: 'Void Black',
      customerId: 'cust-dedup',
      phone: '9866666666',
      email: 'dedup@example.com',
      whatsappConsent: true,
      websiteEnabled: true,
      emailBackupEnabled: true,
    });
    assert.equal(second.alreadySubscribed, true);
    assert.equal(second.subscription.id, first.subscription.id);

    // Restock 0 -> 5 triggers notifications once
    await inventoryRepository.setStock(vMediumBlack, 5, 'ADMIN-1');
    await waitForPendingBackInStockNotifications();
    assert.equal(fetchCalls.length, 2); // 1 WA + 1 Email

    // Further restock 5 -> 10 triggers ZERO notifications
    fetchCalls.length = 0;
    await inventoryRepository.updateStock(vMediumBlack, 5, 'RESTOCK', 'ADMIN-1');
    await waitForPendingBackInStockNotifications();
    assert.equal(fetchCalls.length, 0);
  });

  it('6. Inbound Meta STOP webhook revokes WhatsApp consent on active Back-in-Stock alerts while Website & Email still deliver', async () => {
    const { productId, vMediumBlack } = await createTestProductWithVariants('stop');

    const { subscription } = await subscribeToBackInStock({
      productId,
      variantId: vMediumBlack,
      size: 'M',
      color: 'Void Black',
      customerId: 'cust-stop',
      phone: '9877777777',
      email: 'stop@example.com',
      whatsappConsent: true,
      websiteEnabled: true,
      emailBackupEnabled: true,
    });

    // Provide minimal Prisma stub for campaignOrchestrator webhook call
    const minimalPrismaStub: any = {
      earlyAccessSubscriber: {
        findUnique: async () => null,
      },
      order: {
        updateMany: async () => ({ count: 0 }),
      },
    };
    setPrismaClientOverrideForTests(minimalPrismaStub);

    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ from: '919877777777', text: { body: 'STOP' } }],
              },
            },
          ],
        },
      ],
    };
    const rawBody = JSON.stringify(payload);
    const sig = 'sha256=' + crypto.createHmac('sha256', 'test-meta-secret').update(rawBody).digest('hex');

    const webhookRes = await handleWhatsAppWebhook({
      rawBody,
      signatureHeader: sig,
      body: payload,
    });
    assert.equal(webhookRes.statusCode, 200);
    assert.equal(webhookRes.payload.optOutCount, 1);

    setPrismaClientOverrideForTests(null);

    // Now restock: WhatsApp MUST be skipped, Website + Email MUST deliver
    const summaries = await handleVariantBackInStock(vMediumBlack, 0, 10);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].whatsapp.status, 'SKIPPED');
    assert.equal(summaries[0].website.status, 'DELIVERED');
    assert.equal(summaries[0].email.status, 'SENT');
    assert.equal(fetchCalls.filter((c) => c.url.includes('graph.facebook.com')).length, 0);

    const subAfter = await backInStockRepository.findSubscriptionById(subscription.id);
    assert.equal(subAfter?.whatsappConsent, false);
    assert.equal(subAfter?.whatsappStatus, 'SKIPPED');
  });

  it('7. Offline Website inbox read + independent Browser Push tracking + Admin Overview masking', async () => {
    const { productId, vMediumBlack } = await createTestProductWithVariants('inbox');

    const { subscription } = await subscribeToBackInStock({
      productId,
      variantId: vMediumBlack,
      size: 'M',
      color: 'Void Black',
      customerId: 'cust-offline',
      customerName: 'Zoya',
      phone: '9888888888',
      email: 'zoya@example.com',
      whatsappConsent: true,
      websiteEnabled: true,
      browserPushEnabled: true,
      emailBackupEnabled: false,
    });

    // Restock while customer is offline
    await handleVariantBackInStock(vMediumBlack, 0, 2);

    // Customer comes online later and fetches inbox
    const inbox = await backInStockRepository.listCustomerNotifications({ customerId: 'cust-offline' });
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].isRead, false);
    assert.equal(inbox[0].browserPushStatus, 'PENDING');

    // Browser delivers push notification and reports independently
    await backInStockRepository.updateBrowserPushStatus(inbox[0].id, 'DELIVERED');
    // Customer reads notification
    await backInStockRepository.markCustomerNotificationRead(inbox[0].id);

    const subAfter = await backInStockRepository.findSubscriptionById(subscription.id);
    assert.equal(subAfter?.whatsappStatus, 'SENT');
    assert.equal(subAfter?.websiteStatus, 'READ');
    assert.equal(subAfter?.browserPushStatus, 'DELIVERED');
    assert.equal(subAfter?.emailStatus, 'SKIPPED');

    // Admin overview returns masked contacts and accurate channel stats
    const overview = await getAdminBackInStockOverview();
    assert.equal(overview.summary.notifiedCount, 1);
    assert.equal(overview.summary.channelStats.whatsappSent, 1);
    assert.equal(overview.summary.channelStats.websiteDelivered, 1);
    assert.equal(overview.summary.channelStats.browserPushDelivered, 1);
    assert.equal(overview.subscriptions.length, 1);
    assert.ok(overview.subscriptions[0].phoneMask?.includes('****'), 'Admin phone must be masked');
    assert.ok(overview.subscriptions[0].emailMask?.includes('***@'), 'Admin email must be masked');
  });

  it('8. Backup Email escapes HTML safely, blocks javascript: image URLs, and supports EMAIL_API_KEY alias', async () => {
    const emailDoc = buildBackInStockEmail({
      subscriptionId: 'bis-xss-1',
      customerName: '<script>alert(1)</script>',
      productId: 'prod-1',
      productName: 'Ronin <b>Tee</b>',
      productSlug: 'ronin-tee',
      productImage: 'javascript:alert(2)',
      variantId: 'var-1',
      size: 'XL',
      color: 'Void Black',
    });

    assert.ok(!emailDoc.html.includes('<script>'), 'HTML script tags must be escaped');
    assert.ok(!emailDoc.html.includes('javascript:'), 'javascript: URLs must be stripped');
    assert.ok(emailDoc.html.includes('&lt;script&gt;'));
    assert.ok(emailDoc.text.includes('XL'));

    // Test EMAIL_API_KEY fallback alias when RESEND_API_KEY is unset
    process.env.RESEND_API_KEY = '';
    process.env.EMAIL_API_KEY = 're_alias_key_test';

    const { productId, vMediumBlack } = await createTestProductWithVariants('emailalias');
    await subscribeToBackInStock({
      productId,
      variantId: vMediumBlack,
      size: 'M',
      color: 'Void Black',
      email: 'alias@example.com',
      whatsappConsent: false,
      websiteEnabled: false,
      emailBackupEnabled: true,
    });

    const summaries = await handleVariantBackInStock(vMediumBlack, 0, 4);
    assert.equal(summaries[0].email.status, 'SENT');
    assert.equal(fetchCalls.length, 1);
    assert.ok(fetchCalls[0].url.includes('api.resend.com'));
  });
});
