import { Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './payments/payment-provider.interface';
import { MockPaymentProvider } from './payments/mock-payment.provider';
import { SHIPPING_PROVIDER } from './shipping/shipping-provider.interface';
import { MockShippingProvider } from './shipping/mock-shipping.provider';

// Home for the Payment Provider and Shipping Provider abstraction
// interfaces (blueprint §12/§13) and their concrete adapters. Payments and
// Shipping modules inject PAYMENT_PROVIDER / SHIPPING_PROVIDER — never a
// concrete class — so swapping providers means changing this module's
// `useClass` binding only.
@Module({
  providers: [
    { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider },
    { provide: SHIPPING_PROVIDER, useClass: MockShippingProvider },
  ],
  exports: [PAYMENT_PROVIDER, SHIPPING_PROVIDER],
})
export class IntegrationsModule {}
