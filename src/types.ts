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
  variants?: any[];
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
}
