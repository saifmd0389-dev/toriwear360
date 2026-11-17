export type LogisticsCarrierKey = 
  | 'SHIPROCKET'
  | 'DELHIVERY'
  | 'BLUEDART'
  | 'DTDC'
  | 'XPRESSBEES'
  | 'ECOM_EXPRESS'
  | 'INDIA_POST'
  | 'CUSTOM';

export type LogisticsEnvironment = 'SANDBOX' | 'PRODUCTION';

export type AllocationStrategy = 
  | 'MANUAL'
  | 'CHEAPEST'
  | 'FASTEST'
  | 'PREFERRED_PRIORITY'
  | 'RULE_BASED';

export interface LogisticsPartnerConfig {
  id: string;
  carrierKey: LogisticsCarrierKey;
  name: string;
  logo: string;
  isEnabled: boolean;
  isDefault: boolean;
  environment: LogisticsEnvironment;
  apiEndpoint?: string;
  apiKey?: string;
  apiSecret?: string;
  apiToken?: string;
  merchantId?: string;
  pickupWarehousePin: string;
  trackingUrlTemplate: string;
  webhookSecret?: string;
  priorityOrder: number;
  capabilities: ('FORWARD' | 'REVERSE' | 'COD' | 'TRACKING' | 'LABEL' | 'PICKUP')[];
  lastHealthCheck?: string;
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'FAILED' | 'AWAITING_CREDENTIALS' | 'NEEDS_CONFIGURATION';
  lastErrorMessage?: string;
  testLatencyMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceabilityCheckInput {
  originPin: string;
  destinationPin: string;
  codRequired?: boolean;
  weightGrams?: number;
}

export interface ServiceabilityResult {
  carrierKey: LogisticsCarrierKey;
  carrierName: string;
  serviceable: boolean;
  codAvailable: boolean;
  estimatedDays: number;
  message?: string;
}

export interface RateCalculationInput {
  originPin: string;
  destinationPin: string;
  weightGrams: number;
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
  cod?: boolean;
  declaredValue?: number;
}

export interface RateQuote {
  carrierKey: LogisticsCarrierKey;
  carrierName: string;
  serviceCode: string;
  serviceName: string;
  rate: number;
  estimatedDays: number;
  isCodAvailable: boolean;
  isFastest?: boolean;
  isCheapest?: boolean;
}

export interface CreateCarrierShipmentInput {
  orderId: string;
  orderNumber: string;
  carrierKey?: LogisticsCarrierKey;
  recipient: {
    fullName: string;
    phone: string;
    email?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: {
    name: string;
    sku: string;
    quantity: number;
    price: number;
  }[];
  packageSpecs: {
    weightGrams: number;
    lengthCm: number;
    breadthCm: number;
    heightCm: number;
  };
  paymentMethod: 'UPI' | 'CARD' | 'NETBANKING' | 'COD';
  codAmount?: number;
  declaredValue: number;
  pickupPin?: string;
  pickupLocation?: string;
}

export interface CreateCarrierReturnShipmentInput {
  orderId: string;
  orderNumber: string;
  returnOrderId: string;
  reason: string;
  pickup: { name: string; addressLine1: string; addressLine2?: string; city: string; state: string; pincode: string; phone: string; email: string; country?: string };
  destination: { name: string; addressLine1: string; addressLine2?: string; city: string; state: string; pincode: string; phone: string; email: string; country?: string };
  items: Array<{ name: string; sku: string; quantity: number; price: number }>;
  declaredValue: number;
  packageSpecs: { lengthCm: number; breadthCm: number; heightCm: number; weightGrams: number };
}

export interface CarrierReturnShipmentResult {
  success: boolean;
  carrierKey: LogisticsCarrierKey;
  carrierName: string;
  returnOrderId?: string;
  shipmentId?: string;
  awbNumber?: string;
  trackingUrl?: string;
  labelUrl?: string;
  pickupScheduled?: boolean;
  pickupToken?: string;
  message?: string;
  error?: string;
  rawResponse?: any;
}

export interface CarrierShipmentResult {
  success: boolean;
  carrierKey: LogisticsCarrierKey;
  carrierName: string;
  awbNumber?: string;
  shipmentId?: string;
  labelUrl?: string;
  pickupScheduledDate?: string;
  estimatedDeliveryDate?: string;
  trackingUrl?: string;
  error?: string;
  rawResponse?: any;
}

export interface CarrierTrackingEvent {
  status: string;
  location: string;
  activity: string;
  timestamp: string;
}

export interface CarrierTrackingDetails {
  awbNumber: string;
  carrierKey: LogisticsCarrierKey;
  carrierName: string;
  status: 'MANIFESTED' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RTO_INITIATED' | 'RTO_DELIVERED' | 'CANCELLED';
  currentLocation?: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
  trackingUrl: string;
  events: CarrierTrackingEvent[];
}
