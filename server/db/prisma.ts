/**
 * TORIWEAR Database Abstraction Layer (PostgreSQL / Prisma ORM)
 * 
 * SERVER-SIDE ONLY:
 * - Never expose DATABASE_URL or db credentials to the client/browser.
 * - Manages connection pooling, lifecycle hooks, and safe fallbacks when DATABASE_URL is not configured.
 */

import { createRequire } from 'module';
import dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);

export interface DatabaseStatus {
  connected: boolean;
  provider: 'postgresql' | 'memory-fallback';
  databaseUrlConfigured: boolean;
  poolActive: boolean;
  lastCheckedAt: string;
  error?: string;
}

let prismaInstance: any = null;
let isPrismaAvailable = false;

// Attempt dynamic load of PrismaClient if generated
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client');
  if (PrismaClient) {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl && databaseUrl.trim().length > 0 && !databaseUrl.includes('placeholder')) {
      prismaInstance = new PrismaClient({
        log: process.env.PRISMA_LOG_QUERIES === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'],
      });
      isPrismaAvailable = true;
      console.log('[DATABASE] PostgreSQL PrismaClient successfully initialized with connection pooling.');
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL_PRODUCTION_DATABASE_ERROR: Production environment requires an active PostgreSQL DATABASE_URL. Silent fallback to JSON/memory storage is strictly disabled in production.');
      }
      console.log('[DATABASE] DATABASE_URL is not set or using placeholder. Running in safe repository fallback mode.');
    }
  }
} catch (err: any) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`FATAL_PRODUCTION_DATABASE_ERROR: ${err?.message || 'Prisma client not generated or PostgreSQL connection failed.'}`);
  }
  console.log('[DATABASE] PrismaClient runtime adapter note:', err?.message || 'Prisma client not yet generated.');
}

import { AsyncLocalStorage } from 'async_hooks';

export const txStorage = new AsyncLocalStorage<any>();

/**
 * Returns the active Prisma instance or the current interactive transaction client if inside withTransaction
 */
export function getPrismaClient(): any {
  const activeTx = txStorage.getStore();
  if (activeTx) {
    return activeTx;
  }
  return prismaInstance;
}

export function getRawPrismaClient(): any {
  return prismaInstance;
}

export const prisma: any = new Proxy({}, {
  get(_target, prop) {
    const activeTx = txStorage.getStore();
    const target = activeTx || prismaInstance;
    return target ? target[prop] : undefined;
  }
});

/**
 * Health check for database connectivity
 */
export async function checkDatabaseHealth(): Promise<DatabaseStatus> {
  const databaseUrlConfigured = Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('placeholder'));
  
  if (isPrismaAvailable && prismaInstance) {
    try {
      // Simple raw ping
      await prismaInstance.$queryRaw`SELECT 1`;
      return {
        connected: true,
        provider: 'postgresql',
        databaseUrlConfigured: true,
        poolActive: true,
        lastCheckedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        connected: false,
        provider: 'postgresql',
        databaseUrlConfigured: true,
        poolActive: false,
        lastCheckedAt: new Date().toISOString(),
        error: err?.message || 'Database connection failure',
      };
    }
  }

  return {
    connected: false,
    provider: 'memory-fallback',
    databaseUrlConfigured,
    poolActive: false,
    lastCheckedAt: new Date().toISOString(),
    error: databaseUrlConfigured ? 'Prisma client generation required' : 'DATABASE_URL not configured',
  };
}

/**
 * Graceful shutdown hook
 */
export async function disconnectDatabase(): Promise<void> {
  if (prismaInstance && typeof prismaInstance.$disconnect === 'function') {
    try {
      await prismaInstance.$disconnect();
      console.log('[DATABASE] PostgreSQL pool disconnected gracefully.');
    } catch (e) {
      console.error('[DATABASE] Error disconnecting from PostgreSQL:', e);
    }
  }
}
