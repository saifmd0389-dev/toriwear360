import React, { useState, useEffect } from 'react';
import { Sparkles, ShoppingBag, ArrowRight, Heart } from 'lucide-react';
import { Product } from '../types';
import { getTwinProduct, getComboPricing } from '../utils/twinningCombos';
import { loadFrontPageCmsData, FrontPageAdvertisement } from '../admin/data/frontPageCmsData';
import { ShimmerImage, TwinningSpotlightSkeleton } from './StorefrontSkeletons';

interface TwinningSpotlightSectionProps {
  allProducts: Product[];
  isLoading?: boolean;
  onOpenCombo: (product: Product) => void;
  onShopMen: () => void;
  onShopKids: () => void;
}

const getTwinningAdState = (): { hasConfig: boolean; ad: FrontPageAdvertisement | null } => {
  try {
    const cms = loadFrontPageCmsData();
    const matching = (cms.advertisements || []).filter((a) => a.type === 'TWINNING_SPOTLIGHT');
    if (matching.length === 0) return { hasConfig: false, ad: null };
    return {
      hasConfig: true,
      ad: matching.find((a) => a.enabled !== false) || null,
    };
  } catch {
    return { hasConfig: false, ad: null };
  }
};

export const TwinningSpotlightSection: React.FC<TwinningSpotlightSectionProps> = ({
  allProducts,
  isLoading = false,
  onOpenCombo,
  onShopMen,
}) => {
  const [cmsState, setCmsState] = useState(getTwinningAdState);

  useEffect(() => {
    const sync = () => setCmsState(getTwinningAdState());
    window.addEventListener('tori-cms-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tori-cms-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (cmsState.hasConfig && !cmsState.ad) {
    return null;
  }

  const ad = cmsState.ad;

  // Find a representative pairing
  const sampleMenProduct = allProducts.find((p) => p.department === 'MEN' && p.name.includes('VOID WALKER')) 
    || allProducts.find((p) => p.department === 'MEN');
  const sampleKidsProduct = sampleMenProduct ? getTwinProduct(sampleMenProduct, allProducts) : null;

  const pricing = sampleMenProduct && sampleKidsProduct 
    ? getComboPricing(sampleMenProduct, sampleKidsProduct) 
    : { originalTotal: 1998, comboPrice: 1798, savings: 200, discountPercent: 10 };

  const badgeText = ad?.badge || 'FAMILY & SIBLING TWINNING FEATURE';
  const discountBadgeText = ad?.discountValue || `SAVE ${pricing.discountPercent}%`;
  const headlineText = ad?.headline || 'TRY COMBO: MEN & KID PAIR';
  const taglineText = ad?.tagline || 'Exact same iconic Tokyo anime design for both father & child or siblings.';
  const descriptionText = ad?.description || 'Every signature design in the Tori Wear catalog is engineered for both generations. Purchase both as a set to receive an instant bundle discount.';
  const ctaLabel = ad?.ctaText || 'TRY COMBO PAIR NOW';

  return (
    <section id="twinning-spotlight-section" className="py-16 sm:py-24 bg-[#0d0e14] border-b border-neutral-800/80 relative overflow-hidden select-none text-white">
      {/* Background Soft Glows */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-amber-500/10 blur-[150px] pointer-events-none rounded-full" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-[#FF2028]/10 blur-[150px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Soft Highlight Pill Badge */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold uppercase tracking-wider mb-3 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>{badgeText}</span>
            <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded text-[10px]">{discountBadgeText}</span>
          </div>

          <h2 className="font-display text-4xl sm:text-6xl font-normal text-white uppercase tracking-[0.04em] leading-[0.95]">
            {ad?.headline ? (
              <span className="text-amber-400">{headlineText}</span>
            ) : (
              <>
                TRY COMBO: <span className="text-amber-400">MEN & KID PAIR</span>
              </>
            )}
            <span className="block text-base sm:text-xl font-sans text-neutral-400 font-normal mt-2 tracking-normal normal-case">
              {taglineText}
            </span>
          </h2>
        </div>

        {/* Spotlight Showcase Container or Skeleton */}
        {isLoading ? (
          <TwinningSpotlightSkeleton />
        ) : (
        <div className="bg-[#12131b] border-2 border-amber-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden skeleton-reveal">
          {ad?.imageUrl && (
            <img
              src={ad.imageUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none"
            />
          )}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Visual Dual Model Preview (Left) */}
            <div className="lg:col-span-7 grid grid-cols-2 gap-4 relative">
              {/* Connector Heart Badge */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-amber-400 to-[#FF2028] text-neutral-950 flex items-center justify-center shadow-xl border-4 border-[#12131b]">
                <Heart className="w-5 h-5 fill-neutral-950" />
              </div>

              {/* Men's Showcase Piece */}
              <div className="bg-[#161822] border border-neutral-800 rounded-2xl overflow-hidden p-3 sm:p-4 group">
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-neutral-900 mb-3">
                  <ShimmerImage
                    src={sampleMenProduct?.images[0] || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80'}
                    alt="Adult Men Twinning Piece"
                    theme="dark"
                    wrapperClassName="w-full h-full"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-2 left-2 z-10">
                    <span className="bg-[#FF2028] text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase">
                      ADULT · 240 GSM
                    </span>
                  </div>
                </div>
                <div className="text-xs font-mono font-bold text-white truncate">
                  {sampleMenProduct?.name || 'VOID WALKER'}
                </div>
                <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                  ₹{sampleMenProduct?.price || 1199} · Sizes S to XXXL
                </div>
              </div>

              {/* Kids' Showcase Piece */}
              <div className="bg-[#161822] border border-neutral-800 rounded-2xl overflow-hidden p-3 sm:p-4 group">
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-neutral-900 mb-3">
                  <ShimmerImage
                    src={sampleKidsProduct?.images[0] || 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=900&auto=format&fit=crop&q=80'}
                    alt="Kids Twinning Piece"
                    theme="dark"
                    wrapperClassName="w-full h-full"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-2 left-2 z-10">
                    <span className="bg-sky-500 text-neutral-950 text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase">
                      KID · 180 GSM
                    </span>
                  </div>
                </div>
                <div className="text-xs font-mono font-bold text-white truncate">
                  {sampleKidsProduct?.name || 'LITTLE DRAGON'}
                </div>
                <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                  ₹{sampleKidsProduct?.price || 799} · Ages 2 to 13Y
                </div>
              </div>
            </div>

            {/* Content & Action (Right) */}
            <div className="lg:col-span-5 space-y-4 sm:space-y-6">
              <div>
                <span className="text-amber-400 text-xs font-mono font-bold uppercase tracking-wider block mb-1">
                  1-CLICK PAIR PURCHASE
                </span>
                <h3 className="font-heading text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
                  SAME DESIGN. PERFECT SIZING FOR BOTH.
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
                  {descriptionText}
                </p>
              </div>

              {/* Combo Pricing Box */}
              <div className="p-4 rounded-xl bg-black/50 border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-sans font-medium tracking-[0.06em] text-neutral-400 uppercase">COMBO BUNDLE PRICE</div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="font-sans text-2xl font-bold text-amber-400 tabular-nums">
                      ₹{pricing.comboPrice}
                    </span>
                    <span className="font-sans text-xs text-neutral-500 line-through tabular-nums">
                      ₹{pricing.originalTotal}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="bg-emerald-500/20 text-emerald-400 text-xs font-sans font-semibold px-2.5 py-1 rounded-full border border-emerald-500/30 tabular-nums">
                    YOU SAVE ₹{pricing.savings}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={() => sampleMenProduct && onOpenCombo(sampleMenProduct)}
                  className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-neutral-950 font-sans font-bold text-xs uppercase tracking-[0.06em] rounded-xl transition hover:brightness-110 active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-neutral-950" />
                  <span>{ctaLabel}</span>
                </button>

                <button
                  onClick={onShopMen}
                  className="w-full sm:w-auto px-4 py-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-sans font-semibold uppercase tracking-[0.05em] transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>SEE MEN'S WEAR</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </section>
  );
};
