import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import {
  createSearch,
  updateSearchStatus,
  getSearchById,
  getRecentSearches,
  upsertSearchProgress,
  getSearchProgress,
  upsertEntity,
  getEntityById,
  getRecentEntities,
  createRelationship,
  getRelationshipsForEntity,
  getSecFilingsForEntity,
  saveSecFilings,
  getCampaignFinanceForEntity,
  saveCampaignFinance,
  getDomainIntelForEntity,
  saveDomainIntel,
  createSubscription,
  getSubscriptions,
  deleteSubscription,
} from "./db";
import {
  getOsintSources,
  compileProfile,
  getEdgarSubmissions,
} from "./osint";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Search ────────────────────────────────────────────────────────────────
  search: router({
    initiate: publicProcedure
      .input(
        z.object({
          query: z.string().min(1).max(512),
          searchType: z.enum(["deep_research", "build_profile", "investigate_domain", "monitor"]),
        })
      )
      .mutation(async ({ input }) => {
        const searchId = await createSearch({
          query: input.query,
          searchType: input.searchType,
          status: "pending",
        });

        // Pre-register ALL sources as pending so the frontend count is correct from the start
        const sources = getOsintSources(input.searchType);
        for (const source of sources) {
          await upsertSearchProgress(searchId, source.name, "pending", 0, `Queued: ${source.label}`);
        }

        // Fire background collection — guaranteed to complete (never hangs)
        runOsintCollection(searchId, input.query, input.searchType).catch(console.error);

        return { searchId, totalSources: sources.length };
      }),

    status: publicProcedure
      .input(z.object({ searchId: z.number() }))
      .query(async ({ input }) => {
        const search = await getSearchById(input.searchId);
        const progress = await getSearchProgress(input.searchId);
        // Deduplicate: keep only the latest row per source
        const latestBySource = new Map<string, typeof progress[0]>();
        for (const p of progress) {
          const existing = latestBySource.get(p.source);
          if (!existing || p.id > existing.id) {
            latestBySource.set(p.source, p);
          }
        }
        const dedupedProgress = Array.from(latestBySource.values());
        // Return allSources metadata so frontend knows the full list
        const allSourcesMeta = getOsintSources().map(s => ({ name: s.name, label: s.label, category: s.category }));
        return { search, progress: dedupedProgress, allSources: allSourcesMeta };
      }),

    history: publicProcedure.query(async () => {
      return getRecentSearches(30);
    }),
  }),

  // ─── Entity ────────────────────────────────────────────────────────────────
  entity: router({
    getProfile: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const entity = await getEntityById(input.id);
        if (!entity) return null;
        const relationships = await getRelationshipsForEntity(input.id);
        const filings = await getSecFilingsForEntity(input.id);
        const campaignFinance = await getCampaignFinanceForEntity(input.id);
        const domainIntel = await getDomainIntelForEntity(input.id);
        return { entity, relationships, filings, campaignFinance, domainIntel };
      }),

    getGraph: publicProcedure
      .input(z.object({ id: z.number(), depth: z.number().min(1).max(3).default(2) }))
      .query(async ({ input }) => {
        const entity = await getEntityById(input.id);
        if (!entity) return { nodes: [], edges: [] };

        const nodes: Array<{ id: string; label: string; type: string; data?: unknown }> = [];
        const edges: Array<{ source: string; target: string; label: string; data?: unknown }> = [];
        const visited = new Set<number>();

        async function traverse(entityId: number, currentDepth: number) {
          if (visited.has(entityId) || currentDepth > input.depth) return;
          visited.add(entityId);

          const ent = await getEntityById(entityId);
          if (!ent) return;

          nodes.push({
            id: String(entityId),
            label: ent.name,
            type: ent.entityType || "unknown",
            data: { cik: ent.cik, jurisdiction: ent.jurisdiction, status: ent.status },
          });

          const rels = await getRelationshipsForEntity(entityId);
          for (const rel of rels) {
            const otherId = rel.sourceId === entityId ? rel.targetId : rel.sourceId;
            if (!visited.has(otherId)) {
              edges.push({
                source: String(rel.sourceId),
                target: String(rel.targetId),
                label: rel.relationshipType,
                data: { description: rel.description, confidence: rel.confidence },
              });
              await traverse(otherId, currentDepth + 1);
            }
          }
        }

        await traverse(input.id, 1);
        return { nodes, edges };
      }),

    getRecent: publicProcedure.query(async () => {
      return getRecentEntities(20);
    }),

    exportProfile: publicProcedure
      .input(z.object({ id: z.number(), format: z.enum(["json", "csv"]) }))
      .query(async ({ input }) => {
        const entity = await getEntityById(input.id);
        if (!entity) throw new Error("Entity not found");
        const relationships = await getRelationshipsForEntity(input.id);
        const filings = await getSecFilingsForEntity(input.id);
        const campaignFinance = await getCampaignFinanceForEntity(input.id);
        const domainIntel = await getDomainIntelForEntity(input.id);

        if (input.format === "json") {
          return {
            data: JSON.stringify({ entity, relationships, filings, campaignFinance, domainIntel }, null, 2),
            filename: `${entity.name.replace(/[^a-z0-9]/gi, "_")}_profile.json`,
          };
        }

        const rows: string[] = ["Type,Name,Value,Date"];
        filings.forEach((f) => rows.push(`Filing,${f.formType},${f.description || ""},${f.filingDate}`));
        relationships.forEach((r) => rows.push(`Relationship,${r.relationshipType},${r.description || ""},`));
        campaignFinance.forEach((c) => rows.push(`CampaignFinance,${c.donorName || ""},${c.amount || 0},${c.date || ""}`));

        return {
          data: rows.join("\n"),
          filename: `${entity.name.replace(/[^a-z0-9]/gi, "_")}_profile.csv`,
        };
      }),
  }),

  // ─── Subscriptions ─────────────────────────────────────────────────────────
  subscriptions: router({
    create: publicProcedure
      .input(
        z.object({
          entityId: z.number(),
          entityName: z.string(),
          notifyOnFilings: z.boolean().default(true),
          notifyOnOwnership: z.boolean().default(true),
          notifyOnConnections: z.boolean().default(true),
          notifyOnNews: z.boolean().default(false),
        })
      )
      .mutation(async ({ input }) => {
        const id = await createSubscription(input);
        return { id };
      }),

    list: publicProcedure.query(async () => {
      return getSubscriptions();
    }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteSubscription(input.id);
        return { success: true };
      }),
  }),

  // ─── Intel Analysis ────────────────────────────────────────────────────────
  intel: router({
    analyze: publicProcedure
      .input(
        z.object({
          entityId: z.number(),
          analysisType: z.enum(["summary", "connections", "risks", "timeline"]).default("summary"),
        })
      )
      .mutation(async ({ input }) => {
        const entity = await getEntityById(input.entityId);
        if (!entity) throw new Error("Entity not found");

        const relationships = await getRelationshipsForEntity(input.entityId);
        const filings = await getSecFilingsForEntity(input.entityId);
        const campaignFinance = await getCampaignFinanceForEntity(input.entityId);
        const profileData = entity.profileData as any;

        const contextData = {
          entity: {
            name: entity.name, type: entity.entityType, description: entity.description,
            jurisdiction: entity.jurisdiction, status: entity.status, cik: entity.cik, ticker: entity.ticker,
          },
          relationships: relationships.slice(0, 25).map((r) => ({
            type: r.relationshipType, description: r.description,
          })),
          recentFilings: filings.slice(0, 10).map((f) => ({
            form: f.formType, date: f.filingDate, description: f.description,
          })),
          campaignContributions: campaignFinance.slice(0, 10).map((c) => ({
            donor: c.donorName, recipient: c.recipientName, amount: c.amount, date: c.date,
          })),
          sanctions: profileData?.sanctions?.slice(0, 5),
          contracts: profileData?.contracts?.slice(0, 5),
          courtCases: profileData?.courtCases?.slice(0, 5),
          lobbying: profileData?.lobbying?.slice(0, 5),
          news: profileData?.news?.slice(0, 5),
          wikiSummary: profileData?.wikiSummary?.slice(0, 800),
        };

        const prompts: Record<string, string> = {
          summary: `You are an OSINT intelligence analyst. Analyze the following entity profile and provide a comprehensive executive summary covering: key facts, business activities, notable relationships, regulatory history, sanctions/watchlist status, government contracts, lobbying activities, and any red flags. Be specific and factual.\n\nEntity Data:\n${JSON.stringify(contextData, null, 2)}`,
          connections: `You are an OSINT intelligence analyst specializing in network analysis. Analyze the following entity's relationships and connections. Identify: key power brokers, ownership chains, board interlocks, lobbying relationships, potential conflicts of interest, and hidden connections. Explain the significance of each major connection.\n\nEntity Data:\n${JSON.stringify(contextData, null, 2)}`,
          risks: `You are a risk intelligence analyst. Analyze the following entity profile and identify: regulatory risks, financial red flags, sanctions exposure, political exposure (PEP), reputational concerns, legal proceedings, and any patterns that warrant further investigation. Provide a risk assessment with specific evidence from the data.\n\nEntity Data:\n${JSON.stringify(contextData, null, 2)}`,
          timeline: `You are an OSINT analyst. Create a chronological timeline of key events for this entity based on the available data. Include: incorporation/founding, major SEC filings, ownership changes, executive appointments, regulatory actions, campaign contributions, lobbying registrations, and court cases. Format as a clear timeline with dates.\n\nEntity Data:\n${JSON.stringify(contextData, null, 2)}`,
        };

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an expert OSINT intelligence analyst with deep expertise in corporate structure analysis, SEC filings, campaign finance, sanctions, and relationship mapping. Provide detailed, factual analysis based on the data provided." },
            { role: "user", content: prompts[input.analysisType] },
          ],
        });

        const rawAnalysis = response.choices?.[0]?.message?.content;
        const analysis = typeof rawAnalysis === "string" ? rawAnalysis : "Analysis unavailable";

        return { analysis, analysisType: input.analysisType };
      }),
  }),
});

export type AppRouter = typeof appRouter;

// ─── Background OSINT Collection ──────────────────────────────────────────────
// KEY FIX: Every source is wrapped in a try/catch with a hard timeout.
// Promise.allSettled guarantees ALL promises resolve — no source can hang forever.
// The search is only marked "completed" AFTER every single source finishes.

async function runOsintCollection(searchId: number, query: string, searchType: string) {
  try {
    await updateSearchStatus(searchId, "running");

    const sources = getOsintSources(searchType);
    const collectedData: Record<string, unknown> = {};

    // Run ALL sources in parallel — Promise.allSettled never rejects
    // Each source has its own 12s timeout inside safeFetch, so none can hang
    await Promise.allSettled(
      sources.map(async (source) => {
        try {
          await upsertSearchProgress(searchId, source.name, "running", 0, `Querying ${source.label}...`);
          
          // Wrap in a race with a 15s outer timeout as extra safety
          const data = await Promise.race([
            source.fn(query),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
          ]);
          
          collectedData[source.name] = data;
          const resultCount = countResults(data);
          const hasData = data !== null && data !== undefined;
          await upsertSearchProgress(
            searchId, source.name,
            hasData ? "completed" : "completed",  // always completed, never stuck
            resultCount,
            hasData ? `Found ${resultCount} result${resultCount !== 1 ? "s" : ""} from ${source.label}` : `No data from ${source.label}`
          );
        } catch (err) {
          // Even on error, mark as completed (failed) — never leave as "running"
          collectedData[source.name] = null;
          await upsertSearchProgress(searchId, source.name, "failed", 0, `Unavailable: ${source.label}`);
        }
      })
    );

    // Try to enrich with EDGAR submissions if CIK found
    const edgarData = collectedData.sec_edgar as any;
    const cik = edgarData?.hits?.hits?.[0]?._source?.entity_id;
    if (cik) {
      try {
        const submissions = await getEdgarSubmissions(String(cik));
        collectedData.edgar_submissions = submissions;
      } catch {}
    }

    // Compile unified profile
    const profile = compileProfile(query, searchType, collectedData);
    const entityType = searchType === "investigate_domain" ? "domain" : "company";

    // Save entity
    const entityId = await upsertEntity({
      name: query,
      entityType,
      description: profile.wikiSummary as string | undefined,
      jurisdiction: (profile.company as any)?.jurisdiction,
      incorporationDate: (profile.company as any)?.incorporationDate,
      status: (profile.company as any)?.status,
      cik: (profile.edgar as any)?.cik,
      address: (profile.company as any)?.registeredAddress,
      profileData: profile as unknown as Record<string, unknown>,
    });

    // Save SEC filings
    const profileEdgar = profile.edgar as any;
    if (profileEdgar?.cik && profileEdgar?.filings?.length) {
      await saveSecFilings(entityId, profileEdgar.cik, profileEdgar.filings);
    }

    // Save relationships
    const relArr = profile.relationships as any[] | undefined;
    if (relArr?.length) {
      for (const rel of relArr) {
        const targetId = await upsertEntity({
          name: rel.target,
          entityType: rel.type === "registered_in" ? "organization" : "person",
        });
        const sourceId = rel.source === query
          ? entityId
          : await upsertEntity({ name: rel.source, entityType: "person" });
        await createRelationship({
          sourceId, targetId,
          relationshipType: rel.type,
          description: rel.description,
          source: "osint_collection",
          confidence: 80,
        });
      }
    }

    // Save campaign finance
    const cfArr = profile.campaignFinance as any[] | undefined;
    if (cfArr?.length) {
      for (const cf of cfArr) {
        await saveCampaignFinance({
          entityId,
          donorName: cf.donor,
          recipientName: cf.recipient,
          amount: cf.amount,
          date: cf.date,
          source: "fec",
        });
      }
    }

    // Save domain intel
    const domainData = profile.domain as any;
    if (domainData) {
      await saveDomainIntel({
        entityId,
        domain: query,
        registrar: domainData.registrar,
        registrantOrg: domainData.registrantOrg,
        createdDate: domainData.createdDate,
        expiresDate: domainData.expiresDate,
        nameservers: domainData.nameservers,
        ipAddresses: domainData.ipAddresses,
        certificates: domainData.certificates,
        data: domainData,
      });
    }

    // Generate LLM summary
    let llmSummary = "";
    try {
      const summaryResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an OSINT intelligence analyst. Provide a concise 3-paragraph executive summary of the entity based on the collected data. Focus on key facts, notable relationships, sanctions status, government contracts, and any significant findings.",
          },
          {
            role: "user",
            content: `Analyze: ${query}\n\nData summary:\n${JSON.stringify({
              company: profile.company,
              edgar: (profile.edgar as any) ? { cik: (profile.edgar as any).cik, filingCount: (profile.edgar as any).filings?.length } : null,
              sanctions: (profile.sanctions as any[])?.slice(0, 3),
              contracts: (profile.contracts as any[])?.slice(0, 3),
              grants: (profile.grants as any[])?.slice(0, 3),
              campaignFinance: (profile.campaignFinance as any[])?.slice(0, 3),
              courtCases: (profile.courtCases as any[])?.slice(0, 3),
              lobbying: (profile.lobbying as any[])?.slice(0, 3),
              news: (profile.news as any[])?.slice(0, 3),
              wikiSummary: (profile.wikiSummary as string | undefined)?.slice(0, 500),
              relationshipCount: (profile.relationships as any[])?.length,
              sourcesQueried: Object.keys(collectedData).length,
            }, null, 2)}`,
          },
        ],
      });
      const rawSummary = summaryResponse.choices?.[0]?.message?.content;
      llmSummary = typeof rawSummary === "string" ? rawSummary : "";
    } catch {}

    // Update entity with LLM summary
    if (llmSummary) {
      await upsertEntity({
        id: entityId,
        name: query,
        entityType,
        llmSummary,
        profileData: profile as unknown as Record<string, unknown>,
      });
    }

    const completedSources = Object.keys(collectedData).filter((k) => collectedData[k] !== null).length;
    await updateSearchStatus(
      searchId, "completed",
      llmSummary || `Queried ${sources.length} sources, found data in ${completedSources}`,
      entityId
    );
  } catch (err) {
    console.error("[OSINT] Collection failed:", err);
    // Even on catastrophic failure, mark all pending sources as failed
    try {
      const progress = await getSearchProgress(searchId);
      for (const p of progress) {
        if (p.status === "pending" || p.status === "running") {
          await upsertSearchProgress(searchId, p.source, "failed", 0, `Error: collection interrupted`);
        }
      }
    } catch {}
    await updateSearchStatus(searchId, "failed", String(err));
  }
}

function countResults(data: unknown): number {
  if (!data) return 0;
  if (Array.isArray(data)) return data.length;
  if (typeof data === "string") return data.split("\n").filter(Boolean).length;
  const obj = data as Record<string, unknown>;
  if (obj.results && Array.isArray(obj.results)) return (obj.results as unknown[]).length;
  if (obj.hits && (obj.hits as any).hits) return ((obj.hits as any).hits as unknown[]).length;
  if (obj.companies && Array.isArray(obj.companies)) return (obj.companies as unknown[]).length;
  if (obj.items && Array.isArray(obj.items)) return (obj.items as unknown[]).length;
  if (obj.data && Array.isArray(obj.data)) return (obj.data as unknown[]).length;
  if (obj.organizations && Array.isArray(obj.organizations)) return (obj.organizations as unknown[]).length;
  if (obj.patents && Array.isArray(obj.patents)) return (obj.patents as unknown[]).length;
  if (obj.articles && Array.isArray(obj.articles)) return (obj.articles as unknown[]).length;
  if (obj.message && (obj.message as any).items) return ((obj.message as any).items as unknown[]).length;
  return 1;
}
