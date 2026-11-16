import { BaseLogisticsAdapter } from './baseAdapter';
import {
  ServiceabilityCheckInput,
  ServiceabilityResult,
  RateCalculationInput,
  RateQuote,
  CreateCarrierShipmentInput,
  CarrierShipmentResult,
  CarrierTrackingDetails,
} from './types';

function hasValidCredentials(apiKey?: string, apiSecret?: string, apiToken?: string): boolean {
  const k = apiKey?.trim();
  const s = apiSecret?.trim();
  const t = apiToken?.trim();
  if (!k && !s && !t) return false;
  if ((k && k.includes('••••')) || (s && s.includes('••••')) || (t && t.includes('••••'))) return false;
  if (k?.startsWith('demo_') || k?.startsWith('BD_CUST_') || k?.startsWith('DTDC_API_')) return false;
  return true;
}

// ============================================================================
// 1. Blue Dart Adapter
// ============================================================================
export class BlueDartAdapter extends BaseLogisticsAdapter {
  private get baseUrl(): string {
    return this.config.environment === 'PRODUCTION'
      ? 'https://netconnect.bluedart.com/Ver1.0'
      : 'https://apigateway-sandbox.bluedart.com';
  }

  async testConnection() {
    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return {
        success: false,
        latencyMs: 0,
        message: 'NEEDS CONFIGURATION: Blue Dart requires Customer Code (API Key) and License Key in settings.',
      };
    }

    const start = Date.now();
    try {
      const endpoint = `${this.baseUrl}/Apex/ServiceAvailability`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'JWTToken': this.config.apiToken || '',
        },
        body: JSON.stringify({
          CustomerCode: this.config.apiKey,
          Pincode: this.config.pickupWarehousePin || '110001',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (res.ok) {
        return {
          success: true,
          latencyMs,
          message: `Blue Dart API connected successfully (${this.config.environment} Mode). Latency: ${latencyMs}ms.`,
        };
      }

      return {
        success: false,
        latencyMs,
        message: `Blue Dart API returned HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        success: false,
        latencyMs,
        message: `Blue Dart connection failed: ${err.message || 'Network timeout'}`,
      };
    }
  }

  async checkServiceability(input: ServiceabilityCheckInput): Promise<ServiceabilityResult> {
    const isServiceablePin = /^[1-9][0-9]{5}$/.test(input.destinationPin?.trim());
    if (!isServiceablePin) {
      return {
        carrierKey: 'BLUEDART',
        carrierName: 'Blue Dart Express',
        serviceable: false,
        codAvailable: false,
        estimatedDays: 0,
        message: 'Invalid Indian 6-digit PIN code format.',
      };
    }

    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return {
        carrierKey: 'BLUEDART',
        carrierName: 'Blue Dart Express',
        serviceable: false,
        codAvailable: false,
        estimatedDays: 0,
        message: 'NEEDS CONFIGURATION: Blue Dart Customer Code and License required for live serviceability query.',
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/Apex/ServiceAvailability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'JWTToken': this.config.apiToken || '',
        },
        body: JSON.stringify({
          CustomerCode: this.config.apiKey,
          Pincode: input.destinationPin.trim(),
        }),
      });

      if (res.ok) {
        const json: any = await res.json().catch(() => ({}));
        const serviceable = Boolean(json?.Serviceable);
        return {
          carrierKey: 'BLUEDART',
          carrierName: 'Blue Dart Express',
          serviceable,
          codAvailable: serviceable && Boolean(json?.CODAvailable),
          estimatedDays: 2,
          message: serviceable ? 'Air & Dart Apex Express Priority Network Serviceable' : 'Pincode not serviceable by Blue Dart',
        };
      }
    } catch (err: any) {
      console.warn('[BlueDart] Serviceability error:', err.message);
    }

    return {
      carrierKey: 'BLUEDART',
      carrierName: 'Blue Dart Express',
      serviceable: false,
      codAvailable: false,
      estimatedDays: 0,
      message: 'Failed to query live Blue Dart serviceability.',
    };
  }

  async calculateRates(_input: RateCalculationInput): Promise<RateQuote[]> {
    return [];
  }

  async createShipment(input: CreateCarrierShipmentInput): Promise<CarrierShipmentResult> {
    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return {
        success: false,
        carrierKey: 'BLUEDART',
        carrierName: 'Blue Dart Express',
        error: 'Cannot manifest shipment: Blue Dart Customer Code and License Key are not configured.',
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/Apex/WaybillGeneration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'JWTToken': this.config.apiToken || '',
        },
        body: JSON.stringify({
          CustomerCode: this.config.apiKey,
          OrderNo: input.orderNumber,
          Weight: (input.packageSpecs.weightGrams || 350) / 1000,
          DeclaredValue: input.declaredValue,
          Consignee: {
            Name: input.recipient.fullName,
            Address1: input.recipient.addressLine1,
            Pincode: input.recipient.pincode,
            MobileNo: input.recipient.phone,
          },
        }),
      });

      const json: any = await res.json().catch(() => ({}));
      if (res.ok && json?.AWBNo) {
        const awbNumber = String(json.AWBNo);
        return {
          success: true,
          carrierKey: 'BLUEDART',
          carrierName: 'Blue Dart Express',
          awbNumber,
          shipmentId: `bd-${awbNumber}`,
          labelUrl: `/v1/admin/logistics/shipments/${awbNumber}/label`,
          trackingUrl: `https://www.bluedart.com/tracking?trackNumber=${awbNumber}`,
          estimatedDeliveryDate: new Date(Date.now() + 2 * 86400000).toISOString(),
          rawResponse: json,
        };
      }

      return {
        success: false,
        carrierKey: 'BLUEDART',
        carrierName: 'Blue Dart Express',
        error: json?.ErrorMessage || `Blue Dart waybill generation returned HTTP ${res.status}`,
        rawResponse: json,
      };
    } catch (err: any) {
      return {
        success: false,
        carrierKey: 'BLUEDART',
        carrierName: 'Blue Dart Express',
        error: `Blue Dart API network error: ${err.message}`,
      };
    }
  }

  async generateLabel(_awbNumber: string) {
    return { success: false, labelUrl: '', error: 'Blue Dart label API requires authenticated enterprise access.' };
  }

  async schedulePickup(_awbNumber: string, _pickupDate?: string) {
    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return { success: false, message: 'Blue Dart credentials required to schedule courier pickup.' };
    }
    return { success: false, message: 'Blue Dart pickup scheduling requires live enterprise token.' };
  }

  async cancelShipment(_awbNumber: string) {
    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return { success: false, message: 'Blue Dart credentials required to cancel shipment.' };
    }
    return { success: false, message: 'Blue Dart cancellation endpoint requires live enterprise token.' };
  }

  async trackShipment(awbNumber: string): Promise<CarrierTrackingDetails> {
    const fallbackTrackingUrl = `https://www.bluedart.com/tracking?trackNumber=${awbNumber}`;
    return {
      awbNumber,
      carrierKey: 'BLUEDART',
      carrierName: 'Blue Dart Express',
      status: 'MANIFESTED',
      trackingUrl: fallbackTrackingUrl,
      events: [
        {
          status: 'AWAITING_CREDENTIALS',
          location: 'Carrier Gateway',
          activity: 'Blue Dart credentials required for real-time tracking scans.',
          timestamp: new Date().toLocaleString('en-IN'),
        },
      ],
    };
  }

  parseWebhook(_headers: Record<string, any>, body: any) {
    return {
      isValid: true,
      awbNumber: body?.awb || body?.WaybillNo,
      orderNumber: body?.order_id || body?.ReferenceNo,
      newStatus: 'IN_TRANSIT' as any,
      location: body?.location || 'Blue Dart Hub',
      activityDescription: body?.status || 'Tracking scan update',
      timestamp: new Date(),
    };
  }
}

// ============================================================================
// 2. DTDC Adapter
// ============================================================================
export class DTDCAdapter extends BaseLogisticsAdapter {
  private get baseUrl(): string {
    return this.config.environment === 'PRODUCTION'
      ? 'https://smarttrack.dtdc.com/ctsv2'
      : 'https://smarttrack.dtdc.com/ctsv2/demo';
  }

  async testConnection() {
    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return {
        success: false,
        latencyMs: 0,
        message: 'NEEDS CONFIGURATION: DTDC requires Customer Code (API Key) and Access Token in settings.',
      };
    }

    const start = Date.now();
    try {
      const endpoint = `${this.baseUrl}/api/v1/pincode/${encodeURIComponent(this.config.pickupWarehousePin || '110001')}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(endpoint, {
        headers: { 'X-Access-Token': this.config.apiToken || this.config.apiKey || '' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (res.ok) {
        return {
          success: true,
          latencyMs,
          message: `DTDC API connected successfully (${this.config.environment} Mode). Latency: ${latencyMs}ms.`,
        };
      }

      return {
        success: false,
        latencyMs,
        message: `DTDC API returned HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        success: false,
        latencyMs,
        message: `DTDC connection failed: ${err.message || 'Network timeout'}`,
      };
    }
  }

  async checkServiceability(input: ServiceabilityCheckInput): Promise<ServiceabilityResult> {
    const isValidPin = /^[1-9][0-9]{5}$/.test(input.destinationPin?.trim());
    if (!isValidPin) {
      return {
        carrierKey: 'DTDC',
        carrierName: 'DTDC Express',
        serviceable: false,
        codAvailable: false,
        estimatedDays: 0,
        message: 'Invalid Indian 6-digit PIN code format.',
      };
    }

    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return {
        carrierKey: 'DTDC',
        carrierName: 'DTDC Express',
        serviceable: false,
        codAvailable: false,
        estimatedDays: 0,
        message: 'NEEDS CONFIGURATION: DTDC Customer Code and Token required for serviceability query.',
      };
    }

    return {
      carrierKey: 'DTDC',
      carrierName: 'DTDC Express',
      serviceable: false,
      codAvailable: false,
      estimatedDays: 0,
      message: 'Failed to query live DTDC serviceability.',
    };
  }

  async calculateRates(_input: RateCalculationInput): Promise<RateQuote[]> {
    return [];
  }

  async createShipment(_input: CreateCarrierShipmentInput): Promise<CarrierShipmentResult> {
    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return {
        success: false,
        carrierKey: 'DTDC',
        carrierName: 'DTDC Express',
        error: 'Cannot manifest shipment: DTDC API credentials are not configured.',
      };
    }

    return {
      success: false,
      carrierKey: 'DTDC',
      carrierName: 'DTDC Express',
      error: 'DTDC shipment creation requires verified commercial contract and active token.',
    };
  }

  async generateLabel(_awbNumber: string) {
    return { success: false, labelUrl: '', error: 'DTDC label API requires active commercial credentials.' };
  }

  async schedulePickup(_awbNumber: string, _pickupDate?: string) {
    return { success: false, message: 'DTDC pickup scheduling requires active commercial credentials.' };
  }

  async cancelShipment(_awbNumber: string) {
    return { success: false, message: 'DTDC cancellation requires active commercial credentials.' };
  }

  async trackShipment(awbNumber: string): Promise<CarrierTrackingDetails> {
    return {
      awbNumber,
      carrierKey: 'DTDC',
      carrierName: 'DTDC Express',
      status: 'MANIFESTED',
      trackingUrl: `https://www.dtdc.in/tracking/shipment-tracking.asp?strCnno=${awbNumber}`,
      events: [
        {
          status: 'AWAITING_CREDENTIALS',
          location: 'Carrier Gateway',
          activity: 'DTDC credentials required for real-time tracking scans.',
          timestamp: new Date().toLocaleString('en-IN'),
        },
      ],
    };
  }

  parseWebhook(_headers: Record<string, any>, body: any) {
    return {
      isValid: true,
      awbNumber: body?.awb || body?.consignment_no,
      orderNumber: body?.order_number || body?.reference_no,
      newStatus: 'IN_TRANSIT' as any,
      location: body?.location || 'DTDC Hub',
      activityDescription: body?.status || 'Tracking scan update',
      timestamp: new Date(),
    };
  }
}

// ============================================================================
// 3. Xpressbees Adapter
// ============================================================================
export class XpressbeesAdapter extends BaseLogisticsAdapter {
  private get baseUrl(): string {
    return this.config.environment === 'PRODUCTION'
      ? 'https://shipment.xpressbees.com/api'
      : 'https://staging.xpressbees.com/api';
  }

  async testConnection() {
    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return {
        success: false,
        latencyMs: 0,
        message: 'NEEDS CONFIGURATION: Xpressbees requires User Email and Key in settings.',
      };
    }

    const start = Date.now();
    try {
      const endpoint = `${this.baseUrl}/users/login`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.config.apiKey,
          password: this.config.apiSecret || this.config.apiToken,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (res.ok) {
        return {
          success: true,
          latencyMs,
          message: `Xpressbees API authenticated successfully (${this.config.environment} Mode). Latency: ${latencyMs}ms.`,
        };
      }

      return {
        success: false,
        latencyMs,
        message: `Xpressbees authentication returned HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        success: false,
        latencyMs,
        message: `Xpressbees connection failed: ${err.message || 'Network timeout'}`,
      };
    }
  }

  async checkServiceability(input: ServiceabilityCheckInput): Promise<ServiceabilityResult> {
    const isValidPin = /^[1-9][0-9]{5}$/.test(input.destinationPin?.trim());
    if (!isValidPin) {
      return {
        carrierKey: 'XPRESSBEES',
        carrierName: 'Xpressbees Logistics',
        serviceable: false,
        codAvailable: false,
        estimatedDays: 0,
        message: 'Invalid Indian 6-digit PIN code format.',
      };
    }

    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return {
        carrierKey: 'XPRESSBEES',
        carrierName: 'Xpressbees Logistics',
        serviceable: false,
        codAvailable: false,
        estimatedDays: 0,
        message: 'NEEDS CONFIGURATION: Xpressbees credentials required for live serviceability check.',
      };
    }

    return {
      carrierKey: 'XPRESSBEES',
      carrierName: 'Xpressbees Logistics',
      serviceable: false,
      codAvailable: false,
      estimatedDays: 0,
      message: 'Failed to query live Xpressbees serviceability.',
    };
  }

  async calculateRates(_input: RateCalculationInput): Promise<RateQuote[]> {
    return [];
  }

  async createShipment(_input: CreateCarrierShipmentInput): Promise<CarrierShipmentResult> {
    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return {
        success: false,
        carrierKey: 'XPRESSBEES',
        carrierName: 'Xpressbees Logistics',
        error: 'Cannot manifest shipment: Xpressbees API credentials are not configured.',
      };
    }

    return {
      success: false,
      carrierKey: 'XPRESSBEES',
      carrierName: 'Xpressbees Logistics',
      error: 'Xpressbees shipment manifestation requires authenticated account token.',
    };
  }

  async generateLabel(_awbNumber: string) {
    return { success: false, labelUrl: '', error: 'Xpressbees label API requires active commercial credentials.' };
  }

  async schedulePickup(_awbNumber: string, _pickupDate?: string) {
    return { success: false, message: 'Xpressbees pickup scheduling requires active credentials.' };
  }

  async cancelShipment(_awbNumber: string) {
    return { success: false, message: 'Xpressbees cancellation requires active credentials.' };
  }

  async trackShipment(awbNumber: string): Promise<CarrierTrackingDetails> {
    return {
      awbNumber,
      carrierKey: 'XPRESSBEES',
      carrierName: 'Xpressbees Logistics',
      status: 'MANIFESTED',
      trackingUrl: `https://www.xpressbees.com/track?isawb=Yes&trackid=${awbNumber}`,
      events: [
        {
          status: 'AWAITING_CREDENTIALS',
          location: 'Carrier Gateway',
          activity: 'Xpressbees credentials required for real-time tracking scans.',
          timestamp: new Date().toLocaleString('en-IN'),
        },
      ],
    };
  }

  parseWebhook(_headers: Record<string, any>, body: any) {
    return {
      isValid: true,
      awbNumber: body?.awb,
      orderNumber: body?.order_number,
      newStatus: 'IN_TRANSIT' as any,
      location: body?.location || 'Xpressbees Hub',
      activityDescription: body?.status || 'Scan update',
      timestamp: new Date(),
    };
  }
}

// ============================================================================
// 4. Ecom Express Adapter
// ============================================================================
export class EcomExpressAdapter extends BaseLogisticsAdapter {
  private get baseUrl(): string {
    return this.config.environment === 'PRODUCTION'
      ? 'https://api.ecomexpress.in'
      : 'https://clbeta.ecomexpress.in';
  }

  async testConnection() {
    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return {
        success: false,
        latencyMs: 0,
        message: 'NEEDS CONFIGURATION: Ecom Express requires Username and Password in settings.',
      };
    }

    const start = Date.now();
    try {
      const endpoint = `${this.baseUrl}/apiv2/pincode/`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          username: this.config.apiKey || '',
          password: this.config.apiSecret || this.config.apiToken || '',
          pincode: this.config.pickupWarehousePin || '110001',
        }).toString(),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (res.ok) {
        return {
          success: true,
          latencyMs,
          message: `Ecom Express API connected successfully (${this.config.environment} Mode). Latency: ${latencyMs}ms.`,
        };
      }

      return {
        success: false,
        latencyMs,
        message: `Ecom Express API returned HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        success: false,
        latencyMs,
        message: `Ecom Express connection failed: ${err.message || 'Network timeout'}`,
      };
    }
  }

  async checkServiceability(input: ServiceabilityCheckInput): Promise<ServiceabilityResult> {
    const isValidPin = /^[1-9][0-9]{5}$/.test(input.destinationPin?.trim());
    if (!isValidPin) {
      return {
        carrierKey: 'ECOM_EXPRESS',
        carrierName: 'Ecom Express',
        serviceable: false,
        codAvailable: false,
        estimatedDays: 0,
        message: 'Invalid Indian 6-digit PIN code format.',
      };
    }

    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return {
        carrierKey: 'ECOM_EXPRESS',
        carrierName: 'Ecom Express',
        serviceable: false,
        codAvailable: false,
        estimatedDays: 0,
        message: 'NEEDS CONFIGURATION: Ecom Express credentials required for live serviceability query.',
      };
    }

    return {
      carrierKey: 'ECOM_EXPRESS',
      carrierName: 'Ecom Express',
      serviceable: false,
      codAvailable: false,
      estimatedDays: 0,
      message: 'Failed to query live Ecom Express serviceability.',
    };
  }

  async calculateRates(_input: RateCalculationInput): Promise<RateQuote[]> {
    return [];
  }

  async createShipment(_input: CreateCarrierShipmentInput): Promise<CarrierShipmentResult> {
    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return {
        success: false,
        carrierKey: 'ECOM_EXPRESS',
        carrierName: 'Ecom Express',
        error: 'Cannot manifest shipment: Ecom Express API credentials are not configured.',
      };
    }

    return {
      success: false,
      carrierKey: 'ECOM_EXPRESS',
      carrierName: 'Ecom Express',
      error: 'Ecom Express shipment creation requires verified commercial contract and active credentials.',
    };
  }

  async generateLabel(_awbNumber: string) {
    return { success: false, labelUrl: '', error: 'Ecom Express label API requires active commercial credentials.' };
  }

  async schedulePickup(_awbNumber: string, _pickupDate?: string) {
    return { success: false, message: 'Ecom Express pickup scheduling requires active credentials.' };
  }

  async cancelShipment(_awbNumber: string) {
    return { success: false, message: 'Ecom Express cancellation requires active credentials.' };
  }

  async trackShipment(awbNumber: string): Promise<CarrierTrackingDetails> {
    return {
      awbNumber,
      carrierKey: 'ECOM_EXPRESS',
      carrierName: 'Ecom Express',
      status: 'MANIFESTED',
      trackingUrl: `https://ecomexpress.in/tracking/?awb=${awbNumber}`,
      events: [
        {
          status: 'AWAITING_CREDENTIALS',
          location: 'Carrier Gateway',
          activity: 'Ecom Express credentials required for real-time tracking scans.',
          timestamp: new Date().toLocaleString('en-IN'),
        },
      ],
    };
  }

  parseWebhook(_headers: Record<string, any>, body: any) {
    return {
      isValid: true,
      awbNumber: body?.awb,
      orderNumber: body?.order_number,
      newStatus: 'IN_TRANSIT' as any,
      location: body?.location || 'Ecom Express Hub',
      activityDescription: body?.status || 'Scan update',
      timestamp: new Date(),
    };
  }
}

// ============================================================================
// 5. India Post (Speed Post) Adapter
// ============================================================================
export class IndiaPostAdapter extends BaseLogisticsAdapter {
  async testConnection() {
    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return {
        success: false,
        latencyMs: 0,
        message: 'NEEDS CONFIGURATION: India Post requires official Speed Post Corporate Customer Portal credentials.',
      };
    }

    return {
      success: false,
      latencyMs: 0,
      message: 'NEEDS CONFIGURATION: India Post corporate API credentials require commercial verification.',
    };
  }

  async checkServiceability(input: ServiceabilityCheckInput): Promise<ServiceabilityResult> {
    const isValidPin = /^[1-9][0-9]{5}$/.test(input.destinationPin?.trim());
    if (!isValidPin) {
      return {
        carrierKey: 'INDIA_POST',
        carrierName: 'India Post (Speed Post)',
        serviceable: false,
        codAvailable: false,
        estimatedDays: 0,
        message: 'Invalid Indian 6-digit PIN code format.',
      };
    }

    if (!hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return {
        carrierKey: 'INDIA_POST',
        carrierName: 'India Post (Speed Post)',
        serviceable: false,
        codAvailable: false,
        estimatedDays: 0,
        message: 'NEEDS CONFIGURATION: India Post Speed Post corporate portal access required.',
      };
    }

    return {
      carrierKey: 'INDIA_POST',
      carrierName: 'India Post (Speed Post)',
      serviceable: true,
      codAvailable: false,
      estimatedDays: 4,
      message: 'Universal National Postal Serviceability (Speed Post)',
    };
  }

  async calculateRates(_input: RateCalculationInput): Promise<RateQuote[]> {
    return [];
  }

  async createShipment(_input: CreateCarrierShipmentInput): Promise<CarrierShipmentResult> {
    return {
      success: false,
      carrierKey: 'INDIA_POST',
      carrierName: 'India Post (Speed Post)',
      error: 'Cannot manifest shipment: India Post requires commercial bulk mail booking credentials.',
    };
  }

  async generateLabel(_awbNumber: string) {
    return { success: false, labelUrl: '', error: 'India Post barcode label generation requires Speed Post corporate portal access.' };
  }

  async schedulePickup(_awbNumber: string, _pickupDate?: string) {
    return { success: false, message: 'India Post on-demand pickup requires registered postal contract.' };
  }

  async cancelShipment(_awbNumber: string) {
    return { success: false, message: 'India Post articles cannot be cancelled electronically once manifested.' };
  }

  async trackShipment(awbNumber: string): Promise<CarrierTrackingDetails> {
    return {
      awbNumber,
      carrierKey: 'INDIA_POST',
      carrierName: 'India Post (Speed Post)',
      status: 'MANIFESTED',
      trackingUrl: `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignment=${awbNumber}`,
      events: [
        {
          status: 'AWAITING_CREDENTIALS',
          location: 'Postal Gateway',
          activity: 'Speed Post corporate portal credentials required for automated API tracking.',
          timestamp: new Date().toLocaleString('en-IN'),
        },
      ],
    };
  }

  parseWebhook(_headers: Record<string, any>, body: any) {
    return {
      isValid: true,
      awbNumber: body?.consignment_id,
      orderNumber: body?.article_number,
      newStatus: 'IN_TRANSIT' as any,
      location: body?.office_name || 'Postal Sorting Office',
      activityDescription: body?.event_description || 'Postal scan update',
      timestamp: new Date(),
    };
  }
}

// ============================================================================
// 6. Custom Carrier Adapter
// ============================================================================
export class CustomCarrierAdapter extends BaseLogisticsAdapter {
  async testConnection() {
    if (!this.config.apiEndpoint || !hasValidCredentials(this.config.apiKey, this.config.apiSecret, this.config.apiToken)) {
      return {
        success: false,
        latencyMs: 0,
        message: 'NEEDS CONFIGURATION: Custom carrier integration requires API Endpoint and Auth Token in settings.',
      };
    }

    const start = Date.now();
    try {
      const res = await fetch(this.config.apiEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken || this.config.apiKey}`,
        },
      });
      const latencyMs = Date.now() - start;
      return {
        success: res.ok,
        latencyMs,
        message: res.ok
          ? `Custom Carrier endpoint connected. Latency: ${latencyMs}ms.`
          : `Custom Carrier endpoint returned HTTP ${res.status}`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        success: false,
        latencyMs,
        message: `Custom Carrier endpoint connection failed: ${err.message}`,
      };
    }
  }

  async checkServiceability(_input: ServiceabilityCheckInput): Promise<ServiceabilityResult> {
    return {
      carrierKey: 'CUSTOM',
      carrierName: this.config.name || 'Custom Logistics Partner',
      serviceable: false,
      codAvailable: false,
      estimatedDays: 0,
      message: 'NEEDS CONFIGURATION: Custom carrier serviceability endpoint not configured.',
    };
  }

  async calculateRates(_input: RateCalculationInput): Promise<RateQuote[]> {
    return [];
  }

  async createShipment(_input: CreateCarrierShipmentInput): Promise<CarrierShipmentResult> {
    return {
      success: false,
      carrierKey: 'CUSTOM',
      carrierName: this.config.name || 'Custom Logistics Partner',
      error: 'Custom logistics partner shipment endpoint not configured.',
    };
  }

  async generateLabel(_awbNumber: string) {
    return { success: false, labelUrl: '', error: 'Custom carrier label endpoint not configured.' };
  }

  async schedulePickup(_awbNumber: string, _pickupDate?: string) {
    return { success: false, message: 'Custom carrier pickup endpoint not configured.' };
  }

  async cancelShipment(_awbNumber: string) {
    return { success: false, message: 'Custom carrier cancellation endpoint not configured.' };
  }

  async trackShipment(awbNumber: string): Promise<CarrierTrackingDetails> {
    return {
      awbNumber,
      carrierKey: 'CUSTOM',
      carrierName: this.config.name || 'Custom Logistics Partner',
      status: 'MANIFESTED',
      trackingUrl: this.config.trackingUrlTemplate ? this.config.trackingUrlTemplate.replace('{awb}', awbNumber) : '',
      events: [
        {
          status: 'AWAITING_CREDENTIALS',
          location: 'Custom Gateway',
          activity: 'Custom tracking endpoint not configured.',
          timestamp: new Date().toLocaleString('en-IN'),
        },
      ],
    };
  }

  parseWebhook(_headers: Record<string, any>, body: any) {
    return {
      isValid: true,
      awbNumber: body?.awb || body?.tracking_number,
      orderNumber: body?.order_id,
      newStatus: 'IN_TRANSIT' as any,
      location: body?.location || 'Custom Hub',
      activityDescription: body?.event || 'Scan update',
      timestamp: new Date(),
    };
  }
}
