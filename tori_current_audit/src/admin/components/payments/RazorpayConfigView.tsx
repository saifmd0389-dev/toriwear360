import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Save,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { useAdmin } from '../../AdminDataContext';

export interface RazorpayPublicConfig {
  enabled: boolean;
  environment: 'TEST' | 'LIVE';
  testConfig: {
    keyId: string;
    maskedKeySecret: string;
    hasKeySecret: boolean;
    hasWebhookSecret: boolean;
    maskedWebhookSecret: string;
    webhookUrl: string;
    connectionStatus: string;
    lastTestedAt?: string;
    lastError?: string;
  };
  liveConfig: {
    keyId: string;
    maskedKeySecret: string;
    hasKeySecret: boolean;
    hasWebhookSecret: boolean;
    maskedWebhookSecret: string;
    webhookUrl: string;
    connectionStatus: string;
    lastTestedAt?: string;
    lastError?: string;
  };
}

export const RazorpayConfigView: React.FC = () => {
  const { showToast } = useAdmin();

  const [, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Configuration state
  const [config, setConfig] = useState<RazorpayPublicConfig | null>(null);
  const [activeEnv, setActiveEnv] = useState<'TEST' | 'LIVE'>('TEST');
  const [isEnabled, setIsEnabled] = useState(false);

  // Form inputs for current environment
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // Real connection test results
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    testedAt?: string;
    statusCode?: number;
    errorDetails?: string;
  } | null>(null);

  // Fetch current backend configuration
  const fetchConfig = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('tori_admin_session_token') || sessionStorage.getItem('tori_admin_session_token');
      const res = await fetch('/api/v1/admin/payments/razorpay/config', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const json = await res.json();
      if (json.success && json.data) {
        const d: RazorpayPublicConfig = json.data;
        setConfig(d);
        setActiveEnv(d.environment);
        setIsEnabled(d.enabled);

        const currentEnvConfig = d.environment === 'LIVE' ? d.liveConfig : d.testConfig;
        setKeyId(currentEnvConfig.keyId || '');
        setKeySecret(currentEnvConfig.maskedKeySecret || '');
        setWebhookSecret(currentEnvConfig.maskedWebhookSecret || '');
      } else {
        showToast(json.error || 'Failed to load Razorpay configuration.');
      }
    } catch (err: any) {
      showToast(err.message || 'Error communicating with server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Update inputs when switching environment tab
  const handleSwitchEnvironment = (env: 'TEST' | 'LIVE') => {
    setActiveEnv(env);
    setTestResult(null);
    if (!config) return;
    const envData = env === 'LIVE' ? config.liveConfig : config.testConfig;
    setKeyId(envData.keyId || '');
    setKeySecret(envData.maskedKeySecret || '');
    setWebhookSecret(envData.maskedWebhookSecret || '');
    setShowSecret(false);
    setShowWebhookSecret(false);
  };

  // Save configuration
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('tori_admin_session_token') || sessionStorage.getItem('tori_admin_session_token');
      
      const payload: any = {
        enabled: isEnabled,
        environment: activeEnv,
      };

      if (activeEnv === 'LIVE') {
        payload.liveConfig = {
          keyId: keyId.trim(),
          keySecret: keySecret.trim(),
          webhookSecret: webhookSecret.trim(),
        };
      } else {
        payload.testConfig = {
          keyId: keyId.trim(),
          keySecret: keySecret.trim(),
          webhookSecret: webhookSecret.trim(),
        };
      }

      const res = await fetch('/api/v1/admin/payments/razorpay/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success && json.data) {
        setConfig(json.data);
        showToast('Razorpay credentials encrypted & saved securely to backend.');
        // Refresh masked fields
        const envData = activeEnv === 'LIVE' ? json.data.liveConfig : json.data.testConfig;
        setKeySecret(envData.maskedKeySecret || '');
        setWebhookSecret(envData.maskedWebhookSecret || '');
      } else {
        showToast(json.error || 'Failed to save configuration.');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving configuration.');
    } finally {
      setSaving(false);
    }
  };

  // Perform genuine authenticated backend connection test to Razorpay
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem('tori_admin_session_token') || sessionStorage.getItem('tori_admin_session_token');
      const res = await fetch('/api/v1/admin/payments/razorpay/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ environment: activeEnv })
      });
      const json = await res.json();
      setTestResult({
        success: json.success,
        message: json.message || (json.success ? 'Authenticated successfully with Razorpay API.' : 'Connection test failed.'),
        latencyMs: json.latencyMs,
        testedAt: json.testedAt || new Date().toISOString(),
        statusCode: json.statusCode,
        errorDetails: json.errorDetails,
      });

      if (json.success) {
        showToast(`Razorpay ${activeEnv} connection verified in ${json.latencyMs || 0}ms.`);
      } else {
        showToast(`Razorpay test failed: ${json.message}`);
      }
      // Re-fetch config to sync status
      fetchConfig();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error executing connection test.',
        testedAt: new Date().toISOString()
      });
      showToast('Connection test error.');
    } finally {
      setTesting(false);
    }
  };

  const getWebhookUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://toriwear.com';
    return `${origin}/api/v1/payments/razorpay/webhook`;
  };

  const copyWebhookToClipboard = () => {
    navigator.clipboard.writeText(getWebhookUrl());
    setCopiedWebhook(true);
    showToast('Webhook URL copied to clipboard.');
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const activeEnvConfig = activeEnv === 'LIVE' ? config?.liveConfig : config?.testConfig;
  const status = activeEnvConfig?.connectionStatus || 'NOT_CONFIGURED';

  return (
    <div className="space-y-6">
      {/* Top Banner / Card */}
      <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center shrink-0">
              <CreditCard className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Razorpay Payment Gateway</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  OFFICIAL INTEGRATION
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Accept UPI, Cards, NetBanking & Wallets across India with instant settlement and webhook updates.
              </p>
            </div>
          </div>

          {/* Master Enable/Disable Switch */}
          <div className="flex items-center gap-3 self-start sm:self-auto bg-neutral-900/90 border border-neutral-800 p-2 px-3 rounded-xl">
            <span className="text-xs font-semibold text-neutral-300">
              Enable Razorpay:
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              onClick={() => setIsEnabled(!isEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                isEnabled ? 'bg-emerald-600' : 'bg-neutral-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
                  isEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-[10px] font-mono font-bold uppercase ${isEnabled ? 'text-emerald-400' : 'text-neutral-500'}`}>
              {isEnabled ? 'Active' : 'Disabled'}
            </span>
          </div>
        </div>

        {/* Environment Selector: Test Mode vs Live Mode */}
        <div className="pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-400">Target Environment:</span>
            <div className="inline-flex p-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
              <button
                type="button"
                onClick={() => handleSwitchEnvironment('TEST')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeEnv === 'TEST'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Test Mode (Sandbox)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchEnvironment('LIVE')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeEnv === 'LIVE'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Live Mode (Production)</span>
              </button>
            </div>
          </div>

          {/* Connection Status Pill */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-neutral-400">Status:</span>
            {status === 'VERIFIED' && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>AUTHENTICATED ({activeEnv})</span>
              </span>
            )}
            {status === 'CREDENTIALS_SAVED' && (
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>SAVED (UNTESTED)</span>
              </span>
            )}
            {status === 'CONNECTION_FAILED' && (
              <span className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-1.5 font-bold">
                <XCircle className="w-3.5 h-3.5" />
                <span>FAILED ({activeEnv})</span>
              </span>
            )}
            {status === 'NOT_CONFIGURED' && (
              <span className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-400 border border-neutral-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>NEEDS CONFIGURATION</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Credentials Form */}
      <form onSubmit={handleSave} className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-500" />
              <span>{activeEnv === 'LIVE' ? 'Production (Live) API Credentials' : 'Sandbox (Test) API Credentials'}</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Keys for {activeEnv} are kept completely separate. Never share or log secret keys.
            </p>
          </div>
          <a
            href="https://dashboard.razorpay.com/#/access/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 underline underline-offset-2"
          >
            <span>Open Razorpay Dashboard</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Key ID */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider">
              Razorpay API Key ID ({activeEnv})
            </label>
            <input
              type="text"
              required
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              placeholder={activeEnv === 'LIVE' ? 'rzp_live_xxxxxxxxxxxxxxxx' : 'rzp_test_xxxxxxxxxxxxxxxx'}
              className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-neutral-500">
              Starts with <code className="text-neutral-400 font-mono">{activeEnv === 'LIVE' ? 'rzp_live_' : 'rzp_test_'}</code>
            </p>
          </div>

          {/* Key Secret */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider">
              Razorpay API Key Secret ({activeEnv})
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                required={!activeEnvConfig?.hasKeySecret}
                value={keySecret}
                onChange={(e) => setKeySecret(e.target.value)}
                placeholder={activeEnvConfig?.hasKeySecret ? '•••••••••••••••• (Leave blank to keep existing)' : 'Enter your Razorpay Secret'}
                className="w-full pr-10 pl-3.5 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-neutral-500">
              Encrypted on backend using AES-256-GCM. Never exposed in frontend or client storage.
            </p>
          </div>
        </div>

        {/* Webhook Secret */}
        <div className="space-y-1.5 pt-2">
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider text-xs">
            Razorpay Webhook Secret ({activeEnv})
          </label>
          <div className="relative">
            <input
              type={showWebhookSecret ? 'text' : 'password'}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={activeEnvConfig?.hasWebhookSecret ? '•••••••••••••••• (Leave blank to keep existing)' : 'Secret entered when creating Razorpay webhook'}
              className="w-full pr-10 pl-3.5 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-blue-500 text-xs"
            />
            <button
              type="button"
              onClick={() => setShowWebhookSecret(!showWebhookSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
            >
              {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">
            Used to cryptographically verify <code className="text-neutral-400 font-mono">x-razorpay-signature</code> on incoming payment capture events.
          </p>
        </div>

        {/* Webhook URL Endpoint Box */}
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>TORIWEAR Webhook Endpoint URL</span>
            </span>
            <button
              type="button"
              onClick={copyWebhookToClipboard}
              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copiedWebhook ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedWebhook ? 'Copied!' : 'Copy URL'}</span>
            </button>
          </div>
          <div className="p-2.5 bg-black/50 rounded-lg font-mono text-xs text-blue-300 break-all select-all border border-neutral-800">
            {getWebhookUrl()}
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            In Razorpay Dashboard → Settings → Webhooks, add this URL and subscribe to:
            <span className="text-neutral-300 font-mono ml-1">payment.captured, payment.failed, order.paid, refund.created, refund.processed</span>.
          </p>
        </div>

        {/* Action Buttons: Save & Test */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-neutral-800">
          <div className="text-[11px] text-neutral-500">
            {activeEnvConfig?.lastTestedAt && (
              <span>Last tested: {new Date(activeEnvConfig.lastTestedAt).toLocaleString('en-IN')}</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || saving || !keyId}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 ${testing ? 'animate-spin text-blue-400' : 'text-neutral-400'}`} />
              <span>{testing ? 'Testing API...' : `Test ${activeEnv} Connection`}</span>
            </button>

            <button
              type="submit"
              disabled={saving || testing}
              className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Live Test Results Banner */}
      {testResult && (
        <div className={`p-4 rounded-2xl border text-xs animate-in fade-in space-y-1.5 ${
          testResult.success
            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
            : 'bg-red-950/30 border-red-500/40 text-red-200'
        }`}>
          <div className="flex items-center justify-between font-bold">
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{testResult.success ? 'Authenticated Razorpay Connection Successful' : 'Razorpay Connection Test Failed'}</span>
            </div>
            {testResult.latencyMs !== undefined && (
              <span className="font-mono text-[11px] opacity-80">{testResult.latencyMs} ms latency</span>
            )}
          </div>
          <p className="leading-relaxed pl-6">{testResult.message}</p>
          {testResult.errorDetails && (
            <div className="pl-6 pt-1 font-mono text-[11px] opacity-80">
              Details: {testResult.errorDetails}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
