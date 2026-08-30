import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantAccessService } from '../../common/access/tenant-access.service';

type Tx = Prisma.TransactionClient;

// Owns the reserve -> confirm|release lifecycle described in
// docs/database/erd.md §3: available stock is always
// `quantity_on_hand - quantity_reserved`, and every movement is logged so
// the trail is auditable. Every method here is meant to run inside the
// caller's own transaction (Cart/Order/Payment), which is why they all
// take a `tx` client rather than using `this.prisma` directly.
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
  ) {}

  async createLocation(
    userId: string,
    storeId: string,
    name: string,
    address?: string,
  ) {
    await this.access.assertStoreAccess(userId, storeId);
    return this.prisma.inventoryLocation.create({
      data: { storeId, name, address },
    });
  }

  async listLocations(userId: string, storeId: string) {
    await this.access.assertStoreAccess(userId, storeId);
    return this.prisma.inventoryLocation.findMany({ where: { storeId } });
  }

  async setStock(
    userId: string,
    storeId: string,
    variantId: string,
    locationId: string,
    quantityOnHand: number,
  ) {
    await this.access.assertStoreAccess(userId, storeId);
    return this.prisma.inventoryStock.upsert({
      where: { variantId_locationId: { variantId, locationId } },
      create: { variantId, locationId, quantityOnHand },
      update: { quantityOnHand },
    });
  }

  // Picks the stock row with the most available quantity for this variant
  // and reserves `quantity` against it. Throws if no location can cover it
  // — this deliberately does not split a reservation across locations.
  async reserve(
    tx: Tx,
    variantId: string,
    quantity: number,
    referenceType: string,
    referenceId: string,
  ) {
    const candidates = await tx.inventoryStock.findMany({
      where: { variantId },
    });
    const best = candidates
      .map((s) => ({ ...s, available: s.quantityOnHand - s.quantityReserved }))
      .filter((s) => s.available >= quantity)
      .sort((a, b) => b.available - a.available)[0];

    if (!best) {
      throw new ConflictException('Insufficient stock for this item');
    }

    await tx.inventoryStock.update({
      where: { id: best.id },
      data: { quantityReserved: { increment: quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        stockId: best.id,
        movementType: 'reserve',
        quantity,
        referenceType,
        referenceId,
      },
    });
  }

  async release(tx: Tx, referenceType: string, referenceId: string) {
    await this.closeReservation(
      tx,
      referenceType,
      referenceId,
      'release',
      (stock, qty) =>
        tx.inventoryStock.update({
          where: { id: stock.id },
          data: { quantityReserved: { decrement: qty } },
        }),
    );
  }

  async confirm(tx: Tx, referenceType: string, referenceId: string) {
    await this.closeReservation(
      tx,
      referenceType,
      referenceId,
      'confirm',
      (stock, qty) =>
        tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            quantityReserved: { decrement: qty },
            quantityOnHand: { decrement: qty },
          },
        }),
    );
  }

  private async closeReservation(
    tx: Tx,
    referenceType: string,
    referenceId: string,
    closingType: 'confirm' | 'release',
    apply: (stock: { id: string }, quantity: number) => Promise<unknown>,
  ) {
    const alreadyClosed = await tx.inventoryMovement.findFirst({
      where: {
        referenceType,
        referenceId,
        movementType: { in: ['confirm', 'release'] },
      },
    });
    if (alreadyClosed) return; // idempotent: nothing left to reserve/release twice

    const reserveMovement = await tx.inventoryMovement.findFirst({
      where: { referenceType, referenceId, movementType: 'reserve' },
    });
    if (!reserveMovement) return; // nothing was ever reserved (non-inventoried item)

    await apply({ id: reserveMovement.stockId }, reserveMovement.quantity);
    await tx.inventoryMovement.create({
      data: {
        stockId: reserveMovement.stockId,
        movementType: closingType,
        quantity: reserveMovement.quantity,
        referenceType,
        referenceId,
      },
    });
  }
}
