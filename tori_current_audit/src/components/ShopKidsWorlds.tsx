import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Smile, ChevronLeft, ChevronRight, Sparkles, ArrowRight, Scale } from 'lucide-react';
import { Product, KidsWorldCategory } from '../types';
import { KIDS_WORLDS, KIDS_AGE_GROUPS } from '../data/constants';
import {
  isPublishedKidsProduct,
  matchesKidsWorld,
  matchesKidsAge,
} from '../utils/kidsFilters';
import { EmptyDropState } from './EmptyDropState';
import { KidsCartoonWallpaper } from './KidsCartoonWallpaper';
import { CircleImageBox } from './CircleImageBox';
import { TwinningBadgeButton } from './TwinningBadgeButton';
import { CatalogCardImageCarousel } from './CatalogCardImageCarousel';
import { WishlistHeartIcon } from './WishlistHeartIcon';
import { CircleCarouselSkeleton, CatalogGridSkeleton } from './StorefrontSkeletons';

interface ShopKidsWorldsProps {
  products: Product[];
  isLoading?: boolean;
  wishlist: string[];
  selectedWorld?: KidsWorldCategory | 'ALL';
  onSelectWorld?: (world: KidsWorldCategory | 'ALL') => void;
  onToggleWishlist: (productId: string) => void;
  onOpenProductDetail: (product: Product) => void;
  onOpenPopoutZoom?: (product: Product) => void;
  onOpenCombo?: (product: Product) => void;
  onOpenCompare?: (product: Product) => void;
  onAddToCart: (product: Product, size: string, color: string) => void;
}

export const ShopKidsWorlds: React.FC<ShopKidsWorldsProps> = ({
  products,
  isLoading = false,
  wishlist,
  selectedWorld: externalSelectedWorld,
  onSelectWorld,
  onToggleWishlist,
  onOpenProductDetail,
  onOpenPopoutZoom,
  onOpenCombo,
  onOpenCompare,
  onAddToCart,
}) => {
  // Support both controlled and uncontrolled selectedWorld state
  const isControlled = externalSelectedWorld !== undefined;
  const [internalWorld, setInternalWorld] = useState<KidsWorldCategory | 'ALL'>('ALL');
  const activeWorld = isControlled ? externalSelectedWorld : internalWorld;

  const handleWorldChange = (w: KidsWorldCategory | 'ALL') => {
    if (!isControlled) {
      setInternalWorld(w);
    }
    onSelectWorld?.(w);
  };

  const [selectedAge, setSelectedAge] = useState<string>('ALL');

  // Single source of truth for valid, published Kids products
  const publishedKidsProducts = useMemo(() => {
    return (products || []).filter(isPublishedKidsProduct);
  }, [products]);

  // World counts using the exact same published-product filtering rule
  const worldCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: publishedKidsProducts.length,
    };
    KIDS_WORLDS.forEach((world) => {
      counts[world.id] = publishedKidsProducts.filter((p) =>
        matchesKidsWorld(p, world.id as KidsWorldCategory)
      ).length;
    });
    return counts;
  }, [publishedKidsProducts]);

  // Filtered products matching active world and selected age group
  const filteredProducts = useMemo(() => {
    return publishedKidsProducts.filter((p) => {
      return matchesKidsWorld(p, activeWorld) && matchesKidsAge(p, selectedAge);
    });
  }, [publishedKidsProducts, activeWorld, selectedAge]);

  // Active world metadata from KIDS_WORLDS (only show banner when a specific world is selected)
  const activeWorldMeta = useMemo(() => {
    if (activeWorld === 'ALL') return undefined;
    return KIDS_WORLDS.find((w) => w.id === activeWorld);
  }, [activeWorld]);

  // Carousel controls for Kids Horizontal Scroll Swipe
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
  }, [publishedKidsProducts.length]);

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

  const handleResetFilters = () => {
    handleWorldChange('ALL');
    setSelectedAge('ALL');
  };

  return (
    <section 
      id="shop-kids-section" 
      className="py-20 sm:py-24 bg-white border-b border-sky-100 text-neutral-900 relative select-none overflow-hidden"
    >
      {/* 100% Original Cartoon Wallpaper Background Pattern */}
      <KidsCartoonWallpaper />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 border border-sky-200 text-[11px] font-mono tracking-[0.2em] text-sky-800 uppercase mb-2 font-bold shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>KIDS’ STORYWEAR · AGES 2 TO 13</span>
            </div>
            <h2 className="font-heading text-3xl sm:text-5xl lg:text-6xl font-black text-neutral-950 uppercase tracking-tight">
              LITTLE WORLDS. BIG IMAGINATION.
            </h2>
            <div className="mt-1 text-xs sm:text-sm font-bold text-sky-900 tracking-wider uppercase font-mono">
              CREATIVE APPAREL FOR YOUNG EXPLORERS & HEROES.
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-600 font-mono">
              <span>Ultra-soft breathable cotton</span>
              <span className="text-sky-400">·</span>
              <span>Child-safe prints</span>
              <span className="text-sky-400">·</span>
              <span>Original character stories</span>
            </div>
          </div>

          {/* Action & Age Group Filter Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-full text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer shadow-md shadow-sky-600/20"
            >
              SHOW ALL KIDS
            </button>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedAge('ALL')}
                aria-pressed={selectedAge === 'ALL'}
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition cursor-pointer ${
                  selectedAge === 'ALL'
                    ? 'bg-neutral-900 text-white font-bold shadow-sm'
                    : 'bg-white/90 border border-neutral-300 text-neutral-700 hover:border-sky-500'
                }`}
              >
                ALL AGES
              </button>
              {KIDS_AGE_GROUPS.map((age) => (
                <button
                  key={age}
                  type="button"
                  onClick={() => setSelectedAge(age)}
                  aria-pressed={selectedAge === age}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition cursor-pointer whitespace-nowrap ${
                    selectedAge === age
                      ? 'bg-sky-600 text-white font-bold shadow-sm'
                      : 'bg-white/90 border border-neutral-300 text-neutral-700 hover:border-sky-500'
                  }`}
                >
                  {age}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* NEW REQUIREMENT: Horizontal Scroll Swipe Round Shape Carousel in Kids Section */}
        {/* ========================================================================= */}
        <div className="mb-14 p-5 sm:p-7 rounded-3xl bg-white/80 border-2 border-sky-100 shadow-xl backdrop-blur-md">
          {/* Section Sub-Header with Sliding Arrow Controls */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-md">
                <Smile className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-heading text-lg sm:text-2xl font-black text-neutral-950 uppercase tracking-tight flex items-center gap-2">
                  <span>KIDS’ FEATURED DROPS</span>
                  <span className="text-xs font-mono text-sky-600 font-bold px-2 py-0.5 rounded-full bg-sky-100 hidden sm:inline">
                    ROUND CAPSULE · 5 IN FRONT
                  </span>
                </h3>
                <p className="text-xs text-neutral-500 font-mono">
                  Swipe horizontally to browse round character fits with interactive hover zoom.
                </p>
              </div>
            </div>

            {/* Transparent Left/Right Arrow Buttons for Kids Carousel */}
            <div className="flex items-center gap-2">
              <button
                id="kids-carousel-prev-btn"
                onClick={() => slide('left')}
                disabled={!canScrollLeft}
                className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer backdrop-blur-md ${
                  canScrollLeft
                    ? 'bg-white/90 border-sky-200 text-neutral-900 hover:bg-sky-50 hover:border-sky-400 active:scale-95 shadow-md'
                    : 'bg-white/40 border-neutral-200 text-neutral-400 cursor-not-allowed opacity-40'
                }`}
                aria-label="Previous Kids Drops"
                title="Slide Left"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                id="kids-carousel-next-btn"
                onClick={() => slide('right')}
                disabled={!canScrollRight}
                className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all cursor-pointer backdrop-blur-md ${
                  canScrollRight
                    ? 'bg-white/90 border-sky-200 text-neutral-900 hover:bg-sky-50 hover:border-sky-400 active:scale-95 shadow-md'
                    : 'bg-white/40 border-neutral-200 text-neutral-400 cursor-not-allowed opacity-40'
                }`}
                aria-label="Next Kids Drops"
                title="Slide Right"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Kids Horizontal Carousel Track (5 in Front on Desktop, Touch & Swipe Enabled) */}
          <div className="relative group/carousel">
            {canScrollLeft && (
              <button
                onClick={() => slide('left')}
                className="absolute -left-3 sm:-left-4 top-[38%] -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-white/90 hover:bg-white text-neutral-900 border border-sky-200 flex items-center justify-center shadow-xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
                aria-label="Slide Left"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {canScrollRight && (
              <button
                onClick={() => slide('right')}
                className="absolute -right-3 sm:-right-4 top-[38%] -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-white/90 hover:bg-white text-neutral-900 border border-sky-200 flex items-center justify-center shadow-xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
                aria-label="Slide Right"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {isLoading ? (
              <CircleCarouselSkeleton theme="light" count={5} />
            ) : (
              <div
                id="kids-round-carousel-track"
                ref={carouselRef}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                className="flex items-start gap-4 sm:gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory touch-pan-x pb-4 pt-1 no-scrollbar overscroll-x-contain focus:outline-none focus:ring-2 focus:ring-sky-400/40 rounded-2xl skeleton-reveal"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {publishedKidsProducts.map((product) => {
                  const isWishlisted = wishlist.includes(product.id);

                  return (
                    <div
                      key={product.id}
                      className="w-[calc(48%-8px)] sm:w-[calc(33.33%-12px)] lg:w-[calc(20%-13px)] min-w-[140px] sm:min-w-[170px] max-w-[220px] flex-shrink-0 snap-start"
                    >
                      {/* Circle Image Box with Light Mode Theme & Cursor Hover Zoom */}
                      <CircleImageBox
                        product={product}
                        theme="light"
                        badgeText={product.isNewDrop ? 'NEW' : product.isBestseller ? 'POPULAR' : undefined}
                        isWishlisted={isWishlisted}
                        onToggleWishlist={() => onToggleWishlist(product.id)}
                        onOpenProductDetail={() => onOpenProductDetail(product)}
                        onOpenPopoutZoom={onOpenPopoutZoom}
                        onQuickAdd={(size) => onAddToCart(product, size, product.colors?.[0]?.name || 'Sky Blue')}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 5 Kids Worlds Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-8 no-scrollbar">
          <button
            type="button"
            onClick={() => handleWorldChange('ALL')}
            aria-pressed={activeWorld === 'ALL'}
            className={`px-4 py-2 rounded-full text-xs font-mono font-semibold uppercase whitespace-nowrap transition cursor-pointer border ${
              activeWorld === 'ALL'
                ? 'bg-sky-600 text-white border-sky-600 shadow-md'
                : 'bg-white text-neutral-700 border-neutral-300 hover:border-sky-400'
            }`}
          >
            ALL KIDS’ WORLDS ({worldCounts.ALL ?? 0})
          </button>

          {KIDS_WORLDS.map((world) => {
            const count = worldCounts[world.id] ?? 0;
            const isSelected = activeWorld === world.id;

            return (
              <button
                key={world.id}
                type="button"
                onClick={() => handleWorldChange(world.id as KidsWorldCategory)}
                aria-pressed={isSelected}
                className={`px-4 py-2 rounded-full text-xs font-mono font-medium uppercase whitespace-nowrap transition cursor-pointer border flex items-center gap-2 ${
                  isSelected
                    ? 'bg-neutral-950 text-white border-neutral-950 shadow-md font-bold'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:border-sky-400 hover:text-neutral-950'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: world.accentColor }} />
                <span>{world.name}</span>
                <span className="text-[10px] text-neutral-400 font-normal">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Active Kids World Showcase Banner */}
        {activeWorldMeta && (
          <div className="mb-10 rounded-2xl border-2 border-sky-200 bg-white/95 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm backdrop-blur-md">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <span
                  className="text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${activeWorldMeta.accentColor}15`, color: activeWorldMeta.accentColor }}
                >
                  {activeWorldMeta.badge}
                </span>
                <span className="text-xs font-mono text-neutral-400">/</span>
                <span className="text-xs font-mono text-neutral-500">{activeWorldMeta.japanese}</span>
              </div>
              <h3 className="font-heading text-2xl sm:text-3xl font-black text-neutral-950 uppercase">
                {activeWorldMeta.name} — {activeWorldMeta.subtitle}
              </h3>
              <p className="mt-2 text-sm text-neutral-600 font-sans max-w-2xl leading-relaxed">
                {activeWorldMeta.tagline} {activeWorldMeta.theme}
              </p>
              {activeWorldMeta.bannerQuote && (
                <div className="mt-2 text-xs font-mono italic text-sky-700 font-semibold">
                  "{activeWorldMeta.bannerQuote}"
                </div>
              )}
            </div>

            {activeWorldMeta.visualLanguage && (
              <div className="text-right hidden md:block border-l border-sky-100 pl-6">
                <span className="text-[10px] font-mono uppercase text-sky-600 block font-bold tracking-wider">WORLD AESTHETIC</span>
                <span className="text-xs text-neutral-700 max-w-xs block mt-1 font-medium">
                  {activeWorldMeta.visualLanguage}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Kids Full Catalog Grid */}
        {isLoading ? (
          <CatalogGridSkeleton variant="kids" count={8} />
        ) : filteredProducts.length === 0 ? (
          <EmptyDropState
            title="THE NEXT DROP IS COMING"
            subtitle={activeWorld !== 'ALL' ? `${activeWorld} · PRODUCTION IN PROGRESS` : 'KIDS STORYWEAR CHAPTER 01 IN REVISION'}
            description="Our newest kids apparel designs are currently undergoing safety, softness, and screen-print inspection before release. Only approved pieces are shown."
            theme="light"
            actionLabel="VIEW ALL KIDS WORLDS"
            onAction={handleResetFilters}
            notifyBadgeText="KIDS STORYWEAR"
          />
        ) : (
          <div className="flex flex-wrap gap-3 md:grid md:grid-cols-3 xl:grid-cols-4 md:gap-6 skeleton-reveal">
            {filteredProducts.map((product) => {
              const isWishlisted = wishlist.includes(product.id);

              return (
                <div
                  key={product.id}
                  className="flex-1 basis-[calc(50%-6px)] sm:basis-[calc(33.333%-8px)] min-w-[140px] md:flex-initial md:min-w-0 group bg-white rounded-2xl border border-sky-100 hover:border-sky-300 transition-all duration-300 overflow-hidden flex flex-col shadow-sm hover:shadow-lg"
                >
                  {/* Image Container with Interactive Mini Carousel */}
                  <CatalogCardImageCarousel
                    images={product.images || []}
                    alt={product.name}
                    aspectClass="aspect-square"
                    bgClass="bg-sky-50"
                    onCardClick={() => onOpenProductDetail(product)}
                    counterPositionClass="bottom-2.5 right-2.5"
                  >
                    {/* 70% Screen Zoom Lens Action on Hover */}
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2 pointer-events-none">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenPopoutZoom) onOpenPopoutZoom(product);
                          else onOpenProductDetail(product);
                        }}
                        className="pointer-events-auto px-3 py-1.5 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg transition active:scale-95 cursor-pointer"
                        title="Enlarge product to 70% of screen"
                      >
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>70% ZOOM</span>
                      </button>
                    </div>

                    {/* Wishlist Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWishlist(product.id);
                      }}
                      className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition cursor-pointer shadow-md z-20 ${
                        isWishlisted
                          ? 'bg-[#FF2028] text-white'
                          : 'bg-white/80 text-neutral-600 hover:text-red-500 hover:bg-white'
                      }`}
                      aria-label="Wishlist"
                    >
                      <WishlistHeartIcon
                        active={isWishlisted}
                        resetKey={product.id}
                        className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`}
                      />
                    </button>

                    {/* World Tag */}
                    <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
                      <span className="bg-sky-600/90 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                        {product.world}
                      </span>
                    </div>
                  </CatalogCardImageCarousel>

                  {/* Content */}
                  <div className="p-4 flex flex-col flex-grow justify-between">
                    <div>
                      <h4
                        onClick={() => onOpenProductDetail(product)}
                        className="font-heading text-sm font-black text-neutral-950 uppercase tracking-tight group-hover:text-sky-600 transition cursor-pointer line-clamp-1"
                      >
                        {product.name}
                      </h4>

                      {/* Soft Highlight Option: Try Combo Match with Men's Pair */}
                      {onOpenCombo && (
                        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                          <TwinningBadgeButton
                            product={product}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenCombo(product);
                            }}
                            theme="light"
                          />
                        </div>
                      )}

                      <p className="mt-1 text-xs text-neutral-500 font-sans line-clamp-2">
                        {product.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-sky-50 flex items-center justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-bold font-mono text-neutral-950">
                          ₹{product.price}
                        </span>
                        {product.originalPrice > product.price && (
                          <span className="text-xs font-mono text-neutral-400 line-through">
                            ₹{product.originalPrice}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {onOpenCompare && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenCompare(product);
                            }}
                            title={`Compare ${product.name}`}
                            aria-label={`Compare ${product.name}`}
                            className="p-1.5 border border-sky-200 hover:border-sky-600 bg-white text-neutral-700 hover:text-sky-700 rounded-lg transition cursor-pointer"
                          >
                            <Scale className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => onOpenProductDetail(product)}
                          className="px-3 py-1.5 bg-neutral-950 hover:bg-sky-600 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1 shadow-sm"
                        >
                          <span>VIEW</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
