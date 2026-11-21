/**
 * TORIWEAR Enterprise Cloud & Local Storage Abstraction
 *
 * Supports:
 * 1. LocalStorageAdapter (Default / local disk persistence under public/generated-assets)
 * 2. GoogleCloudStorageAdapter (Official @google-cloud/storage SDK for production cloud storage)
 * 3. CloudflareR2StorageAdapter (Official @aws-sdk/client-s3 S3-compatible SDK for Cloudflare R2)
 *
 * Security & Reliability Rules:
 * - Credentials are read strictly from private server-side environment variables.
 * - Never exposes service-account keys, R2 access keys, or internal storage secrets to clients.
 * - Keeps "local" as the default provider unless STORAGE_PROVIDER="gcs" or "r2" is explicitly configured.
 * - When a cloud provider (GCS or R2) is enabled, never silently falls back to local disk on misconfiguration or upload failure.
 */

import fs from 'fs';
import path from 'path';
import { Storage, Bucket } from '@google-cloud/storage';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

export type StorageProviderName = 'local' | 'gcs' | 'r2';

export const IMMUTABLE_IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface UploadFileOptions {
  cacheControl?: string;
}

export interface UploadResult {
  success: boolean;
  url: string;
  destinationPath: string;
  sizeBytes?: number;
  contentType?: string;
  provider?: StorageProviderName;
  statusCode?: number;
  error?: string;
}

export interface RetrieveFileResult {
  success: boolean;
  buffer?: Buffer;
  contentType?: string;
  sizeBytes?: number;
  statusCode?: number;
  error?: string;
}

export interface StorageConfigStatus {
  provider: StorageProviderName;
  configured: boolean;
  bucketName?: string;
  publicBaseUrl?: string;
  error?: string;
}

export interface StorageAdapter {
  readonly providerName: StorageProviderName;
  uploadFile(
    buffer: Buffer,
    destinationPath: string,
    contentType?: string,
    options?: UploadFileOptions
  ): Promise<UploadResult>;
  getFile(destinationPath: string): Promise<RetrieveFileResult>;
  deleteFile(destinationPath: string): Promise<boolean>;
  getFileUrl(destinationPath: string): string;
  fileExists(destinationPath: string): Promise<boolean>;
  getConfigStatus(): StorageConfigStatus;
  /**
   * Resolves a public image URL strictly belonging to THIS storage adapter into its
   * normalized relative storage key. Returns null for external URLs, static assets,
   * invalid/traversal paths, or URLs belonging to any other storage provider.
   */
  resolveManagedStorageKey(url: string): string | null;
}

function sanitizeRelativeStoragePath(destinationPath: string): string {
  const normalized = String(destinationPath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  const segments = normalized.split('/').filter((seg) => seg && seg !== '.' && seg !== '..');
  if (segments.length === 0) {
    throw new Error('Invalid destination storage path.');
  }
  return segments.join('/');
}

/**
 * Safely extracts and validates a relative storage key from a URL matching an exact
 * configured HTTPS public base URL (origin + path prefix). Rejects traversal,
 * encoded traversal, backslashes, control characters, and non-matching origins/prefixes.
 */
function extractKeyFromHttpBaseUrl(candidateUrl: string, publicBaseUrl: string): string | null {
  const raw = String(candidateUrl || '').trim();
  const baseRaw = String(publicBaseUrl || '').trim().replace(/\/+$/, '');
  if (!raw || !baseRaw) return null;
  if (/^(data|blob|javascript|file):/i.test(raw)) return null;

  // Reject raw literal or percent-encoded path traversal BEFORE WHATWG URL normalization collapses /../
  const rawNoQuery = raw.split(/[?#]/, 1)[0] || '';
  if (/(?:^|[\\/])(?:\.|%2e){2}(?:$|[\\/])/i.test(rawNoQuery) || rawNoQuery.includes('\\')) {
    return null;
  }

  let parsedCandidate: URL;
  let parsedBase: URL;
  try {
    parsedCandidate = new URL(raw);
    parsedBase = new URL(baseRaw);
  } catch {
    return null;
  }

  if (parsedCandidate.protocol !== parsedBase.protocol) return null;
  if (parsedCandidate.origin.toLowerCase() !== parsedBase.origin.toLowerCase()) return null;

  const basePath = parsedBase.pathname.replace(/\/+$/, '');
  const requiredPrefix = basePath ? `${basePath}/` : '/';
  const candidatePath = parsedCandidate.pathname;
  if (!candidatePath.startsWith(requiredPrefix)) return null;

  const rawRelative = candidatePath.slice(requiredPrefix.length);
  return decodeAndValidateManagedRelativeKey(rawRelative);
}

function decodeAndValidateManagedRelativeKey(rawRelative: string): string | null {
  if (!rawRelative || rawRelative.includes('\\')) return null;

  const rawSegments = rawRelative.split('/');
  const decodedSegments: string[] = [];

  for (const rawSeg of rawSegments) {
    if (!rawSeg) return null; // Reject empty segments / double slashes / trailing slash
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawSeg);
    } catch {
      return null;
    }
    if (
      !decoded ||
      decoded === '.' ||
      decoded === '..' ||
      decoded.includes('/') ||
      decoded.includes('\\') ||
      decoded.includes('\0') ||
      /[\x00-\x1f\x7f]/.test(decoded)
    ) {
      return null;
    }
    decodedSegments.push(decoded);
  }

  if (decodedSegments.length === 0) return null;
  return decodedSegments.join('/');
}

function guessContentTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.webp':
      return 'image/webp';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Local filesystem storage adapter (default fallback for local development & self-hosted disk)
 */
export class LocalStorageAdapter implements StorageAdapter {
  public readonly providerName = 'local' as const;
  private baseDir: string;
  private publicPrefix: string;

  constructor(baseDir?: string, publicPrefix: string = '/generated-assets') {
    this.baseDir = path.resolve(baseDir || path.resolve(process.cwd(), 'public', 'generated-assets'));
    this.publicPrefix = publicPrefix.replace(/\/+$/, '');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolveSafeFullPath(destinationPath: string): { cleanRelative: string; fullPath: string } {
    const cleanRelative = sanitizeRelativeStoragePath(destinationPath);
    const fullPath = path.resolve(this.baseDir, cleanRelative);
    if (fullPath !== this.baseDir && !fullPath.startsWith(`${this.baseDir}${path.sep}`)) {
      throw new Error('Path traversal rejected by local storage adapter.');
    }
    return { cleanRelative, fullPath };
  }

  public getConfigStatus(): StorageConfigStatus {
    return {
      provider: 'local',
      configured: true,
      publicBaseUrl: this.publicPrefix,
    };
  }

  public async uploadFile(
    buffer: Buffer,
    destinationPath: string,
    contentType?: string,
    _options?: UploadFileOptions
  ): Promise<UploadResult> {
    try {
      const { cleanRelative, fullPath } = this.resolveSafeFullPath(destinationPath);
      const parentDir = path.dirname(fullPath);

      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      const tmpPath = `${fullPath}.tmp-${process.pid}-${Date.now()}`;
      fs.writeFileSync(tmpPath, buffer);
      fs.renameSync(tmpPath, fullPath);

      const url = this.getFileUrl(cleanRelative);
      return {
        success: true,
        url,
        destinationPath: cleanRelative,
        sizeBytes: buffer.length,
        contentType: contentType || guessContentTypeFromPath(cleanRelative),
        provider: 'local',
      };
    } catch (err: any) {
      console.error('[STORAGE:LOCAL] Failed to write uploaded file:', err?.message || err);
      return {
        success: false,
        url: '',
        destinationPath,
        provider: 'local',
        statusCode: 500,
        error: 'Failed to save uploaded image to local storage.',
      };
    }
  }

  public async getFile(destinationPath: string): Promise<RetrieveFileResult> {
    try {
      const { cleanRelative, fullPath } = this.resolveSafeFullPath(destinationPath);
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: 'File not found in local storage.' };
      }
      const buffer = fs.readFileSync(fullPath);
      return {
        success: true,
        buffer,
        contentType: guessContentTypeFromPath(cleanRelative),
        sizeBytes: buffer.length,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to read file from local storage.',
      };
    }
  }

  public async deleteFile(destinationPath: string): Promise<boolean> {
    try {
      const { fullPath } = this.resolveSafeFullPath(destinationPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public getFileUrl(destinationPath: string): string {
    const cleanRelative = sanitizeRelativeStoragePath(destinationPath);
    const encoded = cleanRelative.split('/').map(encodeURIComponent).join('/');
    return `${this.publicPrefix}/${encoded}`;
  }

  public async fileExists(destinationPath: string): Promise<boolean> {
    try {
      const { fullPath } = this.resolveSafeFullPath(destinationPath);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }

  public resolveManagedStorageKey(url: string): string | null {
    const raw = String(url || '').trim();
    if (!raw || /^(data|blob|javascript|file):/i.test(raw)) return null;

    const prefixWithSlash = `${this.publicPrefix}/`;
    let pathname = '';

    if (raw.startsWith('/')) {
      // Reject protocol-relative URLs like //evil.com/generated-assets/foo.webp
      if (raw.startsWith('//')) return null;
      const hashIdx = raw.indexOf('#');
      const noHash = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
      const queryIdx = noHash.indexOf('?');
      pathname = queryIdx >= 0 ? noHash.slice(0, queryIdx) : noHash;
    } else if (/^https?:\/\//i.test(raw)) {
      let parsed: URL;
      try {
        parsed = new URL(raw);
      } catch {
        return null;
      }
      const allowedOrigins = new Set<string>();
      for (const envUrl of [process.env.SITE_URL, process.env.APP_URL]) {
        if (envUrl && /^https?:\/\//i.test(envUrl.trim())) {
          try {
            allowedOrigins.add(new URL(envUrl.trim()).origin.toLowerCase());
          } catch {
            // ignore invalid env URL
          }
        }
      }
      const hostLower = parsed.hostname.toLowerCase();
      const isLocalOrigin = hostLower === 'localhost' || hostLower === '127.0.0.1';
      if (!isLocalOrigin && !allowedOrigins.has(parsed.origin.toLowerCase())) {
        return null;
      }
      pathname = parsed.pathname;
    } else {
      return null;
    }

    if (!pathname.startsWith(prefixWithSlash)) {
      return null;
    }

    const rawRelative = pathname.slice(prefixWithSlash.length);
    const key = decodeAndValidateManagedRelativeKey(rawRelative);
    if (!key) return null;

    try {
      const { cleanRelative } = this.resolveSafeFullPath(key);
      return cleanRelative;
    } catch {
      return null;
    }
  }
}

interface ParsedGcsConfig {
  valid: boolean;
  bucketName: string;
  projectId?: string;
  publicBaseUrl: string;
  credentials?: {
    client_email: string;
    private_key: string;
  };
  keyFilename?: string;
  error?: string;
}

function isPlaceholderValue(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return (
    !lower ||
    lower.includes('your_') ||
    lower.includes('your-') ||
    lower.includes('<from-') ||
    lower.includes('placeholder') ||
    lower === 'changeme'
  );
}

function parseServiceAccountJson(raw: string): {
  client_email?: string;
  private_key?: string;
  project_id?: string;
} {
  const trimmed = raw.trim();
  const tryParse = (input: string) => JSON.parse(input);
  try {
    return tryParse(trimmed);
  } catch {
    // Support base64-encoded service account JSON for hosting panels that strip newlines/quotes
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
    return tryParse(decoded);
  }
}

function resolveGcsConfiguration(overrideBucketName?: string): ParsedGcsConfig {
  const bucketName = String(overrideBucketName || process.env.GCS_BUCKET_NAME || '').trim();
  const envProjectId = String(process.env.GCS_PROJECT_ID || '').trim();
  const rawJson = String(process.env.GCS_SERVICE_ACCOUNT_JSON || '').trim();
  const clientEmail = String(process.env.GCS_CLIENT_EMAIL || '').trim();
  const privateKeyRaw = String(process.env.GCS_PRIVATE_KEY || '').trim();
  const keyFilename = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  const rawPublicPrefix = String(process.env.GCS_PUBLIC_URL_PREFIX || '').trim().replace(/\/+$/, '');

  const defaultPublicBase = bucketName ? `https://storage.googleapis.com/${bucketName}` : '';
  const publicBaseUrl =
    rawPublicPrefix && !isPlaceholderValue(rawPublicPrefix) ? rawPublicPrefix : defaultPublicBase;

  if (!bucketName || isPlaceholderValue(bucketName)) {
    return {
      valid: false,
      bucketName: '',
      publicBaseUrl: '',
      error: 'Cloud storage is not properly configured: GCS_BUCKET_NAME is missing.',
    };
  }

  if (!/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(bucketName)) {
    return {
      valid: false,
      bucketName,
      publicBaseUrl,
      error: 'Cloud storage is not properly configured: GCS_BUCKET_NAME format is invalid.',
    };
  }

  if (rawPublicPrefix && !isPlaceholderValue(rawPublicPrefix) && !/^https:\/\/.+/i.test(rawPublicPrefix)) {
    return {
      valid: false,
      bucketName,
      publicBaseUrl,
      error: 'Cloud storage is not properly configured: GCS_PUBLIC_URL_PREFIX must use HTTPS.',
    };
  }

  // Option A: Full service-account JSON string (raw or base64-encoded)
  if (rawJson && !isPlaceholderValue(rawJson)) {
    try {
      const parsed = parseServiceAccountJson(rawJson);
      const parsedEmail = String(parsed.client_email || '').trim();
      const parsedKey = String(parsed.private_key || '').replace(/\\n/g, '\n').trim();
      const projectId = (!isPlaceholderValue(envProjectId) ? envProjectId : '') || String(parsed.project_id || '').trim();

      if (!parsedEmail || !parsedKey || !parsedKey.includes('BEGIN')) {
        return {
          valid: false,
          bucketName,
          publicBaseUrl,
          error: 'Cloud storage is not properly configured: GCS_SERVICE_ACCOUNT_JSON is missing valid service account credentials.',
        };
      }

      return {
        valid: true,
        bucketName,
        projectId: projectId || undefined,
        publicBaseUrl,
        credentials: {
          client_email: parsedEmail,
          private_key: parsedKey,
        },
      };
    } catch {
      return {
        valid: false,
        bucketName,
        publicBaseUrl,
        error: 'Cloud storage is not properly configured: GCS_SERVICE_ACCOUNT_JSON could not be parsed as valid JSON.',
      };
    }
  }

  // Option B: Separate service-account variables (GCS_CLIENT_EMAIL + GCS_PRIVATE_KEY)
  if (clientEmail && privateKeyRaw && !isPlaceholderValue(clientEmail) && !isPlaceholderValue(privateKeyRaw)) {
    const normalizedKey = privateKeyRaw.replace(/\\n/g, '\n').trim();
    if (!normalizedKey.includes('BEGIN')) {
      return {
        valid: false,
        bucketName,
        publicBaseUrl,
        error: 'Cloud storage is not properly configured: GCS_PRIVATE_KEY is invalid.',
      };
    }
    return {
      valid: true,
      bucketName,
      projectId: !isPlaceholderValue(envProjectId) ? envProjectId : undefined,
      publicBaseUrl,
      credentials: {
        client_email: clientEmail,
        private_key: normalizedKey,
      },
    };
  }

  // Option C: Standard GCP server keyfile path via GOOGLE_APPLICATION_CREDENTIALS
  if (keyFilename && !isPlaceholderValue(keyFilename)) {
    if (!fs.existsSync(keyFilename)) {
      return {
        valid: false,
        bucketName,
        publicBaseUrl,
        error: 'Cloud storage is not properly configured: credentials file referenced by GOOGLE_APPLICATION_CREDENTIALS was not found.',
      };
    }
    return {
      valid: true,
      bucketName,
      projectId: !isPlaceholderValue(envProjectId) ? envProjectId : undefined,
      publicBaseUrl,
      keyFilename,
    };
  }

  return {
    valid: false,
    bucketName,
    publicBaseUrl,
    error:
      'Cloud storage is not properly configured: provide GCS_SERVICE_ACCOUNT_JSON (or GCS_CLIENT_EMAIL and GCS_PRIVATE_KEY).',
  };
}

export interface GoogleCloudStorageAdapterOptions {
  bucketName?: string;
  publicBaseUrl?: string;
  /** Optional injected @google-cloud/storage client (used for automated mocked SDK tests). */
  storageClient?: Storage;
}

let warnedDeprecatedGcsMakePublic = false;

/**
 * Genuine Google Cloud Storage adapter using official @google-cloud/storage SDK.
 *
 * Public Access Model:
 * - Public storefront images rely exclusively on Uniform Bucket-Level Access (UBLA)
 *   and bucket-level IAM (e.g. roles/storage.objectViewer on a dedicated storefront media bucket).
 * - Legacy per-object ACLs and file.makePublic() are intentionally disabled and never invoked.
 * - Private customer files and unrelated application data must never be stored in a public bucket.
 * - Fails closed whenever credentials or bucket configuration are missing/invalid.
 */
export class GoogleCloudStorageAdapter implements StorageAdapter {
  public readonly providerName = 'gcs' as const;
  private config: ParsedGcsConfig;
  private storageClient: Storage | null = null;
  private bucket: Bucket | null = null;

  constructor(bucketNameOrOptions?: string | GoogleCloudStorageAdapterOptions) {
    if (String(process.env.GCS_MAKE_PUBLIC || '').trim() && !warnedDeprecatedGcsMakePublic) {
      warnedDeprecatedGcsMakePublic = true;
      console.warn(
        '[STORAGE:GCS] Ignoring deprecated GCS_MAKE_PUBLIC setting. Configure Uniform Bucket-Level Access and bucket-level IAM on your storefront media bucket instead.'
      );
    }

    const opts: GoogleCloudStorageAdapterOptions =
      typeof bucketNameOrOptions === 'string'
        ? { bucketName: bucketNameOrOptions }
        : (bucketNameOrOptions || {});

    if (opts.storageClient) {
      const bucketName = String(opts.bucketName || process.env.GCS_BUCKET_NAME || '').trim();
      const publicBaseUrl = (
        opts.publicBaseUrl ||
        (bucketName ? `https://storage.googleapis.com/${bucketName}` : '')
      ).replace(/\/+$/, '');

      if (!bucketName || !/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(bucketName)) {
        this.config = {
          valid: false,
          bucketName,
          publicBaseUrl,
          error: 'Cloud storage is not properly configured: GCS_BUCKET_NAME is missing or invalid.',
        };
      } else {
        this.config = {
          valid: true,
          bucketName,
          publicBaseUrl,
        };
        this.storageClient = opts.storageClient;
        this.bucket = this.storageClient.bucket(bucketName);
      }
      return;
    }

    this.config = resolveGcsConfiguration(opts.bucketName);
    if (this.config.valid) {
      const storageOpts: ConstructorParameters<typeof Storage>[0] = {};
      if (this.config.projectId) storageOpts.projectId = this.config.projectId;
      if (this.config.credentials) storageOpts.credentials = this.config.credentials;
      if (this.config.keyFilename) storageOpts.keyFilename = this.config.keyFilename;
      this.storageClient = new Storage(storageOpts);
      this.bucket = this.storageClient.bucket(this.config.bucketName);
    }
  }

  public getConfigStatus(): StorageConfigStatus {
    return {
      provider: 'gcs',
      configured: this.config.valid,
      bucketName: this.config.bucketName || undefined,
      publicBaseUrl: this.config.publicBaseUrl || undefined,
      error: this.config.error,
    };
  }

  public async verifyBucketAccess(): Promise<{ ok: boolean; error?: string }> {
    if (!this.config.valid || !this.bucket) {
      return { ok: false, error: this.config.error || 'Google Cloud Storage is not configured.' };
    }
    try {
      const [exists] = await this.bucket.exists();
      if (!exists) {
        return { ok: false, error: 'Configured Google Cloud Storage bucket does not exist or is unreachable.' };
      }
      return { ok: true };
    } catch (err: any) {
      console.error('[STORAGE:GCS] Bucket verification failed:', err?.message || err);
      return {
        ok: false,
        error: 'Unable to verify Google Cloud Storage bucket access. Check credentials and bucket IAM permissions.',
      };
    }
  }

  public async uploadFile(
    buffer: Buffer,
    destinationPath: string,
    contentType: string = 'application/octet-stream',
    options?: UploadFileOptions
  ): Promise<UploadResult> {
    const cleanPath = sanitizeRelativeStoragePath(destinationPath);

    if (!this.config.valid || !this.bucket) {
      return {
        success: false,
        url: '',
        destinationPath: cleanPath,
        provider: 'gcs',
        statusCode: 503,
        error: this.config.error || 'Cloud storage is not properly configured.',
      };
    }

    try {
      const file = this.bucket.file(cleanPath);
      const cacheControl = options?.cacheControl || IMMUTABLE_IMAGE_CACHE_CONTROL;

      // Upload without object-level ACLs; public access is governed strictly by Uniform Bucket-Level Access & bucket IAM.
      await file.save(buffer, {
        resumable: false,
        validation: 'crc32c',
        contentType,
        metadata: {
          contentType,
          cacheControl,
        },
      });

      const [exists] = await file.exists();
      if (!exists) {
        throw new Error('Uploaded object could not be verified in Google Cloud Storage.');
      }

      return {
        success: true,
        url: this.getFileUrl(cleanPath),
        destinationPath: cleanPath,
        sizeBytes: buffer.length,
        contentType,
        provider: 'gcs',
      };
    } catch (err: any) {
      const errCode = Number(err?.code);
      console.error('[STORAGE:GCS] Upload failed:', err?.code || '', err?.message || err);
      if (errCode === 403 || errCode === 401) {
        return {
          success: false,
          url: '',
          destinationPath: cleanPath,
          provider: 'gcs',
          statusCode: 403,
          error: 'Cloud storage permission denied. Verify service-account IAM roles on the configured Google Cloud Storage bucket.',
        };
      }
      return {
        success: false,
        url: '',
        destinationPath: cleanPath,
        provider: 'gcs',
        statusCode: 502,
        error: 'Cloud storage upload failed. Verify Google Cloud Storage credentials, bucket permissions, and network availability.',
      };
    }
  }

  public async getFile(destinationPath: string): Promise<RetrieveFileResult> {
    if (!this.config.valid || !this.bucket) {
      return {
        success: false,
        statusCode: 503,
        error: this.config.error || 'Cloud storage is not properly configured.',
      };
    }

    try {
      const cleanPath = sanitizeRelativeStoragePath(destinationPath);
      const file = this.bucket.file(cleanPath);
      const [[buffer], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
      return {
        success: true,
        buffer,
        contentType: metadata?.contentType || guessContentTypeFromPath(cleanPath),
        sizeBytes: buffer.length,
        statusCode: 200,
      };
    } catch (err: any) {
      const errCode = Number(err?.code);
      console.error('[STORAGE:GCS] File retrieval failed:', err?.code || '', err?.message || err);
      if (errCode === 404) {
        return {
          success: false,
          statusCode: 404,
          error: 'File not found in cloud storage.',
        };
      }
      if (errCode === 403 || errCode === 401) {
        return {
          success: false,
          statusCode: 403,
          error: 'Cloud storage permission denied while retrieving file.',
        };
      }
      return {
        success: false,
        statusCode: 502,
        error: 'Failed to retrieve file from cloud storage.',
      };
    }
  }

  public async deleteFile(destinationPath: string): Promise<boolean> {
    if (!this.config.valid || !this.bucket) {
      return false;
    }

    try {
      const cleanPath = sanitizeRelativeStoragePath(destinationPath);
      const file = this.bucket.file(cleanPath);
      const [exists] = await file.exists();
      if (!exists) return false;
      await file.delete({ ignoreNotFound: true });
      return true;
    } catch (err: any) {
      console.error('[STORAGE:GCS] File deletion failed:', err?.code || '', err?.message || err);
      return false;
    }
  }

  public getFileUrl(destinationPath: string): string {
    const cleanPath = sanitizeRelativeStoragePath(destinationPath);
    const encoded = cleanPath.split('/').map(encodeURIComponent).join('/');
    return `${this.config.publicBaseUrl}/${encoded}`;
  }

  public async fileExists(destinationPath: string): Promise<boolean> {
    if (!this.config.valid || !this.bucket) {
      return false;
    }

    try {
      const cleanPath = sanitizeRelativeStoragePath(destinationPath);
      const [exists] = await this.bucket.file(cleanPath).exists();
      return Boolean(exists);
    } catch (err: any) {
      console.error('[STORAGE:GCS] Existence check failed:', err?.code || '', err?.message || err);
      return false;
    }
  }

  public resolveManagedStorageKey(url: string): string | null {
    if (!this.config.valid || !this.config.publicBaseUrl) {
      return null;
    }
    return extractKeyFromHttpBaseUrl(url, this.config.publicBaseUrl);
  }
}

interface ParsedR2Config {
  valid: boolean;
  accountId: string;
  bucketName: string;
  endpoint: string;
  publicBaseUrl: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  error?: string;
}

function resolveR2Configuration(overrides?: {
  bucketName?: string;
  endpoint?: string;
  publicBaseUrl?: string;
  accountId?: string;
}): ParsedR2Config {
  const accountId = String(overrides?.accountId ?? process.env.R2_ACCOUNT_ID ?? '').trim();
  const bucketName = String(overrides?.bucketName ?? process.env.R2_BUCKET_NAME ?? '').trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const rawEndpoint = String(overrides?.endpoint ?? process.env.R2_ENDPOINT ?? '').trim().replace(/\/+$/, '');
  const rawPublicUrl = String(overrides?.publicBaseUrl ?? process.env.R2_PUBLIC_URL ?? '').trim().replace(/\/+$/, '');

  const derivedEndpoint =
    rawEndpoint && !isPlaceholderValue(rawEndpoint)
      ? rawEndpoint
      : accountId && !isPlaceholderValue(accountId)
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : '';

  const publicBaseUrl = rawPublicUrl && !isPlaceholderValue(rawPublicUrl) ? rawPublicUrl : '';

  if (!bucketName || isPlaceholderValue(bucketName)) {
    return {
      valid: false,
      accountId,
      bucketName: '',
      endpoint: derivedEndpoint,
      publicBaseUrl,
      error: 'Cloudflare R2 storage is not properly configured: R2_BUCKET_NAME is missing.',
    };
  }

  if (!/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(bucketName)) {
    return {
      valid: false,
      accountId,
      bucketName,
      endpoint: derivedEndpoint,
      publicBaseUrl,
      error: 'Cloudflare R2 storage is not properly configured: R2_BUCKET_NAME format is invalid.',
    };
  }

  if (!derivedEndpoint) {
    return {
      valid: false,
      accountId,
      bucketName,
      endpoint: '',
      publicBaseUrl,
      error: 'Cloudflare R2 storage is not properly configured: provide R2_ENDPOINT or R2_ACCOUNT_ID.',
    };
  }

  if (!/^https:\/\/.+/i.test(derivedEndpoint)) {
    return {
      valid: false,
      accountId,
      bucketName,
      endpoint: derivedEndpoint,
      publicBaseUrl,
      error: 'Cloudflare R2 storage is not properly configured: R2_ENDPOINT must use HTTPS.',
    };
  }

  if (!publicBaseUrl) {
    return {
      valid: false,
      accountId,
      bucketName,
      endpoint: derivedEndpoint,
      publicBaseUrl: '',
      error: 'Cloudflare R2 storage is not properly configured: R2_PUBLIC_URL is missing.',
    };
  }

  if (!/^https:\/\/.+/i.test(publicBaseUrl)) {
    return {
      valid: false,
      accountId,
      bucketName,
      endpoint: derivedEndpoint,
      publicBaseUrl,
      error: 'Cloudflare R2 storage is not properly configured: R2_PUBLIC_URL must use HTTPS.',
    };
  }

  if (!accessKeyId || isPlaceholderValue(accessKeyId) || !secretAccessKey || isPlaceholderValue(secretAccessKey)) {
    return {
      valid: false,
      accountId,
      bucketName,
      endpoint: derivedEndpoint,
      publicBaseUrl,
      error: 'Cloudflare R2 storage is not properly configured: provide R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.',
    };
  }

  return {
    valid: true,
    accountId,
    bucketName,
    endpoint: derivedEndpoint,
    publicBaseUrl,
    accessKeyId,
    secretAccessKey,
  };
}

function getAwsErrorStatusCode(err: any): number | undefined {
  const metaStatus = Number(err?.$metadata?.httpStatusCode);
  if (Number.isFinite(metaStatus) && metaStatus > 0) return metaStatus;
  const codeNum = Number(err?.code ?? err?.statusCode);
  if (Number.isFinite(codeNum) && codeNum > 0) return codeNum;
  const name = String(err?.name || err?.Code || '');
  if (name === 'NotFound' || name === 'NoSuchKey') return 404;
  if (name === 'AccessDenied' || name === 'Forbidden' || name === 'InvalidAccessKeyId' || name === 'SignatureDoesNotMatch') {
    return 403;
  }
  return undefined;
}

async function s3BodyToBuffer(body: any): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }
  if (typeof body[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error('Unsupported S3 response body stream format.');
}

export interface CloudflareR2StorageAdapterOptions {
  accountId?: string;
  bucketName?: string;
  endpoint?: string;
  publicBaseUrl?: string;
  /** Optional injected @aws-sdk/client-s3 client (used for automated mocked SDK tests). */
  s3Client?: Pick<S3Client, 'send'>;
}

/**
 * Genuine Cloudflare R2 storage adapter using official @aws-sdk/client-s3 SDK (region: "auto").
 *
 * Security & Reliability Rules:
 * - Credentials are read strictly from private server-side environment variables.
 * - Never exposes access keys or secret keys in URLs, responses, or error messages.
 * - Fails closed whenever credentials, bucket, endpoint, or public URL are missing/invalid.
 * - Never silently falls back to local disk storage.
 */
export class CloudflareR2StorageAdapter implements StorageAdapter {
  public readonly providerName = 'r2' as const;
  private config: ParsedR2Config;
  private s3Client: Pick<S3Client, 'send'> | null = null;

  constructor(options?: CloudflareR2StorageAdapterOptions) {
    if (options?.s3Client) {
      const accountId = String(options.accountId ?? process.env.R2_ACCOUNT_ID ?? '').trim();
      const bucketName = String(options.bucketName ?? process.env.R2_BUCKET_NAME ?? '').trim();
      const rawEndpoint = String(options.endpoint ?? process.env.R2_ENDPOINT ?? '').trim().replace(/\/+$/, '');
      const endpoint = rawEndpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
      const publicBaseUrl = String(options.publicBaseUrl ?? process.env.R2_PUBLIC_URL ?? '').trim().replace(/\/+$/, '');

      if (!bucketName || !/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(bucketName)) {
        this.config = {
          valid: false,
          accountId,
          bucketName,
          endpoint,
          publicBaseUrl,
          error: 'Cloudflare R2 storage is not properly configured: R2_BUCKET_NAME is missing or invalid.',
        };
      } else if (!endpoint || !/^https:\/\/.+/i.test(endpoint)) {
        this.config = {
          valid: false,
          accountId,
          bucketName,
          endpoint,
          publicBaseUrl,
          error: 'Cloudflare R2 storage is not properly configured: R2_ENDPOINT must use HTTPS.',
        };
      } else if (!publicBaseUrl || !/^https:\/\/.+/i.test(publicBaseUrl)) {
        this.config = {
          valid: false,
          accountId,
          bucketName,
          endpoint,
          publicBaseUrl,
          error: 'Cloudflare R2 storage is not properly configured: R2_PUBLIC_URL must use HTTPS.',
        };
      } else {
        this.config = {
          valid: true,
          accountId,
          bucketName,
          endpoint,
          publicBaseUrl,
        };
        this.s3Client = options.s3Client;
      }
      return;
    }

    this.config = resolveR2Configuration(options);
    if (this.config.valid && this.config.accessKeyId && this.config.secretAccessKey) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: this.config.endpoint,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
      });
    }
  }

  public getConfigStatus(): StorageConfigStatus {
    return {
      provider: 'r2',
      configured: this.config.valid,
      bucketName: this.config.bucketName || undefined,
      publicBaseUrl: this.config.publicBaseUrl || undefined,
      error: this.config.error,
    };
  }

  public async verifyBucketAccess(): Promise<{ ok: boolean; error?: string }> {
    if (!this.config.valid || !this.s3Client) {
      return { ok: false, error: this.config.error || 'Cloudflare R2 storage is not configured.' };
    }
    try {
      await this.s3Client.send(
        new HeadBucketCommand({
          Bucket: this.config.bucketName,
        })
      );
      return { ok: true };
    } catch (err: any) {
      const status = getAwsErrorStatusCode(err);
      console.error('[STORAGE:R2] Bucket verification failed:', status || err?.name || '', err?.message || err);
      if (status === 403 || status === 401) {
        return {
          ok: false,
          error: 'Cloudflare R2 permission denied. Verify R2 API token permissions on the configured bucket.',
        };
      }
      return {
        ok: false,
        error: 'Unable to verify Cloudflare R2 bucket access. Check endpoint, bucket name, and credentials.',
      };
    }
  }

  public async uploadFile(
    buffer: Buffer,
    destinationPath: string,
    contentType: string = 'application/octet-stream',
    options?: UploadFileOptions
  ): Promise<UploadResult> {
    const cleanPath = sanitizeRelativeStoragePath(destinationPath);

    if (!this.config.valid || !this.s3Client) {
      return {
        success: false,
        url: '',
        destinationPath: cleanPath,
        provider: 'r2',
        statusCode: 503,
        error: this.config.error || 'Cloudflare R2 storage is not properly configured.',
      };
    }

    try {
      const cacheControl = options?.cacheControl || IMMUTABLE_IMAGE_CACHE_CONTROL;

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.config.bucketName,
          Key: cleanPath,
          Body: buffer,
          ContentType: contentType,
          CacheControl: cacheControl,
        })
      );

      const exists = await this.fileExists(cleanPath);
      if (!exists) {
        throw new Error('Uploaded object could not be verified in Cloudflare R2 storage.');
      }

      return {
        success: true,
        url: this.getFileUrl(cleanPath),
        destinationPath: cleanPath,
        sizeBytes: buffer.length,
        contentType,
        provider: 'r2',
      };
    } catch (err: any) {
      const status = getAwsErrorStatusCode(err);
      console.error('[STORAGE:R2] Upload failed:', status || err?.name || '', err?.message || err);
      if (status === 403 || status === 401) {
        return {
          success: false,
          url: '',
          destinationPath: cleanPath,
          provider: 'r2',
          statusCode: 403,
          error: 'Cloudflare R2 permission denied. Verify R2 API token write permissions on the configured bucket.',
        };
      }
      return {
        success: false,
        url: '',
        destinationPath: cleanPath,
        provider: 'r2',
        statusCode: 502,
        error: 'Cloudflare R2 upload failed. Verify R2 credentials, endpoint, bucket permissions, and network availability.',
      };
    }
  }

  public async getFile(destinationPath: string): Promise<RetrieveFileResult> {
    if (!this.config.valid || !this.s3Client) {
      return {
        success: false,
        statusCode: 503,
        error: this.config.error || 'Cloudflare R2 storage is not properly configured.',
      };
    }

    try {
      const cleanPath = sanitizeRelativeStoragePath(destinationPath);
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.config.bucketName,
          Key: cleanPath,
        })
      );
      const buffer = await s3BodyToBuffer(response.Body);
      return {
        success: true,
        buffer,
        contentType: response.ContentType || guessContentTypeFromPath(cleanPath),
        sizeBytes: buffer.length,
        statusCode: 200,
      };
    } catch (err: any) {
      const status = getAwsErrorStatusCode(err);
      console.error('[STORAGE:R2] File retrieval failed:', status || err?.name || '', err?.message || err);
      if (status === 404) {
        return {
          success: false,
          statusCode: 404,
          error: 'File not found in Cloudflare R2 storage.',
        };
      }
      if (status === 403 || status === 401) {
        return {
          success: false,
          statusCode: 403,
          error: 'Cloudflare R2 permission denied while retrieving file.',
        };
      }
      return {
        success: false,
        statusCode: 502,
        error: 'Failed to retrieve file from Cloudflare R2 storage.',
      };
    }
  }

  public async deleteFile(destinationPath: string): Promise<boolean> {
    if (!this.config.valid || !this.s3Client) {
      return false;
    }

    try {
      const cleanPath = sanitizeRelativeStoragePath(destinationPath);
      const exists = await this.fileExists(cleanPath);
      if (!exists) return false;

      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucketName,
          Key: cleanPath,
        })
      );
      return true;
    } catch (err: any) {
      const status = getAwsErrorStatusCode(err);
      console.error('[STORAGE:R2] File deletion failed:', status || err?.name || '', err?.message || err);
      return false;
    }
  }

  public getFileUrl(destinationPath: string): string {
    const cleanPath = sanitizeRelativeStoragePath(destinationPath);
    const encoded = cleanPath.split('/').map(encodeURIComponent).join('/');
    return `${this.config.publicBaseUrl}/${encoded}`;
  }

  public async fileExists(destinationPath: string): Promise<boolean> {
    if (!this.config.valid || !this.s3Client) {
      return false;
    }

    try {
      const cleanPath = sanitizeRelativeStoragePath(destinationPath);
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucketName,
          Key: cleanPath,
        })
      );
      return true;
    } catch (err: any) {
      const status = getAwsErrorStatusCode(err);
      if (status !== 404) {
        console.error('[STORAGE:R2] Existence check failed:', status || err?.name || '', err?.message || err);
      }
      return false;
    }
  }

  public resolveManagedStorageKey(url: string): string | null {
    if (!this.config.valid || !this.config.publicBaseUrl) {
      return null;
    }
    return extractKeyFromHttpBaseUrl(url, this.config.publicBaseUrl);
  }
}

// Global Singleton Storage Provider Factory
let activeStorageAdapter: StorageAdapter | null = null;
let activeProviderKey: StorageProviderName | null = null;

export function getConfiguredStorageProvider(): StorageProviderName {
  const provider = String(process.env.STORAGE_PROVIDER || 'local').toLowerCase().trim();
  if (provider === 'gcs' || provider === 'google' || provider === 'google-cloud-storage') {
    return 'gcs';
  }
  if (provider === 'r2' || provider === 'cloudflare-r2') {
    return 'r2';
  }
  return 'local';
}

export function resetStorageAdapterForTests(): void {
  activeStorageAdapter = null;
  activeProviderKey = null;
}

export function setStorageAdapterForTests(adapter: StorageAdapter | null): void {
  activeStorageAdapter = adapter;
  activeProviderKey = adapter ? adapter.providerName : null;
}

export function getStorageAdapter(): StorageAdapter {
  const provider = getConfiguredStorageProvider();

  if (activeStorageAdapter && activeProviderKey === provider) {
    return activeStorageAdapter;
  }

  activeProviderKey = provider;
  if (provider === 'gcs') {
    const gcsAdapter = new GoogleCloudStorageAdapter();
    activeStorageAdapter = gcsAdapter;
    const status = gcsAdapter.getConfigStatus();
    if (status.configured) {
      console.log(`[STORAGE] Initialized GoogleCloudStorageAdapter (bucket=${status.bucketName}).`);
    } else {
      console.warn(`[STORAGE] GoogleCloudStorageAdapter selected via STORAGE_PROVIDER=gcs, but configuration is incomplete: ${status.error}`);
    }
  } else if (provider === 'r2') {
    const r2Adapter = new CloudflareR2StorageAdapter();
    activeStorageAdapter = r2Adapter;
    const status = r2Adapter.getConfigStatus();
    if (status.configured) {
      console.log(`[STORAGE] Initialized CloudflareR2StorageAdapter (bucket=${status.bucketName}).`);
    } else {
      console.warn(`[STORAGE] CloudflareR2StorageAdapter selected via STORAGE_PROVIDER=r2, but configuration is incomplete: ${status.error}`);
    }
  } else {
    activeStorageAdapter = new LocalStorageAdapter();
    console.log('[STORAGE] Initialized LocalStorageAdapter (Provider: Local).');
  }

  return activeStorageAdapter;
}
