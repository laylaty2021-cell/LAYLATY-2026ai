import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { CartsController } from './carts.controller';
import { CartsService } from './carts.service';

// Owns: carts, cart_items (docs/database/schema.sql §7). Also writes
// orders/order_items during checkout — see CartsService.checkout for why
// that one seam is allowed to cross the module boundary.
// docs/backlog/sprint-backlog.md Sprint 9.
@Module({
  imports: [InventoryModule],
  controllers: [CartsController],
  providers: [CartsService],
  exports: [CartsService],
})
export class CartsModule {}
