import React, { useState, useEffect, useCallback } from 'react';
import { Star, Search, CheckCircle2, XCircle, Trash2, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { ProductReview, ReviewStatus } from '../../types';
import { apiClient } from '../../services/apiClient';
import { useAdmin } from '../AdminDataContext';

const FIT_DISPLAY: Record<string, string> = {
  RUNS_SMALL: 'Runs Small',
  TRUE_TO_SIZE: 'True to Size',
  RUNS_LARGE: 'Runs Large',
};

export const ProductReviewsModerationTab: React.FC = () => {
  const { showToast } = useAdmin();
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReviewStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    const res = await apiClient.getAdminReviews({
      status: statusFilter,
      search: searchQuery.trim() || undefined,
    });
    setIsLoading(false);
    if (res.success && Array.isArray(res.data)) {
      setReviews(res.data);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const handleModerate = async (review: ProductReview, updates: { status?: ReviewStatus; isFeatured?: boolean }) => {
    setBusyId(review.id);
    const res = await apiClient.updateAdminReviewStatus(review.id, updates);
    setBusyId(null);

    if (res.success && res.data) {
      setReviews((prev) => prev.map((r) => (r.id === review.id ? res.data! : r)));
      showToast('Review updated.');
    } else {
      showToast(res.error || 'Failed to update review.');
    }
  };

  const handleDelete = async (review: ProductReview) => {
    setBusyId(review.id);
    const res = await apiClient.deleteAdminReview(review.id);
    setBusyId(null);
    setConfirmDeleteId(null);

    if (res.success) {
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      showToast('Review deleted.');
    } else {
      showToast(res.error || 'Failed to delete review.');
    }
  };

  const approvedCount = reviews.filter((r) => r.status === 'APPROVED').length;
  const pendingCount = reviews.filter((r) => r.status === 'PENDING').length;
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviews.length).toFixed(1)
      : '—';

  return (
    <div className="space-y-5">
      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#14141c] border border-neutral-800 rounded-xl p-4">
          <div className="text-[11px] font-mono uppercase text-neutral-400">Loaded Reviews</div>
          <div className="text-2xl font-bold text-white mt-1 tabular-nums">{reviews.length}</div>
        </div>
        <div className="bg-[#14141c] border border-neutral-800 rounded-xl p-4">
          <div className="text-[11px] font-mono uppercase text-neutral-400">Published</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">{approvedCount}</div>
        </div>
        <div className="bg-[#14141c] border border-neutral-800 rounded-xl p-4">
          <div className="text-[11px] font-mono uppercase text-neutral-400">Pending Review</div>
          <div className="text-2xl font-bold text-amber-400 mt-1 tabular-nums">{pendingCount}</div>
        </div>
        <div className="bg-[#14141c] border border-neutral-800 rounded-xl p-4">
          <div className="text-[11px] font-mono uppercase text-neutral-400">Mean Score</div>
          <div className="text-2xl font-bold text-white mt-1 tabular-nums">{avgRating}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#14141c] p-4 rounded-2xl border border-neutral-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search reviews by customer, product, headline, or comment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ReviewStatus)}
            className="px-3 py-2 bg-neutral-900 border border-neutral-700/80 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-red-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <button
            type="button"
            onClick={loadReviews}
            className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 text-neutral-300 cursor-pointer"
            title="Refresh reviews"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Review List */}
      {isLoading ? (
        <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-10 flex items-center justify-center gap-2 text-xs text-neutral-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading product reviews...</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-10 text-center text-xs text-neutral-400">
          No customer reviews found matching the current filter.
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((rev) => {
            const isBusy = busyId === rev.id;
            return (
              <div
                key={rev.id}
                className="bg-[#14141c] border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-4"
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= rev.rating ? 'fill-red-500 text-red-500' : 'text-neutral-700'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-bold text-white">{rev.customerName}</span>
                    {rev.verifiedPurchase && (
                      <span className="text-[11px] text-emerald-400 font-mono">Verified Buyer</span>
                    )}
                    <span className="text-neutral-600">·</span>
                    <span className="text-neutral-400 font-mono text-[11px] truncate">
                      {rev.productName || rev.productId}
                    </span>
                    <span className="text-neutral-600">·</span>
                    <span className="text-neutral-500 font-mono text-[11px] tabular-nums">
                      {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  {rev.title && (
                    <div className="text-sm font-semibold text-white">{rev.title}</div>
                  )}

                  <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-line">
                    {rev.comment}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-neutral-400 pt-1">
                    <span
                      className={
                        rev.status === 'APPROVED'
                          ? 'text-emerald-400 font-bold'
                          : rev.status === 'REJECTED'
                          ? 'text-rose-400 font-bold'
                          : 'text-amber-400 font-bold'
                      }
                    >
                      Status: {rev.status}
                    </span>
                    {rev.sizePurchased && <span>Size: {rev.sizePurchased}</span>}
                    {rev.fitFeedback && <span>Fit: {FIT_DISPLAY[rev.fitFeedback] || rev.fitFeedback}</span>}
                    {rev.isFeatured && <span className="text-amber-300">★ Featured</span>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {rev.status !== 'APPROVED' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleModerate(rev, { status: 'APPROVED' })}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/40 text-emerald-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  )}

                  {rev.status !== 'REJECTED' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleModerate(rev, { status: 'REJECTED' })}
                      className="px-3 py-1.5 rounded-lg bg-amber-600/15 hover:bg-amber-600/25 border border-amber-600/30 text-amber-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Hide</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleModerate(rev, { isFeatured: !rev.isFeatured })}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      rev.isFeatured
                        ? 'bg-red-600/20 border-red-500/40 text-red-300'
                        : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{rev.isFeatured ? 'Unfeature' : 'Feature'}</span>
                  </button>

                  {confirmDeleteId === rev.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(rev)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmDeleteId(rev.id)}
                      className="p-1.5 rounded-lg bg-neutral-900 hover:bg-red-950 border border-neutral-800 hover:border-red-800 text-neutral-400 hover:text-red-400 cursor-pointer"
                      title="Delete review"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
