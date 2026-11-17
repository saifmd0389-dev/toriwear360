import React, { useState } from 'react';
import {
  TrendingDown,
  Plus,
  Paperclip,
  Search,
  Edit3,
  Trash2,
} from 'lucide-react';
import { FinancialTransaction, ExpenseCategory } from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';

interface ExpensesTrackerTabProps {
  onOpenNewTransaction: (type?: any) => void;
  onEditTransaction: (tx: FinancialTransaction) => void;
}

const ALL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Manufacturing',
  'Fabric',
  'Printing',
  'Packaging',
  'Shipping',
  'Marketing',
  'Advertising',
  'Website/domain',
  'Software',
  'Salaries',
  'Rent',
  'Payment gateway fees',
  'Refunds',
  'Taxes/fees',
  'Miscellaneous',
];

export const ExpensesTrackerTab: React.FC<ExpensesTrackerTabProps> = ({
  onOpenNewTransaction,
  onEditTransaction,
}) => {
  const { transactions, accountsWithBalances, partners, deleteTransaction } = useFinance();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cogsFilter, setCogsFilter] = useState<'ALL' | 'COGS' | 'OPEX'>('ALL');
  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null);

  // Filter only EXPENSE and REFUND transactions
  const expenseTransactions = transactions.filter(t => t.type === 'EXPENSE' || t.type === 'REFUND');

  const filteredExpenses = expenseTransactions.filter(tx => {
    if (selectedCategory !== 'ALL' && tx.category !== selectedCategory) return false;

    const isCogs = tx.isCogs || 
      ['manufacturing', 'fabric', 'printing', 'packaging'].some(k => tx.category.toLowerCase().includes(k));

    if (cogsFilter === 'COGS' && !isCogs) return false;
    if (cogsFilter === 'OPEX' && isCogs) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        tx.transactionNumber.toLowerCase().includes(q) ||
        tx.description.toLowerCase().includes(q) ||
        (tx.referenceId && tx.referenceId.toLowerCase().includes(q)) ||
        tx.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const approvedExpenses = expenseTransactions.filter(t => t.status === 'APPROVED');
  const totalApprovedExpenses = approvedExpenses.reduce((sum, t) => sum + t.amount, 0);

  // COGS vs Opex calculation
  let cogsTotal = 0;
  let opexTotal = 0;
  const categoryTotals: Record<string, number> = {};

  approvedExpenses.forEach(t => {
    const isCogs = t.isCogs || 
      ['manufacturing', 'fabric', 'printing', 'packaging'].some(k => t.category.toLowerCase().includes(k));
    if (isCogs) cogsTotal += t.amount;
    else opexTotal += t.amount;

    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const getAccountName = (id: string) => accountsWithBalances.find(a => a.id === id)?.name || id;
  const getPartnerName = (id?: string) => partners.find(p => p.id === id)?.name || '';

  return (
    <div className="space-y-6">
      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expenses */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase font-mono">Total Business Outflow</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ₹{totalApprovedExpenses.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Direct COGS + Operating Expenses</p>
        </div>

        {/* Direct COGS */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase font-mono">Cost of Goods Sold (COGS)</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
              Direct
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ₹{cogsTotal.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Fabric, Screen Print, Tags & Packaging</p>
        </div>

        {/* Operating Expenses */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase font-mono">Operating Expenses (Opex)</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
              Indirect
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ₹{opexTotal.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Shipping, Marketing, Cloud, Rent, Wages</p>
        </div>

        {/* Quick Outflow Action */}
        <div className="p-5 bg-gradient-to-br from-rose-600 to-red-700 rounded-2xl shadow-sm text-white flex flex-col justify-between">
          <div>
            <span className="text-xs font-mono text-rose-100 uppercase block tracking-wider">Vendor & Operations</span>
            <h3 className="text-base font-bold mt-1">Record Expense Entry</h3>
            <p className="text-xs text-rose-100 mt-1">Upload supplier tax invoices and bills.</p>
          </div>
          <button
            onClick={() => onOpenNewTransaction('EXPENSE')}
            className="mt-4 w-full py-2 bg-white text-rose-900 hover:bg-rose-50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>+ Record Expense</span>
          </button>
        </div>
      </div>

      {/* Itemized Categories Summary Chips */}
      <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
            Expenditure by Designated Categories (15 Classifications)
          </h3>
          <span className="text-[11px] text-slate-400">Click category to filter</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {ALL_EXPENSE_CATEGORIES.map(cat => {
            const spent = categoryTotals[cat] || 0;
            const isSelected = selectedCategory === cat;
            const isCogs = ['Manufacturing', 'Fabric', 'Printing', 'Packaging'].includes(cat);

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? 'ALL' : cat)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  isSelected 
                    ? 'border-red-500 bg-red-50/50 shadow-sm' 
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 truncate" title={cat}>{cat}</span>
                    {isCogs && (
                      <span className="text-[9px] font-mono text-amber-700 bg-amber-100 px-1 rounded font-bold">COGS</span>
                    )}
                  </div>
                  <div className="text-base font-black font-mono text-slate-900 mt-1">
                    ₹{spent.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {totalApprovedExpenses > 0 ? ((spent / totalApprovedExpenses) * 100).toFixed(1) : 0}% of outlays
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search expenses, invoices, vendors, or descriptions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* COGS vs Opex Pill Filter */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setCogsFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition ${cogsFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                All
              </button>
              <button
                onClick={() => setCogsFilter('COGS')}
                className={`px-3 py-1.5 rounded-lg transition ${cogsFilter === 'COGS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                COGS
              </button>
              <button
                onClick={() => setCogsFilter('OPEX')}
                className={`px-3 py-1.5 rounded-lg transition ${cogsFilter === 'OPEX' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                Opex
              </button>
            </div>

            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
            >
              <option value="ALL">All Categories</option>
              {ALL_EXPENSE_CATEGORIES.map(c => (
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
                <th className="py-2.5 px-3 font-semibold">Category</th>
                <th className="py-2.5 px-3 font-semibold">Description</th>
                <th className="py-2.5 px-3 font-semibold">Account / Paid By</th>
                <th className="py-2.5 px-3 font-semibold">Receipt / Proof</th>
                <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(tx => {
                  const isCogs = tx.isCogs || 
                    ['manufacturing', 'fabric', 'printing', 'packaging'].some(k => tx.category.toLowerCase().includes(k));

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">{tx.transactionNumber}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{tx.date}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800">{tx.category}</span>
                          {isCogs ? (
                            <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                              COGS
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono text-blue-700 bg-blue-50 px-1 rounded">
                              Opex
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-800 font-medium max-w-xs truncate" title={tx.description}>
                        {tx.description}
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-[11px]">
                        {tx.isPersonalExpenseByPartner ? (
                          <span className="text-blue-700 font-medium">
                            Paid by Partner: {getPartnerName(tx.partnerId)} (Reimbursable)
                          </span>
                        ) : (
                          <span>{getAccountName(tx.paymentAccountId)}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {tx.attachmentName ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-700 font-medium truncate max-w-[120px]" title={tx.attachmentName}>
                            <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{tx.attachmentName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-right text-rose-700">
                        -₹{tx.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          tx.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          tx.status === 'PENDING_APPROVAL' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEditTransaction(tx)}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
                            title="Edit expense"
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
                              title="Delete expense"
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
    </div>
  );
};
