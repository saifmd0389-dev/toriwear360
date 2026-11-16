import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { encryptSecret, decryptSecret } from '../services/totpService';

const ENC_PREFIX = 'enc:v1:';

/**
 * Resolves an internal store file inside server/data/, migrating any legacy
 * exposed JSON file (from public/generated-assets or project root) once and
 * deleting the legacy exposed file so it is never served publicly.
 */
export function resolveSecureStorePath(filename: string, ...legacyRelativePaths: string[]): string {
  const dataDir = path.resolve(process.cwd(), 'server/data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const targetPath = path.join(dataDir, filename);

  for (const rel of legacyRelativePaths) {
    if (!rel) continue;
    const legacyPath = path.resolve(process.cwd(), rel);
    if (legacyPath === targetPath) continue;
    try {
      if (fs.existsSync(legacyPath)) {
        if (!fs.existsSync(targetPath)) {
          fs.copyFileSync(legacyPath, targetPath);
        }
        fs.unlinkSync(legacyPath);
        console.log(`[STORAGE] Migrated & removed exposed store file: ${rel} -> server/data/${filename}`);
      }
    } catch (err) {
      console.warn(`[STORAGE] Migration note for ${rel}:`, err);
    }
  }

  return targetPath;
}

export function encryptFieldValue(plainText?: string | null): string {
  if (!plainText) return '';
  const trimmed = String(plainText);
  if (!trimmed) return '';
  if (trimmed.startsWith(ENC_PREFIX)) return trimmed;
  try {
    return `${ENC_PREFIX}${encryptSecret(trimmed)}`;
  } catch (err) {
    console.error('[CRYPTO] Failed to encrypt field value:', err);
    throw new Error('Secret encryption failed');
  }
}

export function decryptFieldValue(storedValue?: string | null): string {
  if (!storedValue) return '';
  const raw = String(storedValue);
  if (!raw) return '';
  if (!raw.startsWith(ENC_PREFIX)) {
    return raw;
  }
  try {
    return decryptSecret(raw.slice(ENC_PREFIX.length));
  } catch {
    return '';
  }
}

export function safeTimingEqual(a: string, b: string, encoding: BufferEncoding = 'utf8'): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  try {
    const bufA = Buffer.from(a, encoding);
    const bufB = Buffer.from(b, encoding);
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
