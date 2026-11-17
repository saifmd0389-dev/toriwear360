import crypto from 'crypto';
import { getPrismaClient } from '../db/prisma';

function encryptionKey(): Buffer {
  const raw = String(process.env.API_CREDENTIALS_ENCRYPTION_KEY || '').trim();
  if (!raw) return Buffer.alloc(0);
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length === 32) return decoded;
  throw new Error('API_CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64).');
}

export function decryptIntegrationPayload(value: string): Record<string, string> {
  if (!value.startsWith('api:v1:')) return {};
  const key = encryptionKey();
  if (key.length !== 32) return {};
  const parts = value.split(':');
  if (parts.length !== 5) return {};
  const iv = Buffer.from(parts[2], 'hex');
  const tag = Buffer.from(parts[3], 'hex');
  const ciphertext = Buffer.from(parts[4], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const raw = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  const parsed = JSON.parse(raw);
  if (typeof parsed === 'string') return { apiKey: parsed };
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).filter(([k, v]) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(k) && typeof v === 'string')) as Record<string, string>;
}

/** Read credentials only on the server. Enabled vault config overrides env fallback per field. */
export async function getProviderCredentials(provider: string): Promise<Record<string, string>> {
  const prisma = getPrismaClient();
  if (!prisma?.websiteSetting) return {};
  try {
    const rows = await prisma.websiteSetting.findMany({ where: { group: 'API_CREDENTIAL' } });
    const candidates = rows
      .map((row: any) => { try { return JSON.parse(row.value); } catch { return null; } })
      .filter((v: any) => v && String(v.provider || '').toLowerCase() === provider.toLowerCase() && v.enabled === true)
      .sort((a: any, b: any) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    if (!candidates.length) return {};
    const record = candidates[0];
    if (typeof record.credentials === 'string') return decryptIntegrationPayload(record.credentials);
    if (typeof record.secret === 'string') return decryptIntegrationPayload(record.secret);
    return {};
  } catch (error) {
    console.warn(`[INTEGRATIONS] Unable to read ${provider} vault configuration.`);
    return {};
  }
}

export function mergeProviderCredentials(env: Record<string, string | undefined>, vault: Record<string, string>): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) if (value) merged[key] = value;
  for (const [key, value] of Object.entries(vault)) if (value) merged[key] = value;
  return merged;
}

export async function getIntegrationCredentialsById(id: string): Promise<{ provider: string; credentials: Record<string, string> } | null> {
  const prisma = getPrismaClient();
  if (!prisma?.websiteSetting) return null;
  const row = await prisma.websiteSetting.findUnique({ where: { key: `API_CREDENTIAL:${id}` } });
  if (!row || row.group !== 'API_CREDENTIAL') return null;
  const value = JSON.parse(row.value);
  const encrypted = typeof value.credentials === 'string' ? value.credentials : value.secret;
  return { provider: String(value.provider || 'custom').toLowerCase(), credentials: typeof encrypted === 'string' ? decryptIntegrationPayload(encrypted) : {} };
}
