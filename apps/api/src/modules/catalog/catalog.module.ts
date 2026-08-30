import { Module } from '@nestjs/common';

// Owns: categories, products, product_variants, services, packages,
// package_items (docs/database/schema.sql §3 — the Unified Commerce
// engine). Implemented in docs/backlog/sprint-backlog.md Sprint 3–4.
@Module({})
export class CatalogModule {}
