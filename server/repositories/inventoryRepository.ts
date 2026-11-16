import fs from 'fs';
import path from 'path';
import { getPrismaClient } from '../db/prisma';
import { productRepository } from './productRepository';
import { resolveSecureStorePath } from '../utils/storageHelper';

const STORE_PATH = resolveSecureStorePath('inventory-store.json', 'public/generated-assets/inventory-store.json');

export interface InventoryItemRecord {
  id: string;
  variantId: string;
  sku: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  lowStockAlert: boolean;
  threshold: number;
  updatedAt: Date;
}

export interface ActiveReservationRecord {
  id: string;
  variantId: string;
  sku: string;
  orderId: string;
  quantity: number;
  expiresAt: number;
  createdAt: number;
}

export interface InventoryMovementRecord {
  id: string;
  variantId: string;
  sku: string;
  movementType:
    | 'RESTOCK'
    | 'ORDER_FULFILLMENT'
    | 'DAMAGE'
    | 'RETURN_RESTOCK'
    | 'AUDIT_ADJUSTMENT'
    | 'ORDER_RESERVED'
    | 'ORDER_RELEASED';
  quantityDelta: number;
  previousQuantity: number;
  newQuantity: number;
  referenceId?: string;
  reason?: string;
  operatorId: string;
  createdAt: Date;
}

export class InventoryRepository {
  private fallbackInventory = new Map<string, InventoryItemRecord>();
  private fallbackMovements: InventoryMovementRecord[] = [];
  private fallbackReservations: ActiveReservationRecord[] = [];
  private locks = new Map<string, Promise<void>>();
  private initialized = false;
  private loadedFromDisk = false;
  private lastMtime = 0;

  constructor() {
    this.ensureLoaded();
    // Periodically expire lingering reservations every 60 seconds
    setInterval(() => {
      this.cleanupExpiredReservations().catch(() => {});
    }, 60000).unref();
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
        if (parsed && Array.isArray(parsed.items)) {
          this.fallbackInventory.clear();
          for (const it of parsed.items) {
            this.fallbackInventory.set(it.variantId, {
              ...it,
              updatedAt: new Date(it.updatedAt || Date.now()),
            });
          }
          if (Array.isArray(parsed.movements)) {
            this.fallbackMovements = parsed.movements.map((m: any) => ({
              ...m,
              createdAt: new Date(m.createdAt || Date.now()),
            }));
          }
          if (Array.isArray(parsed.reservations)) {
            this.fallbackReservations = parsed.reservations;
          }
          this.lastMtime = stat.mtimeMs;
          this.loadedFromDisk = true;
          this.initialized = true;
          return;
        }
      }
    } catch (err) {
      console.warn('[InventoryRepo] Could not load inventory store file:', err);
    }

    if (!this.initialized) {
      this.initialized = true;
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        items: Array.from(this.fallbackInventory.values()),
        movements: this.fallbackMovements.slice(0, 1000),
        reservations: this.fallbackReservations,
        lastUpdated: new Date().toISOString(),
      };
      const tempPath = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, STORE_PATH);
      try {
        this.lastMtime = fs.statSync(STORE_PATH).mtimeMs;
      } catch {}
    } catch (err) {
      console.error('[InventoryRepo] Failed to persist inventory to disk:', err);
    }
  }

  private async syncPrisma(item: InventoryItemRecord) {
    const prisma = getPrismaClient();
    if (prisma?.inventory) {
      try {
        let targetVariantId = item.variantId;
        const exists = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
        if (!exists) {
          const bySku = item.sku ? await prisma.productVariant.findUnique({ where: { sku: item.sku } }) : null;
          if (bySku) {
            targetVariantId = bySku.id;
          } else {
            return;
          }
        }
        await prisma.inventory.upsert({
          where: { variantId: targetVariantId },
          create: {
            variantId: targetVariantId,
            warehouseLocation: 'MAIN_MUMBAI',
            quantityOnHand: item.quantityOnHand,
            quantityReserved: item.quantityReserved,
            quantityAvailable: item.quantityAvailable,
            safetyStock: item.threshold || 5,
            reorderPoint: 15,
          },
          update: {
            quantityOnHand: item.quantityOnHand,
            quantityReserved: item.quantityReserved,
            quantityAvailable: item.quantityAvailable,
          },
        });
      } catch (err) {
        // quiet fallback
      }
    }
  }

  /**
   * Acquire a per-variant lock to prevent race conditions during concurrent orders.
   */
  private async acquireLock(variantId: string): Promise<() => void> {
    while (this.locks.has(variantId)) {
      await this.locks.get(variantId);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.locks.set(variantId, lockPromise);

    return () => {
      this.locks.delete(variantId);
      resolveLock();
    };
  }

  async getByVariantId(variantId: string): Promise<InventoryItemRecord | null> {
    this.ensureLoaded();
    const prisma = getPrismaClient();
    if (prisma?.inventory) {
      try {
        let found = await prisma.inventory.findUnique({
          where: { variantId },
        });
        if (!found) {
          const pv = await prisma.productVariant.findFirst({
            where: { OR: [{ id: variantId }, { sku: variantId }] },
          });
          if (pv) {
            found = await prisma.inventory.findUnique({
              where: { variantId: pv.id },
            });
          }
        }
        if (found) return found as unknown as InventoryItemRecord;
      } catch (e) {
        // Fallback
      }
    }

    let item = this.fallbackInventory.get(variantId);
    if (!item) {
      for (const it of this.fallbackInventory.values()) {
        if (it.variantId === variantId || (it.sku && it.sku === variantId)) {
          item = it;
          break;
        }
      }
    }
    if (!item) {
      const variant = await productRepository.getVariantById(variantId);
      if (variant) {
        for (const it of this.fallbackInventory.values()) {
          if (it.variantId === variant.id || (variant.sku && it.sku === variant.sku)) {
            item = it;
            break;
          }
        }
        if (!item) {
          item = {
            id: `inv-${variant.id}`,
            variantId: variant.id,
            sku: variant.sku,
            quantityOnHand: variant.stock,
            quantityReserved: variant.reservedStock || 0,
            quantityAvailable: variant.stock - (variant.reservedStock || 0),
            lowStockAlert: variant.stock <= 5,
            threshold: 5,
            updatedAt: new Date(),
          };
          this.fallbackInventory.set(variant.id, item);
          this.saveToDisk();
        }
      }
    }
    return item || null;
  }

  async getBySku(sku: string): Promise<InventoryItemRecord | null> {
    this.ensureLoaded();
    for (const item of this.fallbackInventory.values()) {
      if (item.sku === sku) return item;
    }
    return null;
  }

  async updateStock(
    variantId: string,
    delta: number,
    type: InventoryMovementRecord['movementType'],
    operatorId: string,
    reason?: string,
    referenceId?: string
  ): Promise<InventoryItemRecord> {
    this.ensureLoaded();
    if (!variantId || variantId.trim().length === 0) {
      console.warn('[InventoryRepo] updateStock called with empty variantId, returning dummy');
      return { id: 'dummy', variantId: '', sku: '', quantityOnHand: 0, quantityReserved: 0, quantityAvailable: 0, lowStockAlert: false, threshold: 0, updatedAt: new Date() };
    }
    const release = await this.acquireLock(variantId);

    try {
      // 1. Idempotency Check: if referenceId matches an existing movement, do not double-process
      if (referenceId && referenceId.trim().length > 0) {
        const cleanRef = referenceId.trim();
        const existingMovement = this.fallbackMovements.find((m) => m.referenceId === cleanRef);
        if (existingMovement) {
          console.log(`[InventoryRepo] Idempotent hit: movement ${cleanRef} already recorded. Returning current stock.`);
          const current = this.fallbackInventory.get(variantId);
          if (current) return current;
        }
      }

      let current = this.fallbackInventory.get(variantId);
      if (!current) {
        for (const it of this.fallbackInventory.values()) {
          if (it.variantId === variantId || (it.sku && it.sku === variantId)) {
            current = it;
            break;
          }
        }
      }
      if (!current) {
        const variant = await productRepository.getVariantById(variantId);
        if (variant) {
          for (const it of this.fallbackInventory.values()) {
            if (it.variantId === variant.id || (variant.sku && it.sku === variant.sku)) {
              current = it;
              break;
            }
          }
        }
        if (!current) {
          const initialStock = variant ? variant.stock : 20;
          current = {
            id: `inv-${variant?.id || variantId}`,
            variantId: variant?.id || variantId,
            sku: variant?.sku || `SKU-${variantId}`,
            quantityOnHand: initialStock,
            quantityReserved: 0,
            quantityAvailable: initialStock,
            lowStockAlert: initialStock <= 5,
            threshold: 5,
            updatedAt: new Date(),
          };
          this.fallbackInventory.set(current.variantId, current);
        }
      }

      if (current && current.variantId !== variantId) {
        this.fallbackInventory.set(variantId, current);
      }

      const previousQuantity = current.quantityOnHand;

      // 2. Strict Negative Inventory & Overselling Prevention
      if (delta < 0 && previousQuantity + delta < 0) {
        throw new Error(
          `Insufficient stock for item (${current.sku}): Available ${previousQuantity}, requested ${Math.abs(delta)}.`
        );
      }

      const newQuantity = previousQuantity + delta;
      current.quantityOnHand = newQuantity;
      current.quantityAvailable = Math.max(0, newQuantity - current.quantityReserved);
      current.lowStockAlert = current.quantityAvailable <= current.threshold;
      current.updatedAt = new Date();

      const movement: InventoryMovementRecord = {
        id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        variantId,
        sku: current.sku,
        movementType: type,
        quantityDelta: delta,
        previousQuantity,
        newQuantity,
        referenceId,
        operatorId,
        reason,
        createdAt: new Date(),
      };

      this.fallbackMovements.unshift(movement);
      this.saveToDisk();
      await this.syncPrisma(current);

      // Sync variant stock to product repository and disk
      try {
        await productRepository.updateVariantStock(variantId, newQuantity);
        if (current.sku) {
          await productRepository.updateVariantStock(current.sku, newQuantity);
        }
      } catch (err) {
        console.warn('[InventoryRepo] Warning syncing variant stock to product repository:', err);
      }

      return current;
    } finally {
      release();
    }
  }

  /**
   * Idempotently deduct stock for an order item.
   * If already deducted for this order + variant, skips deduction.
   */
  async deductStock(
    variantId: string,
    quantity: number,
    reason: string,
    orderId?: string
  ): Promise<InventoryItemRecord> {
    const referenceId = orderId ? `ORDER_DEDUCT_${orderId}_${variantId}` : undefined;
    return this.updateStock(
      variantId,
      -Math.abs(quantity),
      'ORDER_FULFILLMENT',
      orderId || 'ORDER_SERVICE',
      reason || 'Order stock allocation',
      referenceId
    );
  }

  /**
   * Idempotently restore stock for a cancelled/returned order item.
   * If already restored for this order + variant, skips restoration.
   */
  async restoreStock(
    variantId: string,
    quantity: number,
    reason: string,
    orderId?: string
  ): Promise<InventoryItemRecord> {
    const referenceId = orderId ? `ORDER_RESTOCK_${orderId}_${variantId}` : undefined;
    return this.updateStock(
      variantId,
      Math.abs(quantity),
      'RETURN_RESTOCK',
      orderId || 'ORDER_SERVICE',
      reason || 'Order stock restoration',
      referenceId
    );
  }

  /**
   * Atomic stock reservation during checkout.
   * Holds the unit for the customer with an expiration TTL (default 15 minutes).
   * Prevents simultaneous customers from reserving the same stock.
   */
  async reserveStock(
    variantId: string,
    quantity: number,
    orderId: string,
    ttlMinutes = 15
  ): Promise<InventoryItemRecord> {
    this.ensureLoaded();
    await this.cleanupExpiredReservations();

    const release = await this.acquireLock(variantId);
    try {
      // Idempotency: if already reserved for this order + variant
      const existing = this.fallbackReservations.find(
        (r) => r.orderId === orderId && r.variantId === variantId
      );
      if (existing) {
        const cur = this.fallbackInventory.get(variantId);
        if (cur) return cur;
      }

      let current = await this.getByVariantId(variantId);
      if (!current) {
        throw new Error(`Inventory item for variant ${variantId} not found.`);
      }

      if (current.quantityAvailable < quantity) {
        throw new Error(
          `Insufficient stock for item (${current.sku}): Available ${current.quantityAvailable}, requested ${quantity}.`
        );
      }

      current.quantityReserved += quantity;
      current.quantityAvailable = Math.max(0, current.quantityOnHand - current.quantityReserved);
      current.lowStockAlert = current.quantityAvailable <= current.threshold;
      current.updatedAt = new Date();

      const reservation: ActiveReservationRecord = {
        id: `res-${orderId}-${variantId}`,
        variantId,
        sku: current.sku,
        orderId,
        quantity,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttlMinutes * 60 * 1000,
      };
      this.fallbackReservations.push(reservation);

      this.fallbackMovements.unshift({
        id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        variantId,
        sku: current.sku,
        movementType: 'ORDER_RESERVED',
        quantityDelta: 0,
        previousQuantity: current.quantityAvailable + quantity,
        newQuantity: current.quantityAvailable,
        referenceId: `RES_${orderId}_${variantId}`,
        operatorId: orderId,
        reason: `Checkout reservation held for ${ttlMinutes}m`,
        createdAt: new Date(),
      });

      this.saveToDisk();
      await this.syncPrisma(current);
      return current;
    } finally {
      release();
    }
  }

  /**
   * Release reservation if checkout is abandoned, expired, or payment failed.
   */
  async releaseReservation(
    variantId: string,
    quantity: number,
    orderId: string,
    reason = 'Checkout reservation released'
  ): Promise<InventoryItemRecord | null> {
    this.ensureLoaded();
    const release = await this.acquireLock(variantId);
    try {
      const resIndex = this.fallbackReservations.findIndex(
        (r) => r.orderId === orderId && r.variantId === variantId
      );
      const reservation = resIndex !== -1 ? this.fallbackReservations[resIndex] : null;
      const releaseQty = reservation ? reservation.quantity : quantity;

      if (resIndex !== -1) {
        this.fallbackReservations.splice(resIndex, 1);
      }

      const current = this.fallbackInventory.get(variantId);
      if (!current) return null;

      current.quantityReserved = Math.max(0, current.quantityReserved - releaseQty);
      current.quantityAvailable = Math.max(0, current.quantityOnHand - current.quantityReserved);
      current.lowStockAlert = current.quantityAvailable <= current.threshold;
      current.updatedAt = new Date();

      this.fallbackMovements.unshift({
        id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        variantId,
        sku: current.sku,
        movementType: 'ORDER_RELEASED',
        quantityDelta: 0,
        previousQuantity: current.quantityAvailable - releaseQty,
        newQuantity: current.quantityAvailable,
        referenceId: `REL_${orderId}_${variantId}`,
        operatorId: orderId,
        reason,
        createdAt: new Date(),
      });

      this.saveToDisk();
      await this.syncPrisma(current);
      return current;
    } finally {
      release();
    }
  }

  /**
   * Permanently deduct reserved stock exactly once upon verified payment.
   */
  async commitReservation(
    variantId: string,
    quantity: number,
    orderId: string
  ): Promise<InventoryItemRecord> {
    this.ensureLoaded();
    const release = await this.acquireLock(variantId);
    try {
      const referenceId = `ORDER_DEDUCT_${orderId}_${variantId}`;
      const existing = this.fallbackMovements.find((m) => m.referenceId === referenceId);
      if (existing) {
        const cur = this.fallbackInventory.get(variantId);
        if (cur) return cur;
      }

      const resIndex = this.fallbackReservations.findIndex(
        (r) => r.orderId === orderId && r.variantId === variantId
      );
      if (resIndex !== -1) {
        this.fallbackReservations.splice(resIndex, 1);
      }

      let current: InventoryItemRecord | null | undefined = this.fallbackInventory.get(variantId);
      if (!current) {
        current = await this.getByVariantId(variantId);
      }
      if (!current) {
        throw new Error(`Inventory item for variant ${variantId} not found.`);
      }

      const prevOnHand = current.quantityOnHand;
      if (prevOnHand - quantity < 0) {
        throw new Error(
          `Insufficient stock to fulfill item (${current.sku}): Available ${prevOnHand}, requested ${quantity}.`
        );
      }

      current.quantityReserved = Math.max(0, current.quantityReserved - quantity);
      current.quantityOnHand = prevOnHand - quantity;
      current.quantityAvailable = Math.max(0, current.quantityOnHand - current.quantityReserved);
      current.lowStockAlert = current.quantityAvailable <= current.threshold;
      current.updatedAt = new Date();

      this.fallbackMovements.unshift({
        id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        variantId,
        sku: current.sku,
        movementType: 'ORDER_FULFILLMENT',
        quantityDelta: -quantity,
        previousQuantity: prevOnHand,
        newQuantity: current.quantityOnHand,
        referenceId,
        operatorId: orderId,
        reason: `Payment verified & order ${orderId} fulfilled`,
        createdAt: new Date(),
      });

      this.saveToDisk();
      await this.syncPrisma(current);

      try {
        await productRepository.updateVariantStock(variantId, current.quantityOnHand);
        if (current.sku) {
          await productRepository.updateVariantStock(current.sku, current.quantityOnHand);
        }
      } catch (err) {
        console.warn('[InventoryRepo] Warning syncing stock to product repo:', err);
      }

      return current;
    } finally {
      release();
    }
  }

  /**
   * Sweeps and automatically releases expired reservations.
   */
  async cleanupExpiredReservations(): Promise<number> {
    const now = Date.now();
    const expired = this.fallbackReservations.filter((r) => r.expiresAt < now);
    if (expired.length === 0) return 0;

    for (const exp of expired) {
      try {
        await this.releaseReservation(
          exp.variantId,
          exp.quantity,
          exp.orderId,
          'Checkout hold expired (TTL 15m elapsed)'
        );
      } catch (err) {
        console.warn('[InventoryRepo] Error releasing expired reservation:', err);
      }
    }
    return expired.length;
  }

  async setStock(
    variantId: string,
    newStock: number,
    operatorId: string,
    reason?: string
  ): Promise<InventoryItemRecord> {
    this.ensureLoaded();
    const release = await this.acquireLock(variantId);
    try {
      this.fallbackReservations = this.fallbackReservations.filter((r) => r.variantId !== variantId);

      let current: InventoryItemRecord | null | undefined = this.fallbackInventory.get(variantId);
      if (!current) {
        current = await this.getByVariantId(variantId);
      }

      if (!current) {
        const variant = await productRepository.getVariantById(variantId);
        current = {
          id: `inv-${variantId}`,
          variantId,
          sku: variant?.sku || `SKU-${variantId}`,
          quantityOnHand: newStock,
          quantityReserved: 0,
          quantityAvailable: newStock,
          lowStockAlert: newStock <= 5,
          threshold: 5,
          updatedAt: new Date(),
        };
        this.fallbackInventory.set(variantId, current);
      } else {
        const prev = current.quantityOnHand;
        current.quantityReserved = 0;
        current.quantityOnHand = newStock;
        current.quantityAvailable = newStock;
        current.lowStockAlert = newStock <= current.threshold;
        current.updatedAt = new Date();

        this.fallbackMovements.unshift({
          id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          variantId,
          sku: current.sku,
          movementType: 'AUDIT_ADJUSTMENT',
          quantityDelta: newStock - prev,
          previousQuantity: prev,
          newQuantity: newStock,
          operatorId,
          reason: reason || 'Manual stock override',
          createdAt: new Date(),
        });
      }

      this.saveToDisk();
      await this.syncPrisma(current);

      try {
        await productRepository.updateVariantStock(variantId, newStock);
        if (current.sku) {
          await productRepository.updateVariantStock(current.sku, newStock);
        }
      } catch (err) {}

      return current;
    } finally {
      release();
    }
  }

  async deleteItem(variantId: string, operatorId: string = 'ADMIN', reason: string = 'Manual deletion in Admin'): Promise<boolean> {
    this.ensureLoaded();
    const release = await this.acquireLock(variantId);
    try {
      const current = await this.getByVariantId(variantId);
      if (!current) return false;

      // 1. Remove from in-memory fallbackInventory
      this.fallbackInventory.delete(variantId);
      this.fallbackInventory.delete(current.variantId);
      if (current.sku) {
        this.fallbackInventory.delete(current.sku);
      }
      for (const [key, val] of this.fallbackInventory.entries()) {
        if (val.variantId === variantId || val.variantId === current.variantId || val.sku === current.sku || val.id === current.id) {
          this.fallbackInventory.delete(key);
        }
      }

      // 2. Remove from PostgreSQL Prisma if active
      const prisma = getPrismaClient();
      if (prisma?.inventory) {
        try {
          await prisma.inventory.deleteMany({
            where: {
              OR: [
                { variantId },
                { variantId: current.variantId },
                { id: current.id },
              ],
            },
          });
        } catch (err) {
          console.warn('[InventoryRepo] Error deleting from Prisma inventory:', err);
        }
      }

      // 3. Record movement audit
      const movement: InventoryMovementRecord = {
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        variantId: current.variantId,
        sku: current.sku,
        movementType: 'AUDIT_ADJUSTMENT',
        quantityDelta: -current.quantityAvailable,
        previousQuantity: current.quantityAvailable,
        newQuantity: 0,
        reason: `Item Deleted: ${reason}`,
        operatorId,
        createdAt: new Date(),
      };
      this.fallbackMovements.unshift(movement);
      if (this.fallbackMovements.length > 500) {
        this.fallbackMovements = this.fallbackMovements.slice(0, 500);
      }

      this.saveToDisk();
      return true;
    } finally {
      release();
    }
  }

  async syncProductVariants(
    variants: Array<{ id: string; sku: string; stock?: number; reservedStock?: number }>
  ): Promise<void> {
    this.ensureLoaded();
    if (!Array.isArray(variants) || variants.length === 0) return;

    let changed = false;
    for (const v of variants) {
      if (!v.id) continue;
      const existing = this.fallbackInventory.get(v.id);
      const stockVal = Math.max(0, Number(v.stock ?? 0));
      const reservedVal = Math.max(0, Number(v.reservedStock ?? existing?.quantityReserved ?? 0));
      const availableVal = Math.max(0, stockVal - reservedVal);
      if (existing) {
        existing.sku = v.sku || existing.sku;
        existing.quantityOnHand = stockVal;
        existing.quantityReserved = reservedVal;
        existing.quantityAvailable = availableVal;
        existing.lowStockAlert = availableVal <= existing.threshold;
        existing.updatedAt = new Date();
        this.fallbackInventory.set(v.id, existing);
      } else {
        this.fallbackInventory.set(v.id, {
          id: `inv-${v.id}`,
          variantId: v.id,
          sku: v.sku || `SKU-${v.id}`,
          quantityOnHand: stockVal,
          quantityReserved: reservedVal,
          quantityAvailable: availableVal,
          lowStockAlert: availableVal <= 5,
          threshold: 5,
          updatedAt: new Date(),
        });
      }
      changed = true;
    }

    if (changed) {
      this.loadedFromDisk = true;
      this.saveToDisk();
    }
  }

  async deleteByVariantIds(variantIds: string[]): Promise<void> {
    this.ensureLoaded();
    if (!Array.isArray(variantIds) || variantIds.length === 0) return;
    let changed = false;
    for (const vid of variantIds) {
      if (this.fallbackInventory.delete(vid)) changed = true;
      for (const [k, val] of this.fallbackInventory.entries()) {
        if (val.variantId === vid || val.sku === vid || val.id === vid) {
          this.fallbackInventory.delete(k);
          changed = true;
        }
      }
    }
    if (changed) {
      this.loadedFromDisk = true;
      this.saveToDisk();
    }
  }

  async bulkDelete(
    targetIds: string[],
    operatorId: string = 'ADMIN',
    reason: string = 'Bulk product removal / Warehouse clearance'
  ): Promise<{ deletedCount: number; deletedVariantIds: string[]; deletedSkus: string[] }> {
    this.ensureLoaded();
    const cleanIds = Array.from(
      new Set(
        (targetIds || [])
          .map((x) => (typeof x === 'string' ? x.trim() : ''))
          .filter((x) => x.length > 0 && x !== 'unlinked')
      )
    );
    if (cleanIds.length === 0) {
      return { deletedCount: 0, deletedVariantIds: [], deletedSkus: [] };
    }

    const targetSet = new Set(cleanIds);
    const deletedVariantIds: string[] = [];
    const deletedSkus: string[] = [];
    const deletedRecordIds: string[] = [];

    for (const [key, val] of Array.from(this.fallbackInventory.entries())) {
      const isMatch =
        targetSet.has(key) ||
        targetSet.has(val.id) ||
        targetSet.has(val.variantId) ||
        (val.sku && targetSet.has(val.sku));

      if (isMatch) {
        this.fallbackInventory.delete(key);
        deletedVariantIds.push(val.variantId);
        if (val.sku) deletedSkus.push(val.sku);
        deletedRecordIds.push(val.id);

        this.fallbackMovements.unshift({
          id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          variantId: val.variantId,
          sku: val.sku,
          movementType: 'AUDIT_ADJUSTMENT',
          quantityDelta: -val.quantityAvailable,
          previousQuantity: val.quantityAvailable,
          newQuantity: 0,
          reason: `Bulk Deleted: ${reason}`,
          operatorId,
          createdAt: new Date(),
        });
      }
    }

    if (this.fallbackMovements.length > 500) {
      this.fallbackMovements = this.fallbackMovements.slice(0, 500);
    }

    const prisma = getPrismaClient();
    if (prisma?.inventory && (deletedVariantIds.length > 0 || deletedRecordIds.length > 0)) {
      try {
        await prisma.inventory.deleteMany({
          where: {
            OR: [
              { variantId: { in: deletedVariantIds } },
              { id: { in: deletedRecordIds } },
            ],
          },
        });
      } catch (err) {
        console.warn('[InventoryRepo] Error bulk deleting from Prisma inventory:', err);
      }
    }

    if (deletedVariantIds.length > 0) {
      this.loadedFromDisk = true;
      this.saveToDisk();
    }

    return {
      deletedCount: deletedVariantIds.length,
      deletedVariantIds: Array.from(new Set(deletedVariantIds)),
      deletedSkus: Array.from(new Set(deletedSkus)),
    };
  }

  async syncFromProducts(): Promise<{ addedCount: number; totalCount: number }> {
    this.ensureLoaded();
    const prods = await productRepository.getAll({ status: 'ALL' });
    let addedCount = 0;

    for (const p of prods) {
      if (!Array.isArray(p.variants)) continue;
      for (const v of p.variants) {
        if (!v.id) continue;
        const alreadyExists =
          this.fallbackInventory.has(v.id) ||
          Array.from(this.fallbackInventory.values()).some((it) => it.sku === v.sku);
        if (!alreadyExists) {
          const stockVal = Math.max(0, Number(v.stock ?? 0));
          const reservedVal = Math.max(0, Number(v.reservedStock ?? 0));
          const availableVal = Math.max(0, stockVal - reservedVal);
          this.fallbackInventory.set(v.id, {
            id: `inv-${v.id}`,
            variantId: v.id,
            sku: v.sku || `SKU-${v.id}`,
            quantityOnHand: stockVal,
            quantityReserved: reservedVal,
            quantityAvailable: availableVal,
            lowStockAlert: availableVal <= 5,
            threshold: 5,
            updatedAt: new Date(),
          });
          addedCount++;
        }
      }
    }

    if (addedCount > 0) {
      this.loadedFromDisk = true;
      this.saveToDisk();
    }

    return { addedCount, totalCount: this.fallbackInventory.size };
  }

  async clearAll(): Promise<void> {
    this.fallbackInventory.clear();
    this.fallbackMovements = [];
    this.fallbackReservations = [];

    const prisma = getPrismaClient();
    if (prisma?.inventory) {
      try {
        await prisma.stockReservation?.deleteMany?.({});
        await prisma.inventoryMovement?.deleteMany?.({});
        await prisma.inventory.deleteMany({});
      } catch (err) {
        console.warn('[InventoryRepo] Prisma clearAll error:', err);
      }
    }

    this.loadedFromDisk = true;
    this.saveToDisk();
    console.log('[InventoryRepo] Cleared all inventory records from memory and disk store.');
  }

  async getAll(): Promise<InventoryItemRecord[]> {
    this.ensureLoaded();
    if (!this.loadedFromDisk && this.fallbackInventory.size === 0) {
      const prods = await productRepository.getAll();
      for (const p of prods) {
        if (p.variants) {
          for (const v of p.variants) {
            if (!this.fallbackInventory.has(v.id)) {
              this.fallbackInventory.set(v.id, {
                id: `inv-${v.id}`,
                variantId: v.id,
                sku: v.sku,
                quantityOnHand: v.stock,
                quantityReserved: v.reservedStock || 0,
                quantityAvailable: v.stock - (v.reservedStock || 0),
                lowStockAlert: v.stock <= 5,
                threshold: 5,
                updatedAt: new Date(),
              });
            }
          }
        }
      }
      this.loadedFromDisk = true;
      this.saveToDisk();
    }
    return Array.from(this.fallbackInventory.values());
  }

  async getMovements(limit = 50): Promise<InventoryMovementRecord[]> {
    this.ensureLoaded();
    return this.fallbackMovements.slice(0, limit);
  }
}

export const inventoryRepository = new InventoryRepository();
