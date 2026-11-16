import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  X,
  KeyRound,
  Globe,
} from 'lucide-react';
import { OfficialToriwearLogo } from '../../components/OfficialToriwearLogo';
import {
  ADMIN_CONFIG,
  getProductionAdminUrl,
  getAdminSubpath,
} from '../../config/adminRoutes';

interface AdminAccessGatewayProps {
  mode?: 'landing' | 'modal';
  isOpen?: boolean;
  onClose?: () => void;
  onProceedToLogin?: () => void;
  onReturnToStorefront?: () => void;
}

export const AdminAccessGateway: React.FC<AdminAccessGatewayProps> = ({
  mode = 'modal',
  isOpen = true,
  onClose,
  onProceedToLogin,
  onReturnToStorefront,
}) => {
  const [copiedKey, setCopiedKey] = useState<'prod' | 'current' | 'path' | null>(null);

  useEffect(() => {
    if (mode !== 'modal' || !isOpen || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, isOpen, onClose]);

  if (mode === 'modal' && !isOpen) {
    return null;
  }

  const productionUrl = getProductionAdminUrl();
  const currentOrigin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : ADMIN_CONFIG.PUBLIC_STOREFRONT_URL;
  const currentEnvUrl = `${currentOrigin}${ADMIN_CONFIG.ADMIN_PATH}`;
  const isLocalOrPreviewHost =
    currentOrigin !== ADMIN_CONFIG.PUBLIC_STOREFRONT_URL;

  const handleCopy = async (text: string, key: 'prod' | 'current' | 'path') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    }
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const cardBody = (
    <div className="w-full max-w-2xl bg-[#12141c] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden text-neutral-200">
      {/* Header */}
      <div className="px-6 py-5 border-b border-neutral-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight truncate">
              Private Admin Access Gateway
            </h2>
            <p className="text-xs text-neutral-400 flex items-center gap-2">
              <span>Isolated Operations Route</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-neutral-300">
                VITE_ADMIN_PATH
              </span>
            </p>
          </div>
        </div>

        {mode === 'modal' && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close gateway modal"
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-6 space-y-6">
        {/* Unique Route Banner */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-medium text-neutral-300">
              Configured Non-Standard Route (`VITE_ADMIN_PATH`)
            </span>
            <span className="font-mono text-neutral-400">
              {ADMIN_CONFIG.IS_CUSTOM_VITE_ADMIN_PATH ? 'Environment Override' : 'Default Isolated Path'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#0a0b10] border border-neutral-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <KeyRound className="w-4 h-4 text-red-500 shrink-0" />
              <code className="text-sm font-mono tabular-nums text-white truncate">
                {ADMIN_CONFIG.ADMIN_PATH}
              </code>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(ADMIN_CONFIG.ADMIN_PATH, 'path')}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-medium text-neutral-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {copiedKey === 'path' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Path</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Full Production Access URL */}
        <div className="space-y-2 pt-2 border-t border-neutral-800/80">
          <label className="block text-xs font-medium text-neutral-300">
            Production Admin Access URL ({ADMIN_CONFIG.PUBLIC_STOREFRONT_URL.replace(/^https?:\/\//, '')})
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#0a0b10] border border-neutral-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <Globe className="w-4 h-4 text-neutral-400 shrink-0" />
              <span className="text-sm font-mono tabular-nums text-white truncate select-all">
                {productionUrl}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(productionUrl, 'prod')}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {copiedKey === 'prod' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>URL Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Admin URL</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Active Preview / Staging Host URL (shown when host differs from canonical production domain) */}
        {isLocalOrPreviewHost && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-400">
              Current Environment URL
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#0a0b10] border border-neutral-800/80">
              <span className="text-xs font-mono tabular-nums text-neutral-300 truncate select-all">
                {currentEnvUrl}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(currentEnvUrl, 'current')}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-medium text-neutral-200 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                {copiedKey === 'current' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Current URL</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Security & Route Isolation Guarantees */}
        <div className="pt-4 border-t border-neutral-800/80 space-y-3 text-xs">
          <div className="flex items-start justify-between gap-4 py-1">
            <div>
              <p className="font-medium text-white">Exclusive Route Enforcement</p>
              <p className="text-neutral-400 mt-0.5">
                Standard routes such as <code className="font-mono text-neutral-300">/admin</code> and{' '}
                <code className="font-mono text-neutral-300">#admin</code> are disabled. Access is permitted solely via{' '}
                <code className="font-mono text-neutral-300">{ADMIN_CONFIG.ADMIN_PATH}</code>.
              </p>
            </div>
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          </div>

          <div className="border-t border-neutral-800/60 pt-3 flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-white">Zero Public Storefront Exposure</p>
              <p className="text-neutral-400 mt-0.5">
                Customer storefront headers, footers, and navigation drawers contain no administrative links or entry triggers.
              </p>
            </div>
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          </div>

          <div className="border-t border-neutral-800/60 pt-3 flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-white">User ID &amp; Password Sign-In</p>
              <p className="text-neutral-400 mt-0.5">
                Admin and Partner accounts authenticate directly with User ID or Email and Password. Two-step authenticator verification remains optional in Account Security.
              </p>
            </div>
            <KeyRound className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 bg-[#0d0f15] border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        {onReturnToStorefront ? (
          <button
            type="button"
            onClick={onReturnToStorefront}
            className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Storefront</span>
          </button>
        ) : (
          <a
            href={getAdminSubpath('login')}
            className="text-xs font-mono text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{getAdminSubpath('login')}</span>
          </a>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {mode === 'modal' && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-medium text-neutral-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              Close
            </button>
          )}

          {onProceedToLogin && (
            <button
              type="button"
              onClick={onProceedToLogin}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <span>Proceed to Admin Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (mode === 'landing') {
    return (
      <div className="min-h-screen bg-[#0a0b10] flex flex-col justify-center items-center px-4 py-10 font-sans text-neutral-200">
        <div className="mb-6 flex flex-col items-center gap-3">
          <OfficialToriwearLogo className="h-12 w-auto max-w-[180px] object-contain" />
          <p className="text-xs text-neutral-400 font-medium">
            Authorized Personnel Gateway · Non-Public Operations Access
          </p>
        </div>
        {cardBody}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Private Admin Access Gateway"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      {cardBody}
    </div>
  );
};
