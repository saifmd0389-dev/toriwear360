import React, { useState, useEffect, useCallback } from 'react';
import { Star, CheckCircle2, ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react';
import { FitFeedback, ProductReview, ProductReviewSummary } from '../types';
import { apiClient } from '../services/apiClient';
import { useCustomerAuth } from '../context/CustomerAuthContext';

interface ProductReviewsSectionProps {
  productId: string;
  productName: string;
  availableSizes: string[];
  onSummaryChange?: (summary: ProductReviewSummary) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Exceptional',
};

const FIT_LABELS: Record<FitFeedback, string> = {
  RUNS_SMALL: 'Runs Small',
  TRUE_TO_SIZE: 'True to Size',
  RUNS_LARGE: 'Runs Large',
};

export const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({
  productId,
  productName,
  availableSizes,
  onSummaryChange,
}) => {
  const { customer } = useCustomerAuth();

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [summary, setSummary] = useState<ProductReviewSummary>({
    averageRating: 0,
    totalCount: 0,
    verifiedCount: 0,
    breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    fitBreakdown: { TRUE_TO_SIZE: 0, RUNS_SMALL: 0, RUNS_LARGE: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'highest' | 'lowest'>('recent');

  // Composer state
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>(customer?.name || '');
  const [reviewerEmail, setReviewerEmail] = useState<string>(customer?.email || '');
  const [title, setTitle] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [sizePurchased, setSizePurchased] = useState<string>(availableSizes[2] || availableSizes[0] || 'L');
  const [fitFeedback, setFitFeedback] = useState<FitFeedback>('TRUE_TO_SIZE');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (customer?.name && !customerName) setCustomerName(customer.name);
    if (customer?.email && !reviewerEmail) setReviewerEmail(customer.email);
  }, [customer?.name, customer?.email]);

  useEffect(() => {
    setIsComposerOpen(false);
    setRatingFilter(undefined);
    setVerifiedOnly(false);
    setSubmitSuccess(null);
    setSubmitError(null);
  }, [productId]);

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const res = await apiClient.getProductReviews(productId, {
      rating: ratingFilter,
      verified: verifiedOnly || undefined,
      sort: sortBy,
    });
    setIsLoading(false);

    if (res.success) {
      setReviews(Array.isArray(res.data) ? res.data : []);
      if (res.summary) {
        setSummary(res.summary);
        onSummaryChange?.(res.summary);
      }
    } else {
      setLoadError(res.error || 'Could not load reviews.');
    }
  }, [productId, ratingFilter, verifiedOnly, sortBy]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (customerName.trim().length < 2) {
      setSubmitError('Please enter your name (at least 2 characters).');
      return;
    }
    if (comment.trim().length < 10) {
      setSubmitError('Please write at least 10 characters sharing your experience.');
      return;
    }

    setSubmitting(true);
    const res = await apiClient.submitProductReview(productId, {
      rating: ratingInput,
      customerName: customerName.trim(),
      email: reviewerEmail.trim() || undefined,
      title: title.trim() || undefined,
      comment: comment.trim(),
      sizePurchased: sizePurchased || undefined,
      fitFeedback,
    });
    setSubmitting(false);

    if (!res.success) {
      setSubmitError(res.error || 'Failed to publish your review.');
      return;
    }

    setTitle('');
    setComment('');
    setRatingInput(5);
    setIsComposerOpen(false);
    setSubmitSuccess('Thank you — your review is now live.');
    await loadReviews();
  };

  const totalFitVotes =
    summary.fitBreakdown.RUNS_SMALL +
    summary.fitBreakdown.TRUE_TO_SIZE +
    summary.fitBreakdown.RUNS_LARGE;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <section
      id="pdp-reviews-section"
      className="mt-16 pt-10 border-t border-neutral-200 scroll-mt-24"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-500 font-semibold">
            Customer Feedback
          </p>
          <h2 className="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight mt-1">
            Reviews &amp; Fit Consensus
          </h2>
        </div>

        <button
          type="button"
          onClick={() => {
            setSubmitError(null);
            setSubmitSuccess(null);
            setIsComposerOpen((prev) => !prev);
          }}
          className="px-5 py-2.5 bg-[#111115] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <span>{isComposerOpen ? 'Close Review Form' : 'Write a Review'}</span>
          {isComposerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {submitSuccess && (
        <div className="mb-6 p-3.5 border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{submitSuccess}</span>
        </div>
      )}

      {/* Summary Grid: Average Rating, Star Distribution, Fit Consensus */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-5 sm:p-6 bg-neutral-50 border border-neutral-200 mb-8">
        {/* Left: Overall Score */}
        <div className="md:col-span-4 flex flex-col justify-between border-b md:border-b-0 md:border-r border-neutral-200 pb-5 md:pb-0 md:pr-6">
          <div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-4xl font-bold text-neutral-900 tabular-nums tracking-tight">
                {summary.totalCount > 0 ? summary.averageRating.toFixed(1) : '—'}
              </span>
              <span className="text-xs text-neutral-500 font-mono">/ 5.0</span>
            </div>

            <div className="flex items-center gap-1 mt-2" aria-label={`Rated ${summary.averageRating} out of 5`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    summary.totalCount > 0 && star <= Math.round(summary.averageRating)
                      ? 'fill-[#e11b23] text-[#e11b23]'
                      : 'text-neutral-300'
                  }`}
                />
              ))}
            </div>
          </div>

          <p className="text-xs text-neutral-600 mt-4 font-mono tabular-nums">
            {summary.totalCount === 0
              ? 'No published reviews yet'
              : `${summary.totalCount} ${summary.totalCount === 1 ? 'review' : 'reviews'} · ${summary.verifiedCount} verified`}
          </p>
        </div>

        {/* Middle: Star Breakdown */}
        <div className="md:col-span-5 space-y-2 md:px-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.breakdown[star as 1 | 2 | 3 | 4 | 5] || 0;
            const pct = summary.totalCount > 0 ? Math.round((count / summary.totalCount) * 100) : 0;
            const isSelected = ratingFilter === star;
            return (
              <button
                key={star}
                type="button"
                onClick={() => setRatingFilter((prev) => (prev === star ? undefined : star))}
                className={`w-full flex items-center gap-2.5 text-xs group cursor-pointer py-0.5 transition ${
                  isSelected ? 'font-bold text-neutral-950' : 'text-neutral-600 hover:text-neutral-900'
                }`}
                title={`Filter by ${star} star reviews`}
              >
                <span className="w-8 text-left font-mono tabular-nums">{star} ★</span>
                <div className="flex-1 h-2 bg-neutral-200 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isSelected ? 'bg-[#e11b23]' : 'bg-neutral-900 group-hover:bg-[#e11b23]'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-right font-mono text-[11px] tabular-nums text-neutral-500">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Fit Consensus */}
        <div className="md:col-span-3 border-t md:border-t-0 md:border-l border-neutral-200 pt-5 md:pt-0 md:pl-6 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 font-semibold mb-3">
              Fit Consensus
            </div>
            {totalFitVotes === 0 ? (
              <p className="text-xs text-neutral-500 leading-relaxed">
                Share your size &amp; drape feedback after purchase to build fit consensus.
              </p>
            ) : (
              <div className="space-y-2.5">
                {(['RUNS_SMALL', 'TRUE_TO_SIZE', 'RUNS_LARGE'] as FitFeedback[]).map((fitKey) => {
                  const votes = summary.fitBreakdown[fitKey];
                  const pct = Math.round((votes / totalFitVotes) * 100);
                  return (
                    <div key={fitKey} className="text-xs">
                      <div className="flex justify-between text-neutral-700 mb-1">
                        <span>{FIT_LABELS[fitKey]}</span>
                        <span className="font-mono text-[11px] tabular-nums text-neutral-500">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-neutral-200 overflow-hidden">
                        <div className="h-full bg-neutral-900" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline Write a Review Form */}
      {isComposerOpen && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 p-5 sm:p-6 bg-white border border-neutral-900 space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-neutral-200">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Review {productName}</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Verified Buyer status is automatically confirmed against completed orders.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverRating || ratingInput) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRatingInput(star)}
                    className="p-1 cursor-pointer transition-transform hover:scale-110"
                    aria-label={`Rate ${star} stars`}
                  >
                    <Star
                      className={`w-5 h-5 ${
                        active ? 'fill-[#e11b23] text-[#e11b23]' : 'text-neutral-300'
                      }`}
                    />
                  </button>
                );
              })}
              <span className="ml-2 text-xs font-mono font-semibold text-neutral-700">
                {RATING_LABELS[hoverRating || ratingInput]}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-600 font-semibold mb-1.5">
                Your Name *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Aarav Nair"
                className="w-full px-3 py-2 border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-600 font-semibold mb-1.5">
                Order Email (Optional — verifies purchase)
              </label>
              <input
                type="email"
                value={reviewerEmail}
                onChange={(e) => setReviewerEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-600 font-semibold mb-1.5">
                Size Purchased
              </label>
              <select
                value={sizePurchased}
                onChange={(e) => setSizePurchased(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900 bg-white cursor-pointer"
              >
                {availableSizes.map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-600 font-semibold mb-1.5">
                How Did It Fit?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['RUNS_SMALL', 'TRUE_TO_SIZE', 'RUNS_LARGE'] as FitFeedback[]).map((fitOpt) => (
                  <button
                    key={fitOpt}
                    type="button"
                    onClick={() => setFitFeedback(fitOpt)}
                    className={`py-2 px-2 text-xs font-medium border transition cursor-pointer ${
                      fitFeedback === fitOpt
                        ? 'bg-[#111115] text-white border-[#111115]'
                        : 'bg-white text-neutral-700 border-neutral-300 hover:border-neutral-900'
                    }`}
                  >
                    {FIT_LABELS[fitOpt]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-600 font-semibold mb-1.5">
              Review Headline (Optional)
            </label>
            <input
              type="text"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Heavyweight 240 GSM drape and sharp puff print"
              className="w-full px-3 py-2 border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-600 font-semibold mb-1.5">
              Your Review *
            </label>
            <textarea
              required
              rows={3}
              minLength={10}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell others about the fabric weight, print detail, wash quality, and sizing..."
              className="w-full px-3 py-2 border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900 bg-white resize-y"
            />
          </div>

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsComposerOpen(false)}
              className="px-4 py-2 border border-neutral-300 text-xs font-semibold text-neutral-700 hover:text-neutral-950 hover:border-neutral-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-[#e11b23] hover:bg-[#c8161d] text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer disabled:opacity-60 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{submitting ? 'Publishing...' : 'Publish Review'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Filters & Sort Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-neutral-200 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {ratingFilter && (
            <button
              type="button"
              onClick={() => setRatingFilter(undefined)}
              className="text-xs font-mono text-[#e11b23] hover:underline cursor-pointer"
            >
              Clear {ratingFilter}★ Filter
            </button>
          )}

          <label className="inline-flex items-center gap-2 cursor-pointer text-neutral-700 select-none">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="accent-[#111115] w-3.5 h-3.5 cursor-pointer"
            />
            <span>Verified Buyers Only</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="pdp-reviews-sort" className="text-neutral-500 font-mono text-[11px] uppercase">
            Sort:
          </label>
          <select
            id="pdp-reviews-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'highest' | 'lowest')}
            className="px-2.5 py-1.5 border border-neutral-300 bg-white text-xs text-neutral-900 focus:outline-none focus:border-neutral-900 cursor-pointer"
          >
            <option value="recent">Most Recent</option>
            <option value="highest">Highest Rated</option>
            <option value="lowest">Lowest Rated</option>
          </select>
        </div>
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="py-10 flex items-center justify-center gap-2 text-xs text-neutral-500 font-mono">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading customer reviews...</span>
        </div>
      ) : loadError ? (
        <div className="py-8 text-center text-xs text-red-600">{loadError}</div>
      ) : reviews.length === 0 ? (
        <div className="py-12 text-center border-b border-neutral-200">
          <p className="text-sm font-semibold text-neutral-900">
            {ratingFilter || verifiedOnly
              ? 'No reviews match the selected filters.'
              : 'No reviews yet for this piece.'}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {ratingFilter || verifiedOnly
              ? 'Try clearing your filters to view all published feedback.'
              : 'Be the first to share how the fabric weight, print, and fit feel in person.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200">
          {reviews.map((rev) => (
            <article key={rev.id} className="py-6 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-0.5" aria-label={`${rev.rating} out of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                          star <= rev.rating
                            ? 'fill-[#e11b23] text-[#e11b23]'
                            : 'text-neutral-300'
                        }`}
                      />
                    ))}
                  </div>
                  {rev.isFeatured && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#e11b23] font-bold">
                      · Featured
                    </span>
                  )}
                </div>

                <time
                  dateTime={rev.createdAt}
                  className="text-[11px] font-mono text-neutral-500 tabular-nums"
                >
                  {formatDate(rev.createdAt)}
                </time>
              </div>

              {rev.title && (
                <h4 className="text-sm font-bold text-neutral-900 leading-snug">
                  {rev.title}
                </h4>
              )}

              <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed max-w-3xl whitespace-pre-line">
                {rev.comment}
              </p>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500 pt-1">
                <span className="font-semibold text-neutral-900">{rev.customerName}</span>
                {rev.verifiedPurchase && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Verified Buyer</span>
                    </span>
                  </>
                )}
                {rev.sizePurchased && (
                  <>
                    <span>·</span>
                    <span className="font-mono">Size {rev.sizePurchased}</span>
                  </>
                )}
                {rev.fitFeedback && FIT_LABELS[rev.fitFeedback] && (
                  <>
                    <span>·</span>
                    <span>Fit: {FIT_LABELS[rev.fitFeedback]}</span>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
