import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles 
} from 'lucide-react';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { OfficialToriwearLogo } from './OfficialToriwearLogo';

export const CustomerAuthModal: React.FC = () => {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    loginWithGoogle
  } = useCustomerAuth();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Keyboard shortcut (Escape) to close modal
  React.useEffect(() => {
    if (!isAuthModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  // Prevent background page scrolling when auth modal is open
  React.useEffect(() => {
    if (!isAuthModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await loginWithGoogle();
      setLoading(false);
      if (!res.success && res.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Google Sign-In failed.');
    }
  };

  return (
    <div 
      style={{ zIndex: 9999 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeAuthModal();
        }
      }}
    >
      <div 
        id="customer-auth-modal"
        className="bg-[#101016] border border-neutral-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl my-auto animate-in zoom-in-95 flex flex-col font-sans"
      >
        {/* Header Banner */}
        <div className="p-6 border-b border-neutral-800 bg-[#14141e] relative text-center">
          <button
            onClick={closeAuthModal}
            className="absolute top-3.5 right-3.5 min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Close Sign In"
            title="Close Sign In (Esc)"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center justify-center mb-3">
            <OfficialToriwearLogo className="h-10 w-auto max-w-[150px] object-contain" />
          </div>

          <h3 className="font-heading text-xl font-bold text-white tracking-wide">
            Customer Sign In
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Access orders, manage wishlists, earn Tori Insider drop points &amp; tracked cart
          </p>
        </div>

        {/* Form Body with Google Sign-In */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-xs text-neutral-400 text-center">
              Sign in with your Google Account to access your personal profile, cart, and wishlist across all visits.
            </p>

            <button
              id="google-signin-btn"
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full py-3.5 px-4 bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-3 shadow-lg active:scale-[0.99] disabled:opacity-50"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{loading ? 'Signing in with Google...' : 'Continue with Google'}</span>
            </button>
          </div>

          {/* Security & Benefits */}
          <div className="pt-4 border-t border-neutral-800/80 space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Secured by Google Firebase Authentication</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Welcome bonus ₹250 Tori Credit on first login</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
