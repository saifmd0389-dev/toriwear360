/**
 * TORIWEAR MySQL Connection Resolver
 *
 * Supports GoDaddy Hosted MySQL discrete environment variables:
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 * as well as standard MySQL connection strings via DATABASE_URL (`mysql://...`).
 *
 * SERVER-SIDE ONLY: Never expose credentials to client bundles or logs.
 */

export interface MySqlParams {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface ResolvedMySqlConfig {
  configured: boolean;
  url: string | null;
  params: MySqlParams | null;
  source: 'db_env_vars' | 'database_url' | 'none';
}

function cleanEnvValue(raw: string | undefined): string {
  let val = String(raw || '').trim();
  if (
    (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
    (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
  ) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

function isPlaceholder(val: string): boolean {
  const lower = val.toLowerCase();
  return (
    !lower ||
    lower === '<from-hosting>' ||
    lower.includes('placeholder') ||
    lower.includes('your_') ||
    lower === 'localhost:5432'
  );
}

export function resolveMySqlConnectionConfig(): ResolvedMySqlConfig {
  const host = cleanEnvValue(process.env.DB_HOST);
  const portRaw = cleanEnvValue(process.env.DB_PORT);
  const database = cleanEnvValue(process.env.DB_NAME);
  const user = cleanEnvValue(process.env.DB_USER);
  const password = cleanEnvValue(process.env.DB_PASSWORD);

  if (host && database && user && !isPlaceholder(host) && !isPlaceholder(database) && !isPlaceholder(user)) {
    const parsedPort = parseInt(portRaw || '3306', 10);
    const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3306;
    const sslSuffix = cleanEnvValue(process.env.DB_SSL).toLowerCase() === 'true' ? '?sslaccept=strict' : '';
    const url = `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}${sslSuffix}`;

    // Keep process.env.DATABASE_URL synchronized for Prisma and child scripts
    process.env.DATABASE_URL = url;

    return {
      configured: true,
      url,
      params: { host, port, user, password, database },
      source: 'db_env_vars',
    };
  }

  let dbUrl = cleanEnvValue(process.env.DATABASE_URL);
  if (dbUrl.toLowerCase().startsWith('mysqls://')) {
    dbUrl = `mysql://${dbUrl.slice('mysqls://'.length)}`;
  }

  if (dbUrl && dbUrl.toLowerCase().startsWith('mysql://') && !dbUrl.toLowerCase().includes('placeholder')) {
    process.env.DATABASE_URL = dbUrl;
    try {
      const parsed = new URL(dbUrl);
      const port = parsed.port ? parseInt(parsed.port, 10) : 3306;
      const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
      if (parsed.hostname && databaseName && parsed.username) {
        return {
          configured: true,
          url: dbUrl,
          params: {
            host: parsed.hostname,
            port: Number.isFinite(port) && port > 0 ? port : 3306,
            user: decodeURIComponent(parsed.username),
            password: decodeURIComponent(parsed.password || ''),
            database: databaseName,
          },
          source: 'database_url',
        };
      }
    } catch {
      // Even if URL has unusual characters, pass url through to Prisma
    }

    return {
      configured: true,
      url: dbUrl,
      params: null,
      source: 'database_url',
    };
  }

  return {
    configured: false,
    url: null,
    params: null,
    source: 'none',
  };
}
