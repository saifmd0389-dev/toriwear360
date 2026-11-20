/**
 * TORIWEAR Server-Side Image Validation & Optimization Service (Sharp)
 *
 * - Validates real file content (not just filename extensions or client MIME headers).
 * - Enforces safe upload size and pixel-dimension limits.
 * - Converts supported static raster images (JPEG, PNG, WebP, AVIF, static GIF) to WebP.
 * - Resizes oversized images without enlarging smaller images, preserving aspect ratio & EXIF orientation.
 * - Preserves animated GIFs and clean SVG files untouched without damaging them.
 */

import sharp, { type Metadata } from 'sharp';

export const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB safe default for chunked uploads
export const DEFAULT_REGULAR_MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB for JSON Data URL uploads
export const DEFAULT_MAX_DIMENSION = 2048; // Max width or height in px (no upscaling)
export const DEFAULT_WEBP_QUALITY = 82;
const MAX_INPUT_PIXELS = 64_000_000; // ~8000x8000 safe Sharp decompression limit

export class ImageValidationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = 'INVALID_IMAGE') {
    super(message);
    this.name = 'ImageValidationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface OptimizeImageOptions {
  filename?: string;
  mimeType?: string;
  maxBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  webpQuality?: number;
}

export interface OptimizedImageResult {
  buffer: Buffer;
  contentType: string;
  extension: string;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  width?: number;
  height?: number;
  optimized: boolean;
  preservedOriginal: boolean;
  sourceFormat: string;
}

const SUPPORTED_RASTER_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'gif']);

export function getConfiguredMaxUploadBytes(fallback: number = DEFAULT_MAX_UPLOAD_BYTES): number {
  const raw = Number(process.env.MAX_IMAGE_UPLOAD_BYTES);
  if (Number.isFinite(raw) && raw >= 1024 * 1024 && raw <= 100 * 1024 * 1024) {
    return Math.floor(raw);
  }
  return fallback;
}

function isLikelySvgBuffer(buffer: Buffer, filename?: string, mimeType?: string): boolean {
  const mimeLower = String(mimeType || '').toLowerCase();
  const extLower = String(filename || '').toLowerCase();
  const headText = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8').trimStart();
  const hasSvgTag = /<svg[\s>]/i.test(headText);
  if (hasSvgTag) return true;
  if (mimeLower.includes('svg') || extLower.endsWith('.svg')) {
    return /<svg[\s>]/i.test(buffer.toString('utf8'));
  }
  return false;
}

function validateSafeSvg(buffer: Buffer): void {
  // Reject binary null bytes masquerading as SVG
  if (buffer.includes(0)) {
    throw new ImageValidationError('Uploaded SVG file contains invalid binary data.', 400, 'INVALID_SVG');
  }
  const text = buffer.toString('utf8');
  if (!/<svg[\s>]/i.test(text) || !/<\/svg>/i.test(text)) {
    throw new ImageValidationError('Uploaded SVG file is malformed or incomplete.', 400, 'INVALID_SVG');
  }
  // Reject embedded scripts or inline JS handlers
  if (
    /<script[\s>]/i.test(text) ||
    /javascript\s*:/i.test(text) ||
    /\bon[a-z]+\s*=/i.test(text) ||
    /<foreignObject[\s>]/i.test(text)
  ) {
    throw new ImageValidationError(
      'Uploaded SVG contains disallowed active scripting elements.',
      400,
      'UNSAFE_SVG'
    );
  }
}

/**
 * Validates and optimizes an uploaded image buffer for persistent storage.
 * Throws ImageValidationError with an appropriate HTTP status code (400 / 413) on invalid inputs.
 */
export async function optimizeImageForStorage(
  inputBuffer: Buffer,
  options: OptimizeImageOptions = {}
): Promise<OptimizedImageResult> {
  if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    throw new ImageValidationError('Uploaded image file is empty.', 400, 'EMPTY_IMAGE');
  }

  const maxBytes = options.maxBytes ?? getConfiguredMaxUploadBytes();
  if (inputBuffer.length > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
    throw new ImageValidationError(
      `Image size exceeds the maximum allowed limit of ${maxMb} MB.`,
      413,
      'IMAGE_TOO_LARGE'
    );
  }

  const originalSizeBytes = inputBuffer.length;

  // 1. Preserve valid SVG artwork untouched (never rasterize vector graphics)
  if (isLikelySvgBuffer(inputBuffer, options.filename, options.mimeType)) {
    validateSafeSvg(inputBuffer);
    return {
      buffer: inputBuffer,
      contentType: 'image/svg+xml',
      extension: 'svg',
      originalSizeBytes,
      optimizedSizeBytes: inputBuffer.length,
      optimized: false,
      preservedOriginal: true,
      sourceFormat: 'svg',
    };
  }

  // 2. Inspect actual raster image binary using Sharp
  let metadata: Metadata;
  try {
    metadata = await sharp(inputBuffer, {
      animated: true,
      limitInputPixels: MAX_INPUT_PIXELS,
    }).metadata();
  } catch {
    throw new ImageValidationError(
      'Unsupported or corrupted image file. Allowed formats: JPEG, PNG, WebP, AVIF, GIF, SVG.',
      400,
      'UNSUPPORTED_IMAGE'
    );
  }

  const detectedFormat = String(metadata.format || '').toLowerCase();
  if (!SUPPORTED_RASTER_FORMATS.has(detectedFormat)) {
    throw new ImageValidationError(
      `Unsupported image format "${detectedFormat || 'unknown'}". Allowed formats: JPEG, PNG, WebP, AVIF, GIF, SVG.`,
      400,
      'UNSUPPORTED_IMAGE'
    );
  }

  // 3. Preserve animated GIFs untouched so frame timing & animations are never damaged
  if (detectedFormat === 'gif' && (metadata.pages ?? 1) > 1) {
    return {
      buffer: inputBuffer,
      contentType: 'image/gif',
      extension: 'gif',
      originalSizeBytes,
      optimizedSizeBytes: inputBuffer.length,
      width: metadata.width,
      height: metadata.pageHeight || metadata.height,
      optimized: false,
      preservedOriginal: true,
      sourceFormat: 'gif',
    };
  }

  // 4. Optimize supported static raster images (JPEG, PNG, WebP, AVIF, static GIF) -> WebP
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_DIMENSION;
  const maxHeight = options.maxHeight ?? DEFAULT_MAX_DIMENSION;
  const quality = options.webpQuality ?? DEFAULT_WEBP_QUALITY;

  try {
    const pipeline = sharp(inputBuffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate() // Applies EXIF orientation cleanly & prevents rotated mobile photos
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality,
        effort: 4,
      });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      contentType: 'image/webp',
      extension: 'webp',
      originalSizeBytes,
      optimizedSizeBytes: data.length,
      width: info.width,
      height: info.height,
      optimized: true,
      preservedOriginal: false,
      sourceFormat: detectedFormat,
    };
  } catch (err: any) {
    throw new ImageValidationError(
      err?.message ? `Failed to process image: ${err.message}` : 'Failed to process uploaded image.',
      400,
      'IMAGE_PROCESSING_FAILED'
    );
  }
}
