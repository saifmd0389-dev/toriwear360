import {
  LogisticsCarrierKey,
  LogisticsPartnerConfig,
  ServiceabilityCheckInput,
  ServiceabilityResult,
  RateCalculationInput,
  RateQuote,
  CreateCarrierShipmentInput,
  CarrierShipmentResult,
  CreateCarrierReturnShipmentInput,
  CarrierReturnShipmentResult,
  CarrierTrackingDetails,
} from './types';

export abstract class BaseLogisticsAdapter {
  protected config: LogisticsPartnerConfig;

  constructor(config: LogisticsPartnerConfig) {
    this.config = config;
  }

  public get carrierKey(): LogisticsCarrierKey {
    return this.config.carrierKey;
  }

  public get name(): string {
    return this.config.name;
  }

  public get isEnabled(): boolean {
    return this.config.isEnabled;
  }

  public updateConfig(newConfig: LogisticsPartnerConfig) {
    this.config = newConfig;
  }

  // 1. Connectivity & Credentials Health Check
  abstract testConnection(): Promise<{
    success: boolean;
    latencyMs: number;
    message: string;
    details?: any;
  }>;

  // 2. PIN Code Serviceability Check
  abstract checkServiceability(input: ServiceabilityCheckInput): Promise<ServiceabilityResult>;

  // 3. Rate & Estimated Delivery Time Calculation
  abstract calculateRates(input: RateCalculationInput): Promise<RateQuote[]>;

  // 4. Shipment Manifestation & AWB Assignment
  abstract createShipment(input: CreateCarrierShipmentInput): Promise<CarrierShipmentResult>;

  // 4a. Reverse logistics / customer return pickup (provider-specific; unsupported by default)
  async createReturnShipment(_input: CreateCarrierReturnShipmentInput): Promise<CarrierReturnShipmentResult> {
    return { success: false, carrierKey: this.carrierKey, carrierName: this.name, error: `${this.name} does not support automated reverse pickup.` };
  }

  // 5. Generate / Download Shipping Label
  abstract generateLabel(awbNumber: string): Promise<{
    success: boolean;
    labelUrl: string;
    pdfData?: string;
    error?: string;
  }>;

  // 6. Schedule Courier Package Pickup
  abstract schedulePickup(awbNumber: string, pickupDate?: string): Promise<{
    success: boolean;
    pickupToken?: string;
    scheduledDate?: string;
    message: string;
  }>;

  // 7. Cancel Shipment
  abstract cancelShipment(awbNumber: string, reason?: string): Promise<{
    success: boolean;
    message: string;
  }>;

  // 8. Live Tracking Query
  abstract trackShipment(awbNumber: string): Promise<CarrierTrackingDetails>;

  // 9. Webhook Ingestion & Normalization
  abstract parseWebhook(headers: Record<string, any>, body: any): {
    isValid: boolean;
    awbNumber?: string;
    orderNumber?: string;
    newStatus?: 'MANIFESTED' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RTO_INITIATED' | 'RTO_DELIVERED' | 'CANCELLED';
    location?: string;
    activityDescription?: string;
    timestamp?: Date;
  };
}
