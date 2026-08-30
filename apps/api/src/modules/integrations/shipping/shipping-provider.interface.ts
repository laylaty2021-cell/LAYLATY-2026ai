// blueprint §13 Shipping Abstraction Layer — same swap-ability rationale
// as payment-provider.interface.ts.
export interface CreateShipmentParams {
  orderId: string;
  destinationCity: string;
}

export interface CreateShipmentResult {
  trackingNumber: string;
  labelUrl: string;
}

export interface ShippingProvider {
  readonly name: string;
  createShipment(params: CreateShipmentParams): Promise<CreateShipmentResult>;
  trackShipment(trackingNumber: string): Promise<{ status: string }>;
}

export const SHIPPING_PROVIDER = 'SHIPPING_PROVIDER';
