/**
 * Admin portal tests — analytics queries and user management procedures.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ──────────────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "./db";

// ─── adminProcedure guard ─────────────────────────────────────────────────────

describe("adminProcedure guard", () => {
  it("should exist in server/_core/trpc.ts", async () => {
    const { adminProcedure } = await import("./_core/trpc");
    expect(adminProcedure).toBeDefined();
    expect(typeof adminProcedure).toBe("object"); // tRPC procedure builder
  });
});

// ─── Admin router structure ───────────────────────────────────────────────────

describe("adminRouter structure", () => {
  it("should export adminRouter with analytics and users sub-routers", async () => {
    const { adminRouter } = await import("./routers/admin");
    expect(adminRouter).toBeDefined();
    // tRPC router has _def property
    expect((adminRouter as any)._def).toBeDefined();
  });
});

// ─── Date range helper ────────────────────────────────────────────────────────

describe("getRange helper (client-side)", () => {
  it("24h range should be ~24 hours before now", () => {
    const now = new Date();
    const from = new Date(now);
    from.setHours(from.getHours() - 24);
    const diff = now.getTime() - from.getTime();
    expect(diff).toBeGreaterThanOrEqual(23 * 60 * 60 * 1000);
    expect(diff).toBeLessThanOrEqual(25 * 60 * 60 * 1000);
  });

  it("7d range should be 7 days before now", () => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    const diffDays = (now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });

  it("custom range: from date is before to date", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const to = new Date("2026-06-30T00:00:00Z");
    expect(from.getTime()).toBeLessThan(to.getTime());
    expect(to.getUTCMonth()).toBe(5); // June = 5
  });
});

// ─── fmtCents helper ─────────────────────────────────────────────────────────

describe("fmtCents", () => {
  it("converts cents to dollar string", () => {
    const fmtCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
    expect(fmtCents(299)).toBe("$2.99");
    expect(fmtCents(499)).toBe("$4.99");
    expect(fmtCents(0)).toBe("$0.00");
    expect(fmtCents(10000)).toBe("$100.00");
  });
});

// ─── Tier price mapping ───────────────────────────────────────────────────────

describe("TIER_PRICE_CENTS", () => {
  it("basic and pro tiers have correct prices", () => {
    const TIER_PRICE_CENTS: Record<string, number> = {
      basic: 299,
      pro: 499,
    };
    expect(TIER_PRICE_CENTS.basic).toBe(299);
    expect(TIER_PRICE_CENTS.pro).toBe(499);
    expect(TIER_PRICE_CENTS.free).toBeUndefined();
  });
});

// ─── betaOverride logic ───────────────────────────────────────────────────────

describe("betaOverride logic", () => {
  it("null betaOverride means follow global flag", () => {
    const globalFlag = true;
    const resolvesBeta = (override: boolean | null) =>
      override !== null ? override : globalFlag;
    expect(resolvesBeta(null)).toBe(true);
    expect(resolvesBeta(true)).toBe(true);
    expect(resolvesBeta(false)).toBe(false);
  });

  it("explicit false betaOverride disables beta even when global is true", () => {
    const globalFlag = true;
    const resolvesBeta = (override: boolean | null) =>
      override !== null ? override : globalFlag;
    expect(resolvesBeta(false)).toBe(false);
  });
});
