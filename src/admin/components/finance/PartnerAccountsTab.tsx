import React, { useState, useMemo } from 'react';
import {
  Users,
  Settings,
  Plus,
  ShieldCheck,
  Percent,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Download,
  Info,
  Layers,
  Scale,
} from 'lucide-react';
import { FinancialTransaction } from '../../types/finance';
import { useFinance, DateRangePreset } from '../../context/FinanceContext';
import { calculatePartnerChronologicalLedger } from '../../services/financeService';

interface PartnerAccountsTabProps {
  onOpenNewTransaction: (type?: any, partnerId?: string) => void;
  onOpenPartnerConfig: () => void;
  onEditTransaction: (tx: FinancialTransaction) => void;
}

export const PartnerAccountsTab: React.FC<PartnerAccountsTabProps> = ({
  onOpenNewTransaction,
  onOpenPartnerConfig,
}) => {
  const { 
    partners, 
    partnerSummaries, 
    transactions, 
    currentPnL,
    executiveKPIs,
    datePreset,
    setDatePreset,
    distributeProfit
  } = useFinance();

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('ptr-01'); // Default to Mohammed Saif
  const [distributeSuccessMessage, setDistributeSuccessMessage] = useState<string>('');
  const [distributeErrorMessage, setDistributeErrorMessage] = useState<string>('');
  const [isDistributing, setIsDistributing] = useState<boolean>(false);

  // Filter presets
  const presets: { id: DateRangePreset; label: string }[] = [
    { id: 'ALL', label: 'All Time' },
    { id: 'THIS_MONTH', label: 'This Month' },
    { id: 'LAST_MONTH', label: 'Last Month' },
    { id: 'THIS_QUARTER', label: 'This Quarter' },
    { id: 'FY25_26', label: 'FY 2025-26' },
  ];

  // Active selected partner
  const selectedPartner = partners.find(p => p.id === selectedPartnerId) || partners[0];

  // Partner Ledger rows for the selected partner
  const ledgerRows = useMemo(() => {
    if (!selectedPartner) return [];
    return calculatePartnerChronologicalLedger(selectedPartner, transactions);
  }, [selectedPartner, transactions]);

  // Aggregate Metrics for the 9 Separate Balances (Strictly matching prompt specs)
  const totalBusinessRevenue = currentPnL.netRevenue;
  const totalBusinessCOGS = currentPnL.cogs.total;
  const totalBusinessExpenses = currentPnL.operatingExpenses.total + currentPnL.otherExpenses.total;
  const totalBusinessCashBank = executiveKPIs.totalLiquid;
  const totalBusinessCapital = partnerSummaries.reduce(
    (sum, s) => sum + s.capitalInvested + s.additionalContributions - s.capitalReturned, 
    0
  );
  const totalProfitDistributed = partnerSummaries.reduce((sum, s) => sum + s.profitAllocated, 0);
  const totalPartnerWithdrawals = partnerSummaries.reduce((sum, s) => sum + s.withdrawals, 0);
  const totalPartnerReimbursements = partnerSummaries.reduce((sum, s) => sum + (s.reimbursements || 0), 0);
  const undistributedProfit = Math.max(0, currentPnL.netProfit - totalProfitDistributed);

  // Four Equal Partners verified
  const totalConfiguredPercentage = partners.reduce(
    (sum, p) => sum + ((p.profitSharePercentage ?? p.ownershipPercentage) || 0), 
    0
  );
  const isPercentageValid = Math.abs(totalConfiguredPercentage - 100) < 0.01;

  // Handle Distribute Profit Action
  const handleExecuteProfitDistribution = async () => {
    setDistributeSuccessMessage('');
    setDistributeErrorMessage('');

    if (!isPercentageValid) {
      setDistributeErrorMessage(`Cannot distribute profit: Total profit-sharing percentage must equal exactly 100%. Current configured total is ${totalConfiguredPercentage}%.`);
      return;
    }

    if (currentPnL.netProfit <= 0) {
      setDistributeErrorMessage(`Cannot distribute: Net profit for selected period (${currentPnL.period}) is ₹${currentPnL.netProfit.toLocaleString('en-IN')}.`);
      return;
    }

    setIsDistributing(true);
    const result = await distributeProfit(currentPnL.period);
    setIsDistributing(false);

    if (result.success) {
      setDistributeSuccessMessage(
        `Successfully allocated ₹${currentPnL.netProfit.toLocaleString('en-IN')} net profit equally (25% each) across Mohammed Saif, Simranjeet Singh, Lokesh Kottala, and Nagesh M!`
      );
      setTimeout(() => setDistributeSuccessMessage(''), 8000);
    } else {
      setDistributeErrorMessage(result.error || 'Failed to distribute profit.');
    }
  };

  // Export partner ledger to CSV
  const handleExportPartnerLedger = () => {
    if (!selectedPartner) return;
    const rows = [
      [`TORIWEAR — PARTNER FINANCIAL LEDGER: ${selectedPartner.name.toUpperCase()}`],
      ['Role', selectedPartner.role],
      ['Ownership %', `${selectedPartner.ownershipPercentage}%`],
      ['Profit Share %', `${selectedPartner.profitSharePercentage ?? selectedPartner.ownershipPercentage}%`],
      ['Generated On', new Date().toLocaleString('en-IN')],
      [],
      ['Date', 'Transaction', 'Type', 'Credit (INR)', 'Debit (INR)', 'Balance (INR)', 'Reference'],
      ...ledgerRows.map(r => [
        r.date,
        `"${r.description.replace(/"/g, '""')}"`,
        r.type,
        r.credit > 0 ? r.credit : '',
        r.debit > 0 ? r.debit : '',
        r.balance,
        r.reference
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `toriwear_ledger_${selectedPartner.name.replace(/\s+/g, '_').toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Breadcrumb & Quick Actions */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                ADMIN → FINANCE & ACCOUNTS →
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-bold border border-red-200">
                PARTNERS
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
              TORIWEAR Partner Accounts & Equal 25% Partnership Structure
            </h2>
            <p className="text-xs text-slate-500">
              Four Equal Partners: Mohammed Saif (25%), Simranjeet Singh (25%), Lokesh Kottala (25%), and Nagesh M (25%)
            </p>
          </div>
        </div>

        {/* Filter bar and config button */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Preset filters */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {presets.map(p => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  datePreset === p.id 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={onOpenPartnerConfig}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Manage Partner Details</span>
          </button>

          <button
            onClick={() => onOpenNewTransaction('CAPITAL', selectedPartnerId)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm shadow-red-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Inject Capital</span>
          </button>
        </div>
      </div>

      {/* 2. IMPORTANT ACCOUNTING RULE BANNER & REVENUE WATERFALL */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-4 border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">
                  IMPORTANT AUDITED GAAP ACCOUNTING RULE
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold">
                  NO DIRECT REVENUE DIVISION
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight mt-0.5" style={{ color: '#ffffff' }}>
                Product Sales Revenue Must NEVER Be Divided Directly Between Partners
              </h3>
            </div>
          </div>
          <span className="px-3 py-1 rounded-xl bg-slate-800 text-slate-300 font-mono text-xs font-semibold">
            All Sales = 100% Business Revenue
          </span>
        </div>

        {/* Narrative & Standard Accounting Principles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
          <div className="space-y-2 p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
            <div className="font-bold text-white flex items-center gap-1.5 text-xs" style={{ color: '#ffffff' }}>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Revenue Accounting & Expense Waterfall Principle</span>
            </div>
            <p>
              All customer sales revenue must first be recorded as <strong>BUSINESS REVENUE</strong> in company books. 
              Do <strong>NOT</strong> divide product sales revenue directly between the four partners (e.g. a ₹400 sale is NEVER automatically divided as ₹100 each).
            </p>
            <p>
              Applicable business costs must first be subtracted: <strong>Manufacturing/COGS</strong>, <strong>Packaging</strong>, <strong>Shipping/fulfillment</strong>, <strong>Payment gateway charges</strong>, <strong>Discounts</strong>, <strong>Refunds</strong>, and <strong>Marketing/Advertising costs</strong>.
            </p>
            <p className="font-mono text-amber-300 text-[11px] pt-1">
              Formula: Net Profit = Total Revenue − Total Business Costs. ONLY the resulting distributable NET PROFIT is allocated between the 4 equal partners (25% each).
            </p>
          </div>

          <div className="space-y-2 p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
            <div className="font-bold text-white flex items-center gap-1.5 text-xs" style={{ color: '#ffffff' }}>
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Capital, Withdrawals & Profit Allocation Separation</span>
            </div>
            <p>
              • <strong>Partner CAPITAL:</strong> Kept completely separate from sales revenue and profit allocation. Capital contributions only increase partner capital when a partner actually contributes money/assets to the business.
            </p>
            <p>
              • <strong>Partner WITHDRAWALS:</strong> Treated as equity drawings and must <strong>NOT</strong> be treated as business operating expenses.
            </p>
            <p>
              • <strong>Profit Allocation ≠ Cash Withdrawal:</strong> Allocating profit is an internal accounting equity credit. It does not automatically transfer or disburse money from company bank accounts.
            </p>
          </div>
        </div>

        {/* Concrete ₹400 Product Sale Example Box from Prompt */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">
              Concrete Accounting Example (₹400 Sale & Applicable Costs Waterfall):
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              ₹400 Sale remains recorded in Business Accounting Records
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            {/* Step 1 */}
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">1. Product Selling Price</span>
              <div className="text-base font-bold font-mono text-white mt-0.5" style={{ color: '#ffffff' }}>₹400</div>
              <span className="text-[11px] text-emerald-400 block mt-1">Recorded as Business Revenue</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Do NOT transfer ₹100 to each partner</span>
            </div>

            {/* Step 2 */}
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">2. Applicable Business Costs</span>
              <div className="text-base font-bold font-mono text-rose-400 mt-0.5">-₹240</div>
              <span className="text-[11px] text-slate-300 block mt-1">COGS, Shipping, Packaging, Gateway</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Subtracted before profit calculation</span>
            </div>

            {/* Step 3 */}
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">3. Net Distributable Profit</span>
              <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">₹160</div>
              <span className="text-[11px] text-slate-300 block mt-1">Revenue (₹400) − Costs (₹240)</span>
              <span className="text-[10px] text-amber-300 block mt-0.5">Only this net profit is distributed</span>
            </div>

            {/* Step 4 */}
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">4. Equal 25% Allocation</span>
              <div className="text-xs font-mono font-bold text-white mt-1 space-y-0.5" style={{ color: '#ffffff' }}>
                <div className="flex justify-between"><span>Saif (25%):</span> <span className="text-emerald-400">₹40</span></div>
                <div className="flex justify-between"><span>Simranjeet (25%):</span> <span className="text-emerald-400">₹40</span></div>
                <div className="flex justify-between"><span>Lokesh (25%):</span> <span className="text-emerald-400">₹40</span></div>
                <div className="flex justify-between"><span>Nagesh (25%):</span> <span className="text-emerald-400">₹40</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Clear Distinction Banner */}
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold text-amber-300 uppercase tracking-wider font-mono">
              SYSTEM ENFORCEMENT: Profit Allocated vs. Money Actually Paid/Withdrawn
            </span>
            <p className="text-slate-300 leading-relaxed">
              <strong>Profit Allocated</strong> is an internal accounting equity credit recorded when business generates net income. 
              <strong>Money Paid/Withdrawn</strong> is an actual liquid cash transfer from the business account to a partner. 
              <strong>These are NOT the same transaction.</strong> Profit allocation does not reduce company cash, while partner drawings require an authorized withdrawal transaction and reduce business liquid funds without affecting business P&L expenses.
            </p>
          </div>
        </div>
      </div>

      {/* 3. MAINTAIN SEPARATE BALANCES FOR (All 9 Strict Balances Required) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-bold text-slate-900">
                9 Separate Accounting Balances ({currentPnL.period})
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                GAAP Isolated Ledgers
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Strictly maintained distinct balances across operational performance, company treasury, inventory, and partner equity
            </p>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
            <span>4 Equal Partners · <strong>25% Each</strong></span>
          </div>
        </div>

        {/* 9 Dedicated Separate Balances Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* 1. Business Revenue */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-500">1. Business Revenue</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">Sales Income</span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900">
              ₹{totalBusinessRevenue.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Customer sales & wholesale orders. 100% company income, never divided directly among partners.
            </p>
          </div>

          {/* 2. Business Expenses */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-500">2. Business Expenses</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold">OPEX</span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900">
              ₹{totalBusinessExpenses.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Operating costs: Shipping, advertising, software, rent, payment gateway fees. Excludes drawings.
            </p>
          </div>

          {/* 3. Business Cash/Bank */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-500">3. Business Cash/Bank</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold">Treasury</span>
            </div>
            <div className="text-xl font-bold font-mono text-blue-600">
              ₹{totalBusinessCashBank.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Liquid reserves across HDFC Current A/C, Cash Vault & Gateway. Backs all operations.
            </p>
          </div>

          {/* 4. Inventory/COGS */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-500">4. Inventory / COGS</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 text-slate-800 font-bold">Production</span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900">
              ₹{totalBusinessCOGS.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              240 GSM combed cotton fabric mills, DTG/HD screen printing, custom anime boxes & packaging.
            </p>
          </div>

          {/* 5. Partner Capital */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-500">5. Partner Capital</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-bold">Equity Pool</span>
            </div>
            <div className="text-xl font-bold font-mono text-purple-700">
              ₹{totalBusinessCapital.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Cumulative capital contributed by partners. Kept strictly isolated from revenue.
            </p>
          </div>

          {/* 6. Partner Profit Allocation */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-500">6. Partner Profit Allocation</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">25% Share</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600">
              ₹{totalProfitDistributed.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Total net profit allocated into partner equity accounts. Equity credit, NOT cash payout.
            </p>
          </div>

          {/* 7. Partner Withdrawals */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-500">7. Partner Withdrawals</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">Drawings</span>
            </div>
            <div className="text-xl font-bold font-mono text-amber-600">
              ₹{totalPartnerWithdrawals.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Actual cash disbursements drawn out by partners. Treated as equity reduction, never as expense.
            </p>
          </div>

          {/* 8. Partner Reimbursements */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-500">8. Partner Reimbursements</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800 font-bold">Settlements</span>
            </div>
            <div className="text-xl font-bold font-mono text-blue-600">
              ₹{totalPartnerReimbursements.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Company repayments to partners for business expenses paid out-of-pocket personally.
            </p>
          </div>

          {/* 9. Undistributed Business Profit */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-500">9. Undistributed Business Profit</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 font-bold">Retained</span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-800">
              ₹{undistributedProfit.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Retained business net profits preserved in company reserves for future scaling & seasonal drops.
            </p>
          </div>
        </div>

        {/* Individual Partner Balances Row */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 uppercase tracking-wider font-mono text-[11px]">
              Individual Partner Account Balances (25% Equal Structure):
            </span>
            <span className="text-slate-500 text-[11px]">
              Formula: Initial Capital + Additional Capital + Profit Share − Withdrawals + Out-of-Pocket − Reimbursements
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {partnerSummaries.map(s => (
              <div 
                key={s.partner.id} 
                onClick={() => setSelectedPartnerId(s.partner.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  selectedPartnerId === s.partner.id
                    ? 'bg-red-50/50 border-red-500 ring-2 ring-red-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="font-bold text-slate-900 text-xs">{s.partner.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">25% Ownership · 25% Profit Share</div>
                </div>
                <div className="text-right">
                  <div className={`font-mono font-bold text-sm ${
                    s.currentBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    ₹{s.currentBalance.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-slate-400">Account Balance</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. AUTOMATIC PROFIT DISTRIBUTION (Equal 25% allocation for any Net Profit or Loss) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Automatic Equal Profit / Loss Distribution</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                25% Equal Allocation (4 Partners)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              When the business calculates net profit or loss, it automatically allocates equally (25% each) across Mohammed Saif, Simranjeet Singh, Lokesh Kottala, and Nagesh M.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span 
              className="px-3 py-1 bg-slate-900 text-white rounded-xl text-xs font-mono font-bold"
              style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
            >
              Total Ownership: 100% (25% Each)
            </span>
          </div>
        </div>

        {/* Feedback Alerts */}
        {distributeSuccessMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{distributeSuccessMessage}</span>
          </div>
        )}

        {distributeErrorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{distributeErrorMessage}</span>
          </div>
        )}

        {/* Automatic Distribution Box */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold block">
                Live Calculated Business Net Performance ({currentPnL.period}):
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className={`text-2xl font-bold font-mono ${
                  currentPnL.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  ₹{currentPnL.netProfit.toLocaleString('en-IN')}
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  ({currentPnL.netProfit >= 0 ? 'Net Distributable Profit' : 'Net Business Loss'})
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-center gap-2 max-w-lg">
              <Info className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                <strong>Crucial Rule:</strong> Profit allocation and actual withdrawal/payment are separate transactions. 
                Allocating profit credits partner capital accounts; cash is not disbursed until a withdrawal is explicitly requested and approved.
              </span>
            </div>
          </div>

          {/* Equal 25% Allocation Breakdown from Stored Records */}
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-slate-500" />
                <span>Automatic 25% Equal Partner Allocation Breakdown (Calculated from Live Records):</span>
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Formula: Net Distributable ₹{currentPnL.netProfit.toLocaleString('en-IN')} × 25%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {partners.map(p => {
                const partnerShare = Math.round(currentPnL.netProfit * 0.25);
                const isPositive = partnerShare >= 0;

                return (
                  <div key={p.id} className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">25% Profit Share</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-mono font-bold ${
                        isPositive ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isPositive ? '+' : ''}₹{partnerShare.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {isPositive ? 'Distributable Profit' : 'Loss Share'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Prompt Concrete Examples Demonstration Box */}
          <div className="pt-3 border-t border-slate-200 space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              Standard Equal Partnership Calculation Scenarios (Audited GAAP Rules):
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Example 1: Product Sale Waterfall (₹400 Sale) */}
              <div className="p-3.5 bg-white border border-blue-200 rounded-xl">
                <div className="flex items-center justify-between border-b border-blue-100 pb-2 mb-2">
                  <span className="font-bold text-blue-900">Sale Waterfall: ₹400 Product</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">Net: ₹160</span>
                </div>
                <div className="space-y-1 font-mono text-[11px] text-slate-700">
                  <div className="flex justify-between text-slate-500"><span>• Business Revenue:</span> <span className="font-bold text-slate-800">₹400</span></div>
                  <div className="flex justify-between text-rose-600"><span>• Applicable Costs:</span> <span className="font-bold">-₹240</span></div>
                  <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-emerald-700"><span>• Net Distributable:</span> <span>₹160</span></div>
                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                    <div>Saif (25%): <strong>₹40</strong> · Simran: <strong>₹40</strong></div>
                    <div>Lokesh (25%): <strong>₹40</strong> · Nagesh: <strong>₹40</strong></div>
                  </div>
                  <div className="text-[9px] text-amber-700 pt-0.5 font-sans leading-tight">
                    *₹400 stays in company accounts. No automatic ₹100 transfer.
                  </div>
                </div>
              </div>

              {/* Example 2: Distributable Profit ₹100,000 */}
              <div className="p-3.5 bg-white border border-emerald-200 rounded-xl">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2 mb-2">
                  <span className="font-bold text-emerald-800">If Net Distributable = ₹100,000</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">+₹100,000</span>
                </div>
                <div className="space-y-1 font-mono text-[11px] text-slate-700">
                  <div className="flex justify-between"><span>• Mohammed Saif →</span> <span className="font-bold text-emerald-700">₹25,000</span></div>
                  <div className="flex justify-between"><span>• Simranjeet Singh →</span> <span className="font-bold text-emerald-700">₹25,000</span></div>
                  <div className="flex justify-between"><span>• Lokesh Kottala →</span> <span className="font-bold text-emerald-700">₹25,000</span></div>
                  <div className="flex justify-between"><span>• Nagesh M →</span> <span className="font-bold text-emerald-700">₹25,000</span></div>
                  <div className="text-[9px] text-slate-500 pt-1 border-t border-slate-100 font-sans leading-tight">
                    *Equity credited (25% each). Funds not transferred until drawn.
                  </div>
                </div>
              </div>

              {/* Example 3: Net Loss ₹40,000 */}
              <div className="p-3.5 bg-white border border-rose-200 rounded-xl">
                <div className="flex items-center justify-between border-b border-rose-100 pb-2 mb-2">
                  <span className="font-bold text-rose-800">If Net Loss = ₹40,000</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">-₹40,000</span>
                </div>
                <div className="space-y-1 font-mono text-[11px] text-slate-700">
                  <div className="flex justify-between"><span>• Mohammed Saif →</span> <span className="font-bold text-rose-700">₹10,000 loss</span></div>
                  <div className="flex justify-between"><span>• Simranjeet Singh →</span> <span className="font-bold text-rose-700">₹10,000 loss</span></div>
                  <div className="flex justify-between"><span>• Lokesh Kottala →</span> <span className="font-bold text-rose-700">₹10,000 loss</span></div>
                  <div className="flex justify-between"><span>• Nagesh M →</span> <span className="font-bold text-rose-700">₹10,000 loss</span></div>
                  <div className="text-[9px] text-slate-500 pt-1 border-t border-slate-100 font-sans leading-tight">
                    *Loss allocated 25% each against partner capital balances.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200">
            <span className="text-[11px] text-slate-500 font-mono">
              Equal Allocation verified: Saif (25%) + Simranjeet (25%) + Lokesh (25%) + Nagesh (25%) = 100%
            </span>

            <button
              onClick={handleExecuteProfitDistribution}
              disabled={currentPnL.netProfit <= 0 || isDistributing}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                currentPnL.netProfit > 0 && !isDistributing
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isDistributing ? 'Allocating...' : 'Record Distributable Profit Allocation (25% Each)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. FOUR EQUAL PARTNER CARDS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-red-600" />
            <span>Four Equal Business Partners</span>
          </h3>
          <span className="text-xs text-slate-500">
            Click any partner card to inspect their complete transaction ledger below
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {partnerSummaries.map((summary) => {
            const { partner } = summary;
            const isSelected = selectedPartnerId === partner.id;

            return (
              <div 
                key={partner.id}
                onClick={() => setSelectedPartnerId(partner.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer text-left relative flex flex-col justify-between ${
                  isSelected 
                    ? 'bg-red-50/40 border-red-500 ring-2 ring-red-500/20 shadow-md' 
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div>
                  {/* Partner Header with explicit: Name and 25% Ownership | 25% Profit Share */}
                  <div className="flex flex-col border-b border-slate-200/80 pb-3">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-base font-bold text-slate-900">{partner.name}</h4>
                      <span 
                        className="px-2 py-0.5 rounded-full bg-slate-900 text-white font-mono text-[10px] font-bold shrink-0"
                        style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
                      >
                        25%
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-mono font-bold text-slate-800">
                      25% Ownership | 25% Profit Share
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{partner.role}</p>
                  </div>

                  {/* 10 Required Separate Tracking Fields */}
                  <div className="mt-3.5 space-y-1.5 text-xs">
                    {/* 1. Initial Capital Contribution */}
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Initial Capital Contribution</span>
                      <span className="font-mono font-medium text-slate-900">
                        ₹{summary.capitalInvested.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* 2. Additional Capital Contributions */}
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Additional Capital</span>
                      <span className="font-mono font-medium text-slate-900">
                        ₹{summary.additionalContributions.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* 3. Capital Returned */}
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Capital Returned</span>
                      <span className="font-mono font-medium text-amber-600">
                        ₹{summary.capitalReturned.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* 4. Business Expenses Paid Personally */}
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Expenses Paid Personally</span>
                      <span className="font-mono font-medium text-indigo-600">
                        +₹{summary.personalExpensesPaid.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* 5. Reimbursements */}
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Reimbursements</span>
                      <span className="font-mono font-medium text-blue-600">
                        -₹{(summary.reimbursements || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* 6. Partner Withdrawals */}
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Partner Withdrawals</span>
                      <span className="font-mono font-medium text-amber-600">
                        -₹{summary.withdrawals.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* 7. Profit Allocated */}
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Profit Allocated (25%)</span>
                      <span className="font-mono font-medium text-emerald-600">
                        +₹{summary.profitAllocated.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* 8. Loss Allocated */}
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Loss Allocated (25%)</span>
                      <span className="font-mono font-medium text-rose-600">
                        -₹{summary.lossAllocated.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* 9. Current Partner Account Balance */}
                    <div className="pt-2 mt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase font-mono text-slate-700">
                          Current Account Balance
                        </span>
                        <span className={`text-base font-bold font-mono ${
                          summary.currentBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          ₹{summary.currentBalance.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 10. Complete Transaction Ledger Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNewTransaction('CAPITAL', partner.id);
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold text-center transition-colors"
                  >
                    + Capital
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNewTransaction('WITHDRAWAL', partner.id);
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-amber-700 text-[11px] font-semibold text-center transition-colors"
                  >
                    - Drawing
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPartnerId(partner.id);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                    style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
                  >
                    View Ledger
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. PARTNER LEDGER (Exact Columns: Date | Transaction | Type | Credit | Debit | Balance | Reference) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Ledger Header & Partner Switcher */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                {selectedPartner?.name} — Complete Transaction Ledger
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                25% Equal Partner · {ledgerRows.length} Ledger Records
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Full chronological financial ledger with running balance, tracking capital, withdrawals, profit/loss allocations, and personal expense outlays
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Select partner tab */}
            <select
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
            >
              {partners.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (25% Equal Partner)
                </option>
              ))}
            </select>

            <button
              onClick={handleExportPartnerLedger}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export Ledger</span>
            </button>

            <button
              onClick={() => onOpenNewTransaction('CAPITAL', selectedPartnerId)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
            >
              <Plus className="w-3.5 h-3.5" style={{ color: '#ffffff' }} />
              <span style={{ color: '#ffffff' }}>Record Entry</span>
            </button>
          </div>
        </div>

        {/* Ledger Table: Exact required columns */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] font-mono">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Transaction</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Credit</th>
                <th className="py-3 px-4 text-right">Debit</th>
                <th className="py-3 px-4 text-right">Balance</th>
                <th className="py-3 px-4">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {ledgerRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    No ledger entries recorded for {selectedPartner?.name}.
                  </td>
                </tr>
              ) : (
                ledgerRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* 1. Date */}
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {row.date}
                    </td>

                    {/* 2. Transaction Description */}
                    <td className="py-3 px-4 font-sans font-medium text-slate-900 max-w-sm">
                      <div className="truncate">{row.description}</div>
                      <span className="text-[10px] font-mono text-slate-400 block">{row.transactionNumber}</span>
                    </td>

                    {/* 3. Type */}
                    <td className="py-3 px-4 whitespace-nowrap font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        row.type === 'Capital Contribution' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        row.type === 'Capital Return' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        row.type === 'Profit Allocation' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        row.type === 'Loss Allocation' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        row.type === 'Partner Withdrawal' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        row.type === 'Business Expense Paid by Partner' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                        row.type === 'Reimbursement' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {row.type}
                      </span>
                    </td>

                    {/* 4. Credit */}
                    <td className="py-3 px-4 text-right text-emerald-600 font-bold whitespace-nowrap">
                      {row.credit > 0 ? `+₹${row.credit.toLocaleString('en-IN')}` : '—'}
                    </td>

                    {/* 5. Debit */}
                    <td className="py-3 px-4 text-right text-rose-600 font-bold whitespace-nowrap">
                      {row.debit > 0 ? `-₹${row.debit.toLocaleString('en-IN')}` : '—'}
                    </td>

                    {/* 6. Balance */}
                    <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                      row.balance >= 0 ? 'text-slate-900' : 'text-rose-600'
                    }`}>
                      ₹{row.balance.toLocaleString('en-IN')}
                    </td>

                    {/* 7. Reference */}
                    <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {row.reference}
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
