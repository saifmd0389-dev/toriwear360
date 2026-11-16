import { getPrismaClient } from '../db/prisma';

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

export class CustomerRepository {
  private customers = new Map<string, CustomerRecord>();

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
          return rec;
        }
      } catch (err) {
        console.warn('[CustomerRepo] Prisma findById warning:', err);
      }
    }
    return this.customers.get(id) || null;
  }

  async findByFirebaseUid(uid: string): Promise<CustomerRecord | null> {
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
    const clean = identifier.trim().toLowerCase();
    if (!clean) return null;
    const prisma = getPrismaClient();
    if (prisma?.customer) {
      try {
        const found = await prisma.customer.findFirst({
          where: {
            OR: [
              { email: { equals: clean, mode: 'insensitive' } },
              { phone: clean },
            ],
          },
          include: { addresses: true },
        });
        if (found) {
          const rec = this.mapPrismaCustomer(found);
          this.customers.set(rec.id, rec);
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
    this.customers.set(customer.id, customer);
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
        return mapped;
      } catch (err) {
        console.warn('[CustomerRepo] Prisma save warning:', err);
      }
    }
    return customer;
  }

  async getAll(): Promise<CustomerRecord[]> {
    const prisma = getPrismaClient();
    if (prisma?.customer) {
      try {
        const rows = await prisma.customer.findMany({
          include: { addresses: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        const mapped = rows.map((r: any) => this.mapPrismaCustomer(r));
        mapped.forEach((m: CustomerRecord) => this.customers.set(m.id, m));
        return mapped;
      } catch (err) {
        console.warn('[CustomerRepo] Prisma getAll warning:', err);
      }
    }
    return Array.from(this.customers.values());
  }
}

export const customerRepository = new CustomerRepository();
