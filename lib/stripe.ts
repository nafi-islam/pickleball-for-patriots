import "server-only";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY.");
}

export const stripe = new Stripe(secretKey);

export type TicketPayment = {
  email: string;
  name: string | null;
  amountPaid: number;
  currency: string;
  paidAt: number;
  sessionId: string;
};

/**
 * Fetches all completed checkout sessions for the configured payment link.
 * Returns one entry per session with the customer's email lowercased.
 */
export async function fetchTicketPayments(): Promise<TicketPayment[]> {
  const paymentLinkId = process.env.PARTICIPANT_LINK_ID;
  if (!paymentLinkId) return [];

  const payments: TicketPayment[] = [];
  let startingAfter: string | undefined;

  while (true) {
    const params: Record<string, unknown> = {
      payment_link: paymentLinkId,
      status: "complete",
      limit: 100,
    };
    if (startingAfter) params.starting_after = startingAfter;

    const page = await stripe.checkout.sessions.list(
      params as Parameters<typeof stripe.checkout.sessions.list>[0],
    );

    for (const session of page.data) {
      const email = session.customer_details?.email;
      if (email) {
        payments.push({
          email: email.toLowerCase(),
          name: session.customer_details?.name ?? null,
          amountPaid: session.amount_total ?? 0,
          currency: session.currency ?? "usd",
          paidAt: session.created,
          sessionId: session.id,
        });
      }
    }

    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  return payments;
}
