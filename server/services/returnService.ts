import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  returnRepository,
  ReturnRequestRecord,
  ReturnRequestStatus,
  ReturnItemRecord,
  RETURN_PROOFS_DIR,
} from '../repositories/returnRepository';
import { orderRepository, OrderRecord } from '../repositories/orderRepository';
import { inventoryRepository } from '../repositories/inventoryRepository';
import { paymentService } from './paymentService';
import { cmsRepository } from '../repositories/cmsRepository';
import { financeRepository } from '../repositories/financeRepository';
import { auditRepository } from '../repositories/auditRepository';

export const RETURN_ALLOWED_TRANSITIONS: Record<ReturnRequestStatus, ReturnRequestStatus[]> = {
  RETURN_REQUESTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['PICKUP_SCHEDULED', 'RETURNED_TO_WAREHOUSE', 'REFUND_PROCESSING', 'REJECTED', 'CLOSED'],
  REJECTED: ['CLOSED'],
  PICKUP_SCHEDULED: ['IN_TRANSIT', 'RETURNED_TO_WAREHOUSE', 'CLOSED'],
  IN_TRANSIT: ['RETURNED_TO_WAREHOUSE', 'CLOSED'],
  RETURNED_TO_WAREHOUSE: ['REFUND_PROCESSING', 'REFUNDED', 'CLOSED'],
  REFUND_PROCESSING: ['REFUNDED', 'CLOSED'],
  REFUNDED: ['CLOSED'],
  CLOSED: [],
};

export interface CreateReturnInput {
  orderIdOrNumber: string;
  requestType?: 'RETURN' | 'EXCHANGE';
  reason: string;
  comments?: string;
  proofFiles?: string[];
  items: Array<{
    orderItemId?: string;
    productId?: string;
    variantId?: string;
    size?: string;
    quantity: number;
  }>;
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
}

export class ReturnService {
  private locks = new Map<string, Promise<void>>();

  private async acquireLock(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let release!: () => void;
    const promise = new Promise<void>((res) => {
      release = res;
    });
    this.locks.set(key, promise);
    return () => {
      this.locks.delete(key);
      release();
    };
  }

  saveUploadedProof(dataUrl: string, originalFilename?: string): { success: boolean; filename?: string; error?: string } {
    if (!dataUrl || typeof dataUrl !== 'string') {
      return { success: false, error: 'Missing image data payload.' };
    }
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
    if (!match || !match[1] || !match[2]) {
      return { success: false, error: 'Unsupported proof format. Only PNG, JPG, and WEBP images are allowed.' };
    }
    const rawExt = match[1].toLowerCase();
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0) {
      return { success: false, error: 'Uploaded proof image is empty.' };
    }
    if (buffer.length > 5 * 1024 * 1024) {
      return { success: false, error: 'Proof image must be 5 MB or smaller.' };
    }
    if (!fs.existsSync(RETURN_PROOFS_DIR)) {
      fs.mkdirSync(RETURN_PROOFS_DIR, { recursive: true });
    }
    const safePrefix = (originalFilename || 'proof').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'proof';
    const filename = `ret-${safePrefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const fullPath = path.join(RETURN_PROOFS_DIR, filename);
    const tmp = `${fullPath}.tmp`;
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, fullPath);
    return { success: true, filename };
  }

  async createReturnRequest(
    input: CreateReturnInput,
    order: OrderRecord
  ): Promise<{ success: boolean; returnRequest?: ReturnRequestRecord; error?: string }> {
    const release = await this.acquireLock(order.id);
    try {
      const eligibleStatuses = new Set(['DELIVERED', 'RETURN_REQUESTED', 'RETURNED']);
      if (!eligibleStatuses.has(order.fulfillmentStatus)) {
        return {
          success: false,
          error: `Returns can only be initiated after order delivery. Current status: ${order.fulfillmentStatus}.`,
        };
      }

      const settings = await cmsRepository.getStoreSettings();
      const returnWindowDays = settings.returnWindowDays || 7;
      const deliveredEvent = [...(order.timeline || [])]
        .reverse()
        .find((tl) => String(tl.status || '').toUpperCase() === 'DELIVERED');
      const deliveredAtMs = deliveredEvent?.timestamp
        ? new Date(deliveredEvent.timestamp).getTime()
        : new Date(order.updatedAt || order.createdAt).getTime();

      if (Number.isFinite(deliveredAtMs)) {
        const deadlineMs = deliveredAtMs + returnWindowDays * 24 * 60 * 60 * 1000;
        if (Date.now() > deadlineMs) {
          return {
            success: false,
            error: `The ${returnWindowDays}-day return window for order ${order.orderNumber} has expired.`,
          };
        }
      }

      if (!input.reason || input.reason.trim().length < 3) {
        return { success: false, error: 'Please select a valid return or exchange reason.' };
      }

      if (!Array.isArray(input.items) || input.items.length === 0) {
        return { success: false, error: 'Please select at least one item to return or exchange.' };
      }

      const existingReturns = await returnRepository.listByOrderId(order.id);
      const alreadyReturnedQtyByItem = new Map<string, number>();
      for (const existing of existingReturns) {
        if (existing.status === 'REJECTED') continue;
        for (const it of existing.items) {
          alreadyReturnedQtyByItem.set(
            it.orderItemId,
            (alreadyReturnedQtyByItem.get(it.orderItemId) || 0) + Number(it.quantity || 0)
          );
        }
      }

      const merchandiseRatio = order.subtotal > 0
        ? Math.max(0, Math.min(1, (order.subtotal - (order.discount || 0)) / order.subtotal))
        : 1;

      const returnItems: ReturnItemRecord[] = [];
      let totalRefundAmount = 0;

      for (const reqItem of input.items) {
        const qty = Math.max(1, Math.floor(Number(reqItem.quantity || 1)));
        const matchedOrderItem = order.items.find(
          (oi) =>
            (reqItem.orderItemId && oi.id === reqItem.orderItemId) ||
            (reqItem.variantId && oi.variantId === reqItem.variantId) ||
            (reqItem.productId && oi.productId === reqItem.productId && (!reqItem.size || oi.size === reqItem.size))
        );

        if (!matchedOrderItem) {
          return { success: false, error: 'Selected item does not belong to this order.' };
        }

        const priorQty = alreadyReturnedQtyByItem.get(matchedOrderItem.id) || 0;
        const remainingQty = matchedOrderItem.quantity - priorQty;
        if (remainingQty <= 0) {
          return {
            success: false,
            error: `A return or exchange has already been requested for "${matchedOrderItem.productName}" (${matchedOrderItem.size}).`,
          };
        }
        if (qty > remainingQty) {
          return {
            success: false,
            error: `Only ${remainingQty} remaining unit(s) of "${matchedOrderItem.productName}" (${matchedOrderItem.size}) are eligible for return.`,
          };
        }

        alreadyReturnedQtyByItem.set(matchedOrderItem.id, priorQty + qty);
        const unitRefund = Number((matchedOrderItem.unitPrice * merchandiseRatio).toFixed(2));
        const lineRefund = Number((unitRefund * qty).toFixed(2));
        totalRefundAmount = Number((totalRefundAmount + lineRefund).toFixed(2));

        returnItems.push({
          id: `rit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          orderItemId: matchedOrderItem.id,
          productId: matchedOrderItem.productId,
          variantId: matchedOrderItem.variantId,
          productName: matchedOrderItem.productName,
          sku: matchedOrderItem.sku,
          size: matchedOrderItem.size,
          color: matchedOrderItem.color,
          quantity: qty,
          unitPrice: matchedOrderItem.unitPrice,
          refundAmount: lineRefund,
          restocked: false,
        });
      }

      const proofFiles = (Array.isArray(input.proofFiles) ? input.proofFiles : [])
        .map((f) => path.basename(String(f || '').trim()))
        .filter((f) => /^[a-zA-Z0-9._-]+$/.test(f))
        .slice(0, 6);

      const nowIso = new Date().toISOString();
      const returnNumber = `RET-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      const retId = `ret-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      const record: ReturnRequestRecord = {
        id: retId,
        returnNumber,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: input.customer?.id || order.customerId,
        customerName: input.customer?.name || order.customerName,
        customerEmail: input.customer?.email || order.customerEmail,
        customerPhone: input.customer?.phone || order.customerPhone,
        requestType: input.requestType === 'EXCHANGE' ? 'EXCHANGE' : 'RETURN',
        reason: input.reason.trim(),
        comments: input.comments ? input.comments.trim().slice(0, 1500) : undefined,
        proofFiles,
        status: 'RETURN_REQUESTED',
        refundAmount: totalRefundAmount,
        refundMethod: order.paymentMethod?.toUpperCase() === 'COD' ? 'BANK_UPI_MANUAL' : 'RAZORPAY',
        items: returnItems,
        history: [
          {
            id: `rh-${Date.now()}`,
            toStatus: 'RETURN_REQUESTED',
            note: `${input.requestType === 'EXCHANGE' ? 'Exchange' : 'Return'} submitted: ${input.reason.trim()}`,
            actorId: input.customer?.id || 'CUSTOMER',
            actorName: input.customer?.name || order.customerName,
            actorRole: 'CUSTOMER',
            createdAt: nowIso,
          },
        ],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const saved = await returnRepository.save(record);

      // Update order timeline & status cleanly
      const updatedOrderStatus = order.fulfillmentStatus === 'DELIVERED' ? 'RETURN_REQUESTED' : order.fulfillmentStatus;
      await orderRepository.update(order.id, {
        fulfillmentStatus: updatedOrderStatus,
        timeline: [
          ...(order.timeline || []),
          {
            status: 'RETURN_REQUESTED',
            timestamp: nowIso,
            description: `${record.requestType} request ${returnNumber} submitted for ${returnItems.length} item(s).`,
            actorId: input.customer?.id || 'CUSTOMER',
            actorName: record.customerName,
          },
        ],
      });

      await auditRepository.record({
        userId: input.customer?.id || 'CUSTOMER',
        userName: record.customerName,
        userRole: 'CUSTOMER',
        module: 'orders',
        action: 'RETURN_REQUESTED',
        recordAffected: `${returnNumber} (${order.orderNumber})`,
        newValue: `${returnItems.length} item(s) · Value ₹${totalRefundAmount} · Reason: ${record.reason}`,
        severity: 'INFO',
      });

      return { success: true, returnRequest: saved };
    } finally {
      release();
    }
  }

  async updateStatus(
    returnId: string,
    targetStatus: ReturnRequestStatus,
    actor: { id: string; name: string; role: string },
    payload?: {
      note?: string;
      rejectionReason?: string;
      courierPartner?: string;
      awbNumber?: string;
      adminNotes?: string;
    }
  ): Promise<{ success: boolean; returnRequest?: ReturnRequestRecord; error?: string }> {
    const release = await this.acquireLock(returnId);
    try {
      const ret = await returnRepository.findById(returnId);
      if (!ret) {
        return { success: false, error: 'Return request not found.' };
      }

      if (ret.status === targetStatus) {
        return { success: true, returnRequest: ret };
      }

      const allowed = RETURN_ALLOWED_TRANSITIONS[ret.status] || [];
      if (!allowed.includes(targetStatus)) {
        return {
          success: false,
          error: `Invalid return transition from "${ret.status}" to "${targetStatus}". Allowed: ${allowed.join(', ') || 'None'}`,
        };
      }

      if (targetStatus === 'REJECTED') {
        const reason = String(payload?.rejectionReason || payload?.note || '').trim();
        if (reason.length < 3) {
          return { success: false, error: 'A rejection reason is required when rejecting a return request.' };
        }
        ret.rejectionReason = reason;
      }

      const nowIso = new Date().toISOString();

      if (targetStatus === 'PICKUP_SCHEDULED') {
        if (payload?.courierPartner) ret.courierPartner = String(payload.courierPartner).trim();
        if (payload?.awbNumber) ret.awbNumber = String(payload.awbNumber).trim();
        ret.pickupScheduledAt = nowIso;
      }

      if (targetStatus === 'RETURNED_TO_WAREHOUSE') {
        ret.receivedAt = ret.receivedAt || nowIso;
        // Idempotent per-item warehouse restocking using restocked flag + unique reference key
        let anyRestockedNow = false;
        for (const it of ret.items) {
          if (!it.restocked && it.variantId) {
            await inventoryRepository.restoreStock(
              it.variantId,
              it.quantity,
              `Return ${ret.returnNumber} received at warehouse`,
              `${ret.id}_${it.orderItemId}`
            );
            it.restocked = true;
            it.restockedAt = nowIso;
            anyRestockedNow = true;
          }
        }
        if (anyRestockedNow || !ret.restockedAt) {
          ret.restockedAt = nowIso;
        }
      }

      if (payload?.adminNotes !== undefined) {
        ret.adminNotes = String(payload.adminNotes).trim();
      }

      const prevStatus = ret.status;
      ret.status = targetStatus;
      ret.history.push({
        id: `rh-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        fromStatus: prevStatus,
        toStatus: targetStatus,
        note: payload?.rejectionReason || payload?.note || `Transitioned to ${targetStatus}`,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        createdAt: nowIso,
      });

      const saved = await returnRepository.save(ret);

      // Sync parent order status milestone when relevant
      const order = await orderRepository.findById(ret.orderId);
      if (order) {
        const orderNextStatus =
          targetStatus === 'RETURNED_TO_WAREHOUSE' ? 'RETURNED' :
          targetStatus === 'REJECTED' && order.fulfillmentStatus === 'RETURN_REQUESTED' ? 'DELIVERED' :
          order.fulfillmentStatus;
        await orderRepository.update(order.id, {
          fulfillmentStatus: orderNextStatus,
          timeline: [
            ...(order.timeline || []),
            {
              status: targetStatus,
              timestamp: nowIso,
              description: `Return ${ret.returnNumber}: ${targetStatus}${payload?.rejectionReason ? ` (${payload.rejectionReason})` : ''}`,
              actorId: actor.id,
              actorName: actor.name,
            },
          ],
        });
      }

      await auditRepository.record({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role as any,
        module: 'orders',
        action: 'RETURN_STATUS_UPDATED',
        recordAffected: ret.returnNumber,
        oldValue: prevStatus,
        newValue: targetStatus,
        severity: targetStatus === 'REJECTED' ? 'WARNING' : 'INFO',
      });

      return { success: true, returnRequest: saved };
    } finally {
      release();
    }
  }

  async processReturnRefund(
    returnId: string,
    actor: { id: string; name: string; role: string },
    input: {
      method?: 'RAZORPAY' | 'BANK_UPI_MANUAL' | 'TORI_CREDIT';
      amount?: number;
      reference?: string;
      note?: string;
    },
    ip: string
  ): Promise<{ success: boolean; returnRequest?: ReturnRequestRecord; error?: string }> {
    const release = await this.acquireLock(returnId);
    try {
      const ret = await returnRepository.findById(returnId);
      if (!ret) {
        return { success: false, error: 'Return request not found.' };
      }
      if (ret.status === 'REFUNDED' || ret.refundStatus === 'REFUND_COMPLETED') {
        return { success: false, error: 'Refund has already been completed for this return request.' };
      }
      if (!['APPROVED', 'RETURNED_TO_WAREHOUSE', 'REFUND_PROCESSING'].includes(ret.status)) {
        return {
          success: false,
          error: `Refund cannot be processed while return is in "${ret.status}" status.`,
        };
      }

      const order = await orderRepository.findById(ret.orderId);
      if (!order) {
        return { success: false, error: 'Associated order not found.' };
      }

      const maxEligibleRefund = ret.refundAmount || order.total;
      if (input.amount !== undefined) {
        const requestedAmount = Number(input.amount);
        if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
          return { success: false, error: 'Refund amount must be greater than ₹0.' };
        }
        if (requestedAmount > maxEligibleRefund) {
          return {
            success: false,
            error: `Refund amount ₹${requestedAmount} exceeds maximum eligible return amount ₹${maxEligibleRefund}.`,
          };
        }
      }

      const refundRupees = input.amount && Number(input.amount) > 0
        ? Number(input.amount)
        : maxEligibleRefund;
      const method = input.method || (order.paymentMethod?.toUpperCase() === 'COD' ? 'BANK_UPI_MANUAL' : 'RAZORPAY');
      const nowIso = new Date().toISOString();

      if (method === 'RAZORPAY') {
        ret.status = 'REFUND_PROCESSING';
        ret.refundMethod = 'RAZORPAY';
        await returnRepository.save(ret);

        const gwResult = await paymentService.processRefund(
          {
            orderId: order.id,
            amountPaise: Math.round(refundRupees * 100),
            reason: input.note || `Return ${ret.returnNumber}: ${ret.reason}`,
          },
          ip
        );

        if (!gwResult.success) {
          ret.refundStatus = 'FAILED';
          ret.history.push({
            id: `rh-${Date.now()}`,
            fromStatus: 'REFUND_PROCESSING',
            toStatus: 'REFUND_PROCESSING',
            note: `Razorpay refund attempt failed: ${gwResult.error}`,
            actorId: actor.id,
            actorName: actor.name,
            actorRole: actor.role,
            createdAt: new Date().toISOString(),
          });
          await returnRepository.save(ret);
          return { success: false, error: gwResult.error || 'Razorpay refund failed.', returnRequest: ret };
        }

        ret.refundId = gwResult.refundId;
        ret.refundStatus = gwResult.refundStatus === 'pending' ? 'PROCESSING' : 'REFUND_COMPLETED';
        ret.refundAmount = gwResult.refundAmount ?? refundRupees;
        ret.refundedAt = nowIso;
        ret.status = 'REFUNDED';
      } else {
        const manualRef = String(input.reference || '').trim();
        if (manualRef.length < 3) {
          return {
            success: false,
            error: 'A transaction / UPI / bank payout reference is required when recording a manual refund.',
          };
        }
        ret.refundMethod = method;
        ret.refundReference = manualRef;
        ret.refundId = manualRef;
        ret.refundStatus = 'REFUND_COMPLETED';
        ret.refundAmount = refundRupees;
        ret.refundedAt = nowIso;
        ret.status = 'REFUNDED';

        await orderRepository.update(order.id, {
          refundStatus: 'REFUND_COMPLETED',
          refundAmount: Number(((order.refundAmount || 0) + refundRupees).toFixed(2)),
          timeline: [
            ...(order.timeline || []),
            {
              status: 'REFUNDED',
              timestamp: nowIso,
              description: `Manual ${method} refund of ₹${refundRupees} settled for return ${ret.returnNumber} (Ref: ${manualRef})`,
              actorId: actor.id,
              actorName: actor.name,
            },
          ],
        });
      }

      // Record return refund expense idempotently in Finance
      try {
        const primaryAccount =
          financeRepository.getAccounts().find((a) => a.type === 'BANK' && a.isActive) ||
          financeRepository.getAccounts()[0];
        if (primaryAccount) {
          financeRepository.createTransaction(
            {
              transactionNumber: `TXN-RET-${ret.returnNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
              date: nowIso.split('T')[0],
              description: `Return Refund (${ret.returnNumber}) - ${order.orderNumber}`,
              type: 'EXPENSE',
              category: 'Refunds & Returns',
              amount: refundRupees,
              paymentAccountId: primaryAccount.id,
              orderId: order.id,
              referenceId: `RET_REFUND_${ret.id}`,
              status: 'APPROVED',
              notes: `${method} Refund Ref: ${ret.refundId || 'N/A'}`,
            },
            actor.id
          );
        }
      } catch (fErr) {
        console.warn('[ReturnService] Finance expense log note:', fErr);
      }

      ret.history.push({
        id: `rh-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        fromStatus: 'REFUND_PROCESSING',
        toStatus: 'REFUNDED',
        note: `Refund of ₹${refundRupees} issued via ${ret.refundMethod} (ID: ${ret.refundId})`,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        createdAt: nowIso,
      });

      const saved = await returnRepository.save(ret);

      await auditRepository.record({
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role as any,
        module: 'orders',
        action: 'RETURN_REFUND_PROCESSED',
        recordAffected: ret.returnNumber,
        newValue: `₹${refundRupees} via ${ret.refundMethod} · Ref: ${ret.refundId}`,
        severity: 'WARNING',
      });

      return { success: true, returnRequest: saved };
    } finally {
      release();
    }
  }

  async verifyReturnRefund(returnId: string): Promise<{ success: boolean; returnRequest?: ReturnRequestRecord; gatewayStatus?: string; error?: string }> {
    const ret = await returnRepository.findById(returnId);
    if (!ret) return { success: false, error: 'Return request not found.' };
    if (!ret.refundId || ret.refundMethod !== 'RAZORPAY') {
      return { success: false, error: 'No Razorpay refund ID found on this return request.' };
    }
    const verifyRes = await paymentService.verifyRefundStatus(ret.refundId);
    if (!verifyRes.success) {
      return { success: false, error: verifyRes.error };
    }
    ret.refundStatus = verifyRes.status === 'processed' ? 'REFUND_COMPLETED' : String(verifyRes.status || ret.refundStatus).toUpperCase();
    const saved = await returnRepository.save(ret);
    return { success: true, returnRequest: saved, gatewayStatus: verifyRes.status };
  }
}

export const returnService = new ReturnService();
