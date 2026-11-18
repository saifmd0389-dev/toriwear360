export type Department = 'MEN' | 'KIDS';

export type MenWorldCategory = 
  | 'DARK SHONEN'
  | 'CYBERPUNK / NEO TOKYO'
  | 'RETRO Y2K'
  | 'SAMURAI / MYTHIC JAPAN'
  | 'STREET ANIME';

export type KidsWorldCategory =
  | 'CUTE ADVENTURE'
  | 'ROBOT & FUTURE'
  | 'RETRO GAME'
  | 'MINI SAMURAI'
  | 'FANTASY CREATURES';

export type WorldCategory = MenWorldCategory | KidsWorldCategory;

export type FitType = 'Oversized' | 'Drop Shoulder' | 'Super Oversized' | 'Regular Fit' | 'Comfort Fit' | 'Heavyweight' | 'Soft Cotton' | 'Full Sleeve';

export type PopUniverse = 'MEN' | 'KIDS' | 'ORIGINALS' | 'ANIME' | 'ALL';

export type AnimeFranchise = 
  | MenWorldCategory
  | KidsWorldCategory
  | 'Toriwear Originals'
  | 'ORIGINALS'
  | 'LEGACY DEMO'
  | string;

export type ProductStatus = 'ACTIVE' | 'PUBLISHED' | 'DRAFT' | 'REVIEW' | 'APPROVED' | 'SCHEDULED' | 'ARCHIVED' | 'ARCHIVED / LEGACY DEMO';

export interface Product {
  id: string;
  catalogNumber: string; // e.g. "01", "02", ... "50"
  name: string;
  department: Department; // 'MEN' | 'KIDS'
  world: WorldCategory; // The 5 Men worlds or 5 Kids worlds
  franchise: AnimeFranchise;
  universe?: PopUniverse;
  character?: string; // e.g. 'TORI', 'REN', 'KAI', 'YUKI', 'AKI', 'KAMI & ZERO'
  fit: FitType | string;
  price: number;
  originalPrice: number;
  rating: number;
  reviewsCount: number;
  images: string[];
  description: string;
  storyQuote: string;
  drop: string;
  gsm: number;
  fabric: string;
  neck: string;
  sleeves: string;
  print: string;
  printType?: string;
  materialDescription?: string;
  careInstructions?: string;
  colors: { name: string; hex: string }[];
  sizes?: string[];
  ageGroups?: string[];
  isBestseller?: boolean;
  isNewDrop?: boolean;
  isTrending?: boolean;
  inStock: boolean;
  stock?: number;
  licenseType?: 'Original IP' | 'Licensed Partner' | 'Anime Inspired' | 'Official Capsule';
  status?: ProductStatus | string;
  publishingStatus?: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  sku?: string;
  categoryIds?: string[];
  variants?: any[];
}

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  department: Department | 'ALL';
  description?: string;
  image?: string;
  parentId?: string | null;
  seoTitle?: string;
  seoDescription?: string;
  displayOrder: number;
  isActive: boolean;
  showInNav?: boolean;
  productCount?: number;
}

export interface ContactChannelItem {
  id: string;
  platform: string;
  label: string;
  url: string;
  enabled: boolean;
  displayOrder: number;
  isCustom?: boolean;
}

export interface MetaBusinessConfig {
  domainVerificationCode: string;
  pixelId: string;
  capiEnabled: boolean;
  capiTokenConfigured?: boolean;
}

export interface StoreContactConfig {
  storeName: string;
  supportEmail: string;
  phone: string;
  operatingHours: string;
  businessAddress: string;
  returnWindowDays: number;
  whatsappMessage: string;
  whatsappNumber: string;
  channels: ContactChannelItem[];
  metaBusiness?: MetaBusinessConfig;
}

export type ReturnStatusValue =
  | 'RETURN_REQUESTED'
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PICKUP_SCHEDULED'
  | 'IN_TRANSIT'
  | 'RETURNED_TO_WAREHOUSE'
  | 'REFUND_PROCESSING'
  | 'REFUND_INITIATED'
  | 'REFUNDED'
  | 'REFUND_COMPLETED'
  | 'PARTIAL_REFUND_COMPLETED'
  | 'CLOSED';

export interface ReturnRequestItemRecord {
  id?: string;
  orderItemId?: string;
  productId: string;
  productName: string;
  variantId?: string;
  sku?: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  refundAmount?: number;
  restocked?: boolean;
  image?: string;
}

export interface ReturnStatusHistoryEntry {
  id?: string;
  status: string;
  note?: string;
  actorName?: string;
  actorRole?: string;
  createdAt: string;
}

export interface ReturnRequestRecord {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  customerId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  requestType: 'RETURN' | 'EXCHANGE';
  reason: string;
  comments?: string;
  proofFiles?: string[];
  proofUrls: string[];
  refundMethod?: string;
  refundAmount: number;
  refundedAmount: number;
  refundId?: string | null;
  refundReference?: string | null;
  refundTransactionId?: string | null;
  refundGateway?: string | null;
  refundStatus?: string | null;
  refundedAt?: string | null;
  courierPartner?: string | null;
  awbNumber?: string | null;
  pickupCourier?: string | null;
  pickupAwb?: string | null;
  pickupScheduledAt?: string | null;
  receivedAt?: string | null;
  restockedAt?: string | null;
  rejectionReason?: string | null;
  adminNotes?: string | null;
  status: ReturnStatusValue;
  stockRestored?: boolean;
  exchangeProductId?: string | null;
  exchangeSize?: string | null;
  pickupAddress?: any;
  items: ReturnRequestItemRecord[];
  statusHistory: ReturnStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ToriOriginalCharacter {
  id: string;
  name: string;
  alias: string;
  japaneseName: string;
  japanese?: string;
  department: Department;
  world: WorldCategory;
  role: string;
  personality: string[];
  personalityTags?: string[];
  symbol: string;
  description: string;
  biography?: string;
  storyQuote: string;
  quote?: string;
  signatureStyle: string;
  weaponOrPower?: string;
  color?: string;
  themeColor?: string;
  avatarUrl: string;
  avatarImage?: string;
  chapter: string;
  featuredProductId?: string;
  featuredDesign?: string;
  status?: 'ACTIVE' | 'UPCOMING';
}

export interface FitBuilderOption {
  id: string;
  category: 'bottom' | 'shoes' | 'accessory';
  name: string;
  price: number;
  image: string;
  tag: string;
  desc: string;
}

export interface CartItem {
  product: Product;
  size: string;
  color: string;
  quantity: number;
}

export interface ShippingAddress {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
}

export type PaymentMethodType = 'upi' | 'card' | 'netbanking' | 'cod';

export interface OrderTimelineEntry {
  status?: string;
  title: string;
  timestamp: string;
  description?: string;
  note?: string;
  actorName?: string;
}

export interface OrderDetails {
  orderId: string;
  date: string;
  items: CartItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethodType;
  paymentDetails: {
    upiId?: string;
    cardLast4?: string;
    bankName?: string;
    isCod?: boolean;
    razorpayPaymentId?: string;
  };
  subtotal: number;
  discount: number;
  discountCode?: string;
  shipping: number;
  total: number;
  status: 'Confirmed' | 'Packed' | 'Shipped' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
  estimatedDelivery: string;
  cancellationReason?: string;
  cancelledAt?: string;
  refundStatus?: 'Pending' | 'Refund Initiated' | 'Refund Completed' | 'Not Applicable (COD)';
  courierPartner?: string;
  trackingNumber?: string;
  timeline?: OrderTimelineEntry[];
}

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type FitFeedback = 'TRUE_TO_SIZE' | 'RUNS_SMALL' | 'RUNS_LARGE';

export interface ProductReview {
  id: string;
  productId: string;
  productName?: string;
  customerId?: string;
  customerName: string;
  rating: number;
  title?: string;
  comment: string;
  verifiedPurchase: boolean;
  sizePurchased?: string;
  fitFeedback?: FitFeedback;
  status: ReviewStatus;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductReviewSummary {
  averageRating: number;
  totalCount: number;
  verifiedCount: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  fitBreakdown: {
    TRUE_TO_SIZE: number;
    RUNS_SMALL: number;
    RUNS_LARGE: number;
  };
}


