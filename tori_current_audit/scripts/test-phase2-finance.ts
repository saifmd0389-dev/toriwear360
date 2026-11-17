/**
 * Automated Verification Suite for Phase 2: Finance & Accounts + Partner Accounts Persistence
 */
import { hashRecoveryCode } from '../server/services/totpService';
import { getPrismaClient } from '../server/db/prisma';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('================================================================');
  console.log('TORIWEAR PHASE 2 FINANCE & PARTNER ACCOUNTS VERIFICATION SUITE');
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

  // -------------------------------------------------------------
  // TEST 1: Unauthenticated Access Guard on Finance Endpoints
  // -------------------------------------------------------------
  console.log('--- TEST 1: Unauthenticated Access Rejection ---');
  try {
    const resSummary = await fetch(`${BASE_URL}/api/v1/admin/finance/summary`);
    assert(
      resSummary.status === 401,
      'GET /api/v1/admin/finance/summary returns 401 Unauthorized without session token',
      `HTTP status: ${resSummary.status}`
    );

    const resAccounts = await fetch(`${BASE_URL}/api/v1/admin/finance/accounts`);
    assert(
      resAccounts.status === 401,
      'GET /api/v1/admin/finance/accounts returns 401 Unauthorized without session token',
      `HTTP status: ${resAccounts.status}`
    );

    const resTx = await fetch(`${BASE_URL}/api/v1/admin/finance/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 10000, description: 'Hacker Injection' }),
    });
    assert(
      resTx.status === 401,
      'POST /api/v1/admin/finance/transactions returns 401 Unauthorized without session token',
      `HTTP status: ${resTx.status}`
    );

    const resDist = await fetch(`${BASE_URL}/api/v1/admin/finance/partners/distribute-profit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodLabel: 'Hacker Distribution' }),
    });
    assert(
      resDist.status === 401,
      'POST /api/v1/admin/finance/partners/distribute-profit returns 401 Unauthorized without session token',
      `HTTP status: ${resDist.status}`
    );
  } catch (err: any) {
    assert(false, 'Unauthenticated test threw error', err.message);
  }

  // -------------------------------------------------------------
  // TEST 2: Super Admin & Staff Authentication for Session Tokens
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Session Token Issuance for Super Admin & Staff ---');
  let adminToken = '';
  let staffToken = '';

  try {
    // Reset test backup codes in database to ensure clean 2FA verification
    const prisma = getPrismaClient();
    if (prisma) {
      await prisma.twoFactorSetting.updateMany({
        where: { userId: 'usr-saif' },
        data: {
          backupCodes: JSON.stringify(['SAIF-FIN-01', 'SAIF-FIN-02'].map(hashRecoveryCode)),
          lastAcceptedStep: null,
        },
      });
      await prisma.twoFactorSetting.updateMany({
        where: { userId: 'usr-ananya' },
        data: {
          backupCodes: JSON.stringify(['ANAN-FIN-01', 'ANAN-FIN-02'].map(hashRecoveryCode)),
          lastAcceptedStep: null,
        },
      });
    }

    // 2a. Admin Login
    const loginAdmin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@toriwear.com', password: 'ToriAdmin@2026!' }),
    });
    const adminLoginData = await loginAdmin.json();

    if (adminLoginData.sessionToken) {
      adminToken = adminLoginData.sessionToken;
    } else if (adminLoginData.requires2FA && adminLoginData.tempToken) {
      const verifyAdminRes = await fetch(`${BASE_URL}/api/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken: adminLoginData.tempToken, code: 'SAIF-FIN-01' }),
      });
      const verifyAdminData = await verifyAdminRes.json();
      adminToken = verifyAdminData.sessionToken || '';
    }

    assert(
      Boolean(adminToken),
      'Super Admin authenticated successfully and received authorized session token'
    );

    // 2b. Staff Login (Ananya)
    const loginStaff = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'ananya.operations@toriwear.com', password: 'StaffAnanya@2026!' }),
    });
    const staffLoginData = await loginStaff.json();

    if (staffLoginData.sessionToken) {
      staffToken = staffLoginData.sessionToken;
    } else if (staffLoginData.requires2FA && staffLoginData.tempToken) {
      const verifyStaffRes = await fetch(`${BASE_URL}/api/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken: staffLoginData.tempToken, code: 'ANAN-FIN-01' }),
      });
      const verifyStaffData = await verifyStaffRes.json();
      staffToken = verifyStaffData.sessionToken || '';
    }

    assert(
      Boolean(staffToken),
      'Staff member authenticated successfully and received session token'
    );
  } catch (err: any) {
    assert(false, 'Login step failed', err.message);
  }

  // -------------------------------------------------------------
  // TEST 3: Authoritative Financial Summary Retrieval
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Authoritative Financial Summary Retrieval ---');
  try {
    const resSummary = await fetch(`${BASE_URL}/api/v1/admin/finance/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const summaryData = await resSummary.json();

    assert(
      resSummary.status === 200 && summaryData.success === true,
      'GET /api/v1/admin/finance/summary succeeds with authorized Super Admin session',
      JSON.stringify(summaryData.data ? Object.keys(summaryData.data) : {})
    );

    assert(
      Array.isArray(summaryData.data?.accounts) && summaryData.data.accounts.length >= 4,
      'Summary contains verified financial accounts with calculated balances',
      `Account count: ${summaryData.data?.accounts?.length}`
    );

    assert(
      Array.isArray(summaryData.data?.partners) && summaryData.data.partners.length === 4,
      'Summary contains all four TORIWEAR executive partners (Saif, Simranjeet, Lokesh, Nagesh)',
      `Partners count: ${summaryData.data?.partners?.length}`
    );

    assert(
      Boolean(summaryData.data?.currentPnL && typeof summaryData.data.currentPnL.netProfit === 'number'),
      'Summary includes authoritative server-derived Profit & Loss breakdown',
      `Net profit: ₹${summaryData.data?.currentPnL?.netProfit}`
    );
  } catch (err: any) {
    assert(false, 'Summary retrieval failed', err.message);
  }

  // -------------------------------------------------------------
  // TEST 4: Create Financial Transaction & Balance Impact
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Transaction Creation & Real Balance Updates ---');
  const uniqueRef = `INV-POPUPSALE-${Date.now()}`;
  let createdTxId = '';

  try {
    const initialAccountsRes = await fetch(`${BASE_URL}/api/v1/admin/finance/accounts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const initialAccounts = await initialAccountsRes.json();
    const targetAccount = initialAccounts.data.find((a: any) => a.id === 'acc-hdfc-current') || initialAccounts.data[0];
    const initialBalance = targetAccount.currentBalance;

    // Record ₹75,000 Pop-up revenue
    const txPayload = {
      type: 'INCOME',
      category: 'Pop-up Sales',
      amount: 75000,
      paymentAccountId: targetAccount.id,
      referenceId: uniqueRef,
      description: 'Exclusive Bangalore Comic-Con Pop-up Drop Sales Revenue',
      status: 'APPROVED',
    };

    const resCreate = await fetch(`${BASE_URL}/api/v1/admin/finance/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(txPayload),
    });
    const createData = await resCreate.json();

    assert(
      resCreate.status === 201 && createData.success === true && createData.data?.amount === 75000,
      'POST /api/v1/admin/finance/transactions creates authoritative income transaction',
      createData.data?.transactionNumber
    );

    createdTxId = createData.data?.id;

    // Check that account balance updated authoritatively
    const updatedAccountsRes = await fetch(`${BASE_URL}/api/v1/admin/finance/accounts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const updatedAccounts = await updatedAccountsRes.json();
    const updatedAccount = updatedAccounts.data.find((a: any) => a.id === targetAccount.id);

    assert(
      updatedAccount.currentBalance === initialBalance + 75000,
      'Financial account balance derived dynamically and increased by exactly ₹75,000',
      `Old: ₹${initialBalance} -> New: ₹${updatedAccount.currentBalance}`
    );
  } catch (err: any) {
    assert(false, 'Transaction creation failed', err.message);
  }

  // -------------------------------------------------------------
  // TEST 5: Idempotency Protection against Duplicate Transactions
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Duplicate Submission & Idempotency Protection ---');
  try {
    const duplicatePayload = {
      type: 'INCOME',
      category: 'Pop-up Sales',
      amount: 75000,
      paymentAccountId: 'acc-hdfc-current',
      referenceId: uniqueRef, // Identical reference ID
      description: 'Duplicate network retry attempt',
      status: 'APPROVED',
    };

    const resDuplicate = await fetch(`${BASE_URL}/api/v1/admin/finance/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(duplicatePayload),
    });
    const dupData = await resDuplicate.json();

    assert(
      dupData.success === true && dupData.data?.id === createdTxId,
      'Idempotency check prevents duplicate ledger entry and returns original transaction',
      `Returned Tx ID: ${dupData.data?.id}`
    );
  } catch (err: any) {
    assert(false, 'Idempotency test failed', err.message);
  }

  // -------------------------------------------------------------
  // TEST 6: Financial Account Creation & Internal Transfers
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Account Management & Inter-Account Transfers ---');
  let newAccountId = '';
  try {
    // 6a. Create Escrow Reserve Account
    const newAccRes = await fetch(`${BASE_URL}/api/v1/admin/finance/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Federal Escrow Capital Reserve',
        type: 'BANK',
        accountNumber: 'FED-ESCROW-2026',
        bankName: 'Federal Bank Ltd, MG Road',
        ifscCode: 'FDRL0001920',
        initialBalance: 20000,
        currency: 'INR',
        notes: 'Dedicated operational escrow reserve',
      }),
    });
    const newAccData = await newAccRes.json();
    newAccountId = newAccData.data?.id;

    assert(
      newAccRes.status === 201 && newAccData.success === true && newAccData.data?.initialBalance === 20000,
      'Created new financial account with initial balance',
      newAccData.data?.name
    );

    // 6b. Transfer ₹15,000 from acc-hdfc-current to new account
    const transferRes = await fetch(`${BASE_URL}/api/v1/admin/finance/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fromAccountId: 'acc-hdfc-current',
        toAccountId: newAccountId,
        amount: 15000,
        description: 'Working capital transfer to Federal Escrow',
      }),
    });
    const transferData = await transferRes.json();

    assert(
      transferRes.status === 200 && transferData.success === true && transferData.data?.type === 'TRANSFER',
      'Executed verified inter-account transfer transaction',
      transferData.data?.transactionNumber
    );

    // Verify destination account increased by ₹15,000 (20,000 + 15,000 = 35,000)
    const checkDestRes = await fetch(`${BASE_URL}/api/v1/admin/finance/accounts/${newAccountId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const checkDest = await checkDestRes.json();

    assert(
      checkDest.data?.currentBalance === 35000,
      'Destination account balance correctly updated to ₹35,000 following transfer',
      `Current Balance: ₹${checkDest.data?.currentBalance}`
    );
  } catch (err: any) {
    assert(false, 'Account creation/transfer failed', err.message);
  }

  // -------------------------------------------------------------
  // TEST 7: Partner Equity / Profit-Share Configuration
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Partner Equity & Profit Share Governance ---');
  try {
    // 7a. Rejection when sum does not equal 100%
    const badPercentages = {
      'ptr-01': 30,
      'ptr-02': 30,
      'ptr-03': 30,
      'ptr-04': 30, // Total = 120%
    };

    const resBadPct = await fetch(`${BASE_URL}/api/v1/admin/finance/partners/percentages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ percentages: badPercentages }),
    });
    const badPctData = await resBadPct.json();

    assert(
      resBadPct.status === 400 && badPctData.success === false,
      'Server strictly rejects partner percentages when total does not equal 100%',
      badPctData.error
    );

    // 7b. Acceptance when sum equals exactly 100%
    const validPercentages = {
      'ptr-01': 25,
      'ptr-02': 25,
      'ptr-03': 25,
      'ptr-04': 25,
    };

    const resGoodPct = await fetch(`${BASE_URL}/api/v1/admin/finance/partners/percentages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ percentages: validPercentages }),
    });
    const goodPctData = await resGoodPct.json();

    assert(
      resGoodPct.status === 200 && goodPctData.success === true,
      'Server accepts valid partner equity configuration totaling 100%'
    );
  } catch (err: any) {
    assert(false, 'Partner percentages test failed', err.message);
  }

  // -------------------------------------------------------------
  // TEST 8: Server-Authoritative Partner Profit Distribution
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Server-Authoritative Profit Distribution ---');
  try {
    const distRes = await fetch(`${BASE_URL}/api/v1/admin/finance/partners/distribute-profit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ periodLabel: 'FY 2025-26 Drop Phase' }),
    });
    const distData = await distRes.json();

    assert(
      distRes.status === 200 && distData.success === true && Array.isArray(distData.transactionsCreated),
      'Executed server-authoritative profit distribution across partners',
      `Transactions generated: ${distData.transactionsCreated?.length}`
    );

    assert(
      distData.transactionsCreated?.length === 4,
      'Profit distribution generated 4 separate partner ledger allocation records',
      `Count: ${distData.transactionsCreated?.length}`
    );
  } catch (err: any) {
    assert(false, 'Profit distribution test failed', err.message);
  }

  // -------------------------------------------------------------
  // TEST 9: Staff Role RBAC Restrictions on Executive Actions
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: Staff Role Authorization Isolation ---');
  try {
    // 9a. Staff viewing transactions without finance permission is blocked with 403
    const staffViewRes = await fetch(`${BASE_URL}/api/v1/admin/finance/transactions`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(
      staffViewRes.status === 403,
      'Staff member without finance permissions is strictly blocked from transactions (HTTP 403)',
      `HTTP status: ${staffViewRes.status}`
    );

    // 9b. Staff attempting executive profit distribution (FORBIDDEN)
    const staffDistRes = await fetch(`${BASE_URL}/api/v1/admin/finance/partners/distribute-profit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ periodLabel: 'Unauthorized Staff Distribution' }),
    });
    const staffDistData = await staffDistRes.json();

    assert(
      staffDistRes.status === 403,
      'Staff member attempting executive profit distribution is blocked with 403 Forbidden',
      staffDistData.error
    );

    // 9c. Staff attempting partner percentage change (FORBIDDEN)
    const staffPctRes = await fetch(`${BASE_URL}/api/v1/admin/finance/partners/percentages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ percentages: { 'ptr-01': 100 } }),
    });

    assert(
      staffPctRes.status === 403,
      'Staff member attempting partner percentage reconfiguration is blocked with 403 Forbidden',
      `HTTP status: ${staffPctRes.status}`
    );
  } catch (err: any) {
    assert(false, 'Staff RBAC test failed', err.message);
  }

  // -------------------------------------------------------------
  // TEST 10: Storefront Catalog Integrity Check
  // -------------------------------------------------------------
  console.log('\n--- TEST 10: Storefront Products & Vault Integrity ---');
  try {
    const resProducts = await fetch(`${BASE_URL}/api/v1/products`);
    const prodData = await resProducts.json();
    assert(
      resProducts.status === 200 && Array.isArray(prodData.data) && prodData.data.length > 0,
      'Public Storefront catalog /api/v1/products remains fully intact and operational',
      `Catalog count: ${prodData.data?.length}`
    );
  } catch (err: any) {
    assert(false, 'Storefront integrity check failed', err.message);
  }

  // -------------------------------------------------------------
  // FINAL REPORT
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
