import React from 'react';
import { Eye, Trash2, ShoppingBag, ArrowRight, X } from 'lucide-react';
import { Product } from '../types';
import { WishlistHeartIcon } from './WishlistHeartIcon';
import { ShimmerImage, RecentlyViewedSkeleton } from './StorefrontSkeletons';

interface RecentlyViewedSectionProps {
  recentlyViewedIds: string[];
  allProducts: Product[];
  isLoading?: boolean;
  wishlist?: string[];
  onSelectProduct: (product: Product) => void;
  onToggleWishlist?: (product: Product) => void;
  onAddToCart?: (product: Product, size: string, color: string) => void;
  onRemoveFromRecent?: (productId: string) => void;
  onClearAllRecent?: () => void;
  title?: string;
  subtitle?: string;
  className?: string;
}

export const RecentlyViewedSection: React.FC<RecentlyViewedSectionProps> = ({
  recentlyViewedIds,
  allProducts,
  isLoading = false,
  wishlist = [],
  onSelectProduct,
  onToggleWishlist,
  onAddToCart,
  onRemoveFromRecent,
  onClearAllRecent,
  title = 'RECENTLY VIEWED',
  subtitle = 'Pick up where you left off in your oversized streetwear journey',
  className = '',
}) => {
  if (!recentlyViewedIds || recentlyViewedIds.length === 0) {
    return null;
  }

  if (isLoading && allProducts.length === 0) {
    return <RecentlyViewedSkeleton count={Math.min(6, recentlyViewedIds.length)} className={className} />;
  }

  // Map IDs to actual products preserving reverse chronological order
  const recentProducts = recentlyViewedIds
    .map((id) => allProducts.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));

  if (recentProducts.length === 0) {
    return null;
  }

  return (
    <section className={`py-12 bg-neutral-950 border-t border-neutral-900 skeleton-reveal ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-400 font-mono mb-2">
              <Eye className="w-3.5 h-3.5 text-red-500" />
              <span>BROWSING HISTORY ({recentProducts.length})</span>
            </div>
            <h2 className="font-heading text-xl sm:text-2xl font-bold text-white tracking-tight uppercase">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-lg">
              {subtitle}
            </p>
          </div>

          {onClearAllRecent && (
            <button
              onClick={onClearAllRecent}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-red-400 transition cursor-pointer self-start sm:self-auto py-1 px-2.5 rounded-lg border border-neutral-800 hover:border-red-900/60 bg-neutral-900/60"
              title="Clear all recently viewed items"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {/* Product Carousel / Horizontal Scrolling Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {recentProducts.map((product) => {
            const isWishlisted = wishlist.includes(product.id);
            const displayImage = product.images?.[0] || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80';
            const defaultSize = product.variants?.[0]?.size || 'L';
            const defaultColor = product.variants?.[0]?.colorName || 'Black';

            return (
              <div
                key={product.id}
                className="group relative bg-[#121217] rounded-xl border border-neutral-800/80 overflow-hidden flex flex-col transition-all hover:border-neutral-700 hover:shadow-xl hover:shadow-black/50"
              >
                {/* Image & Quick Badges */}
                <div 
                  className="relative aspect-[3/4] bg-neutral-900 overflow-hidden cursor-pointer"
                  onClick={() => onSelectProduct(product)}
                >
                  <ShimmerImage
                    src={displayImage}
                    alt={product.name}
                    theme="dark"
                    wrapperClassName="w-full h-full"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Department & Fit Badge */}
                  <div className="absolute top-2 left-2">
                    <span className="bg-black/75 backdrop-blur-sm text-white text-[9px] font-bold font-mono px-1.5 py-0.5 rounded tracking-wider uppercase border border-neutral-800">
                      {product.department}
                    </span>
                  </div>

                  {/* Remove Item Button */}
                  {onRemoveFromRecent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFromRecent(product.id);
                      }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 hover:bg-red-600 text-neutral-300 hover:text-white flex items-center justify-center transition cursor-pointer opacity-0 group-hover:opacity-100 z-10"
                      title="Remove from history"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Wishlist Floating Button */}
                  {onToggleWishlist && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWishlist(product);
                      }}
                      className={`absolute bottom-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer shadow-md ${
                        isWishlisted
                          ? 'bg-red-600 text-white'
                          : 'bg-black/70 text-neutral-300 hover:text-white hover:bg-neutral-800'
                      }`}
                      aria-label="Wishlist"
                      title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
                    >
                      <WishlistHeartIcon
                        active={isWishlisted}
                        resetKey={product.id}
                        className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`}
                      />
                    </button>
                  )}
                </div>

                {/* Details */}
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3
                      onClick={() => onSelectProduct(product)}
                      className="font-brush text-base sm:text-lg font-normal text-white tracking-wide leading-tight truncate group-hover:text-red-400 transition cursor-pointer"
                      title={product.name}
                    >
                      {product.name}
                    </h3>
                    <p className="text-[10px] text-neutral-400 font-mono truncate mt-0.5">
                      {product.universe || product.world || 'Anime Streetwear'}
                    </p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold font-sans text-white tabular-nums">
                        ₹ {product.price.toLocaleString('en-IN')}
                      </span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="text-[10px] text-neutral-500 line-through ml-1.5 font-sans tabular-nums">
                          ₹{product.originalPrice}
                        </span>
                      )}
                    </div>

                    {onAddToCart ? (
                      <button
                        onClick={() => onAddToCart(product, defaultSize, defaultColor)}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-600 text-neutral-300 hover:text-white transition cursor-pointer"
                        title="Add to Bag"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onSelectProduct(product)}
                        className="p-1 text-neutral-400 hover:text-white transition cursor-pointer"
                        title="View details"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default RecentlyViewedSection;
