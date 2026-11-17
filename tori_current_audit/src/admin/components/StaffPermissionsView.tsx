import React, { useState } from 'react';
import { useAdmin } from '../AdminDataContext';
import { Role } from '../types';
import { ROLE_PERMISSIONS } from '../data/mockData';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Smartphone,
  X,
} from 'lucide-react';

export const StaffPermissionsView: React.FC = () => {
  const { staff, addStaffMember, updateStaffRole, toggleStaffStatus, currentUser, hasPermission } = useAdmin();
  const isRootSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.id === 'usr-saif';
  const canManageStaff = isRootSuperAdmin || hasPermission('staff.manage');

  const [activeTab, setActiveTab] = useState<'STAFF' | 'MATRIX'>('STAFF');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('STORE_MANAGER');
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    addStaffMember({
      name,
      email,
      role,
      twoFactorEnabled: twoFactorRequired,
      isActive: true,
    });
    setShowInviteModal(false);
    setName('');
    setEmail('');
  };

  const rolesList: Role[] = [
    'SUPER_ADMIN',
    'STORE_MANAGER',
    'ORDER_MANAGER',
    'INVENTORY_MANAGER',
    'MARKETING_MANAGER',
    'ACCOUNTANT',
    'CONTENT_MANAGER',
    'CUSTOMER_SUPPORT'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <span>Staff Administration & Role-Based Access Control (RBAC)</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Manage admin users, TOTP 2FA enforcement, and fine-grained operational permissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-red-600/20 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite New Staff</span>
          </button>
        </div>
      </div>

      {/* Switcher */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('STAFF')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'STAFF' 
              ? 'bg-red-600 text-white shadow-sm' 
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Active Staff Members ({staff.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MATRIX')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'MATRIX' 
              ? 'bg-red-600 text-white shadow-sm' 
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>RBAC Permissions Hierarchy Matrix</span>
        </button>
      </div>

      {activeTab === 'STAFF' ? (
        <div className="bg-[#14141c] border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-[#181824] text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="p-3.5 pl-4">Staff Member</th>
                  <th className="p-3.5">Assigned Role</th>
                  <th className="p-3.5">2FA Status</th>
                  <th className="p-3.5">Last Login</th>
                  <th className="p-3.5">Account Status</th>
                  <th className="p-3.5 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-sans">
                {staff.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="p-3.5 pl-4">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{u.name}</span>
                        {currentUser?.id === u.id && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-600/20 text-red-400">YOU</span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono">{u.email}</div>
                    </td>
                    <td className="p-3.5">
                      <select
                        value={u.role}
                        disabled={!canManageStaff}
                        onChange={(e) => updateStaffRole(u.id, e.target.value as Role)}
                        className="px-2 py-1 rounded bg-neutral-900 border border-neutral-700 text-xs text-white font-mono cursor-pointer disabled:opacity-60"
                      >
                        {rolesList.map((r) => (
                          <option key={r} value={r} disabled={r === 'SUPER_ADMIN' && !isRootSuperAdmin}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono ${
                        u.twoFactorEnabled 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        <Smartphone className="w-3 h-3" />
                        <span>{u.twoFactorEnabled ? 'ENFORCED' : 'OFF'}</span>
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-neutral-400 text-[11px]">
                      {u.lastLogin}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                        u.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {u.isActive ? 'ACTIVE' : 'SUSPENDED'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right pr-4">
                      {currentUser?.id !== u.id && (
                        <button
                          onClick={() => toggleStaffStatus(u.id)}
                          className="text-[11px] text-neutral-400 hover:text-white underline cursor-pointer"
                        >
                          {u.isActive ? 'Suspend' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* RBAC MATRIX TAB */
        <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-6">
          <div className="border-b border-neutral-800 pb-3">
            <h3 className="text-sm font-bold text-white">Granular Role Permissions Mapping</h3>
            <p className="text-xs text-neutral-400">Strictly enforced at runtime across all admin operations</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rolesList.map((r) => {
              const perms = ROLE_PERMISSIONS[r] || [];
              return (
                <div key={r} className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-red-400 text-xs">{r}</span>
                    <span className="text-[10px] text-neutral-500 font-mono">{perms.length} Permissions</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {perms.map((p, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[10px] font-mono border border-neutral-700/60">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#14141c] border border-neutral-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white">Invite Operational Staff Member</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Mehta"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Work Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="rahul@toriwear.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Initial Assigned Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-red-500 cursor-pointer font-mono"
                >
                  {rolesList.map((r) => (
                    <option key={r} value={r} disabled={r === 'SUPER_ADMIN' && !isRootSuperAdmin}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="2fa-enforce"
                  checked={twoFactorRequired}
                  onChange={(e) => setTwoFactorRequired(e.target.checked)}
                  className="rounded bg-neutral-900 border-neutral-700 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="2fa-enforce" className="text-neutral-300 cursor-pointer">
                  Require 2FA Authenticator setup on first login
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold shadow-md shadow-red-600/20 cursor-pointer"
                >
                  Send Invite Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
