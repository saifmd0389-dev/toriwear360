import React, { useState, useMemo } from 'react';
import {
  X,
  CreditCard,
  Gift,
  Sparkles,
  Tag,
  MapPin,
  Plus,
  Trash2,
  Check,
  Smartphone,
  Copy,
  User,
  DollarSign,
  Package,
  Download,
  Printer,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  RotateCw,
  RotateCcw,
} from 'lucide-react';
import { useCustomerAuth, CustomerAccountModalType } from '../context/CustomerAuthContext';
import { OrderDetails, CartItem } from '../types';
import { PRODUCTS } from '../data/products';
import { downloadInvoiceFile, printInvoiceDirectly } from '../utils/invoiceGenerator';
import { ReturnExchangeModal, CustomerReturnRequest } from './ReturnExchangeModal';
import { apiClient } from '../services/apiClient';

export interface CustomerAccountModalsProps {
  onApplyCoupon?: (code: string) => void;
  orders?: OrderDetails[];
  onOpenTrackOrder?: (orderId?: string) => void;
  onReorder?: (items: CartItem[]) => void;
}

export const CustomerAccountModals: React.FC<CustomerAccountModalsProps> = ({ 
  onApplyCoupon, 
  orders: propOrders,
  onOpenTrackOrder,
  onReorder
}) => {
  const { 
    customer, 
    activeAccountModal, 
    openAccountModal,
    closeAccountModal, 
    updateProfile,
    addSavedAddress,
    deleteSavedAddress,
    addSavedVpa,
    deleteSavedVpa,
    deleteSavedCard
  } = useCustomerAuth();

  // Temporary form states
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [invoiceToast, setInvoiceToast] = useState<string | null>(null);
  
  // Order History Filter and Search
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'ACTIVE' | 'DELIVERED' | 'CANCELLED' | 'RETURNS'>('ALL');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // Return & Exchange State
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedReturnOrder, setSelectedReturnOrder] = useState<OrderDetails | null>(null);
  const [selectedReturnItem, setSelectedReturnItem] = useState<any | null>(null);
  const [customerReturns, setCustomerReturns] = useState<CustomerReturnRequest[]>(() => {
    try {
      const saved = localStorage.getItem('toriwear_customer_returns');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [viewingReturnStatus, setViewingReturnStatus] = useState<CustomerReturnRequest | null>(null);

  // New VPA
  const [newVpaInput, setNewVpaInput] = useState('');

  // New Address
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({
    name: 'Home',
    addressLine: '',
    city: 'Visakhapatnam',
    state: 'Andhra Pradesh',
    pincode: '530018',
  });

  // Edit Profile Form
  const [editName, setEditName] = useState(customer?.name || '');
  const [editEmail, setEditEmail] = useState(customer?.email || '');
  const [editPhone, setEditPhone] = useState(customer?.phone || '');
  const [editCity, setEditCity] = useState(customer?.city || 'Visakhapatnam');

  // Gift Card Redeem
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardMsg, setGiftCardMsg] = useState('');

  // Server-checked coupons list when COUPONS modal is open
  const [serverCoupons, setServerCoupons] = useState<Array<{
    code: string;
    title: string;
    desc: string;
    active: boolean;
  }> | null>(null);

  React.useEffect(() => {
    if (activeAccountModal !== 'COUPONS') return;
    let active = true;
    const candidates = ['TORI100', 'DROP2026', 'TWIN10'];
    Promise.all(
      candidates.map(async (code) => {
        const res = await apiClient.validateCoupon(code, 2500, {
          customerId: customer?.id,
          customerEmail: customer?.email,
          customerPhone: customer?.phone,
        });
        if (!res.success) {
          return null;
        }
        const label =
          res.discountType === 'PERCENTAGE'
            ? `${res.value}% Off${res.maxDiscount ? ` (Up to ₹${res.maxDiscount})` : ''}`
            : `₹${res.value} Off`;
        return {
          code: res.code || code,
          title: label,
          desc:
            res.description ||
            `Valid on eligible merchandise${res.minOrderValue ? ` above ₹${res.minOrderValue}` : ''}`,
          active: true,
        };
      })
    ).then((results) => {
      if (!active) return;
      setServerCoupons(results.filter((r): r is NonNullable<typeof r> => Boolean(r)));
    });
    return () => {
      active = false;
    };
  }, [activeAccountModal, customer?.id, customer?.email, customer?.phone]);

  // Sync edit profile form fields when customer changes
  React.useEffect(() => {
    if (customer) {
      setEditName(customer.name || '');
      setEditEmail(customer.email || '');
      setEditPhone(customer.phone || '');
      setEditCity(customer.city || 'Visakhapatnam');
    }
  }, [customer?.id, customer?.name, customer?.email, customer?.phone, customer?.city]);

  // Keyboard shortcut (Escape) to close modal
  React.useEffect(() => {
    if (!activeAccountModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAccountModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAccountModal, closeAccountModal]);

  // Prevent background page scrolling when any account modal or return status is open
  React.useEffect(() => {
    if (!activeAccountModal && !viewingReturnStatus) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [activeAccountModal, viewingReturnStatus]);

  // Load orders from props or localStorage (no dummy fallback orders)
  const loadedOrders = useMemo<OrderDetails[]>(() => {
    let list: OrderDetails[] = [];
    if (propOrders && propOrders.length > 0) {
      list = [...propOrders];
    } else {
      try {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('toriwear_orders') : null;
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            list = parsed;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    return list;
  }, [propOrders, customer]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return loadedOrders.filter((order) => {
      // Status filter
      if (orderFilter === 'ACTIVE') {
        if (order.status === 'Delivered' || order.status === 'Cancelled') return false;
      } else if (orderFilter === 'DELIVERED') {
        if (order.status !== 'Delivered') return false;
      } else if (orderFilter === 'CANCELLED') {
        if (order.status !== 'Cancelled') return false;
      } else if (orderFilter === 'RETURNS') {
        const hasReturn = customerReturns.some((r) => r.orderId === order.orderId);
        if (!hasReturn) return false;
      }

      // Search query filter
      if (orderSearchQuery.trim()) {
        const q = orderSearchQuery.trim().toLowerCase();
        const matchesId = order.orderId?.toLowerCase().includes(q);
        const matchesProduct = (order.items || []).some((item) =>
          item.product?.name?.toLowerCase().includes(q) ||
          item.product?.franchise?.toLowerCase().includes(q)
        );
        const matchesStatus = order.status?.toLowerCase().includes(q);
        if (!matchesId && !matchesProduct && !matchesStatus) return false;
      }

      return true;
    });
  }, [loadedOrders, orderFilter, orderSearchQuery, customerReturns]);

  if (!activeAccountModal) return null;

  const handleCopyCoupon = (code: string) => {
    try {
      navigator?.clipboard?.writeText(code);
    } catch {}
    setCopiedCode(code);
    if (onApplyCoupon) onApplyCoupon(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleCopyOrderId = (id: string) => {
    try {
      navigator?.clipboard?.writeText(id);
    } catch {}
    setCopiedOrderId(id);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  const handleDownloadInvoice = (order: OrderDetails) => {
    downloadInvoiceFile(order, customer?.name);
    setInvoiceToast(`Tax Invoice for #${order.orderId} downloaded!`);
    setTimeout(() => setInvoiceToast(null), 3500);
  };

  const handlePrintInvoice = (order: OrderDetails) => {
    printInvoiceDirectly(order, customer?.name);
    setInvoiceToast(`Opening printable invoice for #${order.orderId}...`);
    setTimeout(() => setInvoiceToast(null), 3500);
  };

  const getStepIndex = (orderStatus: string) => {
    switch (orderStatus) {
      case 'Confirmed':
        return 0;
      case 'Packed':
        return 1;
      case 'Shipped':
      case 'Out for Delivery':
        return 2;
      case 'Delivered':
        return 3;
      default:
        return 0;
    }
  };

  const handleReorderOrder = (order: OrderDetails) => {
    const fallbackProduct = PRODUCTS[0];
    const orderItems: CartItem[] = order.items && order.items.length > 0
      ? order.items
      : fallbackProduct
        ? [{ product: fallbackProduct, size: 'L', color: 'Obsidian Black', quantity: 1 }]
        : [];

    if (onReorder) {
      onReorder(orderItems);
    } else {
      try {
        const saved = localStorage.getItem('toriwear_cart');
        const current: CartItem[] = saved ? JSON.parse(saved) : [];
        const merged = [...current];
        orderItems.forEach((newItem) => {
          const idx = merged.findIndex(
            (it) => it.product?.id === newItem.product?.id && it.size === newItem.size && it.color === newItem.color
          );
          const existing = idx > -1 ? merged[idx] : undefined;
          if (existing) {
            existing.quantity += newItem.quantity || 1;
          } else {
            merged.push(newItem);
          }
        });
        localStorage.setItem('toriwear_cart', JSON.stringify(merged));
      } catch (err) {
        console.error(err);
      }
    }

    setInvoiceToast(`Reordered! ${orderItems.length} item${orderItems.length > 1 ? 's' : ''} added to your bag.`);
    setTimeout(() => {
      closeAccountModal();
    }, 450);
  };

  const handleReorderSingleItem = (item: any) => {
    const singleItem: CartItem = {
      product: item.product || PRODUCTS[0],
      size: item.size || 'L',
      color: item.color || 'Standard',
      quantity: item.quantity || 1,
    };
    if (onReorder) {
      onReorder([singleItem]);
    } else {
      try {
        const saved = localStorage.getItem('toriwear_cart');
        const current: CartItem[] = saved ? JSON.parse(saved) : [];
        current.push(singleItem);
        localStorage.setItem('toriwear_cart', JSON.stringify(current));
      } catch (err) {
        console.error(err);
      }
    }
    setInvoiceToast(`Added "${singleItem.product.name}" (${singleItem.size}) to your bag!`);
    setTimeout(() => {
      closeAccountModal();
    }, 450);
  };

  const handleOpenReturnModal = (order: OrderDetails, item?: any) => {
    setSelectedReturnOrder(order);
    setSelectedReturnItem(item || null);
    setReturnModalOpen(true);
  };

  const handleReturnSuccess = (newReturn: CustomerReturnRequest) => {
    setCustomerReturns((prev) => [newReturn, ...prev]);
    setInvoiceToast(`${newReturn.type === 'EXCHANGE' ? 'Exchange' : 'Return'} request #${newReturn.id} confirmed!`);
    setTimeout(() => setInvoiceToast(null), 4000);
  };

  const handleCancelCustomerReturn = (returnId: string) => {
    setCustomerReturns((prev) => {
      const updated = prev.filter((r) => r.id !== returnId);
      try {
        localStorage.setItem('toriwear_customer_returns', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      const storedAdmin = localStorage.getItem('returnRequests');
      if (storedAdmin) {
        const list = JSON.parse(storedAdmin).filter((r: any) => r.id !== returnId);
        localStorage.setItem('returnRequests', JSON.stringify(list));
      }
    } catch {}

    setViewingReturnStatus(null);
    setInvoiceToast(`Return request #${returnId} has been cancelled.`);
    setTimeout(() => setInvoiceToast(null), 3000);
  };

  const handleAddVpa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVpaInput.trim()) return;
    addSavedVpa(newVpaInput.trim());
    setNewVpaInput('');
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddressForm.addressLine || !newAddressForm.pincode) return;
    addSavedAddress({
      name: newAddressForm.name,
      addressLine: newAddressForm.addressLine,
      city: newAddressForm.city,
      state: newAddressForm.state,
      pincode: newAddressForm.pincode,
      isDefault: false,
    });
    setNewAddressForm({ name: 'Home', addressLine: '', city: 'Visakhapatnam', state: 'Andhra Pradesh', pincode: '530018' });
    setShowAddAddress(false);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name: editName,
      email: editEmail,
      phone: editPhone,
      city: editCity,
    });
    closeAccountModal();
  };

  const handleRedeemGiftCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftCardCode.trim()) return;
    const clean = giftCardCode.trim().toUpperCase();
    if (clean === 'TORI500' || clean.startsWith('GIFT')) {
      const added = 500;
      updateProfile({ toriCredit: (customer?.toriCredit || 0) + added });
      setGiftCardMsg(`Successfully credited ₹${added} to your TORI Credit wallet!`);
      setGiftCardCode('');
    } else {
      setGiftCardMsg('Invalid or expired gift voucher code. Try demo code: TORI500');
    }
  };

  const isWideModal = activeAccountModal === 'ORDER_HISTORY';

  // Navigation tab items configuration
  const accountTabs: { id: CustomerAccountModalType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'ORDER_HISTORY', label: 'Order History', icon: Package },
    { id: 'EDIT_PROFILE', label: 'Profile', icon: User },
    { id: 'TORI_CREDIT', label: 'Tori Credit', icon: DollarSign },
    { id: 'COUPONS', label: 'Coupons', icon: Tag },
    { id: 'SAVED_ADDRESSES', label: 'Addresses', icon: MapPin },
    { id: 'SAVED_CARDS', label: 'Cards', icon: CreditCard },
    { id: 'SAVED_VPA', label: 'UPI VPA', icon: Smartphone },
    { id: 'GIFT_CARDS', label: 'Gift Cards', icon: Gift },
    { id: 'TORI_INSIDER', label: 'Insider VIP', icon: Sparkles },
  ];

  return (
    <div 
      style={{ zIndex: 9999 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeAccountModal();
        }
      }}
    >
      <div className={`bg-[#101016] border border-neutral-800 w-full ${isWideModal ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl overflow-hidden shadow-2xl my-auto animate-in zoom-in-95 flex flex-col font-sans max-h-[92vh] transition-all duration-200`}>
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 bg-[#14141e] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h3 className="font-heading text-lg sm:text-xl font-bold text-white tracking-wide flex items-center gap-2">
              {activeAccountModal === 'ORDER_HISTORY' && (
                <>
                  <Package className="w-5 h-5 text-red-500" />
                  <span>Order History & Invoices</span>
                </>
              )}
              {activeAccountModal === 'GIFT_CARDS' && 'TORI-WEAR Gift Cards'}
              {activeAccountModal === 'TORI_INSIDER' && 'TORI Insider Club'}
              {activeAccountModal === 'TORI_CREDIT' && 'TORI Credit Wallet'}
              {activeAccountModal === 'COUPONS' && 'Exclusive Coupons & Offers'}
              {activeAccountModal === 'SAVED_CARDS' && 'Saved Cards'}
              {activeAccountModal === 'SAVED_VPA' && 'Saved VPA (UPI IDs)'}
              {activeAccountModal === 'SAVED_ADDRESSES' && 'Saved Delivery Addresses'}
              {activeAccountModal === 'EDIT_PROFILE' && 'Edit Customer Profile'}
            </h3>
          </div>
          <button
            onClick={closeAccountModal}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Close modal"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Modal Navigation Tabs */}
        <div className="border-b border-neutral-800/80 bg-[#0c0c12] px-3 sm:px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-mono">
          {accountTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeAccountModal === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => openAccountModal(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer font-medium ${
                  isActive
                    ? 'bg-red-600 text-white font-bold shadow-md shadow-red-950/40'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                <span>{tab.label}</span>
                {tab.id === 'ORDER_HISTORY' && loadedOrders.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-black/30 text-white' : 'bg-neutral-800 text-neutral-300'
                  }`}>
                    {loadedOrders.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Global Toast Notification for Invoice & Actions */}
        {invoiceToast && (
          <div className="bg-emerald-950/90 border-b border-emerald-800/80 text-emerald-200 px-4 py-2 text-xs font-mono flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{invoiceToast}</span>
            </div>
            <button 
              onClick={() => setInvoiceToast(null)} 
              className="text-emerald-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs font-mono flex-1">
          {/* ========================================================
              0. ORDER HISTORY TAB
             ======================================================== */}
          {activeAccountModal === 'ORDER_HISTORY' && (
            <div className="space-y-4 font-sans">
              {/* Order History Summary & Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/60 p-3 sm:p-3.5 rounded-xl border border-neutral-800">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    onClick={() => setOrderFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer whitespace-nowrap ${
                      orderFilter === 'ALL'
                        ? 'bg-neutral-200 text-neutral-900 font-bold'
                        : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
                    }`}
                  >
                    All ({loadedOrders.length})
                  </button>
                  <button
                    onClick={() => setOrderFilter('ACTIVE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer whitespace-nowrap ${
                      orderFilter === 'ACTIVE'
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
                    }`}
                  >
                    In Transit / Active
                  </button>
                  <button
                    onClick={() => setOrderFilter('DELIVERED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer whitespace-nowrap ${
                      orderFilter === 'DELIVERED'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
                    }`}
                  >
                    Delivered
                  </button>
                  <button
                    onClick={() => setOrderFilter('CANCELLED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer whitespace-nowrap ${
                      orderFilter === 'CANCELLED'
                        ? 'bg-red-700 text-white font-bold'
                        : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
                    }`}
                  >
                    Cancelled
                  </button>
                  <button
                    onClick={() => setOrderFilter('RETURNS')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      orderFilter === 'RETURNS'
                        ? 'bg-amber-600 text-white font-bold'
                        : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Returns ({customerReturns.length})</span>
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search by Order ID or item..."
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono placeholder:text-neutral-500 focus:outline-none focus:border-red-500"
                  />
                  {orderSearchQuery && (
                    <button
                      onClick={() => setOrderSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Order Cards List */}
              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center bg-neutral-900/30 rounded-2xl border border-neutral-800 space-y-3">
                  <Package className="w-10 h-10 text-neutral-600 mx-auto" />
                  <div className="text-white font-bold text-sm">No orders match your filter</div>
                  <p className="text-neutral-400 text-xs max-w-sm mx-auto font-mono">
                    {orderSearchQuery 
                      ? `No purchases matched query "${orderSearchQuery}". Try clearing search keywords.`
                      : 'You do not have any orders in this category.'}
                  </p>
                  {(orderSearchQuery || orderFilter !== 'ALL') && (
                    <button
                      onClick={() => {
                        setOrderSearchQuery('');
                        setOrderFilter('ALL');
                      }}
                      className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-mono transition"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => {
                    const status = order.status || 'Confirmed';
                    const isDelivered = status === 'Delivered';
                    const isCancelled = status === 'Cancelled';
                    const isShipped = status === 'Shipped' || status === 'Out for Delivery';

                    return (
                      <div 
                        key={order.orderId}
                        className="bg-[#14141e] border border-neutral-800/90 rounded-2xl overflow-hidden hover:border-neutral-700 transition shadow-lg"
                      >
                        {/* Order Card Header */}
                        <div className="p-4 bg-neutral-900/60 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-mono font-bold text-white tracking-wider flex items-center gap-1.5">
                              <span>#{order.orderId}</span>
                              <button
                                onClick={() => handleCopyOrderId(order.orderId)}
                                className="text-neutral-400 hover:text-white p-0.5"
                                title="Copy Order ID"
                              >
                                {copiedOrderId === order.orderId ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </span>
                            <span className="text-neutral-500">•</span>
                            <span className="text-neutral-400 font-mono text-[11px] flex items-center gap-1">
                              <Clock className="w-3 h-3 text-neutral-500" />
                              <span>{order.date}</span>
                            </span>
                          </div>

                          {/* Status Badge */}
                          <div className="flex items-center gap-2">
                            {isDelivered && (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 text-[11px] font-mono font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Delivered</span>
                              </span>
                            )}
                            {isShipped && (
                              <span className="px-2.5 py-0.5 rounded-full bg-blue-950/80 text-blue-400 border border-blue-800/80 text-[11px] font-mono font-bold flex items-center gap-1">
                                <Truck className="w-3 h-3" />
                                <span>{status}</span>
                              </span>
                            )}
                            {!isDelivered && !isShipped && !isCancelled && (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/80 text-[11px] font-mono font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{status}</span>
                              </span>
                            )}
                            {isCancelled && (
                              <span className="px-2.5 py-0.5 rounded-full bg-rose-950/80 text-rose-400 border border-rose-800/80 text-[11px] font-mono font-bold flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                <span>Cancelled</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Visual Step-by-Step Order Progress Timeline */}
                        <div className="px-4 sm:px-6 py-3.5 bg-[#0c0c14] border-b border-neutral-800/80">
                          {isCancelled ? (
                            <div className="flex items-center justify-between text-xs font-mono">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center text-[10px] font-bold">
                                  ✓
                                </span>
                                <div>
                                  <div className="text-white font-bold">Ordered</div>
                                  <div className="text-[10px] text-neutral-400">{order.date}</div>
                                </div>
                              </div>
                              <div className="h-0.5 flex-1 bg-red-900/50 mx-3" />
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-rose-950 text-rose-400 border border-rose-800 flex items-center justify-center text-[10px] font-bold">
                                  ✕
                                </span>
                                <div>
                                  <div className="text-rose-400 font-bold">Cancelled</div>
                                  <div className="text-[10px] text-neutral-400">{order.cancelledAt || 'Order Cancelled'}</div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="py-1">
                              <div className="relative flex items-center justify-between">
                                {/* Connecting Background Track */}
                                <div className="absolute top-3.5 sm:top-4 left-6 right-6 h-1 bg-neutral-800 rounded-full z-0" />
                                {/* Connecting Active Progress Bar */}
                                <div 
                                  className="absolute top-3.5 sm:top-4 left-6 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 rounded-full z-0 transition-all duration-500"
                                  style={{
                                    width: `${
                                      getStepIndex(status) === 0 ? '0%' :
                                      getStepIndex(status) === 1 ? '33%' :
                                      getStepIndex(status) === 2 ? '66%' : 'calc(100% - 48px)'
                                    }`
                                  }}
                                />

                                {/* 4 Milestones: Ordered -> Packed -> Shipped -> Delivered */}
                                {[
                                  { label: 'Ordered', sub: 'Confirmed', icon: Check },
                                  { label: 'Packed', sub: 'QC Passed', icon: Package },
                                  { label: 'Shipped', sub: 'In Transit', icon: Truck },
                                  { label: 'Delivered', sub: isDelivered ? 'Handed Over' : (order.estimatedDelivery || 'Arriving Soon'), icon: CheckCircle2 }
                                ].map((milestone, mIdx) => {
                                  const currentStep = getStepIndex(status);
                                  const isPassed = currentStep >= mIdx;
                                  const isCurrent = currentStep === mIdx;
                                  const IconComponent = milestone.icon;

                                  return (
                                    <div key={mIdx} className="relative z-10 flex flex-col items-center text-center flex-1 max-w-[80px] sm:max-w-[100px]">
                                      <div 
                                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all ${
                                          isPassed
                                            ? mIdx === 3 
                                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60 ring-2 ring-emerald-500/40' 
                                              : 'bg-red-600 text-white shadow-md shadow-red-950/60 ring-2 ring-red-500/40'
                                            : 'bg-neutral-900 border border-neutral-700 text-neutral-500'
                                        } ${isCurrent && !isDelivered ? 'animate-pulse ring-2 ring-amber-400' : ''}`}
                                      >
                                        <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                      </div>
                                      <div className="mt-1.5 font-mono">
                                        <div className={`text-[10px] sm:text-xs font-bold leading-tight ${isPassed ? 'text-white' : 'text-neutral-500'}`}>
                                          {milestone.label}
                                        </div>
                                        <div className="text-[9px] text-neutral-400 hidden sm:block mt-0.5 truncate max-w-[90px]">
                                          {isCurrent ? (isDelivered ? 'Delivered' : 'In Progress') : milestone.sub}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Active Return/Exchange Banner if present */}
                        {(() => {
                          const orderReturns = customerReturns.filter((r) => r.orderId === order.orderId);
                          if (orderReturns.length === 0) return null;
                          return (
                            <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-600/60 space-y-2">
                              {orderReturns.map((ret) => (
                                <div key={ret.id} className="flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-amber-900/80 border border-amber-600/80 flex items-center justify-center text-amber-300 shrink-0">
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2 text-white font-bold flex-wrap">
                                        <span>{ret.type === 'EXCHANGE' ? 'Exchange Requested' : 'Return Requested'}</span>
                                        <span className="text-[10px] text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                                          {ret.id}
                                        </span>
                                        <span className="text-[10px] text-emerald-400 font-bold">
                                          {ret.status}
                                        </span>
                                      </div>
                                      <div className="text-neutral-400 text-[11px] mt-0.5">
                                        Pickup: <span className="text-neutral-200">{ret.estimatedPickupDate}</span> • Reason: {ret.reason}
                                        {ret.exchangeDetails?.newSize && ` • Replacement Size: ${ret.exchangeDetails.newSize}`}
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => setViewingReturnStatus(ret)}
                                    className="px-3 py-1 rounded-lg bg-amber-900/80 hover:bg-amber-800 text-amber-200 font-bold transition flex items-center gap-1 cursor-pointer text-[11px] ml-auto sm:ml-0"
                                  >
                                    <span>Track Return</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        {/* Order Card Content & Line Items */}
                        <div className="p-4 space-y-3.5">
                          {/* Items Preview */}
                          <div className="space-y-2.5">
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
                              const img = item.product?.images?.[0] || '/assets/toriwear-official-logo.png';
                              const itemReturn = customerReturns.find(
                                (r) => r.orderId === order.orderId && 
                                (!r.item?.productName || r.item?.productName === item.product?.name)
                              );

                              return (
                                <div 
                                  key={idx}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-xl bg-neutral-900/50 border border-neutral-800/60 hover:border-neutral-700/80 transition"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-12 h-12 rounded-lg bg-neutral-950 border border-neutral-800 overflow-hidden flex items-center justify-center shrink-0">
                                      <img 
                                        src={img} 
                                        alt={item.product?.name || 'Tori Wear Product'} 
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          (e.currentTarget as HTMLImageElement).src = '/assets/toriwear-official-logo.png';
                                        }}
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-white text-xs font-bold leading-snug truncate">
                                        {item.product?.name || 'Original Streetwear Piece'}
                                      </div>
                                      <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-red-400">Size: {item.size || 'L'}</span>
                                        <span>•</span>
                                        <span>Color: {item.color || 'Standard'}</span>
                                        <span>•</span>
                                        <span>Qty: {item.quantity || 1}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800/60 shrink-0">
                                    <div className="text-right font-mono font-bold text-white text-xs shrink-0 sm:mr-1">
                                      ₹{((item.product?.price || 1199) * (item.quantity || 1)).toLocaleString('en-IN')}
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                      {onOpenTrackOrder && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            closeAccountModal();
                                            onOpenTrackOrder(order.orderId);
                                          }}
                                          className="px-2.5 py-1.5 rounded-lg bg-neutral-800/90 hover:bg-neutral-700 text-neutral-200 hover:text-white transition flex items-center gap-1.5 text-[11px] font-mono font-medium cursor-pointer shrink-0 border border-neutral-700/80 shadow-sm"
                                          title={`Track shipment for ${item.product?.name || 'this item'} (Order #${order.orderId})`}
                                        >
                                          <Truck className="w-3.5 h-3.5 text-blue-400" />
                                          <span>Track Order</span>
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadInvoice(order);
                                        }}
                                        className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white transition flex items-center gap-1.5 text-[11px] font-mono font-bold cursor-pointer shrink-0 shadow-sm shadow-red-950/40"
                                        title={`Download PDF-style invoice summary for Order #${order.orderId}`}
                                      >
                                        <Download className="w-3.5 h-3.5 text-white" />
                                        <span>Download Invoice</span>
                                      </button>

                                      {!isCancelled && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleReorderSingleItem(item);
                                          }}
                                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 text-[11px] font-mono font-bold cursor-pointer shrink-0 shadow-sm shadow-emerald-950/40"
                                          title={`Reorder ${item.product?.name || 'this item'} to your bag`}
                                        >
                                          <RotateCw className="w-3.5 h-3.5 text-white" />
                                          <span>Reorder</span>
                                        </button>
                                      )}

                                      {/* Return/Exchange Button for Delivered Items */}
                                      {isDelivered && !isCancelled && (
                                        itemReturn ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setViewingReturnStatus(itemReturn);
                                            }}
                                            className="px-2.5 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-600/80 text-amber-300 hover:text-white transition flex items-center gap-1.5 text-[11px] font-mono font-bold cursor-pointer shrink-0 shadow-sm"
                                            title={`View return status for ${item.product?.name || 'this item'} (${itemReturn.id})`}
                                          >
                                            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                                            <span>Return: {itemReturn.status === 'REQUESTED' ? 'Scheduled' : itemReturn.status}</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenReturnModal(order, item);
                                            }}
                                            className="px-2.5 py-1.5 rounded-lg bg-neutral-800/90 hover:bg-neutral-700 text-amber-400 hover:text-amber-300 border border-neutral-700/80 transition flex items-center gap-1.5 text-[11px] font-mono font-bold cursor-pointer shrink-0 shadow-sm"
                                            title={`Initiate 7-day Return or Exchange with photo proof for ${item.product?.name || 'this item'}`}
                                          >
                                            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                                            <span>Return / Exchange</span>
                                          </button>
                                        )
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Cancellation Note if applicable */}
                          {isCancelled && order.cancellationReason && (
                            <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-900/60 text-xs font-mono space-y-1">
                              <div className="text-red-300 font-bold flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                                <span>Cancellation Reason: {order.cancellationReason}</span>
                              </div>
                              <div className="text-neutral-400 text-[11px]">
                                Refund Status: <span className="text-emerald-400 font-bold">{order.refundStatus || 'Refund Initiated to Original Source'}</span>
                              </div>
                            </div>
                          )}

                          {/* Meta & Price Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800/80 text-xs font-mono">
                            <div className="text-neutral-400 text-[11px]">
                              <span>Payment: </span>
                              <span className="text-white font-bold uppercase">{order.paymentMethod || 'UPI'}</span>
                              <span className="mx-2">•</span>
                              <span>Est. Delivery: </span>
                              <span className="text-neutral-200">{order.estimatedDelivery || 'Delivered'}</span>
                            </div>

                            <div className="text-right">
                              <span className="text-neutral-400 text-[11px]">Grand Total: </span>
                              <span className="text-sm font-bold text-emerald-400">
                                ₹{(order.total || 1099).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons: Reorder, Download Invoice, Print/Save PDF, Track, Return */}
                          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-neutral-800/60 font-mono text-xs">
                            {/* Return / Exchange Button for Delivered Orders */}
                            {isDelivered && !isCancelled && (
                              <button
                                type="button"
                                onClick={() => handleOpenReturnModal(order)}
                                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-amber-400 hover:text-amber-300 font-bold transition cursor-pointer flex items-center gap-1.5"
                                title="Initiate Return or Exchange request for items in this order"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                                <span>Return / Exchange</span>
                              </button>
                            )}

                            {/* Reorder Button for Completed/Non-Cancelled Orders */}
                            {!isCancelled && (
                              <button
                                type="button"
                                onClick={() => handleReorderOrder(order)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm shadow-emerald-950/40"
                                title={`Add all items from Order #${order.orderId} back to your shopping bag for quick checkout`}
                              >
                                <RotateCw className="w-3.5 h-3.5 text-white" />
                                <span>Reorder Order</span>
                              </button>
                            )}

                            {onOpenTrackOrder && !isCancelled && (
                              <button
                                onClick={() => {
                                  closeAccountModal();
                                  onOpenTrackOrder(order.orderId);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition cursor-pointer flex items-center gap-1.5"
                                title="Track live shipment"
                              >
                                <Truck className="w-3.5 h-3.5 text-blue-400" />
                                <span>Track Shipment</span>
                              </button>
                            )}

                            <button
                              onClick={() => handlePrintInvoice(order)}
                              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition cursor-pointer flex items-center gap-1.5"
                              title="Print or Save as PDF"
                            >
                              <Printer className="w-3.5 h-3.5 text-neutral-400" />
                              <span>Print / PDF</span>
                            </button>

                            <button
                              onClick={() => handleDownloadInvoice(order)}
                              className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm shadow-red-950/40"
                              title="Download official GST tax invoice"
                            >
                              <Download className="w-3.5 h-3.5 text-white" />
                              <span>Download Invoice</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              1. GIFT CARDS
             ======================================================== */}
          {activeAccountModal === 'GIFT_CARDS' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-tr from-rose-950/60 to-red-900/30 border border-red-500/30 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-red-400 uppercase font-bold">Anime Gift Vouchers</div>
                  <div className="text-white text-base font-bold font-sans mt-0.5">Send Style To Your Squad</div>
                  <div className="text-[10px] text-neutral-400 mt-1">Redeemable on all 240 GSM drops across Men & Kids collections</div>
                </div>
                <Gift className="w-10 h-10 text-red-500 shrink-0" />
              </div>

              <form onSubmit={handleRedeemGiftCard} className="space-y-2">
                <label className="block text-neutral-300 font-semibold">Redeem Gift Card Voucher</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={giftCardCode}
                    onChange={(e) => setGiftCardCode(e.target.value)}
                    placeholder="Enter code (e.g. TORI500)"
                    className="flex-1 px-3.5 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-white uppercase"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition cursor-pointer"
                  >
                    Redeem
                  </button>
                </div>
                {giftCardMsg && (
                  <p className={`text-[11px] mt-1 ${giftCardMsg.includes('Successfully') ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {giftCardMsg}
                  </p>
                )}
              </form>
            </div>
          )}

          {/* ========================================================
              2. TORI INSIDER
             ======================================================== */}
          {activeAccountModal === 'TORI_INSIDER' && (
            <div className="space-y-4 font-sans">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-white space-y-2 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-mono font-bold tracking-widest text-red-200">
                    VIP LOYALTY STATUS
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-black/30 text-white font-mono text-[10px] font-bold">
                    {customer?.insiderTier || 'Bronze'} Member
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono">
                  {customer?.insiderPoints || 100} Drop Points
                </div>
                <p className="text-xs text-red-100">
                  Earn 10 points for every ₹100 spent. Redeem points directly at checkout for exclusive capsule discounts!
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-neutral-300 uppercase tracking-wider font-mono">Insider Privileges:</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1">
                    <span className="text-red-400 font-bold block font-mono">⚡ 12h Early Drop Access</span>
                    <span className="text-[11px] text-neutral-400">Shop limited-edition chapters before public release</span>
                  </div>
                  <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1">
                    <span className="text-emerald-400 font-bold block font-mono">🚚 Free Priority Shipping</span>
                    <span className="text-[11px] text-neutral-400">Zero shipping fee on all anime apparel orders</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              3. TORI CREDIT
             ======================================================== */}
          {activeAccountModal === 'TORI_CREDIT' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-[#14141e] border border-neutral-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-neutral-400 uppercase font-mono">Available Wallet Balance</span>
                  <div className="text-2xl font-bold text-emerald-400 font-mono mt-0.5">
                    ₹{customer?.toriCredit || 250}.00
                  </div>
                  <span className="text-[10px] text-neutral-500 font-mono">Usable instantly on any apparel order</span>
                </div>
                <DollarSign className="w-10 h-10 text-emerald-500/40" />
              </div>

              <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
                <div className="font-bold text-neutral-200">How TORI Credit works:</div>
                <div>• Auto-applied at checkout for instant cash discounts</div>
                <div>• Instant refund credits are deposited here upon cancellation</div>
                <div>• Never expires and stackable with coupons</div>
              </div>
            </div>
          )}

          {/* ========================================================
              4. COUPONS
             ======================================================== */}
          {activeAccountModal === 'COUPONS' && (
            <div className="space-y-3">
              {serverCoupons === null ? (
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 font-mono">
                  Checking active drop coupons...
                </div>
              ) : serverCoupons.length === 0 ? (
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 font-mono">
                  No active promo codes are currently unlocked for your account. Watch for drop launch announcements!
                </div>
              ) : (
                serverCoupons.map((c) => (
                  <div key={c.code} className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-red-600/20 text-[#FF2028] font-bold border border-red-500/30">
                          {c.code}
                        </span>
                        <span className="text-white font-bold">{c.title}</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-1">{c.desc}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyCoupon(c.code)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-mono text-xs flex items-center gap-1 cursor-pointer shrink-0 transition"
                    >
                      {copiedCode === c.code ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ========================================================
              5. SAVED CARDS
             ======================================================== */}
          {activeAccountModal === 'SAVED_CARDS' && (
            <div className="space-y-3">
              {(customer?.savedCards && customer.savedCards.length > 0) ? (
                customer.savedCards.map((card) => (
                  <div key={card.id} className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-red-500" />
                      <div>
                        <div className="text-white font-bold">{card.brand} •••• {card.last4}</div>
                        <div className="text-neutral-500 text-[10px]">{card.cardHolder} · Exp {card.exp}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteSavedCard(card.id)}
                      className="p-1.5 text-neutral-500 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-neutral-400 bg-neutral-900/60 rounded-xl border border-neutral-800">
                  <CreditCard className="w-6 h-6 mx-auto mb-1 text-neutral-600" />
                  <span>No saved payment cards yet. Cards added during checkout will safely appear here.</span>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              6. SAVED VPA (UPI)
             ======================================================== */}
          {activeAccountModal === 'SAVED_VPA' && (
            <div className="space-y-3">
              {(customer?.savedVpa && customer.savedVpa.length > 0) ? (
                customer.savedVpa.map((vpa, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-white">{vpa}</span>
                    </div>
                    <button
                      onClick={() => deleteSavedVpa(vpa)}
                      className="p-1 text-neutral-500 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-neutral-500">No saved UPI Virtual Payment Addresses.</p>
              )}

              <form onSubmit={handleAddVpa} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newVpaInput}
                  onChange={(e) => setNewVpaInput(e.target.value)}
                  placeholder="e.g. 6281461985@upi or user@okaxis"
                  className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold cursor-pointer"
                >
                  Add VPA
                </button>
              </form>
            </div>
          )}

          {/* ========================================================
              7. SAVED ADDRESSES
             ======================================================== */}
          {activeAccountModal === 'SAVED_ADDRESSES' && (
            <div className="space-y-3">
              {(customer?.savedAddresses || []).map((addr) => (
                <div key={addr.id} className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-red-500" />
                      <span className="font-bold text-white">{addr.name}</span>
                      {addr.isDefault && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">Default</span>
                      )}
                    </div>
                    <div className="text-neutral-300 mt-1">{addr.addressLine}</div>
                    <div className="text-neutral-500 text-[11px]">{addr.city}, {addr.state} - {addr.pincode}</div>
                  </div>
                  <button
                    onClick={() => deleteSavedAddress(addr.id)}
                    className="p-1 text-neutral-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {!showAddAddress ? (
                <button
                  onClick={() => setShowAddAddress(true)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-neutral-700 hover:border-neutral-500 text-neutral-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Delivery Address</span>
                </button>
              ) : (
                <form onSubmit={handleSaveAddress} className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2.5">
                  <div className="font-bold text-white mb-1">New Delivery Address</div>
                  <input
                    type="text"
                    required
                    placeholder="Address Label (e.g. Home, Office)"
                    value={newAddressForm.name}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Flat, House no., Building, Street"
                    value={newAddressForm.addressLine}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, addressLine: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="City (e.g. Visakhapatnam)"
                      value={newAddressForm.city}
                      onChange={(e) => setNewAddressForm({ ...newAddressForm, city: e.target.value })}
                      className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Pincode (e.g. 530018)"
                      value={newAddressForm.pincode}
                      onChange={(e) => setNewAddressForm({ ...newAddressForm, pincode: e.target.value })}
                      className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold"
                    >
                      Save Address
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddAddress(false)}
                      className="px-3 py-2 bg-neutral-800 text-neutral-300 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ========================================================
              8. EDIT PROFILE
             ======================================================== */}
          {activeAccountModal === 'EDIT_PROFILE' && (
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="block text-neutral-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-300 mb-1">City / Region</label>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Return & Exchange Request Wizard Modal (With Camera Support) */}
      <ReturnExchangeModal
        isOpen={returnModalOpen}
        onClose={() => {
          setReturnModalOpen(false);
          setSelectedReturnOrder(null);
          setSelectedReturnItem(null);
        }}
        order={selectedReturnOrder}
        initialItem={selectedReturnItem}
        onSuccess={handleReturnSuccess}
      />

      {/* Return Status Detailed Modal */}
      {viewingReturnStatus && (
        <div 
          style={{ zIndex: 10000 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setViewingReturnStatus(null);
            }
          }}
        >
          <div className="relative w-full max-w-lg bg-[#0e0e16] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-950 border border-amber-700/80 flex items-center justify-center text-amber-400">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-white text-base font-bold font-sans flex items-center gap-2">
                    <span>{viewingReturnStatus.type === 'EXCHANGE' ? 'Exchange Status' : 'Return Status'}</span>
                    <span className="text-xs text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                      {viewingReturnStatus.id}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    Order #{viewingReturnStatus.orderId} • Requested on {viewingReturnStatus.createdAt}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setViewingReturnStatus(null)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
                aria-label="Close Return Status"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Stepper Status Bar */}
              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="text-[10px] text-neutral-400 font-bold uppercase mb-2">Reverse Progress</div>
                <div className="flex items-center justify-between text-center">
                  {[
                    { label: 'Requested', done: true },
                    { label: 'Pickup Ready', done: viewingReturnStatus.status !== 'REQUESTED' },
                    { label: 'QC Passed', done: viewingReturnStatus.status === 'QC_PASSED' || viewingReturnStatus.status === 'REFUNDED' || viewingReturnStatus.status === 'EXCHANGED' },
                    { label: viewingReturnStatus.type === 'EXCHANGE' ? 'Replaced' : 'Refunded', done: viewingReturnStatus.status === 'REFUNDED' || viewingReturnStatus.status === 'EXCHANGED' }
                  ].map((step, sIdx) => (
                    <div key={sIdx} className="flex-1 flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        step.done ? 'bg-amber-500 text-black shadow-sm shadow-amber-500/30' : 'bg-neutral-800 text-neutral-500'
                      }`}>
                        {step.done ? '✓' : sIdx + 1}
                      </div>
                      <div className={`text-[10px] mt-1 ${step.done ? 'text-white font-bold' : 'text-neutral-500'}`}>
                        {step.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Item Card */}
              <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-neutral-950 border border-neutral-800 overflow-hidden shrink-0">
                  <img
                    src={viewingReturnStatus.item.productImage || '/assets/toriwear-official-logo.png'}
                    alt={viewingReturnStatus.item.productName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/assets/toriwear-official-logo.png';
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white text-xs font-bold font-sans truncate">
                    {viewingReturnStatus.item.productName}
                  </div>
                  <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                    <span>Size: {viewingReturnStatus.item.size}</span>
                    <span>•</span>
                    <span>Qty: {viewingReturnStatus.item.quantity}</span>
                    <span>•</span>
                    <span className="text-white font-bold">₹{viewingReturnStatus.refundAmount.toLocaleString('en-IN')}</span>
                  </div>
                  {viewingReturnStatus.exchangeDetails && (
                    <div className="text-[11px] text-blue-400 mt-1">
                      Exchange for Size: <span className="font-bold">{viewingReturnStatus.exchangeDetails.newSize}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Reason & Comments */}
              <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Reason:</span>
                  <span className="text-white font-bold">{viewingReturnStatus.reason}</span>
                </div>
                {viewingReturnStatus.comments && (
                  <div className="pt-1 border-t border-neutral-800/80 text-neutral-300 text-[11px]">
                    "{viewingReturnStatus.comments}"
                  </div>
                )}
              </div>

              {/* Uploaded / Snapped Photos Preview */}
              {viewingReturnStatus.photos && viewingReturnStatus.photos.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-neutral-400 font-bold uppercase">
                    Photos Attached ({viewingReturnStatus.photos.length})
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {viewingReturnStatus.photos.map((p, pIdx) => (
                      <div key={pIdx} className="aspect-square rounded-lg overflow-hidden border border-neutral-700 bg-neutral-900">
                        <img src={p} alt={`Proof ${pIdx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pickup Courier & Address */}
              <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Pickup Date:</span>
                  <span className="text-neutral-200">{viewingReturnStatus.estimatedPickupDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Reverse Courier:</span>
                  <span className="text-blue-400 font-bold">BlueDart Express Reverse</span>
                </div>
                <div className="flex items-start justify-between pt-1 border-t border-neutral-800/80">
                  <span className="text-neutral-400 shrink-0">Pickup At:</span>
                  <span className="text-neutral-300 text-right truncate max-w-[240px]">
                    {viewingReturnStatus.pickupAddress.addressLine1}, {viewingReturnStatus.pickupAddress.city} - {viewingReturnStatus.pickupAddress.pincode}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
              {viewingReturnStatus.status === 'REQUESTED' ? (
                <button
                  type="button"
                  onClick={() => handleCancelCustomerReturn(viewingReturnStatus.id)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-red-950 text-red-400 border border-red-900/60 font-bold transition cursor-pointer text-xs"
                >
                  Cancel Return Request
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setViewingReturnStatus(null)}
                className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold transition cursor-pointer text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerAccountModals;
