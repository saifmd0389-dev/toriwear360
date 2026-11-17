/**
 * TORIWEAR Database Abstraction Layer (MySQL / Prisma ORM)
 *
 * SERVER-SIDE ONLY:
 * - Never expose DATABASE_URL or DB credentials to the client/browser.
 * - Supports GoDaddy Hosted MySQL env vars (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
 *   or standard mysql:// DATABASE_URL.
 * - Manages connection pooling, lifecycle hooks, and safe non-production fallbacks.
 */

import { createRequire } from 'module';
import { AsyncLocalStorage } from 'async_hooks';
import dotenv from 'dotenv';
import { resolveMySqlConnectionConfig } from './mysqlConfig';

dotenv.config();

const require = createRequire(import.meta.url);

export interface DatabaseStatus {
  connected: boolean;
  provider: 'mysql' | 'postgresql' | 'memory-fallback';
  databaseUrlConfigured: boolean;
  poolActive: boolean;
  lastCheckedAt: string;
  error?: string;
}

let prismaInstance: any = null;
let isPrismaAvailable = false;

const resolvedConfig = resolveMySqlConnectionConfig();

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client');
  if (PrismaClient) {
    if (resolvedConfig.configured && resolvedConfig.url) {
      prismaInstance = new PrismaClient({
        datasources: {
          db: {
            url: resolvedConfig.url,
          },
        },
        log: process.env.PRISMA_LOG_QUERIES === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'],
      });
      isPrismaAvailable = true;
      console.log(`[DATABASE] MySQL PrismaClient successfully initialized (${resolvedConfig.source}).`);
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'FATAL_PRODUCTION_DATABASE_ERROR: Production environment requires MySQL credentials (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD) or a mysql:// DATABASE_URL.'
        );
      }
      console.log('[DATABASE] MySQL credentials not configured for local dev. Running in safe repository fallback mode.');
    }
  }
} catch (err: any) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `FATAL_PRODUCTION_DATABASE_ERROR: ${err?.message || 'Prisma client not generated or MySQL connection failed.'}`
    );
  }
  console.log('[DATABASE] PrismaClient runtime adapter note:', err?.message || 'Prisma client not yet generated.');
}

export const txStorage = new AsyncLocalStorage<any>();
let prismaTestOverride: any = null;

/**
 * Automated unit-test hook to inject a mocked Prisma client.
 * Never used in production or storefront/admin runtime flows.
 */
export function setPrismaClientOverrideForTests(client: any): void {
  prismaTestOverride = client;
}

/**
 * Returns the active Prisma instance or the current interactive transaction client if inside withTransaction
 */
export function getPrismaClient(): any {
  const activeTx = txStorage.getStore();
  if (activeTx) {
    return activeTx;
  }
  if (prismaTestOverride) {
    return prismaTestOverride;
  }
  return prismaInstance;
}

export function getRawPrismaClient(): any {
  return prismaTestOverride || prismaInstance;
}

export const prisma: any = new Proxy(
  {},
  {
    get(_target, prop) {
      const activeTx = txStorage.getStore();
      const target = activeTx || prismaTestOverride || prismaInstance;
      return target ? target[prop] : undefined;
    },
  }
);

/**
 * Health check for database connectivity
 */
export async function checkDatabaseHealth(): Promise<DatabaseStatus> {
  const cfg = resolveMySqlConnectionConfig();
  const databaseUrlConfigured = cfg.configured;

  if (isPrismaAvailable && prismaInstance) {
    try {
      await prismaInstance.$queryRaw`SELECT 1`;
      return {
        connected: true,
        provider: 'mysql',
        databaseUrlConfigured: true,
        poolActive: true,
        lastCheckedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        connected: false,
        provider: 'mysql',
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
    error: databaseUrlConfigured
      ? 'Prisma client generation required'
      : 'MySQL database environment variables (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD) not configured',
  };
}

/**
 * Graceful shutdown hook
 */
export async function disconnectDatabase(): Promise<void> {
  if (prismaInstance && typeof prismaInstance.$disconnect === 'function') {
    try {
      await prismaInstance.$disconnect();
      console.log('[DATABASE] MySQL pool disconnected gracefully.');
    } catch (e) {
      console.error('[DATABASE] Error disconnecting from MySQL:', e);
    }
  }
}
