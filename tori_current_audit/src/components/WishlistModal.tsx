import React, { useEffect, useMemo, useState } from 'react';
import { Product } from '../types';
import { Heart, X, ArrowRight, Eye, Trash2 } from 'lucide-react';
import { OfficialToriwearLogo } from './OfficialToriwearLogo';
import { ProductCard } from './ProductCard';

interface WishlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  wishlistIds: string[];
  allProducts: Product[];
  recentlyViewedIds?: string[];
  onToggleWishlist: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product, size: 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL') => void;
  onContinueShopping: () => void;
  onClearRecent?: () => void;
  initialTab?: 'wishlist' | 'recent';
}

export const WishlistModal: React.FC<WishlistModalProps> = ({
  isOpen,
  onClose,
  wishlistIds,
  allProducts,
  recentlyViewedIds = [],
  onToggleWishlist,
  onSelectProduct,
  onAddToCart,
  onContinueShopping,
  onClearRecent,
  initialTab = 'wishlist',
}) => {
  const [activeTab, setActiveTab] = useState<'wishlist' | 'recent'>('wishlist');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background page scrolling when wishlist modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const wishlistedProducts = useMemo(() => {
    return (allProducts || []).filter((product) => wishlistIds.includes(product.id));
  }, [allProducts, wishlistIds]);

  const recentlyViewedProducts = useMemo(() => {
    return recentlyViewedIds
      .map((id) => (allProducts || []).find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p));
  }, [allProducts, recentlyViewedIds]);

  if (!isOpen) return null;

  return (
    <div 
      style={{ zIndex: 9999 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        id="wishlist-modal"
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0f0f15] border border-neutral-800 w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl my-auto animate-in zoom-in-95 max-h-[92vh] flex flex-col relative z-10"
      >
        {/* Header with Navigation Tabs */}
        <div className="px-5 py-4 border-b border-neutral-800 bg-[#14141d] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <OfficialToriwearLogo className="h-7 w-auto max-w-[120px] object-contain" />
            <span className="text-neutral-700 hidden sm:inline">|</span>
            
            {/* Tabs Pill Switcher */}
            <div className="flex items-center gap-1 bg-neutral-900/90 p-1 rounded-xl border border-neutral-800">
              <button
                type="button"
                onClick={() => setActiveTab('wishlist')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'wishlist'
                    ? 'bg-[#FF2028] text-white shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Heart className="w-3.5 h-3.5 fill-current" />
                <span>WISHLIST ({wishlistedProducts.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('recent')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'recent'
                    ? 'bg-neutral-800 text-white shadow-md border border-neutral-700'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-neutral-300" />
                <span>RECENTLY VIEWED ({recentlyViewedProducts.length})</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'recent' && recentlyViewedProducts.length > 0 && onClearRecent && (
              <button
                type="button"
                onClick={onClearRecent}
                className="text-[11px] font-mono text-neutral-400 hover:text-red-400 flex items-center gap-1 py-1.5 px-2.5 rounded-lg border border-neutral-800 hover:border-red-900/60 bg-neutral-900/60 cursor-pointer transition"
                title="Clear browsing history"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear History</span>
              </button>
            )}

            <button
              id="close-wishlist-modal-btn"
              onClick={onClose}
              className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
              aria-label="Close"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-4 sm:p-6 flex-1">
          {activeTab === 'wishlist' ? (
            /* TAB 1: WISHLIST */
            wishlistedProducts.length === 0 ? (
              <div className="py-14 sm:py-20 flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 rounded-full bg-red-950/30 border border-red-500/20 flex items-center justify-center mb-4">
                  <Heart className="w-8 h-8 text-[#FF2028]" />
                </div>
                <h3 className="font-heading text-xl sm:text-2xl font-bold text-white tracking-wide mb-2">
                  Your Wishlist is empty
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 max-w-md font-sans mb-6">
                  Explore our original anime streetwear collections and save your favorite pieces to your wishlist for later drops.
                </p>
                <button
                  id="wishlist-continue-shopping-btn"
                  type="button"
                  onClick={onContinueShopping}
                  className="py-3 px-6 bg-[#FF2028] hover:bg-[#e02642] text-white font-mono text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-2 shadow-lg active:scale-95"
                >
                  <span>Continue Shopping</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 sm:grid sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
                {wishlistedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex-1 basis-[calc(50%-6px)] min-w-[140px] sm:flex-initial sm:min-w-0 flex flex-col"
                  >
                    <ProductCard
                      product={product}
                      isWishlisted={true}
                      onToggleWishlist={onToggleWishlist}
                      onSelectProduct={(p) => {
                        onClose();
                        onSelectProduct(p);
                      }}
                      onQuickAddToCart={onAddToCart}
                    />
                  </div>
                ))}
              </div>
            )
          ) : (
            /* TAB 2: RECENTLY VIEWED */
            recentlyViewedProducts.length === 0 ? (
              <div className="py-14 sm:py-20 flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4">
                  <Eye className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="font-heading text-xl sm:text-2xl font-bold text-white tracking-wide mb-2">
                  No recently viewed pieces
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 max-w-md font-sans mb-6">
                  Items you browse while shopping will appear here for fast re-discovery and quick bag additions.
                </p>
                <button
                  type="button"
                  onClick={onContinueShopping}
                  className="py-3 px-6 bg-neutral-800 hover:bg-neutral-700 text-white font-mono text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-2 shadow-lg active:scale-95"
                >
                  <span>Browse Latest Drops</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 sm:grid sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
                {recentlyViewedProducts.map((product) => {
                  const isWishlisted = wishlistIds.includes(product.id);
                  return (
                    <div
                      key={product.id}
                      className="flex-1 basis-[calc(50%-6px)] min-w-[140px] sm:flex-initial sm:min-w-0 flex flex-col"
                    >
                      <ProductCard
                        product={product}
                        isWishlisted={isWishlisted}
                        onToggleWishlist={onToggleWishlist}
                        onSelectProduct={(p) => {
                          onClose();
                          onSelectProduct(p);
                        }}
                        onQuickAddToCart={onAddToCart}
                      />
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Footer (When items exist) */}
        <div className="px-5 py-3.5 border-t border-neutral-800 bg-[#14141d] flex items-center justify-between text-xs font-mono">
          <span className="text-neutral-400">
            {activeTab === 'wishlist'
              ? `${wishlistedProducts.length} saved ${wishlistedProducts.length === 1 ? 'item' : 'items'} in your wishlist`
              : `${recentlyViewedProducts.length} recently browsed ${recentlyViewedProducts.length === 1 ? 'item' : 'items'}`}
          </span>
          <button
            onClick={onContinueShopping}
            className="text-[#FF2028] hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>Explore More Drops</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WishlistModal;
