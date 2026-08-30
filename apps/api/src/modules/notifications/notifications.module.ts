import { Module } from '@nestjs/common';

// Owns: notifications (docs/database/schema.sql §10). Implemented in
// docs/backlog/sprint-backlog.md Sprint 11 as BullMQ-backed workers
// dispatching push/SMS/email on domain events (booking.confirmed,
// payment.success, event.reminder, ...).
@Module({})
export class NotificationsModule {}
