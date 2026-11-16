import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminDataContext';
import { Search, X, Package, ShoppingBag, User, Ticket, Sparkles, ArrowRight } from 'lucide-react';

export const GlobalSearchModal: React.FC = () => {
  const { 
    globalSearchOpen, 
    setGlobalSearchOpen, 
    products, 
    orders, 
    customers, 
    coupons,
    setCurrentView
  } = useAdmin();

  const [query, setQuery] = useState('');

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(!globalSearchOpen);
      } else if (e.key === 'Escape' && globalSearchOpen) {
        setGlobalSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [globalSearchOpen, setGlobalSearchOpen]);

  if (!globalSearchOpen) return null;

  const cleanQ = query.trim().toLowerCase();

  // Search matches
  const matchedOrders = cleanQ ? orders.filter(o => 
    o.orderNumber.toLowerCase().includes(cleanQ) ||
    o.customerName.toLowerCase().includes(cleanQ) ||
    o.customerEmail.toLowerCase().includes(cleanQ) ||
    (o.trackingNumber && o.trackingNumber.toLowerCase().includes(cleanQ))
  ) : [];

  const matchedProducts = cleanQ ? products.filter(p => 
    p.name.toLowerCase().includes(cleanQ) ||
    p.sku.toLowerCase().includes(cleanQ) ||
    p.catalogNumber.includes(cleanQ) ||
    p.franchise.toLowerCase().includes(cleanQ) ||
    p.variants.some(v => v.sku.toLowerCase().includes(cleanQ))
  ).slice(0, 5) : [];

  const matchedCustomers = cleanQ ? customers.filter(c => 
    c.name.toLowerCase().includes(cleanQ) ||
    c.email.toLowerCase().includes(cleanQ) ||
    c.phone.includes(cleanQ)
  ).slice(0, 4) : [];

  const matchedCoupons = cleanQ ? coupons.filter(cp => 
    cp.code.toLowerCase().includes(cleanQ)
  ) : [];

  const totalResults = matchedOrders.length + matchedProducts.length + matchedCustomers.length + matchedCoupons.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-[#14141c] border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-neutral-800 gap-3 bg-[#181822]">
          <Search className="w-5 h-5 text-red-500 flex-shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search by SKU, Order ID (e.g. TORI-10482), customer email, product name, coupon..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-neutral-500 text-sm focus:outline-none"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="text-neutral-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="overflow-y-auto p-4 space-y-4">
          {!query ? (
            <div className="py-8 text-center text-neutral-500 text-xs">
              <Sparkles className="w-6 h-6 mx-auto mb-2 text-neutral-600" />
              <p>Type to search across Products, Inventory SKUs, Orders, Customers, and Coupons.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button onClick={() => setQuery('TORI-10482')} className="px-2.5 py-1 bg-neutral-800/80 hover:bg-neutral-800 rounded font-mono text-neutral-300 text-[11px] cursor-pointer">
                  TORI-10482
                </button>
                <button onClick={() => setQuery('Shadow Monarch')} className="px-2.5 py-1 bg-neutral-800/80 hover:bg-neutral-800 rounded text-neutral-300 text-[11px] cursor-pointer">
                  Shadow Monarch
                </button>
                <button onClick={() => setQuery('DROP2026')} className="px-2.5 py-1 bg-neutral-800/80 hover:bg-neutral-800 rounded font-mono text-neutral-300 text-[11px] cursor-pointer">
                  DROP2026
                </button>
                <button onClick={() => setQuery('aditya')} className="px-2.5 py-1 bg-neutral-800/80 hover:bg-neutral-800 rounded text-neutral-300 text-[11px] cursor-pointer">
                  aditya.deshmukh
                </button>
              </div>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-8 text-center text-neutral-400 text-sm">
              No matching records found for "<span className="text-white">{query}</span>"
            </div>
          ) : (
            <>
              {/* Orders */}
              {matchedOrders.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
                    <span>Orders ({matchedOrders.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchedOrders.map((ord) => (
                      <div
                        key={ord.orderId}
                        onClick={() => {
                          setGlobalSearchOpen(false);
                          setCurrentView('ORDERS');
                        }}
                        className="p-2.5 rounded-lg bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-800 flex items-center justify-between cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-red-400">
                            {ord.orderNumber}
                          </span>
                          <span className="text-xs text-white font-medium">
                            {ord.customerName}
                          </span>
                          <span className="text-[11px] text-neutral-400">
                            • ₹{ord.total.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">
                            {ord.shippingStatus}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Products */}
              {matchedProducts.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Products & SKUs ({matchedProducts.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchedProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setGlobalSearchOpen(false);
                          setCurrentView('PRODUCTS');
                        }}
                        className="p-2.5 rounded-lg bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-800 flex items-center justify-between cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <img src={p.images[0]} alt={p.name} className="w-8 h-8 rounded object-cover" />
                          <div>
                            <div className="text-xs text-white font-semibold flex items-center gap-2">
                              <span>{p.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">
                                {p.sku}
                              </span>
                            </div>
                            <div className="text-[11px] text-neutral-400">
                              {p.franchise} • ₹{p.price} • Stock: {p.variants.reduce((acc, v) => acc + v.stock, 0)} units
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customers */}
              {matchedCustomers.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>Customers ({matchedCustomers.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchedCustomers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setGlobalSearchOpen(false);
                          setCurrentView('CUSTOMERS');
                        }}
                        className="p-2.5 rounded-lg bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-800 flex items-center justify-between cursor-pointer transition-colors group"
                      >
                        <div>
                          <div className="text-xs text-white font-medium">{c.name}</div>
                          <div className="text-[11px] text-neutral-400 font-mono">{c.email} • {c.phone}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-neutral-300 font-bold">₹{c.totalSpent.toLocaleString('en-IN')}</span>
                          <div className="text-[10px] text-neutral-500">{c.totalOrders} orders</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coupons */}
              {matchedCoupons.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5 text-purple-400" />
                    <span>Coupons ({matchedCoupons.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchedCoupons.map((cp) => (
                      <div
                        key={cp.id}
                        onClick={() => {
                          setGlobalSearchOpen(false);
                          setCurrentView('MARKETING');
                        }}
                        className="p-2.5 rounded-lg bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-800 flex items-center justify-between cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                            {cp.code}
                          </span>
                          <span className="text-xs text-neutral-300">
                            {cp.discountType === 'PERCENTAGE' ? `${cp.value}% Off` : `₹${cp.value} Off`}
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-500 font-mono">
                          Used {cp.usageCount} times
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-neutral-950 border-t border-neutral-800 text-[11px] text-neutral-500 flex items-center justify-between">
          <span>Global Search indexed across 40 products, all orders, customers, and active campaigns</span>
          <span className="font-mono">Press ESC to close</span>
        </div>
      </div>
    </div>
  );
};
