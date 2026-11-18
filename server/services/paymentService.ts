import crypto from 'crypto';
import { paymentRepository, PaymentTransactionRecord, PaymentWebhookRecord } from '../repositories/paymentRepository';
import { orderRepository } from '../repositories/orderRepository';
import { inventoryRepository } from '../repositories/inventoryRepository';
import { couponRepository } from '../repositories/couponRepository';
import { financeRepository } from '../repositories/financeRepository';
import { auditRepository } from '../repositories/auditRepository';
import { withTransaction } from '../../database/transactions';
import { paymentConfigService } from './paymentConfigService';
import { safeTimingEqual } from '../utils/storageHelper';

export interface CreatePaymentIntentInput {
  orderId: string;
  gateway?: 'RAZORPAY' | 'CASHFREE';
  method: 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'NET_BANKING' | 'WALLET' | 'COD';
}

export interface VerifyPaymentInput {
  orderId: string;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature: string;
}

export interface RefundInput {
  orderId: string;
  paymentId?: string;
  amountPaise?: number;
  reason?: string;
}

export class PaymentService {
  private getConfiguredCredentials() {
    const creds = paymentConfigService.getActiveCredentials();
    const keyId = (creds?.keyId || '').trim();
    const keySecret = (creds?.keySecret || '').trim();
    const webhookSecret = (creds?.webhookSecret || '').trim();
    const isValid =
      Boolean(creds?.enabled) &&
      Boolean(keyId) &&
      Boolean(keySecret) &&
      !keyId.includes('••••') &&
      !keySecret.includes('••••');

    return {
      enabled: Boolean(creds?.enabled),
      environment: creds?.environment || 'test',
      keyId,
      keySecret,
      webhookSecret,
      isValid,
      authHeader: isValid ? 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64') : null,
    };
  }

  /**
   * Creates a real payment order via official Razorpay Orders API.
   * Never creates simulated orders or placeholder keys.
   */
  async createPaymentIntent(input: CreatePaymentIntentInput, ip: string): Promise<{
    success: boolean;
    transaction?: PaymentTransactionRecord;
    gatewayPayload?: any;
    error?: string;
  }> {
    const order = (await orderRepository.findById(input.orderId)) || (await orderRepository.findByOrderNumber(input.orderId));
    if (!order) {
      return { success: false, error: 'Order not found.' };
    }

    if (order.paymentStatus === 'PAID') {
      return { success: false, error: 'This order is already marked as PAID.' };
    }

    if (order.paymentStatus === 'REFUNDED' || order.fulfillmentStatus === 'CANCELLED') {
      return { success: false, error: 'Cannot initiate payment for a cancelled or refunded order.' };
    }

    const creds = this.getConfiguredCredentials();
    if (!creds.enabled) {
      return {
        success: false,
        error: 'Online payment gateway (Razorpay) is currently disabled in Admin → Payment Settings. Please use Cash on Delivery or contact support.',
      };
    }

    if (!creds.isValid || !creds.authHeader) {
      return {
        success: false,
        error: 'Razorpay credentials are not configured. Configure Key ID and Key Secret in Admin → Settings → Payment Gateway.',
      };
    }

    const amountPaise = Math.round(Number(order.total) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return { success: false, error: 'Order total must be greater than zero to create a payment order.' };
    }

    let gatewayOrderId = '';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: creds.authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: order.currency || 'INR',
          receipt: order.orderNumber,
          notes: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerEmail: order.customerEmail,
            customerPhone: order.customerPhone,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || !json?.id) {
        const errDetail = json?.error?.description || `Razorpay order creation returned HTTP ${res.status}`;
        return {
          success: false,
          error: `Razorpay Gateway Error: ${errDetail}`,
        };
      }

      gatewayOrderId = String(json.id);
    } catch (err: any) {
      return {
        success: false,
        error: `Network error contacting Razorpay Orders API: ${err?.name === 'AbortError' ? 'Request timed out' : err.message}`,
      };
    }

    const txId = `tx-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const txRecord: PaymentTransactionRecord = {
      id: txId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      gateway: 'RAZORPAY',
      gatewayOrderId,
      amount: order.total,
      amountPaise,
      currency: order.currency || 'INR',
      status: 'INITIATED',
      method: input.method,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      isSimulated: false,
      signatureVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await paymentRepository.createTransaction(txRecord);

    await auditRepository.record({
      userId: order.customerId || 'GUEST',
      userName: order.customerName,
      userRole: 'CUSTOMER',
      module: 'payments',
      action: 'PAYMENT_INTENT_CREATED',
      recordAffected: txRecord.orderNumber,
      newValue: `Gateway: RAZORPAY (${creds.environment.toUpperCase()}) · Gateway Order: ${gatewayOrderId} · Amount: ₹${order.total}`,
      ipAddress: ip,
      severity: 'INFO',
    });

    return {
      success: true,
      transaction: txRecord,
      gatewayPayload: {
        keyId: creds.keyId,
        amount: amountPaise,
        currency: order.currency || 'INR',
        orderId: gatewayOrderId,
        environment: creds.environment.toUpperCase(),
      },
    };
  }

  /**
   * Cryptographic server-side Razorpay signature verification.
   * Prevents duplicate payment processing across orders and syncs stock/finance atomically.
   */
  async verifyPayment(input: VerifyPaymentInput, ip: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const order = (await orderRepository.findById(input.orderId)) || (await orderRepository.findByOrderNumber(input.orderId));
    if (!order) {
      return { success: false, error: 'Associated order not found.' };
    }

    if (order.paymentStatus === 'REFUNDED') {
      return {
        success: false,
        error: 'Order has already been refunded. Cannot transition back to PAID.',
      };
    }

    if (order.paymentStatus === 'PAID') {
      return {
        success: true,
        message: 'Payment already verified and order is marked PAID.',
      };
    }

    const gatewayOrderId = String(input.gatewayOrderId || '').trim();
    const gatewayPaymentId = String(input.gatewayPaymentId || '').trim();
    const gatewaySignature = String(input.gatewaySignature || '').trim();

    if (!gatewayOrderId || !gatewayPaymentId || !gatewaySignature) {
      return {
        success: false,
        error: 'Razorpay order ID, payment ID, and cryptographic signature are all required for verification.',
      };
    }

    // Prevent replay/reuse of the same Razorpay payment ID across different orders
    const existingByPaymentId = await paymentRepository.findByGatewayPaymentId(gatewayPaymentId);
    if (existingByPaymentId && existingByPaymentId.orderId !== order.id) {
      await auditRepository.record({
        userId: 'SECURITY',
        userName: 'PaymentGateway',
        userRole: 'SYSTEM',
        module: 'payments',
        action: 'DUPLICATE_PAYMENT_REPLAY_BLOCKED',
        recordAffected: order.orderNumber,
        newValue: `Duplicate Payment ID ${gatewayPaymentId} already linked to ${existingByPaymentId.orderNumber}`,
        ipAddress: ip,
        severity: 'CRITICAL',
      });
      return {
        success: false,
        error: 'Duplicate payment reference: This gateway payment ID has already been processed for another order.',
      };
    }

    let tx = await paymentRepository.findByGatewayOrderId(gatewayOrderId);
    if (tx && tx.orderId !== order.id) {
      return {
        success: false,
        error: 'Gateway Order ID does not match the specified application order.',
      };
    }
    if (!tx) {
      tx = await paymentRepository.findByOrderId(order.id);
    }

    const creds = this.getConfiguredCredentials();
    if (!creds.keySecret) {
      return { success: false, error: 'Razorpay Key Secret is not configured on the server for signature verification.' };
    }

    const expectedSignature = crypto
      .createHmac('sha256', creds.keySecret)
      .update(`${gatewayOrderId}|${gatewayPaymentId}`)
      .digest('hex');

    const isSignatureValid = safeTimingEqual(expectedSignature, gatewaySignature);

    if (!isSignatureValid) {
      if (tx) {
        await paymentRepository.updateTransaction(tx.id, {
          status: 'FAILED',
          gatewayPaymentId,
          failureReason: 'Cryptographic signature mismatch.',
        });
      }

      await auditRepository.record({
        userId: 'SECURITY',
        userName: 'PaymentGateway',
        userRole: 'SYSTEM',
        module: 'payments',
        action: 'PAYMENT_SIGNATURE_MISMATCH',
        recordAffected: order.orderNumber,
        ipAddress: ip,
        severity: 'CRITICAL',
      });

      return { success: false, error: 'Payment verification failed: Cryptographic signature mismatch.' };
    }

    // Optional live payment capture/amount verification via Razorpay Payments API when available
    try {
      if (creds.authHeader) {
        const payRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(gatewayPaymentId)}`, {
          method: 'GET',
          headers: { Authorization: creds.authHeader, Accept: 'application/json' },
        });
        if (payRes.ok) {
          const payJson: any = await payRes.json().catch(() => null);
          const expectedPaise = Math.round(Number(order.total) * 100);
          if (payJson && typeof payJson.amount === 'number' && payJson.amount !== expectedPaise) {
            return {
              success: false,
              error: `Payment amount mismatch (expected ${expectedPaise} paise, gateway received ${payJson.amount} paise).`,
            };
          }
          if (payJson && payJson.order_id && payJson.order_id !== gatewayOrderId) {
            return {
              success: false,
              error: 'Gateway payment order reference mismatch.',
            };
          }
        }
      }
    } catch {
      // Network lookup failure does not invalidate already HMAC-verified payload
    }

    await withTransaction(async () => {
      if (tx) {
        await paymentRepository.updateTransaction(tx.id, {
          status: 'CAPTURED',
          gatewayOrderId,
          gatewayPaymentId,
          gatewaySignature,
          signatureVerified: true,
        });
      } else {
        await paymentRepository.createTransaction({
          id: `tx-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          gateway: 'RAZORPAY',
          gatewayOrderId,
          gatewayPaymentId,
          gatewaySignature,
          amount: order.total,
          amountPaise: Math.round(order.total * 100),
          currency: order.currency || 'INR',
          status: 'CAPTURED',
          method: (order.paymentMethod as any) || 'UPI',
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          isSimulated: false,
          signatureVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const nextStatus = order.fulfillmentStatus === 'PENDING_PAYMENT' || order.fulfillmentStatus === 'PAYMENT_PENDING'
        ? 'CONFIRMED'
        : order.fulfillmentStatus;

      order.paymentStatus = 'PAID';
      order.fulfillmentStatus = nextStatus;
      order.timeline.push({
        status: 'PAID',
        timestamp: new Date().toISOString(),
        description: `Payment verified & captured via Razorpay (${gatewayPaymentId})`,
        actorId: 'PAYMENT_SERVICE',
        actorName: 'Razorpay Gateway',
      });
      await orderRepository.update(order.id, {
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        timeline: order.timeline,
      });

      for (const it of order.items) {
        try {
          await inventoryRepository.commitReservation(it.variantId, it.quantity, order.id);
        } catch (err: any) {
          console.warn(`[PaymentService] Stock commit warning for ${it.variantId}:`, err.message);
        }
      }

      this.recordOrderPaymentFinance(order);
    });

    await auditRepository.record({
      userId: order.customerId || 'GUEST',
      userName: order.customerName,
      userRole: 'CUSTOMER',
      module: 'payments',
      action: 'PAYMENT_VERIFIED_CAPTURED',
      recordAffected: order.orderNumber,
      newValue: `Payment ID: ${gatewayPaymentId} · Order: ${gatewayOrderId} · ₹${order.total}`,
      ipAddress: ip,
      severity: 'INFO',
    });

    return {
      success: true,
      message: 'Payment verified successfully and order transitioned to PAID.',
    };
  }

  /**
   * Process genuine full or partial refund through official Razorpay Refund API.
   * Supports multiple partial-item refunds per order up to total paid amount.
   */
  async processRefund(input: RefundInput, ip: string): Promise<{
    success: boolean;
    refundId?: string;
    refundStatus?: string;
    refundAmount?: number;
    error?: string;
  }> {
    const order = (await orderRepository.findById(input.orderId)) || (await orderRepository.findByOrderNumber(input.orderId));
    if (!order) {
      return { success: false, error: 'Order not found.' };
    }

    const alreadyRefundedRupees = Number(order.refundAmount || 0);
    const remainingRefundableRupees = Math.max(0, Number((order.total - alreadyRefundedRupees).toFixed(2)));

    if (order.paymentStatus === 'REFUNDED' || remainingRefundableRupees <= 0.01) {
      return { success: false, error: 'This order has already been fully refunded.' };
    }

    if (order.paymentStatus !== 'PAID') {
      return { success: false, error: 'Refund can only be issued for orders with PAID status.' };
    }

    const tx = await paymentRepository.findByOrderId(order.id);
    const paymentId = input.paymentId || tx?.gatewayPaymentId;

    if (!paymentId) {
      return { success: false, error: 'Cannot process refund: No verified Razorpay payment ID associated with this order.' };
    }

    const creds = this.getConfiguredCredentials();
    if (!creds.authHeader) {
      return {
        success: false,
        error: 'Razorpay credentials are required to process a refund.',
      };
    }

    const maxPaise = Math.round(remainingRefundableRupees * 100);
    const requestedAmountPaise = input.amountPaise && input.amountPaise > 0
      ? Math.min(Math.round(input.amountPaise), maxPaise)
      : maxPaise;

    if (requestedAmountPaise <= 0) {
      return { success: false, error: 'Requested refund amount must be greater than zero.' };
    }

    let refundId = '';
    let gatewayRefundStatus = 'processed';

    try {
      const payload: any = {
        amount: requestedAmountPaise,
        notes: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          reason: input.reason || 'Admin/Customer requested refund',
        },
      };

      const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
        method: 'POST',
        headers: {
          Authorization: creds.authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || !json?.id) {
        return {
          success: false,
          error: json?.error?.description || `Razorpay refund returned HTTP ${res.status}`,
        };
      }

      refundId = String(json.id);
      if (json.status) {
        gatewayRefundStatus = String(json.status);
      }
    } catch (err: any) {
      return {
        success: false,
        error: `Network error contacting Razorpay refund endpoint: ${err.message}`,
      };
    }

    const refundRupees = Number((requestedAmountPaise / 100).toFixed(2));
    const cumulativeRefundRupees = Number((alreadyRefundedRupees + refundRupees).toFixed(2));
    const isFullRefund = cumulativeRefundRupees >= order.total - 0.01;

    if (tx) {
      await paymentRepository.updateTransaction(tx.id, {
        status: isFullRefund ? 'REFUNDED' : tx.status,
        refundId,
        refundAmount: cumulativeRefundRupees,
        refundReason: input.reason || 'Requested',
        refundedAt: new Date(),
      });
    }

    order.paymentStatus = isFullRefund ? 'REFUNDED' : 'PAID';
    order.refundStatus = isFullRefund ? 'REFUND_COMPLETED' : 'PARTIAL_REFUND_COMPLETED';
    order.refundAmount = cumulativeRefundRupees;
    order.timeline.push({
      status: 'REFUNDED',
      timestamp: new Date().toISOString(),
      description: `${isFullRefund ? 'Full' : 'Partial'} refund of ₹${refundRupees} processed via Razorpay. Refund ID: ${refundId}. Reason: ${input.reason || 'Requested'}`,
      actorId: 'PAYMENT_SERVICE',
      actorName: 'Razorpay Gateway',
    });

    await orderRepository.update(order.id, {
      paymentStatus: order.paymentStatus,
      refundStatus: order.refundStatus,
      refundAmount: cumulativeRefundRupees,
      timeline: order.timeline,
    });

    await auditRepository.record({
      userId: 'SYSTEM',
      userName: 'PaymentService',
      userRole: 'SYSTEM',
      module: 'payments',
      action: 'PAYMENT_REFUND_PROCESSED',
      recordAffected: order.orderNumber,
      newValue: `Refund ID: ${refundId} · ₹${refundRupees} (Total refunded: ₹${cumulativeRefundRupees}) · Order: ${order.orderNumber}`,
      ipAddress: ip,
      severity: 'WARNING',
    });

    return {
      success: true,
      refundId,
      refundStatus: gatewayRefundStatus,
      refundAmount: refundRupees,
    };
  }

  /**
   * Verify refund settlement state directly with Razorpay Refunds API (GET /v1/refunds/:id).
   */
  async verifyRefundStatus(refundId: string): Promise<{
    success: boolean;
    refundId?: string;
    status?: string;
    amount?: number;
    error?: string;
  }> {
    const cleanId = String(refundId || '').trim();
    if (!cleanId) {
      return { success: false, error: 'Refund ID is required to verify refund status.' };
    }
    const creds = this.getConfiguredCredentials();
    if (!creds.authHeader) {
      return { success: false, error: 'Razorpay credentials are not configured.' };
    }
    try {
      const res = await fetch(`https://api.razorpay.com/v1/refunds/${encodeURIComponent(cleanId)}`, {
        method: 'GET',
        headers: {
          Authorization: creds.authHeader,
          Accept: 'application/json',
        },
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || !json?.id) {
        return {
          success: false,
          error: json?.error?.description || `Razorpay refund lookup failed (HTTP ${res.status})`,
        };
      }
      return {
        success: true,
        refundId: String(json.id),
        status: String(json.status || 'processed'),
        amount: typeof json.amount === 'number' ? Number((json.amount / 100).toFixed(2)) : undefined,
      };
    } catch (err: any) {
      return { success: false, error: `Failed to verify Razorpay refund status: ${err.message}` };
    }
  }

  /**
   * Process incoming webhook events from Razorpay with fail-closed HMAC signature verification & idempotency
   */
  async processWebhook(
    gateway: string,
    signature: string,
    payload: any,
    rawBody?: string
  ): Promise<{ success: boolean; duplicate?: boolean; error?: string; message?: string }> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { success: false, error: 'Malformed webhook payload.' };
    }

    const creds = this.getConfiguredCredentials();
    const webhookSecret = creds.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';
    if (!webhookSecret) {
      return {
        success: false,
        error: 'Webhook rejected: Razorpay webhook secret is not configured on the server.',
      };
    }

    if (!signature || !rawBody) {
      return {
        success: false,
        error: 'Webhook rejected: Missing x-razorpay-signature header or raw request body.',
      };
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!safeTimingEqual(expectedSignature, signature.trim())) {
      await auditRepository.record({
        userId: 'SECURITY',
        userName: 'RazorpayWebhook',
        userRole: 'SYSTEM',
        module: 'payments',
        action: 'WEBHOOK_SIGNATURE_INVALID',
        recordAffected: String(payload?.event || 'webhook'),
        severity: 'CRITICAL',
      });
      return { success: false, error: 'Invalid webhook cryptographic signature.' };
    }

    const eventType = String(payload?.event || payload?.type || 'unknown');
    const eventId = String(
      payload?.event_id ||
      payload?.id ||
      payload?.eventId ||
      crypto.createHash('sha256').update(rawBody).digest('hex')
    );

    const existingWebhook = await paymentRepository.findWebhookByEventId(eventId);
    if (existingWebhook) {
      return { success: true, duplicate: true, message: 'Webhook already processed.' };
    }

    const paymentEntity = payload?.payload?.payment?.entity;
    const refundEntity = payload?.payload?.refund?.entity;
    const orderNumber = paymentEntity?.notes?.orderNumber || paymentEntity?.description || refundEntity?.notes?.orderNumber;

    let order = orderNumber ? await orderRepository.findByOrderNumber(orderNumber) : null;
    if (!order && paymentEntity?.order_id) {
      const tx = await paymentRepository.findByGatewayOrderId(paymentEntity.order_id);
      if (tx) order = await orderRepository.findById(tx.orderId);
    }
    if (!order && (refundEntity?.payment_id || paymentEntity?.id)) {
      const tx = await paymentRepository.findByGatewayPaymentId(refundEntity?.payment_id || paymentEntity?.id);
      if (tx) order = await orderRepository.findById(tx.orderId);
    }

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      if (order && order.paymentStatus !== 'PAID' && order.paymentStatus !== 'REFUNDED') {
        await withTransaction(async () => {
          order!.paymentStatus = 'PAID';
          if (order!.fulfillmentStatus === 'PENDING_PAYMENT' || order!.fulfillmentStatus === 'PAYMENT_PENDING') {
            order!.fulfillmentStatus = 'CONFIRMED';
          }
          order!.timeline.push({
            status: 'PAID',
            timestamp: new Date().toISOString(),
            description: `Payment captured via Razorpay Webhook (${paymentEntity?.id || 'Confirmed'})`,
            actorId: 'GATEWAY_WEBHOOK',
            actorName: gateway || 'Razorpay Webhook',
          });
          await orderRepository.update(order!.id, {
            paymentStatus: order!.paymentStatus,
            fulfillmentStatus: order!.fulfillmentStatus,
            timeline: order!.timeline,
          });

          const tx = await paymentRepository.findByOrderId(order!.id);
          if (tx) {
            await paymentRepository.updateTransaction(tx.id, {
              status: 'CAPTURED',
              gatewayPaymentId: paymentEntity?.id || tx.gatewayPaymentId,
              method: (paymentEntity?.method ? String(paymentEntity.method).toUpperCase() : tx.method) as any,
              upiVpa: paymentEntity?.vpa || tx.upiVpa,
              signatureVerified: true,
            });
          }

          for (const it of order!.items) {
            try {
              await inventoryRepository.commitReservation(it.variantId, it.quantity, order!.id);
            } catch (err: any) {
              console.warn('[PaymentWebhook] Commit reservation warning:', err.message);
            }
          }

          if (order!.discountCode) {
            await couponRepository.incrementUsage(order!.discountCode);
          }

          this.recordOrderPaymentFinance(order);
        });
      }
    } else if (eventType === 'payment.failed') {
      if (order && order.paymentStatus !== 'PAID' && order.paymentStatus !== 'REFUNDED') {
        order.paymentStatus = 'FAILED';
        order.timeline.push({
          status: 'FAILED',
          timestamp: new Date().toISOString(),
          description: `Payment failed via Webhook: ${paymentEntity?.error_description || 'Declined'}`,
          actorId: 'GATEWAY_WEBHOOK',
          actorName: gateway || 'Razorpay Webhook',
        });
        await orderRepository.update(order.id, {
          paymentStatus: 'FAILED',
          timeline: order.timeline,
        });

        const tx = await paymentRepository.findByOrderId(order.id);
        if (tx) {
          await paymentRepository.updateTransaction(tx.id, {
            status: 'FAILED',
            gatewayPaymentId: paymentEntity?.id || tx.gatewayPaymentId,
            failureReason: paymentEntity?.error_description || 'Payment failed',
          });
        }

        for (const it of order.items) {
          try {
            await inventoryRepository.releaseReservation(it.variantId, it.quantity, order.id, 'Payment failed via webhook');
          } catch {}
        }
      }
    } else if (eventType === 'refund.created' || eventType === 'refund.processed') {
      if (order) {
        const refundAmountRupees = refundEntity?.amount
          ? Number((Number(refundEntity.amount) / 100).toFixed(2))
          : order.total;
        const refundStatus = eventType === 'refund.processed' ? 'REFUND_COMPLETED' : 'REFUND_INITIATED';

        const tx = await paymentRepository.findByOrderId(order.id);
        if (tx) {
          await paymentRepository.updateTransaction(tx.id, {
            status: 'REFUNDED',
            refundId: refundEntity?.id || tx.refundId,
            refundAmount: refundAmountRupees,
            refundedAt: new Date(),
          });
        }

        order.timeline.push({
          status: 'REFUNDED',
          timestamp: new Date().toISOString(),
          description: `Razorpay ${eventType}: ₹${refundAmountRupees} (${refundEntity?.id || 'Refund'})`,
          actorId: 'GATEWAY_WEBHOOK',
          actorName: 'Razorpay Webhook',
        });

        await orderRepository.update(order.id, {
          paymentStatus: 'REFUNDED',
          refundStatus,
          refundAmount: refundAmountRupees,
          timeline: order.timeline,
        });
      }
    }

    const webhookRecord: PaymentWebhookRecord = {
      id: `wh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      gateway: gateway || 'RAZORPAY',
      eventId,
      eventType,
      payload,
      processed: true,
      receivedAt: new Date(),
    };
    await paymentRepository.logWebhook(webhookRecord);

    return { success: true, message: `Webhook event "${eventType}" processed successfully.` };
  }

  private recordOrderPaymentFinance(order: any): void {
    try {
      const primaryAccount =
        financeRepository.getAccounts().find((a) => a.type === 'BANK' && a.isActive) ||
        financeRepository.getAccounts()[0];

      if (primaryAccount) {
        financeRepository.createTransaction(
          {
            transactionNumber: `TXN-ORD-${order.orderNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
            date: new Date().toISOString().split('T')[0],
            description: `Customer Order Revenue - ${order.orderNumber}`,
            type: 'INCOME',
            category: 'Sales Revenue',
            amount: order.total,
            paymentAccountId: primaryAccount.id,
            orderId: order.id,
            referenceId: `ORDER_PAY_${order.id}`,
            status: 'APPROVED',
            notes: `Order ${order.orderNumber} placed by ${order.customerName}`,
          },
          'PAYMENT_SERVICE'
        );
      }
    } catch (err) {
      console.warn('[PaymentService] Finance recording warning:', err);
    }
  }
}

export const paymentService = new PaymentService();
