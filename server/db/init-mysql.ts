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

function resolveMigrationSqlPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'prisma/migrations/0_init/migration.sql'),
    path.resolve(import.meta.dirname || process.cwd(), '../../prisma/migrations/0_init/migration.sql'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
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

    if (existingCoreTables >= 3) {
      return true;
    }

    const migrationPath = resolveMigrationSqlPath();
    if (!migrationPath) {
      console.warn('[MYSQL-INIT] Migration file prisma/migrations/0_init/migration.sql not found; skipping auto-DDL.');
      return false;
    }

    const migrationSql = fs.readFileSync(migrationPath, 'utf8').trim();
    if (!migrationSql) {
      return false;
    }

    if (existingCoreTables === 0) {
      console.log('[MYSQL-INIT] Empty MySQL database detected. Initializing TORIWEAR schema tables...');
      await connection.query(migrationSql);
      console.log('[MYSQL-INIT] MySQL schema initialized successfully.');
    } else {
      // Defensive statement-by-statement pass if partially initialized
      console.log('[MYSQL-INIT] Partial MySQL schema detected. Verifying missing tables...');
      const statements = migrationSql
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));
      for (const stmt of statements) {
        try {
          await connection.query(stmt);
        } catch (stmtErr: any) {
          // Ignore already-exists errors (ER_TABLE_EXISTS_ERROR=1050, ER_DUP_KEYNAME=1061, ER_FK_DUP_NAME=1826/1005)
          if (![1050, 1061, 1826].includes(Number(stmtErr?.errno))) {
            console.warn('[MYSQL-INIT] DDL statement note:', stmtErr?.message || stmtErr);
          }
        }
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
