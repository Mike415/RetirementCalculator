/**
 * Validates that STRIPE_PRICE_BASIC and STRIPE_PRICE_PRO are set and
 * correspond to real, active prices in the Stripe test environment.
 */
import { describe, it, expect } from "vitest";
import Stripe from "stripe";
import dotenv from "dotenv";
dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const basicPriceId = process.env.STRIPE_PRICE_BASIC;
const proPriceId = process.env.STRIPE_PRICE_PRO;

describe("Stripe Price IDs", () => {
  it("STRIPE_PRICE_BASIC is set and not a placeholder", () => {
    expect(basicPriceId).toBeDefined();
    expect(basicPriceId).not.toBe("price_basic_placeholder");
    expect(basicPriceId).toMatch(/^price_/);
  });

  it("STRIPE_PRICE_PRO is set and not a placeholder", () => {
    expect(proPriceId).toBeDefined();
    expect(proPriceId).not.toBe("price_pro_placeholder");
    expect(proPriceId).toMatch(/^price_/);
  });

  it("STRIPE_PRICE_BASIC resolves to an active $2.99/month price", async () => {
    if (!stripeSecretKey || !basicPriceId) {
      throw new Error("STRIPE_SECRET_KEY or STRIPE_PRICE_BASIC not set");
    }
    const stripe = new Stripe(stripeSecretKey);
    const price = await stripe.prices.retrieve(basicPriceId);
    expect(price.active).toBe(true);
    expect(price.unit_amount).toBe(299);
    expect(price.currency).toBe("usd");
    expect(price.recurring?.interval).toBe("month");
  });

  it("STRIPE_PRICE_PRO resolves to an active $4.99/month price", async () => {
    if (!stripeSecretKey || !proPriceId) {
      throw new Error("STRIPE_SECRET_KEY or STRIPE_PRICE_PRO not set");
    }
    const stripe = new Stripe(stripeSecretKey);
    const price = await stripe.prices.retrieve(proPriceId);
    expect(price.active).toBe(true);
    expect(price.unit_amount).toBe(499);
    expect(price.currency).toBe("usd");
    expect(price.recurring?.interval).toBe("month");
  });
});
