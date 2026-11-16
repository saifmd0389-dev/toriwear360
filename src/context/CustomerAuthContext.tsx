import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  CustomerProfile, 
  CustomerProductView, 
  CustomerCartItemPreview, 
  CustomerWishlistItemPreview,
  CustomerSavedCard,
  CustomerSavedAddress 
} from '../admin/types';
import { Product, CartItem } from '../types';
import { INITIAL_CUSTOMERS } from '../admin/data/mockData';
import { auth, googleProvider, authPersistenceReady } from '../firebase/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

export type CustomerAccountModalType = 
  | 'GIFT_CARDS' 
  | 'TORI_INSIDER' 
  | 'TORI_CREDIT' 
  | 'COUPONS' 
  | 'SAVED_CARDS' 
  | 'SAVED_VPA' 
  | 'SAVED_ADDRESSES' 
  | 'EDIT_PROFILE' 
  | 'ORDER_HISTORY'
  | null;

interface CustomerAuthContextType {
  customer: CustomerProfile | null;
  isLoggedIn: boolean;
  isAuthModalOpen: boolean;
  authModalTab: 'PHONE' | 'EMAIL' | 'PASSWORD';
  activeAccountModal: CustomerAccountModalType;
  openAuthModal: (tab?: 'PHONE' | 'EMAIL' | 'PASSWORD') => void;
  closeAuthModal: () => void;
  openAccountModal: (modal: CustomerAccountModalType) => void;
  closeAccountModal: () => void;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithPhoneOtp: (phone: string, otp: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithEmailOtp: (email: string, otp: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPassword: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signupWithPassword: (name: string, email: string, phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<CustomerProfile>) => void;
  recordSearch: (query: string) => void;
  recordProductView: (product: Product) => void;
  syncCartWithCustomer: (cartItems: CartItem[]) => void;
  syncWishlistWithCustomer: (wishlistIds: string[], allProducts: Product[]) => void;
  addSavedAddress: (address: Omit<CustomerSavedAddress, 'id'>) => void;
  deleteSavedAddress: (addressId: string) => void;
  addSavedVpa: (vpa: string) => void;
  deleteSavedVpa: (vpa: string) => void;
  addSavedCard: (card: Omit<CustomerSavedCard, 'id'>) => void;
  deleteSavedCard: (cardId: string) => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

const CURRENT_CUSTOMER_KEY = 'toriwear_current_customer';
const ADMIN_CUSTOMERS_KEY = 'tori_admin_customers';

export const CustomerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load current customer session from localStorage
  const [customer, setCustomer] = useState<CustomerProfile | null>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem(CURRENT_CUSTOMER_KEY);
        if (saved) return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'PHONE' | 'EMAIL' | 'PASSWORD'>('PHONE');
  const [activeAccountModal, setActiveAccountModal] = useState<CustomerAccountModalType>(null);

  // Sync customer state to localStorage and admin customers directory
  const saveCustomerToStorage = (updatedCustomer: CustomerProfile | null) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      if (updatedCustomer) {
        localStorage.setItem(CURRENT_CUSTOMER_KEY, JSON.stringify(updatedCustomer));
        
        // Update customer in Admin Directory (tori_admin_customers)
        const adminRaw = localStorage.getItem(ADMIN_CUSTOMERS_KEY);
        let adminList: CustomerProfile[] = adminRaw ? JSON.parse(adminRaw) : INITIAL_CUSTOMERS;
        
        const existingIdx = adminList.findIndex(
          (c) => c.id === updatedCustomer.id || 
                 c.email.toLowerCase() === updatedCustomer.email.toLowerCase() || 
                 c.phone === updatedCustomer.phone
        );

        if (existingIdx > -1) {
          adminList[existingIdx] = { ...adminList[existingIdx], ...updatedCustomer };
        } else {
          adminList = [updatedCustomer, ...adminList];
        }

        localStorage.setItem(ADMIN_CUSTOMERS_KEY, JSON.stringify(adminList));
        window.dispatchEvent(new CustomEvent('tori_customer_updated', { detail: updatedCustomer }));
      } else {
        localStorage.removeItem(CURRENT_CUSTOMER_KEY);
      }
    } catch (e) {
      console.error('Error saving customer to storage:', e);
    }
  };

  const openAuthModal = (tab: 'PHONE' | 'EMAIL' | 'PASSWORD' = 'PHONE') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const openAccountModal = (modal: CustomerAccountModalType) => {
    setActiveAccountModal(modal);
  };

  const closeAccountModal = () => {
    setActiveAccountModal(null);
  };

  const CUSTOMER_SESSION_KEY = 'tori_customer_session_token';

  const mapServerCustomerToProfile = (serverCust: any, fallback?: Partial<CustomerProfile>): CustomerProfile => {
    const todayStr = new Date().toISOString().split('T')[0] || '2026-01-01';
    const addresses = Array.isArray(serverCust?.addresses)
      ? serverCust.addresses.map((a: any) => ({
          id: a.id,
          name: a.addressType || a.fullName || 'Home',
          addressLine: [a.addressLine1, a.addressLine2].filter(Boolean).join(', '),
          city: a.city || '',
          state: a.state || '',
          pincode: a.pincode || '',
          isDefault: Boolean(a.isDefault),
        }))
      : fallback?.savedAddresses || [];
    const primaryAddr = addresses.find((a: any) => a.isDefault) || addresses[0];
    return {
      id: serverCust.id,
      name: serverCust.name || fallback?.name || 'Toriwear Customer',
      email: serverCust.email || fallback?.email || '',
      phone: serverCust.phone || fallback?.phone || '',
      ...(serverCust.avatarUrl || fallback?.avatar ? { avatar: serverCust.avatarUrl || fallback?.avatar } : {}),
      city: primaryAddr?.city || fallback?.city || '',
      state: primaryAddr?.state || fallback?.state || '',
      pincode: primaryAddr?.pincode || fallback?.pincode || '',
      country: 'India',
      totalOrders: serverCust.totalOrdersCount ?? fallback?.totalOrders ?? 0,
      totalSpent: serverCust.totalSpent ?? fallback?.totalSpent ?? 0,
      averageOrderValue: fallback?.averageOrderValue ?? 0,
      lastOrderDate: serverCust.lastOrderAt ? String(serverCust.lastOrderAt).split('T')[0] : (fallback?.lastOrderDate || todayStr),
      createdAt: serverCust.createdAt ? String(serverCust.createdAt).split('T')[0] : todayStr,
      status: serverCust.status || 'ACTIVE',
      segment: 'New Customers',
      tags: ['Google Authenticated', 'Firebase Auth', 'Storefront Member'],
      notes: ['Authenticated via Google Firebase Authentication.'],
      searchHistory: fallback?.searchHistory || [],
      productViews: fallback?.productViews || [],
      cartItems: fallback?.cartItems || [],
      wishlistItems: fallback?.wishlistItems || [],
      toriCredit: serverCust.toriCredit ?? 0,
      insiderTier: serverCust.insiderTier || 'Bronze',
      insiderPoints: serverCust.insiderPoints ?? 0,
      savedVpa: fallback?.savedVpa || [],
      savedCards: fallback?.savedCards || [],
      savedAddresses: addresses,
    };
  };

  const syncFirebaseUserWithBackend = async (firebaseUser: FirebaseUser): Promise<CustomerProfile | null> => {
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/v1/customers/auth/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (data.success && data.sessionToken && data.customer) {
        try {
          localStorage.setItem(CUSTOMER_SESSION_KEY, data.sessionToken);
        } catch {}
        const mapped = mapServerCustomerToProfile(data.customer, customer || undefined);
        setCustomer(mapped);
        saveCustomerToStorage(mapped);
        return mapped;
      }
      return null;
    } catch (err) {
      console.warn('Failed syncing Firebase session with backend:', err);
      return null;
    }
  };

  // Hydrate existing DB session on mount + listen to Firebase auth persistence
  useEffect(() => {
    let mounted = true;
    const hydrateBackendSession = async () => {
      try {
        const token = localStorage.getItem(CUSTOMER_SESSION_KEY);
        if (!token) return;
        const res = await fetch('/api/v1/customers/auth/me', {
          headers: { Authorization: `Bearer ${token}`, 'x-customer-session': token },
        });
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.success && data.customer) {
            const mapped = mapServerCustomerToProfile(data.customer, customer || undefined);
            setCustomer(mapped);
            saveCustomerToStorage(mapped);
          }
        } else if (res.status === 401) {
          localStorage.removeItem(CUSTOMER_SESSION_KEY);
          if (mounted && !auth.currentUser) {
            setCustomer(null);
            saveCustomerToStorage(null);
          }
        }
      } catch {}
    };
    hydrateBackendSession();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (!mounted) return;
      if (firebaseUser) {
        const existingToken = localStorage.getItem(CUSTOMER_SESSION_KEY);
        if (!existingToken) {
          await syncFirebaseUserWithBackend(firebaseUser);
        } else {
          // Verify existing token matches or refresh silently
          const res = await fetch('/api/v1/customers/auth/me', {
            headers: { Authorization: `Bearer ${existingToken}`, 'x-customer-session': existingToken },
          }).catch(() => null);
          if (res && res.ok) {
            const data = await res.json().catch(() => null);
            if (mounted && data?.success && data.customer) {
              const mapped = mapServerCustomerToProfile(data.customer, customer || undefined);
              setCustomer(mapped);
              saveCustomerToStorage(mapped);
            }
          } else {
            await syncFirebaseUserWithBackend(firebaseUser);
          }
        }
      } else {
        try {
          localStorage.removeItem(CUSTOMER_SESSION_KEY);
        } catch {}
        if (mounted) {
          setCustomer(null);
          saveCustomerToStorage(null);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Primary Customer Authentication: Google Sign-In via Firebase + Server Verification
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      await authPersistenceReady;
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        const synced = await syncFirebaseUserWithBackend(result.user);
        if (!synced) {
          await signOut(auth).catch(() => {});
          return { success: false, error: 'Server verification of Google login failed. Please try again.' };
        }
        closeAuthModal();
        return { success: true };
      }
      return { success: false, error: 'Sign in was cancelled.' };
    } catch (error: any) {
      console.warn('Firebase Google Sign-In Notice:', error);
      let message = error?.message || 'Failed to sign in with Google';
      if (error?.code === 'auth/popup-closed-by-user') {
        message = 'Sign in window was closed before completing.';
      } else if (error?.code === 'auth/popup-blocked') {
        message = 'Sign in popup was blocked by browser. Please allow popups for this site.';
      } else if (error?.code === 'auth/invalid-api-key') {
        message = 'Firebase configuration is incomplete. Please ensure Firebase Web App API key is configured.';
      }
      return { success: false, error: message };
    }
  };

  // Disabled insecure client-only auth stubs in favor of verified Google Firebase Sign-In
  const loginWithPhoneOtp = async (_phone: string, _otp: string, _name?: string) => {
    return { success: false, error: 'Phone OTP authentication requires SMS gateway setup. Please use Continue with Google.' };
  };

  const loginWithEmailOtp = async (_email: string, _otp: string, _name?: string) => {
    return { success: false, error: 'Email OTP authentication is disabled. Please use Continue with Google.' };
  };

  const loginWithPassword = async (_identifier: string, _pass: string) => {
    return { success: false, error: 'Customer password login is disabled. Please use Continue with Google.' };
  };

  const signupWithPassword = async (_name: string, _email: string, _phone: string, _pass: string) => {
    return { success: false, error: 'Please use Continue with Google to create your TORIWEAR account.' };
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem(CUSTOMER_SESSION_KEY);
      if (token) {
        await fetch('/api/v1/customers/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'x-customer-session': token },
        }).catch(() => {});
      }
      localStorage.removeItem(CUSTOMER_SESSION_KEY);
    } catch {}
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase signOut error:', e);
    }
    setCustomer(null);
    saveCustomerToStorage(null);
    setActiveAccountModal(null);
  };

  const syncProfileToBackend = (profile: CustomerProfile) => {
    try {
      const token = localStorage.getItem(CUSTOMER_SESSION_KEY);
      if (!token) return;
      const mappedAddresses = (profile.savedAddresses || []).map((a) => ({
        id: a.id,
        fullName: profile.name,
        phone: profile.phone,
        pincode: a.pincode,
        addressLine1: a.addressLine,
        city: a.city,
        state: a.state,
        addressType: ['HOME', 'WORK', 'OTHER'].includes((a.name || '').toUpperCase())
          ? (a.name || '').toUpperCase()
          : 'HOME',
        isDefault: Boolean(a.isDefault),
      }));
      fetch('/api/v1/customers/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-customer-session': token,
        },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone,
          addresses: mappedAddresses,
        }),
      }).catch(() => {});
    } catch {}
  };

  const updateProfile = (updates: Partial<CustomerProfile>) => {
    if (!customer) return;
    const updated = { ...customer, ...updates };
    setCustomer(updated);
    saveCustomerToStorage(updated);
    syncProfileToBackend(updated);
  };

  // Track: Customer Search History
  const recordSearch = (query: string) => {
    const clean = query.trim();
    if (!clean || !customer) return;

    const existing = customer.searchHistory || [];
    if (existing[0]?.toLowerCase() === clean.toLowerCase()) return; // Don't repeat identical consecutive

    const updatedSearches = [clean, ...existing.filter(s => s.toLowerCase() !== clean.toLowerCase())].slice(0, 15);
    const updated = { ...customer, searchHistory: updatedSearches };
    setCustomer(updated);
    saveCustomerToStorage(updated);
  };

  // Track: Customer Product Views
  const recordProductView = (product: Product) => {
    if (!customer) return;

    const existingViews = customer.productViews || [];
    const nowStr = new Date().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newView: CustomerProductView = {
      productId: product.id,
      productName: product.name,
      price: product.price,
      image: product.images?.[0] || '',
      department: product.department,
      inStock: product.inStock,
      viewedAt: nowStr,
    };

    // Filter out if viewed very recently to keep it neat
    const filtered = existingViews.filter(v => v.productId !== product.id);
    const updatedViews = [newView, ...filtered].slice(0, 20);

    const updated = { ...customer, productViews: updatedViews };
    setCustomer(updated);
    saveCustomerToStorage(updated);
  };

  // Track: Customer Cart Items
  const syncCartWithCustomer = (cartItems: CartItem[]) => {
    if (!customer) return;

    const cartPreviews: CustomerCartItemPreview[] = cartItems.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      size: item.size,
      color: item.color,
      price: item.product.price,
      quantity: item.quantity,
      image: item.product.images?.[0] || '',
      inStock: item.product.inStock,
      addedAt: 'Recent',
    }));

    // Avoid unnecessary state updates if cart items match
    const existingPreviews = customer.cartItems || [];
    if (
      existingPreviews.length === cartPreviews.length &&
      existingPreviews.every(
        (it, idx) =>
          it.productId === cartPreviews[idx]?.productId &&
          it.size === cartPreviews[idx]?.size &&
          it.quantity === cartPreviews[idx]?.quantity
      )
    ) {
      return;
    }

    const updated = { ...customer, cartItems: cartPreviews };
    setCustomer(updated);
    saveCustomerToStorage(updated);
  };

  // Track: Customer Wishlist Items (detects Out of Stock items for Admin visibility!)
  const syncWishlistWithCustomer = (wishlistIds: string[], allProducts: Product[]) => {
    if (!customer) return;

    let oosProductIds: string[] = [];
    try {
      const adminInvRaw = localStorage.getItem('tori_admin_inventory');
      if (adminInvRaw) {
        const invList = JSON.parse(adminInvRaw);
        oosProductIds = invList
          .filter((i: any) => i.status === 'OUT_OF_STOCK' || i.availableStock === 0)
          .map((i: any) => i.productId);
      }
    } catch (e) {
      // safe fallback
    }

    const wishlistPreviews: CustomerWishlistItemPreview[] = wishlistIds.map(id => {
      const prod = allProducts.find(p => p.id === id);
      const isOOS = prod ? (prod.inStock === false || oosProductIds.includes(prod.id)) : false;

      return {
        productId: id,
        productName: prod?.name || `Product ${id}`,
        price: prod?.price || 1199,
        image: prod?.images?.[0] || '',
        inStock: !isOOS,
        addedAt: 'Recent',
      };
    });

    // Avoid unnecessary state updates if wishlist items match
    const existingWishlist = customer.wishlistItems || [];
    if (
      existingWishlist.length === wishlistPreviews.length &&
      existingWishlist.every((it, idx) => it.productId === wishlistPreviews[idx]?.productId)
    ) {
      return;
    }

    const updated = { ...customer, wishlistItems: wishlistPreviews };
    setCustomer(updated);
    saveCustomerToStorage(updated);
  };

  const addSavedAddress = (address: Omit<CustomerSavedAddress, 'id'>) => {
    if (!customer) return;
    const newAddr: CustomerSavedAddress = {
      id: `addr-${Date.now()}`,
      ...address,
    };
    const updated = {
      ...customer,
      savedAddresses: [...(customer.savedAddresses || []), newAddr],
    };
    setCustomer(updated);
    saveCustomerToStorage(updated);
    syncProfileToBackend(updated);
  };

  const deleteSavedAddress = (addressId: string) => {
    if (!customer) return;
    const updated = {
      ...customer,
      savedAddresses: (customer.savedAddresses || []).filter(a => a.id !== addressId),
    };
    setCustomer(updated);
    saveCustomerToStorage(updated);
    syncProfileToBackend(updated);
  };

  const addSavedVpa = (vpa: string) => {
    if (!customer) return;
    const clean = vpa.trim();
    if (!clean) return;
    const updated = {
      ...customer,
      savedVpa: Array.from(new Set([...(customer.savedVpa || []), clean])),
    };
    setCustomer(updated);
    saveCustomerToStorage(updated);
  };

  const deleteSavedVpa = (vpa: string) => {
    if (!customer) return;
    const updated = {
      ...customer,
      savedVpa: (customer.savedVpa || []).filter(v => v !== vpa),
    };
    setCustomer(updated);
    saveCustomerToStorage(updated);
  };

  const addSavedCard = (card: Omit<CustomerSavedCard, 'id'>) => {
    if (!customer) return;
    const newCard: CustomerSavedCard = {
      id: `card-${Date.now()}`,
      ...card,
    };
    const updated = {
      ...customer,
      savedCards: [...(customer.savedCards || []), newCard],
    };
    setCustomer(updated);
    saveCustomerToStorage(updated);
  };

  const deleteSavedCard = (cardId: string) => {
    if (!customer) return;
    const updated = {
      ...customer,
      savedCards: (customer.savedCards || []).filter(c => c.id !== cardId),
    };
    setCustomer(updated);
    saveCustomerToStorage(updated);
  };

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        isLoggedIn: !!customer,
        isAuthModalOpen,
        authModalTab,
        activeAccountModal,
        openAuthModal,
        closeAuthModal,
        openAccountModal,
        closeAccountModal,
        loginWithGoogle,
        loginWithPhoneOtp,
        loginWithEmailOtp,
        loginWithPassword,
        signupWithPassword,
        logout,
        updateProfile,
        recordSearch,
        recordProductView,
        syncCartWithCustomer,
        syncWishlistWithCustomer,
        addSavedAddress,
        deleteSavedAddress,
        addSavedVpa,
        deleteSavedVpa,
        addSavedCard,
        deleteSavedCard,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
};

export const useCustomerAuth = () => {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
};
