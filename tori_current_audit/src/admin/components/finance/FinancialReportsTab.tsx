import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  BarChart3,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Table,
  Building2,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

interface ReportConfig {
  id: string;
  title: string;
  category: string;
  description: string;
  icon: any;
}

export const FinancialReportsTab: React.FC = () => {
  const { 
    transactions, 
    accountsWithBalances, 
    partners, 
    partnerSummaries, 
    currentPnL, 
    executiveKPIs
  } = useFinance();

  const [activeReportId, setActiveReportId] = useState<string>('pnl');

  const reportsList: ReportConfig[] = [
    {
      id: 'pnl',
      title: 'Profit & Loss Statement (P&L)',
      category: 'Financial Performance',
      description: 'Comprehensive statement of revenues, Cost of Goods Sold (COGS), operating expenses, and net profit margins.',
      icon: BarChart3,
    },
    {
      id: 'partner_statement',
      title: 'Partner Statement & Capital Accounts',
      category: 'Equity & Ownership',
      description: 'Individual ledgers for each of the 4 partners tracking capital injected, profit distributions, and current balances.',
      icon: Users,
    },
    {
      id: 'expense_breakdown',
      title: 'Expense Audit & COGS Breakdown',
      category: 'Expenditures',
      description: 'Itemized operational and production cost ledger categorized by manufacturing, fabric, printing, marketing, and logistics.',
      icon: ArrowDownRight,
    },
    {
      id: 'income_reconciliation',
      title: 'Income & Order Reconciliation',
      category: 'Revenues',
      description: 'Audit report linking storefront sales, customer order numbers, wholesale B2B revenues, and settlement accounts.',
      icon: ArrowUpRight,
    },
    {
      id: 'cash_flow',
      title: 'Cash Flow Statement',
      category: 'Treasury & Liquidity',
      description: 'Operating, investing, and financing cash flows across bank, cash vault, and payment gateway escrow accounts.',
      icon: Wallet,
    },
    {
      id: 'capital_accounts',
      title: 'Capital Account & Contributions Summary',
      category: 'Equity & Ownership',
      description: 'Chronological equity summary of initial partner capital subscriptions and subsequent equity changes.',
      icon: Building2,
    },
    {
      id: 'transaction_ledger',
      title: 'Master Transaction Ledger',
      category: 'General Ledger',
      description: 'Complete double-entry financial journal with transaction numbers, accounts, approvals, and reference IDs.',
      icon: Table,
    },
    {
      id: 'monthly_summary',
      title: 'Monthly Financial Summary',
      category: 'Executive Summary',
      description: 'High-level executive briefing with month-over-month revenues, operational expenditures, and liquid reserves.',
      icon: FileText,
    },
  ];

  // Helper to trigger CSV download
  const handleDownloadCSV = (reportId: string) => {
    let rows: (string | number)[][] = [];
    const dateStr = new Date().toISOString().slice(0, 10);

    if (reportId === 'pnl') {
      rows = [
        ['TORIWEAR — PROFIT & LOSS REPORT'],
        ['Generated Date', dateStr],
        ['Period', currentPnL.period],
        [],
        ['Metric', 'Amount (INR)'],
        ['Gross Revenue', currentPnL.grossRevenue],
        ['Discounts', currentPnL.salesDiscounts],
        ['Net Revenue', currentPnL.netRevenue],
        ['Total COGS', currentPnL.cogs.total],
        ['Fabric Sourcing', currentPnL.cogs.fabric],
        ['Screen Printing', currentPnL.cogs.printing],
        ['CMT & Manufacturing', currentPnL.cogs.manufacturing],
        ['Packaging & Boxes', currentPnL.cogs.packaging],
        ['Gross Profit', currentPnL.grossProfit],
        ['Gross Margin %', `${currentPnL.grossMarginPercent.toFixed(1)}%`],
        ['Total OPEX', currentPnL.operatingExpenses.total],
        ['Shipping & Courier', currentPnL.operatingExpenses.shipping],
        ['Advertising', currentPnL.operatingExpenses.advertising],
        ['Marketing', currentPnL.operatingExpenses.marketing],
        ['Salaries', currentPnL.operatingExpenses.salaries],
        ['Rent', currentPnL.operatingExpenses.rent],
        ['Software & Cloud', currentPnL.operatingExpenses.software + currentPnL.operatingExpenses.websiteDomain],
        ['Gateway Fees', currentPnL.operatingExpenses.gatewayFees],
        ['Taxes & GST', currentPnL.operatingExpenses.taxes],
        ['Net Profit', currentPnL.netProfit],
        ['Net Margin %', `${currentPnL.netProfitMarginPercent.toFixed(1)}%`],
        [],
        ['PARTNER PROFIT ALLOCATIONS'],
        ...currentPnL.partnerAllocations.map(p => [p.partnerName, `${p.ownershipPercentage}%`, p.allocatedAmount])
      ];
    } else if (reportId === 'partner_statement' || reportId === 'capital_accounts') {
      rows = [
        ['TORIWEAR — PARTNER STATEMENT & CAPITAL ACCOUNTS'],
        ['Generated Date', dateStr],
        [],
        ['Partner Name', 'Ownership %', 'Initial Capital', 'Addl Contributions', 'Withdrawals', 'Profit Share', 'Current Balance'],
        ...partnerSummaries.map(s => [
          s.partner.name,
          `${s.partner.ownershipPercentage}%`,
          s.capitalInvested,
          s.additionalContributions,
          s.withdrawals,
          s.profitAllocated,
          s.currentBalance
        ])
      ];
    } else if (reportId === 'expense_breakdown') {
      const expenses = transactions.filter(t => t.type === 'EXPENSE' || t.type === 'REFUND');
      rows = [
        ['TORIWEAR — EXPENSE AUDIT REPORT'],
        ['Generated Date', dateStr],
        [],
        ['Date', 'TXN #', 'Category', 'Description', 'Account', 'Status', 'Amount (INR)'],
        ...expenses.map(t => [
          t.date,
          t.transactionNumber,
          t.category,
          `"${t.description.replace(/"/g, '""')}"`,
          accountsWithBalances.find(a => a.id === t.paymentAccountId)?.name || 'Direct',
          t.status,
          t.amount
        ])
      ];
    } else if (reportId === 'income_reconciliation') {
      const incomes = transactions.filter(t => t.type === 'INCOME');
      rows = [
        ['TORIWEAR — REVENUE & INCOME RECONCILIATION'],
        ['Generated Date', dateStr],
        [],
        ['Date', 'TXN #', 'Category', 'Order ID', 'Reference', 'Account', 'Status', 'Amount (INR)'],
        ...incomes.map(t => [
          t.date,
          t.transactionNumber,
          t.category,
          t.orderId || 'N/A',
          t.referenceId || 'N/A',
          accountsWithBalances.find(a => a.id === t.paymentAccountId)?.name || 'Gateway',
          t.status,
          t.amount
        ])
      ];
    } else {
      // General Transaction Ledger
      rows = [
        ['TORIWEAR — MASTER TRANSACTION LEDGER'],
        ['Generated Date', dateStr],
        [],
        ['Date', 'TXN #', 'Type', 'Category', 'Description', 'Account', 'Partner', 'Status', 'Amount (INR)'],
        ...transactions.map(t => [
          t.date,
          t.transactionNumber,
          t.type,
          t.category,
          `"${t.description.replace(/"/g, '""')}"`,
          accountsWithBalances.find(a => a.id === t.paymentAccountId)?.name || 'Direct',
          partners.find(p => p.id === t.partnerId)?.name || 'N/A',
          t.status,
          t.amount
        ])
      ];
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `toriwear_${reportId}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedReport = reportsList.find(r => r.id === activeReportId) || reportsList[0];

  return (
    <div className="space-y-6">
      {/* 1. Header with Stats & Actions */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Financial Reports & Statements</h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                8 GAAP & GST Compliant Formats
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Instant PDF-ready print sheets and CSV data exports backed by verified journal entries
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadCSV(activeReportId)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Selected CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
          >
            <Printer className="w-3.5 h-3.5" style={{ color: '#ffffff' }} />
            <span style={{ color: '#ffffff' }}>Print Report</span>
          </button>
        </div>
      </div>

      {/* 2. Report Selector Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportsList.map((rep) => {
          const Icon = rep.icon;
          const isSelected = activeReportId === rep.id;

          return (
            <div
              key={rep.id}
              onClick={() => setActiveReportId(rep.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-red-50/40 border-red-500 ring-2 ring-red-500/20 shadow-md'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isSelected ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">{rep.category}</span>
                </div>

                <h3 className="text-xs font-bold text-slate-900 mt-2.5">{rep.title}</h3>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {rep.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className={`font-semibold ${isSelected ? 'text-red-600' : 'text-slate-600'}`}>
                  {isSelected ? 'Viewing' : 'Select'}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadCSV(rep.id);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-slate-900 transition-colors"
                  title="Download CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Live Preview of Selected Report */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-white uppercase" style={{ color: '#ffffff', backgroundColor: '#0f172a' }}>
                Preview Sheet
              </span>
              <h3 className="text-base font-bold text-slate-900">{selectedReport?.title || 'Financial Report'}</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{selectedReport?.description || ''}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">
              As of: {new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Dynamic preview content */}
        {activeReportId === 'pnl' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] text-slate-500">Net Revenue</span>
                <div className="text-lg font-bold font-mono text-slate-900 mt-1">₹{currentPnL.netRevenue.toLocaleString('en-IN')}</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] text-slate-500">Gross Margin</span>
                <div className="text-lg font-bold font-mono text-emerald-600 mt-1">{currentPnL.grossMarginPercent.toFixed(1)}%</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] text-slate-500">Net Bottom Line</span>
                <div className="text-lg font-bold font-mono text-slate-900 mt-1">₹{currentPnL.netProfit.toLocaleString('en-IN')}</div>
              </div>
            </div>
            <p className="text-xs text-slate-500 text-center">
              Use the Profit & Loss tab for complete line-item breakdown or click "Export Selected CSV" above to download the full tabular spreadsheet.
            </p>
          </div>
        )}

        {(activeReportId === 'partner_statement' || activeReportId === 'capital_accounts') && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] font-mono">
                <tr>
                  <th className="py-2.5 px-4">Partner</th>
                  <th className="py-2.5 px-4">Equity Share</th>
                  <th className="py-2.5 px-4 text-right">Capital Injected</th>
                  <th className="py-2.5 px-4 text-right">Drawings</th>
                  <th className="py-2.5 px-4 text-right">Profit Allocated</th>
                  <th className="py-2.5 px-4 text-right">Current Account Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {partnerSummaries.map(s => (
                  <tr key={s.partner.id}>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-900">{s.partner.name}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-700">{s.partner.ownershipPercentage}%</td>
                    <td className="py-2.5 px-4 text-right text-slate-900">₹{(s.capitalInvested + s.additionalContributions).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-4 text-right text-amber-600">-₹{s.withdrawals.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-4 text-right text-emerald-600">+₹{s.profitAllocated.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{s.currentBalance.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeReportId === 'cash_flow' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase font-mono">1. Operating Activities</h4>
              <div className="text-xs text-slate-600 flex justify-between">
                <span>Collections from Customers</span>
                <span className="font-mono text-emerald-600 font-semibold">+₹{currentPnL.netRevenue.toLocaleString('en-IN')}</span>
              </div>
              <div className="text-xs text-slate-600 flex justify-between">
                <span>Vendor & Operational Payouts</span>
                <span className="font-mono text-rose-600 font-semibold">-₹{currentPnL.totalExpenses.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase font-mono">2. Financing Activities</h4>
              <div className="text-xs text-slate-600 flex justify-between">
                <span>Partner Capital Infusions</span>
                <span className="font-mono text-emerald-600 font-semibold">+₹{executiveKPIs.totalPartnerCapital.toLocaleString('en-IN')}</span>
              </div>
              <div className="text-xs text-slate-600 flex justify-between">
                <span>Partner Profit Drawings</span>
                <span className="font-mono text-amber-600 font-semibold">-₹{executiveKPIs.totalPartnerWithdrawals.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase font-mono">3. Closing Liquid Balances</h4>
              <div className="text-xs text-slate-600 flex justify-between">
                <span>Bank Accounts</span>
                <span className="font-mono font-semibold text-slate-900">₹{executiveKPIs.bankBalance.toLocaleString('en-IN')}</span>
              </div>
              <div className="text-xs text-slate-600 flex justify-between">
                <span>Cash & Gateways</span>
                <span className="font-mono font-semibold text-slate-900">₹{(executiveKPIs.cashBalance + executiveKPIs.gatewayBalance).toLocaleString('en-IN')}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-bold text-emerald-600">
                <span>Total Liquidity</span>
                <span className="font-mono">₹{executiveKPIs.totalLiquid.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}

        {(activeReportId === 'expense_breakdown' || activeReportId === 'income_reconciliation' || activeReportId === 'transaction_ledger' || activeReportId === 'monthly_summary') && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-900">Ready to export.</span> This report contains {transactions.length} journal records and complete audit references.
            </div>
            <button
              onClick={() => handleDownloadCSV(activeReportId)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
            >
              <Download className="w-3.5 h-3.5" style={{ color: '#ffffff' }} />
              <span style={{ color: '#ffffff' }}>Download CSV File</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
