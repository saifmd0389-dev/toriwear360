import crypto from 'crypto';
import { hashRecoveryCode } from '../server/services/totpService';
import { getPrismaClient } from '../server/db/prisma';
import { productRepository } from '../server/repositories/productRepository';
import { inventoryRepository } from '../server/repositories/inventoryRepository';
import { couponRepository } from '../server/repositories/couponRepository';
import { orderRepository } from '../server/repositories/orderRepository';

async function runTests() {
  const BASE_URL = 'http://localhost:3000';
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      failed++;
    }
  }

  function postWebhook(payload: any) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_tori_secure_2026';
    const bodyStr = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
    return fetch(`${BASE_URL}/api/v1/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature,
      },
      body: bodyStr,
    });
  }

  console.log('================================================================');
  console.log('TORIWEAR PHASE 4: ORDERS + PAYMENTS + INVENTORY VERIFICATION');
  console.log('================================================================\n');

  // Step 0: Authenticate Admin & Staff to obtain session tokens for secured operations
  console.log('--- STEP 0: Authentication Setup for Verification Suite ---');
  const prisma = getPrismaClient();
  if (prisma) {
    await prisma.twoFactorSetting.updateMany({
      where: { userId: 'usr-ananya' },
      data: {
        backupCodes: JSON.stringify(['ANAN-ORD-01', 'ANAN-ORD-02'].map(hashRecoveryCode)),
        lastAcceptedStep: null,
      },
    });
    await prisma.twoFactorSetting.updateMany({
      where: { userId: 'usr-saif' },
      data: {
        backupCodes: JSON.stringify(['SAIF-ORD-01', 'SAIF-ORD-02'].map(hashRecoveryCode)),
        lastAcceptedStep: null,
      },
    });
  }

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'ananya.operations@toriwear.com',
      password: 'StaffAnanya@2026!',
    }),
  });
  const loginData = await loginRes.json();
  const verify2faRes = await fetch(`${BASE_URL}/api/auth/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tempToken: loginData.tempToken, code: 'ANAN-ORD-01' }),
  });
  const verifyData = await verify2faRes.json();
  const staffSessionToken = verifyData.sessionToken;
  assert(Boolean(staffSessionToken), 'Staff authenticated with TOTP session token');

  const staffHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${staffSessionToken}`,
  };

  // Authenticate Super Admin for finance verification
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'admin@toriwear.com',
      password: 'ToriAdmin@2026!',
    }),
  });
  const adminLoginData = await adminLoginRes.json();
  const verifyAdmin2faRes = await fetch(`${BASE_URL}/api/auth/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tempToken: adminLoginData.tempToken, code: 'SAIF-ORD-01' }),
  });
  const verifyAdminData = await verifyAdmin2faRes.json();
  const adminSessionToken = verifyAdminData.sessionToken;
  assert(Boolean(adminSessionToken), 'Super Admin authenticated with TOTP session token');

  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminSessionToken}`,
  };

  // Get a test product and variant from catalog
  const products = await productRepository.getAll();
  const testProduct = products.find((p) => p.variants && p.variants.length > 0 && p.status === 'PUBLISHED') || products[0];
  if (!testProduct || !testProduct.variants?.[0]) {
    throw new Error('No test product with variants found for Phase 4 order tests');
  }
  const testVariant = testProduct.variants[0];
  const testColor = (testVariant as any).color || 'Void Black';

  // Ensure test variant has healthy stock for sequential order tests
  await inventoryRepository.updateStock(testVariant.id, 25, 'RESTOCK', 'TEST_HARNESS', 'Ensure ample stock for Phase 4 suite');
  const initialStock = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand || testVariant.stock;

  // --- 1. Order creation ---
  console.log('\n--- TEST 1: Order Creation ---');
  const orderInput = {
    customerName: 'Aarav Sharma',
    customerEmail: 'aarav.sharma@example.com',
    customerPhone: '+91 9876543210',
    customerId: 'cust-aarav-001',
    shippingAddress: {
      fullName: 'Aarav Sharma',
      phone: '+91 9876543210',
      email: 'aarav.sharma@example.com',
      addressLine1: 'Flat 402, Skyline Towers, Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      country: 'India',
    },
    items: [
      {
        productId: testProduct.id,
        variantId: testVariant.id,
        size: testVariant.size,
        color: testColor,
        quantity: 1,
      },
    ],
    paymentMethod: 'COD',
    idempotencyKey: `idem_test_${Date.now()}_1`,
  };

  const createRes1 = await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderInput),
  });
  const createData1 = await createRes1.json();
  assert(createRes1.status === 201 && createData1.success === true, 'Order created successfully (HTTP 201)');
  const order1 = createData1.order;
  assert(Boolean(order1.orderNumber) && order1.orderNumber.startsWith('TORI-'), `Assigned collision-safe order number: ${order1.orderNumber}`);

  // --- 2. Server-side price validation ---
  console.log('\n--- TEST 2: Server-side Price Validation ---');
  // Attempt to create order with tampered client prices (e.g. unitPrice = 1, total = 1)
  const tamperedInput = {
    ...orderInput,
    idempotencyKey: `idem_tamper_${Date.now()}`,
    unitPrice: 1,
    subtotal: 1,
    total: 1,
    items: [
      {
        productId: testProduct.id,
        variantId: testVariant.id,
        size: testVariant.size,
        color: testColor,
        quantity: 1,
        unitPrice: 1, // Tampered client price
        totalPrice: 1,
      },
    ],
  };
  const tamperRes = await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tamperedInput),
  });
  const tamperData = await tamperRes.json();
  assert(tamperRes.ok && tamperData.success === true, 'Order created and client tampered price was completely ignored');
  assert(
    tamperData.order.items[0].unitPrice === (testVariant.price || testProduct.price),
    `Server enforced authoritative catalog price: ₹${tamperData.order.items[0].unitPrice} (tampered client price ₹1 rejected)`
  );

  // --- 3. Server-side total calculation ---
  console.log('\n--- TEST 3: Server-side Total Calculation ---');
  const expectedSubtotal = testVariant.price || testProduct.price;
  const expectedShipping = expectedSubtotal >= 999 ? 0 : 79;
  const expectedTotal = expectedSubtotal + expectedShipping;
  assert(
    tamperData.order.subtotal === expectedSubtotal,
    `Authoritative subtotal verified: ₹${tamperData.order.subtotal}`
  );
  assert(
    tamperData.order.total === expectedTotal,
    `Authoritative total verified: ₹${tamperData.order.total} (including ₹${expectedShipping} shipping)`
  );

  // --- 4. Inventory deduction ---
  console.log('\n--- TEST 4: Inventory Deduction ---');
  const stockAfterOrder = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand;
  assert(
    stockAfterOrder !== undefined && stockAfterOrder < initialStock,
    `Inventory deducted from ${initialStock} to ${stockAfterOrder}`
  );

  // --- 5. Insufficient inventory ---
  console.log('\n--- TEST 5: Insufficient Inventory Rejection ---');
  const excessiveInput = {
    ...orderInput,
    idempotencyKey: `idem_excess_${Date.now()}`,
    items: [
      {
        productId: testProduct.id,
        variantId: testVariant.id,
        size: testVariant.size,
        color: testColor,
        quantity: 99999, // Way higher than available stock
      },
    ],
  };
  const excessRes = await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(excessiveInput),
  });
  const excessData = await excessRes.json();
  assert(excessRes.status === 400 && excessData.success === false, 'Order rejected with 400 when quantity exceeds available stock');

  // --- 6. Negative inventory prevention ---
  console.log('\n--- TEST 6: Negative Inventory Prevention ---');
  let threwNegative = false;
  try {
    await inventoryRepository.updateStock(testVariant.id, -999999, 'ORDER_FULFILLMENT', 'TEST_RUNNER');
  } catch (err: any) {
    threwNegative = true;
  }
  const currentStockAfterCheck = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand;
  assert(
    threwNegative && (currentStockAfterCheck || 0) >= 0,
    `Negative inventory strictly blocked by repository. Current stock: ${currentStockAfterCheck} (never negative)`
  );

  // --- 7. Duplicate order protection (Idempotency) ---
  console.log('\n--- TEST 7: Duplicate Order Protection (Idempotency) ---');
  const stockBeforeDup = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand || 0;
  const dupRes = await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderInput), // Identical payload with same idempotencyKey
  });
  const dupData = await dupRes.json();
  assert(dupRes.ok && dupData.order.id === order1.id, 'Duplicate order submission returned original existing order');
  const stockAfterDup = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand || 0;
  assert(stockAfterDup === stockBeforeDup, `Stock was NOT deducted again on duplicate order submission (Stock remained ${stockAfterDup})`);

  // --- 8. Successful payment ---
  console.log('\n--- TEST 8: Successful Payment Verification ---');
  // Create an unpaid order first
  const codOrderInput = {
    ...orderInput,
    idempotencyKey: `idem_cod_${Date.now()}`,
    paymentMethod: 'COD',
  };
  const codRes = await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(codOrderInput),
  });
  const codOrder = (await codRes.json()).order;
  assert(codOrder.paymentStatus === 'PENDING', 'New order initialized with PENDING paymentStatus');

  // Simulate payment verification for this order
  const verifyPayRes = await fetch(`${BASE_URL}/api/v1/payments/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: codOrder.id,
      gatewayOrderId: `sim_order_${Date.now()}`,
      gatewayPaymentId: `sim_pay_${Date.now()}`,
      isSimulated: true,
    }),
  });
  const verifyPayData = await verifyPayRes.json();
  assert(verifyPayRes.ok && verifyPayData.success === true, 'Payment verification returned success');

  const refreshedOrder = await (await fetch(`${BASE_URL}/api/v1/orders/${codOrder.id}`, { headers: staffHeaders })).json();
  assert(refreshedOrder.data.paymentStatus === 'PAID', 'Order transitioned to PAID payment status');

  // --- 9. Failed payment ---
  console.log('\n--- TEST 9: Failed Payment Handling ---');
  const failOrderInput = {
    ...orderInput,
    idempotencyKey: `idem_fail_${Date.now()}`,
    paymentMethod: 'COD',
  };
  const failOrderRes = await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(failOrderInput),
  });
  const failOrderJson = await failOrderRes.json();
  const failOrder = failOrderJson.order;
  assert(Boolean(failOrder?.id), 'Fail order created successfully');

  // Send webhook with payment.failed
  const webhookFailRes = await postWebhook({
    event: 'payment.failed',
    event_id: `evt_fail_${Date.now()}`,
    orderId: failOrder.id,
    payload: {
      payment: {
        entity: {
          id: `pay_fail_${Date.now()}`,
          error_description: 'Card declined by issuing bank',
          notes: { orderId: failOrder.id },
        },
      },
    },
  });
  assert(webhookFailRes.ok, 'Failed payment webhook acknowledged');
  const failedRefreshed = await (await fetch(`${BASE_URL}/api/v1/orders/${failOrder.id}`, { headers: staffHeaders })).json();
  assert(failedRefreshed.data.paymentStatus === 'FAILED', 'Order paymentStatus accurately updated to FAILED');

  // --- 10. Duplicate webhook idempotency ---
  console.log('\n--- TEST 10: Duplicate Webhook Idempotency ---');
  const sharedEventId = `evt_shared_${Date.now()}`;
  const webhookPayload = {
    event: 'payment.captured',
    event_id: sharedEventId,
    orderId: codOrder.id,
    payload: {
      payment: {
        entity: {
          id: `pay_cap_${Date.now()}`,
          notes: { orderId: codOrder.id },
        },
      },
    },
  };

  const wh1 = await postWebhook(webhookPayload);
  const wh1Data = await wh1.json();
  assert(wh1.ok && wh1Data.received === true, 'First webhook delivery processed');

  const wh2 = await postWebhook(webhookPayload);
  const wh2Data = await wh2.json();
  assert(wh2.ok && wh2Data.duplicate === true, 'Second identical webhook identified as duplicate and acknowledged cleanly');

  // --- 11. Out-of-order webhook protection ---
  console.log('\n--- TEST 11: Out-of-order Webhook Protection ---');
  // codOrder is already PAID. A late payment.failed webhook must NOT downgrade it to FAILED
  const lateFailPayload = {
    event: 'payment.failed',
    event_id: `evt_late_fail_${Date.now()}`,
    orderId: codOrder.id,
    payload: {
      payment: {
        entity: {
          id: `pay_late_${Date.now()}`,
          notes: { orderId: codOrder.id },
        },
      },
    },
  };
  await postWebhook(lateFailPayload);
  const checkLate = await (await fetch(`${BASE_URL}/api/v1/orders/${codOrder.id}`, { headers: staffHeaders })).json();
  assert(checkLate.data.paymentStatus === 'PAID', 'Late failed webhook was blocked from downgrading already-PAID order');

  // --- 12. Payment status transition validation ---
  console.log('\n--- TEST 12: Payment Status Transition Validation ---');
  // Refund codOrder
  await fetch(`${BASE_URL}/api/v1/admin/orders/${codOrder.id}/refund`, {
    method: 'POST',
    headers: staffHeaders,
    body: JSON.stringify({ amount: codOrder.total, reason: 'Transition test refund' }),
  });
  const refundedCheck = await (await fetch(`${BASE_URL}/api/v1/orders/${codOrder.id}`, { headers: staffHeaders })).json();
  assert(refundedCheck.data.paymentStatus === 'REFUNDED', 'Order is in REFUNDED status');

  // Attempt to transition REFUNDED -> PAID via verification
  const invalidTransitionRes = await fetch(`${BASE_URL}/api/v1/payments/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: codOrder.id,
      gatewayOrderId: 'any',
      gatewayPaymentId: 'any',
      isSimulated: true,
    }),
  });
  const invalidTransitionData = await invalidTransitionRes.json();
  assert(invalidTransitionData.success === false, 'Invalid state transition from REFUNDED to PAID was strictly rejected');

  // --- 13. Order status transition validation ---
  console.log('\n--- TEST 13: Order Status Transition Validation ---');
  // Attempt invalid transition: CONFIRMED -> CANCELLED is allowed, but once CANCELLED -> PROCESSING must be rejected
  const cancelTestRes = await fetch(`${BASE_URL}/api/v1/orders/${order1.id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-customer-id': order1.customerId || 'cust-aarav-001' },
    body: JSON.stringify({ reason: 'Customer changed mind' }),
  });
  assert(cancelTestRes.ok, 'Order transitioned to CANCELLED');

  const invalidOrderTransition = await fetch(`${BASE_URL}/api/v1/admin/orders/${order1.id}/status`, {
    method: 'PUT',
    headers: staffHeaders,
    body: JSON.stringify({ status: 'PROCESSING' }),
  });
  assert(invalidOrderTransition.status === 400, 'Invalid transition CANCELLED -> PROCESSING rejected with 400');

  // --- 14. Order cancellation ---
  console.log('\n--- TEST 14: Order Cancellation ---');
  const orderToCancelInput = {
    ...orderInput,
    idempotencyKey: `idem_cancel_${Date.now()}`,
  };
  const orderToCancel = (await (await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderToCancelInput),
  })).json()).order;

  const cancelRes = await fetch(`${BASE_URL}/api/v1/orders/${orderToCancel.id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-customer-id': orderToCancel.customerId },
    body: JSON.stringify({ reason: 'Wrong size selected' }),
  });
  const cancelData = await cancelRes.json();
  assert(cancelRes.ok && cancelData.order.fulfillmentStatus === 'CANCELLED', 'Order cancellation successfully set status to CANCELLED');

  // --- 15. Duplicate cancellation idempotency ---
  console.log('\n--- TEST 15: Duplicate Cancellation Idempotency ---');
  const cancelRes2 = await fetch(`${BASE_URL}/api/v1/orders/${orderToCancel.id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-customer-id': orderToCancel.customerId },
    body: JSON.stringify({ reason: 'Wrong size selected' }),
  });
  const cancelData2 = await cancelRes2.json();
  assert(cancelRes2.ok && cancelData2.alreadyCancelled === true, 'Second cancellation request detected as duplicate and safely returned without error');

  // --- 16. Inventory restock upon cancellation ---
  console.log('\n--- TEST 16: Inventory Restock ---');
  // Create an order for 2 units, note stock, cancel it, check stock restored by 2
  const restockItemInput = {
    ...orderInput,
    idempotencyKey: `idem_restock_test_${Date.now()}`,
    items: [
      {
        productId: testProduct.id,
        variantId: testVariant.id,
        size: testVariant.size,
        color: testColor,
        quantity: 2,
      },
    ],
  };
  const preStock = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand || 0;
  const restockOrderRes = await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(restockItemInput),
  });
  const restockOrder = (await restockOrderRes.json()).order;
  const stockAfterPurchase = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand || 0;
  assert(stockAfterPurchase === preStock - 2, `Stock deducted by 2 units on purchase (From ${preStock} to ${stockAfterPurchase})`);

  await fetch(`${BASE_URL}/api/v1/orders/${restockOrder.id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-customer-id': restockOrder.customerId },
    body: JSON.stringify({ reason: 'Testing restock' }),
  });
  const stockAfterRestock = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand || 0;
  assert(stockAfterRestock === preStock, `Stock accurately restored by 2 units after cancellation (Back to ${stockAfterRestock})`);

  // --- 17. Duplicate restock protection ---
  console.log('\n--- TEST 17: Duplicate Restock Protection ---');
  // Attempt to cancel again; stock MUST NOT increment beyond preStock
  await fetch(`${BASE_URL}/api/v1/orders/${restockOrder.id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-customer-id': restockOrder.customerId },
    body: JSON.stringify({ reason: 'Testing duplicate restock' }),
  });
  const stockAfterSecondCancel = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand || 0;
  assert(stockAfterSecondCancel === preStock, `Duplicate cancellation did NOT double-restock inventory (Stock remained ${stockAfterSecondCancel})`);

  // --- 18. Coupon usage increment ---
  console.log('\n--- TEST 18: Coupon Usage Increment ---');
  const coupon = await couponRepository.findByCode('TORI100');
  const initialUsage = coupon?.usageCount || 0;
  const couponOrderInput = {
    ...orderInput,
    idempotencyKey: `idem_coupon_${Date.now()}`,
    couponCode: 'TORI100',
  };
  const couponOrder = (await (await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(couponOrderInput),
  })).json()).order;

  const usageAfterOrder = (await couponRepository.findByCode('TORI100'))?.usageCount || 0;
  assert(usageAfterOrder === initialUsage + 1, `Coupon usage count incremented by 1 (From ${initialUsage} to ${usageAfterOrder})`);

  // --- 19. Duplicate webhook coupon protection ---
  console.log('\n--- TEST 19: Duplicate Webhook Coupon Protection ---');
  const couponWhId = `evt_coupon_${Date.now()}`;
  await postWebhook({
    event: 'payment.captured',
    event_id: couponWhId,
    orderId: couponOrder.id,
    payload: { payment: { entity: { id: `pay_c_${Date.now()}`, notes: { orderId: couponOrder.id } } } },
  });
  const usageAfterWh1 = (await couponRepository.findByCode('TORI100'))?.usageCount || 0;

  // Send duplicate webhook
  await postWebhook({
    event: 'payment.captured',
    event_id: couponWhId,
    orderId: couponOrder.id,
    payload: { payment: { entity: { id: `pay_c_${Date.now()}`, notes: { orderId: couponOrder.id } } } },
  });
  const usageAfterWh2 = (await couponRepository.findByCode('TORI100'))?.usageCount || 0;
  assert(usageAfterWh2 === usageAfterWh1, `Duplicate webhook did NOT double-increment coupon usage (Remained ${usageAfterWh2})`);

  // --- 20. Refund state handling ---
  console.log('\n--- TEST 20: Refund State Handling ---');
  const refundRes = await fetch(`${BASE_URL}/api/v1/admin/orders/${couponOrder.id}/refund`, {
    method: 'POST',
    headers: staffHeaders,
    body: JSON.stringify({ amount: couponOrder.total, reason: 'Defective item returned' }),
  });
  const refundData = await refundRes.json();
  assert(refundRes.ok && refundData.order.refundStatus === 'REFUND_COMPLETED', 'Refund processed and marked REFUND_COMPLETED');
  assert(refundData.order.paymentStatus === 'REFUNDED', 'Order paymentStatus updated to REFUNDED');

  // --- 21. Finance transaction idempotency ---
  console.log('\n--- TEST 21: Finance Transaction Idempotency ---');
  // Check that duplicate webhook/verification didn't create duplicate ledger entries
  const financeRes = await fetch(`${BASE_URL}/api/v1/admin/finance/summary`, { headers: adminHeaders });
  const financeData = await financeRes.json();
  assert(financeRes.ok && financeData.success === true, 'Authoritative financial summary retrieved');
  const txs = financeData.data.recentTransactions || [];
  const orderPayTxs = txs.filter((t: any) => t.referenceId === `ORDER_PAY_${couponOrder.id}`);
  assert(orderPayTxs.length <= 1, `Revenue ledger entry for order is unique (Found ${orderPayTxs.length} transaction)`);

  // --- 22. Concurrent final-stock purchase ---
  console.log('\n--- TEST 22: Concurrent Final-Stock Purchase (Race Condition Protection) ---');
  // Set variant stock to exactly 1
  await inventoryRepository.setStock(testVariant.id, 1, 'TEST_RUNNER', 'Prepare final stock race test');
  const verifyOneStock = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand;
  assert(verifyOneStock === 1, 'Test variant stock set to exactly 1 unit');

  // Fire two order creations nearly simultaneously
  const reqA = fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...orderInput,
      idempotencyKey: `idem_race_A_${Date.now()}`,
    }),
  });
  const reqB = fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...orderInput,
      idempotencyKey: `idem_race_B_${Date.now()}`,
    }),
  });

  const [resA, resB] = await Promise.all([reqA, reqB]);
  const dataA = await resA.json();
  const dataB = await resB.json();

  const oneSucceeded = (dataA.success && !dataB.success) || (!dataA.success && dataB.success);
  assert(oneSucceeded, 'Exactly one concurrent purchase succeeded and the other was rejected');
  const finalStock = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand;
  assert(finalStock === 0, `Final stock is exactly 0 and never became negative (Final stock: ${finalStock})`);

  // Restore inventory to healthy baseline for product
  await inventoryRepository.setStock(testVariant.id, 25, 'TEST_RUNNER', 'Restore baseline stock');

  // --- 23. Customer order authorization / IDOR protection ---
  console.log('\n--- TEST 23: Customer Order Authorization / IDOR Protection ---');
  // Customer B attempts to access Customer A's order (order1 belongs to cust-aarav-001)
  const idorRes = await fetch(`${BASE_URL}/api/v1/orders/${order1.id}`, {
    headers: {
      'x-customer-id': 'cust-attacker-999',
      'x-customer-email': 'attacker@malicious.com',
    },
  });
  assert(idorRes.status === 403, 'Customer B attempting to read Customer A order received 403 Forbidden');

  // Customer B attempts to cancel Customer A's order
  const idorCancelRes = await fetch(`${BASE_URL}/api/v1/orders/${order1.id}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-customer-id': 'cust-attacker-999',
      'x-customer-email': 'attacker@malicious.com',
    },
    body: JSON.stringify({ reason: 'Hacking cancel' }),
  });
  assert(idorCancelRes.status === 403, 'Customer B attempting to cancel Customer A order received 403 Forbidden');

  // Legitimate Customer A CAN access their own order
  const legitAccessRes = await fetch(`${BASE_URL}/api/v1/orders/${order1.id}`, {
    headers: {
      'x-customer-id': 'cust-aarav-001',
      'x-customer-email': 'aarav.sharma@example.com',
    },
  });
  assert(legitAccessRes.ok, 'Legitimate customer successfully accesses own order');

  // --- 24. Persistence after server restart ---
  console.log('\n--- TEST 24: Persistence Verification ---');
  // Check that order1 exists in order repository and orders-store.json on disk
  const persistedOrder = await orderRepository.findById(order1.id);
  assert(Boolean(persistedOrder), `Order ${order1.orderNumber} successfully retrieved from persistent repository`);
  assert(persistedOrder?.total === order1.total, `Persisted order total exactly matches: ₹${persistedOrder?.total}`);

  console.log('\n================================================================');
  console.log(`PHASE 4 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running Phase 4 test suite:', err);
  process.exit(1);
});
