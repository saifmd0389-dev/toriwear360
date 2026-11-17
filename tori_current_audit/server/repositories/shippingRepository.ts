import { getPrismaClient } from '../db/prisma';

export interface ShipmentRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  carrier: 'DELHIVERY' | 'BLUEDART' | 'SHIPROCKET' | 'EKART' | 'MANUAL' | string;
  shipmentType?: 'FORWARD' | 'RETURN';
  carrierShipmentId?: string;
  trackingNumber: string;
  awbCode: string;
  trackingUrl?: string;
  shippingLabelUrl?: string;
  status:
    | 'MANIFESTED'
    | 'PICKED_UP'
    | 'IN_TRANSIT'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'CANCELLED'
    | 'RTO_INITIATED'
    | 'RTO_DELIVERED'
    | 'RETURN_REQUESTED';
  estimatedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrackingEventRecord {
  id: string;
  shipmentId: string;
  status: string;
  location: string;
  description: string;
  timestamp: Date;
}

export class ShippingRepository {
  private shipments = new Map<string, ShipmentRecord>();
  private trackingEvents = new Map<string, TrackingEventRecord[]>();

  private mapPrismaShipment(row: any): ShipmentRecord {
    return {
      id: row.id,
      orderId: row.orderId,
      orderNumber: row.shipmentNumber,
      carrier: (row.courierPartner || 'SHIPROCKET').toUpperCase(),
      shipmentType: row.shipmentType === 'RETURN' ? 'RETURN' : 'FORWARD',
      carrierShipmentId: row.carrierShipmentId || undefined,
      trackingNumber: row.trackingNumber || (row.shipmentType === 'RETURN' ? '' : row.shipmentNumber),
      awbCode: row.trackingNumber || '',
      trackingUrl: row.trackingUrl || undefined,
      shippingLabelUrl: row.labelUrl || undefined,
      status: (row.status || 'MANIFESTED') as ShipmentRecord['status'],
      actualDeliveryDate: row.deliveredAt ? new Date(row.deliveredAt) : undefined,
      createdAt: new Date(row.createdAt || Date.now()),
      updatedAt: new Date(row.updatedAt || Date.now()),
    };
  }

  async createShipment(shipment: ShipmentRecord): Promise<ShipmentRecord> {
    this.shipments.set(shipment.id, shipment);
    const prisma = getPrismaClient();
    if (prisma?.shipment) {
      try {
        const orderExists = await prisma.order.findUnique({ where: { id: shipment.orderId }, select: { id: true } });
        if (orderExists) {
          await prisma.shipment.upsert({
            where: { id: shipment.id },
            create: {
              id: shipment.id,
              orderId: shipment.orderId,
              shipmentNumber: shipment.orderNumber || `SHP-${Date.now()}`,
              courierPartner: shipment.carrier,
              shipmentType: shipment.shipmentType || 'FORWARD',
              carrierShipmentId: shipment.carrierShipmentId || null,
              trackingNumber: shipment.awbCode || shipment.trackingNumber,
              trackingUrl: shipment.trackingUrl || null,
              labelUrl: shipment.shippingLabelUrl || null,
              status: shipment.status,
              shippedAt: shipment.shipmentType === 'RETURN' ? null : new Date(),
            },
            update: {
              courierPartner: shipment.carrier,
              shipmentType: shipment.shipmentType || 'FORWARD',
              carrierShipmentId: shipment.carrierShipmentId || null,
              trackingNumber: shipment.awbCode || shipment.trackingNumber,
              trackingUrl: shipment.trackingUrl || null,
              labelUrl: shipment.shippingLabelUrl || null,
              status: shipment.status,
            },
          });
        }
      } catch (err) {
        console.warn('[ShippingRepo] Prisma createShipment warning:', err);
      }
    }
    return shipment;
  }

  async findByOrderId(orderId: string): Promise<ShipmentRecord | null> {
    const prisma = getPrismaClient();
    if (prisma?.shipment) {
      try {
        const row = await prisma.shipment.findFirst({
          where: { orderId, shipmentType: 'FORWARD' },
          orderBy: { createdAt: 'desc' },
        });
        if (row) {
          const rec = this.mapPrismaShipment(row);
          this.shipments.set(rec.id, rec);
          return rec;
        }
      } catch {}
    }
    for (const sh of this.shipments.values()) {
      if (sh.orderId === orderId && sh.shipmentType !== 'RETURN') return sh;
    }
    return null;
  }

  async findReturnShipmentByOrderId(orderId: string): Promise<ShipmentRecord | null> {
    const prisma = getPrismaClient();
    if (prisma?.shipment) {
      try {
        const row = await prisma.shipment.findFirst({ where: { orderId, shipmentType: 'RETURN' }, orderBy: { createdAt: 'desc' } });
        if (row) { const rec=this.mapPrismaShipment(row); this.shipments.set(rec.id,rec); return rec; }
      } catch {}
    }
    for (const shipment of this.shipments.values()) if (shipment.orderId === orderId && shipment.shipmentType === 'RETURN') return shipment;
    return null;
  }

  async createReturnShipment(shipment: ShipmentRecord): Promise<ShipmentRecord> {
    const prisma = getPrismaClient();
    if (!prisma?.shipment) throw new Error('Persistent shipment database is unavailable; refusing to keep a return shipment only in memory.');
    const orderExists = await prisma.order.findUnique({ where: { id: shipment.orderId }, select: { id: true } });
    if (!orderExists) throw new Error('Order does not exist in the persistent database.');
    const row = await prisma.shipment.upsert({
      where: { id: shipment.id },
      create: { id: shipment.id, orderId: shipment.orderId, shipmentNumber: shipment.orderNumber, courierPartner: shipment.carrier, shipmentType: 'RETURN', carrierShipmentId: shipment.carrierShipmentId || null, trackingNumber: shipment.awbCode || shipment.trackingNumber, trackingUrl: shipment.trackingUrl || null, labelUrl: shipment.shippingLabelUrl || null, status: shipment.status, shippedAt: null },
      update: { courierPartner: shipment.carrier, shipmentType: 'RETURN', carrierShipmentId: shipment.carrierShipmentId || null, trackingNumber: shipment.awbCode || shipment.trackingNumber, trackingUrl: shipment.trackingUrl || null, labelUrl: shipment.shippingLabelUrl || null, status: shipment.status },
    });
    const record = this.mapPrismaShipment(row); this.shipments.set(record.id, record); return record;
  }

  async findByTrackingNumber(trackingNumber: string): Promise<ShipmentRecord | null> {
    const clean = trackingNumber.trim();
    const prisma = getPrismaClient();
    if (prisma?.shipment) {
      try {
        const row = await prisma.shipment.findFirst({
          where: {
            OR: [
              { trackingNumber: clean },
              { shipmentNumber: clean },
            ],
          },
        });
        if (row) {
          const rec = this.mapPrismaShipment(row);
          this.shipments.set(rec.id, rec);
          return rec;
        }
      } catch {}
    }
    for (const sh of this.shipments.values()) {
      if (
        sh.trackingNumber.toUpperCase() === clean.toUpperCase() ||
        sh.awbCode.toUpperCase() === clean.toUpperCase()
      ) {
        return sh;
      }
    }
    return null;
  }

  async findByAwbCode(awbCode: string): Promise<ShipmentRecord | null> {
    return this.findByTrackingNumber(awbCode);
  }

  async updateShipment(id: string, updates: Partial<ShipmentRecord>): Promise<ShipmentRecord | null> {
    const existing = this.shipments.get(id);
    const prisma = getPrismaClient();
    let base = existing;
    if (!base && prisma?.shipment) {
      const row = await prisma.shipment.findUnique({ where: { id } }).catch(() => null);
      if (row) base = this.mapPrismaShipment(row);
    }
    if (!base) return null;

    const updated: ShipmentRecord = { ...base, ...updates, updatedAt: new Date() };
    this.shipments.set(id, updated);

    if (prisma?.shipment) {
      try {
        await prisma.shipment.update({
          where: { id },
          data: {
            courierPartner: updated.carrier,
            carrierShipmentId: updated.carrierShipmentId || null,
            trackingNumber: updated.awbCode || updated.trackingNumber,
            trackingUrl: updated.trackingUrl || null,
            labelUrl: updated.shippingLabelUrl || null,
            status: updated.status,
            deliveredAt: updated.actualDeliveryDate || null,
          },
        });
      } catch (err) {
        console.warn('[ShippingRepo] Prisma updateShipment warning:', err);
      }
    }
    return updated;
  }

  async addTrackingEvent(event: TrackingEventRecord): Promise<void> {
    const list = this.trackingEvents.get(event.shipmentId) || [];
    list.push(event);
    this.trackingEvents.set(event.shipmentId, list);

    const prisma = getPrismaClient();
    if (prisma?.shipmentTrackingEvent) {
      try {
        const shExists = await prisma.shipment.findUnique({ where: { id: event.shipmentId }, select: { id: true } });
        if (shExists) {
          await prisma.shipmentTrackingEvent.create({
            data: {
              id: event.id,
              shipmentId: event.shipmentId,
              status: event.status,
              location: event.location || null,
              activityDescription: event.description,
              eventTimestamp: event.timestamp,
            },
          });
        }
      } catch {}
    }
  }

  async getTrackingEvents(shipmentId: string): Promise<TrackingEventRecord[]> {
    const prisma = getPrismaClient();
    if (prisma?.shipmentTrackingEvent) {
      try {
        const rows = await prisma.shipmentTrackingEvent.findMany({
          where: { shipmentId },
          orderBy: { eventTimestamp: 'asc' },
        });
        if (rows.length > 0) {
          return rows.map((r: any) => ({
            id: r.id,
            shipmentId: r.shipmentId,
            status: r.status,
            location: r.location || '',
            description: r.activityDescription,
            timestamp: new Date(r.eventTimestamp),
          }));
        }
      } catch {}
    }
    return this.trackingEvents.get(shipmentId) || [];
  }
}

export const shippingRepository = new ShippingRepository();
