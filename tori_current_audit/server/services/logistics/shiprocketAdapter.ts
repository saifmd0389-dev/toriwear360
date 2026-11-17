import { BaseLogisticsAdapter } from './baseAdapter';
import {
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

export class ShiprocketAdapter extends BaseLogisticsAdapter {
  private bearerToken: string | null = null;
  private tokenExpiresAt: number = 0;

  private get baseUrl(): string {
    return 'https://apiv2.shiprocket.in/v1/external';
  }

  private hasConfiguredCredentials(): boolean {
    const email = this.config.apiKey?.trim();
    const secret = (this.config.apiSecret || this.config.apiToken)?.trim();
    if (!email || !secret) return false;
    if (email.includes('••••') || secret.includes('••••')) return false;
    if (email.startsWith('sandbox_sr_user@') && secret === '••••••••••••••••') return false;
    return true;
  }

  private async getAuthToken(): Promise<{ token: string | null; error?: string; latencyMs: number }> {
    if (this.bearerToken && Date.now() < this.tokenExpiresAt) {
      return { token: this.bearerToken, latencyMs: 0 };
    }

    if (!this.hasConfiguredCredentials()) {
      return { token: null, error: 'Shiprocket API credentials are not configured. Please supply API user email and password.', latencyMs: 0 };
    }

    const email = this.config.apiKey!.trim();
    const password = (this.config.apiSecret || this.config.apiToken)!.trim();
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (res.ok) {
        const json: any = await res.json().catch(() => ({}));
        if (json?.token) {
          this.bearerToken = json.token;
          this.tokenExpiresAt = Date.now() + 23 * 3600 * 1000; // valid 24h
          return { token: this.bearerToken, latencyMs };
        }
        return { token: null, error: 'Shiprocket authentication response missing token.', latencyMs };
      }

      const errJson: any = await res.json().catch(() => ({}));
      const errMsg = errJson?.message || `HTTP ${res.status}: ${res.statusText}`;
      return { token: null, error: `Shiprocket authentication failed: ${errMsg}`, latencyMs };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return { token: null, error: `Network error reaching Shiprocket API: ${err.message || 'Timeout'}`, latencyMs };
    }
  }

  async testConnection(): Promise<{ success: boolean; latencyMs: number; message: string; details?: any }> {
    if (!this.hasConfiguredCredentials()) {
      return {
        success: false,
        latencyMs: 0,
        message: 'NEEDS CONFIGURATION: Shiprocket requires verified API Email and Password in settings.',
      };
    }

    const auth = await this.getAuthToken();
    if (!auth.token) {
      return {
        success: false,
        latencyMs: auth.latencyMs,
        message: auth.error || 'Failed to authenticate with Shiprocket API.',
      };
    }

    return {
      success: true,
      latencyMs: auth.latencyMs,
      message: `Shiprocket API authenticated successfully (${this.config.environment} Mode). Latency: ${auth.latencyMs}ms.`,
      details: { environment: this.config.environment, endpoint: this.baseUrl },
    };
  }

  async checkServiceability(input: ServiceabilityCheckInput): Promise<ServiceabilityResult> {
    const destPin = input.destinationPin?.trim();
    const isValidPin = /^[1-9][0-9]{5}$/.test(destPin);

    if (!isValidPin) {
      return {
        carrierKey: 'SHIPROCKET',
        carrierName: 'Shiprocket Multi-Carrier Hub',
        serviceable: false,
        codAvailable: false,
        estimatedDays: 0,
        message: 'Invalid Indian 6-digit PIN code format.',
      };
    }

    const auth = await this.getAuthToken();
    if (!auth.token) {
      return {
        carrierKey: 'SHIPROCKET',
        carrierName: 'Shiprocket Multi-Carrier Hub',
        serviceable: false,
        codAvailable: false,
        estimatedDays: 0,
        message: 'NEEDS CONFIGURATION: Live Shiprocket credentials required to verify courier serviceability.',
      };
    }

    try {
      const weightKg = (input.weightGrams || 350) / 1000;
      const codFlag = input.codRequired ? 1 : 0;
      const url = `${this.baseUrl}/courier/serviceability/?pickup_postcode=${encodeURIComponent(input.originPin)}&delivery_postcode=${encodeURIComponent(destPin)}&weight=${weightKg}&cod=${codFlag}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`,
        },
      });

      if (res.ok) {
        const json: any = await res.json().catch(() => ({}));
        const couriers = json?.data?.available_courier_companies || [];
        const isServiceable = couriers.length > 0;
        const codSupported = couriers.some((c: any) => c.cod === 1);
        const minDays = couriers.reduce((min: number, c: any) => {
          const days = parseInt(c.estimated_delivery_days, 10);
          return !isNaN(days) && days < min ? days : min;
        }, 5);

        return {
          carrierKey: 'SHIPROCKET',
          carrierName: 'Shiprocket Multi-Carrier Hub',
          serviceable: isServiceable,
          codAvailable: codSupported,
          estimatedDays: isServiceable ? minDays : 0,
          message: isServiceable
            ? `${couriers.length} couriers serviceable (Fastest: ~${minDays} days)`
            : 'PIN code not serviceable by any Shiprocket courier partner.',
        };
      }
    } catch (err: any) {
      console.warn('[Shiprocket] Serviceability API error:', err.message);
    }

    return {
      carrierKey: 'SHIPROCKET',
      carrierName: 'Shiprocket Multi-Carrier Hub',
      serviceable: false,
      codAvailable: false,
      estimatedDays: 0,
      message: 'Failed to retrieve live serviceability from Shiprocket.',
    };
  }

  async calculateRates(input: RateCalculationInput): Promise<RateQuote[]> {
    const auth = await this.getAuthToken();
    if (!auth.token) {
      return [];
    }

    try {
      const weightKg = (input.weightGrams || 350) / 1000;
      const codFlag = input.cod ? 1 : 0;
      const url = `${this.baseUrl}/courier/serviceability/?pickup_postcode=${encodeURIComponent(input.originPin)}&delivery_postcode=${encodeURIComponent(input.destinationPin)}&weight=${weightKg}&cod=${codFlag}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`,
        },
      });

      if (res.ok) {
        const json: any = await res.json().catch(() => ({}));
        const couriers: any[] = json?.data?.available_courier_companies || [];

        return couriers.map((c) => ({
          carrierKey: 'SHIPROCKET',
          carrierName: `Shiprocket (${c.courier_name || 'Carrier'})`,
          serviceCode: `SR_${c.courier_company_id}`,
          serviceName: c.courier_name || 'Standard Courier',
          rate: Math.round(Number(c.rate) || 60),
          estimatedDays: parseInt(c.estimated_delivery_days, 10) || 3,
          isCodAvailable: c.cod === 1,
        }));
      }
    } catch (err: any) {
      console.warn('[Shiprocket] calculateRates error:', err.message);
    }

    return [];
  }

  async createShipment(input: CreateCarrierShipmentInput): Promise<CarrierShipmentResult> {
    const auth = await this.getAuthToken();
    if (!auth.token) {
      return {
        success: false,
        carrierKey: 'SHIPROCKET',
        carrierName: 'Shiprocket Multi-Carrier Hub',
        error: auth.error || 'Cannot create shipment: Shiprocket API credentials are not configured.',
      };
    }

    try {
      const orderDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const payload = {
        order_id: input.orderNumber,
        order_date: orderDate,
        pickup_location: input.pickupLocation?.trim() || 'Primary',
        billing_customer_name: input.recipient.fullName,
        billing_last_name: '',
        billing_address: input.recipient.addressLine1,
        billing_address_2: input.recipient.addressLine2 || '',
        billing_city: input.recipient.city,
        billing_pincode: input.recipient.pincode,
        billing_state: input.recipient.state,
        billing_country: 'India',
        billing_email: input.recipient.email || 'orders@toriwear.com',
        billing_phone: input.recipient.phone,
        shipping_is_billing: true,
        order_items: input.items.map((it) => ({
          name: it.name,
          sku: it.sku,
          units: it.quantity,
          selling_price: it.price,
        })),
        payment_method: input.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
        sub_total: input.declaredValue,
        length: input.packageSpecs.lengthCm || 28,
        breadth: input.packageSpecs.breadthCm || 20,
        height: input.packageSpecs.heightCm || 4,
        weight: (input.packageSpecs.weightGrams || 350) / 1000,
      };

      const createRes = await fetch(`${this.baseUrl}/orders/create/adhoc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`,
        },
        body: JSON.stringify(payload),
      });

      const createJson: any = await createRes.json().catch(() => ({}));
      if (!createRes.ok || !createJson?.shipment_id) {
        return {
          success: false,
          carrierKey: 'SHIPROCKET',
          carrierName: 'Shiprocket Multi-Carrier Hub',
          error: createJson?.message || `Shiprocket adhoc order creation failed with status ${createRes.status}`,
          rawResponse: createJson,
        };
      }

      const shipmentId = String(createJson.shipment_id);

      // Request AWB assignment from Shiprocket
      const awbRes = await fetch(`${this.baseUrl}/courier/assign/awb`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ shipment_id: shipmentId }),
      });

      const awbJson: any = await awbRes.json().catch(() => ({}));
      const awbNumber = awbJson?.response?.data?.awb_code;
      const assignedCourier = awbJson?.response?.data?.courier_name;

      if (!awbNumber) {
        return {
          success: false,
          carrierKey: 'SHIPROCKET',
          carrierName: assignedCourier || 'Shiprocket Multi-Carrier Hub',
          shipmentId,
          error: awbJson?.message || 'Shiprocket shipment created, but AWB generation failed or is pending courier assignment.',
          rawResponse: awbJson,
        };
      }

      return {
        success: true,
        carrierKey: 'SHIPROCKET',
        carrierName: assignedCourier ? `Shiprocket (${assignedCourier})` : 'Shiprocket Multi-Carrier Hub',
        awbNumber,
        shipmentId,
        labelUrl: `/api/v1/admin/logistics/shipments/${awbNumber}/label`,
        trackingUrl: `https://shiprocket.co/tracking/${awbNumber}`,
        estimatedDeliveryDate: awbJson?.response?.data?.etd || undefined,
        rawResponse: awbJson,
      };
    } catch (err: any) {
      return {
        success: false,
        carrierKey: 'SHIPROCKET',
        carrierName: 'Shiprocket Multi-Carrier Hub',
        error: `Shiprocket API network error: ${err.message}`,
      };
    }
  }

  async createReturnShipment(input: CreateCarrierReturnShipmentInput): Promise<CarrierReturnShipmentResult> {
    const auth = await this.getAuthToken();
    if (!auth.token) return { success:false, carrierKey:'SHIPROCKET', carrierName:'Shiprocket', error:auth.error || 'Shiprocket credentials are unavailable.' };
    const cleanPhone = (value:string) => String(value || '').replace(/[^0-9]/g, '').slice(-10);
    const pickupPhone = cleanPhone(input.pickup.phone); const destinationPhone = cleanPhone(input.destination.phone);
    if (!/^[6-9][0-9]{9}$/.test(pickupPhone) || !/^[6-9][0-9]{9}$/.test(destinationPhone)) return { success:false, carrierKey:'SHIPROCKET', carrierName:'Shiprocket', error:'Valid 10-digit Indian pickup and warehouse phone numbers are required.' };
    const orderDate = new Date().toISOString().slice(0,19).replace('T',' ');
    const payload = {
      order_id: input.returnOrderId, order_date: orderDate,
      pickup_customer_name: input.pickup.name, pickup_last_name: '',
      pickup_address: input.pickup.addressLine1, pickup_address_2: input.pickup.addressLine2 || '',
      pickup_city: input.pickup.city, pickup_state: input.pickup.state, pickup_country: input.pickup.country || 'India',
      pickup_pincode: input.pickup.pincode, pickup_email: input.pickup.email, pickup_phone: pickupPhone, pickup_isd_code: '91',
      shipping_customer_name: input.destination.name, shipping_last_name: '',
      shipping_address: input.destination.addressLine1, shipping_address_2: input.destination.addressLine2 || '',
      shipping_city: input.destination.city, shipping_state: input.destination.state, shipping_country: input.destination.country || 'India',
      shipping_pincode: input.destination.pincode, shipping_email: input.destination.email, shipping_phone: destinationPhone, shipping_isd_code: '91',
      order_items: input.items.map((item) => ({ name:item.name, sku:item.sku, units:item.quantity, selling_price:item.price })),
      payment_method: 'Prepaid', sub_total: input.declaredValue,
      length: input.packageSpecs.lengthCm, breadth: input.packageSpecs.breadthCm, height: input.packageSpecs.heightCm, weight: input.packageSpecs.weightGrams / 1000,
      comment: input.reason.slice(0,250),
    };
    try {
      const createResponse = await fetch(`${this.baseUrl}/shipments/create/return-shipment`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.token}`}, body:JSON.stringify(payload), signal:AbortSignal.timeout(20000) });
      const createJson:any = await createResponse.json().catch(()=>({}));
      let shipmentId = String(createJson?.shipment_id || createJson?.response?.shipment_id || createJson?.data?.shipment_id || '');
      let awbNumber = String(createJson?.awb_code || createJson?.response?.awb_code || createJson?.response?.data?.awb_code || createJson?.data?.awb_code || '');
      let courierName = String(createJson?.courier_name || createJson?.response?.courier_name || createJson?.response?.data?.courier_name || 'Shiprocket');
      let latestResponse:any = createJson;
      if (!createResponse.ok || !shipmentId) return { success:false, carrierKey:'SHIPROCKET', carrierName:'Shiprocket', error:createJson?.message || createJson?.errors ? JSON.stringify(createJson.errors || createJson.message) : `Shiprocket return order creation failed (HTTP ${createResponse.status}).`, rawResponse:createJson };

      if (!awbNumber) {
        const awbResponse = await fetch(`${this.baseUrl}/courier/assign/awb`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.token}`}, body:JSON.stringify({shipment_id:shipmentId}), signal:AbortSignal.timeout(15000) });
        const awbJson:any = await awbResponse.json().catch(()=>({})); latestResponse = { create:createJson, awb:awbJson };
        awbNumber = String(awbJson?.response?.data?.awb_code || awbJson?.awb_code || '');
        courierName = String(awbJson?.response?.data?.courier_name || courierName);
      }

      let pickupScheduled = Boolean(createJson?.pickup_scheduled || createJson?.pickup_scheduled_date || createJson?.pickup_token_number || createJson?.response?.pickup_scheduled || createJson?.response?.pickup_scheduled_date);
      let pickupToken = String(createJson?.pickup_token_number || createJson?.response?.pickup_token_number || '');
      if (awbNumber && !pickupScheduled) {
        const pickup = await this.schedulePickup(shipmentId);
        pickupScheduled = pickup.success; pickupToken = pickup.pickupToken || '';
        latestResponse = { response:latestResponse, pickup };
      }
      return { success:true, carrierKey:'SHIPROCKET', carrierName:courierName, returnOrderId:input.returnOrderId, shipmentId, awbNumber:awbNumber || undefined, trackingUrl:awbNumber ? `https://shiprocket.co/tracking/${awbNumber}` : undefined, labelUrl:awbNumber ? `/api/v1/admin/logistics/shipments/${encodeURIComponent(awbNumber)}/label` : undefined, pickupScheduled, pickupToken:pickupToken || undefined, message:awbNumber ? (pickupScheduled ? 'Return AWB assigned and reverse pickup scheduled.' : 'Return AWB assigned; pickup scheduling is pending and can be retried.') : 'Return order created; AWB assignment is pending. Check Shiprocket before retrying to avoid duplicate return orders.', rawResponse:latestResponse };
    } catch (error:any) {
      return { success:false, carrierKey:'SHIPROCKET', carrierName:'Shiprocket', error:`Shiprocket reverse pickup request failed: ${error?.message || 'Network error'}` };
    }
  }

  async generateLabel(shipmentIdOrAwb: string): Promise<{ success: boolean; labelUrl: string; pdfData?: string; error?: string }> {
    const auth = await this.getAuthToken();
    if (!auth.token) {
      return { success: false, labelUrl: '', error: 'Shiprocket API credentials required to generate official carrier label.' };
    }

    const numericId = Number(shipmentIdOrAwb);
    const idPayload = Number.isInteger(numericId) && numericId > 0 ? numericId : shipmentIdOrAwb;

    try {
      const res = await fetch(`${this.baseUrl}/courier/generate/label`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ shipment_id: [idPayload] }),
      });

      const json: any = await res.json().catch(() => ({}));
      if (res.ok && json?.label_url) {
        return { success: true, labelUrl: json.label_url };
      }
      return {
        success: false,
        labelUrl: '',
        error: json?.message || `Shiprocket label generation returned HTTP ${res.status}`,
      };
    } catch (err: any) {
      console.warn('[Shiprocket] generateLabel error:', err.message);
      return { success: false, labelUrl: '', error: `Network error fetching Shiprocket label: ${err.message}` };
    }
  }

  async schedulePickup(shipmentIdOrAwb: string, pickupDate?: string): Promise<{ success: boolean; pickupToken?: string; scheduledDate?: string; message: string }> {
    const auth = await this.getAuthToken();
    if (!auth.token) {
      return {
        success: false,
        message: 'Shiprocket API credentials required to schedule carrier pickup.',
      };
    }

    const numericId = Number(shipmentIdOrAwb);
    const idPayload = Number.isInteger(numericId) && numericId > 0 ? numericId : shipmentIdOrAwb;

    try {
      const scheduledDate = pickupDate || new Date().toISOString().slice(0, 10);
      const res = await fetch(`${this.baseUrl}/courier/generate/pickup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          shipment_id: [idPayload],
          pickup_date: [scheduledDate],
        }),
      });

      const json: any = await res.json().catch(() => ({}));
      if (res.ok && (json?.response?.pickup_token_number || json?.pickup_status === 1)) {
        return {
          success: true,
          pickupToken: json?.response?.pickup_token_number || 'CONFIRMED',
          scheduledDate,
          message: json?.response?.pickup_token_number
            ? `Shiprocket courier pickup confirmed. Token: ${json.response.pickup_token_number}`
            : 'Shiprocket courier pickup scheduled.',
        };
      }

      return {
        success: false,
        message: json?.message || `Shiprocket pickup generation returned HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Network error scheduling pickup with Shiprocket: ${err.message}`,
      };
    }
  }

  async cancelShipment(awbNumber: string, _reason?: string): Promise<{ success: boolean; message: string }> {
    const auth = await this.getAuthToken();
    if (!auth.token) {
      return {
        success: false,
        message: 'Shiprocket API credentials required to cancel shipment.',
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/orders/cancel/shipment/awbs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ awbs: [awbNumber] }),
      });

      const json: any = await res.json().catch(() => ({}));
      if (res.ok) {
        return {
          success: true,
          message: `Shiprocket AWB ${awbNumber} cancelled successfully on carrier network.`,
        };
      }

      return {
        success: false,
        message: json?.message || `Shiprocket cancellation returned HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Network error cancelling Shiprocket AWB: ${err.message}`,
      };
    }
  }

  async trackShipment(awbNumber: string): Promise<CarrierTrackingDetails> {
    const auth = await this.getAuthToken();
    const fallbackTrackingUrl = `https://shiprocket.co/tracking/${awbNumber}`;

    if (!auth.token) {
      return {
        awbNumber,
        carrierKey: 'SHIPROCKET',
        carrierName: 'Shiprocket Multi-Carrier Hub',
        status: 'MANIFESTED',
        trackingUrl: fallbackTrackingUrl,
        events: [
          {
            status: 'AWAITING_CREDENTIALS',
            location: 'Warehouse Dispatch',
            activity: 'Shipment recorded. Shiprocket API credentials required for live carrier tracking scans.',
            timestamp: new Date().toLocaleString('en-IN'),
          },
        ],
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/courier/track/awb/${awbNumber}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`,
        },
      });

      if (res.ok) {
        const json: any = await res.json().catch(() => ({}));
        const trackData = json?.tracking_data;
        const currentStatus = (trackData?.current_status || 'MANIFESTED').toUpperCase();

        let mappedStatus: any = 'IN_TRANSIT';
        if (currentStatus.includes('DELIVERED')) mappedStatus = 'DELIVERED';
        else if (currentStatus.includes('OUT FOR DELIVERY')) mappedStatus = 'OUT_FOR_DELIVERY';
        else if (currentStatus.includes('PICKED') || currentStatus.includes('PICKUP')) mappedStatus = 'PICKED_UP';
        else if (currentStatus.includes('RTO')) mappedStatus = 'RTO_INITIATED';
        else if (currentStatus.includes('CANCEL')) mappedStatus = 'CANCELLED';
        else if (currentStatus.includes('MANIFEST')) mappedStatus = 'MANIFESTED';

        const scans = (trackData?.shipment_track_activities || []).map((s: any) => ({
          status: s?.['sr-status-label'] || s?.activity || 'Scan Update',
          location: s?.location || 'Transit Hub',
          activity: s?.activity || s?.['sr-status-label'] || 'Carrier movement',
          timestamp: s?.date || new Date().toLocaleString('en-IN'),
        }));

        return {
          awbNumber,
          carrierKey: 'SHIPROCKET',
          carrierName: 'Shiprocket Multi-Carrier Hub',
          status: mappedStatus,
          currentLocation: trackData?.shipment_track?.[0]?.current_status_location || undefined,
          estimatedDelivery: trackData?.etd || undefined,
          trackingUrl: fallbackTrackingUrl,
          events: scans.length > 0 ? scans : [
            {
              status: mappedStatus,
              location: 'Transit Network',
              activity: currentStatus,
              timestamp: new Date().toLocaleString('en-IN'),
            },
          ],
        };
      }
    } catch (err: any) {
      console.warn('[Shiprocket] trackShipment error:', err.message);
    }

    return {
      awbNumber,
      carrierKey: 'SHIPROCKET',
      carrierName: 'Shiprocket Multi-Carrier Hub',
      status: 'MANIFESTED',
      trackingUrl: fallbackTrackingUrl,
      events: [
        {
          status: 'UNAVAILABLE',
          location: 'Network Error',
          activity: 'Could not contact Shiprocket tracking gateway.',
          timestamp: new Date().toLocaleString('en-IN'),
        },
      ],
    };
  }

  parseWebhook(_headers: Record<string, any>, body: any) {
    const rawStatus = (body?.current_status || body?.status || '').toUpperCase();
    let mappedStatus: any = 'IN_TRANSIT';
    if (rawStatus.includes('DELIVERED')) mappedStatus = 'DELIVERED';
    else if (rawStatus.includes('OUT FOR DELIVERY')) mappedStatus = 'OUT_FOR_DELIVERY';
    else if (rawStatus.includes('PICKED UP')) mappedStatus = 'PICKED_UP';
    else if (rawStatus.includes('RTO')) mappedStatus = 'RTO_INITIATED';
    else if (rawStatus.includes('CANCEL')) mappedStatus = 'CANCELLED';

    return {
      isValid: true,
      awbNumber: body?.awb || body?.awb_code,
      orderNumber: body?.order_id || body?.channel_order_id,
      newStatus: mappedStatus,
      location: body?.scans?.[0]?.location || 'Courier Hub',
      activityDescription: body?.scans?.[0]?.activity || body?.current_status || 'Tracking scan update',
      timestamp: new Date(),
    };
  }
}
