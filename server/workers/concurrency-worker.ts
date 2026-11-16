import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@127.0.0.1:5433/toriwear?schema=public&sslmode=disable';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

process.on('message', async (msg: any) => {
  const { id, action, variantId, quantity, orderId, ttlSeconds = 900 } = msg;

  if (action === 'reserve') {
    try {
      // Execute PostgreSQL conditional atomic update
      const updateResult: any[] = await prisma.$queryRaw`
        UPDATE "inventory"
        SET "quantityReserved" = "quantityReserved" + ${quantity},
            "quantityAvailable" = "quantityAvailable" - ${quantity},
            "updatedAt" = NOW()
        WHERE "variantId" = ${variantId} AND "quantityAvailable" >= ${quantity}
        RETURNING "id", "variantId", "quantityOnHand", "quantityReserved", "quantityAvailable"
      `;

      if (updateResult && updateResult.length > 0) {
        const row = updateResult[0];
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
          quantityAvailable: row.quantityAvailable,
          quantityOnHand: row.quantityOnHand,
          quantityReserved: row.quantityReserved,
        });
      } else {
        const [curr]: any[] = await prisma.$queryRaw`
          SELECT "quantityAvailable", "quantityOnHand" FROM "inventory" WHERE "variantId" = ${variantId}
        `;
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
