import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { BookingsService } from './bookings.service';
import { CreateBookingResourceDto } from './dto/create-booking-resource.dto';
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';

@Controller('merchant/stores/:storeId/booking-resources')
@UseGuards(JwtAuthGuard)
export class MerchantBookingResourcesController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.bookingsService.listResources(user.id, storeId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: CreateBookingResourceDto,
  ) {
    return this.bookingsService.createResource(user.id, storeId, dto);
  }

  @Post(':resourceId/availability-rules')
  addAvailabilityRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('resourceId') resourceId: string,
    @Body() dto: CreateAvailabilityRuleDto,
  ) {
    return this.bookingsService.addAvailabilityRule(
      user.id,
      storeId,
      resourceId,
      dto,
    );
  }
}
