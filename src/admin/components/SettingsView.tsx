import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../AdminDataContext';
import { apiClient } from '../../services/apiClient';
import { ContactChannelItem, MetaBusinessConfig } from '../../types';
import {
  Settings,
  Save,
  Key,
  Truck,
  Percent,
  Building2,
  Lock,
  CreditCard,
  Globe,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Check,
  Copy,
  ShieldCheck,
  Share2,
  Loader2,
  Sparkles,
  Clock,
} from 'lucide-react';
import { LogisticsPartnersManager } from './logistics/LogisticsPartnersManager';
import { RazorpayConfigView } from './payments/RazorpayConfigView';
import { PaymentGatewaysManager } from './payments/PaymentGatewaysManager';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, showToast } = useAdmin();

  const [activeTab, setActiveTab] = useState<'LOGISTICS' | 'GATEWAYS' | 'GENERAL' | 'CONTACT_META'>('GATEWAYS');
  const [gatewaySubTab, setGatewaySubTab] = useState<'GATEWAYS_LIST' | 'RAZORPAY_DETAIL'>('GATEWAYS_LIST');
  const [form, setForm] = useState(settings);

  // Contact, Social & Meta Business state
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactStatusMsg, setContactStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedFeed, setCopiedFeed] = useState<'json' | 'xml' | null>(null);

  const [contactForm, setContactForm] = useState({
    storeName: settings.storeName || 'TORI WEAR',
    supportEmail: settings.supportEmail || 'care@toriwear.com',
    phone: settings.phone || '+91 98201 45112',
    operatingHours: settings.operatingHours || 'Mon - Sat: 10:00 AM - 8:00 PM IST',
    businessAddress: settings.businessAddress || '',
    returnWindowDays: settings.returnWindowDays || 7,
    whatsappNumber: '+91 98201 45112',
    whatsappMessage: settings.whatsappMessage || "Hey TORI-WEAR! I'd like help with my order / sizing.",
  });
  const [channels, setChannels] = useState<ContactChannelItem[]>([]);
  const [newChannelPlatform, setNewChannelPlatform] = useState('TELEGRAM');
  const [newChannelLabel, setNewChannelLabel] = useState('');
  const [newChannelUrl, setNewChannelUrl] = useState('');

  const [metaForm, setMetaForm] = useState<MetaBusinessConfig>({
    domainVerificationCode: '',
    pixelId: '',
    capiEnabled: false,
    capiTokenConfigured: false,
  });

  // Sync form when global settings update
  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const loadContactAndMeta = useCallback(async () => {
    setContactLoading(true);
    try {
      const [contactRes, metaRes] = await Promise.all([
        apiClient.getAdminStoreContact(),
        apiClient.getAdminMetaBusiness(),
      ]);

      if (contactRes.success && contactRes.data) {
        const d = contactRes.data;
        setContactForm({
          storeName: d.storeName || 'TORI WEAR',
          supportEmail: d.supportEmail || '',
          phone: d.phone || '',
          operatingHours: d.operatingHours || '',
          businessAddress: d.businessAddress || '',
          returnWindowDays: Number(d.returnWindowDays) || 7,
          whatsappNumber: d.whatsappNumber || d.phone || '',
          whatsappMessage: d.whatsappMessage || "Hey TORI-WEAR! I'd like help with my order / sizing.",
        });
        setChannels(
          (d.channels || [])
            .map((ch, i) => ({
              ...ch,
              url: ch.url || (ch as any).valueOrUrl || '',
              enabled: ch.enabled !== false && (ch as any).isEnabled !== false,
              displayOrder: Number.isFinite(Number(ch.displayOrder)) ? Number(ch.displayOrder) : i + 1,
            }))
            .sort((a, b) => a.displayOrder - b.displayOrder)
        );
      }

      if (metaRes.success && metaRes.data) {
        setMetaForm({
          domainVerificationCode: metaRes.data.domainVerificationCode || '',
          pixelId: metaRes.data.pixelId || '',
          capiEnabled: Boolean(metaRes.data.capiEnabled),
          capiTokenConfigured: Boolean(metaRes.data.capiTokenConfigured),
        });
      }
    } finally {
      setContactLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'CONTACT_META') {
      loadContactAndMeta();
    }
  }, [activeTab, loadContactAndMeta]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(form);
  };

  const handleToggleMaintenance = (targetValue?: boolean) => {
    const nextVal = typeof targetValue === 'boolean' ? targetValue : !form.maintenanceMode;
    setForm((prev) => ({ ...prev, maintenanceMode: nextVal }));
    updateSettings({ maintenanceMode: nextVal });
  };

  const handleToggleTwinCombo = (targetValue?: boolean) => {
    const current = form.twinComboEnabled !== false;
    const nextVal = typeof targetValue === 'boolean' ? targetValue : !current;
    setForm((prev) => ({ ...prev, twinComboEnabled: nextVal }));
    updateSettings({ twinComboEnabled: nextVal });
  };

  const handleToggleKidsComingSoon = (targetValue?: boolean) => {
    const current = Boolean(form.kidsComingSoon);
    const nextVal = typeof targetValue === 'boolean' ? targetValue : !current;
    setForm((prev) => ({ ...prev, kidsComingSoon: nextVal }));
    updateSettings({ kidsComingSoon: nextVal });
  };

  const handleMoveChannel = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= channels.length) return;
    setChannels((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next.map((c, idx) => ({ ...c, displayOrder: idx + 1 }));
    });
  };

  const handleAddCustomChannel = () => {
    const cleanLabel = newChannelLabel.trim();
    const cleanUrl = newChannelUrl.trim();
    if (!cleanLabel || !cleanUrl) {
      setContactStatusMsg({ type: 'error', text: 'Enter both a label and URL/contact value for the new channel.' });
      return;
    }
    setChannels((prev) => [
      ...prev,
      {
        id: `ch-custom-${Date.now()}`,
        platform: (newChannelPlatform || 'CUSTOM').toUpperCase(),
        label: cleanLabel,
        url: cleanUrl,
        enabled: true,
        displayOrder: prev.length + 1,
        isCustom: true,
      },
    ]);
    setNewChannelLabel('');
    setNewChannelUrl('');
    setContactStatusMsg(null);
  };

  const handleSaveContactAndMeta = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setContactSaving(true);
    setContactStatusMsg(null);
    try {
      const orderedChannels = channels.map((c, idx) => ({
        ...c,
        valueOrUrl: c.url,
        isEnabled: c.enabled,
        displayOrder: idx + 1,
      }));

      const [contactRes, metaRes] = await Promise.all([
        apiClient.adminUpdateStoreContact({
          storeName: contactForm.storeName,
          supportEmail: contactForm.supportEmail,
          phone: contactForm.phone,
          operatingHours: contactForm.operatingHours,
          businessAddress: contactForm.businessAddress,
          returnWindowDays: Math.max(1, Math.min(60, Number(contactForm.returnWindowDays) || 7)),
          whatsappNumber: contactForm.whatsappNumber,
          whatsappMessage: contactForm.whatsappMessage,
          channels: orderedChannels as any,
        }),
        apiClient.adminUpdateMetaBusiness({
          domainVerificationCode: metaForm.domainVerificationCode.trim(),
          pixelId: metaForm.pixelId.trim(),
          capiEnabled: metaForm.capiEnabled,
        }),
      ]);

      if (!contactRes.success || !metaRes.success) {
        const err = contactRes.error || metaRes.error || 'Failed to save Contact & Meta settings.';
        setContactStatusMsg({ type: 'error', text: err });
        showToast(err);
        return;
      }

      updateSettings({
        storeName: contactForm.storeName,
        supportEmail: contactForm.supportEmail,
        phone: contactForm.phone,
        operatingHours: contactForm.operatingHours,
        businessAddress: contactForm.businessAddress,
        returnWindowDays: Number(contactForm.returnWindowDays) || 7,
        whatsappMessage: contactForm.whatsappMessage,
        contactChannels: channels,
        metaBusiness: {
          domainVerificationCode: metaRes.data?.domainVerificationCode || metaForm.domainVerificationCode,
          pixelId: metaRes.data?.pixelId || metaForm.pixelId,
          capiEnabled: Boolean(metaRes.data?.capiEnabled),
          capiTokenConfigured: Boolean(metaRes.data?.capiTokenConfigured),
        },
      });

      if (metaRes.data) {
        setMetaForm({
          domainVerificationCode: metaRes.data.domainVerificationCode || '',
          pixelId: metaRes.data.pixelId || '',
          capiEnabled: Boolean(metaRes.data.capiEnabled),
          capiTokenConfigured: Boolean(metaRes.data.capiTokenConfigured),
        });
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tori_contact_updated'));
      }
      setContactStatusMsg({ type: 'success', text: 'Contact info, social channels, and Meta Business settings saved.' });
      showToast('Contact, Social & Meta Business settings saved.');
    } finally {
      setContactSaving(false);
    }
  };

  const handleCopyFeed = (type: 'json' | 'xml', url: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedFeed(type);
    setTimeout(() => setCopiedFeed(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-neutral-400" />
            <span>Store Configuration, Indian GST &amp; API Integrations</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Configure legal business info, contact channels, Meta Business integrations, shipping rates, and gateways.
          </p>
        </div>

        {activeTab === 'GENERAL' && (
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-md shadow-red-600/20 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save All Settings</span>
          </button>
        )}

        {activeTab === 'CONTACT_META' && (
          <button
            type="button"
            disabled={contactSaving}
            onClick={() => handleSaveContactAndMeta()}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-md shadow-red-600/20 cursor-pointer"
          >
            {contactSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Contact &amp; Meta Settings</span>
          </button>
        )}
      </div>

      {/* Settings Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 text-xs flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('GATEWAYS')}
          className={`px-3.5 py-2 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'GATEWAYS'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Payments &amp; Gateways</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('LOGISTICS')}
          className={`px-3.5 py-2 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'LOGISTICS'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Shipping &amp; Logistics → Logistics Partners</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('GENERAL')}
          className={`px-3.5 py-2 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'GENERAL'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>General, Legal &amp; Indian GST</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CONTACT_META')}
          className={`px-3.5 py-2 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'CONTACT_META'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Contact, Social &amp; Meta Business</span>
        </button>
      </div>

      {activeTab === 'GATEWAYS' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-[#14141c] p-1.5 rounded-xl border border-neutral-800 w-fit text-xs">
            <button
              type="button"
              onClick={() => setGatewaySubTab('GATEWAYS_LIST')}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                gatewaySubTab === 'GATEWAYS_LIST'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              All Payment Gateways &amp; APIs
            </button>
            <button
              type="button"
              onClick={() => setGatewaySubTab('RAZORPAY_DETAIL')}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                gatewaySubTab === 'RAZORPAY_DETAIL'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Razorpay Dedicated Configuration &amp; Webhook Keys
            </button>
          </div>

          {gatewaySubTab === 'GATEWAYS_LIST' ? (
            <PaymentGatewaysManager />
          ) : (
            <RazorpayConfigView />
          )}
        </div>
      )}

      {activeTab === 'LOGISTICS' && <LogisticsPartnersManager />}

      {activeTab === 'GENERAL' && (
        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          {/* Section 1: Business Identity & Legal */}
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-red-500" />
                  <span>Legal Entity &amp; Store Identity</span>
                </h3>
                <p className="text-neutral-400 text-xs">Appears on invoices, customer receipts, and courier labels</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                GST VERIFIED
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Storefront Public Name
                </label>
                <input
                  type="text"
                  value={form.storeName}
                  onChange={(e) => setForm((prev) => ({ ...prev, storeName: e.target.value }))}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Registered Company Legal Name
                </label>
                <input
                  type="text"
                  value={form.legalBusinessName}
                  onChange={(e) => setForm((prev) => ({ ...prev, legalBusinessName: e.target.value }))}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Indian GSTIN Number
                </label>
                <input
                  type="text"
                  value={form.gstNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, gstNumber: e.target.value }))}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono uppercase focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Customer Support Email
                </label>
                <input
                  type="email"
                  value={form.supportEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, supportEmail: e.target.value }))}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Indian GST Tax Compliance */}
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Percent className="w-4 h-4 text-emerald-500" />
                <span>Indian GST Tax Compliance &amp; HSN Slabs</span>
              </h3>
              <p className="text-neutral-400 text-xs">Standard apparel classification under CBIC India tax codes</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Default Apparel GST Rate (%)
                </label>
                <input
                  type="number"
                  value={form.defaultGstRate}
                  onChange={(e) => setForm((prev) => ({ ...prev, defaultGstRate: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                />
                <p className="text-[10px] text-neutral-500 mt-1">5% for cotton tees &lt; ₹1,000; 12% &gt; ₹1,000</p>
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Standard HSN Code for T-Shirts
                </label>
                <input
                  type="text"
                  value={form.hsnCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, hsnCode: e.target.value }))}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                />
                <p className="text-[10px] text-neutral-500 mt-1">6109 (Cotton knitted/crocheted tees)</p>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="prices-inc-tax"
                  checked={form.taxInclusivePricing}
                  onChange={(e) => setForm((prev) => ({ ...prev, taxInclusivePricing: e.target.checked }))}
                  className="rounded bg-neutral-900 border-neutral-700 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="prices-inc-tax" className="text-neutral-300 cursor-pointer">
                  Product catalog prices are GST-inclusive
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Shipping & COD Rules */}
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-sky-500" />
                <span>Shipping Rates &amp; Cash on Delivery (COD) Surcharge</span>
              </h3>
              <p className="text-neutral-400 text-xs">Automated delivery threshold calculations at checkout</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Free Shipping Cart Threshold (₹)
                </label>
                <input
                  type="number"
                  value={form.freeShippingThreshold}
                  onChange={(e) => setForm((prev) => ({ ...prev, freeShippingThreshold: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                />
                <p className="text-[10px] text-neutral-500 mt-1">Carts above this amount receive 100% free courier</p>
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Standard Shipping Fee (₹)
                </label>
                <input
                  type="number"
                  value={form.standardShippingFee}
                  onChange={(e) => setForm((prev) => ({ ...prev, standardShippingFee: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                />
                <p className="text-[10px] text-neutral-500 mt-1">Charged on orders below the free shipping limit</p>
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  COD Handling Surcharge (₹)
                </label>
                <input
                  type="number"
                  value={form.codFee}
                  onChange={(e) => setForm((prev) => ({ ...prev, codFee: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                />
                <p className="text-[10px] text-neutral-500 mt-1">Added only when customer selects Pay on Delivery</p>
              </div>
            </div>
          </div>

          {/* Section 4: External API Integrations Hub */}
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-500" />
                  <span>Payment Gateways &amp; Courier Logistics APIs</span>
                </h3>
                <p className="text-neutral-400 text-xs">Manage active merchant keys, Webhook secrets, and carrier API tokens</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                AES-256 ENCRYPTED
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-white">Payment Gateways &amp; Checkout APIs</span>
                  </div>
                  <p className="text-neutral-400 text-[11px]">
                    Configure Razorpay API Key ID, Secret, Webhook Secret, Cashfree, Stripe, or Custom Direct UPI.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('GATEWAYS')}
                  className="self-start px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors cursor-pointer"
                >
                  Open Payments &amp; Gateways Tab →
                </button>
              </div>

              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-white">Courier Logistics &amp; Aggregator APIs</span>
                  </div>
                  <p className="text-neutral-400 text-[11px]">
                    Configure Shiprocket, Delhivery B2C, BlueDart, XpressBees &amp; DTDC official carrier endpoints.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('LOGISTICS')}
                  className="self-start px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors cursor-pointer"
                >
                  Open Logistics Partners Tab →
                </button>
              </div>
            </div>
          </div>

          {/* Section 4b: Storefront Feature Launch Controls (Twin Combo & Shop for Kids Coming Soon) */}
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Storefront Feature Launch Controls</span>
              </h3>
              <p className="text-neutral-400 text-xs">
                Enable or disable upcoming storefront features live without touching code or product inventory.
              </p>
            </div>

            {/* Toggle 1: Men & Kid Twin Combo (-10%) */}
            <div
              onClick={() => handleToggleTwinCombo()}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none ${
                form.twinComboEnabled !== false
                  ? 'bg-emerald-950/20 border-emerald-600/40'
                  : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-start sm:items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    form.twinComboEnabled !== false
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">Men &amp; Kid Twin Combo (-10%)</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        form.twinComboEnabled !== false
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                      }`}
                    >
                      {form.twinComboEnabled !== false ? 'ENABLED: VISIBLE ON STOREFRONT' : 'DISABLED: HIDDEN'}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    Controls the <strong className="text-neutral-200">&ldquo;TRY MEN &amp; KID TWIN COMBO -10%&rdquo;</strong> badge on product cards, Hero CTA, and Twinning Spotlight.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.twinComboEnabled !== false}
                  onClick={() => handleToggleTwinCombo()}
                  className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer border ${
                    form.twinComboEnabled !== false
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                  }`}
                >
                  {form.twinComboEnabled !== false ? 'Enabled — Click to Disable' : 'Disabled — Click to Enable'}
                </button>
              </div>
            </div>

            {/* Toggle 2: Shop for Kids Coming Soon Mode */}
            <div
              onClick={() => handleToggleKidsComingSoon()}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none ${
                form.kidsComingSoon
                  ? 'bg-sky-950/30 border-sky-500/60'
                  : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-start sm:items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    form.kidsComingSoon
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">Shop for Kids — Coming Soon Mode</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        form.kidsComingSoon
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {form.kidsComingSoon ? 'COMING SOON ACTIVE' : 'LIVE CATALOG: PUBLIC'}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    When enabled, <strong className="text-neutral-200">Shop Kids</strong> shows a <strong className="text-neutral-200">&ldquo;Coming Soon&rdquo;</strong> badge and preview screen instead of the live Kids catalog.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(form.kidsComingSoon)}
                  onClick={() => handleToggleKidsComingSoon()}
                  className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer border ${
                    form.kidsComingSoon
                      ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                  }`}
                >
                  {form.kidsComingSoon ? 'Coming Soon ON — Click to Disable' : 'Coming Soon OFF — Click to Enable'}
                </button>
              </div>
            </div>
          </div>

          {/* Section 5: Maintenance Mode */}
          <div
            onClick={() => handleToggleMaintenance()}
            className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none ${
              form.maintenanceMode
                ? 'bg-red-950/40 border-red-600/70 shadow-lg shadow-red-950/50'
                : 'bg-[#14141c] border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  form.maintenanceMode ? 'bg-red-600/20 text-red-400 border border-red-500/30' : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                <Lock className="w-5 h-5" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-sm">Storefront Maintenance Mode</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      form.maintenanceMode
                        ? 'bg-red-600 text-white animate-pulse'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {form.maintenanceMode ? 'LOCKED: "DROPPING SOON" ACTIVE' : 'LIVE ONLINE: PUBLIC'}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  When enabled, customer storefront displays <strong className="text-neutral-200">&ldquo;Dropping Soon / Upgrades in Progress&rdquo;</strong>.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-auto shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(form.maintenanceMode)}
                onClick={() => handleToggleMaintenance()}
                className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  form.maintenanceMode ? 'bg-red-600' : 'bg-neutral-700'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    form.maintenanceMode ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>

              <input
                type="checkbox"
                id="storefront-maintenance-checkbox"
                checked={Boolean(form.maintenanceMode)}
                onChange={(e) => handleToggleMaintenance(e.target.checked)}
                className="rounded bg-neutral-900 border-red-700 text-red-600 focus:ring-red-500 w-5 h-5 cursor-pointer ml-1"
                aria-label="Toggle Storefront Maintenance Mode"
              />
            </div>
          </div>
        </form>
      )}

      {activeTab === 'CONTACT_META' && (
        <form onSubmit={handleSaveContactAndMeta} className="space-y-6 text-xs">
          {contactStatusMsg && (
            <div
              className={`p-3.5 rounded-xl border font-medium ${
                contactStatusMsg.type === 'success'
                  ? 'bg-emerald-950/50 border-emerald-600/50 text-emerald-200'
                  : 'bg-red-950/50 border-red-600/50 text-red-200'
              }`}
            >
              {contactStatusMsg.text}
            </div>
          )}

          {contactLoading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-neutral-400">
              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
              <span>Loading contact channels &amp; Meta Business configuration...</span>
            </div>
          ) : (
            <>
              {/* Business Contact & Return Window */}
              <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-4">
                <div className="border-b border-neutral-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-red-500" />
                    <span>Customer Support, WhatsApp Concierge &amp; Return Policy</span>
                  </h3>
                  <p className="text-neutral-400 text-xs">
                    Live values power the Contact popup, Support floating widget, Footer, and Customer return eligibility.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      Store Brand Name
                    </label>
                    <input
                      type="text"
                      value={contactForm.storeName}
                      onChange={(e) => setContactForm((p) => ({ ...p, storeName: e.target.value }))}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      Support Email
                    </label>
                    <input
                      type="email"
                      value={contactForm.supportEmail}
                      onChange={(e) => setContactForm((p) => ({ ...p, supportEmail: e.target.value }))}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      Support Phone
                    </label>
                    <input
                      type="text"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      WhatsApp Concierge Number
                    </label>
                    <input
                      type="text"
                      value={contactForm.whatsappNumber}
                      onChange={(e) => setContactForm((p) => ({ ...p, whatsappNumber: e.target.value }))}
                      placeholder="+91 98201 45112"
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      Operating Hours
                    </label>
                    <input
                      type="text"
                      value={contactForm.operatingHours}
                      onChange={(e) => setContactForm((p) => ({ ...p, operatingHours: e.target.value }))}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      Return Window (Days after delivery)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={contactForm.returnWindowDays}
                      onChange={(e) => setContactForm((p) => ({ ...p, returnWindowDays: Number(e.target.value) || 7 }))}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      Default WhatsApp Pre-filled Message
                    </label>
                    <input
                      type="text"
                      value={contactForm.whatsappMessage}
                      onChange={(e) => setContactForm((p) => ({ ...p, whatsappMessage: e.target.value }))}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      Atelier / Business Address
                    </label>
                    <input
                      type="text"
                      value={contactForm.businessAddress}
                      onChange={(e) => setContactForm((p) => ({ ...p, businessAddress: e.target.value }))}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Ordered Social & Contact Channels */}
              <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-4">
                <div className="border-b border-neutral-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-sky-400" />
                    <span>Ordered Social &amp; Contact Channels</span>
                  </h3>
                  <p className="text-neutral-400 text-xs">
                    Toggle visibility, edit URLs, reorder display position, or add custom channels.
                  </p>
                </div>

                <div className="space-y-2">
                  {channels.map((ch, idx) => (
                    <div
                      key={ch.id}
                      className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center"
                    >
                      <div className="md:col-span-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={ch.enabled !== false}
                          onChange={(e) =>
                            setChannels((prev) =>
                              prev.map((item) => (item.id === ch.id ? { ...item, enabled: e.target.checked } : item))
                            )
                          }
                          className="rounded bg-neutral-950 border-neutral-700 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 uppercase">
                          {ch.platform}
                        </span>
                      </div>

                      <div className="md:col-span-3">
                        <input
                          type="text"
                          value={ch.label}
                          onChange={(e) =>
                            setChannels((prev) =>
                              prev.map((item) => (item.id === ch.id ? { ...item, label: e.target.value } : item))
                            )
                          }
                          placeholder="Label"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-red-500"
                        />
                      </div>

                      <div className="md:col-span-5">
                        <input
                          type="text"
                          value={ch.url}
                          onChange={(e) =>
                            setChannels((prev) =>
                              prev.map((item) => (item.id === ch.id ? { ...item, url: e.target.value } : item))
                            )
                          }
                          placeholder="https://... or email/phone"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 font-mono text-white focus:outline-none focus:border-red-500"
                        />
                      </div>

                      <div className="md:col-span-2 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveChannel(idx, -1)}
                          className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-neutral-200 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === channels.length - 1}
                          onClick={() => handleMoveChannel(idx, 1)}
                          className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-neutral-200 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        {ch.isCustom && (
                          <button
                            type="button"
                            onClick={() => setChannels((prev) => prev.filter((item) => item.id !== ch.id))}
                            className="p-1.5 rounded bg-red-950/60 hover:bg-red-900/60 text-red-400 cursor-pointer"
                            title="Delete Custom Channel"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Custom Channel */}
                <div className="p-3.5 rounded-xl bg-neutral-900/50 border border-dashed border-neutral-700 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <select
                    value={newChannelPlatform}
                    onChange={(e) => setNewChannelPlatform(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-700 text-white"
                  >
                    <option value="TELEGRAM">Telegram</option>
                    <option value="THREADS">Threads</option>
                    <option value="REDDIT">Reddit</option>
                    <option value="TIKTOK">TikTok</option>
                    <option value="CUSTOM">Custom Link</option>
                  </select>
                  <input
                    type="text"
                    value={newChannelLabel}
                    onChange={(e) => setNewChannelLabel(e.target.value)}
                    placeholder="Channel Label (e.g. Community Telegram)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-700 text-white"
                  />
                  <input
                    type="text"
                    value={newChannelUrl}
                    onChange={(e) => setNewChannelUrl(e.target.value)}
                    placeholder="https://t.me/..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-700 font-mono text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomChannel}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Channel</span>
                  </button>
                </div>
              </div>

              {/* Meta Business Integration Panel */}
              <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-4">
                <div className="border-b border-neutral-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-400" />
                      <span>Meta Business Integration (Pixel, CAPI &amp; Catalog Feeds)</span>
                    </h3>
                    <p className="text-neutral-400 text-xs">
                      Connect https://thetoriwearstore.in to Meta Business Suite cleanly without exposing server secrets.
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold border self-start sm:self-auto ${
                      metaForm.capiTokenConfigured
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {metaForm.capiTokenConfigured
                      ? 'CAPI SERVER TOKEN: CONFIGURED'
                      : 'CAPI SERVER TOKEN: NOT SET IN ENV'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      Meta Domain Verification Code
                    </label>
                    <input
                      type="text"
                      value={metaForm.domainVerificationCode}
                      onChange={(e) => setMetaForm((p) => ({ ...p, domainVerificationCode: e.target.value }))}
                      placeholder="e.g. abc123xyz456domainverify"
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg font-mono text-white focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-[10px] text-neutral-500 mt-1">
                      Injected automatically into &lt;meta name=&ldquo;facebook-domain-verification&rdquo;&gt;.
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      Meta Pixel ID
                    </label>
                    <input
                      type="text"
                      value={metaForm.pixelId}
                      onChange={(e) => setMetaForm((p) => ({ ...p, pixelId: e.target.value }))}
                      placeholder="e.g. 102938475610293"
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg font-mono text-white focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-[10px] text-neutral-500 mt-1">
                      Fires PageView, ViewContent, AddToCart, InitiateCheckout &amp; Purchase with event_id deduplication.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                  <input
                    type="checkbox"
                    checked={metaForm.capiEnabled}
                    onChange={(e) => setMetaForm((p) => ({ ...p, capiEnabled: e.target.checked }))}
                    className="rounded bg-neutral-950 border-neutral-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <div>
                    <div className="font-semibold text-white">Enable Conversions API (CAPI) Server Relay</div>
                    <div className="text-[11px] text-neutral-400">
                      Requires server environment variable <code className="text-neutral-200">META_CONVERSIONS_API_TOKEN</code> (never stored or shown in browser UI).
                    </div>
                  </div>
                </label>

                {/* Catalog Feeds */}
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2.5">
                  <div className="font-bold text-neutral-200">Meta Commerce Manager Product Catalog Feeds</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800">
                      <code className="text-[11px] text-sky-300 truncate">
                        https://thetoriwearstore.in/api/v1/catalog/feed.json
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopyFeed('json', 'https://thetoriwearstore.in/api/v1/catalog/feed.json')}
                        className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer shrink-0"
                        title="Copy JSON Feed URL"
                      >
                        {copiedFeed === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800">
                      <code className="text-[11px] text-sky-300 truncate">
                        https://thetoriwearstore.in/api/v1/catalog/feed.xml
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopyFeed('xml', 'https://thetoriwearstore.in/api/v1/catalog/feed.xml')}
                        className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer shrink-0"
                        title="Copy XML RSS Feed URL"
                      >
                        {copiedFeed === 'xml' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-neutral-400 pt-1">
                    <strong>Checklist:</strong> 1) Paste Meta Domain Verification code &amp; click Save → 2) Verify <code className="text-neutral-300">thetoriwearstore.in</code> in Meta Business Settings → 3) Enter Pixel ID &amp; add <code className="text-neutral-300">META_CONVERSIONS_API_TOKEN</code> on GoDaddy → 4) Schedule daily XML/JSON catalog fetch in Commerce Manager.
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={contactSaving}
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    {contactSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>Save Contact, Social &amp; Meta Settings</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
};
