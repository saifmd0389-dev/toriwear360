import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Download,
  Mail,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { useAdmin } from '../AdminDataContext';

interface EarlyAccessStats {
  totalSubscribers: number;
  activeSubscribers: number;
  emailConsented: number;
  whatsappConsented: number;
  bothConsented: number;
  unsubscribedCount: number;
  bouncedCount: number;
  deliveryCounts: Record<string, number>;
  campaignCount: number;
}

interface ProviderReadiness {
  email?: {
    provider?: string;
    configured?: boolean;
    fromAddress?: string;
    webhookSecretConfigured?: boolean;
    missing?: string[];
  };
  whatsapp?: {
    provider?: string;
    configured?: boolean;
    phoneNumberIdSet?: boolean;
    defaultTemplateName?: string;
    webhookVerifyTokenConfigured?: boolean;
    appSecretConfigured?: boolean;
    missing?: string[];
  };
}

interface SubscriberRow {
  id: string;
  email?: string | null;
  whatsappNumber?: string | null;
  preferredChannel: 'EMAIL' | 'WHATSAPP' | 'BOTH';
  emailConsent: boolean;
  emailConsentAt?: string | null;
  whatsappConsent: boolean;
  whatsappConsentAt?: string | null;
  registrationSource: string;
  status: string;
  couponCode?: string | null;
  couponEligible: boolean;
  createdAt: string;
  lastNotifiedAt?: string | null;
  unsubscribedAt?: string | null;
}

interface CampaignRow {
  id: string;
  name: string;
  channels: 'EMAIL' | 'WHATSAPP' | 'BOTH';
  subject?: string | null;
  emailText?: string | null;
  whatsappTemplateName?: string | null;
  whatsappTemplateLang?: string | null;
  couponCode?: string | null;
  status: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: string;
  completedAt?: string | null;
}

interface DeliveryRow {
  id: string;
  campaignId?: string | null;
  subscriberId?: string | null;
  eventType: string;
  channel: 'EMAIL' | 'WHATSAPP';
  recipientMask: string;
  providerName: string;
  providerMessageId?: string | null;
  status: string;
  failureReason?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
}

const STATUS_BADGE_MAP: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SENT: 'bg-sky-50 text-sky-700 border-sky-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  READ: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  QUEUED: 'bg-amber-50 text-amber-700 border-amber-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  SENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARTIAL_FAILURE: 'bg-amber-50 text-amber-700 border-amber-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  BOUNCED: 'bg-red-50 text-red-700 border-red-200',
  COMPLAINED: 'bg-red-50 text-red-700 border-red-200',
  UNSUBSCRIBED: 'bg-slate-100 text-slate-600 border-slate-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
};

function formatShortDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const EarlyAccessView: React.FC = () => {
  const { coupons, setCurrentView, showToast } = useAdmin();

  const [activeTab, setActiveTab] = useState<'SUBSCRIBERS' | 'CAMPAIGNS'>('SUBSCRIBERS');
  const [dbReady, setDbReady] = useState<boolean | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderReadiness>({});
  const [stats, setStats] = useState<EarlyAccessStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Subscribers filters & data
  const [subscribers, setSubscribers] = useState<SubscriberRow[]>([]);
  const [subTotal, setSubTotal] = useState(0);
  const [subPage, setSubPage] = useState(1);
  const [subTotalPages, setSubTotalPages] = useState(1);
  const [subSearch, setSubSearch] = useState('');
  const [subChannelFilter, setSubChannelFilter] = useState<'ALL' | 'EMAIL' | 'WHATSAPP' | 'BOTH'>('ALL');
  const [subStatusFilter, setSubStatusFilter] = useState<'ALL' | 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED'>('ALL');
  const [isLoadingSubs, setIsLoadingSubs] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Campaigns & Deliveries
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [deliveryCampaignFilter, setDeliveryCampaignFilter] = useState<string>('');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>('ALL');
  const [deliveryChannelFilter, setDeliveryChannelFilter] = useState<string>('ALL');
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);

  // Draft Campaign Composer
  const [draftName, setDraftName] = useState('TORIWEAR Launch Drop 001');
  const [draftChannels, setDraftChannels] = useState<'EMAIL' | 'WHATSAPP' | 'BOTH'>('BOTH');
  const [draftSubject, setDraftSubject] = useState('THE TORIWEAR VAULT IS NOW LIVE');
  const [draftEmailText, setDraftEmailText] = useState(
    'Early Access is now open. Explore 240+ GSM heavyweight Japanese anime streetwear before the public drop.'
  );
  const [draftWaTemplate, setDraftWaTemplate] = useState('');
  const [draftWaLang, setDraftWaLang] = useState('en');
  const [draftWaVarsText, setDraftWaVarsText] = useState('');
  const [draftCouponCode, setDraftCouponCode] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Test send & confirmation modals
  const [testTargetCampaign, setTestTargetCampaign] = useState<CampaignRow | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testWhatsappNumber, setTestWhatsappNumber] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResultMsg, setTestResultMsg] = useState<string | null>(null);

  const [confirmSendCampaign, setConfirmSendCampaign] = useState<CampaignRow | null>(null);
  const [isDispatchingCampaign, setIsDispatchingCampaign] = useState(false);
  const [retryingCampaignId, setRetryingCampaignId] = useState<string | null>(null);

  const loadStatsAndStatus = useCallback(async () => {
    setIsLoadingStats(true);
    const res = await apiClient.getEarlyAccessStats();
    setProviders(res.providers || {});
    if (res.success && res.dbReady !== false && res.data) {
      setDbReady(true);
      setDbError(null);
      setStats(res.data);
    } else {
      setDbReady(false);
      setDbError(
        res.error ||
          'MySQL database is not configured or unreachable (503). Subscriber storage and campaign dispatch are safely paused.'
      );
      setStats(null);
    }
    setIsLoadingStats(false);
  }, []);

  const loadSubscribers = useCallback(
    async (targetPage = subPage) => {
      if (dbReady === false) return;
      setIsLoadingSubs(true);
      const res = await apiClient.getEarlyAccessSubscribers({
        search: subSearch.trim() || undefined,
        channel: subChannelFilter,
        status: subStatusFilter,
        page: targetPage,
        limit: 25,
      });
      if (res.success && res.data) {
        setSubscribers(Array.isArray(res.data.items) ? res.data.items : []);
        setSubTotal(Number(res.data.total || 0));
        setSubPage(Number(res.data.page || 1));
        setSubTotalPages(Number(res.data.totalPages || 1));
      } else if (res.statusCode === 503) {
        setDbReady(false);
      }
      setIsLoadingSubs(false);
    },
    [dbReady, subSearch, subChannelFilter, subStatusFilter, subPage]
  );

  const loadCampaignsAndDeliveries = useCallback(async () => {
    if (dbReady === false) return;
    setIsLoadingCampaigns(true);
    const [campRes, delRes] = await Promise.all([
      apiClient.getEarlyAccessCampaigns(),
      apiClient.getEarlyAccessDeliveries({
        campaignId: deliveryCampaignFilter || undefined,
        status: deliveryStatusFilter,
        channel: deliveryChannelFilter,
      }),
    ]);
    if (campRes.success && Array.isArray(campRes.data)) {
      setCampaigns(campRes.data);
    }
    if (delRes.success && delRes.data) {
      setDeliveries(Array.isArray(delRes.data.items) ? delRes.data.items : []);
    }
    setIsLoadingCampaigns(false);
  }, [dbReady, deliveryCampaignFilter, deliveryStatusFilter, deliveryChannelFilter]);

  useEffect(() => {
    void loadStatsAndStatus();
  }, [loadStatsAndStatus]);

  useEffect(() => {
    if (dbReady) {
      void loadSubscribers(1);
      void loadCampaignsAndDeliveries();
    }
  }, [dbReady]);

  useEffect(() => {
    if (dbReady && activeTab === 'SUBSCRIBERS') {
      void loadSubscribers(subPage);
    }
  }, [subChannelFilter, subStatusFilter, subPage]);

  useEffect(() => {
    if (dbReady && activeTab === 'CAMPAIGNS') {
      void loadCampaignsAndDeliveries();
    }
  }, [deliveryCampaignFilter, deliveryStatusFilter, deliveryChannelFilter, activeTab]);

  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    const res = await apiClient.exportEarlyAccessCsv({
      search: subSearch.trim() || undefined,
      channel: subChannelFilter,
      status: subStatusFilter,
    });
    setIsExportingCsv(false);

    if (!res.success || !res.csv) {
      showToast(res.error || 'CSV export failed.');
      return;
    }

    const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `toriwear-early-access-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Early Access subscriber CSV exported.');
  };

  const handleCreateDraftCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftName.trim()) return;
    setIsSavingDraft(true);
    const vars = draftWaVarsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await apiClient.createEarlyAccessCampaign({
      name: draftName.trim(),
      channels: draftChannels,
      subject: draftSubject.trim() || undefined,
      emailText: draftEmailText.trim() || undefined,
      whatsappTemplateName: draftWaTemplate.trim() || undefined,
      whatsappTemplateLang: draftWaLang.trim() || 'en',
      whatsappVariables: vars.length > 0 ? vars : undefined,
      couponCode: draftCouponCode.trim() || null,
    });
    setIsSavingDraft(false);

    if (!res.success) {
      showToast(res.error || 'Could not create campaign draft.');
      return;
    }
    showToast(`Campaign draft "${draftName.trim()}" saved.`);
    await Promise.all([loadStatsAndStatus(), loadCampaignsAndDeliveries()]);
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTargetCampaign) return;
    setIsSendingTest(true);
    setTestResultMsg(null);
    const res = await apiClient.sendTestEarlyAccessCampaign(testTargetCampaign.id, {
      testEmail: testEmail.trim() || undefined,
      testWhatsappNumber: testWhatsappNumber.trim() || undefined,
    });
    setIsSendingTest(false);

    if (!res.success) {
      setTestResultMsg(res.error || 'Test dispatch failed.');
      return;
    }
    const parts: string[] = [];
    if (res.data?.email) {
      parts.push(
        res.data.email.success
          ? `Email sent (${res.data.email.providerMessageId || 'OK'})`
          : `Email failed: ${res.data.email.error}`
      );
    }
    if (res.data?.whatsapp) {
      parts.push(
        res.data.whatsapp.success
          ? `WhatsApp sent (${res.data.whatsapp.providerMessageId || 'OK'})`
          : `WhatsApp failed: ${res.data.whatsapp.error}`
      );
    }
    setTestResultMsg(parts.join(' · ') || 'Test completed.');
  };

  const handleConfirmBatchSend = async () => {
    if (!confirmSendCampaign) return;
    setIsDispatchingCampaign(true);
    const res = await apiClient.confirmSendEarlyAccessCampaign(confirmSendCampaign.id);
    setIsDispatchingCampaign(false);
    setConfirmSendCampaign(null);

    if (!res.success) {
      showToast(res.error || 'Failed to dispatch launch campaign.');
      return;
    }
    showToast(
      `Launch batch queued (${res.data?.queuedCount ?? 0} deliveries). Monitor live delivery statuses below.`
    );
    await Promise.all([loadStatsAndStatus(), loadCampaignsAndDeliveries()]);
  };

  const handleRetryFailed = async (campaignId: string) => {
    setRetryingCampaignId(campaignId);
    const res = await apiClient.retryFailedEarlyAccessCampaign(campaignId);
    setRetryingCampaignId(null);
    if (!res.success) {
      showToast(res.error || 'Retry request failed.');
      return;
    }
    showToast(`Queued ${res.data?.retriedCount ?? 0} failed deliveries for retry.`);
    await Promise.all([loadStatsAndStatus(), loadCampaignsAndDeliveries()]);
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Growth / Early Access & Launch Notifications
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
            <BellRing className="w-5 h-5 text-red-600" />
            <span>Early Access & Drop Dispatch Console</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage verified email & WhatsApp opt-ins, Resend / Meta Cloud API readiness, launch campaigns, and campaign-specific coupon eligibility.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void loadStatsAndStatus();
              if (dbReady) {
                void loadSubscribers(subPage);
                void loadCampaignsAndDeliveries();
              }
            }}
            className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('MARKETING')}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Ticket className="w-3.5 h-3.5 text-amber-400" />
            <span>Manage Coupons</span>
          </button>
        </div>
      </div>

      {/* Fail-Closed Database Readiness Alert */}
      {dbReady === false && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-bold text-red-900 uppercase tracking-wide font-mono">
              503 DATABASE_UNAVAILABLE — Early Access Storage Offline
            </div>
            <p className="text-red-800 leading-relaxed">{dbError}</p>
            <p className="text-red-700 font-mono text-[11px]">
              Required GoDaddy variables: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (or valid mysql:// DATABASE_URL) + non-destructive schema sync.
            </p>
          </div>
        </div>
      )}

      {/* Provider & Coupon Configuration Status Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Email Provider Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-slate-500" />
              <span>Email Provider ({providers.email?.provider || 'Resend'})</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                providers.email?.configured
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {providers.email?.configured ? 'Configured' : 'Missing Env'}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 space-y-0.5">
            <div>From: {providers.email?.fromAddress || 'Not configured'}</div>
            <div>
              Webhook Secret:{' '}
              {providers.email?.provider === 'gmail' ? 'Not required for Gmail' : providers.email?.webhookSecretConfigured ? 'Configured' : 'Unconfigured (EMAIL_WEBHOOK_SECRET)'}
            </div>
            {providers.email?.missing && providers.email.missing.length > 0 && (
              <div className="text-amber-700">Missing: {providers.email.missing.join(', ')}</div>
            )}
          </div>
        </div>

        {/* WhatsApp Provider Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4 text-slate-500" />
              <span>WhatsApp Cloud API (Meta)</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                providers.whatsapp?.configured
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {providers.whatsapp?.configured ? 'Configured' : 'Missing Env'}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 space-y-0.5">
            <div>Template: {providers.whatsapp?.defaultTemplateName || 'Set in campaign or WHATSAPP_TEMPLATE_NAME'}</div>
            <div>
              Webhook Verify/Sig:{' '}
              {providers.whatsapp?.webhookVerifyTokenConfigured && providers.whatsapp?.appSecretConfigured
                ? 'Configured'
                : 'Incomplete (VERIFY_TOKEN / APP_SECRET)'}
            </div>
            {providers.whatsapp?.missing && providers.whatsapp.missing.length > 0 && (
              <div className="text-amber-700">Missing: {providers.whatsapp.missing.join(', ')}</div>
            )}
          </div>
        </div>

        {/* Campaign Coupon Status Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <span className="text-xs font-semibold text-slate-700">Available campaign coupons</span>
          <div className="flex flex-wrap gap-2">
            {coupons.filter((c: any) => c.isActive).map((c: any) => <span key={c.id || c.code} className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-mono">{c.code}</span>)}
            {coupons.filter((c: any) => c.isActive).length === 0 && <span className="text-[11px] text-slate-500">No active coupons. Manage coupons in the Coupons section.</span>}
          </div>
          <p className="text-[10px] text-slate-500">Choose an active coupon in each campaign draft. Checkout remains the authority for coupon validation.</p>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total Registered', val: stats?.totalSubscribers ?? 0 },
          { label: 'Active Opt-Ins', val: stats?.activeSubscribers ?? 0 },
          { label: 'Email Consented', val: stats?.emailConsented ?? 0 },
          { label: 'WhatsApp Consented', val: stats?.whatsappConsented ?? 0 },
          {
            label: 'Sent / Delivered',
            val: `${stats?.deliveryCounts?.SENT ?? 0} / ${(stats?.deliveryCounts?.DELIVERED ?? 0) + (stats?.deliveryCounts?.READ ?? 0)}`,
          },
          {
            label: 'Failed / Opt-Out',
            val: `${stats?.deliveryCounts?.FAILED ?? 0} / ${stats?.unsubscribedCount ?? 0}`,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
            <div className="text-[11px] font-medium text-slate-500">{kpi.label}</div>
            <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {isLoadingStats ? '···' : kpi.val}
            </div>
          </div>
        ))}
      </div>

      {/* Workspace Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('SUBSCRIBERS')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'SUBSCRIBERS'
              ? 'bg-red-600 text-white'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Subscribers & Consent ({subTotal})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CAMPAIGNS')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'CAMPAIGNS'
              ? 'bg-red-600 text-white'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Launch Campaigns & Deliveries ({campaigns.length})</span>
        </button>
      </div>

      {/* TAB 1: SUBSCRIBERS DIRECTORY */}
      {activeTab === 'SUBSCRIBERS' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSubPage(1);
                      void loadSubscribers(1);
                    }
                  }}
                  placeholder="Search email, +phone, source..."
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 w-56 focus:outline-none focus:border-red-500"
                />
              </div>

              <select
                value={subChannelFilter}
                onChange={(e) => {
                  setSubChannelFilter(e.target.value as any);
                  setSubPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 cursor-pointer"
              >
                <option value="ALL">All Channels</option>
                <option value="EMAIL">Email Opt-In</option>
                <option value="WHATSAPP">WhatsApp Opt-In</option>
                <option value="BOTH">Both Channels</option>
              </select>

              <select
                value={subStatusFilter}
                onChange={(e) => {
                  setSubStatusFilter(e.target.value as any);
                  setSubPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="UNSUBSCRIBED">Unsubscribed</option>
                <option value="BOUNCED">Bounced</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setSubPage(1);
                  void loadSubscribers(1);
                }}
                disabled={dbReady === false}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                Search
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={dbReady === false || isExportingCsv}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingCsv ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 font-mono">
                <tr>
                  <th className="py-2.5 px-4">Subscriber Contact</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">Explicit Consents</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-4 text-right">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingSubs ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="py-3 px-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-full" />
                      </td>
                    </tr>
                  ))
                ) : subscribers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 px-4 text-center text-slate-500">
                      {dbReady === false
                        ? 'Connect MySQL to view registered early access subscribers.'
                        : 'No early access subscribers match the current filters.'}
                    </td>
                  </tr>
                ) : (
                  subscribers.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-mono text-slate-900 font-medium">
                          {sub.email || '—'}
                        </div>
                        {sub.whatsappNumber && (
                          <div className="font-mono text-[11px] text-slate-500">
                            {sub.whatsappNumber}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{sub.preferredChannel}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] space-y-0.5 tabular-nums">
                        <div className={sub.emailConsent ? 'text-emerald-700' : 'text-slate-400'}>
                          Email: {sub.emailConsent ? `Yes (${formatShortDate(sub.emailConsentAt)})` : 'No'}
                        </div>
                        <div className={sub.whatsappConsent ? 'text-emerald-700' : 'text-slate-400'}>
                          WhatsApp: {sub.whatsappConsent ? `Yes (${formatShortDate(sub.whatsappConsentAt)})` : 'No'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {sub.registrationSource}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                            STATUS_BADGE_MAP[sub.status] || STATUS_BADGE_MAP.DRAFT
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-500 tabular-nums">
                        {formatShortDate(sub.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {subTotalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs font-mono text-slate-500">
              <span>
                Page {subPage} of {subTotalPages} ({subTotal} subscribers)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={subPage <= 1}
                  onClick={() => setSubPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={subPage >= subTotalPages}
                  onClick={() => setSubPage((p) => Math.min(subTotalPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LAUNCH CAMPAIGNS & DELIVERY LOGS */}
      {activeTab === 'CAMPAIGNS' && (
        <div className="space-y-6">
          {/* Draft Campaign Composer */}
          <form
            onSubmit={handleCreateDraftCampaign}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Compose Launch Announcement Draft</h2>
                <p className="text-[11px] text-slate-500">
                  Drafts never notify subscribers automatically. Run an admin test send first, then confirm batch dispatch.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  required
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Delivery Channels
                </label>
                <select
                  value={draftChannels}
                  onChange={(e) => setDraftChannels(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 cursor-pointer"
                >
                  <option value="BOTH">Both (Email + WhatsApp)</option>
                  <option value="EMAIL">Email Only (Resend)</option>
                  <option value="WHATSAPP">WhatsApp Only (Meta Cloud API)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Launch coupon (optional)</label>
              <select value={draftCouponCode} onChange={(e) => setDraftCouponCode(e.target.value)} className="w-full md:w-1/2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900">
                <option value="">No coupon</option>
                {coupons.filter((c: any) => c.isActive).map((c: any) => <option key={c.id || c.code} value={c.code}>{c.code}</option>)}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">Only active coupons from the main Coupons manager can be selected. The server rechecks the coupon before dispatch.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Email Message Body
                </label>
                <textarea
                  rows={3}
                  value={draftEmailText}
                  onChange={(e) => setDraftEmailText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                      Meta Approved Template Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. toriwear_drop_launch"
                      value={draftWaTemplate}
                      onChange={(e) => setDraftWaTemplate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                      Language Code
                    </label>
                    <input
                      type="text"
                      value={draftWaLang}
                      onChange={(e) => setDraftWaLang(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    WhatsApp Template Body Variables (CSV; add one final slot for coupon if selected)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Drop 001, launch benefit"
                    value={draftWaVarsText}
                    onChange={(e) => setDraftWaVarsText(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={dbReady === false || isSavingDraft}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {isSavingDraft ? 'Saving Draft...' : 'Save Campaign Draft'}
              </button>
            </div>
          </form>

          {/* Saved Campaigns List */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Launch Campaigns ({campaigns.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 font-mono">
                  <tr>
                    <th className="py-2.5 px-4">Campaign</th>
                    <th className="py-2.5 px-3">Channels</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Queued / Sent</th>
                    <th className="py-2.5 px-3 text-right">Delivered / Read</th>
                    <th className="py-2.5 px-3 text-right">Failed</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingCampaigns ? (
                    <tr>
                      <td colSpan={7} className="py-6 px-4 text-center text-slate-400 font-mono">
                        Loading campaigns...
                      </td>
                    </tr>
                  ) : campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 px-4 text-center text-slate-500">
                        No launch campaigns created yet. Save a draft above to run a test send or launch batch.
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((camp) => (
                      <tr key={camp.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900">{camp.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {camp.subject || camp.whatsappTemplateName || camp.id}{camp.couponCode ? ` · Coupon: ${camp.couponCode}` : ''}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{camp.channels}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                              STATUS_BADGE_MAP[camp.status] || STATUS_BADGE_MAP.DRAFT
                            }`}
                          >
                            {camp.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {camp.totalRecipients} / {camp.sentCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700">
                          {camp.deliveredCount} / {camp.readCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-red-600 font-semibold">
                          {camp.failedCount}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setTestTargetCampaign(camp);
                                setTestResultMsg(null);
                              }}
                              className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium cursor-pointer"
                            >
                              Test Send
                            </button>

                            {camp.status === 'DRAFT' && (
                              <button
                                type="button"
                                onClick={() => setConfirmSendCampaign(camp)}
                                className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Confirm Send
                              </button>
                            )}

                            {camp.failedCount > 0 && (
                              <button
                                type="button"
                                disabled={retryingCampaignId === camp.id}
                                onClick={() => void handleRetryFailed(camp.id)}
                                className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Retry Failed</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setDeliveryCampaignFilter(camp.id)}
                              className="px-2 py-1 rounded text-slate-500 hover:text-slate-900 text-[11px] font-mono cursor-pointer"
                            >
                              Logs
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delivery Status Tracking Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Notification Delivery Logs ({deliveries.length})
                </h3>
                {deliveryCampaignFilter && (
                  <button
                    type="button"
                    onClick={() => setDeliveryCampaignFilter('')}
                    className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono cursor-pointer"
                  >
                    Campaign Filtered ×
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={deliveryChannelFilter}
                  onChange={(e) => setDeliveryChannelFilter(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700"
                >
                  <option value="ALL">All Channels</option>
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>
                <select
                  value={deliveryStatusFilter}
                  onChange={(e) => setDeliveryStatusFilter(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="QUEUED">Queued</option>
                  <option value="SENT">Sent</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="READ">Read</option>
                  <option value="FAILED">Failed</option>
                  <option value="BOUNCED">Bounced</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 font-mono">
                  <tr>
                    <th className="py-2.5 px-4">Channel / Event</th>
                    <th className="py-2.5 px-3">Recipient</th>
                    <th className="py-2.5 px-3">Provider ID</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Failure Details</th>
                    <th className="py-2.5 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deliveries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 px-4 text-center text-slate-500">
                        No delivery logs recorded for the current filter.
                      </td>
                    </tr>
                  ) : (
                    deliveries.map((del) => (
                      <tr key={del.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4 font-mono">
                          <div className="font-semibold text-slate-900">{del.channel}</div>
                          <div className="text-[10px] text-slate-500">{del.eventType}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{del.recipientMask}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 truncate max-w-[180px]">
                          {del.providerMessageId || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                              STATUS_BADGE_MAP[del.status] || STATUS_BADGE_MAP.DRAFT
                            }`}
                          >
                            {del.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-red-600 max-w-[240px] truncate">
                          {del.failureReason || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-500 tabular-nums">
                          {formatShortDate(del.readAt || del.deliveredAt || del.sentAt || del.failedAt || del.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Send Test Notification */}
      {testTargetCampaign && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Test Send: {testTargetCampaign.name}
              </h3>
              <button
                type="button"
                onClick={() => setTestTargetCampaign(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendTest} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Admin Test Email (optional)
                </label>
                <input
                  type="email"
                  placeholder="admin@toriwear.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Admin Test WhatsApp E.164 (optional)
                </label>
                <input
                  type="tel"
                  placeholder="+919876543210"
                  value={testWhatsappNumber}
                  onChange={(e) => setTestWhatsappNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                />
              </div>

              {testResultMsg && (
                <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-800">
                  {testResultMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTestTargetCampaign(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isSendingTest ? 'Sending...' : 'Send Test Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Explicit Confirmation Before Batch Send */}
      {confirmSendCampaign && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-50 text-red-600 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Confirm Live Launch Dispatch
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  You are about to dispatch <strong>{confirmSendCampaign.name}</strong> via{' '}
                  <strong className="font-mono">{confirmSendCampaign.channels}</strong> to all active opted-in subscribers ({stats?.activeSubscribers ?? 0} total active).
                </p>
                {((confirmSendCampaign.channels !== 'WHATSAPP' && !providers.email?.configured) ||
                  (confirmSendCampaign.channels !== 'EMAIL' && !providers.whatsapp?.configured)) && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 font-mono">
                    Warning: One or more selected providers are missing credentials or are not enabled in API & Integrations. Those deliveries may fail.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmSendCampaign(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDispatchingCampaign}
                onClick={() => void handleConfirmBatchSend()}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isDispatchingCampaign ? 'Dispatching...' : 'Confirm & Dispatch Batch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
