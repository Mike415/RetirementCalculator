import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { PRODUCTS } from "./products";
import { adminRouter } from "./routers/admin";
import { getDb } from "./db";
import { pageViews } from "../drizzle/schema";
import { createCheckoutSession, createPortalSession, verifyCheckoutSession } from "./stripe";

// ─── Tier helpers ─────────────────────────────────────────────────────────────

const TIER_RANK: Record<string, number> = { free: 0, basic: 1, pro: 2 };

function requireTier(userTier: string, required: "basic" | "pro") {
  if ((TIER_RANK[userTier] ?? 0) < TIER_RANK[required]) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This feature requires a ${required} subscription.`,
    });
  }
}

// Max plans per tier — mirrors shared/tierLimits.ts
const MAX_PLANS: Record<string, number> = { free: 0, basic: 3, pro: 10 };

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  auth: router({
    /** Return the current user from the DB (null if not authenticated). */
    me: publicProcedure.query((opts) => opts.ctx.user),
    /** Debug: return raw auth context info (clerkUserId + user presence). Remove after debugging. */
    debug: publicProcedure.query(async (opts) => {
      const dbInstance = await getDb();
      let directLookup: { found: boolean; id?: number; email?: string | null; role?: string | null; openId?: string | null } | null = null;
      let lookupError: string | null = null;
      let databaseName = 'unknown';
      try {
        const u = new URL(process.env.DATABASE_URL ?? '');
        databaseName = u.pathname.replace('/', '');
      } catch { /* ignore */ }
      if (dbInstance && opts.ctx.clerkUserId) {
        try {
          const user = await db.getUserByOpenId(opts.ctx.clerkUserId);
          directLookup = user
            ? { found: true, id: user.id, email: user.email, role: user.role, openId: user.openId }
            : { found: false };
        } catch (e: any) {
          lookupError = String(e?.message ?? e);
        }
      }
      return {
        clerkUserId: opts.ctx.clerkUserId,
        userId: opts.ctx.user?.id ?? null,
        email: opts.ctx.user?.email ?? null,
        role: opts.ctx.user?.role ?? null,
        hasAuthHeader: !!opts.ctx.req.headers.authorization,
        dbAvailable: !!dbInstance,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        databaseName,
        directLookup,
        lookupError,
      };
    }),
  }),

  // ─── Plans ─────────────────────────────────────────────────────────────────

  plans: router({
    /** List all plans for the authenticated user (metadata only). */
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserPlans(ctx.user.id);
    }),

    /** Get a single plan with full data blob. */
    get: protectedProcedure
      .input(z.object({ planId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const plan = await db.getPlan(input.planId, ctx.user.id);
        if (!plan) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found." });
        }
        return plan;
      }),

    /** Create a new plan. Requires at least Basic tier. */
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255).default("My Plan"),
          data: z.unknown(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireTier(ctx.user.planTier, "basic");
        const existing = await db.getUserPlans(ctx.user.id);
        const maxAllowed = MAX_PLANS[ctx.user.planTier] ?? 0;
        if (existing.length >= maxAllowed) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Your plan allows up to ${maxAllowed} saved plan(s). Upgrade to save more.`,
          });
        }
        const planId = await db.createPlan(ctx.user.id, input.name, input.data);
        return { planId };
      }),

    /** Save (overwrite) an existing plan. Snapshots the previous version.
     * No tier check here — downgraded users must still be able to save edits
     * to plans they already own. New plan creation is gated instead.
     */
    save: protectedProcedure
      .input(
        z.object({
          planId: z.number().int().positive(),
          data: z.unknown(),
          name: z.string().min(1).max(255).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const plan = await db.getPlan(input.planId, ctx.user.id);
        if (!plan) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found." });
        }
        await db.savePlan(input.planId, ctx.user.id, input.data, input.name);
        return { success: true };
      }),

    /** Delete a plan and all its versions. */
    delete: protectedProcedure
      .input(z.object({ planId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await db.deletePlan(input.planId, ctx.user.id);
        return { success: true };
      }),

    /** Get version history for a plan (Pro only). */
    versions: protectedProcedure
      .input(z.object({ planId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        requireTier(ctx.user.planTier, "pro");
        return db.getPlanVersions(input.planId, ctx.user.id);
      }),
  }),

  // ─── User / subscription ───────────────────────────────────────────────────

  user: router({
    /** Return the current user's profile including tier. */
    profile: protectedProcedure.query(({ ctx }) => ({
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      planTier: ctx.user.planTier,
      subscriptionEndsAt: ctx.user.subscriptionEndsAt,
    })),
  }),

  // ─── Stripe / billing ─────────────────────────────────────────────────────

  billing: router({
    /** List available subscription products. */
    products: publicProcedure.query(() => PRODUCTS),

    /** Create a Stripe Checkout Session and return the URL. */
    createCheckout: protectedProcedure
      .input(
        z.object({
          tier: z.enum(["basic", "pro"]),
          origin: z.string().url(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const url = await createCheckoutSession({
          userId: ctx.user.id,
          userEmail: ctx.user.email ?? null,
          userName: ctx.user.name ?? null,
          tier: input.tier,
          origin: input.origin,
        });
        return { url };
      }),

    /**
     * Verify a completed Stripe checkout session and immediately update the user's tier.
     * This is a client-side fallback for when the webhook is delayed or misconfigured.
     * The session is verified directly with Stripe — the user can only update their own tier.
     */
    verifyCheckout: protectedProcedure
      .input(z.object({ sessionId: z.string().optional() }))
      .mutation(async ({ ctx }) => {
        // Re-fetch the user's latest subscription state from Stripe
        const result = await verifyCheckoutSession(ctx.user.id, ctx.user.stripeCustomerId ?? undefined);
        if (result) {
          await db.updateUserTier(
            ctx.user.id,
            result.tier,
            result.customerId,
            result.subscriptionId,
            result.subscriptionEndsAt
          );
          console.log(`[verifyCheckout] Updated user ${ctx.user.id} to ${result.tier}`);
          return { tier: result.tier, updated: true };
        }
        return { tier: ctx.user.planTier, updated: false };
      }),

    /** Create a Stripe Customer Portal session for managing subscriptions. */
    createPortal: protectedProcedure
      .input(z.object({ origin: z.string().url() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.stripeCustomerId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No active subscription found.",
          });
        }
        const url = await createPortalSession({
          stripeCustomerId: ctx.user.stripeCustomerId,
          origin: input.origin,
        });
        return { url };
      }),
  }),

  // ─── Page view tracking ────────────────────────────────────────────────────

  analytics: router({
    /** Record a page view. Called by the client on route change. */
    trackPageView: publicProcedure
      .input(
        z.object({
          sessionId: z.string().min(1).max(64),
          path: z.string().min(1).max(255),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const dbConn = await getDb();
        if (!dbConn) return { ok: false };
        await dbConn.insert(pageViews).values({
          sessionId: input.sessionId,
          userId: ctx.user?.id ?? null,
          path: input.path,
        });
        return { ok: true };
      }),
  }),

  // ─── Admin ─────────────────────────────────────────────────────────────────

  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
