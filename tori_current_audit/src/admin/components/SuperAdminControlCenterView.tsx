import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Crown,
  Users,
  KeyRound,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Sliders,
  Activity,
  PlusCircle,
  X,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { platformApi } from '../services/platformService';
import { PlatformUser, SecurityPolicyConfig, PlatformAuditEntry } from '../../../server/rbacTypes';
import { AdminResetUserPasswordModal } from './AdminResetUserPasswordModal';
import { PartnerAdminAccessModal } from './PartnerAdminAccessModal';
import { useAdmin } from '../AdminDataContext';

const PRECONFIGURED_CREDENTIALS: Record<string, { employeeId: string }> = {};

function getAccessTierLabel(partner: PlatformUser): { label: string; badgeClass: string; unlockedCount: number } {
  const perms = partner.permissions || ({} as any);
  const unlockedCount = Object.values(perms).filter((arr: any) => Array.isArray(arr) && arr.length > 0).length;
  const tier = partner.adminAccessTier;
  if (tier === 'FULL_ADMIN') {
    return {
      label: `Full Admin Access (${unlockedCount} Modules)`,
      badgeClass: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
      unlockedCount,
    };
  }
  if (tier === 'ELEVATED_PARTNER') {
    return {
      label: `Elevated Admin (${unlockedCount} Modules)`,
      badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200',
      unlockedCount,
    };
  }
  return {
    label: `Standard Partner (${unlockedCount} Modules)`,
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
    unlockedCount,
  };
}

export const SuperAdminControlCenterView: React.FC = () => {
  const { refreshCurrentUser } = useAdmin();
  const [currentUser, setCurrentUser] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [partners, setPartners] = useState<PlatformUser[]>([]);
  const [staff, setStaff] = useState<PlatformUser[]>([]);
  const [policies, setPolicies] = useState<SecurityPolicyConfig | null>(null);
  const [criticalAuditLogs, setCriticalAuditLogs] = useState<PlatformAuditEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'PARTNERS' | 'STAFF' | 'SECURITY' | 'AUDIT'>('PARTNERS');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [partnerError, setPartnerError] = useState<string>('');

  // Modals
  const [passwordModalUser, setPasswordModalUser] = useState<PlatformUser | null>(null);
  const [accessModalPartner, setAccessModalPartner] = useState<PlatformUser | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // New Partner Modal
  const [showCreatePartnerModal, setShowCreatePartnerModal] = useState(false);
  const [partnerForm, setPartnerForm] = useState({
    name: '',
    email: '',
    phone: '',
    roleDesignation: '',
    department: 'Executive Leadership',
  });

  const loadData = async () => {
    try {
      const cur = await platformApi.getCurrentUser();
      setCurrentUser(cur);
      const userRes = await platformApi.getUsers();
      setPartners(userRes.partners);
      setStaff(userRes.staff);
      const pol = await platformApi.getSecurityPolicies();
      setPolicies(pol);
      const logs = await platformApi.getAuditLogs({ limit: 50 });
      setCriticalAuditLogs(logs);
    } catch (err) {
      console.error('Failed to load Super Admin Control Center data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const isRootSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.id === 'usr-saif';
  const hasElevatedSuperAdminAccess =
    isRootSuperAdmin || Boolean(currentUser?.permissions?.superAdmin?.includes('view'));
  const canEditSuperAdminControls =
    isRootSuperAdmin ||
    Boolean(
      currentUser?.permissions?.superAdmin?.includes('edit') ||
        currentUser?.permissions?.security?.includes('edit')
    );

  if (loading && !currentUser) {
    return (
      <div className="py-16 text-center text-xs text-slate-500 font-medium">
        Loading Super Admin Control Center...
      </div>
    );
  }

  // Super Admin & explicitly authorized Partner gate
  if (!hasElevatedSuperAdminAccess) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center max-w-2xl mx-auto my-12 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-100 border border-red-200 text-red-600 flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Super Admin Control Center Restricted
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Access denied. This console is accessible by <strong>Mohammed Saif (Super Admin)</strong> or Partners explicitly granted <strong>Super Admin Control</strong> access.
        </p>
        <div className="pt-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold cursor-pointer hover:bg-slate-800"
          >
            Return to Authorized Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleForceLogout = async (userId: string, name: string) => {
    try {
      const res = await platformApi.forceLogout(userId);
      if (res.success) {
        triggerNotice(`Active sessions revoked and forced logout completed for ${name}.`);
        await loadData();
      } else {
        triggerNotice(res.error || 'Failed to force logout.');
      }
    } catch (err: any) {
      triggerNotice(err.message || 'Error executing force logout.');
    }
  };

  const handleReset2FA = async (userId: string, name: string) => {
    try {
      const res = await platformApi.reset2FA(userId);
      if (res.success) {
        triggerNotice(`2FA security configuration reset for ${name}.`);
        await loadData();
      } else {
        triggerNotice(res.error || 'Failed to reset 2FA.');
      }
    } catch (err: any) {
      triggerNotice(err.message || 'Error resetting 2FA.');
    }
  };

  const handleDeactivatePartner = async (partnerId: string, name: string) => {
    try {
      const res = await platformApi.deactivatePartner(partnerId);
      if (res.success) {
        triggerNotice(`Partner account for ${name} has been suspended.`);
        await loadData();
      } else {
        triggerNotice(res.error || 'Failed to deactivate partner.');
      }
    } catch (err: any) {
      triggerNotice(err.message || 'Error deactivating partner.');
    }
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerForm.name || !partnerForm.email || !partnerForm.roleDesignation) return;
    setPartnerError('');
    try {
      const res = await platformApi.createPartner(partnerForm);
      if (res.success) {
        setShowCreatePartnerModal(false);
        setPartnerError('');
        setPartnerForm({
          name: '',
          email: '',
          phone: '',
          roleDesignation: '',
          department: 'Executive Leadership',
        });
        triggerNotice(`New equal partner ${res.partner?.name} (25% structure) created successfully.`);
        await loadData();
      } else {
        setPartnerError(res.error || 'Failed to create partner.');
      }
    } catch (err: any) {
      setPartnerError(err.message || 'Error creating partner.');
    }
  };

  const handleUpdatePolicy = async (key: keyof SecurityPolicyConfig, val: any) => {
    if (!policies) return;
    const updated = { ...policies, [key]: val };
    setPolicies(updated);
    try {
      await platformApi.updateSecurityPolicies({ [key]: val });
      triggerNotice(`Security policy "${String(key)}" updated.`);
    } catch (err) {
      console.error('Failed to update policy:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      {actionNotice && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between text-xs font-semibold animate-in fade-in slide-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-white/80 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-red-950 text-white rounded-3xl p-6 shadow-xl border border-red-900/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Crown className="w-36 h-36 text-red-500" />
        </div>

        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-red-600 text-white uppercase shadow-sm">
              SUPER ADMIN EXCLUSIVE
            </span>
            <span className="text-xs text-slate-300 font-mono">Master System Controls · Mohammed Saif</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Super Admin Control Center</span>
          </h1>
          <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
            Direct executive oversight over all partner credentials, staff lifecycle, two-factor enforcement, hardware session termination, and immutable cryptographic audit feeds.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('PARTNERS')}
          className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'PARTNERS'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <Crown className="w-4 h-4 text-amber-400" />
          <span>Partner Management ({partners.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('STAFF')}
          className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'STAFF'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-blue-400" />
          <span>Staff Management ({staff.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('SECURITY')}
          className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'SECURITY'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4 text-red-400" />
          <span>Security & 2FA Policies</span>
        </button>

        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'AUDIT'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Critical Administrative Audit</span>
        </button>
      </div>

      {/* 1. PARTNER MANAGEMENT */}
      {activeTab === 'PARTNERS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Partner Credentials, Admin Access & Session Controls</h2>
              {isRootSuperAdmin && (
                <p className="text-[11px] text-slate-500">
                  Click <strong>Manage Admin Access</strong> on any Partner card to unlock full admin options or customize module permissions.
                </p>
              )}
            </div>
            {isRootSuperAdmin && (
              <button
                onClick={() => setShowCreatePartnerModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create New Partner</span>
              </button>
            )}
          </div>

          <div className="space-y-4">
            {partners.map((partner) => {
              const isSaif = partner.id === 'usr-saif';
              const creds = PRECONFIGURED_CREDENTIALS[partner.id];
              const tierInfo = getAccessTierLabel(partner);
              const canManageThisPartnerCreds = isRootSuperAdmin || partner.id === currentUser?.id;

              return (
                <div 
                  key={partner.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <img 
                        src={partner.avatarUrl} 
                        alt={partner.name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0" 
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{partner.name}</span>
                          {isSaif ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                              SUPER ADMIN ROOT
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tierInfo.badgeClass}`}>
                              {tierInfo.label}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                            {partner.ownershipPercentage}% EQUAL
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                            ID: {partner.employeeId || creds?.employeeId || 'TORI-001'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">{partner.designation} · {partner.department}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{partner.email} · {partner.phone || 'No phone recorded'}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {!isSaif && isRootSuperAdmin && (
                        <button
                          onClick={() => setAccessModalPartner(partner)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                          title="Grant full admin access or customize individual admin modules for this partner"
                        >
                          <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Manage Admin Access</span>
                        </button>
                      )}

                      {canManageThisPartnerCreds && (
                        <button
                          onClick={() => setPasswordModalUser(partner)}
                          className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                          title="Directly reset, create, or overwrite password for this partner"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-red-600" />
                          <span>Reset / Set Password</span>
                        </button>
                      )}

                      {isRootSuperAdmin && (
                        <>
                          <button
                            onClick={() => handleForceLogout(partner.id, partner.name)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                            title="Invalidates all sessions across devices immediately"
                          >
                            <LogOut className="w-3.5 h-3.5 text-slate-500" />
                            <span>Force Logout</span>
                          </button>

                          <button
                            onClick={() => handleReset2FA(partner.id, partner.name)}
                            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                            title="Requires partner to re-enroll TOTP device"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                            <span>Reset 2FA</span>
                          </button>
                        </>
                      )}

                      {!isSaif ? (
                        isRootSuperAdmin ? (
                          <button
                            onClick={() => handleDeactivatePartner(partner.id, partner.name)}
                            className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                            <span>Deactivate Partner</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono px-2 py-1 bg-slate-50 rounded-lg border border-slate-200">
                            Partner Protected
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono px-2 py-1 bg-slate-50 rounded-lg border border-slate-200">
                          Immutable Master
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Partner Credentials & Emergency Recovery Codes Directory */}
                  <div className="pt-3 border-t border-slate-100 bg-slate-50/70 -mx-5 -mb-5 p-4 rounded-b-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 text-[11px] font-medium">Default Password:</span>
                        <code className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          Secure invitation required
                        </code>
                        <button
                          onClick={() => setActionNotice('Use the secure password reset/invitation workflow; default passwords are disabled.')}
                          className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="Copy Password"
                        >
                          {copiedKey === `pass-${partner.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 text-[11px] font-medium">2FA Status:</span>
                        <span className={`font-bold flex items-center gap-1 text-[11px] ${partner.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-500'}`}>
                          <ShieldCheck className="w-3.5 h-3.5" /> {partner.twoFactorEnabled ? 'Enabled (RFC 6238)' : 'Optional (Off)'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-slate-500 text-[11px] font-medium">Google Authenticator:</span>
                      <span className={`px-2 py-0.5 bg-white font-mono text-[10px] font-bold rounded border border-slate-200 flex items-center gap-1 ${partner.twoFactorEnabled ? 'text-emerald-700' : 'text-slate-600'}`}>
                        <ShieldCheck className={`w-3 h-3 ${partner.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-400'}`} />
                        {partner.twoFactorEnabled ? '5 Single-Use Cryptographic Codes Initialized' : 'Optional — Enable anytime in My Account & Security'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. STAFF MANAGEMENT */}
      {activeTab === 'STAFF' && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Staff Account Controls & Privilege Revocation</h2>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Department & Role</th>
                    <th className="py-3 px-4">Initial Credentials</th>
                    <th className="py-3 px-4">2FA Emergency Codes</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Super Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staff.map((s) => {
                    const creds = PRECONFIGURED_CREDENTIALS[s.id];
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{s.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{s.email}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {s.employeeId || creds?.employeeId || 'TORI-EMP'}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          <div className="font-medium text-slate-900">{s.designation}</div>
                          <div className="text-[11px] text-slate-500">{s.department}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <code className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                              Secure invitation required
                            </code>
                            <button
                              onClick={() => setActionNotice('Use the secure password reset/invitation workflow; default passwords are disabled.')}
                              className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                              title="Copy Password"
                            >
                              {copiedKey === `pass-${s.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className={`text-[10px] font-mono flex items-center gap-1 font-semibold ${s.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-500'}`}>
                            <ShieldCheck className={`w-3 h-3 ${s.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <span>{s.twoFactorEnabled ? 'Enabled (TOTP)' : 'Optional (Off)'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.accountStatus === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {s.accountStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {canEditSuperAdminControls ? (
                            <>
                              <button
                                onClick={() => setPasswordModalUser(s)}
                                className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold cursor-pointer"
                                title="Reset or overwrite password for this staff member"
                              >
                                Set Password
                              </button>
                              <button
                                onClick={() => handleForceLogout(s.id, s.name)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer"
                              >
                                Force Logout
                              </button>
                              <button
                                onClick={() => handleReset2FA(s.id, s.name)}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-medium cursor-pointer"
                              >
                                Reset 2FA
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono">View Only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. SECURITY & 2FA POLICIES */}
      {activeTab === 'SECURITY' && policies && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Enterprise Security Policies</h2>
            <p className="text-xs text-slate-500">
              Adjust platform authentication standards, session timeouts, and encryption enforcement (requires Super Admin or granted Security Edit access).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Require 2FA for Staff</span>
                <span className="text-[11px] text-slate-500">Mandates hardware/authenticator app TOTP codes</span>
              </div>
              <input
                type="checkbox"
                disabled={!canEditSuperAdminControls}
                checked={policies.requireTwoFactorForStaff}
                onChange={(e) => handleUpdatePolicy('requireTwoFactorForStaff', e.target.checked)}
                className="w-4 h-4 rounded text-red-600 cursor-pointer disabled:opacity-50"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Require 2FA for Equal Partners</span>
                <span className="text-[11px] text-slate-500">Enforces two-factor token for all 4 partners</span>
              </div>
              <input
                type="checkbox"
                disabled={!canEditSuperAdminControls}
                checked={policies.requireTwoFactorForPartners}
                onChange={(e) => handleUpdatePolicy('requireTwoFactorForPartners', e.target.checked)}
                className="w-4 h-4 rounded text-red-600 cursor-pointer disabled:opacity-50"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Session Inactivity Timeout (Minutes)</span>
                <span className="text-[11px] text-slate-500">Forces re-authentication after idle duration</span>
              </div>
              <select
                disabled={!canEditSuperAdminControls}
                value={policies.sessionTimeoutMinutes}
                onChange={(e) => handleUpdatePolicy('sessionTimeoutMinutes', Number(e.target.value))}
                className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 font-semibold disabled:opacity-50"
              >
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={60}>60 Minutes</option>
                <option value={120}>2 Hours</option>
              </select>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Enforce E2E Encryption in Private Chat</span>
                <span className="text-[11px] text-slate-500">Client-side Web Crypto AES-GCM for partner threads</span>
              </div>
              <input
                type="checkbox"
                disabled={!canEditSuperAdminControls}
                checked={policies.enforceE2EEncryptionInPrivateChat}
                onChange={(e) => handleUpdatePolicy('enforceE2EEncryptionInPrivateChat', e.target.checked)}
                className="w-4 h-4 rounded text-red-600 cursor-pointer disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. CRITICAL AUDIT FEED */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Critical Administrative Security Audit</h2>
              <p className="text-xs text-slate-500">Real-time immutable audit trail of credential modifications, logins, and approvals.</p>
            </div>
            <span className="text-xs text-slate-500 font-mono">Live Entries: {criticalAuditLogs.length}</span>
          </div>

          <div className="divide-y divide-slate-100">
            {criticalAuditLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      log.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                      log.severity === 'WARNING' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {log.severity}
                    </span>
                    <span className="font-bold text-slate-900">{log.action}</span>
                    <span className="text-[11px] text-slate-400 font-mono">({log.module})</span>
                  </div>
                  <div className="text-slate-700">Affected: <strong>{log.recordAffected}</strong></div>
                  {log.newValue && (
                    <div className="text-slate-500 text-[11px] font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200/60 max-w-xl">
                      {log.newValue}
                    </div>
                  )}
                </div>

                <div className="text-right text-[11px] text-slate-500 font-mono shrink-0">
                  <div>{log.userName} ({log.userRole})</div>
                  <div>IP: {log.ipAddress}</div>
                  <div className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleTimeString('en-IN')} IST</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE PARTNER MODAL */}
      {showCreatePartnerModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">Provision Partner Account</h3>
              </div>
              <button onClick={() => setShowCreatePartnerModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePartner} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Partner Full Name</label>
                <input
                  type="text"
                  required
                  value={partnerForm.name}
                  onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                  placeholder="e.g. Lokesh Kottala"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Official Company Email</label>
                <input
                  type="email"
                  required
                  value={partnerForm.email}
                  onChange={(e) => setPartnerForm({ ...partnerForm, email: e.target.value })}
                  placeholder="partner@toriwear.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Direct Phone</label>
                <input
                  type="tel"
                  value={partnerForm.phone}
                  onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                  placeholder="+91 98450 12091"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Role Designation</label>
                <input
                  type="text"
                  required
                  value={partnerForm.roleDesignation}
                  onChange={(e) => setPartnerForm({ ...partnerForm, roleDesignation: e.target.value })}
                  placeholder="e.g. Creative & Brand Art Director"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-[11px]">
                <strong>Statutory Equal Provisioning:</strong> This partner account will automatically be created with <strong>25% equal ownership</strong> and <strong>25% net profit allocation</strong> in full alignment with the partnership agreement.
              </div>

              {partnerError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-[11px] font-medium">
                  {partnerError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreatePartnerModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold shadow-sm cursor-pointer"
                >
                  Provision Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Super Admin & Partner Password Management Modal */}
      {passwordModalUser && (
        <AdminResetUserPasswordModal
          isOpen={Boolean(passwordModalUser)}
          onClose={() => setPasswordModalUser(null)}
          targetUser={passwordModalUser}
          onSuccess={loadData}
        />
      )}

      {/* Partner Admin Access Management Modal */}
      {accessModalPartner && (
        <PartnerAdminAccessModal
          isOpen={Boolean(accessModalPartner)}
          onClose={() => setAccessModalPartner(null)}
          partner={accessModalPartner}
          onSuccess={async (updated) => {
            triggerNotice(
              `Updated admin access for ${updated?.name || accessModalPartner.name} (${
                updated?.adminAccessTier === 'FULL_ADMIN'
                  ? 'Full Admin Access'
                  : updated?.adminAccessTier === 'ELEVATED_PARTNER'
                    ? 'Elevated Admin'
                    : 'Standard Partner'
              }).`
            );
            await loadData();
            await refreshCurrentUser();
          }}
        />
      )}
    </div>
  );
};
