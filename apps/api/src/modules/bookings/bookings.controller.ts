import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { BookingsService } from './bookings.service';
import { QueryAvailabilityDto } from './dto/query-availability.dto';
import { CreateBookingHoldDto } from './dto/create-booking-hold.dto';

@Controller()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('booking-resources/:resourceId/availability')
  getAvailability(
    @Param('resourceId') resourceId: string,
    @Query() dto: QueryAvailabilityDto,
  ) {
    return this.bookingsService.getAvailability(resourceId, dto);
  }

  @Post('bookings')
  @UseGuards(JwtAuthGuard)
  createHold(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookingHoldDto,
  ) {
    return this.bookingsService.createHold(user.id, dto);
  }

  @Post('bookings/:bookingId/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.bookingsService.cancel(user.id, bookingId);
  }
}
