/**
 * Stripe integration for Project Retire subscriptions.
 * Handles checkout session creation and webhook processing.
 */

import Stripe from "stripe";
import type { Express, Request, Response } from "express";
import express from "express";
import * as db from "./db";
import { getProductByTier } from "./products";

// ── Stripe client ─────────────────────────────────────────────────────────────

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
}

// ── Webhook route (must be registered BEFORE express.json()) ─────────────────

export function registerStripeWebhook(app: Express) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event: Stripe.Event;

      try {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(
          req.body as Buffer,
          sig,
          webhookSecret ?? ""
        );
      } catch (err) {
        console.error("[Webhook] Signature verification failed:", err);
        res.status(400).send("Webhook signature verification failed");
        return;
      }

      // Test events — return verification response
      if (event.id.startsWith("evt_test_")) {
        console.log("[Webhook] Test event detected, returning verification response");
        res.json({ verified: true });
        return;
      }

      console.log(`[Webhook] Event: ${event.type} (${event.id})`);

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            await handleCheckoutCompleted(session);
            break;
          }
          case "customer.subscription.updated":
          case "customer.subscription.deleted": {
            const sub = event.data.object as Stripe.Subscription;
            await handleSubscriptionChange(sub);
            break;
          }
          case "invoice.paid": {
            const invoice = event.data.object as Stripe.Invoice;
            await handleInvoicePaid(invoice);
            break;
          }
          default:
            console.log(`[Webhook] Unhandled event type: ${event.type}`);
        }
        res.json({ received: true });
      } catch (err) {
        console.error("[Webhook] Handler error:", err);
        res.status(500).json({ error: "Webhook handler failed" });
      }
    }
  );
}

// ── Webhook handlers ──────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = parseInt(session.metadata?.user_id ?? "0", 10);
  const tier = session.metadata?.tier as "basic" | "pro" | undefined;
  if (!userId || !tier) {
    console.warn("[Webhook] Missing user_id or tier in session metadata");
    return;
  }

  const stripe = getStripe();
  const subscription = session.subscription
    ? await stripe.subscriptions.retrieve(session.subscription as string)
    : null;

  await db.updateUserTier(
    userId,
    tier,
    session.customer as string | undefined,
    subscription?.id,
    subscription?.billing_cycle_anchor
      ? new Date(subscription.billing_cycle_anchor * 1000)
      : undefined
  );

  console.log(`[Webhook] User ${userId} upgraded to ${tier}`);
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  const userId = parseInt(sub.metadata?.user_id ?? "0", 10);
  if (!userId) return;

  const isActive = sub.status === "active" || sub.status === "trialing";
  const tier = isActive ? (sub.metadata?.tier as "basic" | "pro" | undefined) : undefined;

  await db.updateUserTier(
    userId,
    tier ?? "free",
    sub.customer as string | undefined,
    isActive ? sub.id : undefined,
    sub.cancel_at ? new Date(sub.cancel_at * 1000) : undefined
  );

  console.log(`[Webhook] Subscription ${sub.status} for user ${userId}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Subscription renewal — just log it; tier is already set from checkout
  console.log(`[Webhook] Invoice paid: ${invoice.id} for customer ${invoice.customer}`);
}

// ── tRPC-callable helpers ─────────────────────────────────────────────────────

export async function createCheckoutSession(params: {
  userId: number;
  userEmail: string | null;
  userName: string | null;
  tier: "basic" | "pro";
  origin: string;
}): Promise<string> {
  const stripe = getStripe();
  const product = getProductByTier(params.tier);
  if (!product) throw new Error(`Unknown tier: ${params.tier}`);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: product.stripePriceId,
        quantity: 1,
      },
    ],
    customer_email: params.userEmail ?? undefined,
    allow_promotion_codes: true,
    client_reference_id: params.userId.toString(),
    metadata: {
      user_id: params.userId.toString(),
      tier: params.tier,
      customer_email: params.userEmail ?? "",
      customer_name: params.userName ?? "",
    },
    success_url: `${params.origin}/?checkout=success&tier=${params.tier}`,
    cancel_url: `${params.origin}/?checkout=cancelled`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createPortalSession(params: {
  stripeCustomerId: string;
  origin: string;
}): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: params.origin,
  });
  return session.url;
}
