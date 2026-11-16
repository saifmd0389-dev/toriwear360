import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, Award } from 'lucide-react';
import { Product } from '../types';
import { isPublishedProduct } from '../utils/productFilters';
import { CircleImageBox } from './CircleImageBox';

interface ProductSectionProps {
  products: Product[];
  wishlist: string[];
  onToggleWishlist: (productId: string) => void;
  onOpenProductDetail: (product: Product) => void;
  onOpenPopoutZoom?: (product: Product) => void;
  onAddToCart: (product: Product, size: string, color: string) => void;
}

export const TrendingNow: React.FC<ProductSectionProps> = ({
  products,
  wishlist,
  onToggleWishlist,
  onOpenProductDetail,
  onOpenPopoutZoom,
  onAddToCart,
}) => {
  const trendingProducts = products
    .filter((p) => isPublishedProduct(p) && p.isTrending)
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
  }, [trendingProducts.length]);

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
    <section id="trending-now-section" className="py-16 sm:py-20 bg-[#09090e] border-b border-neutral-800/80 relative select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono uppercase tracking-widest text-amber-400 mb-3">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>HIGH ENGAGEMENT // STREET DROP</span>
            </div>
            <h2 className="font-heading text-3xl sm:text-5xl font-black text-white uppercase tracking-tight">
              TRENDING <span className="text-amber-400">NOW</span>
            </h2>
            <p className="mt-1 text-neutral-400 text-xs sm:text-sm font-mono">
              The hottest community fits across Discord, Instagram, and college campuses this week.
            </p>
          </div>

          {/* Desktop & Mobile Sliding Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => slide('left')}
              disabled={!canScrollLeft}
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer backdrop-blur-md ${
                canScrollLeft
                  ? 'bg-neutral-900/60 border-neutral-700 text-white hover:bg-neutral-800 hover:border-amber-400 active:scale-95 shadow-md'
                  : 'bg-neutral-900/20 border-neutral-800/40 text-neutral-600 cursor-not-allowed opacity-40'
              }`}
              aria-label="Previous Slide"
              title="Slide Left (or Left Arrow Key)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={() => slide('right')}
              disabled={!canScrollRight}
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer backdrop-blur-md ${
                canScrollRight
                  ? 'bg-neutral-900/60 border-neutral-700 text-white hover:bg-neutral-800 hover:border-amber-400 active:scale-95 shadow-md'
                  : 'bg-neutral-900/20 border-neutral-800/40 text-neutral-600 cursor-not-allowed opacity-40'
              }`}
              aria-label="Next Slide"
              title="Slide Right (or Right Arrow Key)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carousel Track with 5 items in front */}
        <div className="relative group/carousel">
          {/* Floating Transparent Left Arrow Button */}
          {canScrollLeft && (
            <button
              onClick={() => slide('left')}
              className="absolute -left-3 sm:-left-5 top-[38%] -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-neutral-950/70 hover:bg-neutral-900 text-white border border-white/15 flex items-center justify-center shadow-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
              aria-label="Slide Left"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Floating Transparent Right Arrow Button */}
          {canScrollRight && (
            <button
              onClick={() => slide('right')}
              className="absolute -right-3 sm:-right-5 top-[38%] -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-neutral-950/70 hover:bg-neutral-900 text-white border border-white/15 flex items-center justify-center shadow-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
              aria-label="Slide Right"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* 5 Visible In Front on Desktop Track */}
          <div
            id="trending-now-carousel-track"
            ref={carouselRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="flex items-start gap-4 sm:gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory touch-pan-x pb-4 pt-1 no-scrollbar overscroll-x-contain focus:outline-none focus:ring-1 focus:ring-amber-400/30 rounded-2xl"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {trendingProducts.map((product) => {
              const isWishlisted = wishlist.includes(product.id);

              return (
                <div
                  key={product.id}
                  className="w-[calc(48%-8px)] sm:w-[calc(33.33%-12px)] lg:w-[calc(20%-13px)] min-w-[140px] sm:min-w-[170px] max-w-[220px] flex-shrink-0 snap-start"
                >
                  <CircleImageBox
                    product={product}
                    badgeText="TRENDING"
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
      </div>
    </section>
  );
};

export const Bestsellers: React.FC<ProductSectionProps> = ({
  products,
  wishlist,
  onToggleWishlist,
  onOpenProductDetail,
  onOpenPopoutZoom,
  onAddToCart,
}) => {
  const bestsellers = products
    .filter((p) => isPublishedProduct(p) && p.isBestseller)
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
  }, [bestsellers.length]);

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
    <section id="bestsellers-section" className="py-16 sm:py-20 bg-[#08080c] border-b border-neutral-800/80 relative select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF2028]/10 border border-[#FF2028]/30 text-[11px] font-mono uppercase tracking-widest text-[#FF2028] mb-3">
              <Award className="w-3.5 h-3.5" />
              <span>THE HALL OF FAME</span>
            </div>
            
            <h2 className="font-heading text-3xl sm:text-5xl font-black text-white uppercase tracking-tight flex items-baseline gap-3">
              <span>TOP SELLING</span>
              <span className="text-sm sm:text-lg font-mono text-[#FF2028] font-bold tracking-normal">
                // BESTSELLERS
              </span>
            </h2>

            <div className="mt-1 font-mono text-xs sm:text-sm font-semibold text-neutral-300 tracking-wider uppercase">
              THE ONES EVERYONE’S WEARING.
            </div>
          </div>

          {/* Desktop & Mobile Sliding Controls */}
          <div className="flex items-center gap-2">
            <button
              id="top-selling-prev-btn"
              onClick={() => slide('left')}
              disabled={!canScrollLeft}
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer backdrop-blur-md ${
                canScrollLeft
                  ? 'bg-neutral-900/60 border-neutral-700 text-white hover:bg-neutral-800 hover:border-[#FF2028] active:scale-95 shadow-md'
                  : 'bg-neutral-900/20 border-neutral-800/40 text-neutral-600 cursor-not-allowed opacity-40'
              }`}
              aria-label="Previous Slide"
              title="Slide Left (or Left Arrow Key)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              id="top-selling-next-btn"
              onClick={() => slide('right')}
              disabled={!canScrollRight}
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer backdrop-blur-md ${
                canScrollRight
                  ? 'bg-neutral-900/60 border-neutral-700 text-white hover:bg-neutral-800 hover:border-[#FF2028] active:scale-95 shadow-md'
                  : 'bg-neutral-900/20 border-neutral-800/40 text-neutral-600 cursor-not-allowed opacity-40'
              }`}
              aria-label="Next Slide"
              title="Slide Right (or Right Arrow Key)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carousel Track with 5 items in front */}
        <div className="relative group/carousel">
          {/* Floating Transparent Left Arrow Button */}
          {canScrollLeft && (
            <button
              onClick={() => slide('left')}
              className="absolute -left-3 sm:-left-5 top-[38%] -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-neutral-950/70 hover:bg-neutral-900 text-white border border-white/15 flex items-center justify-center shadow-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
              aria-label="Slide Left"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Floating Transparent Right Arrow Button */}
          {canScrollRight && (
            <button
              onClick={() => slide('right')}
              className="absolute -right-3 sm:-right-5 top-[38%] -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-neutral-950/70 hover:bg-neutral-900 text-white border border-white/15 flex items-center justify-center shadow-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
              aria-label="Slide Right"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* 5 Visible In Front on Desktop Track */}
          <div
            id="top-selling-carousel-track"
            ref={carouselRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="flex items-start gap-4 sm:gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory touch-pan-x pb-4 pt-1 no-scrollbar overscroll-x-contain focus:outline-none focus:ring-1 focus:ring-[#FF2028]/30 rounded-2xl"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {bestsellers.map((product) => {
              const isWishlisted = wishlist.includes(product.id);

              return (
                <div
                  key={product.id}
                  className="w-[calc(48%-8px)] sm:w-[calc(33.33%-12px)] lg:w-[calc(20%-13px)] min-w-[140px] sm:min-w-[170px] max-w-[220px] flex-shrink-0 snap-start"
                >
                  <CircleImageBox
                    product={product}
                    badgeText="TOP SELLER"
                    isWishlisted={isWishlisted}
                    onToggleWishlist={() => onToggleWishlist(product.id)}
                    onOpenProductDetail={() => onOpenProductDetail(product)}
                    onOpenPopoutZoom={onOpenPopoutZoom}
                    onQuickAdd={(size) => onAddToCart(product, size, product.colors[0]?.name || 'Obsidian')}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
