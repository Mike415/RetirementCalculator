import { clerkClient, verifyToken } from "@clerk/express";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  clerkUserId: string | null;
};

async function getClerkUserId(req: CreateExpressContextOptions["req"]): Promise<string | null> {
  // Extract Bearer token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  try {
    const payload = await verifyToken(token, {
      secretKey: ENV.clerkSecretKey,
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let clerkUserId: string | null = null;

  try {
    clerkUserId = await getClerkUserId(opts.req);

    if (clerkUserId) {
      // Look up user in our DB by Clerk user ID (stored as openId)
      user = (await db.getUserByOpenId(clerkUserId)) ?? null;

      // Auto-provision user on first sign-in
      if (!user) {
        try {
          const clerkUser = await clerkClient.users.getUser(clerkUserId);
          const email = clerkUser.emailAddresses[0]?.emailAddress ?? null;
          const name =
            [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;
          // New users start on free tier; beta feature access is controlled
          // by BETA_FEATURES_UNLOCKED in shared/tierLimits.ts (no DB change needed).
          await db.upsertUser({
            openId: clerkUserId,
            name,
            email,
            loginMethod: "clerk",
            planTier: "free",
            lastSignedIn: new Date(),
          });
          user = (await db.getUserByOpenId(clerkUserId)) ?? null;
        } catch (err) {
          console.error("[Auth] Failed to provision Clerk user:", err);
        }
      } else {
        // Update last signed in timestamp
        await db.upsertUser({ openId: clerkUserId, lastSignedIn: new Date() });
        user = (await db.getUserByOpenId(clerkUserId)) ?? null;
      }
    }
  } catch {
    // Auth is optional for public procedures
  }

  return { req: opts.req, res: opts.res, user, clerkUserId };
}
