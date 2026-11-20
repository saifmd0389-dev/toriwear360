/**
 * TORIWEAR Chunked Upload Session Manager
 *
 * Enforces strict security and reliability invariants for binary chunked image uploads:
 * - Binds every upload session to the authenticated admin identity (ownerId).
 * - Isolates concurrent sessions and prevents upload ID collisions via unique per-session temp files.
 * - Enforces strictly sequential chunk indexes (0, 1, ..., totalChunks - 1).
 * - Validates consistent totalChunks, filename, and mimeType across every chunk in a session.
 * - Rejects duplicate, out-of-order, concurrent-racing, and inconsistent chunks.
 * - Enforces configurable max total upload size (default 25 MB).
 * - Cleans up temporary staging files on completion, failure, invalid chunk, or TTL expiration.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

export const DEFAULT_CHUNK_SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_TOTAL_CHUNKS = 64;

export interface ChunkUploadSession {
  sessionKey: string;
  uploadId: string;
  ownerId: string;
  totalChunks: number;
  filename: string;
  mimeType: string;
  nextExpectedIndex: number;
  totalBytesReceived: number;
  tmpFilePath: string;
  createdAt: number;
  updatedAt: number;
  inFlight: boolean;
}

export class ChunkUploadError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = 'ChunkUploadError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface AppendChunkInput {
  ownerId: string;
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  filename: string;
  mimeType: string;
  chunkBuffer: Buffer;
  maxUploadBytes: number;
}

export interface AppendChunkOutcome {
  completed: boolean;
  sessionKey: string;
  tmpFilePath: string;
  chunkIndex: number;
  totalChunks: number;
  totalBytesReceived: number;
  /** Present only when completed === true; caller must finalize and release/cleanup. */
  assembledBuffer?: Buffer;
}

export class ChunkUploadSessionManager {
  private readonly sessions = new Map<string, ChunkUploadSession>();
  private stagingDir: string;
  private ttlMs: number;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: { stagingDir?: string; ttlMs?: number; enablePeriodicSweep?: boolean }) {
    this.stagingDir = path.resolve(options?.stagingDir || path.join(os.tmpdir(), 'toriwear-upload-chunks'));
    this.ttlMs = options?.ttlMs ?? DEFAULT_CHUNK_SESSION_TTL_MS;

    if (options?.enablePeriodicSweep !== false) {
      const intervalMs = Math.max(60_000, Math.min(this.ttlMs, 5 * 60 * 1000));
      this.sweepTimer = setInterval(() => {
        this.sweepExpiredSessions();
      }, intervalMs);
      if (typeof this.sweepTimer.unref === 'function') {
        this.sweepTimer.unref();
      }
    }
  }

  public getStagingDir(): string {
    if (!fs.existsSync(this.stagingDir)) {
      fs.mkdirSync(this.stagingDir, { recursive: true, mode: 0o700 });
    }
    return this.stagingDir;
  }

  public getTtlMs(): number {
    return this.ttlMs;
  }

  /** Used in tests to verify expiration behavior deterministically without waiting 15 minutes. */
  public setTtlMsForTests(ttlMs: number): void {
    this.ttlMs = ttlMs;
  }

  public getActiveSessionCount(): number {
    return this.sessions.size;
  }

  private buildSessionKey(ownerId: string, uploadId: string): string {
    return `${ownerId}::${uploadId}`;
  }

  private safeUnlink(filePath: string): void {
    if (!filePath) return;
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Best-effort cleanup of temp chunk staging file
    }
  }

  private destroySession(sessionKey: string): void {
    const existing = this.sessions.get(sessionKey);
    if (!existing) return;
    this.sessions.delete(sessionKey);
    this.safeUnlink(existing.tmpFilePath);
  }

  private hasActiveSessionForUploadIdByOtherOwner(uploadId: string, ownerId: string): boolean {
    for (const session of this.sessions.values()) {
      if (session.uploadId === uploadId && session.ownerId !== ownerId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Removes expired sessions from memory and unlinks their temp files, plus any
   * orphaned staging files older than TTL left behind by previous server crashes.
   */
  public sweepExpiredSessions(now: number = Date.now()): number {
    let cleaned = 0;
    const activePaths = new Set<string>();

    for (const [key, session] of this.sessions.entries()) {
      if (now - session.updatedAt > this.ttlMs) {
        this.sessions.delete(key);
        this.safeUnlink(session.tmpFilePath);
        cleaned++;
      } else {
        activePaths.add(path.resolve(session.tmpFilePath));
      }
    }

    if (fs.existsSync(this.stagingDir)) {
      try {
        const entries = fs.readdirSync(this.stagingDir);
        for (const name of entries) {
          if (!name.startsWith('chunk-') || !name.endsWith('.bin')) continue;
          const fullPath = path.resolve(this.stagingDir, name);
          if (activePaths.has(fullPath)) continue;
          try {
            const stat = fs.statSync(fullPath);
            if (now - stat.mtimeMs > this.ttlMs) {
              this.safeUnlink(fullPath);
              cleaned++;
            }
          } catch {
            // File may have been removed concurrently
          }
        }
      } catch {
        // Ignore directory read errors during best-effort sweep
      }
    }

    return cleaned;
  }

  /**
   * Validates and appends a single binary chunk to an authenticated admin upload session.
   * When the final chunk arrives, reads the assembled buffer and removes the temp staging file
   * immediately so no temporary file can leak even if downstream Sharp/GCS processing throws.
   */
  public appendChunk(input: AppendChunkInput): AppendChunkOutcome {
    const now = Date.now();
    this.sweepExpiredSessions(now);

    const ownerId = String(input.ownerId || '').trim();
    if (!ownerId) {
      throw new ChunkUploadError('Authenticated admin identity is required for chunk uploads.', 401, 'MISSING_ADMIN_IDENTITY');
    }

    const uploadId = String(input.uploadId || '').trim();
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(uploadId)) {
      throw new ChunkUploadError('Invalid upload session ID.', 400, 'INVALID_UPLOAD_ID');
    }

    const { chunkIndex, totalChunks, chunkBuffer, maxUploadBytes } = input;
    if (
      !Number.isInteger(chunkIndex) ||
      !Number.isInteger(totalChunks) ||
      chunkIndex < 0 ||
      totalChunks < 1 ||
      totalChunks > MAX_TOTAL_CHUNKS ||
      chunkIndex >= totalChunks
    ) {
      throw new ChunkUploadError('Invalid chunk index parameters.', 400, 'INVALID_CHUNK_INDEX');
    }

    if (!Buffer.isBuffer(chunkBuffer) || chunkBuffer.length === 0) {
      throw new ChunkUploadError('Received empty upload chunk.', 400, 'EMPTY_CHUNK');
    }

    const normalizedFilename = String(input.filename || '').trim();
    const normalizedMimeType = String(input.mimeType || '').trim().toLowerCase();
    const sessionKey = this.buildSessionKey(ownerId, uploadId);
    const existing = this.sessions.get(sessionKey);

    if (chunkIndex === 0) {
      // Reject duplicate chunk 0 / upload ID collision for an active session owned by this admin
      if (existing) {
        this.destroySession(sessionKey);
        throw new ChunkUploadError(
          'Duplicate initial chunk or upload session ID already in use. Start a new upload with a unique uploadId.',
          409,
          'DUPLICATE_CHUNK'
        );
      }

      if (chunkBuffer.length > maxUploadBytes) {
        const maxMb = (maxUploadBytes / (1024 * 1024)).toFixed(0);
        throw new ChunkUploadError(
          `Image size exceeds the maximum allowed limit of ${maxMb} MB.`,
          413,
          'UPLOAD_TOO_LARGE'
        );
      }

      const stagingDir = this.getStagingDir();
      // Server-generated unique random token guarantees concurrent sessions (even from different
      // admins reusing the same client uploadId) can never collide or overwrite each other on disk.
      const uniqueToken = crypto.randomBytes(16).toString('hex');
      const tmpFilePath = path.join(stagingDir, `chunk-${uniqueToken}.bin`);

      const session: ChunkUploadSession = {
        sessionKey,
        uploadId,
        ownerId,
        totalChunks,
        filename: normalizedFilename,
        mimeType: normalizedMimeType,
        nextExpectedIndex: 0,
        totalBytesReceived: 0,
        tmpFilePath,
        createdAt: now,
        updatedAt: now,
        inFlight: true,
      };
      this.sessions.set(sessionKey, session);

      try {
        // Exclusive creation ('wx') guarantees we never overwrite an existing staging file
        fs.writeFileSync(tmpFilePath, chunkBuffer, { flag: 'wx', mode: 0o600 });
        session.totalBytesReceived = chunkBuffer.length;
        session.nextExpectedIndex = 1;
        session.updatedAt = Date.now();
        session.inFlight = false;
      } catch (err) {
        this.destroySession(sessionKey);
        throw err;
      }

      if (totalChunks === 1) {
        return this.finalizeAndCleanupSession(session, chunkIndex);
      }

      return {
        completed: false,
        sessionKey,
        tmpFilePath,
        chunkIndex,
        totalChunks,
        totalBytesReceived: session.totalBytesReceived,
      };
    }

    // Subsequent chunks (chunkIndex >= 1) must match an active session bound to this admin
    if (!existing) {
      if (this.hasActiveSessionForUploadIdByOtherOwner(uploadId, ownerId)) {
        throw new ChunkUploadError(
          'Upload session belongs to a different authenticated admin identity.',
          403,
          'UPLOAD_SESSION_FORBIDDEN'
        );
      }
      throw new ChunkUploadError(
        'Upload session not found, expired, or missing initial chunk (chunkIndex 0 must be uploaded first).',
        400,
        'MISSING_OR_EXPIRED_SESSION'
      );
    }

    if (existing.inFlight) {
      this.destroySession(sessionKey);
      throw new ChunkUploadError(
        'Concurrent write detected for the same upload session.',
        409,
        'CONCURRENT_CHUNK_CONFLICT'
      );
    }

    // Verify metadata consistency across all chunks in this session
    if (existing.totalChunks !== totalChunks) {
      this.destroySession(sessionKey);
      throw new ChunkUploadError(
        `Inconsistent totalChunks for upload session (expected ${existing.totalChunks}, received ${totalChunks}).`,
        400,
        'INCONSISTENT_TOTAL_CHUNKS'
      );
    }

    if (existing.filename !== normalizedFilename) {
      this.destroySession(sessionKey);
      throw new ChunkUploadError(
        'Inconsistent filename across chunks in upload session.',
        400,
        'INCONSISTENT_FILENAME'
      );
    }

    if (existing.mimeType !== normalizedMimeType) {
      this.destroySession(sessionKey);
      throw new ChunkUploadError(
        'Inconsistent MIME type across chunks in upload session.',
        400,
        'INCONSISTENT_MIME_TYPE'
      );
    }

    // Enforce strictly sequential chunk order (reject duplicates & out-of-order chunks)
    if (chunkIndex < existing.nextExpectedIndex) {
      this.destroySession(sessionKey);
      throw new ChunkUploadError(
        `Duplicate chunk received (chunkIndex ${chunkIndex} was already processed; expected ${existing.nextExpectedIndex}).`,
        409,
        'DUPLICATE_CHUNK'
      );
    }

    if (chunkIndex > existing.nextExpectedIndex) {
      this.destroySession(sessionKey);
      throw new ChunkUploadError(
        `Out-of-order chunk received (expected chunkIndex ${existing.nextExpectedIndex}, received ${chunkIndex}).`,
        400,
        'OUT_OF_ORDER_CHUNK'
      );
    }

    if (!fs.existsSync(existing.tmpFilePath)) {
      this.destroySession(sessionKey);
      throw new ChunkUploadError(
        'Upload staging file is missing or expired.',
        400,
        'MISSING_STAGING_FILE'
      );
    }

    if (existing.totalBytesReceived + chunkBuffer.length > maxUploadBytes) {
      this.destroySession(sessionKey);
      const maxMb = (maxUploadBytes / (1024 * 1024)).toFixed(0);
      throw new ChunkUploadError(
        `Image size exceeds the maximum allowed limit of ${maxMb} MB.`,
        413,
        'UPLOAD_TOO_LARGE'
      );
    }

    existing.inFlight = true;
    try {
      fs.appendFileSync(existing.tmpFilePath, chunkBuffer);
      existing.totalBytesReceived += chunkBuffer.length;
      existing.nextExpectedIndex = chunkIndex + 1;
      existing.updatedAt = Date.now();
      existing.inFlight = false;
    } catch (err) {
      this.destroySession(sessionKey);
      throw err;
    }

    if (existing.nextExpectedIndex === existing.totalChunks) {
      return this.finalizeAndCleanupSession(existing, chunkIndex);
    }

    return {
      completed: false,
      sessionKey,
      tmpFilePath: existing.tmpFilePath,
      chunkIndex,
      totalChunks: existing.totalChunks,
      totalBytesReceived: existing.totalBytesReceived,
    };
  }

  private finalizeAndCleanupSession(session: ChunkUploadSession, chunkIndex: number): AppendChunkOutcome {
    const tmpFilePath = session.tmpFilePath;
    const totalChunks = session.totalChunks;
    const totalBytesReceived = session.totalBytesReceived;
    const sessionKey = session.sessionKey;

    try {
      const assembledBuffer = fs.readFileSync(tmpFilePath);
      this.destroySession(sessionKey);
      return {
        completed: true,
        sessionKey,
        tmpFilePath,
        chunkIndex,
        totalChunks,
        totalBytesReceived,
        assembledBuffer,
      };
    } catch (err) {
      this.destroySession(sessionKey);
      throw err;
    }
  }

  /** Cleans up all active sessions and temp files (used in graceful shutdown / tests). */
  public clearAllSessions(): void {
    for (const key of Array.from(this.sessions.keys())) {
      this.destroySession(key);
    }
  }
}

export const chunkUploadSessionManager = new ChunkUploadSessionManager();
