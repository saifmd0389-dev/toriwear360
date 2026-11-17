import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  Landmark,
  ArrowUpRight,
  Users,
  Plus,
  PieChart,
  BarChart3,
  Clock,
} from 'lucide-react';
import { useFinance, DateRangePreset } from '../../context/FinanceContext';

interface FinanceDashboardTabProps {
  onOpenNewTransaction: (type?: any) => void;
  onNavigateToTab: (tabId: string) => void;
  onOpenTransferModal: () => void;
  onOpenPartnerConfig: () => void;
}

export const FinanceDashboardTab: React.FC<FinanceDashboardTabProps> = ({
  onOpenNewTransaction,
  onNavigateToTab,
  onOpenPartnerConfig,
}) => {
  const { 
    executiveKPIs, 
    datePreset, 
    setDatePreset, 
    pendingApprovalsCount
  } = useFinance();

  const { pnl, cashBalance, bankBalance, gatewayBalance, totalPartnerCapital, totalPartnerWithdrawals, accountsPayable, partnerSummaries } = executiveKPIs;

  const presets: { id: DateRangePreset; label: string }[] = [
    { id: 'ALL', label: 'All Time' },
    { id: 'THIS_MONTH', label: 'This Month' },
    { id: 'LAST_MONTH', label: 'Last Month' },
    { id: 'THIS_QUARTER', label: 'This Quarter' },
    { id: 'FY25_26', label: 'FY 2025-26' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Date Range & Quick Actions Filter Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Financial Command Center</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
              Double-Entry Validated
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time accounting ledger analytics, liquid balances, COGS margins & partner capital accounts.
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {presets.map(p => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenNewTransaction('EXPENSE')}
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Expense</span>
            </button>
            <button
              onClick={() => onOpenNewTransaction('INCOME')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Income</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Core Operational Metrics (Primary 6-Card Grid) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Revenue */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Total Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            ₹{pnl.netRevenue.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span>Gross Sales: ₹{pnl.grossRevenue.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* COGS */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">COGS (Direct)</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            ₹{pnl.cogs.total.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>Fabric, Print & Packing</span>
          </div>
        </div>

        {/* Gross Profit */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Gross Profit</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl font-black font-mono ${pnl.grossProfit >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
            ₹{pnl.grossProfit.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-indigo-600 font-bold mt-1">
            {pnl.grossMarginPercent.toFixed(1)}% Gross Margin
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Operating Exp</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            ₹{pnl.operatingExpenses.total.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>Shipping, Ads, SaaS, Rent</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Net Profit</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              pnl.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}>
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl font-black font-mono ${pnl.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ₹{pnl.netProfit.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>Net Margin: {pnl.netProfitMarginPercent.toFixed(1)}%</span>
          </div>
        </div>

        {/* Profit Margin Indicator */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Profit Margin</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-sky-600 font-mono">
            {pnl.netProfitMarginPercent.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>Post-Opex return</span>
          </div>
        </div>
      </div>

      {/* 3. Liquidity, Accounts & Partner Capital Summary (Secondary 6-Card Grid) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Cash Balance */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Cash in Hand</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">
            ₹{cashBalance.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400">Petty Cash & Vault</span>
        </div>

        {/* Bank Balance */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Bank Balance</span>
            <Landmark className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">
            ₹{bankBalance.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400">HDFC & ICICI Current A/Cs</span>
        </div>

        {/* Total Partner Capital */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Partner Capital</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">
            ₹{totalPartnerCapital.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400">4 Partners Initial + Addtl</span>
        </div>

        {/* Partner Withdrawals */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Partner Drawings</span>
            <ArrowUpRight className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">
            ₹{totalPartnerWithdrawals.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400">Profit Withdrawals</span>
        </div>

        {/* Accounts Receivable */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Gateway Settle</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">
            ₹{gatewayBalance.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400">Razorpay T+2 in transit</span>
        </div>

        {/* Accounts Payable */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Pending Bills</span>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">
            ₹{accountsPayable.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400">{pendingApprovalsCount} Unapproved Bills</span>
        </div>
      </div>

      {/* 4. Visual Charts Section: P&L Visualizer & Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue & Profit Waterfall */}
        <div className="lg:col-span-2 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-red-600" />
                <span>Profit & Loss Structure (Waterfall)</span>
              </h3>
              <p className="text-xs text-slate-500">Breakdown of gross revenue retention after COGS and operations</p>
            </div>
            <button
              onClick={() => onNavigateToTab('pnl')}
              className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
            >
              Full P&L Report →
            </button>
          </div>

          <div className="space-y-4 pt-1">
            {/* Visual Waterfall Bar */}
            <div className="h-6 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              <div 
                className="bg-emerald-500 h-full transition-all" 
                style={{ width: `${pnl.netRevenue > 0 ? (pnl.netProfit / pnl.netRevenue) * 100 : 0}%` }}
                title={`Net Profit: ₹${pnl.netProfit.toLocaleString('en-IN')}`}
              />
              <div 
                className="bg-rose-400 h-full transition-all" 
                style={{ width: `${pnl.netRevenue > 0 ? (pnl.operatingExpenses.total / pnl.netRevenue) * 100 : 0}%` }}
                title={`Operating Expenses: ₹${pnl.operatingExpenses.total.toLocaleString('en-IN')}`}
              />
              <div 
                className="bg-amber-400 h-full transition-all" 
                style={{ width: `${pnl.netRevenue > 0 ? (pnl.cogs.total / pnl.netRevenue) * 100 : 0}%` }}
                title={`COGS: ₹${pnl.cogs.total.toLocaleString('en-IN')}`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs font-medium text-slate-600 gap-2">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                Net Profit: <strong className="font-mono text-slate-900 font-bold">₹{pnl.netProfit.toLocaleString('en-IN')}</strong> ({pnl.netProfitMarginPercent.toFixed(1)}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
                Opex: <strong className="font-mono text-slate-900 font-bold">₹{pnl.operatingExpenses.total.toLocaleString('en-IN')}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                COGS: <strong className="font-mono text-slate-900 font-bold">₹{pnl.cogs.total.toLocaleString('en-IN')}</strong>
              </span>
            </div>

            {/* Itemized Comparison Bars */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">1. Gross Revenue</span>
                <span className="font-mono font-bold text-slate-900">₹{pnl.grossRevenue.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium pl-3">↳ Less COGS (Fabric, Print, Pack)</span>
                <span className="font-mono font-bold text-rose-600">- ₹{pnl.cogs.total.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-lg font-semibold">
                <span className="text-slate-800">2. Gross Profit</span>
                <span className="font-mono text-slate-900">₹{pnl.grossProfit.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium pl-3">↳ Less Operating Expenses</span>
                <span className="font-mono font-bold text-rose-600">- ₹{pnl.operatingExpenses.total.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-900 p-2 rounded-lg font-bold">
                <span>3. Net Business Profit Available for Partner Distribution</span>
                <span className="font-mono text-emerald-700">₹{pnl.netProfit.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Partner Equity & Profit Share Breakdown */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Partner Profit Allocation</span>
              </h3>
              <p className="text-xs text-slate-500">Configured profit-sharing ratio distribution</p>
            </div>
            <button
              onClick={onOpenPartnerConfig}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
            >
              Configure %
            </button>
          </div>

          <div className="space-y-3">
            {partnerSummaries.map((pSummary) => (
              <div 
                key={pSummary.partner.id} 
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{pSummary.partner.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 font-semibold">
                      {pSummary.partner.ownershipPercentage}%
                    </span>
                  </div>
                  <span className="font-mono font-bold text-emerald-700 text-xs">
                    +₹{pSummary.profitAllocated.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Current Balance: <strong className="font-mono text-slate-800">₹{pSummary.currentBalance.toLocaleString('en-IN')}</strong></span>
                  <span>Drawings: ₹{pSummary.withdrawals.toLocaleString('en-IN')}</span>
                </div>

                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full rounded-full" 
                    style={{ width: `${pSummary.partner.ownershipPercentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 text-center">
            <button
              onClick={() => onNavigateToTab('partners')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              View Detailed Partner Ledgers →
            </button>
          </div>
        </div>
      </div>

      {/* 5. Expense Categories Quick Breakdown */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-600" />
              <span>Expenditure by Core Department</span>
            </h3>
            <p className="text-xs text-slate-500">Actual expenses recorded from verified vendor invoices and bank debits</p>
          </div>
          <button
            onClick={() => onNavigateToTab('expenses')}
            className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
          >
            All Expenses Ledger →
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Fabric Procurement</span>
            <span className="text-sm font-bold font-mono text-slate-900 block mt-1">₹{pnl.cogs.fabric.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">COGS Direct</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Printing & Pigments</span>
            <span className="text-sm font-bold font-mono text-slate-900 block mt-1">₹{pnl.cogs.printing.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">COGS Direct</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Packaging & Tags</span>
            <span className="text-sm font-bold font-mono text-slate-900 block mt-1">₹{pnl.cogs.packaging.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">COGS Direct</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Shipping & Couriers</span>
            <span className="text-sm font-bold font-mono text-slate-900 block mt-1">₹{pnl.operatingExpenses.shipping.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-blue-600 font-semibold block mt-0.5">Opex Logistics</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Ads & Marketing</span>
            <span className="text-sm font-bold font-mono text-slate-900 block mt-1">₹{(pnl.operatingExpenses.advertising + pnl.operatingExpenses.marketing).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-purple-600 font-semibold block mt-0.5">Meta & Growth</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Warehouse Rent</span>
            <span className="text-sm font-bold font-mono text-slate-900 block mt-1">₹{pnl.operatingExpenses.rent.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">Facility</span>
          </div>
        </div>
      </div>
    </div>
  );
};
