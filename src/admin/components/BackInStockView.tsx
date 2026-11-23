import React, { useState, useEffect, useCallback } from 'react';
import {
  BellRing,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  Globe,
  MonitorSmartphone,
  Mail,
  RotateCcw,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';

interface BackInStockOverviewData {
  summary: {
    totalSubscriptions: number;
    activeWaitlist: number;
    notifiedCount: number;
    partialFailureCount: number;
    cancelledCount: number;
    uniqueVariantsDemanded: number;
    channelStats: {
      whatsappSent: number;
      whatsappFailed: number;
      websiteDelivered: number;
      browserPushDelivered: number;
      emailSent: number;
      emailFailed: number;
    };
    whatsappTemplateHealth: {
      whatsappCredentialsConfigured: boolean;
      templateConfigured: boolean;
      templateName: string | null;
      templateLang: string;
      envVarName: string;
    };
  };
  variantDemand: Array<{
    variantId: string;
    productId: string;
    productName: string;
    sku: string | null;
    size: string;
    color: string;
    currentStock: number;
    activeWaitlistCount: number;
    notifiedCount: number;
    failedCount: number;
  }>;
  subscriptions: Array<{
    id: string;
    productId: string;
    productName: string;
    variantId: string;
    sku: string | null;
    size: string;
    color: string;
    currentStock: number;
    customerName: string;
    phoneMask: string | null;
    emailMask: string | null;
    whatsappConsent: boolean;
    websiteEnabled: boolean;
    browserPushEnabled: boolean;
    emailBackupEnabled: boolean;
    status: string;
    whatsappStatus: string;
    websiteStatus: string;
    browserPushStatus: string;
    emailStatus: string;
    lastFailureSummary: string | null;
    notifiedAt: string | null;
    createdAt: string;
  }>;
}

function statusTone(status: string): string {
  switch (status) {
    case 'SENT':
    case 'DELIVERED':
    case 'READ':
    case 'NOTIFIED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'FAILED':
    case 'PARTIAL_FAILURE':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'PENDING':
    case 'ACTIVE':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    default:
      return 'bg-slate-100 text-slate-500 border-slate-200';
  }
}

export const BackInStockView: React.FC = () => {
  const [data, setData] = useState<BackInStockOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getAdminBackInStockOverview({
        status: statusFilter,
        search: search.trim() || undefined,
      });
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || 'Failed to load back-in-stock alerts.');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to fetch back-in-stock data.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRetry = async (subscriptionId: string) => {
    setRetryingId(subscriptionId);
    setFeedback(null);
    try {
      const res = await apiClient.retryAdminBackInStockDelivery(subscriptionId);
      if (res.success) {
        setFeedback(res.message || 'Retry processed for failed channels.');
        await loadData();
      } else {
        setError(res.error || 'Retry failed.');
      }
    } finally {
      setRetryingId(null);
    }
  };

  const summary = data?.summary;
  const waHealth = summary?.whatsappTemplateHealth;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BellRing className="w-5 h-5 text-red-600" />
            <span>Back-in-Stock Alerts &amp; Waitlist</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Channel Priority: <strong>1. WhatsApp (Primary)</strong> → <strong>2. Website Inbox &amp; Browser Push (Secondary)</strong> → <strong>3. Email (Backup)</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* WhatsApp Template Readiness Banner */}
      {waHealth && (!waHealth.whatsappCredentialsConfigured || !waHealth.templateConfigured) && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">WhatsApp Back-in-Stock Template Configuration Notice</div>
            <p className="mt-0.5 text-amber-800">
              {!waHealth.whatsappCredentialsConfigured
                ? 'Meta WhatsApp Cloud API credentials (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID) are not set. '
                : ''}
              {!waHealth.templateConfigured
                ? `Set ${waHealth.envVarName} to your approved Meta Utility template name. Until configured, WhatsApp attempts will record as FAILED and Website Inbox + Backup Email will still deliver automatically.`
                : ''}
            </p>
          </div>
        </div>
      )}

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-medium text-slate-500">Active Waitlist</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{summary?.activeWaitlist ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{summary?.uniqueVariantsDemanded ?? 0} exact variants</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-medium text-slate-500">Notified</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1 tabular-nums">{summary?.notifiedCount ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Completed restocks</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-medium text-slate-500">Partial Failures</div>
          <div className="text-2xl font-bold text-red-600 mt-1 tabular-nums">{summary?.partialFailureCount ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Available for safe retry</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-medium text-slate-500">WhatsApp (Primary)</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {summary?.channelStats.whatsappSent ?? 0}
            <span className="text-xs font-normal text-red-500 ml-1.5">
              ({summary?.channelStats.whatsappFailed ?? 0} failed)
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {waHealth?.templateName ? `Template: ${waHealth.templateName}` : 'Template env unset'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-medium text-slate-500">Website / Push / Email</div>
          <div className="text-sm font-bold text-slate-900 mt-2 space-y-0.5 font-mono">
            <div>Web: {summary?.channelStats.websiteDelivered ?? 0}</div>
            <div>Push: {summary?.channelStats.browserPushDelivered ?? 0} · Email: {summary?.channelStats.emailSent ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Exact Variant Demand Summary */}
      {data && data.variantDemand.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Waitlist Demand by Exact Variant (Product · Size · Color)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Product</th>
                  <th className="px-4 py-2.5 font-semibold">Size / Color</th>
                  <th className="px-4 py-2.5 font-semibold">SKU</th>
                  <th className="px-4 py-2.5 font-semibold">Current Stock</th>
                  <th className="px-4 py-2.5 font-semibold">Waiting</th>
                  <th className="px-4 py-2.5 font-semibold">Notified</th>
                  <th className="px-4 py-2.5 font-semibold">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.variantDemand.slice(0, 12).map((d) => (
                  <tr key={d.variantId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-semibold text-slate-900">{d.productName}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-700">
                      {d.size} · {d.color}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{d.sku || d.variantId}</td>
                    <td className="px-4 py-2.5 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.currentStock > 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {d.currentStock}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-amber-700">{d.activeWaitlistCount}</td>
                    <td className="px-4 py-2.5 font-mono text-emerald-700">{d.notifiedCount}</td>
                    <td className="px-4 py-2.5 font-mono text-red-600">{d.failedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscriptions & Independent Per-Channel Delivery Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Subscriptions &amp; Per-Channel Delivery Log
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product, size, color..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-red-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-red-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Waiting (Active)</option>
              <option value="NOTIFIED">Notified</option>
              <option value="PARTIAL_FAILURE">Partial Failure</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Exact Variant</th>
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">
                  <span className="inline-flex items-center gap-1"><MessageCircle className="w-3 h-3" /> 1. WhatsApp</span>
                </th>
                <th className="px-4 py-2.5 font-semibold">
                  <span className="inline-flex items-center gap-1"><Globe className="w-3 h-3" /> 2. Website</span>
                </th>
                <th className="px-4 py-2.5 font-semibold">
                  <span className="inline-flex items-center gap-1"><MonitorSmartphone className="w-3 h-3" /> 2b. Push</span>
                </th>
                <th className="px-4 py-2.5 font-semibold">
                  <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> 3. Email</span>
                </th>
                <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !data ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    Loading back-in-stock subscriptions...
                  </td>
                </tr>
              ) : !data || data.subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    No back-in-stock subscriptions found.
                  </td>
                </tr>
              ) : (
                data.subscriptions.map((sub) => {
                  const canRetry =
                    sub.whatsappStatus === 'FAILED' ||
                    sub.websiteStatus === 'FAILED' ||
                    sub.emailStatus === 'FAILED';
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/70 align-top">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{sub.productName}</div>
                        <div className="text-[11px] font-mono text-slate-600">
                          Size {sub.size} · {sub.color}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          Stock: {sub.currentStock} {sub.sku ? `· ${sub.sku}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{sub.customerName}</div>
                        {sub.phoneMask && (
                          <div className="text-[10px] font-mono text-slate-500">
                            {sub.phoneMask} {sub.whatsappConsent ? '(WA Opt-In)' : '(No WA Consent)'}
                          </div>
                        )}
                        {sub.emailMask && (
                          <div className="text-[10px] font-mono text-slate-500">{sub.emailMask}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-mono font-bold border rounded-full ${statusTone(sub.status)}`}>
                          {sub.status}
                        </span>
                        {sub.lastFailureSummary && (
                          <div className="text-[10px] text-red-600 mt-1 max-w-[200px] leading-snug">
                            {sub.lastFailureSummary}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-mono font-semibold border rounded ${statusTone(sub.whatsappStatus)}`}>
                          {sub.whatsappStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-mono font-semibold border rounded ${statusTone(sub.websiteStatus)}`}>
                          {sub.websiteStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-mono font-semibold border rounded ${statusTone(sub.browserPushStatus)}`}>
                          {sub.browserPushStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-mono font-semibold border rounded ${statusTone(sub.emailStatus)}`}>
                          {sub.emailStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canRetry ? (
                          <button
                            type="button"
                            disabled={retryingId === sub.id}
                            onClick={() => handleRetry(sub.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-[10px] font-semibold cursor-pointer"
                          >
                            <RotateCcw className={`w-3 h-3 ${retryingId === sub.id ? 'animate-spin' : ''}`} />
                            <span>{retryingId === sub.id ? 'Retrying...' : 'Retry Failed'}</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
