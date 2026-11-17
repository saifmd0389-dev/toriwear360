/**
 * TORIWEAR Enterprise Cloud & Local Storage Abstraction
 * 
 * Supports:
 * 1. LocalStorageAdapter (Development / local persistence)
 * 2. GoogleCloudStorageAdapter (Production persistent Google Cloud Storage integration)
 */

import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';

export interface UploadResult {
  success: boolean;
  url: string;
  destinationPath: string;
  sizeBytes?: number;
  error?: string;
}

export interface StorageAdapter {
  uploadFile(
    buffer: Buffer,
    destinationPath: string,
    contentType?: string
  ): Promise<UploadResult>;
  deleteFile(destinationPath: string): Promise<boolean>;
  getFileUrl(destinationPath: string): string;
  fileExists(destinationPath: string): Promise<boolean>;
}

/**
 * Local filesystem storage adapter (used in local development and fallback)
 */
export class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;
  private publicPrefix: string;

  constructor(baseDir?: string, publicPrefix: string = '/assets') {
    this.baseDir = baseDir || path.resolve(process.cwd(), 'public', 'assets');
    this.publicPrefix = publicPrefix;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private safePath(destinationPath: string): string {
    const clean = String(destinationPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = clean.split('/');
    if (!clean || segments.some((part) => !part || part === '.' || part === '..')) throw new Error('Invalid storage destination path.');
    return path.resolve(this.baseDir, clean);
  }

  public async uploadFile(
    buffer: Buffer,
    destinationPath: string,
    _contentType?: string
  ): Promise<UploadResult> {
    try {
      const cleanRelative = destinationPath.replace(/^\/+/, '');
      const fullPath = this.safePath(cleanRelative);
      const parentDir = path.dirname(fullPath);

      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(fullPath, buffer);

      const url = `${this.publicPrefix}/${cleanRelative}`;
      return {
        success: true,
        url,
        destinationPath: cleanRelative,
        sizeBytes: buffer.length,
      };
    } catch (err: any) {
      return {
        success: false,
        url: '',
        destinationPath,
        error: err.message || 'Failed to write file locally.',
      };
    }
  }

  public async deleteFile(destinationPath: string): Promise<boolean> {
    try {
      const cleanRelative = destinationPath.replace(/^\/+/, '');
      const fullPath = this.safePath(cleanRelative);
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
    const cleanRelative = path.relative(this.baseDir, this.safePath(destinationPath)).split(path.sep).map(encodeURIComponent).join('/');
    return `${this.publicPrefix}/${cleanRelative}`;
  }

  public async fileExists(destinationPath: string): Promise<boolean> {
    try { return fs.existsSync(this.safePath(destinationPath)); } catch { return false; }
  }
}

/**
 * Google Cloud Storage adapter for persistent production hosting
 * Requires a configured GCS bucket and a service identity with object create/read/delete permissions.
 */
export class GoogleCloudStorageAdapter implements StorageAdapter {
  private bucketName: string;
  private publicBaseUrl: string;
  private storage: Storage;

  constructor(bucketName?: string) {
    this.bucketName = bucketName || process.env.GCS_BUCKET_NAME || '';
    if (!this.bucketName) throw new Error('GCS_BUCKET_NAME is required when STORAGE_PROVIDER=gcs.');
    const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCS_KEY_FILE;
    this.storage = new Storage({ projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT, ...(keyFilename ? { keyFilename } : {}) });
    this.publicBaseUrl = (process.env.GCS_PUBLIC_URL_PREFIX || `https://storage.googleapis.com/${this.bucketName}`).replace(/\/+$/, '');
  }

  private cleanPath(destinationPath: string): string {
    const clean = String(destinationPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = clean.split('/');
    if (!clean || segments.some((part) => !part || part === '.' || part === '..') || clean.length > 900) throw new Error('Invalid storage destination path.');
    return clean;
  }

  public async uploadFile(buffer: Buffer, destinationPath: string, contentType: string = 'application/octet-stream'): Promise<UploadResult> {
    const clean = this.cleanPath(destinationPath);
    try {
      if (process.env.GCS_OBJECTS_PUBLIC === 'false') throw new Error('This adapter returns public media URLs. Set GCS_OBJECTS_PUBLIC=true or implement a private signed-URL adapter.');
      const file = this.storage.bucket(this.bucketName).file(clean);
      await file.save(buffer, { resumable: false, validation: 'crc32c', metadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' } });
      if (process.env.GCS_OBJECTS_PUBLIC !== 'false') await file.makePublic();
      return { success: true, url: this.getFileUrl(clean), destinationPath: clean, sizeBytes: buffer.length };
    } catch (err: any) {
      return { success: false, url: '', destinationPath: clean, error: err?.message || 'Google Cloud Storage upload failed.' };
    }
  }

  public async deleteFile(destinationPath: string): Promise<boolean> {
    try { await this.storage.bucket(this.bucketName).file(this.cleanPath(destinationPath)).delete({ ignoreNotFound: true }); return true; } catch { return false; }
  }

  public getFileUrl(destinationPath: string): string {
    const clean = this.cleanPath(destinationPath).split('/').map(encodeURIComponent).join('/');
    return `${this.publicBaseUrl}/${clean}`;
  }

  public async fileExists(destinationPath: string): Promise<boolean> {
    try { const [exists] = await this.storage.bucket(this.bucketName).file(this.cleanPath(destinationPath)).exists(); return Boolean(exists); } catch { return false; }
  }
}

// Global Singleton Storage Provider Factory
let activeStorageAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (activeStorageAdapter) {
    return activeStorageAdapter;
  }

  const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase().trim();

  if (provider === 'gcs' || provider === 'google') {
    activeStorageAdapter = new GoogleCloudStorageAdapter();
    console.log('[STORAGE] Initialized GoogleCloudStorageAdapter (Provider: GCS).');
  } else {
    activeStorageAdapter = new LocalStorageAdapter(path.resolve(process.cwd(), 'public', 'generated-assets'), '/generated-assets');
    console.log('[STORAGE] Initialized LocalStorageAdapter (Provider: Local).');
  }

  return activeStorageAdapter;
}
