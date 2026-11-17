import React, { useEffect, useRef, useState } from 'react';

export type SkeletonTheme = 'dark' | 'light' | 'sky' | 'neutral';

const THEME_CLASS_MAP: Record<SkeletonTheme, string> = {
  dark: 'skeleton-dark',
  light: 'skeleton-light',
  sky: 'skeleton-sky',
  neutral: 'skeleton-neutral',
};

interface ShimmerImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  theme?: SkeletonTheme;
  fallbackSrc?: string;
  wrapperClassName?: string;
}

export const ShimmerImage: React.FC<ShimmerImageProps> = ({
  src,
  alt = '',
  theme = 'neutral',
  fallbackSrc,
  className = '',
  wrapperClassName = 'w-full h-full',
  onLoad,
  onError,
  ...rest
}) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(src);

  useEffect(() => {
    setResolvedSrc(src);
    if (
      imgRef.current &&
      imgRef.current.getAttribute('src') === src &&
      imgRef.current.complete &&
      imgRef.current.naturalWidth > 0
    ) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [src]);

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [resolvedSrc]);

  const shimmerClass = THEME_CLASS_MAP[theme] || 'skeleton-neutral';

  return (
    <div className={`relative overflow-hidden ${wrapperClassName}`}>
      {!loaded && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 z-0 ${shimmerClass}`}
        />
      )}
      <div
        className={`w-full h-full transition-opacity duration-300 ease-out ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <img
          ref={imgRef}
          src={resolvedSrc}
          alt={alt}
          onLoad={(e) => {
            setLoaded(true);
            onLoad?.(e);
          }}
          onError={(e) => {
            if (fallbackSrc && resolvedSrc !== fallbackSrc) {
              setResolvedSrc(fallbackSrc);
            } else {
              setLoaded(true);
            }
            onError?.(e);
          }}
          className={className}
          {...rest}
        />
      </div>
    </div>
  );
};

interface CatalogGridSkeletonProps {
  variant: 'men' | 'kids';
  count?: number;
}

export const CatalogGridSkeleton: React.FC<CatalogGridSkeletonProps> = ({
  variant,
  count = 8,
}) => {
  const isKids = variant === 'kids';
  const shimmer = isKids ? 'skeleton-sky' : 'skeleton-light';

  return (
    <div
      aria-busy="true"
      aria-label={isKids ? 'Loading Kids catalog drops' : 'Loading Men catalog drops'}
      className="flex flex-wrap gap-3 md:grid md:grid-cols-3 xl:grid-cols-4 md:gap-6"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className={`flex-1 basis-[calc(50%-6px)] sm:basis-[calc(33.333%-8px)] min-w-[140px] md:flex-initial md:min-w-0 bg-white overflow-hidden flex flex-col justify-between shadow-sm ${
            isKids ? 'rounded-2xl border border-sky-100' : 'rounded-xl border border-neutral-200/90'
          }`}
        >
          <div className={`w-full ${isKids ? 'aspect-square' : 'aspect-[3/4]'} ${shimmer}`} />

          <div className={isKids ? 'p-4 space-y-3' : 'p-3 sm:p-5 space-y-3'}>
            <div className="space-y-2">
              {!isKids && (
                <div className="flex items-center justify-between gap-2">
                  <div className={`h-3 w-16 rounded ${shimmer}`} />
                  <div className={`h-3 w-10 rounded ${shimmer}`} />
                </div>
              )}
              <div className={`h-4 w-4/5 rounded ${shimmer}`} />
              <div className={`h-3 w-2/3 rounded ${shimmer}`} />
            </div>

            <div className={`pt-3 border-t ${isKids ? 'border-sky-50' : 'border-neutral-200'} space-y-2.5`}>
              {!isKids && (
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 4 }).map((__, sIdx) => (
                    <div key={sIdx} className={`h-5 w-7 rounded ${shimmer}`} />
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <div className={`h-5 w-20 rounded ${shimmer}`} />
                <div className={`h-7 w-16 rounded-lg ${shimmer}`} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

interface CircleCarouselSkeletonProps {
  theme?: 'dark' | 'light';
  count?: number;
}

export const CircleCarouselSkeleton: React.FC<CircleCarouselSkeletonProps> = ({
  theme = 'dark',
  count = 5,
}) => {
  const isLight = theme === 'light';
  const shimmer = isLight ? 'skeleton-sky' : 'skeleton-dark';

  return (
    <div
      aria-busy="true"
      aria-label="Loading featured capsule drops"
      className="flex items-start gap-4 sm:gap-5 overflow-hidden pb-4 pt-1"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="w-[calc(48%-8px)] sm:w-[calc(33.33%-12px)] lg:w-[calc(20%-13px)] min-w-[140px] sm:min-w-[170px] max-w-[220px] flex-shrink-0 flex flex-col items-center text-center"
        >
          <div
            className={`w-full aspect-square max-w-[220px] mx-auto rounded-full p-1.5 ${
              isLight ? 'border-2 border-sky-100 bg-white' : 'border border-neutral-800/90 bg-neutral-900/60'
            }`}
          >
            <div className={`w-full h-full rounded-full ${shimmer}`} />
          </div>
          <div className="mt-3 w-full px-2 flex flex-col items-center space-y-2">
            <div className={`h-2.5 w-20 rounded ${shimmer}`} />
            <div className={`h-3.5 w-32 rounded ${shimmer}`} />
            <div className={`h-3.5 w-16 rounded ${shimmer}`} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const ProductDetailSkeleton: React.FC = () => {
  return (
    <div
      aria-busy="true"
      aria-label="Loading product details"
      className="min-h-screen bg-white text-neutral-900 font-sans pb-12"
    >
      {/* Breadcrumb bar */}
      <div className="border-b border-neutral-200/80 bg-white">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2">
          <div className="h-3.5 w-12 rounded skeleton-neutral" />
          <div className="h-3.5 w-12 rounded skeleton-neutral" />
          <div className="h-3.5 w-32 rounded skeleton-neutral" />
          <div className="h-3.5 w-28 rounded skeleton-neutral hidden sm:block" />
        </div>
      </div>

      {/* Main 2-column stage */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Gallery Column */}
          <div className="lg:col-span-7 space-y-5">
            <div className="space-y-3">
              <div className="aspect-[4/5] sm:aspect-[3/4] max-h-[76vh] w-full border border-neutral-200/70 skeleton-neutral" />
              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="w-14 h-18 sm:w-16 sm:h-20 shrink-0 border border-neutral-200 skeleton-neutral" />
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-200/80 space-y-3.5">
              <div className="h-4 w-44 rounded skeleton-neutral" />
              <div className="grid grid-cols-2 gap-2.5">
                <div className="aspect-[3/4] skeleton-neutral border border-neutral-200/60" />
                <div className="aspect-[3/4] skeleton-neutral border border-neutral-200/60" />
              </div>
            </div>
          </div>

          {/* Right Commerce Column */}
          <div className="lg:col-span-5 space-y-5">
            <div className="space-y-2.5">
              <div className="h-7 w-4/5 rounded skeleton-neutral" />
              <div className="h-4 w-36 rounded skeleton-neutral" />
              <div className="pt-2 space-y-1.5">
                <div className="h-7 w-28 rounded skeleton-neutral" />
                <div className="h-3 w-32 rounded skeleton-neutral" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="h-3.5 w-32 rounded skeleton-neutral" />
              <div className="flex items-center gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="w-14 h-18 sm:w-16 sm:h-20 skeleton-neutral" />
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="h-3.5 w-28 rounded skeleton-neutral" />
              <div className="flex items-center gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-8 h-8 rounded-full skeleton-neutral" />
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-32 rounded skeleton-neutral" />
                <div className="h-3.5 w-20 rounded skeleton-neutral" />
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="w-[46px] h-9 skeleton-neutral" />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 h-12 skeleton-neutral" />
              <div className="flex-1 h-12 skeleton-neutral" />
            </div>

            <div className="w-full h-10 skeleton-neutral" />

            <div className="pt-2 space-y-2.5">
              <div className="h-3.5 w-28 rounded skeleton-neutral" />
              <div className="w-full h-10 skeleton-neutral" />
              <div className="w-full h-16 skeleton-neutral" />
            </div>

            <div className="border-t border-neutral-200 pt-3 space-y-3">
              <div className="h-10 w-full skeleton-neutral" />
              <div className="h-10 w-full skeleton-neutral" />
            </div>
          </div>
        </div>

        {/* Related Section Placeholder */}
        <div className="mt-16 pt-10 border-t border-neutral-200">
          <div className="h-5 w-44 rounded skeleton-neutral mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="aspect-[3/4] skeleton-neutral" />
                <div className="h-3.5 w-3/4 rounded skeleton-neutral" />
                <div className="h-3 w-1/2 rounded skeleton-neutral" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ChooseYourWorldSkeleton: React.FC = () => {
  return (
    <div
      aria-busy="true"
      aria-label="Loading worlds"
      className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className={`rounded-2xl border border-neutral-800 bg-[#121215] p-3.5 sm:p-6 flex flex-col justify-between min-h-[250px] sm:min-h-[380px] lg:min-h-[420px] ${
            index === 4 ? 'col-span-2 lg:col-span-1' : ''
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-9 rounded skeleton-dark" />
              <div className="h-5 w-20 rounded skeleton-dark" />
            </div>
            <div className="h-3 w-16 rounded skeleton-dark mt-2" />
            <div className="h-7 w-4/5 rounded skeleton-dark" />
            <div className="h-4 w-full rounded skeleton-dark" />
            <div className="h-12 w-full rounded skeleton-dark" />
          </div>
          <div className="pt-5 border-t border-neutral-800/80 flex items-center justify-between">
            <div className="h-4 w-24 rounded skeleton-dark" />
            <div className="w-2.5 h-2.5 rounded-full skeleton-dark" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const TwinningSpotlightSkeleton: React.FC = () => {
  return (
    <div
      aria-busy="true"
      aria-label="Loading twinning spotlight"
      className="bg-[#12131b] border-2 border-neutral-800 rounded-3xl p-6 sm:p-10 shadow-2xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 grid grid-cols-2 gap-4">
          {[0, 1].map((idx) => (
            <div key={idx} className="bg-[#161822] border border-neutral-800 rounded-2xl overflow-hidden p-3 sm:p-4">
              <div className="aspect-[3/4] rounded-xl skeleton-dark mb-3" />
              <div className="h-3.5 w-2/3 rounded skeleton-dark" />
              <div className="h-3 w-1/2 rounded skeleton-dark mt-1.5" />
            </div>
          ))}
        </div>
        <div className="lg:col-span-5 space-y-5">
          <div className="space-y-3">
            <div className="h-3.5 w-36 rounded skeleton-dark" />
            <div className="h-8 w-4/5 rounded skeleton-dark" />
            <div className="h-16 w-full rounded skeleton-dark" />
          </div>
          <div className="h-20 w-full rounded-xl skeleton-dark border border-neutral-800" />
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="h-12 flex-1 rounded-xl skeleton-dark" />
            <div className="h-12 w-36 rounded-xl skeleton-dark" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const OriginalCharactersSkeleton: React.FC = () => {
  return (
    <div aria-busy="true" aria-label="Loading original characters" className="space-y-8">
      <div className="flex items-center gap-2.5 overflow-hidden pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-36 rounded-xl shrink-0 skeleton-dark border border-neutral-800" />
        ))}
      </div>
      <div className="rounded-3xl bg-[#121215] border border-neutral-800/90 p-5 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-5 aspect-[3/4] rounded-2xl skeleton-dark border border-neutral-800" />
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="h-6 w-28 rounded-full skeleton-dark" />
              <div className="h-6 w-36 rounded skeleton-dark" />
            </div>
            <div className="h-9 w-3/4 rounded skeleton-dark" />
            <div className="h-20 w-full rounded skeleton-dark" />
            <div className="h-16 w-full rounded-xl skeleton-dark" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-24 rounded-lg skeleton-dark" />
            <div className="h-8 w-28 rounded-lg skeleton-dark" />
            <div className="h-8 w-24 rounded-lg skeleton-dark" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const StoryBehindDesignsSkeleton: React.FC = () => {
  return (
    <div aria-busy="true" aria-label="Loading design stories" className="space-y-8">
      <div className="flex items-center gap-2 overflow-hidden pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-40 rounded-xl shrink-0 skeleton-dark border border-neutral-800" />
        ))}
      </div>
      <div className="rounded-3xl bg-[#121215] border border-neutral-800/90 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[380px]">
        <div className="lg:col-span-5 p-8 sm:p-12 bg-[#16161d] border-b lg:border-b-0 lg:border-r border-neutral-800 flex flex-col justify-between space-y-8">
          <div className="flex justify-between">
            <div className="h-4 w-20 rounded skeleton-dark" />
            <div className="h-4 w-28 rounded skeleton-dark" />
          </div>
          <div className="space-y-3 flex flex-col items-center">
            <div className="h-4 w-24 rounded skeleton-dark" />
            <div className="h-10 w-56 rounded skeleton-dark" />
            <div className="h-6 w-48 rounded-full skeleton-dark" />
          </div>
          <div className="h-14 w-full rounded-xl skeleton-dark" />
        </div>
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="h-3.5 w-24 rounded skeleton-dark" />
            <div className="h-24 w-full rounded skeleton-dark" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="h-20 rounded-xl skeleton-dark" />
              <div className="h-20 rounded-xl skeleton-dark" />
            </div>
          </div>
          <div className="h-14 w-full rounded-xl skeleton-dark" />
        </div>
      </div>
    </div>
  );
};

export const LookbookGridSkeleton: React.FC = () => {
  return (
    <div
      aria-busy="true"
      aria-label="Loading community lookbook"
      className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl sm:rounded-2xl bg-[#111219] border border-neutral-800 overflow-hidden flex flex-col justify-between"
        >
          <div className="aspect-[3/4] skeleton-dark" />
          <div className="p-2.5 sm:p-4 space-y-2.5">
            <div className="h-3 w-20 rounded skeleton-dark" />
            <div className="h-12 w-full rounded skeleton-dark" />
            <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
              <div className="h-3.5 w-28 rounded skeleton-dark" />
              <div className="h-6 w-6 rounded-lg skeleton-dark" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const ToriFeedGridSkeleton: React.FC = () => {
  return (
    <div
      aria-busy="true"
      aria-label="Loading Tori feed"
      className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl sm:rounded-2xl bg-[#0f1017] border border-neutral-800 overflow-hidden flex flex-col justify-between"
        >
          <div className="aspect-square skeleton-dark" />
          <div className="p-2.5 sm:p-4 space-y-2.5">
            <div className="h-12 w-full rounded skeleton-dark" />
            <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
              <div className="h-3 w-20 rounded skeleton-dark" />
              <div className="h-3 w-16 rounded skeleton-dark" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const RecentlyViewedSkeleton: React.FC<{ count?: number; className?: string }> = ({
  count = 6,
  className = '',
}) => {
  return (
    <section
      aria-busy="true"
      aria-label="Loading recently viewed products"
      className={`py-12 bg-neutral-950 border-t border-neutral-900 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div className="space-y-2">
            <div className="h-6 w-40 rounded-full skeleton-dark" />
            <div className="h-7 w-52 rounded skeleton-dark" />
            <div className="h-4 w-72 rounded skeleton-dark" />
          </div>
          <div className="h-8 w-28 rounded-lg skeleton-dark" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="bg-[#121217] rounded-xl border border-neutral-800/80 overflow-hidden flex flex-col"
            >
              <div className="aspect-[3/4] skeleton-dark" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 w-4/5 rounded skeleton-dark" />
                <div className="h-2.5 w-3/5 rounded skeleton-dark" />
                <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                  <div className="h-4 w-14 rounded skeleton-dark" />
                  <div className="h-6 w-6 rounded-lg skeleton-dark" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
