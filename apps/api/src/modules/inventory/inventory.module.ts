import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

// Owns: inventory_locations, inventory_stock, inventory_movements
// (docs/database/schema.sql §4). Exports InventoryService so Carts/Orders/
// Payments can reserve/confirm/release stock inside their own
// transactions — see InventoryService for why those methods take a `tx`.
@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
