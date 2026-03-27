import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the DB and OSINT modules so tests don't hit real APIs
vi.mock("./db", () => ({
  createSearch: vi.fn().mockResolvedValue(1),
  updateSearchStatus: vi.fn().mockResolvedValue(undefined),
  getSearchById: vi.fn().mockResolvedValue({
    id: 1,
    query: "BlackRock",
    searchType: "deep_research",
    status: "completed",
    entityId: 1,
    resultSummary: "Test summary",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getRecentSearches: vi.fn().mockResolvedValue([]),
  upsertSearchProgress: vi.fn().mockResolvedValue(undefined),
  getSearchProgress: vi.fn().mockResolvedValue([
    { id: 1, searchId: 1, source: "sec_edgar", status: "completed", resultCount: 5, message: "Found 5 results", createdAt: new Date(), updatedAt: new Date() },
  ]),
  upsertEntity: vi.fn().mockResolvedValue(1),
  getEntityById: vi.fn().mockResolvedValue({
    id: 1,
    name: "BlackRock Inc",
    entityType: "company",
    description: "Investment management firm",
    jurisdiction: "US",
    status: "Active",
    cik: "1364742",
    ticker: "BLK",
    website: "blackrock.com",
    address: "New York, NY",
    incorporationDate: null,
    profileData: {},
    llmSummary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getRecentEntities: vi.fn().mockResolvedValue([]),
  createRelationship: vi.fn().mockResolvedValue(1),
  getRelationshipsForEntity: vi.fn().mockResolvedValue([]),
  getSecFilingsForEntity: vi.fn().mockResolvedValue([
    { id: 1, entityId: 1, formType: "10-K", filingDate: "2024-02-15", accessionNumber: "0001364742-24-000001", description: "Annual Report", url: "https://sec.gov/test", createdAt: new Date() },
  ]),
  saveSecFilings: vi.fn().mockResolvedValue(undefined),
  getCampaignFinanceForEntity: vi.fn().mockResolvedValue([]),
  saveCampaignFinance: vi.fn().mockResolvedValue(undefined),
  getDomainIntelForEntity: vi.fn().mockResolvedValue([]),
  saveDomainIntel: vi.fn().mockResolvedValue(undefined),
  createSubscription: vi.fn().mockResolvedValue(1),
  getSubscriptions: vi.fn().mockResolvedValue([
    { id: 1, entityId: 1, entityName: "BlackRock Inc", notifyOnFilings: true, notifyOnOwnership: true, notifyOnConnections: true, notifyOnNews: false, lastChecked: null, active: true, createdAt: new Date() },
  ]),
  deleteSubscription: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./osint", () => ({
  getOsintSources: vi.fn().mockReturnValue([
    { name: "sec_edgar", label: "SEC EDGAR" },
    { name: "opencorporates", label: "OpenCorporates" },
  ]),
  compileProfile: vi.fn().mockResolvedValue({ company: { name: "BlackRock Inc" } }),
  getEdgarSubmissions: vi.fn().mockResolvedValue({ filings: [] }),
  searchOpenCorporates: vi.fn().mockResolvedValue([]),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Mock LLM analysis of BlackRock Inc." } }],
  }),
}));

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Search Router", () => {
  it("initiates a search and returns a searchId", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.initiate({
      query: "BlackRock",
      searchType: "deep_research",
    });
    expect(result).toHaveProperty("searchId");
    expect(typeof result.searchId).toBe("number");
  });

  it("returns search status with progress", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.status({ searchId: 1 });
    expect(result).toHaveProperty("search");
    expect(result).toHaveProperty("progress");
    expect(Array.isArray(result.progress)).toBe(true);
    expect(result.search?.query).toBe("BlackRock");
  });

  it("returns search history", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.search.history();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Entity Router", () => {
  it("returns entity profile with filings", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.entity.getProfile({ id: 1 });
    expect(result).not.toBeNull();
    expect(result?.entity.name).toBe("BlackRock Inc");
    expect(result?.entity.entityType).toBe("company");
    expect(Array.isArray(result?.filings)).toBe(true);
    expect(result?.filings[0]?.formType).toBe("10-K");
  });

  it("returns graph data for entity", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.entity.getGraph({ id: 1, depth: 1 });
    expect(result).toHaveProperty("nodes");
    expect(result).toHaveProperty("edges");
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(result.nodes[0]?.id).toBe("1");
    expect(result.nodes[0]?.label).toBe("BlackRock Inc");
  });

  it("exports entity data as JSON", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.entity.export({ id: 1, format: "json" });
    expect(result.filename).toContain(".json");
    const parsed = JSON.parse(result.data);
    expect(parsed).toHaveProperty("entity");
  });

  it("exports entity data as CSV", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.entity.export({ id: 1, format: "csv" });
    expect(result.filename).toContain(".csv");
    expect(result.data).toContain("BlackRock Inc");
  });

  it("returns recent entities list", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.entity.getRecent();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Subscriptions Router", () => {
  it("creates a subscription", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.subscriptions.create({
      entityId: 1,
      entityName: "BlackRock Inc",
      notifyOnFilings: true,
      notifyOnOwnership: true,
      notifyOnConnections: true,
      notifyOnNews: false,
    });
    expect(result).toHaveProperty("id");
    expect(result.id).toBe(1);
  });

  it("lists subscriptions", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.subscriptions.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.entityName).toBe("BlackRock Inc");
    expect(result[0]?.active).toBe(true);
  });

  it("deletes a subscription", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.subscriptions.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

describe("Intel Analysis Router", () => {
  it("generates LLM analysis for an entity", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.intel.analyze({ entityId: 1, analysisType: "summary" });
    expect(result).toHaveProperty("analysis");
    expect(typeof result.analysis).toBe("string");
    expect(result.analysis.length).toBeGreaterThan(0);
  });

  it("generates connections analysis", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.intel.analyze({ entityId: 1, analysisType: "connections" });
    expect(result).toHaveProperty("analysis");
  });

  it("generates risks analysis", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.intel.analyze({ entityId: 1, analysisType: "risks" });
    expect(result).toHaveProperty("analysis");
  });

  it("generates timeline analysis", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.intel.analyze({ entityId: 1, analysisType: "timeline" });
    expect(result).toHaveProperty("analysis");
  });
});

describe("Auth Router", () => {
  it("returns null user when not authenticated", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("clears cookie on logout", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});
