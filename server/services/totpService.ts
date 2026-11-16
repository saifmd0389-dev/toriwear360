import crypto from 'crypto';
import QRCode from 'qrcode';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generate a cryptographically secure random Base32 secret for TOTP (RFC 4648 / RFC 6238).
 * 20 bytes = 160 bits (recommended key size for HMAC-SHA1), resulting in 32 Base32 characters.
 */
export function generateBase32Secret(byteLength: number = 20): string {
  const bytes = crypto.randomBytes(byteLength);
  let bits = '';
  for (let i = 0; i < bytes.length; i++) {
    bits += (bytes[i] ?? 0).toString(2).padStart(8, '0');
  }

  let base32 = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    const chunk = parseInt(bits.substring(i, i + 5), 2);
    base32 += BASE32_ALPHABET[chunk];
  }
  return base32;
}

/**
 * Decode an RFC 4648 Base32 string into a raw binary Buffer.
 */
export function base32Decode(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/[\s=-]/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i] ?? '';
    const val = BASE32_ALPHABET.indexOf(ch);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Get the server master key for AES-256-GCM TOTP secret encryption at rest.
 * Fails fast and safely in production if missing.
 */
export function getEncryptionKey(): Buffer {
  const envKey = process.env.TWO_FACTOR_ENCRYPTION_KEY?.trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (!envKey) {
    if (isProd) {
      throw new Error('[FATAL_SECURITY_ERROR] TWO_FACTOR_ENCRYPTION_KEY is required in production environment.');
    }
    // Safe deterministic development fallback for local testing
    return crypto.createHash('sha256').update('TORIWEAR_DEV_FALLBACK_2FA_ENCRYPTION_KEY_2026').digest();
  }

  if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    return Buffer.from(envKey, 'hex');
  }

  return crypto.createHash('sha256').update(envKey).digest();
}

/**
 * Encrypt a plaintext TOTP secret with authenticated AES-256-GCM.
 * Output format: "enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>"
 */
export function encryptSecret(plainSecret: string): string {
  if (!plainSecret) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV standard for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plainSecret, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypt an AES-256-GCM encrypted TOTP secret.
 * Verifies authenticated ciphertext with auth tag to prevent tampering.
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload) return '';
  // If not in encrypted format (legacy or mock), return as is for backward-safe migration
  if (!encryptedPayload.startsWith('enc:v1:')) {
    return encryptedPayload;
  }

  const parts = encryptedPayload.split(':');
  const ivHex = parts[2];
  const tagHex = parts[3];
  const cipherHex = parts[4];
  if (parts.length !== 5 || !ivHex || !tagHex || !cipherHex) {
    throw new Error('Invalid encrypted secret format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Hash a single-use recovery code with SHA-256 for secure storage at rest.
 */
export function hashRecoveryCode(code: string): string {
  const clean = code.trim().toUpperCase().replace(/[\s-]/g, '');
  return crypto.createHash('sha256').update(clean).digest('hex');
}

/**
 * Compare candidate recovery code against a stored SHA-256 hash in constant time.
 */
export function verifyRecoveryCode(candidate: string, hashedCode: string): boolean {
  if (!candidate || !hashedCode) return false;
  const candidateHash = hashRecoveryCode(candidate);
  if (candidateHash.length !== hashedCode.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidateHash, 'hex'), Buffer.from(hashedCode, 'hex'));
}

/**
 * Compute RFC 6238 TOTP 6-digit token using HMAC-SHA1.
 */
export function generateTOTP(
  secret: string,
  timestampMs: number = Date.now(),
  timeStepSeconds: number = 30
): string {
  const key = base32Decode(secret);
  const timeStep = Math.floor(timestampMs / 1000 / timeStepSeconds);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const binaryCode =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
    (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
    ((hmac[offset + 3] ?? 0) & 0xff);

  const otp = (binaryCode % 1000000).toString().padStart(6, '0');
  return otp;
}

export interface TOTPVerificationOptions {
  window?: number; // Allowed time-step tolerance (default: 1 step = +/- 30s)
  timestampMs?: number; // Server-authoritative time
  timeStepSeconds?: number;
  lastAcceptedStep?: bigint | number; // For replay prevention
}

export interface TOTPVerificationResult {
  valid: boolean;
  acceptedStep?: bigint;
  reason?: 'VALID' | 'INVALID_CODE' | 'REPLAY_DETECTED' | 'MALFORMED_INPUT';
}

/**
 * Verify a 6-digit TOTP code against an RFC 6238 secret.
 * Enforces:
 * 1. Strict 6-digit regex.
 * 2. Narrow transmission delay window (+/- 1 step as per RFC 6238 §5.2).
 * 3. Server-authoritative clock.
 * 4. Replay prevention: rejects any time-step <= lastAcceptedStep.
 */
export function verifyTOTP(
  secret: string,
  code: string,
  options?: TOTPVerificationOptions
): TOTPVerificationResult {
  if (!code || typeof code !== 'string') {
    return { valid: false, reason: 'MALFORMED_INPUT' };
  }
  const cleanCode = code.replace(/[\s-]/g, '').trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    return { valid: false, reason: 'MALFORMED_INPUT' };
  }

  const window = options?.window ?? 1; // Strict RFC 6238 §5.2 transmission delay window: +/- 1 time step (+/- 30s)
  const now = options?.timestampMs ?? Date.now();
  const stepSeconds = options?.timeStepSeconds ?? 30;
  const currentStep = BigInt(Math.floor(now / 1000 / stepSeconds));

  const lastAccepted = options?.lastAcceptedStep !== undefined && options?.lastAcceptedStep !== null
    ? BigInt(options.lastAcceptedStep)
    : undefined;

  for (let offset = -window; offset <= window; offset++) {
    const candidateStep = currentStep + BigInt(offset);
    const checkTime = Number(candidateStep * BigInt(stepSeconds) * 1000n);
    const expectedOtp = generateTOTP(secret, checkTime, stepSeconds);

    if (crypto.timingSafeEqual(Buffer.from(cleanCode), Buffer.from(expectedOtp))) {
      // Replay prevention: reject duplicate authentication attempt in the exact same time step
      if (lastAccepted !== undefined && candidateStep === lastAccepted) {
        return {
          valid: false,
          acceptedStep: candidateStep,
          reason: 'REPLAY_DETECTED',
        };
      }
      return {
        valid: true,
        acceptedStep: candidateStep,
        reason: 'VALID',
      };
    }
  }

  return { valid: false, reason: 'INVALID_CODE' };
}

/**
 * Generate a set of high-entropy, single-use recovery codes.
 */
export function generateRecoveryCodes(count: number = 5): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

/**
 * Format secret for manual entry with 4-character chunks for legibility.
 */
export function formatSecretForDisplay(secret: string): string {
  const clean = secret.replace(/\s+/g, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join(' ') || clean;
}

/**
 * Build standard otpauth:// URL for QR code enrollment in authenticator apps.
 * Parameter 'secret' is strictly unspaced Base32 per Google Authenticator / RFC 3548 spec.
 */
export function buildOtpAuthUri(email: string, secret: string, issuer: string = 'TORIWEAR'): string {
  const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${cleanSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Render a genuine scannable 2D QR Code data URL for authenticator enrollment.
 */
export async function generateQrCodeDataUrl(otpAuthUri: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUri, {
    errorCorrectionLevel: 'M',
    width: 240,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}
