import { Module } from '@nestjs/common';

// Owns: orders, order_items (docs/database/schema.sql §7).
// Implemented in docs/backlog/sprint-backlog.md Sprint 9. Cart→Order
// conversion must be atomic and snapshot prices at conversion time
// (name_snapshot / unit_price on order_items).
@Module({})
export class OrdersModule {}
