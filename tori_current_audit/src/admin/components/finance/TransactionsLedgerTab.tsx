import React, { useState } from 'react';
import {
  Search,
  Download,
  Plus,
  Eye,
  Edit3,
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileText,
  Tag,
  User,
  Paperclip,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { FinancialTransaction } from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';

interface TransactionsLedgerTabProps {
  onOpenNewTransaction: (type?: any) => void;
  onEditTransaction: (tx: FinancialTransaction) => void;
}

export const TransactionsLedgerTab: React.FC<TransactionsLedgerTabProps> = ({
  onOpenNewTransaction,
  onEditTransaction,
}) => {
  const { 
    filteredTransactions, 
    accountsWithBalances, 
    partners, 
    searchQuery, 
    setSearchQuery,
    filterType, 
    setFilterType,
    filterStatus, 
    setFilterStatus,
    filterAccount, 
    setFilterAccount,
    filterPartner, 
    setFilterPartner,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    resetFilters,
    approveTransaction,
    rejectTransaction,
    voidTransaction,
    deleteTransaction
  } = useFinance();

  const [selectedTx, setSelectedTx] = useState<FinancialTransaction | null>(null);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [txToVoid, setTxToVoid] = useState<FinancialTransaction | null>(null);
  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null);

  // Sorting
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (sortBy === 'date') {
      return sortDir === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    } else {
      return sortDir === 'asc' ? a.amount - b.amount : b.amount - a.amount;
    }
  });

  const getAccountName = (accId: string) => {
    return accountsWithBalances.find(a => a.id === accId)?.name || accId;
  };

  const getPartnerName = (ptrId?: string) => {
    if (!ptrId) return '-';
    return partners.find(p => p.id === ptrId)?.name || ptrId;
  };

  const exportCSV = () => {
    const headers = [
      'Transaction ID',
      'Date',
      'Type',
      'Category',
      'Amount (INR)',
      'Account',
      'To Account',
      'Reference ID',
      'Order ID',
      'Partner',
      'Description',
      'Status',
      'Created By',
      'Approved By',
    ];

    const rows = sortedTransactions.map(t => [
      t.transactionNumber,
      t.date,
      t.type,
      `"${t.category}"`,
      t.amount,
      `"${getAccountName(t.paymentAccountId)}"`,
      t.toPaymentAccountId ? `"${getAccountName(t.toPaymentAccountId)}"` : '',
      `"${t.referenceId || ''}"`,
      `"${t.orderId || ''}"`,
      `"${getPartnerName(t.partnerId)}"`,
      `"${t.description.replace(/"/g, '""')}"`,
      t.status,
      `"${t.createdBy}"`,
      `"${t.approvedBy || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `toriwear_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenVoidPrompt = (tx: FinancialTransaction) => {
    setTxToVoid(tx);
    setVoidReason('');
    setVoidModalOpen(true);
  };

  const handleConfirmVoid = () => {
    if (txToVoid && voidReason.trim()) {
      voidTransaction(txToVoid.id, voidReason.trim());
      setVoidModalOpen(false);
      setTxToVoid(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by transaction #, description, order #, vendor, or invoice..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
              title="Download filtered transactions as CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => onOpenNewTransaction('EXPENSE')}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Entry</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2 border-t border-slate-100">
          {/* Type Filter */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 font-semibold mb-1">Type</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
            >
              <option value="ALL">All Types</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
              <option value="CAPITAL">Capital</option>
              <option value="WITHDRAWAL">Withdrawal</option>
              <option value="TRANSFER">Transfer</option>
              <option value="REFUND">Refund</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 font-semibold mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="DRAFT">Draft</option>
              <option value="REJECTED">Rejected</option>
              <option value="VOIDED">Voided / Reversed</option>
            </select>
          </div>

          {/* Account Filter */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 font-semibold mb-1">Account</label>
            <select
              value={filterAccount}
              onChange={e => setFilterAccount(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
            >
              <option value="ALL">All Accounts</option>
              {accountsWithBalances.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Partner Filter */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 font-semibold mb-1">Partner</label>
            <select
              value={filterPartner}
              onChange={e => setFilterPartner(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
            >
              <option value="ALL">All Partners</option>
              {partners.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 font-semibold mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
            />
          </div>

          {/* End Date & Reset */}
          <div className="flex items-end gap-1.5">
            <div className="flex-1">
              <label className="block text-[10px] font-mono uppercase text-slate-400 font-semibold mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
              />
            </div>
            <button
              onClick={resetFilters}
              className="px-2.5 py-1.5 rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
              title="Reset all filters"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Records Count & Active Filter Tags */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Showing <strong className="text-slate-900 font-mono">{sortedTransactions.length}</strong> transactions
        </span>
        <div className="flex items-center gap-2">
          <span>Sort by:</span>
          <button
            onClick={() => {
              if (sortBy === 'date') setSortDir(d => d === 'asc' ? 'desc' : 'asc');
              else { setSortBy('date'); setSortDir('desc'); }
            }}
            className={`font-semibold hover:text-slate-900 cursor-pointer ${sortBy === 'date' ? 'text-red-600 underline' : ''}`}
          >
            Date {sortBy === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
          </button>
          <span>·</span>
          <button
            onClick={() => {
              if (sortBy === 'amount') setSortDir(d => d === 'asc' ? 'desc' : 'asc');
              else { setSortBy('amount'); setSortDir('desc'); }
            }}
            className={`font-semibold hover:text-slate-900 cursor-pointer ${sortBy === 'amount' ? 'text-red-600 underline' : ''}`}
          >
            Amount {sortBy === 'amount' && (sortDir === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">Txn #</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Category & Description</th>
                <th className="py-3 px-4 font-semibold">Account</th>
                <th className="py-3 px-4 font-semibold">Partner / Order</th>
                <th className="py-3 px-4 font-semibold text-right">Amount</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right sticky right-0 bg-slate-50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] z-10">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sortedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No transactions found</p>
                    <p className="text-xs text-slate-400 mt-1">Try clearing filters or recording a new transaction.</p>
                  </td>
                </tr>
              ) : (
                sortedTransactions.map(tx => {
                  const isCredit = tx.type === 'INCOME' || tx.type === 'CAPITAL';
                  const isDebit = tx.type === 'EXPENSE' || tx.type === 'WITHDRAWAL' || tx.type === 'REFUND';

                  return (
                    <tr 
                      key={tx.id} 
                      className={`hover:bg-slate-50/80 transition ${tx.status === 'VOIDED' ? 'opacity-50 line-through bg-slate-50/40' : ''}`}
                    >
                      {/* 1. Txn Number */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="hover:text-red-600 hover:underline cursor-pointer text-left"
                        >
                          {tx.transactionNumber}
                        </button>
                        {tx.attachmentName && (
                          <span title={tx.attachmentName} className="inline-flex items-center">
                            <Paperclip className="w-3 h-3 text-slate-400 inline ml-1" />
                          </span>
                        )}
                      </td>

                      {/* 2. Date */}
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {tx.date}
                      </td>

                      {/* 3. Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          tx.type === 'INCOME' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          tx.type === 'EXPENSE' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          tx.type === 'CAPITAL' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          tx.type === 'WITHDRAWAL' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          tx.type === 'TRANSFER' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          tx.type === 'REFUND' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {tx.type}
                        </span>
                      </td>

                      {/* 4. Category & Description */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-800 truncate" title={tx.description}>
                          {tx.description}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Tag className="w-3 h-3" />
                          <span>{tx.category}</span>
                          {tx.isCogs && (
                            <span className="text-[9px] font-mono text-amber-700 bg-amber-50 px-1 rounded">COGS</span>
                          )}
                          {tx.isPersonalExpenseByPartner && (
                            <span className="text-[9px] font-mono text-blue-700 bg-blue-50 px-1 rounded">Reimbursable</span>
                          )}
                        </div>
                      </td>

                      {/* 5. Account */}
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <div className="font-medium text-slate-800 text-[11px] truncate max-w-[140px]" title={getAccountName(tx.paymentAccountId)}>
                          {getAccountName(tx.paymentAccountId)}
                        </div>
                        {tx.type === 'TRANSFER' && tx.toPaymentAccountId && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <span>→ {getAccountName(tx.toPaymentAccountId)}</span>
                          </div>
                        )}
                      </td>

                      {/* 6. Partner / Order Link */}
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap text-[11px]">
                        {tx.partnerId && (
                          <div className="font-medium text-slate-800 flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{getPartnerName(tx.partnerId)}</span>
                          </div>
                        )}
                        {tx.orderId && (
                          <div className="text-slate-500 font-mono text-[10px]">
                            Ord: {tx.orderId}
                          </div>
                        )}
                        {tx.referenceId && !tx.orderId && (
                          <div className="text-slate-400 font-mono text-[10px] truncate max-w-[100px]" title={tx.referenceId}>
                            Ref: {tx.referenceId}
                          </div>
                        )}
                        {!tx.partnerId && !tx.orderId && !tx.referenceId && (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* 7. Amount */}
                      <td className="py-3 px-4 font-mono font-bold text-right whitespace-nowrap">
                        <span className={
                          isCredit ? 'text-emerald-700' : 
                          isDebit ? 'text-slate-900' : 
                          'text-indigo-600'
                        }>
                          {isCredit ? '+' : isDebit ? '-' : ''}₹{tx.amount.toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* 8. Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          tx.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          tx.status === 'PENDING_APPROVAL' ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse' :
                          tx.status === 'DRAFT' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                          tx.status === 'VOIDED' ? 'bg-red-50 text-red-700 border border-red-200' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {tx.status === 'PENDING_APPROVAL' ? 'Pending' : tx.status}
                        </span>
                      </td>

                      {/* 9. Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] z-10">
                        <div className="flex items-center justify-end gap-1">
                          {/* View details */}
                          <button
                            onClick={() => setSelectedTx(tx)}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Approve / Reject for Pending */}
                          {tx.status === 'PENDING_APPROVAL' && (
                            <>
                              <button
                                onClick={() => approveTransaction(tx.id)}
                                className="p-1 rounded-lg hover:bg-emerald-50 text-emerald-600 cursor-pointer"
                                title="Approve transaction"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => rejectTransaction(tx.id, 'Declined by Administrator')}
                                className="p-1 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer"
                                title="Reject transaction"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {/* Edit for drafts/pending */}
                          {tx.status !== 'VOIDED' && (
                            <button
                              onClick={() => onEditTransaction(tx)}
                              className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
                              title="Edit transaction"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Void / Reverse for approved transactions */}
                          {tx.status === 'APPROVED' && (
                            <button
                              onClick={() => handleOpenVoidPrompt(tx)}
                              className="p-1 rounded-lg hover:bg-amber-50 text-amber-600 hover:text-amber-700 cursor-pointer"
                              title="Void / Reverse transaction (Leaves audit trail)"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete transaction */}
                          {confirmDeleteTxId === tx.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  deleteTransaction(tx.id);
                                  setConfirmDeleteTxId(null);
                                }}
                                className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteTxId(null)}
                                className="px-1.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-semibold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteTxId(tx.id)}
                              className="p-1 rounded-lg hover:bg-rose-50 text-rose-500 hover:text-rose-700 cursor-pointer"
                              title="Delete transaction"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">Transaction Details</span>
                <h3 className="text-base font-bold text-slate-900 font-mono mt-0.5">{selectedTx.transactionNumber}</h3>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Amount</span>
                  <span className="text-xl font-black font-mono text-slate-900">₹{selectedTx.amount.toLocaleString('en-IN')}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Status</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded font-mono font-bold text-xs uppercase ${
                    selectedTx.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                    selectedTx.status === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {selectedTx.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-600">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Date</span>
                  <span className="font-semibold text-slate-900">{selectedTx.date}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Transaction Type</span>
                  <span className="font-semibold text-slate-900">{selectedTx.type}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Category</span>
                  <span className="font-semibold text-slate-900">{selectedTx.category}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Account</span>
                  <span className="font-semibold text-slate-900">{getAccountName(selectedTx.paymentAccountId)}</span>
                </div>
                {selectedTx.toPaymentAccountId && (
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Destination Account</span>
                    <span className="font-semibold text-slate-900">{getAccountName(selectedTx.toPaymentAccountId)}</span>
                  </div>
                )}
                {selectedTx.partnerId && (
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Associated Partner</span>
                    <span className="font-semibold text-slate-900">{getPartnerName(selectedTx.partnerId)}</span>
                  </div>
                )}
                {selectedTx.orderId && (
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Customer Order #</span>
                    <span className="font-semibold text-slate-900">{selectedTx.orderId}</span>
                  </div>
                )}
                {selectedTx.referenceId && (
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Reference / UTR</span>
                    <span className="font-semibold text-slate-900">{selectedTx.referenceId}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Description</span>
                <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 leading-relaxed">
                  {selectedTx.description}
                </p>
              </div>

              {selectedTx.attachmentName && (
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Receipt Attachment</span>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-red-500" />
                      <span className="font-semibold text-slate-800">{selectedTx.attachmentName}</span>
                      <span className="text-slate-400">({selectedTx.attachmentSize || 'Verified'})</span>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-semibold">Attached</span>
                  </div>
                </div>
              )}

              {/* Audit Metadata */}
              <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-400 space-y-1">
                <div>Created by: <span className="text-slate-600 font-medium">{selectedTx.createdBy}</span> on {new Date(selectedTx.createdAt).toLocaleString()}</div>
                {selectedTx.approvedBy && (
                  <div>Approved by: <span className="text-emerald-700 font-medium">{selectedTx.approvedBy}</span> on {selectedTx.approvedAt ? new Date(selectedTx.approvedAt).toLocaleString() : '-'}</div>
                )}
                {selectedTx.voidedBy && (
                  <div className="text-red-600">Voided by: {selectedTx.voidedBy} - Reason: {selectedTx.voidReason}</div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-slate-200 bg-slate-50">
              {confirmDeleteTxId === selectedTx.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      deleteTransaction(selectedTx.id);
                      setConfirmDeleteTxId(null);
                      setSelectedTx(null);
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteTxId(null)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteTxId(selectedTx.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Transaction</span>
                </button>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Close
                </button>
                {selectedTx.status === 'PENDING_APPROVAL' && (
                  <button
                    onClick={() => {
                      approveTransaction(selectedTx.id);
                      setSelectedTx(null);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition"
                  >
                    Approve Entry
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Prompt Dialog */}
      {voidModalOpen && txToVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Void / Reverse Transaction?</h3>
                <p className="text-xs text-slate-500">Per accounting integrity rules, approved transactions are never deleted; a void reversal is recorded.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="font-bold text-slate-800">{txToVoid.transactionNumber} - ₹{txToVoid.amount.toLocaleString('en-IN')}</div>
              <div className="text-slate-500 mt-0.5">{txToVoid.description}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Reason for Void / Reversal *
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Inadvertent duplicate invoice, supplier credit note issued, or bank debit cancellation."
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVoidModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!voidReason.trim()}
                onClick={handleConfirmVoid}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition"
              >
                Confirm Void Reversal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
