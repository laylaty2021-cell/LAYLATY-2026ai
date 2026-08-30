import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsController } from './payments.controller';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { AdminRefundsController } from './admin-refunds.controller';
import { PaymentsService } from './payments.service';

// Owns: payments, payment_webhook_events, refunds
// (docs/database/schema.sql §8). docs/backlog/sprint-backlog.md Sprint 10.
// HARD RULE (blueprint §12): an order/booking is marked paid ONLY from
// PaymentsService.handleWebhook — never from a client-side redirect return.
@Module({
  imports: [IntegrationsModule, InventoryModule],
  controllers: [
    PaymentsController,
    PaymentWebhooksController,
    AdminRefundsController,
  ],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
