import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, BellRing, CheckCircle2, AlertCircle, MessageCircle, Bell, Mail } from 'lucide-react';
import { Product } from '../types';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { apiClient } from '../services/apiClient';

const BROWSER_PROMPT_DISMISSED_KEY = 'toriwear_browser_notif_prompt_dismissed';

interface BackInStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  variantId?: string;
  size: string;
  color: string;
  sku?: string;
  imageUrl?: string;
}

export const BackInStockModal: React.FC<BackInStockModalProps> = ({
  isOpen,
  onClose,
  product,
  variantId,
  size,
  color,
  sku,
  imageUrl,
}) => {
  const { customer, isLoggedIn } = useCustomerAuth();

  // Strict priority state: 1. WhatsApp (PRIMARY), 2. Website (SECONDARY), 3. Email (BACKUP)
  const [phone, setPhone] = useState('');
  const [whatsappConsent, setWhatsappConsent] = useState(false); // NEVER assumed from having a phone number
  const [websiteEnabled, setWebsiteEnabled] = useState(true);
  const [browserPushEnabled, setBrowserPushEnabled] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [browserPromptDismissed, setBrowserPromptDismissed] = useState(false);

  const [emailBackupEnabled, setEmailBackupEnabled] = useState(false);
  const [email, setEmail] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPhone(customer?.phone || '');
    setEmail(customer?.email || '');
    setWhatsappConsent(false); // Always require explicit opt-in per subscription
    setWebsiteEnabled(isLoggedIn);
    setEmailBackupEnabled(false);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = window.Notification.permission;
      setBrowserPermission(perm);
      setBrowserPushEnabled(perm === 'granted');
      try {
        setBrowserPromptDismissed(localStorage.getItem(BROWSER_PROMPT_DISMISSED_KEY) === '1');
      } catch {
        setBrowserPromptDismissed(false);
      }
    } else {
      setBrowserPermission('unsupported');
      setBrowserPushEnabled(false);
    }
  }, [isOpen, customer?.phone, customer?.email, isLoggedIn, variantId, size, color]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleRequestBrowserPermissionOnce = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (window.Notification.permission !== 'default') {
      setBrowserPermission(window.Notification.permission);
      setBrowserPushEnabled(window.Notification.permission === 'granted');
      return;
    }
    try {
      const result = await window.Notification.requestPermission();
      setBrowserPermission(result);
      setBrowserPushEnabled(result === 'granted');
      if (result !== 'granted') {
        try {
          localStorage.setItem(BROWSER_PROMPT_DISMISSED_KEY, '1');
        } catch {}
        setBrowserPromptDismissed(true);
      }
    } catch {
      setBrowserPushEnabled(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();

    if (whatsappConsent && !cleanPhone) {
      setErrorMsg('Please enter your mobile number to receive the WhatsApp restock alert.');
      return;
    }
    if (emailBackupEnabled && !cleanEmail) {
      setErrorMsg('Please enter your email address if you enable backup email alerts.');
      return;
    }
    if (!whatsappConsent && !(isLoggedIn && websiteEnabled) && !emailBackupEnabled) {
      setErrorMsg(
        isLoggedIn
          ? 'Select at least one notification option (WhatsApp, Website Inbox, or Backup Email).'
          : 'Please tick WhatsApp consent with your mobile number, or enable Backup Email.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.subscribeBackInStock({
        productId: product.id,
        variantId,
        size,
        color,
        customerName: customer?.name || undefined,
        phone: cleanPhone || undefined,
        email: cleanEmail || undefined,
        whatsappConsent,
        websiteEnabled: isLoggedIn ? websiteEnabled : Boolean(cleanPhone || cleanEmail),
        browserPushEnabled: browserPermission === 'granted' && browserPushEnabled,
        emailBackupEnabled: Boolean(emailBackupEnabled && cleanEmail),
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Could not save your back-in-stock alert. Please try again.');
        return;
      }

      setSuccessMsg(
        res.message ||
          `We will alert you as soon as ${product.name} (Size ${size} · ${color}) is back in stock.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to connect right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bis-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] flex flex-col bg-white text-neutral-900 border border-neutral-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (pinned so X close button is always visible) */}
        <div className="shrink-0 bg-[#0a0a0f] text-white px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <BellRing className="w-4 h-4 text-[#FF2028] shrink-0" />
            <div className="min-w-0">
              <h2 id="bis-modal-title" className="text-sm font-bold tracking-wider uppercase truncate">
                Notify Me When Back in Stock
              </h2>
              <p className="text-[11px] text-neutral-400">
                Exact size &amp; color alert · Zero spam
              </p>
            </div>
          </div>
          <button
            id="bis-modal-close-btn"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            title="Close"
            className="shrink-0 p-1.5 rounded text-white/90 hover:text-white hover:bg-white/15 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable modal content */}
        <div className="overflow-y-auto flex-1">
        {/* Exact Selected Variant Summary */}
        <div className="px-5 py-3.5 bg-neutral-50 border-b border-neutral-200 flex items-center gap-3.5">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={product.name}
              className="w-12 h-14 object-cover border border-neutral-200 shrink-0 bg-white"
            />
          )}
          <div className="min-w-0">
            <div className="text-xs font-bold text-neutral-900 truncate">{product.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-mono text-neutral-700">
              <span className="px-2 py-0.5 bg-white border border-neutral-300 font-semibold">
                SIZE: {size}
              </span>
              <span className="px-2 py-0.5 bg-white border border-neutral-300 font-semibold">
                COLOR: {color}
              </span>
            </div>
            {sku && <div className="text-[10px] font-mono text-neutral-400 mt-1">SKU: {sku}</div>}
          </div>
        </div>

        {successMsg ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Restock Alert Activated</h3>
              <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed">{successMsg}</p>
            </div>
            <div className="text-[11px] text-neutral-500 bg-neutral-50 border border-neutral-200 p-3 text-left space-y-1">
              <div className="font-semibold text-neutral-800">Selected Notification Channels:</div>
              {whatsappConsent && <div>1. WhatsApp Alert (Primary) — Enabled</div>}
              {isLoggedIn && websiteEnabled && (
                <div>
                  2. Website Inbox Notification — Enabled
                  {browserPermission === 'granted' && browserPushEnabled ? ' (+ Browser Push)' : ''}
                </div>
              )}
              {emailBackupEnabled && <div>3. Backup Email — Enabled</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-black hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* PRIORITY 1: WHATSAPP (PRIMARY) */}
            <div className="border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-neutral-900">WhatsApp Alert</span>
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 bg-emerald-600 text-white">
                  Primary
                </span>
              </div>

              <div>
                <label htmlFor="bis-phone-input" className="block text-[11px] font-medium text-neutral-700 mb-1">
                  Mobile Number {isLoggedIn && customer?.phone ? '(from your account)' : '(10-digit India or with country code)'}
                </label>
                <input
                  id="bis-phone-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 focus:border-black focus:outline-none font-mono"
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-0.5">
                <input
                  id="bis-whatsapp-consent"
                  type="checkbox"
                  checked={whatsappConsent}
                  onChange={(e) => setWhatsappConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-emerald-600 cursor-pointer"
                />
                <span className="text-[11px] text-neutral-700 leading-snug">
                  <strong>Yes, send me a WhatsApp notification</strong> when Size {size} ({color}) is back in stock. Reply STOP anytime to opt out.
                </span>
              </label>
            </div>

            {/* PRIORITY 2: WEBSITE NOTIFICATION (SECONDARY) + OPTIONAL BROWSER PUSH */}
            <div className="border border-neutral-200 bg-neutral-50/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-neutral-800" />
                  <span className="text-xs font-bold text-neutral-900">Website Inbox Notification</span>
                </div>
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-neutral-600">
                  Secondary
                </span>
              </div>

              {isLoggedIn ? (
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    id="bis-website-enabled"
                    type="checkbox"
                    checked={websiteEnabled}
                    onChange={(e) => setWebsiteEnabled(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-black cursor-pointer"
                  />
                  <span className="text-[11px] text-neutral-600 leading-snug">
                    Save an alert in my Tori-Wear notifications inbox (stays available even if you&apos;re offline when it restocks).
                  </span>
                </label>
              ) : (
                <p className="text-[11px] text-neutral-500 leading-snug">
                  Sign in with your account to also view restock alerts inside your Tori-Wear website inbox.
                </p>
              )}

              {/* Optional Browser Push — never required, never repeatedly prompted */}
              {isLoggedIn && websiteEnabled && browserPermission === 'granted' && (
                <label className="flex items-center gap-2 pt-1 cursor-pointer select-none text-[11px] text-neutral-700">
                  <input
                    type="checkbox"
                    checked={browserPushEnabled}
                    onChange={(e) => setBrowserPushEnabled(e.target.checked)}
                    className="h-3.5 w-3.5 accent-black cursor-pointer"
                  />
                  <span>Also show a browser alert when I visit Tori-Wear</span>
                </label>
              )}

              {isLoggedIn && websiteEnabled && browserPermission === 'default' && !browserPromptDismissed && (
                <div className="pt-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-neutral-500">Optional: enable browser notifications?</span>
                  <button
                    type="button"
                    onClick={handleRequestBrowserPermissionOnce}
                    className="px-2 py-1 text-[10px] font-semibold border border-neutral-300 bg-white hover:border-black text-neutral-800 transition cursor-pointer shrink-0"
                  >
                    Allow Browser Alerts
                  </button>
                </div>
              )}
            </div>

            {/* PRIORITY 3: EMAIL (BACKUP — OPTIONAL) */}
            <div className="border border-neutral-200 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    id="bis-email-backup"
                    type="checkbox"
                    checked={emailBackupEnabled}
                    onChange={(e) => setEmailBackupEnabled(e.target.checked)}
                    className="h-4 w-4 accent-black cursor-pointer"
                  />
                  <Mail className="w-3.5 h-3.5 text-neutral-600" />
                  <span className="text-xs font-semibold text-neutral-800">Backup Email Alert (Optional)</span>
                </label>
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  Backup
                </span>
              </div>

              {emailBackupEnabled && (
                <input
                  id="bis-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 focus:border-black focus:outline-none"
                />
              )}
            </div>

            {errorMsg && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              id="bis-submit-btn"
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#e11b23] hover:bg-[#c6171e] disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              {submitting ? 'Saving Alert...' : `Notify Me — Size ${size}`}
            </button>
          </form>
        )}
        </div>
      </div>
    </div>,
    document.body
  );
};
