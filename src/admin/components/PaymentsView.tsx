import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../AdminDataContext';
import {
  CreditCard,
  Search,
  RotateCcw,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Settings,
} from 'lucide-react';
import { getSessionToken } from '../services/platformService';

interface BackendPaymentTransaction {
  id: string;
  orderId: string;
  orderNumber: string;
  gateway: 'RAZORPAY' | 'CASHFREE' | 'STRIPE' | 'CUSTOM_UPI';
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  amountPaise: number;
  currency: string;
  status: 'INITIATED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
  method: 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'NET_BANKING' | 'WALLET' | 'COD';
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  refundId?: string;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: string;
  gatewayFee?: number;
  gatewayTax?: number;
  failureReason?: string;
  ipAddress?: string;
  createdAt: string;
  updatedAt: string;
}

interface BackendPaymentStats {
  grossVolumePaise: number;
  netSettlementPaise: number;
  totalFeesPaise: number;
  refundedVolumePaise: number;
  totalCount: number;
  capturedCount: number;
  failedCount: number;
  refundedCount: number;
  initiatedCount: number;
}

export const PaymentsView: React.FC = () => {
  const { setCurrentView, showToast } = useAdmin();

  // State
  const [transactions, setTransactions] = useState<BackendPaymentTransaction[]>([]);
  const [stats, setStats] = useState<BackendPaymentStats>({
    grossVolumePaise: 0,
    netSettlementPaise: 0,
    totalFeesPaise: 0,
    refundedVolumePaise: 0,
    totalCount: 0,
    capturedCount: 0,
    failedCount: 0,
    refundedCount: 0,
    initiatedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [gatewayFilter, setGatewayFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Active Gateway State
  const [activeGatewayInfo, setActiveGatewayInfo] = useState<{
    name: string;
    environment: string;
    status: string;
    latencyMs?: number;
  }>({
    name: 'Razorpay',
    environment: 'TEST',
    status: 'NOT_CONFIGURED',
  });

  // Transaction Detail Modal
  const [selectedTx, setSelectedTx] = useState<BackendPaymentTransaction | null>(null);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);

  const getHeaders = () => {
    const token = getSessionToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (searchQuery.trim()) query.set('search', searchQuery.trim());
      if (methodFilter !== 'ALL') query.set('method', methodFilter);
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      if (gatewayFilter !== 'ALL') query.set('gateway', gatewayFilter);
      query.set('page', currentPage.toString());
      query.set('limit', '15');

      const res = await fetch(`/api/v1/admin/payments/transactions?${query.toString()}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setTransactions(data.data || []);
        if (data.stats) setStats(data.stats);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalRecords(data.pagination.total || 0);
        }
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch payment records');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to payment database');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, methodFilter, statusFilter, gatewayFilter, currentPage]);

  const fetchActiveGateway = async () => {
    try {
      const res = await fetch('/api/v1/admin/payments/gateways', { headers: getHeaders() });
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        const primary = data.data.find((g: any) => g.isDefault) || data.data[0];
        setActiveGatewayInfo({
          name: primary.name,
          environment: primary.environment,
          status: primary.connectionStatus,
          latencyMs: primary.lastLatencyMs,
        });
      }
    } catch {}
  };

  useEffect(() => {
    fetchTransactions();
    fetchActiveGateway();
  }, [fetchTransactions]);

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx) return;

    setIsProcessingRefund(true);
    try {
      const res = await fetch('/api/v1/admin/payments/refund', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          orderId: selectedTx.orderId,
          paymentId: selectedTx.gatewayPaymentId,
          amount: selectedTx.amountPaise / 100,
          reason: refundReason || 'Customer requested refund via Admin console',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Refund processed successfully. Refund ID: ${data.refundId || 'REFUNDED'}`);
        setIsRefundModalOpen(false);
        setSelectedTx(null);
        await fetchTransactions();
      } else {
        showToast(data.error || 'Failed to process refund.');
      }
    } catch (err: any) {
      showToast(`Error processing refund: ${err.message}`);
    } finally {
      setIsProcessingRefund(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-red-600" />
            <span>Payments & UPI Settlements</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time backend settlement logs, Razorpay / UPI transactions, fee breakdowns, and verified refunds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Engine Badge */}
          <div className="flex items-center gap-2 font-mono text-xs px-3 py-1.5 rounded-xl bg-slate-900 text-white border border-slate-800">
            <div className={`w-2 h-2 rounded-full ${
              activeGatewayInfo.status === 'VERIFIED' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`} />
            <span>{activeGatewayInfo.name}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
              activeGatewayInfo.environment === 'LIVE' ? 'bg-red-500/30 text-red-300' : 'bg-amber-500/30 text-amber-300'
            }`}>
              {activeGatewayInfo.environment}
            </span>
          </div>

          <button
            onClick={() => setCurrentView('SETTINGS')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Gateway Settings</span>
          </button>
        </div>
      </div>

      {/* Financial Summary Cards derived from real database records */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Gross Payment Volume</div>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            ₹{(stats.grossVolumePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-600 font-mono mt-0.5 font-medium">
            {stats.capturedCount} captured payments
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Net Settlements</div>
          <div className="text-xl font-bold text-emerald-600 font-mono mt-1">
            ₹{(stats.netSettlementPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            After MDR & payment deductions
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Gateway Fees</div>
          <div className="text-xl font-bold text-slate-700 font-mono mt-1">
            ₹{(stats.totalFeesPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Gateway processing & tax
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Refunds Processed</div>
          <div className="text-xl font-bold text-purple-600 font-mono mt-1">
            ₹{(stats.refundedVolumePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-purple-600 font-mono mt-0.5">
            {stats.refundedCount} refunded transactions
          </div>
        </div>
      </div>

      {/* Main Transactions Content */}
      <div className="space-y-4">
        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Payment ID, Order #, or Customer..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <select
              value={gatewayFilter}
              onChange={(e) => {
                setGatewayFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">All Gateways</option>
              <option value="RAZORPAY">Razorpay</option>
              <option value="CASHFREE">Cashfree</option>
              <option value="STRIPE">Stripe</option>
              <option value="CUSTOM_UPI">Custom UPI</option>
            </select>

            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">All Methods</option>
              <option value="UPI">UPI</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="DEBIT_CARD">Debit Card</option>
              <option value="NET_BANKING">Net Banking</option>
              <option value="COD">Cash on Delivery</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="CAPTURED">Captured</option>
              <option value="INITIATED">Initiated</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>

            <button
              onClick={() => fetchTransactions()}
              className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Refresh transactions"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 font-mono">
                <tr>
                  <th className="p-3.5 pl-4">Payment Ref / Order</th>
                  <th className="p-3.5">Gateway Engine</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Method</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Fees & Tax</th>
                  <th className="p-3.5">Net Payout</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right pr-4">Timestamp / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400">
                      <div className="max-w-md mx-auto space-y-2">
                        <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
                        <div className="font-semibold text-slate-700 text-sm">No Payment Transactions Recorded</div>
                        <p className="text-xs text-slate-400">
                          {searchQuery || methodFilter !== 'ALL' || statusFilter !== 'ALL'
                            ? 'No transactions matched your search filters.'
                            : 'Real-time customer checkout orders and UPI transactions will appear here as soon as payments are made on the storefront.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const gross = tx.amountPaise / 100;
                    const fee = (tx.gatewayFee || 0) + (tx.gatewayTax || 0);
                    const net = gross - fee;

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3.5 pl-4">
                          <div className="font-mono font-bold text-slate-900">
                            {tx.gatewayPaymentId || tx.gatewayOrderId}
                          </div>
                          <div className="text-[11px] font-mono text-red-600 font-semibold mt-0.5">
                            Order #{tx.orderNumber}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {tx.gateway}
                          </span>
                        </td>

                        <td className="p-3.5">
                          <div className="font-semibold text-slate-900">{tx.customerName || 'Storefront Guest'}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{tx.customerEmail || '—'}</div>
                        </td>

                        <td className="p-3.5 font-mono">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                            {tx.method}
                          </span>
                        </td>

                        <td className="p-3.5 font-mono font-bold text-slate-900">
                          ₹{gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="p-3.5 font-mono text-slate-400">
                          {fee > 0 ? `-₹${fee.toFixed(2)}` : '₹0.00'}
                        </td>

                        <td className="p-3.5 font-mono font-bold text-emerald-600">
                          ₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${
                            tx.status === 'CAPTURED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : tx.status === 'REFUNDED'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : tx.status === 'FAILED'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {tx.status}
                          </span>
                        </td>

                        <td className="p-3.5 text-right pr-4 font-mono text-xs">
                          <div className="text-slate-500 text-[11px]">
                            {new Date(tx.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedTx(tx)}
                            className="text-blue-600 hover:text-blue-800 text-[11px] font-sans font-semibold mt-0.5 cursor-pointer"
                          >
                            View Details →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing page <strong className="text-slate-900">{currentPage}</strong> of <strong className="text-slate-900">{totalPages}</strong> ({totalRecords} records)
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-red-600" />
                <h3 className="text-sm font-bold text-slate-900">Transaction Details</h3>
              </div>
              <button onClick={() => setSelectedTx(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Order Reference:</span>
                <span className="text-red-600 font-bold">#{selectedTx.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gateway Order ID:</span>
                <span className="text-slate-900">{selectedTx.gatewayOrderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gateway Payment ID:</span>
                <span className="text-slate-900">{selectedTx.gatewayPaymentId || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gross Amount:</span>
                <span className="text-slate-900 font-bold">₹{(selectedTx.amountPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="text-emerald-600 font-bold">{selectedTx.status}</span>
              </div>
            </div>

            <div className="space-y-1 text-slate-600">
              <div className="font-semibold text-slate-800">Customer Details:</div>
              <div>Name: {selectedTx.customerName || 'N/A'}</div>
              <div>Email: {selectedTx.customerEmail || 'N/A'}</div>
              <div>Phone: {selectedTx.customerPhone || 'N/A'}</div>
              <div>Timestamp: {new Date(selectedTx.createdAt).toLocaleString('en-IN')}</div>
            </div>

            {selectedTx.status === 'REFUNDED' && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1 text-purple-900">
                <div className="font-bold flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Refund Details</span>
                </div>
                <div>Refund ID: <code className="font-mono text-purple-700">{selectedTx.refundId || 'N/A'}</code></div>
                <div>Refund Amount: ₹{(selectedTx.amountPaise / 100).toFixed(2)}</div>
                <div>Reason: {selectedTx.refundReason || 'Admin refund'}</div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              {selectedTx.status === 'CAPTURED' ? (
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-semibold border border-red-200 cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Issue Refund</span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Confirmation Modal */}
      {isRefundModalOpen && selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <RotateCcw className="w-4 h-4" />
                <h3 className="text-sm text-slate-900">Initiate Gateway Refund</h3>
              </div>
              <button onClick={() => setIsRefundModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-slate-600">
              Are you sure you want to refund <strong>₹{(selectedTx.amountPaise / 100).toFixed(2)}</strong> for Order #{selectedTx.orderNumber}? The amount will be returned to the customer's original payment method via {selectedTx.gateway}.
            </p>

            <form onSubmit={handleRefundSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Refund Reason</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Customer cancelled order before dispatch"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingRefund}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isProcessingRefund ? 'Processing Refund...' : 'Confirm Refund'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
