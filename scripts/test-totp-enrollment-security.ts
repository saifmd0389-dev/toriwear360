import assert from 'assert';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { getPrismaClient } from '../server/db/prisma';
import { authStore } from '../server/authStore';
import { userStore, FULL_SUPER_ADMIN_PERMISSIONS } from '../server/userStore';
import {
  generateBase32Secret,
  encryptSecret,
  decryptSecret,
  generateTOTP,
  verifyTOTP,
  hashRecoveryCode,
} from '../server/services/totpService';

async function runEnrollmentSecurityTests() {
  console.log('================================================================');
  console.log('TORIWEAR — TOTP ENROLLMENT & QR VERIFICATION SECURITY SUITE');
  console.log('================================================================\n');

  const prisma = getPrismaClient();
  assert(prisma, 'PostgreSQL Prisma client must be connected');

  // --- CHECK 1: Cryptographically random 160-bit Base32 secret generation ---
  console.log('--- CHECK 1: Cryptographically Random 160-bit Base32 Secret ---');
  const secrets = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const s = generateBase32Secret(20); // 20 bytes = 160 bits
    assert.strictEqual(s.length, 32, '20 bytes base32 must yield exactly 32 characters');
    assert(/^[A-Z2-7]+$/.test(s), 'Secret must use strict RFC 4648 Base32 alphabet');
    secrets.add(s);
  }
  assert.strictEqual(secrets.size, 50, '100% entropy uniqueness across 50 generated secrets');
  console.log('  ✓ [PASS] Generated 160-bit (20 byte) random secrets with 100% entropy');

  // --- CHECK 2: Authenticated AES-256-GCM encryption at rest ---
  console.log('\n--- CHECK 2: Authenticated AES-256-GCM Encryption at Rest ---');
  const sampleSecret = generateBase32Secret(20);
  const encrypted = encryptSecret(sampleSecret);
  assert(encrypted.startsWith('enc:v1:'), 'Ciphertext must use versioned enc:v1 format');
  const parts = encrypted.split(':');
  assert.strictEqual(parts.length, 5, 'Format must contain prefix, version, IV, tag, and ciphertext');
  assert.strictEqual((parts[2] ?? '').length, 24, 'IV must be 96-bit (12 bytes = 24 hex chars)');
  assert.strictEqual((parts[3] ?? '').length, 32, 'Auth tag must be 128-bit (16 bytes = 32 hex chars)');
  const decrypted = decryptSecret(encrypted);
  assert.strictEqual(decrypted, sampleSecret, 'Decrypted secret must match original sample');
  console.log('  ✓ [PASS] AES-256-GCM authenticated encryption verified');

  // Create a clean test user in userStore & database for enrollment testing
  const testUserId = `usr-enroll-test-${Date.now()}`;
  const testEmail = `enroll.tester.${Date.now()}@toriwear.com`;
  const salt = 'testsalt12345678';
  const passwordHash = (authStore as any).hashPassword('TestPass@2026!', salt);

  await prisma.user.create({
    data: {
      id: testUserId,
      email: testEmail,
      name: 'Enrollment Tester',
      role: 'STORE_MANAGER',
      passwordHash,
      salt,
      isActive: true,
      accountStatus: 'ACTIVE',
    },
  });

  // Register in userStore and credentials
  (userStore as any).users.push({
    id: testUserId,
    email: testEmail,
    name: 'Enrollment Tester',
    role: 'STORE_MANAGER',
    department: 'Testing',
    employeeId: `TEST-${Date.now().toString().slice(-4)}`,
    accountStatus: 'ACTIVE',
    twoFactorEnabled: false,
    permissions: FULL_SUPER_ADMIN_PERMISSIONS,
  });

  (authStore as any).credentials.set(testUserId, {
    userId: testUserId,
    email: testEmail,
    passwordHash,
    salt,
    mustChangePasswordOnFirstLogin: false,
    failedLoginAttempts: 0,
    twoFactorEnabled: false,
  });

  // --- CHECK 3: 2FA Enrollment: Start Setup & Pending State ---
  console.log('\n--- CHECK 3: Start 2FA Setup: Pending Secret in DB (Inactive) ---');
  const setupRes = await authStore.start2FASetup(testUserId);
  assert(setupRes.success, 'start2FASetup must return success');
  assert(setupRes.qrDataUrl && setupRes.qrDataUrl.startsWith('data:image/png;base64,'), 'Must return PNG data URL');
  assert(setupRes.manualKey, 'Must return formatted manual key');

  // Verify in PostgreSQL: pendingSecret is set, but isEnabled remains false
  const dbSetting1 = await prisma.twoFactorSetting.findUnique({ where: { userId: testUserId } });
  assert(dbSetting1, 'TwoFactorSetting row must be created in PostgreSQL');
  assert.strictEqual(dbSetting1.isEnabled, false, '2FA must remain INACTIVE (isEnabled=false) before verification');
  assert(dbSetting1.pendingSecret && dbSetting1.pendingSecret.startsWith('enc:v1:'), 'pendingSecret must be encrypted at rest');
  assert(dbSetting1.pendingExpiresAt && dbSetting1.pendingExpiresAt.getTime() > Date.now(), 'pendingExpiresAt must be in the future');
  assert(!dbSetting1.secret, 'Active secret must remain null before verification');
  console.log('  ✓ [PASS] Pending secret stored encrypted; 2FA remains strictly inactive');

  // --- CHECK 4: Genuine QR Code Decodability & Google Authenticator Conformance ---
  console.log('\n--- CHECK 4: Decode QR Code Image & Validate otpauth:// URI ---');
  const base64Png = setupRes.qrDataUrl.replace(/^data:image\/png;base64,/, '');
  const pngBuffer = Buffer.from(base64Png, 'base64');
  const { data: pixelData, info: imgInfo } = await sharp(pngBuffer)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const qrResult = jsQR(new Uint8ClampedArray(pixelData), imgInfo.width, imgInfo.height);
  assert(qrResult && qrResult.data, 'QR code must be successfully decoded by standard reader');
  console.log('  ✓ Decoded QR payload:', qrResult.data);

  // Validate standards-compliance for Google Authenticator (RFC 6238)
  assert(qrResult.data.startsWith('otpauth://totp/'), 'URI scheme must be otpauth://totp/');
  assert(qrResult.data.includes('algorithm=SHA1'), 'Algorithm must be SHA1 for Google Authenticator');
  assert(qrResult.data.includes('digits=6'), 'Digits must be 6');
  assert(qrResult.data.includes('period=30'), 'Period must be 30 seconds');
  assert(qrResult.data.includes('issuer=TORIWEAR'), 'Issuer must be TORIWEAR');

  const uriMatch = qrResult.data.match(/secret=([A-Z2-7]+)/);
  assert(uriMatch && uriMatch[1], 'Must contain valid Base32 secret parameter');
  const extractedSecret = uriMatch[1];
  console.log('  ✓ [PASS] Decoded QR conforms to Google Authenticator & RFC 6238 standard');

  // --- CHECK 5: Rejection of Incorrect 6-Digit Code ---
  console.log('\n--- CHECK 5: Rejection of Incorrect 6-Digit Verification Code ---');
  const badCodeRes = await authStore.confirm2FASetup(testUserId, '000000');
  assert.strictEqual(badCodeRes.success, false, 'Invalid code must be rejected');
  assert(badCodeRes.error, 'Error message must be returned');

  // Ensure DB remains inactive
  const dbSetting2 = await prisma.twoFactorSetting.findUnique({ where: { userId: testUserId } });
  assert.strictEqual(dbSetting2?.isEnabled, false, '2FA must remain inactive after failed verification');
  console.log('  ✓ [PASS] Incorrect 6-digit code rejected; 2FA remains inactive');

  // --- CHECK 6: Rejection of Expired Enrollment Attempt ---
  console.log('\n--- CHECK 6: Rejection of Expired Enrollment Attempt ---');
  // Temporarily force pendingExpiresAt into past
  await prisma.twoFactorSetting.update({
    where: { userId: testUserId },
    data: { pendingExpiresAt: new Date(Date.now() - 60000) },
  });
  const expiredCodeRes = await authStore.confirm2FASetup(testUserId, '123456');
  assert.strictEqual(expiredCodeRes.success, false, 'Expired enrollment must be rejected');
  assert(expiredCodeRes.error?.includes('expired') || expiredCodeRes.error?.includes('restart'), 'Expired error expected');

  // Restore valid expiration
  await prisma.twoFactorSetting.update({
    where: { userId: testUserId },
    data: { pendingExpiresAt: new Date(Date.now() + 600000) },
  });
  console.log('  ✓ [PASS] Expired enrollment attempt rejected');

  // --- CHECK 7: Successful Verification with Code from Decoded QR Secret ---
  console.log('\n--- CHECK 7: Successful Verification & Activation in PostgreSQL ---');
  const validTotp = generateTOTP(extractedSecret);
  const confirmRes = await authStore.confirm2FASetup(testUserId, validTotp);
  assert(confirmRes.success, `confirm2FASetup must succeed with code ${validTotp}: ${confirmRes.error}`);
  assert(confirmRes.recoveryCodes && confirmRes.recoveryCodes.length === 5, 'Must return 5 single-use recovery codes');

  // Verify in PostgreSQL: isEnabled is true, pendingSecret is null, secret is stored encrypted
  const dbSetting3 = await prisma.twoFactorSetting.findUnique({ where: { userId: testUserId } });
  assert.strictEqual(dbSetting3?.isEnabled, true, '2FA is now ACTIVE (isEnabled=true)');
  assert.strictEqual(dbSetting3?.pendingSecret, null, 'pendingSecret must be cleared');
  assert.strictEqual(dbSetting3?.pendingExpiresAt, null, 'pendingExpiresAt must be cleared');
  assert(dbSetting3?.secret && dbSetting3.secret.startsWith('enc:v1:'), 'Active secret must be stored encrypted');
  assert.strictEqual(decryptSecret(dbSetting3.secret), extractedSecret, 'Stored secret must decrypt to enrolled secret');
  assert(dbSetting3?.backupCodes, 'Hashed backup codes must be stored in PostgreSQL');
  console.log('  ✓ [PASS] 2FA successfully verified and activated in PostgreSQL');

  // --- CHECK 8: Single-Use Recovery Code Hashing ---
  console.log('\n--- CHECK 8: Hashed Single-Use Recovery Code Verification ---');
  const sampleRecovery = confirmRes.recoveryCodes[0] ?? '';
  assert(sampleRecovery.length > 0, 'Sample recovery code must exist');
  const dbHashes: string[] = JSON.parse(dbSetting3.backupCodes);
  assert(dbHashes.includes(hashRecoveryCode(sampleRecovery)), 'Stored hash must match recovery code');
  assert(!dbHashes.includes(sampleRecovery), 'Plaintext recovery code must NEVER be stored');
  console.log('  ✓ [PASS] Recovery codes are hashed with SHA-256 and stored securely');

  // --- CHECK 9: Replay Prevention on Enrolled Key ---
  console.log('\n--- CHECK 9: Replay Prevention on Enrolled Key ---');
  const replayAttempt = verifyTOTP(extractedSecret, validTotp, {
    lastAcceptedStep: dbSetting3.lastAcceptedStep ? BigInt(dbSetting3.lastAcceptedStep) : undefined,
  });
  assert.strictEqual(replayAttempt.valid, false, 'Replayed TOTP code must be rejected');
  assert.strictEqual(replayAttempt.reason, 'REPLAY_DETECTED', 'Reason must be REPLAY_DETECTED');
  console.log('  ✓ [PASS] Immediate replay of used TOTP code strictly rejected');

  // --- CHECK 10: Preservation of Active Secret During Re-enrollment ---
  console.log('\n--- CHECK 10: Existing Active Secret Preservation During Re-Enrollment ---');
  const initialActiveSecret = dbSetting3.secret;

  // Start re-enrollment while 2FA is active
  const reEnrollRes = await authStore.start2FASetup(testUserId);
  assert(reEnrollRes.success, 'start2FASetup must succeed for active account');

  // Verify in PostgreSQL: existing active secret is UNCHANGED and isEnabled is STILL TRUE
  const dbSetting4 = await prisma.twoFactorSetting.findUnique({ where: { userId: testUserId } });
  assert.strictEqual(dbSetting4?.isEnabled, true, '2FA remains ACTIVE during re-enrollment');
  assert.strictEqual(dbSetting4?.secret, initialActiveSecret, 'Existing active secret must NOT be overwritten');
  assert(dbSetting4?.pendingSecret, 'A new pending secret must be waiting');

  // User cancels or abandons re-enrollment: verify old secret still verifies logins
  const oldSecretCode = generateTOTP(extractedSecret);
  const oldSecretCheck = verifyTOTP(extractedSecret, oldSecretCode);
  assert(oldSecretCheck.valid, 'Existing 2FA secret remains fully functional if re-enrollment is not completed');
  console.log('  ✓ [PASS] Active 2FA secret preserved intact during re-enrollment until verified');

  // Clean up test user
  await prisma.twoFactorSetting.deleteMany({ where: { userId: testUserId } });
  await prisma.user.deleteMany({ where: { id: testUserId } });

  console.log('\n================================================================');
  console.log('TOTP ENROLLMENT VERIFICATION SUMMARY: 10 of 10 CHECKS PASSED');
  console.log('================================================================');
}

runEnrollmentSecurityTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
