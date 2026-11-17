import React, { useState, useRef } from 'react';
import { Maximize2 } from 'lucide-react';
import { Product } from '../types';
import { TwinningBadgeButton } from './TwinningBadgeButton';
import { WishlistHeartIcon } from './WishlistHeartIcon';
import { ShimmerImage } from './StorefrontSkeletons';

interface CircleImageBoxProps {
  product: Product;
  badgeText?: string;
  isWishlisted: boolean;
  theme?: 'dark' | 'light';
  onToggleWishlist: () => void;
  onOpenProductDetail: () => void;
  onOpenPopoutZoom?: (product: Product) => void;
  onOpenCombo?: (product: Product) => void;
  onQuickAdd?: (size: string) => void;
}

export const CircleImageBox: React.FC<CircleImageBoxProps> = ({
  product,
  badgeText,
  isWishlisted,
  theme = 'dark',
  onToggleWishlist,
  onOpenProductDetail,
  onOpenPopoutZoom,
  onOpenCombo,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Smooth cursor tracking for clear enlarged product view
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setCursorPos({ x, y });
  };

  const handleTriggerPopout = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenPopoutZoom) {
      onOpenPopoutZoom(product);
    } else {
      onOpenProductDetail();
    }
  };

  const isLight = theme === 'light';

  return (
    <div
      className="group relative flex flex-col items-center text-center cursor-pointer select-none transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setCursorPos({ x: 50, y: 50 });
      }}
      onClick={handleTriggerPopout}
    >
      {/* Circular Product Image Container with Interactive Pop-Out Trigger */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className={`relative w-full aspect-square max-w-[220px] mx-auto rounded-full p-1.5 transition-all duration-300 shadow-xl group-hover:shadow-2xl ${
          isLight
            ? 'bg-gradient-to-b from-white via-sky-50 to-sky-100 border-2 border-sky-200 group-hover:border-sky-400 group-hover:shadow-sky-200/50'
            : 'bg-gradient-to-b from-neutral-800/80 via-neutral-900/60 to-black/90 border border-neutral-800/90 group-hover:border-neutral-500/80 group-hover:shadow-white/10'
        }`}
      >
        {/* Inner Circle Clipping Container */}
        <div className={`relative w-full h-full rounded-full overflow-hidden ${isLight ? 'bg-white' : 'bg-[#111115]'}`}>
          {/* Primary Product Image with Cursor-Centered Interactive Enlargement */}
          <ShimmerImage
            src={product.images[0]}
            alt={product.name}
            theme={isLight ? 'sky' : 'dark'}
            wrapperClassName="w-full h-full"
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            style={{
              transform: isHovered ? 'scale(1.85)' : 'scale(1)',
              transformOrigin: `${cursorPos.x}% ${cursorPos.y}%`,
              transition: isHovered ? 'transform 0.12s ease-out' : 'transform 0.4s ease-out',
            }}
            className="w-full h-full object-cover object-top will-change-transform pointer-events-none"
          />

          {/* Secondary Hover Image crossfade if available and not zoomed */}
          {!isHovered && product.images[1] && (
            <img
              src={product.images[1]}
              alt={`${product.name} alternate view`}
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover object-top opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            />
          )}

          {/* Interactive Zoom Indicator Lens on Hover */}
          {isHovered && (
            <div
              className="absolute w-12 h-12 rounded-full border border-white/60 bg-white/10 backdrop-blur-[1px] pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-opacity duration-150 flex items-center justify-center shadow-lg"
              style={{
                left: `${cursorPos.x}%`,
                top: `${cursorPos.y}%`,
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white/90" />
            </div>
          )}

          {/* Subtle luxury vignette inside circle */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/30 via-transparent to-black/10 pointer-events-none" />

          {/* Pop-Out Action Overlay on Hover: Pops Out of Circle to 70% Screen */}
          <div
            className={`absolute inset-0 bg-black/50 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 transition-all duration-200 pointer-events-auto ${
              isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <button
              onClick={handleTriggerPopout}
              className="px-3 py-1.5 rounded-full bg-[#FF2028] hover:bg-[#e02642] text-white text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xl transition active:scale-95 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>70% ZOOM</span>
            </button>
            <span className="mt-1 text-[8px] font-mono text-neutral-300 uppercase tracking-widest font-semibold">
              TAP TO ENLARGE
            </span>
          </div>
        </div>

        {/* Wishlist Button floating on Circle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist();
          }}
          className={`absolute top-1 right-1 p-2 rounded-full backdrop-blur-md transition-all z-20 cursor-pointer shadow-md ${
            isWishlisted
              ? 'bg-[#FF2028] text-white shadow-[#FF2028]/30 scale-105'
              : isLight
              ? 'bg-white/90 text-neutral-600 hover:text-red-500 hover:bg-white border border-sky-100 hover:scale-105'
              : 'bg-black/70 text-neutral-300 hover:text-white hover:bg-black border border-neutral-700/80 hover:scale-105'
          }`}
          aria-label="Wishlist"
          title="Wishlist"
        >
          <WishlistHeartIcon
            active={isWishlisted}
            resetKey={product.id}
            className={`w-3 h-3 ${isWishlisted ? 'fill-current text-white' : ''}`}
          />
        </button>

        {/* Small GSM / Drop Badge floating on top-left of Circle */}
        {(badgeText || product.gsm) && (
          <div className="absolute top-1 left-1 z-20 pointer-events-none">
            <span
              className={`text-[8px] sm:text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider shadow ${
                isLight
                  ? 'bg-sky-600 text-white font-bold'
                  : 'bg-black/85 text-neutral-300 border border-neutral-700 backdrop-blur-md'
              }`}
            >
              {badgeText || `${product.gsm} GSM`}
            </span>
          </div>
        )}
      </div>

      {/* Product Details Underneath Circle */}
      <div className="mt-3 w-full px-1 flex flex-col items-center">
        {/* World / Category Tag */}
        <span
          className={`text-[10px] font-mono font-semibold uppercase tracking-widest truncate max-w-full ${
            isLight ? 'text-sky-700' : 'text-neutral-400'
          }`}
        >
          {product.world}
        </span>

        {/* Product Title */}
        <h3
          className={`mt-1 font-heading text-xs sm:text-sm font-bold uppercase tracking-tight line-clamp-1 transition ${
            isLight
              ? 'text-neutral-900 group-hover:text-sky-600'
              : 'text-white group-hover:text-neutral-200'
          }`}
        >
          {product.name}
        </h3>

        {/* Pricing */}
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className={`text-xs sm:text-sm font-bold font-mono ${isLight ? 'text-neutral-950' : 'text-white'}`}>
            ₹{product.price}
          </span>
          <span className="text-[10px] sm:text-xs text-neutral-500 line-through font-mono">
            ₹{product.originalPrice}
          </span>
        </div>

        {/* Soft Highlight Twinning Combo Option */}
        {onOpenCombo && (
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <TwinningBadgeButton
              product={product}
              onClick={(e) => {
                e.stopPropagation();
                onOpenCombo(product);
              }}
              theme={theme}
            />
          </div>
        )}
      </div>
    </div>
  );
};
