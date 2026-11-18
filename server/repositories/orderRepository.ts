import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getPrismaClient } from '../db/prisma';
import { resolveSecureStorePath } from '../utils/storageHelper';

const STORE_PATH = resolveSecureStorePath('orders-store.json', 'public/generated-assets/orders-store.json');

export type OrderFulfillmentStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'PACKED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED'
  | 'REFUNDED'
  | 'RETURN_REQUESTED'
  | 'RETURNED';

export type OrderPaymentStatus = 'PENDING' | 'PENDING_PAYMENT' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface OrderAddressRecord {
  fullName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export interface OrderItemRecord {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  image: string;
  discount?: number;
  tax?: number;
}

export interface OrderTimelineRecord {
  status: string;
  timestamp: string;
  description: string;
  actorId?: string;
  actorName?: string;
  note?: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  orderAccessToken?: string;
  idempotencyKey?: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subtotal: number;
  discount: number;
  discountCode?: string;
  tax: number;
  shippingFee: number;
  codFee?: number;
  total: number;
  currency: string;
  paymentMethod: 'UPI' | 'CARD' | 'NET_BANKING' | 'WALLET' | 'COD' | string;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  shippingAddress: OrderAddressRecord;
  items: OrderItemRecord[];
  courierPartner?: string;
  courierTrackingNumber?: string;
  awbNumber?: string;
  cancellationReason?: string;
  cancelledAt?: Date;
  refundStatus?: string;
  refundAmount?: number;
  estimatedDeliveryDate?: string;
  deliveryNotes?: string;
  ipAddress?: string;
  timeline: OrderTimelineRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export class OrderRepository {
  private fallbackOrders = new Map<string, OrderRecord>();
  private initialized = false;
  private lastMtime = 0;

  constructor() {
    this.ensureLoaded();
  }

  public reloadFromDisk() {
    this.ensureLoaded(true);
  }

  private ensureLoaded(force = false) {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const stat = fs.statSync(STORE_PATH);
        if (!force && this.initialized && stat.mtimeMs <= this.lastMtime) {
          return;
        }
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.fallbackOrders.clear();
          for (const item of parsed) {
            const rec: OrderRecord = {
              ...item,
              createdAt: new Date(item.createdAt || Date.now()),
              updatedAt: new Date(item.updatedAt || Date.now()),
              cancelledAt: item.cancelledAt ? new Date(item.cancelledAt) : undefined,
            };
            this.fallbackOrders.set(rec.id, rec);
          }
          this.lastMtime = stat.mtimeMs;
          this.initialized = true;
          return;
        }
      }
    } catch (err) {
      console.warn('[ORDER_REPO] Could not load orders store file:', err);
    }

    if (!this.initialized) {
      this.fallbackOrders.clear();
      this.saveToDisk();
      this.initialized = true;
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Array.from(this.fallbackOrders.values());
      const tempPath = `${STORE_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, STORE_PATH);
      try {
        this.lastMtime = fs.statSync(STORE_PATH).mtimeMs;
      } catch {}
    } catch (err) {
      console.error('[ORDER_REPO] Failed to persist orders to disk:', err);
    }
  }

  async findById(id: string): Promise<OrderRecord | null> {
    this.ensureLoaded();
    const prisma = getPrismaClient();
    if (prisma?.order) {
      try {
        const found = await prisma.order.findUnique({
          where: { id },
          include: { items: true, addresses: true, statusHistory: true },
        });
        if (found) {
          return this.mapPrismaToRecord(found);
        }
      } catch (err) {
        console.warn('[ORDER_REPO] Prisma findById failed, falling back to memory:', err);
      }
    }
    return this.fallbackOrders.get(id) || null;
  }

  async findByOrderNumber(orderNumber: string): Promise<OrderRecord | null> {
    this.ensureLoaded();
    const cleanNumber = orderNumber.trim().toUpperCase().replace(/^#/, '');
    const prisma = getPrismaClient();
    if (prisma?.order) {
      try {
        const found = await prisma.order.findFirst({
          where: {
            OR: [
              { orderNumber: cleanNumber },
              { orderNumber: `#${cleanNumber}` },
            ],
          },
          include: { items: true, addresses: true, statusHistory: true },
        });
        if (found) {
          return this.mapPrismaToRecord(found);
        }
      } catch (err) {
        console.warn('[ORDER_REPO] Prisma findByOrderNumber failed, falling back:', err);
      }
    }

    for (const order of this.fallbackOrders.values()) {
      const storedClean = order.orderNumber.toUpperCase().replace(/^#/, '');
      if (storedClean === cleanNumber || order.id.toUpperCase() === cleanNumber) {
        return order;
      }
    }
    return null;
  }

  async findByIdempotencyKey(key: string): Promise<OrderRecord | null> {
    this.ensureLoaded();
    if (!key) return null;
    const cleanKey = key.trim();
    const prisma = getPrismaClient();
    if (prisma?.order) {
      try {
        const found = await prisma.order.findUnique({
          where: { idempotencyKey: cleanKey },
          include: { items: true, addresses: true, statusHistory: true },
        });
        if (found) {
          return this.mapPrismaToRecord(found);
        }
      } catch {}
    }
    for (const order of this.fallbackOrders.values()) {
      if (order.idempotencyKey && order.idempotencyKey.trim() === cleanKey) {
        return order;
      }
    }
    return null;
  }

  async create(order: OrderRecord): Promise<OrderRecord> {
    this.fallbackOrders.set(order.id, order);
    this.saveToDisk();

    const prisma = getPrismaClient();
    if (prisma?.order) {
      try {
        let validCustomerId: string | null = null;
        if (order.customerId) {
          const cust = await prisma.customer.findUnique({ where: { id: order.customerId } });
          if (cust) {
            validCustomerId = cust.id;
          } else {
            try {
              const newCust = await prisma.customer.create({
                data: {
                  id: order.customerId,
                  name: order.customerName,
                  email: order.customerEmail,
                  phone: order.customerPhone,
                  isGuest: true,
                  status: 'ACTIVE',
                },
              });
              validCustomerId = newCust.id;
            } catch {
              validCustomerId = null;
            }
          }
        }

        const itemsToCreate = [];
        for (const it of order.items) {
          let validVariantId: string | null = null;
          if (it.variantId) {
            const variantExists = await prisma.productVariant.findUnique({ where: { id: it.variantId } });
            if (variantExists) {
              validVariantId = variantExists.id;
            } else if (it.sku) {
              const bySku = await prisma.productVariant.findUnique({ where: { sku: it.sku } });
              if (bySku) {
                validVariantId = bySku.id;
              }
            }
          }

          let validProductId = it.productId;
          const prodExists = await prisma.product.findUnique({ where: { id: it.productId } });
          if (!prodExists) {
            const firstProd = await prisma.product.findFirst();
            if (firstProd) {
              validProductId = firstProd.id;
            }
          }

          itemsToCreate.push({
            id: it.id || `item-${crypto.randomBytes(8).toString('hex')}`,
            productId: validProductId,
            variantId: validVariantId,
            productName: it.productName,
            productSku: it.sku || `SKU-${it.variantId || validProductId}`,
            size: it.size || 'M',
            color: it.color || 'Void Black',
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice,
            totalPrice: it.totalPrice,
            image: typeof it.image === 'string' ? it.image : ((it.image as any)?.url || ''),
          });
        }

        await prisma.order.create({
          data: {
            id: order.id,
            orderNumber: order.orderNumber,
            customerId: validCustomerId,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            customerPhone: order.customerPhone,
            subtotal: order.subtotal,
            discount: order.discount,
            discountCode: order.discountCode,
            tax: order.tax,
            shippingFee: order.shippingFee,
            total: order.total,
            currency: order.currency || 'INR',
            paymentMethod: order.paymentMethod.toLowerCase(),
            paymentStatus: (order.paymentStatus === 'PENDING_PAYMENT' ? 'PENDING' : order.paymentStatus) as any,
            shippingStatus: (order.fulfillmentStatus === 'PENDING_PAYMENT' ? 'CONFIRMED' : order.fulfillmentStatus) as any,
            courierPartner: order.courierPartner,
            courierTrackingNumber: order.courierTrackingNumber,
            awbNumber: order.awbNumber,
            orderAccessToken: order.orderAccessToken,
            idempotencyKey: order.idempotencyKey || null,
            cancellationReason: order.cancellationReason,
            cancelledAt: order.cancelledAt,
            refundStatus: order.refundStatus,
            refundAmount: order.refundAmount,
            items: {
              create: itemsToCreate,
            },
            addresses: {
              create: {
                fullName: order.shippingAddress.fullName,
                phone: order.shippingAddress.phone,
                email: order.shippingAddress.email,
                addressLine1: order.shippingAddress.addressLine1,
                addressLine2: order.shippingAddress.addressLine2,
                city: order.shippingAddress.city,
                state: order.shippingAddress.state,
                pincode: order.shippingAddress.pincode,
                country: order.shippingAddress.country || 'India',
              },
            },
            statusHistory: {
              create: order.timeline.map((tl) => ({
                toStatus: (order.fulfillmentStatus === 'PENDING_PAYMENT' ? 'CONFIRMED' : order.fulfillmentStatus) as any,
                note: tl.description,
                timestamp: new Date(tl.timestamp),
              })),
            },
          },
        });
      } catch (err) {
        console.warn('[ORDER_REPO] Failed to persist order to Prisma, fallback active:', err);
      }
    }

    return order;
  }

  async update(id: string, updates: Partial<OrderRecord>): Promise<OrderRecord | null> {
    this.ensureLoaded();
    const existing = this.fallbackOrders.get(id);
    if (!existing) return null;
    const merged: OrderRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.fallbackOrders.set(id, merged);
    this.saveToDisk();

    const prisma = getPrismaClient();
    if (prisma?.order) {
      try {
        const existingInPrisma = await prisma.order.findUnique({ where: { id } });
        if (!existingInPrisma) {
          // If not in Prisma yet, create it first
          await this.create(merged);
        } else {
          await prisma.order.update({
            where: { id },
            data: {
              paymentStatus: (merged.paymentStatus === 'PENDING_PAYMENT' ? 'PENDING' : merged.paymentStatus) as any,
              shippingStatus: (merged.fulfillmentStatus === 'PENDING_PAYMENT' ? 'CONFIRMED' : (merged.fulfillmentStatus === 'REFUNDED' ? 'RETURNED' : merged.fulfillmentStatus)) as any,
              courierPartner: merged.courierPartner,
              courierTrackingNumber: merged.courierTrackingNumber,
              awbNumber: merged.awbNumber,
              orderAccessToken: merged.orderAccessToken,
              cancellationReason: merged.cancellationReason,
              cancelledAt: merged.cancelledAt,
              refundStatus: merged.refundStatus,
              refundAmount: merged.refundAmount,
            },
          });

          if (updates.timeline && updates.timeline.length > existing.timeline.length && prisma.orderStatusHistory) {
            const addedEntries = updates.timeline.slice(existing.timeline.length);
            for (const entry of addedEntries) {
              await prisma.orderStatusHistory.create({
                data: {
                  orderId: id,
                  fromStatus: existing.fulfillmentStatus as any,
                  toStatus: (merged.fulfillmentStatus === 'PENDING_PAYMENT' ? 'CONFIRMED' : (merged.fulfillmentStatus === 'REFUNDED' ? 'RETURNED' : merged.fulfillmentStatus)) as any,
                  changedBy: entry.actorName || entry.actorId || undefined,
                  note: entry.note || entry.description,
                  timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
                },
              });
            }
          }
        }
      } catch (err) {
        console.warn('[ORDER_REPO] Failed to update order in Prisma:', err);
      }
    }

    return merged;
  }

  async getAll(filter?: { customerId?: string; status?: string; search?: string }): Promise<OrderRecord[]> {
    this.ensureLoaded();
    let list: OrderRecord[] = [];

    const prisma = getPrismaClient();
    if (prisma?.order) {
      try {
        const rows = await prisma.order.findMany({
          include: { items: true, addresses: true, statusHistory: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        if (rows.length > 0) {
          list = rows.map((r: any) => this.mapPrismaToRecord(r));
        }
      } catch (err) {
        console.warn('[ORDER_REPO] Prisma getAll failed, using disk store:', err);
      }
    }

    if (list.length === 0) {
      list = Array.from(this.fallbackOrders.values());
    }

    if (filter?.customerId) {
      list = list.filter((o) => o.customerId === filter.customerId);
    }
    if (filter?.status) {
      const st = filter.status.toUpperCase();
      list = list.filter((o) => o.fulfillmentStatus === st || o.paymentStatus === st);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerEmail.toLowerCase().includes(q) ||
          o.customerPhone.includes(q) ||
          (o.courierTrackingNumber && o.courierTrackingNumber.toLowerCase().includes(q)) ||
          (o.awbNumber && o.awbNumber.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private mapPrismaToRecord(prismaOrder: any): OrderRecord {
    const fallbackOrder = this.fallbackOrders.get(prismaOrder.id);
    return {
      id: prismaOrder.id,
      orderNumber: prismaOrder.orderNumber,
      orderAccessToken: prismaOrder.orderAccessToken || fallbackOrder?.orderAccessToken,
      idempotencyKey: prismaOrder.idempotencyKey || fallbackOrder?.idempotencyKey,
      refundStatus: prismaOrder.refundStatus || fallbackOrder?.refundStatus || (prismaOrder.paymentStatus === 'REFUNDED' ? 'REFUND_COMPLETED' : undefined),
      refundAmount: prismaOrder.refundAmount ?? fallbackOrder?.refundAmount,
      customerId: prismaOrder.customerId || undefined,
      customerName: prismaOrder.customerName,
      customerEmail: prismaOrder.customerEmail,
      customerPhone: prismaOrder.customerPhone,
      subtotal: prismaOrder.subtotal,
      discount: prismaOrder.discount,
      discountCode: prismaOrder.discountCode || undefined,
      tax: prismaOrder.tax,
      shippingFee: prismaOrder.shippingFee,
      total: prismaOrder.total,
      currency: prismaOrder.currency || 'INR',
      paymentMethod: prismaOrder.paymentMethod.toUpperCase(),
      paymentStatus: prismaOrder.paymentStatus,
      fulfillmentStatus: prismaOrder.shippingStatus,
      shippingAddress: prismaOrder.addresses?.[0]
        ? {
            fullName: prismaOrder.addresses[0].fullName,
            phone: prismaOrder.addresses[0].phone,
            email: prismaOrder.addresses[0].email || '',
            addressLine1: prismaOrder.addresses[0].addressLine1,
            addressLine2: prismaOrder.addresses[0].addressLine2 || '',
            city: prismaOrder.addresses[0].city,
            state: prismaOrder.addresses[0].state,
            pincode: prismaOrder.addresses[0].pincode,
            country: prismaOrder.addresses[0].country || 'India',
          }
        : {
            fullName: prismaOrder.customerName,
            phone: prismaOrder.customerPhone,
            email: prismaOrder.customerEmail,
            addressLine1: '',
            city: '',
            state: '',
            pincode: '',
          },
      items: (prismaOrder.items || []).map((it: any, idx: number) => {
        const originalItem = fallbackOrder?.items?.[idx];
        return {
          id: it.id,
          productId: it.productId,
          productName: it.productName,
          variantId: originalItem?.variantId || it.variantId || '',
          sku: it.productSku,
          size: it.size,
          color: it.color,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          totalPrice: it.totalPrice,
          image: it.image || '',
          discount: it.discount,
          tax: it.tax,
        };
      }),
      courierPartner: prismaOrder.courierPartner || undefined,
      courierTrackingNumber: prismaOrder.courierTrackingNumber || undefined,
      awbNumber: prismaOrder.awbNumber || fallbackOrder?.awbNumber,
      cancellationReason: prismaOrder.cancellationReason || undefined,
      cancelledAt: prismaOrder.cancelledAt || undefined,
      timeline: (prismaOrder.statusHistory || []).map((h: any) => ({
        status: h.toStatus,
        timestamp: h.timestamp ? new Date(h.timestamp).toISOString() : new Date().toISOString(),
        description: h.note || `Status: ${h.toStatus}`,
      })),
      createdAt: new Date(prismaOrder.createdAt),
      updatedAt: new Date(prismaOrder.updatedAt),
    };
  }
}

export const orderRepository = new OrderRepository();
