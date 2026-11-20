import React, { useState } from 'react';
import { ShoppingBag, Eye, Scale } from 'lucide-react';
import { Product, MenWorldCategory, StoreCategory } from '../types';
import { MEN_WORLDS } from '../data/constants';
import { isPublishedProduct } from '../utils/productFilters';
import { EmptyDropState } from './EmptyDropState';
import { TwinningBadgeButton } from './TwinningBadgeButton';
import { CatalogCardImageCarousel } from './CatalogCardImageCarousel';
import { WishlistHeartIcon } from './WishlistHeartIcon';
import { CatalogGridSkeleton } from './StorefrontSkeletons';

interface ShopMenWorldsProps {
  products: Product[];
  isLoading?: boolean;
  wishlist: string[];
  selectedWorld?: MenWorldCategory | 'ALL';
  onSelectWorld?: (world: MenWorldCategory | 'ALL') => void;
  categories?: StoreCategory[];
  selectedCategorySlug?: string | null;
  onSelectCategorySlug?: (slug: string | null) => void;
  onToggleWishlist: (productId: string) => void;
  onOpenProductDetail: (product: Product) => void;
  onOpenPopoutZoom?: (product: Product) => void;
  onOpenCombo?: (product: Product) => void;
  onOpenCompare?: (product: Product) => void;
  onAddToCart: (product: Product, size: string, color: string) => void;
}

export const ShopMenWorlds: React.FC<ShopMenWorldsProps> = ({
  products,
  isLoading = false,
  wishlist,
  selectedWorld: externalSelectedWorld,
  onSelectWorld,
  categories = [],
  selectedCategorySlug: externalCategorySlug,
  onSelectCategorySlug,
  onToggleWishlist,
  onOpenProductDetail,
  onOpenPopoutZoom,
  onOpenCombo,
  onOpenCompare,
  onAddToCart,
}) => {
  const [internalWorld, setInternalWorld] = useState<MenWorldCategory | 'ALL'>('ALL');
  const selectedWorld = externalSelectedWorld !== undefined ? externalSelectedWorld : internalWorld;
  const handleWorldChange = (w: MenWorldCategory | 'ALL') => {
    setInternalWorld(w);
    if (onSelectWorld) onSelectWorld(w);
  };

  const [internalCatSlug, setInternalCatSlug] = useState<string | null>(null);
  const activeCategorySlug = externalCategorySlug !== undefined ? externalCategorySlug : internalCatSlug;
  const handleCategoryChange = (slug: string | null) => {
    setInternalCatSlug(slug);
    if (onSelectCategorySlug) onSelectCategorySlug(slug);
  };

  const [selectedFit, setSelectedFit] = useState<string>('ALL');
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});

  const enabledMenCategories = categories.filter(
    (c) => c.isActive && (c.department === 'MEN' || c.department === 'ALL')
  );
  const activeCategoryObj = activeCategorySlug
    ? enabledMenCategories.find((c) => c.slug === activeCategorySlug) || null
    : null;

  // Active world meta if a specific world is selected
  const activeWorldMeta = MEN_WORLDS.find((w) => w.id === selectedWorld);

  // Filter products: department === 'MEN' and strictly PUBLISHED with valid images
  const filteredProducts = products.filter((p) => {
    if (!isPublishedProduct(p)) return false;
    if (p.department !== 'MEN') return false;
    if (
      selectedWorld !== 'ALL' &&
      p.world?.trim().toUpperCase() !== String(selectedWorld).trim().toUpperCase() &&
      p.franchise?.trim().toUpperCase() !== String(selectedWorld).trim().toUpperCase()
    ) {
      return false;
    }
    if (activeCategoryObj) {
      const ids = Array.isArray(p.categoryIds) ? p.categoryIds : [];
      if (!ids.includes(activeCategoryObj.id)) {
        return false;
      }
    }
    if (selectedFit !== 'ALL' && p.fit !== selectedFit) return false;
    return true;
  });

  const handleSizeSelect = (productId: string, size: string) => {
    setSelectedSizes((prev) => ({ ...prev, [productId]: size }));
  };

  return (
    <section id="shop-men-section" className="py-24 bg-[#f4f2ed] border-b border-neutral-300/80 text-neutral-900 relative select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="text-[11px] font-mono tracking-[0.25em] text-[#FF2028] uppercase mb-2">
              MEN’S STREETWEAR · 240 GSM
            </div>
            <h2 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-black text-neutral-950 uppercase tracking-tight">
              SHOP MEN
            </h2>
            <div className="mt-2 text-sm sm:text-base font-semibold text-neutral-600 tracking-wider uppercase">
              BUILT FOR YOUR WORLD.
            </div>
          </div>

          {/* Action & Fit Filter Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                handleWorldChange('ALL');
                handleCategoryChange(null);
                setSelectedFit('ALL');
              }}
              className="px-4 py-2 bg-neutral-950 text-white rounded-full text-xs font-sans font-semibold uppercase tracking-[0.06em] hover:bg-neutral-800 transition cursor-pointer"
            >
              SHOP ALL MEN
            </button>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {['ALL', 'Oversized', 'Drop Shoulder', 'Heavyweight'].map((fit) => (
                <button
                  key={fit}
                  onClick={() => setSelectedFit(fit)}
                  className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium transition cursor-pointer ${
                    selectedFit === fit
                      ? 'bg-neutral-900 text-white font-semibold shadow-sm'
                      : 'bg-white border border-neutral-300 text-neutral-700 hover:border-neutral-900'
                  }`}
                >
                  {fit}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 5 World Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
          <button
            onClick={() => handleWorldChange('ALL')}
            className={`px-4 py-2 rounded-full text-xs font-heading font-semibold uppercase tracking-[0.05em] whitespace-nowrap transition cursor-pointer border ${
              selectedWorld === 'ALL'
                ? 'bg-neutral-950 text-white border-neutral-950 shadow-md'
                : 'bg-white text-neutral-700 border-neutral-300 hover:border-neutral-600'
            }`}
          >
            ALL WORLDS ({products.filter((p) => p.department === 'MEN').length})
          </button>

          {MEN_WORLDS.map((world) => {
            const count = products.filter((p) => p.department === 'MEN' && p.world === world.id).length;
            const isSelected = selectedWorld === world.id;

            return (
              <button
                key={world.id}
                onClick={() => handleWorldChange(world.id as MenWorldCategory)}
                className={`px-4 py-2 rounded-full text-xs font-heading font-medium uppercase tracking-[0.05em] whitespace-nowrap transition cursor-pointer border flex items-center gap-2 ${
                  isSelected
                    ? 'bg-neutral-950 text-white border-neutral-950 shadow-md font-semibold'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:border-neutral-700 hover:text-neutral-950'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: world.accentColor }} />
                <span>{world.name}</span>
                <span className="text-[11px] font-sans text-neutral-400 font-normal tabular-nums">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Store Categories Filter Pills */}
        {enabledMenCategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-8 no-scrollbar">
            <span className="text-[10px] font-heading uppercase tracking-[0.08em] text-neutral-500 font-semibold shrink-0 mr-1">
              CATEGORIES:
            </span>
            <button
              type="button"
              onClick={() => handleCategoryChange(null)}
              className={`px-3 py-1 rounded-full text-[11px] font-sans font-medium uppercase tracking-[0.04em] whitespace-nowrap transition cursor-pointer border ${
                !activeCategorySlug
                  ? 'bg-[#FF2028] text-white border-[#FF2028] font-semibold'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-neutral-700'
              }`}
            >
              ALL CATEGORIES
            </button>
            {enabledMenCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryChange(activeCategorySlug === cat.slug ? null : cat.slug)}
                className={`px-3 py-1 rounded-full text-[11px] font-sans font-medium uppercase tracking-[0.04em] whitespace-nowrap transition cursor-pointer border ${
                  activeCategorySlug === cat.slug
                    ? 'bg-[#FF2028] text-white border-[#FF2028] font-semibold shadow-sm'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:border-neutral-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Active World Banner Showcase (when a specific world is chosen) */}
        {activeWorldMeta && (
          <div className="mb-12 rounded-xl border border-neutral-300 bg-white p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#FF2028]">
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
              <div className="mt-2 text-xs font-mono italic text-neutral-500">
                "{activeWorldMeta.bannerQuote}"
              </div>
            </div>

            <div className="text-right hidden md:block border-l border-neutral-200 pl-6">
              <span className="text-[10px] font-mono uppercase text-neutral-400 block tracking-wider">VISUAL SIGNATURE</span>
              <span className="text-xs text-neutral-700 max-w-xs block mt-1 font-medium">
                {activeWorldMeta.visualLanguage}
              </span>
            </div>
          </div>
        )}

        {/* Product Grid, Skeleton State, or Empty State */}
        {isLoading ? (
          <CatalogGridSkeleton variant="men" count={8} />
        ) : filteredProducts.length === 0 ? (
          <EmptyDropState
            title="THE NEXT DROP IS COMING"
            subtitle={selectedWorld !== 'ALL' ? `${selectedWorld} · PRODUCTION IN PROGRESS` : 'MEN\'S ARCHIVAL RELEASE IN PROGRESS'}
            description={
              selectedWorld !== 'ALL'
                ? `Currently preparing the next verified apparel drop for ${selectedWorld}. Only administrator-published pieces with approved screen printing are listed.`
                : 'All upcoming oversized tees are currently undergoing fabrication and print verification.'
            }
            theme="light"
            actionLabel={selectedWorld !== 'ALL' ? 'VIEW ALL MEN\'S WORLDS' : undefined}
            onAction={selectedWorld !== 'ALL' ? () => handleWorldChange('ALL') : undefined}
          />
        ) : (
          <div className="flex flex-wrap gap-3 md:grid md:grid-cols-3 xl:grid-cols-4 md:gap-6 skeleton-reveal">
            {filteredProducts.map((product) => {
              const isWishlisted = wishlist.includes(product.id);
              const currentSize = selectedSizes[product.id] || (product.sizes ? product.sizes[0] : 'L');

              return (
                <div
                  key={product.id}
                  className="flex-1 basis-[calc(50%-6px)] sm:basis-[calc(33.333%-8px)] min-w-[140px] md:flex-initial md:min-w-0 group rounded-xl bg-white border border-neutral-200/90 hover:border-neutral-400 hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm"
                >
                  {/* Image Area with Interactive Mini Carousel */}
                  <CatalogCardImageCarousel
                    images={product.images || []}
                    alt={product.name}
                    aspectClass="aspect-[3/4]"
                    bgClass="bg-[#ebe8e1]"
                    onCardClick={() => onOpenProductDetail(product)}
                    counterPositionClass="bottom-10 right-2 sm:bottom-11 sm:right-3"
                  >
                    {/* Authentic Badges Strip (NEW, LIMITED, BESTSELLER, DROP) */}
                    <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex flex-col gap-1 z-10 pointer-events-none">
                      {product.isNewDrop && (
                        <span className="text-[9px] sm:text-[10px] font-mono font-medium bg-neutral-800/80 backdrop-blur-sm text-neutral-300 border border-neutral-700/60 px-1.5 sm:px-2 py-0.5 rounded shadow-sm uppercase">
                          DROP
                        </span>
                      )}
                      {product.isBestseller && !product.isNewDrop && (
                        <span className="text-[9px] sm:text-[10px] font-mono font-bold bg-neutral-900 text-white px-1.5 sm:px-2 py-0.5 rounded shadow-sm uppercase">
                          BESTSELLER
                        </span>
                      )}
                      {product.stock && product.stock <= 5 && (
                        <span className="text-[9px] sm:text-[10px] font-mono font-bold bg-amber-500 text-neutral-950 px-1.5 sm:px-2 py-0.5 rounded shadow-sm uppercase">
                          LIMITED
                        </span>
                      )}
                      <span className="text-[8px] sm:text-[10px] font-mono font-semibold bg-white/90 backdrop-blur-sm text-neutral-800 px-1.5 sm:px-2 py-0.5 rounded shadow-sm">
                        {product.world}
                      </span>
                    </div>

                    {/* Wishlist */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWishlist(product.id);
                      }}
                      className={`absolute top-2 sm:top-3 right-2 sm:right-3 p-1.5 sm:p-2 rounded-full backdrop-blur-md transition z-20 cursor-pointer ${
                        isWishlisted 
                          ? 'bg-[#FF2028] text-white' 
                          : 'bg-white/80 text-neutral-700 hover:text-neutral-950 hover:bg-white'
                      }`}
                      aria-label="Wishlist"
                    >
                      <WishlistHeartIcon
                        active={isWishlisted}
                        resetKey={product.id}
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isWishlisted ? 'fill-current' : ''}`}
                      />
                    </button>

                    <div className="absolute bottom-9 left-2 sm:bottom-10 sm:left-3 z-10 hidden sm:block pointer-events-none">
                      <span className="text-[9px] sm:text-[10px] font-mono text-neutral-800 bg-white/90 backdrop-blur-sm px-1.5 sm:px-2 py-0.5 rounded shadow-sm">
                        240 GSM · {product.fit}
                      </span>
                    </div>

                    {/* 70% Pop-Out Zoom Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenPopoutZoom) onOpenPopoutZoom(product);
                        else onOpenProductDetail(product);
                      }}
                      className="absolute bottom-2.5 right-2 sm:bottom-3 sm:right-3 z-20 px-2 py-1 rounded-full bg-black/80 hover:bg-[#FF2028] text-white text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg backdrop-blur-md opacity-90 sm:opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Enlarge product to 70% of screen"
                    >
                      <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span>70% ZOOM</span>
                    </button>
                  </CatalogCardImageCarousel>

                  {/* Details */}
                  <div className="p-3 sm:p-5 flex flex-col justify-between flex-grow">
                    <div>
                      <div className="flex items-center justify-between text-[10px] sm:text-xs text-neutral-500 font-mono mb-1">
                        <span className="line-clamp-1">{product.catalogNumber}</span>
                        {product.inStock === false || product.stock === 0 ? (
                          <span className="text-[9px] font-mono font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                            OUT OF STOCK
                          </span>
                        ) : product.stock !== undefined && product.stock <= 5 ? (
                          <span className="text-[9px] font-mono font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            ONLY {product.stock} LEFT
                          </span>
                        ) : (
                          <span className="text-neutral-700 font-semibold shrink-0">★ {product.rating}</span>
                        )}
                      </div>

                      <h3 
                        onClick={() => onOpenProductDetail(product)}
                        className="font-sans text-sm sm:text-base font-semibold text-neutral-950 tracking-tight group-hover:text-[#FF2028] transition-colors cursor-pointer line-clamp-1"
                      >
                        {product.name}
                      </h3>

                      {/* Soft Highlight Option: Try Combo Men & Kid Pair */}
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

                      <p className="mt-1 text-[11px] sm:text-xs text-neutral-500 line-clamp-1 font-sans hidden sm:block">
                        {product.storyQuote}
                      </p>
                    </div>

                    {/* Sizing & Add to Cart */}
                    <div className="mt-3 sm:mt-5 pt-2.5 sm:pt-3.5 border-t border-neutral-200">
                      {/* Sizes strip */}
                      {product.sizes && (
                        <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-1.5 sm:mb-2.5 no-scrollbar">
                          {product.sizes.map((sz) => (
                            <button
                              key={sz}
                              onClick={() => handleSizeSelect(product.id, sz)}
                              className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-sans font-medium border transition cursor-pointer ${
                                currentSize === sz 
                                  ? 'bg-neutral-950 text-white border-neutral-950 font-semibold' 
                                  : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:border-neutral-400'
                              }`}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-baseline gap-1 sm:gap-2">
                          <span className="font-sans text-base sm:text-lg font-bold text-neutral-950 tabular-nums">
                            ₹{product.price.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] sm:text-xs text-neutral-400 line-through tabular-nums font-sans">
                            ₹{product.originalPrice.toLocaleString('en-IN')}
                          </span>
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
                              className="p-1.5 sm:p-2 border border-neutral-300 hover:border-neutral-950 bg-white text-neutral-700 hover:text-neutral-950 rounded transition cursor-pointer"
                            >
                              <Scale className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {product.inStock === false || product.stock === 0 ? (
                            <button
                              disabled
                              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-neutral-200 text-neutral-400 rounded text-[10px] sm:text-xs font-bold font-mono tracking-wider cursor-not-allowed shrink-0"
                            >
                              <span>SOLD OUT</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onAddToCart(product, currentSize || 'L', product.colors[0]?.name || 'Obsidian')}
                              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded text-[10px] sm:text-xs font-bold font-mono tracking-wider transition active:scale-95 flex items-center gap-1 cursor-pointer shadow-sm shrink-0"
                            >
                              <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              <span>ADD</span>
                            </button>
                          )}
                        </div>
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
