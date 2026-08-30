import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ShippingService } from './shipping.service';

@Controller('merchant/orders/:orderId/shipment')
@UseGuards(JwtAuthGuard)
export class MerchantShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    return this.shippingService.createShipment(user.id, orderId);
  }
}
