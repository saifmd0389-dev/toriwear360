import crypto from 'crypto';
import { shippingRepository, ShipmentRecord, TrackingEventRecord } from '../repositories/shippingRepository';
import { orderRepository, OrderFulfillmentStatus } from '../repositories/orderRepository';
import { inventoryRepository } from '../repositories/inventoryRepository';
import { auditRepository } from '../repositories/auditRepository';
import { paymentRepository } from '../repositories/paymentRepository';
import { logisticsPartnerRepository } from '../repositories/logisticsPartnerRepository';
import { logisticsManager } from './logistics/logisticsManager';
import { safeTimingEqual } from '../utils/storageHelper';
import { LogisticsCarrierKey } from './logistics/types';

export interface CreateShipmentInput {
  orderId: string;
  carrier?: LogisticsCarrierKey | 'SHIPROCKET' | 'DELHIVERY' | 'BLUEDART' | 'MANUAL';
  weightGrams?: number;
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
}

export class ShippingService {
  /**
   * Manifests a real carrier shipment via LogisticsManager (Shiprocket / configured carrier API).
   * Never creates synthetic AWBs or marks a shipment booked unless confirmed by carrier.
   */
  async createShipment(input: CreateShipmentInput, operatorId: string): Promise<{
    success: boolean;
    shipment?: ShipmentRecord;
    error?: string;
  }> {
    const order = (await orderRepository.findById(input.orderId)) || (await orderRepository.findByOrderNumber(input.orderId));
    if (!order) {
      return { success: false, error: 'Order not found.' };
    }

    const settings = await logisticsPartnerRepository.getSettings();
    const totalWeightGrams =
      input.weightGrams ||
      Math.max(300, (order.items || []).reduce((sum, it) => sum + (it.quantity || 1) * 320, 0));

    const carrierRes = await logisticsManager.createShipment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      carrierKey: (input.carrier && input.carrier !== 'MANUAL' ? input.carrier : undefined) as LogisticsCarrierKey | undefined,
      recipient: {
        fullName: order.shippingAddress?.fullName || order.customerName,
        phone: order.shippingAddress?.phone || order.customerPhone,
        email: order.shippingAddress?.email || order.customerEmail,
        addressLine1: order.shippingAddress?.addressLine1 || '',
        addressLine2: order.shippingAddress?.addressLine2,
        city: order.shippingAddress?.city || '',
        state: order.shippingAddress?.state || '',
        pincode: order.shippingAddress?.pincode || '',
      },
      items: (order.items || []).map((it) => ({
        name: it.productName,
        sku: it.sku,
        quantity: it.quantity,
        price: it.unitPrice,
      })),
      packageSpecs: {
        weightGrams: totalWeightGrams,
        lengthCm: input.lengthCm || 30,
        breadthCm: input.breadthCm || 25,
        heightCm: input.heightCm || 4,
      },
      paymentMethod: order.paymentMethod?.toUpperCase() === 'COD' ? 'COD' : 'UPI',
      codAmount: order.paymentMethod?.toUpperCase() === 'COD' ? order.total : 0,
      declaredValue: order.total,
      pickupPin: settings.pickupWarehousePin || settings.defaultOriginPin,
      pickupLocation: settings.pickupWarehouseName || 'Primary',
    });

    if (!carrierRes.success || !carrierRes.awbNumber) {
      return {
        success: false,
        error: carrierRes.error || 'Carrier failed to issue an AWB. Shipment was not booked.',
      };
    }

    let shipment = await shippingRepository.findByAwbCode(carrierRes.awbNumber);
    if (!shipment) {
      shipment = await shippingRepository.createShipment({
        id: `shp-${Date.now()}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        carrier: carrierRes.carrierKey,
        carrierShipmentId: carrierRes.shipmentId,
        trackingNumber: carrierRes.awbNumber,
        awbCode: carrierRes.awbNumber,
        shippingLabelUrl: carrierRes.labelUrl || `/api/v1/admin/logistics/shipments/${carrierRes.awbNumber}/label`,
        status: 'MANIFESTED',
        estimatedDeliveryDate: carrierRes.estimatedDeliveryDate ? new Date(carrierRes.estimatedDeliveryDate) : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await shippingRepository.addTrackingEvent({
      id: `ev-${Date.now()}`,
      shipmentId: shipment.id,
      status: 'MANIFESTED',
      location: settings.pickupWarehouseCity || 'Fulfillment Warehouse',
      description: `Manifested via ${carrierRes.carrierName}. AWB: ${carrierRes.awbNumber}`,
      timestamp: new Date(),
    });

    order.fulfillmentStatus = 'PROCESSING';
    order.courierPartner = carrierRes.carrierName;
    order.courierTrackingNumber = carrierRes.awbNumber;
    order.awbNumber = carrierRes.awbNumber;
    order.timeline.push({
      status: 'PROCESSING',
      timestamp: new Date().toISOString(),
      description: `Shipment manifested via ${carrierRes.carrierName}. AWB: ${carrierRes.awbNumber}`,
      actorId: operatorId,
      actorName: 'Fulfillment Operator',
    });
    await orderRepository.update(order.id, order);

    await auditRepository.record({
      userId: operatorId,
      userName: 'Fulfillment Operator',
      userRole: 'STAFF',
      module: 'shipping',
      action: 'SHIPMENT_MANIFESTED',
      recordAffected: shipment.orderNumber,
      newValue: `AWB: ${carrierRes.awbNumber} · Carrier: ${carrierRes.carrierName}`,
      ipAddress: '127.0.0.1',
      severity: 'INFO',
    });

    return { success: true, shipment };
  }

  async trackShipment(identifier: string): Promise<{
    success: boolean;
    shipment?: ShipmentRecord;
    events?: TrackingEventRecord[];
    error?: string;
  }> {
    let shipment = await shippingRepository.findByTrackingNumber(identifier);
    if (!shipment) {
      shipment = await shippingRepository.findByAwbCode(identifier);
    }
    if (!shipment) {
      shipment = await shippingRepository.findByOrderId(identifier);
    }

    if (!shipment) {
      return { success: false, error: 'No shipment found for this tracking number or order ID.' };
    }

    const events = await shippingRepository.getTrackingEvents(shipment.id);
    return { success: true, shipment, events };
  }

  /**
   * Process authenticated Shiprocket tracking webhook events.
   * Enforces fail-closed webhook token verification, PostgreSQL-backed deduplication, cancellation sync, and automated RTO restock.
   */
  async processShiprocketWebhook(
    tokenHeader: string | undefined,
    payload: any
  ): Promise<{ success: boolean; duplicate?: boolean; message?: string; error?: string }> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { success: false, error: 'Malformed Shiprocket webhook payload.' };
    }

    // 1. Fail-closed verification: require configured Shiprocket webhook token in env OR partner config
    const srPartner = await logisticsPartnerRepository.getByCarrierKey('SHIPROCKET');
    const configuredToken = (process.env.SHIPROCKET_WEBHOOK_TOKEN || srPartner?.webhookSecret || '').trim();
    if (!configuredToken) {
      return {
        success: false,
        error: 'Unauthorized: Shiprocket webhook token is not configured on the server.',
      };
    }

    if (!tokenHeader || !safeTimingEqual(tokenHeader.trim(), configuredToken)) {
      await auditRepository.record({
        userId: 'SECURITY',
        userName: 'ShiprocketWebhook',
        userRole: 'SYSTEM',
        module: 'shipping',
        action: 'SHIPROCKET_WEBHOOK_UNAUTHORIZED',
        recordAffected: String(payload?.awb || payload?.order_id || 'unknown'),
        severity: 'CRITICAL',
      });
      return { success: false, error: 'Unauthorized: Invalid or missing Shiprocket webhook token.' };
    }

    // 2. Identify & deduplicate persistently in PostgreSQL via paymentRepository webhook table
    const awb = String(payload.awb || payload.awb_code || payload.tracking_number || '').trim();
    const rawStatus = String(payload.current_status || payload.status || '').trim().toUpperCase();
    const eventTimestamp = payload.current_timestamp || payload.timestamp || new Date().toISOString();
    const eventHash = crypto
      .createHash('sha256')
      .update(`${awb}|${rawStatus}|${eventTimestamp}`)
      .digest('hex')
      .slice(0, 32);
    const eventId = String(payload.event_id || payload.id || `sr_${eventHash}`);

    const duplicateHit = await paymentRepository.findWebhookByEventId(eventId);
    if (duplicateHit) {
      return { success: true, duplicate: true, message: 'Shiprocket event already processed.' };
    }

    // 3. Match Shipment and Order
    const orderId = payload.order_id || payload.channel_order_id || payload.orderId;
    let shipment = awb ? await shippingRepository.findByTrackingNumber(awb) : null;
    if (!shipment && awb) {
      shipment = await shippingRepository.findByAwbCode(awb);
    }
    if (!shipment && orderId) {
      shipment = await shippingRepository.findByOrderId(String(orderId));
    }

    let order = null;
    if (shipment) {
      order = await orderRepository.findById(shipment.orderId);
    } else if (orderId) {
      order = (await orderRepository.findById(String(orderId))) || (await orderRepository.findByOrderNumber(String(orderId)));
    }

    if (!order) {
      await paymentRepository.logWebhook({
        id: `wh-sr-${Date.now()}`,
        gateway: 'SHIPROCKET',
        eventId,
        eventType: rawStatus || 'UNKNOWN',
        payload,
        processed: true,
        receivedAt: new Date(),
      });
      return { success: true, message: 'Event acknowledged; matching order not found in local system.' };
    }

    // 4. Map Status & Record Tracking Event
    let mappedShipmentStatus: ShipmentRecord['status'] = 'IN_TRANSIT';
    let mappedFulfillmentStatus: OrderFulfillmentStatus = order.fulfillmentStatus;
    let shouldRestockInventory = false;

    if (rawStatus.includes('CANCEL')) {
      mappedShipmentStatus = 'CANCELLED';
      mappedFulfillmentStatus = 'CANCELLED';
      shouldRestockInventory = order.fulfillmentStatus !== 'CANCELLED';
    } else if (rawStatus.includes('RTO DELIVERED') || rawStatus === 'RETURNED') {
      mappedShipmentStatus = 'RTO_DELIVERED';
      mappedFulfillmentStatus = 'RETURNED';
      shouldRestockInventory = order.fulfillmentStatus !== 'RETURNED';
    } else if (rawStatus.includes('RTO INITIATED') || rawStatus.includes('RTO IN TRANSIT')) {
      mappedShipmentStatus = 'RTO_INITIATED';
      mappedFulfillmentStatus = 'RETURN_REQUESTED';
    } else if (rawStatus === 'DELIVERED') {
      mappedShipmentStatus = 'DELIVERED';
      mappedFulfillmentStatus = 'DELIVERED';
    } else if (rawStatus.includes('OUT FOR DELIVERY')) {
      mappedShipmentStatus = 'OUT_FOR_DELIVERY';
      mappedFulfillmentStatus = 'OUT_FOR_DELIVERY';
    } else if (rawStatus.includes('PICK') || rawStatus === 'OUT FOR PICKUP') {
      mappedShipmentStatus = 'PICKED_UP';
      mappedFulfillmentStatus = 'SHIPPED';
    } else if (rawStatus.includes('TRANSIT') || rawStatus === 'REACHED AT DESTINATION HUB') {
      mappedShipmentStatus = 'IN_TRANSIT';
      mappedFulfillmentStatus = 'SHIPPED';
    }

    // 5. Update Shipment Record & Tracking Timeline
    if (shipment) {
      await shippingRepository.updateShipment(shipment.id, {
        status: mappedShipmentStatus,
        actualDeliveryDate: mappedShipmentStatus === 'DELIVERED' ? new Date() : shipment.actualDeliveryDate,
      });

      await shippingRepository.addTrackingEvent({
        id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        shipmentId: shipment.id,
        status: mappedShipmentStatus,
        location: payload.location || payload.city || 'Courier Logistics Hub',
        description: payload.activity || payload.description || `Status updated to ${rawStatus}`,
        timestamp: new Date(eventTimestamp),
      });
    }

    // 6. Update Order Status & Timeline
    order.fulfillmentStatus = mappedFulfillmentStatus;
    if (mappedShipmentStatus === 'DELIVERED' && order.paymentMethod?.toUpperCase() === 'COD') {
      order.paymentStatus = 'PAID';
    }
    if (mappedFulfillmentStatus === 'CANCELLED' && !order.cancelledAt) {
      order.cancelledAt = new Date();
      order.cancellationReason = order.cancellationReason || `Cancelled via Shiprocket webhook (${rawStatus})`;
    }

    order.timeline.push({
      status: mappedFulfillmentStatus,
      timestamp: new Date().toISOString(),
      description: `Shiprocket Update: ${rawStatus} (${payload.location || 'Hub'})`,
      actorId: 'SHIPROCKET_WEBHOOK',
      actorName: payload.courier_name || 'Shiprocket 3PL',
    });
    await orderRepository.update(order.id, order);

    // 7. Automated Inventory Restock on RTO Delivered / Shipment Cancelled
    if (shouldRestockInventory) {
      for (const it of order.items) {
        try {
          await inventoryRepository.restoreStock(
            it.variantId,
            it.quantity,
            `Shiprocket ${rawStatus}: Returned to warehouse`,
            order.id
          );
        } catch (err: any) {
          console.warn(`[SHIPROCKET] Restock warning for ${it.variantId}:`, err.message);
        }
      }
    }

    await paymentRepository.logWebhook({
      id: `wh-sr-${Date.now()}`,
      gateway: 'SHIPROCKET',
      eventId,
      eventType: rawStatus || 'TRACKING_UPDATE',
      payload,
      processed: true,
      receivedAt: new Date(),
    });

    await auditRepository.record({
      userId: 'SHIPROCKET',
      userName: payload.courier_name || 'Shiprocket Webhook',
      userRole: 'SYSTEM',
      module: 'shipping',
      action: 'SHIPROCKET_STATUS_UPDATED',
      recordAffected: order.orderNumber,
      newValue: `Status: ${rawStatus} · AWB: ${awb}`,
      ipAddress: '127.0.0.1',
      severity: shouldRestockInventory ? 'WARNING' : 'INFO',
    });

    return {
      success: true,
      message: `Shipment status updated to ${rawStatus}.`,
    };
  }

  async cancelShipment(shipmentIdOrAwb: string, reason: string, operatorId: string): Promise<{ success: boolean; error?: string; message?: string }> {
    const cleanId = String(shipmentIdOrAwb || '').trim();
    const shipment =
      (await shippingRepository.findByAwbCode(cleanId)) ||
      (await shippingRepository.findByTrackingNumber(cleanId)) ||
      (await shippingRepository.findByOrderId(cleanId));

    const awbToCancel = shipment?.awbCode || shipment?.trackingNumber || cleanId;
    if (!awbToCancel) {
      return { success: false, error: 'Shipment AWB not found for cancellation.' };
    }

    const res = await logisticsManager.cancelShipment(awbToCancel, reason);
    if (!res.success) {
      return { success: false, error: res.message };
    }

    if (shipment) {
      const order = await orderRepository.findById(shipment.orderId);
      if (order && !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(order.fulfillmentStatus)) {
        order.fulfillmentStatus = 'CANCELLED';
        order.cancelledAt = new Date();
        order.cancellationReason = reason || 'Shipment cancelled by operator';
        order.timeline.push({
          status: 'CANCELLED',
          timestamp: new Date().toISOString(),
          description: `Carrier shipment ${awbToCancel} cancelled: ${reason || 'Operator action'}`,
          actorId: operatorId,
          actorName: 'Operations',
        });
        await orderRepository.update(order.id, order);
      }
    }

    await auditRepository.record({
      userId: operatorId,
      userName: 'Operations',
      userRole: 'STAFF',
      module: 'shipping',
      action: 'SHIPMENT_CANCELLED',
      recordAffected: awbToCancel,
      newValue: reason || 'Shipment cancelled on carrier network',
      severity: 'WARNING',
    });

    return { success: true, message: res.message };
  }

  /**
   * Explicit reporting: Automated reverse pickup API via Shiprocket is not implemented yet.
   * Never generates synthetic RTO AWBs.
   */
  async initiateReturnPickup(_orderId: string, _reason: string): Promise<{ success: boolean; code?: string; returnAwb?: string; error?: string }> {
    return {
      success: false,
      code: 'REVERSE_PICKUP_NOT_IMPLEMENTED',
      error: 'Automated Shiprocket reverse pickup API is not implemented yet. Please schedule reverse pickups manually inside your Shiprocket dashboard.',
    };
  }
}

export const shippingService = new ShippingService();
