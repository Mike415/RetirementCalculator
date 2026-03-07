import {
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
  planTier: mysqlEnum("planTier", ["free", "basic", "pro"]).default("free").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  subscriptionEndsAt: timestamp("subscriptionEndsAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
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
