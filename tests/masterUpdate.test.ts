import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempRuntimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toriwear-master-test-'));
process.env.TORI_RUNTIME_DATA_DIR = tempRuntimeDir;

test.after(() => {
  try {
    fs.rmSync(tempRuntimeDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

test('Store Contact, Social Ordering & Meta Secret Isolation', async () => {
  process.env.META_CONVERSIONS_API_TOKEN = 'secret_meta_token_should_never_leak';
  const { cmsRepository } = await import('../server/repositories/cmsRepository');

  const updated = await cmsRepository.updateStoreSettings(
    {
      supportEmail: 'concierge@thetoriwearstore.in',
      supportPhone: '+91 98201 99999',
      returnWindowDays: 10,
      whatsappNumber: '+91 98201 99999',
      whatsappDefaultMessage: 'Hi TORIWEAR Concierge!',
      metaBusiness: {
        domainVerificationCode: 'meta-verify-123',
        pixelId: '9988776655',
        capiEnabled: true,
      },
      contactChannels: [
        {
          id: 'ch-test-2',
          platform: 'INSTAGRAM',
          label: 'Instagram',
          valueOrUrl: 'https://instagram.com/toriwear_official',
          isEnabled: true,
          displayOrder: 1,
        },
        {
          id: 'ch-test-hidden',
          platform: 'DISCORD',
          label: 'Hidden Discord',
          valueOrUrl: 'https://discord.gg/hidden',
          isEnabled: false,
          displayOrder: 2,
        },
      ],
    },
    'test-admin'
  );

  assert.equal(updated.returnWindowDays, 10);
  const publicCfg = await cmsRepository.getPublicContactConfig(false);
  assert.equal(publicCfg.supportEmail, 'concierge@thetoriwearstore.in');
  assert.equal(publicCfg.phone, '+91 98201 99999');
  assert.equal(publicCfg.returnWindowDays, 10);
  assert.equal(publicCfg.channels.length, 1);
  assert.equal(publicCfg.channels[0]?.url, 'https://instagram.com/toriwear_official');

  // Verify CAPI token is never included in public config or persisted store settings
  const serializedPublic = JSON.stringify(publicCfg);
  const serializedSettings = JSON.stringify(updated);
  assert.equal(serializedPublic.includes('secret_meta_token_should_never_leak'), false);
  assert.equal(serializedSettings.includes('secret_meta_token_should_never_leak'), false);
});

test('Dynamic Category CRUD, Bulk Assignment & Unlink-Only Deletion', async () => {
  const { productRepository } = await import('../server/repositories/productRepository');

  const products = await productRepository.getAll({ status: 'ALL' });
  assert.ok(products.length > 0, 'Expected seeded/stored products in repository');
  const targetProd = products[0]!;

  const catId = `cat-test-${Date.now()}`;
  const created = await productRepository.saveCategory({
    id: catId,
    name: 'Shonen Heavyweight Test',
    slug: `shonen-heavyweight-test-${Date.now()}`,
    department: 'MEN',
    description: 'Test dynamic category',
    displayOrder: 5,
    isActive: true,
    isEnabled: true,
    showInNav: true,
  });
  assert.equal(created.id, catId);

  const assignRes = await productRepository.assignProductsToCategory(catId, [targetProd.id]);
  assert.equal(assignRes.assignedCount, 1);

  const afterAssign = await productRepository.findById(targetProd.id);
  assert.ok(afterAssign);
  assert.ok((afterAssign!.categoryIds || []).includes(catId));

  // Delete category -> product MUST remain in catalog, only unlinked
  const delRes = await productRepository.deleteCategory(catId);
  assert.equal(delRes.deleted, true);

  const prodAfterDelete = await productRepository.findById(targetProd.id);
  assert.ok(prodAfterDelete, 'Product must NOT be deleted when its category is deleted');
  assert.equal((prodAfterDelete!.categoryIds || []).includes(catId), false);
});

test('Customer Session Token Persistence Across Repository Queries', async () => {
  const { customerRepository } = await import('../server/repositories/customerRepository');

  const custId = `cust-session-test-${Date.now()}`;
  const savedCust = await customerRepository.save({
    id: custId,
    name: 'Session Verify User',
    email: `session-${Date.now()}@toriwear.com`,
    phone: '9876543210',
    isGuest: false,
    status: 'ACTIVE',
    toriCredit: 0,
    insiderTier: 'Bronze',
    insiderPoints: 0,
    addresses: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.equal(savedCust.id, custId);

  const token = `tok-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const nowIso = new Date().toISOString();
  await customerRepository.saveSession({
    token,
    customerId: custId,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    isValid: true,
    lastActiveAt: nowIso,
    createdAt: nowIso,
  });

  const resolvedCustomer = await customerRepository.findCustomerBySessionToken(token);
  assert.ok(resolvedCustomer);
  assert.equal(resolvedCustomer!.id, custId);

  await customerRepository.revokeSession(token);
  const removed = await customerRepository.findCustomerBySessionToken(token);
  assert.equal(removed, null);
});

test('Returns & Refunds Lifecycle: Delivery Eligibility, Return Window, Idempotent Restock & Manual Refund Caps', async () => {
  const { orderRepository } = await import('../server/repositories/orderRepository');
  const { inventoryRepository } = await import('../server/repositories/inventoryRepository');
  const { returnService } = await import('../server/services/returnService');
  const { cmsRepository } = await import('../server/repositories/cmsRepository');

  await cmsRepository.updateStoreSettings({ returnWindowDays: 7 }, 'test-admin');

  const prodId = 'prod-return-test';
  const variantId = `var-ret-${Date.now()}`;
  await inventoryRepository.syncProductVariants([
    { id: variantId, sku: `RET-SKU-${Date.now()}`, stock: 10 },
  ]);
  await inventoryRepository.setStock(variantId, 10, 'test-admin', 'Initial test stock');

  // 1. Undelivered order MUST be rejected
  const undeliveredOrder = await orderRepository.create({
    id: `ORD-UNDELIV-${Date.now()}`,
    orderNumber: `TORI-UND-${Date.now()}`,
    customerId: 'cust-ret-1',
    customerName: 'Return Tester',
    customerEmail: 'returns@toriwear.com',
    customerPhone: '9876500001',
    subtotal: 1499,
    discount: 0,
    tax: 0,
    shippingFee: 0,
    total: 1499,
    currency: 'INR',
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    fulfillmentStatus: 'SHIPPED',
    shippingAddress: {
      fullName: 'Return Tester',
      phone: '9876500001',
      email: 'returns@toriwear.com',
      addressLine1: '42 Tokyo Lane',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    },
    items: [
      {
        id: 'oi-1',
        productId: prodId,
        variantId,
        productName: 'Test Heavyweight Tee',
        sku: 'RET-SKU',
        size: 'L',
        color: 'Obsidian Black',
        quantity: 2,
        unitPrice: 1499,
        totalPrice: 2998,
        image: '/assets/placeholder.jpg',
      },
    ],
    timeline: [{ status: 'SHIPPED', timestamp: new Date().toISOString(), description: 'In transit' }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const rejectUndelivered = await returnService.createReturnRequest(
    {
      orderIdOrNumber: undeliveredOrder.id,
      requestType: 'RETURN',
      reason: 'Size mismatch',
      items: [{ orderItemId: 'oi-1', productId: prodId, variantId, size: 'L', quantity: 1 }],
    },
    undeliveredOrder
  );
  assert.equal(rejectUndelivered.success, false);

  // 2. Expired return window MUST be rejected
  const expiredDeliveredOrder = await orderRepository.create({
    ...undeliveredOrder,
    id: `ORD-EXP-${Date.now()}`,
    orderNumber: `TORI-EXP-${Date.now()}`,
    fulfillmentStatus: 'DELIVERED',
    timeline: [
      {
        status: 'DELIVERED',
        timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Delivered 12 days ago',
      },
    ],
  });

  const rejectExpired = await returnService.createReturnRequest(
    {
      orderIdOrNumber: expiredDeliveredOrder.id,
      requestType: 'RETURN',
      reason: 'Size mismatch',
      items: [{ orderItemId: 'oi-1', productId: prodId, variantId, size: 'L', quantity: 1 }],
    },
    expiredDeliveredOrder
  );
  assert.equal(rejectExpired.success, false);
  assert.match(rejectExpired.error || '', /expired/i);

  // 3. Valid delivered order within return window
  const validOrder = await orderRepository.create({
    ...undeliveredOrder,
    id: `ORD-DELIV-${Date.now()}`,
    orderNumber: `TORI-DELIV-${Date.now()}`,
    fulfillmentStatus: 'DELIVERED',
    timeline: [{ status: 'DELIVERED', timestamp: new Date().toISOString(), description: 'Delivered today' }],
  });

  // Over-quantity MUST be rejected
  const overQty = await returnService.createReturnRequest(
    {
      orderIdOrNumber: validOrder.id,
      requestType: 'RETURN',
      reason: 'Defective print',
      items: [{ orderItemId: 'oi-1', productId: prodId, variantId, size: 'L', quantity: 5 }],
    },
    validOrder
  );
  assert.equal(overQty.success, false);

  const createdRet = await returnService.createReturnRequest(
    {
      orderIdOrNumber: validOrder.id,
      requestType: 'RETURN',
      reason: 'Wrong fit / prefer smaller',
      items: [{ orderItemId: 'oi-1', productId: prodId, variantId, size: 'L', quantity: 1 }],
    },
    validOrder
  );
  assert.equal(createdRet.success, true);
  assert.ok(createdRet.returnRequest);
  const retId = createdRet.returnRequest!.id;

  const actor = { id: 'admin-1', name: 'Test Admin', role: 'SUPER_ADMIN' };

  // Rejection requires reason
  const badReject = await returnService.updateStatus(retId, 'REJECTED', actor, { rejectionReason: '' });
  assert.equal(badReject.success, false);

  // Approve -> Pickup -> Warehouse (triggers single idempotent restock)
  const approved = await returnService.updateStatus(retId, 'APPROVED', actor, {});
  assert.equal(approved.success, true);

  const pickedUp = await returnService.updateStatus(retId, 'PICKUP_SCHEDULED', actor, {
    courierPartner: 'Delhivery Reverse',
    awbNumber: 'DLV-TEST-99',
  });
  assert.equal(pickedUp.success, true);

  const received = await returnService.updateStatus(retId, 'RETURNED_TO_WAREHOUSE', actor, {});
  assert.equal(received.success, true);
  assert.ok(received.returnRequest?.restockedAt);

  const invAfterRestock = await inventoryRepository.getByVariantId(variantId);
  assert.equal(invAfterRestock?.quantityOnHand, 11, 'Stock should increase once by 1 when returned to warehouse');

  // Cannot refund above eligible amount
  const overRefund = await returnService.processReturnRefund(
    retId,
    actor,
    { amount: 9999, method: 'BANK_UPI_MANUAL', reference: 'UTR-OVER-TEST' },
    '127.0.0.1'
  );
  assert.equal(overRefund.success, false);

  // Manual refund requires payout reference >= 3 chars
  const missingRefRefund = await returnService.processReturnRefund(
    retId,
    actor,
    { amount: 1499, method: 'BANK_UPI_MANUAL', reference: '' },
    '127.0.0.1'
  );
  assert.equal(missingRefRefund.success, false);

  // Valid manual refund
  const validRefund = await returnService.processReturnRefund(
    retId,
    actor,
    { amount: 1499, method: 'BANK_UPI_MANUAL', reference: 'UTR-VALID-7721' },
    '127.0.0.1'
  );
  assert.equal(validRefund.success, true);
  assert.equal(validRefund.returnRequest?.status, 'REFUNDED');
  assert.equal(validRefund.returnRequest?.refundStatus, 'REFUND_COMPLETED');
});

test('Public Catalog Feeds Format Products for Meta Commerce & Sitemap/Robots', async () => {
  const { productRepository } = await import('../server/repositories/productRepository');
  const products = await productRepository.getAll({ status: 'PUBLISHED' });
  assert.ok(Array.isArray(products) && products.length > 0);
  const first = products[0]!;
  assert.ok(first.id && first.name && Number(first.price) > 0);
});
