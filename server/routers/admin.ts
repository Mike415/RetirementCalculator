/**
 * Admin router — analytics and user management.
 * All procedures require role = "admin".
 */
import { TRPCError } from "@trpc/server";
import { and, count, countDistinct, desc, eq, gte, lt, sql, sum } from "drizzle-orm";
import { z } from "zod";
import { pageViews, plans, stripeEvents, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { adminProcedure, router } from "../_core/trpc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateRangeFilter(from: Date, to: Date) {
  return (col: Parameters<typeof gte>[0]) =>
    and(gte(col, from), lt(col, to));
}

/** Tier monthly price in cents */
const TIER_PRICE_CENTS: Record<string, number> = {
  basic: 299,
  pro: 499,
};

// ─── Router ───────────────────────────────────────────────────────────────────

export const adminRouter = router({
  // ─── Analytics ─────────────────────────────────────────────────────────────

  analytics: router({
    /**
     * Summary metrics for a date range.
     * Returns: pageViews, uniqueVisitors, newSignups, usersByTier,
     *          revenue, resubscriptions, cancellations.
     */
    summary: adminProcedure
      .input(
        z.object({
          from: z.date(),
          to: z.date(),
        })
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const { from, to } = input;
        const inRange = (col: Parameters<typeof gte>[0]) =>
          and(gte(col, from), lt(col, to));

        // Page views
        const [pvRow] = await db
          .select({ total: count() })
          .from(pageViews)
          .where(inRange(pageViews.createdAt));
        const totalPageViews = pvRow?.total ?? 0;

        // Unique visitors (distinct sessionIds)
        const [uvRow] = await db
          .select({ total: countDistinct(pageViews.sessionId) })
          .from(pageViews)
          .where(inRange(pageViews.createdAt));
        const uniqueVisitors = uvRow?.total ?? 0;

        // New signups
        const [signupRow] = await db
          .select({ total: count() })
          .from(users)
          .where(inRange(users.createdAt));
        const newSignups = signupRow?.total ?? 0;

        // Users by tier (current snapshot, not time-filtered)
        const tierRows = await db
          .select({ tier: users.planTier, total: count() })
          .from(users)
          .groupBy(users.planTier);
        const usersByTier: Record<string, number> = {};
        for (const row of tierRows) {
          usersByTier[row.tier] = row.total;
        }

        // Revenue from stripeEvents (checkout.completed)
        const [revRow] = await db
          .select({ total: sum(stripeEvents.amountCents) })
          .from(stripeEvents)
          .where(
            and(
              eq(stripeEvents.eventType, "checkout.completed"),
              inRange(stripeEvents.createdAt)
            )
          );
        const revenueCents = Number(revRow?.total ?? 0);

        // Resubscriptions
        const [resubRow] = await db
          .select({ total: count(), revenue: sum(stripeEvents.amountCents) })
          .from(stripeEvents)
          .where(
            and(
              eq(stripeEvents.eventType, "subscription.reactivated"),
              inRange(stripeEvents.createdAt)
            )
          );
        const resubCount = resubRow?.total ?? 0;
        const resubRevenueCents = Number(resubRow?.revenue ?? 0);

        // Cancellations
        const [cancelRow] = await db
          .select({ total: count() })
          .from(stripeEvents)
          .where(
            and(
              eq(stripeEvents.eventType, "subscription.canceled"),
              inRange(stripeEvents.createdAt)
            )
          );
        const cancellations = cancelRow?.total ?? 0;

        return {
          totalPageViews,
          uniqueVisitors,
          newSignups,
          usersByTier,
          revenueCents,
          resubCount,
          resubRevenueCents,
          cancellations,
        };
      }),

    /**
     * Daily time-series data for charts (page views + signups per day).
     */
    timeSeries: adminProcedure
      .input(z.object({ from: z.date(), to: z.date() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const { from, to } = input;

        // Page views per day
        const pvSeries = await db
          .select({
            day: sql<string>`DATE(${pageViews.createdAt})`.as("day"),
            views: count(),
            uniqueVisitors: countDistinct(pageViews.sessionId),
          })
          .from(pageViews)
          .where(and(gte(pageViews.createdAt, from), lt(pageViews.createdAt, to)))
          .groupBy(sql`DATE(${pageViews.createdAt})`)
          .orderBy(sql`DATE(${pageViews.createdAt})`);

        // Signups per day
        const signupSeries = await db
          .select({
            day: sql<string>`DATE(${users.createdAt})`.as("day"),
            signups: count(),
          })
          .from(users)
          .where(and(gte(users.createdAt, from), lt(users.createdAt, to)))
          .groupBy(sql`DATE(${users.createdAt})`)
          .orderBy(sql`DATE(${users.createdAt})`);

        // Revenue per day
        const revSeries = await db
          .select({
            day: sql<string>`DATE(${stripeEvents.createdAt})`.as("day"),
            revenueCents: sum(stripeEvents.amountCents),
          })
          .from(stripeEvents)
          .where(
            and(
              eq(stripeEvents.eventType, "checkout.completed"),
              gte(stripeEvents.createdAt, from),
              lt(stripeEvents.createdAt, to)
            )
          )
          .groupBy(sql`DATE(${stripeEvents.createdAt})`)
          .orderBy(sql`DATE(${stripeEvents.createdAt})`);

        return { pvSeries, signupSeries, revSeries };
      }),
  }),

  // ─── Users ─────────────────────────────────────────────────────────────────

  users: router({
    /** List all users with summary info. */
    list: adminProcedure
      .input(
        z.object({
          search: z.string().optional(),
          tier: z.enum(["free", "basic", "pro", "all"]).default("all"),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(100).default(50),
        })
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const { page, pageSize, tier } = input;
        const offset = (page - 1) * pageSize;

        const conditions = [];
        if (tier !== "all") {
          conditions.push(eq(users.planTier, tier));
        }
        if (input.search) {
          const like = `%${input.search}%`;
          conditions.push(
            sql`(${users.name} LIKE ${like} OR ${users.email} LIKE ${like})`
          );
        }

        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const rows = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            planTier: users.planTier,
            role: users.role,
            betaOverride: users.betaOverride,
            stripeCustomerId: users.stripeCustomerId,
            stripeSubscriptionId: users.stripeSubscriptionId,
            subscriptionEndsAt: users.subscriptionEndsAt,
            createdAt: users.createdAt,
            lastSignedIn: users.lastSignedIn,
          })
          .from(users)
          .where(where)
          .orderBy(desc(users.createdAt))
          .limit(pageSize)
          .offset(offset);

        const [countRow] = await db
          .select({ total: count() })
          .from(users)
          .where(where);

        return { users: rows, total: countRow?.total ?? 0, page, pageSize };
      }),

    /** Get detailed info for a single user including plan count and Stripe events. */
    detail: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);

        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

        const [planCountRow] = await db
          .select({ total: count() })
          .from(plans)
          .where(eq(plans.userId, input.userId));

        const events = await db
          .select()
          .from(stripeEvents)
          .where(eq(stripeEvents.userId, input.userId))
          .orderBy(desc(stripeEvents.createdAt))
          .limit(20);

        const recentViews = await db
          .select({
            path: pageViews.path,
            views: count(),
            lastSeen: sql<Date>`MAX(${pageViews.createdAt})`.as("lastSeen"),
          })
          .from(pageViews)
          .where(eq(pageViews.userId, input.userId))
          .groupBy(pageViews.path)
          .orderBy(desc(sql`MAX(${pageViews.createdAt})`))
          .limit(10);

        return {
          user,
          planCount: planCountRow?.total ?? 0,
          stripeEvents: events,
          recentPageViews: recentViews,
        };
      }),

    /** Set a user's plan tier (admin override). */
    setTier: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          tier: z.enum(["free", "basic", "pro"]),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await db
          .update(users)
          .set({ planTier: input.tier })
          .where(eq(users.id, input.userId));
        return { success: true };
      }),

    /** Set per-user beta override (null = follow global flag). */
    setBeta: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          betaOverride: z.boolean().nullable(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await db
          .update(users)
          .set({ betaOverride: input.betaOverride })
          .where(eq(users.id, input.userId));
        return { success: true };
      }),

    /** Set a user's role (admin / user). */
    setRole: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          role: z.enum(["user", "admin"]),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await db
          .update(users)
          .set({ role: input.role })
          .where(eq(users.id, input.userId));
        return { success: true };
      }),
  }),
});
