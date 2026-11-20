import React, { useState, useEffect } from 'react';
import { CartItem, PaymentMethodType, ShippingAddress, OrderDetails } from '../types';
import { apiClient } from '../services/apiClient';
import {
  X,
  ShieldCheck,
  Lock,
  CreditCard,
  QrCode,
  Smartphone,
  Building2,
  Banknote,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Printer,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { trackMetaEvent } from '../utils/metaPixel';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  discount: number;
  discountCode?: string;
  shipping: number;
  total: number;
  onOrderPlaced: (order: OrderDetails) => void;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Delhi NCR', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  discountCode,
  total,
  onOrderPlaced,
}) => {
  const [step, setStep] = useState<'address' | 'payment' | 'processing' | 'confirmed'>('address');
  
  // Shipping Form State
  const [address, setAddress] = useState<ShippingAddress>({
    fullName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: 'Maharashtra',
    pincode: '',
  });

  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ShippingAddress, string>>>({});

  // Payment Method State (defaults to COD until gateway availability is confirmed)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cod');
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = useState<boolean | null>(null);
  const [upiOption, setUpiOption] = useState<'qr' | 'id'>('qr');
  const [upiId, setUpiId] = useState('');
  
  // Card State
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // Netbanking State
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');

  // Confirmed Order Info
  const [confirmedOrder, setConfirmedOrder] = useState<OrderDetails | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch('/api/v1/payments/razorpay/public-key')
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        const enabled = Boolean(data?.success && data?.enabled && data?.keyId);
        setOnlinePaymentsEnabled(enabled);
        if (!enabled) {
          setPaymentMethod('cod');
        }
      })
      .catch(() => {
        if (!active) return;
        setOnlinePaymentsEnabled(false);
        setPaymentMethod('cod');
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background page scrolling when checkout modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const validateAddress = () => {
    const errors: Partial<Record<keyof ShippingAddress, string>> = {};
    if (!address.fullName.trim()) errors.fullName = 'Full name is required';
    if (!address.email.trim() || !/\S+@\S+\.\S+/.test(address.email)) errors.email = 'Valid email required';
    if (!address.phone.trim() || !/^\d{10}$/.test(address.phone.replace(/\D/g, ''))) errors.phone = 'Valid 10-digit mobile number required';
    if (!address.addressLine1.trim()) errors.addressLine1 = 'Delivery street address required';
    if (!address.city.trim()) errors.city = 'City required';
    if (!address.pincode.trim() || !/^\d{6}$/.test(address.pincode.trim())) errors.pincode = 'Valid 6-digit PIN code required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFillDemoAddress = () => {
    setAddress({
      fullName: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      phone: '9876543210',
      addressLine1: 'Flat 402, Neo Tokyo Heights, Linking Road',
      addressLine2: 'Near Bandra West Metro',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
    });
    setFormErrors({});
  };

  const handleFillDemoCard = () => {
    setCardNumber('4532 8921 7734 9012');
    setCardExpiry('12/28');
    setCardCvv('889');
    setCardName(address.fullName || 'AARAV SHARMA');
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateAddress()) {
      setStep('payment');
    }
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const finishPlacingOrder = async (orderPayload: any) => {
    const res = await apiClient.createOrder(orderPayload);

    if (res.success && res.order) {
      const serverOrder = res.order;
      const cleanOrderId = serverOrder.orderNumber ? serverOrder.orderNumber.replace(/^#/, '') : serverOrder.id;

      const order: OrderDetails = {
        orderId: cleanOrderId,
        date: new Date(serverOrder.createdAt || Date.now()).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        items,
        shippingAddress: address,
        paymentMethod,
        paymentDetails: {
          upiId: paymentMethod === 'upi' ? (upiOption === 'id' ? upiId || 'customer@okaxis' : 'Paid via Dynamic QR') : undefined,
          cardLast4: paymentMethod === 'card' ? (cardNumber.replace(/\s+/g, '').slice(-4) || '9012') : undefined,
          bankName: paymentMethod === 'netbanking' ? selectedBank : undefined,
          isCod: paymentMethod === 'cod',
          razorpayPaymentId: orderPayload.paymentId,
        },
        subtotal: serverOrder.subtotal,
        discount: serverOrder.discount,
        discountCode: serverOrder.discountCode,
        shipping: serverOrder.shippingFee,
        total: serverOrder.total,
        status: 'Confirmed',
        estimatedDelivery: '3 to 5 Business Days',
      };

      setConfirmedOrder(order);
      onOrderPlaced(order);
      setStep('confirmed');

      trackMetaEvent('Purchase', {
        orderId: cleanOrderId,
        value: Number(order.total || 0),
        currency: 'INR',
        contentIds: items.map((it) => it.product.id),
        numItems: items.reduce((s, it) => s + (it.quantity || 1), 0),
        userData: { email: address.email, phone: address.phone },
      });

      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FF2028', '#ffffff', '#a855f7', '#3b82f6'],
        });
      } catch (err) {
        // Safe fallback
      }
    } else {
      setServerError(res.error || 'Server rejected order. Please check item stock.');
      setStep('payment');
    }
  };

  const handleExecutePayment = async () => {
    setStep('processing');
    setServerError(null);

    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `ord_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      const orderPayload = {
        customerName: address.fullName.trim(),
        customerEmail: address.email.trim(),
        customerPhone: address.phone.trim(),
        shippingAddress: address,
        items: items.map((it) => ({
          productId: it.product.id,
          size: it.size,
          color: it.color,
          quantity: it.quantity,
        })),
        couponCode: discountCode || undefined,
        paymentMethod: paymentMethod.toUpperCase(),
        idempotencyKey,
      };

      // 1. Cash on Delivery direct confirmation
      if (paymentMethod === 'cod') {
        await finishPlacingOrder({ ...orderPayload, paymentMethod: 'COD' });
        return;
      }

      // 2. Online Payment (Razorpay Standard Checkout Lifecycle)
      // Pre-flight check before creating order so we don't strand unpaid orders if gateway is disabled
      const rzpKeyRes = await fetch('/api/v1/payments/razorpay/public-key').then(r => r.json()).catch(() => null);
      const isGatewayEnabled = Boolean(rzpKeyRes?.success && rzpKeyRes?.enabled && rzpKeyRes?.keyId);
      if (!isGatewayEnabled) {
        setServerError('Online payments via Razorpay are not configured/enabled yet. Please use Cash on Delivery (COD) or configure Razorpay credentials in Admin Settings.');
        setStep('payment');
        return;
      }

      // Step A: Create application order in PENDING_PAYMENT state with 15-min stock hold
      const createOrderRes = await apiClient.createOrder(orderPayload);
      if (!createOrderRes.success || !createOrderRes.order) {
        setServerError(createOrderRes.error || 'Server rejected order creation. Please check product stock.');
        setStep('payment');
        return;
      }

      const appOrder = createOrderRes.order;

      // Step B: Create Razorpay Payment Intent on backend
      const orderRes = await fetch('/api/v1/payments/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: appOrder.id,
          method: paymentMethod.toUpperCase(),
        }),
      }).then(r => r.json()).catch(() => null);

      if (!orderRes?.success) {
        setServerError(orderRes?.error || 'Payment gateway initialization failed.');
        setStep('payment');
        return;
      }

      const razorpayOrderId = orderRes.razorpayOrderId || orderRes.orderId || orderRes.order?.id;
      const keyId = orderRes.keyId || rzpKeyRes?.keyId;
      const scriptLoaded = await loadRazorpayScript();

      // Step C: Open official Razorpay modal
      if (!scriptLoaded || !(window as any).Razorpay || !keyId || keyId.includes('placeholder') || !razorpayOrderId) {
        setServerError('Unable to load Razorpay Checkout SDK. Please verify your internet connection and Razorpay API keys.');
        setStep('payment');
        return;
      }

      const rzp = new (window as any).Razorpay({
        key: keyId,
        amount: orderRes.amount || Math.round(appOrder.total * 100),
        currency: orderRes.currency || 'INR',
        name: 'TORIWEAR',
        description: 'Heavyweight Anime Streetwear',
        image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=200&auto=format&fit=crop&q=80',
        order_id: razorpayOrderId,
        prefill: {
          name: address.fullName,
          email: address.email,
          contact: address.phone,
        },
        theme: { color: '#FF2028' },
        handler: async function (response: any) {
          setStep('processing');
          const verifyRes = await fetch('/api/v1/payments/razorpay/verify-signature', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: appOrder.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          }).then(r => r.json()).catch(() => null);

          if (verifyRes?.success) {
            const verifiedOrder = verifyRes.order || appOrder;
            const cleanOrderId = verifiedOrder.orderNumber ? verifiedOrder.orderNumber.replace(/^#/, '') : verifiedOrder.id;

            const confirmed: OrderDetails = {
              orderId: cleanOrderId,
              date: new Date(verifiedOrder.createdAt || Date.now()).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }),
              items,
              shippingAddress: address,
              paymentMethod,
              paymentDetails: {
                upiId: paymentMethod === 'upi' ? (upiOption === 'id' ? upiId || 'Paid via UPI' : 'Paid via UPI') : undefined,
                cardLast4: paymentMethod === 'card' ? (cardNumber.replace(/\s+/g, '').slice(-4) || undefined) : undefined,
                bankName: paymentMethod === 'netbanking' ? selectedBank : undefined,
                isCod: false,
                razorpayPaymentId: response.razorpay_payment_id,
              },
              subtotal: verifiedOrder.subtotal,
              discount: verifiedOrder.discount,
              discountCode: verifiedOrder.discountCode,
              shipping: verifiedOrder.shippingFee,
              total: verifiedOrder.total,
              status: 'Confirmed',
              estimatedDelivery: '3 to 5 Business Days',
            };

            setConfirmedOrder(confirmed);
            onOrderPlaced(confirmed);
            setStep('confirmed');

            trackMetaEvent('Purchase', {
              orderId: cleanOrderId,
              value: Number(confirmed.total || 0),
              currency: 'INR',
              contentIds: items.map((it) => it.product.id),
              numItems: items.reduce((s, it) => s + (it.quantity || 1), 0),
              userData: { email: address.email, phone: address.phone },
            });

            try {
              confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FF2028', '#ffffff', '#a855f7', '#3b82f6'],
              });
            } catch {}
          } else {
            setServerError(verifyRes?.error || 'Payment signature verification failed. Please try again.');
            setStep('payment');
          }
        },
        modal: {
          ondismiss: function () {
            setServerError('Payment cancelled. Your reserved items remain safe in your cart.');
            setStep('payment');
          },
        },
      });
      rzp.open();
      return;
    } catch (err: any) {
      setServerError(err.message || 'Payment communication error. Please try again.');
      setStep('payment');
    }
  };

  const handleCopyOrderId = () => {
    if (confirmedOrder) {
      try {
        navigator?.clipboard?.writeText(confirmedOrder.orderId);
      } catch {}
      setCopiedOrderId(true);
      setTimeout(() => setCopiedOrderId(false), 2000);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div 
      style={{ zIndex: 9999 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        id="checkout-modal"
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0f0f15] border border-neutral-800 w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl my-auto animate-in zoom-in-95 max-h-[94vh] flex flex-col relative z-10"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-neutral-800 bg-[#14141d] flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 -ml-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer gap-1.5 text-xs font-mono"
              title="Return to store"
              aria-label="Back to store"
            >
              <ArrowLeft className="w-4 h-4 text-neutral-300" />
              <span className="hidden sm:inline font-bold text-neutral-300 hover:text-white">BACK</span>
            </button>
            <div className="h-4 w-[1px] bg-neutral-800 hidden sm:block" />
            <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
            <h3 className="font-heading text-lg sm:text-2xl font-bold text-white tracking-wide truncate">
              {step === 'confirmed' ? 'ORDER CONFIRMATION' : 'SECURE CHECKOUT & PAYMENT'}
            </h3>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-neutral-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 256-Bit SSL Encrypted
            </span>
            <button
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
              aria-label="Close Checkout"
              title="Close Checkout (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 sm:p-7 flex-1">
          {/* Progress Tabs (Hidden when confirmed) */}
          {step !== 'confirmed' && step !== 'processing' && (
            <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6 text-xs font-mono">
              <div className={`flex items-center gap-1.5 ${step === 'address' ? 'text-[#FF2028] font-bold' : 'text-neutral-400'}`}>
                <span className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-bold border border-neutral-700">1</span>
                <span>Shipping Address</span>
              </div>
              <span className="text-neutral-700">———</span>
              <div className={`flex items-center gap-1.5 ${step === 'payment' ? 'text-[#FF2028] font-bold' : 'text-neutral-500'}`}>
                <span className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-bold border border-neutral-700">2</span>
                <span>Payment Gateways</span>
              </div>
            </div>
          )}

          {/* STEP 1: SHIPPING ADDRESS */}
          {step === 'address' && (
            <form onSubmit={handleProceedToPayment} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-heading uppercase tracking-[0.08em] text-neutral-300 font-semibold">
                  DELIVERY ADDRESS (PAN-INDIA)
                </h4>
                <button
                  type="button"
                  onClick={handleFillDemoAddress}
                  className="text-[11px] font-sans font-medium text-[#FF2028] hover:underline"
                >
                  ⚡ Auto-fill Test Address
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-sans font-medium text-neutral-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={address.fullName}
                    onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF2028]"
                  />
                  {formErrors.fullName && <p className="text-[11px] text-[#FF2028] mt-1">{formErrors.fullName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-sans font-medium text-neutral-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={address.email}
                    onChange={(e) => setAddress({ ...address, email: e.target.value })}
                    placeholder="For tracking & invoice"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF2028]"
                  />
                  {formErrors.email && <p className="text-[11px] text-[#FF2028] mt-1">{formErrors.email}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-sans font-medium text-neutral-300 mb-1">Phone Number (10 Digits) *</label>
                  <div className="flex">
                    <span className="bg-neutral-900 border border-r-0 border-neutral-800 rounded-l-xl px-3 py-2.5 text-xs text-neutral-400 font-sans tabular-nums">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={address.phone}
                      onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                      placeholder="9876543210"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-r-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF2028] font-sans tabular-nums"
                    />
                  </div>
                  {formErrors.phone && <p className="text-[11px] text-[#FF2028] mt-1">{formErrors.phone}</p>}
                </div>

                <div>
                  <label className="block text-xs font-sans font-medium text-neutral-300 mb-1">PIN Code (6 Digits) *</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={address.pincode}
                    onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                    placeholder="e.g. 400001"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF2028] font-sans tabular-nums"
                  />
                  {formErrors.pincode && <p className="text-[11px] text-[#FF2028] mt-1">{formErrors.pincode}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-sans font-medium text-neutral-300 mb-1">Flat, House no., Building, Street *</label>
                <input
                  type="text"
                  value={address.addressLine1}
                  onChange={(e) => setAddress({ ...address, addressLine1: e.target.value })}
                  placeholder="Address Line 1"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF2028]"
                />
                {formErrors.addressLine1 && <p className="text-[11px] text-[#FF2028] mt-1">{formErrors.addressLine1}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-sans font-medium text-neutral-300 mb-1">City *</label>
                  <input
                    type="text"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    placeholder="e.g. Mumbai"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF2028]"
                  />
                  {formErrors.city && <p className="text-[11px] text-[#FF2028] mt-1">{formErrors.city}</p>}
                </div>

                <div>
                  <label className="block text-xs font-sans font-medium text-neutral-300 mb-1">State *</label>
                  <select
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF2028]"
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Order Amount Preview */}
              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-between text-xs font-sans">
                <div>
                  <span className="text-neutral-400">Total Payable Amount:</span>
                  <span className="text-white font-semibold block text-sm mt-0.5">
                    {items.length} item(s) • Free Pan-India Delivery
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-sans text-2xl text-[#FF2028] font-bold tabular-nums">
                    ₹{total.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-[#FF2028] hover:bg-[#e02441] text-white font-sans text-sm font-bold tracking-[0.06em] uppercase rounded-xl transition shadow-xl shadow-[#FF2028]/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>CONTINUE TO PAYMENT</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {/* STEP 2: INTEGRATED PAYMENT GATEWAY */}
          {step === 'payment' && (
            <div className="space-y-6">
              {serverError && (
                <div className="p-3.5 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-xl flex items-center gap-2.5 font-mono">
                  <AlertCircle className="w-4 h-4 text-[#FF2028] shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              {/* Payment Method Selector Tabs */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-bold">
                    SELECT PAYMENT METHOD
                  </div>
                  {onlinePaymentsEnabled === false && (
                    <span className="text-[10px] font-mono text-amber-300 bg-amber-950/40 border border-amber-800/60 px-2.5 py-0.5 rounded-full">
                      COD Active • Online Payments Coming Soon
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition ${
                      paymentMethod === 'upi'
                        ? 'border-[#FF2028] bg-[#1d1318] text-white'
                        : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-5 h-5 text-[#FF2028]" />
                    <div>
                      <div className="text-xs font-bold font-mono">UPI</div>
                      <div className="text-[10px] text-neutral-500">
                        {onlinePaymentsEnabled === false ? 'Coming Soon' : 'GPay, PhonePe'}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition ${
                      paymentMethod === 'card'
                        ? 'border-[#FF2028] bg-[#1d1318] text-white'
                        : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-[#FF2028]" />
                    <div>
                      <div className="text-xs font-bold font-mono">Cards</div>
                      <div className="text-[10px] text-neutral-500">
                        {onlinePaymentsEnabled === false ? 'Coming Soon' : 'Visa, RuPay'}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('netbanking')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition ${
                      paymentMethod === 'netbanking'
                        ? 'border-[#FF2028] bg-[#1d1318] text-white'
                        : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-5 h-5 text-[#FF2028]" />
                    <div>
                      <div className="text-xs font-bold font-mono">NetBanking</div>
                      <div className="text-[10px] text-neutral-500">
                        {onlinePaymentsEnabled === false ? 'Coming Soon' : 'All Banks'}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition ${
                      paymentMethod === 'cod'
                        ? 'border-[#FF2028] bg-[#1d1318] text-white'
                        : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Banknote className="w-5 h-5 text-[#FF2028]" />
                    <div>
                      <div className="text-xs font-bold font-mono">COD</div>
                      <div className="text-[10px] text-emerald-400 font-semibold">Pay on Delivery</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* PAYMENT DETAILS CONTENT */}
              <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800">
                {onlinePaymentsEnabled === false && paymentMethod !== 'cod' ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-200 text-xs font-mono space-y-2">
                      <div className="flex items-center gap-2 font-bold text-amber-300">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>ONLINE PAYMENTS (UPI / CARDS / NETBANKING) TEMPORARILY UNAVAILABLE</span>
                      </div>
                      <p className="text-[11px] text-neutral-300 leading-relaxed">
                        Online gateway activation is staged for our post-launch update. Please complete your order cleanly using{' '}
                        <strong className="text-white">Cash on Delivery (COD)</strong> — pay ₹{total.toLocaleString('en-IN')} at your doorstep when delivered.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('cod');
                        setServerError(null);
                      }}
                      className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-mono text-xs font-bold uppercase transition cursor-pointer"
                    >
                      Switch to Cash on Delivery (COD)
                    </button>
                  </div>
                ) : null}

                {/* 1. UPI Payment Details */}
                {onlinePaymentsEnabled !== false && paymentMethod === 'upi' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setUpiOption('qr')}
                          className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg transition ${
                            upiOption === 'qr' ? 'bg-[#FF2028] text-white' : 'text-neutral-400 bg-neutral-800'
                          }`}
                        >
                          Scan Dynamic QR
                        </button>
                        <button
                          type="button"
                          onClick={() => setUpiOption('id')}
                          className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg transition ${
                            upiOption === 'id' ? 'bg-[#FF2028] text-white' : 'text-neutral-400 bg-neutral-800'
                          }`}
                        >
                          Enter UPI ID / VPA
                        </button>
                      </div>

                      <span className="text-[11px] font-mono text-emerald-400 font-bold">
                        Razorpay Secured
                      </span>
                    </div>

                    {upiOption === 'qr' ? (
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                        {/* Interactive Dynamic QR Code Container */}
                        <div className="p-3 bg-white rounded-2xl shadow-xl flex flex-col items-center">
                          <div className="w-40 h-40 bg-neutral-100 flex items-center justify-center border-4 border-black/10 rounded-xl relative overflow-hidden">
                            <QrCode className="w-36 h-36 text-black" />
                            {/* Central Brand Badge on QR */}
                            <div className="absolute w-8 h-8 rounded-full bg-black text-[#FF2028] font-heading font-black text-[9px] flex items-center justify-center border border-white">
                              TORI
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-black font-bold mt-1">
                            UPI 2.0 • TORIWEAR STORE
                          </span>
                        </div>

                        <div className="space-y-2 text-center sm:text-left text-xs font-mono text-neutral-300">
                          <div className="text-white font-bold">Scan with any UPI App:</div>
                          <div className="flex items-center justify-center sm:justify-start gap-2 text-[11px] text-neutral-400">
                            <span className="bg-black/60 px-2 py-0.5 rounded border border-neutral-700">Google Pay</span>
                            <span className="bg-black/60 px-2 py-0.5 rounded border border-neutral-700">PhonePe</span>
                            <span className="bg-black/60 px-2 py-0.5 rounded border border-neutral-700">Paytm</span>
                            <span className="bg-black/60 px-2 py-0.5 rounded border border-neutral-700">BHIM</span>
                          </div>
                          <p className="text-[11px] text-neutral-400 max-w-xs">
                            Total payable: <strong className="text-white">₹{total.toLocaleString('en-IN')}</strong>. QR code regenerates automatically.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label className="block text-xs font-mono text-neutral-300">Enter Virtual Payment Address (UPI ID)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            placeholder="e.g. yourname@okhdfcbank or 9876543210@paytm"
                            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF2028] font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setUpiId('aarav@okhdfcbank')}
                            className="px-3 py-1 text-[11px] font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl"
                          >
                            Sample
                          </button>
                        </div>
                        <p className="text-[11px] font-mono text-neutral-500">
                          A payment request will be sent to your UPI app for authorization.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Card Payment Details with Visual Card */}
                {onlinePaymentsEnabled !== false && paymentMethod === 'card' && (
                  <div className="space-y-5">
                    {/* Visual 3D Metal Streetwear Card */}
                    <div className="relative w-full max-w-sm mx-auto h-48 rounded-2xl p-5 bg-gradient-to-tr from-[#15151c] via-[#22222f] to-[#121217] border border-neutral-700/80 shadow-2xl flex flex-col justify-between overflow-hidden">
                      <div className="absolute right-4 top-4 text-xs font-mono font-bold text-neutral-400 tracking-widest">
                        TORI BLACK CARD
                      </div>
                      <div className="w-10 h-7 rounded bg-amber-400/80 border border-amber-300/60" />
                      <div>
                        <div className="font-mono text-lg tracking-widest text-white font-bold">
                          {cardNumber || '•••• •••• •••• ••••'}
                        </div>
                        <div className="flex justify-between items-end mt-2 text-[11px] font-mono text-neutral-400">
                          <div>
                            <span className="block text-[9px] uppercase">Cardholder</span>
                            <span className="text-white font-semibold">{cardName || 'YOUR NAME'}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase">Expires</span>
                            <span className="text-white font-semibold">{cardExpiry || 'MM/YY'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleFillDemoCard}
                        className="text-[11px] font-mono text-[#FF2028] hover:underline"
                      >
                        ⚡ Fill Test Card Credentials
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-mono text-neutral-300 mb-1">Card Number</label>
                        <input
                          type="text"
                          maxLength={19}
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          placeholder="4532 •••• •••• 9012"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF2028] font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-mono text-neutral-300 mb-1">Expiry Date</label>
                          <input
                            type="text"
                            maxLength={5}
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="MM/YY"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF2028] font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-neutral-300 mb-1">CVV / CVC</label>
                          <input
                            type="password"
                            maxLength={4}
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            placeholder="•••"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF2028] font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-neutral-300 mb-1">Name on Card</label>
                        <input
                          type="text"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          placeholder="Name printed on card"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF2028]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Net Banking */}
                {onlinePaymentsEnabled !== false && paymentMethod === 'netbanking' && (
                  <div className="space-y-4">
                    <div className="text-xs font-mono text-neutral-300 font-semibold">
                      Select Your Preferred Bank:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Bank', 'Punjab National Bank'].map((bank) => (
                        <button
                          key={bank}
                          type="button"
                          onClick={() => setSelectedBank(bank)}
                          className={`p-2.5 rounded-xl border text-left text-xs font-mono transition ${
                            selectedBank === bank
                              ? 'border-[#FF2028] bg-[#1d1418] text-white'
                              : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {bank}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] font-mono text-neutral-500">
                      You will be securely redirected to {selectedBank}’s encrypted banking portal to authorize payment of ₹{total.toLocaleString('en-IN')}.
                    </p>
                  </div>
                )}

                {/* 4. Cash on Delivery (COD) */}
                {paymentMethod === 'cod' && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-900/40 text-amber-300 text-xs font-mono">
                      <strong>Cash on Delivery Eligible</strong>
                      <p className="mt-1 text-neutral-300 text-[11px]">
                        Pay ₹{total.toLocaleString('en-IN')} in cash or via UPI to the delivery executive when your package arrives at your doorstep in {address.city}.
                      </p>
                    </div>
                    <div className="text-[11px] font-mono text-neutral-400">
                      ✓ No advance payment required • Verified contactless delivery available.
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep('address')}
                  className="py-3.5 px-5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-sans text-xs font-semibold tracking-[0.05em] rounded-xl transition uppercase cursor-pointer"
                >
                  ← Back to Address
                </button>

                <button
                  type="button"
                  disabled={onlinePaymentsEnabled === false && paymentMethod !== 'cod'}
                  onClick={handleExecutePayment}
                  className="flex-1 py-4 bg-[#FF2028] hover:bg-[#e02441] disabled:bg-neutral-800 disabled:text-neutral-400 disabled:cursor-not-allowed text-white font-sans text-sm font-bold tracking-[0.06em] uppercase rounded-xl transition shadow-xl shadow-[#FF2028]/25 disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer active:scale-98 tabular-nums"
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {paymentMethod === 'cod'
                      ? `CONFIRM COD ORDER — ₹${total.toLocaleString('en-IN')}`
                      : onlinePaymentsEnabled === false
                        ? 'SELECT COD TO PLACE ORDER'
                        : `PAY ₹${total.toLocaleString('en-IN')} SECURELY`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PROCESSING SIMULATION */}
          {step === 'processing' && (
            <div className="py-16 text-center space-y-5 animate-in fade-in">
              <div className="relative w-20 h-20 mx-auto">
                <div className="w-20 h-20 rounded-full border-4 border-neutral-800 border-t-[#FF2028] animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-[#FF2028]" />
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-heading text-2xl font-bold text-white tracking-wide">
                  CONNECTING TO SECURE PAYMENT GATEWAY...
                </h4>
                <p className="text-xs font-mono text-neutral-400 max-w-sm mx-auto">
                  Authorizing 256-bit bank handshake for ₹{total.toLocaleString('en-IN')}. Please do not close or refresh this tab.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 px-3 py-1 rounded-full">
                <Lock className="w-3 h-3" /> PCI-DSS Level 1 Encrypted
              </div>
            </div>
          )}

          {/* STEP 4: ORDER CONFIRMED */}
          {step === 'confirmed' && confirmedOrder && (
            <div className="space-y-6 animate-in fade-in">
              {/* Success Badge */}
              <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-900/60 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="font-heading text-3xl font-black text-white tracking-wide">
                  ORDER PLACED SUCCESSFULLY!
                </h4>
                <p className="text-xs font-mono text-neutral-300">
                  Thank you, <strong className="text-white">{confirmedOrder.shippingAddress.fullName}</strong>. Your anime streetwear fit is locked in!
                </p>
              </div>

              {/* Order Meta Bar */}
              <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
                <div>
                  <span className="text-neutral-500">Order ID: </span>
                  <span className="font-bold text-white tracking-wider">{confirmedOrder.orderId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyOrderId}
                    className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg flex items-center gap-1 transition"
                  >
                    {copiedOrderId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedOrderId ? 'Copied' : 'Copy ID'}</span>
                  </button>
                  <button
                    onClick={handlePrintReceipt}
                    className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg flex items-center gap-1 transition"
                  >
                    <Printer className="w-3 h-3" />
                    <span>Print Invoice</span>
                  </button>
                </div>
              </div>

              {/* Live Tracking Timeline Simulator */}
              <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-3">
                <div className="text-xs font-mono text-neutral-400 uppercase font-bold">
                  DELIVERY STATUS & TIMELINE
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono">
                  <div className="space-y-1">
                    <div className="w-6 h-6 rounded-full bg-[#FF2028] text-white font-bold flex items-center justify-center mx-auto">✓</div>
                    <div className="text-white font-bold">Confirmed</div>
                    <div className="text-neutral-500">Today</div>
                  </div>
                  <div className="space-y-1">
                    <div className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">2</div>
                    <div className="text-neutral-300">Packing</div>
                    <div className="text-neutral-500">Within 24h</div>
                  </div>
                  <div className="space-y-1">
                    <div className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">3</div>
                    <div className="text-neutral-400">Shipped</div>
                    <div className="text-neutral-500">Courier Dispatch</div>
                  </div>
                  <div className="space-y-1">
                    <div className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">4</div>
                    <div className="text-neutral-400">Delivered</div>
                    <div className="text-neutral-500">{confirmedOrder.estimatedDelivery}</div>
                  </div>
                </div>
              </div>

              {/* Items Summary */}
              <div className="space-y-2">
                <div className="text-xs font-mono text-neutral-400 uppercase font-bold">
                  ITEMS PURCHASED ({confirmedOrder.items.length})
                </div>
                <div className="divide-y divide-neutral-800/80 max-h-40 overflow-y-auto">
                  {confirmedOrder.items.map((it, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <img src={it.product.images[0]} alt={it.product.name} className="w-10 h-12 object-cover rounded border border-neutral-800" />
                        <div>
                          <div className="font-sans text-sm text-white font-semibold">{it.product.name}</div>
                          <div className="text-[11px] text-neutral-400 font-sans">
                            Size: {it.size} • Qty: {it.quantity} • {it.product.fit}
                          </div>
                        </div>
                      </div>
                      <div className="font-sans text-white font-bold tabular-nums">
                        ₹{(it.product.price * it.quantity).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Done Button */}
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-neutral-800 hover:bg-neutral-700 text-white font-sans text-xs font-semibold uppercase tracking-[0.06em] rounded-xl transition cursor-pointer"
              >
                CONTINUE SHOPPING
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
