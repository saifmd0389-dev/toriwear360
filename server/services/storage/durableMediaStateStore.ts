/**
 * TORIWEAR Restart-Safe Dual-Backed Durable Media State Store
 *
 * Persists pending uploads, deferred cleanup items, active editor media leases,
 * and short-lived tombstones across GoDaddy Node.js Hosting restarts using:
 *   1. MySQL WebsiteSetting (key="media_cleanup_state_v1", group="INTERNAL_MEDIA", isPublic=false)
 *      with optimistic concurrency (Compare-And-Swap on updatedAt).
 *   2. Atomic runtime JSON (resolveSecureStorePath('media_cleanup_state.json'))
 *      written via unique temp file + atomic rename.
 *
 * Consistency Guarantees:
 * - Never blind-overwrites newer MySQL state with an older JSON snapshot (read -> merge -> CAS write).
 * - Never discards a pending upload or deferred cleanup item if one backend is temporarily unavailable.
 * - Serializes in-process writes through an async mutex; resolves cross-process conflicts via CAS retries.
 * - Preserves earliest uploadedAt timestamps, latest cooldown eligibleAt timestamps, and latest lease expiries.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getPrismaClient } from '../../db/prisma';
import { resolveSecureStorePath } from '../../utils/storageHelper';
import type { StorageProviderName } from './storageAdapter';

export const MEDIA_CLEANUP_MYSQL_KEY = 'media_cleanup_state_v1';
export const MEDIA_CLEANUP_MYSQL_GROUP = 'INTERNAL_MEDIA';
export const MEDIA_TOMBSTONE_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MAX_CAS_RETRIES = 5;

export interface PendingUploadRecord {
  compositeKey: string;
  provider: StorageProviderName;
  storageKey: string;
  url: string;
  ownerId: string;
  sessionId?: string;
  uploadedAt: number;
  createdAt: number;
  updatedAt: number;
  revision: number;
}

export interface CleanupProcessingClaim {
  ownerInstanceId: string;
  claimedAt: number;
  claimExpiresAt: number;
}

export interface DeferredCleanupRecord {
  compositeKey: string;
  provider: StorageProviderName;
  storageKey: string;
  url: string;
  reason: string;
  enqueuedAt: number;
  eligibleAt: number;
  attempts: number;
  lastAttemptAt?: number;
  lastError?: string;
  processingClaim?: CleanupProcessingClaim | null;
  createdAt: number;
  updatedAt: number;
  revision: number;
}

export interface EditorMediaLeaseRecord {
  leaseKey: string;
  ownerId: string;
  sessionId: string;
  entityId?: string;
  storageKeys: string[];
  urls: string[];
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
  revision: number;
}

export interface TombstoneRecord {
  key: string;
  deletedAt: number;
  revision: number;
  reason: string;
}

export interface DurableMediaStateEnvelope {
  schemaVersion: 1;
  stateVersion: number;
  updatedAt: number;
  instanceId: string;
  pendingMySqlSync: boolean;
  lastSyncedMySqlVersion: number;
  pendingUploads: Record<string, PendingUploadRecord>;
  deferredQueue: Record<string, DeferredCleanupRecord>;
  editorLeases: Record<string, EditorMediaLeaseRecord>;
  tombstones: Record<string, TombstoneRecord>;
}

export interface MySqlWebsiteSettingRow {
  key: string;
  value: string;
  updatedAt: Date;
}

export interface MySqlMediaStateBackend {
  isAvailable(): boolean;
  readRow(): Promise<MySqlWebsiteSettingRow | null>;
  createRow(value: string): Promise<{ created: boolean; conflict?: boolean }>;
  compareAndSwapRow(expectedUpdatedAt: Date, nextValue: string): Promise<{ updated: boolean }>;
}

export interface DurableMediaStateStoreOptions {
  runtimeFilePath?: string;
  mysqlBackend?: MySqlMediaStateBackend | null;
  instanceId?: string;
  maxCasRetries?: number;
  tombstoneRetentionMs?: number;
  now?: () => number;
}

export function buildMediaCompositeKey(provider: StorageProviderName, storageKey: string): string {
  return `${provider}:${storageKey}`;
}

export function buildPendingTombstoneKey(compositeKey: string): string {
  return `pending:${compositeKey}`;
}

export function buildDeferredTombstoneKey(compositeKey: string): string {
  return `deferred:${compositeKey}`;
}

export function buildLeaseKey(ownerId: string, sessionId: string): string {
  return `${ownerId}:${sessionId}`;
}

export function buildLeaseTombstoneKey(leaseKey: string): string {
  return `lease:${leaseKey}`;
}

export function createEmptyDurableMediaState(instanceId: string, nowMs: number = Date.now()): DurableMediaStateEnvelope {
  return {
    schemaVersion: 1,
    stateVersion: 0,
    updatedAt: nowMs,
    instanceId,
    pendingMySqlSync: false,
    lastSyncedMySqlVersion: 0,
    pendingUploads: {},
    deferredQueue: {},
    editorLeases: {},
    tombstones: {},
  };
}

function cloneEnvelope(state: DurableMediaStateEnvelope): DurableMediaStateEnvelope {
  return JSON.parse(JSON.stringify(state)) as DurableMediaStateEnvelope;
}

function parseEnvelopeJson(raw: string, fallbackInstanceId: string, nowMs: number): DurableMediaStateEnvelope | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const base = createEmptyDurableMediaState(
      typeof parsed.instanceId === 'string' && parsed.instanceId ? parsed.instanceId : fallbackInstanceId,
      typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : nowMs
    );
    base.stateVersion = typeof parsed.stateVersion === 'number' && Number.isFinite(parsed.stateVersion) ? parsed.stateVersion : 0;
    base.pendingMySqlSync = Boolean(parsed.pendingMySqlSync);
    base.lastSyncedMySqlVersion =
      typeof parsed.lastSyncedMySqlVersion === 'number' && Number.isFinite(parsed.lastSyncedMySqlVersion)
        ? parsed.lastSyncedMySqlVersion
        : 0;
    if (parsed.pendingUploads && typeof parsed.pendingUploads === 'object') {
      base.pendingUploads = parsed.pendingUploads;
    }
    if (parsed.deferredQueue && typeof parsed.deferredQueue === 'object') {
      base.deferredQueue = parsed.deferredQueue;
    }
    if (parsed.editorLeases && typeof parsed.editorLeases === 'object') {
      base.editorLeases = parsed.editorLeases;
    }
    if (parsed.tombstones && typeof parsed.tombstones === 'object') {
      base.tombstones = parsed.tombstones;
    }
    return base;
  } catch {
    return null;
  }
}

function isRecordSupersededByTombstone(
  record: { createdAt: number; updatedAt: number; revision: number },
  tombstone?: TombstoneRecord
): boolean {
  if (!tombstone) return false;
  // A brand-new record created strictly after the tombstone wins (re-upload / re-enqueue).
  if (record.createdAt > tombstone.deletedAt) {
    return false;
  }
  if (tombstone.revision > record.revision) {
    return true;
  }
  if (tombstone.deletedAt > record.updatedAt) {
    return true;
  }
  return tombstone.deletedAt === record.updatedAt && tombstone.revision >= record.revision;
}

function mergeProcessingClaim(
  a?: CleanupProcessingClaim | null,
  b?: CleanupProcessingClaim | null,
  nowMs: number = Date.now()
): CleanupProcessingClaim | null {
  const activeA = a && a.claimExpiresAt > nowMs ? a : null;
  const activeB = b && b.claimExpiresAt > nowMs ? b : null;
  if (!activeA) return activeB;
  if (!activeB) return activeA;
  // Prefer the fresher claim (latest claimedAt, tie-break by latest expiry, then lexicographical ownerInstanceId for determinism)
  if (activeA.claimedAt !== activeB.claimedAt) {
    return activeA.claimedAt > activeB.claimedAt ? activeA : activeB;
  }
  if (activeA.claimExpiresAt !== activeB.claimExpiresAt) {
    return activeA.claimExpiresAt > activeB.claimExpiresAt ? activeA : activeB;
  }
  return activeA.ownerInstanceId >= activeB.ownerInstanceId ? activeA : activeB;
}

/**
 * Pure, deterministic, commutative, and idempotent state merger.
 * Never drops active entries simply because one backend is older or was offline.
 */
export function mergeDurableMediaState(
  stateA: DurableMediaStateEnvelope,
  stateB: DurableMediaStateEnvelope,
  nowMs: number = Date.now(),
  tombstoneRetentionMs: number = MEDIA_TOMBSTONE_RETENTION_MS
): DurableMediaStateEnvelope {
  const mergedTombstones: Record<string, TombstoneRecord> = {};
  const allTombstoneKeys = new Set([
    ...Object.keys(stateA.tombstones || {}),
    ...Object.keys(stateB.tombstones || {}),
  ]);

  for (const tKey of allTombstoneKeys) {
    const tA = stateA.tombstones?.[tKey];
    const tB = stateB.tombstones?.[tKey];
    let chosen: TombstoneRecord | undefined;
    if (tA && tB) {
      if (tA.revision !== tB.revision) {
        chosen = tA.revision > tB.revision ? tA : tB;
      } else {
        chosen = tA.deletedAt >= tB.deletedAt ? tA : tB;
      }
    } else {
      chosen = tA || tB;
    }
    if (chosen && nowMs - chosen.deletedAt <= tombstoneRetentionMs) {
      mergedTombstones[tKey] = { ...chosen };
    }
  }

  // 1. Merge pending uploads (conservative union; preserve earliest uploadedAt so expiry clock never resets)
  const mergedPending: Record<string, PendingUploadRecord> = {};
  const allPendingKeys = new Set([
    ...Object.keys(stateA.pendingUploads || {}),
    ...Object.keys(stateB.pendingUploads || {}),
  ]);

  for (const key of allPendingKeys) {
    const recA = stateA.pendingUploads?.[key];
    const recB = stateB.pendingUploads?.[key];
    let merged: PendingUploadRecord;
    if (recA && recB) {
      const newer =
        recA.revision !== recB.revision
          ? recA.revision > recB.revision
            ? recA
            : recB
          : recA.updatedAt >= recB.updatedAt
            ? recA
            : recB;
      merged = {
        ...newer,
        uploadedAt: Math.min(recA.uploadedAt, recB.uploadedAt),
        createdAt: Math.min(recA.createdAt, recB.createdAt),
        updatedAt: Math.max(recA.updatedAt, recB.updatedAt),
        revision: Math.max(recA.revision, recB.revision),
        ownerId: newer.ownerId || recA.ownerId || recB.ownerId,
        sessionId: newer.sessionId || recA.sessionId || recB.sessionId,
      };
    } else {
      merged = { ...(recA || recB)! };
    }

    const tombstone = mergedTombstones[buildPendingTombstoneKey(key)];
    if (!isRecordSupersededByTombstone(merged, tombstone)) {
      mergedPending[key] = merged;
    }
  }

  // 2. Merge deferred cleanup queue (fail-safe union; preserve latest eligibleAt so cooldown never shortens)
  const mergedDeferred: Record<string, DeferredCleanupRecord> = {};
  const allDeferredKeys = new Set([
    ...Object.keys(stateA.deferredQueue || {}),
    ...Object.keys(stateB.deferredQueue || {}),
  ]);

  for (const key of allDeferredKeys) {
    const recA = stateA.deferredQueue?.[key];
    const recB = stateB.deferredQueue?.[key];
    let merged: DeferredCleanupRecord;
    if (recA && recB) {
      const newer =
        recA.revision !== recB.revision
          ? recA.revision > recB.revision
            ? recA
            : recB
          : recA.updatedAt >= recB.updatedAt
            ? recA
            : recB;
      merged = {
        ...newer,
        enqueuedAt: Math.min(recA.enqueuedAt, recB.enqueuedAt),
        eligibleAt: Math.max(recA.eligibleAt, recB.eligibleAt),
        attempts: Math.max(recA.attempts, recB.attempts),
        lastAttemptAt:
          recA.lastAttemptAt !== undefined || recB.lastAttemptAt !== undefined
            ? Math.max(recA.lastAttemptAt || 0, recB.lastAttemptAt || 0)
            : undefined,
        processingClaim: mergeProcessingClaim(recA.processingClaim, recB.processingClaim, nowMs),
        createdAt: Math.min(recA.createdAt, recB.createdAt),
        updatedAt: Math.max(recA.updatedAt, recB.updatedAt),
        revision: Math.max(recA.revision, recB.revision),
      };
    } else {
      const single = (recA || recB)!;
      merged = {
        ...single,
        processingClaim: mergeProcessingClaim(single.processingClaim, null, nowMs),
      };
    }

    const tombstone = mergedTombstones[buildDeferredTombstoneKey(key)];
    if (!isRecordSupersededByTombstone(merged, tombstone)) {
      mergedDeferred[key] = merged;
    }
  }

  // 3. Merge active editor leases (fail-safe union; keep latest expiresAt & union of keys)
  const mergedLeases: Record<string, EditorMediaLeaseRecord> = {};
  const allLeaseKeys = new Set([
    ...Object.keys(stateA.editorLeases || {}),
    ...Object.keys(stateB.editorLeases || {}),
  ]);

  for (const key of allLeaseKeys) {
    const recA = stateA.editorLeases?.[key];
    const recB = stateB.editorLeases?.[key];
    let merged: EditorMediaLeaseRecord;
    if (recA && recB) {
      const newer =
        recA.revision !== recB.revision
          ? recA.revision > recB.revision
            ? recA
            : recB
          : recA.updatedAt >= recB.updatedAt
            ? recA
            : recB;
      merged = {
        ...newer,
        storageKeys: Array.from(new Set([...(recA.storageKeys || []), ...(recB.storageKeys || [])])),
        urls: Array.from(new Set([...(recA.urls || []), ...(recB.urls || [])])),
        expiresAt: Math.max(recA.expiresAt, recB.expiresAt),
        createdAt: Math.min(recA.createdAt, recB.createdAt),
        updatedAt: Math.max(recA.updatedAt, recB.updatedAt),
        revision: Math.max(recA.revision, recB.revision),
      };
    } else {
      merged = { ...(recA || recB)! };
    }

    const tombstone = mergedTombstones[buildLeaseTombstoneKey(key)];
    if (merged.expiresAt > nowMs && !isRecordSupersededByTombstone(merged, tombstone)) {
      mergedLeases[key] = merged;
    }
  }

  return {
    schemaVersion: 1,
    stateVersion: Math.max(stateA.stateVersion || 0, stateB.stateVersion || 0),
    updatedAt: Math.max(stateA.updatedAt || 0, stateB.updatedAt || 0, nowMs),
    instanceId: stateA.updatedAt >= stateB.updatedAt ? stateA.instanceId : stateB.instanceId,
    pendingMySqlSync: Boolean(stateA.pendingMySqlSync || stateB.pendingMySqlSync),
    lastSyncedMySqlVersion: Math.max(stateA.lastSyncedMySqlVersion || 0, stateB.lastSyncedMySqlVersion || 0),
    pendingUploads: mergedPending,
    deferredQueue: mergedDeferred,
    editorLeases: mergedLeases,
    tombstones: mergedTombstones,
  };
}

/**
 * Default MySQL WebsiteSetting backend using Tori-Wear's existing Prisma client.
 * Uses optimistic concurrency (updateMany with updatedAt guard) to prevent cross-worker clobbering.
 */
export function createPrismaMySqlMediaStateBackend(): MySqlMediaStateBackend {
  return {
    isAvailable(): boolean {
      const client = getPrismaClient();
      return Boolean(client && client.websiteSetting && typeof client.websiteSetting.findUnique === 'function');
    },
    async readRow(): Promise<MySqlWebsiteSettingRow | null> {
      const client = getPrismaClient();
      if (!client?.websiteSetting) return null;
      const row = await client.websiteSetting.findUnique({
        where: { key: MEDIA_CLEANUP_MYSQL_KEY },
      });
      if (!row || typeof row.value !== 'string') return null;
      return {
        key: row.key,
        value: row.value,
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
      };
    },
    async createRow(value: string): Promise<{ created: boolean; conflict?: boolean }> {
      const client = getPrismaClient();
      if (!client?.websiteSetting) return { created: false };
      try {
        await client.websiteSetting.create({
          data: {
            key: MEDIA_CLEANUP_MYSQL_KEY,
            value,
            group: MEDIA_CLEANUP_MYSQL_GROUP,
            description: 'Internal restart-safe media cleanup state (pending uploads, leases, deferred queue).',
            isPublic: false,
          },
        });
        return { created: true };
      } catch (err: any) {
        if (err?.code === 'P2002') {
          return { created: false, conflict: true };
        }
        throw err;
      }
    },
    async compareAndSwapRow(expectedUpdatedAt: Date, nextValue: string): Promise<{ updated: boolean }> {
      const client = getPrismaClient();
      if (!client?.websiteSetting) return { updated: false };
      const res = await client.websiteSetting.updateMany({
        where: {
          key: MEDIA_CLEANUP_MYSQL_KEY,
          updatedAt: expectedUpdatedAt,
        },
        data: {
          value: nextValue,
          group: MEDIA_CLEANUP_MYSQL_GROUP,
          isPublic: false,
        },
      });
      return { updated: Number(res?.count || 0) > 0 };
    },
  };
}

export class DurableMediaStateStore {
  public readonly instanceId: string;
  private readonly runtimeFilePath: string;
  private readonly mysqlBackend: MySqlMediaStateBackend | null;
  private readonly maxCasRetries: number;
  private readonly tombstoneRetentionMs: number;
  private readonly now: () => number;

  private state: DurableMediaStateEnvelope;
  private hydrated = false;
  private mutationChain: Promise<void> = Promise.resolve();

  constructor(options?: DurableMediaStateStoreOptions) {
    this.now = options?.now || (() => Date.now());
    this.instanceId =
      options?.instanceId || `node-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    this.runtimeFilePath =
      options?.runtimeFilePath || resolveSecureStorePath('media_cleanup_state.json');
    this.mysqlBackend =
      options?.mysqlBackend === undefined ? createPrismaMySqlMediaStateBackend() : options.mysqlBackend;
    this.maxCasRetries = Math.max(1, options?.maxCasRetries ?? DEFAULT_MAX_CAS_RETRIES);
    this.tombstoneRetentionMs = options?.tombstoneRetentionMs ?? MEDIA_TOMBSTONE_RETENTION_MS;
    this.state = createEmptyDurableMediaState(this.instanceId, this.now());
  }

  private async runSerialized<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.mutationChain;
    let release!: () => void;
    this.mutationChain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private async readDiskState(nowMs: number): Promise<DurableMediaStateEnvelope | null> {
    try {
      if (!fs.existsSync(this.runtimeFilePath)) return null;
      const raw = await fs.promises.readFile(this.runtimeFilePath, 'utf8');
      if (!raw.trim()) return null;
      return parseEnvelopeJson(raw, this.instanceId, nowMs);
    } catch (err: any) {
      console.warn('[MEDIA-STATE] Could not read runtime JSON state:', err?.message || err);
      return null;
    }
  }

  private async writeDiskStateAtomic(envelope: DurableMediaStateEnvelope): Promise<boolean> {
    const dir = path.dirname(this.runtimeFilePath);
    const tmpPath = `${this.runtimeFilePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(tmpPath, JSON.stringify(envelope, null, 2), 'utf8');
      await fs.promises.rename(tmpPath, this.runtimeFilePath);
      return true;
    } catch (err: any) {
      console.warn('[MEDIA-STATE] Failed atomic runtime JSON write:', err?.message || err);
      try {
        if (fs.existsSync(tmpPath)) {
          await fs.promises.unlink(tmpPath);
        }
      } catch {
        // ignore temp cleanup failure
      }
      return false;
    }
  }

  private async readMySqlState(nowMs: number): Promise<{
    available: boolean;
    reachable: boolean;
    row: MySqlWebsiteSettingRow | null;
    envelope: DurableMediaStateEnvelope | null;
  }> {
    if (!this.mysqlBackend || !this.mysqlBackend.isAvailable()) {
      return { available: false, reachable: false, row: null, envelope: null };
    }
    try {
      const row = await this.mysqlBackend.readRow();
      const envelope = row ? parseEnvelopeJson(row.value, this.instanceId, nowMs) : null;
      return { available: true, reachable: true, row, envelope };
    } catch (err: any) {
      console.warn('[MEDIA-STATE] MySQL read unavailable during state sync:', err?.message || err);
      return { available: true, reachable: false, row: null, envelope: null };
    }
  }

  private compactEnvelope(envelope: DurableMediaStateEnvelope, nowMs: number): DurableMediaStateEnvelope {
    return mergeDurableMediaState(envelope, createEmptyDurableMediaState(this.instanceId, nowMs), nowMs, this.tombstoneRetentionMs);
  }

  private async hydrateUnlocked(): Promise<DurableMediaStateEnvelope> {
    const nowMs = this.now();
    const diskState = await this.readDiskState(nowMs);
    const mysqlRes = await this.readMySqlState(nowMs);

    let reconciled = cloneEnvelope(this.state);
    if (diskState) {
      reconciled = mergeDurableMediaState(reconciled, diskState, nowMs, this.tombstoneRetentionMs);
    }
    if (mysqlRes.envelope) {
      reconciled = mergeDurableMediaState(reconciled, mysqlRes.envelope, nowMs, this.tombstoneRetentionMs);
    }

    // Detect if local disk had unsynced entries relative to MySQL
    const mysqlVersion = mysqlRes.envelope?.stateVersion ?? 0;
    if (mysqlRes.available && !mysqlRes.reachable) {
      reconciled.pendingMySqlSync = true;
    } else if (mysqlRes.available && mysqlRes.reachable) {
      const needsBackfillToMySql =
        reconciled.pendingMySqlSync ||
        reconciled.stateVersion > mysqlVersion ||
        (diskState !== null && mysqlRes.row === null && (
          Object.keys(reconciled.pendingUploads).length > 0 ||
          Object.keys(reconciled.deferredQueue).length > 0 ||
          Object.keys(reconciled.editorLeases).length > 0
        ));
      if (needsBackfillToMySql) {
        reconciled = await this.persistToMySqlWithCasUnlocked(reconciled, mysqlRes.row, nowMs);
      } else if (mysqlRes.envelope) {
        reconciled.pendingMySqlSync = false;
        reconciled.lastSyncedMySqlVersion = Math.max(reconciled.lastSyncedMySqlVersion, mysqlVersion);
      }
    }

    // Re-seed runtime disk if MySQL had fresher records or disk file was missing
    if (
      (mysqlRes.envelope && (!diskState || mysqlRes.envelope.stateVersion > diskState.stateVersion)) ||
      (!diskState && reconciled.stateVersion > 0)
    ) {
      await this.writeDiskStateAtomic(reconciled);
    }

    this.state = reconciled;
    this.hydrated = true;
    return cloneEnvelope(this.state);
  }

  /**
   * Optimistic concurrency (CAS) read-merge-write into MySQL WebsiteSetting.
   * Never lets an older JSON snapshot overwrite newer MySQL state.
   */
  private async persistToMySqlWithCasUnlocked(
    candidate: DurableMediaStateEnvelope,
    initialRow: MySqlWebsiteSettingRow | null,
    nowMs: number
  ): Promise<DurableMediaStateEnvelope> {
    if (!this.mysqlBackend || !this.mysqlBackend.isAvailable()) {
      return candidate;
    }

    let working = cloneEnvelope(candidate);
    let currentRow = initialRow;

    for (let attempt = 0; attempt < this.maxCasRetries; attempt++) {
      try {
        if (attempt > 0) {
          currentRow = await this.mysqlBackend.readRow();
          if (currentRow) {
            const remote = parseEnvelopeJson(currentRow.value, this.instanceId, nowMs);
            if (remote) {
              working = mergeDurableMediaState(remote, working, nowMs, this.tombstoneRetentionMs);
              working.stateVersion = Math.max(working.stateVersion, remote.stateVersion) + 1;
              working.updatedAt = Math.max(working.updatedAt, nowMs);
              working.instanceId = this.instanceId;
            }
          }
        }

        const payloadToStore: DurableMediaStateEnvelope = {
          ...working,
          pendingMySqlSync: false,
          lastSyncedMySqlVersion: working.stateVersion,
        };
        const serialized = JSON.stringify(payloadToStore);

        if (!currentRow) {
          const createRes = await this.mysqlBackend.createRow(serialized);
          if (createRes.created) {
            return payloadToStore;
          }
          if (createRes.conflict) {
            continue; // Another worker inserted first; re-read, merge, and retry CAS
          }
          // Backend became unavailable
          return { ...working, pendingMySqlSync: true };
        }

        const casRes = await this.mysqlBackend.compareAndSwapRow(currentRow.updatedAt, serialized);
        if (casRes.updated) {
          return payloadToStore;
        }
        // CAS mismatch (another process updated MySQL concurrently): retry with fresh read + merge
      } catch (err: any) {
        console.warn('[MEDIA-STATE] MySQL persistence temporarily unavailable; retaining state on runtime disk:', err?.message || err);
        return { ...working, pendingMySqlSync: true };
      }
    }

    console.warn('[MEDIA-STATE] Exhausted MySQL CAS retries under high contention; retaining dirty sync flag for next sweep.');
    return { ...working, pendingMySqlSync: true };
  }

  public async hydrate(): Promise<DurableMediaStateEnvelope> {
    return this.runSerialized(async () => this.hydrateUnlocked());
  }

  public async getSnapshot(): Promise<DurableMediaStateEnvelope> {
    return this.runSerialized(async () => {
      if (!this.hydrated) {
        return this.hydrateUnlocked();
      }
      return cloneEnvelope(this.state);
    });
  }

  /**
   * Reconciles any outage-buffered runtime JSON changes into MySQL (and pulls any
   * newer records written by another worker into local state) without losing any entry.
   */
  public async syncBackends(): Promise<DurableMediaStateEnvelope> {
    return this.runSerialized(async () => {
      const nowMs = this.now();
      if (!this.hydrated) {
        return this.hydrateUnlocked();
      }

      const diskState = await this.readDiskState(nowMs);
      const mysqlRes = await this.readMySqlState(nowMs);

      let merged = cloneEnvelope(this.state);
      if (diskState) {
        merged = mergeDurableMediaState(merged, diskState, nowMs, this.tombstoneRetentionMs);
      }
      if (mysqlRes.envelope) {
        merged = mergeDurableMediaState(merged, mysqlRes.envelope, nowMs, this.tombstoneRetentionMs);
      }

      if (mysqlRes.available && !mysqlRes.reachable) {
        merged.pendingMySqlSync = true;
        await this.writeDiskStateAtomic(merged);
        this.state = merged;
        return cloneEnvelope(this.state);
      }

      if (mysqlRes.available && mysqlRes.reachable) {
        const remoteVer = mysqlRes.envelope?.stateVersion ?? 0;
        const needsPush =
          merged.pendingMySqlSync ||
          merged.stateVersion > remoteVer ||
          (mysqlRes.row === null && merged.stateVersion > 0);

        if (needsPush) {
          merged.stateVersion = Math.max(merged.stateVersion, remoteVer) + 1;
          merged.updatedAt = nowMs;
          merged.instanceId = this.instanceId;
          merged = await this.persistToMySqlWithCasUnlocked(merged, mysqlRes.row, nowMs);
        } else if (mysqlRes.envelope) {
          merged.pendingMySqlSync = false;
          merged.lastSyncedMySqlVersion = Math.max(merged.lastSyncedMySqlVersion, remoteVer);
        }
      }

      await this.writeDiskStateAtomic(merged);
      this.state = merged;
      return cloneEnvelope(this.state);
    });
  }

  /**
   * Runs a serialized read -> merge -> mutate -> atomic disk + MySQL CAS persistence cycle.
   * Never drops mutations if MySQL is temporarily down (falls back to runtime disk + pendingMySqlSync).
   */
  public async mutate<T>(
    mutator: (draft: DurableMediaStateEnvelope, nowMs: number) => { result: T; changed?: boolean }
  ): Promise<T> {
    return this.runSerialized(async () => {
      const nowMs = this.now();
      if (!this.hydrated) {
        await this.hydrateUnlocked();
      }

      // Read latest remote MySQL state before mutating so stale local state never clobbers newer DB state
      const mysqlRes = await this.readMySqlState(nowMs);
      let base = cloneEnvelope(this.state);
      if (mysqlRes.envelope) {
        base = mergeDurableMediaState(base, mysqlRes.envelope, nowMs, this.tombstoneRetentionMs);
      }

      const { result, changed = true } = mutator(base, nowMs);
      if (!changed && !base.pendingMySqlSync) {
        this.state = base;
        return result;
      }

      const compacted = this.compactEnvelope(base, nowMs);
      if (changed) {
        compacted.stateVersion = Math.max(compacted.stateVersion, mysqlRes.envelope?.stateVersion ?? 0) + 1;
        compacted.updatedAt = nowMs;
        compacted.instanceId = this.instanceId;
      }

      // 1. Always write atomically to runtime disk first so no entry is lost on MySQL outage
      if (mysqlRes.available && !mysqlRes.reachable) {
        compacted.pendingMySqlSync = true;
      }
      await this.writeDiskStateAtomic(compacted);

      // 2. Persist to MySQL with CAS read-merge-retry if configured
      let finalEnvelope = compacted;
      if (mysqlRes.available && mysqlRes.reachable) {
        finalEnvelope = await this.persistToMySqlWithCasUnlocked(compacted, mysqlRes.row, nowMs);
        // Update disk snapshot with reconciled state (and cleared pendingMySqlSync flag)
        await this.writeDiskStateAtomic(finalEnvelope);
      }

      this.state = finalEnvelope;
      return result;
    });
  }
}
