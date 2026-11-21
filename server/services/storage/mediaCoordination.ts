/**
 * TORIWEAR Cross-Worker Media Write Coordination & Permanent Retirement Protocol
 *
 * Implements the race-free, single-transaction InnoDB shared/exclusive locking protocol
 * with permanent per-key retired tombstones (zero database schema migrations):
 *
 * 1. Single-Transaction Writer Protocol (Tx_W, MySQL):
 *    - Acquires InnoDB SHARED lock (`LOCK IN SHARE MODE`) on `media_write_coordination_v1`
 *      inside the SAME `prisma.$transaction` as the Product/Category/CMS/Order/Lease mutation.
 *    - Checks `deletingKeys` and performs an InnoDB current read (`LOCK IN SHARE MODE`) on
 *      permanent `media_retired_v1:<sha256(compositeKey)>` rows.
 *    - Eliminates any application-level `activeWrites` TTL: lock lifetime equals transaction lifetime.
 *      A paused or crashed writer's lock is held until MySQL itself COMMITS or ROLLS BACK Tx_W.
 *
 * 2. Authoritative Cleanup Gate 5 (Tx_C, MySQL):
 *    - Acquires InnoDB EXCLUSIVE lock (`FOR UPDATE`) on `media_write_coordination_v1` under READ COMMITTED.
 *    - Cannot be granted while any Tx_W holds `LOCK IN SHARE MODE`, and blocks new writers until Tx_C commits.
 *    - Audits references inside Tx_C, then stamps `deletingKeys[K]` BEFORE releasing the lock and BEFORE
 *      ever calling `storage.deleteFile(K)`.
 *
 * 3. Irreversible One-Way Key Retirement & Permanent Tombstones:
 *    - Once fenced in `deletingKeys[K]`, a key is NEVER resurrected for writers (no timer-based resurrection).
 *    - Only after `storage.fileExists(K) === false` is positively verified does a single atomic transaction
 *      insert the permanent `media_retired_v1:<sha256(K)>` row and remove `deletingKeys[K]`.
 *    - Retired tombstones are append-only, never pruned, never cleared, and never reused.
 *
 * 4. Strict Lock Ordering (Deadlock-Free):
 *    media_write_coordination_v1 -> media_retired_v1:* (sorted) -> media_cleanup_state_v1 -> entity tables
 *
 * 5. Single-Process Preview/Local Mode (USE_MYSQL === false):
 *    - Uses an in-process AsyncRWLock (zero TTLs) + never-pruned `media_retired_keys.json`.
 *    - Explicitly single-process Preview/local only; never presented as multi-worker-safe.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getRawPrismaClient, txStorage } from '../../db/prisma';
import { resolveSecureStorePath } from '../../utils/storageHelper';
import { getStorageAdapter, type StorageAdapter, type StorageProviderName } from './storageAdapter';

export const MEDIA_CLEANUP_MYSQL_KEY = 'media_cleanup_state_v1';
export const MEDIA_CLEANUP_MYSQL_GROUP = 'INTERNAL_MEDIA';
export const MEDIA_COORDINATION_MYSQL_KEY = 'media_write_coordination_v1';
export const MEDIA_TOMBSTONE_MYSQL_GROUP = 'INTERNAL_MEDIA_TOMBSTONE';
export const MEDIA_RETIRED_KEY_PREFIX = 'media_retired_v1:';

export const DEFAULT_WRITER_TX_TIMEOUT_MS = 15_000;
export const DEFAULT_WRITER_TX_MAX_WAIT_MS = 5_000;
export const DEFAULT_CLEANUP_GATE_TX_TIMEOUT_MS = 10_000;
export const DEFAULT_CLEANUP_GATE_TX_MAX_WAIT_MS = 10_000;
export const DEFAULT_FENCE_HEARTBEAT_STALE_MS = 30_000;

export type MediaConflictCode =
  | 'MEDIA_OBJECT_DELETING'
  | 'MEDIA_OBJECT_RETIRED'
  | 'MEDIA_KEY_PERMANENTLY_RETIRED';

export class MediaConflictError extends Error {
  public readonly statusCode = 409;
  public readonly code: MediaConflictCode;
  public readonly compositeKeys: string[];

  constructor(code: MediaConflictCode, compositeKeys: string[], message?: string) {
    super(
      message ||
        (code === 'MEDIA_KEY_PERMANENTLY_RETIRED'
          ? 'Storage key is permanently retired and cannot be reused. Upload under a fresh unique key.'
          : 'One or more referenced media files are being deleted or have been permanently retired. Please upload a fresh image and save again.')
    );
    this.name = 'MediaConflictError';
    this.code = code;
    this.compositeKeys = compositeKeys;
  }
}

export class MediaCoordinationUnavailableError extends Error {
  public readonly statusCode = 503;
  public readonly code = 'MEDIA_COORDINATION_UNAVAILABLE' as const;

  constructor(message?: string) {
    super(
      message ||
        'Media write coordination is temporarily unavailable. Media-bearing writes fail closed to protect storage integrity.'
    );
    this.name = 'MediaCoordinationUnavailableError';
  }
}

export class MediaEnumerationIncompleteError extends Error {
  public readonly statusCode = 400;
  public readonly code = 'MEDIA_ENUMERATION_INCOMPLETE' as const;

  constructor(reason: string) {
    super(`Unable to completely enumerate managed media references in write payload (${reason}). Write rejected fail-closed.`);
    this.name = 'MediaEnumerationIncompleteError';
  }
}

export function isMediaCoordinationError(
  err: unknown
): err is MediaConflictError | MediaCoordinationUnavailableError | MediaEnumerationIncompleteError {
  return (
    err instanceof MediaConflictError ||
    err instanceof MediaCoordinationUnavailableError ||
    err instanceof MediaEnumerationIncompleteError
  );
}

export function isInternalMediaSettingRow(key?: string | null, group?: string | null): boolean {
  const k = String(key || '');
  const g = String(group || '');
  return (
    k === MEDIA_CLEANUP_MYSQL_KEY ||
    k === MEDIA_COORDINATION_MYSQL_KEY ||
    k.startsWith(MEDIA_RETIRED_KEY_PREFIX) ||
    g === MEDIA_CLEANUP_MYSQL_GROUP ||
    g === MEDIA_TOMBSTONE_MYSQL_GROUP
  );
}

export function buildMediaCompositeKey(provider: StorageProviderName, storageKey: string): string {
  return `${provider}:${storageKey}`;
}

export function toRetiredTombstoneKey(compositeKey: string): string {
  const hash = crypto.createHash('sha256').update(compositeKey).digest('hex');
  return `${MEDIA_RETIRED_KEY_PREFIX}${hash}`;
}

/**
 * Generates a unique, monotonic, clock-independent revision token stored in `WebsiteSetting.description`.
 * Eliminates MySQL `updatedAt` timestamp-precision and NTP clock-skew CAS collisions.
 */
export function buildRevisionToken(version: number): string {
  return `rev:${Math.max(1, Math.floor(version))}:${crypto.randomBytes(8).toString('hex')}`;
}

export interface DeletingKeyFence {
  compositeKey: string;
  provider: StorageProviderName;
  storageKey: string;
  status: 'IN_PROGRESS' | 'UNCERTAIN';
  ownerWorkerId: string;
  startedAtMs: number;
  heartbeatAtMs: number;
  attempts: number;
  lastError?: string;
}

export interface MediaWriteCoordinationState {
  schemaVersion: 1;
  version: number;
  deletingKeys: Record<string, DeletingKeyFence>;
}

export interface PermanentRetiredTombstone {
  compositeKey: string;
  provider: StorageProviderName;
  storageKey: string;
  retiredAtMs: number;
  reason: string;
}

export function createEmptyCoordinationState(): MediaWriteCoordinationState {
  return {
    schemaVersion: 1,
    version: 1,
    deletingKeys: {},
  };
}

export function parseCoordinationState(raw: string | null | undefined): MediaWriteCoordinationState {
  if (!raw || typeof raw !== 'string') {
    return createEmptyCoordinationState();
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return createEmptyCoordinationState();
    }
    const version =
      typeof parsed.version === 'number' && Number.isFinite(parsed.version) && parsed.version >= 1
        ? Math.floor(parsed.version)
        : 1;
    const deletingKeys: Record<string, DeletingKeyFence> = {};
    if (parsed.deletingKeys && typeof parsed.deletingKeys === 'object') {
      for (const [k, v] of Object.entries(parsed.deletingKeys as Record<string, any>)) {
        if (v && typeof v === 'object' && typeof v.storageKey === 'string' && typeof v.provider === 'string') {
          deletingKeys[k] = {
            compositeKey: String(v.compositeKey || k),
            provider: v.provider as StorageProviderName,
            storageKey: v.storageKey,
            status: v.status === 'UNCERTAIN' ? 'UNCERTAIN' : 'IN_PROGRESS',
            ownerWorkerId: String(v.ownerWorkerId || 'unknown'),
            startedAtMs: Number(v.startedAtMs || 0),
            heartbeatAtMs: Number(v.heartbeatAtMs || 0),
            attempts: Number(v.attempts || 1),
            lastError: typeof v.lastError === 'string' ? v.lastError : undefined,
          };
        }
      }
    }
    return { schemaVersion: 1, version, deletingKeys };
  } catch {
    return createEmptyCoordinationState();
  }
}

/**
 * In-process async Reader-Writer lock (zero TTLs).
 * - Multiple writers acquire shared locks concurrently.
 * - Gate 5 acquires an exclusive lock (blocks new shared locks once queued so cleanup never starves).
 * Used for single-process Preview/local JSON mode (`USE_MYSQL === false`).
 */
export class AsyncRWLock {
  private activeReaders = 0;
  private activeWriter = false;
  private readonly readerQueue: Array<() => void> = [];
  private readonly writerQueue: Array<() => void> = [];

  private dispatch(): void {
    if (this.activeWriter) return;
    if (this.writerQueue.length > 0 && this.activeReaders === 0) {
      this.activeWriter = true;
      const nextWriter = this.writerQueue.shift()!;
      nextWriter();
      return;
    }
    if (this.writerQueue.length === 0) {
      while (this.readerQueue.length > 0) {
        this.activeReaders += 1;
        const nextReader = this.readerQueue.shift()!;
        nextReader();
      }
    }
  }

  public async withShared<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      if (!this.activeWriter && this.writerQueue.length === 0) {
        this.activeReaders += 1;
        resolve();
      } else {
        this.readerQueue.push(resolve);
      }
    });
    try {
      return await fn();
    } finally {
      this.activeReaders = Math.max(0, this.activeReaders - 1);
      this.dispatch();
    }
  }

  public async withExclusive<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      if (!this.activeWriter && this.activeReaders === 0) {
        this.activeWriter = true;
        resolve();
      } else {
        this.writerQueue.push(resolve);
      }
    });
    try {
      return await fn();
    } finally {
      this.activeWriter = false;
      this.dispatch();
    }
  }
}

export interface StrictManagedKeyExtraction {
  complete: boolean;
  reason?: string;
  storageKeys: string[];
  compositeKeys: string[];
  urls: string[];
}

const EMBEDDED_URL_PATTERN = /(?:https?:\/\/[^\s"'<>\\`]+|\/generated-assets\/[^\s"'<>\\`]+)/gi;

/**
 * Deterministic, fail-closed recursive managed-URL extractor.
 * Walks all objects, arrays, JSON-encoded strings, and embedded URL patterns in text/HTML.
 * Returns `{ complete: false }` if the payload is uninspectable (binary/opaque) or exceeds safety limits.
 */
export function extractManagedKeysStrict(
  payload: unknown,
  storage: StorageAdapter,
  options?: { maxDepth?: number; maxNodes?: number }
): StrictManagedKeyExtraction {
  const maxDepth = options?.maxDepth ?? 20;
  const maxNodes = options?.maxNodes ?? 25_000;
  const storageKeys = new Set<string>();
  const urls = new Set<string>();
  const visited = new WeakSet<object>();
  let nodeCount = 0;

  const inspectString = (str: string, depth: number): { ok: boolean; reason?: string } => {
    const trimmed = str.trim();
    if (!trimmed) return { ok: true };

    const directKey = storage.resolveManagedStorageKey(trimmed);
    if (directKey) {
      storageKeys.add(directKey);
      urls.add(trimmed);
    }

    // Check embedded URLs inside rich text / HTML / serialized strings
    EMBEDDED_URL_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = EMBEDDED_URL_PATTERN.exec(trimmed)) !== null) {
      const candidate = match[0].replace(/[),.;]+$/, '');
      const key = storage.resolveManagedStorageKey(candidate);
      if (key) {
        storageKeys.add(key);
        urls.add(candidate);
      }
    }

    // If string looks like serialized JSON, parse and recurse to catch nested escaped URLs
    if (
      depth < maxDepth &&
      ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']')))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return walk(parsed, depth + 1);
      } catch {
        // Plain text starting/ending with braces; already scanned with EMBEDDED_URL_PATTERN
      }
    }

    return { ok: true };
  };

  const walk = (value: unknown, depth: number): { ok: boolean; reason?: string } => {
    if (value === null || value === undefined) return { ok: true };
    if (depth > maxDepth) {
      return { ok: false, reason: `max nesting depth (${maxDepth}) exceeded` };
    }
    nodeCount += 1;
    if (nodeCount > maxNodes) {
      return { ok: false, reason: `max inspectable node count (${maxNodes}) exceeded` };
    }

    const t = typeof value;
    if (t === 'string') {
      return inspectString(value as string, depth);
    }
    if (t === 'number' || t === 'boolean' || t === 'bigint') {
      return { ok: true };
    }
    if (t === 'function' || t === 'symbol') {
      return { ok: false, reason: `uninspectable payload value type (${t})` };
    }

    if (Buffer.isBuffer(value) || value instanceof Uint8Array || value instanceof ArrayBuffer) {
      return { ok: false, reason: 'uninspectable binary payload' };
    }

    if (value instanceof Date || value instanceof RegExp) {
      return { ok: true };
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const res = walk(item, depth + 1);
        if (!res.ok) return res;
      }
      return { ok: true };
    }

    if (value instanceof Set) {
      for (const item of value) {
        const res = walk(item, depth + 1);
        if (!res.ok) return res;
      }
      return { ok: true };
    }

    if (value instanceof Map) {
      for (const [k, v] of value.entries()) {
        const rk = walk(k, depth + 1);
        if (!rk.ok) return rk;
        const rv = walk(v, depth + 1);
        if (!rv.ok) return rv;
      }
      return { ok: true };
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (visited.has(obj)) return { ok: true };
      visited.add(obj);

      for (const [k, v] of Object.entries(obj)) {
        if (isInternalMediaSettingRow(k, k)) continue;
        const res = walk(v, depth + 1);
        if (!res.ok) return res;
      }
      return { ok: true };
    }

    return { ok: false, reason: 'unknown opaque payload structure' };
  };

  const result = walk(payload, 0);
  if (!result.ok) {
    return {
      complete: false,
      reason: result.reason,
      storageKeys: [],
      compositeKeys: [],
      urls: [],
    };
  }

  const sortedStorageKeys = Array.from(storageKeys).sort();
  const compositeKeys = sortedStorageKeys.map((k) => buildMediaCompositeKey(storage.providerName, k));
  return {
    complete: true,
    storageKeys: sortedStorageKeys,
    compositeKeys,
    urls: Array.from(urls),
  };
}

/**
 * Low-level MySQL transaction helpers on `website_settings` using InnoDB locking reads
 * (`LOCK IN SHARE MODE` / `FOR UPDATE`) and unique `description` revision tokens.
 * Supports both real MySQL Prisma clients (`$queryRawUnsafe` / `$executeRawUnsafe`)
 * and unit-test Prisma mocks.
 */
async function ensureCoordinationRowInMySql(prisma: any): Promise<void> {
  const initialJson = JSON.stringify(createEmptyCoordinationState());
  const initialToken = buildRevisionToken(1);

  if (typeof prisma.$executeRawUnsafe === 'function') {
    await prisma.$executeRawUnsafe(
      'INSERT IGNORE INTO `website_settings` (`id`, `key`, `value`, `group`, `description`, `isPublic`, `updatedAt`) VALUES (?, ?, ?, ?, ?, ?, ?)',
      `coord-${crypto.randomBytes(8).toString('hex')}`,
      MEDIA_COORDINATION_MYSQL_KEY,
      initialJson,
      MEDIA_CLEANUP_MYSQL_GROUP,
      initialToken,
      false,
      new Date()
    );
    return;
  }

  if (prisma.websiteSetting?.findUnique && prisma.websiteSetting?.create) {
    const existing = await prisma.websiteSetting.findUnique({
      where: { key: MEDIA_COORDINATION_MYSQL_KEY },
    });
    if (!existing) {
      try {
        await prisma.websiteSetting.create({
          data: {
            key: MEDIA_COORDINATION_MYSQL_KEY,
            value: initialJson,
            group: MEDIA_CLEANUP_MYSQL_GROUP,
            description: initialToken,
            isPublic: false,
          },
        });
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err;
      }
    }
  }
}

export async function lockAndReadCoordinationRowInTx(
  tx: any,
  mode: 'SHARED' | 'EXCLUSIVE'
): Promise<{ state: MediaWriteCoordinationState; description: string | null }> {
  if (typeof tx.$queryRawUnsafe === 'function') {
    const sql =
      mode === 'EXCLUSIVE'
        ? 'SELECT `value`, `description` FROM `website_settings` WHERE `key` = ? FOR UPDATE'
        : 'SELECT `value`, `description` FROM `website_settings` WHERE `key` = ? LOCK IN SHARE MODE';
    const rows = (await tx.$queryRawUnsafe(sql, MEDIA_COORDINATION_MYSQL_KEY)) as Array<{
      value?: string;
      description?: string | null;
    }>;
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new MediaCoordinationUnavailableError(
        'Media write coordination row is missing in MySQL website_settings.'
      );
    }
    return {
      state: parseCoordinationState(rows[0].value),
      description: rows[0].description ?? null,
    };
  }

  if (tx.websiteSetting?.findUnique) {
    const row = await tx.websiteSetting.findUnique({
      where: { key: MEDIA_COORDINATION_MYSQL_KEY },
    });
    if (!row) {
      throw new MediaCoordinationUnavailableError(
        'Media write coordination row is missing in MySQL website_settings.'
      );
    }
    return {
      state: parseCoordinationState(row.value),
      description: row.description ?? null,
    };
  }

  throw new MediaCoordinationUnavailableError('Prisma transaction client cannot query website_settings.');
}

export async function readPermanentRetiredTombstonesInTx(
  tx: any,
  compositeKeys: string[]
): Promise<string[]> {
  if (compositeKeys.length === 0) return [];
  const keyByTombstone = new Map<string, string>();
  const tombstoneKeys: string[] = [];
  for (const ck of Array.from(new Set(compositeKeys)).sort()) {
    const tk = toRetiredTombstoneKey(ck);
    keyByTombstone.set(tk, ck);
    tombstoneKeys.push(tk);
  }
  tombstoneKeys.sort();

  if (typeof tx.$queryRawUnsafe === 'function') {
    const placeholders = tombstoneKeys.map(() => '?').join(', ');
    const sql = `SELECT \`key\` FROM \`website_settings\` WHERE \`key\` IN (${placeholders}) LOCK IN SHARE MODE`;
    const rows = (await tx.$queryRawUnsafe(sql, ...tombstoneKeys)) as Array<{ key?: string }>;
    const matched: string[] = [];
    for (const row of rows || []) {
      if (row?.key && keyByTombstone.has(row.key)) {
        matched.push(keyByTombstone.get(row.key)!);
      }
    }
    return matched;
  }

  if (tx.websiteSetting?.findMany) {
    const rows = (await tx.websiteSetting.findMany({
      where: { key: { in: tombstoneKeys } },
      select: { key: true },
    })) as Array<{ key?: string }>;
    const matched: string[] = [];
    for (const row of rows || []) {
      if (row?.key && keyByTombstone.has(row.key)) {
        matched.push(keyByTombstone.get(row.key)!);
      }
    }
    return matched;
  }

  throw new MediaCoordinationUnavailableError('Prisma transaction client cannot query retired tombstones.');
}

async function updateCoordinationRowInTx(
  tx: any,
  nextState: MediaWriteCoordinationState,
  expectedDescription: string | null
): Promise<string> {
  const nextToken = buildRevisionToken(nextState.version);
  const serialized = JSON.stringify(nextState);

  if (typeof tx.$executeRawUnsafe === 'function') {
    const affected = await tx.$executeRawUnsafe(
      'UPDATE `website_settings` SET `value` = ?, `description` = ?, `group` = ?, `isPublic` = ?, `updatedAt` = ? WHERE `key` = ? AND (`description` <=> ?)',
      serialized,
      nextToken,
      MEDIA_CLEANUP_MYSQL_GROUP,
      false,
      new Date(),
      MEDIA_COORDINATION_MYSQL_KEY,
      expectedDescription
    );
    if (Number(affected) <= 0) {
      throw new MediaCoordinationUnavailableError(
        'Concurrent revision mismatch updating media_write_coordination_v1.'
      );
    }
    return nextToken;
  }

  if (tx.websiteSetting?.updateMany) {
    const res = await tx.websiteSetting.updateMany({
      where: {
        key: MEDIA_COORDINATION_MYSQL_KEY,
        description: expectedDescription,
      },
      data: {
        value: serialized,
        description: nextToken,
        group: MEDIA_CLEANUP_MYSQL_GROUP,
        isPublic: false,
      },
    });
    if (Number(res?.count || 0) <= 0) {
      throw new MediaCoordinationUnavailableError(
        'Concurrent revision mismatch updating media_write_coordination_v1.'
      );
    }
    return nextToken;
  }

  throw new MediaCoordinationUnavailableError('Prisma transaction client cannot update media_write_coordination_v1.');
}

async function insertPermanentRetiredTombstoneInTx(
  tx: any,
  tombstone: PermanentRetiredTombstone
): Promise<void> {
  const tombstoneKey = toRetiredTombstoneKey(tombstone.compositeKey);
  const serialized = JSON.stringify(tombstone);
  const token = buildRevisionToken(1);

  if (typeof tx.$executeRawUnsafe === 'function') {
    await tx.$executeRawUnsafe(
      'INSERT IGNORE INTO `website_settings` (`id`, `key`, `value`, `group`, `description`, `isPublic`, `updatedAt`) VALUES (?, ?, ?, ?, ?, ?, ?)',
      `ret-${crypto.randomBytes(8).toString('hex')}`,
      tombstoneKey,
      serialized,
      MEDIA_TOMBSTONE_MYSQL_GROUP,
      token,
      false,
      new Date()
    );
    return;
  }

  if (tx.websiteSetting?.create) {
    try {
      await tx.websiteSetting.create({
        data: {
          key: tombstoneKey,
          value: serialized,
          group: MEDIA_TOMBSTONE_MYSQL_GROUP,
          description: token,
          isPublic: false,
        },
      });
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err;
    }
    return;
  }

  throw new MediaCoordinationUnavailableError('Prisma transaction client cannot insert permanent tombstone.');
}

export interface MediaWriteCoordinatorOptions {
  prismaProvider?: () => any;
  storageAdapterProvider?: () => StorageAdapter;
  localCoordinationFilePath?: string;
  localRetiredFilePath?: string;
  workerId?: string;
  now?: () => number;
  writerTxTimeoutMs?: number;
  writerTxMaxWaitMs?: number;
  cleanupGateTxTimeoutMs?: number;
  cleanupGateTxMaxWaitMs?: number;
}

export type AcquireDeletionFenceResult =
  | { status: 'fenced'; fence: DeletingKeyFence }
  | { status: 'referenced' }
  | { status: 'already-fenced'; fence: DeletingKeyFence }
  | { status: 'already-retired' }
  | { status: 'coordination-unavailable'; error: string };

/**
 * Coordinates media-bearing writes, permanent retired tombstones, and Gate 5 deletion fences
 * across Node.js workers (when MySQL is configured) or within a single local Preview process.
 */
export class MediaWriteCoordinator {
  public readonly workerId: string;
  private readonly getPrisma: () => any;
  private readonly getStorage: () => StorageAdapter;
  private readonly localCoordinationFilePath: string;
  private readonly localRetiredFilePath: string;
  private readonly now: () => number;
  private readonly writerTxTimeoutMs: number;
  private readonly writerTxMaxWaitMs: number;
  private readonly cleanupGateTxTimeoutMs: number;
  private readonly cleanupGateTxMaxWaitMs: number;

  // In-process RW lock for single-process Preview/local JSON mode (zero TTLs)
  private readonly localRwLock = new AsyncRWLock();

  constructor(options?: MediaWriteCoordinatorOptions) {
    this.now = options?.now || (() => Date.now());
    this.workerId =
      options?.workerId || `worker-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    this.getPrisma = options?.prismaProvider || (() => getRawPrismaClient());
    this.getStorage = options?.storageAdapterProvider || (() => getStorageAdapter());
    this.localCoordinationFilePath =
      options?.localCoordinationFilePath || resolveSecureStorePath('media_write_coordination.json');
    this.localRetiredFilePath =
      options?.localRetiredFilePath || resolveSecureStorePath('media_retired_keys.json');
    this.writerTxTimeoutMs = options?.writerTxTimeoutMs ?? DEFAULT_WRITER_TX_TIMEOUT_MS;
    this.writerTxMaxWaitMs = options?.writerTxMaxWaitMs ?? DEFAULT_WRITER_TX_MAX_WAIT_MS;
    this.cleanupGateTxTimeoutMs = options?.cleanupGateTxTimeoutMs ?? DEFAULT_CLEANUP_GATE_TX_TIMEOUT_MS;
    this.cleanupGateTxMaxWaitMs = options?.cleanupGateTxMaxWaitMs ?? DEFAULT_CLEANUP_GATE_TX_MAX_WAIT_MS;
  }

  private getMySqlClient(): any | null {
    const client = this.getPrisma();
    if (client && typeof client.$transaction === 'function') {
      return client;
    }
    return null;
  }

  public isMySqlCoordinationActive(): boolean {
    return this.getMySqlClient() !== null;
  }

  // ---- Single-process local JSON persistence (strictly USE_MYSQL === false) ----

  private readLocalCoordinationState(): MediaWriteCoordinationState {
    try {
      if (!fs.existsSync(this.localCoordinationFilePath)) {
        return createEmptyCoordinationState();
      }
      const raw = fs.readFileSync(this.localCoordinationFilePath, 'utf8');
      return parseCoordinationState(raw);
    } catch {
      return createEmptyCoordinationState();
    }
  }

  private writeLocalCoordinationState(state: MediaWriteCoordinationState): void {
    const dir = path.dirname(this.localCoordinationFilePath);
    const tmp = `${this.localCoordinationFilePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmp, this.localCoordinationFilePath);
  }

  private readLocalRetiredTombstones(): Record<string, PermanentRetiredTombstone> {
    try {
      if (!fs.existsSync(this.localRetiredFilePath)) {
        return {};
      }
      const raw = fs.readFileSync(this.localRetiredFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private writeLocalRetiredTombstone(tombstone: PermanentRetiredTombstone): void {
    const current = this.readLocalRetiredTombstones();
    if (!current[tombstone.compositeKey]) {
      current[tombstone.compositeKey] = tombstone;
      const dir = path.dirname(this.localRetiredFilePath);
      const tmp = `${this.localRetiredFilePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(current, null, 2), 'utf8');
      fs.renameSync(tmp, this.localRetiredFilePath);
    }
  }

  // ---- Permanent Upload-Key & Retired-Key Guard ----

  /**
   * Verifies that none of the provided compositeKeys are currently being deleted
   * OR permanently retired. Never clears a retired tombstone.
   */
  public async assertKeysNotRetiredOrDeleting(
    compositeKeys: string[],
    options?: { codeOnRetired?: MediaConflictCode }
  ): Promise<void> {
    const uniqueKeys = Array.from(new Set(compositeKeys.filter(Boolean))).sort();
    if (uniqueKeys.length === 0) return;

    const retiredCode = options?.codeOnRetired || 'MEDIA_OBJECT_RETIRED';
    const prisma = this.getMySqlClient();

    if (prisma) {
      try {
        await ensureCoordinationRowInMySql(prisma);
        await prisma.$transaction(
          async (tx: any) => {
            const { state } = await lockAndReadCoordinationRowInTx(tx, 'SHARED');
            const deletingHits = uniqueKeys.filter((k) => Boolean(state.deletingKeys[k]));
            if (deletingHits.length > 0) {
              throw new MediaConflictError('MEDIA_OBJECT_DELETING', deletingHits);
            }
            const retiredHits = await readPermanentRetiredTombstonesInTx(tx, uniqueKeys);
            if (retiredHits.length > 0) {
              throw new MediaConflictError(retiredCode, retiredHits);
            }
          },
          {
            isolationLevel: 'ReadCommitted',
            maxWait: this.writerTxMaxWaitMs,
            timeout: this.writerTxTimeoutMs,
          }
        );
        return;
      } catch (err: any) {
        if (isMediaCoordinationError(err)) throw err;
        throw new MediaCoordinationUnavailableError(
          `MySQL media coordination check failed: ${err?.message || String(err)}`
        );
      }
    }

    // Single-process local Preview mode
    await this.localRwLock.withShared(async () => {
      const state = this.readLocalCoordinationState();
      const deletingHits = uniqueKeys.filter((k) => Boolean(state.deletingKeys[k]));
      if (deletingHits.length > 0) {
        throw new MediaConflictError('MEDIA_OBJECT_DELETING', deletingHits);
      }
      const retired = this.readLocalRetiredTombstones();
      const retiredHits = uniqueKeys.filter((k) => Boolean(retired[k]));
      if (retiredHits.length > 0) {
        throw new MediaConflictError(retiredCode, retiredHits);
      }
    });
  }

  // ---- Atomic Single-Transaction Coordinated Write (Tx_W) ----

  /**
   * Executes a media-bearing database mutation inside ONE single ACID MySQL transaction (Tx_W)
   * holding an InnoDB shared lock (`LOCK IN SHARE MODE`) on `media_write_coordination_v1`
   * after atomically verifying `deletingKeys` and permanent `media_retired_v1:*` tombstones.
   *
   * - If `payload` has zero managed storage keys (and `complete === true`): executes directly
   *   with zero media coordination overhead (non-media operations remain non-fatal on outage).
   * - If `payload` cannot be completely enumerated (`complete === false`): fails closed immediately.
   * - If `USE_MYSQL === true` and MySQL coordination is unreachable: throws `MediaCoordinationUnavailableError`
   *   (503) — NEVER bypasses coordination for media-bearing writes.
   */
  public async executeCoordinatedWrite<T>(params: {
    payload: unknown;
    /** Optional additional explicit composite keys (e.g. from pre-resolved URLs) */
    extraUrls?: string[];
    /**
     * Runs inside Tx_W (when MySQL is configured, `tx` is the active Prisma transaction client
     * and `txStorage` is also bound to `tx`). When `USE_MYSQL === false`, `tx` is `null` and
     * runs under the in-process shared `AsyncRWLock`.
     */
    executeInTx: (tx: any | null, verifiedCompositeKeys: string[]) => Promise<T>;
    /**
     * Optional DB-driven key resolver invoked inside Tx_W after acquiring the shared coordination lock
     * (e.g., for `restore(id)` where candidate URLs come from an existing DB row).
     */
    resolveAdditionalPayloadInTx?: (tx: any | null) => Promise<unknown>;
  }): Promise<T> {
    const storage = this.getStorage();
    const extracted = extractManagedKeysStrict(
      params.extraUrls ? { payload: params.payload, extraUrls: params.extraUrls } : params.payload,
      storage
    );
    if (!extracted.complete) {
      throw new MediaEnumerationIncompleteError(extracted.reason || 'incomplete payload scan');
    }

    const prisma = this.getMySqlClient();

    // Fast path: zero managed URLs and no DB-side payload lookup -> non-media write (non-fatal)
    if (extracted.compositeKeys.length === 0 && !params.resolveAdditionalPayloadInTx) {
      return params.executeInTx(null, []);
    }

    if (prisma) {
      try {
        await ensureCoordinationRowInMySql(prisma);
      } catch (err: any) {
        if (isMediaCoordinationError(err)) throw err;
        throw new MediaCoordinationUnavailableError(
          `MySQL media coordination bootstrap unavailable: ${err?.message || String(err)}`
        );
      }

      try {
        return await prisma.$transaction(
          async (tx: any) => {
            // Step W1: Acquire InnoDB SHARED lock on `media_write_coordination_v1` (current read)
            const { state } = await lockAndReadCoordinationRowInTx(tx, 'SHARED');

            // Combine pre-extracted keys with any DB-loaded keys resolved inside Tx_W
            let allCompositeKeys = [...extracted.compositeKeys];
            if (params.resolveAdditionalPayloadInTx) {
              const extraPayload = await txStorage.run(tx, () => params.resolveAdditionalPayloadInTx!(tx));
              const extraExtracted = extractManagedKeysStrict(extraPayload, storage);
              if (!extraExtracted.complete) {
                throw new MediaEnumerationIncompleteError(
                  extraExtracted.reason || 'incomplete DB-backed payload scan'
                );
              }
              allCompositeKeys = Array.from(new Set([...allCompositeKeys, ...extraExtracted.compositeKeys])).sort();
            }

            if (allCompositeKeys.length > 0) {
              // Step W2: Check active/uncertain deletingKeys
              const deletingHits = allCompositeKeys.filter((k) => Boolean(state.deletingKeys[k]));
              if (deletingHits.length > 0) {
                throw new MediaConflictError('MEDIA_OBJECT_DELETING', deletingHits);
              }

              // Step W3: InnoDB CURRENT READ on permanent retired tombstones
              const retiredHits = await readPermanentRetiredTombstonesInTx(tx, allCompositeKeys);
              if (retiredHits.length > 0) {
                throw new MediaConflictError('MEDIA_OBJECT_RETIRED', retiredHits);
              }
            }

            // Step W4: Execute the ACTUAL entity mutation inside the SAME Tx_W transaction!
            return await txStorage.run(tx, () => params.executeInTx(tx, allCompositeKeys));
          },
          {
            isolationLevel: 'ReadCommitted',
            maxWait: this.writerTxMaxWaitMs,
            timeout: this.writerTxTimeoutMs,
          }
        );
      } catch (err: any) {
        if (isMediaCoordinationError(err)) throw err;
        throw new MediaCoordinationUnavailableError(
          `Coordinated MySQL media write failed: ${err?.message || String(err)}`
        );
      }
    }

    // Single-process Preview / local JSON mode (USE_MYSQL === false)
    return this.localRwLock.withShared(async () => {
      const state = this.readLocalCoordinationState();
      let allCompositeKeys = [...extracted.compositeKeys];
      if (params.resolveAdditionalPayloadInTx) {
        const extraPayload = await params.resolveAdditionalPayloadInTx(null);
        const extraExtracted = extractManagedKeysStrict(extraPayload, storage);
        if (!extraExtracted.complete) {
          throw new MediaEnumerationIncompleteError(
            extraExtracted.reason || 'incomplete local DB-backed payload scan'
          );
        }
        allCompositeKeys = Array.from(new Set([...allCompositeKeys, ...extraExtracted.compositeKeys])).sort();
      }

      if (allCompositeKeys.length > 0) {
        const deletingHits = allCompositeKeys.filter((k) => Boolean(state.deletingKeys[k]));
        if (deletingHits.length > 0) {
          throw new MediaConflictError('MEDIA_OBJECT_DELETING', deletingHits);
        }
        const retired = this.readLocalRetiredTombstones();
        const retiredHits = allCompositeKeys.filter((k) => Boolean(retired[k]));
        if (retiredHits.length > 0) {
          throw new MediaConflictError('MEDIA_OBJECT_RETIRED', retiredHits);
        }
      }

      return params.executeInTx(null, allCompositeKeys);
    });
  }

  // ---- Authoritative Cleanup Gate 5 (Tx_C) ----

  /**
   * Acquires an EXCLUSIVE lock (`FOR UPDATE` in MySQL / exclusive `AsyncRWLock` in local Preview),
   * invokes `isReferencedInTx(tx)` while zero writers are in flight, and atomically commits
   * `deletingKeys[compositeKey]` BEFORE releasing the lock and BEFORE any `storage.deleteFile()` call.
   */
  public async acquireDeletionFenceAtomic(params: {
    provider: StorageProviderName;
    storageKey: string;
    isReferencedInTx: (tx: any | null) => Promise<boolean>;
  }): Promise<AcquireDeletionFenceResult> {
    const compositeKey = buildMediaCompositeKey(params.provider, params.storageKey);
    const prisma = this.getMySqlClient();

    if (prisma) {
      try {
        await ensureCoordinationRowInMySql(prisma);
        return await prisma.$transaction(
          async (tx: any) => {
            // Optional bounded InnoDB lock wait timeout so half-open/paused writers fail closed cleanly
            if (typeof tx.$executeRawUnsafe === 'function') {
              try {
                await tx.$executeRawUnsafe('SET SESSION innodb_lock_wait_timeout = 10');
              } catch {
                // ignore on non-MySQL/mock drivers that do not implement SET SESSION
              }
            }

            // Step C1: EXCLUSIVE lock on `media_write_coordination_v1`
            // Blocks until all prior Tx_W have COMMITTED or ROLLED BACK; blocks new Tx_W until Tx_C commits.
            const { state, description } = await lockAndReadCoordinationRowInTx(tx, 'EXCLUSIVE');

            if (state.deletingKeys[compositeKey]) {
              return {
                status: 'already-fenced' as const,
                fence: state.deletingKeys[compositeKey],
              };
            }

            const retiredHits = await readPermanentRetiredTombstonesInTx(tx, [compositeKey]);
            if (retiredHits.length > 0) {
              return { status: 'already-retired' as const };
            }

            // Step C2: Authoritative in-transaction reference audit (under READ COMMITTED)
            const stillReferenced = await txStorage.run(tx, () => params.isReferencedInTx(tx));
            if (stillReferenced) {
              return { status: 'referenced' as const };
            }

            // Step C3: Stamp irreversible deletion fence BEFORE storage.deleteFile() is ever called
            const nowMs = this.now();
            const fence: DeletingKeyFence = {
              compositeKey,
              provider: params.provider,
              storageKey: params.storageKey,
              status: 'IN_PROGRESS',
              ownerWorkerId: this.workerId,
              startedAtMs: nowMs,
              heartbeatAtMs: nowMs,
              attempts: 1,
            };
            const nextState: MediaWriteCoordinationState = {
              schemaVersion: 1,
              version: state.version + 1,
              deletingKeys: {
                ...state.deletingKeys,
                [compositeKey]: fence,
              },
            };

            await updateCoordinationRowInTx(tx, nextState, description);
            return { status: 'fenced' as const, fence };
          },
          {
            isolationLevel: 'ReadCommitted',
            maxWait: this.cleanupGateTxMaxWaitMs,
            timeout: this.cleanupGateTxTimeoutMs,
          }
        );
      } catch (err: any) {
        return {
          status: 'coordination-unavailable',
          error: err?.message || 'MySQL coordination lock failed during Gate 5',
        };
      }
    }

    // Single-process Preview / local JSON mode
    return this.localRwLock.withExclusive(async () => {
      const state = this.readLocalCoordinationState();
      if (state.deletingKeys[compositeKey]) {
        return {
          status: 'already-fenced' as const,
          fence: state.deletingKeys[compositeKey],
        };
      }
      const retired = this.readLocalRetiredTombstones();
      if (retired[compositeKey]) {
        return { status: 'already-retired' as const };
      }

      const stillReferenced = await params.isReferencedInTx(null);
      if (stillReferenced) {
        return { status: 'referenced' as const };
      }

      const nowMs = this.now();
      const fence: DeletingKeyFence = {
        compositeKey,
        provider: params.provider,
        storageKey: params.storageKey,
        status: 'IN_PROGRESS',
        ownerWorkerId: this.workerId,
        startedAtMs: nowMs,
        heartbeatAtMs: nowMs,
        attempts: 1,
      };
      const nextState: MediaWriteCoordinationState = {
        schemaVersion: 1,
        version: state.version + 1,
        deletingKeys: {
          ...state.deletingKeys,
          [compositeKey]: fence,
        },
      };
      this.writeLocalCoordinationState(nextState);
      return { status: 'fenced' as const, fence };
    });
  }

  /**
   * Marks an active deletion fence as UNCERTAIN (e.g., storage error or timeout).
   * Keeps the key permanently blocked to writers until forward-completion verifies `fileExists === false`.
   */
  public async markDeletionFenceUncertain(compositeKey: string, errorMessage: string): Promise<void> {
    const prisma = this.getMySqlClient();
    const nowMs = this.now();

    if (prisma) {
      try {
        await ensureCoordinationRowInMySql(prisma);
        await prisma.$transaction(
          async (tx: any) => {
            const { state, description } = await lockAndReadCoordinationRowInTx(tx, 'EXCLUSIVE');
            const existing = state.deletingKeys[compositeKey];
            if (!existing) return;
            const nextState: MediaWriteCoordinationState = {
              schemaVersion: 1,
              version: state.version + 1,
              deletingKeys: {
                ...state.deletingKeys,
                [compositeKey]: {
                  ...existing,
                  status: 'UNCERTAIN',
                  heartbeatAtMs: nowMs,
                  attempts: (existing.attempts || 1) + 1,
                  lastError: errorMessage,
                },
              },
            };
            await updateCoordinationRowInTx(tx, nextState, description);
          },
          {
            isolationLevel: 'ReadCommitted',
            maxWait: this.cleanupGateTxMaxWaitMs,
            timeout: this.cleanupGateTxTimeoutMs,
          }
        );
      } catch (err: any) {
        console.warn('[MEDIA-COORD] Failed to mark deletion fence UNCERTAIN (fence remains active):', err?.message || err);
      }
      return;
    }

    await this.localRwLock.withExclusive(async () => {
      const state = this.readLocalCoordinationState();
      const existing = state.deletingKeys[compositeKey];
      if (!existing) return;
      state.version += 1;
      state.deletingKeys[compositeKey] = {
        ...existing,
        status: 'UNCERTAIN',
        heartbeatAtMs: nowMs,
        attempts: (existing.attempts || 1) + 1,
        lastError: errorMessage,
      };
      this.writeLocalCoordinationState(state);
    });
  }

  /**
   * Atomically transitions a fenced key into a PERMANENT retired tombstone (`media_retired_v1:<sha256>`)
   * and removes `deletingKeys[compositeKey]` in ONE ACID transaction.
   *
   * MUST ONLY be called AFTER `storage.fileExists(storageKey) === false` is positively verified!
   */
  public async finalizeDeletionFenceToPermanentTombstone(params: {
    provider: StorageProviderName;
    storageKey: string;
    reason: string;
  }): Promise<boolean> {
    const compositeKey = buildMediaCompositeKey(params.provider, params.storageKey);
    const tombstone: PermanentRetiredTombstone = {
      compositeKey,
      provider: params.provider,
      storageKey: params.storageKey,
      retiredAtMs: this.now(),
      reason: params.reason,
    };
    const prisma = this.getMySqlClient();

    if (prisma) {
      await ensureCoordinationRowInMySql(prisma);
      await prisma.$transaction(
        async (tx: any) => {
          // Strict lock order: (1) media_write_coordination_v1 FOR UPDATE -> (2) INSERT IGNORE media_retired_v1:<hash>
          const { state, description } = await lockAndReadCoordinationRowInTx(tx, 'EXCLUSIVE');
          await insertPermanentRetiredTombstoneInTx(tx, tombstone);

          const nextDeleting = { ...state.deletingKeys };
          delete nextDeleting[compositeKey];
          const nextState: MediaWriteCoordinationState = {
            schemaVersion: 1,
            version: state.version + 1,
            deletingKeys: nextDeleting,
          };
          await updateCoordinationRowInTx(tx, nextState, description);
        },
        {
          isolationLevel: 'ReadCommitted',
          maxWait: this.cleanupGateTxMaxWaitMs,
          timeout: this.cleanupGateTxTimeoutMs,
        }
      );
      return true;
    }

    await this.localRwLock.withExclusive(async () => {
      // Write permanent tombstone FIRST before removing fence so crash never leaves a gap
      this.writeLocalRetiredTombstone(tombstone);
      const state = this.readLocalCoordinationState();
      if (state.deletingKeys[compositeKey]) {
        delete state.deletingKeys[compositeKey];
        state.version += 1;
        this.writeLocalCoordinationState(state);
      }
    });
    return true;
  }

  /**
   * Claims stale or UNCERTAIN deletion fences for forward-completion crash reconciliation.
   * Never unblocks writers; only authorizes taking over forward deletion to verified `fileExists === false`.
   */
  public async claimReconcilableDeletingFences(
    provider: StorageProviderName,
    staleThresholdMs: number = DEFAULT_FENCE_HEARTBEAT_STALE_MS
  ): Promise<DeletingKeyFence[]> {
    const prisma = this.getMySqlClient();
    const nowMs = this.now();

    const pickAndClaim = (state: MediaWriteCoordinationState): { claimed: DeletingKeyFence[]; changed: boolean } => {
      const claimed: DeletingKeyFence[] = [];
      let changed = false;
      for (const [k, fence] of Object.entries(state.deletingKeys)) {
        if (!fence || fence.provider !== provider) continue;
        const isStale = nowMs - fence.heartbeatAtMs >= staleThresholdMs;
        const shouldTakeover =
          fence.status === 'UNCERTAIN' || (fence.status === 'IN_PROGRESS' && isStale);
        if (!shouldTakeover) continue;

        const updated: DeletingKeyFence = {
          ...fence,
          status: 'UNCERTAIN',
          ownerWorkerId: this.workerId,
          heartbeatAtMs: nowMs,
          attempts: (fence.attempts || 1) + 1,
        };
        state.deletingKeys[k] = updated;
        claimed.push(updated);
        changed = true;
      }
      return { claimed, changed };
    };

    if (prisma) {
      try {
        await ensureCoordinationRowInMySql(prisma);
        return await prisma.$transaction(
          async (tx: any) => {
            const { state, description } = await lockAndReadCoordinationRowInTx(tx, 'EXCLUSIVE');
            const { claimed, changed } = pickAndClaim(state);
            if (changed) {
              state.version += 1;
              await updateCoordinationRowInTx(tx, state, description);
            }
            return claimed;
          },
          {
            isolationLevel: 'ReadCommitted',
            maxWait: this.cleanupGateTxMaxWaitMs,
            timeout: this.cleanupGateTxTimeoutMs,
          }
        );
      } catch (err: any) {
        console.warn('[MEDIA-COORD] Unable to claim reconcilable fences (fail-closed):', err?.message || err);
        return [];
      }
    }

    return this.localRwLock.withExclusive(async () => {
      const state = this.readLocalCoordinationState();
      const { claimed, changed } = pickAndClaim(state);
      if (changed) {
        state.version += 1;
        this.writeLocalCoordinationState(state);
      }
      return claimed;
    });
  }

  /**
   * Read-only diagnostic inspection (used in tests to verify fences & permanent tombstones).
   */
  public async getCoordinationSnapshot(): Promise<{
    state: MediaWriteCoordinationState;
    mysqlActive: boolean;
  }> {
    const prisma = this.getMySqlClient();
    if (prisma) {
      await ensureCoordinationRowInMySql(prisma);
      const state = await prisma.$transaction(
        async (tx: any) => {
          const res = await lockAndReadCoordinationRowInTx(tx, 'SHARED');
          return res.state;
        },
        { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 5000 }
      );
      return { state, mysqlActive: true };
    }
    const state = await this.localRwLock.withShared(async () => this.readLocalCoordinationState());
    return { state, mysqlActive: false };
  }

  public async isKeyPermanentlyRetired(compositeKey: string): Promise<boolean> {
    const prisma = this.getMySqlClient();
    if (prisma) {
      const hits = await prisma.$transaction(
        async (tx: any) => readPermanentRetiredTombstonesInTx(tx, [compositeKey]),
        { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 5000 }
      );
      return hits.length > 0;
    }
    return this.localRwLock.withShared(async () => {
      const retired = this.readLocalRetiredTombstones();
      return Boolean(retired[compositeKey]);
    });
  }
}

export const mediaWriteCoordinator = new MediaWriteCoordinator();
