import { Module } from '@nestjs/common';

// Owns: inventory_locations, inventory_stock, inventory_movements
// (docs/database/schema.sql §4). Reserve/confirm/release wiring lands with
// Cart/Checkout in Sprint 9 and multi-location support in Sprint 11.
// Available stock is always `quantity_on_hand - quantity_reserved`,
// enforced at the DB level by chk_reserved_le_on_hand.
@Module({})
export class InventoryModule {}
