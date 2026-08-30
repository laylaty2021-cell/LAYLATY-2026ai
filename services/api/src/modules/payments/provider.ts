import { randomUUID } from "node:crypto";

/**
 * Payment provider adapter interface, matching
 * docs/blueprint/08-payment-adapter.md, section 2. Only the subset needed
 * for the MVP synchronous-capture flow is implemented; authorize()/
 * refund()/handleWebhook() are stubbed out for a real gateway integration
 * in V1.
 */
export interface PaymentProviderAdapter {
  createPayment(input: { amount: number; currency: string }): Promise<{
    status: "CAPTURED" | "FAILED";
    externalReference: string;
  }>;
}

/**
 * Deterministic mock provider used until a real gateway (Moyasar, Tap,
 * HyperPay...) is wired in. Always "succeeds" synchronously so the order
 * lifecycle can be exercised end-to-end without external dependencies.
 */
export class MockPaymentProvider implements PaymentProviderAdapter {
  async createPayment(_input: {
    amount: number;
    currency: string;
  }): Promise<{ status: "CAPTURED" | "FAILED"; externalReference: string }> {
    return { status: "CAPTURED", externalReference: `mock_${randomUUID()}` };
  }
}
