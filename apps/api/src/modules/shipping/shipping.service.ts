import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantAccessService } from '../../common/access/tenant-access.service';
import {
  SHIPPING_PROVIDER,
  ShippingProvider,
} from '../integrations/shipping/shipping-provider.interface';

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    @Inject(SHIPPING_PROVIDER) private readonly provider: ShippingProvider,
  ) {}

  async getForCustomer(customerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== customerId)
      throw new ForbiddenException('Not your order');

    return this.prisma.shipment.findUnique({
      where: { orderId },
      include: { events: { orderBy: { occurredAt: 'asc' } } },
    });
  }

  // blueprint §13 stage diagram: ORDER -> READY -> SHIPMENT CREATED -> ...
  // Called by a merchant once an order (requires_shipping items) is packed.
  async createShipment(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');
    await this.access.assertStoreAccess(userId, order.storeId);

    const { trackingNumber, labelUrl } = await this.provider.createShipment({
      orderId,
      destinationCity: '',
    });

    return this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          orderId,
          provider: this.provider.name,
          trackingNumber,
          labelUrl,
          status: 'label_created',
        },
      });
      await tx.shipmentEvent.create({
        data: { shipmentId: shipment.id, status: 'label_created' },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'ready' },
      });
      return shipment;
    });
  }
}
