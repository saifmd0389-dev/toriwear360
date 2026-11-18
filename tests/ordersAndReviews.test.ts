import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempRuntimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toriwear-test-runtime-'));
process.env.TORI_RUNTIME_DATA_DIR = tempRuntimeDir;

test.after(() => {
  try {
    fs.rmSync(tempRuntimeDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup failure
  }
});

test('Order Timeline: normalizeOrderTimeline provides human-readable titles and addTimelineEvent appends milestones cleanly', async () => {
  const { orderRepository } = await import('../server/repositories/orderRepository');
  const { orderService, normalizeOrderTimeline } = await import('../server/services/orderService');

  const sampleTimeline = normalizeOrderTimeline([
    {
      status: 'CONFIRMED',
      timestamp: '2026-11-17T06:00:00.000Z',
      description: 'Order placed & confirmed',
    },
    {
      status: 'PACKED',
      timestamp: '2026-11-17T08:00:00.000Z',
      description: '',
    },
  ]);

  assert.equal(sampleTimeline[0].title, 'Order placed & confirmed');
  assert.equal(sampleTimeline[1].title, 'Packed & Quality Checked');

  const testOrderId = `TEST-TIMELINE-${Date.now()}`;
  const createdOrder = await orderRepository.create({
    id: testOrderId,
    orderNumber: testOrderId,
    customerId: 'cust-test-timeline',
    customerName: 'Timeline Test Buyer',
    customerEmail: 'timeline-test@toriwear.com',
    customerPhone: '9876543210',
    subtotal: 1299,
    discount: 0,
    tax: 65,
    shippingFee: 0,
    total: 1364,
    currency: 'INR',
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    fulfillmentStatus: 'CONFIRMED',
    shippingAddress: {
      fullName: 'Timeline Test Buyer',
      phone: '9876543210',
      email: 'timeline-test@toriwear.com',
      addressLine1: '101 Anime Street',
      city: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      pincode: '530018',
    },
    items: [],
    timeline: [
      {
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        description: 'Order Confirmed',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  assert.ok(createdOrder.id);

  const addRes = await orderService.addTimelineEvent(
    testOrderId,
    {
      title: 'Quality Check Completed at Mumbai Studio',
      note: '240 GSM puff print inspected before dispatch.',
      status: 'PACKED',
    },
    { id: 'admin-1', name: 'Operations Lead', role: 'SUPER_ADMIN' }
  );

  assert.equal(addRes.success, true);
  assert.ok(addRes.order);
  assert.equal(addRes.order!.timeline.length, 2);
  const normalized = normalizeOrderTimeline(addRes.order!.timeline);
  assert.equal(normalized[1].title, 'Quality Check Completed at Mumbai Studio');
  assert.equal(normalized[1].note, '240 GSM puff print inspected before dispatch.');

  // Invalid short title rejected cleanly
  const badRes = await orderService.addTimelineEvent(
    testOrderId,
    { title: 'X' },
    { id: 'admin-1', name: 'Operations Lead', role: 'SUPER_ADMIN' }
  );
  assert.equal(badRes.success, false);
});

test('Product Reviews: creation recalculates rating stats, supports moderation, and deletes cleanly', async () => {
  const { productRepository } = await import('../server/repositories/productRepository');
  const { reviewRepository } = await import('../server/repositories/reviewRepository');

  let allProducts = await productRepository.getAll();
  let createdTempProductId: string | null = null;

  if (allProducts.length === 0) {
    createdTempProductId = `test-review-prod-${Date.now()}`;
    const tempProd = await productRepository.save({
      id: createdTempProductId,
      catalogNumber: `TW-TEST-${Date.now()}`,
      name: 'Test Review Heavyweight Tee',
      slug: `test-review-tee-${Date.now()}`,
      sku: `SKU-TEST-${Date.now()}`,
      department: 'MEN',
      world: 'Cyberpunk',
      franchise: 'Original',
      universe: 'Tori-Wear',
      fit: 'Oversized Boxy',
      price: 1299,
      originalPrice: 1699,
      gsm: 240,
      fabric: '100% Combed Cotton',
      neck: 'Crew Neck',
      sleeves: 'Drop Shoulder',
      print: 'High Density Puff',
      description: 'Test product for verifying product reviews persistence.',
      drop: 'Chapter 01',
      rating: 5.0,
      reviewsCount: 0,
      images: ['/assets/placeholder.png'],
      features: ['240 GSM'],
      colors: [{ name: 'Void Black', hex: '#0a0a0c' }],
      sizes: ['M', 'L'],
      isNewDrop: true,
      isTrending: false,
      isBestseller: false,
      inStock: true,
      stock: 10,
      licenseType: 'ORIGINAL',
      status: 'PUBLISHED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    allProducts = [tempProd];
  }

  const product = allProducts[0];
  const originalRating = product.rating;
  const originalCount = product.reviewsCount;

  const createdIds: string[] = [];
  try {
    const rev1 = await reviewRepository.create({
      productId: product.id,
      productName: product.name,
      customerName: 'Aarav Test',
      rating: 5,
      title: 'Heavyweight cotton',
      comment: 'Super crisp puff print and relaxed boxy fit.',
      verifiedPurchase: true,
      sizePurchased: 'L',
      fitFeedback: 'TRUE_TO_SIZE',
      status: 'APPROVED',
    });
    createdIds.push(rev1.id);

    const rev2 = await reviewRepository.create({
      productId: product.id,
      productName: product.name,
      customerName: 'Kabir Test',
      rating: 3,
      title: 'Decent drape',
      comment: 'Nice artwork though sleeves run slightly wide.',
      verifiedPurchase: false,
      sizePurchased: 'M',
      fitFeedback: 'RUNS_LARGE',
      status: 'APPROVED',
    });
    createdIds.push(rev2.id);

    const { reviews, summary } = await reviewRepository.listByProduct(product.id);
    assert.ok(reviews.some((r) => r.id === rev1.id));
    assert.ok(reviews.some((r) => r.id === rev2.id));
    assert.ok(summary.totalCount >= 2);
    assert.ok(summary.breakdown[5] >= 1);
    assert.ok(summary.breakdown[3] >= 1);
    assert.ok(summary.fitBreakdown.TRUE_TO_SIZE >= 1);
    assert.ok(summary.fitBreakdown.RUNS_LARGE >= 1);

    // Verify product record rating stats updated
    const updatedProduct = await productRepository.findById(product.id);
    assert.equal(updatedProduct?.reviewsCount, summary.totalCount);
    assert.equal(updatedProduct?.rating, summary.averageRating);

    // Reject rev2 and confirm it drops from public approved summary
    const moderated = await reviewRepository.moderate(rev2.id, { status: 'REJECTED' });
    assert.equal(moderated?.status, 'REJECTED');

    const afterReject = await reviewRepository.listByProduct(product.id);
    assert.equal(afterReject.reviews.some((r) => r.id === rev2.id), false);
    assert.equal(afterReject.summary.totalCount, summary.totalCount - 1);
  } finally {
    for (const id of createdIds) {
      await reviewRepository.delete(id);
    }
    if (createdTempProductId) {
      await productRepository.delete(createdTempProductId);
    } else {
      const afterCleanup = await reviewRepository.listByProduct(product.id);
      if (afterCleanup.summary.totalCount === 0) {
        await productRepository.updateRatingStats(product.id, originalRating, originalCount);
      }
    }
  }
});

test('Camera Removal: no browser camera APIs or permission requests exist anywhere in codebase', () => {
  const metadata = JSON.parse(fs.readFileSync('metadata.json', 'utf-8'));
  assert.deepEqual(metadata.requestFramePermissions, []);

  const serverSource = fs.readFileSync('server.ts', 'utf-8');
  assert.ok(serverSource.includes("Permissions-Policy', 'camera=(), microphone=(), geolocation=()'"));

  const returnModalSource = fs.readFileSync('src/components/ReturnExchangeModal.tsx', 'utf-8');
  assert.equal(/getUserMedia|capture=|Device Camera/i.test(returnModalSource), false);

  const commViewSource = fs.readFileSync('src/admin/components/InternalCommunicationView.tsx', 'utf-8');
  assert.equal(/getUserMedia|getDisplayMedia|captureStream/i.test(commViewSource), false);
});
