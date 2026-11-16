import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  RotateCcw,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Trash2,
  Package,
  Truck,
  Sparkles,
  CreditCard,
  Wallet,
  ShieldCheck,
  Video,
  VideoOff,
  Image as ImageIcon
} from 'lucide-react';
import { OrderDetails } from '../types';

export interface CustomerReturnRequest {
  id: string;
  orderId: string;
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
  reason: 'Wrong Size' | 'Damaged' | 'Wrong Product' | 'Product Defect' | 'Fabric Quality Issue' | 'Other';
  comments?: string;
  photos: string[];
  refundPreference?: 'WALLET_CREDIT' | 'ORIGINAL_PAYMENT';
  pickupAddress: {
    fullName: string;
    phone: string;
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
  };
  status: 'REQUESTED' | 'APPROVED' | 'PICKUP_SCHEDULED' | 'PRODUCT_RECEIVED' | 'QC_PASSED' | 'REFUNDED' | 'EXCHANGED';
  createdAt: string;
  estimatedPickupDate?: string;
  refundAmount: number;
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

const AVAILABLE_SIZES = ['S', 'M', 'L', 'XL', '2XL'];

export const ReturnExchangeModal: React.FC<ReturnExchangeModalProps> = ({
  isOpen,
  onClose,
  order,
  initialItem,
  onSuccess
}) => {
  // Wizard steps: 1: Type & Item, 2: Reason, 3: Photos (Camera/Upload), 4: Pickup & Refund, 5: Success
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [requestType, setRequestType] = useState<'RETURN' | 'EXCHANGE'>('RETURN');
  
  // Selected line item
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);
  
  // Exchange preference
  const [exchangeSize, setExchangeSize] = useState<string>('L');
  const [exchangeColor, setExchangeColor] = useState<string>('');

  // Reason & comment
  const [reason, setReason] = useState<typeof REASONS[number]['id']>('Wrong Size');
  const [comments, setComments] = useState('');

  // Photos captured/uploaded
  const [photos, setPhotos] = useState<string[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Refund preference & Pickup address
  const [refundPreference, setRefundPreference] = useState<'WALLET_CREDIT' | 'ORIGINAL_PAYMENT'>('WALLET_CREDIT');
  const [pickupAddress, setPickupAddress] = useState({
    fullName: '',
    phone: '',
    addressLine1: '',
    city: '',
    state: '',
    pincode: '',
  });

  // Generated return response
  const [createdReturn, setCreatedReturn] = useState<CustomerReturnRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // References for live camera & file inputs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Set default values when modal opens or order changes
  useEffect(() => {
    if (isOpen && order) {
      setStep(1);
      setRequestType('RETURN');
      setPhotos([]);
      setComments('');
      setCameraError(null);
      stopCameraStream();

      // Find item index if initialItem provided
      const items = order.items || [];
      if (initialItem && items.length > 0) {
        const idx = items.findIndex(
          (it) => it.product?.id === initialItem.product?.id && it.size === initialItem.size
        );
        setSelectedItemIndex(idx >= 0 ? idx : 0);
      } else {
        setSelectedItemIndex(0);
      }

      // Default pickup address from order shipping address
      setPickupAddress({
        fullName: order.shippingAddress?.fullName || 'Customer',
        phone: order.shippingAddress?.phone || '',
        addressLine1: order.shippingAddress?.addressLine1 || '',
        city: order.shippingAddress?.city || 'Visakhapatnam',
        state: order.shippingAddress?.state || 'Andhra Pradesh',
        pincode: order.shippingAddress?.pincode || '530018',
      });

      // Default exchange size to something different from current size
      const currentItem = items[0];
      const currentSize = currentItem?.size || 'L';
      const altSize = currentSize === 'L' ? 'XL' : 'L';
      setExchangeSize(altSize);
      setExchangeColor(currentItem?.color || 'Original Color');
    }
  }, [isOpen, order, initialItem]);

  // Clean up camera on unmount or modal close
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Prevent background page scrolling when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Capture Escape key specifically for this modal without bubbling to parent account modal
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

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  if (!isOpen || !order) return null;

  const currentItem = order.items && order.items.length > 0 ? order.items[selectedItemIndex] || order.items[0] : null;
  const itemPrice = currentItem?.product?.price || order.total || 1199;
  const itemQty = currentItem?.quantity || 1;
  const refundTotal = itemPrice * itemQty;

  // Handle live webcam start
  const handleStartLiveCamera = async () => {
    try {
      setCameraError(null);
      stopCameraStream();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Live camera stream not available:', err);
      setCameraError('Direct webcam preview could not be opened. You can still use the "Take Photo with Device Camera" button below.');
      setCameraActive(false);
    }
  };

  // Capture photo from live webcam
  const handleCaptureLiveSnapshot = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPhotos((prev) => [...prev, dataUrl]);
      }
    } catch (err) {
      console.error('Snapshot failed', err);
    }
  };

  // Handle photo file input (both device camera capture & file gallery)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotos((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input so user can pick the same file or take another photo
    e.target.value = '';
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submission handler
  const handleSubmitReturn = () => {
    setIsSubmitting(true);
    stopCameraStream();

    const returnId = `RET-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const pickupDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const newReturn: CustomerReturnRequest = {
      id: returnId,
      orderId: order.orderId,
      orderDate: order.date,
      type: requestType,
      item: {
        productName: currentItem?.product?.name || 'Tori Wear Apparel',
        productImage: currentItem?.product?.images?.[0] || '/assets/toriwear-official-logo.png',
        size: currentItem?.size || 'L',
        color: currentItem?.color || 'Standard',
        price: itemPrice,
        quantity: itemQty,
        productId: currentItem?.product?.id,
      },
      exchangeDetails: requestType === 'EXCHANGE' ? {
        newSize: exchangeSize,
        newColor: exchangeColor,
      } : undefined,
      reason,
      comments: comments.trim() || undefined,
      photos,
      refundPreference: requestType === 'RETURN' ? refundPreference : undefined,
      pickupAddress,
      status: 'REQUESTED',
      createdAt: formattedDate,
      estimatedPickupDate: pickupDate,
      refundAmount: refundTotal,
    };

    // 1. Save in local customer returns storage
    try {
      const stored = localStorage.getItem('toriwear_customer_returns');
      const list: CustomerReturnRequest[] = stored ? JSON.parse(stored) : [];
      list.unshift(newReturn);
      localStorage.setItem('toriwear_customer_returns', JSON.stringify(list));
    } catch (e) {
      console.error('Error saving return request', e);
    }

    // 2. Also sync to admin returnRequests storage so store owners see it in admin panel
    try {
      const storedAdmin = localStorage.getItem('returnRequests');
      const adminList = storedAdmin ? JSON.parse(storedAdmin) : [];
      adminList.unshift({
        id: newReturn.id,
        orderId: newReturn.orderId,
        orderNumber: newReturn.orderId,
        customerName: pickupAddress.fullName,
        customerEmail: order.shippingAddress?.email || 'customer@toriwear.com',
        customerPhone: pickupAddress.phone,
        productName: newReturn.item.productName,
        size: newReturn.item.size,
        reason: (newReturn.reason === 'Fabric Quality Issue' ? 'Product Defect' : newReturn.reason) as any,
        status: 'REQUESTED',
        refundAmount: newReturn.refundAmount,
        date: newReturn.createdAt,
        notes: `${newReturn.type} requested. Reason: ${newReturn.reason}. ${newReturn.comments || ''}`
      });
      localStorage.setItem('returnRequests', JSON.stringify(adminList));
    } catch (e) {
      console.error('Error syncing return request to admin storage', e);
    }

    setTimeout(() => {
      setIsSubmitting(false);
      setCreatedReturn(newReturn);
      setStep(5);
      if (onSuccess) {
        onSuccess(newReturn);
      }
    }, 700);
  };

  return (
    <div 
      style={{ zIndex: 10000 }}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      {/* Hidden file inputs for Camera and Gallery */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
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
                Easy 7-day doorstep return & replacement with photo verification
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Close Return/Exchange"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicators (Step 1 to 4) */}
        {step < 5 && (
          <div className="px-4 sm:px-6 py-2.5 bg-neutral-900/60 border-b border-neutral-800/80 flex items-center justify-between text-xs font-mono shrink-0">
            {[
              { num: 1, label: 'Type & Item' },
              { num: 2, label: 'Reason' },
              { num: 3, label: 'Photos / Camera' },
              { num: 4, label: 'Refund & Pickup' },
            ].map((s, idx) => (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      step >= s.num
                        ? 'bg-red-600 text-white'
                        : 'bg-neutral-800 text-neutral-500'
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

        {/* Body Content - Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* ========================================================
              STEP 1: REQUEST TYPE & ITEM SELECTION
             ======================================================== */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Type Toggle: Return vs Exchange */}
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
                      Pickup from doorstep and refund to wallet or source account
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

              {/* Item Selection */}
              <div>
                <label className="block text-xs font-mono font-bold text-neutral-300 uppercase mb-2">
                  Select Item to {requestType === 'EXCHANGE' ? 'Exchange' : 'Return'}
                </label>
                <div className="space-y-2">
                  {(order.items && order.items.length > 0 ? order.items : [
                    {
                      product: {
                        name: 'Shadow Monarch Oversized Streetwear Tee',
                        franchise: 'Solo Leveling',
                        images: ['/assets/toriwear-official-logo.png'],
                        price: order.total || 1199,
                      },
                      size: 'L',
                      color: 'Obsidian Black',
                      quantity: 1,
                    }
                  ]).map((item: any, idx: number) => {
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
                              <span className="text-red-400">Current Size: {item.size || 'L'}</span>
                              <span>•</span>
                              <span>Color: {item.color || 'Standard'}</span>
                              <span>•</span>
                              <span>Qty: {item.quantity || 1}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-white text-xs font-mono font-bold">
                            ₹{((item.product?.price || 1199) * (item.quantity || 1)).toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                            Delivered
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* If Exchange: Select New Desired Size & Color */}
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
                    <div className="flex items-center gap-2">
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
                      Preferred Color / Style Variant (Optional):
                    </label>
                    <input
                      type="text"
                      value={exchangeColor}
                      onChange={(e) => setExchangeColor(e.target.value)}
                      placeholder="e.g. Same as original, or Obsidian Black, Cyber Red"
                      className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              STEP 2: REASON SELECTION & COMMENTS
             ======================================================== */}
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
                            isChecked
                              ? 'border-red-500 bg-red-600'
                              : 'border-neutral-600 bg-neutral-900'
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
                  placeholder="Tell us what went wrong (e.g. chest fit was tighter than size chart, stitching pull near sleeve, etc.)"
                  className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs font-mono focus:outline-none focus:border-red-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* ========================================================
              STEP 3: PHOTO UPLOAD VIA CAMERA & FILE UPLOAD
             ======================================================== */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono font-bold text-neutral-300 uppercase">
                    Item Photo Proof (Camera or Upload)
                  </label>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    {photos.length} photo{photos.length !== 1 ? 's' : ''} added
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 font-mono mb-3">
                  Upload clear photos of the item, tags, or defect area. You can take a live photo using your phone/webcam camera or choose files from your device.
                </p>

                {/* Primary Action Buttons: Device Camera & Gallery Upload */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {/* Take Photo with Device Camera */}
                  <button
                    type="button"
                    onClick={() => {
                      // Trigger native device camera input
                      if (cameraInputRef.current) {
                        cameraInputRef.current.click();
                      }
                    }}
                    className="p-3.5 rounded-xl bg-neutral-900 border border-red-500/50 hover:bg-neutral-800/90 text-white transition cursor-pointer flex items-center justify-center gap-2.5 shadow-sm group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-600/30 text-red-400 flex items-center justify-center group-hover:scale-105 transition">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div className="text-left font-mono">
                      <div className="text-xs font-bold text-white">Device Camera</div>
                      <div className="text-[10px] text-neutral-400">Snap directly with camera</div>
                    </div>
                  </button>

                  {/* Upload from Gallery / Files */}
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.click();
                      }
                    }}
                    className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white transition cursor-pointer flex items-center justify-center gap-2.5 shadow-sm group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-neutral-800 text-neutral-300 flex items-center justify-center group-hover:scale-105 transition">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="text-left font-mono">
                      <div className="text-xs font-bold text-white">Choose Files</div>
                      <div className="text-[10px] text-neutral-400">Upload from photo gallery</div>
                    </div>
                  </button>
                </div>

                {/* Optional Live Webcam Viewfinder */}
                <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-neutral-300 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-red-400" />
                      In-Browser Live Webcam Preview
                    </span>
                    {!cameraActive ? (
                      <button
                        type="button"
                        onClick={handleStartLiveCamera}
                        className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-mono font-bold transition cursor-pointer"
                      >
                        Start Live Stream
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopCameraStream}
                        className="px-2.5 py-1 rounded bg-red-950 text-red-400 hover:bg-red-900 text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1"
                      >
                        <VideoOff className="w-3 h-3" />
                        Stop Stream
                      </button>
                    )}
                  </div>

                  {cameraError && (
                    <div className="p-2 rounded bg-amber-950/40 border border-amber-800 text-amber-300 text-[11px] font-mono flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  {cameraActive && (
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-neutral-800">
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        playsInline
                        muted
                      />
                      <button
                        type="button"
                        onClick={handleCaptureLiveSnapshot}
                        className="absolute bottom-3 px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs shadow-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Snap Photo</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Uploaded / Snapped Photos Preview Gallery */}
                <div className="mt-4">
                  <div className="text-xs font-mono font-bold text-neutral-400 mb-2">
                    Photos Attached ({photos.length})
                  </div>

                  {photos.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-neutral-800 text-center font-mono">
                      <ImageIcon className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                      <div className="text-neutral-400 text-xs font-bold">No photos attached yet</div>
                      <div className="text-neutral-600 text-[11px] mt-0.5">
                        Click "Device Camera" or "Choose Files" above to add photo proof
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {photos.map((photo, pIdx) => (
                        <div
                          key={pIdx}
                          className="relative aspect-square rounded-xl overflow-hidden border border-neutral-700 bg-neutral-900 group"
                        >
                          <img
                            src={photo}
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
                          <div className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-neutral-300">
                            Photo #{pIdx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              STEP 4: REFUND METHOD & PICKUP ADDRESS
             ======================================================== */}
          {step === 4 && (
            <div className="space-y-4 font-mono">
              {/* Refund Method (Only for Returns) */}
              {requestType === 'RETURN' && (
                <div>
                  <label className="block text-xs font-bold text-neutral-300 uppercase mb-2">
                    Select Refund Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                          Tori Store Credit + 5% Bonus
                        </span>
                        {refundPreference === 'WALLET_CREDIT' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                      <div className="text-[11px] text-emerald-400 font-bold mt-1">
                        ₹{(refundTotal * 1.05).toFixed(0)} credited instantly
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1">
                        Instant credit on courier pickup with extra 5% shopping boost
                      </p>
                    </button>

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
                        {refundPreference === 'ORIGINAL_PAYMENT' && (
                          <CheckCircle2 className="w-4 h-4 text-neutral-200" />
                        )}
                      </div>
                      <div className="text-[11px] text-white font-bold mt-1">
                        ₹{refundTotal.toLocaleString('en-IN')}
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1">
                        Refunded to {order.paymentMethod?.toUpperCase() || 'Bank / Card'} within 3-5 days
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Doorstep Pickup Address */}
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

              {/* Request Summary Card */}
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Item:</span>
                  <span className="text-white font-bold truncate max-w-[200px]">
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
                  <span>Photos Attached:</span>
                  <span className="text-neutral-200">{photos.length} photo(s)</span>
                </div>
                {requestType === 'RETURN' && (
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-800 font-bold">
                    <span className="text-white">Estimated Refund:</span>
                    <span className="text-emerald-400">₹{refundTotal.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              STEP 5: CONFIRMATION & SUCCESS SCREEN
             ======================================================== */}
          {step === 5 && createdReturn && (
            <div className="py-4 text-center space-y-4 font-mono">
              <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-600/80 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-950/60 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-white text-lg font-bold font-sans">
                  {createdReturn.type === 'EXCHANGE' ? 'Exchange Request Placed!' : 'Return Request Initiated!'}
                </h4>
                <div className="text-xs text-neutral-400 mt-1">
                  Reference Request ID: <span className="text-red-400 font-bold">{createdReturn.id}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 text-left space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Order Reference:</span>
                  <span className="text-white font-bold">#{createdReturn.orderId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Scheduled Pickup:</span>
                  <span className="text-neutral-200">{createdReturn.estimatedPickupDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Pickup Courier:</span>
                  <span className="text-neutral-200 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-blue-400" />
                    BlueDart Express Reverse Logistics
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Current Status:</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                    Pickup Scheduled
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400 text-left flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Please keep the apparel folded in its original polybag with brand tags intact. The pickup agent will scan the barcode on doorstep arrival.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="p-4 sm:p-5 border-t border-neutral-800 flex items-center justify-between bg-neutral-950/90 shrink-0">
          {step > 1 && step < 5 ? (
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                setStep((prev) => (prev - 1) as any);
              }}
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
              onClick={() => {
                stopCameraStream();
                setStep((prev) => (prev + 1) as any);
              }}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-red-950/60"
            >
              <span>Continue</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 4 && (
            <button
              type="button"
              disabled={isSubmitting}
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
              onClick={() => {
                stopCameraStream();
                onClose();
              }}
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
