import React, { useState, useEffect } from 'react';
import { X, Check, Landmark, Wallet, CreditCard, DollarSign, AlertCircle } from 'lucide-react';
import { FinancialAccount, FinancialAccountType } from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountToEdit?: FinancialAccount | null;
}

const ACCOUNT_TYPES: { id: FinancialAccountType; label: string; icon: any }[] = [
  { id: 'BANK', label: 'Commercial Bank Account', icon: Landmark },
  { id: 'CASH', label: 'Petty Cash / Vault', icon: Wallet },
  { id: 'UPI', label: 'Corporate UPI Handle', icon: CreditCard },
  { id: 'PAYMENT_GATEWAY', label: 'Payment Gateway (Razorpay/Stripe)', icon: CreditCard },
  { id: 'OTHER', label: 'Other Financial Ledger', icon: DollarSign },
];

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  accountToEdit,
}) => {
  const { createAccount, updateAccount } = useFinance();

  const [name, setName] = useState('');
  const [type, setType] = useState<FinancialAccountType>('BANK');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [initialBalance, setInitialBalance] = useState<string>('0');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (accountToEdit) {
      setName(accountToEdit.name);
      setType(accountToEdit.type);
      setBankName(accountToEdit.bankName || '');
      setAccountNumber(accountToEdit.accountNumber || '');
      setIfscCode(accountToEdit.ifscCode || '');
      setUpiId(accountToEdit.upiId || '');
      setInitialBalance(String(accountToEdit.initialBalance || 0));
      setNotes(accountToEdit.notes || '');
    } else {
      setName('');
      setType('BANK');
      setBankName('');
      setAccountNumber('');
      setIfscCode('');
      setUpiId('');
      setInitialBalance('0');
      setNotes('');
    }
    setError('');
  }, [accountToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Account name is required.');
      return;
    }

    const initBalNum = parseFloat(initialBalance) || 0;

    if (accountToEdit) {
      updateAccount(accountToEdit.id, {
        name: name.trim(),
        type,
        bankName: bankName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        ifscCode: ifscCode.trim() || undefined,
        upiId: upiId.trim() || undefined,
        initialBalance: initBalNum,
        notes: notes.trim() || undefined,
      });
    } else {
      createAccount({
        name: name.trim(),
        type,
        bankName: bankName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        ifscCode: ifscCode.trim() || undefined,
        upiId: upiId.trim() || undefined,
        initialBalance: initBalNum,
        notes: notes.trim() || undefined,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {accountToEdit ? 'Edit Financial Account' : 'Add Financial Account'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure bank accounts, cash vaults, and UPI handles with running balances
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Account Type Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ACCOUNT_TYPES.map(t => {
                const Icon = t.icon;
                const isSelected = type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-red-50 border-red-500 text-red-700 font-semibold shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Account Display Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HDFC Business Current Account or Main Cash Box"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              required
            />
          </div>

          {/* Conditional Bank Details */}
          {type === 'BANK' && (
            <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bank Name & Branch</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank, Indiranagar Branch"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 502000491820"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="e.g. HDFC0000142"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono uppercase text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* UPI ID */}
          {(type === 'UPI' || type === 'BANK') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">UPI VPA Handle (Optional)</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. toriwear@hdfcbank"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900"
              />
            </div>
          )}

          {/* Opening / Initial Balance */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Starting / Opening Balance (INR)
            </label>
            <input
              type="number"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Approved transactions will automatically update this account's running live balance.
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Operational Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Purpose of this account, authorized signatories, etc."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 resize-none"
            />
          </div>

          {/* Actions */}
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
              <span>{accountToEdit ? 'Save Changes' : 'Create Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
