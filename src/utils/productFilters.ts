import { Product, ProductStatus, Department, WorldCategory } from '../types';
import { AdminProduct } from '../admin/types';

/**
 * Validates whether an image URL is a valid, non-placeholder product image.
 * Accepts web URLs (http/https), base64 data URLs, and relative asset paths (/assets, /generated-assets).
 */
export function isValidProductImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  let trimmed = url.trim();
  if (!trimmed) return false;

  // Normalize unsplash URLs or domains missing protocol
  if (trimmed.startsWith('images.unsplash.com') || trimmed.startsWith('plus.unsplash.com')) {
    trimmed = `https://${trimmed}`;
  }

  // Must start with http://, https://, data:image/, or local relative path (/ or ./)
  const isWebUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://');
  const isDataUrl = trimmed.startsWith('data:image/');
  const isRelativeUrl = trimmed.startsWith('/') || trimmed.startsWith('./');

  if (!isWebUrl && !isDataUrl && !isRelativeUrl) {
    return false;
  }

  // Reject obvious placeholder/broken URLs
  const lower = trimmed.toLowerCase();
  if (lower.includes('placeholder.com') || lower.includes('via.placeholder') || lower.includes('dummyimage.com') || lower.includes('example.com/image')) {
    return false;
  }

  return true;
}

/**
 * Validates that a product has verified product images before being eligible for publishing.
 */
export function hasValidProductImages(product: Product | AdminProduct): boolean {
  if (!product || !Array.isArray(product.images) || product.images.length === 0) {
    return false;
  }
  return product.images.some(isValidProductImageUrl);
}

/**
 * Universal publishing check: returns true ONLY if product is legitimately PUBLISHED
 * by an administrator and has verified product images.
 * Excludes DRAFT, REVIEW, APPROVED, SCHEDULED, ARCHIVED, and legacy demo products at the data level.
 */
export function isPublishedProduct(product: Product | null | undefined): boolean {
  if (!product) {
    console.log('[isPublishedProduct] ❌ Excluded: product is null or undefined');
    return false;
  }

  // 1. Exclude legacy demos or sample data
  if (product.franchise === 'LEGACY DEMO') {
    console.log(`[isPublishedProduct] ❌ Excluded "${product.name}" (${product.id}): franchise is LEGACY DEMO`);
    return false;
  }

  // 2. Strict Admin PublishingStatus check
  if (product.publishingStatus) {
    if (product.publishingStatus !== 'PUBLISHED') {
      console.log(`[isPublishedProduct] ❌ Excluded "${product.name}" (${product.id}): publishingStatus is "${product.publishingStatus}" (expected PUBLISHED)`);
      return false;
    }
  }

  // 3. Product status string check (DRAFT, REVIEW, APPROVED, SCHEDULED, ARCHIVED)
  if (product.status) {
    const s = String(product.status).toUpperCase();
    if (
      s.includes('ARCHIVED') ||
      s.includes('LEGACY') ||
      s === 'DRAFT' ||
      s === 'REVIEW' ||
      s === 'APPROVED' ||
      s === 'SCHEDULED'
    ) {
      console.log(`[isPublishedProduct] ❌ Excluded "${product.name}" (${product.id}): status is "${s}" (expected PUBLISHED)`);
      return false;
    }
  }

  // 4. Require valid, non-placeholder product images
  if (!hasValidProductImages(product)) {
    console.log(`[isPublishedProduct] ❌ Excluded "${product.name}" (${product.id}): No valid product images found in`, product.images);
    return false;
  }

  return true;
}

/**
 * Filters a list of products to return ONLY real, published products.
 */
export function getPublishedProducts(products: Product[]): Product[] {
  if (!Array.isArray(products)) return [];
  return products.filter(isPublishedProduct);
}

/**
 * Convert an AdminProduct to a customer-facing storefront Product.
 */
export function adminProductToStorefrontProduct(admin: AdminProduct): Product {
  const department: Department = admin.department === 'KIDS' || admin.universe === 'KIDS' ? 'KIDS' : 'MEN';
  const world: WorldCategory = (admin.world as WorldCategory) || 
    (admin.franchise as any) || 
    (department === 'KIDS' ? 'CUTE ADVENTURE' : 'DARK SHONEN');

  const colorsMap: Record<string, string> = {};
  (admin.variants || []).forEach((v) => {
    if (v.colorName) {
      colorsMap[v.colorName] = v.colorHex || '#111116';
    }
  });

  const colors = Object.keys(colorsMap).map((name) => ({
    name,
    hex: colorsMap[name] || '#111116',
  }));

  const sizes = Array.from(new Set((admin.variants || []).map((v) => v.size)));
  const totalStock = (admin.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0);

  return {
    id: admin.id,
    catalogNumber: admin.catalogNumber || '00',
    name: admin.name,
    department,
    world,
    franchise: admin.franchise,
    universe: (admin.universe as any) || department,
    fit: admin.fit || (department === 'KIDS' ? 'Comfort Fit' : 'Oversized'),
    price: admin.price,
    originalPrice: admin.mrp || Math.round(admin.price * 1.3),
    rating: admin.rating || 5.0,
    reviewsCount: admin.reviewsCount || 0,
    images: admin.images && admin.images.length > 0 
      ? admin.images 
      : ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80'],
    description: admin.description || '',
    storyQuote: admin.storyQuote || 'Wear Your World.',
    drop: admin.drop || 'CHAPTER 01 — ORIGINALS',
    gsm: admin.gsm || (department === 'KIDS' ? 180 : 240),
    fabric: admin.fabric || '100% Combed Heavyweight Cotton',
    neck: admin.neck || 'High-Ribbed Crewneck',
    sleeves: admin.sleeves || 'Drop Shoulder Half Sleeves',
    print: admin.print || 'High-Density Screen Print',
    colors: colors.length > 0 ? colors : [{ name: 'Obsidian Black', hex: '#111116' }],
    sizes: sizes.length > 0 ? sizes : (department === 'KIDS' ? ['4–5Y', '6–7Y', '8–9Y'] : ['S', 'M', 'L', 'XL', 'XXL']),
    isBestseller: (admin.totalSold || 0) > 100,
    isNewDrop: true,
    isTrending: (admin.totalSold || 0) > 50,
    inStock: totalStock > 0,
    stock: totalStock,
    licenseType: admin.licenseRightsStatus === 'Owned IP' ? 'Original IP' : 'Licensed Partner',
    status: (admin.publishingStatus || 'PUBLISHED') as ProductStatus,
    publishingStatus: admin.publishingStatus || 'PUBLISHED',
    sku: admin.sku || `SKU-${admin.catalogNumber || admin.id}`,
    variants: (admin.variants || []).map(v => ({
      id: v.id,
      productId: admin.id,
      sku: v.sku,
      size: v.size,
      colorName: v.colorName,
      colorHex: v.colorHex,
      price: v.price,
      originalPrice: admin.mrp || Math.round(v.price * 1.3),
      stock: v.stock,
      reservedStock: v.reserved || 0,
      isActive: true,
    })),
  };
}

/**
 * Loads the active storefront product catalog:
 * Merges base products with live admin products stored in localStorage (`tori_admin_products`).
 * Automatically preserves custom products and filters strictly to PUBLISHED items.
 */
export function getStorefrontCatalog(baseProducts: Product[]): Product[] {
  console.log('[getStorefrontCatalog] 📥 Processing input catalog. baseProducts count:', baseProducts.length);

  // If baseProducts are provided from the authoritative backend API (count > 0)
  if (Array.isArray(baseProducts) && baseProducts.length > 0) {
    const normalized = baseProducts.map((p) => {
      const rawStatus = p.status || p.publishingStatus || 'PUBLISHED';
      const status = String(rawStatus).toUpperCase() as ProductStatus;
      const publishingStatus = (p.publishingStatus || p.status || 'PUBLISHED') as any;

      return {
        ...p,
        status,
        publishingStatus,
        inStock: p.inStock ?? ((p.stock ?? 1) > 0),
        images: Array.isArray(p.images) ? p.images : [],
      };
    });

    const published = getPublishedProducts(normalized);
    console.log('[getStorefrontCatalog] 🏁 Authoritative backend catalog count:', published.length);
    return published;
  }

  // Fallback ONLY when backend products are completely empty (e.g. offline / network error)
  console.warn('[getStorefrontCatalog] ⚠️ Base products empty. Checking client fallback cache...');
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('tori_admin_products');
      if (stored) {
        const adminProducts: AdminProduct[] = JSON.parse(stored);
        if (Array.isArray(adminProducts) && adminProducts.length > 0) {
          const mapped = adminProducts.map(adminProductToStorefrontProduct);
          const published = getPublishedProducts(mapped);
          if (published.length > 0) {
            console.log('[getStorefrontCatalog] Loaded from localStorage cache fallback:', published.length);
            return published;
          }
        }
      }
    } catch (e) {
      console.warn('[StorefrontCatalog] ⚠️ Failed reading localStorage fallback:', e);
    }
  }

  return [];
}
