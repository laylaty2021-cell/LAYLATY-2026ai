import { Module } from '@nestjs/common';

// Home for the Payment Provider and Shipping Provider abstraction
// interfaces (blueprint §12/§13: createPayment/verifyPayment/refundPayment,
// getRates/createShipment/trackShipment) and their concrete adapters
// (Moyasar/HyperPay/Tap, a shipping carrier, ...). Payments and Shipping
// modules depend on the interfaces exported here, never on a concrete
// provider directly — this is what keeps a provider swap a one-adapter
// change (blueprint §46, rule 6).
@Module({})
export class IntegrationsModule {}
