import React, { useState } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Store,
  Plus,
  Search,
  Edit3,
  Trash2,
} from 'lucide-react';
import { FinancialTransaction } from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';

interface IncomeTrackerTabProps {
  onOpenNewTransaction: (type?: any) => void;
  onEditTransaction: (tx: FinancialTransaction) => void;
}

export const IncomeTrackerTab: React.FC<IncomeTrackerTabProps> = ({
  onOpenNewTransaction,
  onEditTransaction,
}) => {
  const { transactions, accountsWithBalances, deleteTransaction } = useFinance();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null);

  // Filter only INCOME transactions
  const incomeTransactions = transactions.filter(t => t.type === 'INCOME');

  const filteredIncome = incomeTransactions.filter(tx => {
    if (selectedCategory !== 'ALL' && tx.category !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        tx.transactionNumber.toLowerCase().includes(q) ||
        tx.description.toLowerCase().includes(q) ||
        (tx.orderId && tx.orderId.toLowerCase().includes(q)) ||
        (tx.referenceId && tx.referenceId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const approvedIncome = incomeTransactions.filter(t => t.status === 'APPROVED');
  const totalApprovedIncome = approvedIncome.reduce((sum, t) => sum + t.amount, 0);

  // Group by category
  const categoryTotals: Record<string, number> = {};
  approvedIncome.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const getAccountName = (id: string) => accountsWithBalances.find(a => a.id === id)?.name || id;

  return (
    <div className="space-y-6">
      {/* Header & Income Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase font-mono">Total Business Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ₹{totalApprovedIncome.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">From all verified sales streams</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase font-mono">Storefront D2C Sales</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ₹{(categoryTotals['Customer Orders'] || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Online streetwear orders</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase font-mono">B2B & Wholesale</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ₹{(categoryTotals['B2B Wholesale'] || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Event booths & pop-up sales</p>
        </div>

        <div className="p-5 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl shadow-sm text-white flex flex-col justify-between">
          <div>
            <span className="text-xs font-mono text-emerald-100 uppercase block tracking-wider">Quick Inflow Action</span>
            <h3 className="text-base font-bold mt-1">Record Revenue Entry</h3>
            <p className="text-xs text-emerald-100 mt-1">Link online payouts or direct client deposits.</p>
          </div>
          <button
            onClick={() => onOpenNewTransaction('INCOME')}
            className="mt-4 w-full py-2 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>+ Record Income</span>
          </button>
        </div>
      </div>

      {/* Income Streams Category Distribution */}
      <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
          Revenue Distribution by Stream
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(categoryTotals).map(([cat, total]) => {
            const pct = totalApprovedIncome > 0 ? (total / totalApprovedIncome) * 100 : 0;
            return (
              <div key={cat} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs font-semibold text-slate-700 truncate">{cat}</div>
                <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                  ₹{total.toLocaleString('en-IN')}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span>{pct.toFixed(1)}% of revenue</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Income Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search income receipts, orders, or reference #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
            >
              <option value="ALL">All Categories</option>
              {Object.keys(categoryTotals).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3 font-semibold">Txn #</th>
                <th className="py-2.5 px-3 font-semibold">Date</th>
                <th className="py-2.5 px-3 font-semibold">Source / Category</th>
                <th className="py-2.5 px-3 font-semibold">Description</th>
                <th className="py-2.5 px-3 font-semibold">Destination Account</th>
                <th className="py-2.5 px-3 font-semibold">Linked Order #</th>
                <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredIncome.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No income entries found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredIncome.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{tx.transactionNumber}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{tx.date}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {tx.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-800 font-medium max-w-xs truncate" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className="py-3 px-3 text-slate-600 text-[11px]">{getAccountName(tx.paymentAccountId)}</td>
                    <td className="py-3 px-3 font-mono text-slate-700 text-[11px]">
                      {tx.orderId ? (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-semibold">{tx.orderId}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-right text-emerald-700">
                      +₹{tx.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEditTransaction(tx)}
                          className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
                          title="Edit transaction"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
