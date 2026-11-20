import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PRODUCTS } from './data/products';
import { Product, CartItem, OrderDetails, Department, StoreCategory, StoreContactConfig } from './types';
import { getStorefrontCatalog } from './utils/productFilters';
import { updateSeoTags, buildOrganizationJsonLd } from './utils/seo';
import { initMetaPixel, trackMetaEvent } from './utils/metaPixel';

// Core Navigation & 14-Section Brand Layout
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { ChooseYourWorld } from './components/ChooseYourWorld';
import { ShopMenWorlds } from './components/ShopMenWorlds';
import { ShopKidsWorlds } from './components/ShopKidsWorlds';
import { ToriUniverseSection } from './components/ToriUniverseSection';
import { OriginalCharactersSection } from './components/OriginalCharactersSection';
import { StoryBehindDesignsSection } from './components/StoryBehindDesignsSection';
import { CustomerLookbook } from './components/CustomerLookbook';
import { ToriFeed, NewsletterSection } from './components/ToriFeedAndNewsletter';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileCategoryCircles } from './components/MobileCategoryCircles';

// Dedicated Pages
import { ProductDetailPage } from './components/ProductDetailPage';
import { NewDropSection } from './components/NewDropSection';
import { ProductDetailSkeleton } from './components/StorefrontSkeletons';

// Modals & Panels
import { ProductPopoutZoomPreview } from './components/ProductPopoutZoomPreview';
import { TwinningComboModal } from './components/TwinningComboModal';
import { DepartmentPortals } from './components/DepartmentPortals';
import { TwinningSpotlightSection } from './components/TwinningSpotlightSection';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { SizeGuideModal } from './components/SizeGuideModal';
import { BrandStoryModal } from './components/BrandStoryModal';
import { SearchModal } from './components/SearchModal';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { PromoBannerPopup } from './components/PromoBannerPopup';
import { CustomerAuthModal } from './components/CustomerAuthModal';
import { CustomerAccountModals } from './components/CustomerAccountModals';
import { WishlistModal } from './components/WishlistModal';
import { ProductCompareModal } from './components/ProductCompareModal';
import { RecentlyViewedSection } from './components/RecentlyViewedSection';
import { SupportFloatingWidget } from './components/SupportFloatingWidget';
import { ContactSupportModal } from './components/ContactSupportModal';
import { StorefrontMaintenanceScreen } from './components/StorefrontMaintenanceScreen';
import { CmsPromoBanner } from './components/CmsPromoBanner';
import { useCustomerAuth } from './context/CustomerAuthContext';
import AdminApp from './admin/AdminApp';
import { apiClient } from './services/apiClient';
import { 
  loadFrontPageCmsData, 
  fetchFrontPageCmsDataFromServer, 
  fetchStoreSettingsFromServer,
  DEFAULT_FRONTPAGE_CMS_DATA, 
  FrontPageCmsData 
} from './admin/data/frontPageCmsData';
import { isAdminPath, ADMIN_CONFIG } from './config/adminRoutes';

// Helper to generate a clean URL slug from product name or id
const getProductSlug = (p: Product) => {
  return p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || p.id;
};

// Find product by slug or ID
const findProductBySlugOrId = (identifier: string, catalog: Product[]): Product | undefined => {
  const cleanId = decodeURIComponent(identifier).toLowerCase().trim();
  const searchPool = [...catalog, ...PRODUCTS];
  
  // Exact match first
  const exact = searchPool.find((p) => {
    const slug = getProductSlug(p);
    return slug === cleanId || p.id.toLowerCase() === cleanId || p.catalogNumber.toLowerCase() === cleanId;
  });
  if (exact) return exact;

  // Substring / descriptive slug match (e.g. power-rangers-red-ranger-men-oversized-tshirt)
  return searchPool.find((p) => {
    const slug = getProductSlug(p);
    const pid = p.id.toLowerCase();
    return cleanId.includes(pid) || cleanId.includes(slug) || pid.includes(cleanId) || slug.includes(cleanId);
  });
};

export default function App() {
  // --- Admin Routing State ---
  const [isAdminView, setIsAdminView] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return isAdminPath(window.location.pathname, window.location.hash);
    }
    return false;
  });

  // --- Department & Dynamic Category Filter State ---
  const [activeDepartment, setActiveDepartment] = useState<'ALL' | Department>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/men' || path === '/catalog') return 'MEN';
      if (path === '/kids') return 'KIDS';
    }
    return 'ALL';
  });
  const [selectedWorldCategory, setSelectedWorldCategory] = useState<any>('ALL');
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const m = window.location.pathname.match(/^\/category\/([^/]+)/);
      return m?.[1] ? decodeURIComponent(m[1]) : null;
    }
    return null;
  });
  const [storeContact, setStoreContact] = useState<StoreContactConfig | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // --- Real Administrator-Published Catalog for Customer-Facing Storefront ---
  const [storefrontCatalog, setStorefrontCatalog] = useState<Product[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !isAdminPath(window.location.pathname, window.location.hash);
    }
    return true;
  });
  const hasLoadedCatalogRef = useRef<boolean>(false);

  // Dedicated Full-Screen Product Detail State (Syncs with /product/:slug)
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);
  const [isProductDetailLoading, setIsProductDetailLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const hash = window.location.hash;
      return Boolean(path.match(/^\/products?\/([^/]+)/) || hash.startsWith('#product-'));
    }
    return false;
  });

  // --- Storefront Maintenance Mode State ---
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('tori_admin_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        return Boolean(parsed.maintenanceMode);
      }
    } catch {}
    return false;
  });

  // Sync maintenance mode status on storage / custom events
  useEffect(() => {
    const handleSettingsSync = (e?: any) => {
      try {
        if (e && 'key' in e && e.key && e.key !== 'tori_admin_settings') {
          return;
        }
        const stored = localStorage.getItem('tori_admin_settings');
        if (stored) {
          const parsed = JSON.parse(stored);
          setIsMaintenanceMode(Boolean(parsed.maintenanceMode));
        }
      } catch {}
    };

    window.addEventListener('storage', handleSettingsSync);
    window.addEventListener('tori_settings_updated', handleSettingsSync);
    window.addEventListener('focus', handleSettingsSync);
    return () => {
      window.removeEventListener('storage', handleSettingsSync);
      window.removeEventListener('tori_settings_updated', handleSettingsSync);
      window.removeEventListener('focus', handleSettingsSync);
    };
  }, []);

  // --- Storefront CMS Authoritative Data ---
  const [cmsData, setCmsData] = useState<FrontPageCmsData>(() => loadFrontPageCmsData());
  const [isCmsLoading, setIsCmsLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !isAdminPath(window.location.pathname, window.location.hash);
    }
    return true;
  });

  useEffect(() => {
    let isMounted = true;
    fetchFrontPageCmsDataFromServer()
      .then((data) => {
        if (isMounted && data) {
          setCmsData(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setIsCmsLoading(false);
        }
      });

    fetchStoreSettingsFromServer()
      .then((data) => {
        if (!isMounted || !data) return;
        if (typeof data.maintenanceMode === 'boolean') {
          setIsMaintenanceMode(data.maintenanceMode);
        }
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
      if (e?.detail && e.detail.sections) {
        setCmsData(e.detail);
      } else {
        setCmsData(loadFrontPageCmsData());
      }
    };

    const handleFocusSync = () => {
      fetchFrontPageCmsDataFromServer().then((data) => {
        if (isMounted && data) setCmsData(data);
      }).catch(() => {});
    };

    window.addEventListener('tori-cms-updated', handleCmsSync);
    window.addEventListener('focus', handleFocusSync);
    return () => {
      isMounted = false;
      window.removeEventListener('tori-cms-updated', handleCmsSync);
      window.removeEventListener('focus', handleFocusSync);
    };
  }, []);

  const activeSections = useMemo(() => {
    const list = cmsData?.sections && cmsData.sections.length > 0 
      ? cmsData.sections 
      : DEFAULT_FRONTPAGE_CMS_DATA.sections;
    return [...list]
      .filter((s) => s.isEnabled !== false)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }, [cmsData]);

  const saleBannerAds = useMemo(
    () => (cmsData?.advertisements || []).filter((a) => a.type === 'SALE_BANNER' && a.enabled !== false),
    [cmsData]
  );
  const inFeedAds = useMemo(
    () => (cmsData?.advertisements || []).filter((a) => a.type === 'IN_FEED_AD' && a.enabled !== false),
    [cmsData]
  );
  const footerBannerAds = useMemo(
    () => (cmsData?.advertisements || []).filter((a) => a.type === 'FOOTER_BANNER' && a.enabled !== false),
    [cmsData]
  );

  // Dedicated helper to retrieve authoritative published catalog from backend
  const refreshAuthoritativeCatalog = useCallback((options?: { silent?: boolean }) => {
    if (!options?.silent && !hasLoadedCatalogRef.current) {
      setIsCatalogLoading(true);
    }
    console.log('[StorefrontCatalog] 🔄 refreshAuthoritativeCatalog called. Fetching from backend...');
    apiClient
      .getProducts({ status: 'PUBLISHED' })
      .then((remoteProducts) => {
        console.log('[StorefrontCatalog] 📦 remoteProducts received in App.tsx:', {
          isArray: Array.isArray(remoteProducts),
          count: remoteProducts?.length ?? 0,
          ids: (remoteProducts || []).map(p => p.id),
          names: (remoteProducts || []).map(p => p.name),
        });

        if (Array.isArray(remoteProducts) && remoteProducts.length > 0) {
          const processed = getStorefrontCatalog(remoteProducts);
          console.log('[StorefrontCatalog] ✨ Setting storefrontCatalog to processed list:', {
            count: processed.length,
            ids: processed.map(p => p.id),
            names: processed.map(p => p.name),
          });
          setStorefrontCatalog(processed);
        } else if (Array.isArray(remoteProducts)) {
          console.log('[StorefrontCatalog] 📭 Backend returned 0 published products.');
          setStorefrontCatalog([]);
        } else {
          console.warn('[StorefrontCatalog] ⚠️ Invalid remote products returned from backend. Using PRODUCTS fallback.');
          const fallback = getStorefrontCatalog(PRODUCTS);
          console.log('[StorefrontCatalog] Fallback catalog count:', fallback.length);
          setStorefrontCatalog(fallback);
        }
      })
      .catch((err) => {
        console.warn('[StorefrontCatalog] ⚠️ Transient error loading authoritative products:', err?.message || err);
        setStorefrontCatalog((prev) => (prev.length > 0 ? prev : getStorefrontCatalog(PRODUCTS)));
      })
      .finally(() => {
        hasLoadedCatalogRef.current = true;
        setIsCatalogLoading(false);
      });
  }, []);

  // Re-sync storefront catalog on storage events, focus, or admin updates
  useEffect(() => {
    const handleCatalogUpdate = (e?: StorageEvent | Event) => {
      if (e && 'key' in e && e.key && e.key !== 'tori_admin_products') {
        return;
      }
      refreshAuthoritativeCatalog({ silent: true });
    };
    window.addEventListener('storage', handleCatalogUpdate);
    window.addEventListener('focus', handleCatalogUpdate);
    window.addEventListener('tori_admin_products_updated', handleCatalogUpdate);
    return () => {
      window.removeEventListener('storage', handleCatalogUpdate);
      window.removeEventListener('focus', handleCatalogUpdate);
      window.removeEventListener('tori_admin_products_updated', handleCatalogUpdate);
    };
  }, [refreshAuthoritativeCatalog]);

  // Fetch and sync authoritative catalog from production backend on mount and whenever admin view is exited
  useEffect(() => {
    if (!isAdminView) {
      refreshAuthoritativeCatalog();
    }
  }, [isAdminView, refreshAuthoritativeCatalog]);

  // Fetch dynamic categories and public store contact + Meta Pixel configuration
  useEffect(() => {
    let mounted = true;
    const loadCategories = () => {
      apiClient
        .getCategories()
        .then((list) => {
          if (mounted && Array.isArray(list)) {
            setCategories(list);
          }
        })
        .catch(() => {});
    };

    const loadStoreContact = () => {
      apiClient
        .getStoreContact()
        .then((res) => {
          if (mounted && res.success && res.data) {
            setStoreContact(res.data);
            if (res.data.metaBusiness?.pixelId) {
              initMetaPixel(res.data.metaBusiness.pixelId);
            }
          }
        })
        .catch(() => {});
    };

    loadCategories();
    loadStoreContact();
    window.addEventListener('tori_categories_updated', loadCategories);
    window.addEventListener('tori_contact_updated', loadStoreContact);
    window.addEventListener('focus', loadCategories);
    return () => {
      mounted = false;
      window.removeEventListener('tori_categories_updated', loadCategories);
      window.removeEventListener('tori_contact_updated', loadStoreContact);
      window.removeEventListener('focus', loadCategories);
    };
  }, []);

  // Sync browser back/forward and URL routes
  useEffect(() => {
    let activeRouteCheck = true;

    const handleRoute = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;

      if (isAdminPath(path, hash)) {
        setIsAdminView(true);
        setSelectedProductDetail(null);
        setIsProductDetailLoading(false);
        return;
      } else {
        setIsAdminView(false);
      }

      // Check for /product/:slug or /products/:slug or #product-:slug
      const productMatch = path.match(/^\/products?\/([^/]+)/);
      const slugOrId = productMatch?.[1]
        ? decodeURIComponent(productMatch[1])
        : hash.startsWith('#product-')
          ? hash.replace('#product-', '')
          : null;

      if (slugOrId) {
        if (isCatalogLoading && storefrontCatalog.length === 0) {
          setIsProductDetailLoading(true);
          return;
        }

        const match = findProductBySlugOrId(slugOrId, storefrontCatalog);
        if (match) {
          setSelectedProductDetail(match);
          setIsProductDetailLoading(false);
          return;
        }

        // Fallback single-product lookup for unpublished/deep-linked server items
        setIsProductDetailLoading(true);
        apiClient
          .getProductByIdOrSlug(slugOrId)
          .then((remoteProduct) => {
            if (!activeRouteCheck) return;
            if (remoteProduct) {
              setSelectedProductDetail(remoteProduct);
            } else {
              setSelectedProductDetail(null);
            }
          })
          .catch(() => {
            if (activeRouteCheck) setSelectedProductDetail(null);
          })
          .finally(() => {
            if (activeRouteCheck) setIsProductDetailLoading(false);
          });
        return;
      }

      setIsProductDetailLoading(false);

      // Check for /category/:slug
      const categoryMatch = path.match(/^\/category\/([^/]+)/);
      if (categoryMatch?.[1]) {
        const slug = decodeURIComponent(categoryMatch[1]);
        setSelectedProductDetail(null);
        setSelectedCategorySlug(slug);
        setSelectedWorldCategory('ALL');
        const matchedCat = categories.find((c) => c.slug === slug);
        if (matchedCat) {
          setActiveDepartment(matchedCat.department === 'KIDS' ? 'KIDS' : 'MEN');
        } else {
          apiClient.getCategoryBySlug(slug).then((catRes) => {
            if (!activeRouteCheck) return;
            if (catRes.category) {
              setActiveDepartment(catRes.category.department === 'KIDS' ? 'KIDS' : 'MEN');
            } else {
              setActiveDepartment('MEN');
            }
          }).catch(() => {
            if (activeRouteCheck) setActiveDepartment('MEN');
          });
        }
        return;
      }

      // Standard catalog / department / root routes
      if (path === '/men' || path === '/catalog') {
        setActiveDepartment('MEN');
        setSelectedCategorySlug(null);
        setSelectedProductDetail(null);
      } else if (path === '/kids') {
        setActiveDepartment('KIDS');
        setSelectedCategorySlug(null);
        setSelectedProductDetail(null);
      } else if (path === '/' || path === '') {
        setSelectedCategorySlug(null);
        if (!hash.startsWith('#product-')) {
          setSelectedProductDetail(null);
        }
      }
    };

    // Run once on mount to parse current URL route
    handleRoute();

    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate', handleRoute);
    return () => {
      activeRouteCheck = false;
      window.removeEventListener('hashchange', handleRoute);
      window.removeEventListener('popstate', handleRoute);
    };
  }, [storefrontCatalog, isCatalogLoading, categories]);

  // --- Persistent States (Cart, Wishlist, Orders) ---
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('toriwear_cart');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && (item.product || (item as any).id));
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('toriwear_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [orders, setOrders] = useState<OrderDetails[]>(() => {
    try {
      const saved = localStorage.getItem('toriwear_orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [appliedCouponDetail, setAppliedCouponDetail] = useState<{
    discountType: string;
    value: number;
    maxDiscount?: number;
    discountAmount?: number;
    eligibleSubtotal?: number;
    excludeShipping?: boolean;
    excludeTax?: boolean;
    description?: string;
  } | null>(null);

  // Sync state with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('toriwear_cart', JSON.stringify(cartItems));
    } catch (e) {
      console.error(e);
    }
  }, [cartItems]);

  useEffect(() => {
    try {
      localStorage.setItem('toriwear_wishlist', JSON.stringify(wishlist));
    } catch (e) {
      console.error(e);
    }
  }, [wishlist]);

  // --- Recently Viewed Products History ---
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('toriwear_recently_viewed');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const recordRecentlyViewed = (productId: string) => {
    if (!productId) return;
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((id) => id !== productId);
      const updated = [productId, ...filtered].slice(0, 16);
      try {
        localStorage.setItem('toriwear_recently_viewed', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleRemoveFromRecentlyViewed = (productId: string) => {
    setRecentlyViewed((prev) => {
      const updated = prev.filter((id) => id !== productId);
      try {
        localStorage.setItem('toriwear_recently_viewed', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearRecentlyViewed = () => {
    setRecentlyViewed([]);
    try {
      localStorage.removeItem('toriwear_recently_viewed');
    } catch {}
    showToast('Browsing history cleared');
  };

  useEffect(() => {
    try {
      localStorage.setItem('toriwear_orders', JSON.stringify(orders));
    } catch (e) {
      console.error(e);
    }
  }, [orders]);

  // Customer tracking & real-time synchronization with Admin CRM
  const { 
    customer, 
    syncCartWithCustomer, 
    syncWishlistWithCustomer, 
    recordProductView,
  } = useCustomerAuth();

  useEffect(() => {
    syncCartWithCustomer(cartItems);
  }, [cartItems, customer?.id]);

  useEffect(() => {
    syncWishlistWithCustomer(wishlist, storefrontCatalog);
  }, [wishlist, customer?.id]);

  useEffect(() => {
    if (selectedProductDetail) {
      recordProductView(selectedProductDetail);
      recordRecentlyViewed(selectedProductDetail.id);
    }
  }, [selectedProductDetail?.id, customer?.id]);

  // Hydrate authoritative order history from backend when customer signs in
  useEffect(() => {
    if (!customer?.id) return;
    let active = true;
    apiClient
      .getCustomerOrders(customer.id, customer.email, customer.phone)
      .then((res) => {
        const serverOrders = Array.isArray((res as any)?.data)
          ? (res as any).data
          : Array.isArray((res as any)?.orders)
          ? (res as any).orders
          : null;
        if (!active || !res?.success || !serverOrders) return;
        const mappedServerOrders: OrderDetails[] = serverOrders.map((so: any) => {
          const st = String(so.status || so.fulfillmentStatus || 'CONFIRMED').toUpperCase();
          const mappedStatus: OrderDetails['status'] =
            st === 'CANCELLED'
              ? 'Cancelled'
              : st === 'DELIVERED'
              ? 'Delivered'
              : st === 'OUT_FOR_DELIVERY'
              ? 'Out for Delivery'
              : st === 'SHIPPED' || st === 'IN_TRANSIT'
              ? 'Shipped'
              : st === 'PACKED'
              ? 'Packed'
              : 'Confirmed';

          return {
            orderId: so.orderNumber || so.id,
            date: so.createdAt
              ? new Date(so.createdAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Recent',
            items: Array.isArray(so.items)
              ? so.items.map((it: any, idx: number) => ({
                  product:
                    storefrontCatalog.find((p) => p.id === it.productId) ||
                    ({
                      id: it.productId || `item-${idx}`,
                      name: it.productName || 'TORIWEAR Apparel',
                      price: Number(it.unitPrice || 0),
                      images: it.image ? [it.image] : [],
                      colors: [],
                      sizes: [it.size || 'M'],
                    } as any),
                  size: it.size || 'M',
                  color: it.color || 'Black',
                  quantity: Number(it.quantity || 1),
                }))
              : [],
            shippingAddress: {
              fullName: so.shippingAddress?.fullName || so.customerName || customer.name,
              email: so.customerEmail || customer.email || '',
              phone: so.customerPhone || customer.phone || '',
              addressLine1: so.shippingAddress?.addressLine1 || '',
              city: so.shippingAddress?.city || '',
              state: so.shippingAddress?.state || '',
              pincode: so.shippingAddress?.pincode || '',
            },
            paymentMethod: String(so.paymentMethod || 'cod').toLowerCase() as any,
            paymentDetails: {},
            subtotal: Number(so.subtotal || so.totalAmount || 0),
            discount: Number(so.discountAmount || 0),
            discountCode: so.couponCode || undefined,
            shipping: Number(so.shippingFee || 0),
            total: Number(so.totalAmount || 0),
            status: mappedStatus,
            estimatedDelivery: so.estimatedDeliveryDate
              ? new Date(so.estimatedDeliveryDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '3 to 5 Business Days',
            courierPartner: so.courierPartner || undefined,
            trackingNumber: so.courierTrackingNumber || so.awbNumber || undefined,
            timeline: Array.isArray(so.timeline)
              ? so.timeline.map((tl: any) => ({
                  status: tl.status,
                  title: tl.title || tl.description || tl.status || 'Order Update',
                  timestamp: tl.timestamp,
                  description: tl.description,
                  note: tl.note || tl.description,
                  actorName: tl.actorName,
                }))
              : undefined,
            cancellationReason: so.cancellationReason || undefined,
            refundStatus: (
              mappedStatus === 'Cancelled'
                ? String(so.paymentMethod || '').toLowerCase() === 'cod'
                  ? 'Not Applicable (COD)'
                  : 'Refund Initiated'
                : undefined
            ) as OrderDetails['refundStatus'],
          };
        });

        setOrders((prev) => {
          const byId = new Map<string, OrderDetails>();
          for (const mo of mappedServerOrders) {
            byId.set(mo.orderId.toUpperCase(), mo);
          }
          for (const lo of prev) {
            const key = lo.orderId.toUpperCase();
            if (!byId.has(key)) {
              byId.set(key, lo);
            }
          }
          return Array.from(byId.values());
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [customer?.id]);

  // --- Modal States ---
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [popoutZoomProduct, setPopoutZoomProduct] = useState<Product | null>(null);
  const [twinningComboProduct, setTwinningComboProduct] = useState<Product | null>(null);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [sizeGuideDept, setSizeGuideDept] = useState<'MEN' | 'KIDS'>('MEN');
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | undefined>(undefined);
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPromoOpen, setIsPromoOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareSlots, setCompareSlots] = useState<[Product | null, Product | null]>([null, null]);

  const handleOpenCompare = useCallback((initialProduct?: Product) => {
    if (initialProduct) {
      setCompareSlots((prev) => {
        if (prev[0]?.id === initialProduct.id || prev[1]?.id === initialProduct.id) {
          return prev;
        }
        if (!prev[0]) {
          return [initialProduct, prev[1]];
        }
        if (!prev[1]) {
          return [prev[0], initialProduct];
        }
        return [prev[0], initialProduct];
      });
    }
    setIsCompareOpen(true);
  }, []);

  const handleSelectCompareSlot = useCallback((slotIndex: 0 | 1, prod: Product | null) => {
    setCompareSlots((prev) =>
      slotIndex === 0 ? [prod, prev[1]] : [prev[0], prod]
    );
  }, []);

  const handleSwapCompareSlots = useCallback(() => {
    setCompareSlots((prev) => [prev[1], prev[0]]);
  }, []);

  // --- Quick Toast Notification ---
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // --- Cart Actions ---
  const handleAddToCart = (
    product: Product,
    size: string,
    color: string
  ) => {
    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && item.size === size && item.color === color
      );

      if (existingIndex > -1 && prev[existingIndex]) {
        const updated = [...prev];
        const target = updated[existingIndex];
        if (target) {
          updated[existingIndex] = { ...target, quantity: target.quantity + 1 };
        }
        return updated;
      } else {
        return [...prev, { product, size, color, quantity: 1 }];
      }
    });

    trackMetaEvent('AddToCart', {
      contentIds: [product.id],
      contentName: product.name,
      contentCategory: product.world || product.department,
      value: Number(product.price || 0),
      currency: 'INR',
      numItems: 1,
      userData: { email: customer?.email, phone: customer?.phone },
    });

    showToast(`Added "${product.name}" (${size}) to your bag!`);
  };

  const handleUpdateCartQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveCartItem(index);
      return;
    }
    setCartItems((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (target) {
        updated[index] = { ...target, quantity: newQty };
      }
      return updated;
    });
  };

  const handleRemoveCartItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
    showToast('Item removed from your bag.');
  };

  const handleApplyCoupon = async (code: string): Promise<{ valid: boolean; reason?: string }> => {
    const clean = code.trim().toUpperCase();
    if (!clean) {
      return { valid: false, reason: 'Please enter a coupon code.' };
    }

    try {
      const res = await apiClient.validateCoupon(clean, subtotal, {
        items: (cartItems || [])
          .filter((it) => it?.product?.id)
          .map((it) => ({
            productId: it.product.id,
            quantity: Number(it.quantity || 1),
            unitPrice: typeof it.product.price === 'number' ? it.product.price : 0,
          })),
        customerId: customer?.id,
        customerEmail: customer?.email,
        customerPhone: customer?.phone,
      });

      if (res.success && res.code) {
        setAppliedCoupon(res.code);
        setAppliedCouponDetail({
          discountType: res.discountType,
          value: Number(res.value || 0),
          maxDiscount: res.maxDiscount !== undefined ? Number(res.maxDiscount) : undefined,
          discountAmount: res.discountAmount !== undefined ? Number(res.discountAmount) : undefined,
          eligibleSubtotal: res.eligibleSubtotal !== undefined ? Number(res.eligibleSubtotal) : undefined,
          excludeShipping: res.excludeShipping !== false,
          excludeTax: res.excludeTax !== false,
          description: res.description,
        });
        showToast(`Promo code "${res.code}" applied!`);
        return { valid: true };
      }

      const reason = res.error || `Coupon "${clean}" is invalid or inactive.`;
      setAppliedCoupon(null);
      setAppliedCouponDetail(null);
      showToast(reason);
      return { valid: false, reason };
    } catch {
      const reason = `Unable to validate promo code "${clean}" right now.`;
      showToast(reason);
      return { valid: false, reason };
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setAppliedCouponDetail(null);
    showToast('Promo code removed.');
  };

  // --- Customer Reorder Handler ---
  const handleReorder = (items: CartItem[]) => {
    if (!items || items.length === 0) return;
    setCartItems((prev) => {
      let updated = [...prev];
      items.forEach((newItem) => {
        const existingIdx = updated.findIndex(
          (it) => it.product?.id === newItem.product?.id && it.size === newItem.size && it.color === newItem.color
        );
        if (existingIdx > -1 && updated[existingIdx]) {
          const cur = updated[existingIdx];
          updated[existingIdx] = { ...cur, quantity: cur.quantity + (newItem.quantity || 1) };
        } else {
          updated.push({
            product: newItem.product,
            size: newItem.size || 'L',
            color: newItem.color || 'Void Black',
            quantity: newItem.quantity || 1,
          });
        }
      });
      return updated;
    });

    setIsCartOpen(true);
    showToast(`Added ${items.length} item${items.length > 1 ? 's' : ''} from order to your bag! Ready for checkout 🛍️`);
  };

  // --- Buy Now Direct Flow ---
  const handleBuyNow = (
    product: Product,
    size: string,
    color: string
  ) => {
    handleAddToCart(product, size, color);
    trackMetaEvent('InitiateCheckout', {
      contentIds: [product.id],
      contentName: product.name,
      value: Number(product.price || 0),
      currency: 'INR',
      numItems: 1,
      userData: { email: customer?.email, phone: customer?.phone },
    });
    setSelectedProductDetail(null);
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  // --- Wishlist Toggle ---
  const handleToggleWishlist = (productOrId: string | Product) => {
    const productId = typeof productOrId === 'string' ? productOrId : productOrId.id;
    if (wishlist.includes(productId)) {
      setWishlist((prev) => prev.filter((id) => id !== productId));
      showToast('Removed from wishlist');
    } else {
      setWishlist((prev) => [...prev, productId]);
      showToast('Saved to wishlist ❤️');
    }
  };

  // --- Twinning Combo Add To Cart ---
  const handleAddComboToCart = (
    menProduct: Product,
    menSize: string,
    kidsProduct: Product,
    kidsSize: string
  ) => {
    setCartItems((prev) => {
      let updated = [...prev];
      // Add men's piece
      const menIdx = updated.findIndex(
        (item) => item.product.id === menProduct.id && item.size === menSize
      );
      if (menIdx > -1 && updated[menIdx]) {
        const curMen = updated[menIdx];
        updated[menIdx] = { ...curMen, quantity: curMen.quantity + 1 };
      } else {
        updated.push({ product: menProduct, size: menSize, color: menProduct.colors?.[0]?.name || 'Void Black', quantity: 1 });
      }

      // Add kids' piece
      const kidsIdx = updated.findIndex(
        (item) => item.product.id === kidsProduct.id && item.size === kidsSize
      );
      if (kidsIdx > -1 && updated[kidsIdx]) {
        const curKids = updated[kidsIdx];
        updated[kidsIdx] = { ...curKids, quantity: curKids.quantity + 1 };
      } else {
        updated.push({ product: kidsProduct, size: kidsSize, color: kidsProduct.colors?.[0]?.name || 'Sky Blue', quantity: 1 });
      }
      return updated;
    });
    showToast(`Added Men (${menSize}) & Kid (${kidsSize}) Twinning Combo to your bag! 👯`);
  };

  // --- Customer Order Cancellation Handler ---
  const handleCancelOrder = async (
    orderId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await apiClient.cancelOrder(orderId, reason, customer?.name);
    if (!res.success) {
      const errMsg = res.error || 'Unable to cancel this order.';
      showToast(errMsg);
      return { success: false, error: errMsg };
    }

    const nowStr = new Date().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    setOrders((prev) => {
      const updated = prev.map((o) => {
        if (o.orderId.toUpperCase() === orderId.toUpperCase()) {
          return {
            ...o,
            status: 'Cancelled' as const,
            cancellationReason: reason,
            cancelledAt: nowStr,
            refundStatus: (o.paymentMethod === 'cod'
              ? 'Not Applicable (COD)'
              : 'Refund Initiated') as OrderDetails['refundStatus'],
            timeline: [
              ...(o.timeline || []),
              {
                status: 'CANCELLED',
                title: 'Order Cancelled',
                timestamp: new Date().toISOString(),
                note: `Reason: ${reason}`,
              },
            ],
          };
        }
        return o;
      });

      try {
        localStorage.setItem('toriwear_orders', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }

      try {
        const adminOrdersRaw = localStorage.getItem('tori_admin_orders');
        if (adminOrdersRaw) {
          const adminOrders = JSON.parse(adminOrdersRaw);
          const updatedAdminOrders = adminOrders.map((ao: any) => {
            if (
              ao.orderNumber?.toUpperCase() === orderId.toUpperCase() ||
              ao.orderId?.toUpperCase() === orderId.toUpperCase()
            ) {
              return {
                ...ao,
                shippingStatus: 'CANCELLED',
                paymentStatus: String(ao.paymentMethod || '').toUpperCase() === 'COD' ? ao.paymentStatus : 'REFUNDED',
                timeline: [
                  ...(ao.timeline || []),
                  {
                    title: 'Cancelled by Customer',
                    timestamp: nowStr,
                    note: `Reason: ${reason}.`,
                  },
                ],
              };
            }
            return ao;
          });
          localStorage.setItem('tori_admin_orders', JSON.stringify(updatedAdminOrders));
        }
      } catch (e) {
        console.error(e);
      }

      return updated;
    });

    showToast(`Order ${orderId} cancelled.`);
    return { success: true };
  };

  // --- Navigation & Scroll Helpers ---
  const scrollToSection = (sectionId: string) => {
    // 1. If element already exists in the current DOM, scroll to it immediately
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // 2. Element not in current view - determine destination view and switch
    if (sectionId === 'shop-men-section' || (sectionId === 'new-drop-section' && activeDepartment === 'MEN')) {
      setSelectedProductDetail(null);
      setActiveDepartment('MEN');
      setSelectedWorldCategory('ALL');
      if (typeof window !== 'undefined' && window.history.pushState) {
        window.history.pushState(null, '', '/men');
      }
    } else if (sectionId === 'shop-kids-section' || (sectionId === 'new-drop-section' && activeDepartment === 'KIDS')) {
      setSelectedProductDetail(null);
      setActiveDepartment('KIDS');
      setSelectedWorldCategory('ALL');
      if (typeof window !== 'undefined' && window.history.pushState) {
        window.history.pushState(null, '', '/kids');
      }
    } else {
      // Home page section or general fallback (e.g. faq-section, tori-universe-section, etc.)
      setSelectedProductDetail(null);
      setActiveDepartment('ALL');
      setSelectedWorldCategory('ALL');
      if (typeof window !== 'undefined' && window.history.pushState) {
        window.history.pushState(null, '', '/');
      }
    }

    // Wait for the new view to render then scroll smoothly
    setTimeout(() => {
      const fallbackId = sectionId === 'new-drop-section' 
        ? (activeDepartment === 'KIDS' ? 'shop-kids-section' : 'shop-men-section')
        : sectionId;
      const target = document.getElementById(sectionId) || document.getElementById(fallbackId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 150);
  };

  const handleOpenProductDetail = (prod: Product) => {
    recordRecentlyViewed(prod.id);
    setSelectedProductDetail(prod);
    setIsProductDetailLoading(false);
    if (typeof window !== 'undefined' && window.history.pushState) {
      window.history.pushState(null, '', `/product/${getProductSlug(prod)}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    trackMetaEvent('ViewContent', {
      contentIds: [prod.id],
      contentName: prod.name,
      contentCategory: prod.world || prod.department,
      value: Number(prod.price || 0),
      currency: 'INR',
      userData: { email: customer?.email, phone: customer?.phone },
    });
    // Silently verify latest stock & pricing from server without snapping layout
    apiClient
      .getProductByIdOrSlug(prod.id)
      .then((fresh) => {
        if (fresh) {
          setSelectedProductDetail((current) => (current?.id === fresh.id ? fresh : current));
        }
      })
      .catch(() => {});
  };

  const handleCloseProductDetail = () => {
    setSelectedProductDetail(null);
    setIsProductDetailLoading(false);
    if (typeof window !== 'undefined' && window.history.pushState) {
      const targetPath = selectedCategorySlug
        ? `/category/${encodeURIComponent(selectedCategorySlug)}`
        : activeDepartment === 'MEN'
        ? '/men'
        : activeDepartment === 'KIDS'
        ? '/kids'
        : '/';
      window.history.pushState(null, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateHome = () => {
    setSelectedProductDetail(null);
    setIsProductDetailLoading(false);
    setSelectedCategorySlug(null);
    setActiveDepartment('ALL');
    setSelectedWorldCategory('ALL');
    if (typeof window !== 'undefined' && window.history.pushState) {
      window.history.pushState(null, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectDepartment = (dept: Department | 'ALL') => {
    setSelectedProductDetail(null);
    setIsProductDetailLoading(false);
    setSelectedCategorySlug(null);
    setActiveDepartment(dept);
    setSelectedWorldCategory('ALL');
    if (typeof window !== 'undefined' && window.history.pushState) {
      const targetPath = dept === 'MEN' ? '/men' : dept === 'KIDS' ? '/kids' : '/';
      window.history.pushState(null, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    refreshAuthoritativeCatalog({ silent: storefrontCatalog.length > 0 });
  };

  const handleSelectCategorySlug = (slug: string | null) => {
    setSelectedProductDetail(null);
    setIsProductDetailLoading(false);
    setSelectedWorldCategory('ALL');
    setSelectedCategorySlug(slug);
    if (!slug) {
      const targetDept = activeDepartment === 'KIDS' ? 'KIDS' : 'MEN';
      setActiveDepartment(targetDept);
      if (typeof window !== 'undefined' && window.history.pushState) {
        window.history.pushState(null, '', targetDept === 'KIDS' ? '/kids' : '/men');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const cat = categories.find((c) => c.slug === slug);
    const targetDept: Department = cat?.department === 'KIDS' ? 'KIDS' : activeDepartment === 'KIDS' && cat?.department === 'ALL' ? 'KIDS' : 'MEN';
    setActiveDepartment(targetDept);
    if (typeof window !== 'undefined' && window.history.pushState) {
      window.history.pushState(null, '', `/category/${encodeURIComponent(slug)}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    refreshAuthoritativeCatalog({ silent: storefrontCatalog.length > 0 });
  };

  const handleSelectWorldCategory = (world: string) => {
    setSelectedProductDetail(null);
    setSelectedCategorySlug(null);
    const clean = (world || '').trim().toUpperCase();
    if (clean.includes('SHONEN')) {
      setActiveDepartment('MEN');
      setSelectedWorldCategory('DARK SHONEN');
      if (typeof window !== 'undefined' && window.history.pushState) window.history.pushState(null, '', '/men');
    } else if (clean.includes('CYBER') || clean.includes('NEO TOKYO')) {
      setActiveDepartment('MEN');
      setSelectedWorldCategory('CYBERPUNK / NEO TOKYO');
      if (typeof window !== 'undefined' && window.history.pushState) window.history.pushState(null, '', '/men');
    } else if (clean.includes('RETRO') && !clean.includes('GAME')) {
      setActiveDepartment('MEN');
      setSelectedWorldCategory('RETRO Y2K');
      if (typeof window !== 'undefined' && window.history.pushState) window.history.pushState(null, '', '/men');
    } else if (clean.includes('SAMURAI') && !clean.includes('MINI')) {
      setActiveDepartment('MEN');
      setSelectedWorldCategory('SAMURAI / MYTHIC JAPAN');
      if (typeof window !== 'undefined' && window.history.pushState) window.history.pushState(null, '', '/men');
    } else if (clean.includes('STREET')) {
      setActiveDepartment('MEN');
      setSelectedWorldCategory('STREET ANIME');
      if (typeof window !== 'undefined' && window.history.pushState) window.history.pushState(null, '', '/men');
    } else if (clean.includes('CUTE') || clean.includes('ADVENTURE')) {
      setActiveDepartment('KIDS');
      setSelectedWorldCategory('CUTE ADVENTURE');
      if (typeof window !== 'undefined' && window.history.pushState) window.history.pushState(null, '', '/kids');
    } else if (clean.includes('ROBOT') || clean.includes('FUTURE')) {
      setActiveDepartment('KIDS');
      setSelectedWorldCategory('ROBOT & FUTURE');
      if (typeof window !== 'undefined' && window.history.pushState) window.history.pushState(null, '', '/kids');
    } else if (clean.includes('GAME')) {
      setActiveDepartment('KIDS');
      setSelectedWorldCategory('RETRO GAME');
      if (typeof window !== 'undefined' && window.history.pushState) window.history.pushState(null, '', '/kids');
    } else if (clean.includes('MINI')) {
      setActiveDepartment('KIDS');
      setSelectedWorldCategory('MINI SAMURAI');
      if (typeof window !== 'undefined' && window.history.pushState) window.history.pushState(null, '', '/kids');
    } else if (clean.includes('FANTASY') || clean.includes('CREATURE')) {
      setActiveDepartment('KIDS');
      setSelectedWorldCategory('FANTASY CREATURES');
      if (typeof window !== 'undefined' && window.history.pushState) window.history.pushState(null, '', '/kids');
    } else {
      setActiveDepartment('MEN');
      setSelectedWorldCategory('ALL');
      if (typeof window !== 'undefined' && window.history.pushState) window.history.pushState(null, '', '/men');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCmsBannerLink = (targetLink?: string) => {
    const link = (targetLink || '').trim();
    if (!link) return;
    if (link === '/') {
      handleNavigateHome();
    } else if (link.startsWith('/men')) {
      const match = link.match(/world=([^&]+)/i);
      if (match && match[1]) {
        handleSelectWorldCategory(decodeURIComponent(match[1].replace(/\+/g, ' ')));
      } else {
        handleSelectDepartment('MEN');
      }
    } else if (link.startsWith('/kids')) {
      handleSelectDepartment('KIDS');
    } else if (link.startsWith('#')) {
      const id = link.slice(1);
      const aliasMap: Record<string, string> = {
        'tori-universe': 'tori-universe-section',
        'customer-lookbook': 'customer-lookbook-section',
        'twinning-spotlight': 'twinning-spotlight-section',
      };
      scrollToSection(aliasMap[id] || id);
    } else if (/^https?:\/\//i.test(link)) {
      window.location.href = link;
    }
  };

  // Calculations for Checkout
  const subtotal = (cartItems || []).reduce((sum, item) => {
    const price = typeof item?.product?.price === 'number'
      ? item.product.price
      : typeof (item as any)?.price === 'number'
        ? (item as any).price
        : 0;
    const qty = typeof item?.quantity === 'number' && !isNaN(item.quantity) && item.quantity > 0
      ? item.quantity
      : 1;
    return sum + price * qty;
  }, 0);
  const storeSettings = useMemo(() => {
    try {
      const stored = localStorage.getItem('tori_admin_settings');
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      freeShippingThreshold: 999,
      standardShippingFee: 79,
      codFee: 50,
      orderPrefix: 'TORI-',
    };
  }, [isMaintenanceMode]);

  const freeThreshold = storeSettings?.freeShippingThreshold ?? 999;
  const standardFee = storeSettings?.standardShippingFee ?? 79;

  let discount = 0;
  if (appliedCouponDetail && appliedCoupon && subtotal > 0) {
    if (typeof appliedCouponDetail.discountAmount === 'number') {
      discount = Math.min(appliedCouponDetail.discountAmount, subtotal);
    } else if (appliedCouponDetail.discountType === 'PERCENTAGE') {
      discount = Math.round(subtotal * (appliedCouponDetail.value / 100));
      if (appliedCouponDetail.maxDiscount) discount = Math.min(discount, appliedCouponDetail.maxDiscount);
      discount = Math.min(discount, subtotal);
    } else {
      discount = Math.min(appliedCouponDetail.value || 0, subtotal);
    }
  }

  useEffect(() => {
    if (!appliedCoupon) return;
    if (!cartItems || cartItems.length === 0) {
      setAppliedCoupon(null);
      setAppliedCouponDetail(null);
      return;
    }
    let cancelled = false;
    const currentSub = cartItems.reduce((sum, item) => {
      const price = typeof item?.product?.price === 'number' ? item.product.price : 0;
      const qty = typeof item?.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
      return sum + price * qty;
    }, 0);
    apiClient
      .validateCoupon(appliedCoupon, currentSub, {
        items: cartItems
          .filter((it) => it?.product?.id)
          .map((it) => ({
            productId: it.product.id,
            quantity: Number(it.quantity || 1),
            unitPrice: typeof it.product.price === 'number' ? it.product.price : 0,
          })),
        customerId: customer?.id,
        customerEmail: customer?.email,
        customerPhone: customer?.phone,
      })
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.code) {
          setAppliedCouponDetail({
            discountType: res.discountType,
            value: Number(res.value || 0),
            maxDiscount: res.maxDiscount !== undefined ? Number(res.maxDiscount) : undefined,
            discountAmount: res.discountAmount !== undefined ? Number(res.discountAmount) : undefined,
            eligibleSubtotal: res.eligibleSubtotal !== undefined ? Number(res.eligibleSubtotal) : undefined,
            excludeShipping: res.excludeShipping !== false,
            excludeTax: res.excludeTax !== false,
            description: res.description,
          });
        } else {
          setAppliedCoupon(null);
          setAppliedCouponDetail(null);
          if (res.error) showToast(res.error);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [appliedCoupon, cartItems, customer?.id, customer?.email, customer?.phone]);

  const shipping = subtotal >= freeThreshold || subtotal === 0 ? 0 : standardFee;
  const total = Math.max(0, subtotal - discount) + shipping;

  // Dynamic SEO metadata, canonical URLs, Schema.org JSON-LD, and robots directives
  useEffect(() => {
    if (isAdminView) {
      updateSeoTags({
        title: 'Admin Console | TORI-WEAR',
        description: 'TORI-WEAR internal operations dashboard.',
        canonicalPath: ADMIN_CONFIG.ADMIN_PATH,
        robots: 'noindex, nofollow',
      });
      return;
    }

    if (isMaintenanceMode) {
      updateSeoTags({
        title: 'Dropping Soon | TORI-WEAR Anime Streetwear',
        description: 'TORI-WEAR storefront is preparing the next limited anime streetwear drop.',
        canonicalPath: '/',
        robots: 'noindex, nofollow',
      });
      return;
    }

    if (selectedProductDetail) {
      const slug = getProductSlug(selectedProductDetail);
      updateSeoTags({
        title: `${selectedProductDetail.name} | TORI-WEAR Anime Streetwear`,
        description: (
          selectedProductDetail.description ||
          `${selectedProductDetail.name} — Heavyweight ${selectedProductDetail.gsm || 240} GSM ${selectedProductDetail.fit || 'Oversized'} anime streetwear.`
        ).slice(0, 160),
        keywords: `TORI-WEAR, ${selectedProductDetail.name}, ${selectedProductDetail.world}, ${selectedProductDetail.gsm || 240} GSM t-shirt, anime streetwear India`,
        canonicalPath: `/product/${slug}`,
        ogType: 'product',
        ogImage: selectedProductDetail.images?.[0],
        robots: 'index, follow',
      });
      return;
    }

    if (selectedCategorySlug) {
      const activeCat = categories.find((c) => c.slug === selectedCategorySlug);
      updateSeoTags({
        title: activeCat?.seoTitle || `${activeCat?.name || selectedCategorySlug} | TORI-WEAR Streetwear`,
        description:
          activeCat?.seoDescription ||
          activeCat?.description ||
          `Explore ${activeCat?.name || selectedCategorySlug} original anime-inspired heavyweight 240 GSM streetwear from TORI-WEAR.`,
        keywords: `TORI-WEAR, ${activeCat?.name || selectedCategorySlug}, anime streetwear, oversized t-shirts, 240 GSM`,
        canonicalPath: `/category/${encodeURIComponent(selectedCategorySlug)}`,
        robots: 'index, follow',
      });
      return;
    }

    if (activeDepartment === 'MEN') {
      updateSeoTags({
        title: "Men's Anime Streetwear & 240 GSM Oversized Tees | TORI-WEAR",
        description:
          "Shop TORI-WEAR Men's heavyweight 240 GSM oversized T-shirts, drop-shoulder fits, hoodies, and original anime streetwear chapters.",
        keywords: "TORI-WEAR men, oversized anime t-shirts India, 240 GSM streetwear, drop-shoulder tees, hoodies",
        canonicalPath: '/men',
        robots: 'index, follow',
      });
      return;
    }

    if (activeDepartment === 'KIDS') {
      updateSeoTags({
        title: "Kids' Anime Storywear & Bio-Wash Cotton Tees | TORI-WEAR",
        description:
          "Discover soft 180 GSM bio-wash kids anime T-shirts & adventure storywear crafted by TORI-WEAR for ages 2 to 12.",
        keywords: "TORI-WEAR kids, anime kids t-shirts India, soft cotton storywear, bio-wash kids apparel",
        canonicalPath: '/kids',
        robots: 'index, follow',
      });
      return;
    }

    const sameAs = (storeContact?.channels || [])
      .filter((c) => c.enabled && c.url && /^https?:\/\//i.test(c.url))
      .map((c) => c.url);

    updateSeoTags({
      title: 'TORI-WEAR — Original Anime Streetwear & 240 GSM Apparel',
      description:
        'Original anime-inspired heavyweight 240 GSM streetwear, oversized T-shirts, drop-shoulder styles, hoodies, and custom apparel from TORI-WEAR.',
      keywords:
        'TORI-WEAR, anime streetwear India, heavyweight 240 GSM t-shirt, oversized t-shirts, drop-shoulder styles, anime hoodies, custom streetwear',
      canonicalPath: '/',
      ogType: 'website',
      robots: 'index, follow',
      jsonLdId: 'tori-org-jsonld',
      jsonLd: buildOrganizationJsonLd({
        email: storeContact?.supportEmail,
        phone: storeContact?.phone,
        address: storeContact?.businessAddress,
        sameAs,
      }),
    });
  }, [
    isAdminView,
    isMaintenanceMode,
    selectedProductDetail,
    selectedCategorySlug,
    activeDepartment,
    categories,
    storeContact,
  ]);

  // If Admin View is active, render full-fledged Admin Control Center
  if (isAdminView) {
    return (
      <AdminApp 
        onExitAdmin={() => {
          setIsAdminView(false);
          window.location.hash = '';
          if (typeof window !== 'undefined' && window.history.pushState) {
            window.history.pushState(null, '', '/');
          }
          refreshAuthoritativeCatalog();
        }} 
      />
    );
  }

  // If Storefront Maintenance Mode is active, render only the customer Dropping Soon page
  if (isMaintenanceMode) {
    return <StorefrontMaintenanceScreen />;
  }

  const totalCartCount = (cartItems || []).reduce(
    (s, i) => s + (typeof i?.quantity === 'number' && !isNaN(i.quantity) && i.quantity > 0 ? i.quantity : 1),
    0
  );

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[#050505] text-[#FFFFFF] flex flex-col font-sans selection:bg-[#FF2028] selection:text-white pb-14 lg:pb-0">
      {/* 1. Header (Navigation: MEN, KIDS, COLLECTIONS, WORLDS, Cart) */}
      <Header
        cartCount={totalCartCount}
        wishlistCount={wishlist.length}
        activeDepartment={activeDepartment}
        isFrontPage={activeDepartment === 'ALL' && selectedProductDetail === null && !isProductDetailLoading && selectedWorldCategory === 'ALL' && !selectedCategorySlug}
        menCount={storefrontCatalog.filter((p) => p.department === 'MEN').length}
        kidsCount={storefrontCatalog.filter((p) => p.department === 'KIDS').length}
        categories={categories}
        onSelectCategorySlug={(slug) => handleSelectCategorySlug(slug)}
        onSelectDepartment={handleSelectDepartment}
        onSelectWorld={handleSelectWorldCategory}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        onOpenTrackOrder={() => setIsTrackingOpen(true)}
        onOpenSizeGuide={() => {
          setSizeGuideDept('MEN');
          setIsSizeGuideOpen(true);
        }}
        onOpenStory={() => setIsStoryOpen(true)}
        onOpenContact={() => setIsContactModalOpen(true)}
        onNavigateHome={handleNavigateHome}
        onScrollToSection={scrollToSection}
      />

      {/* Myntra-Style Mobile Top Category Story Circles (hidden on dedicated product page and front page) */}
      {!selectedProductDetail && !isProductDetailLoading && activeDepartment !== 'ALL' && (
        <MobileCategoryCircles
          activeDepartment={activeDepartment}
          onSelectDepartment={handleSelectDepartment}
          onSelectWorld={handleSelectWorldCategory}
          onScrollToSection={scrollToSection}
        />
      )}

      {/* Main Content Sections (14-Section Brand Layout / Dedicated Full-Screen Product Page) */}
      <main className="flex-1">
        {isProductDetailLoading && !selectedProductDetail ? (
          <ProductDetailSkeleton />
        ) : selectedProductDetail ? (
          <ProductDetailPage
            key={selectedProductDetail.id}
            product={selectedProductDetail}
            allProducts={storefrontCatalog}
            isLoading={isProductDetailLoading}
            isRelatedLoading={isCatalogLoading}
            isWishlisted={wishlist.includes(selectedProductDetail.id)}
            onToggleWishlist={handleToggleWishlist}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
            onBackToCatalog={handleCloseProductDetail}
            onNavigateHome={handleNavigateHome}
            onSelectDepartment={handleSelectDepartment}
            onSelectWorld={handleSelectWorldCategory}
            onSelectProduct={handleOpenProductDetail}
            onOpenSizeGuide={() => {
              setSizeGuideDept(selectedProductDetail.department === 'KIDS' ? 'KIDS' : 'MEN');
              setIsSizeGuideOpen(true);
            }}
            onOpenCombo={(prod) => setTwinningComboProduct(prod)}
            onOpenCompare={(prod) => handleOpenCompare(prod)}
            recentlyViewedIds={recentlyViewed}
            wishlistIds={wishlist}
            onRemoveFromRecent={handleRemoveFromRecentlyViewed}
            onClearAllRecent={handleClearRecentlyViewed}
          />
        ) : (
          <>
            {/* VIEW 1: FIRST PAGE (HOME) — NO CATALOGUE / NO PRODUCT CARDS */}
            {activeDepartment === 'ALL' && (
              <div className="animate-in fade-in duration-300">
                {activeSections.map((sec, idx) => {
                  const k = (sec.key || sec.id || sec.name || '').toLowerCase();

                  const hasHero = activeSections.some((s) => (s.key || s.id || s.name || '').toLowerCase().includes('hero'));
                  const hasWorld = activeSections.some((s) => (s.key || s.id || s.name || '').toLowerCase().includes('world'));
                  const showSaleAfterThis = saleBannerAds.length > 0 && (hasHero ? k.includes('hero') : idx === 0);
                  const showInFeedAfterThis = inFeedAds.length > 0 && (hasWorld ? k.includes('world') : idx === Math.floor(activeSections.length / 2));

                  let sectionNode: React.ReactNode = null;

                  // 1. Hero
                  if (k.includes('hero') || sec.key === 'hero') {
                    sectionNode = (
                      <Hero
                        key={sec.id || 'sec-hero'}
                        isLoading={isCmsLoading}
                        onShopMen={() => {
                          setActiveDepartment('MEN');
                          setSelectedWorldCategory('ALL');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onShopKids={() => {
                          setActiveDepartment('KIDS');
                          setSelectedWorldCategory('ALL');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onExploreChapters={() => scrollToSection('choose-your-world-section')}
                        onOpenSearch={() => setIsSearchOpen(true)}
                        onOpenCombo={() => {
                          const sample = storefrontCatalog.find((p) => p.department === 'MEN') || storefrontCatalog[0] || null;
                          setTwinningComboProduct(sample);
                        }}
                      />
                    );
                  } else if (k.includes('portal') || k.includes('department_portals') || sec.key === 'department_portals') {
                    // 2. Department Gateways
                    sectionNode = (
                      <DepartmentPortals
                        key={sec.id || 'sec-portals'}
                        isLoading={isCatalogLoading}
                        menCount={storefrontCatalog.filter((p) => p.department === 'MEN').length}
                        kidsCount={storefrontCatalog.filter((p) => p.department === 'KIDS').length}
                        onShopMen={() => {
                          setActiveDepartment('MEN');
                          setSelectedWorldCategory('ALL');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onShopKids={() => {
                          setActiveDepartment('KIDS');
                          setSelectedWorldCategory('ALL');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onOpenCombo={() => {
                          const sample = storefrontCatalog.find((p) => p.department === 'MEN') || storefrontCatalog[0] || null;
                          setTwinningComboProduct(sample);
                        }}
                      />
                    );
                  } else if (k.includes('twinning') || sec.key === 'twinning_spotlight') {
                    // 3. Twinning Duo Soft Highlight
                    sectionNode = (
                      <TwinningSpotlightSection
                        key={sec.id || 'sec-twinning'}
                        allProducts={storefrontCatalog}
                        isLoading={isCatalogLoading || isCmsLoading}
                        onOpenCombo={(prod) => setTwinningComboProduct(prod)}
                        onShopMen={() => {
                          setActiveDepartment('MEN');
                          setSelectedWorldCategory('ALL');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onShopKids={() => {
                          setActiveDepartment('KIDS');
                          setSelectedWorldCategory('ALL');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      />
                    );
                  } else if (k.includes('new_drop') || k.includes('new drop') || sec.key === 'new_drops') {
                    // 3b. New Drops & Live Vault Releases
                    sectionNode = (
                      <NewDropSection
                        key={sec.id || 'sec-new-drops'}
                        products={storefrontCatalog}
                        isLoading={isCatalogLoading}
                        wishlist={wishlist}
                        onToggleWishlist={handleToggleWishlist}
                        onOpenProductDetail={handleOpenProductDetail}
                        onOpenPopoutZoom={(prod) => setPopoutZoomProduct(prod)}
                        onAddToCart={handleAddToCart}
                      />
                    );
                  } else if (k.includes('world') || k.includes('choose_your_world') || sec.key === 'choose_your_world') {
                    // 4. Choose Your World (Realms Preview)
                    sectionNode = (
                      <ChooseYourWorld
                        key={sec.id || 'sec-world'}
                        isLoading={isCmsLoading}
                        onSelectWorldCategory={handleSelectWorldCategory}
                        onSelectMen={() => {
                          setActiveDepartment('MEN');
                          setSelectedWorldCategory('ALL');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onSelectKids={() => {
                          setActiveDepartment('KIDS');
                          setSelectedWorldCategory('ALL');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      />
                    );
                  } else if (k.includes('universe') || sec.key === 'tori_universe') {
                    // 5. Tori Universe & Lore
                    sectionNode = (
                      <ToriUniverseSection
                        key={sec.id || 'sec-universe'}
                        onEnterUniverse={() => setIsStoryOpen(true)}
                      />
                    );
                  } else if (k.includes('character') || sec.key === 'original_characters') {
                    // 6. Original Characters Profile Showcase
                    sectionNode = (
                      <OriginalCharactersSection
                        key={sec.id || 'sec-characters'}
                        products={storefrontCatalog}
                        isLoading={isCmsLoading}
                        onOpenProductDetail={handleOpenProductDetail}
                        onOpenCharacterModal={() => setIsStoryOpen(true)}
                      />
                    );
                  } else if (k.includes('story_behind') || k.includes('story behind') || sec.key === 'story_behind_designs') {
                    // 7. Story Behind The Designs
                    sectionNode = (
                      <StoryBehindDesignsSection
                        key={sec.id || 'sec-stories'}
                        products={storefrontCatalog}
                        isLoading={isCmsLoading}
                        onOpenProductDetail={handleOpenProductDetail}
                        onExploreMoreStories={() => setIsStoryOpen(true)}
                      />
                    );
                  } else if (k.includes('lookbook') || sec.key === 'customer_lookbook') {
                    // 8. Customer Lookbook
                    sectionNode = (
                      <CustomerLookbook
                        key={sec.id || 'sec-lookbook'}
                        products={storefrontCatalog}
                        isLoading={isCmsLoading}
                        onOpenProductDetail={handleOpenProductDetail}
                      />
                    );
                  } else if (k.includes('feed') || sec.key === 'tori_feed') {
                    // 9. Tori Feed
                    sectionNode = <ToriFeed key={sec.id || 'sec-feed'} isLoading={isCmsLoading} />;
                  } else if (k.includes('newsletter') || sec.key === 'newsletter') {
                    // 10. Newsletter
                    sectionNode = <NewsletterSection key={sec.id || 'sec-newsletter'} />;
                  } else if (k.includes('faq') || sec.key === 'faq') {
                    // 11. FAQ Section
                    sectionNode = <FaqSection key={sec.id || 'sec-faq'} />;
                  }

                  return (
                    <React.Fragment key={sec.id || `sec-${idx}`}>
                      {sectionNode}
                      {showSaleAfterThis && saleBannerAds.map((ad) => (
                        <CmsPromoBanner
                          key={ad.id}
                          ad={ad}
                          variant="strip"
                          onNavigateLink={handleCmsBannerLink}
                          onApplyPromoCode={(code) => handleApplyCoupon(code)}
                        />
                      ))}
                      {showInFeedAfterThis && inFeedAds.map((ad) => (
                        <CmsPromoBanner
                          key={ad.id}
                          ad={ad}
                          variant="infeed"
                          onNavigateLink={handleCmsBannerLink}
                          onApplyPromoCode={(code) => handleApplyCoupon(code)}
                        />
                      ))}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* VIEW 2: MEN'S CATALOGUE — ONLY MEN'S WEAR SHOWN (30 DROPS) */}
            {activeDepartment === 'MEN' && (
              <div className="animate-in fade-in duration-300">
                {/* Men's Breadcrumb & Switcher Header */}
                <div className="bg-[#111218] border-b border-neutral-800 py-3.5 px-4 sm:px-6 lg:px-8">
                  <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-xs font-heading">
                      <button
                        onClick={handleNavigateHome}
                        className="text-neutral-400 hover:text-white transition flex items-center gap-1 cursor-pointer font-medium tracking-[0.05em]"
                      >
                        <span>← HOME</span>
                      </button>
                      <span className="text-neutral-600">/</span>
                      <span className="text-white font-semibold uppercase tracking-[0.06em]">
                        MEN'S APPAREL CATALOGUE
                      </span>
                      <span className="text-[10px] bg-[#FF2028]/15 text-[#FF2028] border border-[#FF2028]/30 px-2 py-0.5 rounded-full font-sans font-semibold tracking-[0.04em] tabular-nums">
                        {isCatalogLoading ? '···' : `${storefrontCatalog.filter((p) => p.department === 'MEN').length} DROPS EXCLUSIVE`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-neutral-400 font-sans hidden sm:inline">Shopping for kids?</span>
                      <button
                        onClick={() => {
                          setActiveDepartment('KIDS');
                          setSelectedWorldCategory('ALL');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-sans font-semibold uppercase tracking-[0.04em] transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <span>SWITCH TO KIDS' WEAR 👶</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section: Men Worlds & Products (STRICTLY ONLY MEN) */}
                <ShopMenWorlds
                  products={storefrontCatalog}
                  isLoading={isCatalogLoading}
                  selectedWorld={selectedWorldCategory}
                  onSelectWorld={setSelectedWorldCategory}
                  categories={categories}
                  selectedCategorySlug={selectedCategorySlug}
                  onSelectCategorySlug={handleSelectCategorySlug}
                  onOpenProductDetail={handleOpenProductDetail}
                  onOpenPopoutZoom={(prod) => setPopoutZoomProduct(prod)}
                  onOpenCombo={(prod) => setTwinningComboProduct(prod)}
                  onOpenCompare={(prod) => handleOpenCompare(prod)}
                  onAddToCart={handleAddToCart}
                  wishlist={wishlist}
                  onToggleWishlist={handleToggleWishlist}
                />

                <FaqSection />
              </div>
            )}

            {/* VIEW 3: KIDS' CATALOGUE — ONLY KIDS' WEAR SHOWN (24 DROPS) */}
            {activeDepartment === 'KIDS' && (
              <div className="animate-in fade-in duration-300">
                {/* Kids' Breadcrumb & Switcher Header */}
                <div className="bg-[#0b1320] border-b border-sky-900/50 py-3.5 px-4 sm:px-6 lg:px-8">
                  <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-xs font-heading">
                      <button
                        onClick={handleNavigateHome}
                        className="text-neutral-400 hover:text-white transition flex items-center gap-1 cursor-pointer font-medium tracking-[0.05em]"
                      >
                        <span>← HOME</span>
                      </button>
                      <span className="text-neutral-600">/</span>
                      <span className="text-sky-300 font-semibold uppercase tracking-[0.06em]">
                        KIDS' STORYWEAR CATALOGUE
                      </span>
                      <span className="text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full font-sans font-semibold tracking-[0.04em] tabular-nums">
                        {isCatalogLoading ? '···' : `${storefrontCatalog.filter((p) => p.department === 'KIDS').length} DROPS · BIO-WASH`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-neutral-400 font-sans hidden sm:inline">Shopping for adults?</span>
                      <button
                        onClick={() => {
                          setActiveDepartment('MEN');
                          setSelectedCategorySlug(null);
                          setSelectedWorldCategory('ALL');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#FF2028]/10 hover:bg-[#FF2028]/20 text-[#FF2028] border border-[#FF2028]/30 text-xs font-sans font-semibold uppercase tracking-[0.04em] transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <span>SWITCH TO MEN'S WEAR 🥋</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section: Kids Worlds & Products (STRICTLY ONLY KIDS) */}
                <ShopKidsWorlds
                  products={storefrontCatalog}
                  isLoading={isCatalogLoading}
                  selectedWorld={selectedWorldCategory}
                  onSelectWorld={setSelectedWorldCategory}
                  categories={categories}
                  selectedCategorySlug={selectedCategorySlug}
                  onSelectCategorySlug={handleSelectCategorySlug}
                  onOpenProductDetail={handleOpenProductDetail}
                  onOpenPopoutZoom={(prod) => setPopoutZoomProduct(prod)}
                  onOpenCombo={(prod) => setTwinningComboProduct(prod)}
                  onOpenCompare={(prod) => handleOpenCompare(prod)}
                  onAddToCart={handleAddToCart}
                  wishlist={wishlist}
                  onToggleWishlist={handleToggleWishlist}
                />

                <FaqSection />
              </div>
            )}
          </>
        )}
      </main>

      {/* Recently Viewed Shelf on Storefront (Visible when customer has browsed pieces) */}
      {!selectedProductDetail && !isProductDetailLoading && recentlyViewed.length > 0 && (
        <RecentlyViewedSection
          recentlyViewedIds={recentlyViewed}
          allProducts={storefrontCatalog}
          isLoading={isCatalogLoading}
          wishlist={wishlist}
          onSelectProduct={handleOpenProductDetail}
          onToggleWishlist={handleToggleWishlist}
          onAddToCart={handleAddToCart}
          onRemoveFromRecent={handleRemoveFromRecentlyViewed}
          onClearAllRecent={handleClearRecentlyViewed}
        />
      )}

      {/* Footer Pre-Banner Ads */}
      {!selectedProductDetail && footerBannerAds.length > 0 && footerBannerAds.map((ad) => (
        <CmsPromoBanner
          key={ad.id}
          ad={ad}
          variant="footer"
          onNavigateLink={handleCmsBannerLink}
          onApplyPromoCode={(code) => handleApplyCoupon(code)}
        />
      ))}

      {/* Footer */}
      <Footer
        onSelectDepartment={handleSelectDepartment}
        onSelectWorld={handleSelectWorldCategory}
        onScrollToSection={scrollToSection}
        onOpenSizeGuide={() => {
          setSizeGuideDept('MEN');
          setIsSizeGuideOpen(true);
        }}
        onOpenTrackOrder={() => setIsTrackingOpen(true)}
        onOpenStory={() => setIsStoryOpen(true)}
        onOpenContact={() => setIsContactModalOpen(true)}
      />

      {/* --- MODALS & DRAWERS --- */}

      {/* 70% Screen Pop-Out Zoom & Inspection Overlay */}
      <ProductPopoutZoomPreview
        product={popoutZoomProduct}
        isOpen={Boolean(popoutZoomProduct)}
        onClose={() => setPopoutZoomProduct(null)}
        isWishlisted={Boolean(popoutZoomProduct && wishlist.includes(popoutZoomProduct.id))}
        onToggleWishlist={(prod: Product) => handleToggleWishlist(prod.id)}
        onOpenProductDetail={(prod: Product) => {
          setPopoutZoomProduct(null);
          handleOpenProductDetail(prod);
        }}
        onAddToCart={handleAddToCart}
      />

      {/* Twinning Combo (Men & Kid Pair) Modal */}
      <TwinningComboModal
        isOpen={Boolean(twinningComboProduct)}
        onClose={() => setTwinningComboProduct(null)}
        baseProduct={twinningComboProduct}
        allProducts={storefrontCatalog}
        onAddComboToCart={handleAddComboToCart}
        onOpenProductDetail={(prod) => {
          setTwinningComboProduct(null);
          handleOpenProductDetail(prod);
        }}
      />

      {/* Cart Slide-over Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        appliedCoupon={appliedCoupon}
        onApplyCoupon={handleApplyCoupon}
        onRemoveCoupon={handleRemoveCoupon}
        freeShippingThreshold={freeThreshold}
        standardShippingFee={standardFee}
        discount={discount}
        appliedCouponDetail={appliedCouponDetail}
        onProceedToCheckout={() => {
          trackMetaEvent('InitiateCheckout', {
            contentIds: cartItems.map((it) => it.product?.id).filter(Boolean),
            value: total,
            currency: 'INR',
            numItems: totalCartCount,
            userData: { email: customer?.email, phone: customer?.phone },
          });
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
        onContinueShopping={() => setIsCartOpen(false)}
      />

      {/* Secure Checkout & Payment Gateways Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cartItems}
        subtotal={subtotal}
        discount={discount}
        discountCode={appliedCoupon || undefined}
        shipping={shipping}
        total={total}
        onOrderPlaced={(order) => {
          const orderWithTimeline: OrderDetails = {
            ...order,
            timeline:
              order.timeline && order.timeline.length > 0
                ? order.timeline
                : [
                    {
                      status: 'CONFIRMED',
                      title: 'Order Confirmed',
                      timestamp: new Date().toISOString(),
                      note: 'Order placed & confirmed via storefront checkout.',
                    },
                  ],
          };
          setOrders((prev) => [orderWithTimeline, ...prev]);
          setCartItems([]);
          setAppliedCoupon(null);
          setAppliedCouponDetail(null);
          try {
            const adminOrdersRaw = localStorage.getItem('tori_admin_orders');
            const adminOrdersList = adminOrdersRaw ? JSON.parse(adminOrdersRaw) : [];
            const mappedAdminOrder = {
              orderId: order.orderId,
              orderNumber: `#${order.orderId}`,
              date: new Date().toISOString().split('T')[0],
              customerId: customer?.id || `cust-${Date.now()}`,
              customerName: order.shippingAddress.fullName || customer?.name || 'Customer',
              customerEmail: order.shippingAddress.email || customer?.email || 'customer@toriwear.com',
              customerPhone: order.shippingAddress.phone || customer?.phone || '9876543210',
              shippingAddress: {
                fullName: order.shippingAddress.fullName,
                addressLine1: order.shippingAddress.addressLine1,
                city: order.shippingAddress.city,
                state: order.shippingAddress.state,
                pincode: order.shippingAddress.pincode,
              },
              items: order.items.map((it: any) => ({
                productId: it.product?.id || `prod-${Math.random()}`,
                productName: it.product?.name || 'Anime Streetwear',
                variantId: `${it.product?.id || 'p'}-${it.size}-${it.color}`,
                sku: it.product?.catalogNumber || `SKU-${it.product?.id || 'TORI'}`,
                size: it.size,
                color: it.color,
                image: it.product?.images?.[0] || '',
                quantity: it.quantity || 1,
                unitPrice: it.product?.price || 0,
                totalPrice: (it.product?.price || 0) * (it.quantity || 1),
              })),
              subtotal: order.subtotal,
              discount: order.discount,
              discountCode: order.discountCode,
              tax: Math.round(order.subtotal * 0.05),
              shippingFee: order.shipping,
              total: order.total,
              paymentMethod: order.paymentMethod === 'upi' ? 'UPI' : order.paymentMethod === 'cod' ? 'COD' : 'Credit Card',
              paymentStatus: order.paymentMethod === 'cod' ? 'PENDING' : 'PAID',
              fulfillmentStatus: 'CONFIRMED',
              timeline: [
                {
                  status: 'CONFIRMED',
                  timestamp: 'Just now',
                  description: 'Order placed & confirmed via storefront checkout.',
                },
              ],
            };
            const updatedAdminOrders = [mappedAdminOrder, ...adminOrdersList];
            localStorage.setItem('tori_admin_orders', JSON.stringify(updatedAdminOrders));
            window.dispatchEvent(new CustomEvent('tori_admin_orders_updated', { detail: updatedAdminOrders }));
          } catch (e) {
            console.error('Error syncing order to admin:', e);
          }
        }}
      />

      {/* Size Guide Modal (Men & Kids Tabs) */}
      <SizeGuideModal
        isOpen={isSizeGuideOpen}
        onClose={() => setIsSizeGuideOpen(false)}
        initialDepartment={sizeGuideDept}
      />

      {/* Order Tracking Modal */}
      <OrderTrackingModal
        isOpen={isTrackingOpen}
        onClose={() => {
          setIsTrackingOpen(false);
          setTrackingOrderId(undefined);
        }}
        recentOrders={orders}
        onCancelOrder={handleCancelOrder}
        initialOrderId={trackingOrderId}
      />

      {/* Brand Story Modal */}
      <BrandStoryModal
        isOpen={isStoryOpen}
        onClose={() => setIsStoryOpen(false)}
      />

      {/* Live Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        products={storefrontCatalog}
        onSelectProduct={(prod) => setSelectedProductDetail(prod)}
      />

      {/* Email Promo Code Popup (TORI100) */}
      <PromoBannerPopup
        isOpen={isPromoOpen}
        onClose={() => setIsPromoOpen(false)}
        onApplyCoupon={(code) => handleApplyCoupon(code)}
      />

      {/* Customer Authentication Modal (Phone OTP / Email OTP / Password) */}
      <CustomerAuthModal />

      {/* Customer Account & Saved Items Modals (Gift Cards, Insider, Credit, Coupons, Addresses, Order History) */}
      <CustomerAccountModals 
        onApplyCoupon={handleApplyCoupon} 
        orders={orders}
        onOpenTrackOrder={(id) => {
          setTrackingOrderId(id);
          setIsTrackingOpen(true);
        }}
        onReorder={handleReorder}
      />

      {/* Customer Wishlist Modal View */}
      <WishlistModal
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        wishlistIds={wishlist}
        allProducts={storefrontCatalog}
        recentlyViewedIds={recentlyViewed}
        onToggleWishlist={(prod) => handleToggleWishlist(prod)}
        onSelectProduct={(prod) => {
          setSelectedProductDetail(prod);
          setIsWishlistOpen(false);
        }}
        onAddToCart={(prod, size) => handleAddToCart(prod, size, prod.colors[0]?.name || 'Black')}
        onClearRecent={handleClearRecentlyViewed}
        onContinueShopping={() => {
          setIsWishlistOpen(false);
          if (activeDepartment === 'ALL') {
            handleSelectDepartment('MEN');
          } else {
            scrollToSection(activeDepartment === 'KIDS' ? 'shop-kids-section' : 'shop-men-section');
          }
        }}
      />

      {/* Side-by-Side Product Comparison Modal */}
      <ProductCompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        allProducts={storefrontCatalog}
        selectedProducts={compareSlots}
        onSelectSlot={handleSelectCompareSlot}
        onSwapSlots={handleSwapCompareSlots}
        onAddToCart={handleAddToCart}
        onOpenProductDetail={(prod) => handleOpenProductDetail(prod)}
      />

      {/* Customer Contact Popup Modal */}
      <ContactSupportModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />

      {/* Single Consolidated Bottom-Right Support Widget */}
      <SupportFloatingWidget onOpenContact={() => setIsContactModalOpen(true)} />

      {/* Toast Floating Notification */}
      {toastMessage && (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#161622] border border-neutral-700/90 text-white text-xs font-mono px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 select-none">
          <span className="w-2 h-2 rounded-full bg-[#FF2028] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Always locked at bottom on mobile) */}
      <MobileBottomNav
        cartCount={totalCartCount}
        wishlistCount={wishlist.length}
        activeDepartment={activeDepartment}
        onNavigateHome={handleNavigateHome}
        onSelectDepartment={(dept) => {
          handleSelectDepartment(dept);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        onOpenCart={() => setIsCartOpen(true)}
      />
    </div>
  );
}
