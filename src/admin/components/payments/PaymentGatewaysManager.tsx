import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  Copy,
  Check,
  ShieldAlert,
  Lock,
  Settings2,
  Zap,
  Radio,
  Eye,
  EyeOff,
} from 'lucide-react';
import { getSessionToken } from '../../services/platformService';

export interface PublicGatewayRecord {
  id: string;
  provider: 'RAZORPAY' | 'CASHFREE' | 'STRIPE' | 'CUSTOM_UPI';
  name: string;
  isEnabled: boolean;
  enabled?: boolean; // alias for backwards compatibility
  isDefault: boolean;
  environment: 'TEST' | 'LIVE';
  keyId: string;
  keyIdMasked?: string; // alias
  hasKeySecret: boolean;
  hasSecret?: boolean; // alias
  hasWebhookSecret: boolean;
  maskedKeySecret?: string;
  maskedWebhookSecret?: string;
  merchantId?: string;
  endpointUrl?: string;
  status: 'NOT_CONFIGURED' | 'CREDENTIALS_SAVED' | 'VERIFIED' | 'FAILED';
  connectionStatus?: 'NOT_CONFIGURED' | 'CREDENTIALS_SAVED' | 'VERIFIED' | 'FAILED'; // alias
  lastTestedAt?: string;
  lastLatencyMs?: number;
  lastErrorMessage?: string;
  webhookUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export const PaymentGatewaysManager: React.FC = () => {
  const [gateways, setGateways] = useState<PublicGatewayRecord[]>([]);
  const [, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeGateway, setActiveGateway] = useState<PublicGatewayRecord | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Form states
  const [formProvider, setFormProvider] = useState<'RAZORPAY' | 'CASHFREE' | 'STRIPE' | 'CUSTOM_UPI'>('RAZORPAY');
  const [formName, setFormName] = useState('Razorpay Gateway');
  const [formEnv, setFormEnv] = useState<'TEST' | 'LIVE'>('TEST');
  const [formKeyId, setFormKeyId] = useState('');
  const [formKeySecret, setFormKeySecret] = useState('');
  const [formWebhookSecret, setFormWebhookSecret] = useState('');
  const [formMerchantId, setFormMerchantId] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [confirmDeleteGatewayId, setConfirmDeleteGatewayId] = useState<string | null>(null);

  const getHeaders = () => {
    const token = getSessionToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const showNotification = (msg: string) => {
    setErrorToast(null);
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const showError = (msg: string) => {
    setSuccessToast(null);
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 5000);
  };

  const loadGateways = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/payments/gateways', { headers: getHeaders() });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const mapped: PublicGatewayRecord[] = data.data.map((gw: any) => {
          const isEnabled = typeof gw.isEnabled === 'boolean' ? gw.isEnabled : Boolean(gw.enabled);
          const rawKey = gw.keyId || '';
          const maskedKey = gw.maskedKeySecret || (rawKey ? (rawKey.length <= 4 ? '••••••••' : `••••••••${rawKey.slice(-4)}`) : 'Not set');
          const hasSecret = Boolean(gw.hasKeySecret ?? gw.hasSecret);
          const status = gw.status || gw.connectionStatus || 'NOT_CONFIGURED';

          return {
            ...gw,
            isEnabled,
            enabled: isEnabled,
            keyId: rawKey,
            keyIdMasked: maskedKey,
            hasKeySecret: hasSecret,
            hasSecret,
            status,
            connectionStatus: status,
          };
        });
        setGateways(mapped);
      } else {
        setError(data.error || 'Failed to load payment gateways');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to payment gateway service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGateways();
  }, []);

  const openAddModal = () => {
    setFormProvider('RAZORPAY');
    setFormName('Razorpay PG');
    setFormEnv('TEST');
    setFormKeyId('');
    setFormKeySecret('');
    setFormWebhookSecret('');
    setFormMerchantId('');
    setShowSecret(false);
    setIsAddModalOpen(true);
  };

  const openEditModal = (gw: PublicGatewayRecord) => {
    setActiveGateway(gw);
    setFormProvider(gw.provider);
    setFormName(gw.name);
    setFormEnv(gw.environment);
    setFormKeyId(gw.keyId || gw.keyIdMasked?.replace(/•/g, '') || '');
    setFormKeySecret('');
    setFormWebhookSecret('');
    setFormMerchantId(gw.merchantId || '');
    setShowSecret(false);
    setIsEditModalOpen(true);
  };

  const handleCreateGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKeyId.trim()) {
      showError('Key ID / Client ID is required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/admin/payments/gateways', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          provider: formProvider,
          name: formName || `${formProvider} Gateway`,
          environment: formEnv,
          keyId: formKeyId.trim(),
          keySecret: formKeySecret.trim(),
          webhookSecret: formWebhookSecret.trim() || undefined,
          merchantId: formMerchantId.trim() || undefined,
          enabled: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAddModalOpen(false);
        showNotification(`Payment Gateway "${data.data?.name || formName}" added successfully.`);
        await loadGateways();
      } else {
        showError(data.error || 'Failed to add payment gateway.');
      }
    } catch (err: any) {
      showError(err.message || 'Error creating gateway');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGateway) return;
    setIsSubmitting(true);
    try {
      const payload: any = {
        name: formName,
        environment: formEnv,
        merchantId: formMerchantId.trim() || undefined,
      };
      if (formKeyId.trim()) payload.keyId = formKeyId.trim();
      if (formKeySecret.trim()) payload.keySecret = formKeySecret.trim();
      if (formWebhookSecret.trim()) payload.webhookSecret = formWebhookSecret.trim();

      const res = await fetch(`/api/v1/admin/payments/gateways/${activeGateway.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setIsEditModalOpen(false);
        showNotification(`Payment Gateway "${formName}" updated successfully.`);
        await loadGateways();
      } else {
        showError(data.error || 'Failed to update gateway.');
      }
    } catch (err: any) {
      showError(err.message || 'Error updating gateway');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGateway = async (gw: PublicGatewayRecord) => {
    if (gw.isDefault) {
      showError('Cannot delete the primary/default payment gateway. Please assign another gateway as default first.');
      return;
    }
    setConfirmDeleteGatewayId(null);
    try {
      const res = await fetch(`/api/v1/admin/payments/gateways/${gw.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Gateway "${gw.name}" removed.`);
        await loadGateways();
      } else {
        showError(data.error || 'Failed to delete gateway.');
      }
    } catch (err: any) {
      showError(err.message || 'Error deleting gateway');
    }
  };

  const handleToggle = async (gw: PublicGatewayRecord) => {
    try {
      const nextState = !gw.isEnabled;
      const res = await fetch(`/api/v1/admin/payments/gateways/${gw.id}/toggle`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ enabled: nextState, isEnabled: nextState }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`${gw.name} is now ${nextState ? 'Enabled' : 'Disabled'}.`);
        await loadGateways();
      } else {
        showError(data.error || 'Failed to toggle status.');
      }
    } catch (err: any) {
      showError(err.message || 'Error toggling gateway');
    }
  };

  const handleSetDefault = async (gw: PublicGatewayRecord) => {
    try {
      const res = await fetch(`/api/v1/admin/payments/gateways/${gw.id}/default`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`${gw.name} is now the primary gateway for customer checkouts.`);
        await loadGateways();
      } else {
        showError(data.error || 'Failed to set default gateway.');
      }
    } catch (err: any) {
      showError(err.message || 'Error setting default');
    }
  };

  const handleTestConnection = async (gw: PublicGatewayRecord) => {
    setTestingId(gw.id);
    try {
      const res = await fetch(`/api/v1/admin/payments/gateways/${gw.id}/test`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Ping Successful! ${gw.name} verified (${data.latencyMs || 0}ms response).`);
      } else {
        showError(`Connection Failed: ${data.message || data.error || 'Unable to authenticate with gateway provider.'}`);
      }
      await loadGateways();
    } catch (err: any) {
      showError(`Network error testing connection: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const copyWebhookUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/api/v1/payments/webhook`;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const getProviderBadge = (provider: string) => {
    switch (provider) {
      case 'RAZORPAY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">RAZORPAY</span>;
      case 'CASHFREE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">CASHFREE</span>;
      case 'STRIPE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">STRIPE</span>;
      case 'CUSTOM_UPI':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">DIRECT UPI</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300">GATEWAY</span>;
    }
  };

  const defaultGateway = gateways.find(g => g.isDefault);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-from-bottom-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}
      {errorToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-red-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-from-bottom-2">
          <span>{errorToast}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl text-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-red-500" />
            <h2 className="text-base font-bold tracking-tight">Payment Gateways & API Management</h2>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
              {gateways.length} Configured
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real merchant credentials stored securely using AES-256-GCM encrypted persistence. Secrets are never exposed to browser or logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-red-600/30 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Payment Gateway / API</span>
          </button>
        </div>
      </div>

      {/* Active Primary Banner */}
      {defaultGateway && (
        <div className="bg-gradient-to-r from-blue-950/40 to-slate-900 border border-blue-500/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Primary Checkout Engine:</span>
                <span className="text-xs font-bold text-blue-400">{defaultGateway.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  defaultGateway.environment === 'LIVE' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {defaultGateway.environment} MODE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                All online orders on TORIWEAR storefront currently process through this gateway.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-mono">Key ID:</span>
            <code className="bg-slate-950 px-2 py-1 rounded text-slate-200 font-mono text-[11px] border border-slate-800">
              {defaultGateway.keyIdMasked || 'Not set'}
            </code>
            <button
              onClick={() => handleTestConnection(defaultGateway)}
              disabled={testingId === defaultGateway.id}
              className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{testingId === defaultGateway.id ? 'Testing...' : 'Test Connection'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Webhook Endpoint Helper */}
      <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Universal Payment Webhook Listener URL:</span>
          <code className="bg-slate-950 px-2 py-0.5 rounded text-slate-300 font-mono border border-slate-800 text-[11px]">
            {typeof window !== 'undefined' ? `${window.location.origin}/api/v1/payments/webhook` : '/api/v1/payments/webhook'}
          </code>
        </div>
        <button
          onClick={copyWebhookUrl}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
        >
          {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedWebhook ? 'Copied URL!' : 'Copy Webhook URL'}</span>
        </button>
      </div>

      {/* Gateways List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gateways.map((gw) => {
          const isVerified = gw.status === 'VERIFIED';
          const isFailed = gw.status === 'FAILED';
          const isConfigured = gw.status === 'CREDENTIALS_SAVED';
          const isRazorpay = gw.provider === 'RAZORPAY';
          const isReadyOrConfigured = gw.isEnabled && (isVerified || isConfigured || gw.hasKeySecret);

          return (
            <div 
              key={gw.id} 
              className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 transition-all relative ${
                gw.isDefault ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-200'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getProviderBadge(gw.provider)}
                    <h3 className="text-sm font-bold text-slate-900">{gw.name}</h3>
                    {gw.isDefault && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold uppercase">
                        PRIMARY
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                    <span>Env:</span>
                    <strong className={gw.environment === 'LIVE' ? 'text-red-600' : 'text-amber-600'}>
                      {gw.environment}
                    </strong>
                    <span>•</span>
                    <span>Status:</span>
                    <span className={gw.isEnabled ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                      {gw.isEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggle(gw)}
                    className={`text-xs px-2 py-1 rounded font-medium border transition-colors cursor-pointer ${
                      gw.isEnabled 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {gw.isEnabled ? 'Active' : 'Disabled'}
                  </button>
                </div>
              </div>

              {/* Functional Readiness Badge */}
              <div className="pt-1">
                {isRazorpay ? (
                  isReadyOrConfigured ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
                      <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600/30" />
                      ONLINE CHECKOUT READY
                    </span>
                  ) : isFailed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-700 border border-red-500/30">
                      <AlertCircle className="w-3.5 h-3.5" />
                      VERIFICATION FAILED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-500/30">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      NEEDS CONFIGURATION
                    </span>
                  )
                ) : (
                  isReadyOrConfigured ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-700 border border-purple-500/30" title="API credentials verified and stored securely. Storefront checkout is powered exclusively via Razorpay.">
                      <Lock className="w-3 h-3 text-purple-600" />
                      CONFIGURED — CHECKOUT NOT AVAILABLE
                    </span>
                  ) : isFailed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-700 border border-red-500/30">
                      <AlertCircle className="w-3.5 h-3.5" />
                      VERIFICATION FAILED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-500/30">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      NEEDS CONFIGURATION
                    </span>
                  )
                )}
              </div>

              {/* Credential Details */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">API Key ID / Client ID:</span>
                  <code className="font-mono text-slate-900 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {gw.keyIdMasked || '••••••••'}
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">API Secret Status:</span>
                  <span className="flex items-center gap-1 font-mono text-xs">
                    {gw.hasKeySecret ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        AES-256 Encrypted
                      </span>
                    ) : (
                      <span className="text-amber-600 font-semibold">Missing Secret</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Webhook Secret:</span>
                  <span className="font-mono text-xs text-slate-700">
                    {gw.hasWebhookSecret ? 'Configured (HMAC-SHA256)' : 'Optional / Not set'}
                  </span>
                </div>
                {gw.merchantId && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Merchant Account ID:</span>
                    <span className="font-mono text-xs text-slate-700">{gw.merchantId}</span>
                  </div>
                )}
              </div>

              {/* Health / Verification Status */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  {isVerified ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      Verified Official API ({gw.lastLatencyMs || 0}ms)
                    </span>
                  ) : isFailed ? (
                    <span className="flex items-center gap-1 text-red-600 font-semibold" title={gw.lastErrorMessage}>
                      <AlertCircle className="w-4 h-4" />
                      Verification Failed
                    </span>
                  ) : isConfigured ? (
                    <span className="flex items-center gap-1 text-blue-600">
                      <Clock className="w-4 h-4" />
                      Credentials Saved (Ready to Test)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600">
                      <ShieldAlert className="w-4 h-4" />
                      Needs Configuration
                    </span>
                  )}
                </div>

                {gw.lastTestedAt && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    Tested {new Date(gw.lastTestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestConnection(gw)}
                    disabled={testingId === gw.id}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Activity className={`w-3.5 h-3.5 ${testingId === gw.id ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
                    <span>{testingId === gw.id ? 'Testing...' : 'Test Ping'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(gw)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-slate-600" />
                    <span>Edit API</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {!gw.isDefault && gw.isEnabled && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(gw)}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition-colors cursor-pointer"
                    >
                      Set Default
                    </button>
                  )}

                  {!gw.isDefault && (
                    confirmDeleteGatewayId === gw.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteGateway(gw)}
                          className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteGatewayId(null)}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteGatewayId(gw.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Remove integration"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-bold text-slate-900">Add Payment Gateway / API</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateGateway} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Provider Engine</label>
                  <select
                    value={formProvider}
                    onChange={(e) => {
                      const p = e.target.value as any;
                      setFormProvider(p);
                      if (p === 'RAZORPAY') setFormName('Razorpay Gateway');
                      else if (p === 'CASHFREE') setFormName('Cashfree PG');
                      else if (p === 'STRIPE') setFormName('Stripe Payments');
                      else if (p === 'CUSTOM_UPI') setFormName('Direct Bharat UPI');
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 font-medium"
                  >
                    <option value="RAZORPAY">Razorpay (Cards, UPI, NetBanking)</option>
                    <option value="CASHFREE">Cashfree Payments (Direct UPI, Cards)</option>
                    <option value="STRIPE">Stripe Global (International Cards)</option>
                    <option value="CUSTOM_UPI">Custom Direct UPI (Zero Gateway Fee)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Environment</label>
                  <select
                    value={formEnv}
                    onChange={(e) => setFormEnv(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 font-medium"
                  >
                    <option value="TEST">Sandbox / Test Mode</option>
                    <option value="LIVE">Live Production Mode</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Razorpay Primary Gateway"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {formProvider === 'RAZORPAY' ? 'Key ID (e.g. rzp_test_...)' : formProvider === 'CASHFREE' ? 'App ID / Client ID' : formProvider === 'STRIPE' ? 'Publishable Key (pk_...)' : 'Merchant UPI ID / VPA'}
                </label>
                <input
                  type="text"
                  value={formKeyId}
                  onChange={(e) => setFormKeyId(e.target.value)}
                  placeholder={formProvider === 'RAZORPAY' ? 'rzp_test_xxxxxxxxxxxxxx' : 'Enter API Key ID'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">
                    {formProvider === 'RAZORPAY' ? 'Key Secret' : formProvider === 'CASHFREE' ? 'Secret Key' : formProvider === 'STRIPE' ? 'Secret Key (sk_...)' : 'Secret Key (Optional)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-[11px]"
                  >
                    {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showSecret ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={formKeySecret}
                  onChange={(e) => setFormKeySecret(e.target.value)}
                  placeholder="Enter secret key (AES-256 encrypted on save)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900"
                  required={formProvider !== 'CUSTOM_UPI'}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Webhook Secret (Optional for HMAC verification)</label>
                <input
                  type="password"
                  value={formWebhookSecret}
                  onChange={(e) => setFormWebhookSecret(e.target.value)}
                  placeholder="e.g. tori_whsec_xxxxxxxxxx"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Encrypting & Saving...' : 'Save & Encrypt Gateway'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && activeGateway && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Configure {activeGateway.name}</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleUpdateGateway} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Environment</label>
                  <select
                    value={formEnv}
                    onChange={(e) => setFormEnv(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 font-medium"
                  >
                    <option value="TEST">Sandbox / Test Mode</option>
                    <option value="LIVE">Live Production Mode</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  API Key ID / Client ID
                </label>
                <input
                  type="text"
                  value={formKeyId}
                  onChange={(e) => setFormKeyId(e.target.value)}
                  placeholder={activeGateway.keyIdMasked}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">
                    API Secret Key
                  </label>
                  <span className="text-slate-400 text-[11px]">Leave blank to keep existing encrypted secret</span>
                </div>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={formKeySecret}
                  onChange={(e) => setFormKeySecret(e.target.value)}
                  placeholder="•••••••••••••••• (Leave blank to keep unchanged)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">Webhook Secret</label>
                  <span className="text-slate-400 text-[11px]">Leave blank to keep existing</span>
                </div>
                <input
                  type="password"
                  value={formWebhookSecret}
                  onChange={(e) => setFormWebhookSecret(e.target.value)}
                  placeholder="•••••••••••••••• (Leave blank to keep unchanged)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Updating...' : 'Save Configuration'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
