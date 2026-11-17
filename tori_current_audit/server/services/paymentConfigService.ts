import fs from 'fs';
import path from 'path';
import { encryptSecret, decryptSecret } from './totpService';
import { getPrismaClient } from '../db/prisma';
import { resolveSecureStorePath } from '../utils/storageHelper';

export interface PaymentGatewayRecord {
  id: string; // e.g. 'gw-razorpay', 'gw-cashfree', 'gw-stripe', 'gw-custom'
  provider: 'RAZORPAY' | 'CASHFREE' | 'STRIPE' | 'CUSTOM_UPI';
  name: string;
  environment: 'TEST' | 'LIVE';
  isEnabled: boolean;
  isDefault: boolean;
  keyId: string;
  keySecretEncrypted: string;
  webhookSecretEncrypted: string;
  merchantId?: string;
  endpointUrl?: string;
  status: 'NOT_CONFIGURED' | 'CREDENTIALS_SAVED' | 'VERIFIED' | 'FAILED';
  lastTestedAt?: string;
  lastErrorMessage?: string;
  lastLatencyMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentGatewayPublicView {
  id: string;
  provider: 'RAZORPAY' | 'CASHFREE' | 'STRIPE' | 'CUSTOM_UPI';
  name: string;
  environment: 'TEST' | 'LIVE';
  isEnabled: boolean;
  isDefault: boolean;
  keyId: string;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  maskedKeySecret: string;
  maskedWebhookSecret: string;
  merchantId?: string;
  endpointUrl?: string;
  status: 'NOT_CONFIGURED' | 'CREDENTIALS_SAVED' | 'VERIFIED' | 'FAILED';
  lastTestedAt?: string;
  lastErrorMessage?: string;
  lastLatencyMs?: number;
  webhookUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface RazorpayEnvConfig {
  keyId: string;
  keySecretEncrypted: string;
  webhookSecretEncrypted: string;
  lastTestedAt?: string;
  status: 'NOT_CONFIGURED' | 'CREDENTIALS_SAVED' | 'VERIFIED' | 'FAILED';
  lastErrorMessage?: string;
  lastLatencyMs?: number;
}

export interface PaymentGatewayStorage {
  enabled: boolean;
  environment: 'test' | 'live';
  defaultGatewayId: string;
  gateways: PaymentGatewayRecord[];
  testConfig: RazorpayEnvConfig;
  liveConfig: RazorpayEnvConfig;
  updatedAt: string;
}

export interface RazorpayEnvPublicView {
  keyId: string;
  maskedKeySecret: string;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  maskedWebhookSecret: string;
  webhookUrl: string;
  connectionStatus: 'VERIFIED' | 'CREDENTIALS_SAVED' | 'CONNECTION_FAILED' | 'NOT_CONFIGURED';
  lastTestedAt?: string;
  lastError?: string;
  lastLatencyMs?: number;
}

export interface RazorpayPublicConfig {
  enabled: boolean;
  environment: 'TEST' | 'LIVE';
  testConfig: RazorpayEnvPublicView;
  liveConfig: RazorpayEnvPublicView;
  activeKeyId: string;
  webhookUrl: string;
}

// Protected runtime storage outside of public & git-tracked directories
const CONFIG_FILE = resolveSecureStorePath('payment-gateways-config.json', '.payment-gateway-config.json');
const LEGACY_CONFIG_FILE = path.resolve(process.cwd(), '.payment-gateway-config.json');

const INITIAL_GATEWAYS: PaymentGatewayRecord[] = [
  {
    id: 'gw-razorpay',
    provider: 'RAZORPAY',
    name: 'Razorpay Standard Checkout',
    environment: 'TEST',
    isEnabled: false,
    isDefault: true,
    keyId: '',
    keySecretEncrypted: '',
    webhookSecretEncrypted: '',
    status: 'NOT_CONFIGURED',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'gw-cashfree',
    provider: 'CASHFREE',
    name: 'Cashfree Payment Gateway',
    environment: 'TEST',
    isEnabled: false,
    isDefault: false,
    keyId: '',
    keySecretEncrypted: '',
    webhookSecretEncrypted: '',
    status: 'NOT_CONFIGURED',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'gw-stripe',
    provider: 'STRIPE',
    name: 'Stripe International Gateway',
    environment: 'TEST',
    isEnabled: false,
    isDefault: false,
    keyId: '',
    keySecretEncrypted: '',
    webhookSecretEncrypted: '',
    status: 'NOT_CONFIGURED',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_CONFIG: PaymentGatewayStorage = {
  enabled: false,
  environment: 'test',
  defaultGatewayId: 'gw-razorpay',
  gateways: INITIAL_GATEWAYS,
  testConfig: {
    keyId: '',
    keySecretEncrypted: '',
    webhookSecretEncrypted: '',
    status: 'NOT_CONFIGURED',
  },
  liveConfig: {
    keyId: '',
    keySecretEncrypted: '',
    webhookSecretEncrypted: '',
    status: 'NOT_CONFIGURED',
  },
  updatedAt: new Date().toISOString(),
};

function maskSecret(val: string): string {
  if (!val) return '';
  if (val.length <= 4) return '••••••••';
  return `••••••••${val.slice(-4)}`;
}

export class PaymentConfigService {
  private config: PaymentGatewayStorage = { ...DEFAULT_CONFIG };
  private initialized = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (this.initialized) return;

    try {
      let pathToRead = CONFIG_FILE;
      if (!fs.existsSync(CONFIG_FILE) && fs.existsSync(LEGACY_CONFIG_FILE)) {
        pathToRead = LEGACY_CONFIG_FILE;
      }

      if (fs.existsSync(pathToRead)) {
        const raw = fs.readFileSync(pathToRead, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed) {
          this.config = {
            enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : false,
            environment: parsed.environment === 'live' ? 'live' : 'test',
            defaultGatewayId: parsed.defaultGatewayId || 'gw-razorpay',
            gateways: Array.isArray(parsed.gateways) && parsed.gateways.length > 0 ? parsed.gateways : INITIAL_GATEWAYS,
            testConfig: { ...DEFAULT_CONFIG.testConfig, ...(parsed.testConfig || {}) },
            liveConfig: { ...DEFAULT_CONFIG.liveConfig, ...(parsed.liveConfig || {}) },
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          };
          if (pathToRead !== CONFIG_FILE) {
            this.saveToStorage(false);
          }
          this.initialized = true;
          return;
        }
      }
    } catch (err) {
      console.warn('[PaymentConfig] Storage load notice:', err);
    }

    // Initialize with environment defaults if present, but do not claim verified
    const envKeyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
    const envSecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
    const envWebhook = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';

    if (envKeyId && envSecret) {
      const isLive = envKeyId.startsWith('rzp_live');
      const targetEnv = isLive ? this.config.liveConfig : this.config.testConfig;
      targetEnv.keyId = envKeyId;
      try {
        targetEnv.keySecretEncrypted = encryptSecret(envSecret);
        if (envWebhook) {
          targetEnv.webhookSecretEncrypted = encryptSecret(envWebhook);
        }
        targetEnv.status = 'CREDENTIALS_SAVED';
      } catch {}
      this.config.environment = isLive ? 'live' : 'test';
      this.config.enabled = true;

      // Also sync to initial gateways list
      const rzpGateway = this.config.gateways.find(g => g.id === 'gw-razorpay');
      if (rzpGateway) {
        rzpGateway.keyId = envKeyId;
        rzpGateway.environment = isLive ? 'LIVE' : 'TEST';
        rzpGateway.isEnabled = true;
        try {
          rzpGateway.keySecretEncrypted = encryptSecret(envSecret);
          if (envWebhook) rzpGateway.webhookSecretEncrypted = encryptSecret(envWebhook);
          rzpGateway.status = 'CREDENTIALS_SAVED';
        } catch {}
      }
    }

    this.saveToStorage(false);
    this.initialized = true;
  }

  public async syncToDatabase(): Promise<void> {
    try {
      const prisma = getPrismaClient();
      if (!prisma?.websiteSetting) return;
      const serialized = JSON.stringify(this.config, null, 2);
      await prisma.websiteSetting.upsert({
        where: { key: 'payment.gateways.config' },
        create: {
          key: 'payment.gateways.config',
          value: serialized,
          group: 'GENERAL',
          isPublic: false,
          description: 'Encrypted payment gateway configurations',
        },
        update: { value: serialized },
      });
    } catch {}
  }

  private saveToStorage(syncDb: boolean = true) {
    try {
      const dir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.config.updatedAt = new Date().toISOString();
      const serialized = JSON.stringify(this.config, null, 2);
      const tmp = `${CONFIG_FILE}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmp, serialized, 'utf-8');
      fs.renameSync(tmp, CONFIG_FILE);

      if (syncDb) {
        const prisma = getPrismaClient();
        if (prisma?.websiteSetting) {
          prisma.websiteSetting.upsert({
            where: { key: 'payment.gateways.config' },
            create: {
              key: 'payment.gateways.config',
              value: serialized,
              group: 'GENERAL',
              isPublic: false,
              description: 'Encrypted payment gateway configurations',
            },
            update: { value: serialized },
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[PaymentConfig] Failed to persist gateway configuration:', err);
    }
  }

  // =========================================================================
  // MULTI-GATEWAY API MANAGEMENT (ADD, EDIT, REMOVE, TEST, DEFAULT, TOGGLE)
  // =========================================================================

  getPublicGateways(appUrl: string = ''): PaymentGatewayPublicView[] {
    const cleanBaseUrl = appUrl.replace(/\/+$/, '') || (process.env.APP_URL?.replace(/\/+$/, '') || 'https://thetoriwearstore.in');

    return this.config.gateways.map((g) => {
      let keySecret = '';
      let webhookSecret = '';
      try {
        if (g.keySecretEncrypted) keySecret = decryptSecret(g.keySecretEncrypted);
        if (g.webhookSecretEncrypted) webhookSecret = decryptSecret(g.webhookSecretEncrypted);
      } catch {}

      const providerSlug = g.provider.toLowerCase();
      const webhookUrl = `${cleanBaseUrl}/api/v1/payments/${providerSlug}/webhook`;

      return {
        id: g.id,
        provider: g.provider,
        name: g.name,
        environment: g.environment,
        isEnabled: g.isEnabled,
        isDefault: g.isDefault,
        keyId: g.keyId || '',
        hasKeySecret: Boolean(keySecret),
        hasWebhookSecret: Boolean(webhookSecret),
        maskedKeySecret: maskSecret(keySecret),
        maskedWebhookSecret: maskSecret(webhookSecret),
        merchantId: g.merchantId,
        endpointUrl: g.endpointUrl,
        status: g.status,
        lastTestedAt: g.lastTestedAt,
        lastErrorMessage: g.lastErrorMessage,
        lastLatencyMs: g.lastLatencyMs,
        webhookUrl,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      };
    });
  }

  getGatewayById(id: string): PaymentGatewayRecord | null {
    return this.config.gateways.find((g) => g.id === id) || null;
  }

  getDefaultGateway(): PaymentGatewayRecord | null {
    const def = this.config.gateways.find((g) => g.id === this.config.defaultGatewayId || g.isDefault);
    return def || this.config.gateways[0] || null;
  }

  async createGateway(payload: {
    provider: 'RAZORPAY' | 'CASHFREE' | 'STRIPE' | 'CUSTOM_UPI';
    name: string;
    environment?: 'TEST' | 'LIVE';
    keyId: string;
    keySecret?: string;
    webhookSecret?: string;
    merchantId?: string;
    endpointUrl?: string;
  }): Promise<PaymentGatewayPublicView> {
    const cleanName = (payload.name || '').trim();
    if (!cleanName) throw new Error('Gateway display name is required.');
    if (!payload.keyId?.trim()) throw new Error('API Key ID / Client ID is required.');

    const newId = `gw-${payload.provider.toLowerCase()}-${Date.now().toString(36)}`;
    const env = payload.environment === 'LIVE' ? 'LIVE' : 'TEST';

    let keySecretEncrypted = '';
    let webhookSecretEncrypted = '';
    if (payload.keySecret?.trim() && !payload.keySecret.includes('••••')) {
      keySecretEncrypted = encryptSecret(payload.keySecret.trim());
    }
    if (payload.webhookSecret?.trim() && !payload.webhookSecret.includes('••••')) {
      webhookSecretEncrypted = encryptSecret(payload.webhookSecret.trim());
    }

    const isFirst = this.config.gateways.length === 0;

    const newGateway: PaymentGatewayRecord = {
      id: newId,
      provider: payload.provider,
      name: cleanName,
      environment: env,
      isEnabled: true,
      isDefault: isFirst,
      keyId: payload.keyId.trim(),
      keySecretEncrypted,
      webhookSecretEncrypted,
      merchantId: payload.merchantId?.trim(),
      endpointUrl: payload.endpointUrl?.trim(),
      status: keySecretEncrypted ? 'CREDENTIALS_SAVED' : 'NOT_CONFIGURED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isFirst) {
      this.config.defaultGatewayId = newId;
    }

    this.config.gateways.push(newGateway);
    this.saveToStorage();

    const publicList = this.getPublicGateways();
    return publicList.find((g) => g.id === newId)!;
  }

  async updateGateway(
    id: string,
    updates: {
      name?: string;
      environment?: 'TEST' | 'LIVE';
      keyId?: string;
      keySecret?: string;
      webhookSecret?: string;
      merchantId?: string;
      endpointUrl?: string;
      isEnabled?: boolean;
      isDefault?: boolean;
    }
  ): Promise<PaymentGatewayPublicView> {
    const existing = this.config.gateways.find((g) => g.id === id);
    if (!existing) {
      throw new Error(`Payment gateway with ID "${id}" not found.`);
    }

    if (updates.name && updates.name.trim()) {
      existing.name = updates.name.trim();
    }

    if (updates.environment === 'TEST' || updates.environment === 'LIVE') {
      if (existing.environment !== updates.environment) {
        existing.environment = updates.environment;
        existing.status = 'CREDENTIALS_SAVED';
      }
    }

    if (typeof updates.keyId === 'string') {
      const cleanKey = updates.keyId.trim();
      if (cleanKey && cleanKey !== existing.keyId) {
        existing.keyId = cleanKey;
        existing.status = 'CREDENTIALS_SAVED';
      }
    }

    // Preserve existing secret if blank or masked with bullets
    if (updates.keySecret !== undefined) {
      const cleanSecret = updates.keySecret.trim();
      if (cleanSecret && !cleanSecret.includes('••••')) {
        existing.keySecretEncrypted = encryptSecret(cleanSecret);
        existing.status = 'CREDENTIALS_SAVED';
      }
    }

    if (updates.webhookSecret !== undefined) {
      const cleanWebhook = updates.webhookSecret.trim();
      if (cleanWebhook && !cleanWebhook.includes('••••')) {
        existing.webhookSecretEncrypted = encryptSecret(cleanWebhook);
      }
    }

    if (updates.merchantId !== undefined) {
      existing.merchantId = updates.merchantId.trim();
    }

    if (updates.endpointUrl !== undefined) {
      existing.endpointUrl = updates.endpointUrl.trim();
    }

    if (typeof updates.isEnabled === 'boolean') {
      existing.isEnabled = updates.isEnabled;
    }

    if (updates.isDefault) {
      this.setDefaultGateway(id);
    }

    existing.updatedAt = new Date().toISOString();

    // If this is the active Razorpay gateway, also sync legacy test/live config
    if (existing.provider === 'RAZORPAY') {
      const targetEnv = existing.environment === 'LIVE' ? this.config.liveConfig : this.config.testConfig;
      targetEnv.keyId = existing.keyId;
      targetEnv.keySecretEncrypted = existing.keySecretEncrypted;
      targetEnv.webhookSecretEncrypted = existing.webhookSecretEncrypted;
      this.config.environment = existing.environment === 'LIVE' ? 'live' : 'test';
      this.config.enabled = existing.isEnabled;
    }

    this.saveToStorage();

    const publicList = this.getPublicGateways();
    return publicList.find((g) => g.id === id)!;
  }

  async deleteGateway(id: string): Promise<boolean> {
    const existing = this.config.gateways.find((g) => g.id === id);
    if (!existing) {
      throw new Error('Payment gateway not found.');
    }

    if (existing.isDefault || this.config.defaultGatewayId === id) {
      throw new Error('Cannot remove the default payment gateway. Please designate another gateway as default first.');
    }

    this.config.gateways = this.config.gateways.filter((g) => g.id !== id);
    this.saveToStorage();
    return true;
  }

  async toggleGateway(id: string, isEnabled: boolean): Promise<PaymentGatewayPublicView> {
    const target = this.config.gateways.find((g) => g.id === id);
    if (!target) throw new Error('Gateway not found.');
    target.isEnabled = isEnabled;
    target.updatedAt = new Date().toISOString();
    this.saveToStorage();
    const publicList = this.getPublicGateways();
    return publicList.find((g) => g.id === id)!;
  }

  async setDefaultGateway(id: string): Promise<PaymentGatewayPublicView> {
    const target = this.config.gateways.find((g) => g.id === id);
    if (!target) throw new Error('Gateway not found.');

    for (const g of this.config.gateways) {
      g.isDefault = g.id === id;
      if (g.id === id) g.isEnabled = true;
    }
    this.config.defaultGatewayId = id;
    this.saveToStorage();
    const publicList = this.getPublicGateways();
    return publicList.find((g) => g.id === id)!;
  }

  /**
   * Genuine Provider Connection Test for any configured gateway.
   * Performs real authenticated request to the provider API.
   * Never returns fake success or fake latency.
   */
  async testGatewayConnection(id: string): Promise<{
    success: boolean;
    latencyMs: number;
    message: string;
    details?: any;
  }> {
    const gateway = this.config.gateways.find((g) => g.id === id);
    if (!gateway) {
      return { success: false, latencyMs: 0, message: 'Gateway not found.' };
    }

    const keyId = gateway.keyId?.trim();
    let secret = '';
    try {
      if (gateway.keySecretEncrypted) secret = decryptSecret(gateway.keySecretEncrypted).trim();
    } catch {}

    if (!keyId) {
      const msg = `API Key ID / Client ID is missing for ${gateway.name}.`;
      gateway.status = 'FAILED';
      gateway.lastErrorMessage = msg;
      this.saveToStorage();
      return { success: false, latencyMs: 0, message: msg };
    }

    if (!secret) {
      const msg = `API Secret is missing for ${gateway.name}.`;
      gateway.status = 'FAILED';
      gateway.lastErrorMessage = msg;
      this.saveToStorage();
      return { success: false, latencyMs: 0, message: msg };
    }

    const start = Date.now();

    // 1. RAZORPAY TEST
    if (gateway.provider === 'RAZORPAY') {
      const authHeader = 'Basic ' + Buffer.from(`${keyId}:${secret}`).toString('base64');
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const res = await fetch('https://api.razorpay.com/v1/orders?count=1', {
          method: 'GET',
          headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const latencyMs = Date.now() - start;
        const json: any = await res.json().catch(() => ({}));

        if (res.ok) {
          gateway.status = 'VERIFIED';
          gateway.lastTestedAt = new Date().toISOString();
          gateway.lastLatencyMs = latencyMs;
          gateway.lastErrorMessage = undefined;
          this.saveToStorage();
          return {
            success: true,
            latencyMs,
            message: `Authenticated request to Razorpay ${gateway.environment} API succeeded (${latencyMs}ms). Verified active orders collection.`,
            details: { mode: gateway.environment, count: json?.count ?? 0 },
          };
        }

        const errDesc = json?.error?.description || `Razorpay returned HTTP ${res.status}`;
        gateway.status = 'FAILED';
        gateway.lastTestedAt = new Date().toISOString();
        gateway.lastLatencyMs = latencyMs;
        gateway.lastErrorMessage = errDesc;
        this.saveToStorage();
        return { success: false, latencyMs, message: `Razorpay connection failed: ${errDesc}`, details: json?.error };
      } catch (err: any) {
        const latencyMs = Date.now() - start;
        const msg = err?.name === 'AbortError' ? 'Connection timed out after 12s.' : err.message;
        gateway.status = 'FAILED';
        gateway.lastTestedAt = new Date().toISOString();
        gateway.lastLatencyMs = latencyMs;
        gateway.lastErrorMessage = msg;
        this.saveToStorage();
        return { success: false, latencyMs, message: `Connection error: ${msg}` };
      }
    }

    // 2. CASHFREE TEST
    if (gateway.provider === 'CASHFREE') {
      const isLive = gateway.environment === 'LIVE';
      const baseUrl = isLive ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(`${baseUrl}/orders?limit=1`, {
          method: 'GET',
          headers: {
            'x-client-id': keyId,
            'x-client-secret': secret,
            'x-api-version': '2023-08-01',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const latencyMs = Date.now() - start;
        const json: any = await res.json().catch(() => ({}));

        if (res.ok) {
          gateway.status = 'VERIFIED';
          gateway.lastTestedAt = new Date().toISOString();
          gateway.lastLatencyMs = latencyMs;
          gateway.lastErrorMessage = undefined;
          this.saveToStorage();
          return {
            success: true,
            latencyMs,
            message: `Authenticated request to Cashfree ${gateway.environment} API succeeded (${latencyMs}ms).`,
            details: json,
          };
        }

        const errDesc = json?.message || `Cashfree returned HTTP ${res.status}`;
        gateway.status = 'FAILED';
        gateway.lastTestedAt = new Date().toISOString();
        gateway.lastLatencyMs = latencyMs;
        gateway.lastErrorMessage = errDesc;
        this.saveToStorage();
        return { success: false, latencyMs, message: `Cashfree connection failed: ${errDesc}`, details: json };
      } catch (err: any) {
        const latencyMs = Date.now() - start;
        gateway.status = 'FAILED';
        gateway.lastTestedAt = new Date().toISOString();
        gateway.lastLatencyMs = latencyMs;
        gateway.lastErrorMessage = err.message;
        this.saveToStorage();
        return { success: false, latencyMs, message: `Cashfree error: ${err.message}` };
      }
    }

    // 3. STRIPE TEST
    if (gateway.provider === 'STRIPE') {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const res = await fetch('https://api.stripe.com/v1/balance', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${secret}`,
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const latencyMs = Date.now() - start;
        const json: any = await res.json().catch(() => ({}));

        if (res.ok) {
          gateway.status = 'VERIFIED';
          gateway.lastTestedAt = new Date().toISOString();
          gateway.lastLatencyMs = latencyMs;
          gateway.lastErrorMessage = undefined;
          this.saveToStorage();
          return {
            success: true,
            latencyMs,
            message: `Authenticated request to Stripe ${gateway.environment} API succeeded (${latencyMs}ms). Live balance endpoint verified.`,
            details: json,
          };
        }

        const errDesc = json?.error?.message || `Stripe returned HTTP ${res.status}`;
        gateway.status = 'FAILED';
        gateway.lastTestedAt = new Date().toISOString();
        gateway.lastLatencyMs = latencyMs;
        gateway.lastErrorMessage = errDesc;
        this.saveToStorage();
        return { success: false, latencyMs, message: `Stripe connection failed: ${errDesc}`, details: json?.error };
      } catch (err: any) {
        const latencyMs = Date.now() - start;
        gateway.status = 'FAILED';
        gateway.lastTestedAt = new Date().toISOString();
        gateway.lastLatencyMs = latencyMs;
        gateway.lastErrorMessage = err.message;
        this.saveToStorage();
        return { success: false, latencyMs, message: `Stripe error: ${err.message}` };
      }
    }

    // 4. CUSTOM UPI / REST ENDPOINT TEST
    if (gateway.endpointUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(gateway.endpointUrl, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        const latencyMs = Date.now() - start;
        gateway.status = res.ok ? 'VERIFIED' : 'FAILED';
        gateway.lastTestedAt = new Date().toISOString();
        gateway.lastLatencyMs = latencyMs;
        this.saveToStorage();
        return {
          success: res.ok,
          latencyMs,
          message: `Custom endpoint returned HTTP ${res.status} (${latencyMs}ms).`,
        };
      } catch (err: any) {
        const latencyMs = Date.now() - start;
        gateway.status = 'FAILED';
        this.saveToStorage();
        return { success: false, latencyMs, message: `Custom endpoint error: ${err.message}` };
      }
    }

    return { success: false, latencyMs: 0, message: 'Provider test not supported for this custom gateway.' };
  }

  // =========================================================================
  // RAZORPAY SPECIFIC CONFIGURATION, SECRET MANAGEMENT & LIVE CONNECTION TEST
  // =========================================================================

  private toConnectionStatus(
    envObj: RazorpayEnvConfig,
    hasSecret: boolean
  ): 'VERIFIED' | 'CREDENTIALS_SAVED' | 'CONNECTION_FAILED' | 'NOT_CONFIGURED' {
    if (envObj.status === 'FAILED') return 'CONNECTION_FAILED';
    if (envObj.status === 'VERIFIED' && envObj.keyId && hasSecret) return 'VERIFIED';
    if (envObj.keyId && hasSecret) return 'CREDENTIALS_SAVED';
    return 'NOT_CONFIGURED';
  }

  getPublicConfig(appUrl: string = ''): RazorpayPublicConfig {
    const testSecret = this.getDecryptedSecret('test', 'keySecret');
    const testWebhook = this.getDecryptedSecret('test', 'webhookSecret');
    const liveSecret = this.getDecryptedSecret('live', 'keySecret');
    const liveWebhook = this.getDecryptedSecret('live', 'webhookSecret');

    const cleanBaseUrl = appUrl.replace(/\/+$/, '') || (process.env.APP_URL?.replace(/\/+$/, '') || 'https://thetoriwearstore.in');
    const webhookUrl = `${cleanBaseUrl}/api/v1/payments/razorpay/webhook`;
    const isLiveEnv = this.config.environment === 'live';

    const testConfig: RazorpayEnvPublicView = {
      keyId: this.config.testConfig.keyId || '',
      maskedKeySecret: maskSecret(testSecret),
      hasKeySecret: Boolean(testSecret),
      hasWebhookSecret: Boolean(testWebhook),
      maskedWebhookSecret: maskSecret(testWebhook),
      webhookUrl,
      connectionStatus: this.toConnectionStatus(this.config.testConfig, Boolean(testSecret)),
      lastTestedAt: this.config.testConfig.lastTestedAt,
      lastError: this.config.testConfig.lastErrorMessage,
      lastLatencyMs: this.config.testConfig.lastLatencyMs,
    };

    const liveConfig: RazorpayEnvPublicView = {
      keyId: this.config.liveConfig.keyId || '',
      maskedKeySecret: maskSecret(liveSecret),
      hasKeySecret: Boolean(liveSecret),
      hasWebhookSecret: Boolean(liveWebhook),
      maskedWebhookSecret: maskSecret(liveWebhook),
      webhookUrl,
      connectionStatus: this.toConnectionStatus(this.config.liveConfig, Boolean(liveSecret)),
      lastTestedAt: this.config.liveConfig.lastTestedAt,
      lastError: this.config.liveConfig.lastErrorMessage,
      lastLatencyMs: this.config.liveConfig.lastLatencyMs,
    };

    return {
      enabled: this.config.enabled,
      environment: isLiveEnv ? 'LIVE' : 'TEST',
      testConfig,
      liveConfig,
      activeKeyId: isLiveEnv ? liveConfig.keyId : testConfig.keyId,
      webhookUrl,
    };
  }

  private getDecryptedSecret(env: 'test' | 'live', field: 'keySecret' | 'webhookSecret'): string {
    const envObj = env === 'live' ? this.config.liveConfig : this.config.testConfig;
    const encField = field === 'keySecret' ? envObj.keySecretEncrypted : envObj.webhookSecretEncrypted;
    if (!encField) return '';
    try {
      return decryptSecret(encField);
    } catch {
      return '';
    }
  }

  getActiveCredentials(): {
    enabled: boolean;
    environment: 'test' | 'live';
    keyId: string;
    keySecret: string;
    webhookSecret: string;
  } {
    const env = this.config.environment === 'live' ? 'live' : 'test';
    const target = env === 'live' ? this.config.liveConfig : this.config.testConfig;
    const keyId = target.keyId?.trim() || '';
    const keySecret = this.getDecryptedSecret(env, 'keySecret').trim();
    const webhookSecret = this.getDecryptedSecret(env, 'webhookSecret').trim();

    if (keyId && keySecret) {
      return {
        enabled: this.config.enabled,
        environment: env,
        keyId,
        keySecret,
        webhookSecret,
      };
    }

    // Fallback to default gateway record if configured directly via multi-gateway API
    const def = this.getDefaultGateway();
    if (def && def.provider === 'RAZORPAY' && def.keyId) {
      let gwSecret = '';
      let gwWebhook = '';
      try {
        if (def.keySecretEncrypted) gwSecret = decryptSecret(def.keySecretEncrypted).trim();
        if (def.webhookSecretEncrypted) gwWebhook = decryptSecret(def.webhookSecretEncrypted).trim();
      } catch {}
      if (gwSecret) {
        return {
          enabled: def.isEnabled && this.config.enabled,
          environment: def.environment === 'LIVE' ? 'live' : 'test',
          keyId: def.keyId.trim(),
          keySecret: gwSecret,
          webhookSecret: gwWebhook,
        };
      }
    }

    if (!keyId && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      return {
        enabled: this.config.enabled,
        environment: process.env.RAZORPAY_KEY_ID.startsWith('rzp_live') ? 'live' : 'test',
        keyId: process.env.RAZORPAY_KEY_ID.trim(),
        keySecret: process.env.RAZORPAY_KEY_SECRET.trim(),
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '',
      };
    }

    return {
      enabled: false,
      environment: env,
      keyId,
      keySecret,
      webhookSecret,
    };
  }

  private applyEnvUpdates(
    targetEnv: 'test' | 'live',
    fields: {
      keyId?: string;
      keySecret?: string;
      webhookSecret?: string;
      clearKeySecret?: boolean;
      clearWebhookSecret?: boolean;
    }
  ) {
    const envObj = targetEnv === 'live' ? this.config.liveConfig : this.config.testConfig;

    if (typeof fields.keyId === 'string') {
      const cleanKeyId = fields.keyId.trim();
      if (cleanKeyId && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(cleanKeyId)) {
        throw new Error(`Invalid Razorpay Key ID format for ${targetEnv.toUpperCase()} mode.`);
      }
      if (cleanKeyId !== envObj.keyId) {
        envObj.keyId = cleanKeyId;
        envObj.status = cleanKeyId ? 'CREDENTIALS_SAVED' : 'NOT_CONFIGURED';
        envObj.lastErrorMessage = undefined;
      }
    }

    if (fields.clearKeySecret) {
      envObj.keySecretEncrypted = '';
      envObj.status = 'NOT_CONFIGURED';
    } else if (fields.keySecret !== undefined) {
      const trimmed = fields.keySecret.trim();
      if (trimmed && !trimmed.includes('••••')) {
        envObj.keySecretEncrypted = encryptSecret(trimmed);
        envObj.status = 'CREDENTIALS_SAVED';
        envObj.lastErrorMessage = undefined;
      }
    }

    if (fields.clearWebhookSecret) {
      envObj.webhookSecretEncrypted = '';
    } else if (fields.webhookSecret !== undefined) {
      const trimmed = fields.webhookSecret.trim();
      if (trimmed && !trimmed.includes('••••')) {
        envObj.webhookSecretEncrypted = encryptSecret(trimmed);
      }
    }

    const hasSecret = Boolean(this.getDecryptedSecret(targetEnv, 'keySecret'));
    if (envObj.keyId && hasSecret && envObj.status === 'NOT_CONFIGURED') {
      envObj.status = 'CREDENTIALS_SAVED';
    } else if (!envObj.keyId || !hasSecret) {
      envObj.status = 'NOT_CONFIGURED';
    }
  }

  updateConfig(updates: {
    enabled?: boolean;
    environment?: string;
    targetEnv?: string;
    keyId?: string;
    keySecret?: string;
    webhookSecret?: string;
    clearKeySecret?: boolean;
    clearWebhookSecret?: boolean;
    testConfig?: {
      keyId?: string;
      keySecret?: string;
      webhookSecret?: string;
      clearKeySecret?: boolean;
      clearWebhookSecret?: boolean;
    };
    liveConfig?: {
      keyId?: string;
      keySecret?: string;
      webhookSecret?: string;
      clearKeySecret?: boolean;
      clearWebhookSecret?: boolean;
    };
  }): RazorpayPublicConfig {
    if (typeof updates.enabled === 'boolean') {
      this.config.enabled = updates.enabled;
    }

    if (typeof updates.environment === 'string') {
      const norm = updates.environment.trim().toLowerCase();
      if (norm === 'live' || norm === 'test') {
        this.config.environment = norm;
      }
    }

    if (updates.testConfig && typeof updates.testConfig === 'object') {
      this.applyEnvUpdates('test', updates.testConfig);
    }
    if (updates.liveConfig && typeof updates.liveConfig === 'object') {
      this.applyEnvUpdates('live', updates.liveConfig);
    }

    const hasFlatFields =
      updates.keyId !== undefined ||
      updates.keySecret !== undefined ||
      updates.webhookSecret !== undefined ||
      updates.clearKeySecret ||
      updates.clearWebhookSecret;

    if (hasFlatFields) {
      const normTarget = typeof updates.targetEnv === 'string' && updates.targetEnv.trim().toLowerCase() === 'live'
        ? 'live'
        : (typeof updates.targetEnv === 'string' && updates.targetEnv.trim().toLowerCase() === 'test'
            ? 'test'
            : this.config.environment);
      this.applyEnvUpdates(normTarget, updates);
    }

    const activeEnv = this.config.environment;
    const activeObj = activeEnv === 'live' ? this.config.liveConfig : this.config.testConfig;
    const rzpGateway = this.config.gateways.find((g) => g.id === 'gw-razorpay');
    if (rzpGateway) {
      rzpGateway.keyId = activeObj.keyId;
      rzpGateway.keySecretEncrypted = activeObj.keySecretEncrypted;
      rzpGateway.webhookSecretEncrypted = activeObj.webhookSecretEncrypted;
      rzpGateway.environment = activeEnv === 'live' ? 'LIVE' : 'TEST';
      rzpGateway.status = activeObj.status;
      rzpGateway.isEnabled = this.config.enabled;
      rzpGateway.updatedAt = new Date().toISOString();
    }

    this.saveToStorage();
    return this.getPublicConfig();
  }

  async testConnection(targetEnvInput?: string): Promise<{
    success: boolean;
    latencyMs: number;
    message: string;
    environment: 'TEST' | 'LIVE';
    testedAt: string;
    statusCode?: number;
    errorDetails?: string;
    details?: any;
  }> {
    const normalizedEnv: 'test' | 'live' =
      typeof targetEnvInput === 'string' && targetEnvInput.trim().toLowerCase() === 'live'
        ? 'live'
        : typeof targetEnvInput === 'string' && targetEnvInput.trim().toLowerCase() === 'test'
          ? 'test'
          : this.config.environment;

    const envObj = normalizedEnv === 'live' ? this.config.liveConfig : this.config.testConfig;
    const envLabel: 'TEST' | 'LIVE' = normalizedEnv === 'live' ? 'LIVE' : 'TEST';
    const keyId = envObj.keyId?.trim() || '';
    const keySecret = this.getDecryptedSecret(normalizedEnv, 'keySecret').trim();
    const testedAt = new Date().toISOString();

    if (!keyId || !keySecret) {
      const msg = !keyId
        ? `Razorpay Key ID is not configured for ${envLabel} mode.`
        : `Razorpay Key Secret is not configured for ${envLabel} mode.`;
      envObj.status = 'NOT_CONFIGURED';
      envObj.lastTestedAt = testedAt;
      envObj.lastErrorMessage = msg;
      this.saveToStorage();
      return {
        success: false,
        latencyMs: 0,
        message: msg,
        environment: envLabel,
        testedAt,
      };
    }

    const start = Date.now();
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch('https://api.razorpay.com/v1/orders?count=1', {
        method: 'GET',
        headers: { Authorization: authHeader, Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      const json: any = await res.json().catch(() => ({}));

      envObj.lastTestedAt = testedAt;
      envObj.lastLatencyMs = latencyMs;

      if (res.ok) {
        envObj.status = 'VERIFIED';
        envObj.lastErrorMessage = undefined;
        const rzpGateway = this.config.gateways.find((g) => g.id === 'gw-razorpay');
        if (rzpGateway && this.config.environment === normalizedEnv) {
          rzpGateway.status = 'VERIFIED';
          rzpGateway.lastTestedAt = testedAt;
          rzpGateway.lastLatencyMs = latencyMs;
          rzpGateway.lastErrorMessage = undefined;
        }
        this.saveToStorage();
        return {
          success: true,
          latencyMs,
          message: `Authenticated request to Razorpay ${envLabel} API succeeded (${latencyMs}ms). Verified active orders endpoint.`,
          environment: envLabel,
          testedAt,
          statusCode: res.status,
          details: { mode: envLabel, count: json?.count ?? 0 },
        };
      }

      const errDesc = json?.error?.description || `Razorpay returned HTTP ${res.status}`;
      envObj.status = 'FAILED';
      envObj.lastErrorMessage = errDesc;
      this.saveToStorage();
      return {
        success: false,
        latencyMs,
        message: `Razorpay ${envLabel} authentication failed: ${errDesc}`,
        environment: envLabel,
        testedAt,
        statusCode: res.status,
        errorDetails: json?.error?.code ? `${json.error.code}: ${errDesc}` : errDesc,
        details: json?.error,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const msg = err?.name === 'AbortError' ? 'Connection timed out after 12s.' : err.message || 'Network error';
      envObj.status = 'FAILED';
      envObj.lastTestedAt = testedAt;
      envObj.lastLatencyMs = latencyMs;
      envObj.lastErrorMessage = msg;
      this.saveToStorage();
      return {
        success: false,
        latencyMs,
        message: `Connection error: ${msg}`,
        environment: envLabel,
        testedAt,
        errorDetails: msg,
      };
    }
  }
}

export const paymentConfigService = new PaymentConfigService();
