import React, { useState } from 'react';
import { ShieldCheck, Search, Download } from 'lucide-react';
import { FinancialAuditLog } from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';

export const FinancialAuditLogTab: React.FC = () => {
  const { auditLogs } = useFinance();

  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');

  const filteredLogs = auditLogs.filter(log => {
    if (selectedAction !== 'ALL' && log.action !== selectedAction) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        log.details.toLowerCase().includes(q) ||
        log.performedBy.toLowerCase().includes(q) ||
        (log.transactionId && log.transactionId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getActionBadge = (action: FinancialAuditLog['action']) => {
    switch (action) {
      case 'CREATE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">CREATED</span>;
      case 'EDIT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">MODIFIED</span>;
      case 'APPROVE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">APPROVED</span>;
      case 'REJECT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">REJECTED</span>;
      case 'VOID':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-900 text-white" style={{ color: '#ffffff', backgroundColor: '#0f172a' }}>VOIDED / REVERSED</span>;
      case 'TRANSFER':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">TRANSFER</span>;
      case 'PARTNER_CONFIG':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">EQUITY CONFIG</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700">{action}</span>;
    }
  };

  const handleExportCSV = () => {
    const rows = [
      ['TORIWEAR — IMMUTABLE FINANCIAL AUDIT LOG'],
      ['Export Date', new Date().toLocaleString('en-IN')],
      [],
      ['TIMESTAMP', 'ACTION', 'PERFORMED BY', 'TRANSACTION ID', 'DETAILS', 'OLD VALUE', 'NEW VALUE'],
      ...filteredLogs.map(l => [
        l.timestamp,
        l.action,
        l.performedBy,
        l.transactionId || 'N/A',
        `"${l.details.replace(/"/g, '""')}"`,
        `"${(l.oldValue || '').replace(/"/g, '""')}"`,
        `"${(l.newValue || '').replace(/"/g, '""')}"`
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `toriwear_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Stats & Security Lock */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Immutable Financial Audit Trail</h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                Append-Only Ledger
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict audit history tracking creations, edits, managerial approvals, void reversals, and equity modifications
            </p>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export Audit Log</span>
        </button>
      </div>

      {/* 2. Audit Table with Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by user, action, details..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE">Created</option>
              <option value="EDIT">Modified</option>
              <option value="APPROVE">Approved</option>
              <option value="REJECT">Rejected</option>
              <option value="VOID">Voided / Reversed</option>
              <option value="TRANSFER">Transfer</option>
              <option value="PARTNER_CONFIG">Equity Changes</option>
            </select>
          </div>
        </div>

        {/* Audit Log Entries Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] font-mono">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Performed By</th>
                <th className="py-3 px-4">Event Details</th>
                <th className="py-3 px-4">Target Record</th>
                <th className="py-3 px-4">State Evolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No audit records matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">
                          {log.performedBy.charAt(0).toUpperCase()}
                        </div>
                        <span>{log.performedBy}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-sm">
                      {log.details}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {log.transactionId || 'GLOBAL'}
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      {log.oldValue && log.newValue ? (
                        <div className="space-y-0.5 font-mono text-[10px]">
                          <span className="line-through text-slate-400 block">{log.oldValue}</span>
                          <span className="text-emerald-600 font-semibold block">{log.newValue}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
