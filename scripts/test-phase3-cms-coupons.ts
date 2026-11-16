import { hashRecoveryCode } from '../server/services/totpService';
import { getPrismaClient } from '../server/db/prisma';

async function runTests() {
  const BASE_URL = 'http://localhost:3000';
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  console.log('=== RUNNING PHASE 3 STOREFRONT CMS & COUPONS VERIFICATION ===\n');

  // 1. Authenticate as Staff/Admin to get session token
  console.log('[1] Admin Authentication for Secured CMS & Coupon Endpoints');
  const prisma = getPrismaClient();
  if (prisma) {
    await prisma.twoFactorSetting.updateMany({
      where: { userId: 'usr-ananya' },
      data: {
        backupCodes: JSON.stringify(['ANAN-CMS-01', 'ANAN-CMS-02'].map(hashRecoveryCode)),
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
  assert(loginRes.ok && Boolean(loginData.tempToken), `Staff password verified, 2FA challenge received`);

  const tempToken = loginData.tempToken;
  const verify2faRes = await fetch(`${BASE_URL}/api/auth/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tempToken,
      code: 'ANAN-CMS-01',
    }),
  });
  const verify2faData = await verify2faRes.json();
  const sessionToken = verify2faData.sessionToken;
  assert(verify2faRes.ok && Boolean(sessionToken), `Staff 2FA completed with recovery code, sessionToken acquired`);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`,
  };

  // 2. Public Storefront CMS Endpoints
  console.log('\n[2] Public Storefront CMS Verification');
  const pubFrontRes = await fetch(`${BASE_URL}/api/v1/cms/frontpage`);
  const pubFrontData = await pubFrontRes.json();
  assert(pubFrontRes.ok && pubFrontData.success === true, 'Public GET /api/v1/cms/frontpage returns 200 OK');
  assert(Array.isArray(pubFrontData.data.sections) && pubFrontData.data.sections.length > 0, `Sections array returned (${pubFrontData.data.sections.length} sections)`);
  assert(Boolean(pubFrontData.data.hero?.headline), `Hero configuration loaded: "${pubFrontData.data.hero?.headline}"`);
  assert(Array.isArray(pubFrontData.data.advertisements) && pubFrontData.data.advertisements.length > 0, `Storefront advertisements/ticker loaded (${pubFrontData.data.advertisements.length} ads)`);

  const pubSettingsRes = await fetch(`${BASE_URL}/api/v1/cms/settings`);
  const pubSettingsData = await pubSettingsRes.json();
  assert(pubSettingsRes.ok && pubSettingsData.success === true, 'Public GET /api/v1/cms/settings returns 200 OK');
  assert(Boolean(pubSettingsData.data.storeName), `Store settings loaded: storeName = "${pubSettingsData.data.storeName}"`);

  // 3. Admin CMS Security & Updates
  console.log('\n[3] Admin CMS Security & Persistence Verification');
  const unauthRes = await fetch(`${BASE_URL}/api/v1/cms/admin/frontpage`);
  assert(unauthRes.status === 401, 'Unauthenticated GET /api/v1/cms/admin/frontpage rejected with 401');

  // Fetch admin frontpage with auth
  const adminFrontRes = await fetch(`${BASE_URL}/api/v1/cms/admin/frontpage`, { headers: authHeaders });
  const adminFrontData = await adminFrontRes.json();
  assert(adminFrontRes.ok && adminFrontData.success === true, 'Authenticated GET /api/v1/cms/admin/frontpage returns 200 OK');

  // Update hero settings via admin endpoint
  const updatedHero = {
    ...adminFrontData.data.hero,
    headline: 'CYBER-STREETWEAR // 240 GSM ARMORED',
  };
  const putHeroRes = await fetch(`${BASE_URL}/api/v1/cms/admin/hero`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify(updatedHero),
  });
  const putHeroData = await putHeroRes.json();
  assert(putHeroRes.ok && putHeroData.data.headline === 'CYBER-STREETWEAR // 240 GSM ARMORED', 'PUT /api/v1/cms/admin/hero successfully persisted new headline');

  // Verify public endpoint reflects updated hero
  const verifyPubHero = await fetch(`${BASE_URL}/api/v1/cms/frontpage`);
  const verifyPubHeroData = await verifyPubHero.json();
  assert(verifyPubHeroData.data.hero.headline === 'CYBER-STREETWEAR // 240 GSM ARMORED', 'Public endpoint immediately reflects persisted hero headline');

  // 4. Coupons & Promotions Persistence
  console.log('\n[4] Coupons & Promotions Persistence Verification');
  
  // List existing coupons
  const listCouponsRes = await fetch(`${BASE_URL}/api/v1/admin/coupons`, { headers: authHeaders });
  const listCouponsData = await listCouponsRes.json();
  assert(listCouponsRes.ok && Array.isArray(listCouponsData.data), `Admin GET /api/v1/admin/coupons returned list (${listCouponsData.data.length} coupons)`);

  // Create a new test promo coupon
  const testCouponCode = 'P3_' + Date.now();
  const createCouponRes = await fetch(`${BASE_URL}/api/v1/admin/coupons`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      code: testCouponCode,
      discountType: 'PERCENTAGE',
      discountValue: 25,
      minOrderValue: 999,
      maxDiscountAmount: 500,
      description: 'Phase 3 Automated Test Promo',
      active: true,
      usageLimit: 100,
    }),
  });
  const createCouponData = await createCouponRes.json();
  if (!createCouponRes.ok) {
    console.error('Coupon creation failed with status:', createCouponRes.status, createCouponData);
  }
  assert(createCouponRes.ok && createCouponData.success === true, `Admin created coupon ${testCouponCode} (25% off, min ₹999)`);
  const createdId = createCouponData.data?.id;

  // Validate coupon via public checkout quote endpoint
  const validateQuoteRes = await fetch(`${BASE_URL}/api/v1/coupons/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: testCouponCode,
      subtotal: 1200,
    }),
  });
  const validateQuoteData = await validateQuoteRes.json();
  assert(validateQuoteRes.ok && validateQuoteData.success === true, `Public validate coupon ${testCouponCode} on ₹1200 subtotal succeeded`);
  // 25% of 1200 is 300
  assert(validateQuoteData.data.discountAmount === 300, `Calculated discount is exact: ₹${validateQuoteData.data.discountAmount} (expected 300)`);

  // Validate subtotal below minimum order value fails
  const belowMinRes = await fetch(`${BASE_URL}/api/v1/coupons/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: testCouponCode,
      subtotal: 500,
    }),
  });
  const belowMinData = await belowMinRes.json();
  assert(belowMinRes.ok && belowMinData.data.valid === false, `Coupon validation correctly rejected when subtotal (₹500) < minOrder (₹999)`);

  // Toggle coupon active state
  const toggleRes = await fetch(`${BASE_URL}/api/v1/admin/coupons/${createdId}/toggle`, {
    method: 'POST',
    headers: authHeaders,
  });
  const toggleData = await toggleRes.json();
  assert(toggleRes.ok && toggleData.data.active === false, `Toggled coupon ${testCouponCode} to inactive (active: false)`);

  // Inactive coupon fails validation
  const inactiveCheckRes = await fetch(`${BASE_URL}/api/v1/coupons/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: testCouponCode,
      subtotal: 1200,
    }),
  });
  const inactiveCheckData = await inactiveCheckRes.json();
  assert(inactiveCheckRes.ok && inactiveCheckData.data.valid === false, `Inactive coupon rejected by checkout validator`);

  // Clean up: delete test coupon
  const deleteRes = await fetch(`${BASE_URL}/api/v1/admin/coupons/${createdId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  const deleteData = await deleteRes.json();
  assert(deleteRes.ok && deleteData.success === true, `Admin DELETE coupon ${testCouponCode} cleaned up successfully`);

  console.log(`\n======================================================`);
  console.log(`PHASE 3 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during Phase 3 verification:', err);
  process.exit(1);
});
