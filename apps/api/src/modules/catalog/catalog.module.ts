import { Module } from '@nestjs/common';
import { MerchantCatalogController } from './merchant-catalog.controller';
import { CatalogSearchController } from './catalog-search.controller';
import { CatalogService } from './catalog.service';

// Owns: categories, products, product_variants, services, packages,
// package_items (docs/database/schema.sql §3 — Unified Commerce).
// docs/backlog/sprint-backlog.md Sprint 3–4.
@Module({
  controllers: [MerchantCatalogController, CatalogSearchController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
