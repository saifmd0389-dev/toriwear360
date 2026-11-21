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
  createPrismaMySqlMediaStateBackend,
  mergeDurableMediaState,
  type MySqlMediaStateBackend,
  type MySqlWebsiteSettingRow,
} from '../server/services/storage/durableMediaStateStore';
import {
  MediaCleanupService,
  type MediaReferenceProviders,
} from '../server/services/storage/mediaCleanupService';
import {
  MEDIA_COORDINATION_MYSQL_KEY,
  MEDIA_TOMBSTONE_MYSQL_GROUP,
  MediaConflictError,
  MediaCoordinationUnavailableError,
  MediaEnumerationIncompleteError,
  MediaWriteCoordinator,
  evaluateMySqlCoordinationExpectation,
  extractManagedKeysStrict,
  toRetiredTombstoneKey,
} from '../server/services/storage/mediaCoordination';
import { getPrismaClient, setPrismaClientOverrideForTests } from '../server/db/prisma';
import { OrderRepository, type OrderRecord } from '../server/repositories/orderRepository';

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
 * In-memory mocked MySQL WebsiteSetting backend with outage & unique revision-token CAS conflict controls.
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
      return row ? { ...row } : null;
    },
    async createRow(value: string, revisionToken: string) {
      if (!online) throw new Error('Simulated MySQL ECONNREFUSED');
      if (row) return { created: false, conflict: true };
      tick += 10;
      row = { key: MEDIA_CLEANUP_MYSQL_KEY, value, revisionToken };
      return { created: true };
    },
    async compareAndSwapRow(expectedRevisionToken: string | null, nextValue: string, nextRevisionToken: string) {
      if (!online) throw new Error('Simulated MySQL ECONNREFUSED');
      if (nextConflictInjector) {
        const inject = nextConflictInjector;
        nextConflictInjector = null;
        inject();
      }
      if (!row || row.revisionToken !== expectedRevisionToken) {
        casConflictsObserved += 1;
        return { updated: false };
      }
      tick += 10;
      row = { key: MEDIA_CLEANUP_MYSQL_KEY, value: nextValue, revisionToken: nextRevisionToken };
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
    forceSetRawRow(value: string, revisionToken?: string) {
      tick += 10;
      row = {
        key: MEDIA_CLEANUP_MYSQL_KEY,
        value,
        revisionToken: revisionToken || `rev:forced:${tick}`,
      };
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

// ============================================================================
// 8. SIMULATED TRANSACTIONAL INNODB MYSQL HARNESS (READ COMMITTED + S/X LOCKS)
// ============================================================================

interface MockWsRow {
  id: string;
  key: string;
  value: string;
  group: string;
  description: string | null;
  isPublic: boolean;
  updatedAt: Date;
}

interface RowLockEntry {
  sharedHolders: Set<number>;
  exclusiveHolder: number | null;
  waiters: Array<{
    txId: number;
    mode: 'S' | 'X';
    resolve: () => void;
    reject: (err: Error) => void;
  }>;
}

/**
 * Faithful in-memory InnoDB transactional MySQL simulator for Preview-only concurrency testing:
 * - Supports `READ COMMITTED` isolation (writes buffer inside each tx and become visible only on commit).
 * - Enforces genuine row-level Shared (`LOCK IN SHARE MODE`) vs Exclusive (`FOR UPDATE`) lock queues
 *   with FIFO writer priority.
 * - Supports simulating server-side transaction timeout/rollback (`abortTransaction(txId)`) which
 *   immediately discards uncommitted mutations, releases InnoDB locks, and rejects any subsequent
 *   DB calls from the paused/waking worker.
 */
function createMockInnoDbMySql() {
  let online = true;
  let nextTxId = 1;

  const websiteSettings = new Map<string, MockWsRow>();
  const productImages = new Map<string, { id: string; productId: string; url: string }>();
  const categories = new Map<string, { id: string; image: string | null }>();
  const collections = new Map<string, { id: string; image: string | null; bannerImage: string | null }>();
  const orders = new Map<string, { id: string; orderNumber: string; items: Array<{ image: string | null }> }>();

  const rowLocks = new Map<string, RowLockEntry>();
  const activeTxControls = new Map<
    number,
    {
      aborted: boolean;
      abortReason: string;
      heldLockKeys: Set<string>;
      abort: (reason: string) => void;
    }
  >();

  const lockEvents: string[] = [];

  function getLockEntry(key: string): RowLockEntry {
    let entry = rowLocks.get(key);
    if (!entry) {
      entry = { sharedHolders: new Set(), exclusiveHolder: null, waiters: [] };
      rowLocks.set(key, entry);
    }
    return entry;
  }

  function pumpLockQueue(key: string) {
    const entry = rowLocks.get(key);
    if (!entry) return;
    while (entry.waiters.length > 0) {
      const next = entry.waiters[0];
      if (next.mode === 'S') {
        if (entry.exclusiveHolder === null || entry.exclusiveHolder === next.txId) {
          entry.waiters.shift();
          entry.sharedHolders.add(next.txId);
          next.resolve();
        } else {
          break;
        }
      } else {
        const onlySelfShared =
          entry.sharedHolders.size === 0 ||
          (entry.sharedHolders.size === 1 && entry.sharedHolders.has(next.txId));
        if ((entry.exclusiveHolder === null || entry.exclusiveHolder === next.txId) && onlySelfShared) {
          entry.waiters.shift();
          entry.sharedHolders.delete(next.txId);
          entry.exclusiveHolder = next.txId;
          next.resolve();
        } else {
          break;
        }
      }
    }
  }

  async function acquireRowLock(txId: number, key: string, mode: 'S' | 'X'): Promise<void> {
    const ctrl = activeTxControls.get(txId);
    if (!ctrl || ctrl.aborted) {
      throw new Error(ctrl?.abortReason || 'MySQL transaction aborted');
    }
    const entry = getLockEntry(key);
    const hasPendingExclusiveWaiter = entry.waiters.some((w) => w.mode === 'X');

    if (mode === 'S') {
      if (
        (entry.exclusiveHolder === null || entry.exclusiveHolder === txId) &&
        (!hasPendingExclusiveWaiter || entry.sharedHolders.has(txId))
      ) {
        entry.sharedHolders.add(txId);
        ctrl.heldLockKeys.add(key);
        lockEvents.push(`tx${txId}:ACQUIRE_S:${key}`);
        return;
      }
    } else {
      const onlySelfShared =
        entry.sharedHolders.size === 0 ||
        (entry.sharedHolders.size === 1 && entry.sharedHolders.has(txId));
      if (
        (entry.exclusiveHolder === null || entry.exclusiveHolder === txId) &&
        onlySelfShared &&
        entry.waiters.length === 0
      ) {
        entry.sharedHolders.delete(txId);
        entry.exclusiveHolder = txId;
        ctrl.heldLockKeys.add(key);
        lockEvents.push(`tx${txId}:ACQUIRE_X:${key}`);
        return;
      }
    }

    lockEvents.push(`tx${txId}:WAIT_${mode}:${key}`);
    await new Promise<void>((resolve, reject) => {
      entry.waiters.push({ txId, mode, resolve, reject });
    });
    if (ctrl.aborted) {
      releaseTxLocks(txId);
      throw new Error(ctrl.abortReason);
    }
    ctrl.heldLockKeys.add(key);
    lockEvents.push(`tx${txId}:ACQUIRE_${mode}:${key}`);
  }

  function releaseTxLocks(txId: number) {
    const ctrl = activeTxControls.get(txId);
    if (!ctrl) return;
    for (const key of Array.from(ctrl.heldLockKeys)) {
      const entry = rowLocks.get(key);
      if (entry) {
        entry.sharedHolders.delete(txId);
        if (entry.exclusiveHolder === txId) {
          entry.exclusiveHolder = null;
        }
        entry.waiters = entry.waiters.filter((w) => w.txId !== txId);
        pumpLockQueue(key);
      }
    }
    ctrl.heldLockKeys.clear();
  }

  function assertOnline() {
    if (!online) {
      const err: any = new Error('Simulated MySQL ECONNREFUSED');
      err.code = 'ECONNREFUSED';
      throw err;
    }
  }

  function createTxClient(txId: number) {
    const wsStaging = new Map<string, MockWsRow>();
    const prodImgStaging = new Map<string, { id: string; productId: string; url: string }>();
    const orderStaging = new Map<string, { id: string; orderNumber: string; items: Array<{ image: string | null }> }>();

    const checkAlive = () => {
      assertOnline();
      const ctrl = activeTxControls.get(txId);
      if (!ctrl || ctrl.aborted) {
        throw new Error(ctrl?.abortReason || 'MySQL Transaction already rolled back');
      }
    };

    const getWs = (key: string): MockWsRow | undefined =>
      wsStaging.has(key) ? wsStaging.get(key) : websiteSettings.get(key);

    const txClient: any = {
      __txId: txId,
      async $queryRawUnsafe(sql: string, ...params: any[]) {
        checkAlive();
        const isExclusive = /FOR UPDATE/i.test(sql);
        const isShared = /LOCK IN SHARE MODE/i.test(sql);
        const mode: 'S' | 'X' | null = isExclusive ? 'X' : isShared ? 'S' : null;

        if (/WHERE `key` IN \(/i.test(sql)) {
          const keys = params.map(String);
          const rows: any[] = [];
          for (const k of keys) {
            if (mode) await acquireRowLock(txId, `ws:${k}`, mode);
            const r = getWs(k);
            if (r) rows.push({ key: r.key, value: r.value, description: r.description });
          }
          return rows;
        }

        if (/WHERE `key` = \?/i.test(sql)) {
          const k = String(params[0]);
          if (mode) await acquireRowLock(txId, `ws:${k}`, mode);
          const r = getWs(k);
          return r ? [{ key: r.key, value: r.value, description: r.description }] : [];
        }

        throw new Error(`Unsupported mock SQL query: ${sql}`);
      },
      async $executeRawUnsafe(sql: string, ...params: any[]) {
        checkAlive();
        if (/^INSERT IGNORE INTO `website_settings`/i.test(sql)) {
          const [id, key, value, group, description, isPublic, updatedAt] = params;
          const k = String(key);
          if (getWs(k)) return 0;
          wsStaging.set(k, {
            id: String(id),
            key: k,
            value: String(value),
            group: String(group),
            description: description === null || description === undefined ? null : String(description),
            isPublic: Boolean(isPublic),
            updatedAt: updatedAt instanceof Date ? updatedAt : new Date(),
          });
          return 1;
        }
        if (/^INSERT INTO `website_settings`/i.test(sql)) {
          const [id, key, value, group, description, isPublic, updatedAt] = params;
          const k = String(key);
          if (getWs(k)) {
            const err: any = new Error('Unique constraint failed');
            err.code = 'P2002';
            throw err;
          }
          wsStaging.set(k, {
            id: String(id),
            key: k,
            value: String(value),
            group: String(group),
            description: description === null || description === undefined ? null : String(description),
            isPublic: Boolean(isPublic),
            updatedAt: updatedAt instanceof Date ? updatedAt : new Date(),
          });
          return 1;
        }
        if (/^UPDATE `website_settings` SET `value` = \?, `description` = \?/i.test(sql)) {
          const [value, description, group, isPublic, updatedAt, key, expectedDescription] = params;
          const k = String(key);
          const existing = getWs(k);
          if (!existing) return 0;
          const exp = expectedDescription === undefined ? null : expectedDescription;
          if (existing.description !== exp) return 0;
          wsStaging.set(k, {
            ...existing,
            value: String(value),
            description: description === null || description === undefined ? null : String(description),
            group: String(group),
            isPublic: Boolean(isPublic),
            updatedAt: updatedAt instanceof Date ? updatedAt : new Date(),
          });
          return 1;
        }
        throw new Error(`Unsupported mock SQL execute: ${sql}`);
      },
      websiteSetting: {
        async findUnique({ where }: any) {
          checkAlive();
          const r = getWs(String(where?.key || ''));
          return r ? { ...r } : null;
        },
        async findMany() {
          checkAlive();
          const merged = new Map<string, MockWsRow>(websiteSettings);
          for (const [k, v] of wsStaging.entries()) merged.set(k, v);
          return Array.from(merged.values()).map((r) => ({ ...r }));
        },
        async create({ data }: any) {
          checkAlive();
          const k = String(data.key);
          if (getWs(k)) {
            const err: any = new Error('Unique constraint failed');
            err.code = 'P2002';
            throw err;
          }
          const rec: MockWsRow = {
            id: data.id || `ws-${k}`,
            key: k,
            value: String(data.value),
            group: String(data.group || 'GENERAL'),
            description: data.description ?? null,
            isPublic: Boolean(data.isPublic),
            updatedAt: new Date(),
          };
          wsStaging.set(k, rec);
          return { ...rec };
        },
      },
      productImage: {
        async findMany() {
          checkAlive();
          const merged = new Map(productImages);
          for (const [k, v] of prodImgStaging.entries()) merged.set(k, v);
          return Array.from(merged.values()).map((r) => ({ ...r }));
        },
        async create({ data }: any) {
          checkAlive();
          const rec = {
            id: String(data.id || `pi-${Date.now()}-${Math.random()}`),
            productId: String(data.productId || 'prod-1'),
            url: String(data.url),
          };
          prodImgStaging.set(rec.id, rec);
          return { ...rec };
        },
      },
      category: {
        async findMany() {
          checkAlive();
          return Array.from(categories.values()).map((r) => ({ ...r }));
        },
      },
      collection: {
        async findMany() {
          checkAlive();
          return Array.from(collections.values()).map((r) => ({ ...r }));
        },
      },
      orderItem: {
        async findMany() {
          checkAlive();
          const rows: Array<{ image: string | null }> = [];
          for (const o of orders.values()) {
            for (const item of o.items) rows.push({ image: item.image });
          }
          for (const o of orderStaging.values()) {
            for (const item of o.items) rows.push({ image: item.image });
          }
          return rows;
        },
      },
      order: {
        async create({ data }: any) {
          checkAlive();
          const items = Array.isArray(data?.items?.create)
            ? data.items.create.map((i: any) => ({ image: i.image ?? null }))
            : [];
          const rec = {
            id: String(data.id),
            orderNumber: String(data.orderNumber),
            items,
          };
          orderStaging.set(rec.id, rec);
          return {
            ...data,
            items: (data?.items?.create || []).map((i: any, idx: number) => ({
              ...i,
              id: i.id || `oi-${idx}`,
              image: i.image ?? null,
            })),
          };
        },
      },
    };

    const commit = () => {
      checkAlive();
      for (const [k, v] of wsStaging.entries()) websiteSettings.set(k, v);
      for (const [k, v] of prodImgStaging.entries()) productImages.set(k, v);
      for (const [k, v] of orderStaging.entries()) orders.set(k, v);
    };

    return { txClient, commit };
  }

  const prisma: any = {
    async $executeRawUnsafe(sql: string, ...params: any[]) {
      assertOnline();
      if (/^INSERT IGNORE INTO `website_settings`/i.test(sql)) {
        const [id, key, value, group, description, isPublic, updatedAt] = params;
        const k = String(key);
        if (websiteSettings.has(k)) return 0;
        websiteSettings.set(k, {
          id: String(id),
          key: k,
          value: String(value),
          group: String(group),
          description: description === null || description === undefined ? null : String(description),
          isPublic: Boolean(isPublic),
          updatedAt: updatedAt instanceof Date ? updatedAt : new Date(),
        });
        return 1;
      }
      throw new Error(`Unsupported top-level mock SQL execute: ${sql}`);
    },
    async $transaction<T>(fn: (tx: any) => Promise<T>, _opts?: any): Promise<T> {
      assertOnline();
      const txId = nextTxId++;
      const ctrl = {
        aborted: false,
        abortReason: '',
        heldLockKeys: new Set<string>(),
        abort(reason: string) {
          if (ctrl.aborted) return;
          ctrl.aborted = true;
          ctrl.abortReason = reason;
          // Immediately release InnoDB row locks as MySQL does upon server-side rollback/timeout!
          releaseTxLocks(txId);
        },
      };
      activeTxControls.set(txId, ctrl);
      const { txClient, commit } = createTxClient(txId);

      try {
        const result = await fn(txClient);
        if (ctrl.aborted) {
          throw new Error(ctrl.abortReason);
        }
        commit();
        return result;
      } finally {
        releaseTxLocks(txId);
        activeTxControls.delete(txId);
      }
    },
    websiteSetting: {
      async findUnique({ where }: any) {
        assertOnline();
        const r = websiteSettings.get(String(where?.key || ''));
        return r ? { ...r } : null;
      },
      async findMany() {
        assertOnline();
        return Array.from(websiteSettings.values()).map((r) => ({ ...r }));
      },
      async create({ data }: any) {
        assertOnline();
        const k = String(data.key);
        if (websiteSettings.has(k)) {
          const err: any = new Error('Unique constraint failed');
          err.code = 'P2002';
          throw err;
        }
        const rec: MockWsRow = {
          id: data.id || `ws-${k}`,
          key: k,
          value: String(data.value),
          group: String(data.group || 'GENERAL'),
          description: data.description ?? null,
          isPublic: Boolean(data.isPublic),
          updatedAt: new Date(),
        };
        websiteSettings.set(k, rec);
        return { ...rec };
      },
    },
    productImage: {
      async findMany() {
        assertOnline();
        return Array.from(productImages.values()).map((r) => ({ ...r }));
      },
    },
    category: {
      async findMany() {
        assertOnline();
        return Array.from(categories.values()).map((r) => ({ ...r }));
      },
    },
    collection: {
      async findMany() {
        assertOnline();
        return Array.from(collections.values()).map((r) => ({ ...r }));
      },
    },
    orderItem: {
      async findMany() {
        assertOnline();
        const rows: Array<{ image: string | null }> = [];
        for (const o of orders.values()) {
          for (const item of o.items) rows.push({ image: item.image });
        }
        return rows;
      },
    },
    order: {
      async create({ data }: any) {
        assertOnline();
        const items = Array.isArray(data?.items?.create)
          ? data.items.create.map((i: any) => ({ image: i.image ?? null }))
          : [];
        const rec = {
          id: String(data.id),
          orderNumber: String(data.orderNumber),
          items,
        };
        orders.set(rec.id, rec);
        return {
          ...data,
          items: (data?.items?.create || []).map((i: any, idx: number) => ({
            ...i,
            id: i.id || `oi-${idx}`,
            image: i.image ?? null,
          })),
        };
      },
    },
  };

  return {
    prisma,
    websiteSettings,
    productImages,
    orders,
    lockEvents,
    setOnline(v: boolean) {
      online = v;
    },
    abortTransaction(txId: number, reason = 'MySQL Transaction timed out and rolled back') {
      activeTxControls.get(txId)?.abort(reason);
    },
    getActiveTxIds() {
      return Array.from(activeTxControls.keys());
    },
  };
}

// ============================================================================
// 9. HARDENED CONCURRENCY, PERMANENT TOMBSTONES & TRANSACTIONAL INNODB TESTS
// ============================================================================

test('Permanent Tombstone Protection: atomic deletingKeys -> media_retired_v1:<sha256> transition blocks stale writers and key reuse forever', async () => {
  const db = createMockInnoDbMySql();
  const r2 = createMockR2Adapter();
  const tmp = makeTempFile('permanent-tombstones');

  try {
    const key = 'cms-retired-tee.webp';
    const url = r2.adapter.getFileUrl(key);
    const compositeKey = buildMediaCompositeKey('r2', key);
    r2.objects.set(key, Buffer.from('retired-img'));

    const coordinator = new MediaWriteCoordinator({
      prismaProvider: () => db.prisma,
      storageAdapterProvider: () => r2.adapter,
      localCoordinationFilePath: path.join(tmp.dir, 'coord.json'),
      localRetiredFilePath: path.join(tmp.dir, 'retired.json'),
    });
    const store = new DurableMediaStateStore({
      runtimeFilePath: tmp.filePath,
      mysqlBackend: createPrismaMySqlMediaStateBackend(() => db.prisma),
    });
    const service = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: store,
      coordinator,
      cleanupCooldownMs: 0,
      referenceProviders: createEmptyRefs({
        getPrismaClient: () => db.prisma,
      }),
    });

    // Clean up unreferenced object -> deletes from R2 and atomically inserts permanent tombstone
    const report = await service.cleanupUnreferencedMedia([url], { reason: 'retire-test' });
    assert.deepEqual(report.deletedKeys, [key]);
    assert.equal(r2.objects.has(key), false);

    // Verify permanent per-key tombstone row exists in website_settings and deletingKeys is clean
    const tombstoneRowKey = toRetiredTombstoneKey(compositeKey);
    const tombstoneRow = db.websiteSettings.get(tombstoneRowKey);
    assert.ok(tombstoneRow, 'Permanent per-key tombstone row must exist in website_settings');
    assert.equal(tombstoneRow!.group, MEDIA_TOMBSTONE_MYSQL_GROUP);
    assert.equal(tombstoneRow!.isPublic, false);

    const coordSnapshot = await coordinator.getCoordinationSnapshot();
    assert.equal(coordSnapshot.state.deletingKeys[compositeKey], undefined);

    // 1. Stale browser tab / writer attempting to reference retired key MUST be rejected with 409 MEDIA_OBJECT_RETIRED
    await assert.rejects(
      () =>
        coordinator.executeCoordinatedWrite({
          payload: { images: [url] },
          executeInTx: async (tx) => {
            await tx.productImage.create({ data: { productId: 'p-stale', url } });
          },
        }),
      (err: any) => err instanceof MediaConflictError && err.statusCode === 409 && err.code === 'MEDIA_OBJECT_RETIRED'
    );
    assert.equal(db.productImages.size, 0, 'Stale write must commit zero product references');

    // 2. registerPendingUpload() MUST NEVER clear or reuse a permanently retired key -> 409 MEDIA_KEY_PERMANENTLY_RETIRED
    await assert.rejects(
      () => service.registerPendingUpload({ url, ownerId: 'admin-1', storageKey: key, provider: 'r2' }),
      (err: any) =>
        err instanceof MediaConflictError &&
        err.statusCode === 409 &&
        err.code === 'MEDIA_KEY_PERMANENTLY_RETIRED'
    );
    assert.ok(db.websiteSettings.has(tombstoneRowKey), 'Permanent tombstone must never be cleared or pruned');
  } finally {
    tmp.cleanup();
  }
});

test('Single-Transaction InnoDB S/X Locking: paused Worker A blocks Worker B Gate 5 until commit, then Gate 5 sees committed reference and aborts delete', async () => {
  const db = createMockInnoDbMySql();
  const r2 = createMockR2Adapter();
  const tmp = makeTempFile('innodb-sx-lock');

  try {
    const key = 'cms-concurrent-shared.webp';
    const url = r2.adapter.getFileUrl(key);
    r2.objects.set(key, Buffer.from('live-image'));

    const workerACoordinator = new MediaWriteCoordinator({
      workerId: 'worker-A',
      prismaProvider: () => db.prisma,
      storageAdapterProvider: () => r2.adapter,
    });
    const workerBCoordinator = new MediaWriteCoordinator({
      workerId: 'worker-B',
      prismaProvider: () => db.prisma,
      storageAdapterProvider: () => r2.adapter,
    });
    const workerBStore = new DurableMediaStateStore({
      runtimeFilePath: tmp.filePath,
      mysqlBackend: createPrismaMySqlMediaStateBackend(() => db.prisma),
    });
    const workerBCleanup = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: workerBStore,
      coordinator: workerBCoordinator,
      cleanupCooldownMs: 0,
      referenceProviders: createEmptyRefs({
        getPrismaClient: () => db.prisma,
      }),
    });

    let signalWorkerAInsideTx!: () => void;
    const workerAInsideTx = new Promise<void>((resolve) => {
      signalWorkerAInsideTx = resolve;
    });
    let resumeWorkerA!: () => void;
    const workerAResumeGate = new Promise<void>((resolve) => {
      resumeWorkerA = resolve;
    });

    // Worker A starts Tx_W (acquires InnoDB LOCK IN SHARE MODE on media_write_coordination_v1) and pauses before committing!
    const workerAPromise = workerACoordinator.executeCoordinatedWrite({
      payload: { images: [url] },
      executeInTx: async (tx) => {
        signalWorkerAInsideTx();
        await workerAResumeGate;
        // Write reference inside the SAME transaction before committing
        await tx.productImage.create({ data: { productId: 'prod-A', url } });
        return 'saved-by-A';
      },
    });

    await workerAInsideTx;

    // Worker B starts cleanup while Worker A is paused mid-transaction!
    let workerBFinished = false;
    const workerBPromise = workerBCleanup
      .cleanupUnreferencedMedia([url], { reason: 'worker-B-sweep' })
      .then((res) => {
        workerBFinished = true;
        return res;
      });

    // Yield event loop: Worker B MUST be blocked on InnoDB FOR UPDATE lock and NOT finish or delete!
    await new Promise((r) => setTimeout(r, 25));
    assert.equal(workerBFinished, false, 'Worker B Gate 5 MUST wait on InnoDB FOR UPDATE while Worker A holds LOCK IN SHARE MODE');
    assert.equal(r2.deleteCalls.length, 0);

    // Now Worker A resumes and commits its ProductImage reference
    resumeWorkerA();
    const workerAResult = await workerAPromise;
    assert.equal(workerAResult, 'saved-by-A');

    // Worker B now acquires FOR UPDATE, sees Worker A's committed row under READ COMMITTED, and preserves the object!
    const workerBReport = await workerBPromise;
    assert.deepEqual(workerBReport.deletedKeys, []);
    assert.deepEqual(workerBReport.preservedReferencedKeys, [key]);
    assert.equal(r2.deleteCalls.length, 0);
    assert.equal(r2.objects.has(key), true);
  } finally {
    tmp.cleanup();
  }
});

test('Former Lease-Expiry Hazard Eliminated: paused Worker A whose Tx_W times out/rolls back CANNOT commit after Worker B fences and deletes', async () => {
  const db = createMockInnoDbMySql();
  const r2 = createMockR2Adapter();
  const tmp = makeTempFile('tx-timeout-safety');

  try {
    const key = 'cms-timeout-hazard.webp';
    const url = r2.adapter.getFileUrl(key);
    r2.objects.set(key, Buffer.from('hazard-img'));

    const workerACoordinator = new MediaWriteCoordinator({
      workerId: 'worker-A',
      prismaProvider: () => db.prisma,
      storageAdapterProvider: () => r2.adapter,
    });
    const workerBCoordinator = new MediaWriteCoordinator({
      workerId: 'worker-B',
      prismaProvider: () => db.prisma,
      storageAdapterProvider: () => r2.adapter,
    });
    const workerBStore = new DurableMediaStateStore({
      runtimeFilePath: tmp.filePath,
      mysqlBackend: createPrismaMySqlMediaStateBackend(() => db.prisma),
    });
    const workerBCleanup = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: workerBStore,
      coordinator: workerBCoordinator,
      cleanupCooldownMs: 0,
      referenceProviders: createEmptyRefs({
        getPrismaClient: () => db.prisma,
      }),
    });

    let workerATxId = 0;
    let signalPaused!: () => void;
    const workerAPaused = new Promise<void>((resolve) => {
      signalPaused = resolve;
    });
    let wakeWorkerA!: () => void;
    const workerAWakeGate = new Promise<void>((resolve) => {
      wakeWorkerA = resolve;
    });

    // 1. Worker A enters Tx_W and freezes (GC pause / network stall)
    const workerAPromise = workerACoordinator.executeCoordinatedWrite({
      payload: { images: [url] },
      executeInTx: async (tx) => {
        workerATxId = tx.__txId;
        signalPaused();
        await workerAWakeGate;
        // Worker A wakes up AFTER its DB transaction timed out and tries to insert the reference!
        await tx.productImage.create({ data: { productId: 'prod-late', url } });
      },
    });

    await workerAPaused;
    assert.ok(workerATxId > 0);

    // 2. Worker B begins cleanup -> blocked waiting for Worker A's InnoDB shared lock
    const workerBPromise = workerBCleanup.cleanupUnreferencedMedia([url], { reason: 'cleanup-after-timeout' });
    await new Promise((r) => setTimeout(r, 15));

    // 3. MySQL server aborts / times out Worker A's transaction -> rolls back & releases shared lock
    db.abortTransaction(workerATxId, 'Simulated MySQL interactive transaction timeout');

    // 4. Worker B now acquires FOR UPDATE, confirms 0 references, fences, deletes from R2, and permanently retires K
    const reportB = await workerBPromise;
    assert.deepEqual(reportB.deletedKeys, [key]);
    assert.equal(r2.objects.has(key), false);

    // 5. Worker A wakes up: its old Tx_W MUST fail to commit (rolled back by DB!)
    wakeWorkerA();
    await assert.rejects(() => workerAPromise, /timeout|rolled back|unavailable/i);
    assert.equal(db.productImages.size, 0, 'Aborted Tx_W MUST NOT commit any reference');

    // 6. If Worker A retries in a brand-new Tx_W2, permanent tombstone rejects it with 409 MEDIA_OBJECT_RETIRED!
    await assert.rejects(
      () =>
        workerACoordinator.executeCoordinatedWrite({
          payload: { images: [url] },
          executeInTx: async (tx) => {
            await tx.productImage.create({ data: { productId: 'prod-retry', url } });
          },
        }),
      (err: any) => err instanceof MediaConflictError && err.statusCode === 409 && err.code === 'MEDIA_OBJECT_RETIRED'
    );
    assert.equal(db.productImages.size, 0);
  } finally {
    tmp.cleanup();
  }
});

test('Crash Reconciliation: crashed worker fence is NEVER resurrected for writers; reconciler drives forward-completion to permanent tombstone', async () => {
  const db = createMockInnoDbMySql();
  let r2Outage = true;
  const objects = new Map<string, Buffer>([['cms-crashed-delete.webp', Buffer.from('orphan-data')]]);
  const deleteCalls: string[] = [];
  const publicBaseUrl = 'https://pub-preview-test.r2.dev';

  const flakyR2 = new CloudflareR2StorageAdapter({
    bucketName: 'toriwear-preview-mock',
    endpoint: 'https://preview-mock-account.r2.cloudflarestorage.com',
    publicBaseUrl,
    s3Client: {
      async send(command: any) {
        if (command instanceof HeadObjectCommand) {
          const k = String(command.input.Key || '');
          if (!objects.has(k)) {
            const err: any = new Error('NotFound');
            err.name = 'NotFound';
            err.$metadata = { httpStatusCode: 404 };
            throw err;
          }
          return { ContentLength: objects.get(k)!.length };
        }
        if (command instanceof DeleteObjectCommand) {
          const k = String(command.input.Key || '');
          deleteCalls.push(k);
          if (r2Outage) {
            const err: any = new Error('Simulated R2 503 outage');
            err.$metadata = { httpStatusCode: 503 };
            throw err;
          }
          objects.delete(k);
          return {};
        }
        throw new Error('Unexpected S3 command');
      },
    },
  });

  const tmp = makeTempFile('crash-reconcile');
  let clock = 20_000_000;

  try {
    const key = 'cms-crashed-delete.webp';
    const url = flakyR2.getFileUrl(key);
    const compositeKey = buildMediaCompositeKey('r2', key);

    const crashedCoordinator = new MediaWriteCoordinator({
      workerId: 'worker-crashed',
      prismaProvider: () => db.prisma,
      storageAdapterProvider: () => flakyR2,
      now: () => clock,
    });
    const recoveryCoordinator = new MediaWriteCoordinator({
      workerId: 'worker-reconciler',
      prismaProvider: () => db.prisma,
      storageAdapterProvider: () => flakyR2,
      now: () => clock,
    });
    const recoveryService = new MediaCleanupService({
      storageAdapterProvider: () => flakyR2,
      stateStore: new DurableMediaStateStore({
        runtimeFilePath: tmp.filePath,
        mysqlBackend: createPrismaMySqlMediaStateBackend(() => db.prisma),
        now: () => clock,
      }),
      coordinator: recoveryCoordinator,
      now: () => clock,
      referenceProviders: createEmptyRefs({ getPrismaClient: () => db.prisma }),
    });

    // 1. Worker 1 acquires deletion fence and crashes BEFORE deleting from R2 (fence stays IN_PROGRESS)
    const fenceRes = await crashedCoordinator.acquireDeletionFenceAtomic({
      provider: 'r2',
      storageKey: key,
      isReferencedInTx: async () => false,
    });
    assert.equal(fenceRes.status, 'fenced');

    // 2. Advance clock far past 60s stale window -> writers MUST STILL be blocked (zero timer-based resurrection!)
    clock += 120_000;
    await assert.rejects(
      () =>
        recoveryCoordinator.executeCoordinatedWrite({
          payload: { images: [url] },
          executeInTx: async (tx) => {
            await tx.productImage.create({ data: { productId: 'p-blocked', url } });
          },
        }),
      (err: any) => err instanceof MediaConflictError && err.statusCode === 409 && err.code === 'MEDIA_OBJECT_DELETING'
    );

    // 3. Reconciler runs while R2 is STILL failing -> key moves to UNCERTAIN and stays blocked (NEVER unblocked!)
    const reconcile1 = await recoveryService.reconcileUncertainDeletingKeys();
    assert.equal(reconcile1.reconciledRetiredKeys.length, 0);
    assert.equal(reconcile1.stillUncertainKeys.length, 1);

    const snapAfterFail = await recoveryCoordinator.getCoordinationSnapshot();
    assert.equal(snapAfterFail.state.deletingKeys[compositeKey]?.status, 'UNCERTAIN');

    await assert.rejects(
      () =>
        recoveryCoordinator.executeCoordinatedWrite({
          payload: { images: [url] },
          executeInTx: async () => {},
        }),
      (err: any) => err instanceof MediaConflictError && err.code === 'MEDIA_OBJECT_DELETING'
    );

    // 4. R2 recovers -> reconciler runs again, completes delete, verifies fileExists === false, and permanently retires K!
    r2Outage = false;
    clock += 120_000;
    const reconcile2 = await recoveryService.reconcileUncertainDeletingKeys();
    assert.deepEqual(reconcile2.reconciledRetiredKeys, [key]);
    assert.equal(reconcile2.stillUncertainKeys.length, 0);
    assert.equal(objects.has(key), false);
    assert.ok(db.websiteSettings.has(toRetiredTombstoneKey(compositeKey)));

    // 5. Writer is now permanently rejected with 409 MEDIA_OBJECT_RETIRED
    await assert.rejects(
      () =>
        recoveryCoordinator.executeCoordinatedWrite({
          payload: { images: [url] },
          executeInTx: async () => {},
        }),
      (err: any) => err instanceof MediaConflictError && err.code === 'MEDIA_OBJECT_RETIRED'
    );
  } finally {
    tmp.cleanup();
  }
});

test('MySQL Outage Policy: cleanup & media-bearing writes fail closed (503), pure non-media writes proceed, and checkout strips unverified managed OrderItem.image to null', async () => {
  const db = createMockInnoDbMySql();
  const r2 = createMockR2Adapter();
  const tmp = makeTempFile('mysql-outage-policy');

  const key = 'cms-outage-protected.webp';
  const managedUrl = r2.adapter.getFileUrl(key);
  const staticUrl = '/assets/toriwear-official-logo.png';
  r2.objects.set(key, Buffer.from('protected'));

  const coordinator = new MediaWriteCoordinator({
    prismaProvider: () => db.prisma,
    storageAdapterProvider: () => r2.adapter,
  });
  const service = new MediaCleanupService({
    storageAdapterProvider: () => r2.adapter,
    stateStore: new DurableMediaStateStore({
      runtimeFilePath: tmp.filePath,
      mysqlBackend: createPrismaMySqlMediaStateBackend(() => db.prisma),
    }),
    coordinator,
    cleanupCooldownMs: 0,
    referenceProviders: createEmptyRefs({ getPrismaClient: () => db.prisma }),
  });

  // Simulate MySQL outage!
  db.setOnline(false);

  try {
    // 1. Cleanup MUST fail closed with zero storage deletions
    const cleanupReport = await service.cleanupUnreferencedMedia([managedUrl], { reason: 'outage-sweep' });
    assert.equal(cleanupReport.abortedFailClosed, true);
    assert.deepEqual(cleanupReport.deletedKeys, []);
    assert.equal(r2.deleteCalls.length, 0);
    assert.equal(r2.objects.has(key), true);

    // 2. Media-bearing admin write MUST fail closed with 503 MEDIA_COORDINATION_UNAVAILABLE
    await assert.rejects(
      () =>
        coordinator.executeCoordinatedWrite({
          payload: { name: 'Hoodie', images: [managedUrl] },
          executeInTx: async () => 'must-not-run',
        }),
      (err: any) =>
        err instanceof MediaCoordinationUnavailableError &&
        err.statusCode === 503 &&
        err.code === 'MEDIA_COORDINATION_UNAVAILABLE'
    );

    // 3. Editor media lease for managed URL MUST fail closed with 503 MEDIA_COORDINATION_UNAVAILABLE
    await assert.rejects(
      () =>
        service.upsertEditorMediaLease({
          sessionId: 'sess-outage',
          ownerId: 'admin-1',
          urls: [managedUrl],
        }),
      (err: any) => err instanceof MediaCoordinationUnavailableError && err.statusCode === 503
    );

    // 4. Pure non-media write (0 managed keys) proceeds non-fatally even during coordination outage!
    let nonMediaRan = false;
    const nonMediaRes = await coordinator.executeCoordinatedWrite({
      payload: { codFee: 99, logoUrl: staticUrl },
      executeInTx: async () => {
        nonMediaRan = true;
        return 'non-media-ok';
      },
    });
    assert.equal(nonMediaRan, true);
    assert.equal(nonMediaRes, 'non-media-ok');

    // 5. Checkout resilience: when a managed OrderItem.image is blocked (e.g. permanently retired or coordination unavailable),
    //    OrderRepository.create strips the unsafe managed OrderItem.image to null while preserving static URLs and completing checkout!
    db.setOnline(true);
    // Permanently retire a local-managed image using the default local storage adapter so OrderRepository hits real conflict
    const localUrl = '/generated-assets/cms-checkout-retired.webp';
    const localComposite = buildMediaCompositeKey('local', 'cms-checkout-retired.webp');
    const localTombstoneKey = toRetiredTombstoneKey(localComposite);
    db.websiteSettings.set(localTombstoneKey, {
      id: 'ret-checkout',
      key: localTombstoneKey,
      value: JSON.stringify({
        compositeKey: localComposite,
        provider: 'local',
        storageKey: 'cms-checkout-retired.webp',
        retiredAt: Date.now(),
        workerId: 'test',
        reason: 'retired',
      }),
      group: MEDIA_TOMBSTONE_MYSQL_GROUP,
      description: 'rev:1:0000000000000001',
      isPublic: false,
      updatedAt: new Date(),
    });

    setPrismaClientOverrideForTests(db.prisma);
    const orderRepo = new OrderRepository();
    const orderInput: OrderRecord = {
      id: `ord-test-${Date.now()}`,
      orderNumber: `TW-TEST-${Date.now()}`,
      customerName: 'Preview Tester',
      customerEmail: 'preview@toriwear.test',
      customerPhone: '9999999999',
      subtotal: 1999,
      discount: 0,
      tax: 0,
      shippingFee: 0,
      total: 1999,
      currency: 'INR',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      fulfillmentStatus: 'CONFIRMED',
      shippingAddress: {
        fullName: 'Preview Tester',
        phone: '9999999999',
        email: 'preview@toriwear.test',
        addressLine1: '123 Test Street',
        city: 'Mumbai',
        state: 'MH',
        pincode: '400001',
      },
      items: [
        {
          id: 'item-1',
          productId: 'p1',
          productName: 'Retired Image Tee',
          variantId: 'v1',
          sku: 'SKU-1',
          size: 'L',
          color: 'Black',
          unitPrice: 1199,
          quantity: 1,
          totalPrice: 1199,
          image: localUrl, // Managed & permanently retired -> MUST be stripped to empty/null!
        },
        {
          id: 'item-2',
          productId: 'p2',
          productName: 'Static Logo Tee',
          variantId: 'v2',
          sku: 'SKU-2',
          size: 'M',
          color: 'White',
          unitPrice: 800,
          quantity: 1,
          totalPrice: 800,
          image: staticUrl, // Unmanaged static asset -> MUST be preserved!
        },
      ],
      timeline: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const createdOrder = await orderRepo.create(orderInput);
    assert.equal(createdOrder.id, orderInput.id);
    const persisted = db.orders.get(orderInput.id);
    assert.ok(persisted, 'Order must be committed even when managed item image is retired');
    assert.equal(persisted!.items[0].image, null, 'Blocked managed OrderItem.image must be stripped to null');
    assert.equal(persisted!.items[1].image, staticUrl, 'Unmanaged static OrderItem.image must be preserved');
  } finally {
    setPrismaClientOverrideForTests(null);
    tmp.cleanup();
  }
});

test('Strict Payload Enumeration: fails closed (400 MEDIA_ENUMERATION_INCOMPLETE) on opaque/over-depth payloads and extracts nested JSON + HTML URLs', async () => {
  const r2 = createMockR2Adapter();
  const urlA = r2.adapter.getFileUrl('nested-json-hero.webp');
  const urlB = r2.adapter.getFileUrl('html-banner.webp');

  // 1. Nested JSON string & HTML attribute URLs are extracted completely
  const nestedPayload = {
    cmsBlob: JSON.stringify({
      hero: { bg: urlA },
      richText: `<section><img src="${urlB}" alt="hero" /></section>`,
    }),
  };
  const extracted = extractManagedKeysStrict(nestedPayload, r2.adapter);
  assert.equal(extracted.complete, true);
  assert.deepEqual(extracted.storageKeys, ['html-banner.webp', 'nested-json-hero.webp']);

  // 2. Opaque binary payload fails closed -> complete === false
  const binaryCheck = extractManagedKeysStrict({ blob: Buffer.from('raw-bytes') }, r2.adapter);
  assert.equal(binaryCheck.complete, false);

  // 3. Over-depth payload fails closed -> 400 MEDIA_ENUMERATION_INCOMPLETE inside executeCoordinatedWrite
  let deep: any = { url: urlA };
  for (let i = 0; i < 40; i++) {
    deep = { child: deep };
  }
  const coordinator = new MediaWriteCoordinator({
    prismaProvider: () => null,
    storageAdapterProvider: () => r2.adapter,
  });
  await assert.rejects(
    () =>
      coordinator.executeCoordinatedWrite({
        payload: deep,
        executeInTx: async () => 'must-not-run',
      }),
    (err: any) =>
      err instanceof MediaEnumerationIncompleteError &&
      err.statusCode === 400 &&
      err.code === 'MEDIA_ENUMERATION_INCOMPLETE'
  );
});

test('Rapid Same-Millisecond Concurrent Updates: InnoDB FOR UPDATE + unique description revision tokens never collide or lose entries when clock is frozen', async () => {
  const db = createMockInnoDbMySql();
  const r2 = createMockR2Adapter();
  const tmpA = makeTempFile('same-ms-A');
  const tmpB = makeTempFile('same-ms-B');
  const frozenClock = 55_555_555; // Exact same millisecond across all concurrent workers!

  try {
    const storeA = new DurableMediaStateStore({
      runtimeFilePath: tmpA.filePath,
      mysqlBackend: createPrismaMySqlMediaStateBackend(() => db.prisma),
      instanceId: 'worker-A',
      now: () => frozenClock,
    });
    const storeB = new DurableMediaStateStore({
      runtimeFilePath: tmpB.filePath,
      mysqlBackend: createPrismaMySqlMediaStateBackend(() => db.prisma),
      instanceId: 'worker-B',
      now: () => frozenClock,
    });
    const serviceA = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: storeA,
      coordinator: new MediaWriteCoordinator({
        workerId: 'worker-A',
        prismaProvider: () => db.prisma,
        storageAdapterProvider: () => r2.adapter,
        now: () => frozenClock,
      }),
      now: () => frozenClock,
      referenceProviders: createEmptyRefs({ getPrismaClient: () => db.prisma }),
    });
    const serviceB = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: storeB,
      coordinator: new MediaWriteCoordinator({
        workerId: 'worker-B',
        prismaProvider: () => db.prisma,
        storageAdapterProvider: () => r2.adapter,
        now: () => frozenClock,
      }),
      now: () => frozenClock,
      referenceProviders: createEmptyRefs({ getPrismaClient: () => db.prisma }),
    });

    // Fire 10 concurrent mutations from 2 distinct worker instances at the exact same millisecond timestamp
    await Promise.all([
      ...Array.from({ length: 5 }, (_, i) =>
        serviceA.registerPendingUpload({
          provider: 'r2',
          storageKey: `same-ms-a-${i}.webp`,
          url: r2.adapter.getFileUrl(`same-ms-a-${i}.webp`),
          ownerId: 'admin-A',
        })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        serviceB.registerPendingUpload({
          provider: 'r2',
          storageKey: `same-ms-b-${i}.webp`,
          url: r2.adapter.getFileUrl(`same-ms-b-${i}.webp`),
          ownerId: 'admin-B',
        })
      ),
    ]);

    // Verify zero entries lost and unique rev:<version>:<hex-nonce> token persisted in WebsiteSetting.description
    const wsRow = db.websiteSettings.get(MEDIA_CLEANUP_MYSQL_KEY);
    assert.ok(wsRow);
    assert.match(String(wsRow!.description || ''), /^rev:\d+:[0-9a-f]{16}$/);

    const finalState = JSON.parse(wsRow!.value);
    assert.equal(Object.keys(finalState.pendingUploads).length, 10);
  } finally {
    tmpA.cleanup();
    tmpB.cleanup();
  }
});

test('Gap 1 TOCTOU Verification: concurrent write beginning during awaited storage.fileExists() is caught by Gate 5 authoritative audit before delete', async () => {
  const db = createMockInnoDbMySql();
  const r2 = createMockR2Adapter();
  const tmp = makeTempFile('gap1-fileexists-toctou');

  try {
    const key = 'cms-gap1-race.webp';
    const url = r2.adapter.getFileUrl(key);
    r2.objects.set(key, Buffer.from('gap1-img'));

    const writerCoordinator = new MediaWriteCoordinator({
      workerId: 'writer-worker',
      prismaProvider: () => db.prisma,
      storageAdapterProvider: () => r2.adapter,
    });
    const cleanupCoordinator = new MediaWriteCoordinator({
      workerId: 'cleanup-worker',
      prismaProvider: () => db.prisma,
      storageAdapterProvider: () => r2.adapter,
    });

    let raceTriggered = false;
    // Wrap r2.adapter.fileExists to simulate a concurrent worker saving a product reference
    // right during the awaited network round-trip of storage.fileExists()!
    const racingAdapter: typeof r2.adapter = Object.create(r2.adapter);
    racingAdapter.fileExists = async (storageKey: string) => {
      const exists = await r2.adapter.fileExists(storageKey);
      if (!raceTriggered && storageKey === key) {
        raceTriggered = true;
        await writerCoordinator.executeCoordinatedWrite({
          payload: { images: [url] },
          executeInTx: async (tx) => {
            await tx.productImage.create({ data: { productId: 'prod-during-head', url } });
          },
        });
      }
      return exists;
    };

    const cleanupService = new MediaCleanupService({
      storageAdapterProvider: () => racingAdapter,
      stateStore: new DurableMediaStateStore({
        runtimeFilePath: tmp.filePath,
        mysqlBackend: createPrismaMySqlMediaStateBackend(() => db.prisma),
      }),
      coordinator: cleanupCoordinator,
      cleanupCooldownMs: 0,
      referenceProviders: createEmptyRefs({ getPrismaClient: () => db.prisma }),
    });

    const report = await cleanupService.cleanupUnreferencedMedia([url], { reason: 'gap1-test' });
    assert.equal(raceTriggered, true);
    assert.deepEqual(report.deletedKeys, []);
    assert.deepEqual(report.preservedReferencedKeys, [key]);
    assert.equal(r2.deleteCalls.length, 0);
    assert.equal(r2.objects.has(key), true);
  } finally {
    tmp.cleanup();
  }
});

test('MySQL coordination policy: explicit USE_MYSQL=false allows local single-process coordination and never uses MySQL', async () => {
  const r2 = createMockR2Adapter();
  const tmpState = makeTempFile('explicit-mysql-disabled-state');
  const tmpCoord = makeTempFile('explicit-mysql-disabled-coord');
  const tmpRetired = makeTempFile('explicit-mysql-disabled-retired');

  try {
    let prismaCalled = false;
    const coordinator = new MediaWriteCoordinator({
      workerId: 'local-explicit-false',
      // Even if MySQL env vars or a throwing Prisma provider exist, explicit USE_MYSQL=false stays local
      envProvider: () => ({
        USE_MYSQL: 'false',
        DB_HOST: '10.0.0.5',
        DATABASE_URL: 'mysql://user:pass@10.0.0.5:3306/toriwear',
        NODE_ENV: 'production',
      }),
      prismaProvider: () => {
        prismaCalled = true;
        throw new Error('Prisma must not be invoked when USE_MYSQL=false');
      },
      storageAdapterProvider: () => r2.adapter,
      localCoordinationFilePath: tmpCoord.filePath,
      localRetiredFilePath: tmpRetired.filePath,
    });

    const expectation = evaluateMySqlCoordinationExpectation({
      USE_MYSQL: 'false',
      DB_HOST: '10.0.0.5',
      NODE_ENV: 'production',
    });
    assert.equal(expectation.mysqlExpected, false);
    assert.equal(expectation.explicitlyDisabled, true);

    assert.equal(coordinator.resolveCoordinationBackend().mode, 'local-single-process');
    assert.equal(coordinator.isMySqlCoordinationActive(), false);
    assert.equal(prismaCalled, false);

    const activeKey = 'local-mode-active.webp';
    const activeUrl = r2.adapter.getFileUrl(activeKey);
    const orphanKey = 'local-mode-orphan.webp';
    const orphanUrl = r2.adapter.getFileUrl(orphanKey);
    r2.objects.set(activeKey, Buffer.from('active-bytes'));
    r2.objects.set(orphanKey, Buffer.from('orphan-bytes'));

    const savedUrls = new Set<string>();
    await coordinator.executeCoordinatedWrite({
      payload: { images: [activeUrl] },
      executeInTx: async () => {
        savedUrls.add(activeUrl);
      },
    });
    assert.equal(savedUrls.has(activeUrl), true);

    const cleanupService = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: new DurableMediaStateStore({
        runtimeFilePath: tmpState.filePath,
      }),
      coordinator,
      cleanupCooldownMs: 0,
      referenceProviders: createEmptyRefs({
        getAllProducts: async () => [{ id: 'prod-local-1', images: Array.from(savedUrls) }],
      }),
    });

    const report = await cleanupService.cleanupUnreferencedMedia([activeUrl, orphanUrl], {
      reason: 'explicit-local-mode-test',
    });
    assert.equal(report.abortedFailClosed, false);
    assert.deepEqual(report.preservedReferencedKeys, [activeKey]);
    assert.deepEqual(report.deletedKeys, [orphanKey]);
    assert.equal(r2.objects.has(activeKey), true);
    assert.equal(r2.objects.has(orphanKey), false);
    assert.equal(await coordinator.isKeyPermanentlyRetired(`r2:${orphanKey}`), true);

    // Retired key remains permanently blocked in local mode
    await assert.rejects(
      () =>
        coordinator.executeCoordinatedWrite({
          payload: { images: [orphanUrl] },
          executeInTx: async () => {
            savedUrls.add(orphanUrl);
          },
        }),
      (err: any) => err instanceof MediaConflictError && err.statusCode === 409 && err.code === 'MEDIA_OBJECT_RETIRED'
    );
    assert.equal(prismaCalled, false);
  } finally {
    tmpState.cleanup();
    tmpCoord.cleanup();
    tmpRetired.cleanup();
  }
});

test('MySQL coordination fail-closed: MySQL configured or expected with Prisma unavailable/failing rejects writes, aborts cleanup with zero deletions, and never falls back to local JSON', async () => {
  const r2 = createMockR2Adapter();
  const tmpState = makeTempFile('mysql-prisma-unavail-state');
  const tmpCoord = makeTempFile('mysql-prisma-unavail-coord');
  const tmpRetired = makeTempFile('mysql-prisma-unavail-retired');

  try {
    const key = 'fail-closed-prisma-missing.webp';
    const url = r2.adapter.getFileUrl(key);
    r2.objects.set(key, Buffer.from('must-never-delete'));

    const scenarios: Array<{
      name: string;
      env: NodeJS.ProcessEnv;
      prismaProvider: () => any;
    }> = [
      {
        name: 'USE_MYSQL=true with null Prisma client',
        env: { USE_MYSQL: 'true', NODE_ENV: 'development' },
        prismaProvider: () => null,
      },
      {
        name: 'DB_HOST/DB_NAME/DB_USER configured with Prisma missing $transaction',
        env: { DB_HOST: '127.0.0.1', DB_NAME: 'toriwear', DB_USER: 'app', NODE_ENV: 'development' },
        prismaProvider: () => ({}),
      },
      {
        name: 'DATABASE_URL=mysql://... configured with Prisma init throwing',
        env: { DATABASE_URL: 'mysql://app:secret@127.0.0.1:3306/toriwear', NODE_ENV: 'development' },
        prismaProvider: () => {
          throw new Error('PrismaClientInitializationError: engine failed to start');
        },
      },
      {
        name: 'NODE_ENV=production with null Prisma client',
        env: { NODE_ENV: 'production' },
        prismaProvider: () => null,
      },
    ];

    for (const scenario of scenarios) {
      const expectation = evaluateMySqlCoordinationExpectation(scenario.env);
      assert.equal(expectation.mysqlExpected, true, `${scenario.name}: expected mysqlExpected=true`);
      assert.equal(expectation.explicitlyDisabled, false, `${scenario.name}: expected explicitlyDisabled=false`);

      const coordinator = new MediaWriteCoordinator({
        workerId: `worker-unavail-${scenario.name}`,
        envProvider: () => scenario.env,
        prismaProvider: scenario.prismaProvider,
        storageAdapterProvider: () => r2.adapter,
        localCoordinationFilePath: tmpCoord.filePath,
        localRetiredFilePath: tmpRetired.filePath,
      });

      const backend = coordinator.resolveCoordinationBackend();
      assert.equal(backend.mode, 'unavailable', `${scenario.name}: backend must be unavailable`);
      assert.equal(coordinator.isMySqlCoordinationActive(), false);

      // 1. Media-bearing writes must fail closed with 503 and NEVER execute the mutation
      let mutationExecuted = false;
      await assert.rejects(
        () =>
          coordinator.executeCoordinatedWrite({
            payload: { images: [url] },
            executeInTx: async () => {
              mutationExecuted = true;
            },
          }),
        (err: any) =>
          err instanceof MediaCoordinationUnavailableError &&
          err.statusCode === 503 &&
          err.code === 'MEDIA_COORDINATION_UNAVAILABLE',
        `${scenario.name}: executeCoordinatedWrite must fail closed with 503`
      );
      assert.equal(mutationExecuted, false, `${scenario.name}: write callback must never execute`);

      // 2. Direct key assertion must fail closed with 503
      await assert.rejects(
        () => coordinator.assertKeysNotRetiredOrDeleting([`r2:${key}`]),
        (err: any) => err instanceof MediaCoordinationUnavailableError && err.statusCode === 503,
        `${scenario.name}: assertKeysNotRetiredOrDeleting must fail closed with 503`
      );

      // 3. Snapshot, retirement check, and tombstone finalization must fail closed with 503
      await assert.rejects(
        () => coordinator.getCoordinationSnapshot(),
        (err: any) => err instanceof MediaCoordinationUnavailableError && err.statusCode === 503
      );
      await assert.rejects(
        () => coordinator.isKeyPermanentlyRetired(`r2:${key}`),
        (err: any) => err instanceof MediaCoordinationUnavailableError && err.statusCode === 503
      );
      await assert.rejects(
        () =>
          coordinator.finalizeDeletionFenceToPermanentTombstone({
            provider: 'r2',
            storageKey: key,
            reason: 'test',
          }),
        (err: any) => err instanceof MediaCoordinationUnavailableError && err.statusCode === 503
      );

      // 4. Reconciler must claim nothing
      const claimed = await coordinator.claimReconcilableDeletingFences('r2');
      assert.deepEqual(claimed, [], `${scenario.name}: claimReconcilableDeletingFences must return []`);

      // 5. Cleanup must abort fail-closed and perform ZERO storage deletions
      const cleanupService = new MediaCleanupService({
        storageAdapterProvider: () => r2.adapter,
        stateStore: new DurableMediaStateStore({
          runtimeFilePath: tmpState.filePath,
        }),
        coordinator,
        cleanupCooldownMs: 0,
        referenceProviders: createEmptyRefs(),
      });

      const report = await cleanupService.cleanupUnreferencedMedia([url], {
        reason: `fail-closed-${scenario.name}`,
      });
      assert.equal(report.abortedFailClosed, true, `${scenario.name}: cleanup must abort fail-closed`);
      assert.deepEqual(report.deletedKeys, []);
      assert.equal(r2.deleteCalls.length, 0, `${scenario.name}: zero storage deletes permitted`);
      assert.equal(r2.objects.has(key), true, `${scenario.name}: R2 object must remain intact`);

      // 6. Local JSON coordination/retired files must NEVER be created (zero silent fallback)
      assert.equal(fs.existsSync(tmpCoord.filePath), false, `${scenario.name}: local coordination JSON must not be written`);
      assert.equal(fs.existsSync(tmpRetired.filePath), false, `${scenario.name}: local retired JSON must not be written`);
    }
  } finally {
    tmpState.cleanup();
    tmpCoord.cleanup();
    tmpRetired.cleanup();
  }
});

test('MySQL coordination fail-closed: MySQL configured and Prisma present, but database connection unavailable, rejects writes and aborts cleanup with zero deletions', async () => {
  const db = createMockInnoDbMySql();
  const r2 = createMockR2Adapter();
  const tmpState = makeTempFile('mysql-conn-down-state');
  const tmpCoord = makeTempFile('mysql-conn-down-coord');
  const tmpRetired = makeTempFile('mysql-conn-down-retired');

  try {
    const key = 'db-down-protected.webp';
    const url = r2.adapter.getFileUrl(key);
    r2.objects.set(key, Buffer.from('protected-during-outage'));

    const coordinator = new MediaWriteCoordinator({
      workerId: 'worker-db-down',
      envProvider: () => ({ USE_MYSQL: 'true', NODE_ENV: 'production' }),
      prismaProvider: () => db.prisma,
      storageAdapterProvider: () => r2.adapter,
      localCoordinationFilePath: tmpCoord.filePath,
      localRetiredFilePath: tmpRetired.filePath,
    });

    assert.equal(coordinator.resolveCoordinationBackend().mode, 'mysql');

    // Simulate MySQL database outage / unreachable connection
    db.setOnline(false);

    // 1. Media-bearing write fails closed with 503; callback never runs
    let mutationRan = false;
    await assert.rejects(
      () =>
        coordinator.executeCoordinatedWrite({
          payload: { images: [url] },
          executeInTx: async (tx) => {
            mutationRan = true;
            await tx.productImage.create({ data: { productId: 'prod-should-fail', url } });
          },
        }),
      (err: any) =>
        err instanceof MediaCoordinationUnavailableError &&
        err.statusCode === 503 &&
        err.code === 'MEDIA_COORDINATION_UNAVAILABLE'
    );
    assert.equal(mutationRan, false);

    // 2. Direct check / snapshot / retirement / finalize fail closed with 503 (never falling back to local JSON)
    await assert.rejects(
      () => coordinator.assertKeysNotRetiredOrDeleting([`r2:${key}`]),
      (err: any) => err instanceof MediaCoordinationUnavailableError && err.statusCode === 503
    );
    await assert.rejects(
      () => coordinator.getCoordinationSnapshot(),
      (err: any) => err instanceof MediaCoordinationUnavailableError && err.statusCode === 503
    );
    await assert.rejects(
      () => coordinator.isKeyPermanentlyRetired(`r2:${key}`),
      (err: any) => err instanceof MediaCoordinationUnavailableError && err.statusCode === 503
    );

    // 3. Cleanup aborts fail-closed without deleting any media
    const cleanupService = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: new DurableMediaStateStore({
        runtimeFilePath: tmpState.filePath,
        mysqlBackend: createPrismaMySqlMediaStateBackend(() => db.prisma),
      }),
      coordinator,
      cleanupCooldownMs: 0,
      referenceProviders: createEmptyRefs({ getPrismaClient: () => db.prisma }),
    });

    const report = await cleanupService.cleanupUnreferencedMedia([url], {
      reason: 'mysql-connection-down-test',
    });
    assert.equal(report.abortedFailClosed, true);
    assert.deepEqual(report.deletedKeys, []);
    assert.equal(r2.deleteCalls.length, 0);
    assert.equal(r2.objects.has(key), true);

    // 4. Local JSON fallback files were never touched
    assert.equal(fs.existsSync(tmpCoord.filePath), false);
    assert.equal(fs.existsSync(tmpRetired.filePath), false);
  } finally {
    tmpState.cleanup();
    tmpCoord.cleanup();
    tmpRetired.cleanup();
  }
});

test('MySQL coordination healthy path: USE_MYSQL=true with live Prisma transaction coordination continues working end-to-end', async () => {
  const db = createMockInnoDbMySql();
  const r2 = createMockR2Adapter();
  const tmpState = makeTempFile('mysql-healthy-e2e-state');
  const tmpCoord = makeTempFile('mysql-healthy-e2e-coord');
  const tmpRetired = makeTempFile('mysql-healthy-e2e-retired');

  try {
    const referencedKey = 'mysql-e2e-referenced.webp';
    const referencedUrl = r2.adapter.getFileUrl(referencedKey);
    const orphanKey = 'mysql-e2e-orphan.webp';
    const orphanUrl = r2.adapter.getFileUrl(orphanKey);
    r2.objects.set(referencedKey, Buffer.from('ref-bytes'));
    r2.objects.set(orphanKey, Buffer.from('orphan-bytes'));

    const coordinator = new MediaWriteCoordinator({
      workerId: 'worker-mysql-healthy',
      envProvider: () => ({ USE_MYSQL: 'true', NODE_ENV: 'production' }),
      prismaProvider: () => db.prisma,
      storageAdapterProvider: () => r2.adapter,
      localCoordinationFilePath: tmpCoord.filePath,
      localRetiredFilePath: tmpRetired.filePath,
    });

    assert.equal(coordinator.resolveCoordinationBackend().mode, 'mysql');
    assert.equal(coordinator.isMySqlCoordinationActive(), true);

    // 1. Coordinated write commits reference inside MySQL Tx_W
    await coordinator.executeCoordinatedWrite({
      payload: { images: [referencedUrl] },
      executeInTx: async (tx) => {
        await tx.productImage.create({ data: { productId: 'prod-e2e-1', url: referencedUrl } });
      },
    });
    assert.equal(db.productImages.size, 1);

    // 2. Cleanup preserves referenced key and deletes + permanently retires orphan key in MySQL
    const cleanupService = new MediaCleanupService({
      storageAdapterProvider: () => r2.adapter,
      stateStore: new DurableMediaStateStore({
        runtimeFilePath: tmpState.filePath,
        mysqlBackend: createPrismaMySqlMediaStateBackend(() => db.prisma),
      }),
      coordinator,
      cleanupCooldownMs: 0,
      referenceProviders: createEmptyRefs({ getPrismaClient: () => db.prisma }),
    });

    const report = await cleanupService.cleanupUnreferencedMedia([referencedUrl, orphanUrl], {
      reason: 'mysql-healthy-e2e-test',
    });
    assert.equal(report.abortedFailClosed, false);
    assert.deepEqual(report.preservedReferencedKeys, [referencedKey]);
    assert.deepEqual(report.deletedKeys, [orphanKey]);
    assert.equal(r2.objects.has(referencedKey), true);
    assert.equal(r2.objects.has(orphanKey), false);

    // 3. Permanent tombstone row exists in MySQL WebsiteSetting and blocks future reuse
    const tombstoneKey = toRetiredTombstoneKey(`r2:${orphanKey}`);
    const tombstoneRow = db.websiteSettings.get(tombstoneKey);
    assert.ok(tombstoneRow);
    assert.equal(tombstoneRow!.group, MEDIA_TOMBSTONE_MYSQL_GROUP);
    assert.equal(await coordinator.isKeyPermanentlyRetired(`r2:${orphanKey}`), true);

    await assert.rejects(
      () =>
        coordinator.executeCoordinatedWrite({
          payload: { images: [orphanUrl] },
          executeInTx: async (tx) => {
            await tx.productImage.create({ data: { productId: 'prod-reuse-fail', url: orphanUrl } });
          },
        }),
      (err: any) => err instanceof MediaConflictError && err.statusCode === 409 && err.code === 'MEDIA_OBJECT_RETIRED'
    );

    // 4. Local JSON files were never used in MySQL mode
    assert.equal(fs.existsSync(tmpCoord.filePath), false);
    assert.equal(fs.existsSync(tmpRetired.filePath), false);
  } finally {
    tmpState.cleanup();
    tmpCoord.cleanup();
    tmpRetired.cleanup();
  }
});


