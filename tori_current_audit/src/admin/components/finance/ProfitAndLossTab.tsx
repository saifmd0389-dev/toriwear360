import React from 'react';
import {
  BarChart3,
  TrendingDown,
  Download,
  Printer,
  DollarSign,
  Users,
} from 'lucide-react';
import { useFinance, DateRangePreset } from '../../context/FinanceContext';

export const ProfitAndLossTab: React.FC = () => {
  const { 
    currentPnL, 
    datePreset, 
    setDatePreset
  } = useFinance();

  const presets: { id: DateRangePreset; label: string }[] = [
    { id: 'ALL', label: 'All Time' },
    { id: 'THIS_MONTH', label: 'This Month' },
    { id: 'LAST_MONTH', label: 'Last Month' },
    { id: 'THIS_QUARTER', label: 'This Quarter' },
    { id: 'FY25_26', label: 'FY 2025-26' },
  ];

  const { 
    period, 
    grossRevenue, 
    salesDiscounts, 
    netRevenue, 
    cogs, 
    grossProfit, 
    grossMarginPercent, 
    operatingExpenses, 
    otherExpenses, 
    operatingProfit, 
    netProfit, 
    netProfitMarginPercent, 
    partnerAllocations 
  } = currentPnL;

  const handleExportCSV = () => {
    const rows = [
      ['TORIWEAR — PROFIT & LOSS STATEMENT'],
      ['Period', period],
      ['Generated On', new Date().toLocaleString('en-IN')],
      [],
      ['LINE ITEM', 'AMOUNT (INR)', '% OF REVENUE'],
      ['Gross Revenue', grossRevenue, '100%'],
      ['Discounts & Allowances', salesDiscounts, '0%'],
      ['Net Revenue', netRevenue, '100%'],
      [],
      ['COST OF GOODS SOLD (COGS)'],
      ['Manufacturing', cogs.manufacturing, `${((cogs.manufacturing / (netRevenue || 1)) * 100).toFixed(1)}%`],
      ['Fabric Sourcing (240 GSM Combed)', cogs.fabric, `${((cogs.fabric / (netRevenue || 1)) * 100).toFixed(1)}%`],
      ['Screen / DTG / HD Printing', cogs.printing, `${((cogs.printing / (netRevenue || 1)) * 100).toFixed(1)}%`],
      ['Packaging & Boxes', cogs.packaging, `${((cogs.packaging / (netRevenue || 1)) * 100).toFixed(1)}%`],
      ['Other Production Costs', cogs.other, `${((cogs.other / (netRevenue || 1)) * 100).toFixed(1)}%`],
      ['TOTAL COGS', cogs.total, `${((cogs.total / (netRevenue || 1)) * 100).toFixed(1)}%`],
      [],
      ['GROSS PROFIT', grossProfit, `${grossMarginPercent.toFixed(1)}%`],
      [],
      ['OPERATING EXPENSES (OPEX)'],
      ['Shipping & Logistics', operatingExpenses.shipping, ''],
      ['Marketing & Campaigns', operatingExpenses.marketing, ''],
      ['Digital Advertising (Meta / Google)', operatingExpenses.advertising, ''],
      ['Website & Domain Infrastructure', operatingExpenses.websiteDomain, ''],
      ['Software, Cloud & Tools', operatingExpenses.software, ''],
      ['Salaries & Freelance', operatingExpenses.salaries, ''],
      ['Studio / Warehouse Rent', operatingExpenses.rent, ''],
      ['Payment Gateway Fees (Razorpay / UPI)', operatingExpenses.gatewayFees, ''],
      ['Taxes & Statutory Filings', operatingExpenses.taxes, ''],
      ['Miscellaneous Supplies', operatingExpenses.miscellaneous, ''],
      ['TOTAL OPERATING EXPENSES', operatingExpenses.total, `${((operatingExpenses.total / (netRevenue || 1)) * 100).toFixed(1)}%`],
      [],
      ['OPERATING PROFIT', operatingProfit, ''],
      ['Refunds & Customer Returns', otherExpenses.refunds, ''],
      ['Accounting Adjustments', otherExpenses.adjustments, ''],
      [],
      ['NET PROFIT / (LOSS)', netProfit, `${netProfitMarginPercent.toFixed(1)}%`],
      [],
      ['PARTNER PROFIT ALLOCATION (Strict Configured %)'],
      ...partnerAllocations.map(p => [p.partnerName, `${p.ownershipPercentage}%`, p.allocatedAmount])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `toriwear_pnl_${period.replace(/\s+/g, '_').toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Period Selectors */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Profit & Loss Statement (P&L)</h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                Accrual & Cash Ledger
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated waterfall from gross revenue to net profit and partner allocations
            </p>
          </div>
        </div>

        {/* Date Filter & Export */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
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
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
          >
            <Printer className="w-3.5 h-3.5" style={{ color: '#ffffff' }} />
            <span style={{ color: '#ffffff' }}>Print Report</span>
          </button>
        </div>
      </div>

      {/* 2. Key Waterfall Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Net Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-2">
            ₹{netRevenue.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">From approved orders & B2B</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Cost of Goods (COGS)</span>
            <TrendingDown className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-600 mt-2">
            ₹{cogs.total.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{((cogs.total / (netRevenue || 1)) * 100).toFixed(1)}% of revenue</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Gross Profit</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              {grossMarginPercent.toFixed(1)}% Margin
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-2">
            ₹{grossProfit.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Revenue minus direct production</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Net Profit</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold border ${
              netProfit >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {netProfitMarginPercent.toFixed(1)}% Net Margin
            </span>
          </div>
          <div className={`text-xl font-bold font-mono mt-2 ${
            netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            ₹{netProfit.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Bottom line for partner distribution</p>
        </div>
      </div>

      {/* 3. Detailed P&L Statement Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Comprehensive Statement of Income</h3>
            <p className="text-xs text-slate-500 mt-0.5">Calculated in real-time from approved financial transactions</p>
          </div>
          <span className="text-xs font-mono text-slate-600 font-semibold bg-slate-100 px-3 py-1 rounded-lg">
            Period: {period}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] font-mono">
              <tr>
                <th className="py-3 px-6">Account Category / Line Item</th>
                <th className="py-3 px-6 text-right">Subtotal (INR)</th>
                <th className="py-3 px-6 text-right">Total (INR)</th>
                <th className="py-3 px-6 text-right">% of Net Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* REVENUE SECTION */}
              <tr className="bg-slate-50/50 font-bold text-slate-900">
                <td className="py-3 px-6 uppercase text-[11px] tracking-wider text-slate-700" colSpan={4}>
                  1. Revenue & Inflows
                </td>
              </tr>
              <tr className="hover:bg-slate-50/40">
                <td className="py-2.5 px-6 pl-10 text-slate-700">Gross Sales (D2C Storefront + Pop-ups)</td>
                <td className="py-2.5 px-6 text-right font-mono text-slate-900">₹{grossRevenue.toLocaleString('en-IN')}</td>
                <td className="py-2.5 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2.5 px-6 text-right font-mono text-slate-500">100.0%</td>
              </tr>
              {salesDiscounts > 0 && (
                <tr className="hover:bg-slate-50/40">
                  <td className="py-2.5 px-6 pl-10 text-slate-700">Less: Promotional Discounts & Coupons</td>
                  <td className="py-2.5 px-6 text-right font-mono text-rose-600">-₹{salesDiscounts.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-6 text-right font-mono text-slate-400">—</td>
                  <td className="py-2.5 px-6 text-right font-mono text-slate-500">
                    -{((salesDiscounts / (grossRevenue || 1)) * 100).toFixed(1)}%
                  </td>
                </tr>
              )}
              <tr className="bg-emerald-50/30 font-semibold">
                <td className="py-2.5 px-6 pl-8 text-emerald-900">NET REVENUE</td>
                <td className="py-2.5 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2.5 px-6 text-right font-mono text-emerald-700 font-bold">
                  ₹{netRevenue.toLocaleString('en-IN')}
                </td>
                <td className="py-2.5 px-6 text-right font-mono text-emerald-700 font-bold">100.0%</td>
              </tr>

              {/* COGS SECTION */}
              <tr className="bg-slate-50/50 font-bold text-slate-900">
                <td className="py-3 px-6 uppercase text-[11px] tracking-wider text-slate-700" colSpan={4}>
                  2. Cost of Goods Sold (COGS)
                </td>
              </tr>
              <tr className="hover:bg-slate-50/40">
                <td className="py-2 px-6 pl-10 text-slate-700">Fabric Sourcing (240 GSM Combed Cotton, Tirupur)</td>
                <td className="py-2 px-6 text-right font-mono text-slate-900">₹{cogs.fabric.toLocaleString('en-IN')}</td>
                <td className="py-2 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2 px-6 text-right font-mono text-slate-500">{((cogs.fabric / (netRevenue || 1)) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="hover:bg-slate-50/40">
                <td className="py-2 px-6 pl-10 text-slate-700">Printing & Inks (Plastisol, Discharge, HD Puff)</td>
                <td className="py-2 px-6 text-right font-mono text-slate-900">₹{cogs.printing.toLocaleString('en-IN')}</td>
                <td className="py-2 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2 px-6 text-right font-mono text-slate-500">{((cogs.printing / (netRevenue || 1)) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="hover:bg-slate-50/40">
                <td className="py-2 px-6 pl-10 text-slate-700">Garment Stitching, Tailoring & CMT</td>
                <td className="py-2 px-6 text-right font-mono text-slate-900">₹{cogs.manufacturing.toLocaleString('en-IN')}</td>
                <td className="py-2 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2 px-6 text-right font-mono text-slate-500">{((cogs.manufacturing / (netRevenue || 1)) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="hover:bg-slate-50/40">
                <td className="py-2 px-6 pl-10 text-slate-700">Premium Packaging, Custom Boxes & Hangtags</td>
                <td className="py-2 px-6 text-right font-mono text-slate-900">₹{cogs.packaging.toLocaleString('en-IN')}</td>
                <td className="py-2 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2 px-6 text-right font-mono text-slate-500">{((cogs.packaging / (netRevenue || 1)) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="bg-amber-50/30 font-semibold">
                <td className="py-2.5 px-6 pl-8 text-amber-900">TOTAL COST OF GOODS SOLD</td>
                <td className="py-2.5 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2.5 px-6 text-right font-mono text-amber-700 font-bold">
                  ₹{cogs.total.toLocaleString('en-IN')}
                </td>
                <td className="py-2.5 px-6 text-right font-mono text-amber-700 font-bold">
                  {((cogs.total / (netRevenue || 1)) * 100).toFixed(1)}%
                </td>
              </tr>

              {/* GROSS PROFIT */}
              <tr className="bg-slate-100 font-bold text-slate-900 border-y border-slate-300">
                <td className="py-3 px-6 pl-6 uppercase text-slate-900">GROSS PROFIT</td>
                <td className="py-3 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-3 px-6 text-right font-mono text-emerald-700 font-bold text-sm">
                  ₹{grossProfit.toLocaleString('en-IN')}
                </td>
                <td className="py-3 px-6 text-right font-mono text-emerald-700 font-bold text-sm">
                  {grossMarginPercent.toFixed(1)}%
                </td>
              </tr>

              {/* OPERATING EXPENSES */}
              <tr className="bg-slate-50/50 font-bold text-slate-900">
                <td className="py-3 px-6 uppercase text-[11px] tracking-wider text-slate-700" colSpan={4}>
                  3. Operating Expenses (OPEX)
                </td>
              </tr>
              <tr className="hover:bg-slate-50/40">
                <td className="py-2 px-6 pl-10 text-slate-700">Courier & Shipping (Bluedart, Delhivery, Xpressbees)</td>
                <td className="py-2 px-6 text-right font-mono text-slate-900">₹{operatingExpenses.shipping.toLocaleString('en-IN')}</td>
                <td className="py-2 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2 px-6 text-right font-mono text-slate-500">{((operatingExpenses.shipping / (netRevenue || 1)) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="hover:bg-slate-50/40">
                <td className="py-2 px-6 pl-10 text-slate-700">Digital Ads (Meta Ads, Instagram, Google Search)</td>
                <td className="py-2 px-6 text-right font-mono text-slate-900">₹{operatingExpenses.advertising.toLocaleString('en-IN')}</td>
                <td className="py-2 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2 px-6 text-right font-mono text-slate-500">{((operatingExpenses.advertising / (netRevenue || 1)) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="hover:bg-slate-50/40">
                <td className="py-2 px-6 pl-10 text-slate-700">Creative Marketing, Photo Shoots & PR</td>
                <td className="py-2 px-6 text-right font-mono text-slate-900">₹{operatingExpenses.marketing.toLocaleString('en-IN')}</td>
                <td className="py-2 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2 px-6 text-right font-mono text-slate-500">{((operatingExpenses.marketing / (netRevenue || 1)) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="hover:bg-slate-50/40">
                <td className="py-2 px-6 pl-10 text-slate-700">Salaries, Contract Artists & Warehouse Staff</td>
                <td className="py-2 px-6 text-right font-mono text-slate-900">₹{operatingExpenses.salaries.toLocaleString('en-IN')}</td>
                <td className="py-2 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2 px-6 text-right font-mono text-slate-500">{((operatingExpenses.salaries / (netRevenue || 1)) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="hover:bg-slate-50/40">
                <td className="py-2 px-6 pl-10 text-slate-700">Studio & Fulfillment Warehouse Rent</td>
                <td className="py-2 px-6 text-right font-mono text-slate-900">₹{operatingExpenses.rent.toLocaleString('en-IN')}</td>
                <td className="py-2 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2 px-6 text-right font-mono text-slate-500">{((operatingExpenses.rent / (netRevenue || 1)) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="hover:bg-slate-50/40">
                <td className="py-2 px-6 pl-10 text-slate-700">Software, Cloud Hosting & Shopify Apps</td>
                <td className="py-2 px-6 text-right font-mono text-slate-900">
                  ₹{(operatingExpenses.software + operatingExpenses.websiteDomain).toLocaleString('en-IN')}
                </td>
                <td className="py-2 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2 px-6 text-right font-mono text-slate-500">
                  {(((operatingExpenses.software + operatingExpenses.websiteDomain) / (netRevenue || 1)) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr className="hover:bg-slate-50/40">
                <td className="py-2 px-6 pl-10 text-slate-700">Payment Gateway Merchant Fees (Razorpay / UPI MDR)</td>
                <td className="py-2 px-6 text-right font-mono text-slate-900">₹{operatingExpenses.gatewayFees.toLocaleString('en-IN')}</td>
                <td className="py-2 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2 px-6 text-right font-mono text-slate-500">{((operatingExpenses.gatewayFees / (netRevenue || 1)) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="hover:bg-slate-50/40">
                <td className="py-2 px-6 pl-10 text-slate-700">Taxes, GST Consultations & Banking Charges</td>
                <td className="py-2 px-6 text-right font-mono text-slate-900">₹{operatingExpenses.taxes.toLocaleString('en-IN')}</td>
                <td className="py-2 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2 px-6 text-right font-mono text-slate-500">{((operatingExpenses.taxes / (netRevenue || 1)) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="hover:bg-slate-50/40">
                <td className="py-2 px-6 pl-10 text-slate-700">Miscellaneous Office & Warehouse Consumables</td>
                <td className="py-2 px-6 text-right font-mono text-slate-900">₹{operatingExpenses.miscellaneous.toLocaleString('en-IN')}</td>
                <td className="py-2 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2 px-6 text-right font-mono text-slate-500">{((operatingExpenses.miscellaneous / (netRevenue || 1)) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="bg-rose-50/30 font-semibold">
                <td className="py-2.5 px-6 pl-8 text-rose-900">TOTAL OPERATING EXPENSES</td>
                <td className="py-2.5 px-6 text-right font-mono text-slate-400">—</td>
                <td className="py-2.5 px-6 text-right font-mono text-rose-700 font-bold">
                  ₹{operatingExpenses.total.toLocaleString('en-IN')}
                </td>
                <td className="py-2.5 px-6 text-right font-mono text-rose-700 font-bold">
                  {((operatingExpenses.total / (netRevenue || 1)) * 100).toFixed(1)}%
                </td>
              </tr>

              {/* OTHER EXPENSES */}
              {otherExpenses.total > 0 && (
                <>
                  <tr className="bg-slate-50/50 font-bold text-slate-900">
                    <td className="py-3 px-6 uppercase text-[11px] tracking-wider text-slate-700" colSpan={4}>
                      4. Returns & Adjustments
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/40">
                    <td className="py-2 px-6 pl-10 text-slate-700">Customer Return Refunds</td>
                    <td className="py-2 px-6 text-right font-mono text-slate-900">₹{otherExpenses.refunds.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-6 text-right font-mono text-slate-400">—</td>
                    <td className="py-2 px-6 text-right font-mono text-slate-500">{((otherExpenses.refunds / (netRevenue || 1)) * 100).toFixed(1)}%</td>
                  </tr>
                </>
              )}

              {/* NET PROFIT / (LOSS) */}
              <tr className="bg-slate-900 text-white font-bold text-sm" style={{ backgroundColor: '#0f172a' }}>
                <td className="py-4 px-6 uppercase tracking-wider" style={{ color: '#ffffff' }}>NET PROFIT / (LOSS)</td>
                <td className="py-4 px-6 text-right font-mono text-slate-400">—</td>
                <td className={`py-4 px-6 text-right font-mono text-base font-bold ${
                  netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  ₹{netProfit.toLocaleString('en-IN')}
                </td>
                <td className={`py-4 px-6 text-right font-mono text-base font-bold ${
                  netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {netProfitMarginPercent.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Partner Profit Allocation Breakdown */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-bold text-slate-900">Partner Profit Allocation</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Net Profit (₹{netProfit.toLocaleString('en-IN')}) distributed dynamically according to each partner's configured ownership percentage
            </p>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
            Total 100% Equity Pool
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {partnerAllocations.map(alloc => (
            <div key={alloc.partnerId} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{alloc.partnerName}</span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                    {alloc.ownershipPercentage}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Configured Equity Share</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200">
                <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Allocated Share</div>
                <div className={`text-base font-bold font-mono mt-0.5 ${
                  alloc.allocatedAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  ₹{alloc.allocatedAmount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
