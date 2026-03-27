import { eq, desc, and, lt, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  searches,
  entities,
  relationships,
  secFilings,
  campaignFinance,
  domainIntel,
  subscriptions,
  cachedResponses,
  searchProgress,
  InsertSearch,
  InsertEntity,
  InsertRelationship,
  InsertSubscription,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

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

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Searches ────────────────────────────────────────────────────────────────

export async function createSearch(data: InsertSearch) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(searches).values(data);
  return (result as any).insertId as number;
}

export async function updateSearchStatus(
  id: number,
  status: "pending" | "running" | "completed" | "failed",
  resultSummary?: string,
  entityId?: number
) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { status };
  if (resultSummary !== undefined) updateData.resultSummary = resultSummary;
  if (entityId !== undefined) updateData.entityId = entityId;
  if (status === "completed" || status === "failed") updateData.completedAt = new Date();
  await db.update(searches).set(updateData).where(eq(searches.id, id));
}

export async function getSearchById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(searches).where(eq(searches.id, id)).limit(1);
  return result[0];
}

export async function getRecentSearches(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(searches).orderBy(desc(searches.createdAt)).limit(limit);
}

// ─── Search Progress ──────────────────────────────────────────────────────────

export async function upsertSearchProgress(
  searchId: number,
  source: string,
  status: "pending" | "running" | "completed" | "failed" | "skipped",
  resultCount = 0,
  message?: string
) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(searchProgress)
    .values({ searchId, source, status, resultCount, message })
    .onDuplicateKeyUpdate({ set: { status, resultCount, message } });
}

export async function getSearchProgress(searchId: number) {
  const db = await getDb();
  if (!db) return [];
  // Return all rows; frontend deduplicates by source (takes latest)
  return db
    .select()
    .from(searchProgress)
    .where(eq(searchProgress.searchId, searchId))
    .orderBy(searchProgress.id);
}

// ─── Entities ─────────────────────────────────────────────────────────────────

export async function upsertEntity(data: InsertEntity): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(entities).values(data).onDuplicateKeyUpdate({
    set: { updatedAt: new Date(), profileData: data.profileData, llmSummary: data.llmSummary },
  });
  return (result as any).insertId as number;
}

export async function getEntityById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(entities).where(eq(entities.id, id)).limit(1);
  return result[0];
}

export async function getRecentEntities(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(entities).orderBy(desc(entities.updatedAt)).limit(limit);
}

// ─── Relationships ────────────────────────────────────────────────────────────

export async function createRelationship(data: InsertRelationship) {
  const db = await getDb();
  if (!db) return;
  await db.insert(relationships).values(data);
}

export async function getRelationshipsForEntity(entityId: number) {
  const db = await getDb();
  if (!db) return [];
  const asSource = await db.select().from(relationships).where(eq(relationships.sourceId, entityId));
  const asTarget = await db.select().from(relationships).where(eq(relationships.targetId, entityId));
  return [...asSource, ...asTarget];
}

// ─── SEC Filings ──────────────────────────────────────────────────────────────

export async function saveSecFilings(
  entityId: number,
  cik: string,
  filings: Array<{
    formType: string;
    filingDate: string;
    reportDate?: string;
    accessionNumber?: string;
    description?: string;
    url?: string;
    data?: unknown;
  }>
) {
  const db = await getDb();
  if (!db) return;
  for (const f of filings) {
    await db.insert(secFilings).values({ entityId, cik, ...f }).onDuplicateKeyUpdate({
      set: { description: f.description },
    });
  }
}

export async function getSecFilingsForEntity(entityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(secFilings).where(eq(secFilings.entityId, entityId)).orderBy(desc(secFilings.filingDate));
}

// ─── Domain Intel ─────────────────────────────────────────────────────────────

export async function saveDomainIntel(data: {
  entityId?: number;
  domain: string;
  registrar?: string;
  registrantOrg?: string;
  registrantEmail?: string;
  createdDate?: string;
  expiresDate?: string;
  nameservers?: unknown;
  ipAddresses?: unknown;
  technologies?: unknown;
  certificates?: unknown;
  data?: unknown;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(domainIntel).values(data);
}

export async function getDomainIntelForEntity(entityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(domainIntel).where(eq(domainIntel.entityId, entityId));
}

// ─── Campaign Finance ─────────────────────────────────────────────────────────

export async function saveCampaignFinance(data: {
  entityId?: number;
  donorName?: string;
  recipientName?: string;
  amount?: number;
  date?: string;
  cycle?: string;
  source?: string;
  data?: unknown;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(campaignFinance).values(data);
}

export async function getCampaignFinanceForEntity(entityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campaignFinance).where(eq(campaignFinance.entityId, entityId));
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function createSubscription(data: InsertSubscription) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(subscriptions).values(data);
  return (result as any).insertId as number;
}

export async function getSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subscriptions).where(eq(subscriptions.active, true)).orderBy(desc(subscriptions.createdAt));
}

export async function deleteSubscription(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(subscriptions).set({ active: false }).where(eq(subscriptions.id, id));
}

// ─── Cache ────────────────────────────────────────────────────────────────────

export async function getCachedResponse(source: string, cacheKey: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(cachedResponses)
    .where(and(eq(cachedResponses.source, source), eq(cachedResponses.cacheKey, cacheKey), gt(cachedResponses.expiresAt, new Date())))
    .limit(1);
  return result[0]?.data ?? null;
}

export async function setCachedResponse(source: string, cacheKey: string, data: unknown, ttlSeconds = 3600) {
  const db = await getDb();
  if (!db) return;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await db.insert(cachedResponses).values({ source, cacheKey, data, expiresAt }).onDuplicateKeyUpdate({
    set: { data, expiresAt },
  });
}
