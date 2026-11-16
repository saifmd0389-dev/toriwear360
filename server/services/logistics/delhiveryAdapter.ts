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

export class DelhiveryAdapter extends BaseLogisticsAdapter {
  private get baseUrl(): string {
    return this.config.environment === 'PRODUCTION'
      ? 'https://track.delhivery.com'
      : 'https://staging-express.delhivery.com';
  }

  private hasConfiguredCredentials(): boolean {
    const token = (this.config.apiToken || this.config.apiKey)?.trim();
    if (!token) return false;
    if (token.includes('••••')) return false;
    if (token === 'delhivery_live_test' || token.startsWith('demo_')) return false;
    return true;
  }

  private get authHeader(): Record<string, string> {
    const token = (this.config.apiToken || this.config.apiKey)?.trim() || '';
    return {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  async testConnection(): Promise<{ success: boolean; latencyMs: number; message: string; details?: any }> {
    if (!this.hasConfiguredCredentials()) {
      return {
        success: false,
        latencyMs: 0,
        message: 'NEEDS CONFIGURATION: Delhivery API token is not configured. Please supply your Delhivery B2C Client Token.',
      };
    }

    const start = Date.now();
    try {
      const testPin = this.config.pickupWarehousePin?.trim() || '110001';
      const endpoint = `${this.baseUrl}/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(testPin)}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(endpoint, {
        method: 'GET',
        headers: this.authHeader,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        return {
          success: true,
          latencyMs,
          message: `Delhivery API connected successfully (${this.config.environment} Gateway). Latency: ${latencyMs}ms.`,
          details: { endpoint, status: res.status, serviceData: json?.delivery_codes?.[0] },
        };
      } else {
        const errText = await res.text().catch(() => res.statusText);
        return {
          success: false,
          latencyMs,
          message: `Delhivery API returned HTTP ${res.status}: ${errText.slice(0, 150)}`,
        };
      }
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        success: false,
        latencyMs,
        message: `Connection to Delhivery failed: ${err.message || 'Network timeout or unreachable host.'}`,
      };
    }
  }

  async checkServiceability(input: ServiceabilityCheckInput): Promise<ServiceabilityResult> {
    const destPin = input.destinationPin?.trim();
    const isValidIndianPin = /^[1-9][0-9]{5}$/.test(destPin);

    if (!isValidIndianPin) {
      return {
        carrierKey: 'DELHIVERY',
        carrierName: 'Delhivery Express',
        serviceable: false,
        codAvailable: false,
        estimatedDays: 0,
        message: 'Invalid 6-digit Indian PIN code format.',
      };
    }

    if (!this.hasConfiguredCredentials()) {
      return {
        carrierKey: 'DELHIVERY',
        carrierName: 'Delhivery Express',
        serviceable: false,
        codAvailable: false,
        estimatedDays: 0,
        message: 'NEEDS CONFIGURATION: Live Delhivery B2C token required for pin-code serviceability query.',
      };
    }

    try {
      const endpoint = `${this.baseUrl}/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(destPin)}`;
      const res = await fetch(endpoint, { headers: this.authHeader });
      if (res.ok) {
        const data: any = await res.json().catch(() => ({}));
        const codeInfo = data?.delivery_codes?.[0]?.postal_code;
        if (codeInfo) {
          const isPrepaid = codeInfo.pre_paid === 'Y';
          const isCod = codeInfo.cod === 'Y';
          const serviceable = isPrepaid || isCod;
          return {
            carrierKey: 'DELHIVERY',
            carrierName: 'Delhivery Express',
            serviceable,
            codAvailable: isCod,
            estimatedDays: 3,
            message: serviceable
              ? (isCod ? 'Prepaid & Cash on Delivery Available' : 'Prepaid Only Available')
              : 'PIN code marked unserviceable by Delhivery.',
          };
        }
      }
    } catch (e: any) {
      console.warn('[Delhivery] Serviceability error:', e.message);
    }

    return {
      carrierKey: 'DELHIVERY',
      carrierName: 'Delhivery Express',
      serviceable: false,
      codAvailable: false,
      estimatedDays: 0,
      message: 'Failed to query live serviceability from Delhivery gateway.',
    };
  }

  async calculateRates(input: RateCalculationInput): Promise<RateQuote[]> {
    if (!this.hasConfiguredCredentials()) {
      return [];
    }

    try {
      const weightGrams = input.weightGrams || 350;
      const weightKg = (weightGrams / 1000).toFixed(2);
      const paymentMode = input.cod ? 'COD' : 'Pre-paid';
      const endpoint = `${this.baseUrl}/api/kinko/v1/invoice/charges/.json?ss=Delivered&pt=${encodeURIComponent(paymentMode)}&wt=${weightKg}&o_pin=${encodeURIComponent(input.originPin)}&d_pin=${encodeURIComponent(input.destinationPin)}`;

      const res = await fetch(endpoint, { headers: this.authHeader });
      if (res.ok) {
        const json: any = await res.json().catch(() => ([]));
        const chargeData = Array.isArray(json) ? json[0] : json;
        if (chargeData?.total_amount) {
          const rate = Math.round(Number(chargeData.total_amount));
          return [
            {
              carrierKey: 'DELHIVERY',
              carrierName: 'Delhivery Express Surface',
              serviceCode: 'DELHIVERY_SURFACE',
              serviceName: 'Delhivery Surface Commercial',
              rate,
              estimatedDays: 3,
              isCodAvailable: true,
            },
          ];
        }
      }
    } catch (err: any) {
      console.warn('[Delhivery] calculateRates error:', err.message);
    }

    return [];
  }

  async createShipment(input: CreateCarrierShipmentInput): Promise<CarrierShipmentResult> {
    if (!this.hasConfiguredCredentials()) {
      return {
        success: false,
        carrierKey: 'DELHIVERY',
        carrierName: 'Delhivery Express',
        error: 'Cannot manifest shipment: Delhivery API token is not configured in Settings.',
      };
    }

    try {
      const pickupPin = input.pickupPin || this.config.pickupWarehousePin || '110001';
      const payload = {
        shipments: [
          {
            name: input.recipient.fullName,
            add: input.recipient.addressLine1 + (input.recipient.addressLine2 ? ` ${input.recipient.addressLine2}` : ''),
            pin: input.recipient.pincode,
            city: input.recipient.city,
            state: input.recipient.state,
            country: 'India',
            phone: input.recipient.phone,
            order: input.orderNumber,
            payment_mode: input.paymentMethod === 'COD' ? 'COD' : 'Pre-paid',
            cod_amount: input.paymentMethod === 'COD' ? input.codAmount || 0 : 0,
            weight: input.packageSpecs.weightGrams,
            products_desc: input.items.map((i) => `${i.quantity}x ${i.name}`).join(', '),
            total_amount: input.declaredValue,
            quantity: input.items.reduce((sum, i) => sum + i.quantity, 0),
          },
        ],
        pickup_location: {
          name: 'TORIWEAR Warehouse',
          pin: pickupPin,
        },
      };

      const res = await fetch(`${this.baseUrl}/api/cmu/create.json`, {
        method: 'POST',
        headers: this.authHeader,
        body: `format=json&data=${encodeURIComponent(JSON.stringify(payload))}`,
      });

      const resJson: any = await res.json().catch(() => ({}));
      const pkg = resJson?.packages?.[0];

      if (res.ok && pkg && pkg.waybill) {
        const waybill = String(pkg.waybill);
        return {
          success: true,
          carrierKey: 'DELHIVERY',
          carrierName: 'Delhivery Express',
          awbNumber: waybill,
          shipmentId: `delh-${waybill}`,
          labelUrl: `/v1/admin/logistics/shipments/${waybill}/label`,
          trackingUrl: `https://www.delhivery.com/track/package/${waybill}`,
          estimatedDeliveryDate: new Date(Date.now() + 3 * 86400000).toISOString(),
          rawResponse: resJson,
        };
      }

      return {
        success: false,
        carrierKey: 'DELHIVERY',
        carrierName: 'Delhivery Express',
        error: resJson?.error || resJson?.packages?.[0]?.remarks?.[0] || `Delhivery CMU manifest returned HTTP ${res.status}`,
        rawResponse: resJson,
      };
    } catch (err: any) {
      return {
        success: false,
        carrierKey: 'DELHIVERY',
        carrierName: 'Delhivery Express',
        error: `Delhivery API network error: ${err.message}`,
      };
    }
  }

  async generateLabel(awbNumber: string): Promise<{ success: boolean; labelUrl: string; pdfData?: string; error?: string }> {
    if (!this.hasConfiguredCredentials()) {
      return { success: false, labelUrl: '', error: 'Delhivery credentials required to fetch official packing slip.' };
    }

    try {
      const endpoint = `${this.baseUrl}/api/p/packing_slip?wbns=${encodeURIComponent(awbNumber)}&style=envelope`;
      const res = await fetch(endpoint, { headers: this.authHeader });
      if (res.ok) {
        const json: any = await res.json().catch(() => ({}));
        if (json?.packages_found > 0) {
          return {
            success: true,
            labelUrl: endpoint,
          };
        }
      }
    } catch (err: any) {
      console.warn('[Delhivery] generateLabel error:', err.message);
    }

    return { success: false, labelUrl: '', error: 'Failed to retrieve official packing slip from Delhivery.' };
  }

  async schedulePickup(_awbNumber: string, pickupDate?: string): Promise<{ success: boolean; pickupToken?: string; scheduledDate?: string; message: string }> {
    if (!this.hasConfiguredCredentials()) {
      return {
        success: false,
        message: 'Delhivery API token required to schedule warehouse pickup.',
      };
    }

    try {
      const scheduledDate = pickupDate || new Date().toISOString().slice(0, 10);
      const payload = {
        pickup_time: '14:00:00',
        pickup_date: scheduledDate,
        pickup_location: 'TORIWEAR Warehouse',
        expected_package_count: 1,
      };

      const res = await fetch(`${this.baseUrl}/fm/request/new/`, {
        method: 'POST',
        headers: this.authHeader,
        body: JSON.stringify(payload),
      });

      const json: any = await res.json().catch(() => ({}));
      if (res.ok && json?.pickup_id) {
        return {
          success: true,
          pickupToken: String(json.pickup_id),
          scheduledDate,
          message: `Delhivery courier pickup confirmed. Pickup ID: ${json.pickup_id}`,
        };
      }

      return {
        success: false,
        message: json?.pr_remarks || json?.error || `Delhivery pickup request returned HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Network error requesting pickup from Delhivery: ${err.message}`,
      };
    }
  }

  async cancelShipment(awbNumber: string, _reason?: string): Promise<{ success: boolean; message: string }> {
    if (!this.hasConfiguredCredentials()) {
      return {
        success: false,
        message: 'Delhivery credentials required to cancel shipment.',
      };
    }

    try {
      const payload = {
        waybill: awbNumber,
        cancellation: 'true',
      };

      const res = await fetch(`${this.baseUrl}/api/p/edit`, {
        method: 'POST',
        headers: this.authHeader,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return {
          success: true,
          message: `Shipment ${awbNumber} successfully cancelled on Delhivery network.`,
        };
      }

      const json: any = await res.json().catch(() => ({}));
      return {
        success: false,
        message: json?.error || `Delhivery cancel returned HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Network error cancelling Delhivery shipment: ${err.message}`,
      };
    }
  }

  async trackShipment(awbNumber: string): Promise<CarrierTrackingDetails> {
    const fallbackTrackingUrl = `https://www.delhivery.com/track/package/${awbNumber}`;

    if (!this.hasConfiguredCredentials()) {
      return {
        awbNumber,
        carrierKey: 'DELHIVERY',
        carrierName: 'Delhivery Express',
        status: 'MANIFESTED',
        trackingUrl: fallbackTrackingUrl,
        events: [
          {
            status: 'AWAITING_CREDENTIALS',
            location: 'Warehouse Dispatch',
            activity: 'Shipment recorded. Delhivery API token required for live carrier tracking scans.',
            timestamp: new Date().toLocaleString('en-IN'),
          },
        ],
      };
    }

    try {
      const endpoint = `${this.baseUrl}/api/v1/packages/json/?waybill=${encodeURIComponent(awbNumber)}`;
      const res = await fetch(endpoint, { headers: this.authHeader });

      if (res.ok) {
        const json: any = await res.json().catch(() => ({}));
        const shipmentData = json?.ShipmentData?.[0]?.Shipment;

        if (shipmentData) {
          const rawStatus = (shipmentData?.Status?.Status || 'In Transit').toUpperCase();
          let mappedStatus: any = 'IN_TRANSIT';
          if (rawStatus.includes('DELIVERED')) mappedStatus = 'DELIVERED';
          else if (rawStatus.includes('OUT FOR DELIVERY')) mappedStatus = 'OUT_FOR_DELIVERY';
          else if (rawStatus.includes('DISPATCH') || rawStatus.includes('PICKED')) mappedStatus = 'PICKED_UP';
          else if (rawStatus.includes('RTO')) mappedStatus = 'RTO_INITIATED';
          else if (rawStatus.includes('CANCEL')) mappedStatus = 'CANCELLED';
          else if (rawStatus.includes('MANIFEST')) mappedStatus = 'MANIFESTED';

          const scans = (shipmentData?.Scans || []).map((s: any) => ({
            status: s?.ScanDetail?.Scan || 'Carrier Scan',
            location: s?.ScanDetail?.ScannedLocation || 'Transit Hub',
            activity: s?.ScanDetail?.Instructions || s?.ScanDetail?.Scan || 'Package in movement',
            timestamp: s?.ScanDetail?.ScanDateTime || new Date().toLocaleString('en-IN'),
          }));

          return {
            awbNumber,
            carrierKey: 'DELHIVERY',
            carrierName: 'Delhivery Express',
            status: mappedStatus,
            currentLocation: shipmentData?.Status?.StatusLocation || undefined,
            estimatedDelivery: shipmentData?.ExpectedDeliveryDate || undefined,
            trackingUrl: fallbackTrackingUrl,
            events: scans.length > 0 ? scans : [
              {
                status: mappedStatus,
                location: shipmentData?.Status?.StatusLocation || 'Delhivery Hub',
                activity: rawStatus,
                timestamp: new Date().toLocaleString('en-IN'),
              },
            ],
          };
        }
      }
    } catch (err: any) {
      console.warn('[Delhivery] trackShipment error:', err.message);
    }

    return {
      awbNumber,
      carrierKey: 'DELHIVERY',
      carrierName: 'Delhivery Express',
      status: 'MANIFESTED',
      trackingUrl: fallbackTrackingUrl,
      events: [
        {
          status: 'UNAVAILABLE',
          location: 'Network Error',
          activity: 'Could not contact Delhivery tracking gateway.',
          timestamp: new Date().toLocaleString('en-IN'),
        },
      ],
    };
  }

  parseWebhook(_headers: Record<string, any>, body: any) {
    const statusMap: Record<string, any> = {
      'In Transit': 'IN_TRANSIT',
      'Out for Delivery': 'OUT_FOR_DELIVERY',
      'Delivered': 'DELIVERED',
      'Dispatched': 'PICKED_UP',
      'RTO': 'RTO_INITIATED',
      'Cancelled': 'CANCELLED',
    };

    const rawStatus = body?.status || body?.Shipment?.Status?.Status || '';
    return {
      isValid: true,
      awbNumber: body?.waybill || body?.awb || body?.Shipment?.AWB,
      orderNumber: body?.order_id || body?.Shipment?.OrderRec?.OrderNumber,
      newStatus: statusMap[rawStatus] || 'IN_TRANSIT',
      location: body?.location || body?.Shipment?.Status?.Location || 'Courier Hub',
      activityDescription: body?.instructions || body?.Shipment?.Status?.StatusType || 'Carrier scan update',
      timestamp: new Date(),
    };
  }
}
