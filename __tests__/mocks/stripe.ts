import { vi } from "vitest";
import type { TicketPayment } from "@/lib/stripe";

export type { TicketPayment };

let _ticketCounts: Record<string, number> = {};
let _stripeErrors: Record<string, Error> = {};
let _strict = false;

function buildPayments(): TicketPayment[] {
  if (_strict && Object.keys(_ticketCounts).length === 0) {
    throw new Error(
      "[Stripe Mock] fetchTicketPayments() called in strict mode with no " +
        "ticket counts configured. Call setTicketCountsByEmail() first.",
    );
  }

  const payments: TicketPayment[] = [];
  let counter = 0;

  for (const [rawEmail, count] of Object.entries(_ticketCounts)) {
    const email = rawEmail.trim().toLowerCase();

    if (_stripeErrors[email]) {
      throw _stripeErrors[email];
    }

    for (let i = 0; i < count; i++) {
      counter++;
      payments.push({
        email,
        name: `Test User ${counter}`,
        amountPaid: 5000,
        currency: "usd",
        paidAt: Math.floor(Date.now() / 1000) - counter * 60,
        sessionId: `cs_test_${email.replace(/[^a-z0-9]/g, "_")}_${i}`,
      });
    }
  }

  return payments;
}

export const mockFetchTicketPayments = vi.fn<() => Promise<TicketPayment[]>>();

function applyDefaultImpl() {
  mockFetchTicketPayments.mockImplementation(async () => buildPayments());
}

applyDefaultImpl();

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function resetStripeMocks() {
  _ticketCounts = {};
  _stripeErrors = {};
  _strict = false;
  mockFetchTicketPayments.mockReset();
  applyDefaultImpl();
}

export function setTicketCountsByEmail(record: Record<string, number>) {
  for (const [email, count] of Object.entries(record)) {
    _ticketCounts[email.trim().toLowerCase()] = count;
  }
}

export function setStripeErrorForEmail(email: string, error: Error | string) {
  _stripeErrors[email.trim().toLowerCase()] =
    typeof error === "string" ? new Error(error) : error;
}

export function setStrictStripeMode(enabled: boolean) {
  _strict = enabled;
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

export function makeCheckoutSession(overrides: Record<string, unknown> = {}) {
  return {
    id: `cs_test_${Math.random().toString(36).slice(2, 10)}`,
    status: "complete" as const,
    customer_details: { email: "test@example.com", name: "Test User" },
    amount_total: 5000,
    currency: "usd",
    created: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

export function makePaymentIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: `pi_test_${Math.random().toString(36).slice(2, 10)}`,
    amount: 5000,
    currency: "usd",
    status: "succeeded" as const,
    ...overrides,
  };
}
