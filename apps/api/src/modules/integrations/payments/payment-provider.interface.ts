// blueprint §12 Payment Abstraction Layer. Payments module depends on this
// interface only — swapping Moyasar for HyperPay/Tap means writing one new
// class that implements it, never touching PaymentsService (blueprint §46
// rule 6: no integration is a single point of lock-in).
export interface CreatePaymentParams {
  amount: number;
  currency: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
}

export interface CreatePaymentResult {
  providerPaymentId: string;
  checkoutUrl: string;
}

export interface VerifyWebhookParams {
  payload: unknown;
  signatureHeader: string | undefined;
}

export interface WebhookVerificationResult {
  valid: boolean;
  eventId: string;
  eventType: string;
  providerPaymentId: string;
  status: 'succeeded' | 'failed';
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  verifyWebhook(params: VerifyWebhookParams): WebhookVerificationResult;
  refundPayment(
    providerPaymentId: string,
    amount: number,
  ): Promise<{ refunded: boolean }>;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
