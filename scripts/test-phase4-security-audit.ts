/**
 * TORIWEAR PHASE 4.1 SECURITY & TRANSACTIONAL VERIFICATION SUITE
 * 
 * Audits:
 * 1. Customer order ownership & IDOR protection
 * 2. Payment webhook authenticity & signature verification
 * 3. Refund integrity & financial recording
 * 4. Inventory concurrency & persistence guarantees
 * 5. Order/payment/inventory/coupon/finance idempotency
 */

import crypto from 'crypto';
import { hashRecoveryCode } from '../server/services/totpService';
import { getPrismaClient } from '../server/db/prisma';
import { productRepository } from '../server/repositories/productRepository';
import { inventoryRepository } from '../server/repositories/inventoryRepository';
import { couponRepository } from '../server/repositories/couponRepository';
import { orderRepository } from '../server/repositories/orderRepository';
import { financeRepository } from '../server/repositories/financeRepository';
import { paymentService } from '../server/services/paymentService';

const BASE_URL = 'http://localhost:3000';

async function runPhase41Audit() {
  console.log('================================================================');
  console.log('TORIWEAR — PHASE 4.1 SECURITY & TRANSACTIONAL VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}${detail ? ` (${detail})` : ''}`);
      failed++;
    }
  }

  // --- STEP 0: Authentication Setup ---
  console.log('--- SETUP: Super Admin Authentication ---');
  const prisma = getPrismaClient();
  if (prisma) {
    await prisma.twoFactorSetting.updateMany({
      where: { userId: 'usr-saif' },
      data: {
        backupCodes: JSON.stringify(['SAIF-AUD-01', 'SAIF-AUD-02'].map(hashRecoveryCode)),
        lastAcceptedStep: null,
      },
    });
  }

  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'admin@toriwear.com',
      password: 'ToriAdmin@2026!',
    }),
  });
  const adminLoginData = await adminLoginRes.json();
  let adminSessionToken = adminLoginData.sessionToken;

  if (adminLoginData.requires2FA && adminLoginData.tempToken) {
    const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: adminLoginData.tempToken, code: 'SAIF-AUD-01' }),
    });
    const verifyData = await verifyRes.json();
    adminSessionToken = verifyData.sessionToken;
  }

  assert(Boolean(adminSessionToken), 'Super Admin authenticated with valid session token');

  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminSessionToken}`,
  };

  const products = await productRepository.getAll();
  const testProduct = products.find((p) => p.variants && p.variants.length > 0 && p.status === 'PUBLISHED') || products[0];
  if (!testProduct || !testProduct.variants?.[0]) {
    throw new Error('No test product with variants found for Phase 4 security audit');
  }
  const testVariant = testProduct.variants[0];
  const testColor = testVariant.colorName || (testVariant as any).color || 'Void Black';

  // ============================================================================
  // CHECK 1 — CUSTOMER IDENTITY AND IDOR PROTECTION
  // ============================================================================
  console.log('\n--- CHECK 1: Customer Identity and IDOR Protection ---');

  // Create Order for Customer A (Aarav)
  const orderAInput = {
    customerName: 'Aarav Sharma',
    customerEmail: 'aarav.sharma@example.com',
    customerPhone: '+91 9876543210',
    customerId: 'cust-aarav-101',
    shippingAddress: {
      fullName: 'Aarav Sharma',
      phone: '+91 9876543210',
      email: 'aarav.sharma@example.com',
      addressLine1: 'Bandra West',
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
    paymentMethod: 'UPI',
    idempotencyKey: `idem_p41_orderA_${Date.now()}`,
  };

  const orderARes = await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderAInput),
  });
  const orderA = (await orderARes.json()).order;
  assert(Boolean(orderA?.id), `Order A created with ID ${orderA?.id}`);
  assert(Boolean(orderA?.orderAccessToken), `Order A has secure server-generated orderAccessToken`);

  // Test 1.1: Customer A reads their own order (allowed)
  const resOwnerRead = await fetch(`${BASE_URL}/api/v1/orders/${orderA.id}`, {
    headers: {
      'x-customer-id': 'cust-aarav-101',
      'x-customer-email': 'aarav.sharma@example.com',
    },
  });
  assert(resOwnerRead.status === 200, 'Legitimate Customer A reads own order -> 200 OK');

  // Test 1.2: Customer A reads with orderAccessToken (allowed)
  const resTokenRead = await fetch(`${BASE_URL}/api/v1/orders/${orderA.id}`, {
    headers: {
      'x-order-token': orderA.orderAccessToken,
    },
  });
  assert(resTokenRead.status === 200, 'Legitimate Customer reads order using orderAccessToken -> 200 OK');

  // Test 1.3: Customer B (Attacker) attempts to read Customer A's order (must be rejected)
  const resAttackerRead = await fetch(`${BASE_URL}/api/v1/orders/${orderA.id}`, {
    headers: {
      'x-customer-id': 'cust-attacker-999',
      'x-customer-email': 'attacker@malicious.com',
    },
  });
  assert(resAttackerRead.status === 403, 'Customer B attempting to read Customer A order -> 403 Forbidden');

  // Test 1.4: Unauthenticated client with NO headers attempts to read Customer A's order (must be rejected)
  const resNoHeaderRead = await fetch(`${BASE_URL}/api/v1/orders/${orderA.id}`);
  assert(resNoHeaderRead.status === 403, 'Unauthenticated client with NO headers reading order -> 403 Forbidden');

  // Test 1.5: Customer B (Attacker) attempts to cancel Customer A's order (must be rejected)
  const resAttackerCancel = await fetch(`${BASE_URL}/api/v1/orders/${orderA.id}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-customer-id': 'cust-attacker-999',
      'x-customer-email': 'attacker@malicious.com',
    },
    body: JSON.stringify({ reason: 'Malicious cancellation attempt' }),
  });
  assert(resAttackerCancel.status === 403, 'Customer B attempting to cancel Customer A order -> 403 Forbidden');

  // Test 1.6: Unauthenticated client with NO headers attempts to cancel Customer A's order (must be rejected)
  const resNoHeaderCancel = await fetch(`${BASE_URL}/api/v1/orders/${orderA.id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Anonymous cancellation attempt' }),
  });
  assert(resNoHeaderCancel.status === 403, 'Unauthenticated client with NO headers cancelling order -> 403 Forbidden');

  // Test 1.7: Unauthenticated client attempting to list customer orders with NO headers (must be rejected)
  const resNoHeaderList = await fetch(`${BASE_URL}/api/v1/orders/customer/cust-aarav-101`);
  assert(resNoHeaderList.status === 403, 'Unauthenticated client querying customer order list -> 403 Forbidden');

  // Test 1.8: Customer B querying Customer A's order list (must be rejected)
  const resMismatchedList = await fetch(`${BASE_URL}/api/v1/orders/customer/cust-aarav-101`, {
    headers: { 'x-customer-id': 'cust-attacker-999' },
  });
  assert(resMismatchedList.status === 403, 'Customer B querying Customer A order list -> 403 Forbidden');

  // Test 1.9: Authorized Admin accesses Customer A's order (allowed under role policy)
  const resAdminRead = await fetch(`${BASE_URL}/api/v1/orders/${orderA.id}`, {
    headers: adminHeaders,
  });
  assert(resAdminRead.status === 200, 'Authorized Admin accesses order under role policy -> 200 OK');

  // ============================================================================
  // CHECK 2 — PAYMENT WEBHOOK AUTHENTICITY & SIGNATURE VERIFICATION
  // ============================================================================
  console.log('\n--- CHECK 2: Payment Webhook Authenticity ---');

  // Test 2.1: Malformed payload rejection
  const resMalformed = await fetch(`${BASE_URL}/api/v1/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify('not-an-object'),
  });
  assert(resMalformed.status === 400, 'Malformed non-object webhook payload -> 400 Bad Request');

  // Test 2.2: Missing signature when secret is configured
  const testSecret = 'whsec_test_toriwear_secret_key_2026';
  process.env.RAZORPAY_WEBHOOK_SECRET = testSecret;

  const validPayload = {
    event: 'payment.captured',
    event_id: `evt_sig_test_${Date.now()}`,
    orderId: orderA.id,
    payload: {
      payment: {
        entity: {
          id: `pay_sig_${Date.now()}`,
          order_id: `order_gw_${Date.now()}`,
          notes: { orderId: orderA.id },
        },
      },
    },
  };
  const rawBody = JSON.stringify(validPayload);

  const missingSigResult = await paymentService.processWebhook('razorpay', '', validPayload, rawBody);
  assert(missingSigResult.success === false && Boolean(missingSigResult.error?.includes('Missing')), 'Configured secret: Webhook with MISSING signature rejected');

  // Test 2.3: Invalid signature rejection
  const badSigResult = await paymentService.processWebhook('razorpay', 'invalid_signature_hex_digest_12345', validPayload, rawBody);
  assert(badSigResult.success === false && Boolean(badSigResult.error?.includes('Invalid')), 'Configured secret: Webhook with INVALID signature rejected');

  // Test 2.4: Valid HMAC-SHA256 signature verification
  const validSignature = crypto.createHmac('sha256', testSecret).update(rawBody).digest('hex');
  const validSigResult = await paymentService.processWebhook('razorpay', validSignature, validPayload, rawBody);
  assert(validSigResult.success === true, 'Configured secret: Webhook with VALID HMAC-SHA256 signature accepted');

  // Test 2.5: Replayed / Duplicate Webhook Event ID
  const dupResult = await paymentService.processWebhook('razorpay', validSignature, validPayload, rawBody);
  assert(dupResult.duplicate === true, 'Replayed event with identical event_id recognized as duplicate without re-processing');

  // Reset secret
  delete process.env.RAZORPAY_WEBHOOK_SECRET;

  // Test 2.6: Delayed PENDING/FAILED event after successful payment (Status downgrade protection)
  const delayedFailedPayload = {
    event: 'payment.failed',
    event_id: `evt_delayed_fail_${Date.now()}`,
    orderId: orderA.id,
    payload: {
      payment: {
        entity: {
          id: `pay_delayed_${Date.now()}`,
          notes: { orderId: orderA.id },
          error_description: 'Payment timed out on gateway side',
        },
      },
    },
  };
  await fetch(`${BASE_URL}/api/v1/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(delayedFailedPayload),
  });
  const orderAfterDelayed = await orderRepository.findById(orderA.id);
  assert(orderAfterDelayed?.paymentStatus === 'PAID', 'Late / out-of-order payment.failed webhook BLOCKED from downgrading PAID order');

  // ============================================================================
  // CHECK 3 — REFUND INTEGRITY
  // ============================================================================
  console.log('\n--- CHECK 3: Refund Integrity ---');

  // Create an UNPAID order (status = PENDING_PAYMENT)
  const unpaidInput = {
    ...orderAInput,
    paymentMethod: 'COD',
    idempotencyKey: `idem_unpaid_${Date.now()}`,
  };
  const unpaidOrder = (await (await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(unpaidInput),
  })).json()).order;

  // Test 3.1: Reject refund on an unpaid order
  const resRefundUnpaid = await fetch(`${BASE_URL}/api/v1/admin/orders/${unpaidOrder.id}/refund`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ amount: unpaidOrder.total, reason: 'Testing refund on unpaid' }),
  });
  const refundUnpaidData = await resRefundUnpaid.json();
  assert(resRefundUnpaid.status === 400 && refundUnpaidData.success === false, 'Refund rejected on unpaid order (Cannot refund an unpaid order)');

  // Test 3.2: Valid refund on PAID order (Order A is PAID)
  const resRefundOrderA = await fetch(`${BASE_URL}/api/v1/admin/orders/${orderA.id}/refund`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ amount: orderA.total, reason: 'Defective zipper returned' }),
  });
  const refundOrderAData = await resRefundOrderA.json();
  assert(resRefundOrderA.status === 200 && refundOrderAData.success === true, 'Refund processed on PAID order -> 200 OK');
  assert(refundOrderAData.order.refundStatus === 'REFUND_COMPLETED', 'Order marked REFUND_COMPLETED');
  assert(refundOrderAData.order.paymentStatus === 'REFUNDED', 'Order paymentStatus updated to REFUNDED');

  // Test 3.3: Repeated refund idempotency (Must not double-refund or double-record in finance)
  const resRepeatRefund = await fetch(`${BASE_URL}/api/v1/admin/orders/${orderA.id}/refund`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ amount: orderA.total, reason: 'Duplicate refund call' }),
  });
  const repeatData = await resRepeatRefund.json();
  assert(repeatData.alreadyRefunded === true, 'Repeated refund recognized as alreadyRefunded without duplicate mutation');

  // Test 3.4: Verify unique finance transaction for refund
  const allTxs = financeRepository.getTransactions();
  const refundTxs = allTxs.filter((t) => t.referenceId === `ORDER_REFUND_${orderA.id}`);
  assert(refundTxs.length === 1, `Financial ledger recorded exactly 1 refund transaction (Found ${refundTxs.length})`);

  // ============================================================================
  // CHECK 4 — INVENTORY CONCURRENCY
  // ============================================================================
  console.log('\n--- CHECK 4: Inventory Concurrency ---');

  // Test 4.1: Simultaneous purchases of final unit (Stock = 1)
  await inventoryRepository.setStock(testVariant.id, 1, 'AUDIT_RUNNER', 'Prepare final stock race test');
  assert((await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand === 1, 'Stock set to exactly 1 unit');

  const purchaseA = fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...orderAInput,
      paymentMethod: 'COD',
      idempotencyKey: `race_stock_A_${Date.now()}`,
    }),
  });
  const purchaseB = fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...orderAInput,
      paymentMethod: 'COD',
      idempotencyKey: `race_stock_B_${Date.now()}`,
    }),
  });

  const [raceResA, raceResB] = await Promise.all([purchaseA, purchaseB]);
  const raceDataA = await raceResA.json();
  const raceDataB = await raceResB.json();
  console.log('Race Test Output -> raceDataA:', raceDataA, 'raceDataB:', raceDataB);

  const exactlyOneSucceeded = (raceDataA.success && !raceDataB.success) || (!raceDataA.success && raceDataB.success);
  assert(exactlyOneSucceeded, 'Simultaneous purchases: Exactly ONE succeeded and the other was rejected');
  const postRaceStock = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand;
  assert(postRaceStock === 0, `Final stock is exactly 0 and never became negative (Stock: ${postRaceStock})`);

  // Restore baseline stock
  await inventoryRepository.setStock(testVariant.id, 25, 'AUDIT_RUNNER', 'Restore baseline stock');

  // Test 4.2: Duplicate deduction protection
  const testOrderId = `test_ord_deduct_${Date.now()}`;
  const preDeductStock = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand || 25;
  await inventoryRepository.deductStock(testVariant.id, 2, 'Initial test deduction', testOrderId);
  const afterFirstDeduct = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand;
  assert(afterFirstDeduct === preDeductStock - 2, 'First deduction reduced stock by 2');

  // Attempt duplicate deduction with identical order reference
  await inventoryRepository.deductStock(testVariant.id, 2, 'Duplicate test deduction', testOrderId);
  const afterDupDeduct = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand;
  assert(afterDupDeduct === afterFirstDeduct, 'Duplicate deduction with same reference was ignored (Stock unchanged)');

  // Test 4.3: Duplicate restock protection
  await inventoryRepository.restoreStock(testVariant.id, 2, 'Initial test restock', testOrderId);
  const afterFirstRestock = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand;
  assert(afterFirstRestock === preDeductStock, 'First restock restored stock by 2');

  await inventoryRepository.restoreStock(testVariant.id, 2, 'Duplicate test restock', testOrderId);
  const afterDupRestock = (await inventoryRepository.getByVariantId(testVariant.id))?.quantityOnHand;
  assert(afterDupRestock === afterFirstRestock, 'Duplicate restock with same reference was ignored (Stock unchanged)');

  // ============================================================================
  // CHECK 5 — IDEMPOTENCY AND CONSISTENCY
  // ============================================================================
  console.log('\n--- CHECK 5: Idempotency and Consistency Across All Systems ---');

  // Test 5.1: Order creation idempotency
  const fixedIdemKey = `idem_consistency_${Date.now()}`;
  const firstOrderCreate = await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...orderAInput,
      idempotencyKey: fixedIdemKey,
    }),
  });
  const firstOrderData = await firstOrderCreate.json();

  const secondOrderCreate = await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...orderAInput,
      idempotencyKey: fixedIdemKey,
    }),
  });
  const secondOrderData = await secondOrderCreate.json();
  assert(secondOrderData.duplicate === true && secondOrderData.order.id === firstOrderData.order.id, 'Duplicate order creation returns existing order without creating second record');

  // Test 5.2: Cancellation duplicate idempotency
  const cancel1 = await fetch(`${BASE_URL}/api/v1/orders/${firstOrderData.order.id}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-customer-id': firstOrderData.order.customerId,
    },
    body: JSON.stringify({ reason: 'Changed mind' }),
  });
  const cancelData1 = await cancel1.json();
  assert(cancelData1.order.fulfillmentStatus === 'CANCELLED', 'First cancellation set status to CANCELLED');

  const cancel2 = await fetch(`${BASE_URL}/api/v1/orders/${firstOrderData.order.id}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-customer-id': firstOrderData.order.customerId,
    },
    body: JSON.stringify({ reason: 'Changed mind again' }),
  });
  const cancelData2 = await cancel2.json();
  assert(cancelData2.alreadyCancelled === true, 'Second cancellation returns alreadyCancelled: true');

  // Test 5.3: Coupon usage increment idempotency under duplicate webhook
  const coupon = await couponRepository.findByCode('TORI100');
  const baseUsage = coupon?.usageCount || 0;

  const couponOrderPayload = {
    ...orderAInput,
    idempotencyKey: `idem_coupon_test_${Date.now()}`,
    couponCode: 'TORI100',
  };
  const couponOrder = (await (await fetch(`${BASE_URL}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(couponOrderPayload),
  })).json()).order;

  const usageAfterOrder = (await couponRepository.findByCode('TORI100'))?.usageCount || 0;
  assert(usageAfterOrder === baseUsage + 1, `Order creation incremented coupon usage to ${usageAfterOrder}`);

  // Deliver duplicate payment webhook for this coupon order
  const cWhId = `evt_coupon_dup_${Date.now()}`;
  await fetch(`${BASE_URL}/api/v1/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'payment.captured',
      event_id: cWhId,
      orderId: couponOrder.id,
      payload: { payment: { entity: { id: `pay_c_${Date.now()}`, notes: { orderId: couponOrder.id } } } },
    }),
  });
  const usageAfterWh1 = (await couponRepository.findByCode('TORI100'))?.usageCount || 0;

  await fetch(`${BASE_URL}/api/v1/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'payment.captured',
      event_id: cWhId,
      orderId: couponOrder.id,
      payload: { payment: { entity: { id: `pay_c_${Date.now()}`, notes: { orderId: couponOrder.id } } } },
    }),
  });
  const usageAfterWh2 = (await couponRepository.findByCode('TORI100'))?.usageCount || 0;
  assert(usageAfterWh2 === usageAfterWh1, `Duplicate webhook did not double-increment coupon usage (Remained ${usageAfterWh2})`);

  console.log('\n================================================================');
  console.log(`PHASE 4.1 AUDIT SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase41Audit().catch((err) => {
  console.error('Fatal error running Phase 4.1 verification suite:', err);
  process.exit(1);
});
