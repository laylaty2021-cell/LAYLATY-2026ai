import { Module } from '@nestjs/common';

// Owns: payments, payment_webhook_events, refunds
// (docs/database/schema.sql §8). Implemented in
// docs/backlog/sprint-backlog.md Sprint 10. HARD RULE (blueprint §12):
// an order/booking is marked paid ONLY from the verified provider webhook
// path — never from the client-side redirect return. Webhook processing
// must be idempotent via the UNIQUE (provider, event_id) constraint on
// payment_webhook_events.
@Module({})
export class PaymentsModule {}
