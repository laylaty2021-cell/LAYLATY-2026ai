import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { MerchantOrdersController } from './merchant-orders.controller';
import { OrdersService } from './orders.service';

// Owns reads over orders, order_items (docs/database/schema.sql §7) —
// creation happens inside CartsService.checkout (see that module) and
// status transitions happen inside PaymentsService on webhook receipt.
// docs/backlog/sprint-backlog.md Sprint 9.
@Module({
  controllers: [OrdersController, MerchantOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
