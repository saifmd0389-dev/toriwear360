import crypto from 'crypto';
import {
  orderRepository,
  OrderRecord,
  OrderItemRecord,
  OrderAddressRecord,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderTimelineRecord,
} from '../repositories/orderRepository';
import { couponRepository } from '../repositories/couponRepository';
import { inventoryRepository } from '../repositories/inventoryRepository';
import { productRepository } from '../repositories/productRepository';
import { financeRepository } from '../repositories/financeRepository';
import { auditRepository } from '../repositories/auditRepository';
import { withTransaction } from '../../database/transactions';
import { dispatchOrderNotificationSafe } from './notifications/orderNotificationService';
import { normalizeOrderPhoneToE164 } from './notifications/orderWhatsAppTemplates';

export interface CreateOrderItemInput {
  productId: string;
  variantId?: string;
  size: string;
  color?: string;
  quantity: number;
}

export interface CreateOrderInput {
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: OrderAddressRecord;
  items: CreateOrderItemInput[];
  couponCode?: string;
  paymentMethod: 'UPI' | 'CARD' | 'NET_BANKING' | 'WALLET' | 'COD' | string;
  deliveryNotes?: string;
  whatsappOptIn?: boolean;
  idempotencyKey?: string;
}

export interface CalculateQuoteInput {
  items: Array<{
    productId: string;
    variantId?: string;
    size?: string;
    color?: string;
    quantity: number;
  }>;
  couponCode?: string;
  shippingPincode?: string;
  state?: string;
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface VerifiedQuoteItem {
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  image: string;
  inStock: boolean;
  availableStock: number;
}

export interface OrderQuote {
  subtotal: number;
  discount: number;
  discountCode?: string;
  shippingFee: number;
  tax: number;
  taxBreakdown: {
    cgst: number;
    sgst: number;
    igst: number;
    rate: number;
  };
  total: number;
  freeShippingThreshold: number;
  amountNeededForFreeShipping: number;
  items: VerifiedQuoteItem[];
  canProceed: boolean;
  warnings?: string[];
}

export const ORDER_ALLOWED_TRANSITIONS: Record<OrderFulfillmentStatus, OrderFulfillmentStatus[]> = {
  PENDING_PAYMENT: ['PAYMENT_PENDING', 'PAID', 'CANCELLED', 'FAILED'],
  PAYMENT_PENDING: ['PAID', 'CANCELLED', 'FAILED'],
  PAID: ['CONFIRMED', 'CANCELLED', 'REFUNDED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED', 'RETURN_REQUESTED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'RETURN_REQUESTED'],
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED', 'REFUNDED', 'DELIVERED'],
  CANCELLED: [],
  FAILED: [],
  REFUNDED: [],
  RETURNED: ['REFUNDED'],
};

export class OrderService {
  private orderLocks = new Map<string, Promise<void>>();

  private async acquireOrderLock(orderId: string): Promise<() => void> {
    while (this.orderLocks.has(orderId)) {
      await this.orderLocks.get(orderId);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.orderLocks.set(orderId, lockPromise);
    return () => {
      this.orderLocks.delete(orderId);
      resolveLock();
    };
  }
  /**
   * Generates a collision-safe, human-readable order number.
   * Format: TORI-YYYYMMDD-XXXX (e.g. TORI-20261008-8K42)
   */
  async generateOrderNumber(): Promise<string> {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `TORI-${yyyy}${mm}${dd}`;

    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    for (let attempts = 0; attempts < 10; attempts++) {
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const candidate = `${datePrefix}-${code}`;
      const existing = await orderRepository.findByOrderNumber(candidate);
      if (!existing) {
        return candidate;
      }
    }

    return `${datePrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  /**
   * Centralized server-authoritative order pricing calculation.
   * Never trusts prices or subtotals sent by the browser.
   */
  async calculateQuote(input: CalculateQuoteInput): Promise<{ success: boolean; quote?: OrderQuote; error?: string }> {
    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      return { success: false, error: 'At least one item is required to calculate pricing.' };
    }

    const verifiedItems: VerifiedQuoteItem[] = [];
    const warnings: string[] = [];
    let subtotal = 0;
    let canProceed = true;

    const quoteProductsMeta: Array<{
      productId: string;
      category?: string;
      world?: string;
      department?: string;
      lineTotal: number;
    }> = [];

    for (const reqItem of input.items) {
      const product = await productRepository.findById(reqItem.productId);
      if (!product) {
        return { success: false, error: `Product ID "${reqItem.productId}" not found in catalog.` };
      }

      let variant = (product.variants || []).find((v: any) => {
        if (reqItem.variantId && (v.id === reqItem.variantId || v.sku === reqItem.variantId)) {
          return true;
        }
        return false;
      });

      if (!variant) {
        variant = (product.variants || []).find((v: any) => {
          const vColor = v.colorName || v.color;
          if (reqItem.size && v.size === reqItem.size) {
            if (!reqItem.color || vColor?.toLowerCase() === reqItem.color.toLowerCase()) return true;
          }
          return false;
        });
      }

      if (!variant) {
        variant = product.variants && product.variants[0];
      }

      if (!variant) {
        return { success: false, error: `Size/variant "${reqItem.size || reqItem.variantId}" not found for product "${product.name}".` };
      }

      // Check authoritative stock from Inventory repository
      const invRecord = await inventoryRepository.getByVariantId(variant.id);
      const variantStock = invRecord ? (invRecord.quantityAvailable ?? invRecord.quantityOnHand) : variant.stock;
      const inStock = variantStock >= reqItem.quantity && reqItem.quantity > 0;

      if (!inStock) {
        canProceed = false;
        warnings.push(`Only ${variantStock} unit(s) available for "${product.name}" (${variant.size}).`);
      }

      const unitPrice = variant.price || product.price;
      const itemSubtotal = unitPrice * reqItem.quantity;
      subtotal += itemSubtotal;

      quoteProductsMeta.push({
        productId: product.id,
        category: product.categoryId || product.franchise,
        world: product.world,
        department: product.department,
        lineTotal: itemSubtotal,
      });

      verifiedItems.push({
        productId: product.id,
        productName: product.name,
        variantId: reqItem.variantId || variant.id,
        sku: variant.sku,
        size: variant.size,
        color: (variant as any).color || reqItem.color || 'Void Black',
        quantity: reqItem.quantity,
        unitPrice,
        totalPrice: itemSubtotal,
        image: product.images?.[0] || '',
        inStock,
        availableStock: variantStock,
      });
    }

    // Coupon discount calculation (strictly on eligible merchandise subtotal; never discounts shipping or tax)
    let discount = 0;
    let appliedCoupon: string | undefined = undefined;

    if (input.couponCode) {
      const validation = await couponRepository.validateWithContext({
        code: input.couponCode,
        subtotal,
        items: quoteProductsMeta,
        customerId: input.customerId,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
      });
      if (validation.valid && validation.coupon) {
        discount = Math.min(validation.discount, subtotal);
        appliedCoupon = validation.coupon.code;
      } else {
        warnings.push(validation.reason || `Invalid promo code "${input.couponCode}".`);
      }
    }

    // Free delivery threshold: ₹999 (never discounted by coupon)
    const freeShippingThreshold = 999;
    const netSubtotal = Math.max(0, subtotal - discount);
    const shippingFee = netSubtotal >= freeShippingThreshold || subtotal === 0 ? 0 : 79;
    const amountNeededForFreeShipping = Math.max(0, freeShippingThreshold - netSubtotal);

    // GST Calculation: 5% apparel tax included in net merchandise price
    const taxTotal = Math.round(netSubtotal * 0.05);
    const isInterState = input.state && input.state.toLowerCase() !== 'maharashtra';
    const taxBreakdown = !isInterState
      ? {
          cgst: Math.round(taxTotal / 2),
          sgst: taxTotal - Math.round(taxTotal / 2),
          igst: 0,
          rate: 0.05,
        }
      : {
          cgst: 0,
          sgst: 0,
          igst: taxTotal,
          rate: 0.05,
        };

    const total = netSubtotal + shippingFee;

    return {
      success: true,
      quote: {
        subtotal,
        discount,
        discountCode: appliedCoupon,
        shippingFee,
        tax: taxTotal,
        taxBreakdown,
        total,
        freeShippingThreshold,
        amountNeededForFreeShipping,
        items: verifiedItems,
        canProceed: canProceed && verifiedItems.length > 0,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    };
  }

  /**
   * Secure, server-side order creation.
   * Completely validates products, inventory availability, discounts, and addresses.
   * Supports idempotency protection, prevents negative stock, and synchronizes inventory atomically.
   */
  async createOrder(input: CreateOrderInput, ip: string): Promise<{ success: boolean; order?: OrderRecord; duplicate?: boolean; error?: string }> {
    if (!input.items || input.items.length === 0) {
      return { success: false, error: 'Cannot create an order with an empty cart.' };
    }

    if (!input.shippingAddress || !input.shippingAddress.addressLine1 || !input.shippingAddress.pincode) {
      return { success: false, error: 'A valid delivery address is required.' };
    }

    // 1. Idempotency Check: if idempotencyKey was provided and exists, return existing order
    if (input.idempotencyKey && input.idempotencyKey.trim().length > 0) {
      const existing = await orderRepository.findByIdempotencyKey(input.idempotencyKey.trim());
      if (existing) {
        console.log(`[OrderService] Idempotent hit: Order ${existing.orderNumber} already created with idempotencyKey "${input.idempotencyKey}"`);
        return { success: true, order: existing, duplicate: true };
      }
    }

    // 2. Calculate server-authoritative quote and check inventory + per-user coupon eligibility
    const quoteRes = await this.calculateQuote({
      items: input.items,
      couponCode: input.couponCode,
      shippingPincode: input.shippingAddress.pincode,
      state: input.shippingAddress.state,
      customerId: input.customerId,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
    });

    if (!quoteRes.success || !quoteRes.quote) {
      return { success: false, error: quoteRes.error || 'Pricing calculation failed.' };
    }

    const { quote } = quoteRes;

    if (!quote.canProceed) {
      const issues = quote.warnings?.join(' ') || 'Some items in your cart are currently out of stock.';
      return { success: false, error: issues };
    }

    // 3. Generate unique human-readable order number
    const orderNumber = await this.generateOrderNumber();
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // 4. Create immutable price snapshots for every item
    const verifiedItems: OrderItemRecord[] = quote.items.map((it, idx) => ({
      id: `it-${Date.now()}-${idx + 1}`,
      productId: it.productId,
      productName: it.productName,
      variantId: it.variantId,
      sku: it.sku,
      size: it.size,
      color: it.color,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      totalPrice: it.totalPrice,
      image: it.image,
      discount: quote.discount > 0 ? Math.round((quote.discount / quote.subtotal) * it.totalPrice) : 0,
      tax: Math.round(it.totalPrice * 0.05),
    }));

    try {
      const normalizedPaymentMethod = (input.paymentMethod || 'UPI').toUpperCase();
      const isCod = normalizedPaymentMethod === 'COD';

      const txResult = await withTransaction(async (tx) => {
        // 5. Inventory Reservation / Allocation
        const heldItems: Array<{ variantId: string; quantity: number }> = [];

        tx.onRollback?.(async () => {
          for (const rollback of heldItems) {
            try {
              if (isCod) {
                await inventoryRepository.restoreStock(
                  rollback.variantId,
                  rollback.quantity,
                  `Rollback failed COD order ${orderNumber}`,
                  orderId
                );
              } else {
                await inventoryRepository.releaseReservation(
                  rollback.variantId,
                  rollback.quantity,
                  orderId,
                  `Rollback failed reservation for order ${orderNumber}`
                );
              }
            } catch {}
          }
        });

        if (isCod) {
          // COD orders allocate/deduct stock immediately
          for (const it of verifiedItems) {
            await inventoryRepository.deductStock(
              it.variantId,
              it.quantity,
              `COD Order ${orderNumber} placed`,
              orderId
            );
            heldItems.push({ variantId: it.variantId, quantity: it.quantity });
          }
        } else {
          // Online payment orders atomically reserve stock with a 15-minute checkout hold
          for (const it of verifiedItems) {
            await inventoryRepository.reserveStock(
              it.variantId,
              it.quantity,
              orderId,
              15 // 15-minute checkout hold
            );
            heldItems.push({ variantId: it.variantId, quantity: it.quantity });
          }
        }

        // 6. Atomically record coupon redemption & per-user audit if applied
        if (quote.discountCode) {
          await couponRepository.recordRedemption({
            code: quote.discountCode,
            orderId,
            customerId: input.customerId,
            customerEmail: input.customerEmail,
            customerPhone: input.customerPhone,
            discountAmount: quote.discount,
          });
        }

    // 7. Save address snapshot
    const addressSnapshot: OrderAddressRecord = {
      fullName: (input.shippingAddress.fullName || input.customerName || '').trim(),
      phone: (input.shippingAddress.phone || input.customerPhone || '').trim(),
      email: (input.shippingAddress.email || input.customerEmail || '').trim(),
      addressLine1: (input.shippingAddress.addressLine1 || '').trim(),
      addressLine2: input.shippingAddress.addressLine2 ? input.shippingAddress.addressLine2.trim() : undefined,
      city: (input.shippingAddress.city || '').trim(),
      state: (input.shippingAddress.state || '').trim(),
      pincode: (input.shippingAddress.pincode || '').trim(),
      country: input.shippingAddress.country || 'India',
    };

    // 8. Server-authoritative initial order & payment states
    // Never mark an order as PAID prior to cryptographic payment verification!
    const paymentStatus: OrderPaymentStatus = isCod ? 'PENDING' : 'PENDING_PAYMENT';
    const fulfillmentStatus: OrderFulfillmentStatus = isCod ? 'CONFIRMED' : 'PENDING_PAYMENT';

    // 9. Initial timeline (courier & AWB remain unassigned until manifested via logistics carrier)
    const timeline: OrderTimelineRecord[] = [
      {
        status: isCod ? 'CONFIRMED' : 'PENDING_PAYMENT',
        timestamp: new Date().toISOString(),
        description: isCod
          ? `Cash on Delivery order placed & verified (₹${quote.total}).`
          : `Order created. Inventory reserved for 15 minutes awaiting payment (₹${quote.total}).`,
        actorId: input.customerId || 'GUEST',
        actorName: input.customerName,
      },
    ];

    const orderAccessToken = 'ord_tok_' + crypto.randomBytes(24).toString('hex');
    const normalizedWhatsappNumber =
      input.whatsappOptIn === true
        ? normalizeOrderPhoneToE164(input.customerPhone || addressSnapshot.phone)
        : null;
    const whatsappOptIn = input.whatsappOptIn === true && Boolean(normalizedWhatsappNumber);

    const orderRecord: OrderRecord = {
      id: orderId,
      orderNumber,
      orderAccessToken,
      idempotencyKey: input.idempotencyKey?.trim(),
      customerId: input.customerId,
      customerName: input.customerName.trim(),
      customerEmail: input.customerEmail.trim(),
      customerPhone: input.customerPhone.trim(),
      subtotal: quote.subtotal,
      discount: quote.discount,
      discountCode: quote.discountCode,
      tax: quote.tax,
      shippingFee: quote.shippingFee,
      total: quote.total,
      currency: 'INR',
      paymentMethod: normalizedPaymentMethod,
      paymentStatus,
      fulfillmentStatus,
      shippingAddress: addressSnapshot,
      items: verifiedItems,
      deliveryNotes: input.deliveryNotes,
      whatsappOptIn,
      whatsappOptInAt: whatsappOptIn ? new Date() : undefined,
      whatsappNumber: normalizedWhatsappNumber || undefined,
      ipAddress: ip,
      timeline,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const saved = await orderRepository.create(orderRecord);

    // 10. Record revenue in Phase 2 Finance if confirmed paid
    if ((paymentStatus as any) === 'PAID') {
      try {
        const primaryAccount =
          financeRepository.getAccounts().find((a) => a.type === 'BANK' && a.isActive) ||
          financeRepository.getAccounts()[0];

        if (primaryAccount) {
          financeRepository.createTransaction(
            {
              transactionNumber: `TXN-ORD-${orderNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
              date: new Date().toISOString().split('T')[0],
              description: `Storefront Order Revenue - ${orderNumber}`,
              type: 'INCOME',
              category: 'Sales Revenue',
              amount: quote.total,
              paymentAccountId: primaryAccount.id,
              orderId: orderId,
              referenceId: `ORDER_PAY_${orderId}`,
              status: 'APPROVED',
              notes: `Customer: ${orderRecord.customerName} (${orderRecord.customerEmail}) · Method: ${normalizedPaymentMethod}`,
            },
            'ORDER_SERVICE'
          );
        }
      } catch (fErr) {
        console.warn('[OrderService] Finance logging warning:', fErr);
      }
    }

    // 11. Record audit entry
    await auditRepository.record({
      userId: input.customerId || 'GUEST',
      userName: input.customerName,
      userRole: 'CUSTOMER',
      module: 'orders',
      action: 'ORDER_CREATED',
      recordAffected: orderNumber,
      newValue: `Total: ₹${quote.total} (${verifiedItems.length} items)`,
      ipAddress: ip,
      severity: 'INFO',
    });

        return { success: true, order: saved };
      });

      // Dispatch transactional confirmation ONLY after COD order commits.
      // Prepaid orders are confirmed exclusively after payment verification/webhook.
      if (txResult.success && txResult.order && isCod) {
        dispatchOrderNotificationSafe('ORDER_CONFIRMED', { order: txResult.order });
      }

      return txResult;
    } catch (err: any) {
      console.warn('[OrderService] Order atomic transaction error:', err.message);
      return { success: false, error: err.message || 'Failed to place order.' };
    }
  }

  /**
   * Controlled state machine transition.
   * Rejects invalid transitions (e.g. DELIVERED -> PROCESSING, CANCELLED -> PROCESSING).
   */
  async transitionOrderStatus(
    orderId: string,
    targetStatus: OrderFulfillmentStatus,
    actor: { id: string; name: string; role: string },
    note?: string,
    courierInfo?: { courierPartner?: string; trackingNumber?: string }
  ): Promise<{ success: boolean; order?: OrderRecord; error?: string }> {
    const order = (await orderRepository.findById(orderId)) || (await orderRepository.findByOrderNumber(orderId));
    if (!order) {
      return { success: false, error: 'Order not found.' };
    }

    const currentStatus = order.fulfillmentStatus;

    // Idempotent: If already in target status, return existing order
    if (currentStatus === targetStatus) {
      return { success: true, order };
    }

    const allowed = ORDER_ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      return {
        success: false,
        error: `Invalid transition from "${currentStatus}" to "${targetStatus}". Allowed next statuses: ${allowed.join(', ') || 'None (Terminal state)'}`,
      };
    }

    // If transitioning to CANCELLED, restore inventory and coupon usage idempotently
    if (targetStatus === 'CANCELLED') {
      for (const it of order.items) {
        await inventoryRepository.restoreStock(
          it.variantId,
          it.quantity,
          `Order ${order.orderNumber} status changed to CANCELLED`,
          order.id
        );
      }
      if (order.discountCode) {
        await couponRepository.releaseRedemption(order.discountCode, order.id);
      }
    }

    const updates: Partial<OrderRecord> = {
      fulfillmentStatus: targetStatus,
    };

    if (targetStatus === 'CANCELLED') {
      if (!order.cancelledAt) updates.cancelledAt = new Date();
      if (!order.cancellationReason) updates.cancellationReason = note || 'Cancelled by administrator';
      if (!order.refundStatus) {
        updates.refundStatus =
          order.paymentStatus === 'PAID'
            ? 'REFUND_INITIATED'
            : order.paymentMethod?.toUpperCase() === 'COD'
              ? 'NOT_APPLICABLE_COD'
              : 'NOT_APPLICABLE_UNPAID';
      }
    }

    if (courierInfo?.courierPartner) updates.courierPartner = courierInfo.courierPartner;
    if (courierInfo?.trackingNumber) {
      updates.courierTrackingNumber = courierInfo.trackingNumber;
      updates.awbNumber = courierInfo.trackingNumber;
    }

    if (targetStatus === 'DELIVERED') {
      updates.paymentStatus = 'PAID';
    }

    const timelineEntry: OrderTimelineRecord = {
      status: targetStatus,
      timestamp: new Date().toISOString(),
      description: note || `Status transitioned to ${targetStatus}`,
      actorId: actor.id,
      actorName: actor.name,
      note,
    };

    updates.timeline = [...order.timeline, timelineEntry];
    const updated = await orderRepository.update(order.id, updates);

    await auditRepository.record({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role as any,
      module: 'orders',
      action: 'ORDER_STATUS_UPDATED',
      recordAffected: order.orderNumber,
      oldValue: currentStatus,
      newValue: targetStatus,
      severity: 'INFO',
    });

    if (updated) {
      if (targetStatus === 'CANCELLED') {
        dispatchOrderNotificationSafe('ORDER_CANCELLED', {
          order: updated,
          cancellationReason: note || updated.cancellationReason,
        });
      } else if (targetStatus === 'SHIPPED') {
        dispatchOrderNotificationSafe('ORDER_SHIPPED', {
          order: updated,
          courierPartner: courierInfo?.courierPartner || updated.courierPartner,
          trackingNumber: courierInfo?.trackingNumber || updated.awbNumber || updated.courierTrackingNumber,
        });
      } else if (targetStatus === 'OUT_FOR_DELIVERY') {
        dispatchOrderNotificationSafe('ORDER_OUT_FOR_DELIVERY', {
          order: updated,
          courierPartner: courierInfo?.courierPartner || updated.courierPartner,
          trackingNumber: courierInfo?.trackingNumber || updated.awbNumber || updated.courierTrackingNumber,
        });
      } else if (targetStatus === 'DELIVERED') {
        dispatchOrderNotificationSafe('ORDER_DELIVERED', {
          order: updated,
          courierPartner: courierInfo?.courierPartner || updated.courierPartner,
          trackingNumber: courierInfo?.trackingNumber || updated.awbNumber || updated.courierTrackingNumber,
        });
      }
    }

    return { success: true, order: updated || undefined };
  }

  /**
   * Cancellation service with inventory restoration, coupon usage adjustment, and refund initiation.
   * Completely idempotent: repeated cancel requests will not double-restock inventory or double-decrement coupon usage.
   */
  async cancelOrder(
    orderId: string,
    reason: string,
    actor: { id: string; name: string; role: string }
  ): Promise<{ success: boolean; order?: OrderRecord; alreadyCancelled?: boolean; error?: string }> {
    const releaseLock = await this.acquireOrderLock(orderId);
    try {
      const txResult = await withTransaction(async (_tx) => {
        const order = (await orderRepository.findById(orderId)) || (await orderRepository.findByOrderNumber(orderId));
        if (!order) {
          return { success: false, error: 'Order not found.' };
        }

        // Idempotency: If already cancelled, do not restock again
        if (order.fulfillmentStatus === 'CANCELLED') {
          return {
            success: true,
            order,
            alreadyCancelled: true,
          };
        }

        const nonCancellableStates: OrderFulfillmentStatus[] = [
          'SHIPPED',
          'OUT_FOR_DELIVERY',
          'DELIVERED',
          'REFUNDED',
          'RETURNED',
        ];

        if (nonCancellableStates.includes(order.fulfillmentStatus)) {
          return {
            success: false,
            error: `Order cannot be cancelled in "${order.fulfillmentStatus}" status. Please initiate a return request instead.`,
          };
        }

        // 1. Idempotently release reservation or restore inventory
        // COD orders deduct stock immediately upon placement; paid orders deduct stock upon payment capture.
        // Unpaid online orders hold a reservation without deducting quantityOnHand.
        const wasDeducted = order.paymentStatus === 'PAID' || order.paymentMethod?.toLowerCase() === 'cod';
        if (wasDeducted) {
          for (const it of order.items) {
            await inventoryRepository.restoreStock(
              it.variantId,
              it.quantity,
              `Order ${order.orderNumber} cancelled: ${reason}`,
              order.id
            );
          }
        } else {
          for (const it of order.items) {
            await inventoryRepository.releaseReservation(
              it.variantId,
              it.quantity,
              order.id,
              `Order ${order.orderNumber} cancelled prior to payment: ${reason}`
            );
          }
        }

        // 2. Idempotently reverse coupon usage
        if (order.discountCode) {
          await couponRepository.releaseRedemption(order.discountCode, order.id);
        }

        const isPaid = order.paymentStatus === 'PAID';
        const refundStatus = isPaid
          ? 'REFUND_INITIATED'
          : order.paymentMethod?.toUpperCase() === 'COD'
            ? 'NOT_APPLICABLE_COD'
            : 'NOT_APPLICABLE_UNPAID';

        // 3. Record refund/cancellation in Phase 2 Finance if paid
        if (isPaid) {
          try {
            const primaryAccount =
              financeRepository.getAccounts().find((a) => a.type === 'BANK' && a.isActive) ||
              financeRepository.getAccounts()[0];

            if (primaryAccount) {
              financeRepository.createTransaction(
                {
                  transactionNumber: `TXN-REF-${order.orderNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
                  date: new Date().toISOString().split('T')[0],
                  description: `Cancellation Refund - ${order.orderNumber}`,
                  type: 'EXPENSE',
                  category: 'Refunds & Returns',
                  amount: order.total,
                  paymentAccountId: primaryAccount.id,
                  orderId: order.id,
                  referenceId: `ORDER_CANCEL_REFUND_${order.id}`,
                  status: 'APPROVED',
                  notes: `Order cancelled by ${actor.name}: ${reason}`,
                },
                'ORDER_SERVICE'
              );
            }
          } catch (fErr) {
            console.warn('[OrderService] Finance refund logging warning:', fErr);
          }
        }

        const timelineEntry: OrderTimelineRecord = {
          status: 'CANCELLED',
          timestamp: new Date().toISOString(),
          description: `Order cancelled by ${actor.name} (${actor.role}): ${reason}`,
          actorId: actor.id,
          actorName: actor.name,
          note: reason,
        };

        const updated = await orderRepository.update(order.id, {
          fulfillmentStatus: 'CANCELLED',
          cancellationReason: reason,
          cancelledAt: new Date(),
          refundStatus,
          timeline: [...order.timeline, timelineEntry],
        });

        await auditRepository.record({
          userId: actor.id,
          userName: actor.name,
          userRole: actor.role as any,
          module: 'orders',
          action: 'ORDER_CANCELLED',
          recordAffected: order.orderNumber,
          newValue: `Reason: ${reason}`,
          severity: 'WARNING',
        });

        return { success: true, order: updated || undefined };
      });

      if (txResult.success && !txResult.alreadyCancelled && txResult.order) {
        dispatchOrderNotificationSafe('ORDER_CANCELLED', {
          order: txResult.order,
          cancellationReason: reason,
        });
      }

      return txResult;
    } finally {
      releaseLock();
    }
  }

  /**
   * Process refund for an order.
   */
  async refundOrder(
    orderId: string,
    amount: number,
    reason: string,
    actor: { id: string; name: string; role: string }
  ): Promise<{ success: boolean; order?: OrderRecord; alreadyRefunded?: boolean; error?: string }> {
    const releaseLock = await this.acquireOrderLock(orderId);
    try {
      return await withTransaction(async (_tx) => {
        const order = (await orderRepository.findById(orderId)) || (await orderRepository.findByOrderNumber(orderId));
        if (!order) {
          return { success: false, error: 'Order not found.' };
        }

        if (order.paymentStatus === 'REFUNDED') {
          return { success: true, order, alreadyRefunded: true };
        }

        if (order.paymentStatus !== 'PAID') {
          return { success: false, error: 'Cannot refund an order that has not been successfully paid.' };
        }

        const refundAmount = amount > 0 ? Math.min(amount, order.total) : order.total;

        // Record refund in Phase 2 Finance
        try {
          const primaryAccount =
            financeRepository.getAccounts().find((a) => a.type === 'BANK' && a.isActive) ||
            financeRepository.getAccounts()[0];

          if (primaryAccount) {
            financeRepository.createTransaction(
              {
                transactionNumber: `TXN-REF-${order.orderNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
                date: new Date().toISOString().split('T')[0],
                description: `Customer Refund - ${order.orderNumber}`,
                type: 'EXPENSE',
                category: 'Refunds & Returns',
                amount: refundAmount,
                paymentAccountId: primaryAccount.id,
                orderId: order.id,
                referenceId: `ORDER_REFUND_${order.id}`,
                status: 'APPROVED',
                notes: `Refund processed: ${reason}`,
              },
              'ORDER_SERVICE'
            );
          }
        } catch (fErr) {
          console.warn('[OrderService] Finance refund logging warning:', fErr);
        }

        const timelineEntry: OrderTimelineRecord = {
          status: 'REFUNDED',
          timestamp: new Date().toISOString(),
          description: `Refund of ₹${refundAmount} processed: ${reason}`,
          actorId: actor.id,
          actorName: actor.name,
          note: reason,
        };

        const updated = await orderRepository.update(order.id, {
          paymentStatus: 'REFUNDED',
          fulfillmentStatus: order.fulfillmentStatus === 'CANCELLED' ? 'CANCELLED' : 'RETURNED',
          refundStatus: 'REFUND_COMPLETED',
          refundAmount,
          timeline: [...order.timeline, timelineEntry],
        });

        await auditRepository.record({
          userId: actor.id,
          userName: actor.name,
          userRole: actor.role as any,
          module: 'orders',
          action: 'PAYMENT_REFUNDED',
          recordAffected: order.orderNumber,
          newValue: `Amount: ₹${refundAmount}, Reason: ${reason}`,
          severity: 'WARNING',
        });

        return { success: true, order: updated || undefined };
      });
    } finally {
      releaseLock();
    }
  }

  async getOrder(orderIdOrNumber: string): Promise<OrderRecord | null> {
    return (await orderRepository.findById(orderIdOrNumber)) || (await orderRepository.findByOrderNumber(orderIdOrNumber));
  }

  async getCustomerOrders(customerId: string, email?: string, phone?: string): Promise<OrderRecord[]> {
    const all = await orderRepository.getAll();
    const cleanEmail = email?.trim().toLowerCase();
    const cleanPhone = phone?.trim();

    return all.filter((o) => {
      if (customerId && o.customerId === customerId) return true;
      if (cleanEmail && o.customerEmail.toLowerCase() === cleanEmail) return true;
      if (cleanPhone && o.customerPhone.includes(cleanPhone)) return true;
      return false;
    });
  }

  async getAllOrders(filter?: { status?: string; search?: string; customerId?: string }): Promise<OrderRecord[]> {
    return await orderRepository.getAll(filter);
  }

  /**
   * Append a custom milestone / fulfillment timeline update to an order.
   */
  async addTimelineEvent(
    orderId: string,
    input: { title: string; status?: string; note?: string },
    actor: { id: string; name: string; role: string }
  ): Promise<{ success: boolean; order?: OrderRecord; entry?: OrderTimelineRecord; error?: string }> {
    const title = String(input.title || '').trim();
    if (title.length < 2) {
      return { success: false, error: 'Timeline update title must be at least 2 characters.' };
    }

    const releaseLock = await this.acquireOrderLock(orderId);
    try {
      const order = (await orderRepository.findById(orderId)) || (await orderRepository.findByOrderNumber(orderId));
      if (!order) {
        return { success: false, error: 'Order not found.' };
      }

      const cleanNote = input.note ? String(input.note).trim() : '';
      const entry: OrderTimelineRecord = {
        status: (input.status || order.fulfillmentStatus || 'UPDATE').toUpperCase(),
        timestamp: new Date().toISOString(),
        description: title,
        actorId: actor.id,
        actorName: actor.name,
        note: cleanNote || title,
      };

      const updated = await orderRepository.update(order.id, {
        timeline: [...(order.timeline || []), entry],
      });

      await auditRepository.record({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role as any,
        module: 'orders',
        action: 'ORDER_TIMELINE_UPDATED',
        recordAffected: order.orderNumber,
        newValue: `${title}${cleanNote ? ` — ${cleanNote}` : ''}`,
        severity: 'INFO',
      });

      return { success: true, order: updated || undefined, entry };
    } finally {
      releaseLock();
    }
  }
}

const TIMELINE_TITLE_MAP: Record<string, string> = {
  CONFIRMED: 'Order Confirmed',
  PENDING_PAYMENT: 'Awaiting Payment',
  PAYMENT_PENDING: 'Awaiting Payment',
  PROCESSING: 'Processing Order',
  PACKED: 'Packed & Quality Checked',
  SHIPPED: 'Dispatched via Courier',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Order Cancelled',
  REFUNDED: 'Refund Processed',
  RETURN_REQUESTED: 'Return Requested',
  RETURNED: 'Order Returned',
};

export function normalizeOrderTimeline(timeline: OrderTimelineRecord[] | undefined | null) {
  if (!Array.isArray(timeline)) return [];
  return timeline.map((entry) => {
    const rawStatus = String(entry.status || '').toUpperCase();
    const fallbackTitle = TIMELINE_TITLE_MAP[rawStatus] || (rawStatus ? `Status: ${rawStatus}` : 'Order Update');
    const title = entry.description && entry.description.length <= 72 ? entry.description : fallbackTitle;
    return {
      status: entry.status || 'UPDATE',
      title,
      timestamp: entry.timestamp,
      description: entry.description || title,
      note: entry.note || entry.description || '',
      actorName: entry.actorName,
    };
  });
}

export const orderService = new OrderService();

