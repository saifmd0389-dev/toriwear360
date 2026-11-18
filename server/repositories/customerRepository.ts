import fs from 'fs';
import path from 'path';
import { getPrismaClient } from '../db/prisma';
import { resolveSecureStorePath } from '../utils/storageHelper';

const CUSTOMERS_STORE_PATH = resolveSecureStorePath('customers-store.json');
const SESSIONS_STORE_PATH = resolveSecureStorePath('customer-sessions.json');

export interface CustomerAddressRecord {
  id: string;
  customerId: string;
  fullName: string;
  phone: string;
  pincode: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  addressType: 'HOME' | 'WORK' | 'OTHER';
  isDefault: boolean;
}

export interface CustomerRecord {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  avatarUrl?: string;
  firebaseUid?: string;
  isGuest: boolean;
  status: 'ACTIVE' | 'SUSPENDED';
  toriCredit: number;
  insiderTier: string;
  insiderPoints: number;
  addresses: CustomerAddressRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerSessionRecord {
  token: string;
  customerId: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: string;
  isValid: boolean;
  lastActiveAt: string;
  createdAt: string;
}

export class CustomerRepository {
  private customers = new Map<string, CustomerRecord>();
  private sessions = new Map<string, CustomerSessionRecord>();
  private loaded = false;

  constructor() {
    this.ensureLoaded();
  }

  private ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (fs.existsSync(CUSTOMERS_STORE_PATH)) {
        const parsed = JSON.parse(fs.readFileSync(CUSTOMERS_STORE_PATH, 'utf-8'));
        if (Array.isArray(parsed)) {
          for (const c of parsed) {
            if (c?.id) {
              this.customers.set(c.id, {
                ...c,
                createdAt: new Date(c.createdAt || Date.now()),
                updatedAt: new Date(c.updatedAt || Date.now()),
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('[CustomerRepo] Failed to load customers store:', err);
    }

    try {
      if (fs.existsSync(SESSIONS_STORE_PATH)) {
        const parsed = JSON.parse(fs.readFileSync(SESSIONS_STORE_PATH, 'utf-8'));
        if (Array.isArray(parsed)) {
          for (const s of parsed) {
            if (s?.token && s?.isValid !== false) {
              this.sessions.set(s.token, s);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[CustomerRepo] Failed to load customer sessions store:', err);
    }
  }

  private persistCustomersToDisk() {
    try {
      const dir = path.dirname(CUSTOMERS_STORE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tmp = `${CUSTOMERS_STORE_PATH}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(Array.from(this.customers.values()), null, 2), 'utf-8');
      fs.renameSync(tmp, CUSTOMERS_STORE_PATH);
    } catch (err) {
      console.warn('[CustomerRepo] Failed to save customers store:', err);
    }
  }

  private persistSessionsToDisk() {
    try {
      const now = Date.now();
      const active = Array.from(this.sessions.values()).filter(
        (s) => s.isValid && new Date(s.expiresAt).getTime() > now
      );
      const dir = path.dirname(SESSIONS_STORE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tmp = `${SESSIONS_STORE_PATH}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(active, null, 2), 'utf-8');
      fs.renameSync(tmp, SESSIONS_STORE_PATH);
    } catch (err) {
      console.warn('[CustomerRepo] Failed to save customer sessions store:', err);
    }
  }

  async saveSession(session: CustomerSessionRecord): Promise<void> {
    this.ensureLoaded();
    this.sessions.set(session.token, session);
    this.persistSessionsToDisk();

    const prisma = getPrismaClient();
    if (prisma?.session) {
      try {
        await prisma.session.create({
          data: {
            token: session.token,
            customerId: session.customerId,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            expiresAt: new Date(session.expiresAt),
            isValid: true,
          },
        });
      } catch (err) {
        console.warn('[CustomerRepo] Prisma saveSession note:', (err as any)?.message || err);
      }
    }
  }

  async findCustomerBySessionToken(token: string): Promise<CustomerRecord | null> {
    this.ensureLoaded();
    if (!token) return null;

    const prisma = getPrismaClient();
    if (prisma?.session) {
      try {
        const sess = await prisma.session.findUnique({
          where: { token },
          include: { customer: { include: { addresses: true } } },
        });
        if (sess && sess.isValid && sess.customerId && sess.customer) {
          if (new Date(sess.expiresAt) < new Date()) {
            await prisma.session.update({ where: { id: sess.id }, data: { isValid: false } }).catch(() => {});
            this.sessions.delete(token);
            this.persistSessionsToDisk();
            return null;
          }
          if (sess.customer.status === 'SUSPENDED') return null;
          await prisma.session.update({ where: { id: sess.id }, data: { lastActiveAt: new Date() } }).catch(() => {});
          return await this.findById(sess.customerId);
        }
      } catch {}
    }

    const diskSession = this.sessions.get(token);
    if (!diskSession || !diskSession.isValid) return null;
    if (new Date(diskSession.expiresAt) < new Date()) {
      this.sessions.delete(token);
      this.persistSessionsToDisk();
      return null;
    }
    const cust = await this.findById(diskSession.customerId);
    if (!cust || cust.status === 'SUSPENDED') return null;
    diskSession.lastActiveAt = new Date().toISOString();
    return cust;
  }

  async revokeSession(token: string): Promise<void> {
    this.ensureLoaded();
    if (!token) return;
    if (this.sessions.delete(token)) {
      this.persistSessionsToDisk();
    }
    const prisma = getPrismaClient();
    if (prisma?.session) {
      await prisma.session.updateMany({ where: { token }, data: { isValid: false } }).catch(() => {});
    }
  }

  private mapPrismaCustomer(c: any): CustomerRecord {
    return {
      id: c.id,
      email: c.email || undefined,
      phone: c.phone || undefined,
      name: c.name || undefined,
      avatarUrl: c.avatarUrl || undefined,
      firebaseUid: c.firebaseUid || undefined,
      isGuest: Boolean(c.isGuest),
      status: c.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
      toriCredit: Number(c.toriCredit) || 0,
      insiderTier: c.insiderTier || 'Bronze',
      insiderPoints: Number(c.insiderPoints) || 0,
      addresses: Array.isArray(c.addresses)
        ? c.addresses.map((a: any) => ({
            id: a.id,
            customerId: a.customerId,
            fullName: a.fullName,
            phone: a.phone,
            pincode: a.pincode,
            addressLine1: a.addressLine1,
            addressLine2: a.addressLine2 || undefined,
            city: a.city,
            state: a.state,
            addressType: ((a.label || a.type || 'HOME').toUpperCase() === 'WORK' ? 'WORK' : (a.label || a.type || 'HOME').toUpperCase() === 'OTHER' ? 'OTHER' : 'HOME') as 'HOME' | 'WORK' | 'OTHER',
            isDefault: Boolean(a.isDefault),
          }))
        : [],
      createdAt: new Date(c.createdAt || Date.now()),
      updatedAt: new Date(c.updatedAt || Date.now()),
    };
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    this.ensureLoaded();
    const prisma = getPrismaClient();
    if (prisma?.customer) {
      try {
        const found = await prisma.customer.findUnique({
          where: { id },
          include: { addresses: true },
        });
        if (found) {
          const rec = this.mapPrismaCustomer(found);
          this.customers.set(rec.id, rec);
          this.persistCustomersToDisk();
          return rec;
        }
      } catch (err) {
        console.warn('[CustomerRepo] Prisma findById warning:', err);
      }
    }
    return this.customers.get(id) || null;
  }

  async findByFirebaseUid(uid: string): Promise<CustomerRecord | null> {
    this.ensureLoaded();
    if (!uid) return null;
    const prisma = getPrismaClient();
    if (prisma?.customer) {
      try {
        const found = await prisma.customer.findUnique({
          where: { firebaseUid: uid },
          include: { addresses: true },
        });
        if (found) {
          const rec = this.mapPrismaCustomer(found);
          this.customers.set(rec.id, rec);
          return rec;
        }
      } catch (err) {
        console.warn('[CustomerRepo] Prisma findByFirebaseUid warning:', err);
      }
    }
    for (const c of this.customers.values()) {
      if (c.firebaseUid === uid) return c;
    }
    return null;
  }

  async findByEmailOrPhone(identifier: string): Promise<CustomerRecord | null> {
    this.ensureLoaded();
    const clean = identifier.trim().toLowerCase();
    if (!clean) return null;
    const prisma = getPrismaClient();
    if (prisma?.customer) {
      try {
        const found = await prisma.customer.findFirst({
          where: {
            OR: [
              { email: clean },
              { phone: clean },
            ],
          },
          include: { addresses: true },
        });
        if (found) {
          const rec = this.mapPrismaCustomer(found);
          this.customers.set(rec.id, rec);
          this.persistCustomersToDisk();
          return rec;
        }
      } catch (err) {
        console.warn('[CustomerRepo] Prisma findByEmailOrPhone warning:', err);
      }
    }
    for (const c of this.customers.values()) {
      if (c.email?.toLowerCase() === clean || c.phone === clean) return c;
    }
    return null;
  }

  async save(customer: CustomerRecord): Promise<CustomerRecord> {
    this.ensureLoaded();
    this.customers.set(customer.id, customer);
    this.persistCustomersToDisk();
    const prisma = getPrismaClient();
    if (prisma?.customer) {
      try {
        const cleanEmail = customer.email ? customer.email.trim().toLowerCase() : null;
        const cleanPhone = customer.phone ? customer.phone.trim() : null;
        const saved = await prisma.customer.upsert({
          where: { id: customer.id },
          create: {
            id: customer.id,
            email: cleanEmail,
            phone: cleanPhone,
            name: customer.name || null,
            avatarUrl: customer.avatarUrl || null,
            firebaseUid: customer.firebaseUid || null,
            isGuest: Boolean(customer.isGuest),
            status: customer.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
            toriCredit: Number(customer.toriCredit) || 0,
            insiderTier: customer.insiderTier || 'Bronze',
            insiderPoints: Number(customer.insiderPoints) || 0,
          },
          update: {
            email: cleanEmail,
            phone: cleanPhone,
            name: customer.name || null,
            avatarUrl: customer.avatarUrl || null,
            firebaseUid: customer.firebaseUid || null,
            isGuest: Boolean(customer.isGuest),
            status: customer.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
            toriCredit: Number(customer.toriCredit) || 0,
            insiderTier: customer.insiderTier || 'Bronze',
            insiderPoints: Number(customer.insiderPoints) || 0,
          },
          include: { addresses: true },
        });

        if (Array.isArray(customer.addresses) && customer.addresses.length > 0 && prisma.customerAddress) {
          for (const addr of customer.addresses) {
            await prisma.customerAddress.upsert({
              where: { id: addr.id },
              create: {
                id: addr.id,
                customerId: saved.id,
                fullName: addr.fullName,
                phone: addr.phone,
                pincode: addr.pincode,
                addressLine1: addr.addressLine1,
                addressLine2: addr.addressLine2 || null,
                city: addr.city,
                state: addr.state,
                type: 'SHIPPING',
                label: addr.addressType || 'HOME',
                isDefault: Boolean(addr.isDefault),
              },
              update: {
                fullName: addr.fullName,
                phone: addr.phone,
                pincode: addr.pincode,
                addressLine1: addr.addressLine1,
                addressLine2: addr.addressLine2 || null,
                city: addr.city,
                state: addr.state,
                label: addr.addressType || 'HOME',
                isDefault: Boolean(addr.isDefault),
              },
            }).catch(() => {});
          }
        }

        const mapped = this.mapPrismaCustomer(saved);
        mapped.addresses = customer.addresses || mapped.addresses;
        this.customers.set(mapped.id, mapped);
        this.persistCustomersToDisk();
        return mapped;
      } catch (err) {
        console.warn('[CustomerRepo] Prisma save warning:', err);
      }
    }
    return customer;
  }

  async getAll(): Promise<CustomerRecord[]> {
    this.ensureLoaded();
    const prisma = getPrismaClient();
    if (prisma?.customer) {
      try {
        const rows = await prisma.customer.findMany({
          include: { addresses: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        if (rows.length > 0) {
          const mapped = rows.map((r: any) => this.mapPrismaCustomer(r));
          mapped.forEach((m: CustomerRecord) => this.customers.set(m.id, m));
          this.persistCustomersToDisk();
          return mapped;
        }
      } catch (err) {
        console.warn('[CustomerRepo] Prisma getAll warning:', err);
      }
    }
    return Array.from(this.customers.values());
  }
}

export const customerRepository = new CustomerRepository();
