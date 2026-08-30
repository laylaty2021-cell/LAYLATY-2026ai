import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { OrdersService } from './orders.service';

@Controller('merchant/stores/:storeId/orders')
@UseGuards(JwtAuthGuard)
export class MerchantOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query('status') status?: OrderStatus,
  ) {
    return this.ordersService.listForStore(user.id, storeId, status);
  }
}
