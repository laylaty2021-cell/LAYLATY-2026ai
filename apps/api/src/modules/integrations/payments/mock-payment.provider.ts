import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProvider,
  VerifyWebhookParams,
  WebhookVerificationResult,
} from './payment-provider.interface';

// Sandbox provider so the whole payments flow (create -> webhook -> verify
// -> settle) is runnable and testable without real gateway credentials.
// A real integration (Moyasar/HyperPay/Tap) is a drop-in replacement: same
// interface, different `name` bound in PaymentsModule (blueprint §12).
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async createPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResult> {
    void params; // amount/currency would be sent to the real gateway here
    const providerPaymentId = `mock_${randomUUID()}`;
    return {
      providerPaymentId,
      checkoutUrl: `https://mock-gateway.laylaty.test/checkout/${providerPaymentId}`,
    };
  }

  verifyWebhook(params: VerifyWebhookParams): WebhookVerificationResult {
    if (params.signatureHeader !== 'mock-signature') {
      return {
        valid: false,
        eventId: '',
        eventType: '',
        providerPaymentId: '',
        status: 'failed',
      };
    }
    const body = params.payload as {
      eventId: string;
      eventType: string;
      providerPaymentId: string;
      status: 'succeeded' | 'failed';
    };
    return { valid: true, ...body };
  }

  async refundPayment(): Promise<{ refunded: boolean }> {
    return { refunded: true };
  }
}
