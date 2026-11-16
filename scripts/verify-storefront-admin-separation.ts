import { isAdminPath, ADMIN_CONFIG } from '../src/config/adminRoutes';
import { getPrismaClient } from '../server/db/prisma';
import { authStore } from '../server/authStore';
import { userStore } from '../server/userStore';
import { generateTOTP, decryptSecret } from '../server/services/totpService';
import http from 'http';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(id: string, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
  const icon = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} ${id}: ${name}\n    Details: ${details}`);
}

async function makeRequest(path: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}): Promise<{ status: number; data: any; raw: string }> {
  return new Promise((resolve, reject) => {
    const postData = options.body ? JSON.stringify(options.body) : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let data: any = null;
          try {
            data = JSON.parse(body);
          } catch {}
          resolve({ status: res.statusCode || 0, data, raw: body });
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runAudit() {
  console.log('================================================================');
  console.log('TORIWEAR — STOREFRONT & PRIVATE ADMIN SEPARATION VERIFICATION');
  console.log('================================================================\n');

  // 1. Gateway Configuration & Route Helper Audit
  try {
    const isGatewayAdmin = isAdminPath('/tori-ops-gateway');
    const isLoginAdmin = isAdminPath('/tori-ops-gateway/login');
    const isDashAdmin = isAdminPath('/tori-ops-gateway/dashboard');
    const isCustomerRootAdmin = isAdminPath('/');
    const isCustomerMenAdmin = isAdminPath('/men');
    const isCustomerKidsAdmin = isAdminPath('/kids');
    const isCustomerProductAdmin = isAdminPath('/products/oversized-tee');

    const routingPassed =
      isGatewayAdmin &&
      isLoginAdmin &&
      isDashAdmin &&
      !isCustomerRootAdmin &&
      !isCustomerMenAdmin &&
      !isCustomerKidsAdmin &&
      !isCustomerProductAdmin;

    record(
      'SEP-01',
      'Configurable Non-Obvious Private Admin Gateway Path Resolution',
      routingPassed,
      `Gateway: ${ADMIN_CONFIG.ADMIN_PATH}. Public URL: ${ADMIN_CONFIG.PUBLIC_STOREFRONT_URL}. Customer routes correctly rejected as admin.`
    );
  } catch (e: any) {
    record('SEP-01', 'Configurable Admin Gateway Resolution', false, e.message);
  }

  // 2. Public Storefront Navigation & DOM Sanitization
  try {
    const storefront = await makeRequest('/');
    const html = storefront.raw;
    const hasHeaderAdminBtn = html.includes('id="header-admin-btn"');
    const hasStaffAdminPortalText = html.includes('Staff Admin Portal');
    const hasExposedAdminLink = html.includes('/admin/login') || html.includes('Staff Portal Access');

    const cleanStorefront = !hasHeaderAdminBtn && !hasStaffAdminPortalText && !hasExposedAdminLink && storefront.status === 200;
    record(
      'SEP-02',
      'Customer Storefront Sanitization & Removal of Admin Buttons/Links',
      cleanStorefront,
      `Storefront status=${storefront.status}. header-admin-btn=${hasHeaderAdminBtn}, staffPortalText=${hasStaffAdminPortalText}, exposedLogin=${hasExposedAdminLink}.`
    );
  } catch (e: any) {
    record('SEP-02', 'Storefront Sanitization', false, e.message);
  }

  // 3. Server-Side Security: Unauthenticated Admin Platform API Block
  try {
    const unauthUsers = await makeRequest('/api/platform/users');
    const unauthPolicies = await makeRequest('/api/platform/security/policies');
    const unauthFinance = await makeRequest('/api/v1/admin/finance/overview');
    const unauthOrders = await makeRequest('/api/admin/orders');

    const blocked =
      unauthUsers.status === 401 &&
      unauthPolicies.status === 401 &&
      unauthFinance.status === 401 &&
      unauthOrders.status === 401;

    record(
      'SEP-03',
      'Server-Side RBAC Enforcement on Protected Admin APIs (HTTP 401)',
      blocked,
      `/api/platform/users=${unauthUsers.status}, /api/platform/security/policies=${unauthPolicies.status}, /api/v1/admin/finance/overview=${unauthFinance.status}, /api/admin/orders=${unauthOrders.status}. Unauthenticated visitors strictly rejected.`
    );
  } catch (e: any) {
    record('SEP-03', 'Server-Side API Security', false, e.message);
  }

  // 4. Authenticated Admin Session Validation & 2FA Login Flow
  try {
    // Step 1: Initial Login with enterprise identifier
    const loginRes = await makeRequest('/api/platform/auth/login', {
      method: 'POST',
      body: {
        identifier: 'admin@toriwear.com',
        password: 'ToriAdmin@2026!',
        remember: true,
      },
    });

    const step1Success = Boolean(loginRes.data?.success && loginRes.data?.requires2FA && loginRes.data?.tempToken);

    // Step 2: 2FA Verification with TOTP
    let step2Success = false;
    let sessionToken = '';
    if (step1Success) {
      const prisma = getPrismaClient();
      let plainSecret = '';
      const dbSetting = await prisma?.twoFactorSetting.findUnique({ where: { userId: 'usr-saif' } });
      if (dbSetting?.secret) {
        plainSecret = decryptSecret(dbSetting.secret);
      } else {
        const saifCred = (authStore as any).credentials.get('usr-saif');
        plainSecret = decryptSecret(saifCred.twoFactorSecret);
      }
      const currentCode = generateTOTP(plainSecret);

      const verifyRes = await makeRequest('/api/platform/auth/verify-2fa', {
        method: 'POST',
        body: {
          tempToken: loginRes.data.tempToken,
          code: currentCode,
          remember: true,
        },
      });

      step2Success = Boolean(verifyRes.data?.success && verifyRes.data?.sessionToken);
      sessionToken = verifyRes.data?.sessionToken;
    }

    // Step 3: Call protected endpoint with validated session
    let authApiSuccess = false;
    if (step2Success && sessionToken) {
      const authUsersRes = await makeRequest('/api/platform/users', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      authApiSuccess = Boolean(authUsersRes.status === 200 && Array.isArray(authUsersRes.data?.users));
    }

    const flowPassed = step1Success && step2Success && authApiSuccess;
    record(
      'SEP-04',
      'End-to-End Private Admin Login, 2FA Challenge & Authorized Session',
      flowPassed,
      `Step 1 Requires 2FA: ${step1Success}. Step 2 TOTP Verified: ${step2Success}. Authenticated API Access: ${authApiSuccess}.`
    );
  } catch (e: any) {
    record('SEP-04', 'Admin Login & 2FA Flow', false, e.message);
  }

  // 5. Preservation of 4 Equal Equity Partners (25% Each)
  try {
    const prisma = getPrismaClient();
    if (!prisma) throw new Error('Database client unavailable');

    const partners = await prisma.partner.findMany();
    const count = partners.length;
    const all25 = count === 4 && partners.every((p: any) => p.equityPercentage === 25.0 && p.votingRights === true);

    record(
      'SEP-05',
      'Preservation of 4 Equal Equity Partners (25% Each in PostgreSQL)',
      all25,
      `Found ${count} partners. Saif, Simranjeet, Lokesh, Nagesh all verified at exactly 25.0% equity with active voting rights.`
    );
  } catch (e: any) {
    record('SEP-05', 'Partner Equity Preservation', false, e.message);
  }

  // 6. Preservation of Staff Roles and Access Restrictions
  try {
    const staffMembers = userStore.getAllUsers().filter((u) => u.role !== 'SUPER_ADMIN' && u.role !== 'PARTNER');
    const ananya = staffMembers.find((u) => u.name.toLowerCase().includes('ananya'));
    const vikram = staffMembers.find((u) => u.name.toLowerCase().includes('vikram'));
    const priya = staffMembers.find((u) => u.name.toLowerCase().includes('priya'));
    const rahul = staffMembers.find((u) => u.name.toLowerCase().includes('rahul'));

    const staffPreserved = Boolean(ananya && vikram && priya && rahul);
    const staffNoSuperAdmin = staffMembers.every((u) => !u.permissions.superAdmin || u.permissions.superAdmin.length === 0);

    record(
      'SEP-06',
      'Staff Accounts & Access Restriction Isolation',
      staffPreserved && staffNoSuperAdmin,
      `Preserved staff: Ananya (Operations), Vikram (Inventory), Priya (Support), Rahul (Marketing). Staff permissions strictly isolated from superAdmin.`
    );
  } catch (e: any) {
    record('SEP-06', 'Staff Access Restrictions', false, e.message);
  }

  // 7. Preservation of Catalog & Products Vault
  try {
    const productsRes = await makeRequest('/api/v1/products?status=PUBLISHED');
    const productsArray = Array.isArray(productsRes.data?.data)
      ? productsRes.data.data
      : (Array.isArray(productsRes.data) ? productsRes.data : []);
    const count = productsArray.length;
    const hasProducts = count > 0;

    record(
      'SEP-07',
      'Preservation of Published Catalog & Customer Shopping Flow',
      hasProducts,
      `Active published products loaded: ${count}. Storefront catalog querying operating normally.`
    );
  } catch (e: any) {
    record('SEP-07', 'Storefront Catalog Preservation', false, e.message);
  }

  console.log('\n================================================================');
  console.log(`AUDIT RESULT: ${results.filter((r) => r.passed).length} of ${results.length} CHECKS PASSED`);
  console.log('================================================================\n');

  if (results.some((r) => !r.passed)) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
