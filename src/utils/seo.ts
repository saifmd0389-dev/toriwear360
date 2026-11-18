export interface SeoUpdateOptions {
  title: string;
  description: string;
  keywords?: string;
  canonicalPath?: string;
  ogType?: 'website' | 'product' | 'article';
  ogImage?: string;
  robots?: string;
  jsonLdId?: string;
  jsonLd?: Record<string, any> | Array<Record<string, any>>;
}

const DEFAULT_ORIGIN = 'https://thetoriwearstore.in';
const DEFAULT_IMAGE = 'https://thetoriwearstore.in/assets/branding/toriwear-official-logo.png';

function upsertMeta(attrName: 'name' | 'property', attrVal: string, content: string) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attrName}="${attrVal}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrVal);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function upsertJsonLd(id: string, payload?: Record<string, any> | Array<Record<string, any>>) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(id);
  if (!payload) {
    if (existing) existing.remove();
    return;
  }
  const script = (existing as HTMLScriptElement | null) || document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(payload);
  if (!existing) {
    document.head.appendChild(script);
  }
}

export function buildAbsoluteUrl(pathOrUrl?: string): string {
  const origin =
    typeof window !== 'undefined' && window.location.hostname && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')
      ? DEFAULT_ORIGIN
      : DEFAULT_ORIGIN;
  if (!pathOrUrl) return `${origin}/`;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const clean = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${origin}${clean}`;
}

export function updateSeoTags(options: SeoUpdateOptions) {
  if (typeof document === 'undefined') return;

  const canonical = buildAbsoluteUrl(options.canonicalPath || (typeof window !== 'undefined' ? window.location.pathname : '/'));
  const ogImage = options.ogImage ? buildAbsoluteUrl(options.ogImage) : DEFAULT_IMAGE;
  const robots = options.robots || 'index, follow';

  document.title = options.title;
  upsertCanonical(canonical);

  upsertMeta('name', 'description', options.description);
  if (options.keywords) {
    upsertMeta('name', 'keywords', options.keywords);
  }
  upsertMeta('name', 'robots', robots);

  upsertMeta('property', 'og:site_name', 'TORI-WEAR');
  upsertMeta('property', 'og:title', options.title);
  upsertMeta('property', 'og:description', options.description);
  upsertMeta('property', 'og:type', options.ogType || 'website');
  upsertMeta('property', 'og:url', canonical);
  upsertMeta('property', 'og:image', ogImage);

  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', options.title);
  upsertMeta('name', 'twitter:description', options.description);
  upsertMeta('name', 'twitter:image', ogImage);

  if (options.jsonLdId) {
    upsertJsonLd(options.jsonLdId, options.jsonLd);
  } else {
    upsertJsonLd('tori-dynamic-jsonld', options.jsonLd);
  }
}

export function buildOrganizationJsonLd(opts?: {
  email?: string;
  phone?: string;
  address?: string;
  sameAs?: string[];
}) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'TORI-WEAR',
      url: DEFAULT_ORIGIN,
      logo: DEFAULT_IMAGE,
      description:
        'Original anime-inspired heavyweight 240 GSM streetwear, oversized T-shirts, drop-shoulder styles, hoodies, and kids storywear.',
      ...(opts?.email ? { email: opts.email } : {}),
      ...(opts?.phone ? { telephone: opts.phone } : {}),
      ...(opts?.sameAs && opts.sameAs.length > 0 ? { sameAs: opts.sameAs } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'TORI-WEAR',
      url: DEFAULT_ORIGIN,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${DEFAULT_ORIGIN}/catalog?search={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ];
}
