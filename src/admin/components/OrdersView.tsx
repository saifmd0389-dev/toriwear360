import React, { useState } from 'react';
import { useAdmin } from '../AdminDataContext';
import { AdminOrder, OrderShippingStatus } from '../types';
import {
  ShoppingBag,
  Search,
  ChevronRight,
  X,
  Truck,
  Printer,
  FileText,
  Send,
  MapPin,
  User,
} from 'lucide-react';

import { getSessionToken } from '../services/platformService';

function getAdminAuthHeaders(): HeadersInit {
  const token = getSessionToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const OrdersView: React.FC = () => {
  const { orders, updateOrderStatus, addOrderTimelineEvent, addOrderInternalNote, cancelOrder, initiateRefund, settings, showToast } = useAdmin();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState<string>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [newInternalNote, setNewInternalNote] = useState('');
  const [newTimelineTitle, setNewTimelineTitle] = useState('');
  const [newTimelineNote, setNewTimelineNote] = useState('');
  const [addingTimeline, setAddingTimeline] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Multi-Logistics Dispatch State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [carrierRates, setCarrierRates] = useState<any[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<string>('AUTO');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState('');
  const [labelViewerHtml, setLabelViewerHtml] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState(false);
  const [shipmentActionLoading, setShipmentActionLoading] = useState(false);

  const openAuthenticatedLabel = async (awb: string) => {
    try {
      setLoadingLabel(true);
      const res = await fetch(`/api/v1/admin/logistics/shipments/${encodeURIComponent(awb)}/label`, {
        headers: getAdminAuthHeaders(),
      });
      const html = await res.text();
      if (!res.ok) {
        showToast('Failed to load shipping label.');
        return;
      }
      setLabelViewerHtml(html);
    } catch {
      showToast('Error loading shipping label.');
    } finally {
      setLoadingLabel(false);
    }
  };

  const handleSchedulePickup = async (awb: string) => {
    try {
      setShipmentActionLoading(true);
      const res = await fetch(`/api/v1/admin/logistics/shipments/${encodeURIComponent(awb)}/pickup`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.data?.message || `Pickup requested for AWB ${awb}`);
      } else {
        showToast(data.error || data.data?.message || 'Failed to request carrier pickup');
      }
    } catch {
      showToast('Network error requesting carrier pickup');
    } finally {
      setShipmentActionLoading(false);
    }
  };

  const handleCancelManifestedShipment = async (order: AdminOrder) => {
    if (!order.trackingNumber) return;
    try {
      setShipmentActionLoading(true);
      const res = await fetch(`/api/v1/admin/logistics/shipments/${encodeURIComponent(order.trackingNumber)}/cancel`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({ reason: 'Admin cancelled manifested shipment' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        updateOrderStatus(order.orderId, 'CANCELLED');
        setSelectedOrder(prev => prev ? { ...prev, shippingStatus: 'CANCELLED' } : null);
        showToast(data.message || `Shipment ${order.trackingNumber} cancelled`);
      } else {
        showToast(data.error || 'Failed to cancel shipment with carrier');
      }
    } catch {
      showToast('Error cancelling shipment');
    } finally {
      setShipmentActionLoading(false);
    }
  };

  const fetchRatesForOrder = async (order: AdminOrder) => {
    try {
      setLoadingRates(true);
      const totalWeight = Math.max(350, (order.items?.length || 1) * 350);
      const res = await fetch('/api/v1/admin/logistics/rates', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({
          destinationPin: order.shippingAddress.pincode,
          weightGrams: totalWeight,
          cod: order.paymentMethod === 'COD',
          declaredValue: order.total,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCarrierRates(data.data);
      }
    } catch (e) {
      console.error('Failed to load rates for order:', e);
    } finally {
      setLoadingRates(false);
    }
  };

  const handleOpenDispatch = (order: AdminOrder) => {
    setSelectedOrder(order);
    setDispatchError('');
    setShowDispatchModal(true);
    fetchRatesForOrder(order);
  };

  const handleManifestShipment = async () => {
    if (!selectedOrder) return;
    setDispatchError('');
    try {
      setDispatching(true);
      const totalWeight = Math.max(350, (selectedOrder.items?.length || 1) * 350);
      const res = await fetch('/api/v1/admin/logistics/shipments', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({
          orderId: selectedOrder.orderId,
          orderNumber: selectedOrder.orderNumber,
          carrierKey: selectedCarrier === 'AUTO' ? undefined : selectedCarrier,
          recipient: {
            fullName: selectedOrder.customerName,
            phone: selectedOrder.customerPhone,
            email: selectedOrder.customerEmail,
            addressLine1: selectedOrder.shippingAddress.addressLine1,
            city: selectedOrder.shippingAddress.city,
            state: selectedOrder.shippingAddress.state,
            pincode: selectedOrder.shippingAddress.pincode,
          },
          items: selectedOrder.items.map(it => ({
            name: it.productName,
            sku: it.sku,
            quantity: it.quantity,
            price: it.unitPrice,
          })),
          packageSpecs: {
            weightGrams: totalWeight,
            lengthCm: 32,
            breadthCm: 25,
            heightCm: 5,
          },
          paymentMethod: selectedOrder.paymentMethod,
          declaredValue: selectedOrder.total,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        const shipment = data.data;
        updateOrderStatus(selectedOrder.orderId, 'PROCESSING', shipment.trackingUrl);
        setSelectedOrder(prev => prev ? {
          ...prev,
          shippingStatus: 'PROCESSING',
          courier: shipment.carrierName,
          trackingNumber: shipment.awbNumber,
        } : null);
        setShowDispatchModal(false);
        openAuthenticatedLabel(shipment.awbNumber);
        showToast(`Shipment manifested via ${shipment.carrierName} (AWB: ${shipment.awbNumber})`);
      } else {
        setDispatchError(data.error || 'Failed to manifest courier shipment');
      }
    } catch (e: any) {
      setDispatchError(e?.message || 'Error manifesting shipment');
    } finally {
      setDispatching(false);
    }
  };

  const filtered = orders.filter((o) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = o.orderNumber.toLowerCase().includes(q) ||
                    o.customerName.toLowerCase().includes(q) ||
                    o.customerEmail.toLowerCase().includes(q) ||
                    (o.trackingNumber && o.trackingNumber.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (statusTab !== 'ALL' && o.shippingStatus !== statusTab) return false;
    return true;
  });

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !newInternalNote.trim()) return;
    addOrderInternalNote(selectedOrder.orderId, newInternalNote.trim());
    setNewInternalNote('');
  };

  const handleAddTimelineMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !newTimelineTitle.trim()) return;
    setAddingTimeline(true);
    const res = await addOrderTimelineEvent(
      selectedOrder.orderId,
      newTimelineTitle.trim(),
      newTimelineNote.trim() || undefined
    );
    setAddingTimeline(false);
    if (res.success) {
      setNewTimelineTitle('');
      setNewTimelineNote('');
    }
  };

  const activeOrder = selectedOrder
    ? orders.find((o) => o.orderId === selectedOrder.orderId) || selectedOrder
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-500" />
            <span>Orders Fulfillment & Shipping Pipeline</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Manage dispatch statuses, generate GST tax invoices, courier AWBs, and process returns.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
            Total Orders: <strong className="text-white">{orders.length}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
            Pending Dispatch: <strong>{orders.filter(o => o.shippingStatus === 'PROCESSING' || o.shippingStatus === 'CONFIRMED').length}</strong>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-neutral-800 text-xs">
        {[
          { key: 'ALL', label: 'All Orders' },
          { key: 'NEW', label: 'New' },
          { key: 'CONFIRMED', label: 'Confirmed' },
          { key: 'PROCESSING', label: 'Processing' },
          { key: 'PACKED', label: 'Packed' },
          { key: 'SHIPPED', label: 'Shipped' },
          { key: 'DELIVERED', label: 'Delivered' },
          { key: 'CANCELLED', label: 'Cancelled' },
          { key: 'RETURN_REQUESTED', label: 'Returns' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors cursor-pointer ${
              statusTab === tab.key
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white bg-neutral-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="bg-[#14141c] p-3.5 rounded-2xl border border-neutral-800">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Order # (e.g. TORI-10482), customer name, email, or AWB tracking..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-[#14141c] border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-[#181824] text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
              <tr>
                <th className="p-3.5 pl-4">Order #</th>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Items</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5">Payment</th>
                <th className="p-3.5">Shipping Status</th>
                <th className="p-3.5 text-right pr-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-sans">
              {filtered.map((ord) => (
                <tr 
                  key={ord.orderId}
                  onClick={() => setSelectedOrder(ord)}
                  className="hover:bg-neutral-800/40 transition-colors cursor-pointer group"
                >
                  <td className="p-3.5 pl-4 font-mono font-bold text-red-400 group-hover:text-red-300">
                    {ord.orderNumber}
                  </td>
                  <td className="p-3.5 font-mono text-neutral-400">
                    {ord.date}
                  </td>
                  <td className="p-3.5">
                    <div className="font-semibold text-white">{ord.customerName}</div>
                    <div className="text-[11px] text-neutral-400">{ord.shippingAddress.city}, {ord.shippingAddress.state}</div>
                  </td>
                  <td className="p-3.5">
                    <span className="text-neutral-300">{ord.items.length} {ord.items.length === 1 ? 'item' : 'items'}</span>
                    <div className="text-[10px] text-neutral-500 font-mono">
                      {ord.items.map(i => `${i.size}`).join(', ')}
                    </div>
                  </td>
                  <td className="p-3.5 font-mono font-bold text-white">
                    ₹{ord.total.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                      ord.paymentStatus === 'PAID'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : ord.paymentStatus === 'REFUNDED'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {ord.paymentMethod} • {ord.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                      ord.shippingStatus === 'DELIVERED'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : ord.shippingStatus === 'SHIPPED'
                        ? 'bg-blue-500/10 text-blue-400'
                        : ord.shippingStatus === 'CANCELLED'
                        ? 'bg-red-500/10 text-red-400'
                        : ord.shippingStatus === 'RETURN_REQUESTED'
                        ? 'bg-orange-500/10 text-orange-400'
                        : 'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {ord.shippingStatus}
                    </span>
                  </td>
                  <td className="p-3.5 text-right pr-4">
                    <button
                      className="p-1.5 rounded-lg bg-neutral-800 group-hover:bg-neutral-700 text-neutral-300 group-hover:text-white transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Order Modal Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div 
            className="w-full max-w-2xl bg-[#14141c] border-l border-neutral-700 h-full overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-neutral-800 bg-[#181824] flex items-center justify-between sticky top-0 z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white font-mono">{selectedOrder.orderNumber}</h2>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono font-medium">
                    {selectedOrder.shippingStatus}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">Placed on {selectedOrder.date}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleOpenDispatch(selectedOrder)}
                  className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-red-600/20"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Manifest Courier</span>
                </button>

                {selectedOrder.trackingNumber && (
                  <>
                    <button
                      disabled={loadingLabel}
                      onClick={() => openAuthenticatedLabel(selectedOrder.trackingNumber!)}
                      className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{loadingLabel ? 'Loading...' : 'Print Label'}</span>
                    </button>

                    {selectedOrder.shippingStatus !== 'CANCELLED' && selectedOrder.shippingStatus !== 'DELIVERED' && (
                      <>
                        <button
                          disabled={shipmentActionLoading}
                          onClick={() => handleSchedulePickup(selectedOrder.trackingNumber!)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          Request Pickup
                        </button>
                        <button
                          disabled={shipmentActionLoading}
                          onClick={() => handleCancelManifestedShipment(selectedOrder)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          Cancel Shipment
                        </button>
                      </>
                    )}
                  </>
                )}

                <button
                  onClick={() => setShowInvoiceModal(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>GST Invoice</span>
                </button>

                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="p-6 space-y-6 flex-1">
              {/* Dispatch Status Updater Bar */}
              <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                    Change Fulfillment Status
                  </span>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-neutral-400">Carrier:</span>
                    <strong className="text-white">{selectedOrder.courier || 'Unassigned'}</strong>
                    {selectedOrder.trackingNumber && (
                      <span className="text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                        AWB: {selectedOrder.trackingNumber}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {(['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'] as OrderShippingStatus[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        updateOrderStatus(selectedOrder.orderId, st);
                        setSelectedOrder(prev => prev ? { ...prev, shippingStatus: st } : null);
                      }}
                      className={`py-2 px-1.5 text-center text-[10px] font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                        selectedOrder.shippingStatus === st
                          ? 'border-red-500 bg-red-600 text-white'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer & Delivery Address Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold flex items-center gap-1.5 mb-2">
                    <User className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Customer Details</span>
                  </div>
                  <div className="font-bold text-white text-sm">{selectedOrder.customerName}</div>
                  <div className="text-xs text-neutral-300 font-mono">{selectedOrder.customerEmail}</div>
                  <div className="text-xs text-neutral-300 font-mono">{selectedOrder.customerPhone}</div>
                </div>

                <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold flex items-center gap-1.5 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Shipping Address</span>
                  </div>
                  <div className="text-xs text-white">{selectedOrder.shippingAddress.addressLine1}</div>
                  <div className="text-xs text-neutral-400">
                    {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} - {selectedOrder.shippingAddress.pincode}
                  </div>
                  {selectedOrder.trackingNumber && (
                    <div className="text-[11px] text-red-400 font-mono mt-1">
                      AWB: {selectedOrder.trackingNumber}
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items Table */}
              <div>
                <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                  Line Items ({selectedOrder.items.length})
                </h3>
                <div className="border border-neutral-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-neutral-300">
                    <thead className="bg-neutral-900 text-neutral-400 text-[10px] uppercase font-mono border-b border-neutral-800">
                      <tr>
                        <th className="p-3">Item</th>
                        <th className="p-3">Size/Color</th>
                        <th className="p-3">Qty</th>
                        <th className="p-3 text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {selectedOrder.items.map((it, idx) => (
                        <tr key={`${it.sku}-${idx}`} className="hover:bg-neutral-800/30">
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <img src={it.image} alt={it.productName} className="w-9 h-9 rounded object-cover bg-neutral-800" />
                              <div>
                                <div className="font-semibold text-white">{it.productName}</div>
                                <div className="text-[10px] text-neutral-500 font-mono">{it.sku}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 font-mono">{it.size} / {it.color}</td>
                          <td className="p-3 font-mono">{it.quantity}</td>
                          <td className="p-3 font-mono font-bold text-white text-right">₹{it.unitPrice * it.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Price Breakdown */}
                <div className="mt-3 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-neutral-400">
                    <span>Subtotal</span>
                    <span className="font-mono text-white">₹{selectedOrder.subtotal}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Discount (Code Applied)</span>
                      <span className="font-mono">-₹{selectedOrder.discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-neutral-400">
                    <span>GST (5% Apparel SGST + CGST)</span>
                    <span className="font-mono text-white">₹{selectedOrder.tax}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Shipping Fee</span>
                    <span className="font-mono text-white">
                      {selectedOrder.shippingFee === 0 ? 'FREE' : `₹${selectedOrder.shippingFee}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-white font-bold pt-2 border-t border-neutral-800 text-sm">
                    <span>Total Amount Paid</span>
                    <span className="font-mono text-red-400">₹{selectedOrder.total}</span>
                  </div>
                </div>
              </div>

              {/* Order Timeline */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                    Fulfillment History ({(activeOrder?.timeline || selectedOrder.timeline).length})
                  </h3>
                </div>
                <div className="space-y-3 border-l-2 border-neutral-800 pl-4 ml-2 mb-3">
                  {(activeOrder?.timeline || selectedOrder.timeline).map((step, idx) => {
                    const parsedTs = step.timestamp ? new Date(step.timestamp) : null;
                    const displayTs =
                      parsedTs && !Number.isNaN(parsedTs.getTime())
                        ? parsedTs.toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : step.timestamp;
                    return (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-red-500" />
                        <div className="text-xs font-semibold text-white">{step.title}</div>
                        <div className="text-[10px] text-neutral-500 font-mono tabular-nums">{displayTs}</div>
                        {step.note && step.note !== step.title && (
                          <div className="text-xs text-neutral-400 mt-0.5">{step.note}</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Customer-Visible Timeline Milestone */}
                <form onSubmit={handleAddTimelineMilestone} className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
                  <div className="text-[11px] font-mono font-semibold text-neutral-300">
                    Post Customer Timeline Update
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Milestone title (e.g. Dispatched from Mumbai Hub)"
                      value={newTimelineTitle}
                      onChange={(e) => setNewTimelineTitle(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-neutral-950 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                    />
                    <button
                      type="submit"
                      disabled={addingTimeline || !newTimelineTitle.trim()}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <Send className="w-3 h-3" />
                      <span>{addingTimeline ? 'Posting...' : 'Post Update'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Optional tracking note for customer (e.g. Handed over to BlueDart Air Express)"
                    value={newTimelineNote}
                    onChange={(e) => setNewTimelineNote(e.target.value)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-red-500"
                  />
                </form>
              </div>

              {/* Internal Staff Notes */}
              <div>
                <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                  Internal Staff Notes
                </h3>
                <div className="space-y-2 mb-3">
                  {selectedOrder.internalNotes.length === 0 ? (
                    <p className="text-xs text-neutral-500">No staff notes recorded yet.</p>
                  ) : (
                    selectedOrder.internalNotes.map((n) => (
                      <div key={n.id} className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs">
                        <div className="flex items-center justify-between text-neutral-400 text-[10px] mb-1 font-mono">
                          <span className="font-bold text-white">{n.author}</span>
                          <span>{n.timestamp}</span>
                        </div>
                        <p className="text-neutral-300">{n.text}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add private staff note regarding packaging or address..."
                    value={newInternalNote}
                    onChange={(e) => setNewInternalNote(e.target.value)}
                    className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </form>
              </div>

              {/* Danger Zone: Cancel / Refund */}
              <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const reason = prompt('Reason for cancelling order:');
                    if (reason) cancelOrder(selectedOrder.orderId, reason);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 text-xs font-medium cursor-pointer"
                >
                  Cancel Order
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const amt = prompt(`Enter refund amount (Max ₹${selectedOrder.total}):`, String(selectedOrder.total));
                    if (amt && !isNaN(Number(amt))) {
                      initiateRefund(selectedOrder.orderId, Number(amt), 'Customer requested return / exchange');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 text-xs font-medium cursor-pointer"
                >
                  Process Refund
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clean Printable GST Tax Invoice Modal */}
      {showInvoiceModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white text-neutral-900 rounded-2xl shadow-2xl p-8 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start border-b border-neutral-200 pb-4">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-neutral-900">TORIWEAR</h1>
                <p className="text-xs text-neutral-500 font-mono">GSTIN: 27AABCT9981E1Z0</p>
                <p className="text-xs text-neutral-500">Toriwear Streetwear Labs Pvt Ltd, Mumbai, India</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold uppercase tracking-wider bg-neutral-100 px-2 py-1 rounded">
                  TAX INVOICE
                </span>
                <div className="font-mono text-sm font-bold mt-1">INV-{selectedOrder.orderNumber}</div>
                <div className="text-xs text-neutral-500">{selectedOrder.date}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 my-6 text-xs">
              <div>
                <span className="font-bold text-neutral-700 block mb-1">Billed & Shipped To:</span>
                <div className="font-semibold text-neutral-900">{selectedOrder.customerName}</div>
                <div>{selectedOrder.shippingAddress.addressLine1}</div>
                <div>{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} - {selectedOrder.shippingAddress.pincode}</div>
                <div>Phone: {selectedOrder.customerPhone}</div>
              </div>
              <div className="text-right">
                <span className="font-bold text-neutral-700 block mb-1">Payment Method:</span>
                <div className="font-semibold">{selectedOrder.paymentMethod}</div>
                <div className="text-neutral-500">Gateway Ref: pay_{selectedOrder.orderNumber}</div>
                <div className="text-neutral-500">HSN Code: 6109 (Cotton T-Shirts)</div>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-neutral-200">
              <thead className="bg-neutral-100 text-neutral-700 uppercase font-mono">
                <tr>
                  <th className="p-2 border">Description</th>
                  <th className="p-2 border">Size</th>
                  <th className="p-2 border">Qty</th>
                  <th className="p-2 border text-right">Taxable Val</th>
                  <th className="p-2 border text-right">GST (5%)</th>
                  <th className="p-2 border text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.items.map((it, idx) => (
                  <tr key={`${it.sku}-${idx}`} className="border-b">
                    <td className="p-2 border font-medium">{it.productName}</td>
                    <td className="p-2 border font-mono">{it.size}</td>
                    <td className="p-2 border font-mono">{it.quantity}</td>
                    <td className="p-2 border font-mono text-right">₹{Math.round(it.unitPrice * 0.952)}</td>
                    <td className="p-2 border font-mono text-right">₹{Math.round(it.unitPrice * 0.048)}</td>
                    <td className="p-2 border font-mono font-bold text-right">₹{it.unitPrice * it.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-1 text-xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">₹{selectedOrder.subtotal}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Total Tax (CGST+SGST):</span>
                  <span className="font-mono">₹{selectedOrder.tax}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-neutral-900 border-t pt-1">
                  <span>Grand Total:</span>
                  <span className="font-mono">₹{selectedOrder.total}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-neutral-200 flex justify-between items-center text-xs text-neutral-500">
              <span>This is a computer-generated tax invoice under Indian GST law.</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-neutral-900 text-white rounded font-medium cursor-pointer"
                >
                  Print Invoice
                </button>
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-3 py-1.5 bg-neutral-200 text-neutral-800 rounded font-medium cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Logistics Dispatch Modal */}
      {showDispatchModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#14141c] border border-neutral-700 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-red-500" />
                <div>
                  <h3 className="font-bold text-white text-sm">
                    Manifest Courier Dispatch & AWB Generation
                  </h3>
                  <p className="text-[11px] text-neutral-400 font-mono">
                    Order {selectedOrder.orderNumber} • Destination PIN: {selectedOrder.shippingAddress.pincode} ({selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDispatchModal(false)}
                className="text-neutral-400 hover:text-white text-xs cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Carrier Comparison Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300 uppercase tracking-wider">
                  Select Carrier / Rate Tier
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {loadingRates ? 'Fetching live freight quotes...' : `${carrierRates.length} available courier options`}
                </span>
              </div>

              {loadingRates ? (
                <div className="p-8 text-center text-neutral-400 text-xs bg-neutral-900 border border-neutral-800 rounded-xl">
                  Pinging logistics partner gateways for PIN {selectedOrder.shippingAddress.pincode}...
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {/* Option: Auto allocation */}
                  <label
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedCarrier === 'AUTO'
                        ? 'border-red-500 bg-red-600/10'
                        : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="carrierSelect"
                        checked={selectedCarrier === 'AUTO'}
                        onChange={() => setSelectedCarrier('AUTO')}
                        className="text-red-600 focus:ring-red-500"
                      />
                      <div>
                        <div className="font-bold text-white text-xs flex items-center gap-2">
                          <span>Auto-Allocate (Recommended Strategy)</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-mono">
                            OPTIMIZED
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400">
                          Automatically select best-match courier based on delivery SLA and freight cost.
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* Carrier options */}
                  {carrierRates.map((q, idx) => (
                    <label
                      key={`${q.carrierKey}-${idx}`}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedCarrier === q.carrierKey
                          ? 'border-red-500 bg-red-600/10'
                          : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="carrierSelect"
                          checked={selectedCarrier === q.carrierKey}
                          onChange={() => setSelectedCarrier(q.carrierKey)}
                          className="text-red-600 focus:ring-red-500"
                        />
                        <div>
                          <div className="font-bold text-white text-xs flex items-center gap-2">
                            <span>{q.carrierName}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">({q.serviceName})</span>
                            {q.isCheapest && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-mono">
                                LOWEST
                              </span>
                            )}
                            {q.isFastest && (
                              <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[9px] font-mono">
                                FASTEST
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                            Transit: {q.estimatedDays} {q.estimatedDays === 1 ? 'day' : 'days'} • COD: {q.isCodAvailable ? 'Yes' : 'Prepaid Only'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-white text-sm">₹{q.rate}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Package Summary */}
            <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] font-mono flex items-center justify-between text-neutral-300">
              <div>
                <span>Est. Weight: </span>
                <strong className="text-white">{Math.max(350, selectedOrder.items.length * 350)}g</strong> (240+ GSM Cotton)
              </div>
              <div>
                <span>Payment: </span>
                <strong className="text-white">{selectedOrder.paymentMethod}</strong> (₹{selectedOrder.total})
              </div>
              <div>
                <span>Origin Hub: </span>
                <strong className="text-white">
                  {(settings as any)?.pickupWarehousePin 
                    ? `${(settings as any).pickupWarehousePin} (${(settings as any).pickupWarehouseCity || 'Warehouse'})` 
                    : 'Configured Dispatch Hub'}
                </strong>
              </div>
            </div>

            {dispatchError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-medium">
                {dispatchError}
              </div>
            )}

            <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleManifestShipment}
                disabled={dispatching}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Truck className="w-4 h-4" />
                <span>{dispatching ? 'Manifesting & Generating AWB...' : 'Confirm Dispatch & Generate AWB'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Label Viewer Modal */}
      {labelViewerHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#14141c] border border-neutral-700 rounded-2xl w-full max-w-3xl h-[85vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-white text-sm">
                  Thermal Shipping Label & Barcode
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const iframe = document.getElementById('thermal-label-iframe') as HTMLIFrameElement | null;
                      iframe?.contentWindow?.print();
                    } catch {}
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                >
                  Thermal Print Label
                </button>
                <button
                  onClick={() => setLabelViewerHtml(null)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 bg-white rounded-xl overflow-hidden border border-neutral-700">
              <iframe
                id="thermal-label-iframe"
                srcDoc={labelViewerHtml}
                title="Shipping Label"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
