import React, { useState } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  Truck,
  AlertCircle,
  AlertTriangle,
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import { OrderDetails, CartItem } from '../types';
import { apiClient } from '../services/apiClient';

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  recentOrders: OrderDetails[];
  onCancelOrder?: (orderId: string, reason: string, cancelledItems?: CartItem[]) => Promise<{ success: boolean; error?: string } | void> | void;
  initialOrderId?: string;
}

interface LiveTrackingMeta {
  courierPartner: string | null;
  awb: string | null;
  estimatedDeliveryDate?: string | null;
  timeline: Array<{ title: string; timestamp?: string; note?: string }>;
  carrierEvents: Array<{ status?: string; location?: string; description?: string; timestamp?: string }>;
}

const CANCELLATION_REASONS = [
  'Ordered wrong size or color (want to reorder)',
  'Need to change delivery address or phone number',
  'Found another design in TORIWEAR catalog I prefer',
  'Delivery timeframe is too long for my schedule',
  'Placed order by mistake / duplicate order',
  'Payment or discount code issue',
  'Changed my mind / financial reasons',
  'Other reason'
];

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  isOpen,
  onClose,
  recentOrders,
  onCancelOrder,
  initialOrderId,
}) => {
  const [query, setQuery] = useState(() => initialOrderId ? initialOrderId.trim().toUpperCase() : '');
  const [verificationContact, setVerificationContact] = useState('');
  const [verificationPrompt, setVerificationPrompt] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [liveMeta, setLiveMeta] = useState<LiveTrackingMeta | null>(null);
  const [searchedOrder, setSearchedOrder] = useState<OrderDetails | null>(() => {
    if (!initialOrderId) return null;
    const clean = initialOrderId.trim().toUpperCase();
    return recentOrders.find(
      (o) => o.orderId.toUpperCase().includes(clean) || o.shippingAddress?.phone?.includes(clean)
    ) || null;
  });
  const [hasSearched, setHasSearched] = useState(() => !!initialOrderId);

  // Cancellation Workflow States
  const [showCancelFlow, setShowCancelFlow] = useState(false);
  const [selectedReason, setSelectedReason] = useState(CANCELLATION_REASONS[0]);
  const [customComment, setCustomComment] = useState('');
  const [selectedItemIndices, setSelectedItemIndices] = useState<number[]>([]);
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);
  const [cancelErrorMsg, setCancelErrorMsg] = useState<string | null>(null);

  const fetchLiveTracking = async (identifier: string, contactOverride?: string) => {
    const clean = identifier.trim();
    if (!clean) return;

    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);
    setVerificationPrompt(null);

    const contact = (contactOverride !== undefined ? contactOverride : verificationContact).trim();
    const isEmail = contact.includes('@');
    const localMatch = recentOrders.find(
      (o) => o.orderId.toUpperCase() === clean.toUpperCase() || o.shippingAddress?.phone?.includes(clean)
    );

    const res = await apiClient.trackOrder(clean, {
      phone: !isEmail && contact ? contact : undefined,
      email: isEmail ? contact : undefined,
      awbOnly: !clean.toUpperCase().startsWith('TORI-') && !clean.startsWith('ord-'),
    });

    setIsSearching(false);

    if (res.success && res.tracking) {
      const tr = res.tracking;
      const mappedOrder: OrderDetails = {
        orderId: tr.orderNumber || tr.orderId || clean,
        date: tr.timeline?.[0]?.timestamp || localMatch?.date || 'Placed',
        items: Array.isArray(tr.items) && tr.items.length > 0
          ? tr.items.map((it: any, idx: number) => ({
              product: localMatch?.items?.[idx]?.product || ({
                id: `item-${idx}`,
                name: it.productName || 'TORIWEAR Apparel',
                price: Number(it.unitPrice || 0),
                images: it.image ? [it.image] : [],
              } as any),
              size: it.size || 'M',
              color: it.color || 'Black',
              quantity: Number(it.quantity || 1),
            }))
          : (localMatch?.items || []),
        shippingAddress: {
          fullName: tr.customer?.name || localMatch?.shippingAddress?.fullName || 'Customer',
          email: tr.customer?.email || localMatch?.shippingAddress?.email || '',
          phone: tr.customer?.phone || localMatch?.shippingAddress?.phone || '',
          addressLine1: localMatch?.shippingAddress?.addressLine1 || '',
          city: tr.shippingAddress?.city || localMatch?.shippingAddress?.city || '',
          state: tr.shippingAddress?.state || localMatch?.shippingAddress?.state || '',
          pincode: tr.shippingAddress?.pincode || localMatch?.shippingAddress?.pincode || '',
        },
        paymentMethod: (String(tr.paymentMethod || 'cod').toLowerCase() as any),
        paymentDetails: localMatch?.paymentDetails || {},
        subtotal: Number(tr.totalAmount || 0),
        discount: 0,
        shipping: 0,
        total: Number(tr.totalAmount || 0),
        status: (
          String(tr.status || '').toUpperCase() === 'CANCELLED' ? 'Cancelled' :
          String(tr.status || '').toUpperCase() === 'DELIVERED' ? 'Delivered' :
          String(tr.status || '').toUpperCase() === 'SHIPPED' ? 'Shipped' : 'Confirmed'
        ) as any,
        estimatedDelivery: tr.estimatedDeliveryDate
          ? new Date(tr.estimatedDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : '3 to 5 Business Days',
      };
      setSearchedOrder(mappedOrder);
      setLiveMeta({
        courierPartner: tr.courierPartner || null,
        awb: tr.awb || null,
        estimatedDeliveryDate: tr.estimatedDeliveryDate || null,
        timeline: Array.isArray(tr.timeline) ? tr.timeline : [],
        carrierEvents: Array.isArray(tr.carrierEvents) ? tr.carrierEvents : [],
      });
      setSelectedItemIndices(mappedOrder.items.map((_, idx) => idx));
    } else if (res.code === 'VERIFICATION_REQUIRED') {
      setSearchedOrder(null);
      setLiveMeta(null);
      setVerificationPrompt(res.error || 'Enter the phone number or email linked to this order to view tracking.');
    } else {
      if (localMatch && localMatch.status === 'Cancelled') {
        setSearchedOrder(localMatch);
        setLiveMeta(null);
      } else {
        setSearchedOrder(null);
        setLiveMeta(null);
        setSearchError(res.error || `No orders found matching "${clean}".`);
      }
    }
  };

  // Auto-search if opened with a specific initialOrderId
  React.useEffect(() => {
    if (isOpen && initialOrderId) {
      const clean = initialOrderId.trim().toUpperCase();
      setQuery(clean);
      setShowCancelFlow(false);
      setCancelSuccessMsg(null);
      setCancelErrorMsg(null);
      fetchLiveTracking(clean);
    }
  }, [isOpen, initialOrderId]);

  // Keyboard shortcut (Escape) to close modal
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background page scrolling when tracking modal is open
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Search logic
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowCancelFlow(false);
    setCancelSuccessMsg(null);
    setCancelErrorMsg(null);
    const clean = query.trim();
    if (!clean) return;
    await fetchLiveTracking(clean);
  };

  // Execute Order Cancellation via backend API
  const handleConfirmCancellation = async () => {
    if (!searchedOrder) return;

    setIsProcessingCancel(true);
    setCancelErrorMsg(null);
    const fullReason = selectedReason + (customComment ? ` - ${customComment}` : '');

    let res: { success: boolean; error?: string } | void;
    if (onCancelOrder) {
      res = await onCancelOrder(searchedOrder.orderId, fullReason, searchedOrder.items);
    } else {
      res = await apiClient.cancelOrder(searchedOrder.orderId, fullReason);
    }

    setIsProcessingCancel(false);

    if (res && res.success === false) {
      setCancelErrorMsg(res.error || 'Unable to cancel this order.');
      return;
    }

    const nowStr = new Date().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const updatedOrder: OrderDetails = {
      ...searchedOrder,
      status: 'Cancelled',
      cancellationReason: fullReason,
      cancelledAt: nowStr,
      refundStatus: searchedOrder.paymentMethod === 'cod' ? 'Not Applicable (COD)' : 'Refund Initiated',
    };

    setSearchedOrder(updatedOrder);
    setShowCancelFlow(false);
    setCancelSuccessMsg(
      searchedOrder.paymentMethod === 'cod'
        ? `Order ${searchedOrder.orderId} has been cancelled.`
        : `Order ${searchedOrder.orderId} has been cancelled. Refund of ₹${searchedOrder.total} initiated.`
    );
  };

  // Toggle item selection for partial cancellation
  const toggleItemSelection = (index: number) => {
    setSelectedItemIndices((prev) => 
      prev.includes(index) 
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  return (
    <div 
      style={{ zIndex: 9999 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        id="order-tracking-modal"
        className="bg-[#101016] border border-neutral-800 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl my-auto animate-in zoom-in-95 max-h-[92vh] flex flex-col font-sans"
      >
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 bg-[#14141e] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center">
              <Truck className="w-4 h-4 text-[#FF2028]" />
            </div>
            <div>
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-white tracking-wide">
                TRACK YOUR ORDER
              </h3>
              <p className="text-[11px] font-mono text-neutral-400">Live courier tracking, dispatch updates & instant order cancellation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Close Tracking"
            title="Close Tracking (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Lookup Input Form */}
          <form onSubmit={handleSearch} className="space-y-2">
            <label className="block text-xs font-mono text-neutral-300">
              Enter Order ID (e.g. TORI-2026-XXXX) or AWB Tracking Number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="TORI-2026-... or AWB number"
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF2028] font-mono placeholder:text-neutral-600"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="px-5 py-2.5 bg-[#FF2028] hover:bg-[#e02441] disabled:opacity-50 text-white text-xs font-mono font-bold uppercase rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-600/20"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isSearching ? 'Searching...' : 'Track'}</span>
              </button>
            </div>

            {verificationPrompt && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2 text-xs font-mono">
                <div className="text-amber-300">{verificationPrompt}</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verificationContact}
                    onChange={(e) => setVerificationContact(e.target.value)}
                    placeholder="Enter phone number or email on order"
                    className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF2028]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Verify & View
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Cancellation Error Toast */}
          {cancelErrorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white">Cancellation Failed</div>
                <div className="text-[11px] text-neutral-300 mt-0.5 leading-relaxed">{cancelErrorMsg}</div>
              </div>
            </div>
          )}

          {/* Cancellation Success Feedback Toast */}
          {cancelSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white">Order Cancellation Confirmed</div>
                <div className="text-[11px] text-neutral-300 mt-0.5 leading-relaxed">{cancelSuccessMsg}</div>
              </div>
            </div>
          )}

          {/* Search Result */}
          {searchedOrder ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-4 animate-in fade-in">
              {/* Order Header & Status Badge */}
              <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3.5">
                <div>
                  <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">Order Reference</div>
                  <div className="font-heading text-lg sm:text-xl text-white font-bold">{searchedOrder.orderId}</div>
                  <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                    Placed: {searchedOrder.date} • Total: ₹{searchedOrder.total} ({searchedOrder.paymentMethod.toUpperCase()})
                  </div>
                </div>

                <div>
                  {searchedOrder.status === 'Cancelled' ? (
                    <span className="px-3 py-1.5 rounded-full bg-red-950/80 text-red-400 border border-red-600/60 text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm">
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                      <span>Cancelled</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{searchedOrder.status}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* PRODUCTS IN ORDER BREAKDOWN */}
              {searchedOrder.items && searchedOrder.items.length > 0 && (
                <div className="space-y-2 border-b border-neutral-800/80 pb-3.5">
                  <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Ordered Apparel ({searchedOrder.items.length} item{searchedOrder.items.length > 1 ? 's' : ''})</span>
                    <span className="text-[10px] text-neutral-500 font-mono">100% Cotton 240 GSM</span>
                  </div>

                  <div className="space-y-2">
                    {searchedOrder.items.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 text-xs"
                      >
                        <img 
                          src={item.product.images?.[0] || 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&q=80&w=300'} 
                          alt={item.product.name} 
                          className="w-12 h-12 rounded-lg object-cover bg-neutral-900 border border-neutral-800 shrink-0" 
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white truncate">{item.product.name}</div>
                          <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
                            Size: <strong className="text-neutral-200">{item.size}</strong> • Qty: {item.quantity} • {item.color}
                          </div>
                        </div>
                        <div className="text-right font-mono font-bold text-white shrink-0">
                          ₹{item.product.price * item.quantity}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TIMELINE / STATUS DISPLAY */}
              {searchedOrder.status === 'Cancelled' ? (
                /* Cancelled State Banner */
                <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-xs font-mono">
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>This order has been cancelled</span>
                  </div>

                  <div className="space-y-1 text-xs text-neutral-300 font-mono text-[11px]">
                    {searchedOrder.cancelledAt && (
                      <div>• Cancelled On: <span className="text-white">{searchedOrder.cancelledAt}</span></div>
                    )}
                    {searchedOrder.cancellationReason && (
                      <div>• Reason: <span className="text-neutral-200">{searchedOrder.cancellationReason}</span></div>
                    )}
                    <div>
                      • Refund Status: <span className="text-emerald-400 font-bold">{searchedOrder.refundStatus || 'Refund Initiated'}</span> (₹{searchedOrder.total})
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-neutral-800 text-[11px] text-neutral-400 leading-relaxed font-mono">
                    {searchedOrder.paymentMethod === 'cod' ? (
                      'Payment was selected as Cash on Delivery. No advance charges were deducted. Dispatch has been voided.'
                    ) : (
                      'A refund request has been recorded against your original payment method. Please allow 24–48 business hours for settlement.'
                    )}
                  </div>
                </div>
              ) : (
                /* Real Fulfillment & Carrier Timeline */
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-neutral-400">Courier Partner: </span>
                      <strong className="text-white">{liveMeta?.courierPartner || 'Pending courier assignment'}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-400">AWB: </span>
                      <strong className="text-red-400">{liveMeta?.awb || 'Awaiting AWB assignment'}</strong>
                    </div>
                  </div>

                  {(liveMeta?.timeline && liveMeta.timeline.length > 0 ? liveMeta.timeline : [
                    { title: `Order Status: ${searchedOrder.status}`, timestamp: searchedOrder.date, note: 'Awaiting carrier dispatch scan.' }
                  ]).map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-xs font-mono text-white">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold text-xs shrink-0">
                        ✓
                      </div>
                      <div>
                        <div className="font-bold">{step.title}</div>
                        <div className="text-[10px] text-neutral-500">
                          {step.timestamp || ''}{step.note ? ` • ${step.note}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}

                  {liveMeta?.carrierEvents && liveMeta.carrierEvents.length > 0 && (
                    <div className="pt-2 border-t border-neutral-800/80 space-y-1.5">
                      <div className="text-[10px] font-mono uppercase text-neutral-400 font-bold">Live Courier Scans</div>
                      {liveMeta.carrierEvents.map((ev, i) => (
                        <div key={i} className="text-[11px] font-mono text-neutral-300 flex items-center justify-between gap-2">
                          <span>{ev.status}{ev.location ? ` (${ev.location})` : ''}</span>
                          <span className="text-neutral-500 text-[10px]">{ev.timestamp || ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Destination Address */}
              <div className="pt-2 text-[11px] font-mono text-neutral-400 border-t border-neutral-800/80 flex items-center justify-between">
                <span>Destination: {searchedOrder.shippingAddress.city}, {searchedOrder.shippingAddress.state} ({searchedOrder.shippingAddress.pincode})</span>
              </div>

              {/* CANCELLATION ACTION PANEL / WORKFLOW TRIGGER */}
              {searchedOrder.status !== 'Cancelled' && (
                <div className="pt-2 border-t border-neutral-800 space-y-3">
                  {!showCancelFlow ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-[11px] text-neutral-400">
                        <span className="text-neutral-300 font-semibold block">Need to change or cancel this order?</span>
                        <span>Free cancellation with 100% instant refund guarantee.</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowCancelFlow(true)}
                        className="px-4 py-2.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-[#FF2028] border border-red-500/30 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
                      >
                        <XCircle className="w-4 h-4 text-[#FF2028]" />
                        <span>Cancel Order / Product</span>
                      </button>
                    </div>
                  ) : (
                    /* EXPANDED CANCELLATION WORKFLOW */
                    <div className="p-4 rounded-xl bg-neutral-950 border border-red-500/30 space-y-4 animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-white font-mono">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>Cancel Order Request</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCancelFlow(false)}
                          className="text-neutral-400 hover:text-white text-xs cursor-pointer"
                        >
                          ✕ Close
                        </button>
                      </div>

                      {/* Items to cancel */}
                      {searchedOrder.items.length > 1 && (
                        <div className="space-y-2">
                          <label className="block text-xs font-mono text-neutral-300">
                            Select Items to Cancel:
                          </label>
                          <div className="space-y-1.5">
                            {searchedOrder.items.map((item, idx) => (
                              <label 
                                key={idx} 
                                className="flex items-center gap-2 p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs cursor-pointer select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedItemIndices.includes(idx)}
                                  onChange={() => toggleItemSelection(idx)}
                                  className="w-4 h-4 rounded bg-neutral-950 border-neutral-700 text-[#FF2028] focus:ring-[#FF2028]"
                                />
                                <span className="font-semibold text-white">{item.product.name}</span>
                                <span className="text-neutral-400 font-mono ml-auto">₹{item.product.price * item.quantity}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Reason Selection */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-mono text-neutral-300">
                          Please select reason for cancellation: *
                        </label>
                        <select
                          value={selectedReason}
                          onChange={(e) => setSelectedReason(e.target.value)}
                          className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-[#FF2028] font-mono cursor-pointer"
                        >
                          {CANCELLATION_REASONS.map((reason, idx) => (
                            <option key={idx} value={reason} className="bg-neutral-900 text-white">
                              {reason}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Optional Note */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-mono text-neutral-300">
                          Additional Comments (optional):
                        </label>
                        <input
                          type="text"
                          value={customComment}
                          onChange={(e) => setCustomComment(e.target.value)}
                          placeholder="e.g. Need size XL instead of L..."
                          className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-[#FF2028] placeholder:text-neutral-600 font-mono"
                        />
                      </div>

                      {/* Refund Summary Card */}
                      <div className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between text-neutral-400">
                          <span>Refund Payable:</span>
                          <span className="text-emerald-400 font-bold text-sm">₹{searchedOrder.total} (100%)</span>
                        </div>
                        <div className="flex justify-between text-neutral-500 text-[11px]">
                          <span>Refund Method:</span>
                          <span className="text-neutral-300">
                            {searchedOrder.paymentMethod === 'cod' ? 'Cash on Delivery (No Charge)' : 'Original Payment Source (UPI/Card)'}
                          </span>
                        </div>
                        <div className="flex justify-between text-neutral-500 text-[11px]">
                          <span>Estimated Time:</span>
                          <span className="text-neutral-300">Immediate Authorization (24-48 hrs credit)</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isProcessingCancel}
                          onClick={handleConfirmCancellation}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-mono font-bold text-xs transition shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isProcessingCancel ? (
                            <span className="animate-pulse">Processing Cancellation...</span>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4" />
                              <span>Confirm & Cancel Order</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowCancelFlow(false)}
                          className="py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-mono transition cursor-pointer"
                        >
                          Keep My Order
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : hasSearched ? (
            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800 text-center space-y-2 text-xs font-mono text-neutral-400">
              <AlertCircle className="w-7 h-7 text-amber-400 mx-auto" />
              <div className="text-white font-bold">No orders found matching "{query}".</div>
              <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                {searchError || 'Please check the Order ID or AWB tracking number in your confirmation SMS/Email (e.g. TORI-2026-XXXXXX).'}
              </p>
            </div>
          ) : (
            recentOrders.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-xs font-mono uppercase text-neutral-400 font-semibold tracking-wider">
                  Your Recent Orders ({recentOrders.length}):
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {recentOrders.map((ord) => (
                    <div
                      key={ord.orderId}
                      className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 text-xs font-mono flex items-center justify-between gap-3 transition"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold">{ord.orderId}</span>
                          <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                            ord.status === 'Cancelled' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-emerald-950 text-emerald-400'
                          }`}>
                            {ord.status}
                          </span>
                        </div>
                        <span className="text-neutral-500 block text-[10px] mt-0.5 truncate">
                          {ord.date} • {ord.items.length || 1} item(s) • ₹{ord.total}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setQuery(ord.orderId);
                            setShowCancelFlow(false);
                            setCancelSuccessMsg(null);
                            setCancelErrorMsg(null);
                            fetchLiveTracking(
                              ord.orderId,
                              ord.shippingAddress?.phone || ord.shippingAddress?.email || ''
                            );
                          }}
                          className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono font-medium transition cursor-pointer"
                        >
                          Track →
                        </button>
                        {ord.status !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchedOrder(ord);
                              setLiveMeta(null);
                              setSelectedItemIndices(ord.items.map((_, idx) => idx));
                              setCancelSuccessMsg(null);
                              setCancelErrorMsg(null);
                              setShowCancelFlow(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-[#FF2028] text-xs font-mono transition cursor-pointer border border-red-500/30"
                            title="Cancel Order"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Customer Trust Footer Note */}
          <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80 flex items-center gap-3 text-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-[11px] text-neutral-400 leading-relaxed font-mono">
              <strong className="text-neutral-200">100% Free Cancellations & Easy Returns:</strong> You can cancel any confirmed order anytime prior to final delivery dispatch with no penalty.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
