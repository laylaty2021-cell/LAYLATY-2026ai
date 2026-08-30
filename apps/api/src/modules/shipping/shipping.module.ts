import { Module } from '@nestjs/common';

// Owns: shipments, shipment_events (docs/database/schema.sql §9).
// Implemented in docs/backlog/sprint-backlog.md Sprint 11, behind the
// Shipping Provider abstraction (blueprint §13) so no shipping carrier is
// hard-wired into the platform.
@Module({})
export class ShippingModule {}
