import { AnimeFranchise, PopUniverse, FitType, ContactChannelItem, MetaBusinessConfig, ReturnStatusValue, ReturnRequestItemRecord, ReturnStatusHistoryEntry } from '../types';

export type Role = 
  | 'SUPER_ADMIN'
  | 'PARTNER'
  | 'FINANCE_MANAGER'
  | 'ACCOUNTANT'
  | 'STORE_MANAGER'
  | 'ORDER_MANAGER'
  | 'INVENTORY_MANAGER'
  | 'MARKETING_MANAGER'
  | 'CONTENT_MANAGER'
  | 'CUSTOMER_SUPPORT'
  | 'VIEWER';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  adminAccessTier?: string;
  employeeId?: string;
  designation?: string;
  avatarUrl?: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  lastLogin: string;
  isActive: boolean;
  department?: string;
  permissions?: Record<string, string[]>;
}

export type Permission = 
  | 'products.view'
  | 'products.create'
  | 'products.edit'
  | 'products.delete'
  | 'inventory.view'
  | 'inventory.edit'
  | 'orders.view'
  | 'orders.edit'
  | 'orders.cancel'
  | 'refunds.create'
  | 'payments.view'
  | 'marketing.create'
  | 'marketing.edit'
  | 'customers.view'
  | 'customers.edit'
  | 'website.edit'
  | 'reports.view'
  | 'staff.manage'
  | 'security.manage'
  | 'settings.manage'
  | 'superadmin.view'
  | 'superadmin.edit'
  | 'finance.view'
  | 'finance.create'
  | 'finance.edit'
  | 'finance.approve'
  | 'finance.partners'
  | 'finance.accounts'
  | 'finance.reports'
  | 'ai.view'
  | 'ai.create'
  | 'ai.edit'
  | 'ai.approve'
  | 'ai.delete'
  | 'ai.settings'
  | 'AI_DESIGN_LAB_VIEW'
  | 'AI_DESIGN_LAB_CREATE'
  | 'AI_DESIGN_LAB_EDIT'
  | 'AI_DESIGN_LAB_APPROVE'
  | 'AI_DESIGN_LAB_DELETE'
  | 'AI_DESIGN_LAB_SETTINGS';

export * from './types/ai';
export * from './types/finance';

export type PublishingStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

export type LicenseRightsStatus = 'Owned IP' | 'Licensed' | 'Pending Authorization' | 'Not Authorized';

export interface AdminProductVariant {
  id: string;
  sku: string;
  size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
  colorName: string;
  colorHex: string;
  price: number;
  stock: number;
  reserved: number;
  barcode: string;
  weightGrams: number;
}

export interface AdminProduct {
  id: string;
  catalogNumber: string;
  name: string;
  sku: string;
  department?: 'MEN' | 'KIDS';
  world?: string;
  franchise: AnimeFranchise;
  universe: PopUniverse;
  category: 'T-Shirts' | 'Oversized Tees' | 'Hoodies' | 'Cargoes' | 'Accessories';
  fit: FitType;
  price: number;
  mrp: number;
  costPrice: number;
  discountPercent: number;
  gstRate: number; // e.g. 5 or 12
  rating: number;
  reviewsCount: number;
  images: string[];
  description: string;
  shortDescription: string;
  storyQuote: string;
  drop: string;
  gsm: number;
  fabric: string;
  neck: string;
  sleeves: string;
  print: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  slug: string;
  publishingStatus: PublishingStatus;
  licenseRightsStatus: LicenseRightsStatus;
  categoryIds?: string[];
  variants: AdminProductVariant[];
  stock?: number;
  inStock?: boolean;
  totalSold: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  size: string;
  colorName: string;
  availableStock: number;
  reservedStock: number;
  sold: number;
  lowStockThreshold: number;
  criticalThreshold: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'CRITICAL_STOCK' | 'OUT_OF_STOCK' | 'DISABLED';
  lastUpdated: string;
}

export interface InventoryMovement {
  id: string;
  timestamp: string;
  productId: string;
  productName: string;
  sku: string;
  type: 'INCREASE' | 'DECREASE' | 'ORDER_RESERVED' | 'RESTOCK' | 'DAMAGE_WRITE_OFF' | 'MANUAL_CORRECTION';
  amount: number;
  previousStock: number;
  newStock: number;
  reason: string;
  adminName: string;
}

export type OrderShippingStatus = 
  | 'NEW'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'PACKED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | 'RETURNED'
  | 'REFUNDED';

export type PaymentStatus = 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export interface OrderItem {
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  size: string;
  color: string;
  image: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface AdminOrder {
  orderId: string;
  orderNumber: string; // e.g. #TORI-10482
  date: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: OrderItem[];
  subtotal: number;
  discount: number;
  discountCode?: string;
  tax: number;
  shippingFee: number;
  total: number;
  paymentMethod: 'UPI' | 'Credit Card' | 'Debit Card' | 'Net Banking' | 'COD';
  paymentStatus: PaymentStatus;
  shippingStatus: OrderShippingStatus;
  courier?: string;
  trackingNumber?: string;
  awbNumber?: string;
  estimatedDelivery: string;
  timeline: {
    title: string;
    timestamp: string;
    note?: string;
  }[];
  internalNotes: {
    id: string;
    text: string;
    author: string;
    timestamp: string;
  }[];
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  method: 'UPI' | 'Credit Card' | 'Debit Card' | 'Net Banking' | 'COD';
  gateway: 'Razorpay' | 'Cashfree' | 'Stripe' | 'COD Handled';
  gatewayRefId: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED';
  date: string;
  refundStatus?: 'NONE' | 'REQUESTED' | 'PROCESSING' | 'COMPLETED';
  refundAmount?: number;
  fee: number;
  netSettlement: number;
}

export interface CustomerSavedAddress {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface CustomerProductView {
  productId: string;
  productName: string;
  price: number;
  image: string;
  department?: string;
  inStock: boolean;
  viewedAt: string;
}

export interface CustomerCartItemPreview {
  productId: string;
  productName: string;
  size: string;
  color: string;
  price: number;
  quantity: number;
  image: string;
  inStock: boolean;
  addedAt?: string;
}

export interface CustomerWishlistItemPreview {
  productId: string;
  productName: string;
  price: number;
  image: string;
  inStock: boolean;
  addedAt?: string;
}

export interface CustomerSavedCard {
  id: string;
  cardHolder: string;
  last4: string;
  exp: string;
  brand: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  avgOrderValue?: number;
  savedAddresses?: CustomerSavedAddress[];
  lastOrderDate: string;
  createdAt: string;
  status: 'ACTIVE' | 'INACTIVE';
  segment: 'VIP Customers' | 'Returning Customers' | 'New Customers' | 'High Value' | 'COD Customers' | 'Frequent Buyers';
  tags: string[];
  notes: string[] | string;
  // Customer Activity Tracking
  searchHistory?: string[];
  productViews?: CustomerProductView[];
  cartItems?: CustomerCartItemPreview[];
  wishlistItems?: CustomerWishlistItemPreview[];
  toriCredit?: number;
  savedVpa?: string[];
  savedCards?: CustomerSavedCard[];
  insiderTier?: 'Bronze' | 'Silver' | 'Gold' | 'VIP Insider';
  insiderPoints?: number;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';
  value: number; // e.g. 15 for 15% or 200 for ₹200
  minCartValue: number;
  maxDiscount?: number;
  usageLimit: number;
  usageCount: number;
  perCustomerLimit: number;
  applicableFranchises: string[];
  eligibleCategories?: string[];
  eligibleProductIds?: string[];
  excludeShipping?: boolean;
  excludeTax?: boolean;
  startDate: string;
  endDate: string;
  expiryDate?: string;
  isActive: boolean;
  description?: string;
  minOrderValue?: number;
}

export interface FlashSaleCampaign {
  id: string;
  name: string;
  tagline: string;
  productIds: string[];
  discountPercent: number;
  startDate: string;
  endDate: string;
  bannerImage: string;
  status: 'DRAFT' | 'ACTIVE' | 'SCHEDULED' | 'EXPIRED';
}

export interface Advertisement {
  id: string;
  name: string;
  campaign: string;
  placement: 
    | 'Homepage Hero'
    | 'Homepage Banner'
    | 'New Drop'
    | 'Collection Page'
    | 'Product Page'
    | 'Popup'
    | 'Mobile Banner'
    | 'Checkout';
  desktopImage: string;
  mobileImage: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaLink: string;
  startDate: string;
  endDate: string;
  priority: number;
  status: 'ACTIVE' | 'SCHEDULED' | 'DRAFT' | 'EXPIRED';
  clicks: number;
  impressions: number;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  type: 'Social Ad' | 'Influencer' | 'Email Blast' | 'Search Engine' | 'Flash Sale';
  startDate: string;
  endDate: string;
  views: number;
  clicks: number;
  ctr: number;
  orders: number;
  revenue: number;
  adSpend: number;
  roi: number;
  status: 'ACTIVE' | 'SCHEDULED' | 'PAST';
}

export interface WebsiteSection {
  id: string;
  key: string;
  name: string;
  title?: string;
  type?: string;
  description: string;
  isEnabled: boolean;
  order: number;
}

export interface HeroSettings {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaLink: string;
  bgImage: string;
  mobileImage: string;
  overlayOpacity: number;
  // Left Hero Side Box (Ren Lore Card)
  leftCardTag?: string;
  leftCardTitle?: string;
  leftCardDesc?: string;
  leftCardImage?: string;
  // Right Hero Side Box (Yuki Lore Card)
  rightCardTag?: string;
  rightCardTitle?: string;
  rightCardDesc?: string;
  rightCardImage?: string;
  // Hero Buttons
  secondaryCtaText?: string;
  tertiaryCtaText?: string;
  tertiaryCtaBadge?: string;
  // Pre-header Pill Tag (Circled Top)
  preheaderTag?: string;
  preheaderHighlight?: string;
  // Quality / Trust Badges (Circled Bottom 3)
  trustBadge1?: string;
  trustBadge2?: string;
  trustBadge3?: string;
}

export interface ReturnRequest {
  id: string;
  returnNumber?: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  requestType?: 'RETURN' | 'EXCHANGE';
  productName: string;
  size: string;
  reason: string;
  comments?: string;
  status: ReturnStatusValue | 'REVIEWING' | 'PRODUCT_RECEIVED' | 'QC_PASSED' | 'REFUNDED';
  refundAmount: number;
  refundedAmount?: number;
  refundMethod?: string;
  refundTransactionId?: string | null;
  refundGateway?: string | null;
  refundStatus?: string | null;
  proofUrls?: string[];
  pickupCourier?: string | null;
  pickupAwb?: string | null;
  pickupScheduledAt?: string | null;
  rejectionReason?: string | null;
  stockRestored?: boolean;
  items?: ReturnRequestItemRecord[];
  statusHistory?: ReturnStatusHistoryEntry[];
  date: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  adminName: string;
  userName?: string;
  adminEmail: string;
  action: 
    | 'PRODUCT_CREATED'
    | 'PRODUCT_UPDATED'
    | 'PRODUCT_ARCHIVED'
    | 'PRODUCT_DELETED'
    | 'PRICE_UPDATED'
    | 'STOCK_MODIFIED'
    | 'ORDER_STATUS_CHANGED'
    | 'ORDER_CANCELLED'
    | 'REFUND_INITIATED'
    | 'COUPON_CREATED'
    | 'COUPON_UPDATED'
    | 'STAFF_ADDED'
    | 'PERMISSION_CHANGED'
    | 'SETTINGS_SAVED'
    | 'MAINTENANCE_TOGGLED'
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'SESSION_REVOKED'
    | '2FA_VERIFIED'
    | 'CONTENT_UPDATE'
    | 'AI_GENERATED';
  entity: string;
  module?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  details: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
  ipAddress: string;
}

export interface SecuritySession {
  id: string;
  adminEmail: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  ipAddress: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface StoreSettings {
  storeName: string;
  legalBusinessName?: string;
  tagline: string;
  businessEmail: string;
  supportEmail: string;
  phone: string;
  businessAddress: string;
  operatingHours?: string;
  returnWindowDays?: number;
  whatsappMessage?: string;
  contactChannels?: ContactChannelItem[];
  metaBusiness?: MetaBusinessConfig;
  currency: string;
  currencySymbol: string;
  timezone: string;
  orderPrefix: string;
  invoicePrefix: string;
  gstNumber: string;
  hsnCode?: string;
  defaultGstRate: number;
  taxInclusivePricing: boolean;
  freeShippingThreshold: number;
  standardShippingFee: number;
  expressShippingFee: number;
  codFee: number;
  maintenanceMode: boolean;
  enforceApprovedLicenseOnly: boolean;
  lowStockThreshold: number;
  criticalStockThreshold: number;
  sessionTimeoutMinutes?: number;
  enforceTwoFactor?: boolean;
  ipWhitelist?: string[];
  backupStatus: {
    lastBackup: string;
    nextBackup: string;
    health: 'OPTIMAL' | 'WARNING' | 'ERROR';
    size: string;
  };
}
