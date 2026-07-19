import "server-only";

/**
 * Stripe is a FUTURE integration. This is an intentional placeholder so the
 * payments boundary exists without pulling in the SDK yet.
 *
 * When enabling payments:
 *   1. npm install stripe
 *   2. Add STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET to env.ts
 *   3. Replace the stubs below with a real Stripe client and handlers.
 */

export interface CheckoutParams {
  priceId: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

export const PAYMENTS_ENABLED = false;

export async function createCheckoutSession(): Promise<CheckoutSession> {
  throw new Error("Payments are not enabled yet (Stripe integration is a future milestone).");
}
