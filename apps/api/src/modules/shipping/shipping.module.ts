import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ShippingController } from './shipping.controller';
import { MerchantShippingController } from './merchant-shipping.controller';
import { ShippingService } from './shipping.service';

// Owns: shipments, shipment_events (docs/database/schema.sql §9), behind
// the Shipping Provider abstraction (blueprint §13).
// docs/backlog/sprint-backlog.md Sprint 11.
@Module({
  imports: [IntegrationsModule],
  controllers: [ShippingController, MerchantShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
