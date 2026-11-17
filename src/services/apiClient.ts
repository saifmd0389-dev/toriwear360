/**
 * TORIWEAR Client-Side API Service
 * 
 * Interacts with the production-grade PostgreSQL persistence backend.
 * Provides resilient fallbacks if the server is temporarily booting.
 */

import { Product } from '../types';
import { AdminProduct, InventoryItem } from '../admin/types';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  order?: any;
  quote?: any;
  count?: number;
  error?: string;
  message?: string;
  [key: string]: any;
}

const API_BASE = '/api/v1';

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    // Try staff session token if present
    const staffSession = localStorage.getItem('tori_staff_session');
    if (staffSession) {
      const parsed = JSON.parse(staffSession);
      if (parsed?.token) {
        headers['Authorization'] = `Bearer ${parsed.token}`;
      }
    }

    const legacyToken = localStorage.getItem('tori_admin_session_token') || sessionStorage.getItem('tori_admin_session_token');
    if (!headers['Authorization'] && legacyToken) {
      headers['Authorization'] = `Bearer ${legacyToken}`;
    }
  } catch {}

  return headers;
}

const CUSTOMER_SESSION_KEY = 'tori_customer_session_token';
const ORDER_TOKENS_KEY = 'tori_order_tokens';

export function getCustomerSessionToken(): string | null {
  try {
    return localStorage.getItem(CUSTOMER_SESSION_KEY);
  } catch {
    return null;
  }
}

export function setCustomerSessionToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(CUSTOMER_SESSION_KEY, token);
    } else {
      localStorage.removeItem(CUSTOMER_SESSION_KEY);
    }
  } catch {}
}

export function saveOrderAccessToken(orderKeys: (string | undefined)[], token?: string) {
  if (!token) return;
  try {
    const raw = localStorage.getItem(ORDER_TOKENS_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    for (const k of orderKeys) {
      if (k && typeof k === 'string') {
        map[k.trim().toUpperCase()] = token;
      }
    }
    localStorage.setItem(ORDER_TOKENS_KEY, JSON.stringify(map));
  } catch {}
}

export function getOrderAccessToken(orderKey?: string): string | undefined {
  if (!orderKey) return undefined;
  try {
    const raw = localStorage.getItem(ORDER_TOKENS_KEY);
    if (!raw) return undefined;
    const map = JSON.parse(raw);
    return map[orderKey.trim().toUpperCase()] || map[orderKey.trim()];
  } catch {
    return undefined;
  }
}

function getCustomerHeaders(orderKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const customerToken = getCustomerSessionToken();
  if (customerToken) {
    headers['Authorization'] = `Bearer ${customerToken}`;
    headers['x-customer-session'] = customerToken;
  }
  const orderToken = getOrderAccessToken(orderKey);
  if (orderToken) {
    headers['x-order-token'] = orderToken;
  }
  return headers;
}

async function safeParseJson<T = any>(res: Response): Promise<{ okJson: boolean; data?: T; isHtml?: boolean; rawSnippet?: string }> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  const trimmed = text.trim();
  const looksHtml =
    trimmed.startsWith('<!') ||
    trimmed.startsWith('<html') ||
    contentType.includes('text/html');

  if (!trimmed) {
    return { okJson: false, isHtml: looksHtml, rawSnippet: '' };
  }

  if (looksHtml) {
    return { okJson: false, isHtml: true, rawSnippet: trimmed.slice(0, 120) };
  }

  try {
    const parsed = JSON.parse(text) as T;
    return { okJson: true, data: parsed };
  } catch {
    return { okJson: false, isHtml: false, rawSnippet: trimmed.slice(0, 120) };
  }
}

async function fetchJsonWithRetry<T = any>(
  url: string,
  init: RequestInit = {},
  retryDelaysMs: number[] = [450, 1100]
): Promise<{ res: Response; json: T }> {
  let lastError: Error | null = null;
  const maxAttempts = retryDelaysMs.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const headers = new Headers(init.headers || {});
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
      }

      const res = await fetch(url, { ...init, headers });
      const parsed = await safeParseJson<T>(res);

      // Retry transient proxy/gateway/server-boot responses (502/503/504 or HTML interstitials)
      if ((parsed.isHtml || !parsed.okJson || res.status === 502 || res.status === 503 || res.status === 504) && attempt < maxAttempts - 1) {
        const delay = retryDelaysMs[attempt] ?? 600;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (parsed.isHtml || !parsed.okJson) {
        throw new Error(
          parsed.isHtml
            ? `Server returned an HTML splash/boot page instead of JSON (HTTP ${res.status})`
            : `Server returned invalid JSON payload (HTTP ${res.status})`
        );
      }

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      return { res, json: parsed.data as T };
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err || 'Network error'));
      if (attempt < maxAttempts - 1) {
        const delay = retryDelaysMs[attempt] ?? 600;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error('Failed to retrieve JSON from backend');
}

export const apiClient = {
  // ==========================================
  // Storefront Catalog APIs
  // ==========================================
  async getProducts(params?: {
    department?: string;
    world?: string;
    status?: string;
    categoryId?: string;
    collectionSlug?: string;
    search?: string;
  }): Promise<Product[]> {
    const query = new URLSearchParams();
    if (params?.department && params.department !== 'ALL') query.set('department', params.department);
    if (params?.world && params.world !== 'ALL') query.set('world', params.world);
    if (params?.status) query.set('status', params.status);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.collectionSlug) query.set('collectionSlug', params.collectionSlug);
    if (params?.search) query.set('search', params.search);

    const endpointUrl = `${API_BASE}/products?${query.toString()}`;
    console.log('[apiClient.getProducts] 🚀 Requesting products from backend:', {
      endpoint: endpointUrl,
      filterParams: params,
      timestamp: new Date().toISOString(),
    });

    try {
      const { json } = await fetchJsonWithRetry<ApiResponse<any[]>>(endpointUrl);
      const rawProducts = (json.data as Product[]) || [];

      console.log('[apiClient.getProducts] ✅ Backend response received:', {
        success: json.success,
        count: json.count ?? rawProducts.length,
        receivedCount: rawProducts.length,
      });

      return rawProducts;
    } catch (err: any) {
      console.warn('[apiClient.getProducts] ⚠️ Transient failure retrieving products from backend:', {
        error: err.message,
        endpoint: endpointUrl,
      });
      throw err;
    }
  },

  async getProductByIdOrSlug(identifier: string): Promise<Product | null> {
    try {
      const { json } = await fetchJsonWithRetry<ApiResponse<Product>>(
        `${API_BASE}/products/${encodeURIComponent(identifier)}`,
        {},
        [400]
      );
      return json.data || null;
    } catch (err) {
      console.warn('[API Client] Error fetching product:', err);
      return null;
    }
  },

  async getFeaturedProducts(): Promise<Product[]> {
    try {
      const { json } = await fetchJsonWithRetry<ApiResponse<Product[]>>(`${API_BASE}/products/featured`, {}, [400]);
      return json.data || [];
    } catch {
      return [];
    }
  },

  async getNewArrivals(department?: string): Promise<Product[]> {
    try {
      const q = department && department !== 'ALL' ? `?department=${department}` : '';
      const { json } = await fetchJsonWithRetry<ApiResponse<Product[]>>(`${API_BASE}/products/new-arrivals${q}`, {}, [400]);
      return json.data || [];
    } catch {
      return [];
    }
  },

  async getTopSelling(department?: string): Promise<Product[]> {
    try {
      const q = department && department !== 'ALL' ? `?department=${department}` : '';
      const { json } = await fetchJsonWithRetry<ApiResponse<Product[]>>(`${API_BASE}/products/top-selling${q}`, {}, [400]);
      return json.data || [];
    } catch {
      return [];
    }
  },

  async getCategories(department?: string): Promise<any[]> {
    try {
      const q = department && department !== 'ALL' ? `?department=${department}` : '';
      const { json } = await fetchJsonWithRetry<ApiResponse<any[]>>(`${API_BASE}/categories${q}`, {}, [400]);
      return json.data || [];
    } catch {
      return [];
    }
  },

  async getCollections(): Promise<any[]> {
    try {
      const { json } = await fetchJsonWithRetry<ApiResponse<any[]>>(`${API_BASE}/collections`, {}, [400]);
      return json.data || [];
    } catch {
      return [];
    }
  },

  // ==========================================
  // Admin Product Management APIs
  // ==========================================
  async getAdminProducts(): Promise<ApiResponse<AdminProduct[]>> {
    try {
      const res = await fetch(`${API_BASE}/admin/products`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json: ApiResponse<AdminProduct[]> = await res.json();
      return json;
    } catch (err: any) {
      console.warn('[API Client] Error fetching admin products:', err);
      return { success: false, error: err.message || 'Failed to fetch admin products', data: [] };
    }
  },

  async adminCreateProduct(productData: Partial<AdminProduct>): Promise<ApiResponse<AdminProduct>> {
    try {
      const res = await fetch(`${API_BASE}/admin/products`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(productData),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Network request failed' };
    }
  },

  async adminUpdateProduct(id: string, updates: Partial<AdminProduct>): Promise<ApiResponse<AdminProduct>> {
    try {
      const res = await fetch(`${API_BASE}/admin/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Network request failed' };
    }
  },

  async adminArchiveProduct(id: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/admin/products/${encodeURIComponent(id)}/archive`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Network request failed' };
    }
  },

  async adminRestoreProduct(id: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/admin/products/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Network request failed' };
    }
  },

  async adminDeleteProduct(id: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/admin/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tori-admin-session-expired'));
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: json.error || `HTTP error ${res.status}` };
      }
      return json;
    } catch (err: any) {
      return { success: false, error: err.message || 'Network request failed' };
    }
  },

  async adminClearAllProducts(): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/admin/products/clear-all`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tori-admin-session-expired'));
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: json.error || `HTTP error ${res.status}` };
      }
      return json;
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to clear products' };
    }
  },

  // ==========================================
  // Inventory APIs
  // ==========================================
  async getInventory(): Promise<InventoryItem[]> {
    try {
      const res = await fetch(`${API_BASE}/inventory`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json: ApiResponse<InventoryItem[]> = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  },

  async updateStock(variantId: string, newStock: number, reason?: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/inventory/${encodeURIComponent(variantId)}/stock`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ newStock, reason }),
      });
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tori-admin-session-expired'));
      }
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Stock update failed' };
    }
  },

  async deleteInventoryItem(variantId: string, reason?: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/inventory/${encodeURIComponent(variantId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason }),
      });
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tori-admin-session-expired'));
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: json.error || `HTTP error ${res.status}` };
      }
      return json;
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete inventory record' };
    }
  },

  async bulkDeleteInventory(
    targetIds: string[],
    reason?: string
  ): Promise<
    ApiResponse<any> & {
      deletedCount?: number;
      deletedVariantIds?: string[];
      deletedSkus?: string[];
      removedProductIds?: string[];
      modifiedProductIds?: string[];
      message?: string;
    }
  > {
    try {
      const res = await fetch(`${API_BASE}/inventory/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ targetIds, reason }),
      });
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tori-admin-session-expired'));
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: json.error || `Bulk delete failed (HTTP ${res.status})` };
      }
      return json;
    } catch (err: any) {
      return { success: false, error: err.message || 'Bulk delete network error' };
    }
  },

  async syncInventoryFromCatalog(): Promise<ApiResponse<InventoryItem[]> & { addedCount?: number; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/inventory/sync-catalog`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tori-admin-session-expired'));
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: json.error || `Sync failed (HTTP ${res.status})` };
      }
      return json;
    } catch (err: any) {
      return { success: false, error: err.message || 'Inventory sync network error' };
    }
  },

  // ==========================================
  // Orders & Payment Security APIs (Phase 4)
  // ==========================================
  async calculateOrderQuote(quotePayload: {
    items: Array<{ productId: string; variantId?: string; size?: string; color?: string; quantity: number }>;
    couponCode?: string;
    shippingPincode?: string;
    state?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/orders/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quotePayload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Pricing quote failed' };
    }
  },

  async createOrder(orderPayload: any): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: getCustomerHeaders(),
        body: JSON.stringify(orderPayload),
      });
      const json = await res.json();
      if (json?.success && json?.order) {
        const token = json.orderAccessToken || json.order.orderAccessToken;
        saveOrderAccessToken([json.order.id, json.order.orderNumber], token);
      }
      return json;
    } catch (err: any) {
      return { success: false, error: err.message || 'Order creation failed' };
    }
  },

  async trackOrder(
    identifier: string,
    verification?: { phone?: string; email?: string; orderToken?: string; awbOnly?: boolean }
  ): Promise<ApiResponse<any> & { code?: string }> {
    try {
      const clean = identifier.trim();
      const params = new URLSearchParams();
      if (verification?.awbOnly) {
        params.set('awb', clean);
      } else {
        params.set('orderId', clean);
      }
      if (verification?.phone) params.set('phone', verification.phone.trim());
      if (verification?.email) params.set('email', verification.email.trim());
      const headers = getCustomerHeaders(clean);
      if (verification?.orderToken) {
        headers['x-order-token'] = verification.orderToken.trim();
      }
      const res = await fetch(`${API_BASE}/orders/track?${params.toString()}`, {
        headers,
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to track order' };
    }
  },

  async getOrder(orderId: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}`, {
        headers: getCustomerHeaders(orderId),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch order' };
    }
  },

  async getCustomerOrders(customerId: string, email?: string, phone?: string): Promise<ApiResponse<any>> {
    try {
      const params = new URLSearchParams();
      if (email) params.append('email', email);
      if (phone) params.append('phone', phone);
      const url = `${API_BASE}/orders/customer/${encodeURIComponent(customerId)}?${params.toString()}`;
      const res = await fetch(url, {
        headers: getCustomerHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch customer orders' };
    }
  },

  async cancelOrder(orderId: string, reason: string, customerName?: string): Promise<ApiResponse<any>> {
    try {
      const headers = getCustomerHeaders(orderId);
      const orderToken = getOrderAccessToken(orderId);
      const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason, customerName, orderToken }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to cancel order' };
    }
  },

  async getAdminOrders(filter?: { status?: string; search?: string; customerId?: string }): Promise<ApiResponse<any>> {
    try {
      const params = new URLSearchParams();
      if (filter?.status) params.append('status', filter.status);
      if (filter?.search) params.append('search', filter.search);
      if (filter?.customerId) params.append('customerId', filter.customerId);
      const res = await fetch(`${API_BASE}/admin/orders?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch admin orders' };
    }
  },

  async getAdminOrder(orderId: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${encodeURIComponent(orderId)}`, {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch order details' };
    }
  },

  async updateAdminOrderStatus(
    orderId: string,
    status: string,
    note?: string,
    courierInfo?: { courierPartner?: string; trackingNumber?: string }
  ): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status,
          note,
          courierPartner: courierInfo?.courierPartner,
          trackingNumber: courierInfo?.trackingNumber,
        }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update order status' };
    }
  },

  async cancelAdminOrder(orderId: string, reason: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to cancel order' };
    }
  },

  async refundAdminOrder(orderId: string, amount: number, reason: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${encodeURIComponent(orderId)}/refund`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ amount, reason }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to refund order' };
    }
  },

  async validateCoupon(
    code: string,
    subtotal?: number,
    context?: {
      items?: Array<{ productId: string; quantity: number; unitPrice?: number }>;
      customerId?: string;
      customerEmail?: string;
      customerPhone?: string;
    }
  ): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/coupons/validate`, {
        method: 'POST',
        headers: getCustomerHeaders(),
        body: JSON.stringify({
          code: String(code || '').trim().toUpperCase(),
          subtotal: subtotal ?? 0,
          items: context?.items,
          customerId: context?.customerId,
          customerEmail: context?.customerEmail,
          customerPhone: context?.customerPhone,
        }),
      });
      const parsed = await safeParseJson<any>(res);
      const json = parsed.data;
      if (!parsed.okJson || !json) {
        return {
          success: false,
          valid: false,
          error: 'Promo validation service temporarily unavailable. Please try again.',
        };
      }
      if (json?.data) {
        return {
          success: Boolean(json.data.valid),
          valid: Boolean(json.data.valid),
          code: json.data.code,
          discountType: json.data.discountType,
          value: json.data.value,
          maxDiscount: json.data.maxDiscount,
          minOrderValue: json.data.minOrderValue,
          discountAmount: json.data.discountAmount ?? json.data.calculatedDiscount ?? 0,
          calculatedDiscount: json.data.calculatedDiscount ?? json.data.discountAmount ?? 0,
          eligibleSubtotal: json.data.eligibleSubtotal,
          excludeShipping: json.data.excludeShipping,
          excludeTax: json.data.excludeTax,
          description: json.data.description,
          error: json.data.reason,
          data: json.data,
        };
      }
      return json;
    } catch (err: any) {
      return { success: false, valid: false, error: err.message || 'Coupon validation failed' };
    }
  },

  // ==========================================
  // Early Access Registration & Notifications
  // ==========================================
  async registerEarlyAccess(payload: {
    email?: string;
    whatsappNumber?: string;
    channel: 'EMAIL' | 'WHATSAPP' | 'BOTH';
    emailConsent: boolean;
    whatsappConsent: boolean;
    registrationSource?: string;
  }): Promise<ApiResponse<any> & { statusCode?: number; code?: string }> {
    try {
      const res = await fetch(`${API_BASE}/early-access/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      return {
        success: Boolean(res.ok && json?.success),
        statusCode: res.status,
        ...json,
      };
    } catch (err: any) {
      return {
        success: false,
        statusCode: 503,
        code: 'NETWORK_ERROR',
        error: err?.message || 'Unable to reach server. Please check your connection and try again.',
      };
    }
  },

  async subscribeNewsletter(payload: {
    email: string;
    emailConsent: boolean;
    registrationSource?: string;
  }): Promise<ApiResponse<any> & { statusCode?: number; code?: string }> {
    try {
      const res = await fetch(`${API_BASE}/early-access/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      return {
        success: Boolean(res.ok && json?.success),
        statusCode: res.status,
        ...json,
      };
    } catch (err: any) {
      return {
        success: false,
        statusCode: 503,
        code: 'NETWORK_ERROR',
        error: err?.message || 'Unable to reach server. Please check your connection and try again.',
      };
    }
  },

  async getEarlyAccessStats(): Promise<ApiResponse<any> & { statusCode?: number; dbReady?: boolean; providers?: any }> {
    try {
      const res = await fetch(`${API_BASE}/admin/early-access/stats`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      return { statusCode: res.status, ...json };
    } catch (err: any) {
      return { success: false, statusCode: 503, dbReady: false, error: err?.message || 'Request failed' };
    }
  },

  async getEarlyAccessSubscribers(params?: {
    search?: string;
    channel?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any> & { statusCode?: number }> {
    try {
      const q = new URLSearchParams();
      if (params?.search) q.set('search', params.search);
      if (params?.channel && params.channel !== 'ALL') q.set('channel', params.channel);
      if (params?.status && params.status !== 'ALL') q.set('status', params.status);
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      const res = await fetch(`${API_BASE}/admin/early-access/subscribers?${q.toString()}`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      return { statusCode: res.status, ...json };
    } catch (err: any) {
      return { success: false, statusCode: 503, error: err?.message || 'Failed to fetch subscribers' };
    }
  },

  async exportEarlyAccessCsv(params?: { search?: string; channel?: string; status?: string }): Promise<{
    success: boolean;
    csv?: string;
    error?: string;
  }> {
    try {
      const q = new URLSearchParams();
      if (params?.search) q.set('search', params.search);
      if (params?.channel && params.channel !== 'ALL') q.set('channel', params.channel);
      if (params?.status && params.status !== 'ALL') q.set('status', params.status);
      const res = await fetch(`${API_BASE}/admin/early-access/subscribers/export?${q.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        return { success: false, error: json?.error || `Export failed (HTTP ${res.status})` };
      }
      const csv = await res.text();
      return { success: true, csv };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Export request failed' };
    }
  },

  async getEarlyAccessCampaigns(): Promise<ApiResponse<any[]>> {
    try {
      const res = await fetch(`${API_BASE}/admin/early-access/campaigns`, {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to load campaigns', data: [] };
    }
  },

  async createEarlyAccessCampaign(payload: {
    name: string;
    channels: 'EMAIL' | 'WHATSAPP' | 'BOTH';
    subject?: string;
    emailText?: string;
    emailHtml?: string;
    whatsappTemplateName?: string;
    whatsappTemplateLang?: string;
    whatsappVariables?: string[];
  }): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/admin/early-access/campaigns`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create campaign draft' };
    }
  },

  async sendTestEarlyAccessCampaign(
    campaignId: string,
    payload: { testEmail?: string; testWhatsappNumber?: string }
  ): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(`${API_BASE}/admin/early-access/campaigns/${encodeURIComponent(campaignId)}/test`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Test send failed' };
    }
  },

  async confirmSendEarlyAccessCampaign(campaignId: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(
        `${API_BASE}/admin/early-access/campaigns/${encodeURIComponent(campaignId)}/confirm-send`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ confirmSend: true }),
        }
      );
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to start campaign send' };
    }
  },

  async retryFailedEarlyAccessCampaign(campaignId: string): Promise<ApiResponse<any>> {
    try {
      const res = await fetch(
        `${API_BASE}/admin/early-access/campaigns/${encodeURIComponent(campaignId)}/retry-failed`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        }
      );
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to retry campaign deliveries' };
    }
  },

  async getEarlyAccessDeliveries(params?: {
    campaignId?: string;
    status?: string;
    channel?: string;
    page?: number;
  }): Promise<ApiResponse<any>> {
    try {
      const q = new URLSearchParams();
      if (params?.campaignId) q.set('campaignId', params.campaignId);
      if (params?.status && params.status !== 'ALL') q.set('status', params.status);
      if (params?.channel && params.channel !== 'ALL') q.set('channel', params.channel);
      if (params?.page) q.set('page', String(params.page));
      const res = await fetch(`${API_BASE}/admin/early-access/deliveries?${q.toString()}`, {
        headers: getAuthHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to load deliveries' };
    }
  },
};
