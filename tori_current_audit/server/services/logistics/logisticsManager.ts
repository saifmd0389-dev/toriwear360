import { logisticsPartnerRepository } from '../../repositories/logisticsPartnerRepository';
import { shippingRepository } from '../../repositories/shippingRepository';
import { orderRepository } from '../../repositories/orderRepository';
import { cmsRepository } from '../../repositories/cmsRepository';
import { safeTimingEqual } from '../../utils/storageHelper';
import { getProviderCredentials } from '../integrationVault';
import { BaseLogisticsAdapter } from './baseAdapter';
import { ShiprocketAdapter } from './shiprocketAdapter';
import { DelhiveryAdapter } from './delhiveryAdapter';
import {
  BlueDartAdapter,
  DTDCAdapter,
  XpressbeesAdapter,
  EcomExpressAdapter,
  IndiaPostAdapter,
  CustomCarrierAdapter,
} from './otherAdapters';
import {
  LogisticsPartnerConfig,
  LogisticsCarrierKey,
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

export class LogisticsManager {
  private adapters: Map<string, BaseLogisticsAdapter> = new Map();
  private customAdapterFactories: Map<string, (config: LogisticsPartnerConfig) => BaseLogisticsAdapter> = new Map();

  /**
   * Dynamic pluggable carrier adapter registry
   */
  public registerAdapter(carrierKey: string, factory: (config: LogisticsPartnerConfig) => BaseLogisticsAdapter) {
    this.customAdapterFactories.set(carrierKey.toUpperCase(), factory);
  }

  private createAdapter(config: LogisticsPartnerConfig): BaseLogisticsAdapter {
    const key = (config.carrierKey || '').toUpperCase();
    if (this.customAdapterFactories.has(key)) {
      return this.customAdapterFactories.get(key)!(config);
    }

    switch (key) {
      case 'SHIPROCKET':
        return new ShiprocketAdapter(config);
      case 'DELHIVERY':
        return new DelhiveryAdapter(config);
      case 'BLUEDART':
        return new BlueDartAdapter(config);
      case 'DTDC':
        return new DTDCAdapter(config);
      case 'XPRESSBEES':
        return new XpressbeesAdapter(config);
      case 'ECOM_EXPRESS':
        return new EcomExpressAdapter(config);
      case 'INDIA_POST':
        return new IndiaPostAdapter(config);
      case 'CUSTOM':
      case 'CUSTOM_REST':
      default:
        return new CustomCarrierAdapter(config);
    }
  }

  private async getAdapterForConfig(config: LogisticsPartnerConfig): Promise<BaseLogisticsAdapter> {
    const key = `${config.id}-${config.updatedAt}`;
    if (!this.adapters.has(key)) {
      this.adapters.set(key, this.createAdapter(config));
    }
    return this.adapters.get(key)!;
  }

  async getAdapter(carrierKey: LogisticsCarrierKey): Promise<BaseLogisticsAdapter | null> {
    let config = await logisticsPartnerRepository.getByCarrierKey(carrierKey);
    if (!config) return null;
    if (String(carrierKey).toUpperCase() === 'SHIPROCKET' && (!config.apiKey || !config.apiSecret || config.apiKey.includes('••••') || config.apiSecret.includes('••••'))) {
      const vault = await getProviderCredentials('shiprocket');
      if (vault.email && vault.password) config = { ...config, apiKey: vault.email, apiSecret: vault.password, webhookSecret: config.webhookSecret || vault.webhookSecret || '', updatedAt: `${config.updatedAt}-vault` };
    }
    return this.getAdapterForConfig(config);
  }

  async getAllPartners(maskSensitive = true): Promise<LogisticsPartnerConfig[]> {
    const partners = await logisticsPartnerRepository.getAll();
    if (!maskSensitive) return partners;
    return partners.map(p => logisticsPartnerRepository.maskConfig(p));
  }

  async getPartnerById(id: string, maskSensitive = true): Promise<LogisticsPartnerConfig | null> {
    const partner = await logisticsPartnerRepository.getById(id);
    if (!partner) return null;
    return maskSensitive ? logisticsPartnerRepository.maskConfig(partner) : partner;
  }

  async updatePartner(id: string, updates: Partial<LogisticsPartnerConfig>): Promise<LogisticsPartnerConfig | null> {
    // If updating sensitive fields with bullets '••••', ignore them so we don't overwrite real tokens
    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.apiKey && sanitizedUpdates.apiKey.includes('••••')) delete sanitizedUpdates.apiKey;
    if (sanitizedUpdates.apiSecret && sanitizedUpdates.apiSecret.includes('••••')) delete sanitizedUpdates.apiSecret;
    if (sanitizedUpdates.apiToken && sanitizedUpdates.apiToken.includes('••••')) delete sanitizedUpdates.apiToken;
    if (sanitizedUpdates.webhookSecret && sanitizedUpdates.webhookSecret.includes('••••')) delete sanitizedUpdates.webhookSecret;

    const updated = await logisticsPartnerRepository.update(id, sanitizedUpdates);
    if (!updated) return null;
    return logisticsPartnerRepository.maskConfig(updated);
  }

  async createPartner(payload: Partial<LogisticsPartnerConfig>): Promise<LogisticsPartnerConfig> {
    const created = await logisticsPartnerRepository.create(payload);
    return logisticsPartnerRepository.maskConfig(created);
  }

  async deletePartner(id: string): Promise<boolean> {
    return logisticsPartnerRepository.delete(id);
  }

  async togglePartner(id: string, isEnabled?: boolean) {
    const res = await logisticsPartnerRepository.toggleActive(id, isEnabled);
    return res ? logisticsPartnerRepository.maskConfig(res) : null;
  }

  async setDefaultPartner(id: string) {
    return logisticsPartnerRepository.setDefault(id);
  }

  async getSettings() {
    return logisticsPartnerRepository.getSettings();
  }

  async updateSettings(updates: any) {
    return logisticsPartnerRepository.updateSettings(updates);
  }

  async testPartner(id: string): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const partner = await logisticsPartnerRepository.getById(id);
    if (!partner) {
      return { success: false, latencyMs: 0, message: `Carrier config not found for ${id}` };
    }

    const adapter = await this.getAdapterForConfig(partner);
    const start = Date.now();
    try {
      const result = await adapter.testConnection();
      const latencyMs = result.latencyMs || (Date.now() - start);

      const isNeedsConfig = result.message.includes('NEEDS CONFIGURATION');
      const healthStatus = result.success ? 'HEALTHY' : (isNeedsConfig ? 'AWAITING_CREDENTIALS' : 'FAILED');

      await logisticsPartnerRepository.update(id, {
        healthStatus,
        lastHealthCheck: new Date().toISOString(),
        testLatencyMs: latencyMs,
        lastErrorMessage: result.success ? undefined : result.message,
      });

      return {
        success: result.success,
        latencyMs,
        message: result.message,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const errorMsg = err?.message || 'Carrier API ping failed';
      await logisticsPartnerRepository.update(id, {
        healthStatus: 'FAILED',
        lastHealthCheck: new Date().toISOString(),
        testLatencyMs: latencyMs,
        lastErrorMessage: errorMsg,
      });

      return {
        success: false,
        latencyMs,
        message: errorMsg,
      };
    }
  }

  /**
   * Check PIN code serviceability across all active partners
   */
  async checkServiceability(input: ServiceabilityCheckInput): Promise<ServiceabilityResult[]> {
    const partners = await logisticsPartnerRepository.getAll();
    const enabledPartners = partners.filter(p => p.isEnabled);

    const results = await Promise.all(
      enabledPartners.map(async p => {
        try {
          const adapter = await this.getAdapterForConfig(p);
          return await adapter.checkServiceability(input);
        } catch (e: any) {
          return {
            carrierKey: p.carrierKey,
            carrierName: p.name,
            serviceable: false,
            codAvailable: false,
            estimatedDays: 5,
            message: e?.message || 'Failed to check serviceability',
          };
        }
      })
    );

    return results;
  }

  /**
   * Live rate comparison across all active partners
   */
  async compareRates(input: RateCalculationInput): Promise<RateQuote[]> {
    const partners = await logisticsPartnerRepository.getAll();
    const enabledPartners = partners.filter(p => p.isEnabled);

    const quotesNested = await Promise.all(
      enabledPartners.map(async p => {
        try {
          const adapter = await this.getAdapterForConfig(p);
          return await adapter.calculateRates(input);
        } catch (e) {
          return [];
        }
      })
    );

    const allQuotes: RateQuote[] = quotesNested.flat();
    if (allQuotes.length === 0) return [];

    // Tag cheapest and fastest
    let minRate = Infinity;
    let minDays = Infinity;

    for (const q of allQuotes) {
      if (q.rate < minRate) minRate = q.rate;
      if (q.estimatedDays < minDays) minDays = q.estimatedDays;
    }

    return allQuotes.map(q => ({
      ...q,
      isCheapest: q.rate === minRate,
      isFastest: q.estimatedDays === minDays,
    })).sort((a, b) => a.rate - b.rate);
  }

  /**
   * Create shipment manifesting order and generating AWB
   */
  async createShipment(input: CreateCarrierShipmentInput): Promise<CarrierShipmentResult> {
    const settings = await logisticsPartnerRepository.getSettings();

    // 1. Determine which carrier to use
    let targetCarrierKey: LogisticsCarrierKey | undefined = input.carrierKey;

    if (!targetCarrierKey) {
      // Automatic allocation based on settings
      if (settings.allocationStrategy === 'CHEAPEST' || settings.allocationStrategy === 'FASTEST') {
        const quotes = await this.compareRates({
          originPin: input.pickupPin || settings.defaultOriginPin,
          destinationPin: input.recipient.pincode,
          weightGrams: input.packageSpecs.weightGrams,
          cod: input.paymentMethod === 'COD',
          declaredValue: input.declaredValue,
        });

        const firstQuote = quotes[0];
        if (firstQuote) {
          const selectedQuote = settings.allocationStrategy === 'FASTEST'
            ? quotes.reduce((fastest, cur) => cur.estimatedDays < fastest.estimatedDays ? cur : fastest, firstQuote)
            : firstQuote; // Already sorted by cheapest rate
          targetCarrierKey = selectedQuote.carrierKey;
        }
      }
    }

    // Fallback to default partner
    if (!targetCarrierKey) {
      const defaultPartner = await logisticsPartnerRepository.getDefault();
      targetCarrierKey = defaultPartner?.carrierKey || 'SHIPROCKET';
    }

    const partnerConfig = await logisticsPartnerRepository.getByCarrierKey(targetCarrierKey);
    if (!partnerConfig) {
      throw new Error(`Carrier configuration not found for: ${targetCarrierKey}`);
    }

    const adapter = await this.getAdapterForConfig(partnerConfig);
    const enrichedInput: CreateCarrierShipmentInput = {
      ...input,
      pickupPin: input.pickupPin || settings.pickupWarehousePin || settings.defaultOriginPin,
      pickupLocation: input.pickupLocation || settings.pickupWarehouseName || 'Primary',
    };
    const result = await adapter.createShipment(enrichedInput);

    if (result.success && result.awbNumber && input.orderId) {
      try {
        await shippingRepository.createShipment({
          id: `shp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          orderId: input.orderId,
          orderNumber: input.orderNumber || input.orderId,
          carrier: result.carrierKey,
          carrierShipmentId: result.shipmentId,
          trackingNumber: result.awbNumber,
          awbCode: result.awbNumber,
          shippingLabelUrl: result.labelUrl || `/api/v1/admin/logistics/shipments/${result.awbNumber}/label`,
          status: 'MANIFESTED',
          estimatedDeliveryDate: result.estimatedDeliveryDate ? new Date(result.estimatedDeliveryDate) : undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (persistErr) {
        console.warn('[LogisticsManager] Shipment DB persistence warning:', persistErr);
      }
    }

    return result;
  }

  async createReturnShipment(input: CreateCarrierReturnShipmentInput): Promise<CarrierReturnShipmentResult> {
    const partner = await logisticsPartnerRepository.getByCarrierKey('SHIPROCKET');
    if (!partner || !partner.isEnabled) return { success:false, carrierKey:'SHIPROCKET', carrierName:'Shiprocket', error:'Shiprocket carrier is not enabled in Logistics settings.' };
    const adapter = await this.getAdapter('SHIPROCKET');
    if (!adapter) return { success:false, carrierKey:'SHIPROCKET', carrierName:'Shiprocket', error:'Shiprocket adapter is not configured.' };
    return adapter.createReturnShipment(input);
  }

  private escapeHtml(str: unknown): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Get official carrier PDF label or printable HTML dispatch slip for a verified shipment
   */
  async getShippingLabel(awbNumber: string): Promise<{ html?: string; redirectUrl?: string }> {
    const cleanAwb = String(awbNumber || '').trim();
    const shipment =
      (await shippingRepository.findByAwbCode(cleanAwb)) ||
      (await shippingRepository.findByTrackingNumber(cleanAwb));

    let order = shipment ? await orderRepository.findById(shipment.orderId) : null;
    if (!order) {
      const candidates = await orderRepository.getAll({ search: cleanAwb });
      order =
        candidates.find(
          (o) =>
            (o.awbNumber && o.awbNumber.toLowerCase() === cleanAwb.toLowerCase()) ||
            (o.courierTrackingNumber && o.courierTrackingNumber.toLowerCase() === cleanAwb.toLowerCase())
        ) || null;
    }

    if (!shipment && !order) {
      const err: any = new Error(`Shipment or order not found for AWB "${cleanAwb}".`);
      err.status = 404;
      throw err;
    }

    // Attempt official carrier PDF label retrieval via configured adapter when carrierShipmentId or AWB exists
    const carrierKey = ((shipment?.carrier || '').toUpperCase().split(' ')[0] || '') as LogisticsCarrierKey;
    const adapter = carrierKey ? await this.getAdapter(carrierKey) : null;
    if (adapter) {
      try {
        const carrierLabel = await adapter.generateLabel(shipment?.carrierShipmentId || cleanAwb);
        if (carrierLabel.success && carrierLabel.labelUrl) {
          return { redirectUrl: carrierLabel.labelUrl };
        }
      } catch {}
    }

    const defaultPartner = await logisticsPartnerRepository.getDefault();
    const settings = await logisticsPartnerRepository.getSettings();
    const storeSettings = await cmsRepository.getStoreSettings();

    const carrierName = shipment?.carrier || order?.courierPartner || defaultPartner?.name || 'Carrier Assigned';
    const recipientName = order?.shippingAddress?.fullName || order?.customerName || 'Recipient Unavailable';
    const addr1 = order?.shippingAddress?.addressLine1 || 'Address on order record';
    const addr2 = order?.shippingAddress?.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : '';
    const city = order?.shippingAddress?.city || '';
    const state = order?.shippingAddress?.state || '';
    const pincode = order?.shippingAddress?.pincode || '';
    const phone = order?.shippingAddress?.phone || order?.customerPhone || '';

    const warehouseName = settings.pickupWarehouseName || 'TORIWEAR Fulfillment Warehouse';
    const warehouseAddress = settings.pickupWarehouseAddress || storeSettings.registeredAddress || '';
    const warehouseCity = settings.pickupWarehouseCity || '';
    const warehouseState = settings.pickupWarehouseState || '';
    const warehousePin = settings.pickupWarehousePin || settings.defaultOriginPin || '';
    const warehousePhone = settings.pickupWarehousePhone || storeSettings.supportPhone || storeSettings.supportEmail || '';

    const itemsSummary = order?.items?.length
      ? order.items.map((it) => `${it.quantity}x ${it.productName} (${it.size})`).join(', ')
      : 'Apparel Package';
    const totalWeightGrams = order?.items?.length ? order.items.reduce((s, it) => s + it.quantity * 320, 0) : 350;
    const paymentLabel = order?.paymentMethod?.toUpperCase() === 'COD'
      ? `COD (Collect ₹${Number(order.total || 0).toLocaleString('en-IN')})`
      : `PREPAID (${order?.paymentMethod || 'Online'})`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>TORIWEAR DISPATCH SLIP — ${this.escapeHtml(cleanAwb)}</title>
  <style>
    @page { size: 100mm 150mm; margin: 0; }
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, monospace;
      margin: 0;
      padding: 10px;
      background: #f4f4f4;
      color: #000;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .print-bar { margin-bottom: 12px; display: flex; gap: 10px; }
    .print-btn {
      background: #dc2626;
      color: #fff;
      border: none;
      padding: 8px 16px;
      font-weight: bold;
      font-size: 13px;
      border-radius: 6px;
      cursor: pointer;
    }
    .label-card {
      width: 100mm;
      min-height: 145mm;
      background: #fff;
      border: 2px solid #000;
      padding: 10px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
    }
    .logo-brand { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; }
    .sub-brand { font-size: 9px; letter-spacing: 1px; font-weight: 600; }
    .carrier-box { text-align: right; }
    .carrier-title { font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .mode-pill {
      font-size: 9px;
      font-weight: bold;
      background: #000;
      color: #fff;
      padding: 1px 6px;
      display: inline-block;
      margin-top: 2px;
    }
    .barcode-section { text-align: center; padding: 10px 0 6px 0; border-bottom: 2px solid #000; }
    .awb-text { font-family: monospace; font-size: 15px; font-weight: 900; letter-spacing: 2px; margin-top: 4px; }
    .routing-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 2px solid #000;
      padding: 6px 0;
      font-size: 10px;
    }
    .route-cell strong { display: block; font-size: 13px; font-weight: 900; }
    .address-section { border-bottom: 1px solid #000; padding: 8px 0; font-size: 10.5px; line-height: 1.35; }
    .address-title { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    .spec-table { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-top: 6px; border-bottom: 1px solid #000; }
    .spec-table td { padding: 3px 0; }
    .footer-row { display: flex; justify-content: space-between; align-items: center; padding-top: 6px; font-size: 8.5px; }
  </style>
</head>
<body>
  <div class="no-print print-bar">
    <button class="print-btn" onclick="window.print()">Print Thermal Label (4x6 / 100x150mm)</button>
  </div>

  <div class="label-card">
    <div class="header-row">
      <div>
        <div class="logo-brand">TORIWEAR</div>
        <div class="sub-brand">ORDER #${this.escapeHtml(order?.orderNumber || shipment?.orderNumber || cleanAwb)}</div>
      </div>
      <div class="carrier-box">
        <div class="carrier-title">${this.escapeHtml(carrierName)}</div>
        <div class="mode-pill">${this.escapeHtml(order?.paymentMethod?.toUpperCase() === 'COD' ? 'COD' : 'PREPAID')}</div>
      </div>
    </div>

    <div class="barcode-section">
      <div class="awb-text">AWB: ${this.escapeHtml(cleanAwb)}</div>
      ${shipment?.carrierShipmentId ? `<div style="font-size:9px;font-family:monospace;">Shipment ID: ${this.escapeHtml(shipment.carrierShipmentId)}</div>` : ''}
    </div>

    <div class="routing-grid">
      <div class="route-cell">
        <span>DESTINATION PIN:</span>
        <strong>${this.escapeHtml(pincode || 'N/A')}</strong>
      </div>
      <div class="route-cell" style="text-align: right;">
        <span>ORIGIN PIN:</span>
        <strong>${this.escapeHtml(warehousePin || 'N/A')}</strong>
      </div>
    </div>

    <div class="address-section">
      <div class="address-title">SHIP TO (CONSIGNEE):</div>
      <div style="font-weight: bold; font-size: 11px;">${this.escapeHtml(recipientName)}</div>
      <div>${this.escapeHtml(addr1)}${this.escapeHtml(addr2)}</div>
      <div>${this.escapeHtml([city, state].filter(Boolean).join(', '))}${pincode ? ` - ${this.escapeHtml(pincode)}` : ''}</div>
      ${phone ? `<div>Phone: ${this.escapeHtml(phone)}</div>` : ''}
    </div>

    <div class="address-section">
      <div class="address-title">RETURN TO (DISPATCH ORIGIN):</div>
      <div style="font-weight: bold;">${this.escapeHtml(warehouseName)}</div>
      ${warehouseAddress ? `<div>${this.escapeHtml(warehouseAddress)}</div>` : ''}
      <div>${this.escapeHtml([warehouseCity, warehouseState].filter(Boolean).join(', '))}${warehousePin ? ` - ${this.escapeHtml(warehousePin)}` : ''}</div>
      ${warehousePhone ? `<div>Contact: ${this.escapeHtml(warehousePhone)}</div>` : ''}
    </div>

    <table class="spec-table">
      <tr>
        <td><strong>Est. Weight:</strong> ${(totalWeightGrams / 1000).toFixed(2)} Kg</td>
        <td style="text-align: right;"><strong>Order Date:</strong> ${order?.createdAt ? this.escapeHtml(new Date(order.createdAt).toLocaleDateString('en-IN')) : 'N/A'}</td>
      </tr>
      <tr>
        <td><strong>Payment Mode:</strong> ${this.escapeHtml(paymentLabel)}</td>
        <td style="text-align: right;"><strong>Decl. Value:</strong> ₹${Number(order?.total || 0).toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td colspan="2"><strong>Contents:</strong> ${this.escapeHtml(itemsSummary)}</td>
      </tr>
    </table>

    <div class="footer-row">
      <span>${storeSettings.gstNumber ? `GSTIN: ${this.escapeHtml(storeSettings.gstNumber)}` : 'TORIWEAR'}</span>
      <span>Order Dispatch Manifest</span>
    </div>
  </div>
</body>
</html>`;

    return { html };
  }

  /**
   * Request carrier pickup using carrierShipmentId (required numeric ID for Shiprocket) or AWB
   */
  async schedulePickup(awbOrShipmentId: string, pickupDate?: string, carrierKey?: LogisticsCarrierKey) {
    const cleanId = String(awbOrShipmentId || '').trim();
    const shipment =
      (await shippingRepository.findByAwbCode(cleanId)) ||
      (await shippingRepository.findByTrackingNumber(cleanId));

    const resolvedKey =
      carrierKey ||
      ((shipment?.carrier?.toUpperCase() || '') as LogisticsCarrierKey) ||
      (await logisticsPartnerRepository.getDefault())?.carrierKey ||
      'SHIPROCKET';

    const adapter = await this.getAdapter(resolvedKey);
    if (!adapter) {
      return { success: false, message: `Carrier adapter "${resolvedKey}" not found.` };
    }

    const targetId = shipment?.carrierShipmentId || cleanId;
    return adapter.schedulePickup(targetId, pickupDate);
  }

  /**
   * Cancel shipment on carrier network and sync status in repository
   */
  async cancelShipment(awbNumber: string, reason?: string, carrierKey?: LogisticsCarrierKey) {
    const cleanAwb = String(awbNumber || '').trim();
    const shipment =
      (await shippingRepository.findByAwbCode(cleanAwb)) ||
      (await shippingRepository.findByTrackingNumber(cleanAwb));

    const resolvedKey =
      carrierKey ||
      ((shipment?.carrier?.toUpperCase() || '') as LogisticsCarrierKey) ||
      (await logisticsPartnerRepository.getDefault())?.carrierKey ||
      'SHIPROCKET';

    const adapter = await this.getAdapter(resolvedKey);
    if (!adapter) {
      return { success: false, message: `Carrier adapter "${resolvedKey}" not found.` };
    }

    const res = await adapter.cancelShipment(shipment?.awbCode || cleanAwb, reason);
    if (res.success && shipment) {
      await shippingRepository.updateShipment(shipment.id, { status: 'CANCELLED' });
    }
    return res;
  }

  /**
   * Track shipment
   */
  async trackShipment(awbNumber: string, carrierKey?: LogisticsCarrierKey): Promise<CarrierTrackingDetails> {
    let adapter: BaseLogisticsAdapter | null = null;
    if (carrierKey) {
      adapter = await this.getAdapter(carrierKey);
    }
    if (!adapter) {
      const shipment =
        (await shippingRepository.findByAwbCode(awbNumber)) ||
        (await shippingRepository.findByTrackingNumber(awbNumber));
      if (shipment?.carrier) {
        const keyGuess = shipment.carrier.toUpperCase().split(' ')[0] as LogisticsCarrierKey;
        adapter = await this.getAdapter(keyGuess);
      }
    }
    if (!adapter) {
      const defaultPartner = await logisticsPartnerRepository.getDefault();
      if (defaultPartner) adapter = await this.getAdapterForConfig(defaultPartner);
    }

    if (!adapter) {
      throw new Error('No active logistics carrier available for tracking.');
    }

    return adapter.trackShipment(awbNumber);
  }

  /**
   * Fail-closed carrier webhook router
   */
  async handleWebhook(carrierKey: string, payload: any, headers: any): Promise<{ handled: boolean; awb?: string; status?: string; error?: string }> {
    const key = carrierKey.toUpperCase() as LogisticsCarrierKey;
    const partnerConfig = await logisticsPartnerRepository.getByCarrierKey(key);
    if (!partnerConfig) {
      return { handled: false, error: `Unknown carrier "${carrierKey}".` };
    }

    const shiprocketVault = key === 'SHIPROCKET' ? await getProviderCredentials('shiprocket') : {};
    const configuredSecret = (partnerConfig.webhookSecret || process.env.SHIPROCKET_WEBHOOK_TOKEN || shiprocketVault.webhookSecret || '').trim();
    if (!configuredSecret) {
      return { handled: false, error: `Webhook rejected: Webhook secret not configured for ${partnerConfig.name}.` };
    }

    const providedToken = String(
      headers?.['x-api-key'] ||
      headers?.['x-shiprocket-token'] ||
      headers?.['x-webhook-token'] ||
      (typeof headers?.authorization === 'string' ? headers.authorization.replace(/^Bearer\s+/i, '') : '')
    ).trim();

    if (!providedToken || !safeTimingEqual(providedToken, configuredSecret)) {
      return { handled: false, error: 'Unauthorized carrier webhook signature/token.' };
    }

    const adapter = await this.getAdapterForConfig(partnerConfig);
    const parsed = await adapter.parseWebhook(headers, payload);
    return {
      handled: true,
      awb: parsed.awbNumber,
      status: parsed.newStatus,
    };
  }
}

export const logisticsManager = new LogisticsManager();
