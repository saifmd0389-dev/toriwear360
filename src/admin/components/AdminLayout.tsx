import React, { useState, useEffect } from 'react';
import { useAdmin, AdminView } from '../AdminDataContext';
import { OfficialToriwearLogo } from '../../components/OfficialToriwearLogo';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingBag,
  CreditCard,
  Users,
  Megaphone,
  Layout,
  FileText,
  Truck,
  BarChart3,
  UserCheck,
  ShieldAlert,
  Settings,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Sparkles,
  Landmark,
  Crown,
  ClipboardCheck,
  MessageSquare,
  ShieldCheck,
  KeyRound,
  Trash2,
  FileSpreadsheet,
  BellRing,
  FolderTree,
} from 'lucide-react';

import { useFinance } from '../context/FinanceContext';
import { DashboardView } from './DashboardView';
import { FinanceView } from './FinanceView';
import { UserManagementView } from './UserManagementView';
import { SuperAdminControlCenterView } from './SuperAdminControlCenterView';
import { StaffApprovalsView } from './StaffApprovalsView';
import { InternalCommunicationView } from './InternalCommunicationView';
import { ProductsView } from './ProductsView';
import { CategoryManagementView } from './CategoryManagementView';
import { InventoryView } from './InventoryView';
import { BackInStockView } from './BackInStockView';
import { OrdersView } from './OrdersView';
import { PaymentsView } from './PaymentsView';
import { CustomersView } from './CustomersView';
import { MarketingView } from './MarketingView';
import { EarlyAccessView } from './EarlyAccessView';
import { WebsiteCMSView } from './WebsiteCMSView';
import { CatalogView } from './CatalogView';
import { ShippingReturnsView } from './ShippingReturnsView';
import { AnalyticsReportsView } from './AnalyticsReportsView';
import { ReportsCenterView } from './ReportsCenterView';
import { StaffPermissionsView } from './StaffPermissionsView';
import { AuditSecurityView } from './AuditSecurityView';
import { SettingsView } from './SettingsView';
import { AIDesignLabView } from './AIDesignLabView';
import { GlobalSearchModal } from './GlobalSearchModal';
import { AdminAccountSecurityModal } from './AdminAccountSecurityModal';
import { AdminAccessGateway } from './AdminAccessGateway';
import { ADMIN_CONFIG } from '../../config/adminRoutes';

interface AdminLayoutProps {
  onExitAdmin?: () => void;
  deleteNotification?: (id: string, e?: React.MouseEvent) => void;
  onDeleteNotification?: (id: string, e?: React.MouseEvent) => void;
  clearAllNotifications?: (e?: React.MouseEvent) => void;
  onClearAllNotifications?: (e?: React.MouseEvent) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ 
  onExitAdmin,
  deleteNotification: propDeleteNotification,
  onDeleteNotification,
  clearAllNotifications: propClearAllNotifications,
  onClearAllNotifications
}) => {
  const { 
    currentView, 
    setCurrentView, 
    currentUser, 
    logout, 
    hasPermission, 
    toastMessage,
    notifications,
    markNotificationAsRead,
    deleteNotification,
    clearAllNotifications,
    orders,
    inventory,
    returnRequests,
    globalSearchOpen,
    setGlobalSearchOpen
  } = useAdmin();

  const { pendingApprovalsCount } = useFinance();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityModalTab, setSecurityModalTab] = useState<'PROFILE' | 'PASSWORD' | '2FA' | 'SESSIONS' | 'HISTORY'>('PROFILE');
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);

  const handleDeleteNotification = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (propDeleteNotification) {
      propDeleteNotification(id, e);
    } else if (onDeleteNotification) {
      onDeleteNotification(id, e);
    } else {
      deleteNotification(id);
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (propClearAllNotifications) {
      propClearAllNotifications(e);
    } else if (onClearAllNotifications) {
      onClearAllNotifications(e);
    } else {
      clearAllNotifications();
    }
  };

  // Keyboard shortcut Cmd+K or Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(!globalSearchOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [globalSearchOpen, setGlobalSearchOpen]);

  // Counts for sidebar badges
  const pendingOrdersCount = orders.filter(o => o.shippingStatus === 'PROCESSING' || o.shippingStatus === 'CONFIRMED').length;
  const lowStockCount = inventory.filter(i => i.status === 'LOW_STOCK' || i.status === 'OUT_OF_STOCK').length;
  const activeReturnsCount = returnRequests.filter(r => r.status === 'REQUESTED' || r.status === 'APPROVED').length;
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  const isSuperAdminUser = currentUser?.role === 'SUPER_ADMIN' || currentUser?.id === 'usr-saif' || currentUser?.email === 'admin@toriwear.com';

  const navItems: { id: AdminView; label: string; icon: any; permission?: string; badge?: number; superAdminOnly?: boolean }[] = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'FINANCE', label: 'Finance & Accounts', icon: Landmark, badge: pendingApprovalsCount },
    { id: 'USER_MANAGEMENT', label: 'User Management', icon: Users },
    { id: 'APPROVALS', label: 'Approvals Workflow', icon: ClipboardCheck, badge: pendingApprovalsCount },
    { id: 'COMMUNICATION', label: 'Internal Teams Chat', icon: MessageSquare },
    { id: 'SUPER_ADMIN', label: 'Super Admin Control', icon: Crown, permission: 'superadmin.view' },
    { id: 'ACCOUNT_SECURITY', label: 'My Account & Security', icon: ShieldCheck },
    { id: 'AI_DESIGN_LAB', label: 'AI Design Lab', icon: Sparkles, permission: 'ai.view' },
    { id: 'PRODUCTS', label: 'Products Vault', icon: Package, permission: 'products.view' },
    { id: 'CATEGORIES', label: 'Categories', icon: FolderTree, permission: 'products.view' },
    { id: 'INVENTORY', label: 'Inventory & Stock', icon: Boxes, permission: 'inventory.view', badge: lowStockCount },
    { id: 'BACK_IN_STOCK', label: 'Back-in-Stock Alerts', icon: BellRing, permission: 'inventory.view' },
    { id: 'ORDERS', label: 'Orders Fulfillment', icon: ShoppingBag, permission: 'orders.view', badge: pendingOrdersCount },
    { id: 'PAYMENTS', label: 'Payments & UPI', icon: CreditCard, permission: 'payments.view' },
    { id: 'CUSTOMERS', label: 'Customer CRM', icon: Users, permission: 'customers.view' },
    { id: 'MARKETING', label: 'Promotions & Ads', icon: Megaphone, permission: 'marketing.create' },
    { id: 'EARLY_ACCESS', label: 'Early Access & Drops', icon: BellRing, permission: 'marketing.create' },
    { id: 'WEBSITE', label: 'Storefront CMS', icon: Layout, permission: 'website.edit' },
    { id: 'CATALOG', label: 'Digital Line Sheet', icon: FileText, permission: 'products.view' },
    { id: 'SHIPPING', label: 'Logistics & Returns', icon: Truck, permission: 'orders.edit', badge: activeReturnsCount },
    { id: 'ANALYTICS', label: 'Analytics & GST', icon: BarChart3, permission: 'reports.view' },
    { id: 'REPORTS', label: 'Reports Center (All Modules)', icon: FileSpreadsheet },
    { id: 'STAFF', label: 'Staff & Roles', icon: UserCheck, permission: 'staff.manage' },
    { id: 'SECURITY', label: 'Audit Trail', icon: ShieldAlert, permission: 'security.manage' },
    { id: 'SETTINGS', label: 'Store Settings', icon: Settings, permission: 'settings.manage' },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.superAdminOnly && !isSuperAdminUser) return false;
    if (!item.permission) return true;
    return isSuperAdminUser || hasPermission(item.permission);
  });

  return (
    <div className="admin-root min-h-screen bg-slate-50 text-slate-900 flex font-sans antialiased selection:bg-red-600 selection:text-white">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-white border border-slate-200 text-slate-900 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-from-bottom-4 duration-200">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Global Search Modal */}
      <GlobalSearchModal />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <OfficialToriwearLogo className="h-9 w-auto max-w-[150px] object-contain" />
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-bold border border-red-200 uppercase">
                ADMIN CONSOLE
              </span>
              <span className="text-[9px] text-slate-400 font-mono">v2.4.0</span>
            </div>
          </div>

          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-0.5 flex-1 overflow-y-auto custom-scrollbar">
          <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
            Core Modules
          </div>
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-red-600 text-white font-semibold shadow-md shadow-red-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge && item.badge > 0 ? (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-white text-red-600' : 'bg-red-50 text-red-600 border border-red-200'
                  }`}>
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Footer: User profile & Live Storefront Switcher */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 space-y-2">
          {onExitAdmin && (
            <button
              onClick={onExitAdmin}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer border border-slate-200 shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>View Customer Storefront</span>
            </button>
          )}

          <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 shadow-sm">
            <button
              onClick={() => {
                setSecurityModalTab('PROFILE');
                setIsSecurityModalOpen(true);
              }}
              className="flex items-center gap-2 min-w-0 text-left hover:opacity-80 cursor-pointer"
              title="Open My Account & Security"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-amber-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {currentUser?.name.slice(0, 2).toUpperCase() || 'AD'}
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-slate-900 truncate">{currentUser?.name}</div>
                <div className="text-[10px] text-red-600 font-mono truncate">{currentUser?.role}</div>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  setSecurityModalTab('PASSWORD');
                  setIsSecurityModalOpen(true);
                }}
                title="Change Password & 2FA"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={logout}
                title="Logout session"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 bg-slate-50">
        {/* TOP NAVBAR */}
        <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global Search Bar trigger */}
            <button
              onClick={() => setGlobalSearchOpen(true)}
              className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 transition-all text-xs cursor-pointer w-48 sm:w-72"
            >
              <Search className="w-3.5 h-3.5 text-neutral-500" />
              <span className="truncate">Search orders, SKUs, customers...</span>
              <kbd className="hidden sm:inline-block ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications Center */}
            <div className="relative">
              <button
                onClick={() => setNotificationMenuOpen(prev => !prev)}
                className="relative p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                )}
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>

              {notificationMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <span className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                      Live Operational Alerts ({unreadNotificationsCount})
                    </span>
                    <div className="flex items-center gap-2">
                      {notifications.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="text-[11px] font-mono text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Clear all alerts"
                          aria-label="Clear all alerts"
                        >
                          <Trash2 className="w-3 h-3 pointer-events-none" />
                          <span>Clear All</span>
                        </button>
                      )}
                      <button 
                        onClick={() => setNotificationMenuOpen(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto mt-2 space-y-2">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No active operational alerts.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div 
                          key={n.id} 
                          onClick={() => markNotificationAsRead(n.id)}
                          className={`p-3 rounded-xl cursor-pointer transition-colors relative group ${
                            n.read 
                              ? 'bg-slate-50/80 hover:bg-slate-100 border border-slate-200/60' 
                              : 'bg-red-50/40 hover:bg-red-50/70 border border-red-200/80 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs gap-2">
                            <span className={`font-semibold truncate ${n.read ? 'text-slate-700' : 'text-slate-900 font-bold'}`}>
                              {n.title}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-slate-400 font-mono">{n.timestamp}</span>
                              <button
                                type="button"
                                data-id={n.id}
                                data-testid={`delete-notification-${n.id}`}
                                aria-label={`Dismiss alert ${n.title}`}
                                onClick={(e) => handleDeleteNotification(e, n.id)}
                                title="Dismiss alert"
                                className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer relative z-10"
                              >
                                <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed pr-6">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Private Admin Gateway URL Inspector */}
            <button
              type="button"
              onClick={() => setIsGatewayModalOpen(true)}
              title={`View private admin URL (${ADMIN_CONFIG.ADMIN_PATH})`}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-mono font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{ADMIN_CONFIG.ADMIN_PATH}</span>
            </button>

            {/* Quick Master Reports Action */}
            <button
              onClick={() => setCurrentView('REPORTS')}
              title="Generate report for core modules (Dashboard to Audit Trail)"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
              <span>Generate Report</span>
            </button>

            {/* Storefront Link on Desktop */}
            {onExitAdmin && (
              <button
                onClick={onExitAdmin}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>Storefront</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* VIEW CONTAINER */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentView === 'DASHBOARD' && <DashboardView />}
          {currentView === 'FINANCE' && <FinanceView />}
          {currentView === 'USER_MANAGEMENT' && <UserManagementView />}
          {currentView === 'SUPER_ADMIN' && <SuperAdminControlCenterView />}
          {currentView === 'ACCOUNT_SECURITY' && (
            <AdminAccountSecurityModal
              isOpen={true}
              asCardView={true}
              onClose={() => setCurrentView('DASHBOARD')}
              onLogout={logout}
              initialTab={securityModalTab}
            />
          )}
          {currentView === 'APPROVALS' && <StaffApprovalsView />}
          {currentView === 'COMMUNICATION' && <InternalCommunicationView />}
          {currentView === 'AI_DESIGN_LAB' && <AIDesignLabView />}
          {currentView === 'PRODUCTS' && <ProductsView />}
          {currentView === 'CATEGORIES' && <CategoryManagementView />}
          {currentView === 'INVENTORY' && <InventoryView />}
          {currentView === 'BACK_IN_STOCK' && <BackInStockView />}
          {currentView === 'ORDERS' && <OrdersView />}
          {currentView === 'PAYMENTS' && <PaymentsView />}
          {currentView === 'CUSTOMERS' && <CustomersView />}
          {currentView === 'MARKETING' && <MarketingView />}
          {currentView === 'EARLY_ACCESS' && <EarlyAccessView />}
          {currentView === 'WEBSITE' && <WebsiteCMSView />}
          {currentView === 'CATALOG' && <CatalogView />}
          {currentView === 'SHIPPING' && <ShippingReturnsView />}
          {currentView === 'ANALYTICS' && <AnalyticsReportsView />}
          {currentView === 'REPORTS' && <ReportsCenterView />}
          {currentView === 'STAFF' && <StaffPermissionsView />}
          {currentView === 'SECURITY' && <AuditSecurityView />}
          {currentView === 'SETTINGS' && <SettingsView />}
        </main>
      </div>

      {/* Account Security Modal Popup */}
      {isSecurityModalOpen && (
        <AdminAccountSecurityModal
          isOpen={isSecurityModalOpen}
          onClose={() => setIsSecurityModalOpen(false)}
          onLogout={logout}
          initialTab={securityModalTab}
        />
      )}

      {/* Private Admin Access Gateway URL Modal */}
      <AdminAccessGateway
        mode="modal"
        isOpen={isGatewayModalOpen}
        onClose={() => setIsGatewayModalOpen(false)}
        onReturnToStorefront={onExitAdmin}
      />
    </div>
  );
};
