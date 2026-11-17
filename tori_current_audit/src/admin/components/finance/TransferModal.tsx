import React, { useState } from 'react';
import { X, ArrowRightLeft, AlertCircle, Check } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose }) => {
  const { accountsWithBalances, transferBetweenAccounts } = useFinance();

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const fromAccount = accountsWithBalances.find(a => a.id === fromAccountId);
  const toAccount = accountsWithBalances.find(a => a.id === toAccountId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fromAccountId || !toAccountId) {
      setError('Please select both source and destination accounts.');
      return;
    }

    if (fromAccountId === toAccountId) {
      setError('Source and destination accounts must be different.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid positive transfer amount.');
      return;
    }

    if (fromAccount && numAmount > fromAccount.currentBalance) {
      setError(`Insufficient balance in ${fromAccount.name}. Available: ₹${fromAccount.currentBalance.toLocaleString('en-IN')}`);
      return;
    }

    transferBetweenAccounts(
      fromAccountId,
      toAccountId,
      numAmount,
      description.trim() || `Fund transfer from ${fromAccount?.name} to ${toAccount?.name}`,
      referenceId.trim() || undefined
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Transfer Funds</h3>
              <p className="text-xs text-slate-500">Move funds between business accounts or payout gateways</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* From Account */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">From Account (Source)</label>
            <select
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
              required
            >
              <option value="">Select source account...</option>
              {accountsWithBalances.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} (Balance: ₹{a.currentBalance.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          {/* To Account */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">To Account (Destination)</label>
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
              required
            >
              <option value="">Select destination account...</option>
              {accountsWithBalances.map(a => (
                <option key={a.id} value={a.id} disabled={a.id === fromAccountId}>
                  {a.name} (Balance: ₹{a.currentBalance.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Amount (INR)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">₹</span>
              <input
                type="number"
                step="any"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50000"
                className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900"
                required
              />
            </div>
          </div>

          {/* Reference / UTR Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">UTR / Bank Reference (Optional)</label>
            <input
              type="text"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="e.g. UTR491029104"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Memo</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Sweep gateway settlements to HDFC operating account"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-md shadow-red-600/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Execute Transfer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
