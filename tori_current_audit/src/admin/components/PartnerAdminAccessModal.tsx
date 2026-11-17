import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ShieldCheck,
  Crown,
  Sliders,
  CheckCircle2,
  Lock,
  Unlock,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import {
  PlatformUser,
  GranularPermissions,
  ModuleName,
  PermissionAction,
  AdminAccessTier,
} from '../../../server/rbacTypes';
import { platformApi } from '../services/platformService';

interface PartnerAdminAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  partner: PlatformUser;
  onSuccess: (updatedPartner?: PlatformUser) => void | Promise<void>;
}

const ALL_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'approve', 'export', 'delete'];

const GOVERNANCE_MODULES: { id: ModuleName; label: string; description: string }[] = [
  {
    id: 'superAdmin',
    label: 'Super Admin Control Center',
    description: 'Access staff password/2FA controls, security policy settings, and enterprise audit feed.',
  },
  {
    id: 'staff',
    label: 'Staff & Roles Management',
    description: 'Create staff accounts, change operational roles, and suspend or reactivate staff.',
  },
  {
    id: 'security',
    label: 'Audit Trail & Security Policies',
    description: 'Inspect complete enterprise audit logs, IP activity, and configure session/2FA rules.',
  },
  {
    id: 'settings',
    label: 'Store Settings, Payments & Logistics',
    description: 'Manage GST/store configuration, Razorpay/payment gateways, and shipping courier integrations.',
  },
];

const OPERATIONAL_MODULES: { id: ModuleName; label: string; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard Overview', description: 'KPI cards, live sales pulse, and executive summary.' },
  { id: 'products', label: 'Products Vault', description: 'Create, edit, publish, and archive catalog products.' },
  { id: 'inventory', label: 'Inventory & Stock', description: 'Adjust warehouse stock, thresholds, and SKUs.' },
  { id: 'orders', label: 'Orders Fulfillment', description: 'Process orders, manifests, cancellations, and refunds.' },
  { id: 'shipping', label: 'Logistics & Returns', description: 'Generate labels, schedule pickups, and process returns.' },
  { id: 'customers', label: 'Customer CRM', description: 'View customer profiles, addresses, and loyalty credits.' },
  { id: 'customerSupport', label: 'Customer Support', description: 'Handle support inquiries and order escalations.' },
  { id: 'marketing', label: 'Promotions & Ads', description: 'Manage coupons, flash sales, and promotional banners.' },
  { id: 'website', label: 'Storefront CMS', description: 'Edit homepage hero, lore cards, sections, and brand logo.' },
  { id: 'catalog', label: 'Digital Line Sheet', description: 'Access wholesale/digital catalog exports.' },
  { id: 'finance', label: 'Finance & Accounts', description: 'Accounts, transactions, partner ledger, and profit splits.' },
  { id: 'reports', label: 'Reports & GST Analytics', description: 'View and export GST and multi-module reports.' },
  { id: 'aiDesignLab', label: 'AI Design Lab', description: 'Generate anime apparel concepts and convert to product drafts.' },
  { id: 'communication', label: 'Internal Teams Chat', description: 'Team channels, partner threads, and direct messages.' },
  { id: 'meetings', label: 'Internal Meetings', description: 'Schedule and join encrypted partner/staff meetings.' },
];

const ALL_MODULE_IDS: ModuleName[] = [
  ...GOVERNANCE_MODULES.map((m) => m.id),
  ...OPERATIONAL_MODULES.map((m) => m.id),
];

function buildFullAdminPermissions(): GranularPermissions {
  const next = {} as GranularPermissions;
  for (const mod of ALL_MODULE_IDS) {
    next[mod] = [...ALL_ACTIONS];
  }
  return next;
}

function buildStandardPartnerPermissions(): GranularPermissions {
  return {
    dashboard: ['view', 'export'],
    products: ['view', 'create', 'edit', 'approve', 'export'],
    inventory: ['view', 'create', 'edit', 'approve', 'export'],
    orders: ['view', 'create', 'edit', 'approve', 'export'],
    customers: ['view', 'edit', 'export'],
    customerSupport: ['view', 'edit', 'export'],
    marketing: ['view', 'create', 'edit', 'approve', 'export'],
    catalog: ['view', 'create', 'edit', 'approve', 'export'],
    shipping: ['view', 'edit', 'export'],
    finance: ['view', 'create', 'edit', 'approve', 'export'],
    reports: ['view', 'export'],
    communication: ['view', 'create', 'edit', 'approve', 'export'],
    meetings: ['view', 'create', 'edit', 'approve', 'export'],
    aiDesignLab: ['view', 'create', 'edit', 'approve', 'export'],
    website: ['view', 'edit'],
    staff: [],
    security: [],
    settings: [],
    superAdmin: [],
  };
}

function buildReadOnlyPermissions(): GranularPermissions {
  const next = {} as GranularPermissions;
  for (const mod of ALL_MODULE_IDS) {
    if (mod === 'superAdmin' || mod === 'staff') {
      next[mod] = [];
    } else {
      next[mod] = ['view', 'export'];
    }
  }
  return next;
}

function clonePermissions(raw?: Partial<GranularPermissions>): GranularPermissions {
  const fallback = buildStandardPartnerPermissions();
  const next = {} as GranularPermissions;
  for (const mod of ALL_MODULE_IDS) {
    const arr = raw && Array.isArray(raw[mod]) ? raw[mod]! : fallback[mod] || [];
    next[mod] = [...arr];
  }
  return next;
}

export const PartnerAdminAccessModal: React.FC<PartnerAdminAccessModalProps> = ({
  isOpen,
  onClose,
  partner,
  onSuccess,
}) => {
  const [permissions, setPermissions] = useState<GranularPermissions>(() =>
    clonePermissions(partner.permissions)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPermissions(clonePermissions(partner.permissions));
      setError('');
    }
  }, [isOpen, partner]);

  const computedTier: AdminAccessTier = useMemo(() => {
    const hasSuperAdminFull =
      permissions.superAdmin?.includes('view') &&
      (permissions.staff?.includes('edit') || permissions.staff?.includes('view')) &&
      permissions.security?.includes('view') &&
      (permissions.settings?.includes('edit') || permissions.settings?.includes('view'));

    if (hasSuperAdminFull) return 'FULL_ADMIN';
    const hasAnyElevated =
      (permissions.superAdmin?.length || 0) > 0 ||
      (permissions.staff?.length || 0) > 0 ||
      (permissions.security?.length || 0) > 0 ||
      (permissions.settings?.length || 0) > 0;
    return hasAnyElevated ? 'ELEVATED_PARTNER' : 'STANDARD_PARTNER';
  }, [permissions]);

  const unlockedModulesCount = useMemo(
    () => ALL_MODULE_IDS.filter((mod) => (permissions[mod]?.length || 0) > 0).length,
    [permissions]
  );

  if (!isOpen) return null;

  const toggleModuleAll = (mod: ModuleName) => {
    setPermissions((prev) => {
      const current = prev[mod] || [];
      const isEnabled = current.length > 0;
      return {
        ...prev,
        [mod]: isEnabled ? [] : [...ALL_ACTIONS],
      };
    });
  };

  const toggleAction = (mod: ModuleName, action: PermissionAction) => {
    setPermissions((prev) => {
      const current = prev[mod] || [];
      const exists = current.includes(action);
      const updated = exists ? current.filter((a) => a !== action) : [...current, action];
      return {
        ...prev,
        [mod]: updated,
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await platformApi.updatePartnerPermissions(partner.id, {
        permissions,
        adminAccessTier: computedTier,
      });
      if (!res.success) {
        setError(res.error || 'Failed to update partner admin access.');
        setSaving(false);
        return;
      }
      await onSuccess(res.partner);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Network error while updating partner admin access.');
    } finally {
      setSaving(false);
    }
  };

  const renderModuleRow = (
    mod: { id: ModuleName; label: string; description: string },
    isGovernance: boolean
  ) => {
    const actions = permissions[mod.id] || [];
    const enabled = actions.length > 0;

    return (
      <div
        key={mod.id}
        className={`p-3.5 rounded-xl border transition-colors ${
          isGovernance
            ? enabled
              ? 'bg-indigo-50/70 border-indigo-200'
              : 'bg-slate-50 border-slate-200'
            : enabled
              ? 'bg-white border-slate-200'
              : 'bg-slate-50/70 border-slate-200 opacity-80'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">{mod.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  enabled
                    ? isGovernance
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {enabled ? `${actions.length}/6 ACTIONS` : 'LOCKED'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{mod.description}</p>
          </div>

          <button
            type="button"
            onClick={() => toggleModuleAll(mod.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
              enabled
                ? 'bg-slate-900 hover:bg-slate-800 text-white'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
            }`}
          >
            {enabled ? <Unlock className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3 text-slate-400" />}
            <span>{enabled ? 'Disable Module' : 'Unlock All'}</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3 pt-2.5 border-t border-slate-200/70">
          {ALL_ACTIONS.map((action) => {
            const checked = actions.includes(action);
            return (
              <label
                key={action}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors ${
                  checked
                    ? isGovernance
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleAction(mod.id, action)}
                  className="sr-only"
                />
                <span className="capitalize">{action}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={partner.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80'}
              alt={partner.name}
              className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 truncate">
                  Manage Admin Access — {partner.name}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {partner.ownershipPercentage || 25}% EQUAL PARTNER
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    computedTier === 'FULL_ADMIN'
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      : computedTier === 'ELEVATED_PARTNER'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {computedTier === 'FULL_ADMIN'
                    ? 'Full Admin Access'
                    : computedTier === 'ELEVATED_PARTNER'
                      ? 'Elevated Admin'
                      : 'Standard Partner'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono truncate mt-0.5">
                {partner.email} · {unlockedModulesCount} of {ALL_MODULE_IDS.length} Admin Modules Unlocked
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Quick One-Click Access Presets */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider">Quick Access Presets</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Choose a preset or customize individual modules below
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setPermissions(buildFullAdminPermissions())}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  computedTier === 'FULL_ADMIN'
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Crown className="w-3.5 h-3.5 text-amber-300" />
                  <span>Full Admin Access</span>
                </div>
                <div className="text-[11px] opacity-80 mt-1">
                  Unlock all 19 admin modules including Staff, Audit Trail, Store Settings & Super Admin Control.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPermissions(buildStandardPartnerPermissions())}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  computedTier === 'STANDARD_PARTNER'
                    ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Standard Partner</span>
                </div>
                <div className="text-[11px] opacity-80 mt-1">
                  Full store, products, orders, CRM, AI Lab, CMS & finance access without governance controls.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPermissions(buildReadOnlyPermissions())}
                className="p-3 rounded-xl border bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                  <span>Executive View-Only</span>
                </div>
                <div className="text-[11px] opacity-80 mt-1">
                  Read & export analytics across business modules without edit or delete privileges.
                </div>
              </button>
            </div>
          </div>

          {/* Root Safeguard Notice */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Super Admin Root Protection:</strong> Even with Full Admin Access enabled, {partner.name} can never modify, suspend, reset credentials, or alter 25% equity structure for <strong>Mohammed Saif (usr-saif)</strong> or fellow Partners.
            </div>
          </div>

          {/* Governance & Restricted Admin Modules */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-indigo-600" />
                <span>Restricted Admin & Governance Controls</span>
              </h4>
              <span className="text-[11px] text-slate-500">Controls previously limited to Super Admin</span>
            </div>
            <div className="space-y-2.5">
              {GOVERNANCE_MODULES.map((m) => renderModuleRow(m, true))}
            </div>
          </div>

          {/* Storefront, Operations & AI Modules */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Storefront, AI Lab & Operations Modules</span>
              </h4>
              <span className="text-[11px] text-slate-500">Operational modules & day-to-day workflows</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {OPERATIONAL_MODULES.map((m) => renderModuleRow(m, false))}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Changes persist immediately to the database and take effect on {partner.name}&apos;s next request/refresh.
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Saving Access...' : 'Save Admin Access'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
