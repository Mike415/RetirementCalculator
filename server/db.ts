import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertPlan, InsertUser, Plan, planVersions, plans, users } from "../drizzle/schema";
let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User helpers ────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserTier(
  userId: number,
  tier: "free" | "basic" | "pro",
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
  subscriptionEndsAt?: Date,
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ planTier: tier, stripeCustomerId, stripeSubscriptionId, subscriptionEndsAt })
    .where(eq(users.id, userId));
}

// ─── Plan helpers ─────────────────────────────────────────────────────────────

/** List all plans for a user (metadata only, no data blob). */
export async function getUserPlans(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: plans.id,
      name: plans.name,
      schemaVersion: plans.schemaVersion,
      createdAt: plans.createdAt,
      updatedAt: plans.updatedAt,
    })
    .from(plans)
    .where(eq(plans.userId, userId))
    .orderBy(desc(plans.updatedAt));
}

/** Get a single plan by ID, verifying ownership. */
export async function getPlan(planId: number, userId: number): Promise<Plan | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.userId, userId)))
    .limit(1);
  return result[0];
}

/** Create a new plan and return it. */
export async function createPlan(userId: number, name: string, data: unknown): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(plans).values({ userId, name, data } as InsertPlan);
  return (result[0] as any).insertId as number;
}

/** Save (upsert) a plan and snapshot the previous version. */
export async function savePlan(planId: number, userId: number, data: unknown, name?: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Snapshot the current version before overwriting
  const existing = await getPlan(planId, userId);
  if (existing) {
    await db.insert(planVersions).values({ planId, data: existing.data });
    // Keep only the last 10 versions
    const versions = await db
      .select({ id: planVersions.id })
      .from(planVersions)
      .where(eq(planVersions.planId, planId))
      .orderBy(desc(planVersions.savedAt));
    if (versions.length > 10) {
      const toDelete = versions.slice(10).map((v) => v.id);
      for (const id of toDelete) {
        await db.delete(planVersions).where(eq(planVersions.id, id));
      }
    }
  }

  const updateData: Record<string, unknown> = { data };
  if (name !== undefined) updateData.name = name;
  await db.update(plans).set(updateData).where(and(eq(plans.id, planId), eq(plans.userId, userId)));
}

/** Delete a plan and all its versions. */
export async function deletePlan(planId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(planVersions).where(eq(planVersions.planId, planId));
  await db.delete(plans).where(and(eq(plans.id, planId), eq(plans.userId, userId)));
}

/** Get version history for a plan. */
export async function getPlanVersions(planId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Verify ownership first
  const plan = await getPlan(planId, userId);
  if (!plan) return [];
  return db
    .select({ id: planVersions.id, savedAt: planVersions.savedAt })
    .from(planVersions)
    .where(eq(planVersions.planId, planId))
    .orderBy(desc(planVersions.savedAt));
}
