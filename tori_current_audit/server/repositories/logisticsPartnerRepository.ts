import fs from 'fs';
import { LogisticsPartnerConfig, AllocationStrategy } from '../services/logistics/types';
import { orderRepository } from './orderRepository';
import { getPrismaClient } from '../db/prisma';
import { resolveSecureStorePath, encryptFieldValue, decryptFieldValue } from '../utils/storageHelper';

export interface GlobalLogisticsSettings {
  allocationStrategy: AllocationStrategy;
  pickupWarehouseName: string;
  pickupWarehouseAddress: string;
  pickupWarehouseCity: string;
  pickupWarehouseState: string;
  pickupWarehousePin: string;
  pickupWarehousePhone: string;
  defaultOriginPin: string;
  autoManifestOnPaid: boolean;
  notifyCustomerOnDispatch: boolean;
  preferredCarrierPriority: string[];
  weightBufferGrams: number;
}

const STORAGE_FILE = resolveSecureStorePath('logistics-partners.json', '.logistics-partners.json');

const INITIAL_PARTNERS: LogisticsPartnerConfig[] = [
  {
    id: 'shiprocket',
    carrierKey: 'SHIPROCKET',
    name: 'Shiprocket Multi-Courier Hub',
    logo: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100&q=80',
    isEnabled: false,
    isDefault: false,
    environment: 'SANDBOX',
    apiEndpoint: 'https://apiv2.shiprocket.in/v1/external',
    apiKey: '',
    apiSecret: '',
    pickupWarehousePin: '',
    trackingUrlTemplate: 'https://shiprocket.co/tracking/{awb}',
    priorityOrder: 1,
    capabilities: ['FORWARD', 'REVERSE', 'COD', 'TRACKING', 'LABEL', 'PICKUP'],
    healthStatus: 'AWAITING_CREDENTIALS',
    testLatencyMs: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'delhivery',
    carrierKey: 'DELHIVERY',
    name: 'Delhivery Express Surface & Air',
    logo: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=100&q=80',
    isEnabled: false,
    isDefault: false,
    environment: 'SANDBOX',
    apiEndpoint: 'https://staging-express.delhivery.com/api',
    apiToken: '',
    pickupWarehousePin: '',
    trackingUrlTemplate: 'https://www.delhivery.com/track/package/{awb}',
    priorityOrder: 2,
    capabilities: ['FORWARD', 'REVERSE', 'COD', 'TRACKING', 'LABEL', 'PICKUP'],
    healthStatus: 'AWAITING_CREDENTIALS',
    testLatencyMs: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bluedart',
    carrierKey: 'BLUEDART',
    name: 'Blue Dart Apex & Air Express',
    logo: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=100&q=80',
    isEnabled: false,
    isDefault: false,
    environment: 'SANDBOX',
    apiEndpoint: 'https://apigateway-sandbox.bluedart.com',
    apiKey: '',
    apiSecret: '',
    pickupWarehousePin: '',
    trackingUrlTemplate: 'https://www.bluedart.com/tracking?trackNumber={awb}',
    priorityOrder: 3,
    capabilities: ['FORWARD', 'REVERSE', 'COD', 'TRACKING', 'LABEL', 'PICKUP'],
    healthStatus: 'AWAITING_CREDENTIALS',
    testLatencyMs: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dtdc',
    carrierKey: 'DTDC',
    name: 'DTDC Courier & Cargo Express',
    logo: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=100&q=80',
    isEnabled: false,
    isDefault: false,
    environment: 'SANDBOX',
    apiEndpoint: 'https://smarttrack.dtdc.com/ctsv2',
    apiKey: '',
    apiSecret: '',
    pickupWarehousePin: '',
    trackingUrlTemplate: 'https://www.dtdc.in/tracking/shipment-tracking.asp?strCnno={awb}',
    priorityOrder: 4,
    capabilities: ['FORWARD', 'COD', 'TRACKING', 'LABEL', 'PICKUP'],
    healthStatus: 'AWAITING_CREDENTIALS',
    testLatencyMs: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'xpressbees',
    carrierKey: 'XPRESSBEES',
    name: 'Xpressbees Logistics',
    logo: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=100&q=80',
    isEnabled: false,
    isDefault: false,
    environment: 'SANDBOX',
    apiEndpoint: 'https://shipment.xpressbees.com/api',
    apiKey: '',
    pickupWarehousePin: '',
    trackingUrlTemplate: 'https://www.xpressbees.com/track?awb={awb}',
    priorityOrder: 5,
    capabilities: ['FORWARD', 'REVERSE', 'COD', 'TRACKING', 'LABEL', 'PICKUP'],
    healthStatus: 'AWAITING_CREDENTIALS',
    testLatencyMs: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ecom_express',
    carrierKey: 'ECOM_EXPRESS',
    name: 'Ecom Express EWS & EXS',
    logo: 'https://images.unsplash.com/photo-1519074069444-1ba4ea16e6f6?w=100&q=80',
    isEnabled: false,
    isDefault: false,
    environment: 'SANDBOX',
    apiEndpoint: 'https://api.ecomexpress.in',
    apiKey: '',
    pickupWarehousePin: '',
    trackingUrlTemplate: 'https://ecomexpress.in/tracking/?awb={awb}',
    priorityOrder: 6,
    capabilities: ['FORWARD', 'REVERSE', 'COD', 'TRACKING', 'LABEL', 'PICKUP'],
    healthStatus: 'AWAITING_CREDENTIALS',
    testLatencyMs: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'india_post',
    carrierKey: 'INDIA_POST',
    name: 'India Post Speed Post & Parcel',
    logo: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?w=100&q=80',
    isEnabled: false,
    isDefault: false,
    environment: 'PRODUCTION',
    apiEndpoint: 'https://api.indiapost.gov.in/v1',
    merchantId: '',
    pickupWarehousePin: '',
    trackingUrlTemplate: 'https://www.indiapost.gov.in/_layouts/15/dpt.cpt.tracking/trackconsignment.aspx?consignNumber={awb}',
    priorityOrder: 7,
    capabilities: ['FORWARD', 'COD', 'TRACKING', 'LABEL'],
    healthStatus: 'AWAITING_CREDENTIALS',
    testLatencyMs: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'custom_carrier',
    carrierKey: 'CUSTOM',
    name: 'Custom REST Logistics Gateway',
    logo: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=100&q=80',
    isEnabled: false,
    isDefault: false,
    environment: 'SANDBOX',
    apiEndpoint: '',
    apiKey: '',
    pickupWarehousePin: '',
    trackingUrlTemplate: '',
    priorityOrder: 8,
    capabilities: ['FORWARD', 'REVERSE', 'TRACKING', 'LABEL', 'PICKUP'],
    healthStatus: 'AWAITING_CREDENTIALS',
    testLatencyMs: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_SETTINGS: GlobalLogisticsSettings = {
  allocationStrategy: 'CHEAPEST',
  pickupWarehouseName: 'Primary Fulfillment Warehouse',
  pickupWarehouseAddress: '',
  pickupWarehouseCity: '',
  pickupWarehouseState: '',
  pickupWarehousePin: '',
  pickupWarehousePhone: '',
  defaultOriginPin: '',
  autoManifestOnPaid: false,
  notifyCustomerOnDispatch: true,
  preferredCarrierPriority: ['SHIPROCKET', 'DELHIVERY', 'BLUEDART', 'DTDC', 'XPRESSBEES', 'ECOM_EXPRESS', 'INDIA_POST'],
  weightBufferGrams: 50,
};

function isConfigured(p: LogisticsPartnerConfig): boolean {
  const k = p.apiKey?.trim();
  const s = p.apiSecret?.trim();
  const t = p.apiToken?.trim();
  if (!k && !s && !t) return false;
  if ((k && k.includes('••••')) || (s && s.includes('••••')) || (t && t.includes('••••'))) return false;
  if (k?.startsWith('sandbox_sr_') || k?.startsWith('BD_CUST_') || k?.startsWith('DTDC_API_') || k?.startsWith('XB_CLIENT_') || k?.startsWith('ECOM_USER_')) return false;
  return true;
}

export class LogisticsPartnerRepository {
  private partners: Map<string, LogisticsPartnerConfig> = new Map();
  private settings: GlobalLogisticsSettings = { ...INITIAL_SETTINGS };

  constructor() {
    this.loadFromStorage();
  }

  private encryptPartnerForDisk(p: LogisticsPartnerConfig): LogisticsPartnerConfig {
    return {
      ...p,
      apiKey: p.apiKey ? encryptFieldValue(p.apiKey) : '',
      apiSecret: p.apiSecret ? encryptFieldValue(p.apiSecret) : '',
      apiToken: p.apiToken ? encryptFieldValue(p.apiToken) : '',
      webhookSecret: p.webhookSecret ? encryptFieldValue(p.webhookSecret) : '',
    };
  }

  private decryptPartnerFromDisk(p: LogisticsPartnerConfig): LogisticsPartnerConfig {
    return {
      ...p,
      apiKey: decryptFieldValue(p.apiKey),
      apiSecret: decryptFieldValue(p.apiSecret),
      apiToken: decryptFieldValue(p.apiToken),
      webhookSecret: decryptFieldValue(p.webhookSecret),
    };
  }

  private loadFromStorage() {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
        if (Array.isArray(data.partners) && data.partners.length > 0) {
          data.partners.forEach((rawPartner: LogisticsPartnerConfig) => {
            const p = this.decryptPartnerFromDisk(rawPartner);
            // Validate: if credentials are unconfigured or placeholder, enforce AWAITING_CREDENTIALS
            if (!isConfigured(p)) {
              p.healthStatus = 'AWAITING_CREDENTIALS';
              p.testLatencyMs = 0;
            }
            this.partners.set(p.id, p);
          });
        } else {
          INITIAL_PARTNERS.forEach(p => this.partners.set(p.id, { ...p }));
        }

        if (data.settings) {
          this.settings = { ...INITIAL_SETTINGS, ...data.settings };
        }
        return;
      }
    } catch (e) {
      console.warn('[LogisticsRepo] Storage load note:', e);
    }

    INITIAL_PARTNERS.forEach(p => this.partners.set(p.id, { ...p }));
    this.persistToStorage(false);
  }

  private persistToStorage(syncDb: boolean = true) {
    try {
      const encryptedPartners = Array.from(this.partners.values()).map(p => this.encryptPartnerForDisk(p));
      const data = {
        partners: encryptedPartners,
        settings: this.settings,
        savedAt: new Date().toISOString(),
      };
      const tmp = `${STORAGE_FILE}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmp, STORAGE_FILE);

      if (syncDb) {
        const prisma = getPrismaClient();
        if (prisma?.websiteSetting) {
          prisma.websiteSetting.upsert({
            where: { key: 'logistics.partners.config' },
            create: {
              key: 'logistics.partners.config',
              value: JSON.stringify(data),
              group: 'SHIPPING',
              isPublic: false,
              description: 'Encrypted carrier partner configs and global logistics warehouse settings',
            },
            update: {
              value: JSON.stringify(data),
            },
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[LogisticsRepo] Failed to persist configuration:', err);
    }
  }

  async getAll(): Promise<LogisticsPartnerConfig[]> {
    return Array.from(this.partners.values()).sort((a, b) => a.priorityOrder - b.priorityOrder);
  }

  async getById(id: string): Promise<LogisticsPartnerConfig | null> {
    return this.partners.get(id) || null;
  }

  async getByCarrierKey(carrierKey: string): Promise<LogisticsPartnerConfig | null> {
    for (const p of this.partners.values()) {
      if (p.carrierKey === carrierKey) return p;
    }
    return null;
  }

  async getDefault(): Promise<LogisticsPartnerConfig | null> {
    for (const p of this.partners.values()) {
      if (p.isDefault && p.isEnabled) return p;
    }
    const enabled = Array.from(this.partners.values()).filter(p => p.isEnabled);
    return enabled[0] || null;
  }

  async create(payload: Partial<LogisticsPartnerConfig>): Promise<LogisticsPartnerConfig> {
    if (!payload.name?.trim()) {
      throw new Error('Courier name is required.');
    }
    const carrierKey = (payload.carrierKey || 'CUSTOM_REST').toUpperCase();
    const id = payload.id || `courier-${carrierKey.toLowerCase()}-${Date.now()}`;
    if (this.partners.has(id)) {
      throw new Error(`Carrier with ID "${id}" already exists.`);
    }

    const newPartner: LogisticsPartnerConfig = {
      id,
      carrierKey: carrierKey as any,
      name: payload.name.trim(),
      logo: payload.logo || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100&q=80',
      isEnabled: payload.isEnabled ?? false,
      isDefault: false,
      environment: payload.environment || 'SANDBOX',
      apiEndpoint: payload.apiEndpoint || '',
      apiKey: payload.apiKey || '',
      apiSecret: payload.apiSecret || '',
      apiToken: payload.apiToken || '',
      webhookSecret: payload.webhookSecret || '',
      pickupWarehousePin: payload.pickupWarehousePin || this.settings.defaultOriginPin || '',
      trackingUrlTemplate: payload.trackingUrlTemplate || '',
      priorityOrder: payload.priorityOrder || (this.partners.size + 1),
      capabilities: payload.capabilities || ['FORWARD', 'TRACKING', 'LABEL'],
      healthStatus: 'AWAITING_CREDENTIALS',
      testLatencyMs: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.partners.set(id, newPartner);
    this.persistToStorage();
    return newPartner;
  }

  async delete(id: string): Promise<boolean> {
    const partner = this.partners.get(id);
    if (!partner) {
      throw new Error('Logistics partner not found.');
    }
    if (partner.isDefault) {
      throw new Error('Cannot delete the default courier partner. Set another courier as default first.');
    }

    // Safety audit: Check for any active shipments assigned to this courier
    try {
      const allOrders = await orderRepository.getAll();
      const activeShipments = allOrders.filter(o => 
        (o.courierPartner?.toLowerCase() === partner.carrierKey.toLowerCase() || 
         o.courierPartner?.toLowerCase() === partner.id.toLowerCase() || 
         o.courierPartner?.toLowerCase() === partner.name.toLowerCase()) &&
        ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'].includes(o.fulfillmentStatus)
      );

      if (activeShipments.length > 0) {
        throw new Error(`Cannot delete ${partner.name}: ${activeShipments.length} active shipment(s) currently assigned. Please deactivate the courier instead or complete/reassign those shipments.`);
      }
    } catch (err: any) {
      if (err.message?.includes('Cannot delete')) throw err;
      console.warn('[LogisticsRepo] Active shipment check warning:', err);
    }

    this.partners.delete(id);
    this.persistToStorage();
    return true;
  }

  async update(id: string, updates: Partial<LogisticsPartnerConfig>): Promise<LogisticsPartnerConfig | null> {
    const existing = this.partners.get(id);
    if (!existing) return null;

    const cleanField = (newVal?: string, oldVal?: string) => {
      if (newVal === undefined) return oldVal;
      const trimmed = newVal.trim();
      if (!trimmed || trimmed.includes('••••')) return oldVal;
      return trimmed;
    };

    const updated: LogisticsPartnerConfig = {
      ...existing,
      ...updates,
      id: existing.id,
      carrierKey: updates.carrierKey || existing.carrierKey,
      apiKey: cleanField(updates.apiKey, existing.apiKey),
      apiSecret: cleanField(updates.apiSecret, existing.apiSecret),
      apiToken: cleanField(updates.apiToken, existing.apiToken),
      webhookSecret: cleanField(updates.webhookSecret, existing.webhookSecret),
      updatedAt: new Date().toISOString(),
    };

    // If credentials were reset or are missing, ensure status is AWAITING_CREDENTIALS
    if (!isConfigured(updated)) {
      if (updated.healthStatus === 'HEALTHY') {
        updated.healthStatus = 'AWAITING_CREDENTIALS';
      }
    }

    this.partners.set(id, updated);
    this.persistToStorage();
    return updated;
  }

  async toggleActive(id: string, isEnabled?: boolean): Promise<LogisticsPartnerConfig | null> {
    const existing = this.partners.get(id);
    if (!existing) return null;

    existing.isEnabled = typeof isEnabled === 'boolean' ? isEnabled : !existing.isEnabled;
    existing.updatedAt = new Date().toISOString();
    this.persistToStorage();
    return existing;
  }

  async setDefault(id: string): Promise<LogisticsPartnerConfig | null> {
    const target = this.partners.get(id);
    if (!target) return null;

    for (const p of this.partners.values()) {
      p.isDefault = (p.id === id);
    }
    target.isEnabled = true;
    target.updatedAt = new Date().toISOString();
    this.persistToStorage();
    return target;
  }

  async getSettings(): Promise<GlobalLogisticsSettings> {
    return { ...this.settings };
  }

  async updateSettings(updates: Partial<GlobalLogisticsSettings>): Promise<GlobalLogisticsSettings> {
    this.settings = { ...this.settings, ...updates };

    // Sync warehouse pincode to partners if updated
    if (updates.pickupWarehousePin || updates.defaultOriginPin) {
      const pin = updates.pickupWarehousePin || updates.defaultOriginPin;
      for (const p of this.partners.values()) {
        p.pickupWarehousePin = pin || '';
      }
    }

    this.persistToStorage();
    return { ...this.settings };
  }

  maskConfig(config: LogisticsPartnerConfig): LogisticsPartnerConfig {
    return {
      ...config,
      apiKey: config.apiKey ? (config.apiKey.length > 8 ? `${config.apiKey.slice(0, 4)}••••${config.apiKey.slice(-4)}` : '••••••••') : undefined,
      apiSecret: config.apiSecret ? '••••••••••••••••' : undefined,
      apiToken: config.apiToken ? '••••••••••••••••' : undefined,
      webhookSecret: config.webhookSecret ? '••••••••••••••••' : undefined,
    };
  }
}

export const logisticsPartnerRepository = new LogisticsPartnerRepository();
