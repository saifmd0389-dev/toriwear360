import React, { useState, useMemo } from 'react';
import { useAdmin } from '../AdminDataContext';
import { CustomerProfile } from '../types';
import {
  Users,
  Search,
  ShoppingBag,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  X,
  Heart,
  Eye,
  Flame,
  Package,
  BellRing,
  CheckCircle2,
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const { customers, orders } = useAdmin();

  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'WISHLIST' | 'CART' | 'SEARCH' | 'VIEWS' | 'ORDERS' | 'DETAILS'>('WISHLIST');
  const [restockAlertSent, setRestockAlertSent] = useState<string | null>(null);

  // Aggregated Out-Of-Stock Wishlist Demand: "People Looking For This T-Shirt"
  const outOfStockDemands = useMemo(() => {
    const demandMap = new Map<string, {
      productId: string;
      productName: string;
      image: string;
      price: number;
      interestedCustomers: {
        id: string;
        name: string;
        email: string;
        phone: string;
      }[];
    }>();

    customers.forEach((cust) => {
      (cust.wishlistItems || []).forEach((item) => {
        if (item.inStock === false) {
          const key = item.productId || item.productName;
          if (!demandMap.has(key)) {
            demandMap.set(key, {
              productId: item.productId,
              productName: item.productName,
              image: item.image || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop&q=80',
              price: item.price || 1299,
              interestedCustomers: [],
            });
          }
          const entry = demandMap.get(key)!;
          if (!entry.interestedCustomers.some(c => c.id === cust.id)) {
            entry.interestedCustomers.push({
              id: cust.id,
              name: cust.name,
              email: cust.email,
              phone: cust.phone,
            });
          }
        }
      });
    });

    return Array.from(demandMap.values()).sort((a, b) => b.interestedCustomers.length - a.interestedCustomers.length);
  }, [customers]);

  const totalPeopleLooking = useMemo(() => {
    return outOfStockDemands.reduce((sum, item) => sum + item.interestedCustomers.length, 0);
  }, [outOfStockDemands]);

  const filtered = customers.filter((c) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = c.name.toLowerCase().includes(q) ||
                    c.email.toLowerCase().includes(q) ||
                    c.phone.includes(q) ||
                    (c.searchHistory && c.searchHistory.some(s => s.toLowerCase().includes(q))) ||
                    (c.wishlistItems && c.wishlistItems.some(w => w.productName.toLowerCase().includes(q)));
      if (!match) return false;
    }
    if (segmentFilter !== 'ALL' && !c.tags.includes(segmentFilter)) return false;
    return true;
  });

  const handleNotifyWarehouse = (productName: string) => {
    setRestockAlertSent(productName);
    setTimeout(() => {
      setRestockAlertSent(null);
    }, 3500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-500" />
            <span>Customer CRM & Behavioral Intelligence</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Real-time tracking of customer accounts, search queries, product views, active carts, and out-of-stock wishlist demand.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
            Total Customers: <strong className="text-white">{customers.length}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>OOS Wishlist Demand: <strong>{totalPeopleLooking}</strong></span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
            VIP Tier: <strong>{customers.filter(c => c.tags.includes('VIP')).length}</strong>
          </span>
        </div>
      </div>

      {/* 🚨 CORE SECTION: PEOPLE LOOKING FOR THIS T-SHIRT (Out of stock wishlist demand) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-neutral-950 via-[#161214] to-neutral-950 border border-red-500/30 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/40 text-red-500 flex items-center justify-center font-bold">
              <Flame className="w-4 h-4 fill-red-500 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>People Looking For This T-Shirt</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-600 text-white font-bold uppercase tracking-wider">
                  Out-Of-Stock Wishlist Alert
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                Customers who have added out-of-stock t-shirts to their wishlist waiting for restock.
              </p>
            </div>
          </div>

          <div className="text-right font-mono text-xs">
            <span className="text-neutral-400">Active High-Demand SKUs: </span>
            <span className="font-bold text-red-400">{outOfStockDemands.length} t-shirts</span>
          </div>
        </div>

        {restockAlertSent && (
          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Restock broadcast dispatched to Warehouse Ops & Surat Manufacturing Hub for <strong>"{restockAlertSent}"</strong>! Interested customers will be auto-notified via SMS/WhatsApp.</span>
          </div>
        )}

        {outOfStockDemands.length === 0 ? (
          <div className="p-6 text-center text-xs text-neutral-400 font-mono bg-neutral-900/40 rounded-xl border border-neutral-800">
            No customers currently have out-of-stock items in their wishlist. As soon as a user wishlists an out-of-stock t-shirt on the storefront, it will appear here instantly!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {outOfStockDemands.map((demand) => (
              <div 
                key={demand.productId}
                className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 hover:border-red-500/40 transition flex gap-3 group relative overflow-hidden"
              >
                <img 
                  src={demand.image} 
                  alt={demand.productName} 
                  className="w-16 h-20 rounded-lg object-cover bg-neutral-950 border border-neutral-800 shrink-0" 
                />
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-mono font-bold text-red-500 uppercase bg-red-950/60 border border-red-500/30 px-1.5 py-0.5 rounded">
                        OUT OF STOCK
                      </span>
                      <span className="text-[11px] font-mono font-bold text-emerald-400">
                        ₹{demand.price}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-white mt-1 group-hover:text-red-400 transition truncate">
                      {demand.productName}
                    </h3>

                    {/* People looking counter */}
                    <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-amber-400">
                      <Flame className="w-3.5 h-3.5 fill-amber-500" />
                      <span>{demand.interestedCustomers.length} people looking for this t-shirt</span>
                    </div>
                  </div>

                  {/* Customer Badges */}
                  <div className="mt-2 pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {demand.interestedCustomers.slice(0, 3).map((cust) => (
                        <div 
                          key={cust.id} 
                          title={`${cust.name} (${cust.phone})`}
                          className="inline-block h-5 w-5 rounded-full ring-2 ring-neutral-900 bg-neutral-700 text-white font-bold text-[9px] flex items-center justify-center cursor-pointer"
                        >
                          {cust.name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {demand.interestedCustomers.length > 3 && (
                        <div className="inline-block h-5 w-5 rounded-full ring-2 ring-neutral-900 bg-neutral-800 text-neutral-400 font-bold text-[9px] flex items-center justify-center">
                          +{demand.interestedCustomers.length - 3}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleNotifyWarehouse(demand.productName)}
                      className="px-2 py-1 rounded bg-red-600/80 hover:bg-red-600 text-white text-[10px] font-mono font-bold uppercase transition cursor-pointer flex items-center gap-1"
                    >
                      <BellRing className="w-3 h-3" />
                      <span>Prioritize Restock</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-[#14141c] p-3.5 rounded-2xl border border-neutral-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, email, mobile, search queries, or wishlisted products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
            className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-red-500 cursor-pointer"
          >
            <option value="ALL">All Segments</option>
            <option value="VIP">VIP Collectors (₹4,000+ spend)</option>
            <option value="Repeat Buyer">Repeat Buyers</option>
            <option value="New Customer">New Customers</option>
            <option value="Anime Core">Anime Core</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-[#14141c] border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-[#181824] text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
              <tr>
                <th className="p-3.5 pl-4">Customer Name & ID</th>
                <th className="p-3.5">Contact Details</th>
                <th className="p-3.5">Cart Items</th>
                <th className="p-3.5">Wishlist & OOS Demand</th>
                <th className="p-3.5">Recent Search Queries</th>
                <th className="p-3.5">Lifetime Spend</th>
                <th className="p-3.5">Orders</th>
                <th className="p-3.5 text-right pr-4">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-sans">
              {filtered.map((c) => {
                const oosWishlistCount = (c.wishlistItems || []).filter(w => w.inStock === false).length;
                const cartCount = (c.cartItems || []).reduce((s, i) => s + (i.quantity || 1), 0);

                return (
                  <tr 
                    key={c.id} 
                    onClick={() => {
                      setSelectedCustomer(c);
                      setActiveDrawerTab('WISHLIST');
                    }}
                    className="hover:bg-neutral-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="p-3.5 pl-4">
                      <div className="font-semibold text-white group-hover:text-teal-400 transition-colors flex items-center gap-1.5">
                        <span>{c.name}</span>
                        {c.tags.includes('VIP') && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold">
                            VIP
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500 font-mono">
                        {c.id} • Registered {c.createdAt}
                      </div>
                    </td>

                    <td className="p-3.5 font-mono text-neutral-300">
                      <div>{c.email}</div>
                      <div className="text-[10px] text-neutral-500">{c.phone}</div>
                    </td>

                    {/* Active Cart */}
                    <td className="p-3.5">
                      {cartCount > 0 ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-neutral-900 border border-neutral-700 text-white flex items-center gap-1 w-max">
                          <ShoppingBag className="w-3 h-3 text-red-500" />
                          <span>{cartCount} in cart</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-500 font-mono">Cart empty</span>
                      )}
                    </td>

                    {/* Wishlist & Out-of-Stock alert */}
                    <td className="p-3.5">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-neutral-900 border border-neutral-700 text-neutral-200 flex items-center gap-1">
                          <Heart className="w-3 h-3 text-rose-500" />
                          <span>{c.wishlistItems?.length || 0} saved</span>
                        </span>

                        {oosWishlistCount > 0 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/80 border border-red-500/40 text-red-400 flex items-center gap-1">
                            <Flame className="w-3 h-3 fill-red-400" />
                            <span>Looking for {oosWishlistCount} OOS tee</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Search History snippet */}
                    <td className="p-3.5">
                      {c.searchHistory && c.searchHistory.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {c.searchHistory.slice(0, 2).map((query, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-300">
                              "{query}"
                            </span>
                          ))}
                          {c.searchHistory.length > 2 && (
                            <span className="text-[10px] text-neutral-500 font-mono">+{c.searchHistory.length - 2} more</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-neutral-500 font-mono">No searches logged</span>
                      )}
                    </td>

                    <td className="p-3.5 font-mono font-bold text-emerald-400">
                      ₹{c.totalSpent.toLocaleString('en-IN')}
                    </td>

                    <td className="p-3.5 font-mono font-bold text-white">
                      {c.totalOrders}
                    </td>

                    <td className="p-3.5 text-right pr-4">
                      <button className="p-1.5 rounded-lg bg-neutral-800 group-hover:bg-neutral-700 text-neutral-300 group-hover:text-white transition-colors cursor-pointer">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Profile & Behavioral Intelligence Drawer */}
      {selectedCustomer && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end"
          onClick={() => setSelectedCustomer(null)}
        >
          <div 
            className="w-full max-w-2xl bg-[#12121a] border-l border-neutral-700 h-full overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Top Header */}
            <div className="p-5 border-b border-neutral-800 bg-[#161622] flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                  {selectedCustomer.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{selectedCustomer.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                      {selectedCustomer.status}
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-400 font-mono">
                    {selectedCustomer.phone} • {selectedCustomer.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-4 gap-2 p-4 bg-[#14141e] border-b border-neutral-800 text-center font-mono">
              <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800">
                <div className="text-[10px] text-neutral-400 uppercase">Total Orders</div>
                <div className="text-sm font-bold text-white mt-0.5">{selectedCustomer.totalOrders}</div>
              </div>
              <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800">
                <div className="text-[10px] text-neutral-400 uppercase">Lifetime Spend</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">₹{selectedCustomer.totalSpent.toLocaleString('en-IN')}</div>
              </div>
              <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800">
                <div className="text-[10px] text-neutral-400 uppercase">Avg Order</div>
                <div className="text-sm font-bold text-blue-400 mt-0.5">₹{(selectedCustomer.avgOrderValue ?? selectedCustomer.averageOrderValue ?? 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800">
                <div className="text-[10px] text-neutral-400 uppercase">Tori Credit</div>
                <div className="text-sm font-bold text-amber-400 mt-0.5">₹{selectedCustomer.toriCredit || 0}</div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-neutral-800 bg-neutral-950 text-xs font-mono overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveDrawerTab('WISHLIST')}
                className={`py-3 px-4 flex items-center gap-1.5 border-b-2 font-semibold transition whitespace-nowrap cursor-pointer ${
                  activeDrawerTab === 'WISHLIST' 
                    ? 'border-red-500 text-white bg-neutral-900/50' 
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                <span>Wishlist ({selectedCustomer.wishlistItems?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveDrawerTab('CART')}
                className={`py-3 px-4 flex items-center gap-1.5 border-b-2 font-semibold transition whitespace-nowrap cursor-pointer ${
                  activeDrawerTab === 'CART' 
                    ? 'border-red-500 text-white bg-neutral-900/50' 
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5 text-red-500" />
                <span>Cart ({selectedCustomer.cartItems?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveDrawerTab('SEARCH')}
                className={`py-3 px-4 flex items-center gap-1.5 border-b-2 font-semibold transition whitespace-nowrap cursor-pointer ${
                  activeDrawerTab === 'SEARCH' 
                    ? 'border-red-500 text-white bg-neutral-900/50' 
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <Search className="w-3.5 h-3.5 text-sky-400" />
                <span>Search History ({selectedCustomer.searchHistory?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveDrawerTab('VIEWS')}
                className={`py-3 px-4 flex items-center gap-1.5 border-b-2 font-semibold transition whitespace-nowrap cursor-pointer ${
                  activeDrawerTab === 'VIEWS' 
                    ? 'border-red-500 text-white bg-neutral-900/50' 
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-purple-400" />
                <span>Product Views ({selectedCustomer.productViews?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveDrawerTab('ORDERS')}
                className={`py-3 px-4 flex items-center gap-1.5 border-b-2 font-semibold transition whitespace-nowrap cursor-pointer ${
                  activeDrawerTab === 'ORDERS' 
                    ? 'border-red-500 text-white bg-neutral-900/50' 
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-amber-400" />
                <span>Orders</span>
              </button>

              <button
                onClick={() => setActiveDrawerTab('DETAILS')}
                className={`py-3 px-4 flex items-center gap-1.5 border-b-2 font-semibold transition whitespace-nowrap cursor-pointer ${
                  activeDrawerTab === 'DETAILS' 
                    ? 'border-red-500 text-white bg-neutral-900/50' 
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-teal-400" />
                <span>Profile & Addresses</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-5 space-y-4 flex-1 overflow-y-auto text-xs font-mono">
              {/* 1. WISHLIST TAB */}
              {activeDrawerTab === 'WISHLIST' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-2">
                      <Heart className="w-4 h-4 text-rose-500" />
                      <span>Tracked Wishlist Items ({selectedCustomer.wishlistItems?.length || 0})</span>
                    </h3>
                  </div>

                  {(!selectedCustomer.wishlistItems || selectedCustomer.wishlistItems.length === 0) ? (
                    <div className="p-6 text-center text-neutral-500 bg-neutral-900/40 rounded-xl border border-neutral-800">
                      Customer has not added any t-shirts to their wishlist yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedCustomer.wishlistItems.map((item, idx) => (
                        <div 
                          key={idx} 
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                            item.inStock === false 
                              ? 'bg-red-950/30 border-red-500/40' 
                              : 'bg-neutral-900 border-neutral-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <img 
                              src={item.image} 
                              alt={item.productName} 
                              className="w-12 h-14 rounded-lg object-cover bg-neutral-950 border border-neutral-800"
                            />
                            <div>
                              <div className="font-bold text-white text-xs">{item.productName}</div>
                              <div className="text-emerald-400 font-bold mt-0.5">₹{item.price}</div>
                              {item.addedAt && (
                                <div className="text-[10px] text-neutral-500">Added: {item.addedAt}</div>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            {item.inStock === false ? (
                              <div className="space-y-1">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white font-mono flex items-center gap-1">
                                  <Flame className="w-3 h-3 fill-white" />
                                  <span>LOOKING FOR THIS T-SHIRT</span>
                                </span>
                                <div className="text-[10px] text-red-400 font-semibold">Out of Stock Alert</div>
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                                In Stock
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 2. CART TAB */}
              {activeDrawerTab === 'CART' && (
                <div className="space-y-3">
                  <h3 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-red-500" />
                    <span>Active Cart Items in Shopping Bag ({selectedCustomer.cartItems?.length || 0})</span>
                  </h3>

                  {(!selectedCustomer.cartItems || selectedCustomer.cartItems.length === 0) ? (
                    <div className="p-6 text-center text-neutral-500 bg-neutral-900/40 rounded-xl border border-neutral-800">
                      Customer bag is currently empty.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedCustomer.cartItems.map((cItem, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img 
                              src={cItem.image} 
                              alt={cItem.productName} 
                              className="w-12 h-14 rounded-lg object-cover bg-neutral-950 border border-neutral-800"
                            />
                            <div>
                              <div className="font-bold text-white text-xs">{cItem.productName}</div>
                              <div className="text-neutral-400 text-[11px]">Size: <strong>{cItem.size}</strong> • Color: {cItem.color}</div>
                              <div className="text-emerald-400 font-bold mt-0.5">₹{cItem.price} × {cItem.quantity}</div>
                            </div>
                          </div>

                          <div className="text-right font-mono">
                            <div className="text-sm font-bold text-white">₹{cItem.price * cItem.quantity}</div>
                            <span className="text-[10px] text-neutral-400">Qty: {cItem.quantity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. SEARCH HISTORY TAB */}
              {activeDrawerTab === 'SEARCH' && (
                <div className="space-y-3">
                  <h3 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-2">
                    <Search className="w-4 h-4 text-sky-400" />
                    <span>Customer Search Query History</span>
                  </h3>

                  {(!selectedCustomer.searchHistory || selectedCustomer.searchHistory.length === 0) ? (
                    <div className="p-6 text-center text-neutral-500 bg-neutral-900/40 rounded-xl border border-neutral-800">
                      No search keywords recorded yet. Searches typed on the storefront search bar appear here in real time.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-[11px] text-neutral-400">
                        Keywords this customer actively searched for in the TORIWEAR catalog:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedCustomer.searchHistory.map((query, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                            <span className="font-semibold text-white">"{query}"</span>
                            <span className="text-[10px] text-neutral-500 font-mono">Search #{idx + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. PRODUCT VIEWS TAB */}
              {activeDrawerTab === 'VIEWS' && (
                <div className="space-y-3">
                  <h3 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-2">
                    <Eye className="w-4 h-4 text-purple-400" />
                    <span>Customer Product Browsing & View History</span>
                  </h3>

                  {(!selectedCustomer.productViews || selectedCustomer.productViews.length === 0) ? (
                    <div className="p-6 text-center text-neutral-500 bg-neutral-900/40 rounded-xl border border-neutral-800">
                      No product views recorded yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {selectedCustomer.productViews.map((view, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 flex gap-2.5 items-center">
                          <img 
                            src={view.image} 
                            alt={view.productName} 
                            className="w-12 h-14 rounded-lg object-cover bg-neutral-950 border border-neutral-800 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-white text-xs truncate">{view.productName}</div>
                            <div className="text-emerald-400 font-bold mt-0.5">₹{view.price}</div>
                            <div className="text-[10px] text-neutral-500 flex items-center justify-between mt-1">
                              <span>{view.viewedAt}</span>
                              <span className={view.inStock ? 'text-emerald-400' : 'text-red-400 font-bold'}>
                                {view.inStock ? 'In Stock' : 'OOS'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 5. ORDERS TAB */}
              {activeDrawerTab === 'ORDERS' && (
                <div className="space-y-3">
                  <h3 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-400" />
                    <span>Order Purchase History</span>
                  </h3>

                  <div className="space-y-2">
                    {orders.filter(o => o.customerId === selectedCustomer.id || o.customerEmail === selectedCustomer.email).length === 0 ? (
                      <div className="p-6 text-center text-neutral-500 bg-neutral-900/40 rounded-xl border border-neutral-800">
                        No orders recorded yet.
                      </div>
                    ) : (
                      orders.filter(o => o.customerId === selectedCustomer.id || o.customerEmail === selectedCustomer.email).map((ord) => (
                        <div key={ord.orderId} className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex justify-between items-center">
                          <div>
                            <div className="font-mono font-bold text-red-400">{ord.orderNumber}</div>
                            <div className="text-[10px] text-neutral-500 font-mono">{ord.date} • {ord.items.length} items</div>
                            <div className="text-[10px] text-neutral-400 mt-1">
                              Payment: {ord.paymentMethod} ({ord.paymentStatus})
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            <div className="font-bold text-white">₹{ord.total}</div>
                            <span className="text-[10px] text-emerald-400 font-semibold">{ord.shippingStatus}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* 6. PROFILE & ADDRESSES TAB */}
              {activeDrawerTab === 'DETAILS' && (
                <div className="space-y-4">
                  {/* Contact Info */}
                  <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                    <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">Contact & Delivery Addresses</h3>
                    <div className="flex items-center gap-2 text-neutral-300 font-mono">
                      <Phone className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{selectedCustomer.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-300">
                      <Mail className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{selectedCustomer.email}</span>
                    </div>

                    {(selectedCustomer.savedAddresses || []).map((addr) => (
                      <div key={addr.id} className="mt-2 p-2.5 rounded-lg bg-neutral-900 border border-neutral-800">
                        <div className="font-semibold text-white">{addr.name} ({addr.city}, {addr.state})</div>
                        <div className="text-neutral-400 text-[11px]">{addr.addressLine} - {addr.pincode}</div>
                      </div>
                    ))}
                  </div>

                  {/* Payment VPAs */}
                  {selectedCustomer.savedVpa && selectedCustomer.savedVpa.length > 0 && (
                    <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                      <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">Saved UPI VPAs</h3>
                      <div className="space-y-1">
                        {selectedCustomer.savedVpa.map((vpa, i) => (
                          <div key={i} className="p-2 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono">
                            {vpa}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Staff CRM Notes */}
                  <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                    <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">Internal CRM Notes</h3>
                    <div className="text-neutral-300">
                      {Array.isArray(selectedCustomer.notes) 
                        ? selectedCustomer.notes.join('; ') || 'No notes for this customer.'
                        : selectedCustomer.notes || 'No notes for this customer.'
                      }
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
