import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table — extended with Clerk ID and subscription tier.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Clerk user ID (sub claim from Clerk JWT). */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Subscription tier: free | basic | pro */
  // Default is "free"; beta feature access is controlled by BETA_FEATURES_UNLOCKED
  // in shared/tierLimits.ts — no DB change needed to end the beta.
  planTier: mysqlEnum("planTier", ["free", "basic", "pro"]).default("free").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  subscriptionEndsAt: timestamp("subscriptionEndsAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  /**
   * Per-user beta override. When set, overrides BETA_FEATURES_UNLOCKED for this user.
   * null = follow global flag, true = beta on, false = beta off.
   */
  betaOverride: boolean("betaOverride"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Retirement plans — one JSON blob per plan, resilient to schema changes.
 * The `data` column stores the full RetirementInputs object.
 * New fields added to RetirementInputs are handled by mergeWithDefaults on the frontend.
 */
export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull().default("My Plan"),
  /** Increment when a breaking structural change requires a migration script. */
  schemaVersion: int("schemaVersion").notNull().default(1),
  /** Full RetirementInputs JSON blob. */
  data: json("data").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

/**
 * Plan version history — last 10 saves per plan for rollback.
 */
export const planVersions = mysqlTable("planVersions", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  data: json("data").notNull(),
  savedAt: timestamp("savedAt").defaultNow().notNull(),
});

export type PlanVersion = typeof planVersions.$inferSelect;
export type InsertPlanVersion = typeof planVersions.$inferInsert;

/**
 * Page view events for analytics.
 * Lightweight: just path + session + optional userId.
 */
export const pageViews = mysqlTable("pageViews", {
  id: int("id").autoincrement().primaryKey(),
  /** Anonymous session fingerprint (stored in localStorage). */
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  /** Authenticated user ID if signed in. */
  userId: int("userId"),
  /** Hash path, e.g. /overview, /billing */
  path: varchar("path", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = typeof pageViews.$inferInsert;

/**
 * Stripe subscription events for analytics (cancellations, resubscriptions).
 * Written by the webhook handler.
 */
export const stripeEvents = mysqlTable("stripeEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  /** checkout.completed | subscription.canceled | subscription.reactivated */
  eventType: varchar("eventType", { length: 64 }).notNull(),
  tier: mysqlEnum("tier", ["free", "basic", "pro"]),
  /** Amount in cents (for revenue tracking). */
  amountCents: int("amountCents"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StripeEvent = typeof stripeEvents.$inferSelect;
export type InsertStripeEvent = typeof stripeEvents.$inferInsert;
