import React, { useState, useEffect, useCallback } from 'react';
import { X, Bell, CheckCheck, ExternalLink, Trash2, Clock, PackageCheck } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { Product } from '../types';

const BROWSER_PROMPT_DISMISSED_KEY = 'toriwear_browser_notif_prompt_dismissed';

export interface CustomerInboxNotification {
  id: string;
  subscriptionId?: string | null;
  type: string;
  title: string;
  message: string;
  productId?: string | null;
  productSlug?: string | null;
  productName?: string | null;
  productImage?: string | null;
  variantId?: string | null;
  size?: string | null;
  color?: string | null;
  actionUrl?: string | null;
  isRead: boolean;
  readAt?: string | null;
  browserPushStatus?: string;
  createdAt: string;
}

interface CustomerNotificationsInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: CustomerInboxNotification[];
  unreadCount: number;
  allProducts: Product[];
  onRefresh: () => Promise<void>;
  onSelectProduct: (product: Product) => void;
}

export const CustomerNotificationsInboxModal: React.FC<CustomerNotificationsInboxModalProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  allProducts,
  onRefresh,
  onSelectProduct,
}) => {
  const [activeTab, setActiveTab] = useState<'INBOX' | 'WAITLIST'>('INBOX');
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [promptDismissed, setPromptDismissed] = useState(true);

  const loadWaitlist = useCallback(async () => {
    setLoadingWaitlist(true);
    try {
      const res = await apiClient.getMyBackInStockSubscriptions();
      if (res.success && Array.isArray(res.data)) {
        setWaitlist(res.data);
      }
    } finally {
      setLoadingWaitlist(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void onRefresh();
    void loadWaitlist();

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(window.Notification.permission);
      try {
        setPromptDismissed(localStorage.getItem(BROWSER_PROMPT_DISMISSED_KEY) === '1');
      } catch {
        setPromptDismissed(false);
      }
    } else {
      setBrowserPermission('unsupported');
    }
  }, [isOpen, onRefresh, loadWaitlist]);

  if (!isOpen) return null;

  const handleMarkRead = async (notif: CustomerInboxNotification) => {
    if (!notif.isRead) {
      await apiClient.markCustomerNotificationRead(notif.id);
      await onRefresh();
    }
  };

  const handleOpenProductFromNotif = async (notif: CustomerInboxNotification) => {
    await handleMarkRead(notif);
    const matched = allProducts.find(
      (p) =>
        (notif.productId && p.id === notif.productId) ||
        (notif.productSlug && (((p as any).slug === notif.productSlug) || p.id === notif.productSlug))
    );
    if (matched) {
      onClose();
      onSelectProduct(matched);
    } else if (notif.actionUrl && notif.actionUrl.startsWith('/')) {
      window.location.href = notif.actionUrl;
    }
  };

  const handleMarkAllRead = async () => {
    await apiClient.markAllCustomerNotificationsRead();
    await onRefresh();
  };

  const handleCancelWaitlist = async (id: string) => {
    const res = await apiClient.cancelMyBackInStockSubscription(id);
    if (res.success) {
      await loadWaitlist();
    }
  };

  const handleEnableBrowserAlerts = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await window.Notification.requestPermission();
      setBrowserPermission(perm);
      if (perm !== 'granted') {
        try {
          localStorage.setItem(BROWSER_PROMPT_DISMISSED_KEY, '1');
        } catch {}
        setPromptDismissed(true);
      }
    } catch {}
  };

  const handleDismissBrowserBanner = () => {
    try {
      localStorage.setItem(BROWSER_PROMPT_DISMISSED_KEY, '1');
    } catch {}
    setPromptDismissed(true);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex justify-end bg-black/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Customer Notifications Inbox"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white text-neutral-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0a0a0f] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-[#FF2028]" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Notifications</h2>
              <p className="text-[11px] text-neutral-400">
                Back-in-stock alerts &amp; restock updates
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="p-1.5 text-neutral-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 bg-neutral-50 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('INBOX')}
            className={`flex-1 py-2.5 text-center border-b-2 transition cursor-pointer ${
              activeTab === 'INBOX'
                ? 'border-[#e11b23] text-neutral-900 bg-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Inbox {unreadCount > 0 ? `(${unreadCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('WAITLIST')}
            className={`flex-1 py-2.5 text-center border-b-2 transition cursor-pointer ${
              activeTab === 'WAITLIST'
                ? 'border-[#e11b23] text-neutral-900 bg-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            My Waitlist ({waitlist.filter((w) => w.status === 'ACTIVE').length})
          </button>
        </div>

        {/* Optional one-time Browser Notification opt-in (never repeated once dismissed) */}
        {browserPermission === 'default' && !promptDismissed && (
          <div className="px-4 py-2.5 bg-neutral-900 text-neutral-200 text-[11px] flex items-center justify-between gap-2">
            <span>Get instant browser alerts when your waitlisted size restocks?</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleEnableBrowserAlerts}
                className="px-2 py-1 bg-[#e11b23] hover:bg-[#c6171e] text-white font-semibold text-[10px] cursor-pointer"
              >
                Enable
              </button>
              <button
                type="button"
                onClick={handleDismissBrowserBanner}
                className="px-1.5 py-1 text-neutral-400 hover:text-white text-[10px] cursor-pointer"
              >
                Later
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'INBOX' ? (
            <>
              {unreadCount > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-600 hover:text-black cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all as read
                  </button>
                </div>
              )}

              {notifications.length === 0 ? (
                <div className="py-14 text-center space-y-2">
                  <PackageCheck className="w-8 h-8 text-neutral-300 mx-auto" />
                  <div className="text-xs font-semibold text-neutral-700">No notifications yet</div>
                  <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
                    When an out-of-stock size &amp; color you follow is restocked, your alert will appear here even if you were offline.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3.5 border transition ${
                      notif.isRead
                        ? 'bg-white border-neutral-200'
                        : 'bg-red-50/40 border-red-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {notif.productImage && (
                        <img
                          src={notif.productImage}
                          alt={notif.productName || 'Product'}
                          className="w-12 h-14 object-cover border border-neutral-200 shrink-0 bg-neutral-100"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-neutral-900 truncate">
                            {notif.title}
                          </span>
                          {!notif.isRead && (
                            <span className="w-2 h-2 rounded-full bg-[#e11b23] shrink-0" />
                          )}
                        </div>

                        {(notif.size || notif.color) && (
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-mono">
                            {notif.size && (
                              <span className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-800 font-semibold">
                                Size {notif.size}
                              </span>
                            )}
                            {notif.color && (
                              <span className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-800 font-semibold">
                                {notif.color}
                              </span>
                            )}
                          </div>
                        )}

                        <p className="text-[11px] text-neutral-600 mt-1.5 leading-relaxed">
                          {notif.message}
                        </p>

                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-neutral-400 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(notif.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>

                          <div className="flex items-center gap-2">
                            {!notif.isRead && (
                              <button
                                type="button"
                                onClick={() => handleMarkRead(notif)}
                                className="text-[10px] font-semibold text-neutral-500 hover:text-black cursor-pointer"
                              >
                                Mark read
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenProductFromNotif(notif)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-black hover:bg-neutral-800 text-white text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                            >
                              <span>Shop Now</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          ) : loadingWaitlist ? (
            <div className="py-12 text-center text-xs text-neutral-500">Loading your restock alerts...</div>
          ) : waitlist.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <Bell className="w-8 h-8 text-neutral-300 mx-auto" />
              <div className="text-xs font-semibold text-neutral-700">No active restock alerts</div>
              <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
                Click &ldquo;Notify Me When Back in Stock&rdquo; on any sold-out size &amp; color to join its waitlist.
              </p>
            </div>
          ) : (
            waitlist.map((sub) => (
              <div key={sub.id} className="p-3.5 border border-neutral-200 bg-white space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-neutral-900">{sub.productName}</div>
                    <div className="text-[11px] font-mono text-neutral-600 mt-0.5">
                      Size {sub.size} · {sub.color}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 uppercase ${
                      sub.status === 'ACTIVE'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : sub.status === 'NOTIFIED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : sub.status === 'CANCELLED'
                            ? 'bg-neutral-100 text-neutral-500'
                            : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {sub.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-neutral-600">
                  {sub.whatsappConsent && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700">WhatsApp</span>}
                  {sub.websiteEnabled && <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-700">Website Inbox</span>}
                  {sub.emailBackupEnabled && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700">Email Backup</span>}
                </div>

                {sub.status === 'ACTIVE' && (
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleCancelWaitlist(sub.id)}
                      className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 font-medium cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Cancel Alert
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
