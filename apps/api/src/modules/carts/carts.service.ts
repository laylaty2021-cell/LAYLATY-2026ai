import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { generateOrderNumber } from '../../common/utils/generate-order-number';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CheckoutDto } from './dto/checkout.dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async getOrCreateActiveCart(customerId: string, storeId: string) {
    const existing = await this.prisma.cart.findFirst({
      where: { customerId, storeId, status: 'active' },
      include: { items: true },
    });
    if (existing) return existing;

    return this.prisma.cart.create({
      data: { customerId, storeId, status: 'active' },
      include: { items: true },
    });
  }

  // Resolves an itemType/itemId into (name, unitPrice, requiresInventory).
  // Kept close to the "Sellable Item" polymorphism from
  // docs/database/erd.md §2 — every branch mirrors a row in products/
  // services/packages.
  private async resolveItem(tx: Tx, dto: AddCartItemDto) {
    if (dto.itemType === 'product') {
      const product = await tx.product.findUnique({
        where: { id: dto.itemId },
      });
      if (
        !product ||
        product.storeId !== dto.storeId ||
        product.status !== 'active'
      ) {
        throw new NotFoundException('Product not found');
      }
      if (dto.variantId) {
        const variant = await tx.productVariant.findUnique({
          where: { id: dto.variantId },
        });
        if (!variant || variant.productId !== product.id) {
          throw new NotFoundException('Variant not found');
        }
        return {
          name: product.name,
          unitPrice: variant.price,
          variantId: variant.id,
        };
      }
      return {
        name: product.name,
        unitPrice: product.basePrice,
        variantId: undefined,
      };
    }

    if (dto.itemType === 'service') {
      const service = await tx.service.findUnique({
        where: { id: dto.itemId },
      });
      if (
        !service ||
        service.storeId !== dto.storeId ||
        service.status !== 'active'
      ) {
        throw new NotFoundException('Service not found');
      }
      return {
        name: service.name,
        unitPrice: service.price,
        variantId: undefined,
      };
    }

    const pkg = await tx.package.findUnique({ where: { id: dto.itemId } });
    if (!pkg || pkg.storeId !== dto.storeId || pkg.status !== 'active') {
      throw new NotFoundException('Package not found');
    }
    return { name: pkg.name, unitPrice: pkg.price, variantId: undefined };
  }

  async addItem(customerId: string, dto: AddCartItemDto) {
    if (dto.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
      });
      if (
        !booking ||
        booking.customerId !== customerId ||
        booking.status !== 'held'
      ) {
        throw new BadRequestException(
          'Booking is not a valid, held booking of yours',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const cart =
        (await tx.cart.findFirst({
          where: { customerId, storeId: dto.storeId, status: 'active' },
        })) ??
        (await tx.cart.create({
          data: { customerId, storeId: dto.storeId, status: 'active' },
        }));

      const resolved = await this.resolveItem(tx, dto);
      const quantity = dto.quantity ?? 1;

      const cartItem = await tx.cartItem.create({
        data: {
          cartId: cart.id,
          itemType: dto.itemType,
          itemId: dto.itemId,
          variantId: resolved.variantId,
          bookingId: dto.bookingId,
          quantity,
          unitPrice: resolved.unitPrice,
        },
      });

      if (resolved.variantId) {
        await this.inventory.reserve(
          tx,
          resolved.variantId,
          quantity,
          'cart_item',
          cartItem.id,
        );
      }

      return tx.cart.findUniqueOrThrow({
        where: { id: cart.id },
        include: { items: true },
      });
    });
  }

  async removeItem(customerId: string, cartItemId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true },
    });
    if (!item || item.cart.customerId !== customerId) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.$transaction(async (tx) => {
      if (item.variantId) {
        await this.inventory.release(tx, 'cart_item', item.id);
      }
      await tx.cartItem.delete({ where: { id: item.id } });
    });
  }

  // blueprint §14 / sprint 9: cart -> order is one atomic transaction.
  // Line-item prices are snapshotted onto order_items so a later catalog
  // price change never rewrites a placed order's total.
  async checkout(customerId: string, dto: CheckoutDto) {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: { customerId, storeId: dto.storeId, status: 'active' },
        include: { items: true },
      });
      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      const subtotal = cart.items.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0,
      );

      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerId,
          storeId: dto.storeId,
          status: 'pending_payment',
          subtotal,
          totalAmount: subtotal,
          shippingAddressId: dto.shippingAddressId,
        },
      });

      for (const item of cart.items) {
        const nameSnapshot = await this.snapshotName(
          tx,
          item.itemType,
          item.itemId,
        );
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            itemType: item.itemType,
            itemId: item.itemId,
            variantId: item.variantId,
            bookingId: item.bookingId,
            nameSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: Number(item.unitPrice) * item.quantity,
          },
        });

        if (item.variantId) {
          // Re-key the reservation from the cart_item to the order_item
          // that now represents it — see InventoryService for why this is
          // a release+reserve pair rather than an in-place rename.
          await this.inventory.release(tx, 'cart_item', item.id);
          await this.inventory.reserve(
            tx,
            item.variantId,
            item.quantity,
            'order_item',
            orderItem.id,
          );
        }

        if (item.bookingId) {
          await tx.booking.update({
            where: { id: item.bookingId },
            data: { orderId: order.id },
          });
        }
      }

      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'converted' },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });
    });
  }

  private async snapshotName(tx: Tx, itemType: string, itemId: string) {
    if (itemType === 'product') {
      return (
        (await tx.product.findUnique({ where: { id: itemId } }))?.name ??
        'Product'
      );
    }
    if (itemType === 'service') {
      return (
        (await tx.service.findUnique({ where: { id: itemId } }))?.name ??
        'Service'
      );
    }
    return (
      (await tx.package.findUnique({ where: { id: itemId } }))?.name ??
      'Package'
    );
  }
}
