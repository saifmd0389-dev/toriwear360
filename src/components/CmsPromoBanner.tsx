import React from 'react';
import { ArrowRight, Sparkles, Tag, Copy, Check } from 'lucide-react';
import { FrontPageAdvertisement } from '../admin/data/frontPageCmsData';

interface CmsPromoBannerProps {
  ad: FrontPageAdvertisement;
  variant?: 'strip' | 'infeed' | 'footer';
  onNavigateLink: (linkUrl?: string) => void;
  onApplyPromoCode?: (code: string) => void;
}

export const CmsPromoBanner: React.FC<CmsPromoBannerProps> = ({
  ad,
  variant = 'strip',
  onNavigateLink,
  onApplyPromoCode,
}) => {
  const [copied, setCopied] = React.useState(false);

  const bgColor = ad.bgColor || (variant === 'infeed' ? '#12131b' : variant === 'footer' ? '#140b0e' : '#0d0e14');
  const textColor = ad.textColor || '#FFFFFF';

  const handlePromoAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ad.promoCode) return;
    try {
      navigator.clipboard?.writeText(ad.promoCode);
    } catch {}
    onApplyPromoCode?.(ad.promoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      className="relative overflow-hidden border-y border-neutral-800/80 select-none"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {ad.imageUrl && (
        <img
          src={ad.imageUrl}
          alt={ad.headline || ad.title}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/75 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10 flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="space-y-1.5 text-center md:text-left max-w-2xl">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            {ad.badge && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FF2028] text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                {ad.badge}
              </span>
            )}
            {ad.discountValue && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-mono font-bold uppercase">
                {ad.discountValue}
              </span>
            )}
          </div>

          {ad.headline && (
            <h3 className="font-heading text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight" style={{ color: textColor }}>
              {ad.headline}
            </h3>
          )}

          {(ad.tagline || ad.description) && (
            <p className="text-xs sm:text-sm opacity-85 font-sans leading-relaxed" style={{ color: textColor }}>
              {ad.tagline || ad.description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
          {ad.promoCode && (
            <button
              type="button"
              onClick={handlePromoAction}
              className="px-3.5 py-2.5 rounded-xl bg-black/50 hover:bg-black/75 border border-dashed border-amber-400/60 text-amber-300 text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer"
              title="Click to copy & apply promo code"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>{ad.promoCode}</span>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 opacity-75" />}
            </button>
          )}

          {(ad.ctaText || ad.linkUrl) && (
            <button
              type="button"
              onClick={() => {
                if (ad.linkUrl) {
                  onNavigateLink(ad.linkUrl);
                } else if (ad.promoCode) {
                  onApplyPromoCode?.(ad.promoCode);
                }
              }}
              className="px-5 py-3 rounded-xl bg-[#FF2028] hover:bg-red-500 text-white font-heading font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg cursor-pointer"
            >
              <span>{ad.ctaText || 'EXPLORE DROP'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
