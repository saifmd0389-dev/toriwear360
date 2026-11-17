import React, { useState } from 'react';
import {
  Landmark,
  Wallet,
  CreditCard,
  Plus,
  ArrowRightLeft,
  Edit3,
  Building2,
  DollarSign,
  Trash2,
} from 'lucide-react';
import { FinancialAccount, FinancialTransaction } from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';
import { AccountModal } from './AccountModal';
import { TransferModal } from './TransferModal';

interface CashBankAccountsTabProps {
  onOpenNewTransaction: (type?: any) => void;
  onEditTransaction: (tx: FinancialTransaction) => void;
}

export const CashBankAccountsTab: React.FC<CashBankAccountsTabProps> = ({
  onOpenNewTransaction,
  onEditTransaction,
}) => {
  const { accountsWithBalances, transactions, deleteTransaction } = useFinance();

  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<FinancialAccount | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null);

  // Compute liquid sums
  let totalCash = 0;
  let totalBank = 0;
  let totalGateway = 0;

  accountsWithBalances.forEach(acc => {
    if (acc.type === 'CASH') totalCash += acc.currentBalance;
    else if (acc.type === 'BANK') totalBank += acc.currentBalance;
    else totalGateway += acc.currentBalance;
  });

  const grandLiquidTotal = totalCash + totalBank + totalGateway;

  // Filter transactions for table
  const accountTransactions = transactions.filter(t => {
    if (selectedAccountId === 'ALL') return true;
    return t.paymentAccountId === selectedAccountId || t.toPaymentAccountId === selectedAccountId;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const selectedAccount = accountsWithBalances.find(a => a.id === selectedAccountId);

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'BANK': return Landmark;
      case 'CASH': return Wallet;
      case 'UPI': return CreditCard;
      case 'PAYMENT_GATEWAY': return CreditCard;
      default: return DollarSign;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Stats & Actions */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Cash & Bank Accounts</h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                {accountsWithBalances.length} Active Accounts
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live balances calculated automatically from approved financial movements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
            <span>Transfer Funds</span>
          </button>

          <button
            onClick={() => {
              setAccountToEdit(null);
              setIsAccountModalOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm shadow-red-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {/* 2. Liquid Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Liquid Reserves</span>
            <Building2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-2">
            ₹{grandLiquidTotal.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Across bank, cash & gateways</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Commercial Bank Balances</span>
            <Landmark className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-2">
            ₹{totalBank.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Operating bank accounts</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Payment Gateway Escrow</span>
            <CreditCard className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold font-mono text-indigo-600 mt-2">
            ₹{totalGateway.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Razorpay / UPI pending payout</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Petty Cash / Vault</span>
            <Wallet className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-2">
            ₹{totalCash.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Cash on hand for local outlays</p>
        </div>
      </div>

      {/* 3. Account Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accountsWithBalances.map((acc) => {
          const Icon = getAccountIcon(acc.type);
          const isSelected = selectedAccountId === acc.id;

          return (
            <div
              key={acc.id}
              onClick={() => setSelectedAccountId(isSelected ? 'ALL' : acc.id)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                isSelected 
                  ? 'bg-red-50/40 border-red-500 ring-2 ring-red-500/20 shadow-md' 
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">{acc.name}</h3>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">
                        {acc.type}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAccountToEdit(acc);
                      setIsAccountModalOpen(true);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Running Balance */}
                <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold">
                    Live Running Balance
                  </div>
                  <div className={`text-xl font-bold font-mono mt-0.5 ${
                    acc.currentBalance >= 0 ? 'text-slate-900' : 'text-rose-600'
                  }`}>
                    ₹{acc.currentBalance.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Metadata Details */}
                <div className="mt-3 space-y-1 text-[11px] text-slate-500">
                  {acc.accountNumber && (
                    <div className="flex items-center justify-between font-mono">
                      <span>Account No:</span>
                      <span className="text-slate-800 font-medium">{acc.accountNumber}</span>
                    </div>
                  )}
                  {acc.ifscCode && (
                    <div className="flex items-center justify-between font-mono">
                      <span>IFSC:</span>
                      <span className="text-slate-800 font-medium">{acc.ifscCode}</span>
                    </div>
                  )}
                  {acc.upiId && (
                    <div className="flex items-center justify-between font-mono">
                      <span>UPI VPA:</span>
                      <span className="text-slate-800 font-medium">{acc.upiId}</span>
                    </div>
                  )}
                  {acc.bankName && (
                    <div className="text-slate-400 text-[10px] truncate mt-1">
                      {acc.bankName}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenNewTransaction('INCOME');
                  }}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-emerald-700 text-[11px] font-semibold text-center transition-colors"
                >
                  + Deposit
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenNewTransaction('EXPENSE');
                  }}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-rose-700 text-[11px] font-semibold text-center transition-colors"
                >
                  - Payout
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTransferModalOpen(true);
                  }}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold text-center transition-colors"
                >
                  Transfer
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Account Ledger Transactions */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                {selectedAccountId === 'ALL' 
                  ? 'All Cash & Bank Account Transactions' 
                  : `${selectedAccount?.name} — Ledger`}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                {accountTransactions.length} records
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live journal entries of credits, debits, and inter-account transfers
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
            >
              <option value="ALL">All Accounts</option>
              {accountsWithBalances.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] font-mono">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">TXN Number</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accountTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No transactions associated with this account.
                  </td>
                </tr>
              ) : (
                accountTransactions.map((tx) => {
                  const account = accountsWithBalances.find(a => a.id === tx.paymentAccountId);
                  const isCredit = tx.type === 'INCOME' || tx.type === 'CAPITAL' || (tx.type === 'TRANSFER' && tx.toPaymentAccountId === selectedAccountId);

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {tx.transactionNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {account?.name || 'Operating Account'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          tx.type === 'INCOME' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          tx.type === 'EXPENSE' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          tx.type === 'TRANSFER' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {tx.category}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-700">
                        {tx.description}
                        {tx.referenceId && (
                          <span className="text-[10px] text-slate-400 block font-mono">Ref: {tx.referenceId}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          tx.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                          tx.status === 'PENDING_APPROVAL' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isCredit ? 'text-emerald-600' : 'text-rose-600'}>
                          {isCredit ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onEditTransaction(tx)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            View / Edit
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
                              title="Delete transaction"
                              className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
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

      {/* Modals */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => {
          setIsAccountModalOpen(false);
          setAccountToEdit(null);
        }}
        accountToEdit={accountToEdit}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
      />
    </div>
  );
};
