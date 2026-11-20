import React, { useState, useEffect } from 'react';
import { X, Sparkles, Check, Send } from 'lucide-react';
import { loadFrontPageCmsData, FrontPageAdvertisement } from '../admin/data/frontPageCmsData';
import { apiClient } from '../services/apiClient';

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
  const [emailConsent, setEmailConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [grantedCoupon, setGrantedCoupon] = useState<string | null>(null);
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

  const badgeText = popupAd?.badge || 'ORIGINAL ANIME STREETWEAR';
  const headline = popupAd?.headline || 'JOIN EARLY DROP ACCESS';
  const description =
    popupAd?.description ||
    'Join the Toriwear universe for private drop alerts, lore chapters, and eligible launch perks.';
  const ctaText = popupAd?.ctaText || 'JOIN ACCESS LIST';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!emailConsent) {
      setErrorMsg('Please confirm email notification consent to join.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.subscribeNewsletter({
        email: email.trim(),
        emailConsent,
        registrationSource: 'PROMO_POPUP',
      });
      if (!res.success) {
        setErrorMsg(res.error || 'Registration unavailable right now. Please try again.');
        return;
      }
      setSubscribed(true);
      if (res.coupon?.active && res.coupon?.eligible && res.coupon?.code) {
        setGrantedCoupon(res.coupon.code);
        onApplyCoupon(res.coupon.code);
      } else {
        setGrantedCoupon(null);
      }
    } finally {
      setIsSubmitting(false);
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
          <div className="font-display text-2xl text-white font-normal tracking-[0.04em] uppercase">
            ACCESS GRANTED
          </div>
          {grantedCoupon ? (
            <p className="text-xs font-sans text-neutral-300">
              Coupon code <strong className="text-[#FF2028]">{grantedCoupon}</strong> is eligible on your account when you reach checkout rules!
            </p>
          ) : (
            <p className="text-xs font-sans text-neutral-300">
              You are now registered for TORIWEAR early access drop notifications!
            </p>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#FF2028] hover:bg-[#e02641] text-white text-xs font-sans font-bold uppercase tracking-[0.06em] rounded-lg transition cursor-pointer"
          >
            START SHOPPING
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-heading uppercase tracking-[0.1em] text-[#FF2028] font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>{badgeText}</span>
          </div>

          <div className="font-display text-3xl font-normal tracking-[0.04em] text-white uppercase leading-[0.95]">
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
              disabled={isSubmitting}
              placeholder="Enter your email address"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF2028] font-sans disabled:opacity-60"
            />
            <label className="flex items-start gap-2 text-[11px] text-neutral-400 font-sans cursor-pointer">
              <input
                type="checkbox"
                checked={emailConsent}
                onChange={(e) => setEmailConsent(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 accent-[#FF2028] cursor-pointer"
              />
              <span>I agree to receive drop notifications & marketing emails from TORIWEAR.</span>
            </label>
            {errorMsg && (
              <div className="text-[11px] font-sans text-red-400">{errorMsg}</div>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-[#FF2028] hover:bg-[#e02641] text-white text-xs font-sans font-bold uppercase tracking-[0.06em] rounded-xl transition shadow-lg shadow-[#FF2028]/30 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span>{isSubmitting ? 'REGISTERING...' : ctaText}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
