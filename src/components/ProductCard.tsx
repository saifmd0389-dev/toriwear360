import React, { useState } from 'react';
import { Product } from '../types';
import { ShoppingBag, Star, Check } from 'lucide-react';
import { TwinningBadgeButton } from './TwinningBadgeButton';
import { CatalogCardImageCarousel } from './CatalogCardImageCarousel';
import { WishlistHeartIcon } from './WishlistHeartIcon';

interface ProductCardProps {
  product: Product;
  isWishlisted: boolean;
  onToggleWishlist: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
  onOpenPopoutZoom?: (product: Product) => void;
  onOpenCombo?: (product: Product) => void;
  onQuickAddToCart: (product: Product, size: 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL') => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isWishlisted,
  onToggleWishlist,
  onSelectProduct,
  onOpenCombo,
  onQuickAddToCart,
}) => {
  const [selectedSize, setSelectedSize] = useState<'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL'>('L');
  const [addedNotice, setAddedNotice] = useState(false);

  const discountPercent = product?.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    onQuickAddToCart(product, selectedSize);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 1800);
  };

  return (
    <div
      id={`product-card-${product.id}`}
      onClick={() => onSelectProduct(product)}
      className="group cursor-pointer rounded-2xl bg-[#121217] border border-neutral-800/80 hover:border-neutral-700 transition-all duration-300 flex flex-col overflow-hidden hover:shadow-2xl hover:shadow-black/70 relative"
    >
      {/* Product Image Micro-Carousel Stage */}
      <CatalogCardImageCarousel
        images={product?.images || []}
        alt={product.name}
        aspectClass="aspect-[4/5]"
        bgClass="bg-neutral-900"
        onCardClick={() => onSelectProduct(product)}
      >
        {/* Subtle Category Badge Top-Left */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
          <span className="bg-black/75 backdrop-blur-md border border-neutral-700/60 text-neutral-300 text-[9px] font-medium font-mono px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
            {product.licenseType === 'Original IP' ? 'ORIGINAL IP' : (product.department || 'TORI')}
          </span>
        </div>

        {/* Clean Wishlist / Remove Button Top-Right */}
        <button
          id={`wishlist-btn-${product.id}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist(product);
          }}
          className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition-all z-20 cursor-pointer shadow-lg active:scale-90 ${
            isWishlisted
              ? 'bg-[#FF2028] text-white hover:bg-red-600'
              : 'bg-black/70 text-neutral-300 hover:text-white hover:bg-black'
          }`}
          aria-label={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
          title={isWishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}
        >
          <WishlistHeartIcon
            active={isWishlisted}
            resetKey={product.id}
            className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`}
          />
        </button>
      </CatalogCardImageCarousel>

      {/* Product Information */}
      <div className="p-3.5 sm:p-4 flex flex-col flex-grow justify-between">
        <div>
          {/* Franchise & Fit */}
          <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 mb-1">
            <span className="text-neutral-300 font-medium uppercase tracking-wider">{product.franchise}</span>
            <span className="text-neutral-400 text-[10px]">
              {product.fit}
            </span>
          </div>

          {/* Product Name */}
          <h3 className="font-sans text-[15px] sm:text-base font-semibold text-white group-hover:text-[#FF2028] transition-colors tracking-tight leading-snug line-clamp-1">
            {product.name}
          </h3>

          {/* Soft Highlight Option: Try Combo Men and Kid Pair with Same Design */}
          {onOpenCombo && (
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              <TwinningBadgeButton
                product={product}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCombo(product);
                }}
                theme="dark"
              />
            </div>
          )}

          {/* Rating */}
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-neutral-400 font-sans">
            <div className="flex items-center text-amber-400">
              <Star className="w-3 h-3 fill-current" />
              <span className="font-semibold text-neutral-200 text-xs ml-1 tabular-nums">{product.rating}</span>
            </div>
            <span className="text-neutral-600">·</span>
            <span className="text-[11px] text-neutral-500 tabular-nums">({product.reviewsCount})</span>
          </div>

          {/* Pricing */}
          <div className="mt-2.5 pt-2.5 border-t border-neutral-800/80 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="font-sans text-base sm:text-lg font-bold text-white tabular-nums">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-neutral-500 line-through tabular-nums font-sans">
                ₹{product.originalPrice.toLocaleString('en-IN')}
              </span>
            </div>

            <span className="text-[11px] font-sans font-semibold text-red-400 tabular-nums">
              {discountPercent}% OFF
            </span>
          </div>
        </div>

        {/* Size Selection & Clean Move to Bag Action */}
        <div className="mt-3 pt-3 border-t border-neutral-800/80" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between text-[10px] font-sans font-medium tracking-[0.05em] text-neutral-400 mb-1.5">
            <span>SIZE:</span>
            <span className="text-white font-semibold">{selectedSize}</span>
          </div>

          <div className="flex items-center gap-1 py-0.5 mb-2.5">
            {(product.department === 'KIDS'
              ? (['4-5Y', '6-7Y', '8-9Y', '10-11Y'] as const)
              : (['S', 'M', 'L', 'XL', 'XXL'] as const)
            ).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setSelectedSize(sz as any)}
                className={`flex-1 py-1 rounded text-[11px] font-sans font-semibold transition cursor-pointer text-center ${
                  selectedSize === sz
                    ? 'bg-[#FF2028] text-white shadow-sm'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>

          <button
            id={`quick-add-btn-${product.id}`}
            type="button"
            onClick={handleQuickAdd}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold font-sans uppercase tracking-[0.06em] transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 ${
              addedNotice
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-black hover:bg-neutral-200'
            }`}
          >
            {addedNotice ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>ADDED TO BAG</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>MOVE TO BAG</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

