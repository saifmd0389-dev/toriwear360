import React, { useState, useEffect } from 'react';
import { X, Sparkles, Check, Send } from 'lucide-react';
import { loadFrontPageCmsData, FrontPageAdvertisement } from '../admin/data/frontPageCmsData';

interface PromoBannerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCoupon: (code: string) => void;
}

export const PromoBannerPopup: React.FC<PromoBannerPopupProps> = ({
  isOpen,
  onClose,
  onApplyCoupon,
}) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [popupAd, setPopupAd] = useState<FrontPageAdvertisement | null>(() => {
    const found = loadFrontPageCmsData().advertisements?.find((a) => a.type === 'POPUP_MODAL');
    return found || null;
  });

  useEffect(() => {
    const sync = () => {
      const found = loadFrontPageCmsData().advertisements?.find((a) => a.type === 'POPUP_MODAL');
      setPopupAd(found || null);
    };
    window.addEventListener('tori-cms-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tori-cms-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Keyboard shortcut (Escape) to close popup
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

  if (!isOpen || (popupAd && popupAd.enabled === false)) return null;

  const promoCode = popupAd?.promoCode || 'TORI100';
  const badgeText = popupAd?.badge || 'ORIGINAL ANIME STREETWEAR';
  const headline = popupAd?.headline || 'GET ₹100 OFF YOUR FIRST DROP';
  const description =
    popupAd?.description ||
    'Join the Toriwear universe. Unlock private drop alerts, lore chapters, and instant ₹100 discount.';
  const ctaText = popupAd?.ctaText || 'CLAIM ₹100 VOUCHER';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && email.includes('@')) {
      setSubscribed(true);
      onApplyCoupon(promoCode);
    }
  };

  return (
    <div className="fixed bottom-20 sm:bottom-5 right-3 sm:right-5 z-40 max-w-sm w-[calc(100vw-24px)] sm:w-[calc(100vw-40px)] bg-[#121219] border border-neutral-700/80 rounded-2xl p-4 sm:p-5 shadow-2xl animate-in slide-in-from-bottom-5 select-none">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
        aria-label="Dismiss Offer"
        title="Dismiss Offer (Esc)"
      >
        <X className="w-4 h-4" />
      </button>

      {subscribed ? (
        <div className="text-center py-2 space-y-2">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <Check className="w-5 h-5" />
          </div>
          <div className="font-heading text-xl text-white font-bold uppercase">
            ACCESS GRANTED
          </div>
          <p className="text-xs font-mono text-neutral-300">
            Coupon code <strong className="text-[#FF2028]">{promoCode}</strong> has been applied to your cart for your first order!
          </p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-[#FF2028] hover:bg-[#e02641] text-white text-xs font-mono font-bold uppercase rounded-lg transition cursor-pointer"
          >
            START SHOPPING
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#FF2028] font-bold">
            <Sparkles className="w-4 h-4" />
            <span>{badgeText}</span>
          </div>

          <div className="font-heading text-2xl font-black text-white uppercase leading-tight">
            {headline}
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed font-sans">
            {description}
          </p>

          <div className="space-y-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF2028] font-mono"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-[#FF2028] hover:bg-[#e02641] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition shadow-lg shadow-[#FF2028]/30 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{ctaText}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
