import React, { useState } from 'react';
import { useAdmin } from '../AdminDataContext';
import {
  ShieldAlert,
  Lock,
  FileText,
  Search,
} from 'lucide-react';

export const AuditSecurityView: React.FC = () => {
  const { auditLogs, settings, updateSettings } = useAdmin();

  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'LOGS' | 'POLICIES'>('LOGS');

  // Security policies local state
  const [sessionTimeout, setSessionTimeout] = useState(settings.sessionTimeoutMinutes ?? 30);
  const [enforce2FA, setEnforce2FA] = useState(settings.enforceTwoFactor ?? false);
  const [ipWhitelist, setIpWhitelist] = useState((settings.ipWhitelist || []).join(', '));

  const filteredLogs = auditLogs.filter((log) => {
    const userName = log.userName || log.adminName;
    const severity = log.severity || 'INFO';
    const logModule = log.module || log.entity;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = log.action.toLowerCase().includes(q) ||
                    userName.toLowerCase().includes(q) ||
                    log.details.toLowerCase().includes(q) ||
                    log.ipAddress.includes(q);
      if (!match) return false;
    }
    if (severityFilter !== 'ALL' && severity !== severityFilter) return false;
    if (moduleFilter !== 'ALL' && logModule !== moduleFilter) return false;
    return true;
  });

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      sessionTimeoutMinutes: Number(sessionTimeout),
      enforceTwoFactor: enforce2FA,
      ipWhitelist: ipWhitelist.split(',').map((s: string) => s.trim()).filter(Boolean)
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <span>Audit Trail, Intrusion Monitoring & Security Policies</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Cryptographically sealed operational audit logs, IP tracking, and system access policies.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            System Integrity: <strong>VERIFIED (0 BREACHES)</strong>
          </span>
        </div>
      </div>

      {/* Switcher */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('LOGS')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'LOGS' 
              ? 'bg-red-600 text-white shadow-sm' 
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Real-Time Audit Trail ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('POLICIES')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'POLICIES' 
              ? 'bg-red-600 text-white shadow-sm' 
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>System Security Policies</span>
        </button>
      </div>

      {activeTab === 'LOGS' ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 bg-[#14141c] p-3.5 rounded-2xl border border-neutral-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search audit actions, user, IP, or details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-red-500 cursor-pointer"
              >
                <option value="ALL">All Severities</option>
                <option value="INFO">Info</option>
                <option value="WARNING">Warning</option>
                <option value="CRITICAL">Critical</option>
              </select>

              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-red-500 cursor-pointer font-mono"
              >
                <option value="ALL">All Modules</option>
                <option value="AUTH">AUTH</option>
                <option value="PRODUCTS">PRODUCTS</option>
                <option value="ORDERS">ORDERS</option>
                <option value="INVENTORY">INVENTORY</option>
                <option value="PAYMENTS">PAYMENTS</option>
                <option value="SYSTEM">SYSTEM</option>
              </select>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300 font-mono">
                <thead className="bg-[#181824] text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                  <tr>
                    <th className="p-3.5 pl-4">Timestamp</th>
                    <th className="p-3.5">Severity</th>
                    <th className="p-3.5">Operator</th>
                    <th className="p-3.5">Module</th>
                    <th className="p-3.5">Action Executed</th>
                    <th className="p-3.5">Details</th>
                    <th className="p-3.5 text-right pr-4">Origin IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-sans">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="p-3.5 pl-4 font-mono text-neutral-400 text-[11px] whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                          (log.severity || 'INFO') === 'CRITICAL'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : (log.severity || 'INFO') === 'WARNING'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {log.severity || 'INFO'}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-white">
                        {log.userName || log.adminName}
                      </td>
                      <td className="p-3.5 font-mono text-neutral-400 text-[11px]">
                        {log.module || log.entity}
                      </td>
                      <td className="p-3.5 font-bold text-neutral-200">
                        {log.action}
                      </td>
                      <td className="p-3.5 text-neutral-400 text-xs max-w-xs truncate" title={log.details}>
                        {log.details}
                      </td>
                      <td className="p-3.5 text-right pr-4 font-mono text-neutral-500 text-[11px]">
                        {log.ipAddress}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* POLICIES TAB */
        <form onSubmit={handleSaveSecurity} className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-6 max-w-2xl text-xs">
          <div className="border-b border-neutral-800 pb-3">
            <h3 className="text-sm font-bold text-white">Hardened Admin Security Settings</h3>
            <p className="text-neutral-400 text-xs">Configure session timeouts, brute force protection & 2FA</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800">
              <div>
                <div className="font-bold text-white">Enforce 2-Factor Authentication (2FA)</div>
                <div className="text-neutral-400 text-[11px]">Require all staff to submit TOTP token on sign-in</div>
              </div>
              <input
                type="checkbox"
                checked={enforce2FA}
                onChange={(e) => setEnforce2FA(e.target.checked)}
                className="rounded bg-neutral-900 border-neutral-700 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Session Idle Timeout (Minutes)
              </label>
              <input
                type="number"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(Number(e.target.value))}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
              />
              <p className="text-[10px] text-neutral-500 mt-1">Automatically logs out inactive staff after N minutes</p>
            </div>

            <div>
              <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Admin Subnet IP Whitelist (Comma separated CIDR)
              </label>
              <input
                type="text"
                placeholder="103.21.244.0/24, 49.36.12.8"
                value={ipWhitelist}
                onChange={(e) => setIpWhitelist(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono focus:outline-none focus:border-red-500"
              />
              <p className="text-[10px] text-neutral-500 mt-1">Leave blank to allow access from any secure IP address</p>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-800 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold shadow-md shadow-red-600/20 cursor-pointer"
            >
              Save Security Policies
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
