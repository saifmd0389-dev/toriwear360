import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../AdminDataContext';
import { apiClient } from '../../services/apiClient';
import { ReturnRequestRecord } from '../../types';
import {
  Truck,
  RotateCcw,
  Sliders,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  PackageCheck,
  CreditCard,
  ShieldCheck,
  Clock,
  Eye,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { LogisticsPartnersManager } from './logistics/LogisticsPartnersManager';

const RETURN_STATUS_FILTERS = [
  'ALL',
  'RETURN_REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'PICKUP_SCHEDULED',
  'IN_TRANSIT',
  'RETURNED_TO_WAREHOUSE',
  'REFUND_PROCESSING',
  'REFUNDED',
  'CLOSED',
] as const;

const AdminAuthProofThumbnail: React.FC<{ url: string; index: number }> = ({ url, index }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let generated: string | null = null;
    apiClient.fetchReturnProofBlobUrl(url, true).then((resolved) => {
      if (!active) {
        if (resolved && resolved.startsWith('blob:')) URL.revokeObjectURL(resolved);
        return;
      }
      if (resolved) {
        generated = resolved;
        setBlobUrl(resolved);
      } else {
        setFailed(true);
      }
    });
    return () => {
      active = false;
      if (generated && generated.startsWith('blob:')) URL.revokeObjectURL(generated);
    };
  }, [url]);

  if (failed) {
    return (
      <div className="w-20 h-20 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-[10px] text-neutral-500">
        Unavailable
      </div>
    );
  }
  if (!blobUrl) {
    return (
      <div className="w-20 h-20 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
      </div>
    );
  }
  return (
    <img
      src={blobUrl}
      alt={`Return proof ${index + 1}`}
      className="w-20 h-20 rounded-xl object-cover border border-neutral-700"
    />
  );
};

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'REFUNDED':
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    case 'REFUND_PROCESSING':
      return 'bg-purple-500/15 text-purple-400 border border-purple-500/30';
    case 'RETURNED_TO_WAREHOUSE':
      return 'bg-teal-500/15 text-teal-400 border border-teal-500/30';
    case 'PICKUP_SCHEDULED':
    case 'IN_TRANSIT':
      return 'bg-sky-500/15 text-sky-400 border border-sky-500/30';
    case 'APPROVED':
      return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20';
    case 'UNDER_REVIEW':
      return 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
    case 'REJECTED':
      return 'bg-red-500/15 text-red-400 border border-red-500/30';
    case 'CLOSED':
      return 'bg-neutral-800 text-neutral-400 border border-neutral-700';
    default:
      return 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30';
  }
}

export const ShippingReturnsView: React.FC = () => {
  const { showToast } = useAdmin();

  const [activeTab, setActiveTab] = useState<'RETURNS' | 'SHIPMENTS' | 'LOGISTICS_PARTNERS'>('LOGISTICS_PARTNERS');
  const [returns, setReturns] = useState<ReturnRequestRecord[]>([]);
  const [isLoadingReturns, setIsLoadingReturns] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Detail Drawer
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequestRecord | null>(null);

  // Reject Modal
  const [rejectTarget, setRejectTarget] = useState<ReturnRequestRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionNote, setRejectionNote] = useState('');

  // Schedule Pickup Modal
  const [pickupTarget, setPickupTarget] = useState<ReturnRequestRecord | null>(null);
  const [pickupCourier, setPickupCourier] = useState('Delhivery Reverse');
  const [pickupAwb, setPickupAwb] = useState('');
  const [pickupNote, setPickupNote] = useState('');

  // Issue Refund Modal
  const [refundTarget, setRefundTarget] = useState<ReturnRequestRecord | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [refundMethodInput, setRefundMethodInput] = useState<'RAZORPAY' | 'BANK_UPI_MANUAL' | 'TORI_CREDIT'>('RAZORPAY');
  const [manualReferenceInput, setManualReferenceInput] = useState('');
  const [refundNotesInput, setRefundNotesInput] = useState('');

  const loadReturns = useCallback(async () => {
    setIsLoadingReturns(true);
    try {
      const res = await apiClient.getAdminReturns({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      if (res.success && Array.isArray(res.data)) {
        setReturns(res.data);
        setSelectedReturn((prev) => (prev ? res.data!.find((r) => r.id === prev.id) || prev : null));
      }
    } finally {
      setIsLoadingReturns(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  const applyReturnUpdate = (updated: ReturnRequestRecord) => {
    setReturns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedReturn((prev) => (prev && prev.id === updated.id ? updated : prev));
  };

  const handleStatusTransition = async (
    ret: ReturnRequestRecord,
    targetStatus: string,
    extra?: { note?: string; rejectionReason?: string; pickupCourier?: string; pickupAwb?: string }
  ) => {
    setActionError(null);
    setBusyId(ret.id);
    try {
      const res = await apiClient.updateAdminReturnStatus(ret.id, {
        status: targetStatus,
        ...extra,
      });
      if (!res.success || !res.data) {
        const msg = res.error || `Failed to update status to ${targetStatus}.`;
        setActionError(msg);
        showToast(msg);
        return false;
      }
      applyReturnUpdate(res.data);
      showToast(`${ret.returnNumber || ret.id} updated to ${res.data.status}.`);
      return true;
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmitRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    if (rejectionReason.trim().length < 3) {
      setActionError('Rejection reason must be at least 3 characters.');
      return;
    }
    const ok = await handleStatusTransition(rejectTarget, 'REJECTED', {
      rejectionReason: rejectionReason.trim(),
      note: rejectionNote.trim() || rejectionReason.trim(),
    });
    if (ok) {
      setRejectTarget(null);
      setRejectionReason('');
      setRejectionNote('');
    }
  };

  const handleSubmitPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupTarget) return;
    if (!pickupCourier.trim()) {
      setActionError('Pickup courier partner is required.');
      return;
    }
    const ok = await handleStatusTransition(pickupTarget, 'PICKUP_SCHEDULED', {
      pickupCourier: pickupCourier.trim(),
      pickupAwb: pickupAwb.trim() || undefined,
      note: pickupNote.trim() || `Pickup scheduled via ${pickupCourier.trim()}${pickupAwb.trim() ? ` (AWB: ${pickupAwb.trim()})` : ''}`,
    });
    if (ok) {
      setPickupTarget(null);
      setPickupAwb('');
      setPickupNote('');
    }
  };

  const openRefundModal = (ret: ReturnRequestRecord) => {
    setActionError(null);
    setRefundTarget(ret);
    setRefundAmountInput(String(ret.refundAmount || 0));
    const defaultMethod =
      ret.refundMethod === 'BANK_UPI_MANUAL' || ret.refundMethod === 'TORI_CREDIT'
        ? ret.refundMethod
        : 'RAZORPAY';
    setRefundMethodInput(defaultMethod);
    setManualReferenceInput('');
    setRefundNotesInput('');
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    setActionError(null);

    const parsedAmount = Number(refundAmountInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > refundTarget.refundAmount) {
      setActionError(`Refund amount must be between ₹1 and ₹${refundTarget.refundAmount}.`);
      return;
    }
    if (refundMethodInput !== 'RAZORPAY' && manualReferenceInput.trim().length < 3) {
      setActionError('A valid payout/credit reference (at least 3 characters) is required for manual or credit refunds.');
      return;
    }

    setBusyId(refundTarget.id);
    try {
      const res = await apiClient.processAdminReturnRefund(refundTarget.id, {
        amount: parsedAmount,
        refundMethod: refundMethodInput,
        manualReference: manualReferenceInput.trim() || undefined,
        notes: refundNotesInput.trim() || undefined,
      });
      if (!res.success || !res.data) {
        setActionError(res.error || 'Failed to process refund.');
        if (res.data) applyReturnUpdate(res.data);
        return;
      }
      applyReturnUpdate(res.data);
      showToast(`Refund of ₹${parsedAmount} processed (${refundMethodInput}).`);
      setRefundTarget(null);
    } finally {
      setBusyId(null);
    }
  };

  const handleVerifyRazorpayRefund = async (ret: ReturnRequestRecord) => {
    setActionError(null);
    setBusyId(ret.id);
    try {
      const res = await apiClient.verifyAdminReturnRefund(ret.id);
      if (!res.success || !res.data) {
        const msg = res.error || 'Could not verify refund with Razorpay.';
        setActionError(msg);
        showToast(msg);
        return;
      }
      applyReturnUpdate(res.data);
      showToast(`Razorpay refund status verified: ${res.gatewayStatus || res.data.refundStatus || 'Checked'}`);
    } finally {
      setBusyId(null);
    }
  };

  const activeOpenCount = returns.filter((r) => !['CLOSED', 'REJECTED', 'REFUNDED'].includes(r.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-sky-500" />
            <span>Shipping Logistics &amp; Reverse Returns QC Center</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Courier API integrations (Delhivery, Bluedart, Shadowfax), tracking AWBs &amp; end-to-end return refunds.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
            Open Returns: <strong className="text-white">{activeOpenCount}</strong> / {returns.length}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
            Delhivery API: <strong>Connected</strong>
          </span>
        </div>
      </div>

      {/* Switcher */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 text-xs flex-wrap">
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
          <span>Customer Returns &amp; Refunds ({returns.length})</span>
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
          {actionError && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{actionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-red-300 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Search & Status Filter */}
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Return #, Order #, customer, or product..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <button
                type="button"
                onClick={loadReturns}
                disabled={isLoadingReturns}
                className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReturns ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {RETURN_STATUS_FILTERS.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold uppercase transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-red-600 text-white'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  {st.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Returns Table */}
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            {isLoadingReturns && returns.length === 0 ? (
              <div className="py-12 flex items-center justify-center gap-2 text-xs text-neutral-400">
                <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                <span>Loading return &amp; refund records...</span>
              </div>
            ) : returns.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-400">
                No return or exchange requests found matching the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-neutral-300">
                  <thead className="bg-[#181824] text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-800 font-mono">
                    <tr>
                      <th className="p-3.5 pl-4">Return #</th>
                      <th className="p-3.5">Order #</th>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Items &amp; Reason</th>
                      <th className="p-3.5">Refund</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 font-sans">
                    {returns.map((ret) => {
                      const firstItem = ret.items?.[0];
                      const itemSummary = firstItem
                        ? `${firstItem.productName} (${firstItem.size} × ${firstItem.quantity})${ret.items.length > 1 ? ` +${ret.items.length - 1} more` : ''}`
                        : 'Return Items';
                      const isBusy = busyId === ret.id;

                      return (
                        <tr key={ret.id} className="hover:bg-neutral-800/40 transition-colors">
                          <td className="p-3.5 pl-4 font-mono">
                            <div className="font-bold text-red-400">{ret.returnNumber || ret.id}</div>
                            <div className="text-[10px] text-neutral-500">{ret.requestType}</div>
                          </td>
                          <td className="p-3.5 font-mono text-neutral-300">
                            <div>{ret.orderNumber}</div>
                            <div className="text-[10px] text-neutral-500">
                              {new Date(ret.createdAt).toLocaleDateString('en-IN')}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-white">{ret.customerName}</div>
                            <div className="text-[10px] text-neutral-500 font-mono">{ret.customerEmail}</div>
                          </td>
                          <td className="p-3.5 max-w-xs">
                            <div className="font-semibold text-white truncate">{itemSummary}</div>
                            <div className="text-[11px] text-amber-400 truncate">{ret.reason}</div>
                            {ret.proofUrls?.length > 0 && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[9px] font-mono">
                                {ret.proofUrls.length} Proof Photo{ret.proofUrls.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 font-mono">
                            <div className="font-bold text-white">
                              ₹{Number(ret.refundAmount || 0).toLocaleString('en-IN')}
                            </div>
                            <div className="text-[10px] text-neutral-400">{ret.refundMethod || 'RAZORPAY'}</div>
                            {ret.stockRestored && (
                              <span className="inline-block mt-0.5 text-[9px] text-emerald-400">Restocked</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${getStatusBadgeClass(ret.status)}`}>
                              {ret.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="p-3.5 text-right pr-4">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setSelectedReturn(ret)}
                                className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Inspect</span>
                              </button>

                              {ret.status === 'RETURN_REQUESTED' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleStatusTransition(ret, 'APPROVED')}
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] cursor-pointer disabled:opacity-50"
                                >
                                  Approve
                                </button>
                              )}

                              {ret.status === 'APPROVED' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => {
                                    setActionError(null);
                                    setPickupTarget(ret);
                                  }}
                                  className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-[11px] cursor-pointer disabled:opacity-50"
                                >
                                  Pickup
                                </button>
                              )}

                              {(ret.status === 'PICKUP_SCHEDULED' || ret.status === 'IN_TRANSIT') && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleStatusTransition(ret, 'RETURNED_TO_WAREHOUSE')}
                                  className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-medium text-[11px] cursor-pointer disabled:opacity-50"
                                >
                                  Received &amp; Restock
                                </button>
                              )}

                              {ret.status === 'RETURNED_TO_WAREHOUSE' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => openRefundModal(ret)}
                                  className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium text-[11px] cursor-pointer disabled:opacity-50"
                                >
                                  Issue Refund
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* OUTBOUND SHIPMENTS PIPELINE */
        <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-white text-sm">Active Couriers &amp; Aggregators</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">Delhivery Surface &amp; Air</span>
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
              <p className="text-xs text-neutral-400">Doorstep QC &amp; Instant Reverse Dispatch</p>
              <div className="text-xs text-neutral-500 font-mono">Serviceability: 9,500+ Pincodes</div>
            </div>
          </div>
        </div>
      )}

      {/* Return Detail Drawer */}
      {selectedReturn && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex justify-end"
          onClick={() => setSelectedReturn(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-[#101119] border-l border-neutral-800 h-full overflow-y-auto p-6 space-y-5 text-xs text-neutral-200"
          >
            <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-white">
                    {selectedReturn.returnNumber || selectedReturn.id}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${getStatusBadgeClass(selectedReturn.status)}`}>
                    {selectedReturn.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-neutral-400 font-mono text-[11px] mt-1">
                  Order: {selectedReturn.orderNumber} · Type: {selectedReturn.requestType}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReturn(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Workflow Actions */}
            <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
                Lifecycle Actions
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedReturn.status === 'RETURN_REQUESTED' && (
                  <button
                    type="button"
                    disabled={busyId === selectedReturn.id}
                    onClick={() => handleStatusTransition(selectedReturn, 'UNDER_REVIEW')}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer"
                  >
                    Mark Under Review
                  </button>
                )}

                {['RETURN_REQUESTED', 'UNDER_REVIEW'].includes(selectedReturn.status) && (
                  <button
                    type="button"
                    disabled={busyId === selectedReturn.id}
                    onClick={() => handleStatusTransition(selectedReturn, 'APPROVED')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Return</span>
                  </button>
                )}

                {['RETURN_REQUESTED', 'UNDER_REVIEW', 'APPROVED'].includes(selectedReturn.status) && (
                  <button
                    type="button"
                    disabled={busyId === selectedReturn.id}
                    onClick={() => {
                      setActionError(null);
                      setRejectTarget(selectedReturn);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                )}

                {selectedReturn.status === 'APPROVED' && (
                  <button
                    type="button"
                    disabled={busyId === selectedReturn.id}
                    onClick={() => {
                      setActionError(null);
                      setPickupTarget(selectedReturn);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Schedule Pickup</span>
                  </button>
                )}

                {selectedReturn.status === 'PICKUP_SCHEDULED' && (
                  <button
                    type="button"
                    disabled={busyId === selectedReturn.id}
                    onClick={() => handleStatusTransition(selectedReturn, 'IN_TRANSIT')}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer"
                  >
                    Mark In Transit
                  </button>
                )}

                {['APPROVED', 'PICKUP_SCHEDULED', 'IN_TRANSIT'].includes(selectedReturn.status) && (
                  <button
                    type="button"
                    disabled={busyId === selectedReturn.id}
                    onClick={() => handleStatusTransition(selectedReturn, 'RETURNED_TO_WAREHOUSE')}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Mark Returned to Warehouse (Restock)</span>
                  </button>
                )}

                {['APPROVED', 'RETURNED_TO_WAREHOUSE', 'REFUND_PROCESSING'].includes(selectedReturn.status) && (
                  <button
                    type="button"
                    disabled={busyId === selectedReturn.id}
                    onClick={() => openRefundModal(selectedReturn)}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Issue Refund</span>
                  </button>
                )}

                {selectedReturn.refundMethod === 'RAZORPAY' &&
                  Boolean(selectedReturn.refundTransactionId || selectedReturn.refundId) && (
                    <button
                      type="button"
                      disabled={busyId === selectedReturn.id}
                      onClick={() => handleVerifyRazorpayRefund(selectedReturn)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verify Razorpay Refund</span>
                    </button>
                  )}

                {!['RETURN_REQUESTED', 'UNDER_REVIEW', 'CLOSED'].includes(selectedReturn.status) && (
                  <button
                    type="button"
                    disabled={busyId === selectedReturn.id}
                    onClick={() => handleStatusTransition(selectedReturn, 'CLOSED')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold cursor-pointer"
                  >
                    Close Case
                  </button>
                )}
              </div>
            </div>

            {/* Customer & Pickup Logistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-1">
                <div className="text-[10px] font-mono uppercase text-neutral-500">Customer Info</div>
                <div className="font-bold text-white">{selectedReturn.customerName}</div>
                <div className="text-neutral-400">{selectedReturn.customerEmail}</div>
                <div className="text-neutral-400 font-mono">{selectedReturn.customerPhone}</div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-1">
                <div className="text-[10px] font-mono uppercase text-neutral-500">Refund &amp; Restock</div>
                <div className="font-mono font-bold text-white">
                  Eligible: ₹{Number(selectedReturn.refundAmount || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-neutral-400">
                  Method: {selectedReturn.refundMethod || 'RAZORPAY'} · Status: {selectedReturn.refundStatus || 'PENDING'}
                </div>
                {(selectedReturn.refundTransactionId || selectedReturn.refundId) && (
                  <div className="text-[11px] font-mono text-emerald-400 break-all">
                    Ref ID: {selectedReturn.refundTransactionId || selectedReturn.refundId}
                  </div>
                )}
                <div className="text-[11px] text-neutral-400">
                  Inventory Restocked:{' '}
                  <strong className={selectedReturn.stockRestored ? 'text-emerald-400' : 'text-neutral-300'}>
                    {selectedReturn.stockRestored ? 'Yes (Restored)' : 'No'}
                  </strong>
                </div>
              </div>
            </div>

            {(selectedReturn.pickupCourier || selectedReturn.pickupAwb) && (
              <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-500/30 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase text-sky-400">Reverse Pickup Courier</div>
                  <div className="font-bold text-white mt-0.5">{selectedReturn.pickupCourier}</div>
                </div>
                {selectedReturn.pickupAwb && (
                  <div className="text-right font-mono">
                    <div className="text-[10px] text-neutral-400">AWB Tracking</div>
                    <div className="font-bold text-sky-300">{selectedReturn.pickupAwb}</div>
                  </div>
                )}
              </div>
            )}

            {selectedReturn.rejectionReason && (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200">
                <div className="text-[10px] font-mono uppercase text-red-400 font-bold">Rejection Reason</div>
                <div className="mt-1">{selectedReturn.rejectionReason}</div>
              </div>
            )}

            {/* Reason & Proofs */}
            <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <div>
                <div className="text-[10px] font-mono uppercase text-neutral-500">Customer Reason</div>
                <div className="font-semibold text-amber-400 mt-0.5">{selectedReturn.reason}</div>
                {selectedReturn.comments && (
                  <p className="text-neutral-300 mt-1">{selectedReturn.comments}</p>
                )}
              </div>

              {selectedReturn.proofUrls?.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase text-neutral-500 mb-2">
                    Uploaded Proof Photos ({selectedReturn.proofUrls.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedReturn.proofUrls.map((url, idx) => (
                      <AdminAuthProofThumbnail key={url} url={url} index={idx} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
              <div className="text-[10px] font-mono uppercase text-neutral-500">Returned Items</div>
              {(selectedReturn.items || []).map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-950 border border-neutral-800"
                >
                  <div>
                    <div className="font-semibold text-white">{item.productName}</div>
                    <div className="text-[11px] font-mono text-neutral-400">
                      Size: {item.size} · Color: {item.color} · Qty: {item.quantity}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-white font-bold">₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}</div>
                    {item.restocked && <div className="text-[10px] text-emerald-400">Restocked</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Status History Timeline */}
            <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <div className="text-[10px] font-mono uppercase text-neutral-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Audit &amp; Status Timeline</span>
              </div>
              <div className="space-y-2.5">
                {(selectedReturn.statusHistory || []).map((entry, idx) => (
                  <div key={entry.id || idx} className="flex items-start gap-2.5 text-[11px]">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-white">
                          {entry.status.replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono text-[10px] text-neutral-500">
                          {new Date(entry.createdAt).toLocaleString('en-IN')}
                        </span>
                      </div>
                      {entry.note && <div className="text-neutral-300 mt-0.5">{entry.note}</div>}
                      {entry.actorName && (
                        <div className="text-[10px] text-neutral-500">
                          By {entry.actorName} ({entry.actorRole || 'STAFF'})
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-[60] bg-black/75 flex items-center justify-center p-4"
          onClick={() => setRejectTarget(null)}
        >
          <form
            onSubmit={handleSubmitRejection}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#14141c] border border-neutral-800 rounded-2xl p-5 space-y-4 text-xs text-white"
          >
            <h3 className="font-bold text-sm">Reject Return {rejectTarget.returnNumber || rejectTarget.id}</h3>
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Rejection Reason (shown to customer) *</label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Tags removed / product washed / return window exceeded"
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Internal Note (Optional)</label>
              <input
                type="text"
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId === rejectTarget.id}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Schedule Pickup Modal */}
      {pickupTarget && (
        <div
          className="fixed inset-0 z-[60] bg-black/75 flex items-center justify-center p-4"
          onClick={() => setPickupTarget(null)}
        >
          <form
            onSubmit={handleSubmitPickup}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#14141c] border border-neutral-800 rounded-2xl p-5 space-y-4 text-xs text-white"
          >
            <h3 className="font-bold text-sm">Schedule Reverse Pickup — {pickupTarget.returnNumber || pickupTarget.id}</h3>
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Courier Partner *</label>
              <input
                type="text"
                required
                value={pickupCourier}
                onChange={(e) => setPickupCourier(e.target.value)}
                placeholder="Delhivery Reverse / Shadowfax / BlueDart"
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Reverse AWB Number</label>
              <input
                type="text"
                value={pickupAwb}
                onChange={(e) => setPickupAwb(e.target.value)}
                placeholder="e.g. DLV-REV-998124"
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 font-mono text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Pickup Note (Optional)</label>
              <input
                type="text"
                value={pickupNote}
                onChange={(e) => setPickupNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPickupTarget(null)}
                className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId === pickupTarget.id}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer"
              >
                Confirm Pickup
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Issue Refund Modal */}
      {refundTarget && (
        <div
          className="fixed inset-0 z-[60] bg-black/75 flex items-center justify-center p-4"
          onClick={() => setRefundTarget(null)}
        >
          <form
            onSubmit={handleSubmitRefund}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#14141c] border border-neutral-800 rounded-2xl p-5 space-y-4 text-xs text-white"
          >
            <h3 className="font-bold text-sm">
              Process Return Refund — {refundTarget.returnNumber || refundTarget.id}
            </h3>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Refund Amount (₹) — Max ₹{refundTarget.refundAmount}
              </label>
              <input
                type="number"
                step="0.01"
                min={1}
                max={refundTarget.refundAmount}
                required
                value={refundAmountInput}
                onChange={(e) => setRefundAmountInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 font-mono text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Refund Method</label>
              <select
                value={refundMethodInput}
                onChange={(e) => setRefundMethodInput(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-red-500"
              >
                <option value="RAZORPAY">Razorpay Original Payment Method (Automated API)</option>
                <option value="BANK_UPI_MANUAL">Bank / UPI Manual Payout (COD / Direct Transfer)</option>
                <option value="TORI_CREDIT">TORI-WEAR Store Credit</option>
              </select>
            </div>

            {refundMethodInput !== 'RAZORPAY' && (
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Manual Payout / UPI / Credit Reference *
                </label>
                <input
                  type="text"
                  required
                  value={manualReferenceInput}
                  onChange={(e) => setManualReferenceInput(e.target.value)}
                  placeholder="e.g. UTR-6328199012 or CREDIT-8821"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 font-mono text-white focus:outline-none focus:border-red-500"
                />
              </div>
            )}

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Refund Note (Optional)</label>
              <input
                type="text"
                value={refundNotesInput}
                onChange={(e) => setRefundNotesInput(e.target.value)}
                placeholder="Reason or internal settlement reference..."
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundTarget(null)}
                className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId === refundTarget.id}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold cursor-pointer disabled:opacity-50"
              >
                {busyId === refundTarget.id ? 'Processing...' : 'Execute Refund'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
