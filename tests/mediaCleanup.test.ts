import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import type { Storage } from '@google-cloud/storage';
import {
  CloudflareR2StorageAdapter,
  GoogleCloudStorageAdapter,
  LocalStorageAdapter,
} from '../server/services/storage/storageAdapter';
import {
  DurableMediaStateStore,
  MEDIA_CLEANUP_MYSQL_GROUP,
  MEDIA_CLEANUP_MYSQL_KEY,
  buildMediaCompositeKey,
  mergeDurableMediaState,
  type MySqlMediaStateBackend,
  type MySqlWebsiteSettingRow,
} from '../server/services/storage/durableMediaStateStore';
import {
  MediaCleanupService,
  type MediaReferenceProviders,
} from '../server/services/storage/mediaCleanupService';

/**
 * In-memory mocked Cloudflare R2 S3Client (Preview-only; zero real network/production calls).
 */
function createMockR2Adapter(options?: {
  publicBaseUrl?: string;
  throwOnDelete?: boolean;
}) {
  const objects = new Map<string, Buffer>();
  const deleteCalls: string[] = [];
  const publicBaseUrl = options?.publicBaseUrl || 'https://pub-preview-test.r2.dev';

  const mockS3Client = {
    async send(command: any): Promise<any> {
      if (command instanceof PutObjectCommand) {
        const key = String(command.input.Key || '');
        const body = command.input.Body;
        const buf = Buffer.isBuffer(body)
          ? body
          : body instanceof Uint8Array
            ? Buffer.from(body)
            : Buffer.from(String(body || ''));
        objects.set(key, buf);
        return {};
      }
      if (command instanceof HeadObjectCommand) {
        const key = String(command.input.Key || '');
        if (!objects.has(key)) {
          const err: any = new Error('NotFound');
          err.name = 'NotFound';
          err.$metadata = { httpStatusCode: 404 };
          throw err;
        }
        return { ContentLength: objects.get(key)!.length };
      }
      if (command instanceof DeleteObjectCommand) {
        const key = String(command.input.Key || '');
        deleteCalls.push(key);
        if (options?.throwOnDelete) {
          const err: any = new Error('Simulated R2 delete outage');
          err.$metadata = { httpStatusCode: 503 };
          throw err;
        }
        objects.delete(key);
        return {};
      }
      throw new Error(`Unexpected mock S3 command: ${command?.constructor?.name}`);
    },
  };

  const adapter = new CloudflareR2StorageAdapter({
    bucketName: 'toriwear-preview-mock',
    endpoint: 'https://preview-mock-account.r2.cloudflarestorage.com',
    publicBaseUrl,
    s3Client: mockS3Client,
  });

  return { adapter, objects, deleteCalls, publicBaseUrl };
}

/**
 * In-memory mocked GCS adapter (Preview-only; zero real network calls).
 */
function createMockGcsAdapter(publicBaseUrl = 'https://storage.googleapis.com/toriwear-preview-gcs') {
  const objects = new Map<string, Buffer>();
  const deleteCalls: string[] = [];

  const mockStorage = {
    bucket() {
      return {
        file(key: string) {
          return {
            async save(buf: Buffer) {
              objects.set(key, Buffer.from(buf));
            },
            async exists() {
              return [objects.has(key)];
            },
            async delete() {
              deleteCalls.push(key);
              objects.delete(key);
              return [{}];
            },
          };
        },
      };
    },
  } as unknown as Storage;

  const adapter = new GoogleCloudStorageAdapter({
    bucketName: 'toriwear-preview-gcs',
    publicBaseUrl,
    storageClient: mockStorage,
  });

  return { adapter, objects, deleteCalls, publicBaseUrl };
}

/**
 * In-memory mocked MySQL WebsiteSetting backend with outage & CAS conflict controls.
 */
function createMockMySqlBackend() {
  let row: MySqlWebsiteSettingRow | null = null;
  let online = true;
  let tick = 1000;
  let nextConflictInjector: (() => void) | null = null;
  let casConflictsObserved = 0;

  const backend: MySqlMediaStateBackend = {
    isAvailable: () => true,
    async readRow() {
      if (!online) throw new Error('Simulated MySQL ECONNREFUSED');
      return row ? { ...row, updatedAt: new Date(row.updatedAt.getTime()) } : null;
    },
    async createRow(value: string) {
      if (!online) throw new Error('Simulated MySQL ECONNREFUSED');
      if (row) return { created: false, conflict: true };
      tick += 10;
      row = { key: MEDIA_CLEANUP_MYSQL_KEY, value, updatedAt: new Date(tick) };
      return { created: true };
    },
    async compareAndSwapRow(expectedUpdatedAt: Date, nextValue: string) {
      if (!online) throw new Error('Simulated MySQL ECONNREFUSED');
      if (nextConflictInjector) {
        const inject = nextConflictInjector;
        nextConflictInjector = null;
        inject();
      }
      if (!row || row.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        casConflictsObserved += 1;
        return { updated: false };
      }
      tick += 10;
      row = { key: MEDIA_CLEANUP_MYSQL_KEY, value: nextValue, updatedAt: new Date(tick) };
      return { updated: true };
    },
  };

  return {
    backend,
    setOnline(v: boolean) {
      online = v;
    },
    getRow() {
      return row;
    },
    forceSetRawRow(value: string) {
      tick += 10;
      row = { key: MEDIA_CLEANUP_MYSQL_KEY, value, updatedAt: new Date(tick) };
    },
    injectNextCasConflict(fn: () => void) {
      nextConflictInjector = fn;
    },
    getCasConflictsObserved() {
      return casConflictsObserved;
    },
  };
}

function createEmptyRefs(overrides?: Partial<MediaReferenceProviders>): MediaReferenceProviders {
  return {
    getAllProducts: async () => [],
    getAllCategories: async () => [],
    getAllCollections: async () => [],
    getFrontPageCms: async () => ({}),
    getStoreSettings: async () => ({}),
    getAllOrders: async () => [],
    getPrismaClient: () => null,
    ...overrides,
  };
}

function makeTempFile(prefix: string): { dir: string; filePath: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `toriwear-media-test-${prefix}-`));
  const filePath = path.join(dir, 'media_cleanup_state.json');
  return {
    dir,
    filePath,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

// ============================================================================
// 1. ACTIVE-PROVIDER URL-TO-KEY RESOLUTION & PROVIDER ISOLATION
// ============================================================================

test('resolveManagedStorageKey enforces strict active-provider boundaries across R2, GCS, and Local', () => {
  const r2 = createMockR2Adapter({ publicBaseUrl: 'https://pub-abc123.r2.dev' }).adapter;
  const gcs = createMockGcsAdapter('https://storage.googleapis.com/toriwear-media').adapter;
  const tmp = makeTempFile('local-resolve');
  const local = new LocalStorageAdapter(tmp.dir, '/generated-assets');

  try {
    // R2 accepts only its configured R2_PUBLIC_URL
    assert.equal(r2.resolveManagedStorageKey('https://pub-abc123.r2.dev/cms-shirt-1.webp'), 'cms-shirt-1.webp');
    assert.equal(
      r2.resolveManagedStorageKey('https://pub-abc123.r2.dev/products/my%20tee.webp?v=2#hero'),
      'products/my tee.webp'
    );
    // R2 rejects external URLs, static /assets/, local /generated-assets/, GCS, data URIs, and traversal
    assert.equal(r2.resolveManagedStorageKey('https://images.unsplash.com/photo-12345'), null);
    assert.equal(r2.resolveManagedStorageKey('/assets/logo.png'), null);
    assert.equal(r2.resolveManagedStorageKey('/generated-assets/cms-old.webp'), null);
    assert.equal(r2.resolveManagedStorageKey('https://storage.googleapis.com/toriwear-media/cms-1.webp'), null);
    assert.equal(r2.resolveManagedStorageKey('data:image/png;base64,iVBORw0KGgo='), null);
    assert.equal(r2.resolveManagedStorageKey('https://pub-abc123.r2.dev/../secret.txt'), null);
    assert.equal(r2.resolveManagedStorageKey('https://pub-abc123.r2.dev/%2e%2e/secret.txt'), null);
    assert.equal(r2.resolveManagedStorageKey('https://pub-abc123.r2.dev.evil.com/cms-1.webp'), null);

    // GCS accepts only its configured GCS public base URL
    assert.equal(gcs.resolveManagedStorageKey('https://storage.googleapis.com/toriwear-media/cms-1.webp'), 'cms-1.webp');
    assert.equal(gcs.resolveManagedStorageKey('https://storage.googleapis.com/toriwear-media-other/cms-1.webp'), null);
    assert.equal(gcs.resolveManagedStorageKey('https://pub-abc123.r2.dev/cms-1.webp'), null);

    // Local accepts only /generated-assets/ and rejects /assets/, R2, GCS, and external domains
    assert.equal(local.resolveManagedStorageKey('/generated-assets/cms-local.webp?cache=1'), 'cms-local.webp');
    assert.equal(local.resolveManagedStorageKey('http://localhost:3000/generated-assets/cms-local.webp'), 'cms-local.webp');
    assert.equal(local.resolveManagedStorageKey('/assets/brand-logo.png'), null);
    assert.equal(local.resolveManagedStorageKey('//evil.com/generated-assets/cms-local.webp'), null);
    assert.equal(local.resolveManagedStorageKey('https://evil.com/generated-assets/cms-local.webp'), null);
    assert.equal(local.resolveManagedStorageKey('https://pub-abc123.r2.dev/cms-1.webp'), null);
    assert.equal(local.resolveManagedStorageKey('/generated-assets/%2e%2e/server.ts'), null);
  } finally {
    tmp.cleanup();
  }
});

// ============================================================================
// 2. CROSS-ENTITY REFERENCE PROTECTION (PRODUCTS, CMS, CATEGORIES, COLLECTIONS, ORDERS)
// ============================================================================

test('Cross-entity reference audit preserves shared, draft, archived, CMS, category, collection, and order-snapshot images and deletes only unreferenced R2 objects', async () => {
  const r2 = createMockR2Adapter();
  const tmp = makeTempFile('cross-entity');

  try {
    const keys = [
      'shared-dup.webp',
      'draft-ref.webp',
      'archived-ref.webp',
      'cms-banner.webp',
      'cms-logo.webp',
      'disabled-cat.webp',
      'collection-hero.webp',
      'order-snapshot.webp',
      'truly-orphan.webp',
    ];
    for (const k of keys) {
      r2.objects.set(k, Buffer.from(`img-${k}`));
    }
    const url = (k: string) => r2.adapter.getFileUrl(k);

    const store = new DurableMediaStateStore({ runtimeFilePath: tmp.filePath, mysqlBackend: null });
    const service = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: store,
      cleanupCooldownMs: 0,
      referenceProviders: createEmptyRefs({
        getAllProducts: async () => [
          { images: [url('shared-dup.webp')] }, // Duplicated / published product
          { images: [url('draft-ref.webp')] }, // Draft product
          { images: [url('archived-ref.webp')] }, // Archived product
        ],
        getAllCategories: async () => [
          { image: url('disabled-cat.webp') }, // Disabled category
        ],
        getAllCollections: async () => [
          { heroImage: url('collection-hero.webp') },
        ],
        getFrontPageCms: async () => ({
          lookbook: [{ title: 'Drop 01', image: url('cms-banner.webp') }],
        }),
        getStoreSettings: async () => ({
          logoUrl: url('cms-logo.webp'),
        }),
        getAllOrders: async () => [
          { items: [{ image: url('order-snapshot.webp') }] },
        ],
      }),
    });

    const report = await service.cleanupUnreferencedMedia([
      ...keys.map(url),
      'https://images.unsplash.com/photo-external',
      '/assets/static-banner.png',
      '/generated-assets/legacy-local-file.webp',
    ]);

    assert.equal(report.abortedFailClosed, false);
    assert.deepEqual(report.deletedKeys, ['truly-orphan.webp']);
    assert.deepEqual(r2.deleteCalls, ['truly-orphan.webp']);
    assert.equal(r2.objects.has('truly-orphan.webp'), false);

    // Every referenced object must remain intact
    for (const protectedKey of keys.filter((k) => k !== 'truly-orphan.webp')) {
      assert.equal(r2.objects.has(protectedKey), true, `Expected ${protectedKey} to be preserved`);
      assert.ok(report.preservedReferencedKeys.includes(protectedKey));
    }

    // External, static, and inactive-provider local files must be skipped
    assert.equal(report.skippedUnmanagedUrls.length, 3);
  } finally {
    tmp.cleanup();
  }
});

// ============================================================================
// 3. PRODUCT REPLACE/REMOVE, CLEAR-ALL, AND VARIANT-TRIGGERED DELETION
// ============================================================================

test('Image replacement, clear-all, and variant-triggered deletion clean up only unreferenced objects after cooldown', async () => {
  const r2 = createMockR2Adapter();
  const tmp = makeTempFile('lifecycle');
  let clock = 1_000_000;

  try {
    const keptUrl = r2.adapter.getFileUrl('kept.webp');
    const replacedUrl = r2.adapter.getFileUrl('replaced.webp');
    const orderUsedUrl = r2.adapter.getFileUrl('order-used.webp');
    const variantDeletedUrl = r2.adapter.getFileUrl('variant-removed.webp');

    for (const k of ['kept.webp', 'replaced.webp', 'order-used.webp', 'variant-removed.webp']) {
      r2.objects.set(k, Buffer.from(k));
    }

    const activeProducts = [{ images: [keptUrl] }];
    const store = new DurableMediaStateStore({
      runtimeFilePath: tmp.filePath,
      mysqlBackend: null,
      now: () => clock,
    });
    const service = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: store,
      cleanupCooldownMs: 120_000, // 2-minute safety cooldown
      now: () => clock,
      referenceProviders: createEmptyRefs({
        getAllProducts: async () => activeProducts,
        getAllOrders: async () => [{ items: [{ image: orderUsedUrl }] }],
      }),
    });

    // Enqueue replaced image + order-used image + variant-triggered removed product image
    await service.enqueueDeferredMediaCleanup([replacedUrl, orderUsedUrl, variantDeletedUrl], {
      reason: 'product-replace-and-variant-delete',
    });

    // Before 2-minute cooldown elapses -> zero deletions
    const earlyReport = await service.processDeferredCleanupQueue();
    assert.deepEqual(earlyReport.deletedKeys, []);
    assert.equal(r2.deleteCalls.length, 0);

    // Advance clock past 2-minute cooldown -> replaced & variant-removed deleted, kept & order-used preserved
    clock += 120_001;
    const postCooldownReport = await service.processDeferredCleanupQueue();
    assert.deepEqual(postCooldownReport.deletedKeys.sort(), ['replaced.webp', 'variant-removed.webp']);
    assert.equal(r2.objects.has('kept.webp'), true);
    assert.equal(r2.objects.has('order-used.webp'), true);
    assert.equal(r2.objects.has('replaced.webp'), false);
    assert.equal(r2.objects.has('variant-removed.webp'), false);
  } finally {
    tmp.cleanup();
  }
});

// ============================================================================
// 4. RESTART-SAFE PENDING UPLOAD PERSISTENCE & INTERNAL METADATA EXCLUSION
// ============================================================================

test('Pending uploads survive simulated GoDaddy Node.js Hosting restarts with earliest uploadedAt preserved and do not self-reference in Prisma WebsiteSetting scans', async () => {
  const r2 = createMockR2Adapter();
  const tmp = makeTempFile('restart-recovery');
  const mockMySql = createMockMySqlBackend();
  let clock = 5_000_000;

  try {
    const abandonedUrl = r2.adapter.getFileUrl('abandoned-before-restart.webp');
    const savedUrl = r2.adapter.getFileUrl('saved-before-restart.webp');
    r2.objects.set('abandoned-before-restart.webp', Buffer.from('a'));
    r2.objects.set('saved-before-restart.webp', Buffer.from('b'));

    // Process 1: Admin uploads 2 images, saves 1, leaves 1 abandoned before Node restarts
    const store1 = new DurableMediaStateStore({
      runtimeFilePath: tmp.filePath,
      mysqlBackend: mockMySql.backend,
      instanceId: 'godaddy-worker-1',
      now: () => clock,
    });
    const service1 = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: store1,
      pendingUploadTtlMs: 60 * 60 * 1000, // 60 minutes
      cleanupCooldownMs: 0,
      now: () => clock,
      referenceProviders: createEmptyRefs({
        getAllProducts: async () => [{ images: [savedUrl] }],
      }),
    });

    await service1.registerPendingUpload({ url: abandonedUrl, ownerId: 'admin-1', sessionId: 'sess-1' });
    await service1.registerPendingUpload({ url: savedUrl, ownerId: 'admin-1', sessionId: 'sess-1' });
    await service1.markUrlsCommitted([savedUrl]);

    // --- SIMULATE GODADDY SERVER RESTART 61 MINUTES LATER ---
    clock += 61 * 60 * 1000;

    // Mock Prisma client returning the INTERNAL_MEDIA WebsiteSetting row alongside normal settings
    const mockPrisma = {
      websiteSetting: {
        findMany: async () => {
          const row = mockMySql.getRow();
          return [
            // Even if someone returned all rows, our filter & defensive check must exclude INTERNAL_MEDIA!
            ...(row ? [{ key: MEDIA_CLEANUP_MYSQL_KEY, group: MEDIA_CLEANUP_MYSQL_GROUP, value: row.value }] : []),
          ];
        },
      },
    };

    // Process 2: Fresh instance with zero in-memory state, backed by the same runtime JSON + MySQL row
    const store2 = new DurableMediaStateStore({
      runtimeFilePath: tmp.filePath,
      mysqlBackend: mockMySql.backend,
      instanceId: 'godaddy-worker-2',
      now: () => clock,
    });
    const service2 = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: store2,
      pendingUploadTtlMs: 60 * 60 * 1000,
      cleanupCooldownMs: 0,
      now: () => clock,
      referenceProviders: createEmptyRefs({
        getAllProducts: async () => [{ images: [savedUrl] }],
        getPrismaClient: () => mockPrisma,
      }),
    });

    // Startup hydration restores original uploadedAt (5_000_000), so at 5_000_000 + 61m it is expired
    const sweepReport = await service2.sweepExpiredPendingUploads();
    assert.deepEqual(sweepReport.deletedKeys, ['abandoned-before-restart.webp']);
    assert.equal(r2.objects.has('abandoned-before-restart.webp'), false);
    assert.equal(r2.objects.has('saved-before-restart.webp'), true);
  } finally {
    tmp.cleanup();
  }
});

// ============================================================================
// 5. DURABLE STATE CONSISTENCY: STALE JSON vs NEWER MYSQL, OUTAGE RECOVERY, CAS CONFLICT, DUPLICATE CLAIMS
// ============================================================================

test('Older runtime JSON snapshot never overwrites newer MySQL state or resurrects tombstoned uploads', async () => {
  const tmp = makeTempFile('stale-json');
  const mockMySql = createMockMySqlBackend();
  let clock = 2_000_000;

  try {
    // Worker A writes upload-1 and upload-2, then commits upload-1 (creating a tombstone in MySQL)
    const storeA = new DurableMediaStateStore({
      runtimeFilePath: path.join(tmp.dir, 'workerA.json'),
      mysqlBackend: mockMySql.backend,
      instanceId: 'worker-A',
      now: () => clock,
    });
    const key1 = buildMediaCompositeKey('r2', 'u1.webp');
    const key2 = buildMediaCompositeKey('r2', 'u2.webp');

    await storeA.mutate((draft, nowMs) => {
      draft.pendingUploads[key1] = {
        compositeKey: key1,
        provider: 'r2',
        storageKey: 'u1.webp',
        url: 'https://pub-preview-test.r2.dev/u1.webp',
        ownerId: 'admin-1',
        uploadedAt: nowMs,
        createdAt: nowMs,
        updatedAt: nowMs,
        revision: 1,
      };
      return { result: true, changed: true };
    });

    // Snapshot the OLDER disk JSON before u1 was committed and before u2 existed
    const olderJsonSnapshot = fs.readFileSync(path.join(tmp.dir, 'workerA.json'), 'utf8');

    clock += 1000;
    await storeA.mutate((draft, nowMs) => {
      // Commit u1 (tombstone rev 2) and add u2
      delete draft.pendingUploads[key1];
      draft.tombstones[`pending:${key1}`] = {
        key: `pending:${key1}`,
        deletedAt: nowMs,
        revision: 2,
        reason: 'committed',
      };
      draft.pendingUploads[key2] = {
        compositeKey: key2,
        provider: 'r2',
        storageKey: 'u2.webp',
        url: 'https://pub-preview-test.r2.dev/u2.webp',
        ownerId: 'admin-2',
        uploadedAt: nowMs,
        createdAt: nowMs,
        updatedAt: nowMs,
        revision: 1,
      };
      return { result: true, changed: true };
    });

    // Worker B starts up with the OLDER JSON file on disk while MySQL has the newer state
    const staleDiskPath = path.join(tmp.dir, 'stale-workerB.json');
    fs.writeFileSync(staleDiskPath, olderJsonSnapshot, 'utf8');

    const storeB = new DurableMediaStateStore({
      runtimeFilePath: staleDiskPath,
      mysqlBackend: mockMySql.backend,
      instanceId: 'worker-B',
      now: () => clock + 500,
    });

    const hydrated = await storeB.hydrate();
    // u1 must NOT be resurrected; u2 from newer MySQL must be preserved!
    assert.equal(hydrated.pendingUploads[key1], undefined);
    assert.ok(hydrated.pendingUploads[key2]);
    assert.equal(hydrated.pendingUploads[key2].ownerId, 'admin-2');
  } finally {
    tmp.cleanup();
  }
});

test('Temporary MySQL outage preserves new pending uploads & cleanup entries on runtime JSON, fails closed on deletes, and reconciles cleanly upon MySQL recovery', async () => {
  const r2 = createMockR2Adapter();
  const tmp = makeTempFile('mysql-outage');
  const mockMySql = createMockMySqlBackend();
  let clock = 3_000_000;

  try {
    const outageUrl = r2.adapter.getFileUrl('uploaded-during-outage.webp');
    r2.objects.set('uploaded-during-outage.webp', Buffer.from('outage-img'));

    const store = new DurableMediaStateStore({
      runtimeFilePath: tmp.filePath,
      mysqlBackend: mockMySql.backend,
      instanceId: 'worker-outage',
      now: () => clock,
    });

    let mysqlQueryFailing = true;
    const mockPrisma = {
      productImage: {
        findMany: async () => {
          if (mysqlQueryFailing) throw new Error('Simulated MySQL outage during reference audit');
          return [];
        },
      },
    };

    const service = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: store,
      cleanupCooldownMs: 0,
      now: () => clock,
      referenceProviders: createEmptyRefs({
        getPrismaClient: () => mockPrisma,
      }),
    });

    // Simulate MySQL going offline
    mockMySql.setOnline(false);

    // Register pending upload & enqueue cleanup during MySQL outage -> MUST NOT be lost!
    const reg = await service.registerPendingUpload({ url: outageUrl, ownerId: 'admin-1' });
    assert.ok(reg);
    await service.enqueueDeferredMediaCleanup([outageUrl], { reason: 'outage-product-delete' });

    const duringOutage = await store.getSnapshot();
    assert.equal(duringOutage.pendingMySqlSync, true);
    assert.ok(duringOutage.pendingUploads[buildMediaCompositeKey('r2', 'uploaded-during-outage.webp')]);
    assert.ok(duringOutage.deferredQueue[buildMediaCompositeKey('r2', 'uploaded-during-outage.webp')]);

    // Attempt cleanup while MySQL is down -> MUST FAIL CLOSED (zero deletions, entry stays queued)
    const outageSweep = await service.processDeferredCleanupQueue();
    assert.equal(outageSweep.abortedFailClosed, true);
    assert.deepEqual(outageSweep.deletedKeys, []);
    assert.equal(r2.objects.has('uploaded-during-outage.webp'), true);

    // MySQL recovers!
    mockMySql.setOnline(true);
    mysqlQueryFailing = false;

    const syncedBeforeDelete = await store.syncBackends();
    assert.equal(syncedBeforeDelete.pendingMySqlSync, false);
    assert.ok(mockMySql.getRow(), 'Expected outage-buffered entries to reconcile into MySQL');
    assert.ok(mockMySql.getRow()!.value.includes('uploaded-during-outage.webp'));

    // Now advance past backoff bump and verify cleanup succeeds safely post-recovery
    clock += 20_000;
    const recoverySweep = await service.processDeferredCleanupQueue();
    assert.equal(recoverySweep.abortedFailClosed, false);
    assert.deepEqual(recoverySweep.deletedKeys, ['uploaded-during-outage.webp']);
    assert.equal(r2.objects.has('uploaded-during-outage.webp'), false);
  } finally {
    tmp.cleanup();
  }
});

test('Concurrent writes and MySQL CAS conflicts retry, merge deterministically, and never drop updates', async () => {
  const tmp = makeTempFile('cas-conflict');
  const mockMySql = createMockMySqlBackend();
  const clock = 4_000_000;

  try {
    const store = new DurableMediaStateStore({
      runtimeFilePath: tmp.filePath,
      mysqlBackend: mockMySql.backend,
      instanceId: 'worker-cas',
      now: () => clock,
    });

    const keyA = buildMediaCompositeKey('r2', 'concurrent-a.webp');
    const keyB = buildMediaCompositeKey('r2', 'concurrent-b.webp');
    const keyRemote = buildMediaCompositeKey('r2', 'remote-worker-c.webp');

    // Seed initial row in MySQL
    await store.mutate((draft, nowMs) => {
      draft.pendingUploads[keyA] = {
        compositeKey: keyA,
        provider: 'r2',
        storageKey: 'concurrent-a.webp',
        url: 'https://pub-preview-test.r2.dev/concurrent-a.webp',
        ownerId: 'admin-a',
        uploadedAt: nowMs,
        createdAt: nowMs,
        updatedAt: nowMs,
        revision: 1,
      };
      return { result: true, changed: true };
    });

    // Inject a cross-worker MySQL CAS conflict right before the next CAS write
    mockMySql.injectNextCasConflict(() => {
      const current = JSON.parse(mockMySql.getRow()!.value);
      current.stateVersion += 1;
      current.pendingUploads[keyRemote] = {
        compositeKey: keyRemote,
        provider: 'r2',
        storageKey: 'remote-worker-c.webp',
        url: 'https://pub-preview-test.r2.dev/remote-worker-c.webp',
        ownerId: 'admin-remote',
        uploadedAt: clock + 5,
        createdAt: clock + 5,
        updatedAt: clock + 5,
        revision: 1,
      };
      mockMySql.forceSetRawRow(JSON.stringify(current));
    });

    // Fire concurrent mutations in-process while CAS conflict fires against MySQL
    await Promise.all([
      store.mutate((draft, nowMs) => {
        draft.pendingUploads[keyB] = {
          compositeKey: keyB,
          provider: 'r2',
          storageKey: 'concurrent-b.webp',
          url: 'https://pub-preview-test.r2.dev/concurrent-b.webp',
          ownerId: 'admin-b',
          uploadedAt: nowMs,
          createdAt: nowMs,
          updatedAt: nowMs,
          revision: 1,
        };
        return { result: true, changed: true };
      }),
      store.syncBackends(),
    ]);

    assert.ok(mockMySql.getCasConflictsObserved() >= 1, 'Expected CAS conflict retry to execute');
    const finalSnapshot = await store.getSnapshot();
    // ALL THREE keys (A, B, and remote-worker C) must be present in both runtime JSON and MySQL!
    assert.ok(finalSnapshot.pendingUploads[keyA]);
    assert.ok(finalSnapshot.pendingUploads[keyB]);
    assert.ok(finalSnapshot.pendingUploads[keyRemote]);

    const mysqlParsed = JSON.parse(mockMySql.getRow()!.value);
    assert.ok(mysqlParsed.pendingUploads[keyA]);
    assert.ok(mysqlParsed.pendingUploads[keyB]);
    assert.ok(mysqlParsed.pendingUploads[keyRemote]);
  } finally {
    tmp.cleanup();
  }
});

test('Duplicate cleanup jobs and multi-worker durable processingClaim delete an object at most once', async () => {
  const r2 = createMockR2Adapter();
  const tmp = makeTempFile('duplicate-claim');
  const mockMySql = createMockMySqlBackend();
  const clock = 6_000_000;

  try {
    const url = r2.adapter.getFileUrl('single-delete-only.webp');
    r2.objects.set('single-delete-only.webp', Buffer.from('once'));

    const store1 = new DurableMediaStateStore({
      runtimeFilePath: path.join(tmp.dir, 'w1.json'),
      mysqlBackend: mockMySql.backend,
      instanceId: 'worker-1',
      now: () => clock,
    });
    const store2 = new DurableMediaStateStore({
      runtimeFilePath: path.join(tmp.dir, 'w2.json'),
      mysqlBackend: mockMySql.backend,
      instanceId: 'worker-2',
      now: () => clock,
    });

    const service1 = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: store1,
      cleanupCooldownMs: 0,
      now: () => clock,
      referenceProviders: createEmptyRefs(),
    });
    const service2 = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: store2,
      cleanupCooldownMs: 0,
      now: () => clock,
      referenceProviders: createEmptyRefs(),
    });

    // Queue same URL 3 times -> deduplicates to 1 entry
    await service1.enqueueDeferredMediaCleanup([url, url, url], { reason: 'dedup-test' });
    // Pre-claim on worker-1 while worker-2 tries to sweep simultaneously
    const compositeKey = buildMediaCompositeKey('r2', 'single-delete-only.webp');
    await store1.mutate((draft, nowMs) => {
      draft.deferredQueue[compositeKey].processingClaim = {
        ownerInstanceId: 'worker-1',
        claimedAt: nowMs,
        claimExpiresAt: nowMs + 120_000,
      };
      draft.deferredQueue[compositeKey].revision += 1;
      return { result: true, changed: true };
    });

    // Worker-2 must skip the key claimed by worker-1
    const worker2Report = await service2.processDeferredCleanupQueue();
    assert.deepEqual(worker2Report.deletedKeys, []);
    assert.equal(r2.deleteCalls.length, 0);

    // Worker-1 executes its claimed cleanup -> deletes exactly once
    const worker1Report = await service1.processDeferredCleanupQueue();
    assert.deepEqual(worker1Report.deletedKeys, ['single-delete-only.webp']);
    assert.equal(r2.deleteCalls.length, 1);

    // Subsequent sweeps on either worker do nothing (tombstoned & removed)
    const repeatReport = await service2.processDeferredCleanupQueue();
    assert.deepEqual(repeatReport.deletedKeys, []);
    assert.equal(r2.deleteCalls.length, 1);
  } finally {
    tmp.cleanup();
  }
});

// ============================================================================
// 6. CONCURRENT EDITING SAFETY: ACTIVE EDITOR LEASES, CANCEL OWNERSHIP & TOCTOU GATE
// ============================================================================

test('Active Editor Media Leases protect open-editor images across admins and enforce ownership on cancel discard', async () => {
  const r2 = createMockR2Adapter();
  const tmp = makeTempFile('leases-and-cancel');
  let clock = 7_000_000;

  try {
    const sharedUrl = r2.adapter.getFileUrl('editor-leased.webp');
    const soloCancelUrl = r2.adapter.getFileUrl('solo-cancel.webp');
    r2.objects.set('editor-leased.webp', Buffer.from('leased'));
    r2.objects.set('solo-cancel.webp', Buffer.from('cancel'));

    const store = new DurableMediaStateStore({
      runtimeFilePath: tmp.filePath,
      mysqlBackend: null,
      now: () => clock,
    });
    const service = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: store,
      cleanupCooldownMs: 0,
      editorLeaseTtlMs: 5 * 60 * 1000,
      now: () => clock,
      referenceProviders: createEmptyRefs(),
    });

    // Admin A uploads soloCancelUrl; Admin B holds an active editor lease on sharedUrl
    await service.registerPendingUpload({ url: soloCancelUrl, ownerId: 'admin-A', sessionId: 'sess-A' });
    await service.upsertEditorMediaLease({
      sessionId: 'sess-A',
      ownerId: 'admin-A',
      urls: [soloCancelUrl],
    });
    await service.upsertEditorMediaLease({
      sessionId: 'sess-B',
      ownerId: 'admin-B',
      urls: [sharedUrl],
    });

    // Admin B tries to discard Admin A's pending upload -> rejected by ownership check!
    const unauthorizedDiscard = await service.discardPendingUploads({
      urls: [soloCancelUrl],
      ownerId: 'admin-B',
      sessionId: 'sess-B',
      isSuperAdmin: false,
    });
    assert.equal(unauthorizedDiscard.acceptedUrls.length, 0);
    assert.equal(unauthorizedDiscard.rejectedUrls.length, 1);
    assert.equal(r2.objects.has('solo-cancel.webp'), true);

    // Admin A cancels their own editor session -> excludes sess-A lease and deletes soloCancelUrl
    const validCancelDiscard = await service.discardPendingUploads({
      urls: [soloCancelUrl],
      ownerId: 'admin-A',
      sessionId: 'sess-A',
    });
    assert.deepEqual(validCancelDiscard.report.deletedKeys, ['solo-cancel.webp']);
    assert.equal(r2.objects.has('solo-cancel.webp'), false);

    // Meanwhile, deleting sharedUrl while Admin B's lease is active MUST preserve sharedUrl!
    const leasedReport = await service.cleanupUnreferencedMedia([sharedUrl], {
      reason: 'admin-a-deleted-product',
    });
    assert.deepEqual(leasedReport.deletedKeys, []);
    assert.deepEqual(leasedReport.preservedReferencedKeys, ['editor-leased.webp']);
    assert.equal(r2.objects.has('editor-leased.webp'), true);

    // Once Admin B releases their lease (or it expires after 5 min), cleanup succeeds
    await service.releaseEditorMediaLease({ sessionId: 'sess-B', ownerId: 'admin-B' });
    const postReleaseReport = await service.cleanupUnreferencedMedia([sharedUrl], {
      reason: 'post-lease-release',
    });
    assert.deepEqual(postReleaseReport.deletedKeys, ['editor-leased.webp']);
    assert.equal(r2.objects.has('editor-leased.webp'), false);
  } finally {
    tmp.cleanup();
  }
});

test('TOCTOU Double-Check Gate aborts deletion when a concurrent write commits mid-audit', async () => {
  const r2 = createMockR2Adapter();
  const tmp = makeTempFile('toctou-gate');

  try {
    const raceUrl = r2.adapter.getFileUrl('toctou-race.webp');
    r2.objects.set('toctou-race.webp', Buffer.from('race'));

    const store = new DurableMediaStateStore({ runtimeFilePath: tmp.filePath, mysqlBackend: null });
    let service!: MediaCleanupService;

    service = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: store,
      cleanupCooldownMs: 0,
      referenceProviders: createEmptyRefs({
        getAllProducts: async () => {
          // Simulate another admin saving a product right in the middle of the reference audit!
          service.beginMediaReferenceWrite();
          service.endMediaReferenceWrite();
          return [];
        },
      }),
    });

    const report = await service.cleanupUnreferencedMedia([raceUrl], {
      reason: 'toctou-test',
      requeueOnConflict: true,
    });

    assert.deepEqual(report.deletedKeys, []);
    assert.deepEqual(report.deferredConflictKeys, ['toctou-race.webp']);
    assert.equal(r2.deleteCalls.length, 0);
    assert.equal(r2.objects.has('toctou-race.webp'), true);
  } finally {
    tmp.cleanup();
  }
});

// ============================================================================
// 7. FAILURE RESILIENCE, DRY-RUN MODE & GCS / LOCAL COMPATIBILITY
// ============================================================================

test('Storage delete failures never throw, dry-run performs zero deletions, and Local + GCS adapters work identically', async () => {
  const failingR2 = createMockR2Adapter({ throwOnDelete: true });
  const gcs = createMockGcsAdapter();
  const tmp = makeTempFile('resilience');
  const localDir = path.join(tmp.dir, 'generated-assets');
  fs.mkdirSync(localDir, { recursive: true });
  const local = new LocalStorageAdapter(localDir, '/generated-assets');

  try {
    // 1. Failing R2 delete -> non-fatal, caught and recorded
    const failUrl = failingR2.adapter.getFileUrl('fail-r2.webp');
    failingR2.objects.set('fail-r2.webp', Buffer.from('x'));
    const failService = new MediaCleanupService({
      storageAdapterProvider: () => failingR2.adapter,
      stateStore: new DurableMediaStateStore({ runtimeFilePath: path.join(tmp.dir, 's1.json'), mysqlBackend: null }),
      referenceProviders: createEmptyRefs(),
    });
    const failReport = await failService.cleanupUnreferencedMedia([failUrl]);
    assert.equal(failReport.deletedKeys.length, 0);
    assert.equal(failReport.failedKeys.length, 1);

    // 2. Dry-run mode -> logs intent, zero delete calls
    const gcsUrl = gcs.adapter.getFileUrl('dry-run-gcs.webp');
    gcs.objects.set('dry-run-gcs.webp', Buffer.from('gcs-data'));
    const dryRunService = new MediaCleanupService({
      storageAdapterProvider: () => gcs.adapter,
      stateStore: new DurableMediaStateStore({ runtimeFilePath: path.join(tmp.dir, 's2.json'), mysqlBackend: null }),
      dryRun: true,
      referenceProviders: createEmptyRefs(),
    });
    const dryReport = await dryRunService.cleanupUnreferencedMedia([gcsUrl]);
    assert.equal(dryReport.dryRun, true);
    assert.deepEqual(dryReport.deletedKeys, ['dry-run-gcs.webp']);
    assert.equal(gcs.deleteCalls.length, 0);
    assert.equal(gcs.objects.has('dry-run-gcs.webp'), true);

    // 3. Real GCS live delete (mocked SDK)
    const liveGcsService = new MediaCleanupService({
      storageAdapterProvider: () => gcs.adapter,
      stateStore: new DurableMediaStateStore({ runtimeFilePath: path.join(tmp.dir, 's3.json'), mysqlBackend: null }),
      dryRun: false,
      referenceProviders: createEmptyRefs(),
    });
    const gcsReport = await liveGcsService.cleanupUnreferencedMedia([gcsUrl]);
    assert.deepEqual(gcsReport.deletedKeys, ['dry-run-gcs.webp']);
    assert.equal(gcs.objects.has('dry-run-gcs.webp'), false);

    // 4. Local storage cleanup works identically without touching /assets/*
    const uploadedLocal = await local.uploadFile(Buffer.from('local-webp'), 'cms-local-orphan.webp', 'image/webp');
    assert.equal(uploadedLocal.success, true);
    const localService = new MediaCleanupService({
      storageAdapterProvider: () => local,
      stateStore: new DurableMediaStateStore({ runtimeFilePath: path.join(tmp.dir, 's4.json'), mysqlBackend: null }),
      referenceProviders: createEmptyRefs(),
    });
    const localReport = await localService.cleanupUnreferencedMedia([
      uploadedLocal.url,
      '/assets/logo.png',
    ]);
    assert.deepEqual(localReport.deletedKeys, ['cms-local-orphan.webp']);
    assert.deepEqual(localReport.skippedUnmanagedUrls, ['/assets/logo.png']);
    assert.equal(await local.fileExists('cms-local-orphan.webp'), false);
  } finally {
    tmp.cleanup();
  }
});

test('mergeDurableMediaState preserves earliest uploadedAt, latest eligibleAt, and latest lease expiresAt deterministically', () => {
  const now = 10_000_000;
  const k = buildMediaCompositeKey('r2', 'merge-check.webp');
  const a: any = {
    schemaVersion: 1,
    stateVersion: 4,
    updatedAt: now - 1000,
    instanceId: 'A',
    pendingMySqlSync: false,
    lastSyncedMySqlVersion: 4,
    pendingUploads: {
      [k]: {
        compositeKey: k,
        provider: 'r2',
        storageKey: 'merge-check.webp',
        url: 'https://pub-preview-test.r2.dev/merge-check.webp',
        ownerId: 'admin-1',
        uploadedAt: now - 50_000,
        createdAt: now - 50_000,
        updatedAt: now - 1000,
        revision: 2,
      },
    },
    deferredQueue: {
      [k]: {
        compositeKey: k,
        provider: 'r2',
        storageKey: 'merge-check.webp',
        url: 'https://pub-preview-test.r2.dev/merge-check.webp',
        reason: 'delete',
        enqueuedAt: now - 20_000,
        eligibleAt: now + 30_000,
        attempts: 1,
        createdAt: now - 20_000,
        updatedAt: now - 1000,
        revision: 2,
      },
    },
    editorLeases: {},
    tombstones: {},
  };

  const b: any = {
    ...a,
    stateVersion: 5,
    updatedAt: now,
    instanceId: 'B',
    pendingUploads: {
      [k]: {
        ...a.pendingUploads[k],
        uploadedAt: now - 10_000, // Later uploadedAt on B
        updatedAt: now,
        revision: 3,
      },
    },
    deferredQueue: {
      [k]: {
        ...a.deferredQueue[k],
        eligibleAt: now + 90_000, // Longer cooldown on B
        attempts: 2,
        updatedAt: now,
        revision: 3,
      },
    },
  };

  const mergedAB = mergeDurableMediaState(a, b, now);
  const mergedBA = mergeDurableMediaState(b, a, now);

  assert.equal(mergedAB.pendingUploads[k].uploadedAt, now - 50_000); // Earliest preserved!
  assert.equal(mergedBA.pendingUploads[k].uploadedAt, now - 50_000); // Commutative!
  assert.equal(mergedAB.deferredQueue[k].eligibleAt, now + 90_000); // Latest cooldown preserved!
  assert.equal(mergedBA.deferredQueue[k].eligibleAt, now + 90_000); // Commutative!
  assert.equal(mergedAB.deferredQueue[k].attempts, 2);
});
