import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import sharp from 'sharp';
import {
  ImageValidationError,
  optimizeImageForStorage,
} from '../server/services/storage/imageOptimizer';
import {
  GoogleCloudStorageAdapter,
  LocalStorageAdapter,
  getStorageAdapter,
  resetStorageAdapterForTests,
} from '../server/services/storage/storageAdapter';

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

test('ImageOptimizer: converts oversized JPEG to WebP, preserves aspect ratio & EXIF orientation', async () => {
  // 3000x1500 with EXIF orientation 6 (90 deg CW -> visual 1500x3000 -> resized inside 2048x2048 -> 1024x2048)
  const jpegBuf = await createSampleRaster('jpeg', 3000, 1500, { orientation: 6 });
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
  assert.equal(outMeta.width, 1024);
  assert.equal(outMeta.height, 2048);
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
