import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  UserPlus,
  KeyRound,
  CheckCircle2,
  Smartphone,
  Layers,
  X,
  Copy,
  Check,
  Sliders,
} from 'lucide-react';
import { platformApi } from '../services/platformService';
import { PlatformUser, GranularPermissions, StaffDepartment, ModuleName, PermissionAction } from '../../../server/rbacTypes';
import { AdminResetUserPasswordModal } from './AdminResetUserPasswordModal';
import { PartnerAdminAccessModal } from './PartnerAdminAccessModal';
import { useAdmin } from '../AdminDataContext';

const MODULES_LIST: { id: ModuleName; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'finance', label: 'Finance & Accounts' },
  { id: 'products', label: 'Products Vault' },
  { id: 'inventory', label: 'Inventory & Stock' },
  { id: 'orders', label: 'Orders Fulfillment' },
  { id: 'customers', label: 'Customer CRM' },
  { id: 'customerSupport', label: 'Customer Support' },
  { id: 'marketing', label: 'Promotions & Ads' },
  { id: 'website', label: 'Storefront CMS' },
  { id: 'catalog', label: 'Digital Catalog' },
  { id: 'shipping', label: 'Logistics & Shipping' },
  { id: 'reports', label: 'Reports & Analytics' },
  { id: 'communication', label: 'Internal Chat & Meetings' },
  { id: 'aiDesignLab', label: 'AI Design Lab' },
  { id: 'staff', label: 'Staff & Roles' },
  { id: 'security', label: 'Audit Trail & Security' },
  { id: 'settings', label: 'Store Settings & Gateways' },
  { id: 'superAdmin', label: 'Super Admin Control' },
];

const ACTIONS_LIST: PermissionAction[] = ['view', 'create', 'edit', 'approve', 'export', 'delete'];

const PRECONFIGURED_CREDENTIALS: Record<string, { employeeId: string }> = {};

export const UserManagementView: React.FC = () => {
  const { refreshCurrentUser } = useAdmin();
  const [, setUsers] = useState<PlatformUser[]>([]);
  const [partners, setPartners] = useState<PlatformUser[]>([]);
  const [staff, setStaff] = useState<PlatformUser[]>([]);
  const [currentUser, setCurrentUser] = useState<PlatformUser | null>(null);
  const [activeTab, setActiveTab] = useState<'PARTNERS' | 'STAFF' | 'MATRIX'>('PARTNERS');
  const [, setLoading] = useState(true);

  // Modals
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [viewSessionsUser, setViewSessionsUser] = useState<PlatformUser | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<PlatformUser | null>(null);
  const [accessModalPartner, setAccessModalPartner] = useState<PlatformUser | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string>('');

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: 'Store & Operations' as StaffDepartment,
    designation: '',
    permissions: {} as GranularPermissions,
  });
  const [staffError, setStaffError] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const cur = await platformApi.getCurrentUser();
      setCurrentUser(cur);
      const res = await platformApi.getUsers();
      setUsers(res.users);
      setPartners(res.partners);
      setStaff(res.staff);
    } catch (err) {
      console.error('Failed to load user management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSwitchPerspective = async (userId: string) => {
    try {
      const switched = await platformApi.switchUser(userId);
      setCurrentUser(switched);
      await loadData();
    } catch (err) {
      console.error('Switch perspective failed:', err);
    }
  };

  const isPartnerOrAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'PARTNER';
  const isRootSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.id === 'usr-saif';

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.designation) return;

    try {
      const res = await platformApi.createStaff({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        department: formData.department,
        designation: formData.designation,
        permissions: formData.permissions,
      });

      if (res.success) {
        setShowAddStaffModal(false);
        setStaffError('');
        setFormData({
          name: '',
          email: '',
          phone: '',
          department: 'Store & Operations',
          designation: '',
          permissions: {} as any,
        });
        await loadData();
      } else {
        setStaffError(res.error || 'Failed to create staff member.');
      }
    } catch (err: any) {
      setStaffError(err.message || 'Error creating staff.');
    }
  };

  const handleTogglePermission = (mod: ModuleName, action: PermissionAction) => {
    setFormData(prev => {
      const curList = prev.permissions[mod] || [];
      const updatedList = curList.includes(action)
        ? curList.filter(a => a !== action)
        : [...curList, action];

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [mod]: updatedList,
        },
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Role Perspective Notice */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-red-600 text-white uppercase">
                ENTERPRISE RBAC ARCHITECTURE
              </span>
              <span className="text-xs text-slate-400">Server-Side Enforced Security</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              User & Role Management
            </h1>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Super Admin Mohammed Saif retains master root authority. Four equal 25% partners (Saif, Simranjeet, Lokesh, Nagesh) hold equal business ownership. Granular permissions govern staff access with server-side authorization.
            </p>
          </div>

          {/* Perspective Switcher */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3 flex flex-col gap-1.5 min-w-[280px]">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span className="font-semibold text-white">Active Session Perspective:</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-600/30 text-red-300 border border-red-500/40">
                {currentUser?.role}
              </span>
            </div>
            <select
              value={currentUser?.id || 'usr-saif'}
              onChange={(e) => handleSwitchPerspective(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <optgroup label="Super Admin">
                <option value="usr-saif">👑 Mohammed Saif (Super Admin - Master Control)</option>
              </optgroup>
              <optgroup label="Equal 25% Partners">
                <option value="usr-simranjeet">🤝 Simranjeet Singh (Partner - 25% Equal)</option>
                <option value="usr-lokesh">🤝 Lokesh Kottala (Partner - 25% Equal)</option>
                <option value="usr-nagesh">🤝 Nagesh M (Partner - 25% Equal)</option>
              </optgroup>
              <optgroup label="Staff Members">
                <option value="usr-ananya">👤 Ananya Sharma (Store Ops Manager)</option>
                <option value="usr-priya">👤 Priya Patel (Growth & Ads Specialist)</option>
                <option value="usr-vikram">👤 Vikram Mehta (Warehouse & Inventory Lead)</option>
              </optgroup>
            </select>
            <span className="text-[10px] text-slate-400">
              Switching perspectives instantly validates server-side RBAC restrictions.
            </span>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-2.5 text-xs flex items-center justify-between">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice('')}
            className="text-amber-700 hover:text-amber-900 font-bold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('PARTNERS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'PARTNERS'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Equal Partners & Super Admin (4)</span>
          </button>

          <button
            onClick={() => setActiveTab('STAFF')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'STAFF'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4 text-blue-400" />
            <span>Staff Directory ({staff.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('MATRIX')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'MATRIX'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Granular Permissions Matrix</span>
          </button>
        </div>

        {isPartnerOrAdmin && (
          <button
            onClick={() => setShowAddStaffModal(true)}
            className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Staff Account</span>
          </button>
        )}
      </div>

      {/* TAB 1: PARTNER ACCOUNTS & SUPER ADMIN */}
      {activeTab === 'PARTNERS' && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <strong className="font-bold">100% Equal Partnership Policy:</strong> Each partner maintains exactly <strong>25% ownership</strong> and <strong>25% net profit/loss share</strong>. Under strict platform security rules, Partners possess complete business admin access (Finance, Orders, Inventory, Catalog, Meetings, etc.) but cannot modify, deactivate, or take control of Mohammed Saif’s Super Admin root account.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {partners.map((partner) => {
              const isSaif = partner.id === 'usr-saif';
              const creds = PRECONFIGURED_CREDENTIALS[partner.id];
              const unlockedModulesCount = Object.values(partner.permissions || {}).filter(
                (acts: any) => Array.isArray(acts) && acts.length > 0
              ).length;
              const accessTier = partner.adminAccessTier;

              return (
                <div 
                  key={partner.id}
                  className={`bg-white rounded-2xl border p-5 shadow-xs transition-all relative overflow-hidden flex flex-col justify-between ${
                    isSaif ? 'border-red-300 ring-2 ring-red-500/20' : 'border-slate-200'
                  }`}
                >
                  {isSaif && (
                    <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl tracking-wider uppercase">
                      👑 Super Admin Root
                    </div>
                  )}

                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <img 
                          src={partner.avatarUrl} 
                          alt={partner.name}
                          className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shrink-0" 
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 truncate">{partner.name}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                              {partner.ownershipPercentage}% EQUAL
                            </span>
                            {!isSaif && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                  accessTier === 'FULL_ADMIN'
                                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                    : accessTier === 'ELEVATED_PARTNER'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {accessTier === 'FULL_ADMIN'
                                  ? `Full Admin (${unlockedModulesCount} Mod)`
                                  : accessTier === 'ELEVATED_PARTNER'
                                    ? `Elevated (${unlockedModulesCount} Mod)`
                                    : `Standard (${unlockedModulesCount} Mod)`}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-600 truncate mt-0.5">{partner.designation}</p>
                          <div className="text-[11px] text-slate-500 font-mono mt-1 truncate">{partner.email}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                              ID: {partner.employeeId || creds?.employeeId || 'TORI-001'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{partner.department}</span>
                          </div>
                        </div>
                      </div>

                      {/* Partner Admin & Credential Actions */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {!isSaif && isRootSuperAdmin && (
                          <button
                            onClick={() => setAccessModalPartner(partner)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                            title="Assign full admin options or customize module permissions for this partner"
                          >
                            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Manage Admin Access</span>
                          </button>
                        )}
                        {(isRootSuperAdmin || partner.id === currentUser?.id) && (
                          <button
                            onClick={() => setPasswordModalUser(partner)}
                            className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                            title="Directly reset, create, or overwrite password for this partner"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-red-600" />
                            <span>Reset / Set Password</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Profit / Loss Share</span>
                        <span className="font-bold text-slate-900 font-mono">{partner.profitSharePercentage}% (Statutory Equal)</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Two-Factor TOTP</span>
                        <span className={`font-bold flex items-center gap-1 ${partner.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-600'}`}>
                          <ShieldCheck className="w-3.5 h-3.5" /> {partner.twoFactorEnabled ? 'Enabled (RFC 6238)' : 'Optional (Off)'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1 font-mono">
                        <Smartphone className="w-3 h-3 text-slate-400" />
                        {partner.activeSessions.length} active sessions
                      </span>
                      <button
                        onClick={() => setViewSessionsUser(partner)}
                        className="text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                      >
                        View Sessions & Device
                      </button>
                    </div>
                  </div>

                  {/* Partner Credentials & Emergency Recovery Codes Directory */}
                  <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50/70 -mx-5 -mb-5 p-4 rounded-b-2xl flex flex-col gap-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 text-[11px] font-medium">Default Password:</span>
                        <code className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          Secure invitation required
                        </code>

                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 text-[11px] font-medium">2FA Status:</span>
                        <span className={`font-bold flex items-center gap-1 text-[11px] ${partner.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-600'}`}>
                          <ShieldCheck className="w-3.5 h-3.5" /> {partner.twoFactorEnabled ? 'Enabled (RFC 6238)' : 'Optional (Off)'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-500 text-[11px] font-medium mb-1">Google Authenticator Status:</div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-1 bg-white font-mono text-[10px] font-bold rounded border border-slate-200 flex items-center gap-1 shadow-2xs ${partner.twoFactorEnabled ? 'text-emerald-700' : 'text-slate-600'}`}>
                          <ShieldCheck className={`w-3 h-3 ${partner.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-400'}`} />
                          {partner.twoFactorEnabled ? '5 Single-Use Hashed Recovery Codes Initialized' : 'Optional — Enable anytime in My Account & Security'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: STAFF DIRECTORY */}
      {activeTab === 'STAFF' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Enterprise Staff Roster</h2>
              <p className="text-xs text-slate-500">
                Staff members operate under strictly assigned departmental and module-level permissions.
              </p>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Total Staff: <strong className="text-slate-900">{staff.length}</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Department & Role</th>
                  <th className="py-3 px-4">Staff ID</th>
                  <th className="py-3 px-4">Credentials & 2FA Recovery</th>
                  <th className="py-3 px-4">Assigned Modules</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Active Devices</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((s) => {
                  const allowedModules = Object.entries(s.permissions || {})
                    .filter(([_, actions]) => actions.length > 0)
                    .map(([mod]) => mod);
                  const creds = PRECONFIGURED_CREDENTIALS[s.id];

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={s.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80'} 
                            alt={s.name}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0" 
                          />
                          <div>
                            <div className="font-bold text-slate-900">{s.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{s.designation}</div>
                        <div className="text-[11px] text-slate-500">{s.department}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-600">
                        {s.employeeId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-slate-400 font-medium">Pass:</span>
                            <code className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              Secure invitation required
                            </code>
                            <button
                              onClick={() => setActionNotice('Use the secure password reset/invitation workflow; default passwords are disabled.')}
                              className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                              title="Copy Password"
                            >
                              {copiedKey === `stf-pass-${s.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                            </button>
                          </div>
                          <div className={`text-[10px] font-mono flex items-center gap-1 font-semibold ${s.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-500'}`}>
                            <ShieldCheck className={`w-3 h-3 ${s.twoFactorEnabled ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <span>{s.twoFactorEnabled ? '2FA Enabled' : '2FA Optional (Off)'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {allowedModules.map((m) => (
                            <span 
                              key={m}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200 font-mono"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.accountStatus === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {s.accountStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {s.activeSessions?.length || 0} active
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPasswordModalUser(s)}
                            className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Reset or set password for this staff member"
                          >
                            <KeyRound className="w-3 h-3 text-red-600" />
                            <span>Set Pass</span>
                          </button>
                          <button
                            onClick={() => setViewSessionsUser(s)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer transition-colors"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PERMISSION MATRIX */}
      {activeTab === 'MATRIX' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Fine-Grained Operational RBAC Matrix</h2>
            <p className="text-xs text-slate-500">
              Each action is verified server-side on every REST route. Client UI hiding is reinforced by cryptographic tokens and server checks.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-900 text-white font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Super Admin (Saif)</th>
                  <th className="py-3 px-4">Partners (Saif, Simran, Lokesh, Nagesh)</th>
                  <th className="py-3 px-4">Standard Staff Default</th>
                  <th className="py-3 px-4">Approval Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {MODULES_LIST.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{m.label}</td>
                    <td className="py-3 px-4 font-mono text-emerald-600 font-bold">ALL [View, Create, Edit, Approve, Export, Void]</td>
                    <td className="py-3 px-4 font-mono text-blue-600 font-semibold">View, Create, Edit, Approve, Export</td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {['dashboard', 'products', 'inventory', 'orders', 'communication'].includes(m.id) ? 'View Only' : 'Restricted'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {m.id === 'finance' ? 'Partner/Admin Approval Mandatory' : 'Standard Workflow'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE STAFF MODAL */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-bold text-slate-900">Provision Staff Account</h3>
              </div>
              <button 
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Karan Vohra"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Company Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="karan@toriwear.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                  >
                    <option value="Store & Operations">Store & Operations</option>
                    <option value="Inventory & Warehouse">Inventory & Warehouse</option>
                    <option value="Production & Quality">Production & Quality</option>
                    <option value="Marketing & Growth">Marketing & Growth</option>
                    <option value="Design & Creative">Design & Creative</option>
                    <option value="Customer Support">Customer Support</option>
                    <option value="Logistics & Dispatch">Logistics & Dispatch</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Designation</label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Logistics Coordinator"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Granular Permissions Section */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-900 block">
                  Granular Module Permissions:
                </label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {MODULES_LIST.map((mod) => (
                    <div key={mod.id} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800">{mod.label}</span>
                      <div className="flex flex-wrap gap-2">
                        {ACTIONS_LIST.map((act) => {
                          const isChecked = formData.permissions[mod.id]?.includes(act) || false;
                          return (
                            <label key={act} className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleTogglePermission(mod.id, act)}
                                className="rounded text-red-600 focus:ring-red-500"
                              />
                              <span className="capitalize">{act}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {staffError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
                  {staffError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm cursor-pointer"
                >
                  Create & Issue Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SESSIONS & DEVICE DETAILS MODAL */}
      {viewSessionsUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">{viewSessionsUser.name}</h3>
                <p className="text-xs text-slate-500">Active sessions, device fingerprints & locations</p>
              </div>
              <button 
                onClick={() => setViewSessionsUser(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {viewSessionsUser.activeSessions && viewSessionsUser.activeSessions.length > 0 ? (
                viewSessionsUser.activeSessions.map((sess) => (
                  <div key={sess.sessionId} className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-slate-900">
                      <span>{sess.device}</span>
                      <span className="text-emerald-600 font-bold text-[10px]">ACTIVE</span>
                    </div>
                    <div className="text-[11px] text-slate-600">IP: <span className="font-mono">{sess.ipAddress}</span> · {sess.location}</div>
                    <div className="text-[10px] text-slate-400">Logged in: {sess.loginTime} · Last activity: {sess.lastActivity}</div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-500">
                  No active sessions found for this user.
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewSessionsUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
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
            setActionNotice(
              `Admin access updated for ${updated?.name || accessModalPartner.name} (${
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
