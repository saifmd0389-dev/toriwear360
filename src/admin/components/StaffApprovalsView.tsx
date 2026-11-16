import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  PlusCircle,
  Check,
  X,
  Search,
  AlertCircle,
} from 'lucide-react';
import { platformApi } from '../services/platformService';
import { ApprovalRequest, PlatformUser } from '../../../server/rbacTypes';

export const StaffApprovalsView: React.FC = () => {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [currentUser, setCurrentUser] = useState<PlatformUser | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'VOIDED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [voidModalTarget, setVoidModalTarget] = useState<ApprovalRequest | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);

  // New request form
  const [newReq, setNewReq] = useState({
    type: 'EXPENSE' as ApprovalRequest['type'],
    title: '',
    description: '',
    amount: 0,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const cur = await platformApi.getCurrentUser();
      setCurrentUser(cur);
      const items = await platformApi.getApprovals();
      setApprovals(items);
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => {
      loadData();
    };
    window.addEventListener('tori_approvals_updated', handleRefresh);
    window.addEventListener('tori_admin_products_updated', handleRefresh);
    return () => {
      window.removeEventListener('tori_approvals_updated', handleRefresh);
      window.removeEventListener('tori_admin_products_updated', handleRefresh);
    };
  }, []);

  const isPartnerOrAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'PARTNER';

  const handleReview = async () => {
    if (!selectedApproval || !reviewAction) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await platformApi.reviewApproval(selectedApproval.id, reviewAction, reviewComment);
      if (res.success) {
        const reviewedTitle = selectedApproval.title;
        const wasProductCreation = selectedApproval.type === 'PRODUCT_CREATION';
        setSelectedApproval(null);
        setReviewAction(null);
        setReviewComment('');
        setActionSuccess(
          wasProductCreation && res.updatedProductStatus
            ? `Reviewed "${reviewedTitle}" — linked product status updated to ${res.updatedProductStatus}.`
            : `Request "${reviewedTitle}" marked as ${reviewAction}.`
        );
        await loadData();
        if (wasProductCreation) {
          window.dispatchEvent(new CustomEvent('tori_admin_products_refresh'));
        }
      } else {
        setActionError(res.error || 'Failed to review request.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error submitting review.');
    }
  };

  const handleVoid = async () => {
    if (!voidModalTarget || !voidReason) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await platformApi.voidApproval(voidModalTarget.id, voidReason);
      if (res.success) {
        const voidedTitle = voidModalTarget.title;
        setVoidModalTarget(null);
        setVoidReason('');
        setActionSuccess(`Voided record "${voidedTitle}".`);
        await loadData();
      } else {
        setActionError(res.error || 'Failed to void record.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error voiding record.');
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReq.title || !newReq.description) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await platformApi.createApproval({
        type: newReq.type,
        title: newReq.title,
        description: newReq.description,
        amount: Number(newReq.amount) || 0,
      });
      if (res.success) {
        setShowNewRequestModal(false);
        setNewReq({ type: 'EXPENSE', title: '', description: '', amount: 0 });
        setActionSuccess('Submitted approval request to workflow.');
        await loadData();
      } else {
        setActionError(res.error || 'Failed to create request.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error creating request.');
    }
  };

  const filtered = approvals.filter(item => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match = item.title.toLowerCase().includes(q) ||
                    item.description.toLowerCase().includes(q) ||
                    item.submittedBy.name.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const pendingCount = approvals.filter(a => a.status === 'SUBMITTED').length;

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="p-1 hover:text-red-900 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button type="button" onClick={() => setActionSuccess(null)} className="p-1 hover:text-emerald-900 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Staff Approval Workflow & Ledger</h1>
            {loading && <span className="text-[11px] text-slate-400">Syncing...</span>}
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white animate-pulse">
                {pendingCount} Pending
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-stage verification for sensitive financial, inventory, pricing, and refund requests. Records cannot be deleted; voiding maintains audit integrity.
          </p>
        </div>

        <button
          onClick={() => setShowNewRequestModal(true)}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Submit Request for Approval</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Tabs */}
          {(['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED', 'VOIDED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'SUBMITTED' ? 'PENDING APPROVAL' : st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 bg-white font-medium focus:outline-none"
          >
            <option value="ALL">All Request Types</option>
            <option value="EXPENSE">Expense Request</option>
            <option value="REFUND">Customer Refund</option>
            <option value="PRICE_CHANGE">Price Change</option>
            <option value="PRODUCT_CREATION">Product Creation</option>
            <option value="INVENTORY_ADJUSTMENT">Inventory Adjustment</option>
            <option value="FINANCIAL_TRANSACTION">Financial Transaction</option>
            <option value="MARKETING_EXPENDITURE">Marketing Expenditure</option>
            <option value="PARTNER_TRANSACTION">Partner Transaction</option>
          </select>

          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search requests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-red-500"
            />
          </div>
        </div>
      </div>

      {/* Approvals Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Request / Operation</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Submitted By</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Reviewed / Voided By</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 max-w-sm">
                    <div className="font-bold text-slate-900">{req.title}</div>
                    <div className="text-slate-500 text-[11px] line-clamp-1 mt-0.5">{req.description}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                      {req.type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                    {req.amount ? `₹${req.amount.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-800">{req.submittedBy.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {new Date(req.submittedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                      req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      req.status === 'SUBMITTED' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      req.status === 'REJECTED' ? 'bg-red-100 text-red-800 border border-red-200' :
                      'bg-slate-800 text-white'
                    }`}>
                      {req.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                      {req.status === 'SUBMITTED' && <Clock className="w-3 h-3" />}
                      {req.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                      {req.status === 'VOIDED' && <RotateCcw className="w-3 h-3" />}
                      <span>{req.status === 'SUBMITTED' ? 'PENDING' : req.status}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-[11px]">
                    {req.reviewedBy ? (
                      <div>
                        <span className="font-semibold text-slate-800">{req.reviewedBy.name}</span>
                        <div className="text-slate-500 italic text-[10px]">"{req.reviewComment}"</div>
                      </div>
                    ) : req.voidedBy ? (
                      <div>
                        <span className="font-semibold text-red-700">Voided by {req.voidedBy.name}</span>
                        <div className="text-slate-500 italic text-[10px]">"{req.voidReason}"</div>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic font-mono">Awaiting Review</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {req.status === 'SUBMITTED' && isPartnerOrAdmin && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedApproval(req);
                              setReviewAction('APPROVED');
                            }}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer"
                            title="Approve Request"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedApproval(req);
                              setReviewAction('REJECTED');
                            }}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 cursor-pointer"
                            title="Reject Request"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {req.status === 'APPROVED' && isPartnerOrAdmin && (
                        <button
                          onClick={() => setVoidModalTarget(req)}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          title="Reversal / Void (No Permanent Deletion)"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Void Record</span>
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

      {/* REVIEW CONFIRMATION MODAL */}
      {selectedApproval && reviewAction && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {reviewAction === 'APPROVED' ? 'Approve Workflow Action' : 'Reject Workflow Action'}
            </h3>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900">{selectedApproval.title}</div>
              <div className="text-slate-600">{selectedApproval.description}</div>
              {selectedApproval.amount && (
                <div className="text-slate-900 font-mono font-bold pt-1">
                  Amount: ₹{selectedApproval.amount.toLocaleString('en-IN')}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Executive Review Comments / Reason:
              </label>
              <textarea
                required
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Enter mandatory approval comment or justification..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedApproval(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReview}
                className={`px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-sm cursor-pointer ${
                  reviewAction === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                Confirm {reviewAction === 'APPROVED' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID / REVERSAL MODAL */}
      {voidModalTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <RotateCcw className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">Void / Reverse Record</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              In accordance with enterprise accounting standards, financial records are <strong>never permanently erased</strong>. Voiding creates a formal reversal ledger entry citing the responsible executive and legal justification.
            </p>

            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs space-y-1">
              <div className="font-bold text-red-950">{voidModalTarget.title}</div>
              <div className="text-red-800 text-[11px]">Original Amount: ₹{voidModalTarget.amount || 0}</div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Mandatory Void Justification:
              </label>
              <textarea
                required
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="State the accounting reason for reversing this record..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setVoidModalTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVoid}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm cursor-pointer"
              >
                Execute Reversal / Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW REQUEST MODAL */}
      {showNewRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Submit Action for Executive Approval</h3>
              <button onClick={() => setShowNewRequestModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Operation Category</label>
                <select
                  value={newReq.type}
                  onChange={(e) => setNewReq({ ...newReq, type: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none"
                >
                  <option value="EXPENSE">New Expense</option>
                  <option value="REFUND">Customer Refund</option>
                  <option value="PRICE_CHANGE">Product Price Change</option>
                  <option value="PRODUCT_CREATION">Product Creation</option>
                  <option value="INVENTORY_ADJUSTMENT">Major Inventory Adjustment</option>
                  <option value="FINANCIAL_TRANSACTION">Financial Transaction</option>
                  <option value="MARKETING_EXPENDITURE">Marketing Expenditure</option>
                  <option value="PARTNER_TRANSACTION">Partner-Related Transaction</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Title / Summary</label>
                <input
                  type="text"
                  required
                  value={newReq.title}
                  onChange={(e) => setNewReq({ ...newReq, title: e.target.value })}
                  placeholder="e.g. Bulk Tirupur loopback cotton batch restock"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Amount (₹, if applicable)</label>
                <input
                  type="number"
                  value={newReq.amount}
                  onChange={(e) => setNewReq({ ...newReq, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Description & Operational Context</label>
                <textarea
                  required
                  rows={3}
                  value={newReq.description}
                  onChange={(e) => setNewReq({ ...newReq, description: e.target.value })}
                  placeholder="Provide complete breakdown, vendor details, or customer justification..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewRequestModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer shadow-sm"
                >
                  Submit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
