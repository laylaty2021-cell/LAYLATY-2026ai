import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// Owns: notifications (docs/database/schema.sql §10). Real push/SMS/email
// dispatch via BullMQ workers is docs/backlog/sprint-backlog.md Sprint 11;
// NotificationsService.enqueue is already callable by other modules today.
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
