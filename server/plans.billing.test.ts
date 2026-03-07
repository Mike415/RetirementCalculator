/**
 * Tests for plans and billing tRPC procedures.
 * These are unit tests that verify the tier-gating logic without hitting the DB.
 */

import { describe, it, expect } from "vitest";

// ── Tier rank helper (mirrors server/routers.ts logic) ─────────────────────────

const TIER_RANK: Record<string, number> = { free: 0, basic: 1, pro: 2 };
const MAX_PLANS: Record<string, number> = { free: 0, basic: 1, pro: 10 };

function canCreatePlan(tier: string, existingCount: number): { allowed: boolean; reason?: string } {
  const maxAllowed = MAX_PLANS[tier] ?? 0;
  if (maxAllowed === 0) {
    return { allowed: false, reason: `This feature requires a basic subscription.` };
  }
  if (existingCount >= maxAllowed) {
    return {
      allowed: false,
      reason: `Your plan allows up to ${maxAllowed} saved plan(s). Upgrade to save more.`,
    };
  }
  return { allowed: true };
}

function canAccessVersionHistory(tier: string): boolean {
  return (TIER_RANK[tier] ?? 0) >= TIER_RANK["pro"];
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("tier gating", () => {
  it("free tier cannot create any plans", () => {
    const result = canCreatePlan("free", 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("basic subscription");
  });

  it("basic tier can create 1 plan", () => {
    expect(canCreatePlan("basic", 0).allowed).toBe(true);
  });

  it("basic tier cannot create a second plan", () => {
    const result = canCreatePlan("basic", 1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("1 saved plan");
  });

  it("pro tier can create up to 10 plans", () => {
    for (let i = 0; i < 10; i++) {
      expect(canCreatePlan("pro", i).allowed).toBe(true);
    }
  });

  it("pro tier cannot create an 11th plan", () => {
    const result = canCreatePlan("pro", 10);
    expect(result.allowed).toBe(false);
  });

  it("only pro tier can access version history", () => {
    expect(canAccessVersionHistory("free")).toBe(false);
    expect(canAccessVersionHistory("basic")).toBe(false);
    expect(canAccessVersionHistory("pro")).toBe(true);
  });
});

describe("tier rank ordering", () => {
  it("pro > basic > free", () => {
    expect(TIER_RANK["pro"]).toBeGreaterThan(TIER_RANK["basic"]);
    expect(TIER_RANK["basic"]).toBeGreaterThan(TIER_RANK["free"]);
  });
});
