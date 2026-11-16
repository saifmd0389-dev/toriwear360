import React, { useState, useEffect } from 'react';
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Sliders,
  Save,
  Key,
  Globe,
  Copy,
  Zap,
  MapPin,
  Clock,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { getSessionToken } from '../../services/platformService';

function getAdminAuthHeaders(): HeadersInit {
  const token = getSessionToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export interface LogisticsPartnerUI {
  id: string;
  carrierKey: string;
  name: string;
  logo: string;
  isEnabled: boolean;
  isDefault: boolean;
  environment: 'SANDBOX' | 'PRODUCTION';
  apiEndpoint?: string;
  apiKey?: string;
  apiSecret?: string;
  apiToken?: string;
  merchantId?: string;
  pickupWarehousePin: string;
  trackingUrlTemplate: string;
  webhookSecret?: string;
  priorityOrder: number;
  capabilities: string[];
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'FAILED' | 'AWAITING_CREDENTIALS' | 'NEEDS_CONFIGURATION';
  lastHealthCheck?: string;
  lastErrorMessage?: string;
  testLatencyMs?: number;
}

export interface GlobalLogisticsSettingsUI {
  allocationStrategy: 'MANUAL' | 'CHEAPEST' | 'FASTEST' | 'PREFERRED_PRIORITY' | 'RULE_BASED';
  defaultOriginPin: string;
  pickupWarehouseName?: string;
  pickupWarehouseAddress?: string;
  pickupWarehouseCity?: string;
  pickupWarehouseState?: string;
  pickupWarehousePin?: string;
  pickupWarehousePhone?: string;
  autoManifestOnPaid: boolean;
  notifyCustomerOnDispatch: boolean;
  preferredCarrierPriority: string[];
  weightBufferGrams: number;
}

export interface RateQuoteUI {
  carrierKey: string;
  carrierName: string;
  serviceCode: string;
  serviceName: string;
  rate: number;
  estimatedDays: number;
  isCodAvailable: boolean;
  isFastest?: boolean;
  isCheapest?: boolean;
}

export const LogisticsPartnersManager: React.FC = () => {
  const [partners, setPartners] = useState<LogisticsPartnerUI[]>([]);
  const [settings, setSettings] = useState<GlobalLogisticsSettingsUI>({
    allocationStrategy: 'CHEAPEST',
    defaultOriginPin: '',
    pickupWarehouseName: 'Primary Fulfillment Facility',
    pickupWarehouseAddress: '',
    pickupWarehouseCity: '',
    pickupWarehouseState: '',
    pickupWarehousePin: '',
    pickupWarehousePhone: '',
    autoManifestOnPaid: false,
    notifyCustomerOnDispatch: true,
    preferredCarrierPriority: ['SHIPROCKET', 'DELHIVERY', 'BLUEDART', 'DTDC', 'XPRESSBEES', 'ECOM_EXPRESS', 'INDIA_POST'],
    weightBufferGrams: 50,
  });

  const [loading, setLoading] = useState(true);
  const [testingPartnerId, setTestingPartnerId] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<LogisticsPartnerUI | null>(null);
  const [partnerEditForm, setPartnerEditForm] = useState<Partial<LogisticsPartnerUI>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add Courier Modal state
  const [isAddCourierModalOpen, setIsAddCourierModalOpen] = useState(false);
  const [isCreatingCourier, setIsCreatingCourier] = useState(false);
  const [newCourierForm, setNewCourierForm] = useState({
    carrierKey: '',
    name: '',
    logo: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100&auto=format&fit=crop&q=80',
    environment: 'SANDBOX' as 'SANDBOX' | 'PRODUCTION',
    apiEndpoint: '',
    apiKey: '',
    apiSecret: '',
    apiToken: '',
    merchantId: '',
    pickupWarehousePin: '400001',
    trackingUrlTemplate: 'https://track.carrier.com?awb={{awb}}',
    priorityOrder: 10,
    capabilities: ['FORWARD_SURFACE', 'COD_VERIFIED', 'LABEL_GENERATION', 'TRACKING_WEBHOOK'],
  });

  // Remove Courier Modal state
  const [deletingPartner, setDeletingPartner] = useState<LogisticsPartnerUI | null>(null);
  const [isDeletingPartner, setIsDeletingPartner] = useState(false);

  // Rate calculator / Serviceability simulation state
  const [testPin, setTestPin] = useState('400001'); // Mumbai Default
  const [testWeight, setTestWeight] = useState(350); // 350g single 240+ GSM heavyweight tee
  const [testCod, setTestCod] = useState(false);
  const [calculatingRates, setCalculatingRates] = useState(false);
  const [liveRateQuotes, setLiveRateQuotes] = useState<RateQuoteUI[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchLogistics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/admin/logistics/partners', {
        headers: getAdminAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setPartners(data.data.partners || []);
        if (data.data.settings) setSettings(data.data.settings);
      }
    } catch (e) {
      console.error('Failed to load logistics partners:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogistics();
  }, []);

  const handleTogglePartner = async (id: string, currentState: boolean) => {
    try {
      const res = await fetch(`/api/v1/admin/logistics/partners/${id}/toggle`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({ isEnabled: !currentState }),
      });
      const data = await res.json();
      if (data.success) {
        setPartners(prev => prev.map(p => p.id === id ? { ...p, isEnabled: !currentState } : p));
        showToast(data.message || 'Status updated');
      } else {
        showToast(data.error || 'Failed to toggle status');
      }
    } catch (e) {
      showToast('Network error updating status');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/admin/logistics/partners/${id}/default`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setPartners(prev => prev.map(p => ({
          ...p,
          isDefault: p.id === id,
          isEnabled: p.id === id ? true : p.isEnabled,
        })));
        showToast('Default carrier updated successfully');
      }
    } catch {
      showToast('Failed to set default carrier');
    }
  };

  const handleTestConnection = async (partner: LogisticsPartnerUI) => {
    try {
      setTestingPartnerId(partner.id);
      const res = await fetch(`/api/v1/admin/logistics/partners/${partner.id}/test`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setPartners(prev => prev.map(p => p.id === partner.id ? {
          ...p,
          healthStatus: 'HEALTHY',
          testLatencyMs: data.data.latencyMs,
          lastErrorMessage: undefined,
          lastHealthCheck: new Date().toISOString(),
        } : p));
        showToast(`Connected to ${partner.name}! Latency: ${data.data.latencyMs}ms`);
      } else {
        setPartners(prev => prev.map(p => p.id === partner.id ? {
          ...p,
          healthStatus: 'FAILED',
          lastErrorMessage: data.data?.message || data.error || 'Connection failed',
        } : p));
        showToast(`Connection failed: ${data.data?.message || data.error || 'Check credentials'}`);
      }
    } catch {
      showToast('Failed to reach carrier endpoint');
    } finally {
      setTestingPartnerId(null);
    }
  };

  const handleSavePartnerModal = async () => {
    if (!selectedPartner) return;
    try {
      const res = await fetch(`/api/v1/admin/logistics/partners/${selectedPartner.id}`, {
        method: 'PUT',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify(partnerEditForm),
      });
      const data = await res.json();
      if (data.success) {
        setPartners(prev => prev.map(p => p.id === selectedPartner.id ? { ...p, ...data.data } : p));
        showToast(`${selectedPartner.name} settings saved`);
        setSelectedPartner(null);
      } else {
        showToast(data.error || 'Failed to save configuration');
      }
    } catch {
      showToast('Error saving partner configuration');
    }
  };

  const handleSaveGlobalSettings = async () => {
    try {
      const res = await fetch('/api/v1/admin/logistics/settings', {
        method: 'PUT',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Logistics allocation strategy & warehouse settings updated');
      } else {
        showToast(data.error || 'Failed to save settings');
      }
    } catch {
      showToast('Failed to save settings');
    }
  };

  const handleCreateCourier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourierForm.carrierKey || !newCourierForm.name) {
      showToast('Carrier Key and Courier Name are required.');
      return;
    }
    setIsCreatingCourier(true);
    try {
      const res = await fetch('/api/v1/admin/logistics/partners', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify(newCourierForm),
      }).then(r => r.json());

      if (res.success) {
        showToast(`Courier "${newCourierForm.name}" registered successfully.`);
        setIsAddCourierModalOpen(false);
        setNewCourierForm({
          carrierKey: '',
          name: '',
          logo: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100&auto=format&fit=crop&q=80',
          environment: 'SANDBOX',
          apiEndpoint: '',
          apiKey: '',
          apiSecret: '',
          apiToken: '',
          merchantId: '',
          pickupWarehousePin: '400001',
          trackingUrlTemplate: 'https://track.carrier.com?awb={{awb}}',
          priorityOrder: 10,
          capabilities: ['FORWARD_SURFACE', 'COD_VERIFIED', 'LABEL_GENERATION', 'TRACKING_WEBHOOK'],
        });
        fetchLogistics();
      } else {
        showToast(res.error || 'Failed to register courier.');
      }
    } catch (err: any) {
      showToast(err.message || 'Error registering courier.');
    } finally {
      setIsCreatingCourier(false);
    }
  };

  const handleDeleteCourier = async () => {
    if (!deletingPartner) return;
    setIsDeletingPartner(true);
    try {
      const res = await fetch(`/api/v1/admin/logistics/partners/${deletingPartner.id}`, {
        method: 'DELETE',
        headers: getAdminAuthHeaders(),
      }).then(r => r.json());

      if (res.success) {
        showToast(`Carrier integration "${deletingPartner.name}" removed successfully.`);
        setDeletingPartner(null);
        fetchLogistics();
      } else {
        showToast(res.error || 'Failed to delete carrier integration.');
      }
    } catch (err: any) {
      showToast(err.message || 'Error removing carrier integration.');
    } finally {
      setIsDeletingPartner(false);
    }
  };

  const handleCalculateRates = async () => {
    if (!testPin || testPin.length !== 6) {
      showToast('Please enter a valid 6-digit Indian PIN code');
      return;
    }
    try {
      setCalculatingRates(true);
      const res = await fetch('/api/v1/admin/logistics/rates', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({
          destinationPin: testPin,
          weightGrams: testWeight,
          cod: testCod,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLiveRateQuotes(data.data || []);
        showToast(`Compared rates across ${data.data?.length || 0} active courier services`);
      } else {
        showToast(data.error || 'Rate calculation failed');
      }
    } catch {
      showToast('Error comparing courier rates');
    } finally {
      setCalculatingRates(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#14141c] border border-red-500/50 shadow-xl shadow-black/80 text-white text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Zap className="w-4 h-4 text-red-500 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-[#101016] border border-neutral-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-red-600/10 to-transparent pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-red-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LOGISTICS CONTROL ENGINE • 8 COURIER INTEGRATIONS</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight uppercase flex items-center gap-3">
              <Truck className="w-7 h-7 text-red-600" />
              <span>Multi-Logistics Partner Management</span>
            </h1>
            <p className="text-xs text-neutral-400 max-w-2xl mt-1">
              Connect and automate Shiprocket, Delhivery, Blue Dart, DTDC, Xpressbees, Ecom Express, and India Post.
              Run automated cheapest/fastest rate allocation, instant AWB generation, and webhook tracking sync.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                partners.forEach(p => {
                  if (p.isEnabled) handleTestConnection(p);
                });
              }}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 text-neutral-400" />
              <span>Test Active Connections</span>
            </button>

            <button
              onClick={handleSaveGlobalSettings}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 transition-colors shadow-lg shadow-red-600/30 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Logistics Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Allocation Strategy & Warehouse Configuration */}
      <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-4">
        <div className="border-b border-neutral-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-red-500" />
              <span>Dynamic Carrier Selection & Warehouse Dispatch Hub</span>
            </h2>
            <p className="text-neutral-400 text-xs">Configure how orders choose shipping partners and set warehouse pickup location</p>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
            Dispatch Origin: <strong>{settings.pickupWarehousePin || settings.defaultOriginPin || 'Not Set'}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Carrier Allocation Strategy
            </label>
            <select
              value={settings.allocationStrategy}
              onChange={(e) => setSettings(prev => ({ ...prev, allocationStrategy: e.target.value as any }))}
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-medium focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="CHEAPEST">Cheapest Courier (Auto-minimize shipping cost)</option>
              <option value="FASTEST">Fastest Delivery (Auto-minimize transit days)</option>
              <option value="PREFERRED_PRIORITY">Preferred Carrier Priority (Waterfall Order)</option>
              <option value="MANUAL">Manual Operator Choice (Staff picks carrier at dispatch)</option>
            </select>
            <p className="text-[10px] text-neutral-500 mt-1">
              Applied automatically whenever an order is marked ready to dispatch.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Pickup Warehouse Name
            </label>
            <input
              type="text"
              value={settings.pickupWarehouseName || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, pickupWarehouseName: e.target.value }))}
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-medium focus:outline-none focus:border-red-500"
              placeholder="e.g. Primary Central Fulfillment Hub"
            />
            <p className="text-[10px] text-neutral-500 mt-1">
              Warehouse name registered on carrier portals for courier van pickups.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Origin PIN Code
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={settings.pickupWarehousePin || settings.defaultOriginPin || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings(prev => ({ ...prev, pickupWarehousePin: val, defaultOriginPin: val }));
                }}
                className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                placeholder="Enter 6-digit PIN code"
              />
            </div>
            <p className="text-[10px] text-neutral-500 mt-1">
              Pickup facility postal code used for carrier rate calculations.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2 border-t border-neutral-800/60">
          <div className="md:col-span-2">
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Warehouse Physical Address & City / State
            </label>
            <input
              type="text"
              value={settings.pickupWarehouseAddress || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, pickupWarehouseAddress: e.target.value }))}
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-medium focus:outline-none focus:border-red-500"
              placeholder="e.g. Facility No. 4, Industrial Logistics Estate, City, State"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Dispatch Contact Phone
            </label>
            <input
              type="text"
              value={settings.pickupWarehousePhone || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, pickupWarehousePhone: e.target.value }))}
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
              placeholder="+91 9XXXXXXXXX"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-neutral-800/60 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoManifestOnPaid}
              onChange={(e) => setSettings(prev => ({ ...prev, autoManifestOnPaid: e.target.checked }))}
              className="rounded bg-neutral-900 border-neutral-700 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
            />
            <span className="text-neutral-300 font-medium">Auto-manifest shipment on verified prepaid orders</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifyCustomerOnDispatch}
              onChange={(e) => setSettings(prev => ({ ...prev, notifyCustomerOnDispatch: e.target.checked }))}
              className="rounded bg-neutral-900 border-neutral-700 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
            />
            <span className="text-neutral-300 font-medium">Notify customer on AWB generation & carrier dispatch</span>
          </label>
        </div>
      </div>

      {/* 8 Integrated Logistics Partners Cards */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>Configured Carriers ({partners.length})</span>
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-400 font-mono">
              {partners.filter(p => p.isEnabled).length} active / {partners.length} integrated
            </span>
            <button
              type="button"
              onClick={() => setIsAddCourierModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-red-600/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Courier / REST API</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-neutral-400 bg-[#14141c] border border-neutral-800 rounded-2xl text-xs">
            Loading logistics partners and testing connectivity...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {partners.map((partner) => (
              <div
                key={partner.id}
                className={`bg-[#14141c] border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                  partner.isEnabled
                    ? 'border-neutral-800 hover:border-neutral-700 shadow-md'
                    : 'border-neutral-800/40 opacity-60 bg-[#121218]'
                }`}
              >
                <div>
                  {/* Top: Badges & Default Indicator */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      partner.environment === 'PRODUCTION'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {partner.environment}
                    </span>

                    {partner.isDefault ? (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        DEFAULT
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSetDefault(partner.id)}
                          className="text-[10px] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        >
                          Set Default
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingPartner(partner)}
                          title="Remove integration"
                          className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Logo & Name */}
                  <div className="flex items-start gap-3 mb-3">
                    <img
                      src={partner.logo}
                      alt={partner.name}
                      className="w-10 h-10 rounded-xl object-cover border border-neutral-800 bg-neutral-900 shrink-0"
                    />
                    <div>
                      <h3 className="font-bold text-white text-sm leading-tight">{partner.name}</h3>
                      <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                        Key: <span className="text-neutral-300">{partner.carrierKey}</span>
                      </div>
                    </div>
                  </div>

                  {/* Health & Ping Latency */}
                  <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-2.5 mb-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-400 uppercase font-mono">Status:</span>
                      <span className={`font-mono font-bold text-[10px] flex items-center gap-1 ${
                        partner.healthStatus === 'HEALTHY'
                          ? 'text-emerald-400'
                          : partner.healthStatus === 'FAILED'
                          ? 'text-red-400'
                          : 'text-amber-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          partner.healthStatus === 'HEALTHY'
                            ? 'bg-emerald-400'
                            : partner.healthStatus === 'FAILED'
                            ? 'bg-red-400'
                            : 'bg-amber-400'
                        }`} />
                        {partner.healthStatus === 'AWAITING_CREDENTIALS' || partner.healthStatus === 'NEEDS_CONFIGURATION'
                          ? 'NEEDS CONFIGURATION'
                          : partner.healthStatus === 'HEALTHY'
                          ? 'CONNECTED & VERIFIED'
                          : 'CONNECTION FAILED'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-400 uppercase font-mono">Gateway Ping:</span>
                      <span className="font-mono text-neutral-300 text-[10px]">
                        {partner.healthStatus === 'HEALTHY' && partner.testLatencyMs
                          ? `${partner.testLatencyMs}ms`
                          : partner.healthStatus === 'AWAITING_CREDENTIALS'
                          ? 'Awaiting Credentials'
                          : 'Offline'}
                      </span>
                    </div>
                  </div>

                  {/* Capabilities Tags */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {partner.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="space-y-2 pt-2 border-t border-neutral-800/80">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleTestConnection(partner)}
                      disabled={testingPartnerId === partner.id}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RotateCw className={`w-3 h-3 ${testingPartnerId === partner.id ? 'animate-spin text-red-500' : ''}`} />
                      <span>{testingPartnerId === partner.id ? 'Pinging...' : 'Test Ping'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedPartner(partner);
                        setPartnerEditForm({
                          environment: partner.environment,
                          apiEndpoint: partner.apiEndpoint,
                          pickupWarehousePin: partner.pickupWarehousePin,
                          trackingUrlTemplate: partner.trackingUrlTemplate,
                          apiKey: '',
                          apiSecret: '',
                          apiToken: '',
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Key className="w-3 h-3 text-amber-500" />
                      <span>Config API</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleTogglePartner(partner.id, partner.isEnabled)}
                    className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      partner.isEnabled
                        ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800'
                        : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    <span>{partner.isEnabled ? 'Deactivate Courier' : 'Activate Courier'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interactive PIN Serviceability & Rate Comparison Simulator */}
      <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-4">
        <div className="border-b border-neutral-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Live India Postal PIN Serviceability & Courier Rate Simulator</span>
            </h2>
            <p className="text-neutral-400 text-xs">
              Simulate customer checkout freight quotes and dispatch SLA across active logistics carriers
            </p>
          </div>
          <span className="text-[10px] font-mono text-neutral-400">
            Dispatch Origin: <strong>{settings.pickupWarehousePin || settings.defaultOriginPin || 'Not Configured'} {settings.pickupWarehouseCity ? `(${settings.pickupWarehouseCity})` : ''}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Destination PIN Code
            </label>
            <input
              type="text"
              maxLength={6}
              value={testPin}
              onChange={(e) => setTestPin(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 400001"
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Package Weight (Grams)
            </label>
            <input
              type="number"
              step={50}
              value={testWeight}
              onChange={(e) => setTestWeight(Number(e.target.value))}
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="test-cod-box"
              checked={testCod}
              onChange={(e) => setTestCod(e.target.checked)}
              className="rounded bg-neutral-900 border-neutral-700 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="test-cod-box" className="text-neutral-300 cursor-pointer">
              Cash on Delivery (COD) Required
            </label>
          </div>

          <div className="pt-5">
            <button
              onClick={handleCalculateRates}
              disabled={calculatingRates}
              className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md shadow-red-600/20 cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${calculatingRates ? 'animate-spin' : ''}`} />
              <span>{calculatingRates ? 'Calculating...' : 'Compare Live Rates'}</span>
            </button>
          </div>
        </div>

        {/* Comparison Table */}
        {liveRateQuotes.length > 0 && (
          <div className="border border-neutral-800 rounded-xl overflow-hidden mt-4">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-neutral-900 text-neutral-400 text-[10px] uppercase font-mono border-b border-neutral-800">
                <tr>
                  <th className="p-3">Courier Provider</th>
                  <th className="p-3">Service Tier</th>
                  <th className="p-3">Transit Time</th>
                  <th className="p-3">COD Available</th>
                  <th className="p-3 text-right">Freight Rate (₹)</th>
                  <th className="p-3 text-center">Badges</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {liveRateQuotes.map((q, idx) => (
                  <tr key={`${q.serviceCode}-${idx}`} className="hover:bg-neutral-800/30">
                    <td className="p-3 font-semibold text-white flex items-center gap-2">
                      <Truck className="w-4 h-4 text-neutral-400" />
                      <span>{q.carrierName}</span>
                    </td>
                    <td className="p-3 font-mono text-neutral-300">{q.serviceName}</td>
                    <td className="p-3 font-mono">
                      <span className="flex items-center gap-1 text-sky-400">
                        <Clock className="w-3 h-3" />
                        {q.estimatedDays} {q.estimatedDays === 1 ? 'day' : 'days'}
                      </span>
                    </td>
                    <td className="p-3 font-mono">
                      {q.isCodAvailable ? (
                        <span className="text-emerald-400">Yes</span>
                      ) : (
                        <span className="text-neutral-500">Prepaid Only</span>
                      )}
                    </td>
                    <td className="p-3 font-mono font-bold text-white text-right text-sm">
                      ₹{q.rate}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {q.isCheapest && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold font-mono">
                            LOWEST COST
                          </span>
                        )}
                        {q.isFastest && (
                          <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] font-bold font-mono">
                            FASTEST
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Webhook Endpoints & Automated Synchronization */}
      <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-4">
        <div className="border-b border-neutral-800 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-500" />
            <span>Automated Courier Webhook Endpoints (Status & RTO Automation)</span>
          </h2>
          <p className="text-neutral-400 text-xs">
            Copy these URLs into your carrier dashboards (Delhivery, Shiprocket, Blue Dart) to receive real-time parcel updates
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {[
            { carrier: 'Shiprocket', slug: 'shiprocket', desc: 'Auto-updates In-Transit, Out-for-Delivery, and auto-restocks on RTO' },
            { carrier: 'Delhivery Express', slug: 'delhivery', desc: 'Real-time scan event ingestion and delivery confirmation timestamps' },
            { carrier: 'Blue Dart Apex', slug: 'bluedart', desc: 'Apex express flight manifests and POD delivery receipts' },
            { carrier: 'Universal Webhook Gateway', slug: 'universal', desc: 'DTDC, Xpressbees, and Ecom Express status sync' },
          ].map((hook) => {
            const url = `${window.location.origin}/api/v1/shipping/webhook/${hook.slug}`;
            return (
              <div key={hook.slug} className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between text-white font-bold">
                  <span>{hook.carrier}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(url);
                      showToast(`Copied ${hook.carrier} webhook URL`);
                    }}
                    className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                    title="Copy URL"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[11px] text-red-400 truncate bg-black/40 px-2.5 py-1.5 rounded border border-neutral-800">
                  {url}
                </div>
                <div className="text-[10px] text-neutral-400 font-sans">
                  {hook.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Partner API Credentials Modal */}
      {selectedPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#14141c] border border-neutral-700 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-3">
                <img src={selectedPartner.logo} alt="" className="w-8 h-8 rounded-lg object-cover" />
                <div>
                  <h3 className="font-bold text-white text-sm">{selectedPartner.name}</h3>
                  <p className="text-[10px] text-neutral-400 font-mono">Configure API credentials & endpoints</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPartner(null)}
                className="text-neutral-400 hover:text-white text-xs cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Environment
                </label>
                <select
                  value={partnerEditForm.environment || 'SANDBOX'}
                  onChange={(e) => setPartnerEditForm(prev => ({ ...prev, environment: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="SANDBOX">Sandbox / Testing Mode</option>
                  <option value="PRODUCTION">Production / Live Commercial Mode</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  API Gateway Endpoint URL
                </label>
                <input
                  type="text"
                  value={partnerEditForm.apiEndpoint || ''}
                  onChange={(e) => setPartnerEditForm(prev => ({ ...prev, apiEndpoint: e.target.value }))}
                  placeholder="https://api.carrier.com/v1"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  API Key / Client ID / Customer Code
                </label>
                <input
                  type="password"
                  value={partnerEditForm.apiKey || ''}
                  onChange={(e) => setPartnerEditForm(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="Enter new API key or leave blank to keep existing"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  API Secret / License Key / Bearer Token
                </label>
                <input
                  type="password"
                  value={partnerEditForm.apiSecret || ''}
                  onChange={(e) => setPartnerEditForm(prev => ({ ...prev, apiSecret: e.target.value }))}
                  placeholder="Enter secret token or leave blank to keep existing"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Pickup Warehouse PIN Code
                </label>
                <input
                  type="text"
                  value={partnerEditForm.pickupWarehousePin || ''}
                  onChange={(e) => setPartnerEditForm(prev => ({ ...prev, pickupWarehousePin: e.target.value }))}
                  placeholder={settings.pickupWarehousePin || settings.defaultOriginPin || 'Enter 6-digit origin PIN'}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Public Tracking URL Template
                </label>
                <input
                  type="text"
                  value={partnerEditForm.trackingUrlTemplate || ''}
                  onChange={(e) => setPartnerEditForm(prev => ({ ...prev, trackingUrlTemplate: e.target.value }))}
                  placeholder="https://track.carrier.com/{awb}"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedPartner(null)}
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePartnerModal}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/30 cursor-pointer"
              >
                Save Credentials
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Courier Modal */}
      {isAddCourierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#14141c] border border-neutral-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-bold text-white">Add New Logistics Partner / REST API</h3>
              </div>
              <button onClick={() => setIsAddCourierModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourier} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Carrier Unique Key *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCourierForm.carrierKey}
                    onChange={(e) => setNewCourierForm(prev => ({ ...prev, carrierKey: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                    placeholder="e.g. BLUEDART, TRACKON, CUSTOM_REST"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCourierForm.name}
                    onChange={(e) => setNewCourierForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. BlueDart Express, Custom Fast Courier"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Environment
                  </label>
                  <select
                    value={newCourierForm.environment}
                    onChange={(e) => setNewCourierForm(prev => ({ ...prev, environment: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="SANDBOX">Sandbox / Testing</option>
                    <option value="PRODUCTION">Production / Live</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Logo Image URL
                  </label>
                  <input
                    type="text"
                    value={newCourierForm.logo}
                    onChange={(e) => setNewCourierForm(prev => ({ ...prev, logo: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Base API Endpoint URL
                </label>
                <input
                  type="text"
                  value={newCourierForm.apiEndpoint}
                  onChange={(e) => setNewCourierForm(prev => ({ ...prev, apiEndpoint: e.target.value }))}
                  placeholder="https://apiv2.carrier.com or https://express.api.com"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    API Key / Username / Client ID
                  </label>
                  <input
                    type="text"
                    value={newCourierForm.apiKey}
                    onChange={(e) => setNewCourierForm(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="API Key or login ID"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    API Secret / Password
                  </label>
                  <input
                    type="password"
                    value={newCourierForm.apiSecret}
                    onChange={(e) => setNewCourierForm(prev => ({ ...prev, apiSecret: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Pickup Origin PIN
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={newCourierForm.pickupWarehousePin}
                    onChange={(e) => setNewCourierForm(prev => ({ ...prev, pickupWarehousePin: e.target.value.replace(/\D/g, '') }))}
                    placeholder="400001"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Tracking URL Template
                  </label>
                  <input
                    type="text"
                    value={newCourierForm.trackingUrlTemplate}
                    onChange={(e) => setNewCourierForm(prev => ({ ...prev, trackingUrlTemplate: e.target.value }))}
                    placeholder="https://track.carrier.com?awb={{awb}}"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isCreatingCourier}
                  onClick={() => setIsAddCourierModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCourier}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-md shadow-red-600/30 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isCreatingCourier ? 'Registering...' : 'Register Courier Integration'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Courier Integration Confirmation Modal */}
      {deletingPartner && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#14141c] border border-red-500/50 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="text-sm font-bold text-white">Remove Courier Integration</h3>
              </div>
              <button 
                onClick={() => setDeletingPartner(null)} 
                disabled={isDeletingPartner}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 space-y-1">
              <div>Are you sure you want to permanently remove <strong>{deletingPartner.name}</strong> ({deletingPartner.carrierKey})?</div>
              <div className="text-[11px] text-neutral-400">
                Safeguard note: Integrations currently set as default or with active shipments in transit cannot be deleted.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                disabled={isDeletingPartner}
                onClick={() => setDeletingPartner(null)}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingPartner}
                onClick={handleDeleteCourier}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingPartner ? 'Removing...' : 'Confirm Remove Integration'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
