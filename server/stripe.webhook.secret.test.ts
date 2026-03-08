import { describe, it, expect } from "vitest";

describe("STRIPE_WEBHOOK_SECRET_PROD", () => {
  it("should be set and start with whsec_", () => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET_PROD;
    expect(secret).toBeDefined();
    expect(secret).not.toBe("");
    expect(secret?.startsWith("whsec_")).toBe(true);
  });
});
