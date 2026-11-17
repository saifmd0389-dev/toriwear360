/**
 * TORIWEAR Enterprise Architecture - Route & Gateway Separation
 * 
 * Public Storefront Domain: https://thetoriwearstore.in
 * Private Admin Operations Gateway: /tori-ops-gateway (configurable via VITE_ADMIN_PATH)
 * 
 * Customer-facing pages must never render admin links or trigger buttons.
 * Admin endpoints & views are strictly protected by server-side authentication,
 * session validation, and 2FA TOTP verification.
 */

// Canonical Public Storefront URL
export const PUBLIC_STOREFRONT_URL = 'https://thetoriwearstore.in';

// Default private admin route
export const DEFAULT_ADMIN_PATH = '/tori-ops-gateway';

declare global {
  interface Window {
    __TORI_RUNTIME_CONFIG__?: {
      adminPath?: string;
    };
  }
}

const KNOWN_ADMIN_SUBROUTE_SUFFIXES = [
  '/login',
  '/gateway',
  '/dashboard',
  '/forgot-password',
  '/reset-password',
  '/activate-account',
  '/account/security',
];

/**
 * Normalizes an admin path from env/runtime variables:
 * - trims whitespace and surrounding single/double quotes (common in CI/hosting secret UIs)
 * - extracts pathname if a full URL was entered
 * - normalizes slashes and strips accidental subroute suffixes like /login
 * - rejects standard /admin or empty root /
 */
export function sanitizeAdminGatewayPath(rawValue: unknown): string {
  if (rawValue === null || rawValue === undefined) return '';
  let value = String(rawValue).trim();
  if (!value) return '';

  // Strip matching or stray surrounding quotes from hosting env UIs
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  value = value.replace(/^['"]+|['"]+$/g, '').trim();
  if (!value) return '';

  // If a full URL was pasted into VITE_ADMIN_PATH, extract its pathname
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      return '';
    }
  }

  // Drop query or hash fragments if accidentally included
  value = value.split('?')[0]?.split('#')[0] || '';
  value = value.trim();
  if (!value) return '';

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  let normalized = withLeadingSlash.replace(/\/+/g, '/').replace(/\/+$/, '');

  // Strip accidental subroute suffix (e.g. /tori-ops-gateway/login -> /tori-ops-gateway)
  const lower = normalized.toLowerCase();
  for (const suffix of KNOWN_ADMIN_SUBROUTE_SUFFIXES) {
    if (lower.endsWith(suffix) && lower.length > suffix.length) {
      normalized = normalized.slice(0, normalized.length - suffix.length).replace(/\/+$/, '');
      break;
    }
  }

  if (!normalized || normalized === '/' || normalized.toLowerCase() === '/admin') {
    return '';
  }

  return normalized;
}

function readRuntimeAdminPath(): string {
  if (typeof window !== 'undefined' && window.__TORI_RUNTIME_CONFIG__?.adminPath) {
    const sanitizedRuntime = sanitizeAdminGatewayPath(window.__TORI_RUNTIME_CONFIG__.adminPath);
    if (sanitizedRuntime) return sanitizedRuntime;
  }
  return '';
}

// Resolved private admin route from runtime config or VITE_ADMIN_PATH build env
const rawRuntimeAdminPath = readRuntimeAdminPath();
const rawEnvAdminPath =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_PATH
    ? sanitizeAdminGatewayPath(import.meta.env.VITE_ADMIN_PATH)
    : '';

const resolvedCustomAdminPath = rawRuntimeAdminPath || rawEnvAdminPath;

export const IS_CUSTOM_VITE_ADMIN_PATH = Boolean(resolvedCustomAdminPath);

export const ADMIN_GATEWAY_PATH = resolvedCustomAdminPath || DEFAULT_ADMIN_PATH;

export const ADMIN_CONFIG = {
  PUBLIC_STOREFRONT_URL,
  ADMIN_PATH: ADMIN_GATEWAY_PATH,
  DEFAULT_ADMIN_PATH,
  IS_CUSTOM_VITE_ADMIN_PATH,
};

function getCandidateGatewayPaths(): string[] {
  const candidates = [ADMIN_GATEWAY_PATH.toLowerCase(), DEFAULT_ADMIN_PATH.toLowerCase()];
  return Array.from(new Set(candidates.filter(Boolean)));
}

function normalizePathname(pathname: string = ''): string {
  const withoutQuery = pathname.split('?')[0]?.split('#')[0] || '';
  const collapsed = withoutQuery.trim().toLowerCase().replace(/\/+/g, '/').replace(/\/+$/, '');
  return collapsed;
}

function isProductStorefrontPath(cleanPath: string): boolean {
  return cleanPath === '/product' || cleanPath.startsWith('/product/') || cleanPath === '/products' || cleanPath.startsWith('/products/');
}

/**
 * Checks if a given URL pathname or hash matches the configured private admin gateway route
 * or canonical /tori-ops-gateway base route.
 * Standard paths such as /admin or #admin are intentionally rejected.
 */
export function isAdminPath(pathname: string = '', hash: string = ''): boolean {
  const cleanPath = normalizePathname(pathname);
  const cleanHash = hash.trim().toLowerCase().replace(/\/+/g, '/').replace(/\/+$/, '');

  // Explicitly reject standard /admin and #admin routes
  if (cleanPath === '/admin' || cleanPath.startsWith('/admin/')) {
    return false;
  }
  if (cleanHash === '#admin' || cleanHash.startsWith('#admin/')) {
    return false;
  }

  const candidates = getCandidateGatewayPaths();

  for (const gatewayLower of candidates) {
    if (cleanPath === gatewayLower || cleanPath.startsWith(`${gatewayLower}/`)) {
      return true;
    }

    // Handle proxy mount prefixes (e.g. /share/<id>/tori-ops-gateway or /share/<id>/tori-ops-gateway/login)
    if (cleanPath && !isProductStorefrontPath(cleanPath)) {
      if (cleanPath.endsWith(gatewayLower) || cleanPath.includes(`${gatewayLower}/`)) {
        return true;
      }
    }

    const gatewayHashPrefix = `#${gatewayLower.replace(/^\/+/, '')}`;
    const gatewayHashSlashPrefix = `#/${gatewayLower.replace(/^\/+/, '')}`;
    if (
      cleanHash === gatewayHashPrefix ||
      cleanHash.startsWith(`${gatewayHashPrefix}/`) ||
      cleanHash === gatewayHashSlashPrefix ||
      cleanHash.startsWith(`${gatewayHashSlashPrefix}/`)
    ) {
      return true;
    }
  }

  return false;
}

function detectActiveMountPrefix(): string {
  if (typeof window === 'undefined') return '';
  const rawPath = (window.location.pathname || '').split('?')[0] || '';
  const normalized = rawPath.replace(/\/+/g, '/').replace(/\/+$/, '');
  const lower = normalized.toLowerCase();

  if (isProductStorefrontPath(lower)) return '';

  for (const gatewayLower of getCandidateGatewayPaths()) {
    if (lower === gatewayLower || lower.startsWith(`${gatewayLower}/`)) {
      return '';
    }
    const idx = lower.indexOf(gatewayLower);
    if (idx > 0) {
      const afterIdx = idx + gatewayLower.length;
      if (afterIdx === lower.length || lower[afterIdx] === '/') {
        return normalized.slice(0, idx).replace(/\/+$/, '');
      }
    }
  }
  return '';
}

/**
 * Formats a path inside the private admin portal.
 */
export function getAdminSubpath(subpath?: string): string {
  const prefix = detectActiveMountPrefix();
  const basePath = `${prefix}${ADMIN_CONFIG.ADMIN_PATH}`;
  if (!subpath || subpath === '/' || subpath === '') {
    return basePath;
  }
  const clean = subpath.replace(/^\/+/, '');
  return `${basePath}/${clean}`;
}

/**
 * Builds the canonical production URL for the private admin gateway.
 */
export function getProductionAdminUrl(subpath?: string): string {
  const base = PUBLIC_STOREFRONT_URL.replace(/\/+$/, '');
  const cleanSub = !subpath || subpath === '/' || subpath === '' ? '' : `/${subpath.replace(/^\/+/, '')}`;
  return `${base}${ADMIN_CONFIG.ADMIN_PATH}${cleanSub}`;
}
