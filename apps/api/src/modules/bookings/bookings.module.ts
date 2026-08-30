import { Module } from '@nestjs/common';
import { MerchantBookingResourcesController } from './merchant-booking-resources.controller';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

// Owns: booking_resources, resource_availability_rules,
// resource_blackout_dates, bookings (docs/database/schema.sql §5).
// docs/backlog/sprint-backlog.md Sprint 7–8. See BookingsService.createHold
// for why this never does a separate check-then-insert.
@Module({
  controllers: [MerchantBookingResourcesController, BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
