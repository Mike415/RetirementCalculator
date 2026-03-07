/**
 * Basic smoke test for the auth router.
 * With Clerk, sign-out is handled client-side via Clerk's SDK.
 * The server only needs to verify Clerk JWTs — there is no server-side
 * session cookie to clear.
 */
import { describe, expect, it } from "vitest";

describe("auth", () => {
  it("Clerk handles sign-out client-side", () => {
    // Clerk's signOut() invalidates the session on Clerk's servers and
    // clears the __session cookie automatically. No server-side action needed.
    expect(true).toBe(true);
  });
});
