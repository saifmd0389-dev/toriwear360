import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  Check,
  AlertCircle,
  FileText,
  Calendar,
  User,
} from 'lucide-react';
import { 
  FinancialTransaction, 
  FinancialTransactionType, 
  ExpenseCategory, 
  IncomeCategory, 
  TransactionApprovalStatus 
} from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';
import { useAdmin } from '../../AdminDataContext';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: FinancialTransactionType;
  initialPartnerId?: string;
  transactionToEdit?: FinancialTransaction | null;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
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

const INCOME_CATEGORIES: IncomeCategory[] = [
  'Customer Orders',
  'B2B Wholesale',
  'Pop-up Sales',
  'Licensing & Royalties',
  'Shipping Revenue',
  'Investment Income',
  'Miscellaneous Income',
];

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  initialType = 'EXPENSE',
  initialPartnerId,
  transactionToEdit,
}) => {
  const { accountsWithBalances, partners, createTransaction, updateTransaction } = useFinance();
  const { orders } = useAdmin();

  const [type, setType] = useState<FinancialTransactionType>(initialType);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0] || '2026-01-01');
  const [category, setCategory] = useState<string>('Fabric');
  const [amount, setAmount] = useState<string>('');
  const [paymentAccountId, setPaymentAccountId] = useState<string>('');
  const [toPaymentAccountId, setToPaymentAccountId] = useState<string>('');
  const [referenceId, setReferenceId] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [partnerId, setPartnerId] = useState<string>('');
  const [isPersonalExpenseByPartner, setIsPersonalExpenseByPartner] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<TransactionApprovalStatus>('APPROVED');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [attachmentSize, setAttachmentSize] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Populate state on open or edit
  useEffect(() => {
    if (transactionToEdit) {
      setType(transactionToEdit.type);
      setDate(transactionToEdit.date);
      setCategory(transactionToEdit.category);
      setAmount(String(transactionToEdit.amount));
      setPaymentAccountId(transactionToEdit.paymentAccountId);
      setToPaymentAccountId(transactionToEdit.toPaymentAccountId || '');
      setReferenceId(transactionToEdit.referenceId || '');
      setOrderId(transactionToEdit.orderId || '');
      setPartnerId(transactionToEdit.partnerId || '');
      setIsPersonalExpenseByPartner(!!transactionToEdit.isPersonalExpenseByPartner);
      setDescription(transactionToEdit.description);
      setNotes(transactionToEdit.notes || '');
      setStatus(transactionToEdit.status);
      setAttachmentName(transactionToEdit.attachmentName || '');
      setAttachmentSize(transactionToEdit.attachmentSize || '');
    } else {
      setType(initialType);
      setDate(new Date().toISOString().split('T')[0] || '2026-01-01');
      setCategory(initialType === 'INCOME' ? 'Customer Orders' : initialType === 'CAPITAL' ? 'Capital Contribution' : 'Fabric');
      setAmount('');
      setPaymentAccountId(accountsWithBalances[0]?.id || '');
      setToPaymentAccountId(accountsWithBalances[1]?.id || '');
      setReferenceId('');
      setOrderId('');
      setPartnerId(initialPartnerId || '');
      setIsPersonalExpenseByPartner(false);
      setDescription('');
      setNotes('');
      setStatus('APPROVED');
      setAttachmentName('');
      setAttachmentSize('');
    }
    setError('');
  }, [isOpen, transactionToEdit, initialType, initialPartnerId, accountsWithBalances]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive transaction amount.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a brief description.');
      return;
    }
    if (!paymentAccountId) {
      setError('Please select a payment account.');
      return;
    }
    if (type === 'TRANSFER' && paymentAccountId === toPaymentAccountId) {
      setError('Destination account must be different from source account for transfers.');
      return;
    }
    if ((type === 'CAPITAL' || type === 'WITHDRAWAL') && !partnerId) {
      setError('Please select the associated partner for capital / withdrawal transactions.');
      return;
    }

    const isCogs = type === 'EXPENSE' && ['manufacturing', 'fabric', 'printing', 'packaging'].some(k => 
      category.toLowerCase().includes(k)
    );

    if (transactionToEdit) {
      updateTransaction(transactionToEdit.id, {
        type,
        date,
        category,
        amount: numAmount,
        paymentAccountId,
        toPaymentAccountId: type === 'TRANSFER' ? toPaymentAccountId : undefined,
        referenceId: referenceId.trim() || undefined,
        orderId: orderId.trim() || undefined,
        partnerId: partnerId || undefined,
        isPersonalExpenseByPartner,
        description: description.trim(),
        notes: notes.trim() || undefined,
        status,
        attachmentName: attachmentName || undefined,
        attachmentSize: attachmentSize || undefined,
        isCogs,
      });
    } else {
      createTransaction({
        type,
        date,
        category,
        amount: numAmount,
        paymentAccountId,
        toPaymentAccountId: type === 'TRANSFER' ? toPaymentAccountId : undefined,
        referenceId: referenceId.trim() || undefined,
        orderId: orderId.trim() || undefined,
        partnerId: partnerId || undefined,
        isPersonalExpenseByPartner,
        description: description.trim(),
        notes: notes.trim() || undefined,
        status,
        attachmentName: attachmentName || undefined,
        attachmentSize: attachmentSize || undefined,
        isCogs,
      });
    }

    onClose();
  };

  const handleSimulatedFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachmentName(file.name);
      setAttachmentSize(`${(file.size / 1024).toFixed(0)} KB`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {transactionToEdit ? 'Edit Transaction' : 'Record Financial Transaction'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter double-entry ledger details. All records dynamically update financial statements.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Transaction Type Selector Tabs */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Transaction Type *
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {([
                'EXPENSE', 
                'INCOME', 
                'CAPITAL', 
                'WITHDRAWAL', 
                'CAPITAL_RETURN',
                'PROFIT_ALLOCATION',
                'LOSS_ALLOCATION',
                'PARTNER_EXPENSE',
                'REIMBURSEMENT',
                'TRANSFER', 
                'REFUND', 
                'ADJUSTMENT'
              ] as FinancialTransactionType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                    if (t === 'INCOME') setCategory('Customer Orders');
                    else if (t === 'CAPITAL') setCategory('Capital Contribution');
                    else if (t === 'CAPITAL_RETURN') setCategory('Capital Return');
                    else if (t === 'PROFIT_ALLOCATION') setCategory('Profit Allocation');
                    else if (t === 'LOSS_ALLOCATION') setCategory('Loss Allocation');
                    else if (t === 'WITHDRAWAL') setCategory('Partner Drawings');
                    else if (t === 'PARTNER_EXPENSE') setCategory('Business Expense Paid by Partner');
                    else if (t === 'REIMBURSEMENT') setCategory('Partner Reimbursement');
                    else if (t === 'TRANSFER') setCategory('Internal Transfer');
                    else if (t === 'REFUND') setCategory('Refunds');
                    else setCategory('Fabric');
                  }}
                  className={`py-1.5 px-1 rounded-lg text-xs font-semibold text-center transition cursor-pointer truncate ${
                    type === t
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Amount (INR ₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-semibold text-sm">₹</span>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* 3. Category & Accounts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Category *
              </label>
              {type === 'EXPENSE' ? (
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                >
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : type === 'INCOME' ? (
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                >
                  {INCOME_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {type === 'TRANSFER' ? 'Source Account *' : 'Financial Account *'}
              </label>
              <select
                value={paymentAccountId}
                onChange={e => setPaymentAccountId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                required
              >
                {accountsWithBalances.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (₹{acc.currentBalance.toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. If TRANSFER: Destination Account */}
          {type === 'TRANSFER' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Destination Account *
              </label>
              <select
                value={toPaymentAccountId}
                onChange={e => setToPaymentAccountId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                required
              >
                {accountsWithBalances.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (₹{acc.currentBalance.toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 5. Partner Association (for CAPITAL, WITHDRAWAL, or Personal Expense paid by Partner) */}
          {(type === 'CAPITAL' || type === 'WITHDRAWAL' || type === 'CAPITAL_RETURN' || type === 'PROFIT_ALLOCATION' || type === 'LOSS_ALLOCATION' || type === 'PARTNER_EXPENSE' || type === 'REIMBURSEMENT' || type === 'EXPENSE' || partnerId) && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Partner Association</span>
                </label>
                {type === 'EXPENSE' && (
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPersonalExpenseByPartner}
                      onChange={e => setIsPersonalExpenseByPartner(e.target.checked)}
                      className="rounded text-red-600 focus:ring-red-500"
                    />
                    <span>Paid personally by partner (Reimbursable)</span>
                  </label>
                )}
              </div>

              {(type !== 'EXPENSE' || isPersonalExpenseByPartner) && (
                <div>
                  <select
                    value={partnerId}
                    onChange={e => setPartnerId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    required={type === 'CAPITAL' || type === 'WITHDRAWAL' || type === 'CAPITAL_RETURN' || type === 'PROFIT_ALLOCATION' || type === 'LOSS_ALLOCATION' || type === 'PARTNER_EXPENSE'}
                  >
                    <option value="">-- Select Partner --</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.role} • {p.ownershipPercentage}% Equity)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* 6. Description & Reference */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Description *
              </label>
              <input
                type="text"
                placeholder="e.g. 240 GSM Combed Cotton Roll procurement from Tirupur Mills"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reference / Invoice / UTR #
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-9041 or UTR-098214"
                  value={referenceId}
                  onChange={e => setReferenceId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Link Customer Order ID</span>
                  <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                </label>
                <select
                  value={orderId}
                  onChange={e => setOrderId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                >
                  <option value="">-- No order linked --</option>
                  {orders.slice(0, 15).map(o => (
                    <option key={o.orderId} value={o.orderNumber}>
                      {o.orderNumber} - {o.customerName} (₹{o.total.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 7. Attachment / Receipt Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Receipt / Tax Invoice / Proof Attachment
            </label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-slate-300 transition bg-slate-50/50">
              {attachmentName ? (
                <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">{attachmentName}</span>
                    <span className="text-slate-400">({attachmentSize || '320 KB'})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentName('');
                      setAttachmentSize('');
                    }}
                    className="text-slate-400 hover:text-red-500 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center">
                  <Upload className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-xs font-medium text-slate-700">Click to upload receipt, PDF, or JPG/PNG image</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Supports vendor tax invoices, bank transfer slips up to 10MB</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleSimulatedFileUpload}
                  />
                </label>
              )}
            </div>
          </div>

          {/* 8. Approval Status Selection */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Workflow Status
            </label>
            <div className="flex items-center gap-3">
              {(['APPROVED', 'PENDING_APPROVAL', 'DRAFT'] as TransactionApprovalStatus[]).map(s => (
                <label key={s} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="approvalStatus"
                    checked={status === s}
                    onChange={() => setStatus(s)}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span className={s === 'APPROVED' ? 'text-emerald-700 font-semibold' : ''}>
                    {s === 'APPROVED' ? 'Approved (Instant Ledger)' : s === 'PENDING_APPROVAL' ? 'Pending Approval' : 'Draft'}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              * Note: Only Approved transactions alter account balances, partner current accounts, and financial statements.
            </p>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>{transactionToEdit ? 'Save Changes' : 'Post Transaction'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
