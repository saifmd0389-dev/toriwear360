import { PrismaClient } from '@prisma/client';
import { resolveMySqlConnectionConfig } from '../db/mysqlConfig';

const cfg = resolveMySqlConnectionConfig();
const prisma = new PrismaClient(
  cfg.url
    ? {
        datasources: {
          db: {
            url: cfg.url,
          },
        },
      }
    : undefined
);

process.on('message', async (msg: any) => {
  const { id, action, variantId, quantity, orderId, ttlSeconds = 900 } = msg;

  if (action === 'reserve') {
    try {
      // Execute MySQL conditional atomic update
      const affectedRows = await prisma.$executeRaw`
        UPDATE inventory
        SET quantityReserved = quantityReserved + ${quantity},
            quantityAvailable = quantityAvailable - ${quantity},
            updatedAt = NOW(3)
        WHERE variantId = ${variantId} AND quantityAvailable >= ${quantity}
      `;

      if (Number(affectedRows) > 0) {
        const row = await prisma.inventory.findUnique({
          where: { variantId },
          select: { id: true, variantId: true, quantityOnHand: true, quantityReserved: true, quantityAvailable: true },
        });
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

        await prisma.stockReservation.create({
          data: {
            id: `res-${orderId}-${variantId}-${Date.now()}`,
            variantId,
            orderId,
            quantity,
            expiresAt,
            status: 'ACTIVE',
          },
        });

        process.send?.({
          id,
          success: true,
          variantId,
          orderId,
          quantityAvailable: row?.quantityAvailable ?? 0,
          quantityOnHand: row?.quantityOnHand ?? 0,
          quantityReserved: row?.quantityReserved ?? 0,
        });
      } else {
        const curr = await prisma.inventory.findUnique({
          where: { variantId },
          select: { quantityAvailable: true, quantityOnHand: true },
        });
        process.send?.({
          id,
          success: false,
          variantId,
          orderId,
          error: `Insufficient stock for item (${variantId}): Available ${curr?.quantityAvailable ?? 0}, requested ${quantity}.`,
        });
      }
    } catch (err: any) {
      process.send?.({
        id,
        success: false,
        variantId,
        orderId,
        error: err.message,
      });
    }
  } else if (action === 'ping') {
    process.send?.({ id, success: true, pid: process.pid });
  }
});
