import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { checkDatabaseHealth, getPrismaClient } from '../db/prisma';
import { userService } from '../services/userService';
import { orderService } from '../services/orderService';
import { orderRepository, OrderRecord } from '../repositories/orderRepository';
import { paymentService } from '../services/paymentService';
import { shippingService } from '../services/shippingService';
import { shippingRepository } from '../repositories/shippingRepository';
import { couponRepository } from '../repositories/couponRepository';
import { customerRepository } from '../repositories/customerRepository';
import { productRepository, ProductRecord, ProductVariantRecord, CategoryRecord } from '../repositories/productRepository';
import { inventoryRepository } from '../repositories/inventoryRepository';
import { logisticsManager } from '../services/logistics/logisticsManager';
import { paymentConfigService } from '../services/paymentConfigService';
import { paymentRepository } from '../repositories/paymentRepository';
import { verifyFirebaseIdToken } from '../services/firebaseAuthService';
import { safeTimingEqual } from '../utils/storageHelper';
import { requireAuth, requireRole, extractSessionToken } from '../middleware/authMiddleware';
import { authStore } from '../authStore';
import { userStore } from '../userStore';
import { approvalStore } from '../approvalStore';
import { PlatformRole, ModuleName, PermissionAction } from '../rbacTypes';
import {
  validateLoginInput,
  validateCreateOrderInput,
  validateQuoteOrderInput,
  validateUpdateOrderStatusInput,
  validateCancelOrderInput,
  validatePaymentIntentInput,
  validatePaymentVerificationInput,
} from '../validation/schemas';

export const apiRouter = Router();

const ROLE_PERMISSION_FALLBACKS: Record<string, Record<string, PermissionAction[]>> = {
  STORE_MANAGER: {
    dashboard: ['view'],
    products: ['view', 'create', 'edit'],
    inventory: ['view', 'create', 'edit'],
    orders: ['view', 'create', 'edit', 'approve'],
    customers: ['view', 'create', 'edit'],
    marketing: ['view', 'create', 'edit'],
    catalog: ['view', 'create', 'edit'],
    shipping: ['view', 'create', 'edit'],
    finance: ['view'],
    superAdmin: ['view'],
  },
  INVENTORY_MANAGER: {
    dashboard: ['view'],
    products: ['view', 'create', 'edit'],
    inventory: ['view', 'create', 'edit', 'delete'],
    catalog: ['view', 'edit'],
    orders: ['view'],
  },
  FULFILLMENT_STAFF: {
    dashboard: ['view'],
    orders: ['view', 'edit'],
    shipping: ['view', 'create', 'edit'],
    inventory: ['view'],
  },
  DESIGNER: {
    dashboard: ['view'],
    products: ['view', 'create', 'edit'],
    catalog: ['view'],
    aiDesignLab: ['view', 'create', 'edit'],
  },
  SUPPORT_STAFF: {
    dashboard: ['view'],
    orders: ['view'],
    customers: ['view', 'edit'],
    customerSupport: ['view', 'edit'],
  },
  VIEWER: {
    dashboard: ['view'],
    products: ['view'],
    inventory: ['view'],
    orders: ['view'],
    customers: ['view'],
  },
};

function hasStaffPermission(user: any, permissionName?: string): boolean {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase();
  if (role === 'CUSTOMER') return false;
  if (role === 'SUPER_ADMIN') return true;
  if (!permissionName) return true;

  const [rawModule, rawAction = 'view'] = permissionName.split('.');
  let targetModule: ModuleName = (rawModule as ModuleName);
  let targetAction: PermissionAction = (rawAction as PermissionAction);

  // Map logical permission prefixes to RBAC GranularPermissions modules
  if (rawModule === 'settings') {
    targetModule = 'settings';
  } else if (rawModule === 'payments') {
    targetModule = 'finance';
  } else if (rawModule === 'refunds') {
    targetModule = 'finance';
    targetAction = 'approve';
  }
  if (rawAction === 'archive') {
    targetAction = 'delete';
  }

  const perms = user.permissions;
  if (role === 'PARTNER') {
    if (rawModule === 'settings') {
      return Boolean(
        perms?.settings?.includes(targetAction) || perms?.superAdmin?.includes(targetAction)
      );
    }
    return true;
  }

  if (perms && typeof perms === 'object') {
    const allowed: PermissionAction[] = perms[targetModule] || [];
    if (allowed.includes(targetAction)) return true;
    if (rawModule === 'settings' && (perms.superAdmin?.includes(targetAction) || (rawAction === 'view' && (perms.shipping?.includes('view') || perms.orders?.includes('view'))))) {
      return true;
    }
    if (rawModule === 'refunds' && perms.orders?.includes('approve')) {
      return true;
    }
    return false;
  }

  const roleDefaults = ROLE_PERMISSION_FALLBACKS[role];
  if (roleDefaults) {
    return Boolean(roleDefaults[targetModule]?.includes(targetAction));
  }
  return false;
}

function requireStaffPermission(permissionName?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = extractSessionToken(req);

    if (token) {
      let resolvedUser: any = null;
      const session = await userService.validateSession(token);
      if (session) {
        const storeUser = userStore.getUserById(session.user.id);
        resolvedUser = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role,
          permissions: storeUser?.permissions,
          department: session.user.department,
        };
      } else {
        const legacyUser = await authStore.getUserByTokenAsync(token);
        if (legacyUser) {
          resolvedUser = {
            id: legacyUser.id,
            email: legacyUser.email,
            name: legacyUser.name,
            role: legacyUser.role,
            permissions: legacyUser.permissions,
            department: legacyUser.department,
          };
        }
      }

      if (resolvedUser) {
        if (!hasStaffPermission(resolvedUser, permissionName)) {
          res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            error: `Access denied: Missing required permission (${permissionName || 'staff'}).`,
          });
          return;
        }
        req.user = resolvedUser;
        req.sessionToken = token;
        return next();
      }
    }

    res.status(401).json({
      success: false,
      code: 'UNAUTHENTICATED',
      error: 'Admin authentication required to perform this operation.',
    });
    return;
  };
}

async function resolveAuthenticatedCustomer(req: Request) {
  const token =
    extractSessionToken(req) ||
    (typeof req.headers['x-customer-session'] === 'string' ? req.headers['x-customer-session'].trim() : undefined);
  if (!token) return null;

  const prisma = getPrismaClient();
  if (!prisma?.session) return null;

  try {
    const sess = await prisma.session.findUnique({
      where: { token },
      include: { customer: { include: { addresses: true } } },
    });
    if (!sess || !sess.isValid || !sess.customerId || !sess.customer) return null;
    if (new Date(sess.expiresAt) < new Date()) {
      await prisma.session.update({ where: { id: sess.id }, data: { isValid: false } }).catch(() => {});
      return null;
    }
    if (sess.customer.status === 'SUSPENDED') return null;
    await prisma.session.update({ where: { id: sess.id }, data: { lastActiveAt: new Date() } }).catch(() => {});
    return await customerRepository.findById(sess.customerId);
  } catch {
    return null;
  }
}

function resolvePlatformActor(req: Request): { id: string; name: string; role: PlatformRole } {
  if (req.sessionToken) {
    const legacy = authStore.getUserByToken(req.sessionToken);
    if (legacy) {
      return { id: legacy.id, name: legacy.name, role: legacy.role };
    }
  }
  const rawRole = (req.user?.role || 'STAFF').toUpperCase();
  const role: PlatformRole =
    rawRole === 'SUPER_ADMIN' || rawRole === 'PARTNER' ? rawRole : 'STAFF';
  return {
    id: req.user?.id || 'usr-admin',
    name: req.user?.name || req.user?.email || 'Admin Operator',
    role,
  };
}

function normalizeVariantsAndTaxonomy(
  rawVariants: unknown,
  fallbackColors: { name: string; hex: string }[],
  fallbackSizes: string[],
  department: string
): {
  variants: ProductVariantRecord[] | undefined;
  colors: { name: string; hex: string }[];
  sizes: string[];
} {
  if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
    return {
      variants: Array.isArray(rawVariants) ? [] : undefined,
      colors: fallbackColors,
      sizes: fallbackSizes,
    };
  }

  const defaultWeight = department === 'KIDS' ? 200 : 340;
  const colorMap = new Map<string, { name: string; hex: string }>();
  const sizeSet = new Set<string>();

  const normalizedVariants: ProductVariantRecord[] = rawVariants.map((v: any) => {
    const colorName = String(v?.colorName || 'Obsidian Black').trim() || 'Obsidian Black';
    const colorHex = String(v?.colorHex || '#111115').trim() || '#111115';
    const size = String(v?.size || 'M').trim() || 'M';
    const parsedWeight = Number(v?.weightGrams);
    const weightGrams = !isNaN(parsedWeight) && parsedWeight > 0 ? Math.round(parsedWeight) : defaultWeight;

    const colorKey = colorName.toLowerCase();
    if (!colorMap.has(colorKey)) {
      colorMap.set(colorKey, { name: colorName, hex: colorHex });
    }
    sizeSet.add(size);

    return {
      ...v,
      colorName,
      colorHex,
      size,
      stock: Number(v?.stock ?? 0),
      reservedStock: Number(v?.reservedStock ?? v?.reserved ?? 0),
      weightGrams,
      isActive: v?.isActive !== false,
    };
  });

  return {
    variants: normalizedVariants,
    colors: colorMap.size > 0 ? Array.from(colorMap.values()) : fallbackColors,
    sizes: sizeSet.size > 0 ? Array.from(sizeSet) : fallbackSizes,
  };
}

// ============================================================================
// 1. SYSTEM HEALTH & DATABASE ARCHITECTURE STATUS
// ============================================================================
apiRouter.get('/health', async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();
  res.json({
    status: 'HEALTHY',
    service: 'TORIWEAR Backend & Persistence Engine',
    timestamp: new Date().toISOString(),
    database: dbHealth,
    environment: process.env.NODE_ENV || 'development',
    serverUptimeSeconds: Math.floor(process.uptime()),
  });
});

// ============================================================================
// 2. PRODUCTION AUTHENTICATION & SESSIONS
// ============================================================================
apiRouter.post('/v1/auth/login', async (req: Request, res: Response) => {
  const validation = validateLoginInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }

  const ip = (req.ip || req.socket.remoteAddress || '127.0.0.1').replace('::ffff:', '');
  const userAgent = req.headers['user-agent'] as string;
  const result = await userService.authenticate(req.body.identifier, req.body.password, ip, userAgent);

  if (!result.success) {
    return res.status(401).json(result);
  }

  return res.json(result);
});

apiRouter.get('/v1/auth/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    user: req.user,
  });
});

apiRouter.post('/v1/auth/logout', requireAuth, async (req: Request, res: Response) => {
  if (req.sessionToken) {
    await userService.revokeSession(req.sessionToken);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ============================================================================
// 2B. CUSTOMER FIREBASE AUTHENTICATION & PERSISTENT DATABASE SESSIONS
// ============================================================================
apiRouter.post('/v1/customers/auth/firebase', async (req: Request, res: Response) => {
  try {
    const idToken = String(req.body?.idToken || '').trim();
    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Firebase ID token is required.' });
    }

    let verified;
    try {
      verified = await verifyFirebaseIdToken(idToken);
    } catch (verifyErr: any) {
      return res.status(401).json({
        success: false,
        error: verifyErr?.message || 'Firebase authentication verification failed.',
      });
    }

    if (!verified?.uid) {
      return res.status(401).json({ success: false, error: 'Firebase authentication verification failed.' });
    }

    let customer = await customerRepository.findByFirebaseUid(verified.uid);
    if (!customer && verified.email) {
      customer = await customerRepository.findByEmailOrPhone(verified.email);
    }

    const resolvedId = customer?.id || `cust-${crypto.randomBytes(8).toString('hex')}`;
    const savedCustomer = await customerRepository.save({
      id: resolvedId,
      firebaseUid: verified.uid,
      email: verified.email || customer?.email,
      phone: customer?.phone,
      name: verified.name || customer?.name || (verified.email ? verified.email.split('@')[0] : 'TORIWEAR Customer'),
      avatarUrl: verified.picture || customer?.avatarUrl,
      isGuest: false,
      status: customer?.status || 'ACTIVE',
      toriCredit: customer?.toriCredit ?? 0,
      insiderTier: customer?.insiderTier || 'Bronze',
      insiderPoints: customer?.insiderPoints ?? 0,
      addresses: customer?.addresses || [],
      createdAt: customer?.createdAt || new Date(),
      updatedAt: new Date(),
    });

    if (savedCustomer.status === 'SUSPENDED') {
      return res.status(403).json({ success: false, error: 'Customer account is suspended.' });
    }

    const sessionToken = `cust_sess_${crypto.randomBytes(32).toString('hex')}`;
    const prisma = getPrismaClient();
    if (prisma?.session) {
      await prisma.session.create({
        data: {
          token: sessionToken,
          customerId: savedCustomer.id,
          ipAddress: (req.ip || req.socket.remoteAddress || '127.0.0.1').replace('::ffff:', ''),
          userAgent: String(req.headers['user-agent'] || '').slice(0, 255),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isValid: true,
        },
      });
    }

    return res.json({
      success: true,
      sessionToken,
      customer: savedCustomer,
    });
  } catch (err: any) {
    console.error('[CustomerAuth] Firebase exchange error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Customer authentication failed.' });
  }
});

apiRouter.get('/v1/customers/auth/me', async (req: Request, res: Response) => {
  const customer = await resolveAuthenticatedCustomer(req);
  if (!customer) {
    return res.status(401).json({ success: false, error: 'No active customer session found.' });
  }
  return res.json({ success: true, customer });
});

apiRouter.post('/v1/customers/auth/logout', async (req: Request, res: Response) => {
  const token =
    extractSessionToken(req) ||
    (typeof req.headers['x-customer-session'] === 'string' ? req.headers['x-customer-session'].trim() : undefined);
  if (token) {
    const prisma = getPrismaClient();
    if (prisma?.session) {
      await prisma.session.updateMany({ where: { token }, data: { isValid: false } }).catch(() => {});
    }
  }
  return res.json({ success: true, message: 'Customer session ended.' });
});

apiRouter.put('/v1/customers/auth/profile', async (req: Request, res: Response) => {
  const customer = await resolveAuthenticatedCustomer(req);
  if (!customer) {
    return res.status(401).json({ success: false, error: 'Authentication required to update profile.' });
  }

  const updates = req.body || {};
  const updated = await customerRepository.save({
    ...customer,
    name: typeof updates.name === 'string' && updates.name.trim() ? updates.name.trim() : customer.name,
    phone: typeof updates.phone === 'string' ? updates.phone.trim() || undefined : customer.phone,
    addresses: Array.isArray(updates.addresses)
      ? updates.addresses.map((a: any, i: number) => ({
          id: a.id || `addr-${customer.id}-${i}-${Date.now()}`,
          customerId: customer.id,
          fullName: String(a.fullName || customer.name || '').trim(),
          phone: String(a.phone || customer.phone || '').trim(),
          pincode: String(a.pincode || '').trim(),
          addressLine1: String(a.addressLine1 || '').trim(),
          addressLine2: a.addressLine2 ? String(a.addressLine2).trim() : undefined,
          city: String(a.city || '').trim(),
          state: String(a.state || '').trim(),
          addressType: (['HOME', 'WORK', 'OTHER'].includes(String(a.addressType || '').toUpperCase())
            ? String(a.addressType).toUpperCase()
            : 'HOME') as 'HOME' | 'WORK' | 'OTHER',
          isDefault: Boolean(a.isDefault),
        }))
      : customer.addresses,
    updatedAt: new Date(),
  });

  return res.json({ success: true, customer: updated });
});

// ============================================================================
// 3. STOREFRONT PRODUCT CATALOG & PUBLIC READ APIS
// ============================================================================
apiRouter.get('/v1/products', async (req: Request, res: Response) => {
  const { department, world, status, categoryId, collectionSlug, isBestseller, isNewDrop, isTrending, search } = req.query;

  const targetStatus = typeof status === 'string' ? status : 'PUBLISHED';
  const products = await productRepository.getAll({
    department: typeof department === 'string' ? department : undefined,
    world: typeof world === 'string' ? world : undefined,
    status: targetStatus,
    categoryId: typeof categoryId === 'string' ? categoryId : undefined,
    collectionSlug: typeof collectionSlug === 'string' ? collectionSlug : undefined,
    isBestseller: isBestseller !== undefined ? isBestseller === 'true' : undefined,
    isNewDrop: isNewDrop !== undefined ? isNewDrop === 'true' : undefined,
    isTrending: isTrending !== undefined ? isTrending === 'true' : undefined,
    search: typeof search === 'string' ? search : undefined,
  });

  console.log(`[API] 🌐 GET /v1/products?status=${targetStatus}&dept=${department || 'ALL'} -> Returning ${products.length} products`);

  res.json({
    success: true,
    count: products.length,
    data: products,
  });
});

apiRouter.get('/v1/products/featured', async (_req: Request, res: Response) => {
  const products = await productRepository.getAll({
    status: 'PUBLISHED',
    isNewDrop: true,
  });
  res.json({ success: true, count: products.length, data: products.slice(0, 8) });
});

apiRouter.get('/v1/products/new-arrivals', async (req: Request, res: Response) => {
  const { department } = req.query;
  const products = await productRepository.getAll({
    department: typeof department === 'string' ? department : undefined,
    status: 'PUBLISHED',
    isNewDrop: true,
  });
  res.json({ success: true, count: products.length, data: products });
});

apiRouter.get('/v1/products/top-selling', async (req: Request, res: Response) => {
  const { department } = req.query;
  const products = await productRepository.getAll({
    department: typeof department === 'string' ? department : undefined,
    status: 'PUBLISHED',
    isBestseller: true,
  });
  res.json({ success: true, count: products.length, data: products });
});

apiRouter.get('/v1/products/slug/:slug', async (req: Request, res: Response) => {
  const product = await productRepository.findBySlug(String(req.params.slug || ''));
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found.' });
  }
  return res.json({ success: true, data: product });
});

apiRouter.get('/v1/products/category/:categoryId', async (req: Request, res: Response) => {
  const products = await productRepository.getAll({
    categoryId: String(req.params.categoryId || ''),
    status: 'PUBLISHED',
  });
  res.json({ success: true, count: products.length, data: products });
});

apiRouter.get('/v1/products/collection/:collectionSlug', async (req: Request, res: Response) => {
  const products = await productRepository.getAll({
    collectionSlug: String(req.params.collectionSlug || ''),
    status: 'PUBLISHED',
  });
  res.json({ success: true, count: products.length, data: products });
});

apiRouter.get('/v1/products/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id || '');
  const product =
    (await productRepository.findById(id)) ||
    (await productRepository.findBySlug(id)) ||
    (await productRepository.findByCatalogNumber(id));

  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found.' });
  }
  return res.json({ success: true, data: product });
});

apiRouter.get('/v1/products/:id/variants', async (req: Request, res: Response) => {
  const variants = await productRepository.getVariants(String(req.params.id || ''));
  res.json({ success: true, count: variants.length, data: variants });
});

apiRouter.get('/v1/products/:id/images', async (req: Request, res: Response) => {
  const images = await productRepository.getImages(String(req.params.id || ''));
  res.json({ success: true, count: images.length, data: images });
});

// ============================================================================
// 4. CATEGORIES & COLLECTIONS
// ============================================================================
apiRouter.get('/v1/categories', async (req: Request, res: Response) => {
  const { department } = req.query;
  const categories = await productRepository.getCategories(typeof department === 'string' ? department : undefined);
  res.json({ success: true, count: categories.length, data: categories });
});

apiRouter.get('/v1/categories/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id || '');
  const cat = (await productRepository.getCategoryById(id)) || (await productRepository.getCategoryBySlug(id));
  if (!cat) {
    return res.status(404).json({ success: false, error: 'Category not found.' });
  }
  return res.json({ success: true, data: cat });
});

apiRouter.get('/v1/collections', async (_req: Request, res: Response) => {
  const collections = await productRepository.getCollections();
  res.json({ success: true, count: collections.length, data: collections });
});

apiRouter.get('/v1/collections/:slug', async (req: Request, res: Response) => {
  const collection = await productRepository.getCollectionBySlug(String(req.params.slug || ''));
  if (!collection) {
    return res.status(404).json({ success: false, error: 'Collection not found.' });
  }
  return res.json({ success: true, data: collection });
});

// ============================================================================
// 5. ADMIN PRODUCT MANAGEMENT APIS
// ============================================================================
apiRouter.get('/v1/admin/products', requireStaffPermission('products.view'), async (_req: Request, res: Response) => {
  try {
    const products = await productRepository.getAll({ status: 'ALL' });
    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (err: any) {
    console.error('[API] Error fetching admin products:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch admin products.' });
  }
});

apiRouter.post('/v1/admin/products', requireStaffPermission('products.create'), async (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (!data.name || !data.price) {
      return res.status(400).json({ success: false, error: 'Product name and price are required.' });
    }

    const id = data.id || `tori-prod-${Date.now()}`;
    const catalogNumber = data.catalogNumber || `PR-${Math.floor(1000 + Math.random() * 9000)}`;
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const dept = data.department || 'MEN';
    const defaultColors = Array.isArray(data.colors) ? data.colors : [{ name: 'Obsidian Black', hex: '#111115' }];
    const defaultSizes = Array.isArray(data.sizes)
      ? data.sizes
      : dept === 'KIDS'
        ? ['4–5Y', '6–7Y', '8–9Y']
        : ['S', 'M', 'L', 'XL', 'XXL'];
    const { variants, colors, sizes } = normalizeVariantsAndTaxonomy(data.variants, defaultColors, defaultSizes, dept);

    console.log(`[API] ➕ CREATE request received for Product "${data.name}" (ID: ${id}, Catalog: ${catalogNumber})`);

    const newProduct: ProductRecord = {
      id,
      catalogNumber,
      name: data.name,
      slug,
      sku: data.sku || `SKU-${catalogNumber}`,
      department: dept,
      world: data.world || 'STREET ANIME',
      franchise: data.franchise || data.world || 'TORIWEAR',
      universe: data.universe || dept || 'MEN',
      character: data.character,
      fit: data.fit || 'Oversized',
      price: Number(data.price),
      originalPrice: Number(data.originalPrice || data.mrp || data.price * 1.3),
      costPrice: data.costPrice ? Number(data.costPrice) : undefined,
      gsm: Number(data.gsm || 240),
      fabric: data.fabric || '100% Combed Heavyweight Cotton',
      neck: data.neck || 'High-Ribbed Crewneck',
      sleeves: data.sleeves || 'Drop Shoulder Half Sleeves',
      print: data.print || 'High-Density Screen Print',
      description: data.description || '',
      storyQuote: data.storyQuote,
      drop: data.drop || 'CHAPTER 01 — ORIGINALS',
      rating: 5.0,
      reviewsCount: 0,
      images: Array.isArray(data.images) ? data.images : [],
      features: Array.isArray(data.features) ? data.features : ['240 GSM Combed Cotton', 'Pre-Shrunk Bio-Washed Fabric'],
      colors,
      sizes,
      isNewDrop: Boolean(data.isNewDrop ?? true),
      isTrending: Boolean(data.isTrending),
      isBestseller: Boolean(data.isBestseller),
      inStock: true,
      stock: Array.isArray(variants)
        ? variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0)
        : Number(data.stock || 50),
      licenseType: data.licenseType || 'Original IP',
      status: data.publishingStatus || data.status || 'PUBLISHED',
      categoryId: data.categoryId,
      subcategoryId: data.subcategoryId,
      collectionSlugs: Array.isArray(data.collectionSlugs) ? data.collectionSlugs : ['new-drop'],
      variants,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const saved = await productRepository.save(newProduct);
    if (Array.isArray(saved.variants) && saved.variants.length > 0) {
      await inventoryRepository.syncProductVariants(saved.variants);
    }
    if (saved.status === 'REVIEW') {
      approvalStore.syncProductReviewRequest({
        product: saved,
        actor: resolvePlatformActor(req),
      });
    }
    console.log(`[API] ✅ CREATE persisted successfully to repository/store for Product "${saved.name}" (ID: ${saved.id}, status=${saved.status})`);
    return res.status(201).json({ success: true, message: 'Product created successfully.', data: saved });
  } catch (err: any) {
    console.error('[API] Error creating product:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to create product.' });
  }
});

apiRouter.put('/v1/admin/products/:id', requireStaffPermission('products.edit'), async (req: Request, res: Response) => {
  try {
    const existing = await productRepository.findById(String(req.params.id || ''));
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Product not found.' });
    }

    const updates = req.body;
    const targetStatus = updates.publishingStatus || updates.status || existing.status;
    const catalogNumber = updates.catalogNumber || existing.catalogNumber;
    const dept = updates.department || existing.department || 'MEN';

    console.log(`[API] ✏️ UPDATE request for Product "${existing.name}" (${existing.id}) -> Target status: ${targetStatus}`);

    let computedStock = existing.stock;
    let resolvedVariants = existing.variants;
    let resolvedColors = Array.isArray(updates.colors) ? updates.colors : existing.colors;
    let resolvedSizes = Array.isArray(updates.sizes) ? updates.sizes : existing.sizes;

    if (Array.isArray(updates.variants)) {
      const normalized = normalizeVariantsAndTaxonomy(updates.variants, resolvedColors, resolvedSizes, dept);
      resolvedVariants = normalized.variants;
      resolvedColors = normalized.colors;
      resolvedSizes = normalized.sizes;
      computedStock = (resolvedVariants || []).reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
      await inventoryRepository.syncProductVariants(resolvedVariants || []);
      for (const v of resolvedVariants || []) {
        if (v.id && v.stock !== undefined) {
          inventoryRepository.setStock(v.id, Number(v.stock), req.user?.id || 'ADMIN', 'Product editor variant stock sync').catch(() => {});
        }
      }
    } else if (updates.stock !== undefined) {
      computedStock = Number(updates.stock);
    }

    const merged: ProductRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      catalogNumber,
      department: dept,
      variants: resolvedVariants,
      colors: resolvedColors,
      sizes: resolvedSizes,
      status: targetStatus,
      stock: computedStock,
      inStock: computedStock > 0,
      updatedAt: new Date(),
    };

    const saved = await productRepository.save(merged);
    if (saved.status === 'REVIEW' || existing.status === 'REVIEW') {
      approvalStore.syncProductReviewRequest({
        product: saved,
        actor: resolvePlatformActor(req),
      });
    }
    console.log(`[API] ✅ UPDATE persisted successfully for Product "${saved.name}" (${saved.id}, status=${saved.status})`);
    return res.json({ success: true, message: 'Product updated successfully.', data: saved });
  } catch (err: any) {
    console.error('[API] Error updating product:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to update product.' });
  }
});

apiRouter.post('/v1/admin/products/:id/archive', requireStaffPermission('products.archive'), async (req: Request, res: Response) => {
  const productId = String(req.params.id || '');
  console.log(`[API] 📦 ARCHIVE request for Product ID: ${productId}`);
  const product = await productRepository.archive(productId);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found.' });
  }
  console.log(`[API] ✅ Product archived: "${product.name}" (${product.id})`);
  return res.json({ success: true, message: 'Product archived successfully.', data: product });
});

apiRouter.post('/v1/admin/products/:id/restore', requireStaffPermission('products.edit'), async (req: Request, res: Response) => {
  const productId = String(req.params.id || '');
  console.log(`[API] 🔄 RESTORE request for Product ID: ${productId}`);
  const product = await productRepository.restore(productId);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found.' });
  }
  console.log(`[API] ✅ Product restored: "${product.name}" (${product.id})`);
  return res.json({ success: true, message: 'Product restored successfully.', data: product });
});

apiRouter.delete('/v1/admin/products/:id', requireStaffPermission('products.delete'), async (req: Request, res: Response) => {
  try {
    const productId = String(req.params.id || '');
    console.log(`[API] 🗑️ DELETE request for Product ID: ${productId}`);
    const existing = await productRepository.findById(productId);
    const variantIds = existing?.variants?.map((v) => v.id) || [];
    const deleted = await productRepository.delete(productId);
    if (variantIds.length > 0) {
      await inventoryRepository.deleteByVariantIds(variantIds);
    }
    console.log(`[API] ✅ Product permanently deleted: ${productId} (success=${deleted})`);
    res.json({ success: true, message: 'Product permanently deleted.', data: { id: productId, deleted } });
  } catch (err: any) {
    console.error('[API] Error deleting product:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to delete product.' });
  }
});

apiRouter.post('/v1/admin/products/clear-all', requireStaffPermission('products.delete'), async (_req: Request, res: Response) => {
  try {
    console.log('[API] 🗑️ CLEAR-ALL request for all products');
    await productRepository.clearAll();
    await inventoryRepository.clearAll();
    res.json({ success: true, message: 'All products and inventory permanently cleared from catalog.' });
  } catch (err: any) {
    console.error('[API] Error clearing products:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to clear products.' });
  }
});

apiRouter.post('/v1/admin/products/:id/variants', requireStaffPermission('products.edit'), async (req: Request, res: Response) => {
  const { size, colorName, colorHex, price, originalPrice, stock, sku } = req.body;
  if (!size || !colorName) {
    return res.status(400).json({ success: false, error: 'Size and colorName are required.' });
  }

  const productId = String(req.params.id || '');
  const newVariant: ProductVariantRecord = {
    id: `var-${productId}-${Date.now()}`,
    productId,
    sku: sku || `SKU-${productId}-${size}`,
    size,
    colorName,
    colorHex: colorHex || '#0f0f14',
    price: Number(price || 1199),
    originalPrice: Number(originalPrice || 1599),
    stock: Number(stock || 20),
    reservedStock: 0,
    isActive: true,
  };

  const saved = await productRepository.saveVariant(productId, newVariant);
  if (!saved) {
    return res.status(404).json({ success: false, error: 'Product not found.' });
  }
  return res.status(201).json({ success: true, data: saved });
});

apiRouter.put('/v1/admin/products/:id/variants/:variantId', requireStaffPermission('products.edit'), async (req: Request, res: Response) => {
  const existing = await productRepository.getVariantById(String(req.params.variantId || ''));
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Variant not found.' });
  }

  const updated: ProductVariantRecord = {
    ...existing,
    ...req.body,
    id: existing.id,
    productId: existing.productId,
  };

  const saved = await productRepository.saveVariant(String(req.params.id || ''), updated);
  return res.json({ success: true, data: saved });
});

apiRouter.post('/v1/admin/products/:id/variants/:variantId/archive', requireStaffPermission('products.edit'), async (req: Request, res: Response) => {
  const success = await productRepository.archiveVariant(String(req.params.variantId || ''));
  if (!success) {
    return res.status(404).json({ success: false, error: 'Variant not found.' });
  }
  return res.json({ success: true, message: 'Variant archived successfully.' });
});

apiRouter.post('/v1/admin/categories', requireStaffPermission('catalog.edit'), async (req: Request, res: Response) => {
  const { name, department, description, image } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: 'Category name is required.' });
  }

  const cat: CategoryRecord = {
    id: `cat-${Date.now()}`,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    department: department || 'MEN',
    description,
    image,
    displayOrder: 99,
    isActive: true,
  };

  const saved = await productRepository.saveCategory(cat);
  return res.status(201).json({ success: true, data: saved });
});

apiRouter.put('/v1/admin/categories/:id', requireStaffPermission('catalog.edit'), async (req: Request, res: Response) => {
  const existing = await productRepository.getCategoryById(String(req.params.id || ''));
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Category not found.' });
  }

  const updated: CategoryRecord = {
    ...existing,
    ...req.body,
    id: existing.id,
  };

  const saved = await productRepository.saveCategory(updated);
  return res.json({ success: true, data: saved });
});

apiRouter.post('/v1/admin/categories/:id/archive', requireStaffPermission('catalog.edit'), async (req: Request, res: Response) => {
  const success = await productRepository.archiveCategory(String(req.params.id || ''));
  if (!success) {
    return res.status(404).json({ success: false, error: 'Category not found.' });
  }
  return res.json({ success: true, message: 'Category archived successfully.' });
});

// ============================================================================
// 6. INVENTORY FOUNDATION APIS
// ============================================================================
apiRouter.get('/v1/inventory', requireStaffPermission('inventory.view'), async (_req: Request, res: Response) => {
  const items = await inventoryRepository.getAll();
  res.json({ success: true, count: items.length, data: items });
});

apiRouter.get('/v1/inventory/:variantId', requireStaffPermission('inventory.view'), async (req: Request, res: Response) => {
  const item = await inventoryRepository.getByVariantId(String(req.params.variantId || ''));
  if (!item) {
    return res.status(404).json({ success: false, error: 'Inventory record not found.' });
  }
  return res.json({ success: true, data: item });
});

apiRouter.post('/v1/inventory/:variantId/stock', requireStaffPermission('inventory.edit'), async (req: Request, res: Response) => {
  const { delta, newStock, reason } = req.body;
  const operatorId = req.user?.id || 'OPERATOR';
  const variantId = String(req.params.variantId || '');

  if (newStock !== undefined) {
    const updated = await inventoryRepository.setStock(variantId, Number(newStock), operatorId, reason);
    return res.json({ success: true, data: updated });
  }

  if (delta !== undefined) {
    const updated = await inventoryRepository.updateStock(
      variantId,
      Number(delta),
      'AUDIT_ADJUSTMENT',
      operatorId,
      reason
    );
    return res.json({ success: true, data: updated });
  }

  return res.status(400).json({ success: false, error: 'Either "delta" or "newStock" is required.' });
});

apiRouter.post('/v1/inventory/bulk-delete', requireStaffPermission('inventory.delete'), async (req: Request, res: Response) => {
  try {
    const { targetIds, reason } = req.body || {};
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ success: false, error: 'targetIds array is required.' });
    }

    const operatorId = req.user?.id || 'OPERATOR';
    const cleanTargetIds = targetIds
      .map((x: any) => (typeof x === 'string' ? x.trim() : ''))
      .filter((x: string) => x.length > 0 && x !== 'unlinked');

    // Collect any variants belonging to explicitly targeted products too
    const expandedIds = new Set<string>(cleanTargetIds);
    for (const id of cleanTargetIds) {
      const prod = await productRepository.findById(id);
      if (prod?.variants) {
        for (const v of prod.variants) {
          if (v.id) expandedIds.add(v.id);
          if (v.sku) expandedIds.add(v.sku);
        }
      }
    }

    const invResult = await inventoryRepository.bulkDelete(
      Array.from(expandedIds),
      operatorId,
      reason || 'Bulk product/SKU removal in Admin'
    );

    const prodResult = await productRepository.removeVariants([
      ...Array.from(expandedIds),
      ...invResult.deletedVariantIds,
      ...invResult.deletedSkus,
    ]);

    const totalDeleted = Math.max(invResult.deletedCount, prodResult.removedProductIds.length);
    console.log(`[API] 🗑️ BULK DELETE completed by ${operatorId}: ${invResult.deletedCount} inventory records, ${prodResult.removedProductIds.length} products removed.`);

    return res.json({
      success: true,
      deletedCount: totalDeleted,
      deletedVariantIds: invResult.deletedVariantIds,
      deletedSkus: invResult.deletedSkus,
      removedProductIds: prodResult.removedProductIds,
      modifiedProductIds: prodResult.modifiedProductIds,
      message: `Permanently removed ${invResult.deletedCount} inventory SKUs and ${prodResult.removedProductIds.length} catalog products.`,
    });
  } catch (err: any) {
    console.error('[API] Bulk inventory delete error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Bulk delete failed.' });
  }
});

apiRouter.post('/v1/inventory/sync-catalog', requireStaffPermission('inventory.edit'), async (_req: Request, res: Response) => {
  try {
    const result = await inventoryRepository.syncFromProducts();
    const items = await inventoryRepository.getAll();
    res.json({
      success: true,
      addedCount: result.addedCount,
      count: items.length,
      data: items,
      message: result.addedCount > 0
        ? `Synced ${result.addedCount} catalog variants into warehouse inventory.`
        : 'Inventory is already synced with all catalog variants.',
    });
  } catch (err: any) {
    console.error('[API] Inventory sync-catalog error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to sync inventory from catalog.' });
  }
});

apiRouter.delete('/v1/inventory/:variantId', requireStaffPermission('inventory.delete'), async (req: Request, res: Response) => {
  const reason = (req.body?.reason || req.query?.reason || 'Inventory record removed by staff') as string;
  const operatorId = req.user?.id || 'OPERATOR';
  const variantId = String(req.params.variantId || '');
  const current = await inventoryRepository.getByVariantId(variantId);
  const success = await inventoryRepository.deleteItem(variantId, operatorId, reason);
  if (!success) {
    return res.status(404).json({ success: false, error: 'Inventory record not found.' });
  }
  await productRepository.removeVariants([variantId, current?.variantId || '', current?.sku || ''].filter(Boolean));
  return res.json({ success: true, message: 'Inventory item removed successfully' });
});

apiRouter.get('/v1/inventory/movements/recent', requireStaffPermission('inventory.view'), async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const movements = await inventoryRepository.getMovements(limit);
  res.json({ success: true, count: movements.length, data: movements });
});

// ============================================================================
// 7. ORDERS & SERVER-SIDE VALIDATION (PHASE 4 ORDER LIFECYCLE)
// ============================================================================

/**
 * Server-authoritative Pricing Quote / Calculation.
 * Calculates items subtotal, coupon discount, delivery fee, GST tax breakdown, and availability.
 */
apiRouter.post('/v1/orders/quote', async (req: Request, res: Response) => {
  const validation = validateQuoteOrderInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }

  const result = await orderService.calculateQuote({
    items: req.body.items,
    couponCode: req.body.couponCode,
    shippingPincode: req.body.shippingPincode,
    state: req.body.state,
    customerId: req.body.customerId,
    customerEmail: req.body.customerEmail,
    customerPhone: req.body.customerPhone,
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

async function isStaffOrAdmin(req: Request): Promise<boolean> {
  const token = extractSessionToken(req);
  if (!token) return false;
  const session = await userService.validateSession(token);
  if (session && String(session.user?.role || '').toUpperCase() !== 'CUSTOMER') return true;
  const legacy = await authStore.getUserByTokenAsync(token);
  return Boolean(legacy && String(legacy.role || '').toUpperCase() !== 'CUSTOMER');
}

/**
 * Server-authoritative Order Creation.
 * Never trusts prices or subtotals sent by client. Verifies inventory and creates immutable snapshots.
 */
apiRouter.post('/v1/orders', async (req: Request, res: Response) => {
  const validation = validateCreateOrderInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }

  const authCustomer = await resolveAuthenticatedCustomer(req);
  const idempotencyKey = (req.headers['idempotency-key'] || req.body.idempotencyKey) as string | undefined;
  const ip = (req.ip || req.socket.remoteAddress || '127.0.0.1').replace('::ffff:', '');
  const result = await orderService.createOrder({
    ...req.body,
    customerId: authCustomer ? authCustomer.id : undefined,
    idempotencyKey: idempotencyKey || req.body.idempotencyKey,
  }, ip);

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.status(201).json(result);
});

/**
 * Customer Order Tracking API
 * Enforces ownership or phone/email verification before revealing order tracking details.
 * Returns only real courier/AWB/timeline data.
 */
apiRouter.get(['/v1/orders/track', '/orders/track'], async (req: Request, res: Response) => {
  try {
    const queryOrder = ((req.query.orderId || req.query.orderNumber || req.query.id) as string | undefined)?.trim();
    const queryPhone = ((req.query.phone) as string | undefined)?.trim().replace(/\D/g, '');
    const queryEmail = ((req.query.email) as string | undefined)?.trim().toLowerCase();
    const queryAwb = ((req.query.awb || req.query.trackingNumber) as string | undefined)?.trim();

    if (!queryOrder && !queryAwb) {
      return res.status(400).json({
        success: false,
        error: 'Order ID / Number or AWB Tracking Number is required.',
      });
    }

    let order: any = null;
    let shipment: any = null;

    if (queryAwb) {
      shipment =
        (await shippingRepository.findByAwbCode(queryAwb)) ||
        (await shippingRepository.findByTrackingNumber(queryAwb));
      if (shipment) {
        order = await orderService.getOrder(shipment.orderId);
      }
      if (!order) {
        const matchingOrders = await orderRepository.getAll({ search: queryAwb });
        order = matchingOrders.find(
          (o: OrderRecord) =>
            (o.courierTrackingNumber && o.courierTrackingNumber.toLowerCase() === queryAwb.toLowerCase()) ||
            (o.awbNumber && o.awbNumber.toLowerCase() === queryAwb.toLowerCase())
        ) || null;
      }
    }

    if (!order && queryOrder) {
      order = await orderService.getOrder(queryOrder);
      if (order) {
        shipment = await shippingRepository.findByOrderId(order.id);
      }
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'No order or shipment found matching the provided details. Please verify your order number or AWB.',
      });
    }

    // Strict IDOR protection: require staff auth, authenticated customer owner, cryptographic orderToken, or matching phone/email
    const isStaff = await isStaffOrAdmin(req);
    const authCustomer = isStaff ? null : await resolveAuthenticatedCustomer(req);
    const orderToken = String(req.headers['x-order-token'] || req.query.orderToken || req.query.token || '').trim();

    const hasValidOrderToken = Boolean(
      orderToken && order.orderAccessToken && safeTimingEqual(orderToken, order.orderAccessToken)
    );
    const isOwnerCustomer = Boolean(
      authCustomer && (
        (order.customerId && authCustomer.id === order.customerId) ||
        (authCustomer.email && order.customerEmail && authCustomer.email.toLowerCase() === order.customerEmail.toLowerCase())
      )
    );

    const orderPhoneClean = (order.customerPhone || '').replace(/\D/g, '');
    const phoneMatches = Boolean(
      queryPhone &&
      queryPhone.length >= 4 &&
      orderPhoneClean.length >= 4 && (
        orderPhoneClean === queryPhone ||
        orderPhoneClean.endsWith(queryPhone) ||
        (queryPhone.length >= 10 && orderPhoneClean.slice(-4) === queryPhone.slice(-4))
      )
    );
    const emailMatches = Boolean(
      queryEmail && order.customerEmail && order.customerEmail.trim().toLowerCase() === queryEmail
    );

    if (!isStaff && !hasValidOrderToken && !isOwnerCustomer && !phoneMatches && !emailMatches) {
      return res.status(403).json({
        success: false,
        code: 'VERIFICATION_REQUIRED',
        error: queryPhone || queryEmail
          ? 'Verification failed. The phone number or email does not match this order.'
          : 'Please provide the phone number or email address associated with this order to view tracking details.',
      });
    }

    const maskedPhone = order.customerPhone ? order.customerPhone.replace(/(\d{2})\d{4,6}(\d{2})/, '$1******$2') : undefined;
    const maskedEmail = order.customerEmail
      ? order.customerEmail.replace(/^(.)(.*)(@.*)$/, (_m: string, a: string, b: string, c: string) => `${a}${'*'.repeat(Math.max(b.length, 3))}${c}`)
      : undefined;

    const trackingEvents = shipment ? await shippingRepository.getTrackingEvents(shipment.id) : [];

    return res.json({
      success: true,
      tracking: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: (order as any).shippingStatus || order.fulfillmentStatus,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        courierPartner: shipment?.carrier || order.courierPartner || null,
        awb: shipment?.awbCode || order.awbNumber || order.courierTrackingNumber || null,
        estimatedDeliveryDate: shipment?.estimatedDeliveryDate || order.estimatedDeliveryDate || null,
        timeline: Array.isArray(order.timeline) ? order.timeline : [],
        carrierEvents: trackingEvents,
        shippingAddress: {
          city: order.shippingAddress?.city,
          state: order.shippingAddress?.state,
          pincode: order.shippingAddress?.pincode,
        },
        customer: {
          name: order.customerName,
          phone: maskedPhone,
          email: maskedEmail,
        },
        items: (order.items || []).map((it: any) => ({
          productName: it.productName,
          size: it.size,
          color: it.color,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          image: it.image,
        })),
        itemsCount: order.items?.length || 0,
        totalAmount: order.total,
        currency: order.currency || 'INR',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Tracking service error.' });
  }
});

/**
 * Lookup order by ID or human-readable order number.
 * IDOR Protection: Staff/Admin, verified customer session owner, or cryptographic orderAccessToken.
 */
apiRouter.get('/v1/orders/:orderId', async (req: Request, res: Response) => {
  const order = await orderService.getOrder(String(req.params.orderId || ''));
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found.' });
  }

  const isStaff = await isStaffOrAdmin(req);
  if (!isStaff) {
    const authCustomer = await resolveAuthenticatedCustomer(req);
    const orderToken = String(req.headers['x-order-token'] || req.query.orderToken || req.query.token || '').trim();

    const hasValidToken = Boolean(
      orderToken && order.orderAccessToken && safeTimingEqual(orderToken, order.orderAccessToken)
    );
    const hasMatchingCustomer = Boolean(
      authCustomer && (
        (order.customerId && authCustomer.id === order.customerId) ||
        (authCustomer.email && order.customerEmail && authCustomer.email.toLowerCase() === order.customerEmail.trim().toLowerCase())
      )
    );

    if (!hasValidToken && !hasMatchingCustomer) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have permission to view this order.',
      });
    }
  }

  return res.json({ success: true, data: order });
});

/**
 * List customer orders by customer ID (authenticated customer session or staff only).
 */
apiRouter.get('/v1/orders/customer/:customerId', async (req: Request, res: Response) => {
  const isStaff = await isStaffOrAdmin(req);
  const customerId = String(req.params.customerId || '');
  const authCustomer = isStaff ? null : await resolveAuthenticatedCustomer(req);

  if (!isStaff && (!authCustomer || authCustomer.id !== customerId)) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: Customer authentication required to view your order history.',
    });
  }

  const email = isStaff
    ? (typeof req.query.email === 'string' ? req.query.email : undefined)
    : authCustomer?.email;
  const phone = isStaff
    ? (typeof req.query.phone === 'string' ? req.query.phone : undefined)
    : authCustomer?.phone;
  const orders = await orderService.getCustomerOrders(customerId, email, phone);
  return res.json({ success: true, count: orders.length, data: orders });
});

/**
 * Customer Order Cancellation (only allowed prior to dispatch).
 * IDOR Protection: Staff, verified customer session owner, or cryptographic orderAccessToken.
 */
apiRouter.post('/v1/orders/:orderId/cancel', async (req: Request, res: Response) => {
  const validation = validateCancelOrderInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }

  const orderId = String(req.params.orderId || '');
  const order = await orderService.getOrder(orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found.' });
  }

  const isStaff = await isStaffOrAdmin(req);
  let verifiedCustomerName: string | undefined;
  let verifiedCustomerId: string | undefined;

  if (!isStaff) {
    const authCustomer = await resolveAuthenticatedCustomer(req);
    const orderToken = String(req.headers['x-order-token'] || req.body.orderToken || '').trim();

    const hasValidToken = Boolean(
      orderToken && order.orderAccessToken && safeTimingEqual(orderToken, order.orderAccessToken)
    );
    const hasMatchingCustomer = Boolean(
      authCustomer && (
        (order.customerId && authCustomer.id === order.customerId) ||
        (authCustomer.email && order.customerEmail && authCustomer.email.toLowerCase() === order.customerEmail.trim().toLowerCase())
      )
    );

    if (!hasValidToken && !hasMatchingCustomer) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have permission to cancel this order.',
      });
    }

    verifiedCustomerId = authCustomer?.id;
    verifiedCustomerName = authCustomer?.name;
  }

  const actor = {
    id: req.user?.id || verifiedCustomerId || 'CUSTOMER',
    name: req.user?.name || verifiedCustomerName || order.customerName || 'Customer',
    role: isStaff ? (req.user?.role || 'STAFF') : 'CUSTOMER',
  };

  const result = await orderService.cancelOrder(orderId, req.body.reason, actor);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

/**
 * Admin: List all orders with filters (status, search, customer).
 */
apiRouter.get('/v1/admin/orders', requireStaffPermission('orders.view'), async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;

  const orders = await orderService.getAllOrders({ status, search, customerId });
  res.json({ success: true, count: orders.length, data: orders });
});

/**
 * Admin: Get single order with complete snapshots & timeline history.
 */
apiRouter.get('/v1/admin/orders/:orderId', requireStaffPermission('orders.view'), async (req: Request, res: Response) => {
  const order = await orderService.getOrder(String(req.params.orderId || ''));
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found.' });
  }
  return res.json({ success: true, data: order });
});

/**
 * Admin: Transition order status using controlled state machine.
 */
apiRouter.put('/v1/admin/orders/:orderId/status', requireStaffPermission('orders.edit'), async (req: Request, res: Response) => {
  const validation = validateUpdateOrderStatusInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }

  const actor = {
    id: req.user?.id || 'STAFF',
    name: req.user?.name || 'Operations Staff',
    role: req.user?.role || 'STAFF',
  };

  const result = await orderService.transitionOrderStatus(
    String(req.params.orderId || ''),
    req.body.status.toUpperCase(),
    actor,
    req.body.note,
    {
      courierPartner: req.body.courierPartner,
      trackingNumber: req.body.trackingNumber,
    }
  );

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

/**
 * Admin: Cancel order.
 */
apiRouter.post('/v1/admin/orders/:orderId/cancel', requireStaffPermission('orders.edit'), async (req: Request, res: Response) => {
  const validation = validateCancelOrderInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }

  const actor = {
    id: req.user?.id || 'STAFF',
    name: req.user?.name || 'Admin',
    role: req.user?.role || 'ADMIN',
  };

  const result = await orderService.cancelOrder(String(req.params.orderId || ''), req.body.reason, actor);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

/**
 * Admin: Process refund.
 */
apiRouter.post('/v1/admin/orders/:orderId/refund', requireStaffPermission('orders.edit'), async (req: Request, res: Response) => {
  const amount = typeof req.body.amount === 'number' ? req.body.amount : 0;
  const reason = req.body.reason || 'Customer refund requested';

  const actor = {
    id: req.user?.id || 'STAFF',
    name: req.user?.name || 'Admin',
    role: req.user?.role || 'ADMIN',
  };

  const result = await orderService.refundOrder(String(req.params.orderId || ''), amount, reason, actor);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// ============================================================================
// 8. PAYMENTS (DEMO/SIMULATED & REAL GATEWAY INTERFACES)
// ============================================================================
apiRouter.post('/v1/payments/intent', async (req: Request, res: Response) => {
  const validation = validatePaymentIntentInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }

  const ip = (req.ip || req.socket.remoteAddress || '127.0.0.1').replace('::ffff:', '');
  const result = await paymentService.createPaymentIntent(req.body, ip);

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

apiRouter.post('/v1/payments/verify', async (req: Request, res: Response) => {
  const validation = validatePaymentVerificationInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ success: false, errors: validation.errors });
  }

  const ip = (req.ip || req.socket.remoteAddress || '127.0.0.1').replace('::ffff:', '');
  const result = await paymentService.verifyPayment(req.body, ip);

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

apiRouter.post(['/v1/payments/webhook', '/v1/payments/razorpay/webhook'], async (req: Request, res: Response) => {
  const signature = (req.headers['x-razorpay-signature'] || '') as string;
  const rawBody = (req as any).rawBody;
  const result = await paymentService.processWebhook('razorpay', signature, req.body, rawBody);
  if (!result.success && result.error && !result.duplicate) {
    const status = result.error.includes('signature') || result.error.includes('not configured') ? 401 : 400;
    return res.status(status).json({ received: false, ...result });
  }
  return res.json({ received: true, ...result });
});

// ============================================================================
// 8.1 RAZORPAY CONFIGURATION & CHECKOUT (ADMIN DASHBOARD & STOREFRONT)
// ============================================================================
apiRouter.get('/v1/admin/payments/razorpay/config', requireStaffPermission('settings.view'), async (_req: Request, res: Response) => {
  try {
    const config = paymentConfigService.getPublicConfig();
    res.json({ success: true, data: config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch payment gateway configuration.' });
  }
});

apiRouter.post('/v1/admin/payments/razorpay/config', requireStaffPermission('settings.edit'), async (req: Request, res: Response) => {
  try {
    const config = paymentConfigService.updateConfig(req.body);
    res.json({ success: true, message: 'Razorpay configuration saved securely.', data: config });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to save payment gateway configuration.' });
  }
});

apiRouter.post('/v1/admin/payments/razorpay/test', requireStaffPermission('settings.edit'), async (req: Request, res: Response) => {
  try {
    const environment = req.body.environment || 'TEST';
    const result = await paymentConfigService.testConnection(environment);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Payment gateway connection test failed.' });
  }
});

// ============================================================================
// 8.2 MULTI-GATEWAY API MANAGEMENT (ADMIN DASHBOARD -> SETTINGS -> PAYMENTS)
// ============================================================================
apiRouter.get('/v1/admin/payments/gateways', requireStaffPermission('settings.view'), async (_req: Request, res: Response) => {
  try {
    const gateways = paymentConfigService.getPublicGateways();
    res.json({ success: true, count: gateways.length, data: gateways });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to list payment gateways.' });
  }
});

apiRouter.post('/v1/admin/payments/gateways', requireStaffPermission('settings.edit'), async (req: Request, res: Response) => {
  try {
    const gateway = await paymentConfigService.createGateway(req.body);
    res.status(201).json({ success: true, message: 'Payment gateway added successfully.', data: gateway });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to create payment gateway.' });
  }
});

apiRouter.put('/v1/admin/payments/gateways/:id', requireStaffPermission('settings.edit'), async (req: Request, res: Response) => {
  try {
    const gateway = await paymentConfigService.updateGateway(String(req.params.id || ''), req.body);
    res.json({ success: true, message: 'Payment gateway updated successfully.', data: gateway });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to update payment gateway.' });
  }
});

apiRouter.delete('/v1/admin/payments/gateways/:id', requireStaffPermission('settings.edit'), async (req: Request, res: Response) => {
  try {
    const gatewayId = String(req.params.id || '');
    const success = await paymentConfigService.deleteGateway(gatewayId);
    res.json({ success: true, message: 'Payment gateway removed successfully.', data: { id: gatewayId, deleted: success } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to delete payment gateway.' });
  }
});

apiRouter.post('/v1/admin/payments/gateways/:id/test', requireStaffPermission('settings.edit'), async (req: Request, res: Response) => {
  try {
    const result = await paymentConfigService.testGatewayConnection(String(req.params.id || ''));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Connection test failed.' });
  }
});

apiRouter.post('/v1/admin/payments/gateways/:id/toggle', requireStaffPermission('settings.edit'), async (req: Request, res: Response) => {
  try {
    const enabled = typeof req.body.isEnabled === 'boolean' ? req.body.isEnabled : Boolean(req.body.enabled);
    const gateway = await paymentConfigService.toggleGateway(String(req.params.id || ''), enabled);
    res.json({ success: true, message: `Gateway ${enabled ? 'enabled' : 'disabled'}.`, data: gateway });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to toggle payment gateway.' });
  }
});

apiRouter.post('/v1/admin/payments/gateways/:id/default', requireStaffPermission('settings.edit'), async (req: Request, res: Response) => {
  try {
    const gateway = await paymentConfigService.setDefaultGateway(String(req.params.id || ''));
    res.json({ success: true, message: `${gateway.name} set as primary payment gateway.`, data: gateway });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to set default gateway.' });
  }
});

// ============================================================================
// 8.3 BACKEND PAYMENT TRANSACTIONS & STATS (PAYMENTS & UPI VIEW)
// ============================================================================
apiRouter.get('/v1/admin/payments/transactions', requireStaffPermission('payments.view'), async (req: Request, res: Response) => {
  try {
    const { status, gateway, method, search, page, limit } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 15));
    const offset = (pageNum - 1) * limitNum;

    const result = await paymentRepository.queryTransactions({
      status: status as any,
      gateway: gateway as any,
      method: method as any,
      search: search as string,
      limit: limitNum,
      offset,
    });
    const stats = await paymentRepository.getStats();
    res.json({
      success: true,
      data: result.transactions,
      pagination: {
        total: result.total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(result.total / limitNum) || 1,
      },
      stats,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch payment transactions.' });
  }
});

apiRouter.get('/v1/admin/payments/transactions/:id', requireStaffPermission('payments.view'), async (req: Request, res: Response) => {
  try {
    const tx = await paymentRepository.findById(String(req.params.id || ''));
    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction not found.' });
    }
    return res.json({ success: true, data: tx });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch transaction details.' });
  }
});

apiRouter.post('/v1/admin/payments/refund', requireStaffPermission('refunds.create'), async (req: Request, res: Response) => {
  try {
    const ip = (req.ip || req.socket.remoteAddress || '127.0.0.1').replace('::ffff:', '');
    const { orderId, paymentId, amount, reason } = req.body;
    const amountPaise = amount ? Math.round(Number(amount) * 100) : undefined;
    const result = await paymentService.processRefund({
      orderId,
      paymentId,
      amountPaise,
      reason: reason || 'Admin initiated refund',
    }, ip);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to process refund.' });
  }
});

apiRouter.get('/v1/payments/razorpay/public-key', async (_req: Request, res: Response) => {
  try {
    const creds = paymentConfigService.getActiveCredentials();
    const config = paymentConfigService.getPublicConfig();
    const isConfigured = Boolean(config.enabled && creds?.enabled && creds?.keyId && creds?.keySecret);
    res.json({
      success: true,
      keyId: isConfigured ? creds.keyId : '',
      enabled: isConfigured,
      environment: config.environment,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve public payment configuration.' });
  }
});

apiRouter.post('/v1/payments/razorpay/create-order', async (req: Request, res: Response) => {
  try {
    const ip = (req.ip || req.socket.remoteAddress || '127.0.0.1').replace('::ffff:', '');
    const result = await paymentService.createPaymentIntent({
      orderId: req.body.orderId,
      gateway: 'RAZORPAY',
      method: req.body.method || 'UPI',
    }, ip);
    if (!result.success) {
      return res.status(400).json(result);
    }

    const razorpayOrderId = result.gatewayPayload?.orderId || '';
    const keyId = result.gatewayPayload?.keyId || '';
    const amount = result.gatewayPayload?.amount || 0;
    const currency = result.gatewayPayload?.currency || 'INR';

    return res.json({
      success: true,
      applicationOrderId: result.transaction?.orderId || req.body.orderId,
      razorpayOrderId,
      orderId: razorpayOrderId,
      keyId,
      amount,
      currency,
      order: {
        id: razorpayOrderId,
        amount,
        currency,
      },
      transaction: result.transaction,
      gatewayPayload: result.gatewayPayload,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Razorpay order creation failed.' });
  }
});

apiRouter.post(['/v1/payments/razorpay/verify-signature', '/v1/payments/razorpay/verify'], async (req: Request, res: Response) => {
  try {
    const ip = (req.ip || req.socket.remoteAddress || '127.0.0.1').replace('::ffff:', '');
    const result = await paymentService.verifyPayment({
      orderId: req.body.orderId,
      gatewayOrderId: req.body.razorpay_order_id || req.body.gatewayOrderId,
      gatewayPaymentId: req.body.razorpay_payment_id || req.body.gatewayPaymentId,
      gatewaySignature: req.body.razorpay_signature || req.body.gatewaySignature,
    }, ip);
    if (!result.success) {
      return res.status(400).json(result);
    }
    const order = (await orderRepository.findById(req.body.orderId)) || (await orderRepository.findByOrderNumber(req.body.orderId));
    return res.json({
      success: true,
      verified: true,
      message: result.message || 'Payment verified successfully.',
      order,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Payment signature verification failed.' });
  }
});

// ============================================================================
// 9. SHIPPING & TRACKING
// ============================================================================
apiRouter.get('/v1/shipping/track/:identifier', requireStaffPermission('orders.view'), async (req: Request, res: Response) => {
  const result = await shippingService.trackShipment(String(req.params.identifier || ''));
  if (!result.success) {
    return res.status(404).json(result);
  }
  return res.json(result);
});

apiRouter.post(
  '/v1/shipping/manifest',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'PARTNER', 'STORE_MANAGER', 'INVENTORY_MANAGER', 'FULFILLMENT_STAFF']),
  async (req: Request, res: Response) => {
    const result = await shippingService.createShipment(req.body, req.user?.id || 'STAFF');
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  }
);

/**
 * Shiprocket Webhook Endpoint.
 * Authenticates incoming events, updates live parcel status, and triggers automated inventory restock on RTO.
 */
apiRouter.post('/v1/shipping/webhook/shiprocket', async (req: Request, res: Response) => {
  const token = (
    req.headers['x-api-key'] ||
    req.headers['x-shiprocket-token'] ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '')
  ) as string | undefined;

  const result = await shippingService.processShiprocketWebhook(token, req.body);
  if (!result.success) {
    const status = result.error?.startsWith('Unauthorized') ? 401 : 400;
    return res.status(status).json(result);
  }
  return res.json(result);
});

// ============================================================================
// 9B. MULTI-LOGISTICS PARTNER MANAGEMENT SYSTEM
// ============================================================================

/**
 * Admin: List all logistics partners with masked credentials and health status
 */
apiRouter.get('/v1/admin/logistics/partners', requireStaffPermission('settings.view'), async (_req: Request, res: Response) => {
  try {
    const partners = await logisticsManager.getAllPartners(true);
    const settings = await logisticsManager.getSettings();
    res.json({
      success: true,
      data: {
        partners,
        settings,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch logistics partners.' });
  }
});

/**
 * Admin: Add New Courier / Add Custom REST Carrier API
 */
apiRouter.post('/v1/admin/logistics/partners', requireStaffPermission('settings.edit'), async (req: Request, res: Response) => {
  try {
    const created = await logisticsManager.createPartner(req.body);
    res.status(201).json({ success: true, message: `Courier "${created.name}" created successfully.`, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to create courier partner.' });
  }
});

/**
 * Admin: Remove Courier Integration (with active shipment & default safeguards)
 */
apiRouter.delete('/v1/admin/logistics/partners/:id', requireStaffPermission('settings.edit'), async (req: Request, res: Response) => {
  try {
    await logisticsManager.deletePartner(String(req.params.id || ''));
    res.json({ success: true, message: 'Courier partner integration removed successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to remove courier partner.' });
  }
});

/**
 * Admin: Get single logistics partner configuration
 */
apiRouter.get('/v1/admin/logistics/partners/:id', requireStaffPermission('settings.view'), async (req: Request, res: Response) => {
  try {
    const partner = await logisticsManager.getPartnerById(String(req.params.id || ''), true);
    if (!partner) {
      return res.status(404).json({ success: false, error: 'Carrier configuration not found.' });
    }
    return res.json({ success: true, data: partner });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch partner config.' });
  }
});

/**
 * Admin: Update logistics partner settings / API keys / environment
 */
apiRouter.put('/v1/admin/logistics/partners/:id', requireStaffPermission('settings.edit'), async (req: Request, res: Response) => {
  try {
    const updated = await logisticsManager.updatePartner(String(req.params.id || ''), req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Carrier configuration not found.' });
    }
    return res.json({ success: true, message: `${updated.name} updated successfully.`, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message || 'Failed to update partner.' });
  }
});

/**
 * Admin: Test live API connectivity and latency for a partner
 */
apiRouter.post('/v1/admin/logistics/partners/:id/test', requireStaffPermission('settings.edit'), async (req: Request, res: Response) => {
  try {
    const result = await logisticsManager.testPartner(String(req.params.id || ''));
    res.json({
      success: result.success,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Connectivity test failed.' });
  }
});

/**
 * Admin: Activate or deactivate a logistics partner
 */
apiRouter.post('/v1/admin/logistics/partners/:id/toggle', requireStaffPermission('settings.edit'), async (req: Request, res: Response) => {
  try {
    const updated = await logisticsManager.togglePartner(String(req.params.id || ''), req.body.isEnabled);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Carrier configuration not found.' });
    }
    return res.json({ success: true, message: `${updated.name} is now ${updated.isEnabled ? 'active' : 'disabled'}.`, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to toggle carrier status.' });
  }
});

/**
 * Admin: Set default carrier
 */
apiRouter.post('/v1/admin/logistics/partners/:id/default', requireStaffPermission('settings.edit'), async (req: Request, res: Response) => {
  try {
    const success = await logisticsManager.setDefaultPartner(String(req.params.id || ''));
    if (!success) {
      return res.status(404).json({ success: false, error: 'Carrier configuration not found.' });
    }
    const partners = await logisticsManager.getAllPartners(true);
    return res.json({ success: true, message: 'Default logistics partner updated.', data: partners });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to set default carrier.' });
  }
});

/**
 * Admin: Update global logistics settings (Allocation strategy, Warehouse PIN)
 */
apiRouter.put('/v1/admin/logistics/settings', requireStaffPermission('settings.edit'), async (req: Request, res: Response) => {
  try {
    const updated = await logisticsManager.updateSettings(req.body);
    res.json({ success: true, message: 'Logistics settings updated.', data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to update settings.' });
  }
});

/**
 * Admin & Fulfillment: Check PIN Code Serviceability across all active partners
 */
apiRouter.post('/v1/admin/logistics/serviceability', requireStaffPermission('orders.view'), async (req: Request, res: Response) => {
  try {
    const { destinationPin, originPin, codRequired, weightGrams } = req.body;
    if (!destinationPin) {
      return res.status(400).json({ success: false, error: 'Destination pincode is required.' });
    }
    const settings = await logisticsManager.getSettings();
    const results = await logisticsManager.checkServiceability({
      destinationPin: String(destinationPin).trim(),
      originPin: originPin ? String(originPin).trim() : settings.defaultOriginPin,
      codRequired: Boolean(codRequired),
      weightGrams: weightGrams ? Number(weightGrams) : 350,
    });
    return res.json({ success: true, data: results });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to check serviceability.' });
  }
});

/**
 * Admin & Fulfillment: Compare Live Rates across all active partners
 */
apiRouter.post('/v1/admin/logistics/rates', requireStaffPermission('orders.view'), async (req: Request, res: Response) => {
  try {
    const { destinationPin, originPin, weightGrams, lengthCm, breadthCm, heightCm, cod, declaredValue } = req.body;
    if (!destinationPin) {
      return res.status(400).json({ success: false, error: 'Destination pincode is required.' });
    }
    const settings = await logisticsManager.getSettings();
    const quotes = await logisticsManager.compareRates({
      destinationPin: String(destinationPin).trim(),
      originPin: originPin ? String(originPin).trim() : settings.defaultOriginPin,
      weightGrams: Number(weightGrams) || 350,
      lengthCm: lengthCm ? Number(lengthCm) : 30,
      breadthCm: breadthCm ? Number(breadthCm) : 25,
      heightCm: heightCm ? Number(heightCm) : 4,
      cod: Boolean(cod),
      declaredValue: declaredValue ? Number(declaredValue) : 1999,
    });
    return res.json({ success: true, data: quotes });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to calculate rates.' });
  }
});

/**
 * Admin & Fulfillment: Manifest order shipment, generate AWB and shipping label
 */
apiRouter.post('/v1/admin/logistics/shipments', requireStaffPermission('orders.edit'), async (req: Request, res: Response) => {
  try {
    const result = await logisticsManager.createShipment(req.body);
    if (!result.success || !result.awbNumber) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Carrier manifestation failed. Shipment was not booked.',
        data: result,
      });
    }

    if (req.body.orderId && result.awbNumber) {
      try {
        await orderService.transitionOrderStatus(
          req.body.orderId,
          'PROCESSING',
          { id: req.user?.id || 'STAFF', name: req.user?.name || 'Fulfillment Staff', role: req.user?.role || 'STAFF' },
          `Fulfillment manifested via ${result.carrierName}. AWB: ${result.awbNumber}`,
          { courierPartner: result.carrierName, trackingNumber: result.awbNumber }
        );
      } catch {
        // Order state update non-blocking
      }
    }
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message || 'Failed to create shipment.' });
  }
});

/**
 * Request carrier pickup for an AWB / Shiprocket shipment
 */
apiRouter.post('/v1/admin/logistics/shipments/:awb/pickup', requireStaffPermission('orders.edit'), async (req: Request, res: Response) => {
  try {
    const result = await logisticsManager.schedulePickup(
      String(req.params.awb || ''),
      req.body?.pickupDate,
      req.body?.carrierKey
    );
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message, data: result });
    }
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to schedule pickup.' });
  }
});

/**
 * Cancel manifested carrier shipment and sync OMS order status
 */
apiRouter.post('/v1/admin/logistics/shipments/:awb/cancel', requireStaffPermission('orders.edit'), async (req: Request, res: Response) => {
  try {
    const result = await shippingService.cancelShipment(
      String(req.params.awb || ''),
      String(req.body?.reason || 'Admin cancelled shipment'),
      req.user?.id || 'STAFF'
    );
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to cancel shipment.' });
  }
});

/**
 * Explicit unimplemented reverse pickup API endpoint
 */
apiRouter.post('/v1/admin/shipping/return-pickup', requireStaffPermission('orders.edit'), async (req: Request, res: Response) => {
  const result = await shippingService.initiateReturnPickup(String(req.body?.orderId || ''), String(req.body?.reason || ''));
  return res.status(result.success ? 200 : 501).json(result);
});

/**
 * Printable Shipping Label (authenticated admin/staff only)
 */
apiRouter.get('/v1/admin/logistics/shipments/:awb/label', requireStaffPermission('orders.view'), async (req: Request, res: Response) => {
  try {
    const labelRes = await logisticsManager.getShippingLabel(String(req.params.awb || ''));
    if (labelRes.redirectUrl) {
      const escapedUrl = labelRes.redirectUrl.replace(/"/g, '&quot;');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;text-align:center;">
          <h3>Official Carrier Shipping Label Ready</h3>
          <p><a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 20px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Download / Print Carrier Label PDF</a></p>
        </body></html>`
      );
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(labelRes.html || '');
  } catch (err: any) {
    const status = err?.status === 404 ? 404 : 500;
    return res.status(status).send(`<h2>Error rendering shipping label: ${err.message}</h2>`);
  }
});

/**
 * Live AWB tracking across all carriers (authenticated admin/staff only)
 */
apiRouter.get('/v1/admin/logistics/shipments/:awb/track', requireStaffPermission('orders.view'), async (req: Request, res: Response) => {
  try {
    const carrier = req.query.carrier as any;
    const details = await logisticsManager.trackShipment(String(req.params.awb || ''), carrier);
    res.json({ success: true, data: details });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Tracking lookup failed.' });
  }
});

/**
 * Unified multi-carrier webhook endpoint (fail-closed)
 */
apiRouter.post('/v1/shipping/webhook/:carrier', async (req: Request, res: Response) => {
  try {
    const carrier = String(req.params.carrier || '').toUpperCase();
    if (carrier === 'SHIPROCKET') {
      const token = (
        req.headers['x-api-key'] ||
        req.headers['x-shiprocket-token'] ||
        req.headers['authorization']?.replace(/^Bearer\s+/i, '')
      ) as string | undefined;
      const srResult = await shippingService.processShiprocketWebhook(token, req.body);
      if (!srResult.success) {
        const status = srResult.error?.startsWith('Unauthorized') ? 401 : 400;
        return res.status(status).json({ received: false, ...srResult });
      }
      return res.json({ received: true, ...srResult });
    }

    const result = await logisticsManager.handleWebhook(carrier, req.body, req.headers);
    if (!result.handled) {
      const status = result.error?.includes('Unauthorized') || result.error?.includes('secret not configured') ? 401 : 400;
      return res.status(status).json({ received: false, ...result });
    }
    return res.json({ received: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ received: false, error: err.message });
  }
});

// ============================================================================
// 10. COUPONS & PROMOTIONS (SERVER-AUTHORITATIVE PERSISTENCE & VALIDATION)
// ============================================================================

/**
 * Public Coupon Validation Endpoint
 * Validates active status, date range, min order value, usage limits, and returns computed discount.
 */
apiRouter.get('/v1/coupons/validate/:code', async (req: Request, res: Response) => {
  const subtotal = req.query.subtotal ? Number(req.query.subtotal) : 0;
  const validation = await couponRepository.validateWithContext({
    code: String(req.params.code || ''),
    subtotal,
    customerId: typeof req.query.customerId === 'string' ? req.query.customerId : undefined,
    customerEmail: typeof req.query.customerEmail === 'string' ? req.query.customerEmail : undefined,
    customerPhone: typeof req.query.customerPhone === 'string' ? req.query.customerPhone : undefined,
  });
  if (!validation.valid || !validation.coupon) {
    return res.status(400).json({
      success: false,
      error: validation.reason || 'Invalid or inactive coupon code.',
    });
  }

  const c = validation.coupon;
  return res.json({
    success: true,
    code: c.code,
    discountType: c.discountType,
    value: c.value,
    maxDiscount: c.maxDiscount,
    minOrderValue: c.minOrderValue,
    perUserLimit: c.perUserLimit,
    eligibleCategories: c.eligibleCategories,
    eligibleProductIds: c.eligibleProductIds,
    excludeShipping: c.excludeShipping,
    excludeTax: c.excludeTax,
    eligibleSubtotal: validation.eligibleSubtotal,
    calculatedDiscount: validation.discount,
    discountAmount: validation.discount,
    description: c.description,
  });
});

/**
 * Public Coupon Validation POST Endpoint (supports cart items, eligibility & per-user limit verification)
 */
apiRouter.post('/v1/coupons/validate', async (req: Request, res: Response) => {
  const { code, subtotal, items, customerId, customerEmail, customerPhone } = req.body || {};
  const numSubtotal = typeof subtotal === 'number' ? subtotal : Number(subtotal || 0);

  // Enrich cart items from server catalog so client cannot spoof categories/prices
  let enrichedItems: Array<{ productId: string; category?: string; world?: string; department?: string; lineTotal: number }> | undefined;
  let serverSubtotal = numSubtotal;

  if (Array.isArray(items) && items.length > 0) {
    enrichedItems = [];
    let computedSub = 0;
    for (const rawIt of items) {
      if (!rawIt?.productId) continue;
      const product = await productRepository.findById(String(rawIt.productId)).catch(() => null);
      const qty = Math.max(1, Number(rawIt.quantity || 1));
      const unitPrice = product ? Number(product.price || 0) : Number(rawIt.unitPrice || 0);
      const lineTotal = unitPrice * qty;
      computedSub += lineTotal;
      enrichedItems.push({
        productId: String(rawIt.productId),
        category: product?.categoryId || product?.franchise || rawIt.category,
        world: product?.world || rawIt.world,
        department: product?.department || rawIt.department,
        lineTotal,
      });
    }
    if (computedSub > 0) serverSubtotal = computedSub;
  }

  const validation = await couponRepository.validateWithContext({
    code: String(code || ''),
    subtotal: serverSubtotal,
    items: enrichedItems,
    customerId,
    customerEmail,
    customerPhone,
  });

  if (!validation.valid || !validation.coupon) {
    return res.json({
      success: true,
      data: {
        valid: false,
        reason: validation.reason || 'Invalid or inactive coupon code.',
        discountAmount: 0,
        calculatedDiscount: 0,
      },
    });
  }

  const c = validation.coupon;
  return res.json({
    success: true,
    data: {
      valid: true,
      code: c.code,
      discountType: c.discountType,
      value: c.value,
      discountAmount: validation.discount,
      calculatedDiscount: validation.discount,
      eligibleSubtotal: validation.eligibleSubtotal,
      minOrderValue: c.minOrderValue,
      maxDiscount: c.maxDiscount,
      perUserLimit: c.perUserLimit,
      eligibleCategories: c.eligibleCategories,
      eligibleProductIds: c.eligibleProductIds,
      excludeShipping: c.excludeShipping,
      excludeTax: c.excludeTax,
      description: c.description,
    },
  });
});

/**
 * Admin: List all coupons
 */
apiRouter.get('/v1/admin/coupons', requireStaffPermission('marketing.view'), async (_req: Request, res: Response) => {
  const coupons = await couponRepository.getAll();
  res.json({ success: true, count: coupons.length, data: coupons });
});

/**
 * Admin: Create new coupon
 */
apiRouter.post('/v1/admin/coupons', requireStaffPermission('marketing.edit'), async (req: Request, res: Response) => {
  try {
    const code = req.body.code;
    const rawVal = req.body.value !== undefined ? req.body.value : req.body.discountValue;
    if (!code || rawVal === undefined) {
      return res.status(400).json({ success: false, error: 'Both coupon "code" and "value" (or "discountValue") are required.' });
    }

    const discountType = req.body.discountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FLAT';
    const minOrderValue = req.body.minOrderValue !== undefined ? req.body.minOrderValue : (req.body.minOrder || req.body.minCartValue || 0);
    const maxDiscount = req.body.maxDiscount !== undefined ? req.body.maxDiscount : req.body.maxDiscountAmount;
    const usageLimit = req.body.usageLimit !== undefined ? req.body.usageLimit : req.body.usageLimitTotal;
    const perUserLimit = req.body.perUserLimit !== undefined ? req.body.perUserLimit : (req.body.perCustomerLimit || 1);
    const startDate = req.body.startDate;
    const expiryDate = req.body.expiryDate || req.body.endDate;
    const isActive = req.body.isActive !== undefined ? req.body.isActive : (req.body.active !== undefined ? req.body.active : true);
    const description = req.body.description || '';

    const created = await couponRepository.create(
      {
        code: String(code).toUpperCase().trim(),
        discountType,
        value: Number(rawVal),
        minOrderValue: Number(minOrderValue),
        maxDiscount: maxDiscount !== undefined ? Number(maxDiscount) : undefined,
        usageLimit: usageLimit !== undefined ? Number(usageLimit) : undefined,
        perUserLimit: Number(perUserLimit || 1),
        eligibleCategories: req.body.eligibleCategories,
        eligibleProductIds: req.body.eligibleProductIds,
        excludeShipping: req.body.excludeShipping !== false,
        excludeTax: req.body.excludeTax !== false,
        startDate: startDate ? new Date(startDate) : new Date(),
        expiryDate: expiryDate ? new Date(expiryDate) : new Date('2026-12-31T23:59:59.000Z'),
        isActive: Boolean(isActive),
        description: description || '',
      },
      req.user?.id || 'ADMIN'
    );

    return res.status(201).json({
      success: true,
      message: 'Coupon created successfully.',
      data: {
        ...created,
        active: created.isActive,
        discountValue: created.value,
      },
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message || 'Failed to create coupon.' });
  }
});

/**
 * Admin: Update coupon
 */
apiRouter.put('/v1/admin/coupons/:id', requireStaffPermission('marketing.edit'), async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const updates: any = { ...body };
    if (body.minCartValue !== undefined && body.minOrderValue === undefined) {
      updates.minOrderValue = Number(body.minCartValue);
    }
    if (body.perCustomerLimit !== undefined && body.perUserLimit === undefined) {
      updates.perUserLimit = Number(body.perCustomerLimit);
    }
    if (body.endDate !== undefined && body.expiryDate === undefined) {
      updates.expiryDate = new Date(body.endDate);
    }
    const updated = await couponRepository.update(String(req.params.id || ''), updates, req.user?.id || 'ADMIN');
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Coupon not found.' });
    }
    return res.json({ success: true, message: 'Coupon updated successfully.', data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message || 'Failed to update coupon.' });
  }
});

/**
 * Admin: Toggle coupon active/inactive status
 */
apiRouter.post('/v1/admin/coupons/:id/toggle', requireStaffPermission('marketing.edit'), async (req: Request, res: Response) => {
  try {
    const updated = await couponRepository.toggleActive(String(req.params.id || ''), req.user?.id || 'ADMIN');
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Coupon not found.' });
    }
    return res.json({
      success: true,
      message: `Coupon is now ${updated.isActive ? 'active' : 'inactive'}.`,
      data: {
        ...updated,
        active: updated.isActive,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to toggle coupon status.' });
  }
});

/**
 * Admin: Delete coupon
 */
apiRouter.delete('/v1/admin/coupons/:id', requireStaffPermission('marketing.edit'), async (req: Request, res: Response) => {
  try {
    const success = await couponRepository.delete(String(req.params.id || ''), req.user?.id || 'ADMIN');
    if (!success) {
      return res.status(404).json({ success: false, error: 'Coupon not found.' });
    }
    return res.json({ success: true, message: 'Coupon deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete coupon.' });
  }
});
