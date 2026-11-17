/**
 * TORIWEAR Automatic MySQL Schema Initializer
 *
 * Ensures all Prisma-managed tables exist in the configured MySQL database
 * (e.g., GoDaddy Hosted MySQL) on first boot without requiring manual SSH access.
 */

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { resolveMySqlConnectionConfig } from './mysqlConfig';

function resolveMigrationSqlPath(relativePath: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), relativePath),
    path.resolve(import.meta.dirname || process.cwd(), '../..', relativePath),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function applyStatementsIdempotently(connection: mysql.Connection, sql: string): Promise<void> {
  const cleaned = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .trim();
  if (!cleaned) return;

  const statements = cleaned
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await connection.query(stmt);
    } catch (stmtErr: any) {
      // Ignore idempotent already-exists errors:
      // 1050 ER_TABLE_EXISTS_ERROR, 1060 ER_DUP_FIELDNAME, 1061 ER_DUP_KEYNAME, 1826/1005 ER_FK_DUP_NAME
      const errno = Number(stmtErr?.errno);
      if (![1050, 1060, 1061, 1826, 1005].includes(errno)) {
        console.warn('[MYSQL-INIT] DDL statement note:', stmtErr?.message || stmtErr);
      }
    }
  }
}

export async function ensureMySqlSchemaInitialized(): Promise<boolean> {
  const cfg = resolveMySqlConnectionConfig();
  if (!cfg.configured || !cfg.params) {
    return false;
  }

  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection({
      host: cfg.params.host,
      port: cfg.params.port,
      user: cfg.params.user,
      password: cfg.params.password,
      database: cfg.params.database,
      multipleStatements: true,
      connectTimeout: 10000,
    });

    const [rows]: any = await connection.query(
      "SELECT COUNT(*) AS tableCount FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('users', 'orders', 'products')"
    );
    const existingCoreTables = Number(rows?.[0]?.tableCount || 0);

    if (existingCoreTables < 3) {
      const initMigrationPath = resolveMigrationSqlPath('prisma/migrations/0_init/migration.sql');
      if (!initMigrationPath) {
        console.warn('[MYSQL-INIT] Migration file prisma/migrations/0_init/migration.sql not found; skipping auto-DDL.');
        return false;
      }

      const migrationSql = fs.readFileSync(initMigrationPath, 'utf8').trim();
      if (migrationSql) {
        if (existingCoreTables === 0) {
          console.log('[MYSQL-INIT] Empty MySQL database detected. Initializing TORIWEAR schema tables...');
          await connection.query(migrationSql);
          console.log('[MYSQL-INIT] MySQL base schema initialized successfully.');
        } else {
          console.log('[MYSQL-INIT] Partial MySQL schema detected. Verifying missing tables...');
          await applyStatementsIdempotently(connection, migrationSql);
        }
      }
    }

    // Check additive Early Access & Coupon columns/tables idempotently
    const [eaRows]: any = await connection.query(
      "SELECT COUNT(*) AS tableCount FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('early_access_subscribers', 'notification_campaigns', 'notification_deliveries')"
    );
    const existingEaTables = Number(eaRows?.[0]?.tableCount || 0);

    const [couponColRows]: any = await connection.query(
      "SELECT COUNT(*) AS colCount FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'coupons' AND column_name = 'eligibleCategories'"
    );
    const hasCouponCols = Number(couponColRows?.[0]?.colCount || 0) >= 1;

    const [usageColRows]: any = await connection.query(
      "SELECT COUNT(*) AS colCount FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'coupon_usage' AND column_name = 'customerEmail'"
    );
    const hasUsageCols = Number(usageColRows?.[0]?.colCount || 0) >= 1;

    if (existingEaTables < 3 || !hasCouponCols || !hasUsageCols) {
      const additivePath = resolveMigrationSqlPath('prisma/migrations/20261117_early_access_notifications/migration.sql');
      if (additivePath) {
        const additiveSql = fs.readFileSync(additivePath, 'utf8');
        console.log('[MYSQL-INIT] Applying additive Early Access & Coupon schema updates...');
        await applyStatementsIdempotently(connection, additiveSql);
        console.log('[MYSQL-INIT] Additive Early Access & Coupon schema verified.');
      }
    }

    return true;
  } catch (err: any) {
    console.warn('[MYSQL-INIT] Database schema check note:', err?.message || err);
    return false;
  } finally {
    if (connection) {
      await connection.end().catch(() => {});
    }
  }
}
