/**
 * TORIWEAR Enterprise Cloud & Local Storage Abstraction
 * 
 * Supports:
 * 1. LocalStorageAdapter (Development / local persistence)
 * 2. GoogleCloudStorageAdapter (Production zero-cost Google Cloud Storage integration)
 */

import fs from 'fs';
import path from 'path';

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

  public async uploadFile(
    buffer: Buffer,
    destinationPath: string,
    _contentType?: string
  ): Promise<UploadResult> {
    try {
      const cleanRelative = destinationPath.replace(/^\/+/, '');
      const fullPath = path.join(this.baseDir, cleanRelative);
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
      const fullPath = path.join(this.baseDir, cleanRelative);
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
    const cleanRelative = destinationPath.replace(/^\/+/, '');
    return `${this.publicPrefix}/${cleanRelative}`;
  }

  public async fileExists(destinationPath: string): Promise<boolean> {
    const cleanRelative = destinationPath.replace(/^\/+/, '');
    const fullPath = path.join(this.baseDir, cleanRelative);
    return fs.existsSync(fullPath);
  }
}

/**
 * Google Cloud Storage adapter for persistent production hosting
 * Compatible with Google Cloud Always Free tier (5 GB storage per month)
 */
export class GoogleCloudStorageAdapter implements StorageAdapter {
  private bucketName: string;
  private publicBaseUrl: string;

  constructor(bucketName?: string) {
    this.bucketName = bucketName || process.env.GCS_BUCKET_NAME || 'toriwear-media-storage';
    this.publicBaseUrl = process.env.GCS_PUBLIC_URL_PREFIX || `https://storage.googleapis.com/${this.bucketName}`;
  }

  public async uploadFile(
    _buffer: Buffer,
    destinationPath: string,
    _contentType: string = 'application/octet-stream'
  ): Promise<UploadResult> {
    // Do not claim an upload succeeded: this adapter currently has no GCS SDK/client.
    return {
      success: false,
      url: '',
      destinationPath: destinationPath.replace(/^\/+/, ''),
      error: 'Google Cloud Storage is not implemented. Configure a real storage client before enabling this provider.',
    };
  }

  public async deleteFile(_destinationPath: string): Promise<boolean> {
    return false;
  }

  public getFileUrl(destinationPath: string): string {
    const cleanPath = destinationPath.replace(/^\/+/, '');
    return `${this.publicBaseUrl}/${cleanPath}`;
  }

  public async fileExists(_destinationPath: string): Promise<boolean> {
    return false;
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
    activeStorageAdapter = new LocalStorageAdapter();
    console.log('[STORAGE] Initialized LocalStorageAdapter (Provider: Local).');
  }

  return activeStorageAdapter;
}
