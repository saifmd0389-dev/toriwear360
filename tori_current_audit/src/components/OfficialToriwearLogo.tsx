import React, { useState, useEffect } from 'react';

export interface OfficialToriwearLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
  alt?: string;
  suppressWarning?: boolean;
  variant?: 'primary' | 'secondary';
}

export interface BrandLogoState {
  primaryUrl: string;
  secondaryUrl: string;
  timestamp: string;
}

const DEFAULT_LOGO_STATE: BrandLogoState = {
  primaryUrl: '/assets/toriwear-official-logo.png',
  secondaryUrl: '/assets/second-brand-logo.png',
  timestamp: (() => {
    try {
      return localStorage.getItem('tori_logo_timestamp') || '';
    } catch {
      return '';
    }
  })(),
};

let cachedLogoState: BrandLogoState = { ...DEFAULT_LOGO_STATE };
let inflightLogoFetch: Promise<BrandLogoState> | null = null;
const logoListeners = new Set<(state: BrandLogoState) => void>();

export function notifyBrandLogoUpdated(partial: Partial<BrandLogoState>) {
  cachedLogoState = {
    ...cachedLogoState,
    ...partial,
  };
  try {
    if (cachedLogoState.timestamp) {
      localStorage.setItem('tori_logo_timestamp', cachedLogoState.timestamp);
    }
  } catch {}
  logoListeners.forEach((cb) => cb(cachedLogoState));
}

export async function refreshBrandLogoState(force: boolean = false): Promise<BrandLogoState> {
  if (!force && inflightLogoFetch) return inflightLogoFetch;

  inflightLogoFetch = fetch('/api/brand/logo-status')
    .then((res) => res.json())
    .then((json) => {
      if (json?.success && json?.data) {
        const d = json.data;
        const next: BrandLogoState = {
          primaryUrl: d.path || cachedLogoState.primaryUrl,
          secondaryUrl: d.secondaryPath || cachedLogoState.secondaryUrl,
          timestamp: d.timestamp ? String(d.timestamp) : cachedLogoState.timestamp,
        };
        cachedLogoState = next;
        try {
          if (next.timestamp) {
            localStorage.setItem('tori_logo_timestamp', next.timestamp);
          }
        } catch {}
        logoListeners.forEach((cb) => cb(next));
        return next;
      }
      return cachedLogoState;
    })
    .catch(() => cachedLogoState)
    .finally(() => {
      inflightLogoFetch = null;
    });

  return inflightLogoFetch;
}

export function useBrandLogoState(): BrandLogoState {
  const [state, setState] = useState<BrandLogoState>(cachedLogoState);

  useEffect(() => {
    const listener = (next: BrandLogoState) => setState({ ...next });
    logoListeners.add(listener);
    refreshBrandLogoState(false);

    const handleLogoEvent = (e: any) => {
      const detail = e?.detail || {};
      const next: BrandLogoState = {
        primaryUrl: detail.primaryUrl || cachedLogoState.primaryUrl,
        secondaryUrl: detail.secondaryUrl || cachedLogoState.secondaryUrl,
        timestamp: detail.timestamp ? String(detail.timestamp) : Date.now().toString(),
      };
      cachedLogoState = next;
      setState(next);
      refreshBrandLogoState(true);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'tori_logo_timestamp' && e.newValue) {
        refreshBrandLogoState(true);
      }
    };

    window.addEventListener('tori-logo-updated', handleLogoEvent);
    window.addEventListener('storage', handleStorage);
    return () => {
      logoListeners.delete(listener);
      window.removeEventListener('tori-logo-updated', handleLogoEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return state;
}

/**
 * Official TORIWEAR Logo Component
 *
 * Strict Brand Requirements:
 * - Renders ONLY the authoritative uploaded logo asset (.png / .svg) from disk
 * - NO text recreation, NO font substitute, NO CSS recreation
 * - Responsive proportional scaling with object-fit: contain
 * - Authoritative server logo-status + cache-busting so updates persist across restarts and logins
 */
export const OfficialToriwearLogo: React.FC<OfficialToriwearLogoProps> = ({
  className = '',
  alt = 'TORIWEAR — WEAR YOUR WORLD',
  suppressWarning = false,
  variant = 'primary',
  src,
  ...props
}) => {
  const logoState = useBrandLogoState();
  const [fallbackIdx, setFallbackIdx] = useState(0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setFallbackIdx(0);
    setLoadError(false);
  }, [logoState.primaryUrl, logoState.secondaryUrl, logoState.timestamp, src, variant]);

  const candidates = src
    ? [src]
    : variant === 'secondary'
      ? [
          logoState.secondaryUrl,
          '/assets/second-brand-logo.png',
          logoState.primaryUrl,
          '/assets/branding/toriwear-official-logo.png',
          '/assets/toriwear-official-logo.png',
        ]
      : [
          logoState.primaryUrl,
          '/assets/branding/toriwear-official-logo.png',
          '/assets/toriwear-official-logo.png',
        ];

  const uniqueCandidates = candidates.filter((v, idx, arr) => Boolean(v) && arr.indexOf(v) === idx);
  const baseSrc = uniqueCandidates[fallbackIdx] || uniqueCandidates[0] || '/assets/toriwear-official-logo.png';

  const handleError = () => {
    if (fallbackIdx + 1 < uniqueCandidates.length) {
      setFallbackIdx(fallbackIdx + 1);
    } else {
      setLoadError(true);
    }
  };

  if (loadError) {
    if (suppressWarning) return null;
    return (
      <div
        className={`border border-red-500/40 bg-black/90 text-white rounded p-2 text-center inline-flex flex-col items-center justify-center ${className}`}
        title="THE OFFICIAL LOGO FILE IS NOT PRESENT IN THE PROJECT ASSETS."
      >
        <span className="text-[10px] font-mono text-red-500 font-bold uppercase tracking-wider">
          THE OFFICIAL LOGO FILE IS NOT PRESENT IN THE PROJECT ASSETS.
        </span>
        <span className="text-[8px] font-mono text-neutral-400 mt-0.5">
          Expected at /assets/branding/toriwear-official-logo.png
        </span>
      </div>
    );
  }

  const finalSrc = logoState.timestamp
    ? (baseSrc.includes('?') ? `${baseSrc}&v=${logoState.timestamp}` : `${baseSrc}?v=${logoState.timestamp}`)
    : baseSrc;

  return (
    <img
      src={finalSrc}
      alt={alt}
      className={`toriwear-official-logo ${className}`}
      onError={handleError}
      loading="eager"
      decoding="async"
      {...props}
    />
  );
};

export default OfficialToriwearLogo;
