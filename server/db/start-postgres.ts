import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

function isTcpPortOpen(host: string, port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (open: boolean) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(open);
      }
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

function isLocalDevDatabaseTarget(port: number): boolean {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) return true;
  try {
    const parsed = new URL(dbUrl);
    const isLocalHost = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
    const parsedPort = parsed.port ? parseInt(parsed.port, 10) : 5432;
    return isLocalHost && parsedPort === port;
  } catch {
    return dbUrl.includes(`127.0.0.1:${port}`) || dbUrl.includes(`localhost:${port}`);
  }
}

export async function ensureDevPostgresRunning(): Promise<{ stop: () => Promise<void> }> {
  const isProduction = process.env.NODE_ENV === 'production';

  // Strict architectural guard: Never run embedded PostgreSQL in production
  if (isProduction) {
    return { stop: async () => {} };
  }

  const pgDir = process.env.EMBEDDED_PG_DIR || '/tmp/toriwear_pgdata';
  const port = parseInt(process.env.PGPORT || '5433', 10);
  const user = process.env.PGUSER || 'postgres';
  const password = process.env.PGPASSWORD || 'postgrespassword';

  if (!isLocalDevDatabaseTarget(port)) {
    return { stop: async () => {} };
  }

  let pgInstance: EmbeddedPostgres | null = null;
  const alreadyOpen = await isTcpPortOpen('127.0.0.1', port);

  if (!alreadyOpen) {
    pgInstance = new EmbeddedPostgres({
      databaseDir: pgDir,
      port,
      user,
      password,
      authMethod: 'password',
      persistent: true,
      createPostgresUser: true,
      autoRehydrateSymlinks: true,
    });

    const pgVersionFile = path.join(pgDir, 'PG_VERSION');
    if (!fs.existsSync(pgVersionFile)) {
      if (fs.existsSync(pgDir)) {
        fs.rmSync(pgDir, { recursive: true, force: true });
      }
      console.log('[PG-DEV] Initialising new development PostgreSQL cluster...');
      await pgInstance.initialise();
    } else {
      const stalePidFile = path.join(pgDir, 'postmaster.pid');
      if (fs.existsSync(stalePidFile)) {
        fs.rmSync(stalePidFile, { force: true });
      }
    }

    console.log(`[PG-DEV] Starting development PostgreSQL cluster on 127.0.0.1:${port}...`);
    await pgInstance.start();
  }

  // Create database toriwear if it doesn't exist
  const adminClient = new pg.Client({
    host: '127.0.0.1',
    port,
    user,
    password,
    database: 'postgres',
  });
  await adminClient.connect();
  const dbRes = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = 'toriwear'");
  if (dbRes.rowCount === 0) {
    console.log('[PG-DEV] Creating database toriwear...');
    await adminClient.query('CREATE DATABASE toriwear');
  }
  await adminClient.end();

  // Verify schema tables & seed if empty in development only
  try {
    const { execSync } = await import('child_process');
    const toriClient = new pg.Client({
      host: '127.0.0.1',
      port,
      user,
      password,
      database: 'toriwear',
    });
    await toriClient.connect();
    const tableRes = await toriClient.query(
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tableCount = parseInt(tableRes.rows[0]?.count || '0', 10);

    if (tableCount === 0) {
      await toriClient.end();
      console.log('[PG-DEV] Empty development database detected. Applying Prisma schema...');
      execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
      console.log('[PG-DEV] Prisma schema synchronized for local development.');
    } else {
      await toriClient.end();
    }

    const checkSeedClient = new pg.Client({
      host: '127.0.0.1',
      port,
      user,
      password,
      database: 'toriwear',
    });
    await checkSeedClient.connect();
    const userCountRes = await checkSeedClient.query('SELECT count(*) FROM "users"');
    const userCount = parseInt(userCountRes.rows[0]?.count || '0', 10);
    await checkSeedClient.end();

    if (userCount === 0) {
      console.log('[PG-DEV] Fresh database detected. Running controlled initial seed...');
      const { runDatabaseSeed } = await import('./seed');
      await runDatabaseSeed();
    }
  } catch (syncErr) {
    console.warn('[PG-DEV] Schema/seed check note:', syncErr);
  }

  console.log(`[PG-DEV] Local PostgreSQL ready on 127.0.0.1:${port} (database: toriwear).`);

  return {
    stop: async () => {
      if (pgInstance) {
        try {
          await pgInstance.stop();
          console.log('[PG-DEV] Embedded PostgreSQL stopped gracefully.');
        } catch (err) {
          console.warn('[PG-DEV] Error stopping Embedded PostgreSQL:', err);
        }
      }
    },
  };
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[PG-FATAL] Embedded PostgreSQL is strictly prohibited in production.');
    console.error('[PG-FATAL] TORIWEAR production requires a managed PostgreSQL instance (e.g. AWS RDS, GCP Cloud SQL, Supabase, Neon) connected via DATABASE_URL.');
    console.error('[PG-FATAL] Database migrations must be applied using "npx prisma migrate deploy" and NOT "prisma db push".');
    process.exit(1);
  }

  await ensureDevPostgresRunning();
  setInterval(() => {}, 60000);
}

const isCliEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCliEntry) {
  main().catch((err) => {
    console.error('[PG] Fatal error:', err);
    process.exit(1);
  });
}
