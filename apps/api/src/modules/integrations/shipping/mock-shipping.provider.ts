import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  CreateShipmentParams,
  CreateShipmentResult,
  ShippingProvider,
} from './shipping-provider.interface';

@Injectable()
export class MockShippingProvider implements ShippingProvider {
  readonly name = 'mock';

  async createShipment(
    params: CreateShipmentParams,
  ): Promise<CreateShipmentResult> {
    void params; // destinationCity would pick a carrier/rate in a real integration
    const trackingNumber = `MOCK${randomBytes(4).toString('hex').toUpperCase()}`;
    return {
      trackingNumber,
      labelUrl: `https://mock-carrier.laylaty.test/labels/${trackingNumber}.pdf`,
    };
  }

  async trackShipment(): Promise<{ status: string }> {
    return { status: 'in_transit' };
  }
}
