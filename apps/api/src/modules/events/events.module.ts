import { Module } from '@nestjs/common';

// Owns: events, event_tasks, event_budget_items, event_task_templates
// (docs/database/schema.sql §6 — the platform's Event-Centric core, see
// blueprint §7). Implemented in docs/backlog/sprint-backlog.md Sprint 5–6.
@Module({})
export class EventsModule {}
