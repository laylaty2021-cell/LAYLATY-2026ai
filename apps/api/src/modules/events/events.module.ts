import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

// Owns: events, event_tasks, event_budget_items, event_task_templates
// (docs/database/schema.sql §6 — the platform's Event-Centric core, see
// blueprint §7). docs/backlog/sprint-backlog.md Sprint 5–6.
@Module({
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
