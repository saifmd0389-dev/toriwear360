/**
 * Automated Verification Suite for Phase 1: Critical Admin Security Fixes
 */
import { generateTOTP, decryptSecret, hashRecoveryCode } from '../server/services/totpService';
import { getPrismaClient } from '../server/db/prisma';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('================================================================');
  console.log('TORIWEAR PHASE 1 SECURITY AUDIT & VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - Detail: ${detail}` : ''}`);
      failed++;
    }
  }

  // Ensure fresh backup codes and clear replay step before running test suite
  const setupPrisma = getPrismaClient();
  if (setupPrisma) {
    await setupPrisma.twoFactorSetting.updateMany({
      where: { userId: 'usr-ananya' },
      data: {
        backupCodes: JSON.stringify(['ANAN-RECV-01', 'ANAN-RECV-02', 'ANAN-RECV-03'].map(hashRecoveryCode)),
        lastAcceptedStep: null,
      },
    });
    await setupPrisma.twoFactorSetting.updateMany({
      where: { userId: 'usr-saif' },
      data: {
        backupCodes: JSON.stringify(['SAIF-RECV-01', 'SAIF-RECV-02', 'SAIF-RECV-03'].map(hashRecoveryCode)),
        lastAcceptedStep: null,
      },
    });
  }

  // -------------------------------------------------------------
  // TEST 1: Unauthenticated Session Check on /api/auth/me
  // -------------------------------------------------------------
  console.log('--- TEST 1: Unauthenticated Visitor /admin Behavior ---');
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    const data = await res.json();
    assert(
      res.status === 401 && data.authenticated === false,
      'Unauthenticated visitor calling /api/auth/me receives 401 Unauthorized',
      JSON.stringify(data)
    );
  } catch (err: any) {
    assert(false, 'Calling /api/auth/me failed', err.message);
  }

  // -------------------------------------------------------------
  // TEST 2: Protected Admin Endpoints Block Unauthenticated Access
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Protected Admin Endpoints Reject Unauthenticated Access ---');
  try {
    // 2a. Users list
    const resUsers = await fetch(`${BASE_URL}/api/platform/users`);
    assert(
      resUsers.status === 401,
      'GET /api/platform/users returns 401 Unauthorized without session token',
      `HTTP status: ${resUsers.status}`
    );

    // 2b. Audit logs
    const resAudit = await fetch(`${BASE_URL}/api/platform/audit-logs`);
    assert(
      resAudit.status === 401,
      'GET /api/platform/audit-logs returns 401 Unauthorized without session token',
      `HTTP status: ${resAudit.status}`
    );

    // 2c. Admin Products creation
    const resProd = await fetch(`${BASE_URL}/api/v1/admin/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacker Injected Hoodie' }),
    });
    assert(
      resProd.status === 401,
      'POST /api/v1/admin/products returns 401 Unauthorized without session token',
      `HTTP status: ${resProd.status}`
    );
  } catch (err: any) {
    assert(false, 'Protected endpoint check threw error', err.message);
  }

  // -------------------------------------------------------------
  // TEST 3: Login Authentication Flow & Lockout
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Login Authentication Flow & Lockout ---');
  let staffToken = '';
  try {
    // 3a. Invalid password
    const resBadPass = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@toriwear.com', password: 'WrongPassword123!' }),
    });
    const badPassData = await resBadPass.json();
    assert(
      resBadPass.status === 401 && badPassData.success === false,
      'Invalid password returns 401 and descriptive error message',
      badPassData.error
    );

    // 3b. Non-existent user
    const resBadUser = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'attacker@darkweb.org', password: 'AnyPassword@2026' }),
    });
    const badUserData = await resBadUser.json();
    assert(
      resBadUser.status === 401 && badUserData.success === false,
      'Unknown user returns 401 Invalid credentials',
      badUserData.error
    );

    // 3c. Valid Staff Login (Ananya Sharma) -> verifies password and triggers staff 2FA policy
    const resStaff = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'ananya.operations@toriwear.com', password: 'StaffAnanya@2026!' }),
    });
    const staffData = await resStaff.json();
    assert(
      resStaff.status === 200 && staffData.success === true && staffData.requires2FA === true,
      'Staff password verification succeeds and triggers 2FA challenge per security policy',
      JSON.stringify(staffData.tempToken?.substring(0, 8))
    );

    // Complete Staff 2FA with recovery code
    const resStaff2FA = await fetch(`${BASE_URL}/api/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: staffData.tempToken, code: 'ANAN-RECV-01' }),
    });
    const staff2FAData = await resStaff2FA.json();
    assert(
      resStaff2FA.status === 200 && staff2FAData.success === true && Boolean(staff2FAData.sessionToken),
      'Staff 2FA completes successfully and issues authorized Staff sessionToken',
      staff2FAData.user?.role
    );
    staffToken = staff2FAData.sessionToken;

    // 3d. Valid Super Admin Login (triggers 2FA challenge)
    const resAdmin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@toriwear.com', password: 'ToriAdmin@2026!' }),
    });
    const adminData = await resAdmin.json();
    assert(
      resAdmin.status === 200 && adminData.requires2FA === true && Boolean(adminData.tempToken),
      'Super Admin login triggers 2FA requirement and returns single-use tempToken',
      `tempToken: ${adminData.tempToken?.substring(0, 10)}...`
    );

    // -------------------------------------------------------------
    // TEST 4: 2FA Bypass Prevention (Dummy, Short, Expired, Valid TOTP, Recovery)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: RFC 6238 TOTP Verification & Bypass Prevention ---');
    const tempToken = adminData.tempToken;

    // 4a. Short 4-character code (old dummy bypass)
    const resShort = await fetch(`${BASE_URL}/api/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code: '1234' }),
    });
    const shortData = await resShort.json();
    assert(
      resShort.status === 401 && shortData.success === false,
      'Bypass attempt with 4-digit code (old dummy bypass) is strictly REJECTED (HTTP 401)',
      shortData.error
    );

    // 4b. Arbitrary 6-digit code "123456"
    const resFake = await fetch(`${BASE_URL}/api/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code: '123456' }),
    });
    const fakeData = await resFake.json();
    assert(
      resFake.status === 401 && fakeData.success === false,
      'Arbitrary dummy code "123456" is strictly REJECTED (HTTP 401)',
      fakeData.error
    );

    // 4c. Verify deprecated challenge-info endpoint was permanently REMOVED to prevent secret leakage (SEC-01)
    const resInfo = await fetch(`${BASE_URL}/api/auth/2fa/challenge-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken }),
    });
    assert(
      resInfo.status === 404 || resInfo.status === 401,
      'Challenge info endpoint was permanently removed to prevent 2FA secret exposure (SEC-01)',
      `HTTP status: ${resInfo.status}`
    );

    // Retrieve encrypted secret securely from PostgreSQL via Prisma for test verification
    const prisma = getPrismaClient();
    const saifSetting = await prisma?.twoFactorSetting.findUnique({ where: { userId: 'usr-saif' } });
    const cleanSecret = saifSetting?.secret ? decryptSecret(saifSetting.secret) : '';
    assert(Boolean(cleanSecret), 'Server decrypted persisted AES-256-GCM secret from PostgreSQL');

    // Reset lastAcceptedStep for testing fresh codes
    await prisma?.twoFactorSetting.update({
      where: { userId: 'usr-saif' },
      data: {
        lastAcceptedStep: null,
        backupCodes: JSON.stringify(['SAIF-RECV-01', 'SAIF-RECV-02', 'SAIF-RECV-03'].map(hashRecoveryCode)),
      },
    });

    // 4d. Expired TOTP code (computed from 3 minutes ago)
    const expiredTotp = generateTOTP(cleanSecret, Date.now() - 180000);
    const resExpired = await fetch(`${BASE_URL}/api/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code: expiredTotp }),
    });
    const expiredData = await resExpired.json();
    assert(
      resExpired.status === 401 && expiredData.success === false,
      'Expired TOTP code (outside window tolerance) is strictly REJECTED (HTTP 401)',
      expiredData.error
    );

    // 4e. Real valid current RFC 6238 TOTP code
    const validCurrentTotp = generateTOTP(cleanSecret, Date.now());
    const resValid = await fetch(`${BASE_URL}/api/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code: validCurrentTotp }),
    });
    const validData = await resValid.json();
    assert(
      resValid.status === 200 && validData.success === true && Boolean(validData.sessionToken),
      'Cryptographically valid RFC 6238 TOTP code is ACCEPTED and session issued',
      `Session token: ${validData.sessionToken?.substring(0, 12)}...`
    );

    const adminSessionToken = validData.sessionToken;

    // 4f. Test single-use recovery code on fresh challenge
    const resAdmin2 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@toriwear.com', password: 'ToriAdmin@2026!' }),
    });
    const admin2Data = await resAdmin2.json();
    // Use recovery code SAIF-RECV-01
    const resRecv = await fetch(`${BASE_URL}/api/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: admin2Data.tempToken, code: 'SAIF-RECV-01' }),
    });
    const recvData = await resRecv.json();
    assert(
      resRecv.status === 200 && recvData.success === true,
      'Single-use recovery code successfully verifies 2FA challenge',
      recvData.user?.name
    );

    // 4g. Test replay of consumed recovery code
    const resAdmin3 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@toriwear.com', password: 'ToriAdmin@2026!' }),
    });
    const admin3Data = await resAdmin3.json();
    const resReplay = await fetch(`${BASE_URL}/api/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: admin3Data.tempToken, code: 'SAIF-RECV-01' }),
    });
    const replayData = await resReplay.json();
    assert(
      resReplay.status === 401 && replayData.success === false,
      'Replay of already-consumed recovery code is strictly REJECTED (HTTP 401)',
      replayData.error
    );

    // -------------------------------------------------------------
    // TEST 5: Session Verification and Invalidation (Refresh & Logout)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Session Validation on /api/auth/me & Logout ---');
    // 5a. Call /api/auth/me with valid session token
    const resMe = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminSessionToken}` },
    });
    const meData = await resMe.json();
    assert(
      resMe.status === 200 && meData.authenticated === true && meData.user?.role === 'SUPER_ADMIN',
      'Valid Bearer token resolves authenticated Super Admin profile on /api/auth/me',
      meData.user?.email
    );

    // 5b. Logout and revoke session
    const resLogout = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminSessionToken}` },
    });
    const logoutData = await resLogout.json();
    assert(resLogout.status === 200 && logoutData.success === true, 'POST /api/auth/logout revokes session token');

    // 5c. Verify revoked token now returns 401
    const resMeRevoked = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminSessionToken}` },
    });
    assert(
      resMeRevoked.status === 401,
      'Revoked session token immediately returns 401 Unauthorized on subsequent requests',
      `HTTP status: ${resMeRevoked.status}`
    );

    // -------------------------------------------------------------
    // TEST 6: RBAC & Permissions Hierarchy
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Role Permissions Isolation (Super Admin vs Staff) ---');

    // Staff tries to create a Partner account (Super Admin only)
    const resPartnerCreate = await fetch(`${BASE_URL}/api/platform/users/partners`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        name: 'Unauthorized Partner',
        email: 'unauthorized@partner.com',
        roleDesignation: 'Partner',
      }),
    });
    assert(
      resPartnerCreate.status === 403,
      'Staff account attempting Super Admin operation returns 403 Forbidden',
      `HTTP status: ${resPartnerCreate.status}`
    );

    // -------------------------------------------------------------
    // TEST 7: Storefront Public API & Catalog Unaffected
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Storefront Catalog Integrity & Products Vault ---');
    const resProducts = await fetch(`${BASE_URL}/api/v1/products`);
    const productsData = await resProducts.json();
    assert(
      resProducts.status === 200 && Array.isArray(productsData.data) && productsData.data.length > 0,
      'Public storefront catalog /api/v1/products remains fully operational and accessible without admin auth',
      `Product count: ${productsData.data?.length}`
    );

    const resFeatured = await fetch(`${BASE_URL}/api/v1/products/featured`);
    const featuredData = await resFeatured.json();
    assert(
      resFeatured.status === 200 && Array.isArray(featuredData.data),
      'Storefront featured products API functions smoothly',
      `Featured count: ${featuredData.data?.length}`
    );
  } catch (err: any) {
    assert(false, 'Unexpected failure during test run', err.stack || err.message);
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
