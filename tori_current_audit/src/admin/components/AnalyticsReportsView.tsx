import React, { useState } from 'react';
import { useAdmin } from '../AdminDataContext';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  DollarSign,
  ShoppingBag,
  Package,
} from 'lucide-react';

export const AnalyticsReportsView: React.FC = () => {
  const { orders, inventory, showToast, setCurrentView } = useAdmin();

  const [reportType, setReportType] = useState<'SALES' | 'ORDERS' | 'INVENTORY' | 'GST'>('SALES');

  // Trigger real CSV download
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `TORIWEAR_${reportType}_REPORT.csv`;

    if (reportType === 'SALES' || reportType === 'ORDERS') {
      headers = ['Order Number', 'Date', 'Customer', 'Items Count', 'Payment Method', 'Payment Status', 'Shipping Status', 'Gross Amount (INR)'];
      rows = orders.map(o => [
        o.orderNumber,
        o.date,
        `"${o.customerName}"`,
        o.items.length,
        o.paymentMethod,
        o.paymentStatus,
        o.shippingStatus,
        o.total
      ]);
    } else if (reportType === 'INVENTORY') {
      headers = ['Product Name', 'SKU', 'Size', 'Color', 'Available Stock', 'Status', 'Reserved Units'];
      rows = inventory.map(i => [
        `"${i.productName}"`,
        i.sku,
        i.size,
        i.colorName,
        i.availableStock,
        i.status,
        i.reservedStock
      ]);
    } else if (reportType === 'GST') {
      headers = ['Invoice Number', 'Date', 'Customer GST/Name', 'State', 'Taxable Value (INR)', 'CGST 2.5%', 'SGST 2.5%', 'Total Invoice (INR)'];
      rows = orders.map(o => {
        const taxable = Math.round(o.total * 0.952);
        const taxHalf = Math.round((o.total - taxable) / 2);
        return [
          `INV-${o.orderNumber}`,
          o.date,
          `"${o.customerName}"`,
          o.shippingAddress.state,
          taxable,
          taxHalf,
          taxHalf,
          o.total
        ];
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${filename} successfully.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <span>Business Analytics, GST Tax Audit & CSV Reports</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Download financial ledgers, inventory velocity, and monthly Indian GST tax schedules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentView('REPORTS')}
            className="px-3.5 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Master Reports Hub (All 20 Modules) →</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 shadow-md shadow-red-600/20 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Clean CSV</span>
          </button>
        </div>
      </div>

      {/* Select Report Mode */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'SALES', label: 'Sales & Revenue', icon: DollarSign, sub: 'Daily gross & net sales' },
          { key: 'ORDERS', label: 'Order Dispatches', icon: ShoppingBag, sub: 'Fulfillment & returns' },
          { key: 'INVENTORY', label: 'Inventory Velocity', icon: Package, sub: 'Low stock & turnover' },
          { key: 'GST', label: 'GST Tax Schedule', icon: FileSpreadsheet, sub: 'GSTR-1 HSN breakdown' },
        ].map((rep) => {
          const Icon = rep.icon;
          const isSel = reportType === rep.key;
          return (
            <div
              key={rep.key}
              onClick={() => setReportType(rep.key as any)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                isSel
                  ? 'bg-red-600/10 border-red-500 text-white shadow-md'
                  : 'bg-[#14141c] border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${isSel ? 'text-red-500' : 'text-neutral-500'}`} />
                <span className="font-bold text-xs">{rep.label}</span>
              </div>
              <div className="text-[10px] text-neutral-500">{rep.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Report Data Preview Table */}
      <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white">{reportType} REPORT PREVIEW</h3>
            <p className="text-xs text-neutral-400">All data generated directly from live system storage</p>
          </div>
          <span className="font-mono text-xs text-neutral-400">
            Export Format: UTF-8 RFC 4180 CSV
          </span>
        </div>

        {reportType === 'GST' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300 font-mono">
              <thead className="bg-[#181824] text-neutral-400 text-[10px] uppercase border-b border-neutral-800">
                <tr>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">State</th>
                  <th className="p-3 text-right">Taxable Val</th>
                  <th className="p-3 text-right">CGST (2.5%)</th>
                  <th className="p-3 text-right">SGST (2.5%)</th>
                  <th className="p-3 text-right">Total Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {orders.map((o) => {
                  const taxable = Math.round(o.total * 0.952);
                  const taxHalf = Math.round((o.total - taxable) / 2);
                  return (
                    <tr key={o.orderId} className="hover:bg-neutral-800/30">
                      <td className="p-3 text-red-400">INV-{o.orderNumber}</td>
                      <td className="p-3 text-neutral-400">{o.date}</td>
                      <td className="p-3 text-white font-sans">{o.customerName}</td>
                      <td className="p-3 text-neutral-300 font-sans">{o.shippingAddress.state}</td>
                      <td className="p-3 text-right">₹{taxable}</td>
                      <td className="p-3 text-right">₹{taxHalf}</td>
                      <td className="p-3 text-right">₹{taxHalf}</td>
                      <td className="p-3 text-right font-bold text-white">₹{o.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300 font-mono">
              <thead className="bg-[#181824] text-neutral-400 text-[10px] uppercase border-b border-neutral-800">
                <tr>
                  <th className="p-3">Record #</th>
                  <th className="p-3">Timestamp / Created</th>
                  <th className="p-3">Entity</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Gross Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {orders.map((o) => (
                  <tr key={o.orderId} className="hover:bg-neutral-800/30">
                    <td className="p-3 text-red-400">{o.orderNumber}</td>
                    <td className="p-3 text-neutral-400">{o.date}</td>
                    <td className="p-3 text-white font-sans">{o.customerName}</td>
                    <td className="p-3 text-emerald-400">{o.shippingStatus}</td>
                    <td className="p-3 text-right font-bold text-white">₹{o.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
