import {
  AdminProduct,
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
  AdminUser,
  InventoryItem,
  InventoryMovement,
  Role,
  Permission,
} from '../types';
import { PRODUCTS } from '../../data/products';

export const INITIAL_ADMIN_USERS: AdminUser[] = [
  {
    id: 'user-01',
    name: 'Saif (Owner)',
    email: 'admin@toriwear.com',
    role: 'SUPER_ADMIN',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    twoFactorEnabled: false,
    lastLogin: 'Today at 07:14 PM IST',
    isActive: true,
    department: 'Executive Leadership',
  },
  {
    id: 'user-02',
    name: 'Ananya Sharma',
    email: 'ananya.operations@toriwear.com',
    role: 'STORE_MANAGER',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    twoFactorEnabled: false,
    lastLogin: 'Today at 05:22 PM IST',
    isActive: true,
    department: 'Store Operations',
  },
  {
    id: 'user-03',
    name: 'Vikram Mehta',
    email: 'vikram.inventory@toriwear.com',
    role: 'INVENTORY_MANAGER',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
    twoFactorEnabled: false,
    lastLogin: 'Yesterday at 04:30 PM IST',
    isActive: true,
    department: 'Warehouse & Fulfillment',
  },
  {
    id: 'user-04',
    name: 'Priya Patel',
    email: 'priya.marketing@toriwear.com',
    role: 'MARKETING_MANAGER',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80',
    twoFactorEnabled: false,
    lastLogin: '3 days ago',
    isActive: true,
    department: 'Growth & Campaigns',
  },
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    'products.view', 'products.create', 'products.edit', 'products.delete',
    'inventory.view', 'inventory.edit',
    'orders.view', 'orders.edit', 'orders.cancel',
    'refunds.create', 'payments.view',
    'marketing.create', 'marketing.edit',
    'customers.view', 'customers.edit',
    'website.edit', 'reports.view',
    'staff.manage', 'security.manage', 'settings.manage',
    'finance.view', 'finance.create', 'finance.edit', 'finance.approve', 'finance.partners', 'finance.accounts', 'finance.reports',
    'ai.view', 'ai.create', 'ai.edit', 'ai.approve', 'ai.delete', 'ai.settings',
    'AI_DESIGN_LAB_VIEW', 'AI_DESIGN_LAB_CREATE', 'AI_DESIGN_LAB_EDIT', 'AI_DESIGN_LAB_APPROVE', 'AI_DESIGN_LAB_DELETE', 'AI_DESIGN_LAB_SETTINGS',
  ],
  PARTNER: [
    'products.view', 'products.create', 'products.edit', 'products.delete',
    'inventory.view', 'inventory.edit',
    'orders.view', 'orders.edit', 'orders.cancel',
    'refunds.create', 'payments.view',
    'marketing.create', 'marketing.edit',
    'customers.view', 'customers.edit',
    'website.edit', 'reports.view',
    'finance.view', 'finance.create', 'finance.edit', 'finance.approve', 'finance.partners', 'finance.accounts', 'finance.reports',
    'ai.view', 'ai.create', 'ai.edit', 'ai.approve',
    'AI_DESIGN_LAB_VIEW', 'AI_DESIGN_LAB_CREATE', 'AI_DESIGN_LAB_EDIT', 'AI_DESIGN_LAB_APPROVE',
  ],
  FINANCE_MANAGER: [
    'orders.view', 'payments.view', 'reports.view',
    'finance.view', 'finance.create', 'finance.edit', 'finance.approve', 'finance.accounts', 'finance.reports',
  ],
  STORE_MANAGER: [
    'products.view', 'products.create', 'products.edit',
    'inventory.view', 'inventory.edit',
    'orders.view', 'orders.edit', 'orders.cancel',
    'refunds.create', 'payments.view',
    'marketing.view' as any, 'marketing.edit',
    'customers.view', 'website.edit', 'reports.view',
    'ai.view', 'ai.create', 'ai.edit', 'ai.approve',
    'AI_DESIGN_LAB_VIEW', 'AI_DESIGN_LAB_CREATE', 'AI_DESIGN_LAB_EDIT', 'AI_DESIGN_LAB_APPROVE',
  ],
  ORDER_MANAGER: [
    'orders.view', 'orders.edit', 'orders.cancel',
    'refunds.create', 'customers.view', 'reports.view',
  ],
  INVENTORY_MANAGER: [
    'products.view', 'inventory.view', 'inventory.edit', 'reports.view',
  ],
  MARKETING_MANAGER: [
    'marketing.create', 'marketing.edit', 'website.edit',
    'products.view', 'reports.view',
    'ai.view', 'ai.create',
    'AI_DESIGN_LAB_VIEW', 'AI_DESIGN_LAB_CREATE',
  ],
  ACCOUNTANT: [
    'payments.view', 'reports.view', 'orders.view',
    'finance.view', 'finance.create', 'finance.edit', 'finance.reports',
  ],
  CONTENT_MANAGER: [
    'website.edit', 'products.view', 'products.edit',
    'ai.view', 'ai.create', 'ai.edit',
    'AI_DESIGN_LAB_VIEW', 'AI_DESIGN_LAB_CREATE', 'AI_DESIGN_LAB_EDIT',
  ],
  CUSTOMER_SUPPORT: [
    'orders.view', 'orders.edit', 'customers.view', 'customers.edit',
  ],
  VIEWER: [
    'products.view', 'orders.view', 'reports.view', 'finance.view',
  ],
};

// Generate admin products based on PRODUCTS list
export const INITIAL_ADMIN_PRODUCTS: AdminProduct[] = PRODUCTS.map((p, idx) => {
  const isOriginal = p.franchise === 'Toriwear Originals';
  const isMarvelDc = ['Marvel', 'DC Universe', 'Avengers', 'Disney / Pixar Kids'].includes(p.franchise);
  const licenseRights: 'Owned IP' | 'Licensed' | 'Pending Authorization' = isOriginal 
    ? 'Owned IP' 
    : isMarvelDc 
    ? 'Licensed' 
    : 'Owned IP';

  const sizes: ('XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL')[] = ['S', 'M', 'L', 'XL', 'XXL'];
  const variants = sizes.map((sz, szIdx) => ({
    id: `var-${p.id}-${sz}`,
    sku: `TORI-${p.catalogNumber}-${sz}`,
    size: sz,
    colorName: p.colors[0]?.name || 'Obsidian Black',
    colorHex: p.colors[0]?.hex || '#111115',
    price: p.price,
    stock: idx === 0 ? 8 : (idx % 4 === 0 ? 3 : 24 + ((idx * 3 + szIdx * 5) % 35)),
    reserved: 0,
    barcode: `890${p.catalogNumber.padStart(3, '0')}${szIdx + 1}092`,
    weightGrams: 340,
  }));

  return {
    id: p.id,
    catalogNumber: p.catalogNumber,
    name: p.name,
    sku: `TORI-TSHIRT-${p.catalogNumber}`,
    franchise: p.franchise,
    universe: (p.universe as any) || 'ORIGINALS',
    category: 'Oversized Tees',
    fit: (p.fit as any) || 'Oversized',
    price: p.price,
    mrp: p.originalPrice,
    costPrice: Math.round(p.price * 0.38),
    discountPercent: Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100),
    gstRate: 5,
    rating: p.rating,
    reviewsCount: p.reviewsCount,
    images: p.images,
    description: p.description,
    shortDescription: `${p.gsm} GSM drop-shoulder oversized streetwear fit featuring archival ${p.franchise} graphic detailing.`,
    storyQuote: p.storyQuote,
    drop: p.drop,
    gsm: p.gsm,
    fabric: p.fabric,
    neck: p.neck,
    sleeves: p.sleeves,
    print: p.print,
    tags: [p.franchise.toLowerCase(), 'heavyweight', 'streetwear', 'oversized', p.fit.toLowerCase()],
    seoTitle: `${p.name} Oversized Heavyweight T-Shirt | TORIWEAR India`,
    seoDescription: `Shop the official ${p.name} anime streetwear t-shirt. 240+ GSM combed cotton, drop shoulder cut. Fast shipping across India.`,
    slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    publishingStatus: 'PUBLISHED',
    licenseRightsStatus: licenseRights,
    variants,
    totalSold: 0,
    createdAt: '2026-08-10T10:00:00Z',
    updatedAt: '2026-09-15T14:30:00Z',
  };
});

// Generate initial inventory items
export const INITIAL_INVENTORY_ITEMS: InventoryItem[] = INITIAL_ADMIN_PRODUCTS.flatMap((prod) => 
  prod.variants.map((v) => {
    let status: 'IN_STOCK' | 'LOW_STOCK' | 'CRITICAL_STOCK' | 'OUT_OF_STOCK' | 'DISABLED' = 'IN_STOCK';
    if (v.stock === 0) status = 'OUT_OF_STOCK';
    else if (v.stock <= 2) status = 'CRITICAL_STOCK';
    else if (v.stock <= 5) status = 'LOW_STOCK';

    return {
      id: `inv-${v.id}`,
      productId: prod.id,
      productName: prod.name,
      variantId: v.id,
      sku: v.sku,
      size: v.size,
      colorName: v.colorName,
      availableStock: v.stock,
      reservedStock: v.reserved,
      sold: 0,
      lowStockThreshold: 5,
      criticalThreshold: 2,
      status,
      lastUpdated: '2026-09-20 18:45 IST',
    };
  })
);

export const INITIAL_INVENTORY_MOVEMENTS: InventoryMovement[] = [];

export const INITIAL_ORDERS: AdminOrder[] = [];


export const INITIAL_PAYMENT_TRANSACTIONS: PaymentTransaction[] = [];


export const INITIAL_CUSTOMERS: CustomerProfile[] = [];


export const INITIAL_COUPONS: Coupon[] = [
  {
    id: 'coup-01',
    code: 'DROP2026',
    discountType: 'PERCENTAGE',
    value: 15,
    minCartValue: 1999,
    maxDiscount: 600,
    usageLimit: 500,
    usageCount: 184,
    perCustomerLimit: 1,
    applicableFranchises: ['ALL'],
    startDate: '2026-09-01',
    endDate: '2026-10-31',
    isActive: true,
  },
  {
    id: 'coup-02',
    code: 'ANIME10',
    discountType: 'PERCENTAGE',
    value: 10,
    minCartValue: 999,
    maxDiscount: 300,
    usageLimit: 1000,
    usageCount: 429,
    perCustomerLimit: 2,
    applicableFranchises: ['ALL'],
    startDate: '2026-08-01',
    endDate: '2026-12-31',
    isActive: true,
  },
  {
    id: 'coup-03',
    code: 'FREESHIP',
    discountType: 'FREE_SHIPPING',
    value: 79,
    minCartValue: 799,
    usageLimit: 2000,
    usageCount: 812,
    perCustomerLimit: 3,
    applicableFranchises: ['ALL'],
    startDate: '2026-07-01',
    endDate: '2026-12-31',
    isActive: true,
  },
  {
    id: 'coup-04',
    code: 'TORIVIP20',
    discountType: 'PERCENTAGE',
    value: 20,
    minCartValue: 2499,
    maxDiscount: 800,
    usageLimit: 100,
    usageCount: 42,
    perCustomerLimit: 1,
    applicableFranchises: ['Toriwear Originals'],
    startDate: '2026-09-15',
    endDate: '2026-10-15',
    isActive: true,
  },
];

export const INITIAL_ADVERTISEMENTS: Advertisement[] = [
  {
    id: 'ad-01',
    name: 'Drop 001 Shadow Era Main Banner',
    campaign: 'Drop 001 Launch',
    placement: 'Homepage Hero',
    desktopImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1600&auto=format&fit=crop&q=80',
    mobileImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
    headline: 'DROP 001 — SHADOW ERA',
    subheadline: 'Archival 240 GSM Japanese combed cotton. Minted in strictly limited batches.',
    ctaText: 'SHOP THE DROP',
    ctaLink: '#catalogue-gallery-section',
    startDate: '2026-09-01',
    endDate: '2026-10-15',
    priority: 1,
    status: 'ACTIVE',
    clicks: 1420,
    impressions: 18450,
  },
  {
    id: 'ad-02',
    name: 'Tori Originals Neo Ronin Spotlight',
    campaign: 'Original IP Awareness',
    placement: 'New Drop',
    desktopImage: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=1600&auto=format&fit=crop&q=80',
    mobileImage: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=800&auto=format&fit=crop&q=80',
    headline: 'BORN IN THE TORI UNIVERSE',
    subheadline: 'Proprietary Tokyo street lore featuring Aki, Kai, and Ren.',
    ctaText: 'EXPLORE ORIGINALS',
    ctaLink: '#tori-originals-lore-section',
    startDate: '2026-09-10',
    endDate: '2026-11-01',
    priority: 2,
    status: 'ACTIVE',
    clicks: 890,
    impressions: 11200,
  },
];

export const INITIAL_FLASH_SALES: FlashSaleCampaign[] = [
  {
    id: 'flash-01',
    name: 'MIDNIGHT TOKYO FLASH SALE',
    tagline: 'Flat 20% Off All Heavyweight Anime Oversized Tees',
    productIds: ['tori-01', 'tori-001', 'tori-007', 'tori-03'],
    discountPercent: 20,
    startDate: '2026-09-20T20:00:00',
    endDate: '2026-09-23T23:59:59',
    bannerImage: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1200&auto=format&fit=crop&q=80',
    status: 'ACTIVE',
  },
];

export const INITIAL_WEBSITE_SECTIONS: WebsiteSection[] = [
  { id: 'sec-1', key: 'hero', name: '01. Hero "Wear Your World"', description: 'Cinematic hero stage with original character cards and particle canvas', isEnabled: true, order: 1 },
  { id: 'sec-2', key: 'choose_your_world', name: '02. Choose Your World', description: 'Dual store gateways: Men (5 Worlds) vs Kids (5 Worlds)', isEnabled: true, order: 2 },
  { id: 'sec-3', key: 'new_drop', name: '03. New Drop: Chapter 01 Originals', description: 'Flagship capsule launch with hover image preview and quick add', isEnabled: true, order: 3 },
  { id: 'sec-4', key: 'shop_men', name: '04. Shop Men (5 Worlds)', description: 'Dark Shonen, Cyberpunk, Retro Y2K, Samurai, Street Anime', isEnabled: true, order: 4 },
  { id: 'sec-5', key: 'shop_kids', name: '05. Shop Kids (5 Worlds)', description: 'Cute Adventure, Robot & Future, Retro Game, Mini Samurai, Fantasy Creatures', isEnabled: true, order: 5 },
  { id: 'sec-6', key: 'trending_now', name: '06. Trending Now', description: 'High engagement community fits and campus favorites', isEnabled: true, order: 6 },
  { id: 'sec-7', key: 'bestsellers', name: '07. Bestsellers', description: 'The ones everyone is wearing with 4.9+ star ratings', isEnabled: true, order: 7 },
  { id: 'sec-8', key: 'tori_universe', name: '08. The Tori Universe', description: 'Narrative worldbuilding, lore pillars, and Chapter One introduction', isEnabled: true, order: 8 },
  { id: 'sec-9', key: 'original_characters', name: '09. Original Characters', description: 'Interactive roster profiles (Tori, Ren, Kai, Yuki, Aki, Kami & Zero)', isEnabled: true, order: 9 },
  { id: 'sec-10', key: 'story_behind_designs', name: '10. Story Behind The Designs', description: 'Archival design breakdown for Void Walker, Neon Ronin, 02:17 AM, etc.', isEnabled: true, order: 10 },
  { id: 'sec-11', key: 'customer_lookbook', name: '11. Seen in the Real World Lookbook', description: 'Community street fits with customer ratings and size references', isEnabled: true, order: 11 },
  { id: 'sec-12', key: 'tori_feed', name: '12. Enter The Tori Feed', description: 'Atelier design sketches, concept art notes, and drop snaps', isEnabled: true, order: 12 },
  { id: 'sec-13', key: 'newsletter', name: '13. Enter The Universe Newsletter', description: 'Drop alerts, chapter access, and instant ₹100 discount coupon', isEnabled: true, order: 13 },
  { id: 'sec-14', key: 'faq', name: '14. Frequently Asked Questions', description: 'Original IP clarity, sizing, fabric care, and pan-India shipping', isEnabled: true, order: 14 },
];

export const INITIAL_HERO_SETTINGS: HeroSettings = {
  headline: 'WEAR YOUR WORLD.',
  subheadline: 'Original anime-inspired streetwear created for people who live between imagination and reality.',
  ctaText: 'SHOP MEN',
  ctaLink: '#shop-men-section',
  bgImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1600&auto=format&fit=crop&q=80',
  mobileImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
  overlayOpacity: 75,
  leftCardTag: 'ORIGINAL LORE · 01',
  leftCardTitle: 'REN // DARK SHONEN',
  leftCardDesc: '“Some people run from the darkness. He learned to walk through it.”',
  leftCardImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
  rightCardTag: 'ORIGINAL LORE · 02',
  rightCardTitle: 'YUKI // CYBERPUNK',
  rightCardDesc: '“Midnight runs through rain-slicked neon alleys of Neo Tokyo.”',
  rightCardImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
  secondaryCtaText: 'SHOP KIDS',
  tertiaryCtaText: 'TRY TWIN COMBO 👯',
  tertiaryCtaBadge: 'SAVE 10%',
  preheaderTag: 'ORIGINAL TOKYO-INSPIRED STREETWEAR',
  preheaderHighlight: '240 GSM',
  trustBadge1: '240 GSM Combed Cotton',
  trustBadge2: '100% Original Japanese Anime IP',
  trustBadge3: 'Free Pan-India Delivery Over ₹999',
};

export const INITIAL_RETURN_REQUESTS: ReturnRequest[] = [];


export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-001',
    adminName: 'Saif (Owner)',
    adminEmail: 'admin@toriwear.com',
    action: 'PRICE_UPDATED',
    entity: 'Product #tori-001 (Shadow Monarch Oversized Tee)',
    details: 'Price updated from ₹1,299 to ₹1,199 ahead of Drop 001 campaign launch.',
    oldValue: '₹1,299',
    newValue: '₹1,199',
    timestamp: '2026-09-21 16:40 IST',
    ipAddress: '152.58.112.9 (Mumbai, India)',
  },
  {
    id: 'log-002',
    adminName: 'Vikram Mehta',
    adminEmail: 'vikram.inventory@toriwear.com',
    action: 'STOCK_MODIFIED',
    entity: 'Variant #TORI-01-L (Shinobi Legacy L)',
    details: 'Added 50 units following QA inspection from Tirupur warehouse batch.',
    oldValue: '4 units',
    newValue: '54 units',
    timestamp: '2026-09-21 16:30 IST',
    ipAddress: '103.21.144.2 (Bengaluru, India)',
  },
  {
    id: 'log-003',
    adminName: 'Ananya Sharma',
    adminEmail: 'ananya.operations@toriwear.com',
    action: 'ORDER_STATUS_CHANGED',
    entity: 'Order #TORI-10482',
    details: 'Status changed from CONFIRMED to PACKED. AWB label generated via Bluedart.',
    oldValue: 'CONFIRMED',
    newValue: 'PACKED',
    timestamp: '2026-09-21 18:30 IST',
    ipAddress: '49.36.19.88 (New Delhi, India)',
  },
  {
    id: 'log-004',
    adminName: 'Saif (Owner)',
    adminEmail: 'admin@toriwear.com',
    action: 'REFUND_INITIATED',
    entity: 'Order #TORI-10477',
    details: 'Refund of ₹1,128 initiated for cancelled order. Razorpay RRN generated.',
    oldValue: 'PAID',
    newValue: 'REFUNDED',
    timestamp: '2026-09-20 11:35 IST',
    ipAddress: '152.58.112.9 (Mumbai, India)',
  },
  {
    id: 'log-005',
    adminName: 'Saif (Owner)',
    adminEmail: 'admin@toriwear.com',
    action: 'LOGIN_SUCCESS',
    entity: 'Admin Session',
    details: 'Successful 2FA login via Authenticator TOTP token.',
    timestamp: '2026-09-21 19:14 IST',
    ipAddress: '152.58.112.9 (Mumbai, India)',
  },
];

export const INITIAL_SECURITY_SESSIONS: SecuritySession[] = [
  {
    id: 'sess-01',
    adminEmail: 'admin@toriwear.com',
    device: 'MacBook Pro 16"',
    browser: 'Chrome 128.0',
    os: 'macOS Sonoma',
    location: 'Mumbai, Maharashtra, India',
    ipAddress: '152.58.112.9',
    lastActive: 'Active Now (Current Session)',
    isCurrent: true,
  },
  {
    id: 'sess-02',
    adminEmail: 'admin@toriwear.com',
    device: 'iPhone 15 Pro Max',
    browser: 'Mobile Safari',
    os: 'iOS 18.0',
    location: 'Mumbai, Maharashtra, India',
    ipAddress: '152.58.112.18',
    lastActive: '2 hours ago',
    isCurrent: false,
  },
  {
    id: 'sess-03',
    adminEmail: 'ananya.operations@toriwear.com',
    device: 'Dell XPS 15',
    browser: 'Firefox Developer Edition',
    os: 'Windows 11 Pro',
    location: 'New Delhi, India',
    ipAddress: '49.36.19.88',
    lastActive: '18 minutes ago',
    isCurrent: false,
  },
];

export const INITIAL_STORE_SETTINGS: StoreSettings = {
  storeName: 'TORIWEAR STORE',
  tagline: 'WEAR YOUR WORLD.',
  businessEmail: 'contact@toriwear.com',
  supportEmail: 'support@toriwear.com',
  phone: '+91 80009 26262',
  businessAddress: 'TORIWEAR FASHION LABS PVT LTD, Plot 42-B, Indiranagar 100ft Road, Bengaluru, Karnataka 560038',
  currency: 'INR',
  currencySymbol: '₹',
  timezone: 'Asia/Kolkata (IST)',
  orderPrefix: 'TORI-',
  invoicePrefix: 'INV-2026-',
  gstNumber: '29AABCT1928K1Z5',
  defaultGstRate: 5,
  taxInclusivePricing: true,
  freeShippingThreshold: 999,
  standardShippingFee: 79,
  expressShippingFee: 149,
  codFee: 50,
  maintenanceMode: false,
  enforceApprovedLicenseOnly: true,
  lowStockThreshold: 5,
  criticalStockThreshold: 2,
  backupStatus: {
    lastBackup: 'Today at 04:00 AM IST (Automated Daily Cloud Snapshot)',
    nextBackup: 'Tomorrow at 04:00 AM IST',
    health: 'OPTIMAL',
    size: '142.8 MB (AES-256 Encrypted)',
  },
};
