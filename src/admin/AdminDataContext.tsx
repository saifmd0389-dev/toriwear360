import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  AdminUser,
  Role,
  AdminProduct,
  InventoryItem,
  InventoryMovement,
  AdminOrder,
  PaymentTransaction,
  CustomerProfile,
  Coupon,
  Advertisement,
  FlashSaleCampaign,
  WebsiteSection,
  HeroSettings,
  ReturnRequest,
  AuditLog,
  SecuritySession,
  StoreSettings,
  OrderShippingStatus,
} from './types';
import { platformApi, clearSessionToken, getSessionToken } from './services/platformService';
import {
  INITIAL_ADMIN_USERS,
  INITIAL_ADMIN_PRODUCTS,
  INITIAL_INVENTORY_ITEMS,
  INITIAL_INVENTORY_MOVEMENTS,
  INITIAL_ORDERS,
  INITIAL_PAYMENT_TRANSACTIONS,
  INITIAL_CUSTOMERS,
  INITIAL_COUPONS,
  INITIAL_ADVERTISEMENTS,
  INITIAL_FLASH_SALES,
  INITIAL_WEBSITE_SECTIONS,
  INITIAL_HERO_SETTINGS,
  INITIAL_RETURN_REQUESTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SECURITY_SESSIONS,
  INITIAL_STORE_SETTINGS,
  ROLE_PERMISSIONS
} from './data/mockData';
import {
  AIDesignConcept,
  AICharacter,
  AIWorld,
  AICollection,
  AISettings,
  AIUsageLog,
} from './types/ai';
import {
  INITIAL_AI_CHARACTERS,
  INITIAL_AI_WORLDS,
  INITIAL_AI_COLLECTIONS,
  INITIAL_AI_CONCEPTS,
  INITIAL_AI_SETTINGS,
  INITIAL_AI_USAGE_LOGS,
} from './data/aiMockData';
import { conceptToProductDraft } from './services/aiService';
import { isValidProductImageUrl } from '../utils/productFilters';
import { apiClient } from '../services/apiClient';
import { loadFrontPageCmsData, fetchFrontPageCmsDataFromServer, fetchStoreSettingsFromServer } from './data/frontPageCmsData';

function usePersistedSlice<T>(key: string, value: T) {
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    safeLocalStorageSet(key, value);
  }, [key, value]);
}

export type AdminView = 
  | 'DASHBOARD'
  | 'FINANCE'
  | 'USER_MANAGEMENT'
  | 'SUPER_ADMIN'
  | 'APPROVALS'
  | 'COMMUNICATION'
  | 'ACCOUNT_SECURITY'
  | 'PRODUCTS'
  | 'INVENTORY'
  | 'ORDERS'
  | 'CUSTOMERS'
  | 'PAYMENTS'
  | 'MARKETING'
  | 'EARLY_ACCESS'
  | 'CATALOG'
  | 'WEBSITE'
  | 'SHIPPING'
  | 'ANALYTICS'
  | 'REPORTS'
  | 'STAFF'
  | 'NOTIFICATIONS'
  | 'SETTINGS'
  | 'SECURITY'
  | 'AI_DESIGN_LAB';

export interface AdminNotification {
  id: string;
  type: 'ORDER' | 'STOCK' | 'PAYMENT' | 'SECURITY' | 'RETURN';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  linkView?: AdminView;
}

interface AdminDataContextType {
  // Auth & Session
  currentUser: AdminUser | null;
  isAuthenticated: boolean;
  isAuthChecking: boolean;
  twoFactorRequired: boolean;
  loginEmail: string;
  loginWithSession: (user: any) => void;
  login: (email: string, pass: string, remember: boolean) => any;
  verify2FA: (code: string, tempTokenOverride?: string) => any;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  refreshCurrentUser: () => Promise<void>;

  // View Navigation
  currentView: AdminView;
  setCurrentView: (view: AdminView) => void;
  selectedSubFilter?: string;
  setSelectedSubFilter: (filter?: string) => void;
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;

  // Data Collections
  products: AdminProduct[];
  inventory: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  orders: AdminOrder[];
  payments: PaymentTransaction[];
  customers: CustomerProfile[];
  coupons: Coupon[];
  ads: Advertisement[];
  flashSales: FlashSaleCampaign[];
  websiteSections: WebsiteSection[];
  heroSettings: HeroSettings;
  returnRequests: ReturnRequest[];
  auditLogs: AuditLog[];
  securitySessions: SecuritySession[];
  staff: AdminUser[];
  settings: StoreSettings;
  notifications: AdminNotification[];

  // AI Design Lab
  aiConcepts: AIDesignConcept[];
  aiCharacters: AICharacter[];
  aiWorlds: AIWorld[];
  aiCollections: AICollection[];
  aiSettings: AISettings;
  aiUsageLogs: AIUsageLog[];
  selectedConcept: AIDesignConcept | null;
  setSelectedConcept: (concept: AIDesignConcept | null) => void;
  addAIConcept: (concept: AIDesignConcept) => void;
  updateAIConcept: (concept: AIDesignConcept) => void;
  deleteAIConcept: (id: string) => void;
  addAICharacter: (char: AICharacter) => void;
  updateAICharacter: (char: AICharacter) => void;
  addAIWorld: (world: AIWorld) => void;
  updateAIWorld: (world: AIWorld) => void;
  addAICollection: (col: AICollection) => void;
  updateAICollection: (col: AICollection) => void;
  updateAISettings: (settings: Partial<AISettings>) => void;
  convertConceptToProductDraft: (concept: AIDesignConcept) => Promise<{ success: boolean; message: string; productId?: string }>;

  // Operations
  addProduct: (productData: Partial<AdminProduct>) => Promise<{ success: boolean; message: string; data?: AdminProduct }>;
  updateProduct: (id: string, updates: Partial<AdminProduct>) => Promise<{ success: boolean; message: string; data?: AdminProduct }>;
  archiveProduct: (id: string) => Promise<{ success: boolean; message: string }>;
  deleteProduct: (id: string) => Promise<{ success: boolean; message: string }>;
  duplicateProduct: (id: string) => void;
  bulkUpdateProducts: (ids: string[], action: 'PUBLISH' | 'ARCHIVE' | 'DELETE' | 'DISCOUNT', val?: any) => Promise<void>;

  updateStock: (variantId: string, newStock: number, reason: string) => void;
  deleteInventoryItem: (variantId: string, reason?: string) => void;
  bulkDeleteInventoryItems: (inventoryIds: string[], reason?: string) => Promise<{ success: boolean; deletedCount: number; message: string }>;
  clearAllProductsAndInventory: () => Promise<{ success: boolean; message: string }>;
  syncInventoryFromCatalog: () => Promise<{ success: boolean; addedCount?: number; message: string }>;
  updateOrderStatus: (orderId: string, status: OrderShippingStatus, note?: string) => void;
  addOrderInternalNote: (orderId: string, noteText: string) => void;
  cancelOrder: (orderId: string, reason: string) => void;
  initiateRefund: (orderId: string, amount: number, reason: string) => void;

  addCoupon: (coupon: Omit<Coupon, 'id' | 'usageCount'>) => Promise<void> | void;
  updateCoupon: (id: string, updates: Partial<Coupon>) => Promise<boolean>;
  toggleCoupon: (id: string) => void;
  deleteCoupon: (id: string) => void;

  addAdvertisement: (ad: Omit<Advertisement, 'id' | 'clicks' | 'impressions'>) => void;
  updateAdvertisement: (id: string, updates: Partial<Advertisement>) => void;
  deleteAdvertisement: (id: string) => void;

  saveWebsiteSections: (sections: WebsiteSection[]) => Promise<boolean>;
  saveHeroSettings: (hero: HeroSettings) => Promise<boolean>;
  syncCmsStateLocally: (sections?: WebsiteSection[], hero?: HeroSettings) => void;

  processReturnRequest: (id: string, newStatus: ReturnRequest['status'], note?: string) => void;

  revokeSession: (id: string) => void;
  revokeAllOtherSessions: () => void;

  addStaffMember: (user: Omit<AdminUser, 'id' | 'lastLogin'>) => void;
  updateStaffRole: (userId: string, newRole: Role) => void;
  toggleStaffStatus: (userId: string) => void;

  updateSettings: (newSettings: Partial<StoreSettings>) => void;
  toggleMaintenanceMode: () => void;

  markNotificationAsRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;

  toastMessage: string | null;
  showToast: (msg: string) => void;
  resetToDemoData: () => void;
}

/**
 * Safely writes to localStorage with automatic eviction of expendable caches
 * and payload compression/sanitization to prevent QuotaExceededError.
 */
function safeLocalStorageSet(key: string, data: any): boolean {
  if (typeof window === 'undefined') return false;

  const tryWrite = (val: string): boolean => {
    try {
      localStorage.setItem(key, val);
      return true;
    } catch {
      return false;
    }
  };

  // 1. First attempt: standard JSON stringify
  try {
    const raw = JSON.stringify(data);
    if (tryWrite(raw)) return true;
  } catch {}

  // 2. If QuotaExceededError, evict low-priority ephemeral logs and cache keys
  const expendableKeys = [
    'tori_admin_ai_usage_logs',
    'tori_admin_auditLogs',
    'tori_admin_inv_movements',
    'tori_admin_securitySessions',
    'tori_admin_ads',
    'tori_admin_flashSales',
  ];
  for (const expKey of expendableKeys) {
    if (expKey !== key) {
      try {
        localStorage.removeItem(expKey);
      } catch {}
    }
  }

  // Retry write after evicting expendable keys
  try {
    const raw = JSON.stringify(data);
    if (tryWrite(raw)) return true;
  } catch {}

  // 3. If saving products, sanitize/compact large base64 images that consume megabytes
  if (key === 'tori_admin_products' && Array.isArray(data)) {
    try {
      const sanitized = data.map((p: any) => {
        const cleanImages = Array.isArray(p.images)
          ? p.images.map((img: string) => {
              if (typeof img === 'string' && img.startsWith('data:') && img.length > 1024) {
                return 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80';
              }
              return img;
            })
          : p.images;

        return {
          id: p.id,
          catalogNumber: p.catalogNumber,
          name: p.name,
          sku: p.sku,
          department: p.department,
          world: p.world,
          franchise: p.franchise,
          universe: p.universe,
          category: p.category,
          fit: p.fit,
          price: p.price,
          mrp: p.mrp,
          costPrice: p.costPrice,
          publishingStatus: p.publishingStatus,
          licenseRightsStatus: p.licenseRightsStatus,
          stock: p.stock,
          inStock: p.inStock,
          images: cleanImages,
          variants: Array.isArray(p.variants)
            ? p.variants.map((v: any) => ({
                id: v.id,
                sku: v.sku,
                size: v.size,
                colorName: v.colorName,
                colorHex: v.colorHex,
                price: v.price,
                stock: v.stock,
              }))
            : [],
        };
      });

      const sanitizedRaw = JSON.stringify(sanitized);
      if (tryWrite(sanitizedRaw)) {
        return true;
      }
    } catch {}
  }

  // 4. Graceful degradation: The backend database and React state remain authoritative.
  console.warn(`[AdminData] Local storage quota reached. Falling back to in-memory & authoritative database for "${key}".`);
  return false;
}

const AdminDataContext = createContext<AdminDataContextType | undefined>(undefined);

export const AdminDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Check LocalStorage or seed with INITIAL_*
  const loadInitial = <T,>(key: string, fallback: T): T => {
    try {
      const stored = localStorage.getItem(`tori_admin_${key}`);
      if (!stored) return fallback;
      // Purge legacy mock data strings from storage
      if (
        (key === 'orders' && (stored.includes('ord-104') || stored.includes('TORI-104'))) ||
        (key === 'payments' && (stored.includes('tx-90') || stored.includes('PAY-104') || stored.includes('pay-'))) ||
        (key === 'customers' && (stored.includes('cust-01') || stored.includes('Rohan Sharma') || stored.includes('Aarav Kapoor') || stored.includes('Kavya Nair'))) ||
        (key === 'inv_movements' && (stored.includes('mov-101') || stored.includes('Tirupur'))) ||
        (key === 'return_requests' && stored.includes('ret-101')) ||
        (key === 'returnRequests' && stored.includes('ret-101'))
      ) {
        localStorage.removeItem(`tori_admin_${key}`);
        return fallback;
      }
      return JSON.parse(stored);
    } catch (e) {
      return fallback;
    }
  };

  // CRITICAL SECURITY FIX: Never initialize unauthenticated visitor as Mohammed Saif or any Super Admin!
  // Initialize strictly to null and verify session token asynchronously against backend /api/auth/me.
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [pendingTempToken, setPendingTempToken] = useState<string>('');
  const [twoFactorRequired, setTwoFactorRequired] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [currentView, setCurrentView] = useState<AdminView>('DASHBOARD');

  // Verify active session with authoritative server upon initialization
  useEffect(() => {
    let isMounted = true;
    const verifySession = async () => {
      const token = getSessionToken();
      if (!token) {
        if (isMounted) {
          setCurrentUser(null);
          setIsAuthChecking(false);
        }
        return;
      }

      try {
        const res = await platformApi.getMe();
        if (isMounted && res && res.authenticated && res.user) {
          const mappedUser: AdminUser = {
            id: res.user.id,
            name: res.user.name,
            email: res.user.email,
            role: res.user.role as any,
            adminAccessTier: res.user.adminAccessTier,
            employeeId: res.user.employeeId,
            designation: res.user.designation,
            department: res.user.department || 'Executive Leadership',
            avatarUrl: res.user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
            twoFactorEnabled: res.user.twoFactorEnabled,
            lastLogin: 'Active now',
            isActive: true,
            permissions: res.user.permissions as any,
          };
          setCurrentUser(mappedUser);
        } else if (isMounted) {
          clearSessionToken();
          setCurrentUser(null);
        }
      } catch (err) {
        if (isMounted) {
          clearSessionToken();
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthChecking(false);
        }
      }
    };

    verifySession();
    return () => {
      isMounted = false;
    };
  }, []);
  const [selectedSubFilter, setSelectedSubFilter] = useState<string | undefined>(undefined);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  // States
  const [products, setProducts] = useState<AdminProduct[]>(() => loadInitial('products', INITIAL_ADMIN_PRODUCTS));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => loadInitial('inventory', INITIAL_INVENTORY_ITEMS));
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>(() => loadInitial('inv_movements', INITIAL_INVENTORY_MOVEMENTS));
  const [orders, setOrders] = useState<AdminOrder[]>(() => loadInitial('orders', INITIAL_ORDERS));
  const [payments, setPayments] = useState<PaymentTransaction[]>(() => loadInitial('payments', INITIAL_PAYMENT_TRANSACTIONS));
  const [customers, setCustomers] = useState<CustomerProfile[]>(() => loadInitial('customers', INITIAL_CUSTOMERS));
  const [coupons, setCoupons] = useState<Coupon[]>(() => loadInitial('coupons', INITIAL_COUPONS));
  const [ads, setAds] = useState<Advertisement[]>(() => loadInitial('ads', INITIAL_ADVERTISEMENTS));
  const [flashSales] = useState<FlashSaleCampaign[]>(() => loadInitial('flashSales', INITIAL_FLASH_SALES));
  const [websiteSections, setWebsiteSections] = useState<WebsiteSection[]>(() => loadFrontPageCmsData().sections || INITIAL_WEBSITE_SECTIONS);
  const [heroSettings, setHeroSettings] = useState<HeroSettings>(() => loadFrontPageCmsData().hero || INITIAL_HERO_SETTINGS);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>(() => loadInitial('returnRequests', INITIAL_RETURN_REQUESTS));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadInitial('auditLogs', INITIAL_AUDIT_LOGS));
  const [securitySessions, setSecuritySessions] = useState<SecuritySession[]>(() => loadInitial('securitySessions', INITIAL_SECURITY_SESSIONS));
  const [staff, setStaff] = useState<AdminUser[]>(() => loadInitial('staff', INITIAL_ADMIN_USERS));
  const [settings, setSettings] = useState<StoreSettings>(() => loadInitial('settings', INITIAL_STORE_SETTINGS));

  // AI Design Lab States
  const [aiConcepts, setAiConcepts] = useState<AIDesignConcept[]>(() => loadInitial('ai_concepts', INITIAL_AI_CONCEPTS));
  const [aiCharacters, setAiCharacters] = useState<AICharacter[]>(() => loadInitial('ai_characters', INITIAL_AI_CHARACTERS));
  const [aiWorlds, setAiWorlds] = useState<AIWorld[]>(() => loadInitial('ai_worlds', INITIAL_AI_WORLDS));
  const [aiCollections, setAiCollections] = useState<AICollection[]>(() => loadInitial('ai_collections', INITIAL_AI_COLLECTIONS));
  const [aiSettings, setAiSettings] = useState<AISettings>(() => loadInitial('ai_settings', INITIAL_AI_SETTINGS));
  const [aiUsageLogs] = useState<AIUsageLog[]>(() => loadInitial('ai_usage_logs', INITIAL_AI_USAGE_LOGS));
  const [selectedConcept, setSelectedConcept] = useState<AIDesignConcept | null>(null);

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);


  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync each state slice independently on change (avoids re-serializing all 16 stores on a single field edit)
  usePersistedSlice('tori_admin_currentUser', currentUser);
  usePersistedSlice('tori_admin_products', products);
  usePersistedSlice('tori_admin_inventory', inventory);
  usePersistedSlice('tori_admin_inv_movements', inventoryMovements);
  usePersistedSlice('tori_admin_orders', orders);
  usePersistedSlice('tori_admin_customers', customers);
  usePersistedSlice('tori_admin_coupons', coupons);
  usePersistedSlice('tori_admin_settings', settings);
  usePersistedSlice('tori_admin_heroSettings', heroSettings);
  usePersistedSlice('tori_admin_websiteSections', websiteSections);
  usePersistedSlice('tori_admin_ai_concepts', aiConcepts);
  usePersistedSlice('tori_admin_ai_characters', aiCharacters);
  usePersistedSlice('tori_admin_ai_worlds', aiWorlds);
  usePersistedSlice('tori_admin_ai_collections', aiCollections);
  usePersistedSlice('tori_admin_ai_settings', aiSettings);
  usePersistedSlice('tori_admin_ai_usage_logs', aiUsageLogs);

  // Hydrate authoritative CMS frontpage & store settings from backend on mount & listen for session expiry
  useEffect(() => {
    let isMounted = true;

    fetchFrontPageCmsDataFromServer().then((serverData) => {
      if (!isMounted || !serverData) return;
      if (Array.isArray(serverData.sections) && serverData.sections.length > 0) {
        setWebsiteSections(serverData.sections);
      }
      if (serverData.hero) {
        setHeroSettings(serverData.hero);
      }
    }).catch(() => {});

    fetchStoreSettingsFromServer()
      .then((data) => {
        if (!isMounted || !data) return;
        setSettings((prev) => ({
          ...prev,
          ...data,
        }));
        if (data.logoUpdatedAt) {
          try {
            const serverTs = String(data.logoUpdatedAt);
            const existingTs = localStorage.getItem('tori_logo_timestamp');
            if (!existingTs || Number(serverTs) > Number(existingTs)) {
              localStorage.setItem('tori_logo_timestamp', serverTs);
              window.dispatchEvent(new CustomEvent('tori-logo-updated', { detail: { timestamp: serverTs } }));
            }
          } catch {}
        }
      })
      .catch(() => {});

    const handleCmsSync = (e?: any) => {
      const fresh = e?.detail && e.detail.sections ? e.detail : loadFrontPageCmsData();
      if (fresh.sections && fresh.sections.length > 0) {
        setWebsiteSections(fresh.sections);
      }
      if (fresh.hero) {
        setHeroSettings(fresh.hero);
      }
    };

    const handleSessionExpired = () => {
      clearSessionToken();
      setCurrentUser(null);
      showToast('Admin session expired or invalid — please sign in again.');
    };

    window.addEventListener('tori-cms-updated', handleCmsSync);
    window.addEventListener('tori-admin-session-expired', handleSessionExpired);
    return () => {
      isMounted = false;
      window.removeEventListener('tori-cms-updated', handleCmsSync);
      window.removeEventListener('tori-admin-session-expired', handleSessionExpired);
    };
  }, []);

  // Real-time synchronization of customer signups and activities from storefront
  useEffect(() => {
    const syncCustomers = () => {
      try {
        const stored = localStorage.getItem('tori_admin_customers');
        if (stored) {
          const parsed = JSON.parse(stored);
          setCustomers(prev => {
            if (JSON.stringify(prev) === stored) return prev;
            return parsed;
          });
        }
      } catch (e) {
        console.error(e);
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'tori_admin_customers') syncCustomers();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('tori_customer_updated', syncCustomers);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('tori_customer_updated', syncCustomers);
    };
  }, []);

  // Real-time synchronization of customer orders placed or updated on storefront
  useEffect(() => {
    const syncOrders = () => {
      try {
        const stored = localStorage.getItem('tori_admin_orders');
        if (stored) {
          const parsed = JSON.parse(stored);
          setOrders(prev => {
            if (JSON.stringify(prev) === stored) return prev;
            return parsed;
          });
        }
      } catch (e) {
        console.error(e);
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'tori_admin_orders') syncOrders();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('tori_admin_orders_updated', syncOrders);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('tori_admin_orders_updated', syncOrders);
    };
  }, []);

  // Fetch server-authoritative orders from backend API whenever authenticated user changes
  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;
    apiClient.getAdminOrders().then((res) => {
      if (isMounted && res.success && Array.isArray(res.data)) {
        setOrders(res.data.map((o: any) => {
          const rawMethod = String(o.paymentMethod || 'UPI').toUpperCase();
          const mappedMethod = rawMethod.includes('CARD')
            ? ('Credit Card' as const)
            : rawMethod.includes('NET')
            ? ('Net Banking' as const)
            : rawMethod === 'COD'
            ? ('COD' as const)
            : ('UPI' as const);

          const rawStatus = String(o.fulfillmentStatus || o.shippingStatus || 'CONFIRMED').toUpperCase();
          const validStatuses = ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED'];
          const mappedShippingStatus = validStatuses.includes(rawStatus) ? (rawStatus as any) : 'CONFIRMED';

          return {
            orderId: o.id || o.orderId,
            orderNumber: o.orderNumber || `#${o.id || o.orderId}`,
            date: o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN') : o.date || 'Recent',
            customerId: o.customerId || 'GUEST',
            customerName: o.customerName || 'Customer',
            customerEmail: o.customerEmail || '',
            customerPhone: o.customerPhone || '',
            shippingAddress: {
              fullName: o.shippingAddress?.fullName || o.customerName || 'Customer',
              addressLine1: o.shippingAddress?.addressLine1 || '',
              addressLine2: o.shippingAddress?.addressLine2 || undefined,
              city: o.shippingAddress?.city || '',
              state: o.shippingAddress?.state || '',
              pincode: o.shippingAddress?.pincode || '',
            },
            items: (o.items || []).map((it: any) => ({
              productId: it.productId,
              productName: it.productName,
              variantId: it.variantId || `${it.productId}-${it.size}-${it.color}`,
              sku: it.sku || `SKU-${it.productId}`,
              size: it.size,
              color: it.color,
              image: it.image || '',
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              totalPrice: it.totalPrice,
            })),
            subtotal: o.subtotal,
            discount: o.discount || 0,
            discountCode: o.discountCode,
            tax: o.tax || 0,
            shippingFee: o.shippingFee ?? 0,
            total: o.total,
            paymentMethod: mappedMethod,
            paymentStatus: (o.paymentStatus || 'PAID') as any,
            shippingStatus: mappedShippingStatus,
            courier: o.courierPartner || o.courier,
            trackingNumber: o.courierTrackingNumber || o.trackingNumber,
            estimatedDelivery: o.estimatedDeliveryDate || o.estimatedDelivery || '3 to 5 Business Days',
            timeline: (o.timeline || []).map((tl: any) => ({
              title: tl.status || tl.title || 'Update',
              timestamp: tl.timestamp,
              note: tl.description || tl.note,
            })),
            internalNotes: o.internalNotes || [],
          };
        }));
      }
    }).catch((err) => console.warn('[AdminData] Async fetch orders from API:', err));

    return () => { isMounted = false; };
  }, [currentUser]);

  // Track last catalog write timestamp to prevent stale GET responses from racing
  const lastProductMutationTimeRef = useRef<number>(0);

  // Fetch server-authoritative products & inventory from backend API whenever authenticated
  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;
    const fetchStartTime = Date.now();
    const token = getSessionToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const syncCatalogAndInventory = async () => {
      try {
        const res = await apiClient.getAdminProducts();
        if (!isMounted) return;
        if (lastProductMutationTimeRef.current > fetchStartTime) {
          console.log('[AdminData] ⏭️ Skipping stale getAdminProducts response as a newer mutation occurred.');
          return;
        }

        let mappedProducts: AdminProduct[] = [];
        if (res.success && Array.isArray(res.data)) {
          mappedProducts = res.data.map((rp: any) => {
            const dept: 'MEN' | 'KIDS' = rp.department === 'KIDS' || rp.universe === 'KIDS' ? 'KIDS' : 'MEN';
            return {
              id: rp.id,
              catalogNumber: rp.catalogNumber || '00',
              name: rp.name,
              sku: rp.sku || `TORI-${rp.catalogNumber || '00'}`,
              department: dept,
              world: rp.world || (dept === 'KIDS' ? 'CUTE ADVENTURE' : 'DARK SHONEN'),
              franchise: rp.franchise || 'Toriwear Originals',
              universe: rp.universe || (dept === 'KIDS' ? 'KIDS' : 'ORIGINALS'),
              category: rp.category || 'Oversized Tees',
              fit: rp.fit || 'Oversized',
              price: Number(rp.price) || 1199,
              mrp: Number(rp.originalPrice || rp.mrp) || Math.round((Number(rp.price) || 1199) * 1.3),
              costPrice: Number(rp.costPrice) || 450,
              discountPercent: 25,
              gstRate: 5,
              rating: rp.rating || 5.0,
              reviewsCount: rp.reviewsCount || 0,
              images: Array.isArray(rp.images) && rp.images.length > 0 ? rp.images : ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80'],
              description: rp.description || '',
              shortDescription: `${rp.gsm || 240} GSM streetwear fit.`,
              storyQuote: rp.storyQuote || 'Wear Your World.',
              drop: rp.drop || 'CHAPTER 01 — ORIGINALS',
              gsm: Number(rp.gsm) || 240,
              fabric: rp.fabric || '100% Combed Heavyweight Cotton',
              neck: rp.neck || 'High-Ribbed Crewneck',
              sleeves: rp.sleeves || 'Drop Shoulder Half Sleeves',
              print: rp.print || 'High-Density Screen Print',
              tags: ['streetwear', 'anime'],
              seoTitle: `${rp.name} | TORIWEAR`,
              seoDescription: 'Shop official heavyweight streetwear from Toriwear.',
              slug: rp.slug || rp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              publishingStatus: (rp.status || rp.publishingStatus || 'PUBLISHED') as any,
              licenseRightsStatus: (rp.licenseRightsStatus || 'Owned IP') as any,
              variants: Array.isArray(rp.variants) && rp.variants.length > 0 
                ? rp.variants.map((v: any) => ({
                    id: v.id,
                    sku: v.sku || `SKU-${v.id}`,
                    size: v.size || 'M',
                    colorName: v.colorName || 'Obsidian Black',
                    colorHex: v.colorHex || '#111115',
                    price: Number(v.price) || Number(rp.price) || 1199,
                    stock: v.stock !== undefined && !isNaN(Number(v.stock)) ? Number(v.stock) : 25,
                    reserved: Number(v.reservedStock) || 0,
                    barcode: v.barcode || `89000${v.id}`,
                    weightGrams: Number(v.weightGrams) || (dept === 'KIDS' ? 200 : 340),
                  }))
                : [
                    { id: `var-${rp.id}-s`, sku: `${rp.sku || 'TORI'}-S`, size: 'S', colorName: 'Obsidian Black', colorHex: '#111115', price: rp.price || 1199, stock: 20, reserved: 0, barcode: '8901001', weightGrams: 320 },
                    { id: `var-${rp.id}-m`, sku: `${rp.sku || 'TORI'}-M`, size: 'M', colorName: 'Obsidian Black', colorHex: '#111115', price: rp.price || 1199, stock: 35, reserved: 0, barcode: '8901002', weightGrams: 340 },
                    { id: `var-${rp.id}-l`, sku: `${rp.sku || 'TORI'}-L`, size: 'L', colorName: 'Obsidian Black', colorHex: '#111115', price: rp.price || 1199, stock: 40, reserved: 0, barcode: '8901003', weightGrams: 360 },
                    { id: `var-${rp.id}-xl`, sku: `${rp.sku || 'TORI'}-XL`, size: 'XL', colorName: 'Obsidian Black', colorHex: '#111115', price: rp.price || 1199, stock: 25, reserved: 0, barcode: '8901004', weightGrams: 380 },
                  ],
              totalSold: 0,
              createdAt: rp.createdAt || new Date().toISOString(),
              updatedAt: rp.updatedAt || new Date().toISOString(),
            };
          });
          setProducts(mappedProducts);
          safeLocalStorageSet('tori_admin_products', mappedProducts);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tori_admin_products_updated', { detail: mappedProducts }));
          }
        }

        // Also fetch authoritative Inventory from backend API
        const invRes = await fetch('/api/v1/inventory', { headers });
        if (isMounted && invRes.ok) {
          const invJson = await invRes.json();
          if (invJson.success && Array.isArray(invJson.data) && lastProductMutationTimeRef.current <= fetchStartTime) {
            const variantLookup = new Map<string, { prod: AdminProduct; variant: any }>();
            for (const mp of mappedProducts) {
              for (const mv of mp.variants || []) {
                variantLookup.set(mv.id, { prod: mp, variant: mv });
                if (mv.sku) variantLookup.set(mv.sku, { prod: mp, variant: mv });
              }
            }

            const mappedInv: InventoryItem[] = invJson.data.map((ri: any) => {
              const found = variantLookup.get(ri.variantId) || variantLookup.get(ri.sku);
              const available = Number(ri.quantityAvailable ?? ri.quantityOnHand ?? 0);
              const threshold = Number(ri.threshold ?? 5);
              let status: InventoryItem['status'] = 'IN_STOCK';
              if (available === 0) status = 'OUT_OF_STOCK';
              else if (available <= 2) status = 'CRITICAL_STOCK';
              else if (available <= threshold) status = 'LOW_STOCK';

              return {
                id: ri.id || `inv-${ri.variantId}`,
                productId: found?.prod?.id || 'unlinked',
                productName: found?.prod?.name || ri.sku || 'Variant SKU',
                variantId: ri.variantId,
                sku: ri.sku || found?.variant?.sku || ri.variantId,
                size: found?.variant?.size || 'M',
                colorName: found?.variant?.colorName || 'Obsidian Black',
                availableStock: available,
                reservedStock: Number(ri.quantityReserved ?? 0),
                sold: 0,
                lowStockThreshold: threshold,
                criticalThreshold: 2,
                status,
                lastUpdated: ri.updatedAt ? new Date(ri.updatedAt).toLocaleString('en-IN') : 'Synced',
              };
            });

            setInventory(mappedInv);
            safeLocalStorageSet('tori_admin_inventory', mappedInv);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('tori_admin_inventory_updated', { detail: mappedInv }));
            }
          }
        }

        // Also fetch inventory movements
        const movRes = await fetch('/api/v1/inventory/movements/recent?limit=100', { headers });
        if (isMounted && movRes.ok) {
          const movJson = await movRes.json();
          if (movJson.success && Array.isArray(movJson.data)) {
            const mappedMov: InventoryMovement[] = movJson.data.map((m: any) => ({
              id: m.id,
              timestamp: m.createdAt ? new Date(m.createdAt).toLocaleString('en-IN') : 'Synced',
              productId: m.variantId,
              productName: m.sku || m.variantId,
              sku: m.sku || m.variantId,
              type: Number(m.quantityDelta) >= 0 ? 'INCREASE' : 'DECREASE',
              amount: Number(m.quantityDelta || 0),
              previousStock: Number(m.previousQuantity || 0),
              newStock: Number(m.newQuantity || 0),
              reason: m.reason || m.movementType || 'Stock adjustment',
              adminName: m.operatorId || 'Admin',
            }));
            setInventoryMovements(mappedMov);
            safeLocalStorageSet('tori_admin_inv_movements', mappedMov);
          }
        }
      } catch (err) {
        console.warn('[AdminData] Async fetch admin products/inventory from API:', err);
      }
    };

    syncCatalogAndInventory();

    return () => { isMounted = false; };
  }, [currentUser]);

  // Fetch server-authoritative coupons
  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;
    const token = getSessionToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch('/api/v1/admin/coupons', { headers })
      .then(res => res.json())
      .then(res => {
        if (isMounted && res.success && Array.isArray(res.data)) {
          const mapped: Coupon[] = res.data.map((c: any) => ({
            id: c.id,
            code: c.code,
            discountType: c.discountType === 'PERCENTAGE' ? 'PERCENTAGE' : (c.discountType === 'FREE_SHIPPING' ? 'FREE_SHIPPING' : 'FIXED'),
            value: Number(c.value),
            minCartValue: Number(c.minOrderValue || c.minCartValue || 0),
            minOrderValue: Number(c.minOrderValue || 0),
            maxDiscount: c.maxDiscount != null ? Number(c.maxDiscount) : undefined,
            usageLimit: c.usageLimit != null ? Number(c.usageLimit) : 1000,
            usageCount: Number(c.usageCount || 0),
            perCustomerLimit: Number(c.perUserLimit || c.perCustomerLimit || 1),
            applicableFranchises: Array.isArray(c.applicableFranchises) ? c.applicableFranchises : ['ALL'],
            eligibleCategories: Array.isArray(c.eligibleCategories) ? c.eligibleCategories : [],
            eligibleProductIds: Array.isArray(c.eligibleProductIds) ? c.eligibleProductIds : [],
            excludeShipping: c.excludeShipping !== false,
            excludeTax: c.excludeTax !== false,
            startDate: c.startDate ? (new Date(c.startDate).toISOString().split('T')[0] || '2026-01-01') : '2026-01-01',
            endDate: c.expiryDate ? (new Date(c.expiryDate).toISOString().split('T')[0] || '2026-12-31') : '2026-12-31',
            expiryDate: c.expiryDate ? (new Date(c.expiryDate).toISOString().split('T')[0] || '2026-12-31') : '2026-12-31',
            isActive: c.isActive !== false,
            description: c.description || '',
          }));
          setCoupons(mapped);
          safeLocalStorageSet('tori_admin_coupons', mapped);
        }
      })
      .catch((err) => console.warn('[AdminData] Async fetch coupons error:', err));

    return () => { isMounted = false; };
  }, [currentUser]);

  // Listen to product & inventory storage events and local custom update events
  useEffect(() => {
    const handleProductsUpdated = () => {
      try {
        const stored = localStorage.getItem('tori_admin_products');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setProducts((prev) => {
              if (prev.length === parsed.length && prev[0]?.id === parsed[0]?.id) return prev;
              return parsed;
            });
          }
        }
      } catch {}
    };

    const handleInventoryUpdated = () => {
      try {
        const stored = localStorage.getItem('tori_admin_inventory');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setInventory(parsed);
          }
        }
      } catch {}
    };

    const handleProductsRefresh = async () => {
      if (!currentUser) return;
      try {
        const res = await apiClient.getAdminProducts();
        if (res.success && Array.isArray(res.data)) {
          const refreshed: AdminProduct[] = res.data.map((rp: any) => {
            const dept: 'MEN' | 'KIDS' = rp.department === 'KIDS' || rp.universe === 'KIDS' ? 'KIDS' : 'MEN';
            return {
              id: rp.id,
              catalogNumber: rp.catalogNumber || '00',
              name: rp.name,
              sku: rp.sku || `TORI-${rp.catalogNumber || '00'}`,
              department: dept,
              world: rp.world || (dept === 'KIDS' ? 'CUTE ADVENTURE' : 'DARK SHONEN'),
              franchise: rp.franchise || 'Toriwear Originals',
              universe: rp.universe || (dept === 'KIDS' ? 'KIDS' : 'ORIGINALS'),
              category: rp.category || 'Oversized Tees',
              fit: rp.fit || 'Oversized',
              price: Number(rp.price) || 1199,
              mrp: Number(rp.originalPrice || rp.mrp) || Math.round((Number(rp.price) || 1199) * 1.3),
              costPrice: Number(rp.costPrice) || 450,
              discountPercent: 25,
              gstRate: 5,
              rating: rp.rating || 5.0,
              reviewsCount: rp.reviewsCount || 0,
              images: Array.isArray(rp.images) && rp.images.length > 0 ? rp.images : ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80'],
              description: rp.description || '',
              shortDescription: `${rp.gsm || 240} GSM streetwear fit.`,
              storyQuote: rp.storyQuote || 'Wear Your World.',
              drop: rp.drop || 'CHAPTER 01 — ORIGINALS',
              gsm: Number(rp.gsm) || 240,
              fabric: rp.fabric || '100% Combed Heavyweight Cotton',
              neck: rp.neck || 'High-Ribbed Crewneck',
              sleeves: rp.sleeves || 'Drop Shoulder Half Sleeves',
              print: rp.print || 'High-Density Screen Print',
              tags: ['streetwear', 'anime'],
              seoTitle: `${rp.name} | TORIWEAR`,
              seoDescription: 'Shop official heavyweight streetwear from Toriwear.',
              slug: rp.slug || rp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              publishingStatus: (rp.status || rp.publishingStatus || 'PUBLISHED') as any,
              licenseRightsStatus: (rp.licenseRightsStatus || 'Owned IP') as any,
              variants: Array.isArray(rp.variants) && rp.variants.length > 0
                ? rp.variants.map((v: any) => ({
                    id: v.id,
                    sku: v.sku || `SKU-${v.id}`,
                    size: v.size || 'M',
                    colorName: v.colorName || 'Obsidian Black',
                    colorHex: v.colorHex || '#111115',
                    price: Number(v.price) || Number(rp.price) || 1199,
                    stock: v.stock !== undefined && !isNaN(Number(v.stock)) ? Number(v.stock) : 25,
                    reserved: Number(v.reservedStock) || 0,
                    barcode: v.barcode || `89000${v.id}`,
                    weightGrams: Number(v.weightGrams) || (dept === 'KIDS' ? 200 : 340),
                  }))
                : [],
              totalSold: 0,
              createdAt: rp.createdAt || new Date().toISOString(),
              updatedAt: rp.updatedAt || new Date().toISOString(),
            };
          });
          setProducts(refreshed);
          safeLocalStorageSet('tori_admin_products', refreshed);
          window.dispatchEvent(new CustomEvent('tori_admin_products_updated', { detail: refreshed }));
        }
      } catch (err) {
        console.warn('[AdminData] Failed to refresh products:', err);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'tori_admin_products') handleProductsUpdated();
      else if (e.key === 'tori_admin_inventory') handleInventoryUpdated();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('tori_admin_products_updated', handleProductsUpdated);
    window.addEventListener('tori_admin_inventory_updated', handleInventoryUpdated);
    window.addEventListener('tori_admin_products_refresh', handleProductsRefresh);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('tori_admin_products_updated', handleProductsUpdated);
      window.removeEventListener('tori_admin_inventory_updated', handleInventoryUpdated);
      window.removeEventListener('tori_admin_products_refresh', handleProductsRefresh);
    };
  }, [currentUser]);

  const logAction = (
    action: AuditLog['action'], 
    entity: string, 
    details: string, 
    oldValue?: string, 
    newValue?: string
  ) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      adminName: currentUser?.name || 'System Operator',
      adminEmail: currentUser?.email || 'admin@toriwear.com',
      action,
      entity,
      details,
      oldValue,
      newValue,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST (Today)',
      ipAddress: '152.58.112.9 (Session)',
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Permission check — evaluates live server-authoritative GranularPermissions first
  const hasPermission = (permission: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'SUPER_ADMIN' || currentUser.id === 'usr-saif') return true;

    const perms = currentUser.permissions;
    if (perms && typeof perms === 'object') {
      const hasAction = (mod: string, action: string) =>
        Array.isArray(perms[mod]) && perms[mod].includes(action);

      switch (permission) {
        case 'products.view': return hasAction('products', 'view');
        case 'products.create': return hasAction('products', 'create');
        case 'products.edit': return hasAction('products', 'edit');
        case 'products.delete': return hasAction('products', 'delete');
        case 'inventory.view': return hasAction('inventory', 'view');
        case 'inventory.edit': return hasAction('inventory', 'edit');
        case 'orders.view': return hasAction('orders', 'view');
        case 'orders.edit': return hasAction('orders', 'edit') || hasAction('shipping', 'edit');
        case 'orders.cancel': return hasAction('orders', 'edit') || hasAction('orders', 'delete');
        case 'refunds.create': return hasAction('finance', 'approve') || hasAction('orders', 'approve');
        case 'payments.view': return hasAction('finance', 'view') || hasAction('orders', 'view');
        case 'marketing.create': return hasAction('marketing', 'create');
        case 'marketing.edit': return hasAction('marketing', 'edit');
        case 'customers.view': return hasAction('customers', 'view');
        case 'customers.edit': return hasAction('customers', 'edit');
        case 'website.edit':
          return hasAction('website', 'edit') || hasAction('website', 'view') || hasAction('catalog', 'edit') || hasAction('marketing', 'edit');
        case 'reports.view': return hasAction('reports', 'view');
        case 'staff.manage':
          return hasAction('staff', 'view') || hasAction('staff', 'edit') || hasAction('superAdmin', 'edit');
        case 'security.manage':
          return hasAction('security', 'view') || hasAction('security', 'edit') || hasAction('superAdmin', 'view');
        case 'settings.manage':
          return hasAction('settings', 'view') || hasAction('settings', 'edit') || hasAction('superAdmin', 'edit');
        case 'superadmin.view':
          return hasAction('superAdmin', 'view');
        case 'superadmin.edit':
          return hasAction('superAdmin', 'edit');
        case 'finance.view': return hasAction('finance', 'view');
        case 'finance.create': return hasAction('finance', 'create');
        case 'finance.edit': return hasAction('finance', 'edit');
        case 'finance.approve': return hasAction('finance', 'approve');
        case 'finance.partners': return hasAction('finance', 'view');
        case 'finance.accounts': return hasAction('finance', 'view');
        case 'finance.reports': return hasAction('finance', 'export') || hasAction('finance', 'view');
        case 'ai.view':
        case 'AI_DESIGN_LAB_VIEW':
          return hasAction('aiDesignLab', 'view');
        case 'ai.create':
        case 'AI_DESIGN_LAB_CREATE':
          return hasAction('aiDesignLab', 'create');
        case 'ai.edit':
        case 'AI_DESIGN_LAB_EDIT':
          return hasAction('aiDesignLab', 'edit');
        case 'ai.approve':
        case 'AI_DESIGN_LAB_APPROVE':
          return hasAction('aiDesignLab', 'approve');
        case 'ai.delete':
        case 'AI_DESIGN_LAB_DELETE':
          return hasAction('aiDesignLab', 'delete');
        case 'ai.settings':
        case 'AI_DESIGN_LAB_SETTINGS':
          return hasAction('aiDesignLab', 'edit') || hasAction('settings', 'edit');
        default:
          break;
      }
    }

    const allowed = ROLE_PERMISSIONS[currentUser.role] || [];
    return allowed.includes(permission as any);
  };

  const refreshCurrentUser = async () => {
    const token = getSessionToken();
    if (!token) return;
    try {
      const res = await platformApi.getMe();
      if (res && res.authenticated && res.user) {
        const refreshed: AdminUser = {
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          role: res.user.role as any,
          adminAccessTier: res.user.adminAccessTier,
          employeeId: res.user.employeeId,
          designation: res.user.designation,
          department: res.user.department || 'Executive Leadership',
          avatarUrl: res.user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
          twoFactorEnabled: res.user.twoFactorEnabled,
          lastLogin: 'Active now',
          isActive: true,
          permissions: res.user.permissions as any,
        };
        setCurrentUser(refreshed);
        safeLocalStorageSet('tori_admin_currentUser', refreshed);
      }
    } catch {}
  };

  const loginWithSession = (user: any) => {
    const mappedUser: AdminUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as any,
      adminAccessTier: user.adminAccessTier,
      employeeId: user.employeeId,
      designation: user.designation,
      department: user.department || 'Management',
      avatarUrl: user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      twoFactorEnabled: user.twoFactorEnabled,
      lastLogin: 'Active now',
      isActive: true,
      permissions: user.permissions as any,
    };
    setCurrentUser(mappedUser);
    setTwoFactorRequired(false);
    setPendingTempToken('');
    safeLocalStorageSet('tori_admin_currentUser', mappedUser);
    logAction('LOGIN_SUCCESS', 'Admin Session', `Authenticated session established for ${mappedUser.email} (${mappedUser.role})`);
    showToast(`Welcome back, ${mappedUser.name}!`);
  };

  // Auth operations — Genuine server-side authentication
  const login = async (email: string, pass: string, remember: boolean = true) => {
    try {
      const res = await platformApi.login(email, pass, remember);
      if (!res.success) {
        return { success: false, error: res.error || 'Invalid credentials. Please verify your email/ID and password.' };
      }

      if (res.requires2FA && res.tempToken) {
        setLoginEmail(email);
        setPendingTempToken(res.tempToken);
        setTwoFactorRequired(true);
        return { success: true, requires2fa: true, tempToken: res.tempToken };
      }

      if (res.user) {
        loginWithSession(res.user);
        return { success: true };
      }

      return { success: false, error: 'Unexpected login response from authentication server.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error communicating with authentication server.' };
    }
  };

  const verify2FA = async (code: string, tempTokenOverride?: string) => {
    const tokenToUse = tempTokenOverride || pendingTempToken;
    if (!tokenToUse) {
      showToast('2FA challenge expired. Please sign in again.');
      return false;
    }

    try {
      const res = await platformApi.verify2FA(tokenToUse, code);
      if (res.success && res.user) {
        loginWithSession(res.user);
        showToast(`2FA Verified. Welcome to Toriwear Command Center, ${res.user.name}.`);
        return true;
      } else {
        showToast(res.error || 'Invalid 2FA verification code.');
        return false;
      }
    } catch (err: any) {
      showToast(err.message || 'Verification error.');
      return false;
    }
  };

  const logout = () => {
    platformApi.logout();
    logAction('LOGIN_SUCCESS', 'Admin Session', `User ${currentUser?.email || 'admin'} logged out`);
    setCurrentUser(null);
    setTwoFactorRequired(false);
    setPendingTempToken('');
    safeLocalStorageSet('tori_admin_currentUser', null);
    showToast('Logged out securely.');
  };

  // Immediate synchronous persistence helpers to prevent state drops on unmount/navigation
  const persistProductsImmediately = (updatedProducts: AdminProduct[]) => {
    setProducts(updatedProducts);
    safeLocalStorageSet('tori_admin_products', updatedProducts);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tori_admin_products_updated', { detail: updatedProducts }));
    }
  };

  const persistInventoryImmediately = (updatedInventory: InventoryItem[]) => {
    setInventory(updatedInventory);
    safeLocalStorageSet('tori_admin_inventory', updatedInventory);
  };

  // Products CRUD — Authoritative Database-First Operations
  const addProduct = async (productData: Partial<AdminProduct>): Promise<{ success: boolean; message: string; data?: AdminProduct }> => {
    // Publishing safeguard
    if (settings.enforceApprovedLicenseOnly && productData.licenseRightsStatus === 'Not Authorized') {
      return { 
        success: false, 
        message: 'Publishing blocked: Products marked "Not Authorized" cannot be published under Toriwear IP compliance rules.' 
      };
    }

    const cleanName = (productData.name || '').trim();
    if (!cleanName) {
      return { success: false, message: 'Product Name / Title is required.' };
    }
    const cleanPrice = Number(productData.price);
    if (!cleanPrice || cleanPrice <= 0) {
      return { success: false, message: 'Selling price must be greater than ₹0.' };
    }

    const newId = productData.id || `tori-custom-${Date.now()}`;
    const newCatalogNum = productData.catalogNumber || `PR-${Math.floor(1000 + Math.random() * 9000)}`;
    const dept: 'MEN' | 'KIDS' = productData.department || (productData.universe === 'KIDS' ? 'KIDS' : 'MEN');
    const world: string = productData.world || (dept === 'KIDS' ? 'CUTE ADVENTURE' : 'DARK SHONEN');

    const defaultImages = [
      dept === 'KIDS'
        ? 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80',
    ];

    const finalImages = productData.images && productData.images.length > 0 ? productData.images : defaultImages;

    const created: AdminProduct = {
      id: newId,
      catalogNumber: newCatalogNum,
      name: cleanName,
      sku: productData.sku || `TORI-TSHIRT-${newCatalogNum}`,
      department: dept,
      world,
      franchise: productData.franchise || (world as any) || 'Toriwear Originals',
      universe: productData.universe || (dept === 'KIDS' ? 'KIDS' : 'ORIGINALS'),
      category: productData.category || 'Oversized Tees',
      fit: productData.fit || (dept === 'KIDS' ? 'Comfort Fit' : 'Oversized'),
      price: cleanPrice,
      mrp: Number(productData.mrp) || Math.round(cleanPrice * 1.3),
      costPrice: Number(productData.costPrice) || 450,
      discountPercent: productData.discountPercent || 25,
      gstRate: productData.gstRate || 5,
      rating: 5.0,
      reviewsCount: 1,
      images: finalImages,
      description: productData.description || 'Premium heavyweight anime streetwear tee.',
      shortDescription: productData.shortDescription || `${dept === 'KIDS' ? '180' : '240'} GSM drop-shoulder streetwear fit.`,
      storyQuote: productData.storyQuote || 'Wear Your World.',
      drop: productData.drop || 'DROP 002 — SHINOBI',
      gsm: productData.gsm || (dept === 'KIDS' ? 180 : 240),
      fabric: productData.fabric || '100% Combed Heavyweight Cotton',
      neck: productData.neck || 'High-Ribbed Crewneck',
      sleeves: productData.sleeves || 'Drop Shoulder Half Sleeves',
      print: productData.print || 'High-Density Puff & Screen Print',
      tags: productData.tags || ['streetwear', 'anime', 'heavyweight'],
      seoTitle: `${cleanName} | TORIWEAR`,
      seoDescription: 'Shop official heavyweight streetwear from Toriwear.',
      slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      publishingStatus: productData.publishingStatus || 'PUBLISHED',
      licenseRightsStatus: productData.licenseRightsStatus || 'Owned IP',
      variants: productData.variants && productData.variants.length > 0 
        ? productData.variants 
        : [
            { id: `var-${newId}-S`, sku: `TORI-${newCatalogNum}-S`, size: 'S', colorName: 'Obsidian Black', colorHex: '#111115', price: cleanPrice, stock: 20, reserved: 0, barcode: `89000${newCatalogNum}1`, weightGrams: 320 },
            { id: `var-${newId}-M`, sku: `TORI-${newCatalogNum}-M`, size: 'M', colorName: 'Obsidian Black', colorHex: '#111115', price: cleanPrice, stock: 35, reserved: 0, barcode: `89000${newCatalogNum}2`, weightGrams: 340 },
            { id: `var-${newId}-L`, sku: `TORI-${newCatalogNum}-L`, size: 'L', colorName: 'Obsidian Black', colorHex: '#111115', price: cleanPrice, stock: 40, reserved: 0, barcode: `89000${newCatalogNum}3`, weightGrams: 360 },
            { id: `var-${newId}-XL`, sku: `TORI-${newCatalogNum}-XL`, size: 'XL', colorName: 'Obsidian Black', colorHex: '#111115', price: cleanPrice, stock: 25, reserved: 0, barcode: `89000${newCatalogNum}4`, weightGrams: 380 },
          ],
      totalSold: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Await authoritative persistence to backend database FIRST
    try {
      const apiRes = await apiClient.adminCreateProduct(created);
      if (!apiRes || !apiRes.success) {
        const errorMsg = apiRes?.error || 'Database save failed. Product was NOT saved.';
        console.error('[AdminData] Product creation failed on backend:', errorMsg);
        return { success: false, message: errorMsg };
      }
      lastProductMutationTimeRef.current = Date.now();
    } catch (err: any) {
      console.error('[AdminData] Network error saving product to backend:', err);
      return { success: false, message: err.message || 'Database connection error. Product was NOT saved.' };
    }

    // Only after successful database persistence, update local state & fallback cache
    const updatedProducts = [created, ...products.filter(p => p.id !== created.id)];
    persistProductsImmediately(updatedProducts);

    // Also add to inventory items
    const newInvItems: InventoryItem[] = created.variants.map(v => ({
      id: `inv-${v.id}`,
      productId: created.id,
      productName: created.name,
      variantId: v.id,
      sku: v.sku,
      size: v.size,
      colorName: v.colorName,
      availableStock: v.stock,
      reservedStock: 0,
      sold: 0,
      lowStockThreshold: 5,
      criticalThreshold: 2,
      status: v.stock > 5 ? 'IN_STOCK' : 'LOW_STOCK',
      lastUpdated: 'Just now',
    }));
    const updatedInventory = [...newInvItems, ...inventory];
    persistInventoryImmediately(updatedInventory);

    logAction('PRODUCT_CREATED', `Product #${created.catalogNumber} (${created.name})`, `Created with ${created.variants.length} variants at ₹${created.price}`);
    if (created.publishingStatus === 'REVIEW' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tori_approvals_updated', { detail: { productId: created.id } }));
    }
    showToast(
      created.publishingStatus === 'REVIEW'
        ? `Product "${created.name}" submitted for approval workflow.`
        : `Product "${created.name}" created and saved to database!`
    );
    return { success: true, message: 'Product added successfully', data: created };
  };

  const updateProduct = async (id: string, updates: Partial<AdminProduct>): Promise<{ success: boolean; message: string; data?: AdminProduct }> => {
    const existing = products.find(p => p.id === id);
    if (!existing) {
      return { success: false, message: `Product ${id} not found.` };
    }

    // If variants were modified, recalculate total stock, availability, colors, and sizes
    let enrichedUpdates: any = { ...updates };
    if (Array.isArray(updates.variants)) {
      const totalStock = updates.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      enrichedUpdates.stock = totalStock;
      enrichedUpdates.inStock = totalStock > 0;
      const colorMap = new Map<string, { name: string; hex: string }>();
      const sizeSet = new Set<string>();
      for (const v of updates.variants) {
        const cName = (v.colorName || 'Obsidian Black').trim();
        if (cName && !colorMap.has(cName.toLowerCase())) {
          colorMap.set(cName.toLowerCase(), { name: cName, hex: v.colorHex || '#111115' });
        }
        if (v.size) sizeSet.add(v.size);
      }
      if (colorMap.size > 0) enrichedUpdates.colors = Array.from(colorMap.values());
      if (sizeSet.size > 0) enrichedUpdates.sizes = Array.from(sizeSet);
    }

    // Persist to authoritative backend database first
    try {
      const apiRes = await apiClient.adminUpdateProduct(id, enrichedUpdates);
      if (!apiRes || !apiRes.success) {
        const errorMsg = apiRes?.error || 'Failed to update product in database.';
        console.error('[AdminData] Product update failed on backend:', errorMsg);
        return { success: false, message: errorMsg };
      }
      lastProductMutationTimeRef.current = Date.now();
    } catch (err: any) {
      console.error('[AdminData] Network error updating product on backend:', err);
      return { success: false, message: err.message || 'Database connection error while updating product.' };
    }

    const updated = { ...existing, ...enrichedUpdates, updatedAt: new Date().toISOString() };
    const updatedProducts = products.map(p => (p.id === id ? updated : p));
    persistProductsImmediately(updatedProducts);

    // If variants were provided, also keep inventory state in sync (including color/size & new variants)
    if (Array.isArray(updates.variants)) {
      setInventory(prevInv => {
        const seenVariantIds = new Set<string>();
        const nextInv = prevInv.map(item => {
          const matchingVar = updates.variants?.find(v => v.id === item.variantId || v.sku === item.sku);
          if (matchingVar) {
            seenVariantIds.add(matchingVar.id);
            const st = Number(matchingVar.stock ?? item.availableStock);
            let s: InventoryItem['status'] = 'IN_STOCK';
            if (st === 0) s = 'OUT_OF_STOCK';
            else if (st <= item.criticalThreshold) s = 'CRITICAL_STOCK';
            else if (st <= item.lowStockThreshold) s = 'LOW_STOCK';
            return {
              ...item,
              sku: matchingVar.sku || item.sku,
              size: matchingVar.size || item.size,
              colorName: matchingVar.colorName || item.colorName,
              availableStock: st,
              status: s,
              lastUpdated: 'Just now',
            };
          }
          return item;
        });

        const addedInv: InventoryItem[] = (updates.variants || [])
          .filter(v => !seenVariantIds.has(v.id))
          .map(v => ({
            id: `inv-${v.id}`,
            productId: updated.id,
            productName: updated.name,
            variantId: v.id,
            sku: v.sku,
            size: v.size,
            colorName: v.colorName,
            availableStock: Number(v.stock || 0),
            reservedStock: Number(v.reserved || 0),
            sold: 0,
            lowStockThreshold: 5,
            criticalThreshold: 2,
            status: Number(v.stock || 0) === 0 ? 'OUT_OF_STOCK' : Number(v.stock || 0) <= 5 ? 'LOW_STOCK' : 'IN_STOCK',
            lastUpdated: 'Just now',
          }));

        const mergedInv = [...addedInv, ...nextInv];
        persistInventoryImmediately(mergedInv);
        return mergedInv;
      });
    }

    if (updates.price && updates.price !== existing.price) {
      logAction('PRICE_UPDATED', `Product #${existing.catalogNumber} (${existing.name})`, `Price modified from ₹${existing.price} to ₹${updates.price}`, `₹${existing.price}`, `₹${updates.price}`);
    } else {
      logAction('PRODUCT_UPDATED', `Product #${existing.catalogNumber} (${existing.name})`, 'Metadata, pricing or variants modified.');
    }
    if (updated.publishingStatus === 'REVIEW' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tori_approvals_updated', { detail: { productId: updated.id } }));
    }
    showToast(
      updated.publishingStatus === 'REVIEW'
        ? `Product "${existing.name}" sent to Approval Workflow.`
        : `Product "${existing.name}" updated successfully.`
    );
    return { success: true, message: 'Product updated successfully', data: updated };
  };

  const archiveProduct = async (id: string): Promise<{ success: boolean; message: string }> => {
    const target = products.find(p => p.id === id);
    if (!target) return { success: false, message: 'Product not found.' };

    try {
      const apiRes = await apiClient.adminArchiveProduct(id);
      if (!apiRes || !apiRes.success) {
        const errorMsg = apiRes?.error || 'Failed to archive product on backend.';
        showToast(`Error: ${errorMsg}`);
        return { success: false, message: errorMsg };
      }
      lastProductMutationTimeRef.current = Date.now();
    } catch (err: any) {
      console.error('[AdminData] Network error archiving product:', err);
      showToast('Database error archiving product.');
      return { success: false, message: err.message || 'Database error archiving product.' };
    }

    const updatedProducts = products.map(p => p.id === id ? { ...p, publishingStatus: 'ARCHIVED' as const } : p);
    persistProductsImmediately(updatedProducts);
    logAction('PRODUCT_ARCHIVED', `Product #${target.catalogNumber} (${target.name})`, 'Archived and hidden from customer storefront.');
    showToast(`Product "${target.name}" archived.`);
    return { success: true, message: 'Product archived successfully' };
  };

  const deleteProduct = async (id: string): Promise<{ success: boolean; message: string }> => {
    const target = products.find(p => p.id === id);
    const targetName = target ? target.name : id;
    const targetCatalog = target ? target.catalogNumber : id;

    try {
      const apiRes = await apiClient.adminDeleteProduct(id);
      if (!apiRes || !apiRes.success) {
        console.warn('[AdminData] Product delete API returned warning:', apiRes?.error);
      }
      lastProductMutationTimeRef.current = Date.now();
    } catch (err: any) {
      console.warn('[AdminData] Network error deleting product on backend:', err);
    }

    // Atomically update products state
    setProducts(prev => {
      const next = prev.filter(p => p.id !== id);
      safeLocalStorageSet('tori_admin_products', next);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tori_admin_products_updated', { detail: next }));
      }
      return next;
    });

    // Atomically remove linked inventory records
    setInventory(prev => {
      const next = prev.filter(item => item.productId !== id);
      safeLocalStorageSet('tori_admin_inventory', next);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tori_admin_inventory_updated', { detail: next }));
      }
      return next;
    });

    logAction('PRODUCT_DELETED', `Product #${targetCatalog} (${targetName})`, 'Permanently deleted from product catalogue and database.');
    showToast(`Product "${targetName}" permanently deleted.`);
    return { success: true, message: 'Product deleted successfully' };
  };

  const duplicateProduct = (id: string) => {
    const target = products.find(p => p.id === id);
    if (!target) return;
    const duplicated: AdminProduct = {
      ...target,
      id: `tori-dup-${Date.now()}`,
      catalogNumber: String(products.length + 1).padStart(2, '0'),
      name: `${target.name} (Copy)`,
      sku: `${target.sku}-COPY`,
      publishingStatus: 'DRAFT',
      totalSold: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Persist duplicated product to backend asynchronously
    apiClient.adminCreateProduct(duplicated).then(() => {
      lastProductMutationTimeRef.current = Date.now();
      const updatedProducts = [duplicated, ...products];
      persistProductsImmediately(updatedProducts);
      logAction('PRODUCT_CREATED', `Product #${duplicated.catalogNumber} (${duplicated.name})`, `Duplicated from ${target.name}`);
      showToast(`Duplicated "${target.name}" as a draft.`);
    }).catch(err => {
      console.warn('[AdminData] Error duplicating product on backend:', err);
      showToast('Failed to duplicate product on database.');
    });
  };

  const bulkUpdateProducts = async (ids: string[], action: 'PUBLISH' | 'ARCHIVE' | 'DELETE' | 'DISCOUNT', val?: any): Promise<void> => {
    lastProductMutationTimeRef.current = Date.now();

    if (action === 'PUBLISH') {
      let publishedCount = 0;
      let blockedCount = 0;
      const updatedProducts = products.map(p => {
        if (ids.includes(p.id)) {
          const hasValidImage = p.images && p.images.some(img => isValidProductImageUrl(img));
          if (hasValidImage) {
            publishedCount++;
            return { ...p, publishingStatus: 'PUBLISHED' as const };
          } else {
            blockedCount++;
            return p;
          }
        }
        return p;
      });
      persistProductsImmediately(updatedProducts);
      // Persist to backend
      for (const id of ids) {
        const prod = updatedProducts.find(p => p.id === id);
        if (prod && prod.publishingStatus === 'PUBLISHED') {
          apiClient.adminUpdateProduct(id, { publishingStatus: 'PUBLISHED' }).catch(() => {});
        }
      }
      if (blockedCount > 0) {
        showToast(`${publishedCount} published. ${blockedCount} blocked (missing valid product image).`);
      } else {
        showToast(`${publishedCount} products published to live storefront.`);
      }
    } else if (action === 'ARCHIVE') {
      const updatedProducts = products.map(p => ids.includes(p.id) ? { ...p, publishingStatus: 'ARCHIVED' as const } : p);
      persistProductsImmediately(updatedProducts);
      ids.forEach(id => {
        apiClient.adminArchiveProduct(id).catch(() => {});
      });
      showToast(`${ids.length} products archived.`);
    } else if (action === 'DELETE') {
      const updatedProducts = products.filter(p => !ids.includes(p.id));
      persistProductsImmediately(updatedProducts);
      setInventory(prev => {
        const next = prev.filter(item => !ids.includes(item.productId));
        persistInventoryImmediately(next);
        return next;
      });
      showToast(`${ids.length} products deleted.`);
      await Promise.all(
        ids.map(id => 
          apiClient.adminDeleteProduct(id).catch(err => console.warn('[AdminData] Async sync product bulk delete to API:', err))
        )
      );
    } else if (action === 'DISCOUNT' && typeof val === 'number') {
      const updatedProducts = products.map(p => {
        if (ids.includes(p.id)) {
          const newPrice = Math.round(p.mrp * (1 - val / 100));
          return { ...p, price: newPrice, discountPercent: val };
        }
        return p;
      });
      persistProductsImmediately(updatedProducts);
      ids.forEach(id => {
        const p = updatedProducts.find(prod => prod.id === id);
        if (p) {
          apiClient.adminUpdateProduct(id, { price: p.price, discountPercent: p.discountPercent }).catch(() => {});
        }
      });
      showToast(`Applied ${val}% discount to ${ids.length} products.`);
    }
    logAction('PRODUCT_UPDATED', `Bulk Operation on ${ids.length} Products`, `Action executed: ${action}`);
  };

  // Inventory Stock Adjustment
  const updateStock = (variantId: string, newStock: number, reason: string) => {
    const invItem = inventory.find(i => i.variantId === variantId || i.sku === variantId);
    if (!invItem) return;

    const oldStock = invItem.availableStock;
    const diff = newStock - oldStock;

    let newStatus: InventoryItem['status'] = 'IN_STOCK';
    if (newStock === 0) newStatus = 'OUT_OF_STOCK';
    else if (newStock <= invItem.criticalThreshold) newStatus = 'CRITICAL_STOCK';
    else if (newStock <= invItem.lowStockThreshold) newStatus = 'LOW_STOCK';

    const nextInv = inventory.map(i => {
      if (i.variantId === variantId || i.sku === variantId) {
        return {
          ...i,
          availableStock: newStock,
          status: newStatus,
          lastUpdated: 'Just now',
        };
      }
      return i;
    });
    persistInventoryImmediately(nextInv);

    // Synchronize product variant stock and total stock in products list
    const targetProduct = products.find(p => p.id === invItem.productId || p.variants?.some(v => v.id === variantId || v.sku === invItem.sku));
    if (targetProduct) {
      const updatedVariants = (targetProduct.variants || []).map(v => 
        (v.id === variantId || v.sku === invItem.sku) ? { ...v, stock: Math.max(0, newStock) } : v
      );
      const totalStock = updatedVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      const updatedProd: AdminProduct = {
        ...targetProduct,
        variants: updatedVariants,
        stock: totalStock as any,
        inStock: (totalStock > 0) as any,
        updatedAt: new Date().toISOString(),
      };
      const updatedProducts = products.map(p => p.id === targetProduct.id ? updatedProd : p);
      persistProductsImmediately(updatedProducts);

      apiClient.adminUpdateProduct(targetProduct.id, {
        variants: updatedVariants,
        stock: totalStock,
        inStock: totalStock > 0,
      }).catch((err) => console.warn('[AdminData] Async sync product stock update to API:', err));
    }

    // Record movement
    const movement: InventoryMovement = {
      id: `mov-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST (Today)',
      productId: invItem.productId,
      productName: invItem.productName,
      sku: invItem.sku,
      type: diff >= 0 ? 'INCREASE' : 'DECREASE',
      amount: diff,
      previousStock: oldStock,
      newStock: newStock,
      reason: reason || 'Manual stock reconciliation in Admin',
      adminName: currentUser?.name || 'Saif (Owner)',
    };
    setInventoryMovements(prev => [movement, ...prev]);

    logAction('STOCK_MODIFIED', `SKU #${invItem.sku} (${invItem.productName})`, `Stock adjusted from ${oldStock} to ${newStock}. Reason: ${reason}`, `${oldStock} units`, `${newStock} units`);
    showToast(`Stock for ${invItem.sku} updated to ${newStock} units.`);
    apiClient.updateStock(variantId, newStock, reason).catch((err) => console.warn('[AdminData] Async sync stock update to API:', err));
  };

  // Inventory SKU Deletion (Functional & Atomic)
  const deleteInventoryItem = (variantId: string, reason?: string) => {
    let deletedItem: InventoryItem | undefined;

    setInventory(prev => {
      const target = prev.find(i => i.variantId === variantId || i.sku === variantId || i.id === variantId);
      if (!target) return prev;
      deletedItem = target;
      const next = prev.filter(i => i.variantId !== variantId && i.sku !== variantId && i.id !== variantId);
      safeLocalStorageSet('tori_admin_inventory', next);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tori_admin_inventory_updated', { detail: next }));
      }
      return next;
    });

    if (deletedItem) {
      const invItem = deletedItem;
      // Record movement audit
      const movement: InventoryMovement = {
        id: `mov-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST (Today)',
        productId: invItem.productId,
        productName: invItem.productName,
        sku: invItem.sku,
        type: 'MANUAL_CORRECTION',
        amount: -invItem.availableStock,
        previousStock: invItem.availableStock,
        newStock: 0,
        reason: reason || 'Inventory record removed in Admin',
        adminName: currentUser?.name || 'Saif (Owner)',
      };
      setInventoryMovements(prev => [movement, ...prev]);

      // Remove variant from products and update stock
      setProducts(prevProducts => {
        const nextProducts = prevProducts.map(p => {
          if (p.id === invItem.productId || p.variants?.some(v => v.id === invItem.variantId || v.sku === invItem.sku)) {
            const nextVariants = (p.variants || []).filter(v => v.id !== invItem.variantId && v.sku !== invItem.sku);
            const totalStock = nextVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
            return {
              ...p,
              variants: nextVariants,
              stock: totalStock as any,
              inStock: (totalStock > 0) as any,
              updatedAt: new Date().toISOString(),
            };
          }
          return p;
        });
        safeLocalStorageSet('tori_admin_products', nextProducts);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tori_admin_products_updated', { detail: nextProducts }));
        }
        return nextProducts;
      });

      logAction(
        'STOCK_MODIFIED',
        `Deleted SKU #${invItem.sku} (${invItem.productName})`,
        `Inventory record removed. Reason: ${reason || 'Manual SKU deletion'}. Previous stock: ${invItem.availableStock}`,
        `${invItem.availableStock} units`,
        '0 units (Deleted)'
      );

      showToast(`Inventory SKU ${invItem.sku} (${invItem.size}) deleted.`);
      apiClient.deleteInventoryItem(invItem.variantId || invItem.sku, reason).catch((err) =>
        console.warn('[AdminData] Async sync delete inventory to API:', err)
      );
    }
  };

  // Bulk Inventory & Product Deletion (Backend-Authoritative Atomic Multi-Variant Delete)
  const bulkDeleteInventoryItems = async (
    targetIds: string[], 
    reason: string = 'Bulk product removal / Warehouse clearance'
  ): Promise<{ success: boolean; deletedCount: number; message: string }> => {
    const cleanTargetIds = Array.from(
      new Set(
        (targetIds || [])
          .filter(id => Boolean(id) && typeof id === 'string')
          .map(id => id.trim())
          .filter(id => id.length > 0 && id !== 'unlinked')
      )
    );
    if (cleanTargetIds.length === 0) {
      return { success: false, deletedCount: 0, message: 'No valid items selected.' };
    }

    lastProductMutationTimeRef.current = Date.now();

    // 1. Execute atomic bulk deletion on backend FIRST so UI never reports false success
    const apiRes = await apiClient.bulkDeleteInventory(cleanTargetIds, reason);
    if (!apiRes || !apiRes.success) {
      const errorMsg = apiRes?.error || 'Backend failed to delete selected inventory products.';
      showToast(errorMsg);
      return { success: false, deletedCount: 0, message: errorMsg };
    }

    const serverRemovedProdIds = new Set(apiRes.removedProductIds || []);
    const serverDeletedVariantIds = new Set(apiRes.deletedVariantIds || []);
    const serverDeletedSkus = new Set(apiRes.deletedSkus || []);
    const targetSet = new Set([
      ...cleanTargetIds,
      ...(apiRes.deletedVariantIds || []),
      ...(apiRes.deletedSkus || []),
      ...(apiRes.removedProductIds || []),
    ]);

    const itemsToDelete = inventory.filter(i =>
      (i.id && targetSet.has(i.id)) ||
      (i.variantId && (targetSet.has(i.variantId) || serverDeletedVariantIds.has(i.variantId))) ||
      (i.sku && (targetSet.has(i.sku) || serverDeletedSkus.has(i.sku))) ||
      (i.productId && i.productId !== 'unlinked' && (targetSet.has(i.productId) || serverRemovedProdIds.has(i.productId)))
    );

    const affectedProductIds = Array.from(
      new Set(itemsToDelete.map(i => i.productId).filter(pid => pid && pid !== 'unlinked'))
    );

    // 2. Reconcile local products state & cache
    const fullyRemovedProductIds: string[] = [];
    const nextProducts: AdminProduct[] = [];

    for (const prod of products) {
      if (targetSet.has(prod.id) || serverRemovedProdIds.has(prod.id)) {
        fullyRemovedProductIds.push(prod.id);
        continue;
      }

      const prodVariants = prod.variants || [];
      const remainingVariants = prodVariants.filter(v =>
        !targetSet.has(v.id) &&
        !targetSet.has(`inv-${v.id}`) &&
        (!v.id || !serverDeletedVariantIds.has(v.id)) &&
        (!v.sku || !serverDeletedSkus.has(v.sku))
      );

      if (remainingVariants.length !== prodVariants.length) {
        if (remainingVariants.length === 0) {
          fullyRemovedProductIds.push(prod.id);
        } else {
          const totalStock = remainingVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
          nextProducts.push({
            ...prod,
            variants: remainingVariants,
            stock: totalStock as any,
            inStock: (totalStock > 0) as any,
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        nextProducts.push(prod);
      }
    }

    persistProductsImmediately(nextProducts);

    // 3. Reconcile local inventory state & cache
    const removedProdSet = new Set([...fullyRemovedProductIds, ...(apiRes.removedProductIds || [])]);
    const nextInv = inventory.filter(i => {
      if (i.id && targetSet.has(i.id)) return false;
      if (i.variantId && (targetSet.has(i.variantId) || serverDeletedVariantIds.has(i.variantId))) return false;
      if (i.sku && (targetSet.has(i.sku) || serverDeletedSkus.has(i.sku))) return false;
      if (i.productId && i.productId !== 'unlinked' && (targetSet.has(i.productId) || removedProdSet.has(i.productId))) return false;
      return true;
    });
    persistInventoryImmediately(nextInv);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tori_admin_inventory_updated', { detail: nextInv }));
    }

    // 4. Record audit trail & movements
    const timestamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST (Today)';
    const newMovements: InventoryMovement[] = itemsToDelete.map(item => ({
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      type: 'MANUAL_CORRECTION',
      amount: -item.availableStock,
      previousStock: item.availableStock,
      newStock: 0,
      reason,
      adminName: currentUser?.name || 'Saif (Owner)',
    }));

    if (newMovements.length > 0) {
      setInventoryMovements(prev => [...newMovements, ...prev].slice(0, 500));
    }

    const deletedCount = Math.max(itemsToDelete.length, apiRes.deletedCount || 0);
    logAction(
      'STOCK_MODIFIED',
      `Bulk deleted ${deletedCount} SKU entries across ${Math.max(affectedProductIds.length, removedProdSet.size)} products`,
      `Reason: ${reason}. Removed: ${Array.from(serverDeletedSkus).slice(0, 5).join(', ')}${serverDeletedSkus.size > 5 ? '...' : ''}`
    );

    const msg = apiRes.message || `Permanently deleted ${deletedCount} inventory records and ${removedProdSet.size} products.`;
    showToast(msg);
    return {
      success: true,
      deletedCount,
      message: msg,
    };
  };

  // Wipe All Products & Inventory (Backend-Authoritative Clean Slate)
  const clearAllProductsAndInventory = async (): Promise<{ success: boolean; message: string }> => {
    lastProductMutationTimeRef.current = Date.now();

    const apiRes = await apiClient.adminClearAllProducts();
    if (!apiRes || !apiRes.success) {
      const errorMsg = apiRes?.error || 'Failed to clear all products and inventory on server.';
      showToast(errorMsg);
      return { success: false, message: errorMsg };
    }

    persistProductsImmediately([]);
    persistInventoryImmediately([]);
    setInventoryMovements([]);
    safeLocalStorageSet('tori_admin_products', []);
    safeLocalStorageSet('tori_admin_inventory', []);
    safeLocalStorageSet('tori_admin_inv_movements', []);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tori_admin_inventory_updated', { detail: [] }));
    }

    logAction('STOCK_MODIFIED', 'All Products & Inventory', 'Permanently cleared all products and warehouse inventory records.');
    showToast('All products and warehouse inventory records have been permanently cleared.');
    return { success: true, message: 'All products and inventory cleared.' };
  };

  // Backfill missing product catalog variants into warehouse inventory
  const syncInventoryFromCatalog = async (): Promise<{ success: boolean; addedCount?: number; message: string }> => {
    const apiRes = await apiClient.syncInventoryFromCatalog();
    if (!apiRes || !apiRes.success) {
      const errorMsg = apiRes?.error || 'Failed to sync inventory from catalog.';
      showToast(errorMsg);
      return { success: false, message: errorMsg };
    }

    if (Array.isArray(apiRes.data)) {
      const variantLookup = new Map<string, { prod: AdminProduct; variant: any }>();
      for (const mp of products) {
        for (const mv of mp.variants || []) {
          variantLookup.set(mv.id, { prod: mp, variant: mv });
          if (mv.sku) variantLookup.set(mv.sku, { prod: mp, variant: mv });
        }
      }

      const mappedInv: InventoryItem[] = apiRes.data.map((ri: any) => {
        const found = variantLookup.get(ri.variantId) || variantLookup.get(ri.sku);
        const available = Number(ri.quantityAvailable ?? ri.quantityOnHand ?? 0);
        const threshold = Number(ri.threshold ?? 5);
        let status: InventoryItem['status'] = 'IN_STOCK';
        if (available === 0) status = 'OUT_OF_STOCK';
        else if (available <= 2) status = 'CRITICAL_STOCK';
        else if (available <= threshold) status = 'LOW_STOCK';

        return {
          id: ri.id || `inv-${ri.variantId}`,
          productId: found?.prod?.id || 'unlinked',
          productName: found?.prod?.name || ri.sku || 'Variant SKU',
          variantId: ri.variantId,
          sku: ri.sku || found?.variant?.sku || ri.variantId,
          size: found?.variant?.size || 'M',
          colorName: found?.variant?.colorName || 'Obsidian Black',
          availableStock: available,
          reservedStock: Number(ri.quantityReserved ?? 0),
          sold: 0,
          lowStockThreshold: threshold,
          criticalThreshold: 2,
          status,
          lastUpdated: ri.updatedAt ? new Date(ri.updatedAt).toLocaleString('en-IN') : 'Synced',
        };
      });

      persistInventoryImmediately(mappedInv);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tori_admin_inventory_updated', { detail: mappedInv }));
      }
    }

    const msg = apiRes.message || `Synced ${apiRes.addedCount || 0} catalog variants into warehouse inventory.`;
    showToast(msg);
    return { success: true, addedCount: apiRes.addedCount, message: msg };
  };

  // Orders Workflow
  const updateOrderStatus = (orderId: string, status: OrderShippingStatus, note?: string) => {
    const target = orders.find(o => o.orderId === orderId);
    if (!target) return;

    const oldStatus = target.shippingStatus;
    const newTimelineEntry = {
      title: `Status changed to ${status}`,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST (Today)',
      note: note || `Updated by ${currentUser?.name || 'Admin'}`,
    };

    setOrders(prev => prev.map(o => {
      if (o.orderId === orderId) {
        return {
          ...o,
          shippingStatus: status,
          timeline: [newTimelineEntry, ...o.timeline],
        };
      }
      return o;
    }));

    logAction('ORDER_STATUS_CHANGED', `Order #${target.orderNumber}`, `Changed status from ${oldStatus} to ${status}. Note: ${note || 'None'}`, oldStatus, status);
    showToast(`Order #${target.orderNumber} is now marked ${status}.`);
    apiClient.updateAdminOrderStatus(orderId, status, note).catch((err) => console.warn('[AdminData] Async sync order status to API:', err));
  };

  const addOrderInternalNote = (orderId: string, noteText: string) => {
    const newNote = {
      id: `note-${Date.now()}`,
      text: noteText,
      author: currentUser?.name || 'Saif (Owner)',
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST',
    };

    setOrders(prev => prev.map(o => {
      if (o.orderId === orderId) {
        return { ...o, internalNotes: [newNote, ...o.internalNotes] };
      }
      return o;
    }));
    showToast('Internal note saved.');
  };

  const cancelOrder = (orderId: string, reason: string) => {
    const target = orders.find(o => o.orderId === orderId);
    if (!target) return;

    setOrders(prev => prev.map(o => {
      if (o.orderId === orderId) {
        return {
          ...o,
          shippingStatus: 'CANCELLED',
          paymentStatus: o.paymentMethod === 'COD' ? 'FAILED' : 'REFUNDED',
          timeline: [
            { title: 'Order Cancelled by Admin', timestamp: 'Today', note: `Reason: ${reason}` },
            ...o.timeline,
          ],
        };
      }
      return o;
    }));

    logAction('ORDER_CANCELLED', `Order #${target.orderNumber}`, `Cancelled by ${currentUser?.name}. Reason: ${reason}`);
    showToast(`Order #${target.orderNumber} cancelled.`);
    apiClient.cancelAdminOrder(orderId, reason).catch((err) => console.warn('[AdminData] Async sync cancel order to API:', err));
  };

  const initiateRefund = (orderId: string, amount: number, reason: string) => {
    const target = orders.find(o => o.orderId === orderId);
    if (!target) return;

    // Add payment transaction record
    const refundTx: PaymentTransaction = {
      id: `tx-ref-${Date.now()}`,
      orderId: target.orderId,
      orderNumber: target.orderNumber,
      customerName: target.customerName,
      customerEmail: target.customerEmail,
      amount: amount,
      method: target.paymentMethod,
      gateway: 'Razorpay',
      gatewayRefId: `pay_REF_${Date.now()}`,
      status: 'REFUNDED',
      date: new Date().toLocaleDateString('en-IN') + ' IST',
      refundStatus: 'COMPLETED',
      refundAmount: amount,
      fee: 0,
      netSettlement: 0,
    };

    setPayments(prev => [refundTx, ...prev]);

    setOrders(prev => prev.map(o => {
      if (o.orderId === orderId) {
        return {
          ...o,
          paymentStatus: 'REFUNDED',
          timeline: [
            { title: `Refund of ₹${amount} Initiated`, timestamp: 'Today', note: `Reason: ${reason}` },
            ...o.timeline,
          ],
        };
      }
      return o;
    }));

    logAction('REFUND_INITIATED', `Order #${target.orderNumber}`, `Refund of ₹${amount} processed. Reason: ${reason}`);
    showToast(`Refund of ₹${amount} initiated for Order #${target.orderNumber}.`);
    apiClient.refundAdminOrder(orderId, amount, reason).catch((err) => console.warn('[AdminData] Async sync refund order to API:', err));
  };

  // Coupons (Server Authoritative)
  const addCoupon = async (couponData: Omit<Coupon, 'id' | 'usageCount'>) => {
    const token = getSessionToken();
    try {
      const res = await fetch('/api/v1/admin/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...couponData,
          minOrderValue: couponData.minCartValue ?? couponData.minOrderValue ?? 0,
          perUserLimit: couponData.perCustomerLimit ?? 1,
          expiryDate: couponData.endDate || couponData.expiryDate,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const c = json.data;
        const newCoupon: Coupon = {
          id: c.id,
          code: c.code,
          discountType: c.discountType === 'PERCENTAGE' ? 'PERCENTAGE' : (c.discountType === 'FREE_SHIPPING' ? 'FREE_SHIPPING' : 'FIXED'),
          value: Number(c.value),
          minCartValue: Number(c.minOrderValue || c.minCartValue || 0),
          minOrderValue: Number(c.minOrderValue || 0),
          maxDiscount: c.maxDiscount != null ? Number(c.maxDiscount) : undefined,
          usageLimit: Number(c.usageLimit || 1000),
          usageCount: Number(c.usageCount || 0),
          perCustomerLimit: Number(c.perUserLimit || c.perCustomerLimit || 1),
          applicableFranchises: Array.isArray(c.applicableFranchises) ? c.applicableFranchises : ['ALL'],
          eligibleCategories: Array.isArray(c.eligibleCategories) ? c.eligibleCategories : [],
          eligibleProductIds: Array.isArray(c.eligibleProductIds) ? c.eligibleProductIds : [],
          excludeShipping: c.excludeShipping !== false,
          excludeTax: c.excludeTax !== false,
          startDate: c.startDate ? (new Date(c.startDate).toISOString().split('T')[0] || '2026-01-01') : '2026-01-01',
          endDate: c.expiryDate ? (new Date(c.expiryDate).toISOString().split('T')[0] || '2026-12-31') : (c.endDate || '2026-12-31'),
          isActive: c.isActive !== false,
          description: c.description || '',
        };
        setCoupons(prev => [newCoupon, ...prev.filter(item => item.id !== newCoupon.id)]);
        logAction('COUPON_CREATED', `Coupon Code ${newCoupon.code}`, `Created with ${newCoupon.value}${newCoupon.discountType === 'PERCENTAGE' ? '%' : '₹'} discount`);
        showToast(`Coupon "${newCoupon.code}" created and saved to database.`);
        return;
      } else {
        showToast(json.error || 'Failed to create coupon on server.');
      }
    } catch (err: any) {
      console.warn('[AdminData] Error saving coupon to server:', err);
      showToast('Error communicating with backend.');
    }
  };

  const updateCoupon = async (id: string, updates: Partial<Coupon>): Promise<boolean> => {
    const token = getSessionToken();
    try {
      const payload: Record<string, any> = { ...updates };
      if (updates.minCartValue !== undefined) payload.minOrderValue = Number(updates.minCartValue);
      if (updates.perCustomerLimit !== undefined) payload.perUserLimit = Number(updates.perCustomerLimit);
      if (updates.endDate !== undefined) payload.expiryDate = updates.endDate;
      if (updates.discountType === 'FIXED') payload.discountType = 'FLAT';

      const res = await fetch(`/api/v1/admin/coupons/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const c = json.data;
        const updatedCoupon: Coupon = {
          id: c.id,
          code: c.code,
          discountType: c.discountType === 'PERCENTAGE' ? 'PERCENTAGE' : (c.discountType === 'FREE_SHIPPING' ? 'FREE_SHIPPING' : 'FIXED'),
          value: Number(c.value),
          minCartValue: Number(c.minOrderValue || 0),
          minOrderValue: Number(c.minOrderValue || 0),
          maxDiscount: c.maxDiscount != null ? Number(c.maxDiscount) : undefined,
          usageLimit: Number(c.usageLimit || 1000),
          usageCount: Number(c.usageCount || 0),
          perCustomerLimit: Number(c.perUserLimit || 1),
          applicableFranchises: ['ALL'],
          eligibleCategories: Array.isArray(c.eligibleCategories) ? c.eligibleCategories : [],
          eligibleProductIds: Array.isArray(c.eligibleProductIds) ? c.eligibleProductIds : [],
          excludeShipping: c.excludeShipping !== false,
          excludeTax: c.excludeTax !== false,
          startDate: c.startDate ? (new Date(c.startDate).toISOString().split('T')[0] || '2026-01-01') : '2026-01-01',
          endDate: c.expiryDate ? (new Date(c.expiryDate).toISOString().split('T')[0] || '2026-12-31') : '2026-12-31',
          isActive: c.isActive !== false,
          description: c.description || '',
        };
        setCoupons(prev => prev.map(item => item.id === id ? updatedCoupon : item));
        logAction('COUPON_CREATED', `Coupon Code ${updatedCoupon.code}`, `Updated coupon settings (active=${updatedCoupon.isActive}, value=${updatedCoupon.value})`);
        showToast(`Coupon "${updatedCoupon.code}" updated.`);
        return true;
      }
      showToast(json.error || 'Failed to update coupon on server.');
      return false;
    } catch (err: any) {
      console.warn('[AdminData] Error updating coupon:', err);
      showToast('Error communicating with backend.');
      return false;
    }
  };

  const toggleCoupon = async (id: string) => {
    const token = getSessionToken();
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c));
    showToast('Coupon status updated.');
    try {
      await fetch(`/api/v1/admin/coupons/${encodeURIComponent(id)}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch (err) {
      console.warn('[AdminData] Error toggling coupon on backend:', err);
    }
  };

  const deleteCoupon = async (id: string) => {
    const token = getSessionToken();
    setCoupons(prev => prev.filter(c => c.id !== id));
    showToast('Coupon deleted.');
    try {
      await fetch(`/api/v1/admin/coupons/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch (err) {
      console.warn('[AdminData] Error deleting coupon on backend:', err);
    }
  };

  // Ads
  const addAdvertisement = (adData: Omit<Advertisement, 'id' | 'clicks' | 'impressions'>) => {
    const newAd: Advertisement = {
      ...adData,
      id: `ad-${Date.now()}`,
      clicks: 0,
      impressions: 0,
    };
    setAds(prev => [newAd, ...prev]);
    showToast(`Ad "${newAd.name}" created.`);
  };

  const updateAdvertisement = (id: string, updates: Partial<Advertisement>) => {
    setAds(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    showToast('Advertisement campaign updated.');
  };

  const deleteAdvertisement = (id: string) => {
    setAds(prev => prev.filter(a => a.id !== id));
    showToast('Advertisement removed.');
  };

  // CMS (Server Authoritative)
  const syncCmsStateLocally = (sections?: WebsiteSection[], hero?: HeroSettings) => {
    if (Array.isArray(sections)) {
      setWebsiteSections(sections);
      safeLocalStorageSet('tori_admin_websiteSections', sections);
    }
    if (hero) {
      setHeroSettings(hero);
      safeLocalStorageSet('tori_admin_heroSettings', hero);
    }
  };

  const saveWebsiteSections = async (sections: WebsiteSection[]): Promise<boolean> => {
    setWebsiteSections(sections);
    try {
      const rawCms = localStorage.getItem('tori_admin_frontpage_cms');
      if (rawCms) {
        const parsed = JSON.parse(rawCms);
        const nextCms = { ...parsed, sections };
        safeLocalStorageSet('tori_admin_frontpage_cms', nextCms);
        window.dispatchEvent(new CustomEvent('tori-cms-updated', { detail: nextCms }));
      } else {
        window.dispatchEvent(new Event('tori-cms-updated'));
      }
      safeLocalStorageSet('tori_admin_websiteSections', sections);
    } catch {}

    const token = getSessionToken();
    try {
      const res = await fetch('/api/v1/admin/cms/sections', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {}),
        },
        body: JSON.stringify({ sections }),
      });
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('tori-admin-session-expired'));
        return false;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        showToast(json.error || `Failed to save sections (${res.status})`);
        return false;
      }
      logAction('SETTINGS_SAVED', 'Homepage CMS Sections', 'Updated section order and visibility flags.');
      showToast('Homepage section architecture updated.');
      return true;
    } catch (err: any) {
      showToast(err?.message || 'Network error while saving sections.');
      return false;
    }
  };

  const saveHeroSettings = async (hero: HeroSettings): Promise<boolean> => {
    setHeroSettings(hero);
    try {
      const rawCms = localStorage.getItem('tori_admin_frontpage_cms');
      if (rawCms) {
        const parsed = JSON.parse(rawCms);
        const nextCms = { ...parsed, hero };
        safeLocalStorageSet('tori_admin_frontpage_cms', nextCms);
        window.dispatchEvent(new CustomEvent('tori-cms-updated', { detail: nextCms }));
      } else {
        window.dispatchEvent(new Event('tori-cms-updated'));
      }
      safeLocalStorageSet('tori_admin_heroSettings', hero);
      window.dispatchEvent(new CustomEvent('tori_hero_updated', { detail: hero }));
    } catch (e) {
      console.error(e);
    }

    const token = getSessionToken();
    try {
      const res = await fetch('/api/v1/admin/cms/hero', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {}),
        },
        body: JSON.stringify(hero),
      });
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('tori-admin-session-expired'));
        return false;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        showToast(json.error || `Failed to save hero settings (${res.status})`);
        return false;
      }
      logAction('SETTINGS_SAVED', 'Hero Parallax Banner', `Updated headline to "${hero.headline}"`);
      showToast('Hero section settings saved.');
      return true;
    } catch (err: any) {
      showToast(err?.message || 'Network error while saving hero settings.');
      return false;
    }
  };

  // Returns
  const processReturnRequest = (id: string, newStatus: ReturnRequest['status'], note?: string) => {
    setReturnRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus, notes: note || r.notes } : r));
    showToast(`Return request updated to ${newStatus}.`);
  };

  // Security Sessions
  const revokeSession = (id: string) => {
    setSecuritySessions(prev => prev.filter(s => s.id !== id));
    logAction('SESSION_REVOKED', `Session #${id}`, 'Session remotely terminated by administrator.');
    showToast('Session revoked successfully.');
  };

  const revokeAllOtherSessions = () => {
    setSecuritySessions(prev => prev.filter(s => s.isCurrent));
    logAction('SESSION_REVOKED', 'All Remote Sessions', 'Terminated all sessions except current active device.');
    showToast('All other sessions terminated.');
  };

  // Staff
  const addStaffMember = (user: Omit<AdminUser, 'id' | 'lastLogin'>) => {
    const newStaff: AdminUser = {
      avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
      department: 'Operations',
      ...user,
      id: `user-${Date.now()}`,
      lastLogin: 'Never (Invited)',
    };
    setStaff(prev => [...prev, newStaff]);
    logAction('STAFF_ADDED', `User ${newStaff.email}`, `Assigned role ${newStaff.role}`);
    showToast(`Invited ${newStaff.name} as ${newStaff.role}.`);
  };

  const updateStaffRole = (userId: string, newRole: Role) => {
    setStaff(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    logAction('PERMISSION_CHANGED', `User ID #${userId}`, `Role updated to ${newRole}`);
    showToast('Staff role updated.');
  };

  const toggleStaffStatus = (userId: string) => {
    setStaff(prev => prev.map(u => u.id === userId ? { ...u, isActive: !u.isActive } : u));
    showToast('Staff access status toggled.');
  };

  // Settings (Server Authoritative)
  const updateSettings = async (newSettings: Partial<StoreSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      try {
        safeLocalStorageSet('tori_admin_settings', updated);
        window.dispatchEvent(new CustomEvent('tori_settings_updated', { detail: updated }));
      } catch {}
      return updated;
    });

    const token = getSessionToken();
    try {
      const res = await fetch('/api/v1/admin/cms/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {}),
        },
        body: JSON.stringify(newSettings),
      });
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('tori-admin-session-expired'));
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        showToast(json.error || `Failed to save settings (${res.status})`);
        return;
      }
      logAction('SETTINGS_SAVED', 'Store Configuration', 'Updated GST, shipping or business details.');
      showToast('Store settings saved.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to persist store settings to backend.');
    }
  };

  const toggleMaintenanceMode = async () => {
    const nextState = !settings.maintenanceMode;
    setSettings(prev => {
      const updated = { ...prev, maintenanceMode: nextState };
      try {
        safeLocalStorageSet('tori_admin_settings', updated);
        window.dispatchEvent(new CustomEvent('tori_settings_updated', { detail: updated }));
      } catch {}
      return updated;
    });

    const token = getSessionToken();
    try {
      const res = await fetch('/api/v1/admin/cms/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {}),
        },
        body: JSON.stringify({ maintenanceMode: nextState }),
      });
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('tori-admin-session-expired'));
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        showToast(json.error || `Failed to persist maintenance mode (${res.status})`);
        return;
      }
      logAction('MAINTENANCE_TOGGLED', 'Storefront System', `Maintenance mode ${nextState ? 'ACTIVATED' : 'DEACTIVATED'}`);
      showToast(`Maintenance mode is now ${nextState ? 'ACTIVE ("Dropping Soon")' : 'OFF (Live Online)'}.`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to persist maintenance mode.');
    }
  };

  // Notifications
  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showToast('All notifications marked as read.');
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    showToast('Notification dismissed.');
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    showToast('All notifications cleared.');
  };

  const resetToDemoData = () => {
    localStorage.clear();
    setProducts(INITIAL_ADMIN_PRODUCTS);
    setInventory(INITIAL_INVENTORY_ITEMS);
    setOrders(INITIAL_ORDERS);
    setPayments(INITIAL_PAYMENT_TRANSACTIONS);
    setCustomers(INITIAL_CUSTOMERS);
    setCoupons(INITIAL_COUPONS);
    setAds(INITIAL_ADVERTISEMENTS);
    setStaff(INITIAL_ADMIN_USERS);
    setSettings(INITIAL_STORE_SETTINGS);
    setCurrentUser(INITIAL_ADMIN_USERS[0] || null);
    showToast('Reset database to clean production demo state.');
  };

  // AI Design Lab Actions
  const addAIConcept = (concept: AIDesignConcept) => {
    setAiConcepts((prev) => [concept, ...prev]);
    logAction('CONTENT_UPDATE', 'AI Design Lab', `Generated new concept: ${concept.designName} (${concept.designNumber})`);
    showToast(`AI Concept "${concept.designName}" saved.`);
  };

  const updateAIConcept = (concept: AIDesignConcept) => {
    setAiConcepts((prev) => prev.map((c) => (c.id === concept.id ? concept : c)));
    showToast(`Concept "${concept.designName}" updated.`);
  };

  const deleteAIConcept = (id: string) => {
    const found = aiConcepts.find((c) => c.id === id);
    setAiConcepts((prev) => prev.filter((c) => c.id !== id));
    if (selectedConcept?.id === id) setSelectedConcept(null);
    showToast(`Concept "${found?.designName || id}" deleted.`);
  };

  const addAICharacter = (char: AICharacter) => {
    setAiCharacters((prev) => [char, ...prev]);
    logAction('CONTENT_UPDATE', 'AI Characters', `Created character: ${char.name}`);
    showToast(`Character "${char.name}" added to TORIWEAR Universe.`);
  };

  const updateAICharacter = (char: AICharacter) => {
    setAiCharacters((prev) => prev.map((c) => (c.id === char.id ? char : c)));
    showToast(`Character "${char.name}" updated.`);
  };

  const addAIWorld = (world: AIWorld) => {
    setAiWorlds((prev) => [world, ...prev]);
    logAction('CONTENT_UPDATE', 'AI Worlds', `Created world: ${world.name}`);
    showToast(`World "${world.name}" created.`);
  };

  const updateAIWorld = (world: AIWorld) => {
    setAiWorlds((prev) => prev.map((w) => (w.id === world.id ? world : w)));
    showToast(`World "${world.name}" updated.`);
  };

  const addAICollection = (col: AICollection) => {
    setAiCollections((prev) => [col, ...prev]);
    logAction('CONTENT_UPDATE', 'AI Collections', `Created collection chapter: ${col.name}`);
    showToast(`Collection "${col.name}" created.`);
  };

  const updateAICollection = (col: AICollection) => {
    setAiCollections((prev) => prev.map((c) => (c.id === col.id ? col : c)));
    showToast(`Collection "${col.name}" updated.`);
  };

  const updateAISettings = (updates: Partial<AISettings>) => {
    setAiSettings((prev) => ({ ...prev, ...updates }));
    showToast('AI Design Lab settings updated.');
  };

  const convertConceptToProductDraft = async (concept: AIDesignConcept): Promise<{ success: boolean; message: string; productId?: string }> => {
    const draftData = conceptToProductDraft(concept, products.length);
    const result = await addProduct(draftData);
    if (result.success) {
      setAiConcepts((prev) =>
        prev.map((c) =>
          c.id === concept.id
            ? { ...c, convertedToProductId: draftData.id || `TORI-DRAFT-${Date.now()}`, status: 'APPROVED' }
            : c
        )
      );
      logAction('CONTENT_UPDATE', 'AI Design Lab', `Converted AI concept ${concept.designName} to product draft`);
      showToast(`Product Draft created for "${concept.designName}". Added to Products Vault as DRAFT.`);
      return { success: true, message: 'Draft product created.', productId: draftData.id };
    }
    return { success: false, message: result.message };
  };

  return (
    <AdminDataContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isAuthChecking,
        twoFactorRequired,
        loginEmail,
        loginWithSession,
        login,
        verify2FA,
        logout,
        hasPermission,
        refreshCurrentUser,

        currentView,
        setCurrentView,
        selectedSubFilter,
        setSelectedSubFilter,
        globalSearchOpen,
        setGlobalSearchOpen,

        products,
        inventory,
        inventoryMovements,
        orders,
        payments,
        customers,
        coupons,
        ads,
        flashSales,
        websiteSections,
        heroSettings,
        returnRequests,
        auditLogs,
        securitySessions,
        staff,
        settings,
        notifications,

        // AI Design Lab Values
        aiConcepts,
        aiCharacters,
        aiWorlds,
        aiCollections,
        aiSettings,
        aiUsageLogs,
        selectedConcept,
        setSelectedConcept,
        addAIConcept,
        updateAIConcept,
        deleteAIConcept,
        addAICharacter,
        updateAICharacter,
        addAIWorld,
        updateAIWorld,
        addAICollection,
        updateAICollection,
        updateAISettings,
        convertConceptToProductDraft,

        addProduct,
        updateProduct,
        archiveProduct,
        deleteProduct,
        duplicateProduct,
        bulkUpdateProducts,

        updateStock,
        deleteInventoryItem,
        bulkDeleteInventoryItems,
        clearAllProductsAndInventory,
        syncInventoryFromCatalog,
        updateOrderStatus,
        addOrderInternalNote,
        cancelOrder,
        initiateRefund,

        addCoupon,
        updateCoupon,
        toggleCoupon,
        deleteCoupon,

        addAdvertisement,
        updateAdvertisement,
        deleteAdvertisement,

        saveWebsiteSections,
        saveHeroSettings,
        syncCmsStateLocally,

        processReturnRequest,

        revokeSession,
        revokeAllOtherSessions,

        addStaffMember,
        updateStaffRole,
        toggleStaffStatus,

        updateSettings,
        toggleMaintenanceMode,

        markNotificationAsRead,
        markAllNotificationsRead,
        deleteNotification,
        clearAllNotifications,

        toastMessage,
        showToast,
        resetToDemoData,
      }}
    >
      {children}
    </AdminDataContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminDataProvider');
  }
  return context;
};
