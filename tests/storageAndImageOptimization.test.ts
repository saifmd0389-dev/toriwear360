import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import sharp from 'sharp';
import {
  DEFAULT_MAX_DIMENSION,
  ImageValidationError,
  optimizeImageForStorage,
} from '../server/services/storage/imageOptimizer';
import {
  GoogleCloudStorageAdapter,
  IMMUTABLE_IMAGE_CACHE_CONTROL,
  LocalStorageAdapter,
  getStorageAdapter,
  resetStorageAdapterForTests,
} from '../server/services/storage/storageAdapter';
import {
  ChunkUploadError,
  ChunkUploadSessionManager,
  chunkUploadSessionManager,
} from '../server/services/storage/chunkUploadSessionManager';
import type { Storage } from '@google-cloud/storage';

async function createSampleRaster(
  format: 'jpeg' | 'png' | 'webp',
  width: number,
  height: number,
  options?: { orientation?: number }
): Promise<Buffer> {
  let img = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 220, g: 38, b: 38, alpha: 1 },
    },
  });
  if (options?.orientation) {
    img = img.withMetadata({ orientation: options.orientation });
  }
  if (format === 'jpeg') return img.jpeg({ quality: 92 }).toBuffer();
  if (format === 'png') return img.png().toBuffer();
  return img.webp({ quality: 90 }).toBuffer();
}

async function createAnimatedGif(): Promise<Buffer> {
  // 2 frames stacked vertically (16x16 each -> 16x32 with pageHeight 16)
  const frame1 = Buffer.alloc(16 * 16 * 4);
  const frame2 = Buffer.alloc(16 * 16 * 4);
  for (let i = 0; i < 16 * 16; i++) {
    frame1[i * 4] = 255;
    frame1[i * 4 + 3] = 255;
    frame2[i * 4 + 2] = 255;
    frame2[i * 4 + 3] = 255;
  }
  const combined = Buffer.concat([frame1, frame2]);
  return sharp(combined, {
    raw: { width: 16, height: 32, channels: 4, pageHeight: 16 },
  })
    .gif({ delay: [100, 100], loop: 0 })
    .toBuffer();
}

const SAMPLE_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect width="120" height="40" fill="#111"/><text x="12" y="25" fill="#fff">TORI</text></svg>',
  'utf8'
);

test('ImageOptimizer: converts oversized JPEG to WebP at 2560px max dimension, preserves aspect ratio & EXIF orientation', async () => {
  assert.equal(DEFAULT_MAX_DIMENSION, 2560);

  // 4000x2000 with EXIF orientation 6 (90 deg CW -> visual 2000x4000 -> resized inside 2560x2560 -> 1280x2560)
  const jpegBuf = await createSampleRaster('jpeg', 4000, 2000, { orientation: 6 });
  const result = await optimizeImageForStorage(jpegBuf, {
    filename: 'hero-banner.jpg',
    mimeType: 'image/jpeg',
  });

  assert.equal(result.contentType, 'image/webp');
  assert.equal(result.extension, 'webp');
  assert.equal(result.optimized, true);
  assert.equal(result.preservedOriginal, false);

  const outMeta = await sharp(result.buffer).metadata();
  assert.equal(outMeta.format, 'webp');
  assert.equal(outMeta.width, 1280);
  assert.equal(outMeta.height, 2560);

  // 2400x1600 is within the 2560px max dimension and must NOT be downscaled or upscaled
  const midResJpeg = await createSampleRaster('jpeg', 2400, 1600);
  const midRes = await optimizeImageForStorage(midResJpeg, {
    filename: 'banner-2400.jpg',
    mimeType: 'image/jpeg',
  });
  const midMeta = await sharp(midRes.buffer).metadata();
  assert.equal(midMeta.width, 2400);
  assert.equal(midMeta.height, 1600);
});

test('ImageOptimizer: converts small PNG & WebP to WebP without enlarging', async () => {
  const pngBuf = await createSampleRaster('png', 320, 240);
  const pngRes = await optimizeImageForStorage(pngBuf, {
    filename: 'thumb.png',
    mimeType: 'image/png',
  });
  assert.equal(pngRes.contentType, 'image/webp');
  assert.equal(pngRes.extension, 'webp');
  assert.equal(pngRes.width, 320);
  assert.equal(pngRes.height, 240);

  const webpBuf = await createSampleRaster('webp', 640, 480);
  const webpRes = await optimizeImageForStorage(webpBuf, {
    filename: 'product.webp',
    mimeType: 'image/webp',
  });
  assert.equal(webpRes.contentType, 'image/webp');
  assert.equal(webpRes.extension, 'webp');
  assert.equal(webpRes.width, 640);
  assert.equal(webpRes.height, 480);
});

test('ImageOptimizer: preserves animated GIFs and valid SVGs untouched; rejects unsafe SVG & spoofed files', async () => {
  const animGif = await createAnimatedGif();
  const gifMetaBefore = await sharp(animGif, { animated: true }).metadata();
  assert.equal(gifMetaBefore.pages, 2);

  const gifRes = await optimizeImageForStorage(animGif, {
    filename: 'drop-loop.gif',
    mimeType: 'image/gif',
  });
  assert.equal(gifRes.contentType, 'image/gif');
  assert.equal(gifRes.extension, 'gif');
  assert.equal(gifRes.preservedOriginal, true);
  assert.equal(Buffer.compare(gifRes.buffer, animGif), 0);

  const svgRes = await optimizeImageForStorage(SAMPLE_SVG, {
    filename: 'emblem.svg',
    mimeType: 'image/svg+xml',
  });
  assert.equal(svgRes.contentType, 'image/svg+xml');
  assert.equal(svgRes.extension, 'svg');
  assert.equal(svgRes.preservedOriginal, true);
  assert.equal(Buffer.compare(svgRes.buffer, SAMPLE_SVG), 0);

  // Unsafe SVG with script must be rejected
  const unsafeSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  await assert.rejects(
    () => optimizeImageForStorage(unsafeSvg, { filename: 'bad.svg', mimeType: 'image/svg+xml' }),
    (err: any) => err instanceof ImageValidationError && err.statusCode === 400
  );

  // Spoofed PNG containing plain text must be rejected
  await assert.rejects(
    () => optimizeImageForStorage(Buffer.from('not really a png'), { filename: 'fake.png', mimeType: 'image/png' }),
    (err: any) => err instanceof ImageValidationError && err.statusCode === 400
  );

  // Oversized image exceeding maxBytes must be rejected with 413
  await assert.rejects(
    () => optimizeImageForStorage(Buffer.alloc(2048, 1), { maxBytes: 1024 }),
    (err: any) => err instanceof ImageValidationError && err.statusCode === 413
  );
});

test('LocalStorageAdapter: supports upload, retrieval, existence checks, URL formatting, and deletion', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toriwear-local-storage-'));
  try {
    const adapter = new LocalStorageAdapter(tmpDir, '/generated-assets');
    const payload = await createSampleRaster('webp', 100, 100);

    const up = await adapter.uploadFile(payload, 'cms-test-unique.webp', 'image/webp');
    assert.equal(up.success, true);
    assert.equal(up.url, '/generated-assets/cms-test-unique.webp');
    assert.equal(up.contentType, 'image/webp');
    assert.equal(up.sizeBytes, payload.length);

    assert.equal(await adapter.fileExists('cms-test-unique.webp'), true);
    assert.equal(adapter.getFileUrl('cms-test-unique.webp'), '/generated-assets/cms-test-unique.webp');

    const retrieved = await adapter.getFile('cms-test-unique.webp');
    assert.equal(retrieved.success, true);
    assert.equal(retrieved.contentType, 'image/webp');
    assert.equal(Buffer.compare(retrieved.buffer!, payload), 0);

    assert.equal(await adapter.deleteFile('cms-test-unique.webp'), true);
    assert.equal(await adapter.fileExists('cms-test-unique.webp'), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('GoogleCloudStorageAdapter: fails closed when misconfigured and never falls back to local disk', async () => {
  const prevEnv = {
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
    GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
    GCS_SERVICE_ACCOUNT_JSON: process.env.GCS_SERVICE_ACCOUNT_JSON,
    GCS_CLIENT_EMAIL: process.env.GCS_CLIENT_EMAIL,
    GCS_PRIVATE_KEY: process.env.GCS_PRIVATE_KEY,
    GCS_PUBLIC_URL_PREFIX: process.env.GCS_PUBLIC_URL_PREFIX,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  };

  try {
    process.env.STORAGE_PROVIDER = 'gcs';
    delete process.env.GCS_BUCKET_NAME;
    delete process.env.GCS_SERVICE_ACCOUNT_JSON;
    delete process.env.GCS_CLIENT_EMAIL;
    delete process.env.GCS_PRIVATE_KEY;
    delete process.env.GCS_PUBLIC_URL_PREFIX;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    resetStorageAdapterForTests();

    const adapter = getStorageAdapter();
    assert.equal(adapter.providerName, 'gcs');
    assert.equal(adapter.getConfigStatus().configured, false);

    const payload = await createSampleRaster('png', 64, 64);
    const res = await adapter.uploadFile(payload, 'should-not-write.webp', 'image/webp');
    assert.equal(res.success, false);
    assert.equal(res.statusCode, 503);
    assert.ok(res.error && res.error.includes('GCS_BUCKET_NAME'));
    assert.equal(
      fs.existsSync(path.resolve(process.cwd(), 'public/generated-assets/should-not-write.webp')),
      false,
      'Failed GCS upload must NEVER silently write to local storage'
    );

    // Valid-looking bucket + malformed JSON credentials must also fail closed without leaking secrets
    process.env.GCS_BUCKET_NAME = 'toriwear-test-bucket';
    process.env.GCS_SERVICE_ACCOUNT_JSON = '{not-valid-json-secret}';
    const badJsonAdapter = new GoogleCloudStorageAdapter();
    assert.equal(badJsonAdapter.getConfigStatus().configured, false);
    assert.equal(badJsonAdapter.getConfigStatus().error?.includes('not-valid-json-secret'), false);
    assert.equal(
      badJsonAdapter.getFileUrl('cms-hero-123.webp'),
      'https://storage.googleapis.com/toriwear-test-bucket/cms-hero-123.webp'
    );

    // Custom HTTPS prefix formatting
    process.env.GCS_PUBLIC_URL_PREFIX = 'https://media.thetoriwearstore.in/';
    const customPrefixAdapter = new GoogleCloudStorageAdapter();
    assert.equal(
      customPrefixAdapter.getFileUrl('cms-hero-123.webp'),
      'https://media.thetoriwearstore.in/cms-hero-123.webp'
    );
  } finally {
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    resetStorageAdapterForTests();
  }
});

test('CMS Router HTTP endpoints: regular & chunked uploads optimize and serve WebP/GIF/SVG, and GCS misconfig fails closed', async () => {
  const { cmsRouter } = await import('../server/routes/cmsRouter');
  const { authStore } = await import('../server/authStore');
  const { userStore } = await import('../server/userStore');

  // Create a temporary in-memory admin session token for HTTP endpoint verification
  const adminUser = userStore.getAllUsers().find((u) => u.role === 'SUPER_ADMIN') || userStore.getAllUsers()[0]!;
  const session = (authStore as any).createSession(adminUser, { ip: '127.0.0.1', userAgent: 'node-test' });
  const authHeaders = { Authorization: `Bearer ${session.token}` };

  const app = express();
  app.use(express.json({ limit: '20mb' }));
  app.use('/api/v1/admin/cms', cmsRouter);
  app.use(
    '/generated-assets',
    express.static(path.resolve(process.cwd(), 'public/generated-assets'), {
      setHeaders: (res, filePath) => {
        if (/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );

  const server = await new Promise<http.Server>((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const createdFiles: string[] = [];

  const prevProvider = process.env.STORAGE_PROVIDER;
  const prevBucket = process.env.GCS_BUCKET_NAME;

  try {
    process.env.STORAGE_PROVIDER = 'local';
    resetStorageAdapterForTests();

    // 1. Regular Data URL upload (JPEG -> WebP)
    const jpegBuf = await createSampleRaster('jpeg', 800, 600);
    const regularRes = await fetch(`${baseUrl}/api/v1/admin/cms/upload-asset`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'lookbook-shot.jpg',
        dataUrl: `data:image/jpeg;base64,${jpegBuf.toString('base64')}`,
      }),
    });
    assert.equal(regularRes.status, 200);
    const regularJson: any = await regularRes.json();
    assert.equal(regularJson.success, true);
    assert.equal(regularJson.contentType, 'image/webp');
    assert.equal(regularJson.optimized, true);
    assert.match(regularJson.url, /^\/generated-assets\/cms-lookbook-shot-.*\.webp$/);
    createdFiles.push(path.basename(regularJson.url));

    // Verify served URL loads with WebP Content-Type and immutable Cache-Control
    const servedRegular = await fetch(`${baseUrl}${regularJson.url}`);
    assert.equal(servedRegular.status, 200);
    assert.match(String(servedRegular.headers.get('content-type')), /image\/webp/i);
    assert.equal(servedRegular.headers.get('cache-control'), 'public, max-age=31536000, immutable');

    // 2. Multi-chunk binary upload (PNG -> WebP, split into 2 chunks)
    const pngBuf = await createSampleRaster('png', 500, 500);
    const mid = Math.floor(pngBuf.length / 2);
    const uploadId = `testchunk_${Date.now()}`;

    const c0 = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${uploadId}&chunkIndex=0&totalChunks=2&filename=tee-front.png&mimeType=image/png`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(pngBuf.subarray(0, mid)),
      }
    );
    assert.equal(c0.status, 200);
    assert.equal((await c0.json() as any).completed, false);

    const c1 = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${uploadId}&chunkIndex=1&totalChunks=2&filename=tee-front.png&mimeType=image/png`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(pngBuf.subarray(mid)),
      }
    );
    assert.equal(c1.status, 200);
    const c1Json: any = await c1.json();
    assert.equal(c1Json.success, true);
    assert.equal(c1Json.completed, true);
    assert.equal(c1Json.contentType, 'image/webp');
    assert.match(c1Json.url, /^\/generated-assets\/cms-tee-front-.*\.webp$/);
    createdFiles.push(path.basename(c1Json.url));

    const servedChunked = await fetch(`${baseUrl}${c1Json.url}`);
    assert.equal(servedChunked.status, 200);
    assert.match(String(servedChunked.headers.get('content-type')), /image\/webp/i);

    // 3. Chunked upload of Animated GIF -> preserved as GIF
    const gifBuf = await createAnimatedGif();
    const gifRes = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=gif_${Date.now()}&chunkIndex=0&totalChunks=1&filename=anim.gif&mimeType=image/gif`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(gifBuf),
      }
    );
    assert.equal(gifRes.status, 200);
    const gifJson: any = await gifRes.json();
    assert.equal(gifJson.contentType, 'image/gif');
    assert.match(gifJson.url, /\.gif$/);
    createdFiles.push(path.basename(gifJson.url));

    // 4. Chunked upload of SVG -> preserved as SVG
    const svgRes = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=svg_${Date.now()}&chunkIndex=0&totalChunks=1&filename=mark.svg&mimeType=image/svg+xml`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(SAMPLE_SVG),
      }
    );
    assert.equal(svgRes.status, 200);
    const svgJson: any = await svgRes.json();
    assert.equal(svgJson.contentType, 'image/svg+xml');
    assert.match(svgJson.url, /\.svg$/);
    createdFiles.push(path.basename(svgJson.url));

    // 5. GCS mode without valid credentials -> fails closed with 503 on both endpoints
    process.env.STORAGE_PROVIDER = 'gcs';
    delete process.env.GCS_BUCKET_NAME;
    resetStorageAdapterForTests();

    const gcsRegFail = await fetch(`${baseUrl}/api/v1/admin/cms/upload-asset`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'should-fail.jpg',
        dataUrl: `data:image/jpeg;base64,${jpegBuf.toString('base64')}`,
      }),
    });
    assert.equal(gcsRegFail.status, 503);
    const gcsRegJson: any = await gcsRegFail.json();
    assert.equal(gcsRegJson.success, false);

    const gcsChunkFail = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=gcsfail_${Date.now()}&chunkIndex=0&totalChunks=1&filename=should-fail.png&mimeType=image/png`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(pngBuf),
      }
    );
    assert.equal(gcsChunkFail.status, 503);
    const gcsChunkJson: any = await gcsChunkFail.json();
    assert.equal(gcsChunkJson.success, false);
  } finally {
    if (prevProvider === undefined) delete process.env.STORAGE_PROVIDER;
    else process.env.STORAGE_PROVIDER = prevProvider;
    if (prevBucket === undefined) delete process.env.GCS_BUCKET_NAME;
    else process.env.GCS_BUCKET_NAME = prevBucket;
    resetStorageAdapterForTests();

    for (const fileName of createdFiles) {
      const p = path.resolve(process.cwd(), 'public/generated-assets', fileName);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('GoogleCloudStorageAdapter (mocked SDK): upload, retrieval, deletion, missing object (404), permission errors (403) & Uniform Bucket-Level Access (no makePublic)', async () => {
  const prevMakePublic = process.env.GCS_MAKE_PUBLIC;
  try {
    // Even if legacy GCS_MAKE_PUBLIC is set, Uniform Bucket-Level Access mode must NEVER invoke file.makePublic()
    process.env.GCS_MAKE_PUBLIC = 'true';

    const objects = new Map<string, { data: Buffer; metadata: Record<string, any> }>();
    const savedOptionsLog: Array<{ name: string; options: any }> = [];
    let makePublicCalled = false;
    let simulatePermissionDenied = false;

    const makeError = (code: number, message: string) => {
      const err: any = new Error(message);
      err.code = code;
      return err;
    };

    const mockStorageClient = {
      bucket: (_bucketName: string) => ({
        exists: async () => {
          if (simulatePermissionDenied) throw makeError(403, 'Permission denied on bucket');
          return [true];
        },
        file: (name: string) => ({
          save: async (buffer: Buffer, options: any) => {
            if (simulatePermissionDenied) throw makeError(403, 'storage.objects.create denied');
            savedOptionsLog.push({ name, options });
            objects.set(name, {
              data: Buffer.from(buffer),
              metadata: {
                contentType: options?.contentType || options?.metadata?.contentType,
                cacheControl: options?.metadata?.cacheControl,
              },
            });
          },
          makePublic: async () => {
            makePublicCalled = true;
            throw makeError(400, 'Cannot update ACLs when Uniform Bucket-Level Access is enabled.');
          },
          exists: async () => {
            if (simulatePermissionDenied) throw makeError(403, 'storage.objects.get denied');
            return [objects.has(name)];
          },
          download: async () => {
            if (simulatePermissionDenied) throw makeError(403, 'storage.objects.get denied');
            const obj = objects.get(name);
            if (!obj) throw makeError(404, 'No such object');
            return [Buffer.from(obj.data)];
          },
          getMetadata: async () => {
            if (simulatePermissionDenied) throw makeError(403, 'storage.objects.get denied');
            const obj = objects.get(name);
            if (!obj) throw makeError(404, 'No such object');
            return [obj.metadata];
          },
          delete: async () => {
            if (simulatePermissionDenied) throw makeError(403, 'storage.objects.delete denied');
            if (!objects.has(name)) throw makeError(404, 'No such object');
            objects.delete(name);
          },
        }),
      }),
    } as unknown as Storage;

    const adapter = new GoogleCloudStorageAdapter({
      bucketName: 'toriwear-public-media',
      storageClient: mockStorageClient,
    });

    assert.equal(adapter.getConfigStatus().configured, true);
    assert.deepEqual(await adapter.verifyBucketAccess(), { ok: true });

    // 1. Successful upload with Uniform Bucket-Level Access (no makePublic, no object ACL)
    const sampleWebp = await createSampleRaster('webp', 120, 120);
    const up = await adapter.uploadFile(sampleWebp, 'products/cms-drop-01.webp', 'image/webp');
    assert.equal(up.success, true);
    assert.equal(up.provider, 'gcs');
    assert.equal(up.url, 'https://storage.googleapis.com/toriwear-public-media/products/cms-drop-01.webp');
    assert.equal(up.contentType, 'image/webp');
    assert.equal(up.sizeBytes, sampleWebp.length);
    assert.equal(makePublicCalled, false, 'Legacy file.makePublic() must NEVER be called');
    assert.equal(savedOptionsLog.length, 1);
    assert.equal(savedOptionsLog[0].options.metadata.cacheControl, IMMUTABLE_IMAGE_CACHE_CONTROL);
    assert.equal(savedOptionsLog[0].options.predefinedAcl, undefined);

    // 2. Existence & Retrieval
    assert.equal(await adapter.fileExists('products/cms-drop-01.webp'), true);
    const retrieved = await adapter.getFile('products/cms-drop-01.webp');
    assert.equal(retrieved.success, true);
    assert.equal(retrieved.statusCode, 200);
    assert.equal(retrieved.contentType, 'image/webp');
    assert.equal(retrieved.sizeBytes, sampleWebp.length);
    assert.equal(Buffer.compare(retrieved.buffer!, sampleWebp), 0);

    // 3. Deletion & Missing Object (404)
    assert.equal(await adapter.deleteFile('products/cms-drop-01.webp'), true);
    assert.equal(await adapter.fileExists('products/cms-drop-01.webp'), false);
    assert.equal(await adapter.deleteFile('products/cms-drop-01.webp'), false);

    const missing = await adapter.getFile('products/does-not-exist.webp');
    assert.equal(missing.success, false);
    assert.equal(missing.statusCode, 404);

    // 4. Permission Denied (403) across upload, retrieval, deletion, and bucket check
    simulatePermissionDenied = true;
    const permUpload = await adapter.uploadFile(sampleWebp, 'products/forbidden.webp', 'image/webp');
    assert.equal(permUpload.success, false);
    assert.equal(permUpload.statusCode, 403);
    assert.match(String(permUpload.error), /permission denied/i);
    assert.equal(
      fs.existsSync(path.resolve(process.cwd(), 'public/generated-assets/products/forbidden.webp')),
      false
    );

    const permGet = await adapter.getFile('products/forbidden.webp');
    assert.equal(permGet.success, false);
    assert.equal(permGet.statusCode, 403);

    assert.equal(await adapter.deleteFile('products/forbidden.webp'), false);
    assert.equal(await adapter.fileExists('products/forbidden.webp'), false);
    const permBucket = await adapter.verifyBucketAccess();
    assert.equal(permBucket.ok, false);
  } finally {
    if (prevMakePublic === undefined) delete process.env.GCS_MAKE_PUBLIC;
    else process.env.GCS_MAKE_PUBLIC = prevMakePublic;
  }
});

test('ChunkUploadSessionManager: sequential uploads, duplicates, out-of-order, mismatched metadata, concurrent IDs, admin binding & cleanup', async () => {
  const tmpStagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toriwear-chunk-mgr-test-'));
  const manager = new ChunkUploadSessionManager({
    stagingDir: tmpStagingDir,
    ttlMs: 60_000,
    enablePeriodicSweep: false,
  });

  const listStagingFiles = () =>
    fs.existsSync(tmpStagingDir)
      ? fs.readdirSync(tmpStagingDir).filter((f) => f.startsWith('chunk-') && f.endsWith('.bin'))
      : [];

  try {
    // 1. Sequential 3-chunk upload succeeds and cleans up staging file immediately
    const payload = Buffer.from('chunk-0-part|chunk-1-part|chunk-2-part');
    const c0 = manager.appendChunk({
      ownerId: 'admin-1',
      uploadId: 'seq_upload_001',
      chunkIndex: 0,
      totalChunks: 3,
      filename: 'tee.png',
      mimeType: 'image/png',
      chunkBuffer: payload.subarray(0, 12),
      maxUploadBytes: 1024 * 1024,
    });
    assert.equal(c0.completed, false);
    assert.equal(listStagingFiles().length, 1);

    const c1 = manager.appendChunk({
      ownerId: 'admin-1',
      uploadId: 'seq_upload_001',
      chunkIndex: 1,
      totalChunks: 3,
      filename: 'tee.png',
      mimeType: 'image/png',
      chunkBuffer: payload.subarray(12, 25),
      maxUploadBytes: 1024 * 1024,
    });
    assert.equal(c1.completed, false);

    const c2 = manager.appendChunk({
      ownerId: 'admin-1',
      uploadId: 'seq_upload_001',
      chunkIndex: 2,
      totalChunks: 3,
      filename: 'tee.png',
      mimeType: 'image/png',
      chunkBuffer: payload.subarray(25),
      maxUploadBytes: 1024 * 1024,
    });
    assert.equal(c2.completed, true);
    assert.equal(Buffer.compare(c2.assembledBuffer!, payload), 0);
    assert.equal(listStagingFiles().length, 0);
    assert.equal(manager.getActiveSessionCount(), 0);

    // 2. Duplicate chunk 0 and duplicate chunk 1 are rejected with 409 & cleaned up
    manager.appendChunk({
      ownerId: 'admin-1',
      uploadId: 'dup_upload_001',
      chunkIndex: 0,
      totalChunks: 3,
      filename: 'dup.png',
      mimeType: 'image/png',
      chunkBuffer: Buffer.from('aaa'),
      maxUploadBytes: 1024 * 1024,
    });
    assert.throws(
      () =>
        manager.appendChunk({
          ownerId: 'admin-1',
          uploadId: 'dup_upload_001',
          chunkIndex: 0,
          totalChunks: 3,
          filename: 'dup.png',
          mimeType: 'image/png',
          chunkBuffer: Buffer.from('aaa'),
          maxUploadBytes: 1024 * 1024,
        }),
      (err: any) => err instanceof ChunkUploadError && err.statusCode === 409 && err.code === 'DUPLICATE_CHUNK'
    );
    assert.equal(listStagingFiles().length, 0);

    // Duplicate chunk 1 after chunk 1 already received
    manager.appendChunk({
      ownerId: 'admin-1',
      uploadId: 'dup_upload_002',
      chunkIndex: 0,
      totalChunks: 3,
      filename: 'dup2.png',
      mimeType: 'image/png',
      chunkBuffer: Buffer.from('aaa'),
      maxUploadBytes: 1024 * 1024,
    });
    manager.appendChunk({
      ownerId: 'admin-1',
      uploadId: 'dup_upload_002',
      chunkIndex: 1,
      totalChunks: 3,
      filename: 'dup2.png',
      mimeType: 'image/png',
      chunkBuffer: Buffer.from('bbb'),
      maxUploadBytes: 1024 * 1024,
    });
    assert.throws(
      () =>
        manager.appendChunk({
          ownerId: 'admin-1',
          uploadId: 'dup_upload_002',
          chunkIndex: 1,
          totalChunks: 3,
          filename: 'dup2.png',
          mimeType: 'image/png',
          chunkBuffer: Buffer.from('bbb'),
          maxUploadBytes: 1024 * 1024,
        }),
      (err: any) => err instanceof ChunkUploadError && err.statusCode === 409 && err.code === 'DUPLICATE_CHUNK'
    );
    assert.equal(listStagingFiles().length, 0);

    // 3. Out-of-order chunks rejected & cleaned up
    assert.throws(
      () =>
        manager.appendChunk({
          ownerId: 'admin-1',
          uploadId: 'ooo_upload_001',
          chunkIndex: 1,
          totalChunks: 2,
          filename: 'ooo.png',
          mimeType: 'image/png',
          chunkBuffer: Buffer.from('bbb'),
          maxUploadBytes: 1024 * 1024,
        }),
      (err: any) => err instanceof ChunkUploadError && err.statusCode === 400
    );

    manager.appendChunk({
      ownerId: 'admin-1',
      uploadId: 'ooo_upload_002',
      chunkIndex: 0,
      totalChunks: 3,
      filename: 'ooo2.png',
      mimeType: 'image/png',
      chunkBuffer: Buffer.from('aaa'),
      maxUploadBytes: 1024 * 1024,
    });
    assert.throws(
      () =>
        manager.appendChunk({
          ownerId: 'admin-1',
          uploadId: 'ooo_upload_002',
          chunkIndex: 2,
          totalChunks: 3,
          filename: 'ooo2.png',
          mimeType: 'image/png',
          chunkBuffer: Buffer.from('ccc'),
          maxUploadBytes: 1024 * 1024,
        }),
      (err: any) => err instanceof ChunkUploadError && err.statusCode === 400 && err.code === 'OUT_OF_ORDER_CHUNK'
    );
    assert.equal(listStagingFiles().length, 0);

    // 4. Mismatched totalChunks, filename, and mimeType rejected & cleaned up
    for (const mismatch of [
      { field: 'totalChunks', totalChunks: 3, filename: 'same.png', mimeType: 'image/png', code: 'INCONSISTENT_TOTAL_CHUNKS' },
      { field: 'filename', totalChunks: 2, filename: 'different.png', mimeType: 'image/png', code: 'INCONSISTENT_FILENAME' },
      { field: 'mimeType', totalChunks: 2, filename: 'same.png', mimeType: 'image/jpeg', code: 'INCONSISTENT_MIME_TYPE' },
    ]) {
      const uid = `mismatch_${mismatch.field}_001`;
      manager.appendChunk({
        ownerId: 'admin-1',
        uploadId: uid,
        chunkIndex: 0,
        totalChunks: 2,
        filename: 'same.png',
        mimeType: 'image/png',
        chunkBuffer: Buffer.from('part0'),
        maxUploadBytes: 1024 * 1024,
      });
      assert.throws(
        () =>
          manager.appendChunk({
            ownerId: 'admin-1',
            uploadId: uid,
            chunkIndex: 1,
            totalChunks: mismatch.totalChunks,
            filename: mismatch.filename,
            mimeType: mismatch.mimeType,
            chunkBuffer: Buffer.from('part1'),
            maxUploadBytes: 1024 * 1024,
          }),
        (err: any) => err instanceof ChunkUploadError && err.statusCode === 400 && err.code === mismatch.code
      );
      assert.equal(listStagingFiles().length, 0);
    }

    // 5. Concurrent upload IDs (both distinct IDs and same ID across different admins) never collide
    const sharedUploadId = 'concurrent_shared_id_01';
    const a0 = manager.appendChunk({
      ownerId: 'admin-A',
      uploadId: sharedUploadId,
      chunkIndex: 0,
      totalChunks: 2,
      filename: 'alpha.png',
      mimeType: 'image/png',
      chunkBuffer: Buffer.from('ALPHA-0|'),
      maxUploadBytes: 1024 * 1024,
    });
    const b0 = manager.appendChunk({
      ownerId: 'admin-B',
      uploadId: sharedUploadId,
      chunkIndex: 0,
      totalChunks: 2,
      filename: 'beta.png',
      mimeType: 'image/png',
      chunkBuffer: Buffer.from('BETA-0|'),
      maxUploadBytes: 1024 * 1024,
    });
    assert.notEqual(a0.tmpFilePath, b0.tmpFilePath, 'Concurrent sessions must use isolated staging files');
    assert.equal(listStagingFiles().length, 2);

    // Admin C trying to append chunk 1 to sharedUploadId (owned by A & B) must be forbidden (403) without harming A or B
    assert.throws(
      () =>
        manager.appendChunk({
          ownerId: 'admin-C',
          uploadId: sharedUploadId,
          chunkIndex: 1,
          totalChunks: 2,
          filename: 'alpha.png',
          mimeType: 'image/png',
          chunkBuffer: Buffer.from('HIJACK'),
          maxUploadBytes: 1024 * 1024,
        }),
      (err: any) => err instanceof ChunkUploadError && err.statusCode === 403 && err.code === 'UPLOAD_SESSION_FORBIDDEN'
    );

    const a1 = manager.appendChunk({
      ownerId: 'admin-A',
      uploadId: sharedUploadId,
      chunkIndex: 1,
      totalChunks: 2,
      filename: 'alpha.png',
      mimeType: 'image/png',
      chunkBuffer: Buffer.from('ALPHA-1'),
      maxUploadBytes: 1024 * 1024,
    });
    const b1 = manager.appendChunk({
      ownerId: 'admin-B',
      uploadId: sharedUploadId,
      chunkIndex: 1,
      totalChunks: 2,
      filename: 'beta.png',
      mimeType: 'image/png',
      chunkBuffer: Buffer.from('BETA-1'),
      maxUploadBytes: 1024 * 1024,
    });
    assert.equal(a1.assembledBuffer!.toString('utf8'), 'ALPHA-0|ALPHA-1');
    assert.equal(b1.assembledBuffer!.toString('utf8'), 'BETA-0|BETA-1');
    assert.equal(listStagingFiles().length, 0);

    // 6. Expiration & maxUploadBytes failure cleanup
    manager.appendChunk({
      ownerId: 'admin-1',
      uploadId: 'oversize_upload_01',
      chunkIndex: 0,
      totalChunks: 2,
      filename: 'big.png',
      mimeType: 'image/png',
      chunkBuffer: Buffer.alloc(600, 1),
      maxUploadBytes: 1000,
    });
    assert.throws(
      () =>
        manager.appendChunk({
          ownerId: 'admin-1',
          uploadId: 'oversize_upload_01',
          chunkIndex: 1,
          totalChunks: 2,
          filename: 'big.png',
          mimeType: 'image/png',
          chunkBuffer: Buffer.alloc(500, 2),
          maxUploadBytes: 1000,
        }),
      (err: any) => err instanceof ChunkUploadError && err.statusCode === 413 && err.code === 'UPLOAD_TOO_LARGE'
    );
    assert.equal(listStagingFiles().length, 0);

    manager.setTtlMsForTests(5);
    manager.appendChunk({
      ownerId: 'admin-1',
      uploadId: 'expire_upload_01',
      chunkIndex: 0,
      totalChunks: 2,
      filename: 'exp.png',
      mimeType: 'image/png',
      chunkBuffer: Buffer.from('temp'),
      maxUploadBytes: 1024 * 1024,
    });
    assert.equal(listStagingFiles().length, 1);
    await new Promise((r) => setTimeout(r, 20));
    const swept = manager.sweepExpiredSessions();
    assert.equal(swept, 1);
    assert.equal(listStagingFiles().length, 0);
  } finally {
    manager.clearAllSessions();
    fs.rmSync(tmpStagingDir, { recursive: true, force: true });
  }
});

test('CMS Router HTTP chunked upload hardening: sequential, duplicate, out-of-order, mismatched totalChunks, concurrent IDs, admin binding & cleanup after failure', async () => {
  const { cmsRouter } = await import('../server/routes/cmsRouter');
  const { authStore } = await import('../server/authStore');
  const { userStore } = await import('../server/userStore');

  const users = userStore.getAllUsers();
  const adminA = users.find((u) => u.role === 'SUPER_ADMIN') || users[0]!;
  const adminB = users.find((u) => u.id !== adminA.id && String(u.role) !== 'CUSTOMER') || {
    ...adminA,
    id: `${adminA.id}_second_admin`,
    email: 'second-admin@thetoriwearstore.in',
  };

  const sessionA = (authStore as any).createSession(adminA, { ip: '127.0.0.1', userAgent: 'node-test-A' });
  const sessionB = (authStore as any).createSession(adminB, { ip: '127.0.0.1', userAgent: 'node-test-B' });
  const headersA = { Authorization: `Bearer ${sessionA.token}`, 'Content-Type': 'application/octet-stream' };
  const headersB = { Authorization: `Bearer ${sessionB.token}`, 'Content-Type': 'application/octet-stream' };

  const app = express();
  app.use(express.json({ limit: '20mb' }));
  app.use('/api/v1/admin/cms', cmsRouter);

  const server = await new Promise<http.Server>((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const createdFiles: string[] = [];
  const prevProvider = process.env.STORAGE_PROVIDER;

  const listStagingFiles = () => {
    const dir = chunkUploadSessionManager.getStagingDir();
    return fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => f.startsWith('chunk-') && f.endsWith('.bin'))
      : [];
  };

  try {
    process.env.STORAGE_PROVIDER = 'local';
    resetStorageAdapterForTests();
    chunkUploadSessionManager.clearAllSessions();

    const imgA = await createSampleRaster('png', 240, 240);
    const imgB = await createSampleRaster('jpeg', 300, 180);

    // 1. Concurrent upload IDs (two different IDs interleaved by Admin A + same ID by Admin B)
    const uid1 = `http_conc_1_${Date.now()}`;
    const uid2 = `http_conc_2_${Date.now()}`;
    const midA = Math.floor(imgA.length / 2);
    const midB = Math.floor(imgB.length / 2);

    const r1c0 = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${uid1}&chunkIndex=0&totalChunks=2&filename=front.png&mimeType=image/png`,
      { method: 'POST', headers: headersA, body: new Uint8Array(imgA.subarray(0, midA)) }
    );
    assert.equal(r1c0.status, 200);

    // Admin B starts concurrent session using the EXACT same uploadId (isolated by admin identity & unique temp file)
    const rBc0 = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${uid1}&chunkIndex=0&totalChunks=2&filename=back.jpg&mimeType=image/jpeg`,
      { method: 'POST', headers: headersB, body: new Uint8Array(imgB.subarray(0, midB)) }
    );
    assert.equal(rBc0.status, 200);

    // Admin A starts second concurrent upload with uid2
    const r2c0 = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${uid2}&chunkIndex=0&totalChunks=2&filename=detail.jpg&mimeType=image/jpeg`,
      { method: 'POST', headers: headersA, body: new Uint8Array(imgB.subarray(0, midB)) }
    );
    assert.equal(r2c0.status, 200);

    // Admin B attempts to append chunk 1 to Admin A's uid2 -> rejected with 403 Forbidden
    const hijackRes = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${uid2}&chunkIndex=1&totalChunks=2&filename=detail.jpg&mimeType=image/jpeg`,
      { method: 'POST', headers: headersB, body: new Uint8Array(imgB.subarray(midB)) }
    );
    assert.equal(hijackRes.status, 403);

    // Finish all 3 legitimate concurrent sessions cleanly
    const [r1c1, rBc1, r2c1] = await Promise.all([
      fetch(
        `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${uid1}&chunkIndex=1&totalChunks=2&filename=front.png&mimeType=image/png`,
        { method: 'POST', headers: headersA, body: new Uint8Array(imgA.subarray(midA)) }
      ),
      fetch(
        `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${uid1}&chunkIndex=1&totalChunks=2&filename=back.jpg&mimeType=image/jpeg`,
        { method: 'POST', headers: headersB, body: new Uint8Array(imgB.subarray(midB)) }
      ),
      fetch(
        `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${uid2}&chunkIndex=1&totalChunks=2&filename=detail.jpg&mimeType=image/jpeg`,
        { method: 'POST', headers: headersA, body: new Uint8Array(imgB.subarray(midB)) }
      ),
    ]);
    for (const res of [r1c1, rBc1, r2c1]) {
      assert.equal(res.status, 200);
      const j: any = await res.json();
      assert.equal(j.success, true);
      assert.equal(j.completed, true);
      assert.equal(j.contentType, 'image/webp');
      createdFiles.push(path.basename(j.url));
    }
    assert.equal(chunkUploadSessionManager.getActiveSessionCount(), 0);

    // 2. Duplicate chunk via HTTP returns 409 and cleans up temp file
    const dupId = `http_dup_${Date.now()}`;
    const d0 = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${dupId}&chunkIndex=0&totalChunks=2&filename=dup.png&mimeType=image/png`,
      { method: 'POST', headers: headersA, body: new Uint8Array(imgA.subarray(0, midA)) }
    );
    assert.equal(d0.status, 200);
    const d0Again = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${dupId}&chunkIndex=0&totalChunks=2&filename=dup.png&mimeType=image/png`,
      { method: 'POST', headers: headersA, body: new Uint8Array(imgA.subarray(0, midA)) }
    );
    assert.equal(d0Again.status, 409);
    assert.equal(chunkUploadSessionManager.getActiveSessionCount(), 0);

    // 3. Out-of-order chunk via HTTP returns 400 and cleans up temp file
    const oooId = `http_ooo_${Date.now()}`;
    const o0 = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${oooId}&chunkIndex=0&totalChunks=3&filename=ooo.png&mimeType=image/png`,
      { method: 'POST', headers: headersA, body: new Uint8Array(imgA.subarray(0, 100)) }
    );
    assert.equal(o0.status, 200);
    const o2 = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${oooId}&chunkIndex=2&totalChunks=3&filename=ooo.png&mimeType=image/png`,
      { method: 'POST', headers: headersA, body: new Uint8Array(imgA.subarray(100, 200)) }
    );
    assert.equal(o2.status, 400);
    assert.equal(chunkUploadSessionManager.getActiveSessionCount(), 0);

    // 4. Mismatched totalChunks via HTTP returns 400 and cleans up temp file
    const misId = `http_mis_${Date.now()}`;
    const m0 = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${misId}&chunkIndex=0&totalChunks=2&filename=mis.png&mimeType=image/png`,
      { method: 'POST', headers: headersA, body: new Uint8Array(imgA.subarray(0, midA)) }
    );
    assert.equal(m0.status, 200);
    const m1 = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${misId}&chunkIndex=1&totalChunks=3&filename=mis.png&mimeType=image/png`,
      { method: 'POST', headers: headersA, body: new Uint8Array(imgA.subarray(midA)) }
    );
    assert.equal(m1.status, 400);
    assert.equal(chunkUploadSessionManager.getActiveSessionCount(), 0);

    // 5. Cleanup after finalization failure (corrupted/spoofed image payload -> 400 & zero temp files left)
    const beforeFailureFiles = listStagingFiles().length;
    const corruptId = `http_corrupt_${Date.now()}`;
    const bad0 = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${corruptId}&chunkIndex=0&totalChunks=2&filename=fake.png&mimeType=image/png`,
      { method: 'POST', headers: headersA, body: new Uint8Array(Buffer.from('not-a-valid-')) }
    );
    assert.equal(bad0.status, 200);
    const bad1 = await fetch(
      `${baseUrl}/api/v1/admin/cms/upload-asset-chunk?uploadId=${corruptId}&chunkIndex=1&totalChunks=2&filename=fake.png&mimeType=image/png`,
      { method: 'POST', headers: headersA, body: new Uint8Array(Buffer.from('png-binary')) }
    );
    assert.equal(bad1.status, 400);
    assert.equal(chunkUploadSessionManager.getActiveSessionCount(), 0);
    assert.equal(listStagingFiles().length, beforeFailureFiles, 'Temp staging file must be removed after image optimization failure');
  } finally {
    chunkUploadSessionManager.clearAllSessions();
    if (prevProvider === undefined) delete process.env.STORAGE_PROVIDER;
    else process.env.STORAGE_PROVIDER = prevProvider;
    resetStorageAdapterForTests();

    for (const fileName of createdFiles) {
      const p = path.resolve(process.cwd(), 'public/generated-assets', fileName);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
