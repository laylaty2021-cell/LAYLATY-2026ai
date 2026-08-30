import { Module } from '@nestjs/common';

// Owns: booking_resources, resource_availability_rules,
// resource_blackout_dates, bookings (docs/database/schema.sql §5).
// Implemented in docs/backlog/sprint-backlog.md Sprint 7–8. The create-hold
// endpoint MUST rely on the DB-level EXCLUDE constraint
// (excl_bookings_no_overlap) for concurrency safety — never a separate
// check-then-insert (see docs/database/erd.md §4).
@Module({})
export class BookingsModule {}
