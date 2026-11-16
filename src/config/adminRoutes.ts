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

// Resolved private admin route from VITE_ADMIN_PATH environment variable or non-standard default
const rawEnvAdminPath =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_PATH
    ? String(import.meta.env.VITE_ADMIN_PATH).trim()
    : '';

export const IS_CUSTOM_VITE_ADMIN_PATH = Boolean(rawEnvAdminPath);

export const ADMIN_GATEWAY_PATH = (() => {
  if (rawEnvAdminPath) {
    const withLeadingSlash = rawEnvAdminPath.startsWith('/') ? rawEnvAdminPath : `/${rawEnvAdminPath}`;
    const trimmed = withLeadingSlash.replace(/\/+$/, '');
    if (trimmed && trimmed.toLowerCase() !== '/admin') {
      return trimmed;
    }
  }
  return DEFAULT_ADMIN_PATH;
})();

export const ADMIN_CONFIG = {
  PUBLIC_STOREFRONT_URL,
  ADMIN_PATH: ADMIN_GATEWAY_PATH,
  DEFAULT_ADMIN_PATH,
  IS_CUSTOM_VITE_ADMIN_PATH,
};

/**
 * Checks if a given URL pathname or hash strictly matches the non-standard VITE_ADMIN_PATH gateway route.
 * Standard paths such as /admin or #admin are intentionally rejected.
 */
export function isAdminPath(pathname: string = '', hash: string = ''): boolean {
  const cleanPath = pathname.toLowerCase().replace(/\/+$/, '');
  const cleanHash = hash.toLowerCase().replace(/\/+$/, '');
  const gatewayLower = ADMIN_GATEWAY_PATH.toLowerCase();
  const gatewayHashPrefix = `#${gatewayLower.replace(/^\/+/, '')}`;

  if (cleanPath === gatewayLower || cleanPath.startsWith(`${gatewayLower}/`)) {
    return true;
  }

  if (cleanHash === gatewayHashPrefix || cleanHash.startsWith(`${gatewayHashPrefix}/`)) {
    return true;
  }

  return false;
}

/**
 * Formats a path inside the private admin portal.
 */
export function getAdminSubpath(subpath?: string): string {
  if (!subpath || subpath === '/' || subpath === '') {
    return ADMIN_CONFIG.ADMIN_PATH;
  }
  const clean = subpath.replace(/^\/+/, '');
  return `${ADMIN_CONFIG.ADMIN_PATH}/${clean}`;
}

/**
 * Builds the canonical production URL for the private admin gateway.
 */
export function getProductionAdminUrl(subpath?: string): string {
  const base = PUBLIC_STOREFRONT_URL.replace(/\/+$/, '');
  return `${base}${getAdminSubpath(subpath)}`;
}
