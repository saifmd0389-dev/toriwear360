import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ShimmerImage, SkeletonTheme } from './StorefrontSkeletons';

// Session-level image cache so neighbor slides decode/load with zero buffering
const preloadedUrls = new Set<string>();

function preloadImageUrl(url: string) {
  if (!url || preloadedUrls.has(url) || typeof window === 'undefined') return;
  preloadedUrls.add(url);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
}

interface CatalogCardImageCarouselProps {
  images: string[];
  alt: string;
  aspectClass?: string;
  bgClass?: string;
  shimmerTheme?: SkeletonTheme;
  fallbackSrc?: string;
  onCardClick: () => void;
  dotActiveColorClass?: string;
  counterPositionClass?: string;
  children?: React.ReactNode;
}

/**
 * High-speed hardware-accelerated micro carousel for Catalog Product Cards.
 * Supports Prev/Next buttons, clickable pagination dots, horizontal touch swipe,
 * and silent neighbor image preloading for instant zero-buffer transitions.
 */
export const CatalogCardImageCarousel: React.FC<CatalogCardImageCarouselProps> = ({
  images,
  alt,
  aspectClass = 'aspect-[3/4]',
  bgClass = 'bg-[#ebe8e1]',
  shimmerTheme,
  fallbackSrc = '/assets/branding/toriwear-official-logo.png',
  onCardClick,
  dotActiveColorClass = 'bg-white',
  counterPositionClass = 'bottom-2.5 right-2.5',
  children,
}) => {
  const resolvedTheme: SkeletonTheme = shimmerTheme
    || (bgClass.includes('sky') ? 'sky' : bgClass.includes('ebe8e1') || bgClass.includes('white') ? 'light' : 'dark');
  const validImages = React.useMemo(() => {
    const clean = Array.isArray(images)
      ? images.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      : [];
    return clean.length > 0 ? clean : [fallbackSrc];
  }, [images, fallbackSrc]);

  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipedRef = useRef(false);

  // Reset if product images array changes cleanly
  useEffect(() => {
    if (activeIndex >= validImages.length) {
      setActiveIndex(0);
    }
  }, [validImages.length, activeIndex]);

  // Preload adjacent slides whenever index changes
  useEffect(() => {
    if (validImages.length <= 1) return;
    const nextIdx = (activeIndex + 1) % validImages.length;
    const prevIdx = (activeIndex - 1 + validImages.length) % validImages.length;
    const nextSrc = validImages[nextIdx];
    const prevSrc = validImages[prevIdx];
    if (nextSrc) preloadImageUrl(nextSrc);
    if (prevSrc) preloadImageUrl(prevSrc);
  }, [activeIndex, validImages]);

  const total = validImages.length;
  const hasMultiple = total > 1;

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  };

  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  };

  const handleMouseEnter = () => {
    if (!hasMultiple) return;
    // Warm up second & third frames immediately on pointer hover
    if (validImages[1]) preloadImageUrl(validImages[1]);
    if (validImages[2]) preloadImageUrl(validImages[2]);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasMultiple) return;
    const touch = e.touches[0];
    if (!touch) return;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    swipedRef.current = false;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!hasMultiple || touchStartX.current === null || touchStartY.current === null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(dx) > 32 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swipedRef.current = true;
      if (dx < 0) {
        setActiveIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
      } else {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
      }
    }
  };

  const handleContainerClick = () => {
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }
    onCardClick();
  };

  // Compute sliding window of up to 7 dots when a product has many images
  const maxDots = 7;
  let dotStart = 0;
  let dotEnd = total;
  if (total > maxDots) {
    dotStart = Math.max(0, Math.min(activeIndex - 3, total - maxDots));
    dotEnd = dotStart + maxDots;
  }
  const visibleDotIndices = Array.from({ length: dotEnd - dotStart }, (_, i) => dotStart + i);

  return (
    <div
      onClick={handleContainerClick}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`relative ${aspectClass} overflow-hidden ${bgClass} cursor-pointer select-none`}
    >
      {/* Hardware-accelerated Carousel Track */}
      <div
        className="flex w-full h-full will-change-transform transition-transform duration-300 ease-out"
        style={{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }}
      >
        {validImages.map((src, idx) => (
          <ShimmerImage
            key={`${idx}-${src.slice(-24)}`}
            src={src}
            alt={idx === 0 ? alt : `${alt} view ${idx + 1}`}
            theme={resolvedTheme}
            fallbackSrc={fallbackSrc}
            wrapperClassName="w-full h-full shrink-0"
            referrerPolicy="no-referrer"
            loading={idx === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className="w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ))}
      </div>

      {/* Custom card overlays (badges, wishlist, 70% zoom button) */}
      {children}

      {/* Mini Prev / Next Controls */}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous image"
            className="absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/55 hover:bg-black/85 text-white backdrop-blur-xs flex items-center justify-center transition-opacity duration-200 opacity-85 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer shadow-md active:scale-90"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={goNext}
            aria-label="Next image"
            className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/55 hover:bg-black/85 text-white backdrop-blur-xs flex items-center justify-center transition-opacity duration-200 opacity-85 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer shadow-md active:scale-90"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Bottom Interactive Pagination Dots */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/45 backdrop-blur-xs"
          >
            {visibleDotIndices.map((dotIdx) => {
              const isCurrent = dotIdx === activeIndex;
              return (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex(dotIdx);
                  }}
                  aria-label={`View image ${dotIdx + 1} of ${total}`}
                  className={`transition-all duration-200 rounded-full cursor-pointer ${
                    isCurrent
                      ? `w-4 h-1.5 ${dotActiveColorClass}`
                      : 'w-1.5 h-1.5 bg-white/55 hover:bg-white/90'
                  }`}
                />
              );
            })}
          </div>

          {/* Crisp Photo Index Chip when > 2 photos */}
          {total > 2 && (
            <div className={`absolute ${counterPositionClass} z-10 pointer-events-none bg-black/60 backdrop-blur-xs text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded`}>
              {activeIndex + 1}/{total}
            </div>
          )}
        </>
      )}
    </div>
  );
};
