import React, { useState } from 'react';
import { useAdmin } from '../AdminDataContext';
import { Truck, RotateCcw, Sliders } from 'lucide-react';
import { LogisticsPartnersManager } from './logistics/LogisticsPartnersManager';

export const ShippingReturnsView: React.FC = () => {
  const { returnRequests, processReturnRequest } = useAdmin();

  const [activeTab, setActiveTab] = useState<'RETURNS' | 'SHIPMENTS' | 'LOGISTICS_PARTNERS'>('LOGISTICS_PARTNERS');
  const [searchQuery] = useState('');

  const filteredReturns = returnRequests.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = r.orderNumber.toLowerCase().includes(q) ||
                    r.customerName.toLowerCase().includes(q) ||
                    r.productName.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-sky-500" />
            <span>Shipping Logistics & Reverse Returns QC Center</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Courier API integrations (Delhivery, Bluedart, Shadowfax), tracking AWBs & automated reverse pickups.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
            Active Returns: <strong className="text-white">{returnRequests.length}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
            Delhivery API: <strong>Connected</strong>
          </span>
        </div>
      </div>

      {/* Switcher */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('LOGISTICS_PARTNERS')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'LOGISTICS_PARTNERS' 
              ? 'bg-red-600 text-white shadow-sm' 
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Logistics Partners API (8 Integrated Carriers)</span>
        </button>

        <button
          onClick={() => setActiveTab('RETURNS')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'RETURNS' 
              ? 'bg-red-600 text-white shadow-sm' 
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Customer Returns & Exchanges ({returnRequests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('SHIPMENTS')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'SHIPMENTS' 
              ? 'bg-red-600 text-white shadow-sm' 
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Outbound Courier Pipelines</span>
        </button>
      </div>

      {activeTab === 'LOGISTICS_PARTNERS' ? (
        <LogisticsPartnersManager />
      ) : activeTab === 'RETURNS' ? (
        <div className="space-y-4">
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-[#181824] text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-800 font-mono">
                  <tr>
                    <th className="p-3.5 pl-4">Return ID</th>
                    <th className="p-3.5">Order #</th>
                    <th className="p-3.5">Customer</th>
                    <th className="p-3.5">Product & Size</th>
                    <th className="p-3.5">Return Reason</th>
                    <th className="p-3.5">Amount</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right pr-4">Workflow Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-sans">
                  {filteredReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="p-3.5 pl-4 font-mono font-bold text-red-400">
                        {ret.id}
                      </td>
                      <td className="p-3.5 font-mono text-neutral-300">
                        {ret.orderNumber}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-white">{ret.customerName}</div>
                        <div className="text-[10px] text-neutral-500 font-mono">{ret.date}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-white">{ret.productName}</div>
                        <div className="text-[10px] text-neutral-400 font-mono">Size: {ret.size}</div>
                      </td>
                      <td className="p-3.5 text-neutral-300">
                        <span className="font-medium text-amber-400">{ret.reason}</span>
                        {ret.notes && <div className="text-[10px] text-neutral-500 mt-0.5">{ret.notes}</div>}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-white">
                        ₹{ret.refundAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                          ret.status === 'REFUNDED'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : ret.status === 'QC_PASSED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : ret.status === 'PICKUP_SCHEDULED'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : ret.status === 'APPROVED'
                            ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                            : 'bg-yellow-500/10 text-yellow-400'
                        }`}>
                          {ret.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {ret.status === 'REQUESTED' && (
                            <button
                              onClick={() => processReturnRequest(ret.id, 'APPROVED')}
                              className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-medium text-[11px] cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {ret.status === 'APPROVED' && (
                            <button
                              onClick={() => processReturnRequest(ret.id, 'PICKUP_SCHEDULED')}
                              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] cursor-pointer"
                            >
                              Schedule Pickup
                            </button>
                          )}
                          {ret.status === 'PICKUP_SCHEDULED' && (
                            <button
                              onClick={() => processReturnRequest(ret.id, 'QC_PASSED')}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] cursor-pointer"
                            >
                              Pass QC
                            </button>
                          )}
                          {ret.status === 'QC_PASSED' && (
                            <button
                              onClick={() => processReturnRequest(ret.id, 'REFUNDED')}
                              className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium text-[11px] cursor-pointer"
                            >
                              Issue Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* OUTBOUND SHIPMENTS PIPELINE */
        <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-white text-sm">Active Couriers & Aggregators</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">Delhivery Surface & Air</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">ACTIVE</span>
              </div>
              <p className="text-xs text-neutral-400">Avg Delivery: 2.8 Days across Metros</p>
              <div className="text-xs text-neutral-500 font-mono">Serviceability: 28,000+ Pincodes</div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">Bluedart Express</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">ACTIVE</span>
              </div>
              <p className="text-xs text-neutral-400">Air Express Priority for Tier 1</p>
              <div className="text-xs text-neutral-500 font-mono">Serviceability: 19,000+ Pincodes</div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">Shadowfax Reverse QC</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">ACTIVE</span>
              </div>
              <p className="text-xs text-neutral-400">Doorstep QC & Instant Reverse Dispatch</p>
              <div className="text-xs text-neutral-500 font-mono">Serviceability: 9,500+ Pincodes</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
