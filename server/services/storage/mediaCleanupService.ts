/**
 * TORIWEAR Safe, Fail-Closed, Concurrency-Safe Media Cleanup Service
 *
 * Supports Cloudflare R2, Google Cloud Storage, and Local Storage adapters:
 * - Active-provider-only boundary (never deletes external URLs, /assets/*, or objects from other providers).
 * - Post-commit only; storage errors never break product creation, updates, deletions, or modal cancellation.
 * - Fail-closed cross-entity reference audit across:
 *     Products (all statuses & duplicates), Categories/Subcategories (including disabled),
 *     Collections, CMS front-page & store settings (excluding INTERNAL_MEDIA),
 *     Historical OrderItem snapshots, and Active Editor Media Leases.
 * - Concurrent editing & TOCTOU protection:
 *     Active Editor Media Leases + Write-Epoch Barrier & Double-Check Gate + Durable Cooldown Queue.
 * - Restart-safe dual-backed persistence via DurableMediaStateStore (MySQL WebsiteSetting CAS + atomic runtime JSON).
 */

import { getPrismaClient } from '../../db/prisma';
import { productRepository } from '../../repositories/productRepository';
import { cmsRepository } from '../../repositories/cmsRepository';
import { orderRepository } from '../../repositories/orderRepository';
import { getStorageAdapter, type StorageAdapter, type StorageProviderName } from './storageAdapter';
import {
  DurableMediaStateStore,
  MEDIA_CLEANUP_MYSQL_GROUP,
  MEDIA_CLEANUP_MYSQL_KEY,
  buildDeferredTombstoneKey,
  buildLeaseKey,
  buildLeaseTombstoneKey,
  buildMediaCompositeKey,
  buildPendingTombstoneKey,
  type DeferredCleanupRecord,
  type EditorMediaLeaseRecord,
  type PendingUploadRecord,
} from './durableMediaStateStore';

export const DEFAULT_PENDING_UPLOAD_TTL_MS = 60 * 60 * 1000; // 60 minutes
export const DEFAULT_CLEANUP_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
export const DEFAULT_CLEANUP_CLAIM_TTL_MS = 2 * 60 * 1000; // 2 minutes
export const DEFAULT_EDITOR_LEASE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_SWEEP_INTERVAL_MS = 60 * 1000; // 1 minute
export const DEFAULT_STARTUP_SWEEP_DELAY_MS = 30 * 1000; // 30 seconds
const DEFAULT_WRITE_SETTLE_TIMEOUT_MS = 3000;

export interface MediaReferenceProviders {
  getAllProducts: () => Promise<Array<{ images?: string[]; variants?: Array<{ image?: string; [key: string]: any }> }>>;
  getAllCategories: () => Promise<Array<{ image?: string; bannerImage?: string; subcategories?: Array<{ image?: string }> }>>;
  getAllCollections: () => Promise<Array<{ bannerImage?: string; heroImage?: string; image?: string }>>;
  getFrontPageCms: () => Promise<unknown>;
  getStoreSettings: () => Promise<unknown>;
  getAllOrders: () => Promise<Array<{ items?: Array<{ image?: string }> }>>;
  getPrismaClient?: () => any;
}

export interface MediaCleanupReport {
  provider: StorageProviderName;
  dryRun: boolean;
  abortedFailClosed: boolean;
  abortReason?: string;
  deletedKeys: string[];
  alreadyAbsentKeys: string[];
  preservedReferencedKeys: string[];
  skippedUnmanagedUrls: string[];
  deferredConflictKeys: string[];
  skippedClaimedKeys: string[];
  failedKeys: Array<{ storageKey: string; error: string }>;
}

export interface MediaCleanupServiceOptions {
  storageAdapterProvider?: () => StorageAdapter;
  stateStore?: DurableMediaStateStore;
  referenceProviders?: Partial<MediaReferenceProviders>;
  pendingUploadTtlMs?: number;
  cleanupCooldownMs?: number;
  claimTtlMs?: number;
  editorLeaseTtlMs?: number;
  sweepIntervalMs?: number;
  startupSweepDelayMs?: number;
  dryRun?: boolean;
  now?: () => number;
}

function parseEnvPositiveMs(envKey: string, fallback: number, allowZero = false): number {
  const raw = process.env[envKey];
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  if (allowZero && parsed >= 0) return parsed;
  if (parsed > 0) return parsed;
  return fallback;
}

function parseEnvBool(envKey: string, fallback: boolean): boolean {
  const raw = String(process.env[envKey] || '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

/**
 * Recursively extracts all string values that resemble URLs or managed media paths
 * from arbitrary CMS JSON payloads or store settings, while explicitly excluding
 * internal media cleanup state keys so pending records can never self-reference.
 */
export function extractAllMediaUrlsFromValue(value: unknown, out: Set<string>, depth = 0): void {
  if (depth > 16 || value === null || value === undefined) return;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('/generated-assets/') ||
      trimmed.startsWith('/assets/')
    ) {
      out.add(trimmed);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      extractAllMediaUrlsFromValue(item, out, depth + 1);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === MEDIA_CLEANUP_MYSQL_KEY || k === MEDIA_CLEANUP_MYSQL_GROUP) {
        continue;
      }
      extractAllMediaUrlsFromValue(v, out, depth + 1);
    }
  }
}

export class MediaCleanupService {
  private readonly getStorage: () => StorageAdapter;
  private readonly stateStore: DurableMediaStateStore;
  private readonly refs: MediaReferenceProviders;
  private readonly now: () => number;
  private readonly pendingUploadTtlMsOverride?: number;
  private readonly cleanupCooldownMsOverride?: number;
  private readonly claimTtlMsOverride?: number;
  private readonly editorLeaseTtlMsOverride?: number;
  private readonly sweepIntervalMs: number;
  private readonly startupSweepDelayMs: number;
  private readonly dryRunOverride?: boolean;

  // Write-Epoch Barrier & TOCTOU coordination
  private inFlightWriteCount = 0;
  private mediaReferenceEpoch = 0;
  private writeSettleWaiters: Array<() => void> = [];

  // In-process concurrency guards
  private readonly activeKeyLocks = new Map<string, Promise<void>>();
  private sweepInProgress = false;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;
  private sweepIntervalTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: MediaCleanupServiceOptions) {
    this.now = options?.now || (() => Date.now());
    this.getStorage = options?.storageAdapterProvider || (() => getStorageAdapter());
    this.stateStore = options?.stateStore || new DurableMediaStateStore({ now: this.now });
    this.pendingUploadTtlMsOverride = options?.pendingUploadTtlMs;
    this.cleanupCooldownMsOverride = options?.cleanupCooldownMs;
    this.claimTtlMsOverride = options?.claimTtlMs;
    this.editorLeaseTtlMsOverride = options?.editorLeaseTtlMs;
    this.sweepIntervalMs =
      options?.sweepIntervalMs ?? parseEnvPositiveMs('MEDIA_CLEANUP_SWEEP_INTERVAL_MS', DEFAULT_SWEEP_INTERVAL_MS);
    this.startupSweepDelayMs =
      options?.startupSweepDelayMs ?? parseEnvPositiveMs('MEDIA_CLEANUP_STARTUP_DELAY_MS', DEFAULT_STARTUP_SWEEP_DELAY_MS, true);
    this.dryRunOverride = options?.dryRun;

    this.refs = {
      getAllProducts: options?.referenceProviders?.getAllProducts || (() => productRepository.getAll()),
      getAllCategories:
        options?.referenceProviders?.getAllCategories || (() => productRepository.getCategories(undefined, true)),
      getAllCollections: options?.referenceProviders?.getAllCollections || (() => productRepository.getCollections()),
      getFrontPageCms: options?.referenceProviders?.getFrontPageCms || (() => cmsRepository.getFrontPageData()),
      getStoreSettings: options?.referenceProviders?.getStoreSettings || (() => cmsRepository.getStoreSettings()),
      getAllOrders: options?.referenceProviders?.getAllOrders || (() => orderRepository.getAll()),
      getPrismaClient:
        options?.referenceProviders?.getPrismaClient !== undefined
          ? options.referenceProviders.getPrismaClient
          : () => getPrismaClient(),
    };
  }

  public getStateStore(): DurableMediaStateStore {
    return this.stateStore;
  }

  public getPendingUploadTtlMs(): number {
    return this.pendingUploadTtlMsOverride ?? parseEnvPositiveMs('MEDIA_PENDING_UPLOAD_TTL_MS', DEFAULT_PENDING_UPLOAD_TTL_MS);
  }

  public getCleanupCooldownMs(): number {
    return (
      this.cleanupCooldownMsOverride ??
      parseEnvPositiveMs('MEDIA_CLEANUP_COOLDOWN_MS', DEFAULT_CLEANUP_COOLDOWN_MS, true)
    );
  }

  public getClaimTtlMs(): number {
    return this.claimTtlMsOverride ?? parseEnvPositiveMs('MEDIA_CLEANUP_CLAIM_TTL_MS', DEFAULT_CLEANUP_CLAIM_TTL_MS);
  }

  public getEditorLeaseTtlMs(): number {
    return this.editorLeaseTtlMsOverride ?? parseEnvPositiveMs('MEDIA_EDITOR_LEASE_TTL_MS', DEFAULT_EDITOR_LEASE_TTL_MS);
  }

  public isDryRun(): boolean {
    return this.dryRunOverride ?? parseEnvBool('MEDIA_CLEANUP_DRY_RUN', false);
  }

  // ==========================================================================
  // 1. WRITE-EPOCH BARRIER (CONCURRENT EDITING / TOCTOU PROTECTION)
  // ==========================================================================

  public beginMediaReferenceWrite(): void {
    this.inFlightWriteCount += 1;
    this.mediaReferenceEpoch += 1;
  }

  public endMediaReferenceWrite(): void {
    this.inFlightWriteCount = Math.max(0, this.inFlightWriteCount - 1);
    this.mediaReferenceEpoch += 1;
    if (this.inFlightWriteCount === 0 && this.writeSettleWaiters.length > 0) {
      const waiters = this.writeSettleWaiters.splice(0, this.writeSettleWaiters.length);
      for (const resolve of waiters) {
        resolve();
      }
    }
  }

  public async withMediaReferenceWrite<T>(fn: () => Promise<T>): Promise<T> {
    this.beginMediaReferenceWrite();
    try {
      return await fn();
    } finally {
      this.endMediaReferenceWrite();
    }
  }

  public getWriteEpochSnapshot(): { inFlightWriteCount: number; mediaReferenceEpoch: number } {
    return {
      inFlightWriteCount: this.inFlightWriteCount,
      mediaReferenceEpoch: this.mediaReferenceEpoch,
    };
  }

  private async waitForWritesToSettle(timeoutMs: number = DEFAULT_WRITE_SETTLE_TIMEOUT_MS): Promise<boolean> {
    if (this.inFlightWriteCount === 0) return true;
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(ok);
      };
      const waiter = () => done(true);
      this.writeSettleWaiters.push(waiter);
      const timer = setTimeout(() => {
        const idx = this.writeSettleWaiters.indexOf(waiter);
        if (idx >= 0) this.writeSettleWaiters.splice(idx, 1);
        done(this.inFlightWriteCount === 0);
      }, Math.max(10, timeoutMs));
      if (typeof timer.unref === 'function') timer.unref();
    });
  }

  private async withPerKeyLock<T>(compositeKey: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.activeKeyLocks.get(compositeKey) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => current);
    this.activeKeyLocks.set(compositeKey, chained);

    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.activeKeyLocks.get(compositeKey) === chained) {
        this.activeKeyLocks.delete(compositeKey);
      }
    }
  }

  // ==========================================================================
  // 2. PENDING UPLOAD REGISTRY & EDITOR MEDIA LEASES
  // ==========================================================================

  public async registerPendingUpload(params: {
    url: string;
    ownerId: string;
    sessionId?: string;
    storageKey?: string;
    provider?: StorageProviderName;
  }): Promise<PendingUploadRecord | null> {
    try {
      const storage = this.getStorage();
      const resolvedKey = params.storageKey || storage.resolveManagedStorageKey(params.url);
      if (!resolvedKey) return null;

      const provider = params.provider || storage.providerName;
      const compositeKey = buildMediaCompositeKey(provider, resolvedKey);

      return await this.stateStore.mutate((draft, nowMs) => {
        const existing = draft.pendingUploads[compositeKey];
        const prevTombstone = draft.tombstones[buildPendingTombstoneKey(compositeKey)];
        const nextRev = Math.max(existing?.revision ?? 0, prevTombstone?.revision ?? 0) + 1;
        const createdAt = existing ? Math.min(existing.createdAt, nowMs) : nowMs;
        const record: PendingUploadRecord = {
          compositeKey,
          provider,
          storageKey: resolvedKey,
          url: params.url.trim(),
          ownerId: String(params.ownerId || 'ADMIN').trim(),
          sessionId: params.sessionId ? String(params.sessionId).trim() : existing?.sessionId,
          uploadedAt: existing ? Math.min(existing.uploadedAt, nowMs) : nowMs,
          createdAt,
          updatedAt: nowMs,
          revision: nextRev,
        };
        draft.pendingUploads[compositeKey] = record;
        return { result: record, changed: true };
      });
    } catch (err: any) {
      console.warn('[MEDIA-CLEANUP] Failed to register pending upload (non-fatal):', err?.message || err);
      return null;
    }
  }

  /**
   * Marks URLs as committed (saved to a product, CMS, category, collection, or order).
   * Writes tombstones for any matching pending uploads or deferred cleanup entries
   * so they are neither resurrected by stale snapshots nor deleted by sweeps.
   */
  public async markUrlsCommitted(urls: string[]): Promise<void> {
    if (!Array.isArray(urls) || urls.length === 0) return;
    try {
      const storage = this.getStorage();
      const keys = new Set<string>();
      for (const url of urls) {
        if (typeof url !== 'string' || !url.trim()) continue;
        const resolved = storage.resolveManagedStorageKey(url);
        if (resolved) {
          keys.add(buildMediaCompositeKey(storage.providerName, resolved));
        }
      }
      if (keys.size === 0) return;

      await this.stateStore.mutate((draft, nowMs) => {
        let changed = false;
        for (const compositeKey of keys) {
          const pending = draft.pendingUploads[compositeKey];
          if (pending) {
            const tKey = buildPendingTombstoneKey(compositeKey);
            const nextRev = Math.max(pending.revision, draft.tombstones[tKey]?.revision ?? 0) + 1;
            draft.tombstones[tKey] = {
              key: tKey,
              deletedAt: nowMs,
              revision: nextRev,
              reason: 'committed',
            };
            delete draft.pendingUploads[compositeKey];
            changed = true;
          }

          const deferred = draft.deferredQueue[compositeKey];
          if (deferred) {
            const tKey = buildDeferredTombstoneKey(compositeKey);
            const nextRev = Math.max(deferred.revision, draft.tombstones[tKey]?.revision ?? 0) + 1;
            draft.tombstones[tKey] = {
              key: tKey,
              deletedAt: nowMs,
              revision: nextRev,
              reason: 're-committed',
            };
            delete draft.deferredQueue[compositeKey];
            changed = true;
          }
        }
        return { result: undefined, changed };
      });
    } catch (err: any) {
      console.warn('[MEDIA-CLEANUP] Failed to mark URLs committed (non-fatal):', err?.message || err);
    }
  }

  public async upsertEditorMediaLease(params: {
    sessionId: string;
    ownerId: string;
    entityId?: string;
    urls: string[];
    ttlMs?: number;
  }): Promise<EditorMediaLeaseRecord | null> {
    const cleanSessionId = String(params.sessionId || '').trim();
    const cleanOwnerId = String(params.ownerId || '').trim();
    if (!cleanSessionId || !cleanOwnerId) return null;

    try {
      const storage = this.getStorage();
      const managedKeys = new Set<string>();
      const cleanUrls = new Set<string>();
      for (const rawUrl of Array.isArray(params.urls) ? params.urls : []) {
        if (typeof rawUrl !== 'string' || !rawUrl.trim()) continue;
        const resolved = storage.resolveManagedStorageKey(rawUrl);
        if (resolved) {
          managedKeys.add(resolved);
          cleanUrls.add(rawUrl.trim());
        }
      }

      const ttlMs = Math.max(10_000, params.ttlMs ?? this.getEditorLeaseTtlMs());
      const leaseKey = buildLeaseKey(cleanOwnerId, cleanSessionId);

      return await this.stateStore.mutate((draft, nowMs) => {
        const existing = draft.editorLeases[leaseKey];
        const prevTombstone = draft.tombstones[buildLeaseTombstoneKey(leaseKey)];
        const nextRev = Math.max(existing?.revision ?? 0, prevTombstone?.revision ?? 0) + 1;

        const record: EditorMediaLeaseRecord = {
          leaseKey,
          ownerId: cleanOwnerId,
          sessionId: cleanSessionId,
          entityId: params.entityId ? String(params.entityId).trim() : existing?.entityId,
          storageKeys: Array.from(managedKeys),
          urls: Array.from(cleanUrls),
          expiresAt: nowMs + ttlMs,
          createdAt: existing ? Math.min(existing.createdAt, nowMs) : nowMs,
          updatedAt: nowMs,
          revision: nextRev,
        };
        draft.editorLeases[leaseKey] = record;
        return { result: record, changed: true };
      });
    } catch (err: any) {
      console.warn('[MEDIA-CLEANUP] Failed to upsert editor media lease (non-fatal):', err?.message || err);
      return null;
    }
  }

  public async releaseEditorMediaLease(params: { sessionId: string; ownerId: string }): Promise<boolean> {
    const cleanSessionId = String(params.sessionId || '').trim();
    const cleanOwnerId = String(params.ownerId || '').trim();
    if (!cleanSessionId || !cleanOwnerId) return false;

    try {
      const leaseKey = buildLeaseKey(cleanOwnerId, cleanSessionId);
      return await this.stateStore.mutate((draft, nowMs) => {
        const existing = draft.editorLeases[leaseKey];
        if (!existing) return { result: false, changed: false };
        const tKey = buildLeaseTombstoneKey(leaseKey);
        const nextRev = Math.max(existing.revision, draft.tombstones[tKey]?.revision ?? 0) + 1;
        draft.tombstones[tKey] = {
          key: tKey,
          deletedAt: nowMs,
          revision: nextRev,
          reason: 'lease-released',
        };
        delete draft.editorLeases[leaseKey];
        return { result: true, changed: true };
      });
    } catch (err: any) {
      console.warn('[MEDIA-CLEANUP] Failed to release editor media lease (non-fatal):', err?.message || err);
      return false;
    }
  }

  private async getActiveLeasedKeys(
    storage: StorageAdapter,
    excludeLeaseSessionId?: string
  ): Promise<Set<string>> {
    const snapshot = await this.stateStore.getSnapshot();
    const nowMs = this.now();
    const protectedKeys = new Set<string>();

    for (const lease of Object.values(snapshot.editorLeases || {})) {
      if (!lease || lease.expiresAt <= nowMs) continue;
      if (excludeLeaseSessionId && lease.sessionId === excludeLeaseSessionId) continue;

      for (const key of lease.storageKeys || []) {
        if (key) protectedKeys.add(key);
      }
      for (const url of lease.urls || []) {
        const resolved = storage.resolveManagedStorageKey(url);
        if (resolved) protectedKeys.add(resolved);
      }
    }
    return protectedKeys;
  }

  // ==========================================================================
  // 3. FAIL-CLOSED CROSS-ENTITY REFERENCE AUDIT
  // ==========================================================================

  /**
   * Collects every active storage key referenced anywhere in Tori-Wear:
   * - Products (all statuses: PUBLISHED, DRAFT, REVIEW, ARCHIVED, duplicates) + Prisma ProductImage
   * - Categories & Subcategories (including disabled) + Prisma Category / Subcategory
   * - Collections + Prisma Collection
   * - CMS front-page data & store settings (deep recursive scan, excluding INTERNAL_MEDIA)
   *   + Prisma Banner / WebsiteBanner / HomepageSection / WebsiteSetting
   * - Historical Order snapshots (OrderItem.image) + Prisma OrderItem
   * - Non-expired Active Editor Media Leases (excluding excludeLeaseSessionId if supplied)
   *
   * FAIL-CLOSED: Throws if ANY reference source fails to load so cleanup never deletes on partial data.
   */
  public async collectActiveReferencedStorageKeys(
    storage: StorageAdapter,
    options?: { excludeLeaseSessionId?: string }
  ): Promise<Set<string>> {
    const rawUrls = new Set<string>();

    // Query all repository sources in parallel — any rejection aborts fail-closed!
    const [products, categories, collections, frontPageCms, storeSettings, orders, leasedKeys] = await Promise.all([
      this.refs.getAllProducts(),
      this.refs.getAllCategories(),
      this.refs.getAllCollections(),
      this.refs.getFrontPageCms(),
      this.refs.getStoreSettings(),
      this.refs.getAllOrders(),
      this.getActiveLeasedKeys(storage, options?.excludeLeaseSessionId),
    ]);

    for (const p of products || []) {
      for (const img of p?.images || []) {
        if (typeof img === 'string' && img.trim()) rawUrls.add(img.trim());
      }
      for (const v of p?.variants || []) {
        if (typeof v?.image === 'string' && v.image.trim()) rawUrls.add(v.image.trim());
      }
    }

    for (const cat of categories || []) {
      if (typeof cat?.image === 'string' && cat.image.trim()) rawUrls.add(cat.image.trim());
      if (typeof cat?.bannerImage === 'string' && cat.bannerImage.trim()) rawUrls.add(cat.bannerImage.trim());
      for (const sub of cat?.subcategories || []) {
        if (typeof sub?.image === 'string' && sub.image.trim()) rawUrls.add(sub.image.trim());
      }
    }

    for (const col of collections || []) {
      if (typeof col?.bannerImage === 'string' && col.bannerImage.trim()) rawUrls.add(col.bannerImage.trim());
      if (typeof col?.heroImage === 'string' && col.heroImage.trim()) rawUrls.add(col.heroImage.trim());
      if (typeof col?.image === 'string' && col.image.trim()) rawUrls.add(col.image.trim());
    }

    extractAllMediaUrlsFromValue(frontPageCms, rawUrls);
    extractAllMediaUrlsFromValue(storeSettings, rawUrls);

    for (const order of orders || []) {
      for (const item of order?.items || []) {
        if (typeof item?.image === 'string' && item.image.trim()) rawUrls.add(item.image.trim());
      }
    }

    // When Prisma/MySQL is configured, verify DB tables directly as well (fail-closed if MySQL is down!)
    const prismaClient = this.refs.getPrismaClient ? this.refs.getPrismaClient() : null;
    if (prismaClient) {
      const queries: Array<Promise<void>> = [];

      if (prismaClient.productImage?.findMany) {
        queries.push(
          prismaClient.productImage.findMany({ select: { url: true } }).then((rows: Array<{ url?: string | null }>) => {
            for (const row of rows || []) {
              if (row?.url) rawUrls.add(row.url);
            }
          })
        );
      }

      if (prismaClient.category?.findMany) {
        queries.push(
          prismaClient.category
            .findMany({ select: { image: true, bannerImage: true } })
            .then((rows: Array<{ image?: string | null; bannerImage?: string | null }>) => {
              for (const row of rows || []) {
                if (row?.image) rawUrls.add(row.image);
                if (row?.bannerImage) rawUrls.add(row.bannerImage);
              }
            })
        );
      }

      if (prismaClient.subcategory?.findMany) {
        queries.push(
          prismaClient.subcategory.findMany({ select: { image: true } }).then((rows: Array<{ image?: string | null }>) => {
            for (const row of rows || []) {
              if (row?.image) rawUrls.add(row.image);
            }
          })
        );
      }

      if (prismaClient.collection?.findMany) {
        queries.push(
          prismaClient.collection
            .findMany({ select: { bannerImage: true, heroImage: true } })
            .then((rows: Array<{ bannerImage?: string | null; heroImage?: string | null }>) => {
              for (const row of rows || []) {
                if (row?.bannerImage) rawUrls.add(row.bannerImage);
                if (row?.heroImage) rawUrls.add(row.heroImage);
              }
            })
        );
      }

      if (prismaClient.orderItem?.findMany) {
        queries.push(
          prismaClient.orderItem.findMany({ select: { image: true } }).then((rows: Array<{ image?: string | null }>) => {
            for (const row of rows || []) {
              if (row?.image) rawUrls.add(row.image);
            }
          })
        );
      }

      if (prismaClient.banner?.findMany) {
        queries.push(
          prismaClient.banner
            .findMany({ select: { imageUrl: true, mobileImageUrl: true } })
            .then((rows: Array<{ imageUrl?: string | null; mobileImageUrl?: string | null }>) => {
              for (const row of rows || []) {
                if (row?.imageUrl) rawUrls.add(row.imageUrl);
                if (row?.mobileImageUrl) rawUrls.add(row.mobileImageUrl);
              }
            })
        );
      }

      if (prismaClient.websiteBanner?.findMany) {
        queries.push(
          prismaClient.websiteBanner
            .findMany({ select: { bgImageUrl: true } })
            .then((rows: Array<{ bgImageUrl?: string | null }>) => {
              for (const row of rows || []) {
                if (row?.bgImageUrl) rawUrls.add(row.bgImageUrl);
              }
            })
        );
      }

      if (prismaClient.homepageSection?.findMany) {
        queries.push(
          prismaClient.homepageSection
            .findMany({ select: { configJson: true } })
            .then((rows: Array<{ configJson?: string | null }>) => {
              for (const row of rows || []) {
                if (!row?.configJson) continue;
                try {
                  extractAllMediaUrlsFromValue(JSON.parse(row.configJson), rawUrls);
                } catch {
                  // non-JSON text
                }
              }
            })
        );
      }

      if (prismaClient.websiteSetting?.findMany) {
        queries.push(
          prismaClient.websiteSetting
            .findMany({
              where: {
                key: { not: MEDIA_CLEANUP_MYSQL_KEY },
                group: { not: MEDIA_CLEANUP_MYSQL_GROUP },
              },
              select: { key: true, group: true, value: true },
            })
            .then((rows: Array<{ key?: string; group?: string; value?: string | null }>) => {
              for (const row of rows || []) {
                if (!row || row.key === MEDIA_CLEANUP_MYSQL_KEY || row.group === MEDIA_CLEANUP_MYSQL_GROUP) {
                  continue;
                }
                if (!row.value) continue;
                try {
                  extractAllMediaUrlsFromValue(JSON.parse(row.value), rawUrls);
                } catch {
                  extractAllMediaUrlsFromValue(row.value, rawUrls);
                }
              }
            })
        );
      }

      if (queries.length > 0) {
        await Promise.all(queries);
      }
    }

    const referencedKeys = new Set<string>(leasedKeys);
    for (const url of rawUrls) {
      const managedKey = storage.resolveManagedStorageKey(url);
      if (managedKey) {
        referencedKeys.add(managedKey);
      }
    }

    return referencedKeys;
  }

  // ==========================================================================
  // 4. DURABLE DEFERRED CLEANUP QUEUE & JOB CLAIM DISCIPLINE
  // ==========================================================================

  /**
   * Enqueues candidate image URLs into the restart-safe deferred cleanup queue
   * with a configurable safety cooldown. If cooldownMs === 0 and processImmediatelyIfZeroCooldown
   * is true (used in tests or explicit immediate mode), processes eligible entries immediately.
   */
  public async enqueueDeferredMediaCleanup(
    candidateUrls: string[],
    options: {
      reason: string;
      cooldownMs?: number;
      processImmediatelyIfZeroCooldown?: boolean;
    }
  ): Promise<{ enqueuedKeys: string[]; skippedUnmanagedUrls: string[]; immediateReport?: MediaCleanupReport }> {
    const storage = this.getStorage();
    const skippedUnmanagedUrls: string[] = [];
    const managedMap = new Map<string, string>(); // storageKey -> url

    for (const rawUrl of Array.isArray(candidateUrls) ? candidateUrls : []) {
      const trimmed = String(rawUrl || '').trim();
      if (!trimmed) continue;
      const key = storage.resolveManagedStorageKey(trimmed);
      if (!key) {
        skippedUnmanagedUrls.push(trimmed);
        continue;
      }
      if (!managedMap.has(key)) {
        managedMap.set(key, trimmed);
      }
    }

    if (managedMap.size === 0) {
      return { enqueuedKeys: [], skippedUnmanagedUrls };
    }

    const cooldownMs = Math.max(0, options.cooldownMs ?? this.getCleanupCooldownMs());
    const enqueuedKeys = Array.from(managedMap.keys());

    try {
      await this.stateStore.mutate((draft, nowMs) => {
        const eligibleAt = nowMs + cooldownMs;
        for (const [storageKey, url] of managedMap.entries()) {
          const compositeKey = buildMediaCompositeKey(storage.providerName, storageKey);
          const existing = draft.deferredQueue[compositeKey];
          const prevTombstone = draft.tombstones[buildDeferredTombstoneKey(compositeKey)];
          const nextRev = Math.max(existing?.revision ?? 0, prevTombstone?.revision ?? 0) + 1;

          draft.deferredQueue[compositeKey] = {
            compositeKey,
            provider: storage.providerName,
            storageKey,
            url,
            reason: options.reason,
            enqueuedAt: existing ? Math.min(existing.enqueuedAt, nowMs) : nowMs,
            eligibleAt: existing ? Math.max(existing.eligibleAt, eligibleAt) : eligibleAt,
            attempts: existing?.attempts ?? 0,
            lastAttemptAt: existing?.lastAttemptAt,
            lastError: existing?.lastError,
            processingClaim: existing?.processingClaim ?? null,
            createdAt: existing ? Math.min(existing.createdAt, nowMs) : nowMs,
            updatedAt: nowMs,
            revision: nextRev,
          };
        }
        return { result: undefined, changed: true };
      });
    } catch (err: any) {
      console.warn('[MEDIA-CLEANUP] Failed to persist deferred cleanup queue (non-fatal):', err?.message || err);
    }

    if (cooldownMs === 0 && options.processImmediatelyIfZeroCooldown) {
      const immediateReport = await this.processDeferredCleanupQueue();
      return { enqueuedKeys, skippedUnmanagedUrls, immediateReport };
    }

    return { enqueuedKeys, skippedUnmanagedUrls };
  }

  private async tryClaimDeferredKey(compositeKey: string): Promise<'claimed' | 'already-claimed' | 'missing'> {
    const claimTtlMs = this.getClaimTtlMs();
    return this.stateStore.mutate((draft, nowMs) => {
      const rec = draft.deferredQueue[compositeKey];
      if (!rec) return { result: 'missing' as const, changed: false };
      if (
        rec.processingClaim &&
        rec.processingClaim.claimExpiresAt > nowMs &&
        rec.processingClaim.ownerInstanceId !== this.stateStore.instanceId
      ) {
        return { result: 'already-claimed' as const, changed: false };
      }
      rec.processingClaim = {
        ownerInstanceId: this.stateStore.instanceId,
        claimedAt: nowMs,
        claimExpiresAt: nowMs + claimTtlMs,
      };
      rec.updatedAt = nowMs;
      rec.revision += 1;
      return { result: 'claimed' as const, changed: true };
    });
  }

  private async completeKeyWithTombstone(
    compositeKey: string,
    reason: string,
    options?: { clearDeferred?: boolean; clearPending?: boolean }
  ): Promise<void> {
    const clearDeferred = options?.clearDeferred ?? true;
    const clearPending = options?.clearPending ?? true;

    await this.stateStore.mutate((draft, nowMs) => {
      let changed = false;

      if (clearDeferred && draft.deferredQueue[compositeKey]) {
        const rec = draft.deferredQueue[compositeKey];
        const tKey = buildDeferredTombstoneKey(compositeKey);
        const nextRev = Math.max(rec.revision, draft.tombstones[tKey]?.revision ?? 0) + 1;
        draft.tombstones[tKey] = {
          key: tKey,
          deletedAt: nowMs,
          revision: nextRev,
          reason,
        };
        delete draft.deferredQueue[compositeKey];
        changed = true;
      }

      if (clearPending && draft.pendingUploads[compositeKey]) {
        const rec = draft.pendingUploads[compositeKey];
        const tKey = buildPendingTombstoneKey(compositeKey);
        const nextRev = Math.max(rec.revision, draft.tombstones[tKey]?.revision ?? 0) + 1;
        draft.tombstones[tKey] = {
          key: tKey,
          deletedAt: nowMs,
          revision: nextRev,
          reason,
        };
        delete draft.pendingUploads[compositeKey];
        changed = true;
      }

      return { result: undefined, changed };
    });
  }

  private async releaseClaimAndRecordAttempt(
    compositeKey: string,
    params: { error?: string; bumpEligibleAtMs?: number }
  ): Promise<void> {
    await this.stateStore.mutate((draft, nowMs) => {
      const rec = draft.deferredQueue[compositeKey];
      if (!rec) return { result: undefined, changed: false };
      rec.processingClaim = null;
      rec.attempts = (rec.attempts || 0) + 1;
      rec.lastAttemptAt = nowMs;
      if (params.error !== undefined) {
        rec.lastError = params.error;
      }
      if (params.bumpEligibleAtMs && params.bumpEligibleAtMs > 0) {
        rec.eligibleAt = Math.max(rec.eligibleAt, nowMs + params.bumpEligibleAtMs);
      }
      rec.updatedAt = nowMs;
      rec.revision += 1;
      return { result: undefined, changed: true };
    });
  }

  // ==========================================================================
  // 5. CORE FIVE-GATE CLEANUP EXECUTION ENGINE
  // ==========================================================================

  /**
   * Executes Gates 1-5 on candidate URLs strictly post-commit:
   *  Gate 1: Active-provider key resolution (resolveManagedStorageKey)
   *  Gate 2: Per-key async lock + durable claim (when queue-backed) + Write-Epoch settle
   *  Gate 3: Fail-closed cross-entity reference & active lease audit
   *  Gate 4: TOCTOU Double-Check Gate right before deleteFile()
   *  Gate 5: Dry-run OR idempotent storage.deleteFile() with tombstone completion
   *
   * Never throws to callers.
   */
  public async cleanupUnreferencedMedia(
    candidateUrls: string[],
    options?: {
      reason?: string;
      excludeLeaseSessionId?: string;
      requireDeferredClaim?: boolean;
      requeueOnConflict?: boolean;
      clearPendingOnComplete?: boolean;
      clearDeferredOnComplete?: boolean;
    }
  ): Promise<MediaCleanupReport> {
    const storage = this.getStorage();
    const dryRun = this.isDryRun();
    const report: MediaCleanupReport = {
      provider: storage.providerName,
      dryRun,
      abortedFailClosed: false,
      deletedKeys: [],
      alreadyAbsentKeys: [],
      preservedReferencedKeys: [],
      skippedUnmanagedUrls: [],
      deferredConflictKeys: [],
      skippedClaimedKeys: [],
      failedKeys: [],
    };

    try {
      // Gate 1: Deduplicate and filter strictly to active storage provider
      const keyToUrl = new Map<string, string>();
      for (const rawUrl of Array.isArray(candidateUrls) ? candidateUrls : []) {
        const trimmed = String(rawUrl || '').trim();
        if (!trimmed) continue;
        const resolvedKey = storage.resolveManagedStorageKey(trimmed);
        if (!resolvedKey) {
          report.skippedUnmanagedUrls.push(trimmed);
          continue;
        }
        if (!keyToUrl.has(resolvedKey)) {
          keyToUrl.set(resolvedKey, trimmed);
        }
      }

      if (keyToUrl.size === 0) {
        return report;
      }

      // Check active storage config status before attempting cloud calls
      const configStatus = storage.getConfigStatus();
      if (!configStatus.configured) {
        report.abortedFailClosed = true;
        report.abortReason = configStatus.error || `Storage provider "${storage.providerName}" is not configured.`;
        return report;
      }

      for (const [storageKey, url] of keyToUrl.entries()) {
        const compositeKey = buildMediaCompositeKey(storage.providerName, storageKey);

        await this.withPerKeyLock(compositeKey, async () => {
          // Acquire durable cross-worker claim when processing deferred queue items
          let acquiredDeferredClaim = false;
          if (options?.requireDeferredClaim) {
            const claimStatus = await this.tryClaimDeferredKey(compositeKey);
            if (claimStatus === 'already-claimed') {
              report.skippedClaimedKeys.push(storageKey);
              return;
            }
            if (claimStatus === 'missing') {
              return;
            }
            acquiredDeferredClaim = true;
          }

          try {
            // Gate 2: Wait for in-flight catalog/CMS/order writes to settle & capture epoch
            const settled = await this.waitForWritesToSettle();
            if (!settled) {
              report.deferredConflictKeys.push(storageKey);
              if (acquiredDeferredClaim) {
                await this.releaseClaimAndRecordAttempt(compositeKey, {
                  error: 'Concurrent catalog/CMS write in flight; deferred for retry.',
                  bumpEligibleAtMs: 5_000,
                });
              } else if (options?.requeueOnConflict) {
                await this.enqueueDeferredMediaCleanup([url], {
                  reason: `${options.reason || 'cleanup'}-concurrent-write-retry`,
                });
              }
              return;
            }

            const epochBefore = this.mediaReferenceEpoch;

            // Gate 3: Fail-closed cross-entity reference audit + active editor lease check
            let referencedKeys: Set<string>;
            try {
              referencedKeys = await this.collectActiveReferencedStorageKeys(storage, {
                excludeLeaseSessionId: options?.excludeLeaseSessionId,
              });
            } catch (auditErr: any) {
              report.abortedFailClosed = true;
              report.abortReason = auditErr?.message || 'Reference audit failed; aborted fail-closed.';
              console.warn(
                `[MEDIA-CLEANUP] Fail-closed abort for ${compositeKey} (zero deletions performed):`,
                report.abortReason
              );
              if (acquiredDeferredClaim) {
                await this.releaseClaimAndRecordAttempt(compositeKey, {
                  error: report.abortReason,
                  bumpEligibleAtMs: 15_000,
                });
              }
              return;
            }

            if (referencedKeys.has(storageKey)) {
              report.preservedReferencedKeys.push(storageKey);
              // Keep leased keys queued so they can be re-evaluated after lease expiry,
              // unless they are persisted in an actual entity (check whether lease-only).
              const activeLeasedKeys = await this.getActiveLeasedKeys(storage, options?.excludeLeaseSessionId);
              if (activeLeasedKeys.has(storageKey)) {
                // Protected by an active editor lease: release claim and keep deferred for later re-check
                if (acquiredDeferredClaim) {
                  await this.releaseClaimAndRecordAttempt(compositeKey, {
                    error: 'Protected by active editor media lease.',
                    bumpEligibleAtMs: 30_000,
                  });
                }
              } else {
                // Referenced by a persisted entity (product/CMS/category/collection/order): safe to clear from queues
                await this.completeKeyWithTombstone(compositeKey, 'preserved-referenced', {
                  clearDeferred: options?.clearDeferredOnComplete ?? true,
                  clearPending: options?.clearPendingOnComplete ?? true,
                });
              }
              return;
            }

            // Gate 4: TOCTOU Double-Check Gate immediately before deletion
            const postAuditLeased = await this.getActiveLeasedKeys(storage, options?.excludeLeaseSessionId);
            if (
              this.inFlightWriteCount > 0 ||
              this.mediaReferenceEpoch !== epochBefore ||
              postAuditLeased.has(storageKey)
            ) {
              report.deferredConflictKeys.push(storageKey);
              console.warn(
                `[MEDIA-CLEANUP] TOCTOU barrier triggered for ${compositeKey}; aborting delete and deferring re-verification.`
              );
              if (acquiredDeferredClaim) {
                await this.releaseClaimAndRecordAttempt(compositeKey, {
                  error: 'Concurrent edit detected at TOCTOU double-check gate.',
                  bumpEligibleAtMs: 10_000,
                });
              } else if (options?.requeueOnConflict) {
                await this.enqueueDeferredMediaCleanup([url], {
                  reason: `${options.reason || 'cleanup'}-toctou-retry`,
                });
              }
              return;
            }

            // Gate 5: Dry-run audit OR idempotent storage deletion
            if (dryRun) {
              console.log(
                `[MEDIA-CLEANUP][DRY-RUN] Would delete unreferenced ${storage.providerName} object: ${storageKey} (reason=${options?.reason || 'cleanup'})`
              );
              report.deletedKeys.push(storageKey);
              if (acquiredDeferredClaim) {
                await this.releaseClaimAndRecordAttempt(compositeKey, {
                  error: 'dry-run mode active',
                  bumpEligibleAtMs: 60_000,
                });
              }
              return;
            }

            try {
              const exists = await storage.fileExists(storageKey);
              if (!exists) {
                report.alreadyAbsentKeys.push(storageKey);
                await this.completeKeyWithTombstone(compositeKey, 'already-absent', {
                  clearDeferred: options?.clearDeferredOnComplete ?? true,
                  clearPending: options?.clearPendingOnComplete ?? true,
                });
                return;
              }

              const deleted = await storage.deleteFile(storageKey);
              if (deleted) {
                report.deletedKeys.push(storageKey);
                await this.completeKeyWithTombstone(compositeKey, options?.reason || 'deleted', {
                  clearDeferred: options?.clearDeferredOnComplete ?? true,
                  clearPending: options?.clearPendingOnComplete ?? true,
                });
                console.log(
                  `[MEDIA-CLEANUP] Safely deleted unreferenced ${storage.providerName} object: ${storageKey} (reason=${options?.reason || 'cleanup'})`
                );
              } else {
                // Re-check existence to distinguish idempotent 404 from silent delete failure
                const stillExists = await storage.fileExists(storageKey);
                if (!stillExists) {
                  report.alreadyAbsentKeys.push(storageKey);
                  await this.completeKeyWithTombstone(compositeKey, 'already-absent', {
                    clearDeferred: options?.clearDeferredOnComplete ?? true,
                    clearPending: options?.clearPendingOnComplete ?? true,
                  });
                } else {
                  const errMsg = `Storage adapter returned false deleting ${storageKey}.`;
                  report.failedKeys.push({ storageKey, error: errMsg });
                  if (acquiredDeferredClaim) {
                    await this.releaseClaimAndRecordAttempt(compositeKey, {
                      error: errMsg,
                      bumpEligibleAtMs: 30_000,
                    });
                  }
                }
              }
            } catch (deleteErr: any) {
              const errMsg = deleteErr?.message || 'Storage deletion error';
              console.error(`[MEDIA-CLEANUP] Storage delete failed for ${compositeKey} (non-fatal):`, errMsg);
              report.failedKeys.push({ storageKey, error: errMsg });
              if (acquiredDeferredClaim) {
                await this.releaseClaimAndRecordAttempt(compositeKey, {
                  error: errMsg,
                  bumpEligibleAtMs: 30_000,
                });
              }
            }
          } catch (innerErr: any) {
            const errMsg = innerErr?.message || 'Unexpected per-key cleanup failure';
            report.failedKeys.push({ storageKey, error: errMsg });
            if (acquiredDeferredClaim) {
              await this.releaseClaimAndRecordAttempt(compositeKey, {
                error: errMsg,
                bumpEligibleAtMs: 30_000,
              });
            }
          }
        });

        // If reference audit aborted fail-closed, stop scanning remaining keys in this batch
        if (report.abortedFailClosed) {
          break;
        }
      }
    } catch (outerErr: any) {
      console.error('[MEDIA-CLEANUP] Unexpected cleanup error (non-fatal):', outerErr?.message || outerErr);
      report.abortedFailClosed = true;
      report.abortReason = outerErr?.message || 'Unexpected cleanup error';
    }

    return report;
  }

  // ==========================================================================
  // 6. ABANDONED UPLOAD DISCARD & PERIODIC / STARTUP RECOVERY SWEEPS
  // ==========================================================================

  /**
   * Handles explicit Product Editor Cancel/Close discard requests.
   * Enforces ownership against the durable pending-upload registry so admins
   * cannot probe or delete arbitrary URLs or another admin's pending uploads.
   */
  public async discardPendingUploads(params: {
    urls: string[];
    ownerId: string;
    sessionId?: string;
    isSuperAdmin?: boolean;
  }): Promise<{
    acceptedUrls: string[];
    rejectedUrls: string[];
    report: MediaCleanupReport;
  }> {
    const storage = this.getStorage();
    const snapshot = await this.stateStore.syncBackends();
    const cleanOwnerId = String(params.ownerId || '').trim();
    const acceptedUrls: string[] = [];
    const rejectedUrls: string[] = [];

    for (const rawUrl of Array.isArray(params.urls) ? params.urls : []) {
      const trimmed = String(rawUrl || '').trim();
      if (!trimmed) continue;
      const key = storage.resolveManagedStorageKey(trimmed);
      if (!key) {
        rejectedUrls.push(trimmed);
        continue;
      }
      const compositeKey = buildMediaCompositeKey(storage.providerName, key);
      const pending = snapshot.pendingUploads[compositeKey];
      if (!pending) {
        rejectedUrls.push(trimmed);
        continue;
      }
      const ownerMatches = pending.ownerId === cleanOwnerId || Boolean(params.isSuperAdmin);
      if (!ownerMatches) {
        rejectedUrls.push(trimmed);
        continue;
      }
      acceptedUrls.push(pending.url || trimmed);
    }

    const report = await this.cleanupUnreferencedMedia(acceptedUrls, {
      reason: 'editor-cancel-discard',
      excludeLeaseSessionId: params.sessionId,
      requireDeferredClaim: false,
      requeueOnConflict: true,
      clearPendingOnComplete: true,
      clearDeferredOnComplete: true,
    });

    return { acceptedUrls, rejectedUrls, report };
  }

  /**
   * Processes eligible entries in the durable deferred cleanup queue whose
   * safety cooldown (eligibleAt) has elapsed.
   */
  public async processDeferredCleanupQueue(nowOverrideMs?: number): Promise<MediaCleanupReport> {
    const storage = this.getStorage();
    const nowMs = nowOverrideMs ?? this.now();
    const snapshot = await this.stateStore.syncBackends();

    const eligibleUrls: string[] = [];
    for (const rec of Object.values(snapshot.deferredQueue || {})) {
      if (!rec) continue;
      if (rec.provider !== storage.providerName) continue;
      if (rec.eligibleAt > nowMs) continue;
      if (
        rec.processingClaim &&
        rec.processingClaim.claimExpiresAt > nowMs &&
        rec.processingClaim.ownerInstanceId !== this.stateStore.instanceId
      ) {
        continue;
      }
      eligibleUrls.push(rec.url);
    }

    return this.cleanupUnreferencedMedia(eligibleUrls, {
      reason: 'deferred-queue-sweep',
      requireDeferredClaim: true,
      clearPendingOnComplete: true,
      clearDeferredOnComplete: true,
    });
  }

  /**
   * Sweeps durable pending uploads older than MEDIA_PENDING_UPLOAD_TTL_MS.
   * Safely recovers abandoned uploads across GoDaddy Node.js Hosting restarts.
   */
  public async sweepExpiredPendingUploads(nowOverrideMs?: number): Promise<MediaCleanupReport> {
    const storage = this.getStorage();
    const nowMs = nowOverrideMs ?? this.now();
    const ttlMs = this.getPendingUploadTtlMs();
    const snapshot = await this.stateStore.syncBackends();

    const expiredEntries: PendingUploadRecord[] = [];
    for (const rec of Object.values(snapshot.pendingUploads || {})) {
      if (!rec) continue;
      if (rec.provider !== storage.providerName) continue;
      if (nowMs - rec.uploadedAt >= ttlMs) {
        expiredEntries.push(rec);
      }
    }

    if (expiredEntries.length === 0) {
      return {
        provider: storage.providerName,
        dryRun: this.isDryRun(),
        abortedFailClosed: false,
        deletedKeys: [],
        alreadyAbsentKeys: [],
        preservedReferencedKeys: [],
        skippedUnmanagedUrls: [],
        deferredConflictKeys: [],
        skippedClaimedKeys: [],
        failedKeys: [],
      };
    }

    // Move expired pending uploads into the deferred queue with 0 cooldown so they
    // inherit durable cross-worker claim & retry semantics (no duplicate processing!).
    await this.enqueueDeferredMediaCleanup(
      expiredEntries.map((e) => e.url),
      {
        reason: 'pending-upload-ttl-expired',
        cooldownMs: 0,
        processImmediatelyIfZeroCooldown: false,
      }
    );

    return this.processDeferredCleanupQueue(nowMs);
  }

  /**
   * Single-flight combined maintenance pass (reconciles backends, sweeps expired pending uploads,
   * and processes eligible deferred cleanup queue items).
   */
  public async runMaintenanceSweep(nowOverrideMs?: number): Promise<{
    skippedOverlap: boolean;
    deferredReport?: MediaCleanupReport;
    expiredPendingReport?: MediaCleanupReport;
  }> {
    if (this.sweepInProgress) {
      return { skippedOverlap: true };
    }
    this.sweepInProgress = true;
    try {
      const nowMs = nowOverrideMs ?? this.now();
      const expiredPendingReport = await this.sweepExpiredPendingUploads(nowMs);
      const deferredReport = await this.processDeferredCleanupQueue(nowMs);
      return { skippedOverlap: false, deferredReport, expiredPendingReport };
    } finally {
      this.sweepInProgress = false;
    }
  }

  public startBackgroundSweeper(): void {
    if (this.startupTimer || this.sweepIntervalTimer) return;

    // Hydrate durable state immediately on startup so pre-restart pending uploads & queue items are loaded
    this.stateStore.hydrate().catch((err) => {
      console.warn('[MEDIA-CLEANUP] Startup hydration note:', err?.message || err);
    });

    this.startupTimer = setTimeout(() => {
      this.startupTimer = null;
      this.runMaintenanceSweep().catch((err) => {
        console.warn('[MEDIA-CLEANUP] Startup recovery sweep note:', err?.message || err);
      });
    }, this.startupSweepDelayMs);
    if (typeof this.startupTimer.unref === 'function') {
      this.startupTimer.unref();
    }

    this.sweepIntervalTimer = setInterval(() => {
      this.runMaintenanceSweep().catch((err) => {
        console.warn('[MEDIA-CLEANUP] Periodic maintenance sweep note:', err?.message || err);
      });
    }, this.sweepIntervalMs);
    if (typeof this.sweepIntervalTimer.unref === 'function') {
      this.sweepIntervalTimer.unref();
    }
  }

  public stopBackgroundSweeper(): void {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
    if (this.sweepIntervalTimer) {
      clearInterval(this.sweepIntervalTimer);
      this.sweepIntervalTimer = null;
    }
  }
}

export const mediaCleanupService = new MediaCleanupService();
