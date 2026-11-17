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
  const runtimeDir = process.env.TORI_RUNTIME_DATA_DIR
    ? path.resolve(process.env.TORI_RUNTIME_DATA_DIR)
    : path.resolve(process.cwd(), 'server/runtime-data');
  if (!fs.existsSync(runtimeDir)) {
    fs.mkdirSync(runtimeDir, { recursive: true });
  }
  const targetPath = path.join(runtimeDir, filename);

  // If runtime copy does not exist yet, seed from read-only repo seed in server/data/
  if (!fs.existsSync(targetPath)) {
    const repoSeedPath = path.resolve(process.cwd(), 'server/data', filename);
    if (repoSeedPath !== targetPath && fs.existsSync(repoSeedPath)) {
      try {
        fs.copyFileSync(repoSeedPath, targetPath);
      } catch (err) {
        console.warn(`[STORAGE] Seed copy note for server/data/${filename}:`, err);
      }
    }
  }

  for (const rel of legacyRelativePaths) {
    if (!rel) continue;
    const legacyPath = path.resolve(process.cwd(), rel);
    if (legacyPath === targetPath) continue;
    try {
      if (fs.existsSync(legacyPath)) {
        if (!fs.existsSync(targetPath)) {
          fs.copyFileSync(legacyPath, targetPath);
        }
        // Only remove untracked dotfiles in root; never delete repo-tracked paths that could break git pull
        if (path.basename(legacyPath).startsWith('.') && path.dirname(legacyPath) === process.cwd()) {
          fs.unlinkSync(legacyPath);
        }
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
