import React, { useState, useMemo } from 'react';
import { X, Sparkles, ShoppingBag, Check, Heart, Users } from 'lucide-react';
import { Product } from '../types';
import { getTwinProduct, getComboPricing } from '../utils/twinningCombos';

interface TwinningComboModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseProduct: Product | null;
  allProducts: Product[];
  onAddComboToCart: (
    menProduct: Product,
    menSize: string,
    kidsProduct: Product,
    kidsSize: string
  ) => void;
  onOpenProductDetail: (product: Product) => void;
}

export const TwinningComboModal: React.FC<TwinningComboModalProps> = ({
  isOpen,
  onClose,
  baseProduct,
  allProducts,
  onAddComboToCart,
}) => {
  // Resolve which is Men and which is Kids
  const twinProduct = useMemo(() => {
    return baseProduct ? getTwinProduct(baseProduct, allProducts) : null;
  }, [baseProduct, allProducts]);

  const menProduct = baseProduct?.department === 'MEN' ? baseProduct : twinProduct;
  const kidsProduct = baseProduct?.department === 'KIDS' ? baseProduct : twinProduct;

  const defaultMenSize = menProduct?.sizes?.[0] || 'L';
  const defaultKidsSize = kidsProduct?.sizes?.[0] || '6–7Y';

  const [selectedMenSize, setSelectedMenSize] = useState<string>(defaultMenSize);
  const [selectedKidsSize, setSelectedKidsSize] = useState<string>(defaultKidsSize);
  const [addedToast, setAddedToast] = useState(false);

  // Escape key handler
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Body scroll lock
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !baseProduct || !menProduct || !kidsProduct) return null;

  const pricing = getComboPricing(menProduct, kidsProduct);

  const handleAddBoth = () => {
    onAddComboToCart(menProduct, selectedMenSize, kidsProduct, selectedKidsSize);
    setAddedToast(true);
    setTimeout(() => {
      setAddedToast(false);
      onClose();
    }, 1500);
  };

  return (
    <div
      style={{ zIndex: 9999 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in select-none"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[92vh] bg-[#0d0e14] border-2 border-amber-500/40 rounded-3xl overflow-y-auto shadow-[0_0_60px_rgba(245,158,11,0.25)] flex flex-col text-white animate-in zoom-in-95"
      >
        {/* Header Bar */}
        <div className="p-4 sm:p-6 border-b border-neutral-800 bg-gradient-to-r from-[#12131b] via-[#1a1520] to-[#12131b] flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-500 text-neutral-950 text-[10px] font-mono font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  TWINNING CAPSULE
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold hidden sm:inline">
                  SAVE {pricing.discountPercent}% INSTANTLY
                </span>
              </div>
              <h2 className="font-heading text-lg sm:text-2xl font-black text-white uppercase tracking-tight mt-0.5">
                Men & Kid Matching Combo Pair
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Close Twinning Modal"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Narrative Banner */}
        <div className="px-4 sm:px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-200/90 font-mono flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Twin with your child in the <strong>same original Tokyo anime artwork</strong>! Heavyweight 240 GSM for adults + Ultra-soft 180 GSM for kids.
            </span>
          </div>
          <span className="font-bold text-amber-300">
            Combo Code Applied: TWIN10
          </span>
        </div>

        {/* Dual Product Stage */}
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 relative">
          {/* Middle Connection Badge (Desktop) */}
          <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-[#FF2028] text-neutral-950 font-bold text-xs items-center justify-center shadow-xl border-4 border-[#0d0e14]">
            <Heart className="w-5 h-5 fill-neutral-950" />
          </div>

          {/* CARD 1: MEN'S EDITION */}
          <div className="bg-[#12141c] border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative group hover:border-neutral-700 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold bg-[#FF2028]/20 text-[#FF2028] border border-[#FF2028]/40 px-2 py-0.5 rounded uppercase">
                MEN'S PIECE · 240 GSM
              </span>
              <span className="font-mono text-xs text-neutral-400">
                {menProduct.fit}
              </span>
            </div>

            <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-neutral-900 mb-4">
              <img
                src={menProduct.images[0]}
                alt={menProduct.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute top-2 left-2">
                <span className="bg-black/80 backdrop-blur-sm text-neutral-300 text-[10px] font-mono px-2 py-0.5 rounded border border-neutral-700">
                  {menProduct.world}
                </span>
              </div>
            </div>

            <div>
              <h3 className="font-brush text-2xl font-normal text-white uppercase tracking-wide leading-tight">
                {menProduct.name}
              </h3>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-base font-bold text-white">
                  ₹{menProduct.price}
                </span>
                <span className="font-mono text-xs text-neutral-500 line-through">
                  ₹{menProduct.originalPrice}
                </span>
              </div>

              {/* Men Size Picker */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 mb-1.5">
                  <span>ADULT SIZE:</span>
                  <span className="text-white font-bold">{selectedMenSize}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(menProduct.sizes || ['S', 'M', 'L', 'XL', 'XXL']).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setSelectedMenSize(sz)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition cursor-pointer border ${
                        selectedMenSize === sz
                          ? 'bg-white text-black border-white shadow'
                          : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-600'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: KIDS' EDITION */}
          <div className="bg-[#12141c] border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative group hover:border-sky-500/50 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40 px-2 py-0.5 rounded uppercase">
                KID'S PIECE · 180 GSM BIO-WASH
              </span>
              <span className="font-mono text-xs text-neutral-400">
                {kidsProduct.fit}
              </span>
            </div>

            <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-neutral-900 mb-4">
              <img
                src={kidsProduct.images[0]}
                alt={kidsProduct.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute top-2 left-2">
                <span className="bg-sky-600 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow">
                  {kidsProduct.world}
                </span>
              </div>
            </div>

            <div>
              <h3 className="font-brush text-2xl font-normal text-white uppercase tracking-wide leading-tight">
                {kidsProduct.name}
              </h3>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-base font-bold text-white">
                  ₹{kidsProduct.price}
                </span>
                <span className="font-mono text-xs text-neutral-500 line-through">
                  ₹{kidsProduct.originalPrice}
                </span>
              </div>

              {/* Kids Size Picker */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 mb-1.5">
                  <span>KID AGE / SIZE:</span>
                  <span className="text-sky-300 font-bold">{selectedKidsSize}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(kidsProduct.sizes || ['2–3Y', '4–5Y', '6–7Y', '8–9Y', '10–11Y', '12–13Y']).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setSelectedKidsSize(sz)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition cursor-pointer border ${
                        selectedKidsSize === sz
                          ? 'bg-sky-400 text-neutral-950 border-sky-400 shadow font-black'
                          : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-600'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Summary & 1-Click Action Bar */}
        <div className="p-4 sm:p-6 border-t border-neutral-800 bg-[#0f1017] flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-0 z-20">
          <div className="w-full sm:w-auto">
            <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-2">
              <span>TWINNING COMBO BUNDLE</span>
              <span className="text-emerald-400 font-bold">
                (YOU SAVE ₹{pricing.savings})
              </span>
            </div>
            <div className="flex items-baseline gap-2.5 mt-0.5">
              <span className="font-mono text-2xl sm:text-3xl font-black text-amber-400">
                ₹{pricing.comboPrice}
              </span>
              <span className="font-mono text-sm text-neutral-500 line-through">
                ₹{pricing.originalTotal}
              </span>
              <span className="text-xs font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                10% OFF APPLIED
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleAddBoth}
              disabled={addedToast}
              className={`w-full sm:w-auto px-6 sm:px-8 py-3.5 rounded-xl font-heading font-black text-xs sm:text-sm uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-xl ${
                addedToast
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-neutral-950 hover:brightness-110 shadow-amber-500/20'
              }`}
            >
              {addedToast ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>BOTH ADDED TO BAG!</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4 text-neutral-950" />
                  <span>ADD MEN + KID COMBO PAIR (₹{pricing.comboPrice})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
