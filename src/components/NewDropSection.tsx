import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Product } from '../types';
import { isPublishedProduct } from '../utils/productFilters';
import { EmptyDropState } from './EmptyDropState';
import { CircleImageBox } from './CircleImageBox';
import { CircleCarouselSkeleton } from './StorefrontSkeletons';

interface NewDropSectionProps {
  products: Product[];
  isLoading?: boolean;
  wishlist: string[];
  onToggleWishlist: (productId: string) => void;
  onOpenProductDetail: (product: Product) => void;
  onOpenPopoutZoom?: (product: Product) => void;
  onAddToCart: (product: Product, size: string, color: string) => void;
}

export const NewDropSection: React.FC<NewDropSectionProps> = ({
  products,
  isLoading = false,
  wishlist,
  onToggleWishlist,
  onOpenProductDetail,
  onOpenPopoutZoom,
  onAddToCart,
}) => {
  // Filter new drops: strictly published products with valid images
  const newDropProducts = products
    .filter((p) => isPublishedProduct(p) && p.isNewDrop)
    .slice(0, 10);

  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollRafRef = useRef<number | null>(null);

  const checkScrollState = () => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (!carouselRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      const nextCanLeft = scrollLeft > 10;
      const nextCanRight = scrollLeft + clientWidth < scrollWidth - 10;

      setCanScrollLeft((prev) => (prev !== nextCanLeft ? nextCanLeft : prev));
      setCanScrollRight((prev) => (prev !== nextCanRight ? nextCanRight : prev));
    });
  };

  useEffect(() => {
    checkScrollState();
    const el = carouselRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScrollState, { passive: true });
    window.addEventListener('resize', checkScrollState);
    return () => {
      el.removeEventListener('scroll', checkScrollState);
      window.removeEventListener('resize', checkScrollState);
    };
  }, [newDropProducts.length]);

  const slide = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const scrollAmount = carouselRef.current.clientWidth * 0.75;
    carouselRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      slide('left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      slide('right');
    }
  };

  return (
    <section 
      id="new-drop-section" 
      className="py-16 sm:py-20 bg-[#0a0a0a] border-b border-neutral-800/80 relative select-none"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-mono tracking-[0.25em] text-[#FF2028] uppercase font-bold">
                EXCLUSIVE CAPSULE
              </span>
              <span className="text-neutral-600">•</span>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded">
                HORIZONTAL SCROLL · 5 IN FRONT
              </span>
            </div>
            
            <h2 className="font-heading text-3xl sm:text-5xl font-black text-white uppercase tracking-tight flex items-baseline gap-3">
              <span>NEW LAUNCH</span>
              <span className="text-sm sm:text-lg font-mono text-[#FF2028] font-bold tracking-normal">
                // DROP 01
              </span>
            </h2>
            
            <div className="mt-1 text-xs sm:text-sm font-semibold text-neutral-300 tracking-wider uppercase font-mono">
              THE LATEST CHAPTER.
            </div>
          </div>

          {/* Desktop & Mobile Sliding Controls + CTA */}
          <div className="flex items-center gap-3">
            {/* Transparent Left & Right Sliding Arrow Controls */}
            <div className="flex items-center gap-2">
              <button
                id="new-drop-prev-btn"
                onClick={() => slide('left')}
                disabled={!canScrollLeft}
                className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer backdrop-blur-md ${
                  canScrollLeft
                    ? 'bg-neutral-900/60 border-neutral-700 text-white hover:bg-neutral-800 hover:border-white/40 active:scale-95 shadow-lg'
                    : 'bg-neutral-900/20 border-neutral-800/40 text-neutral-600 cursor-not-allowed opacity-40'
                }`}
                aria-label="Previous Slide"
                title="Slide Left (or Left Arrow Key)"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                id="new-drop-next-btn"
                onClick={() => slide('right')}
                disabled={!canScrollRight}
                className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer backdrop-blur-md ${
                  canScrollRight
                    ? 'bg-neutral-900/60 border-neutral-700 text-white hover:bg-neutral-800 hover:border-white/40 active:scale-95 shadow-lg'
                    : 'bg-neutral-900/20 border-neutral-800/40 text-neutral-600 cursor-not-allowed opacity-40'
                }`}
                aria-label="Next Slide"
                title="Slide Right (or Right Arrow Key)"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={() => {
                const el = document.getElementById('shop-men-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-4 py-2.5 bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-bold font-heading uppercase tracking-wider rounded-xl transition whitespace-nowrap cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <span>ALL MEN’S</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Carousel Content, Skeleton, or Empty State */}
        {isLoading ? (
          <CircleCarouselSkeleton theme="dark" count={5} />
        ) : newDropProducts.length === 0 ? (
          <EmptyDropState
            title="THE NEXT DROP IS COMING"
            subtitle="CHAPTER 01 CAPSULE IN REVISION"
            description="Our newest apparel designs are currently undergoing rigorous quality and screen-print inspection before release."
            theme="dark"
            actionLabel="EXPLORE MEN'S WORLDS"
            onAction={() => {
              const el = document.getElementById('shop-men-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        ) : (
          <div className="relative group/carousel skeleton-reveal">
            {/* Transparent Floating Left Arrow Button over Track */}
            {canScrollLeft && (
              <button
                onClick={() => slide('left')}
                className="absolute -left-3 sm:-left-5 top-[38%] -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-neutral-950/70 hover:bg-neutral-900 text-white border border-white/15 flex items-center justify-center shadow-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
                aria-label="Slide Left"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {/* Transparent Floating Right Arrow Button over Track */}
            {canScrollRight && (
              <button
                onClick={() => slide('right')}
                className="absolute -right-3 sm:-right-5 top-[38%] -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-neutral-950/70 hover:bg-neutral-900 text-white border border-white/15 flex items-center justify-center shadow-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
                aria-label="Slide Right"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {/* Horizontal Product-Scrolling Carousel Track (5 visible in front on desktop) */}
            <div
              id="new-drop-carousel-track"
              ref={carouselRef}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              className="flex items-start gap-4 sm:gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory touch-pan-x pb-4 pt-1 no-scrollbar overscroll-x-contain focus:outline-none focus:ring-1 focus:ring-white/20 rounded-2xl"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {newDropProducts.map((product) => {
                const isWishlisted = wishlist.includes(product.id);

                return (
                  <div
                    key={product.id}
                    className="w-[calc(48%-8px)] sm:w-[calc(33.33%-12px)] lg:w-[calc(20%-13px)] min-w-[140px] sm:min-w-[170px] max-w-[220px] flex-shrink-0 snap-start"
                  >
                    {/* Circle Image Box with Hover Image Zoom */}
                    <CircleImageBox
                      product={product}
                      badgeText="NEW DROP"
                      isWishlisted={isWishlisted}
                      onToggleWishlist={() => onToggleWishlist(product.id)}
                      onOpenProductDetail={() => onOpenProductDetail(product)}
                      onOpenPopoutZoom={onOpenPopoutZoom}
                      onQuickAdd={(size) => onAddToCart(product, size, product.colors[0]?.name || 'Black')}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
