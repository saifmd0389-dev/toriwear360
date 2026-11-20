/**
 * TORIWEAR Enterprise Cloud & Local Storage Abstraction
 *
 * Supports:
 * 1. LocalStorageAdapter (Default / local disk persistence under public/generated-assets)
 * 2. GoogleCloudStorageAdapter (Official @google-cloud/storage SDK for production cloud storage)
 *
 * Security & Reliability Rules:
 * - Credentials are read strictly from private server-side environment variables.
 * - Never exposes service-account keys or internal storage secrets to clients.
 * - Does NOT activate GCS unless STORAGE_PROVIDER="gcs" (or "google") is explicitly configured.
 * - When GCS is enabled, never silently falls back to local disk on misconfiguration or upload failure.
 */

import fs from 'fs';
import path from 'path';
import { Storage, Bucket } from '@google-cloud/storage';

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
  provider?: 'local' | 'gcs';
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
  provider: 'local' | 'gcs';
  configured: boolean;
  bucketName?: string;
  publicBaseUrl?: string;
  error?: string;
}

export interface StorageAdapter {
  readonly providerName: 'local' | 'gcs';
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
}

// Global Singleton Storage Provider Factory
let activeStorageAdapter: StorageAdapter | null = null;
let activeProviderKey: string | null = null;

export function getConfiguredStorageProvider(): 'local' | 'gcs' {
  const provider = String(process.env.STORAGE_PROVIDER || 'local').toLowerCase().trim();
  if (provider === 'gcs' || provider === 'google' || provider === 'google-cloud-storage') {
    return 'gcs';
  }
  return 'local';
}

export function resetStorageAdapterForTests(): void {
  activeStorageAdapter = null;
  activeProviderKey = null;
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
  } else {
    activeStorageAdapter = new LocalStorageAdapter();
    console.log('[STORAGE] Initialized LocalStorageAdapter (Provider: Local).');
  }

  return activeStorageAdapter;
}
