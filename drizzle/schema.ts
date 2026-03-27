import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  boolean,
  bigint,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Searches initiated by users
export const searches = mysqlTable("searches", {
  id: int("id").autoincrement().primaryKey(),
  query: varchar("query", { length: 512 }).notNull(),
  searchType: mysqlEnum("searchType", ["deep_research", "build_profile", "investigate_domain", "monitor"]).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  resultSummary: text("resultSummary"),
  entityId: int("entityId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Search = typeof searches.$inferSelect;
export type InsertSearch = typeof searches.$inferInsert;

// Entities (companies, people, domains, organizations)
export const entities = mysqlTable("entities", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 512 }).notNull(),
  entityType: mysqlEnum("entityType", ["company", "person", "domain", "organization", "fund"]).notNull(),
  description: text("description"),
  jurisdiction: varchar("jurisdiction", { length: 128 }),
  incorporationDate: varchar("incorporationDate", { length: 32 }),
  status: varchar("status", { length: 64 }),
  website: varchar("website", { length: 512 }),
  ticker: varchar("ticker", { length: 32 }),
  cik: varchar("cik", { length: 32 }),
  ein: varchar("ein", { length: 32 }),
  address: text("address"),
  profileData: json("profileData"),
  llmSummary: text("llmSummary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Entity = typeof entities.$inferSelect;
export type InsertEntity = typeof entities.$inferInsert;

// Relationships between entities
export const relationships = mysqlTable("relationships", {
  id: int("id").autoincrement().primaryKey(),
  sourceId: int("sourceId").notNull(),
  targetId: int("targetId").notNull(),
  relationshipType: varchar("relationshipType", { length: 128 }).notNull(),
  description: text("description"),
  startDate: varchar("startDate", { length: 32 }),
  endDate: varchar("endDate", { length: 32 }),
  confidence: int("confidence").default(100),
  source: varchar("source", { length: 256 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Relationship = typeof relationships.$inferSelect;
export type InsertRelationship = typeof relationships.$inferInsert;

// SEC filings cache
export const secFilings = mysqlTable("sec_filings", {
  id: int("id").autoincrement().primaryKey(),
  entityId: int("entityId").notNull(),
  cik: varchar("cik", { length: 32 }).notNull(),
  formType: varchar("formType", { length: 32 }).notNull(),
  filingDate: varchar("filingDate", { length: 32 }).notNull(),
  reportDate: varchar("reportDate", { length: 32 }),
  accessionNumber: varchar("accessionNumber", { length: 64 }),
  description: text("description"),
  url: varchar("url", { length: 1024 }),
  data: json("data"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SecFiling = typeof secFilings.$inferSelect;

// Campaign finance records
export const campaignFinance = mysqlTable("campaign_finance", {
  id: int("id").autoincrement().primaryKey(),
  entityId: int("entityId"),
  donorName: varchar("donorName", { length: 512 }),
  recipientName: varchar("recipientName", { length: 512 }),
  amount: bigint("amount", { mode: "number" }),
  date: varchar("date", { length: 32 }),
  cycle: varchar("cycle", { length: 16 }),
  source: varchar("source", { length: 128 }),
  data: json("data"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Domain intelligence records
export const domainIntel = mysqlTable("domain_intel", {
  id: int("id").autoincrement().primaryKey(),
  entityId: int("entityId"),
  domain: varchar("domain", { length: 512 }).notNull(),
  registrar: varchar("registrar", { length: 256 }),
  registrantOrg: varchar("registrantOrg", { length: 512 }),
  registrantEmail: varchar("registrantEmail", { length: 320 }),
  createdDate: varchar("createdDate", { length: 32 }),
  expiresDate: varchar("expiresDate", { length: 32 }),
  nameservers: json("nameservers"),
  ipAddresses: json("ipAddresses"),
  technologies: json("technologies"),
  certificates: json("certificates"),
  data: json("data"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Subscriptions for monitoring entities
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  entityId: int("entityId").notNull(),
  entityName: varchar("entityName", { length: 512 }).notNull(),
  notifyOnFilings: boolean("notifyOnFilings").default(true).notNull(),
  notifyOnOwnership: boolean("notifyOnOwnership").default(true).notNull(),
  notifyOnConnections: boolean("notifyOnConnections").default(true).notNull(),
  notifyOnNews: boolean("notifyOnNews").default(false).notNull(),
  lastChecked: timestamp("lastChecked"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// Cached API responses
export const cachedResponses = mysqlTable("cached_responses", {
  id: int("id").autoincrement().primaryKey(),
  source: varchar("source", { length: 128 }).notNull(),
  cacheKey: varchar("cacheKey", { length: 512 }).notNull(),
  data: json("data").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Search progress events (for streaming)
export const searchProgress = mysqlTable("search_progress", {
  id: int("id").autoincrement().primaryKey(),
  searchId: int("searchId").notNull(),
  source: varchar("source", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "skipped"]).default("pending").notNull(),
  resultCount: int("resultCount").default(0),
  message: text("message"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SearchProgress = typeof searchProgress.$inferSelect;
