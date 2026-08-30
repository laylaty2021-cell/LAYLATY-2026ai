import { Module } from '@nestjs/common';
import { StoresController } from './stores.controller';
import { StoreModulesController } from './store-modules.controller';
import { MerchantStoresController } from './merchant-stores.controller';
import { StoresService } from './stores.service';

// Owns: stores, store_modules (docs/database/schema.sql §2).
// docs/backlog/sprint-backlog.md Sprint 2.
@Module({
  controllers: [
    StoresController,
    StoreModulesController,
    MerchantStoresController,
  ],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
