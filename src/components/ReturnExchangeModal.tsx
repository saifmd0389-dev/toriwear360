import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  RotateCcw,
  Upload,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Trash2,
  Package,
  Truck,
  Sparkles,
  CreditCard,
  Wallet,
  ShieldCheck,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  OrderDetails,
  ReturnRequestRecord,
  ReturnStatusHistoryEntry,
} from '../types';
import { apiClient } from '../services/apiClient';

export interface CustomerReturnRequest {
  id: string;
  returnNumber?: string;
  orderId: string;
  orderNumber?: string;
  orderDate?: string;
  type: 'RETURN' | 'EXCHANGE';
  item: {
    productName: string;
    productImage?: string;
    size: string;
    color?: string;
    price: number;
    quantity: number;
    productId?: string;
  };
  exchangeDetails?: {
    newSize: string;
    newColor?: string;
  };
  reason: string;
  comments?: string;
  photos: string[];
  proofUrls?: string[];
  refundPreference?: 'WALLET_CREDIT' | 'ORIGINAL_PAYMENT';
  refundMethod?: string;
  refundTransactionId?: string | null;
  refundStatus?: string | null;
  refundedAmount?: number;
  pickupCourier?: string | null;
  pickupAwb?: string | null;
  pickupScheduledAt?: string | null;
  rejectionReason?: string | null;
  statusHistory?: ReturnStatusHistoryEntry[];
  pickupAddress: {
    fullName: string;
    phone: string;
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
  };
  status: string;
  createdAt: string;
  estimatedPickupDate?: string;
  refundAmount: number;
}

export function mapServerReturnToCustomerReturn(rec: ReturnRequestRecord): CustomerReturnRequest {
  const firstItem = rec.items && rec.items.length > 0 ? rec.items[0] : undefined;
  return {
    id: rec.id,
    returnNumber: rec.returnNumber,
    orderId: rec.orderNumber || rec.orderId,
    orderNumber: rec.orderNumber,
    type: rec.requestType === 'EXCHANGE' ? 'EXCHANGE' : 'RETURN',
    item: {
      productId: firstItem?.productId,
      productName: firstItem?.productName || 'TORI-WEAR Apparel',
      productImage: firstItem?.image || '/assets/toriwear-official-logo.png',
      size: firstItem?.size || 'L',
      color: firstItem?.color || 'Standard',
      price: Number(firstItem?.unitPrice || rec.refundAmount || 0),
      quantity: Number(firstItem?.quantity || 1),
    },
    exchangeDetails: rec.exchangeSize
      ? { newSize: rec.exchangeSize }
      : undefined,
    reason: rec.reason,
    comments: rec.comments,
    photos: Array.isArray(rec.proofUrls) ? rec.proofUrls : [],
    proofUrls: Array.isArray(rec.proofUrls) ? rec.proofUrls : [],
    refundMethod: rec.refundMethod,
    refundTransactionId: rec.refundTransactionId || rec.refundId || null,
    refundStatus: rec.refundStatus || null,
    refundedAmount: Number(rec.refundedAmount || 0),
    pickupCourier: rec.pickupCourier || rec.courierPartner || null,
    pickupAwb: rec.pickupAwb || rec.awbNumber || null,
    pickupScheduledAt: rec.pickupScheduledAt || null,
    rejectionReason: rec.rejectionReason || null,
    statusHistory: Array.isArray(rec.statusHistory) ? rec.statusHistory : [],
    pickupAddress: rec.pickupAddress || {
      fullName: rec.customerName,
      phone: rec.customerPhone,
      addressLine1: '',
      city: '',
      state: '',
      pincode: '',
    },
    status: rec.status,
    createdAt: new Date(rec.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    estimatedPickupDate: rec.pickupScheduledAt
      ? new Date(rec.pickupScheduledAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : undefined,
    refundAmount: Number(rec.refundAmount || 0),
  };
}

interface ReturnExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetails | null;
  initialItem?: any | null;
  onSuccess?: (returnRequest: CustomerReturnRequest) => void;
}

const REASONS = [
  { id: 'Wrong Size', label: 'Wrong Size / Fit Issue', description: 'Item is too loose, too tight, or fits differently than expected' },
  { id: 'Damaged', label: 'Damaged in Transit', description: 'Torn packaging, stains, or damage sustained during delivery' },
  { id: 'Wrong Product', label: 'Wrong Product Received', description: 'Received a completely different item or print' },
  { id: 'Product Defect', label: 'Defect / Stitching Issue', description: 'Loose seams, print misalignment, or broken hem' },
  { id: 'Fabric Quality Issue', label: 'Fabric / Quality Issue', description: 'Material texture or color mismatch' },
  { id: 'Other', label: 'Other / Change of Mind', description: 'No longer needed or other reason' },
] as const;

const AVAILABLE_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

interface UploadedProofItem {
  url: string;
  filename: string;
  previewDataUrl: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error(`Unable to read ${file.name}`));
    };
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function isOrderWithinReturnWindow(order: OrderDetails, returnWindowDays: number): boolean {
  const statusUpper = String(order.status || '').toUpperCase();
  if (statusUpper !== 'DELIVERED' && statusUpper !== 'RETURN REQUESTED' && statusUpper !== 'RETURN_REQUESTED') {
    return false;
  }
  const deliveredEntry = [...(order.timeline || [])]
    .reverse()
    .find((t) => String(t.status || t.title || '').toUpperCase().includes('DELIVERED'));
  const rawDate = deliveredEntry?.timestamp || order.date;
  if (!rawDate) return true;
  const parsed = new Date(rawDate).getTime();
  if (!Number.isFinite(parsed)) return true;
  const deadline = parsed + Math.max(1, returnWindowDays) * 24 * 60 * 60 * 1000;
  return Date.now() <= deadline;
}

export const ReturnExchangeModal: React.FC<ReturnExchangeModalProps> = ({
  isOpen,
  onClose,
  order,
  initialItem,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [requestType, setRequestType] = useState<'RETURN' | 'EXCHANGE'>('RETURN');
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);
  const [exchangeSize, setExchangeSize] = useState<string>('L');
  const [exchangeColor, setExchangeColor] = useState<string>('');
  const [reason, setReason] = useState<typeof REASONS[number]['id']>('Wrong Size');
  const [comments, setComments] = useState('');

  const [uploadedProofs, setUploadedProofs] = useState<UploadedProofItem[]>([]);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [refundPreference, setRefundPreference] = useState<'WALLET_CREDIT' | 'ORIGINAL_PAYMENT'>('ORIGINAL_PAYMENT');
  const [pickupAddress, setPickupAddress] = useState({
    fullName: '',
    phone: '',
    addressLine1: '',
    city: '',
    state: '',
    pincode: '',
  });

  const [returnWindowDays, setReturnWindowDays] = useState<number>(7);
  const [createdReturn, setCreatedReturn] = useState<CustomerReturnRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    apiClient.getStoreContact().then((res) => {
      if (active && res.success && res.data?.returnWindowDays) {
        setReturnWindowDays(Math.max(1, Number(res.data.returnWindowDays) || 7));
      }
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && order) {
      setStep(1);
      setRequestType('RETURN');
      setUploadedProofs([]);
      setUploadError(null);
      setSubmitError(null);
      setComments('');
      setCreatedReturn(null);

      const items = order.items || [];
      if (initialItem && items.length > 0) {
        const idx = items.findIndex(
          (it) => it.product?.id === initialItem.product?.id && it.size === initialItem.size
        );
        setSelectedItemIndex(idx >= 0 ? idx : 0);
      } else {
        setSelectedItemIndex(0);
      }

      setPickupAddress({
        fullName: order.shippingAddress?.fullName || 'Customer',
        phone: order.shippingAddress?.phone || '',
        addressLine1: order.shippingAddress?.addressLine1 || '',
        city: order.shippingAddress?.city || '',
        state: order.shippingAddress?.state || '',
        pincode: order.shippingAddress?.pincode || '',
      });

      const currentItem = items[0];
      const currentSize = currentItem?.size || 'L';
      setExchangeSize(currentSize === 'L' ? 'XL' : 'L');
      setExchangeColor(currentItem?.color || '');
      setRefundPreference(order.paymentMethod === 'cod' ? 'WALLET_CREDIT' : 'ORIGINAL_PAYMENT');
    }
  }, [isOpen, order, initialItem]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const currentItem = order.items && order.items.length > 0 ? order.items[selectedItemIndex] || order.items[0] : null;
  const itemPrice = currentItem?.product?.price || order.total || 0;
  const itemQty = currentItem?.quantity || 1;
  const refundTotal = itemPrice * itemQty;

  const isDelivered = String(order.status || '').toUpperCase() === 'DELIVERED';
  const isWithinWindow = isOrderWithinReturnWindow(order, returnWindowDays);
  const canInitiateReturn = isDelivered && isWithinWindow;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = '';

    setUploadError(null);
    setIsUploadingProof(true);

    try {
      const selectedFiles = Array.from(files).slice(0, Math.max(0, 6 - uploadedProofs.length));
      for (const file of selectedFiles) {
        if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) {
          setUploadError(`"${file.name}" is not a supported image format. Use PNG, JPG, or WEBP.`);
          continue;
        }
        if (file.size > MAX_PROOF_BYTES) {
          setUploadError(`"${file.name}" exceeds the 5 MB limit.`);
          continue;
        }

        const dataUrl = await readFileAsDataUrl(file);
        const uploadRes = await apiClient.uploadReturnProof({
          dataUrl,
          mimeType: file.type,
          filename: file.name,
          orderId: order.orderId,
        });

        if (!uploadRes.success || !uploadRes.data?.url) {
          setUploadError(uploadRes.error || `Failed to upload "${file.name}".`);
          continue;
        }

        setUploadedProofs((prev) => [
          ...prev,
          {
            url: uploadRes.data!.url,
            filename: uploadRes.data!.filename,
            previewDataUrl: dataUrl,
          },
        ]);
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Error uploading proof photo.');
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleRemovePhoto = (idx: number) => {
    setUploadedProofs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitReturn = async () => {
    if (!canInitiateReturn) {
      setSubmitError(`Returns are only eligible within ${returnWindowDays} days of delivery.`);
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const res = await apiClient.createReturnRequest({
        orderId: order.orderId,
        requestType,
        reason,
        comments: comments.trim() || undefined,
        proofUrls: uploadedProofs.map((p) => p.url),
        refundMethod:
          requestType === 'EXCHANGE'
            ? 'EXCHANGE'
            : refundPreference === 'WALLET_CREDIT'
              ? 'TORI_CREDIT'
              : order.paymentMethod === 'cod'
                ? 'BANK_UPI_MANUAL'
                : 'RAZORPAY',
        pickupAddress,
        exchangeProductId: requestType === 'EXCHANGE' ? currentItem?.product?.id : undefined,
        exchangeSize: requestType === 'EXCHANGE' ? exchangeSize : undefined,
        items: [
          {
            productId: currentItem?.product?.id || '',
            variantId: (currentItem as any)?.variantId,
            sku: currentItem?.product?.sku,
            productName: currentItem?.product?.name || 'TORI-WEAR Apparel',
            size: currentItem?.size || 'L',
            color: currentItem?.color || 'Standard',
            quantity: itemQty,
            unitPrice: itemPrice,
            image: currentItem?.product?.images?.[0],
          },
        ],
      });

      if (!res.success || !res.data) {
        setSubmitError(res.error || 'Could not submit return request. Please review order eligibility.');
        setIsSubmitting(false);
        return;
      }

      const mapped = mapServerReturnToCustomerReturn(res.data);
      setCreatedReturn(mapped);
      setStep(5);
      if (onSuccess) {
        onSuccess(mapped);
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Network failure submitting return request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{ zIndex: 10000 }}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="relative w-full max-w-2xl bg-[#0e0e16] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-950/80 border border-red-800/80 flex items-center justify-center text-red-400">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white text-base sm:text-lg font-bold font-sans">
                  {requestType === 'EXCHANGE' ? 'Exchange Item' : 'Return Item'}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                  Order #{order.orderId}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                Easy {returnWindowDays}-day doorstep return & replacement with photo verification
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Close Return/Exchange"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicators */}
        {step < 5 && (
          <div className="px-4 sm:px-6 py-2.5 bg-neutral-900/60 border-b border-neutral-800/80 flex items-center justify-between text-xs font-mono shrink-0">
            {[
              { num: 1, label: 'Type & Item' },
              { num: 2, label: 'Reason' },
              { num: 3, label: 'Photo Proof' },
              { num: 4, label: 'Refund & Pickup' },
            ].map((s, idx) => (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      step >= s.num ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-500'
                    }`}
                  >
                    {step > s.num ? '✓' : s.num}
                  </div>
                  <span
                    className={`hidden sm:inline text-[11px] font-medium ${
                      step >= s.num ? 'text-white' : 'text-neutral-500'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < 3 && <div className="h-0.5 flex-1 bg-neutral-800 mx-2" />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {!canInitiateReturn && step < 5 && (
            <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-700/70 text-amber-200 text-xs font-mono flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white mb-0.5">Return Window / Eligibility Notice</div>
                {!isDelivered
                  ? `Returns can only be requested after delivery. Current order status: ${order.status}.`
                  : `This order is outside our ${returnWindowDays}-day return window from delivery.`}
              </div>
            </div>
          )}

          {submitError && (
            <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs font-mono flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">{submitError}</div>
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-neutral-300 uppercase mb-2">
                  Select Action
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRequestType('RETURN')}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      requestType === 'RETURN'
                        ? 'bg-red-950/40 border-red-500/80 ring-1 ring-red-500/50'
                        : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-white text-sm font-bold font-sans flex items-center gap-1.5">
                        <RotateCcw className="w-4 h-4 text-red-400" />
                        Return & Refund
                      </span>
                      {requestType === 'RETURN' && <CheckCircle2 className="w-4 h-4 text-red-400" />}
                    </div>
                    <p className="text-[11px] text-neutral-400 font-mono">
                      Pickup from doorstep and refund via Razorpay or bank payout
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRequestType('EXCHANGE')}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      requestType === 'EXCHANGE'
                        ? 'bg-blue-950/40 border-blue-500/80 ring-1 ring-blue-500/50'
                        : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-white text-sm font-bold font-sans flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-blue-400" />
                        Exchange / Replace
                      </span>
                      {requestType === 'EXCHANGE' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                    </div>
                    <p className="text-[11px] text-neutral-400 font-mono">
                      Exchange for a different size or color with zero extra fees
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-neutral-300 uppercase mb-2">
                  Select Item to {requestType === 'EXCHANGE' ? 'Exchange' : 'Return'}
                </label>
                <div className="space-y-2">
                  {(order.items || []).map((item: any, idx: number) => {
                    const isSelected = selectedItemIndex === idx;
                    const img = item.product?.images?.[0] || '/assets/toriwear-official-logo.png';

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedItemIndex(idx)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-neutral-800/80 border-red-500/80 ring-1 ring-red-500/40'
                            : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-lg bg-neutral-950 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center">
                            <img
                              src={img}
                              alt={item.product?.name || 'Tori Wear'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = '/assets/toriwear-official-logo.png';
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-white text-xs sm:text-sm font-bold truncate">
                              {item.product?.name || 'Tori Wear Piece'}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-2 mt-0.5">
                              <span className="text-red-400">Size: {item.size || 'L'}</span>
                              <span>•</span>
                              <span>Color: {item.color || 'Standard'}</span>
                              <span>•</span>
                              <span>Qty: {item.quantity || 1}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-white text-xs font-mono font-bold">
                            ₹{((item.product?.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                            {order.status}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {requestType === 'EXCHANGE' && (
                <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-3">
                  <div className="text-xs font-mono font-bold text-blue-400 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Choose Replacement Preferences</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-neutral-300 mb-1.5">
                      New Requested Size:
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {AVAILABLE_SIZES.map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setExchangeSize(sz)}
                          className={`w-10 h-10 rounded-lg font-mono font-bold text-xs transition cursor-pointer ${
                            exchangeSize === sz
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-950/60 ring-2 ring-blue-400'
                              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-neutral-700'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-neutral-300 mb-1">
                      Preferred Color Variant (Optional):
                    </label>
                    <input
                      type="text"
                      value={exchangeColor}
                      onChange={(e) => setExchangeColor(e.target.value)}
                      placeholder="e.g. Same as original, or Obsidian Black"
                      className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-neutral-300 uppercase mb-2">
                  Select Reason for {requestType === 'EXCHANGE' ? 'Exchange' : 'Return'}
                </label>
                <div className="space-y-2">
                  {REASONS.map((r) => {
                    const isChecked = reason === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setReason(r.id)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                          isChecked
                            ? 'bg-red-950/30 border-red-500/80 ring-1 ring-red-500/40'
                            : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                            isChecked ? 'border-red-500 bg-red-600' : 'border-neutral-600 bg-neutral-900'
                          }`}
                        >
                          {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <div className="text-white text-xs sm:text-sm font-bold">{r.label}</div>
                          <div className="text-[11px] text-neutral-400 font-mono mt-0.5">{r.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-neutral-300 uppercase mb-1.5">
                  Additional Details or Notes (Optional)
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={3}
                  placeholder="Describe fit issue, transit damage, or defect details"
                  className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs font-mono focus:outline-none focus:border-red-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono font-bold text-neutral-300 uppercase">
                    Item Photo Proof (Secure Upload · Max 5 MB / Photo)
                  </label>
                  <span className="text-[11px] text-neutral-400 font-mono tabular-nums">
                    {uploadedProofs.length}/6 uploaded
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 font-mono mb-3">
                  Upload clear PNG, JPG, or WEBP photos of the item, brand tags, or defect. Images are stored privately for QC review only.
                </p>

                {uploadError && (
                  <div className="mb-3 p-2.5 rounded-lg bg-red-950/70 border border-red-800 text-red-200 text-[11px] font-mono flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={isUploadingProof || uploadedProofs.length >= 6}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 rounded-xl bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 disabled:opacity-50 text-white transition cursor-pointer flex items-center justify-center gap-3 shadow-sm group"
                >
                  <div className="w-9 h-9 rounded-lg bg-neutral-800 text-neutral-200 flex items-center justify-center group-hover:scale-105 transition">
                    {isUploadingProof ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </div>
                  <div className="text-left font-mono">
                    <div className="text-xs font-bold text-white">
                      {isUploadingProof ? 'Uploading Proof Image...' : 'Choose Image Files (PNG, JPG, WEBP)'}
                    </div>
                    <div className="text-[10px] text-neutral-400">Up to 6 photos • Max 5 MB each</div>
                  </div>
                </button>

                <div className="mt-4">
                  <div className="text-xs font-mono font-bold text-neutral-400 mb-2 tabular-nums">
                    Verified Proofs Attached ({uploadedProofs.length})
                  </div>

                  {uploadedProofs.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-neutral-800 text-center font-mono">
                      <ImageIcon className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                      <div className="text-neutral-400 text-xs font-bold">No photos uploaded yet</div>
                      <div className="text-neutral-600 text-[11px] mt-0.5">
                        Click "Choose Image Files" above to upload proof for faster QC approval
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {uploadedProofs.map((proof, pIdx) => (
                        <div
                          key={proof.filename}
                          className="relative aspect-square rounded-xl overflow-hidden border border-neutral-700 bg-neutral-900 group"
                        >
                          <img
                            src={proof.previewDataUrl}
                            alt={`Proof photo ${pIdx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(pIdx)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/80 hover:bg-red-600 text-white flex items-center justify-center transition cursor-pointer"
                            title="Remove photo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <div className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono text-emerald-300">
                            Uploaded ✓
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="space-y-4 font-mono">
              {requestType === 'RETURN' && (
                <div>
                  <label className="block text-xs font-bold text-neutral-300 uppercase mb-2">
                    Select Refund Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRefundPreference('ORIGINAL_PAYMENT')}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        refundPreference === 'ORIGINAL_PAYMENT'
                          ? 'bg-neutral-800/80 border-neutral-400 ring-1 ring-neutral-400'
                          : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-xs font-bold font-sans flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-blue-400" />
                          Original Payment Source
                        </span>
                        {refundPreference === 'ORIGINAL_PAYMENT' && <CheckCircle2 className="w-4 h-4 text-neutral-200" />}
                      </div>
                      <div className="text-[11px] text-white font-bold mt-1">
                        ₹{refundTotal.toLocaleString('en-IN')}
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1">
                        {order.paymentMethod === 'cod'
                          ? 'Manual UPI / Bank transfer settlement after warehouse QC'
                          : 'Refunded via Razorpay to original source upon QC verification'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRefundPreference('WALLET_CREDIT')}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        refundPreference === 'WALLET_CREDIT'
                          ? 'bg-emerald-950/40 border-emerald-500/80 ring-1 ring-emerald-500/50'
                          : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-xs font-bold font-sans flex items-center gap-1.5">
                          <Wallet className="w-4 h-4 text-emerald-400" />
                          Tori Store Credit / Bank UPI
                        </span>
                        {refundPreference === 'WALLET_CREDIT' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <div className="text-[11px] text-emerald-400 font-bold mt-1">
                        ₹{refundTotal.toLocaleString('en-IN')}
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1">
                        Fastest settlement after reverse pickup passes warehouse inspection
                      </p>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-neutral-300 uppercase mb-2">
                  Doorstep Pickup Address
                </label>
                <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-neutral-400 block mb-0.5">Contact Name</span>
                      <input
                        type="text"
                        value={pickupAddress.fullName}
                        onChange={(e) => setPickupAddress({ ...pickupAddress, fullName: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block mb-0.5">Phone Number</span>
                      <input
                        type="text"
                        value={pickupAddress.phone}
                        onChange={(e) => setPickupAddress({ ...pickupAddress, phone: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-neutral-400 block mb-0.5">Address</span>
                    <input
                      type="text"
                      value={pickupAddress.addressLine1}
                      onChange={(e) => setPickupAddress({ ...pickupAddress, addressLine1: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-neutral-400 block mb-0.5">City</span>
                      <input
                        type="text"
                        value={pickupAddress.city}
                        onChange={(e) => setPickupAddress({ ...pickupAddress, city: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block mb-0.5">State</span>
                      <input
                        type="text"
                        value={pickupAddress.state}
                        onChange={(e) => setPickupAddress({ ...pickupAddress, state: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block mb-0.5">PIN Code</span>
                      <input
                        type="text"
                        value={pickupAddress.pincode}
                        onChange={(e) => setPickupAddress({ ...pickupAddress, pincode: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Item:</span>
                  <span className="text-white font-bold truncate max-w-[240px]">
                    {currentItem?.product?.name || 'Tori Wear Piece'} ({currentItem?.size || 'L'})
                  </span>
                </div>
                {requestType === 'EXCHANGE' && (
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>Exchanging For:</span>
                    <span className="text-blue-400 font-bold">
                      Size: {exchangeSize} {exchangeColor ? `• ${exchangeColor}` : ''}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Reason:</span>
                  <span className="text-neutral-200">{reason}</span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Uploaded Proof Photos:</span>
                  <span className="text-neutral-200">{uploadedProofs.length} photo(s)</span>
                </div>
                {requestType === 'RETURN' && (
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-800 font-bold">
                    <span className="text-white">Eligible Refund Value:</span>
                    <span className="text-emerald-400">₹{refundTotal.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && createdReturn && (
            <div className="py-4 text-center space-y-4 font-mono">
              <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-600/80 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-950/60">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-white text-lg font-bold font-sans">
                  {createdReturn.type === 'EXCHANGE' ? 'Exchange Request Submitted!' : 'Return Request Submitted!'}
                </h4>
                <div className="text-xs text-neutral-400 mt-1">
                  Reference Number: <span className="text-red-400 font-bold">{createdReturn.returnNumber || createdReturn.id}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 text-left space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Order Reference:</span>
                  <span className="text-white font-bold">#{createdReturn.orderId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Request Status:</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                    {createdReturn.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Reverse Pickup:</span>
                  <span className="text-neutral-200 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-blue-400" />
                    Scheduled after review & approval
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400 text-left flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Please keep the apparel folded in its original polybag with brand tags intact. You can track real-time review, pickup AWB, and refund settlement inside Order History.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-neutral-800 flex items-center justify-between bg-neutral-950/90 shrink-0">
          {step > 1 && step < 5 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev - 1) as any)}
              className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 && (
            <button
              type="button"
              disabled={!canInitiateReturn || isUploadingProof}
              onClick={() => setStep((prev) => (prev + 1) as any)}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-red-950/60"
            >
              <span>Continue</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 4 && (
            <button
              type="button"
              disabled={isSubmitting || !canInitiateReturn}
              onClick={handleSubmitReturn}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-mono font-bold transition cursor-pointer flex items-center gap-2 shadow-lg shadow-red-950/60"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit {requestType === 'EXCHANGE' ? 'Exchange' : 'Return'} Request</span>
                </>
              )}
            </button>
          )}

          {step === 5 && (
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-emerald-950/60"
            >
              <span>Back to Order History</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
