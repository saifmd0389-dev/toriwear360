import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminDataContext';
import {
  Settings,
  Save,
  Key,
  Truck,
  Percent,
  Building2,
  Lock,
  CreditCard,
} from 'lucide-react';
import { LogisticsPartnersManager } from './logistics/LogisticsPartnersManager';
import { RazorpayConfigView } from './payments/RazorpayConfigView';
import { PaymentGatewaysManager } from './payments/PaymentGatewaysManager';
import { ApiIntegrationsManager } from './integrations/ApiIntegrationsManager';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings } = useAdmin();

  const [activeTab, setActiveTab] = useState<'LOGISTICS' | 'GATEWAYS' | 'INTEGRATIONS' | 'GENERAL'>('GATEWAYS');
  const [gatewaySubTab, setGatewaySubTab] = useState<'GATEWAYS_LIST' | 'RAZORPAY_DETAIL'>('GATEWAYS_LIST');
  const [form, setForm] = useState(settings);

  // Sync form when global settings update
  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(form);
  };

  const handleToggleMaintenance = (targetValue?: boolean) => {
    const nextVal = typeof targetValue === 'boolean' ? targetValue : !form.maintenanceMode;
    setForm(prev => ({ ...prev, maintenanceMode: nextVal }));
    updateSettings({ maintenanceMode: nextVal });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-neutral-400" />
            <span>Store Configuration, Indian GST & API Integrations</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Configure legal business info, shipping rates, Indian tax compliance, and gateway webhooks.
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
          <span>Payments & Gateways</span>
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
          <span>Shipping & Logistics → Logistics Partners</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('INTEGRATIONS')}
          className={`px-3.5 py-2 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'INTEGRATIONS'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>API & Integrations</span>
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
          <span>General, Legal & Indian GST</span>
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
              All Payment Gateways & APIs
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
              Razorpay Dedicated Configuration & Webhook Keys
            </button>
          </div>

          {gatewaySubTab === 'GATEWAYS_LIST' ? (
            <PaymentGatewaysManager />
          ) : (
            <RazorpayConfigView />
          )}
        </div>
      )}

      {activeTab === 'LOGISTICS' && (
        <LogisticsPartnersManager />
      )}

      {activeTab === 'INTEGRATIONS' && <ApiIntegrationsManager />}

      {activeTab === 'GENERAL' && (
        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* Section 1: Business Identity & Legal */}
        <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-4">
          <div className="border-b border-neutral-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-red-500" />
                <span>Legal Entity & Store Identity</span>
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
                onChange={(e) => setForm(prev => ({ ...prev, storeName: e.target.value }))}
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
                onChange={(e) => setForm(prev => ({ ...prev, legalBusinessName: e.target.value }))}
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
                onChange={(e) => setForm(prev => ({ ...prev, gstNumber: e.target.value }))}
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
                onChange={(e) => setForm(prev => ({ ...prev, supportEmail: e.target.value }))}
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
              <span>Indian GST Tax Compliance & HSN Slabs</span>
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
                onChange={(e) => setForm(prev => ({ ...prev, defaultGstRate: Number(e.target.value) }))}
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
                onChange={(e) => setForm(prev => ({ ...prev, hsnCode: e.target.value }))}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
              />
              <p className="text-[10px] text-neutral-500 mt-1">6109 (Cotton knitted/crocheted tees)</p>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="prices-inc-tax"
                checked={form.taxInclusivePricing}
                onChange={(e) => setForm(prev => ({ ...prev, taxInclusivePricing: e.target.checked }))}
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
              <span>Shipping Rates & Cash on Delivery (COD) Surcharge</span>
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
                onChange={(e) => setForm(prev => ({ ...prev, freeShippingThreshold: Number(e.target.value) }))}
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
                onChange={(e) => setForm(prev => ({ ...prev, standardShippingFee: Number(e.target.value) }))}
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
                onChange={(e) => setForm(prev => ({ ...prev, codFee: Number(e.target.value) }))}
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
                <span>Payment Gateways & Courier Logistics APIs</span>
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
                  <span className="font-bold text-white">Payment Gateways & Checkout APIs</span>
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
                Open Payments & Gateways Tab →
              </button>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-white">Courier Logistics & Aggregator APIs</span>
                </div>
                <p className="text-neutral-400 text-[11px]">
                  Configure Shiprocket, Delhivery B2C, BlueDart, XpressBees & DTDC official carrier endpoints.
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
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              form.maintenanceMode ? 'bg-red-600/20 text-red-400 border border-red-500/30' : 'bg-neutral-800 text-neutral-400'
            }`}>
              <Lock className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm">Storefront Maintenance Mode</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                  form.maintenanceMode 
                    ? 'bg-red-600 text-white animate-pulse' 
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {form.maintenanceMode ? 'LOCKED: "DROPPING SOON" ACTIVE' : 'LIVE ONLINE: PUBLIC'}
                </span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                When enabled, customer storefront displays <strong className="text-neutral-200">"Dropping Soon / Upgrades in Progress"</strong>.
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-auto shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Visual Toggle Pill Button */}
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

            {/* Standard Checkbox sync */}
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
    </div>
  );
};
