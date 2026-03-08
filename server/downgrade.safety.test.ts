/**
 * Tests for subscription downgrade safety.
 *
 * Verifies:
 *  1. Saving to an existing plan is always allowed (no tier check).
 *  2. Creating a new plan is blocked when over the tier limit.
 *  3. Over-limit detection logic (used by the Plans page banner).
 *  4. resolveUserId falls back to stripeCustomerId when metadata is missing.
 */

import { describe, it, expect } from "vitest";

// ── Mirrors server/routers.ts ─────────────────────────────────────────────────

const MAX_PLANS: Record<string, number> = { free: 0, basic: 3, pro: 10 };

function canSavePlan(_tier: string, _planId: number): { allowed: boolean } {
  // No tier check — downgraded users must always be able to save existing plans.
  return { allowed: true };
}

function canCreatePlan(tier: string, existingCount: number): { allowed: boolean; reason?: string } {
  const maxAllowed = MAX_PLANS[tier] ?? 0;
  if (maxAllowed === 0) {
    return { allowed: false, reason: "This feature requires a basic subscription." };
  }
  if (existingCount >= maxAllowed) {
    return {
      allowed: false,
      reason: `Your plan allows up to ${maxAllowed} saved plan(s). Upgrade to save more.`,
    };
  }
  return { allowed: true };
}

function isOverLimit(tier: string, planCount: number): boolean {
  const max = MAX_PLANS[tier] ?? 0;
  return planCount > max;
}

// ── Mirrors resolveUserId in server/stripe.ts ─────────────────────────────────

type UserRecord = { id: number; stripeCustomerId: string | null };

async function resolveUserId(
  metadataUserId: string | undefined,
  stripeCustomerId: string | undefined,
  lookupByCustomer: (id: string) => Promise<UserRecord | undefined>
): Promise<number> {
  const fromMeta = parseInt(metadataUserId ?? "0", 10);
  if (fromMeta > 0) return fromMeta;
  if (stripeCustomerId) {
    const user = await lookupByCustomer(stripeCustomerId);
    if (user) return user.id;
  }
  return 0;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("downgrade safety — plan saves", () => {
  it("allows saving to an existing plan regardless of tier", () => {
    expect(canSavePlan("free", 1).allowed).toBe(true);
    expect(canSavePlan("basic", 5).allowed).toBe(true);
    expect(canSavePlan("pro", 99).allowed).toBe(true);
  });
});

describe("downgrade safety — plan creation", () => {
  it("blocks free tier from creating any plan", () => {
    expect(canCreatePlan("free", 0).allowed).toBe(false);
  });

  it("blocks creation when over the basic limit (3 plans)", () => {
    expect(canCreatePlan("basic", 3).allowed).toBe(false);
  });

  it("allows creation when within the basic limit", () => {
    expect(canCreatePlan("basic", 2).allowed).toBe(true);
  });

  it("allows creation when within the pro limit", () => {
    expect(canCreatePlan("pro", 9).allowed).toBe(true);
  });
});

describe("downgrade safety — over-limit detection", () => {
  it("detects over-limit when a basic user has more than 3 plans after downgrade", () => {
    // e.g. was Pro (10 plans), downgraded to Basic (3 plans)
    expect(isOverLimit("basic", 4)).toBe(true);
    expect(isOverLimit("basic", 3)).toBe(false);
  });

  it("detects over-limit when a free user has any plans after downgrade", () => {
    expect(isOverLimit("free", 1)).toBe(true);
    expect(isOverLimit("free", 0)).toBe(false);
  });

  it("does not flag over-limit for pro users", () => {
    expect(isOverLimit("pro", 10)).toBe(false);
  });
});

describe("webhook resolveUserId fallback", () => {
  const fakeUser: UserRecord = { id: 42, stripeCustomerId: "cus_abc123" };
  const lookup = async (id: string) => (id === "cus_abc123" ? fakeUser : undefined);

  it("resolves from metadata when user_id is present", async () => {
    const id = await resolveUserId("7", "cus_abc123", lookup);
    expect(id).toBe(7);
  });

  it("falls back to stripeCustomerId lookup when metadata user_id is missing", async () => {
    const id = await resolveUserId(undefined, "cus_abc123", lookup);
    expect(id).toBe(42);
  });

  it("returns 0 when both metadata and customer lookup fail", async () => {
    const id = await resolveUserId(undefined, "cus_unknown", lookup);
    expect(id).toBe(0);
  });

  it("returns 0 when no metadata and no customer id provided", async () => {
    const id = await resolveUserId(undefined, undefined, lookup);
    expect(id).toBe(0);
  });
});
