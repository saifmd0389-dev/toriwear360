import React, { useState, useEffect } from 'react';
import { CartItem } from '../types';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck, Truck, RotateCcw, Tag } from 'lucide-react';
import { OfficialToriwearLogo } from './OfficialToriwearLogo';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (index: number, newQty: number) => void;
  onRemoveItem: (index: number) => void;
  appliedCoupon: string | null;
  onApplyCoupon: (code: string) => boolean;
  onRemoveCoupon: () => void;
  onProceedToCheckout: () => void;
  onContinueShopping: () => void;
  freeShippingThreshold?: number;
  standardShippingFee?: number;
  discount?: number;
  appliedCouponDetail?: any;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  onProceedToCheckout,
  onContinueShopping,
  freeShippingThreshold = 999,
  standardShippingFee = 79,
  discount: propsDiscount,
  appliedCouponDetail,
}) => {
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);

  // Keyboard shortcut (Escape) to close drawer - must be before any return to respect React Rules of Hooks
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

  // Lock background body scrolling while cart drawer is open to prevent header jumping
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Safe early return after all hooks
  if (!isOpen) return null;

  const FREE_SHIPPING_THRESHOLD = freeShippingThreshold;
  const STANDARD_SHIPPING_FEE = standardShippingFee;

  // Defensive array handling
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  const subtotal = safeItems.reduce((sum, item) => {
    const price = typeof item?.product?.price === 'number'
      ? item.product.price
      : typeof (item as any)?.price === 'number'
        ? (item as any).price
        : 0;
    const qty = typeof item?.quantity === 'number' && !isNaN(item.quantity) && item.quantity > 0
      ? item.quantity
      : 1;
    return sum + price * qty;
  }, 0);

  const totalQuantity = safeItems.reduce(
    (s, i) => s + (typeof i?.quantity === 'number' && !isNaN(i.quantity) && i.quantity > 0 ? i.quantity : 1),
    0
  );

  let discount = propsDiscount !== undefined ? propsDiscount : 0;
  if (propsDiscount === undefined) {
    if (appliedCouponDetail) {
      if (appliedCouponDetail.discountType === 'PERCENTAGE') {
        discount = Math.round(subtotal * (appliedCouponDetail.value / 100));
        if (appliedCouponDetail.maxDiscount) discount = Math.min(discount, appliedCouponDetail.maxDiscount);
      } else {
        discount = Math.min(appliedCouponDetail.value || 0, subtotal);
      }
    } else if (appliedCoupon === 'TORI100' || appliedCoupon === 'ANIME100') {
      discount = Math.min(100, subtotal);
    } else if (appliedCoupon === 'TORI10' || appliedCoupon === 'TWIN10' || appliedCoupon === 'ANIME10') {
      discount = Math.round(subtotal * 0.1);
    } else if (appliedCoupon === 'DROP2026') {
      discount = Math.round(subtotal * 0.15);
    } else if (appliedCoupon) {
      try {
        const stored = localStorage.getItem('tori_admin_coupons');
        if (stored) {
          const parsed = JSON.parse(stored);
          const match = parsed.find((c: any) => c.code?.toUpperCase() === appliedCoupon);
          if (match) {
            if (match.discountType === 'PERCENTAGE') {
              discount = Math.round(subtotal * (match.value / 100));
              if (match.maxDiscount) discount = Math.min(discount, match.maxDiscount);
            } else {
              discount = Math.min(match.value || 0, subtotal);
            }
          }
        }
      } catch {}
    }
  }

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : STANDARD_SHIPPING_FEE;
  const total = Math.max(0, subtotal - discount + shipping);

  const amountNeededForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const freeShippingProgress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const success = onApplyCoupon(code);
    if (success) {
      setCouponInput('');
    } else {
      setCouponError('Invalid promo code. Try "TORI100" or "TORI10"');
    }
  };

  return (
    <div 
      style={{ zIndex: 9999, isolation: 'isolate', transform: 'translateZ(0)' }}
      className="fixed inset-0 z-[9999] flex justify-end bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        id="cart-drawer"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#0f0f15] border-l border-neutral-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 relative z-10"
      >
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-[#14141c] shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-3">
            <OfficialToriwearLogo className="h-5 sm:h-6 w-auto max-w-[85px] sm:max-w-[110px] object-contain" suppressWarning={true} />
            <span className="text-neutral-600">|</span>
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-neutral-300">
              <ShoppingBag className="w-3.5 h-3.5 text-red-500" />
              <span>BAG ({totalQuantity})</span>
            </div>
          </div>

          <button
            id="close-cart-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="relative z-40 pointer-events-auto min-h-[40px] min-w-[40px] px-3 py-2 text-neutral-200 hover:text-white bg-neutral-800 hover:bg-neutral-700 active:scale-95 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 text-xs font-mono font-bold shadow-md"
            aria-label="Close Cart"
            title="Close Bag (Esc)"
          >
            <span>CLOSE</span>
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Free Shipping Progress Meter */}
        <div className="p-3 bg-neutral-900/90 border-b border-neutral-800 text-xs">
          <div className="flex justify-between items-center text-neutral-300 font-mono mb-1.5">
            <span>
              {amountNeededForFreeShipping === 0 ? (
                <strong className="text-emerald-400 flex items-center gap-1">
                  🎉 You unlocked FREE Pan-India Shipping!
                </strong>
              ) : (
                <span>Add <strong>₹{amountNeededForFreeShipping}</strong> more for <strong>FREE Shipping</strong></span>
              )}
            </span>
            <span className="text-neutral-500 font-bold">{freeShippingProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                freeShippingProgress >= 100 ? 'bg-emerald-500' : 'bg-[#FF2028]'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, freeShippingProgress || 0))}%` }}
            />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-neutral-800/60">
          {safeItems.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <div className="font-heading text-xl text-white">YOUR BAG IS EMPTY</div>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                  Looks like you haven't picked your anime fit yet. Explore our 40 heavyweight designs!
                </p>
              </div>
              <button
                onClick={() => { onClose(); onContinueShopping(); }}
                className="px-6 py-2.5 bg-[#FF2028] hover:bg-[#e02441] text-white text-xs font-mono font-bold uppercase rounded-xl transition cursor-pointer"
              >
                EXPLORE CATALOGUE
              </button>
            </div>
          ) : (
            safeItems.map((item, idx) => {
              const product = item?.product || (item as any);
              const productId = product?.id || `cart-item-${idx}`;
              const productName = product?.name || 'Toriwear Apparel';
              const price = typeof product?.price === 'number' ? product.price : 0;
              const originalPrice = typeof product?.originalPrice === 'number' ? product.originalPrice : price;
              const quantity = typeof item?.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
              const size = item?.size || 'M';
              const color = item?.color || 'Black';
              const images = Array.isArray(product?.images) && product.images.length > 0 
                ? product.images 
                : ['/assets/branding/toriwear-official-logo.png'];
              const gsm = product?.gsm || 240;
              const fit = product?.fit || 'Oversized';

              return (
                <div key={`${productId}-${size}-${color}-${idx}`} className="pt-3 flex gap-3">
                  {/* Product Thumbnail */}
                  <div className="w-20 h-24 rounded-xl overflow-hidden bg-neutral-900 flex-shrink-0 border border-neutral-800">
                    <img
                      src={images[0]}
                      alt={productName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/assets/branding/toriwear-official-logo.png';
                      }}
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <h4 className="font-heading text-base font-bold text-white leading-tight">
                          {productName}
                        </h4>
                        <button
                          onClick={() => onRemoveItem(idx)}
                          className="text-neutral-500 hover:text-[#FF2028] p-1 transition cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-xs text-neutral-400 font-mono mt-0.5">
                        <span>Size: <strong className="text-white">{size}</strong></span>
                        <span className="mx-1.5">•</span>
                        <span>{color}</span>
                      </div>

                      <div className="text-[11px] text-neutral-500 font-mono">
                        {gsm} GSM • {fit}
                      </div>
                    </div>

                    {/* Quantity & Price */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-neutral-800 bg-neutral-900 rounded-lg overflow-hidden">
                        <button
                          onClick={() => onUpdateQuantity(idx, quantity - 1)}
                          className="px-2 py-1 text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-3 py-1 text-xs font-mono font-bold text-white">
                          {quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(idx, quantity + 1)}
                          className="px-2 py-1 text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right font-mono">
                        <div className="font-bold text-white text-sm">
                          ₹{(price * quantity).toLocaleString('en-IN')}
                        </div>
                        {originalPrice > price && (
                          <div className="text-[10px] text-neutral-500 line-through">
                            ₹{(originalPrice * quantity).toLocaleString('en-IN')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Summary from Blueprint Section 13 */}
        {safeItems.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-neutral-800 bg-[#12121a] space-y-4">
            {/* Promo Code Input */}
            <div>
              {appliedCoupon ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/40 border border-emerald-900/60 text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Tag className="w-3.5 h-3.5" />
                    <span>COUPON {appliedCoupon} APPLIED</span>
                  </div>
                  <button
                    onClick={onRemoveCoupon}
                    className="text-xs text-neutral-400 hover:text-white underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Discount code (e.g. ANIME100)"
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF2028] font-mono uppercase"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-mono font-bold rounded-lg transition uppercase cursor-pointer"
                  >
                    Apply
                  </button>
                </form>
              )}
              {couponError && (
                <div className="text-[11px] text-[#FF2028] font-mono mt-1">{couponError}</div>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1.5 text-xs font-mono text-neutral-400">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-white">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Discount</span>
                  <span>-₹{discount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>
                  {shipping === 0 ? (
                    <strong className="text-emerald-400">FREE</strong>
                  ) : (
                    `₹${shipping}`
                  )}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-neutral-800">
                <span>TOTAL</span>
                <span className="text-[#FF2028] text-lg font-heading tracking-wide">
                  ₹{total.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Blueprint Section 13 CTA: CHECKOUT */}
            <button
              id="cart-checkout-btn"
              onClick={onProceedToCheckout}
              className="w-full py-4 bg-[#FF2028] hover:bg-[#e02441] text-white font-heading text-lg font-bold tracking-wider uppercase rounded-xl transition shadow-xl shadow-[#FF2028]/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <span>CHECKOUT</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            {/* Blueprint Section 13 Trust Points */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] text-neutral-400 font-mono text-center">
              <div className="flex flex-col items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Secure Payments</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-blue-400" />
                <span>Pan-India Delivery</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Easy Exchange</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
