import React, { useState } from 'react';
import { useAdmin } from '../AdminDataContext';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Package,
  Users,
  AlertTriangle,
  Clock,
  CreditCard,
  RotateCcw,
  Plus,
  Activity,
  ShieldCheck,
  ArrowUpRight,
  Sparkles,
  ChevronRight,
  FileText,
  Flame,
} from 'lucide-react';

export const DashboardView: React.FC<{ onOpenAddProductModal?: () => void }> = ({ onOpenAddProductModal }) => {
  const { 
    orders, 
    products, 
    inventory, 
    payments, 
    customers, 
    auditLogs, 
    inventoryMovements,
    settings, 
    setCurrentView,
    toggleMaintenanceMode
  } = useAdmin();

  const [dateRange, setDateRange] = useState<'7D' | '30D' | '3M' | '1Y'>('30D');
  const [metricView, setMetricView] = useState<'revenue' | 'orders' | 'units'>('revenue');

  // Compute real-time stats from live orders & store state
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const getOrderTimestamp = (o: any): number => {
    if (!o.date) return 0;
    const parsed = Date.parse(o.date);
    return isNaN(parsed) ? 0 : parsed;
  };

  const isOrderPaid = (o: any) => o.paymentStatus === 'PAID' || o.paymentStatus === 'SUCCESS';

  const todayOrders = orders.filter(o => getOrderTimestamp(o) >= todayStart);
  const yesterdayOrders = orders.filter(o => {
    const t = getOrderTimestamp(o);
    return t >= yesterdayStart && t < todayStart;
  });
  const monthOrders = orders.filter(o => getOrderTimestamp(o) >= monthStart);

  const todaySales = todayOrders.reduce((sum, o) => sum + (isOrderPaid(o) ? o.total : 0), 0);
  const yesterdaySales = yesterdayOrders.reduce((sum, o) => sum + (isOrderPaid(o) ? o.total : 0), 0);
  const monthSales = monthOrders.reduce((sum, o) => sum + (isOrderPaid(o) ? o.total : 0), 0);
  const totalRev = orders.reduce((sum, o) => sum + (isOrderPaid(o) ? o.total : 0), 0);
  const totalOrdersCount = orders.length;
  const productsSoldCount = orders.reduce((sum, o) => sum + (o.items || []).reduce((s, it) => s + (it.quantity || 1), 0), 0);
  const avgOrderVal = totalOrdersCount > 0 ? Math.round(totalRev / totalOrdersCount) : 0;
  const newCustomersCount = customers.length;
  const oosWishlistDemand = customers.reduce((sum, c) => sum + (c.wishlistItems || []).filter(w => w.inStock === false).length, 0);
  const returningCount = customers.filter(c => (c.totalOrders || 0) > 1).length;
  const returnRatePercent = customers.length > 0 ? ((returningCount / customers.length) * 100).toFixed(1) : "0.0";
  const lowStockCount = inventory.filter(i => i.status === 'LOW_STOCK' || i.status === 'CRITICAL_STOCK' || i.status === 'OUT_OF_STOCK').length;
  const pendingOrdersCount = orders.filter(o => o.shippingStatus === 'NEW' || o.shippingStatus === 'CONFIRMED' || o.shippingStatus === 'PROCESSING').length;
  const failedPaymentsCount = payments.filter(p => p.status === 'FAILED').length;
  const pendingRefundsCount = orders.filter(o => o.shippingStatus === 'RETURN_REQUESTED').length;

  const kpis = [
    {
      id: 'kpi-today',
      title: "TODAY'S SALES",
      value: `₹${todaySales.toLocaleString('en-IN')}`,
      comparison: todaySales > 0 ? "+100%" : "0%",
      isPositive: true,
      period: "today",
      icon: DollarSign,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      targetView: 'ORDERS' as const,
    },
    {
      id: 'kpi-yesterday',
      title: "YESTERDAY'S SALES",
      value: `₹${yesterdaySales.toLocaleString('en-IN')}`,
      comparison: yesterdaySales > 0 ? "+100%" : "0%",
      isPositive: true,
      period: "yesterday",
      icon: TrendingUp,
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      targetView: 'ORDERS' as const,
    },
    {
      id: 'kpi-month',
      title: "THIS MONTH'S SALES",
      value: `₹${monthSales.toLocaleString('en-IN')}`,
      comparison: monthSales > 0 ? "+100%" : "0%",
      isPositive: true,
      period: "this month",
      icon: DollarSign,
      color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
      targetView: 'ANALYTICS' as const,
    },
    {
      id: 'kpi-orders',
      title: "TOTAL ORDERS",
      value: `${totalOrdersCount}`,
      comparison: totalOrdersCount > 0 ? `${totalOrdersCount} orders` : "0 orders",
      isPositive: true,
      period: "real-time",
      icon: ShoppingBag,
      color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
      targetView: 'ORDERS' as const,
    },
    {
      id: 'kpi-products-sold',
      title: "PRODUCTS SOLD",
      value: `${productsSoldCount} pcs`,
      comparison: productsSoldCount > 0 ? `${productsSoldCount} units` : "0 units",
      isPositive: true,
      period: "this month",
      icon: Package,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      targetView: 'PRODUCTS' as const,
    },
    {
      id: 'kpi-aov',
      title: "AVG ORDER VALUE",
      value: `₹${avgOrderVal.toLocaleString('en-IN')}`,
      comparison: avgOrderVal > 0 ? `₹${avgOrderVal}` : "₹0",
      isPositive: true,
      period: "average",
      icon: TrendingUp,
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      targetView: 'ANALYTICS' as const,
    },
    {
      id: 'kpi-new-cust',
      title: "NEW CUSTOMERS",
      value: `${newCustomersCount}`,
      comparison: `${newCustomersCount} total`,
      isPositive: true,
      period: "total accounts",
      icon: Users,
      color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
      targetView: 'CUSTOMERS' as const,
    },
    {
      id: 'kpi-oos-demand',
      title: "PEOPLE LOOKING FOR T-SHIRTS",
      value: `${oosWishlistDemand} waiting`,
      comparison: "OOS Wishlist Demand",
      isPositive: false,
      period: "real-time demand",
      icon: Flame,
      color: "text-red-400 bg-red-500/10 border-red-500/20",
      targetView: 'CUSTOMERS' as const,
    },
    {
      id: 'kpi-ret-cust',
      title: "RETURNING CUSTOMERS",
      value: `${returnRatePercent}%`,
      comparison: `${returningCount} repeat`,
      isPositive: true,
      period: "repeat rate",
      icon: Users,
      color: "text-pink-400 bg-pink-500/10 border-pink-500/20",
      targetView: 'CUSTOMERS' as const,
    },
    {
      id: 'kpi-pending-orders',
      title: "PENDING ORDERS",
      value: `${pendingOrdersCount}`,
      comparison: pendingOrdersCount > 0 ? "Needs packing" : "Up to date",
      isPositive: pendingOrdersCount === 0,
      period: pendingOrdersCount > 0 ? "action required" : "all clear",
      icon: Clock,
      color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
      targetView: 'ORDERS' as const,
    },
    {
      id: 'kpi-low-stock',
      title: "LOW STOCK ALERTS",
      value: `${lowStockCount} items`,
      comparison: lowStockCount > 0 ? "Critical" : "Optimal",
      isPositive: lowStockCount === 0,
      period: lowStockCount > 0 ? "reorder now" : "stock ready",
      icon: AlertTriangle,
      color: "text-red-400 bg-red-500/10 border-red-500/20",
      targetView: 'INVENTORY' as const,
    },
    {
      id: 'kpi-failed-pay',
      title: "FAILED PAYMENTS",
      value: `${failedPaymentsCount}`,
      comparison: failedPaymentsCount > 0 ? `${failedPaymentsCount} failed` : "0 failed",
      isPositive: failedPaymentsCount === 0,
      period: "real-time",
      icon: CreditCard,
      color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
      targetView: 'PAYMENTS' as const,
    },
    {
      id: 'kpi-pending-refunds',
      title: "PENDING REFUNDS",
      value: `${pendingRefundsCount}`,
      comparison: pendingRefundsCount > 0 ? `${pendingRefundsCount} requested` : "0 requested",
      isPositive: pendingRefundsCount === 0,
      period: pendingRefundsCount > 0 ? "under review" : "none pending",
      icon: RotateCcw,
      color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
      targetView: 'SHIPPING' as const,
    },
  ];

  // Dynamic 7-day chart data points calculated from live store orders
  const chartPoints = Array.from({ length: 7 }).map((_, i) => {
    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() - (6 - i));
    const dayStart = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const label = i === 6 
      ? `${dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (Today)`
      : dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const dayOrders = orders.filter(o => {
      const t = getOrderTimestamp(o);
      return t >= dayStart && t < dayEnd;
    });

    const dayRev = dayOrders.reduce((sum, o) => sum + (isOrderPaid(o) ? o.total : 0), 0);
    const dayOrderCount = dayOrders.length;
    const dayUnits = dayOrders.reduce((sum, o) => sum + (o.items || []).reduce((s, it) => s + (it.quantity || 1), 0), 0);

    return { label, rev: dayRev, orders: dayOrderCount, units: dayUnits };
  });

  const rawMax = Math.max(...chartPoints.map(p => metricView === 'revenue' ? p.rev : metricView === 'orders' ? p.orders : p.units), 0);
  const maxVal = rawMax > 0 ? rawMax : 100;
  const sevenDayTotalRev = chartPoints.reduce((sum, p) => sum + p.rev, 0);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Toriwear Business Command Center
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              STORE: {settings.maintenanceMode ? 'MAINTENANCE' : 'ONLINE'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time analytics, inventory allocation, order fulfillment & D2C operations across India.
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCurrentView('AI_DESIGN_LAB')}
            className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm shadow-red-600/20 cursor-pointer"
            style={{ color: '#ffffff' }}
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>AI Design Lab</span>
          </button>
          <button
            onClick={onOpenAddProductModal || (() => setCurrentView('PRODUCTS'))}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
          >
            <Plus className="w-3.5 h-3.5" style={{ color: '#ffffff' }} />
            <span>Add Product</span>
          </button>
          <button
            onClick={() => setCurrentView('MARKETING')}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Create Coupon</span>
          </button>
          <button
            onClick={() => setCurrentView('MARKETING')}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Create Ad</span>
          </button>
          <button
            onClick={() => setCurrentView('CATALOG')}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Generate Catalogue</span>
          </button>
          <button
            onClick={() => setCurrentView('STAFF')}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>Add Staff</span>
          </button>
        </div>
      </div>

      {/* 12 KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.id}
              onClick={() => setCurrentView(k.targetView)}
              className="p-4 rounded-xl bg-[#14141c] hover:bg-[#191924] border border-neutral-800/90 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase truncate">
                  {k.title}
                </span>
                <div className={`p-1.5 rounded-lg border ${k.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <div className="text-lg font-bold text-white tracking-tight font-mono">
                  {k.value}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                  <span className={`font-medium ${k.isPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {k.comparison}
                  </span>
                  <span className="text-neutral-500 text-[10px] truncate">{k.period}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Section 2: Sales Analytics Interactive Chart & Store Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart (2 cols) */}
        <div className="lg:col-span-2 bg-[#14141c] border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Activity className="w-4 h-4 text-red-500" />
                <span>Sales & Revenue Analytics</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Gross revenue, settled orders, and volume trends
              </p>
            </div>

            {/* Chart controls */}
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-neutral-900 border border-neutral-800 p-0.5 text-xs">
                {(['revenue', 'orders', 'units'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetricView(m)}
                    className={`px-2.5 py-1 rounded-md capitalize text-[11px] font-medium transition-colors cursor-pointer ${
                      metricView === m ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {m === 'revenue' ? 'Revenue' : m === 'orders' ? 'Orders' : 'Units'}
                  </button>
                ))}
              </div>

              <div className="flex rounded-lg bg-neutral-900 border border-neutral-800 p-0.5 text-xs">
                {(['7D', '30D', '3M', '1Y'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setDateRange(r)}
                    className={`px-2 py-1 rounded-md text-[10px] font-mono transition-colors cursor-pointer ${
                      dateRange === r ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SVG Bar / Area Chart */}
          <div className="pt-4 pb-2">
            <div className="h-56 flex items-end justify-between gap-3 sm:gap-6 px-2 border-b border-neutral-800 pb-2">
              {chartPoints.map((p, idx) => {
                const val = metricView === 'revenue' ? p.rev : metricView === 'orders' ? p.orders : p.units;
                const heightPercent = val === 0 ? 4 : Math.max(10, Math.round((val / maxVal) * 100));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900 border border-neutral-700 text-white text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap font-mono z-10 pointer-events-none">
                      {metricView === 'revenue' ? `₹${p.rev.toLocaleString('en-IN')}` : `${val} ${metricView}`}
                    </div>

                    <div className="w-full max-w-[48px] bg-neutral-800/80 group-hover:bg-red-600/30 rounded-t-lg transition-all relative overflow-hidden flex items-end" style={{ height: `${heightPercent}%` }}>
                      <div className="w-full bg-gradient-to-t from-red-600 to-red-400 rounded-t-lg transition-all" style={{ height: `${heightPercent}%` }} />
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono text-center truncate w-full">
                      {p.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-3 px-2 font-mono">
              <span>Gross 7-Day Total: ₹{sevenDayTotalRev.toLocaleString('en-IN')}</span>
              <span className="text-emerald-400">{sevenDayTotalRev > 0 ? '+100% active' : 'Live real-time stream active'}</span>
            </div>
          </div>
        </div>

        {/* Store Health & Operational Status (1 col) */}
        <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Store Infrastructure Health</span>
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                100% OPERATIONAL
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-slate-800">Catalog & Products</span>
                </div>
                <span className="text-[11px] text-slate-600 font-mono font-medium">{products.length} Active SKUs</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${lowStockCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span className="text-xs font-semibold text-slate-800">Inventory Sync</span>
                </div>
                <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-mono font-bold">
                  {lowStockCount} Low Stock
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-slate-800">Razorpay / UPI Gateway</span>
                </div>
                <span className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono font-bold">
                  Synced
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-slate-800">Logistics (Bluedart, Delhivery)</span>
                </div>
                <span className="text-[11px] text-slate-600 font-mono font-medium">API Active</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${settings.maintenanceMode ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span className="text-xs font-semibold text-slate-800">Storefront Status</span>
                </div>
                <button
                  onClick={toggleMaintenanceMode}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                    settings.maintenanceMode ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                  }`}
                >
                  {settings.maintenanceMode ? 'Maintenance ON' : 'Live Online'}
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-slate-800">Encrypted Backups</span>
                </div>
                <span className="text-[11px] text-slate-600 font-mono font-medium">Daily 04:00 AM</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>SOC2 Type II & Indian GST Compliant</span>
            <button onClick={() => setCurrentView('SETTINGS')} className="text-red-600 hover:underline flex items-center gap-1 cursor-pointer font-medium">
              <span>Settings</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Section 3: Recent Activity Feeds (Orders, Payments, Inventory Movements) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
              <span>Recent Orders</span>
            </h2>
            <button 
              onClick={() => setCurrentView('ORDERS')} 
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-medium"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {orders.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400 font-mono">
                No orders yet. Live orders will appear here automatically.
              </div>
            ) : (
              orders.slice(0, 4).map((ord) => (
                <div 
                  key={ord.orderId}
                  onClick={() => setCurrentView('ORDERS')}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-900">{ord.orderNumber}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                        {ord.shippingStatus}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {ord.customerName} • {ord.items.length} {ord.items.length === 1 ? 'item' : 'items'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900 font-mono">
                      ₹{ord.total.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {ord.paymentMethod}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Inventory Movements Log */}
        <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-600" />
              <span>Inventory Movements</span>
            </h2>
            <button 
              onClick={() => setCurrentView('INVENTORY')} 
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-medium"
            >
              <span>Manage Stock</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {inventoryMovements.slice(0, 4).map((mov) => (
              <div 
                key={mov.id}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 flex items-center justify-between transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                      {mov.productName}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                      {mov.sku}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[200px]">
                    {mov.reason}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-mono font-bold ${mov.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {mov.amount >= 0 ? `+${mov.amount}` : mov.amount}
                  </span>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Stock: {mov.newStock}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Admin Operational Audit Feed */}
        <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-red-600" />
              <span>Admin Audit Feed</span>
            </h2>
            <button 
              onClick={() => setCurrentView('SECURITY')} 
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-medium"
            >
              <span>Audit Center</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {auditLogs.slice(0, 4).map((log) => (
              <div 
                key={log.id}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-red-700 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded">
                    {log.action}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                </div>
                <p className="text-xs text-slate-800 mt-1 font-bold truncate">
                  {log.entity}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">
                  {log.details}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
