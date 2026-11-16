import { loadFrontPageCmsData } from '../admin/data/frontPageCmsData';

export const DEFAULT_INSTAGRAM_URL = 'https://www.instagram.com/toriwear.apparel/';

/**
 * Normalizes any raw social URL or @handle into a safe absolute HTTPS URL.
 * Ensures Instagram links always resolve to `https://www.instagram.com/...`
 * so mobile OS Universal Links / App Links route cleanly to the Instagram app
 * and desktop browsers open the Instagram website cleanly.
 */
export function normalizeSocialUrl(rawUrl?: string, fallbackUrl = DEFAULT_INSTAGRAM_URL): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return fallbackUrl;

  if (trimmed.startsWith('@')) {
    const handle = trimmed.slice(1).replace(/[^a-zA-Z0-9._]/g, '');
    return handle ? `https://www.instagram.com/${handle}/` : fallbackUrl;
  }

  let withProtocol = trimmed;
  if (!/^https?:\/\//i.test(withProtocol)) {
    withProtocol = `https://${withProtocol.replace(/^\/+/, '')}`;
  }

  try {
    const parsed = new URL(withProtocol);
    if (parsed.hostname === 'instagram.com' || parsed.hostname === 'm.instagram.com') {
      parsed.hostname = 'www.instagram.com';
    }
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    return parsed.toString();
  } catch {
    return fallbackUrl;
  }
}

/**
 * Resolves the authoritative Instagram URL from Footer CMS social links,
 * falling back to the official @toriwear.apparel profile URL.
 */
export function getAuthoritativeInstagramUrl(): string {
  try {
    const cms = loadFrontPageCmsData();
    const links = cms?.footer?.socialLinks || [];
    const igEntry = links.find(
      (s) => s && s.enabled !== false && (s.platform || '').toLowerCase().includes('insta') && s.url?.trim()
    );
    if (igEntry?.url) {
      return normalizeSocialUrl(igEntry.url, DEFAULT_INSTAGRAM_URL);
    }
  } catch {
    // Fallback below
  }
  return DEFAULT_INSTAGRAM_URL;
}

/**
 * Extracts a clean @handle label from an Instagram URL when available.
 */
export function getInstagramHandleFromUrl(url: string): string {
  try {
    const parsed = new URL(normalizeSocialUrl(url));
    const segments = parsed.pathname.split('/').filter(Boolean);
    const first = segments[0];
    if (first && !['p', 'reel', 'reels', 'stories', 'explore', 'tv'].includes(first.toLowerCase())) {
      return `@${first}`;
    }
  } catch {
    // Ignore parse error
  }
  return '@toriwear.apparel';
}
