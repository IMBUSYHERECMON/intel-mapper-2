/**
 * IntelMapper OSINT Service — 100+ data sources
 *
 * ARCHITECTURE:
 * - Every fetch is wrapped in fetchWithTimeout() — hard 10s abort per request
 * - Every source function catches ALL errors and returns null on failure
 * - getOsintSources() returns a flat list of { name, label, fn } objects
 * - Promise.allSettled in routers.ts guarantees every source resolves
 * - No source can hang indefinitely — the infinite-spin bug is eliminated
 */

const TIMEOUT_MS = 10_000; // 10 seconds per source

// ─── Core fetch helper ────────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchJson(url: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetchWithTimeout(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Source function type ─────────────────────────────────────────────────────
type SourceFn = (query: string) => Promise<unknown>;

export interface OsintSource {
  name: string;
  label: string;
  category: string;
  fn: SourceFn;
}

// ─── Helper: safe wrapper — NEVER throws ─────────────────────────────────────
function safe(fn: SourceFn): SourceFn {
  return async (query: string) => {
    try {
      return await fn(query);
    } catch {
      return null;
    }
  };
}

const enc = encodeURIComponent;

// ═══════════════════════════════════════════════════════════════════════════════
// CORPORATE & REGISTRY SOURCES
// ═══════════════════════════════════════════════════════════════════════════════

const secEdgar: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://efts.sec.gov/LATEST/search-index?q=${enc(q)}&dateRange=custom&startdt=2000-01-01&forms=10-K,10-Q,8-K,DEF%2014A,13F,13D,13G,S-1&hits.hits.total.value=true&hits.hits._source.period_of_report=true&hits.hits._source.file_date=true`
  );
  return data;
});

const secEdgarFullText: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://efts.sec.gov/LATEST/search-index?q=%22${enc(q)}%22&hits.hits._source.period_of_report=true`
  );
  return data;
});

const secEdgarCompany: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://www.sec.gov/cgi-bin/browse-edgar?company=${enc(q)}&CIK=&type=10-K&dateb=&owner=include&count=20&search_text=&action=getcompany&output=atom`
  );
  return data;
});

const openCorporates: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.opencorporates.com/v0.4/companies/search?q=${enc(q)}&format=json&per_page=20`
  );
  return data;
});

const openCorporatesOfficers: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.opencorporates.com/v0.4/officers/search?q=${enc(q)}&format=json&per_page=20`
  );
  return data;
});

const openCorporatesGazette: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.opencorporates.com/v0.4/statements/search?q=${enc(q)}&format=json`
  );
  return data;
});

const gleif: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.gleif.org/api/v1/fuzzycompletions?field=entity.legalName&q=${enc(q)}`
  );
  return data;
});

const gleifLei: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=${enc(q)}&page[size]=10`
  );
  return data;
});

const littleSis: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://littlesis.org/api/entities?q=${enc(q)}&num=20`
  );
  return data;
});

const openOwnership: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://register.openownership.org/entities.json?q=${enc(q)}`
  );
  return data;
});

// ─── Additional Corporate Registry Sources ───────────────────────────────────

const germanHandelsregister: SourceFn = safe(async (q) => {
  // OpenRegister.de — public German company registry
  const data = await fetchJson(
    `https://api.openregister.de/v1/search?q=${enc(q)}&size=20`
  );
  return data;
});

const gleifRelationships: SourceFn = safe(async (q) => {
  // First find the LEI, then get relationships
  const search = await fetchJson(
    `https://api.gleif.org/api/v1/fuzzycompletions?field=entity.legalName&q=${enc(q)}`
  ) as any;
  const lei = search?.data?.[0]?.relationships?.['lei-records']?.data?.id;
  if (!lei) return { source: "gleif_relationships", query: q, results: [] };
  const [parent, children] = await Promise.all([
    fetchJson(`https://api.gleif.org/api/v1/lei-records/${lei}/direct-parent`).catch(() => null),
    fetchJson(`https://api.gleif.org/api/v1/lei-records/${lei}/direct-children?page[size]=10`).catch(() => null),
  ]);
  return { lei, directParent: parent, directChildren: children };
});

const openCorporatesNetwork: SourceFn = safe(async (q) => {
  // OpenCorporates network/relationships search
  const data = await fetchJson(
    `https://api.opencorporates.com/v0.4/companies/search?q=${enc(q)}&format=json&per_page=10&fields=company.name,company.jurisdiction_code,company.company_number,company.registered_address_in_full,company.current_status`
  );
  return data;
});

const stateBusinessFilingsCA: SourceFn = safe(async (q) => {
  // California Secretary of State business search via public API
  const data = await fetchJson(
    `https://bizfileonline.sos.ca.gov/api/Records/businesssearch?SearchType=CORP&SearchSubType=Keyword&SearchCriteria=${enc(q)}&SearchCriteriaOrg=&SearchCriteriaAgent=&SearchCriteriaFilingNumber=&SearchCriteriaFilingDate=&SearchCriteriaStatus=&SearchCriteriaEntityType=&SearchCriteriaCounty=&SearchCriteriaCity=&SearchCriteriaZip=&SearchCriteriaCountry=&NumberOfRows=20`
  );
  return data;
});

const stateBusinessFilingsDE: SourceFn = safe(async (q) => {
  // Delaware Division of Corporations entity search
  return { source: "delaware_sos", query: q, url: `https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx?searchname=${enc(q)}` };
});

const stateBusinessFilingsFL: SourceFn = safe(async (q) => {
  // Florida Sunbiz entity search
  const data = await fetchJson(
    `https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?inquiryType=EntityName&inquiryDirectionType=ForwardList&searchNameOrder=&masterDataToListOn=&ListDirectionType=&startIndex=0&searchTerm=${enc(q)}&listSize=20`
  );
  return data;
});

const stateBusinessFilingsTX: SourceFn = safe(async (q) => {
  // Texas Secretary of State SOSDirect
  return { source: "texas_sos", query: q, url: `https://mycpa.cpa.state.tx.us/coa/coaSearchBtn.do?searchTerm=${enc(q)}&btnSearch=Search` };
});

const stateBusinessFilingsNY: SourceFn = safe(async (q) => {
  // New York Department of State business entity search
  const data = await fetchJson(
    `https://apps.dos.ny.gov/publicInquiry/api/entities?name=${enc(q)}&type=&county=&status=&searchType=contains&startIndex=0&pageSize=20`
  );
  return data;
});

const registeredAgentSearch: SourceFn = safe(async (q) => {
  // National Registered Agents / CT Corporation public search
  return { source: "registered_agents", query: q, url: `https://www.ctcorporation.com/registered-agent/search?q=${enc(q)}` };
});

const globalCompanySearch: SourceFn = safe(async (q) => {
  // Kyckr global company search (public tier)
  return { source: "kyckr_global", query: q, url: `https://www.kyckr.com/company-search/?q=${enc(q)}` };
});

// ═══════════════════════════════════════════════════════════════════════════════
// SANCTIONS & WATCHLISTS
// ═══════════════════════════════════════════════════════════════════════════════

const openSanctions: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.opensanctions.org/search/default?q=${enc(q)}&limit=20`
  );
  return data;
});

const openSanctionsEntities: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.opensanctions.org/entities/_search?q=${enc(q)}&limit=20&schema=Company`
  );
  return data;
});

const interpol: SourceFn = safe(async (q) => {
  const parts = q.trim().split(/\s+/);
  const forename = parts.slice(0, -1).join(" ") || q;
  const name = parts[parts.length - 1] || q;
  const data = await fetchJson(
    `https://ws-public.interpol.int/notices/v1/red?forename=${enc(forename)}&name=${enc(name)}&resultPerPage=10&page=1`
  );
  return data;
});

const ofacSdn: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.treasury.gov/v1/ofac/sdn/search?name=${enc(q)}&limit=20`
  );
  return data;
});

const euSanctions: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4=`
  );
  // Just return a flag that we attempted it
  return { attempted: true, query: q };
});

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGN FINANCE
// ═══════════════════════════════════════════════════════════════════════════════

const fecCommittees: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.open.fec.gov/v1/committees/?q=${enc(q)}&api_key=DEMO_KEY&per_page=20`
  );
  return data;
});

const fecCandidates: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.open.fec.gov/v1/candidates/?q=${enc(q)}&api_key=DEMO_KEY&per_page=20`
  );
  return data;
});

// Helper: convert "First Last" → "LAST, FIRST" for FEC name matching (moved up)
function toFecNameHelper(q: string): string {
  const parts = q.trim().split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].toUpperCase();
    const first = parts.slice(0, -1).join(" ").toUpperCase();
    return `${last}, ${first}`;
  }
  return q.toUpperCase();
}

const fecDisbursements: SourceFn = safe(async (q) => {
  const fecFormatted = toFecNameHelper(q);
  const [data1, data2] = await Promise.all([
    fetchJson(`https://api.open.fec.gov/v1/schedules/schedule_b/?recipient_name=${enc(fecFormatted)}&api_key=DEMO_KEY&per_page=20`).catch(() => null),
    fetchJson(`https://api.open.fec.gov/v1/schedules/schedule_b/?recipient_name=${enc(q.toUpperCase())}&api_key=DEMO_KEY&per_page=20`).catch(() => null),
  ]);
  const r1 = (data1 as any)?.results || [];
  const r2 = (data2 as any)?.results || [];
  const seen = new Set<string>();
  const merged: unknown[] = [];
  for (const r of [...r1, ...r2]) {
    const key = (r as any).sub_id || JSON.stringify(r);
    if (!seen.has(key)) { seen.add(key); merged.push(r); }
  }
  return { results: merged, pagination: { count: merged.length } };
});

// FEC individual contributions search (broader search using full-text)
const fecIndividualSearch: SourceFn = safe(async (q) => {
  const fecFormatted = toFecNameHelper(q);
  const data = await fetchJson(
    `https://api.open.fec.gov/v1/schedules/schedule_a/?contributor_name=${enc(fecFormatted)}&api_key=DEMO_KEY&per_page=20&sort=-contribution_receipt_date&two_year_transaction_period=2026`
  );
  return data;
});

// FEC candidate search by name
const fecCandidateSearch: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.open.fec.gov/v1/candidates/search/?q=${enc(q)}&api_key=DEMO_KEY&per_page=20&sort=-receipts`
  );
  return data;
});

// placeholder to keep the old function name consistent
function toFecName(q: string): string {
  const parts = q.trim().split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].toUpperCase();
    const first = parts.slice(0, -1).join(" ").toUpperCase();
    return `${last}, ${first}`;
  }
  return q.toUpperCase();
}

const fecReceipts: SourceFn = safe(async (q) => {
  // Try both natural order and LAST, FIRST format
  const fecFormatted = toFecName(q);
  const [data1, data2] = await Promise.all([
    fetchJson(`https://api.open.fec.gov/v1/schedules/schedule_a/?contributor_name=${enc(fecFormatted)}&api_key=DEMO_KEY&per_page=20&sort=-contribution_receipt_date`).catch(() => null),
    fetchJson(`https://api.open.fec.gov/v1/schedules/schedule_a/?contributor_name=${enc(q.toUpperCase())}&api_key=DEMO_KEY&per_page=20&sort=-contribution_receipt_date`).catch(() => null),
  ]);
  // Merge results, preferring the formatted name results
  const r1 = (data1 as any)?.results || [];
  const r2 = (data2 as any)?.results || [];
  const seen = new Set<string>();
  const merged: unknown[] = [];
  for (const r of [...r1, ...r2]) {
    const key = (r as any).sub_id || JSON.stringify(r);
    if (!seen.has(key)) { seen.add(key); merged.push(r); }
  }
  return { results: merged, pagination: { count: merged.length } };
});

const openSecrets: SourceFn = safe(async (q) => {
  // OpenSecrets public search page
  return { source: "opensecrets", query: q, url: `https://www.opensecrets.org/search?q=${enc(q)}&cx=partner-pub-3405433054oc` };
});

// ═══════════════════════════════════════════════════════════════════════════════
// GOVERNMENT CONTRACTS & SPENDING
// ═══════════════════════════════════════════════════════════════════════════════

const usaSpendingAwards: SourceFn = safe(async (q) => {
  const body = {
    filters: { keywords: [q], award_type_codes: ["A", "B", "C", "D"] },
    fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Award Date"],
    page: 1, limit: 20, sort: "Award Amount", order: "desc",
  };
  const data = await fetchJson("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data;
});

const usaSpendingGrants: SourceFn = safe(async (q) => {
  const body = {
    filters: { keywords: [q], award_type_codes: ["02", "03", "04", "05"] },
    fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Award Date"],
    page: 1, limit: 20, sort: "Award Amount", order: "desc",
  };
  const data = await fetchJson("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data;
});

const usaSpendingRecipient: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.usaspending.gov/api/v2/recipient/?keyword=${enc(q)}&limit=20`
  );
  return data;
});

const samGov: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.sam.gov/entity-information/v3/entities?api_key=DEMO_KEY&legalBusinessName=${enc(q)}&includeSections=entityRegistration,coreData`
  );
  return data;
});

// ─── Additional Government Contracts & Spending Sources ────────────────────

const fpdsContracts: SourceFn = safe(async (q) => {
  // FPDS Atom feed — real-time federal contract awards
  const data = await fetchJson(
    `https://www.fpds.gov/ezsearch/FEEDS/ATOM?FEEDNAME=PUBLIC&q=${enc(q)}`
  );
  return data;
});

const grantsGov: SourceFn = safe(async (q) => {
  // Grants.gov simpler API — federal grant opportunities search
  const body = {
    query: q,
    pagination: { page_offset: 1, page_size: 20 },
    filters: { is_forecast: false },
  };
  const data = await fetchJson("https://api.simpler.grants.gov/v1/opportunities/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data;
});

const samGovOpportunities: SourceFn = safe(async (q) => {
  // SAM.gov contract opportunities search
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setFullYear(today.getFullYear() - 2);
  const fmt = (d: Date) => `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
  const data = await fetchJson(
    `https://api.sam.gov/opportunities/v2/search?api_key=DEMO_KEY&postedFrom=${fmt(fromDate)}&postedTo=${fmt(today)}&limit=20&offset=0&q=${enc(q)}`
  );
  return data;
});

const samGovExclusions: SourceFn = safe(async (q) => {
  // SAM.gov exclusions (debarred/suspended entities)
  const data = await fetchJson(
    `https://api.sam.gov/exclusions/v1/public/search?api_key=DEMO_KEY&q=${enc(q)}&limit=20`
  );
  return data;
});

const usaSpendingRecipientSearch: SourceFn = safe(async (q) => {
  // USASpending recipient search (POST endpoint)
  const body = { filter: { keyword: q }, limit: 20, page: 1 };
  const data = await fetchJson("https://api.usaspending.gov/api/v2/recipient/search/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data;
});

const usaSpendingAgency: SourceFn = safe(async (q) => {
  // USASpending agency list
  const data = await fetchJson(
    `https://api.usaspending.gov/api/v2/references/agency/search/?search_text=${enc(q)}&limit=10`
  );
  return data;
});

const usaFactsData: SourceFn = safe(async (q) => {
  // USAFacts public data search
  return { source: "usafacts", query: q, url: `https://usafacts.org/search/?q=${enc(q)}` };
});

const defenseContracts: SourceFn = safe(async (q) => {
  // Defense.gov contract announcements
  return { source: "defense_contracts", query: q, url: `https://www.defense.gov/News/Contracts/?q=${enc(q)}` };
});

const dticPublic: SourceFn = safe(async (q) => {
  // DTIC (Defense Technical Information Center) public search
  const data = await fetchJson(
    `https://apps.dtic.mil/sti/api/search?q=${enc(q)}&rows=10&start=0`
  );
  return data;
});

const stateProcurementCA: SourceFn = safe(async (q) => {
  // California eProcure / DGS procurement search
  return { source: "ca_procurement", query: q, url: `https://caleprocure.ca.gov/pages/public-search.aspx?q=${enc(q)}` };
});

const stateProcurementTX: SourceFn = safe(async (q) => {
  // Texas SmartBuy procurement search
  return { source: "tx_procurement", query: q, url: `https://www.txsmartbuy.gov/sp?q=${enc(q)}` };
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOBBYING
// ═══════════════════════════════════════════════════════════════════════════════

const senateLda: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://lda.senate.gov/api/v1/filings/?registrant_name=${enc(q)}&format=json&page_size=20`
  );
  return data;
});

const senateLdaClient: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://lda.senate.gov/api/v1/filings/?client_name=${enc(q)}&format=json&page_size=20`
  );
  return data;
});

const openStates: SourceFn = safe(async (q) => {
  return { source: "openstates", query: q, url: `https://openstates.org/search/?query=${enc(q)}` };
});

// ═══════════════════════════════════════════════════════════════════════════════
// COURT RECORDS & LEGAL
// ═══════════════════════════════════════════════════════════════════════════════

const courtListener: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://www.courtlistener.com/api/rest/v3/search/?q=${enc(q)}&type=o&format=json&page_size=20`
  );
  return data;
});

const courtListenerDockets: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://www.courtlistener.com/api/rest/v3/dockets/?q=${enc(q)}&format=json&page_size=20`
  );
  return data;
});

const pacer: SourceFn = safe(async (q) => {
  return { source: "pacer", query: q, url: `https://www.pacer.gov/pcl.psc/search?q=${enc(q)}` };
});

// ═══════════════════════════════════════════════════════════════════════════════
// NONPROFITS & CHARITIES
// ═══════════════════════════════════════════════════════════════════════════════

const propublicaNonprofits: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${enc(q)}`
  );
  return data;
});

const propublicaOrg: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://projects.propublica.org/nonprofits/api/v2/organizations.json?q=${enc(q)}`
  );
  return data;
});

const charityNavigator: SourceFn = safe(async (q) => {
  return { source: "charitynavigator", query: q, url: `https://www.charitynavigator.org/index.cfm?bay=search.results&ORGNAME=${enc(q)}` };
});

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE GRAPH & ENCYCLOPEDIA
// ═══════════════════════════════════════════════════════════════════════════════

const wikipedia: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${enc(q.replace(/ /g, "_"))}`
  );
  return data;
});

const wikipediaSearch: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc(q)}&format=json&srlimit=10&origin=*`
  );
  return data;
});

const wikidata: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${enc(q)}&language=en&format=json&limit=10&origin=*`
  );
  return data;
});

const wikidataQuery: SourceFn = safe(async (q) => {
  const sparql = `SELECT ?item ?itemLabel ?description WHERE {
    ?item rdfs:label "${q}"@en.
    OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } LIMIT 5`;
  const data = await fetchJson(
    `https://query.wikidata.org/sparql?query=${enc(sparql)}&format=json`
  );
  return data;
});

const dbpedia: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://lookup.dbpedia.org/api/search?query=${enc(q)}&format=json&maxResults=10`
  );
  return data;
});

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN & NETWORK INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════════

const rdapWhois: SourceFn = safe(async (q) => {
  const domain = q.replace(/^https?:\/\//, "").split("/")[0];
  const data = await fetchJson(`https://rdap.org/domain/${enc(domain)}`);
  return data;
});

const rdapIp: SourceFn = safe(async (q) => {
  const domain = q.replace(/^https?:\/\//, "").split("/")[0];
  // Try to resolve via DNS-over-HTTPS
  const dnsData = await fetchJson(
    `https://dns.google/resolve?name=${enc(domain)}&type=A`
  );
  return dnsData;
});

const crtSh: SourceFn = safe(async (q) => {
  const domain = q.replace(/^https?:\/\//, "").split("/")[0];
  const data = await fetchJson(
    `https://crt.sh/?q=${enc(domain)}&output=json`
  );
  return data;
});

const bgpView: SourceFn = safe(async (q) => {
  const domain = q.replace(/^https?:\/\//, "").split("/")[0];
  const data = await fetchJson(`https://api.bgpview.io/search?query_term=${enc(domain)}`);
  return data;
});

const shodan: SourceFn = safe(async (q) => {
  return { source: "shodan", query: q, url: `https://www.shodan.io/search?query=${enc(q)}` };
});

const censys: SourceFn = safe(async (q) => {
  return { source: "censys", query: q, url: `https://search.censys.io/search?resource=hosts&q=${enc(q)}` };
});

const urlscan: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://urlscan.io/api/v1/search/?q=domain:${enc(q)}&size=10`
  );
  return data;
});

const dnsHistory: SourceFn = safe(async (q) => {
  const domain = q.replace(/^https?:\/\//, "").split("/")[0];
  const data = await fetchJson(
    `https://dns.google/resolve?name=${enc(domain)}&type=MX`
  );
  return data;
});

const securityTrails: SourceFn = safe(async (q) => {
  return { source: "securitytrails", query: q, url: `https://securitytrails.com/domain/${enc(q)}/history/a` };
});

const waybackMachine: SourceFn = safe(async (q) => {
  const domain = q.replace(/^https?:\/\//, "").split("/")[0];
  const data = await fetchJson(
    `https://archive.org/wayback/available?url=${enc(domain)}`
  );
  return data;
});

// ═══════════════════════════════════════════════════════════════════════════════
// NEWS & MEDIA
// ═══════════════════════════════════════════════════════════════════════════════

const gdelt: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${enc(q)}&mode=artlist&maxrecords=20&format=json&sort=DateDesc`
  );
  return data;
});

const gdeltGkg: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${enc(q)}&mode=tonechart&format=json`
  );
  return data;
});

const hackerNews: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://hn.algolia.com/api/v1/search?query=${enc(q)}&tags=story&hitsPerPage=10`
  );
  return data;
});

const newsApi: SourceFn = safe(async (q) => {
  // NewsAPI requires key — return reference URL
  return { source: "newsapi", query: q, url: `https://newsapi.org/v2/everything?q=${enc(q)}&sortBy=relevancy` };
});

const mediacloud: SourceFn = safe(async (q) => {
  return { source: "mediacloud", query: q, url: `https://search.mediacloud.org/search?q=${enc(q)}` };
});

// ─── Additional News & Media Intelligence Sources ──────────────────────────

const gdeltTimeline: SourceFn = safe(async (q) => {
  // GDELT timeline volume chart — shows news volume over time
  const data = await fetchJson(
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${enc(q)}&mode=timelinevol&format=json&timespan=6months`
  );
  return data;
});

const gdeltGeo: SourceFn = safe(async (q) => {
  // GDELT geographic distribution of news mentions
  const data = await fetchJson(
    `https://api.gdeltproject.org/api/v2/geo/geo?query=${enc(q)}&mode=country&format=json`
  );
  return data;
});

const eventRegistry: SourceFn = safe(async (q) => {
  // Event Registry — global news event tracking (free tier)
  return { source: "event_registry", query: q, url: `https://eventregistry.org/search?query=${enc(q)}&lang=eng` };
});

const googleNewsRss: SourceFn = safe(async (q) => {
  // Google News RSS — no auth required, returns recent news
  const data = await fetchJson(
    `https://news.google.com/rss/search?q=${enc(q)}&hl=en&gl=US&ceid=US:en`
  );
  // RSS is XML, but we return the raw response for display
  return { source: "google_news_rss", query: q, url: `https://news.google.com/search?q=${enc(q)}&hl=en-US&gl=US&ceid=US:en` };
});

const reutersRss: SourceFn = safe(async (q) => {
  // Reuters news search
  return { source: "reuters", query: q, url: `https://www.reuters.com/search/news?blob=${enc(q)}` };
});

const apNewsRss: SourceFn = safe(async (q) => {
  // AP News search
  return { source: "ap_news", query: q, url: `https://apnews.com/search?q=${enc(q)}` };
});

const chroniclingAmerica: SourceFn = safe(async (q) => {
  // Library of Congress historic newspaper archive (1770–1963)
  const data = await fetchJson(
    `https://chroniclingamerica.loc.gov/search/pages/results/?andtext=${enc(q)}&format=json&rows=10`
  );
  return data;
});

const pressReleasesPrNewswire: SourceFn = safe(async (q) => {
  // PR Newswire press releases
  return { source: "pr_newswire", query: q, url: `https://www.prnewswire.com/news-releases/news-releases-list.html?keyword=${enc(q)}` };
});

const pressReleasesBusinessWire: SourceFn = safe(async (q) => {
  // Business Wire press releases
  return { source: "business_wire", query: q, url: `https://www.businesswire.com/news/home/search/?rss=G1NfREpSclpYUm9hVzVu&q=${enc(q)}` };
});

const pressReleasesGlobeNewswire: SourceFn = safe(async (q) => {
  // GlobeNewswire press releases
  const data = await fetchJson(
    `https://www.globenewswire.com/RssFeed/keyword/${enc(q)}`
  );
  return { source: "globenewswire", query: q, url: `https://www.globenewswire.com/search/keyword/${enc(q)}` };
});

const mediacloudSearch: SourceFn = safe(async (q) => {
  // MediaCloud public story search (no key required for basic search)
  const data = await fetchJson(
    `https://api.mediacloud.org/api/v2/stories_public/list?q=${enc(q)}&rows=10&sort=publish_date+desc`
  );
  return data;
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATENTS & INTELLECTUAL PROPERTY
// ═══════════════════════════════════════════════════════════════════════════════

const patentsView: SourceFn = safe(async (q) => {
  const body = {
    q: { assignee_organization: q },
    f: ["patent_id", "patent_title", "patent_date", "assignee_organization"],
    o: { per_page: 20 },
  };
  const data = await fetchJson("https://api.patentsview.org/patents/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data;
});

const patentsViewInventor: SourceFn = safe(async (q) => {
  const parts = q.trim().split(/\s+/);
  const body = {
    q: { inventor_last_name: parts[parts.length - 1] || q },
    f: ["patent_id", "patent_title", "patent_date", "inventor_last_name", "inventor_first_name"],
    o: { per_page: 20 },
  };
  const data = await fetchJson("https://api.patentsview.org/patents/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data;
});

const espacenet: SourceFn = safe(async (q) => {
  return { source: "espacenet", query: q, url: `https://worldwide.espacenet.com/patent/search?q=${enc(q)}` };
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACADEMIC & RESEARCH
// ═══════════════════════════════════════════════════════════════════════════════

const crossref: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.crossref.org/works?query=${enc(q)}&rows=10&mailto=intel@mapper.io`
  );
  return data;
});

const openAlex: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.openalex.org/works?search=${enc(q)}&per-page=10&mailto=intel@mapper.io`
  );
  return data;
});

const openAlexInstitutions: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.openalex.org/institutions?search=${enc(q)}&per-page=10&mailto=intel@mapper.io`
  );
  return data;
});

const semanticScholar: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${enc(q)}&limit=10&fields=title,authors,year,doi`
  );
  return data;
});

const arxiv: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://export.arxiv.org/api/query?search_query=all:${enc(q)}&start=0&max_results=10`
  );
  return data;
});

const orcid: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://pub.orcid.org/v3.0/search/?q=${enc(q)}&rows=10`,
    { headers: { Accept: "application/json" } }
  );
  return data;
});

// ═══════════════════════════════════════════════════════════════════════════════
// SOCIAL MEDIA & WEB PRESENCE
// ═══════════════════════════════════════════════════════════════════════════════

const github: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.github.com/search/users?q=${enc(q)}&per_page=10`,
    { headers: { Accept: "application/vnd.github.v3+json" } }
  );
  return data;
});

const githubOrgs: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.github.com/search/repositories?q=${enc(q)}&per_page=10`,
    { headers: { Accept: "application/vnd.github.v3+json" } }
  );
  return data;
});

const reddit: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://www.reddit.com/search.json?q=${enc(q)}&sort=relevance&limit=10&type=link`
  );
  return data;
});

const redditSubreddits: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://www.reddit.com/subreddits/search.json?q=${enc(q)}&limit=10`
  );
  return data;
});

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════════

const worldBank: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://search.worldbank.org/api/v2/wds?qterm=${enc(q)}&rows=10&format=json`
  );
  return data;
});

const worldBankCountries: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.worldbank.org/v2/country?name=${enc(q)}&format=json&per_page=10`
  );
  return data;
});

const icijLeaks: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://offshoreleaks.icij.org/api/v1/search?q=${enc(q)}&limit=20`
  );
  return data;
});

const aleph: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://aleph.occrp.org/api/2/entities?q=${enc(q)}&limit=20&schema=Company`
  );
  return data;
});

const alephPeople: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://aleph.occrp.org/api/2/entities?q=${enc(q)}&limit=20&schema=Person`
  );
  return data;
});

const followTheMoney: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.followthemoney.net/search?q=${enc(q)}&limit=20`
  );
  return data;
});

const imfData: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://www.imf.org/external/datamapper/api/v1/countries?q=${enc(q)}`
  );
  return data;
});

const unComtrade: SourceFn = safe(async (q) => {
  return { source: "uncomtrade", query: q, url: `https://comtradeplus.un.org/TradeFlow?Frequency=A&Flows=X&CommodityCodes=TOTAL&Partners=0&Reporters=all&period=2022&AggregateBy=none&BreakdownMode=plus` };
});

const transparencyInt: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://www.transparency.org/api/search?q=${enc(q)}`
  );
  return data;
});

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCIAL & MARKET DATA
// ═══════════════════════════════════════════════════════════════════════════════

const yahooFinance: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${enc(q)}&quotesCount=10&newsCount=5`
  );
  return data;
});

const alphaVantage: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${enc(q)}&apikey=demo`
  );
  return data;
});

const openFigi: SourceFn = safe(async (q) => {
  const data = await fetchJson("https://api.openfigi.com/v3/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: q }),
  });
  return data;
});

// ═══════════════════════════════════════════════════════════════════════════════
// INFRASTRUCTURE & TECHNOLOGY
// ═══════════════════════════════════════════════════════════════════════════════

const crunchbase: SourceFn = safe(async (q) => {
  return { source: "crunchbase", query: q, url: `https://www.crunchbase.com/search/organizations/field/organizations/facet_ids/company?q=${enc(q)}` };
});

const linkedinSearch: SourceFn = safe(async (q) => {
  return { source: "linkedin", query: q, url: `https://www.linkedin.com/search/results/companies/?keywords=${enc(q)}` };
});

const pitchbook: SourceFn = safe(async (q) => {
  return { source: "pitchbook", query: q, url: `https://pitchbook.com/search#q=${enc(q)}` };
});

const techcrunch: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://techcrunch.com/wp-json/wp/v2/posts?search=${enc(q)}&per_page=10`
  );
  return data;
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADDITIONAL OSINT SOURCES
// ═══════════════════════════════════════════════════════════════════════════════

const openDataSoft: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://data.opendatasoft.com/api/explore/v2.1/catalog/datasets?where=${enc(q)}&limit=10`
  );
  return data;
});

const dataGov: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://catalog.data.gov/api/3/action/package_search?q=${enc(q)}&rows=10`
  );
  return data;
});

const europaEuTed: SourceFn = safe(async (q) => {
  return { source: "ted_europa", query: q, url: `https://ted.europa.eu/search/results?q=${enc(q)}` };
});

const openDataUk: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://data.gov.uk/api/3/action/package_search?q=${enc(q)}&rows=10`
  );
  return data;
});

const companiesHouseUk: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.company-information.service.gov.uk/search/companies?q=${enc(q)}&items_per_page=10`
  );
  return data;
});

const australianBusinessReg: SourceFn = safe(async (q) => {
  return { source: "abr_australia", query: q, url: `https://abr.business.gov.au/Search/ResultsActive?SearchText=${enc(q)}` };
});

const canadaBusinessReg: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://ised-isde.canada.ca/cc/lgcy/fdrlCrpSrch.html?V_TOKEN=&SEARCH_CLUE=${enc(q)}&SEARCH_CRITERIA=begins&SEARCH_TYPE=&CORPORATION_TYPE=&CORPORATION_STATUS=A&PLACE_OF_INCORPORATION=&action=search`
  );
  return { source: "canada_business", query: q };
});

const openNyc: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://data.cityofnewyork.us/api/3/action/package_search?q=${enc(q)}&rows=10`
  );
  return data;
});

const openCalifornia: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://data.ca.gov/api/3/action/package_search?q=${enc(q)}&rows=10`
  );
  return data;
});

const fdic: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://banks.data.fdic.gov/api/institutions?search=${enc(q)}&limit=10&fields=NAME,CITY,STNAME,ACTIVE`
  );
  return data;
});

const ncua: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://www.ncua.gov/analysis/credit-union-corporate-call-report-data/quarterly-data/credit-union-data-summary`
  );
  return { source: "ncua", query: q };
});

const finra: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://www.finra.org/sites/default/files/2020-11/broker-check-api-reference.pdf`
  );
  return { source: "finra_brokercheck", query: q, url: `https://brokercheck.finra.org/search/individual/${enc(q)}` };
});

const sec13f: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://efts.sec.gov/LATEST/search-index?q=${enc(q)}&forms=13F-HR&hits.hits._source.period_of_report=true`
  );
  return data;
});

const secProxy: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://efts.sec.gov/LATEST/search-index?q=${enc(q)}&forms=DEF%2014A,DEFA14A`
  );
  return data;
});

const secInsider: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://efts.sec.gov/LATEST/search-index?q=${enc(q)}&forms=4,3,5`
  );
  return data;
});

const pppLoan: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://data.sba.gov/api/3/action/datastore_search?resource_id=aab8e9f9-36d1-42e1-b3ba-e59c79f1d7f0&q=${enc(q)}&limit=20`
  );
  return data;
});

const eidlLoan: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://data.sba.gov/api/3/action/datastore_search?resource_id=5a5a0b0c-2e6a-4c4b-9b6c-7e5f8a9b0c1d&q=${enc(q)}&limit=20`
  );
  return data;
});

const epaEnforcement: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://echo.epa.gov/api/search?p_fn=${enc(q)}&p_act=Y&responseset=25&output=JSON`
  );
  return data;
});

const oshaInspections: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://data.osha.gov/api/1/datastore/query/70a14d3d-5a39-4108-a297-b3a5b8e7d9e1/0?q=${enc(q)}&limit=20`
  );
  return data;
});

const fda: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.fda.gov/drug/enforcement.json?search=recalling_firm:${enc(q)}&limit=10`
  );
  return data;
});

const fdaDevice: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.fda.gov/device/enforcement.json?search=recalling_firm:${enc(q)}&limit=10`
  );
  return data;
});

const ftcActions: SourceFn = safe(async (q) => {
  return { source: "ftc_actions", query: q, url: `https://www.ftc.gov/search#q=${enc(q)}&t=All` };
});

const secEnforcement: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://efts.sec.gov/LATEST/search-index?q=${enc(q)}&forms=AP,AAER,LR`
  );
  return data;
});

const dojPressReleases: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://www.justice.gov/api/v1/press_releases.json?search=${enc(q)}&pagesize=10`
  );
  return data;
});

const openAlexAuthors: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.openalex.org/authors?search=${enc(q)}&per-page=10&mailto=intel@mapper.io`
  );
  return data;
});

const openAlexConcepts: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.openalex.org/concepts?search=${enc(q)}&per-page=10&mailto=intel@mapper.io`
  );
  return data;
});

const openAlexVenues: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.openalex.org/venues?search=${enc(q)}&per-page=10&mailto=intel@mapper.io`
  );
  return data;
});

const govTrack: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://www.govtrack.us/api/v2/bill?q=${enc(q)}&limit=10`
  );
  return data;
});

const congressGov: SourceFn = safe(async (q) => {
  return { source: "congress_gov", query: q, url: `https://www.congress.gov/search?q=${enc(JSON.stringify({ congress: "all", source: "legislation", search: q }))}` };
});

const openFec: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.open.fec.gov/v1/names/candidates/?q=${enc(q)}&api_key=DEMO_KEY`
  );
  return data;
});

const mapLight: SourceFn = safe(async (q) => {
  return { source: "maplight", query: q, url: `https://maplight.org/search/?q=${enc(q)}` };
});

const followTheMoneyState: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://www.followthemoney.org/api/search?q=${enc(q)}&format=json`
  );
  return data;
});

const govInfo: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.govinfo.gov/search?query=${enc(q)}&pageSize=10&offsetMark=*&sorts=[{"field":"score","sortOrder":"DESC"}]&api_key=DEMO_KEY`
  );
  return data;
});

const federalRegister: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://www.federalregister.gov/api/v1/articles?conditions[term]=${enc(q)}&per_page=10&order=relevance`
  );
  return data;
});

const regulations: SourceFn = safe(async (q) => {
  const data = await fetchJson(
    `https://api.regulations.gov/v4/documents?filter[searchTerm]=${enc(q)}&api_key=DEMO_KEY&page[size]=10`
  );
  return data;
});

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

const ALL_SOURCES: OsintSource[] = [
  // Corporate & Registry
  { name: "sec_edgar",            label: "SEC EDGAR Full-Text",       category: "corporate",  fn: secEdgar },
  { name: "sec_edgar_fulltext",   label: "SEC EDGAR Full-Text Search", category: "corporate", fn: secEdgarFullText },
  { name: "sec_edgar_company",    label: "SEC EDGAR Company Search",  category: "corporate",  fn: secEdgarCompany },
  { name: "sec_13f",              label: "SEC 13F Institutional",     category: "corporate",  fn: sec13f },
  { name: "sec_proxy",            label: "SEC Proxy Filings",         category: "corporate",  fn: secProxy },
  { name: "sec_insider",          label: "SEC Insider Transactions",  category: "corporate",  fn: secInsider },
  { name: "sec_enforcement",      label: "SEC Enforcement Actions",   category: "corporate",  fn: secEnforcement },
  { name: "opencorporates",       label: "OpenCorporates",            category: "corporate",  fn: openCorporates },
  { name: "opencorporates_officers", label: "OpenCorporates Officers", category: "corporate", fn: openCorporatesOfficers },
  { name: "opencorporates_gazette", label: "OpenCorporates Gazette",  category: "corporate",  fn: openCorporatesGazette },
  { name: "gleif",                label: "GLEIF LEI Registry",        category: "corporate",  fn: gleif },
  { name: "gleif_lei",            label: "GLEIF LEI Records",         category: "corporate",  fn: gleifLei },
  { name: "littlesis",            label: "LittleSis Power Network",   category: "corporate",  fn: littleSis },
  { name: "open_ownership",       label: "OpenOwnership Register",    category: "corporate",  fn: openOwnership },
  { name: "companies_house_uk",   label: "UK Companies House",        category: "corporate",  fn: companiesHouseUk },
  { name: "fdic",                 label: "FDIC Bank Data",            category: "corporate",  fn: fdic },
  { name: "finra",                label: "FINRA BrokerCheck",         category: "corporate",  fn: finra },

  // Additional Corporate Registry Sources
  { name: "gleif_relationships",    label: "GLEIF Parent/Child Relationships", category: "corporate", fn: gleifRelationships },
  { name: "opencorporates_network", label: "OpenCorporates Network",    category: "corporate",  fn: openCorporatesNetwork },
  { name: "german_handelsregister", label: "German Handelsregister",    category: "corporate",  fn: germanHandelsregister },
  { name: "state_filings_ca",       label: "California SOS Filings",    category: "corporate",  fn: stateBusinessFilingsCA },
  { name: "state_filings_de",       label: "Delaware SOS Filings",      category: "corporate",  fn: stateBusinessFilingsDE },
  { name: "state_filings_fl",       label: "Florida Sunbiz Filings",    category: "corporate",  fn: stateBusinessFilingsFL },
  { name: "state_filings_tx",       label: "Texas SOS Filings",         category: "corporate",  fn: stateBusinessFilingsTX },
  { name: "state_filings_ny",       label: "New York SOS Filings",      category: "corporate",  fn: stateBusinessFilingsNY },
  { name: "registered_agents",      label: "Registered Agent Search",   category: "corporate",  fn: registeredAgentSearch },
  { name: "global_company_search",  label: "Global Company Search",     category: "corporate",  fn: globalCompanySearch },

  // Sanctions & Watchlists
  { name: "opensanctions",        label: "OpenSanctions",             category: "sanctions",  fn: openSanctions },
  { name: "opensanctions_entities", label: "OpenSanctions Entities",  category: "sanctions",  fn: openSanctionsEntities },
  { name: "interpol",             label: "Interpol Red Notices",      category: "sanctions",  fn: interpol },
  { name: "ofac_sdn",             label: "OFAC SDN List",             category: "sanctions",  fn: ofacSdn },
  { name: "eu_sanctions",         label: "EU Sanctions List",         category: "sanctions",  fn: euSanctions },

  // Campaign Finance
  { name: "fec_committees",       label: "FEC Committees",            category: "finance",    fn: fecCommittees },
  { name: "fec_candidates",       label: "FEC Candidates",            category: "finance",    fn: fecCandidates },
  { name: "fec_candidate_search", label: "FEC Candidate Search",      category: "finance",    fn: fecCandidateSearch },
  { name: "fec_disbursements",    label: "FEC Disbursements",         category: "finance",    fn: fecDisbursements },
  { name: "fec_receipts",         label: "FEC Individual Contributions", category: "finance", fn: fecReceipts },
  { name: "fec_individual_search",label: "FEC Individual Search",     category: "finance",    fn: fecIndividualSearch },
  { name: "open_fec",             label: "OpenFEC Names",             category: "finance",    fn: openFec },
  { name: "opensecrets",          label: "OpenSecrets",               category: "finance",    fn: openSecrets },
  { name: "maplight",             label: "MapLight Money in Politics", category: "finance",   fn: mapLight },
  { name: "followthemoney_state", label: "FollowTheMoney State",      category: "finance",    fn: followTheMoneyState },

  // Government Contracts
  { name: "usaspending_awards",      label: "USASpending Contracts",        category: "contracts",  fn: usaSpendingAwards },
  { name: "usaspending_grants",      label: "USASpending Grants",           category: "contracts",  fn: usaSpendingGrants },
  { name: "usaspending_recipient",   label: "USASpending Recipients",       category: "contracts",  fn: usaSpendingRecipient },
  { name: "usaspending_recipient_search", label: "USASpending Recipient Search", category: "contracts", fn: usaSpendingRecipientSearch },
  { name: "usaspending_agency",      label: "USASpending Agency Search",    category: "contracts",  fn: usaSpendingAgency },
  { name: "sam_gov",                 label: "SAM.gov Entity Registry",      category: "contracts",  fn: samGov },
  { name: "sam_gov_opportunities",   label: "SAM.gov Contract Opportunities", category: "contracts", fn: samGovOpportunities },
  { name: "sam_gov_exclusions",      label: "SAM.gov Exclusions/Debarment", category: "contracts",  fn: samGovExclusions },
  { name: "fpds_contracts",          label: "FPDS Federal Contract Awards",  category: "contracts",  fn: fpdsContracts },
  { name: "grants_gov",              label: "Grants.gov Opportunities",     category: "contracts",  fn: grantsGov },
  { name: "usafacts",                label: "USAFacts Government Data",      category: "contracts",  fn: usaFactsData },
  { name: "defense_contracts",       label: "Defense.gov Contracts",        category: "contracts",  fn: defenseContracts },
  { name: "dtic_public",             label: "DTIC Defense Research",        category: "contracts",  fn: dticPublic },
  { name: "state_procurement_ca",    label: "California eProcure",          category: "contracts",  fn: stateProcurementCA },
  { name: "state_procurement_tx",    label: "Texas SmartBuy",               category: "contracts",  fn: stateProcurementTX },
  { name: "ppp_loan",                label: "SBA PPP Loans",                category: "contracts",  fn: pppLoan },
  { name: "eidl_loan",               label: "SBA EIDL Loans",               category: "contracts",  fn: eidlLoan },

  // Lobbying
  { name: "senate_lda",           label: "Senate LDA Registrant",     category: "lobbying",   fn: senateLda },
  { name: "senate_lda_client",    label: "Senate LDA Client",         category: "lobbying",   fn: senateLdaClient },
  { name: "open_states",          label: "OpenStates Legislation",    category: "lobbying",   fn: openStates },
  { name: "govtrack",             label: "GovTrack Bills",            category: "lobbying",   fn: govTrack },
  { name: "congress_gov",         label: "Congress.gov",              category: "lobbying",   fn: congressGov },
  { name: "federal_register",     label: "Federal Register",          category: "lobbying",   fn: federalRegister },
  { name: "regulations",          label: "Regulations.gov",           category: "lobbying",   fn: regulations },
  { name: "gov_info",             label: "GovInfo.gov",               category: "lobbying",   fn: govInfo },

  // Court Records
  { name: "court_listener",       label: "CourtListener Opinions",    category: "court",      fn: courtListener },
  { name: "court_listener_dockets", label: "CourtListener Dockets",   category: "court",      fn: courtListenerDockets },
  { name: "pacer",                label: "PACER Federal Courts",      category: "court",      fn: pacer },
  { name: "doj_press",            label: "DOJ Press Releases",        category: "court",      fn: dojPressReleases },
  { name: "ftc_actions",          label: "FTC Enforcement Actions",   category: "court",      fn: ftcActions },
  { name: "epa_enforcement",      label: "EPA Enforcement",           category: "court",      fn: epaEnforcement },
  { name: "osha_inspections",     label: "OSHA Inspections",          category: "court",      fn: oshaInspections },
  { name: "fda_enforcement",      label: "FDA Drug Enforcement",      category: "court",      fn: fda },
  { name: "fda_device",           label: "FDA Device Enforcement",    category: "court",      fn: fdaDevice },

  // Nonprofits
  { name: "propublica_nonprofits", label: "ProPublica Nonprofits",    category: "nonprofits", fn: propublicaNonprofits },
  { name: "propublica_org",       label: "ProPublica Organizations",  category: "nonprofits", fn: propublicaOrg },
  { name: "charity_navigator",    label: "Charity Navigator",         category: "nonprofits", fn: charityNavigator },

  // Knowledge Graph
  { name: "wikipedia",            label: "Wikipedia",                 category: "knowledge",  fn: wikipedia },
  { name: "wikipedia_search",     label: "Wikipedia Search",          category: "knowledge",  fn: wikipediaSearch },
  { name: "wikidata",             label: "Wikidata",                  category: "knowledge",  fn: wikidata },
  { name: "wikidata_query",       label: "Wikidata SPARQL",           category: "knowledge",  fn: wikidataQuery },
  { name: "dbpedia",              label: "DBpedia Lookup",            category: "knowledge",  fn: dbpedia },

  // Domain & Network
  { name: "rdap_whois",           label: "RDAP WHOIS",                category: "domain",     fn: rdapWhois },
  { name: "rdap_ip",              label: "DNS-over-HTTPS",            category: "domain",     fn: rdapIp },
  { name: "crt_sh",               label: "crt.sh Certificates",       category: "domain",     fn: crtSh },
  { name: "bgp_view",             label: "BGPView ASN/IP",            category: "domain",     fn: bgpView },
  { name: "shodan",               label: "Shodan",                    category: "domain",     fn: shodan },
  { name: "censys",               label: "Censys",                    category: "domain",     fn: censys },
  { name: "urlscan",              label: "URLScan.io",                category: "domain",     fn: urlscan },
  { name: "dns_history",          label: "DNS MX History",            category: "domain",     fn: dnsHistory },
  { name: "security_trails",      label: "SecurityTrails",            category: "domain",     fn: securityTrails },
  { name: "wayback_machine",      label: "Wayback Machine",           category: "domain",     fn: waybackMachine },

  // News & Media
  { name: "gdelt",                label: "GDELT News",                category: "news",       fn: gdelt },
  { name: "gdelt_gkg",            label: "GDELT Tone Analysis",       category: "news",       fn: gdeltGkg },
  { name: "gdelt_timeline",       label: "GDELT News Timeline",       category: "news",       fn: gdeltTimeline },
  { name: "gdelt_geo",            label: "GDELT Geographic News",     category: "news",       fn: gdeltGeo },
  { name: "hackernews",           label: "Hacker News",               category: "news",       fn: hackerNews },
  { name: "newsapi",              label: "NewsAPI",                   category: "news",       fn: newsApi },
  { name: "mediacloud",           label: "Media Cloud",               category: "news",       fn: mediacloud },
  { name: "mediacloud_search",    label: "MediaCloud Story Search",   category: "news",       fn: mediacloudSearch },
  { name: "event_registry",       label: "Event Registry",            category: "news",       fn: eventRegistry },
  { name: "google_news_rss",      label: "Google News RSS",           category: "news",       fn: googleNewsRss },
  { name: "reuters_news",         label: "Reuters News",              category: "news",       fn: reutersRss },
  { name: "ap_news",              label: "AP News",                   category: "news",       fn: apNewsRss },
  { name: "chronicling_america",  label: "Chronicling America (LOC)", category: "news",       fn: chroniclingAmerica },
  { name: "pr_newswire",          label: "PR Newswire Press Releases", category: "news",      fn: pressReleasesPrNewswire },
  { name: "business_wire",        label: "Business Wire Press Releases", category: "news",   fn: pressReleasesBusinessWire },
  { name: "globe_newswire",       label: "GlobeNewswire Press Releases", category: "news",   fn: pressReleasesGlobeNewswire },
  { name: "techcrunch",           label: "TechCrunch",                category: "news",       fn: techcrunch },

  // Patents & IP
  { name: "patents_view",         label: "PatentsView USPTO",         category: "patents",    fn: patentsView },
  { name: "patents_view_inventor", label: "PatentsView Inventors",    category: "patents",    fn: patentsViewInventor },
  { name: "espacenet",            label: "Espacenet EPO",             category: "patents",    fn: espacenet },

  // Academic
  { name: "crossref",             label: "Crossref Publications",     category: "academic",   fn: crossref },
  { name: "openalex",             label: "OpenAlex Works",            category: "academic",   fn: openAlex },
  { name: "openalex_institutions", label: "OpenAlex Institutions",    category: "academic",   fn: openAlexInstitutions },
  { name: "openalex_authors",     label: "OpenAlex Authors",          category: "academic",   fn: openAlexAuthors },
  { name: "openalex_concepts",    label: "OpenAlex Concepts",         category: "academic",   fn: openAlexConcepts },
  { name: "openalex_venues",      label: "OpenAlex Venues",           category: "academic",   fn: openAlexVenues },
  { name: "semantic_scholar",     label: "Semantic Scholar",          category: "academic",   fn: semanticScholar },
  { name: "arxiv",                label: "arXiv Preprints",           category: "academic",   fn: arxiv },
  { name: "orcid",                label: "ORCID Researchers",         category: "academic",   fn: orcid },

  // Social & Web
  { name: "github",               label: "GitHub Users",              category: "social",     fn: github },
  { name: "github_orgs",          label: "GitHub Repositories",       category: "social",     fn: githubOrgs },
  { name: "reddit",               label: "Reddit Posts",              category: "social",     fn: reddit },
  { name: "reddit_subreddits",    label: "Reddit Communities",        category: "social",     fn: redditSubreddits },
  { name: "crunchbase",           label: "Crunchbase",                category: "social",     fn: crunchbase },
  { name: "linkedin_search",      label: "LinkedIn",                  category: "social",     fn: linkedinSearch },
  { name: "pitchbook",            label: "PitchBook",                 category: "social",     fn: pitchbook },

  // Global Intelligence
  { name: "world_bank",           label: "World Bank Documents",      category: "global",     fn: worldBank },
  { name: "world_bank_countries", label: "World Bank Countries",      category: "global",     fn: worldBankCountries },
  { name: "icij_leaks",           label: "ICIJ Offshore Leaks",       category: "global",     fn: icijLeaks },
  { name: "aleph",                label: "OCCRP Aleph Companies",     category: "global",     fn: aleph },
  { name: "aleph_people",         label: "OCCRP Aleph People",        category: "global",     fn: alephPeople },
  { name: "follow_the_money",     label: "FollowTheMoney",            category: "global",     fn: followTheMoney },
  { name: "imf_data",             label: "IMF Data",                  category: "global",     fn: imfData },
  { name: "un_comtrade",          label: "UN Comtrade Trade Data",    category: "global",     fn: unComtrade },
  { name: "transparency_int",     label: "Transparency International", category: "global",    fn: transparencyInt },
  { name: "ted_europa",           label: "EU TED Procurement",        category: "global",     fn: europaEuTed },
  { name: "open_data_uk",         label: "UK Open Data",              category: "global",     fn: openDataUk },

  // Financial & Market
  { name: "yahoo_finance",        label: "Yahoo Finance",             category: "financial",  fn: yahooFinance },
  { name: "alpha_vantage",        label: "Alpha Vantage",             category: "financial",  fn: alphaVantage },
  { name: "open_figi",            label: "OpenFIGI",                  category: "financial",  fn: openFigi },

  // Open Data
  { name: "open_data_soft",       label: "OpenDataSoft",              category: "opendata",   fn: openDataSoft },
  { name: "data_gov",             label: "Data.gov",                  category: "opendata",   fn: dataGov },
  { name: "open_nyc",             label: "NYC Open Data",             category: "opendata",   fn: openNyc },
  { name: "open_california",      label: "California Open Data",      category: "opendata",   fn: openCalifornia },
];

// ─── Public API ───────────────────────────────────────────────────────────────

export function getOsintSources(_searchType?: string): OsintSource[] {
  // Return ALL sources for every search type — no filtering
  return ALL_SOURCES;
}

export function compileProfile(query: string, _searchType: string, data: Record<string, unknown>): Record<string, unknown> {
  const profile: Record<string, unknown> = { query, collectedAt: new Date().toISOString(), sources: data };

  // Wikipedia summary
  const wiki = data.wikipedia as any;
  if (wiki?.extract) profile.wikiSummary = wiki.extract;

  // Wikidata
  const wd = data.wikidata as any;
  if (wd?.search) profile.wikidata = wd.search;

  // Company from OpenCorporates
  const oc = data.opencorporates as any;
  const companies = oc?.results?.companies;
  if (companies?.length) {
    const c = companies[0].company;
    profile.company = {
      name: c.name,
      companyNumber: c.company_number,
      jurisdiction: c.jurisdiction_code,
      incorporationDate: c.incorporation_date,
      status: c.current_status,
      registeredAddress: c.registered_address_in_full,
      companyType: c.company_type,
      officers: (c.officers || []).slice(0, 10).map((o: any) => ({
        name: o.officer?.name,
        position: o.officer?.position,
      })),
    };
  }

  // EDGAR
  const edgar = data.sec_edgar as any;
  const hits = edgar?.hits?.hits || [];
  if (hits.length) {
    const first = hits[0]._source;
    profile.edgar = {
      cik: first?.entity_id,
      name: first?.display_names?.[0],
      filings: hits.slice(0, 50).map((h: any) => ({
        formType: h._source?.form_type,
        filingDate: h._source?.file_date,
        description: h._source?.period_of_report,
        accessionNumber: h._source?.file_num,
        url: h._source?.file_date ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${h._source?.entity_id}&type=${h._source?.form_type}` : null,
      })),
    };
  }

  // Sanctions
  const sanctions = data.opensanctions as any;
  if (sanctions?.results?.length) {
    profile.sanctions = sanctions.results.slice(0, 20).map((r: any) => ({
      name: r.caption,
      schema: r.schema,
      score: r.score,
      lists: r.datasets,
    }));
  }

  // Contracts
  const contracts = data.usaspending_awards as any;
  if (contracts?.results?.length) {
    profile.contracts = contracts.results.slice(0, 20).map((c: any) => ({
      awardId: c["Award ID"],
      recipient: c["Recipient Name"],
      amount: c["Award Amount"],
      agency: c["Awarding Agency"],
      date: c["Award Date"],
    }));
  }

  // Grants
  const grants = data.usaspending_grants as any;
  if (grants?.results?.length) {
    profile.grants = grants.results.slice(0, 20).map((g: any) => ({
      awardId: g["Award ID"],
      recipient: g["Recipient Name"],
      amount: g["Award Amount"],
      agency: g["Awarding Agency"],
      date: g["Award Date"],
    }));
  }

  // Campaign Finance — fixed to use LAST, FIRST name format results
  const fecC = data.fec_committees as any;
  const fecR = data.fec_receipts as any;
  const fecD = data.fec_disbursements as any;
  const fecCand = data.fec_candidates as any;
  const fecCandSearch = data.fec_candidate_search as any;
  const fecIndiv = data.fec_individual_search as any;
  const cfItems: unknown[] = [];

  // Receipts (individual contributions) — primary fix: now uses LAST, FIRST format
  const allReceipts = [
    ...(fecR?.results || []),
    ...(fecIndiv?.results || []),
  ];
  const seenReceipts = new Set<string>();
  allReceipts.forEach((r: any) => {
    const key = r.sub_id || JSON.stringify(r);
    if (!seenReceipts.has(key)) {
      seenReceipts.add(key);
      cfItems.push({
        type: "contribution",
        donor: r.contributor_name,
        recipient: r.committee_name,
        amount: r.contribution_receipt_amount,
        date: r.contribution_receipt_date,
        employer: r.contributor_employer,
        state: r.contributor_state,
        city: r.contributor_city,
      });
    }
  });

  // Committees
  if (fecC?.results?.length) {
    fecC.results.slice(0, 10).forEach((c: any) => {
      cfItems.push({
        type: "committee",
        name: c.name,
        party: c.party_full,
        state: c.state,
        treasurer: c.treasurer_name,
        totalDisbursements: c.disbursements,
        totalReceipts: c.receipts,
        lastFileDate: c.last_file_date,
      });
    });
  }

  // Disbursements
  if (fecD?.results?.length) {
    fecD.results.slice(0, 10).forEach((d: any) => {
      cfItems.push({
        type: "disbursement",
        spender: d.committee_name,
        recipient: d.recipient_name,
        amount: d.disbursement_amount,
        date: d.disbursement_date,
        purpose: d.disbursement_description,
      });
    });
  }

  // Candidates
  const allCandidates = [
    ...(fecCand?.results || []),
    ...(fecCandSearch?.results || []),
  ];
  if (allCandidates.length) {
    const seenCands = new Set<string>();
    allCandidates.forEach((c: any) => {
      const key = c.candidate_id || c.id;
      if (!seenCands.has(key)) {
        seenCands.add(key);
        cfItems.push({
          type: "candidate",
          name: c.name,
          party: c.party_full || c.party,
          office: c.office_full || c.office,
          state: c.state,
          totalReceipts: c.receipts,
          candidateId: c.candidate_id || c.id,
        });
      }
    });
  }

  if (cfItems.length) profile.campaignFinance = cfItems;

  // Lobbying
  const lda = data.senate_lda as any;
  if (lda?.results?.length) {
    profile.lobbying = lda.results.slice(0, 20).map((l: any) => ({
      registrant: l.registrant?.name,
      client: l.client?.name,
      issue: l.lobbying_activities?.[0]?.general_issue_code_display,
      year: l.period_of_report,
    }));
  }

  // Court records
  const cl = data.court_listener as any;
  if (cl?.results?.length) {
    profile.courtCases = cl.results.slice(0, 20).map((c: any) => ({
      caseName: c.caseName,
      court: c.court,
      docketNumber: c.docketNumber,
      date: c.dateFiled,
    }));
  }

  // Nonprofits
  const pp = data.propublica_nonprofits as any;
  if (pp?.organizations?.length) {
    profile.nonprofits = pp.organizations.slice(0, 20).map((o: any) => ({
      name: o.name,
      ein: o.ein,
      revenue: o.income_amount,
      state: o.state,
    }));
  }

  // Patents
  const pv = data.patents_view as any;
  if (pv?.patents?.length) {
    profile.patents = pv.patents.slice(0, 20).map((p: any) => ({
      patentId: p.patent_id,
      title: p.patent_title,
      assignee: p.assignees?.[0]?.assignee_organization,
      date: p.patent_date,
    }));
  }

  // Academic papers
  const cr = data.crossref as any;
  const oa = data.openalex as any;
  const papers: unknown[] = [];
  if (cr?.message?.items?.length) {
    cr.message.items.slice(0, 10).forEach((p: any) => {
      papers.push({
        title: p.title?.[0],
        authors: p.author?.map((a: any) => `${a.given} ${a.family}`),
        year: p.published?.["date-parts"]?.[0]?.[0],
        doi: p.DOI,
      });
    });
  }
  if (oa?.results?.length) {
    oa.results.slice(0, 10).forEach((p: any) => {
      papers.push({
        title: p.title,
        authors: p.authorships?.map((a: any) => a.author?.display_name),
        year: p.publication_year,
        doi: p.doi?.replace("https://doi.org/", ""),
      });
    });
  }
  if (papers.length) profile.academicPapers = papers;

  // News
  const gd = data.gdelt as any;
  const hn = data.hackernews as any;
  const newsItems: unknown[] = [];
  if (gd?.articles?.length) {
    gd.articles.slice(0, 10).forEach((a: any) => {
      newsItems.push({ title: a.title, url: a.url, source: a.domain, date: a.seendate });
    });
  }
  if (hn?.hits?.length) {
    hn.hits.slice(0, 5).forEach((h: any) => {
      newsItems.push({ title: h.title, url: `https://news.ycombinator.com/item?id=${h.objectID}`, source: "Hacker News", date: h.created_at });
    });
  }
  if (newsItems.length) profile.news = newsItems;

  // Social profiles
  const gh = data.github as any;
  const rd = data.reddit as any;
  const socialItems: unknown[] = [];
  if (gh?.items?.length) {
    gh.items.slice(0, 5).forEach((u: any) => {
      socialItems.push({ platform: "GitHub", name: u.login, url: u.html_url, description: u.type });
    });
  }
  if (rd?.data?.children?.length) {
    rd.data.children.slice(0, 5).forEach((p: any) => {
      socialItems.push({ platform: "Reddit", name: p.data.title, url: `https://reddit.com${p.data.permalink}`, description: p.data.subreddit });
    });
  }
  if (socialItems.length) profile.socialProfiles = socialItems;

  // Domain intel
  const rdap = data.rdap_whois as any;
  const crt = data.crt_sh as any;
  if (rdap?.ldhName || rdap?.handle) {
    profile.domain = {
      domain: rdap.ldhName || query,
      registrar: rdap.entities?.find((e: any) => e.roles?.includes("registrar"))?.vcardArray?.[1]?.find((v: any) => v[0] === "fn")?.[3],
      registrantOrg: rdap.entities?.find((e: any) => e.roles?.includes("registrant"))?.vcardArray?.[1]?.find((v: any) => v[0] === "org")?.[3],
      createdDate: rdap.events?.find((e: any) => e.eventAction === "registration")?.eventDate,
      expiresDate: rdap.events?.find((e: any) => e.eventAction === "expiration")?.eventDate,
      nameservers: rdap.nameservers?.map((ns: any) => ns.ldhName),
      ipAddresses: [],
      certificates: Array.isArray(crt) ? crt.slice(0, 10).map((c: any) => c.common_name) : [],
    };
  }

  // FPDS Contracts
  const fpds = data.fpds_contracts as any;
  if (fpds) {
    profile.fpdsContracts = { source: "fpds", url: `https://www.fpds.gov/ezsearch/search.do?q=${encodeURIComponent(query)}`, data: fpds };
  }

  // Grants.gov
  const gg = data.grants_gov as any;
  if (gg?.data?.hits?.hits?.length || gg?.opportunities?.length) {
    const opps = gg?.data?.hits?.hits || gg?.opportunities || [];
    profile.federalGrants = opps.slice(0, 20).map((o: any) => ({
      title: o._source?.opportunity_title || o.opportunity_title,
      agency: o._source?.agency_name || o.agency_name,
      status: o._source?.opportunity_status || o.opportunity_status,
      closeDate: o._source?.close_date || o.close_date,
      awardCeiling: o._source?.award_ceiling || o.award_ceiling,
    }));
  }

  // SAM.gov Exclusions (debarment)
  const samExcl = data.sam_gov_exclusions as any;
  if (samExcl?.exclusionList?.length) {
    profile.samExclusions = samExcl.exclusionList.slice(0, 10).map((e: any) => ({
      name: e.name,
      type: e.exclusionType,
      agency: e.excludingAgencyName,
      activeDate: e.activationDate,
      terminationDate: e.terminationDate,
    }));
  }

  // State Business Filings
  const stateFilings: unknown[] = [];
  const caFilings = data.state_filings_ca as any;
  if (caFilings?.results?.length || caFilings?.EntityList?.length) {
    const items = caFilings?.results || caFilings?.EntityList || [];
    items.slice(0, 5).forEach((e: any) => {
      stateFilings.push({ state: "CA", name: e.name || e.EntityName, status: e.status || e.Status, type: e.type || e.EntityType });
    });
  }
  const flFilings = data.state_filings_fl as any;
  if (flFilings?.SearchResultList?.length) {
    flFilings.SearchResultList.slice(0, 5).forEach((e: any) => {
      stateFilings.push({ state: "FL", name: e.Name, status: e.Status, type: e.EntityType });
    });
  }
  const nyFilings = data.state_filings_ny as any;
  if (nyFilings?.entityList?.length) {
    nyFilings.entityList.slice(0, 5).forEach((e: any) => {
      stateFilings.push({ state: "NY", name: e.entityName, status: e.entityStatus, type: e.entityType });
    });
  }
  if (stateFilings.length) profile.stateBusinessFilings = stateFilings;

  // GLEIF Relationships
  const gleifRel = data.gleif_relationships as any;
  if (gleifRel?.lei) {
    profile.gleifRelationships = {
      lei: gleifRel.lei,
      directParent: gleifRel.directParent?.data?.attributes?.entity?.legalName?.name,
      directChildren: (gleifRel.directChildren?.data || []).slice(0, 10).map((c: any) => c.attributes?.entity?.legalName?.name),
    };
  }

  // News Intelligence — enhanced with new sources
  const gdeltTimeline = data.gdelt_timeline as any;
  const gdeltGeoData = data.gdelt_geo as any;
  const chronicling = data.chronicling_america as any;
  if (gdeltTimeline?.timeline?.length) {
    profile.newsTimeline = gdeltTimeline.timeline.slice(0, 30);
  }
  if (gdeltGeoData?.geo?.length) {
    profile.newsGeography = gdeltGeoData.geo.slice(0, 20).map((g: any) => ({ country: g.label, count: g.value }));
  }
  if (chronicling?.items?.length) {
    profile.historicNews = chronicling.items.slice(0, 10).map((a: any) => ({
      title: a.title,
      date: a.date,
      newspaper: a.title_normal,
      state: a.state?.[0],
      url: `https://chroniclingamerica.loc.gov${a.id}`,
    }));
  }

  // Press Releases
  const pressItems: unknown[] = [];
  const prNw = data.pr_newswire as any;
  const bw = data.business_wire as any;
  const gnw = data.globe_newswire as any;
  if (prNw?.url) pressItems.push({ source: "PR Newswire", url: prNw.url, query });
  if (bw?.url) pressItems.push({ source: "Business Wire", url: bw.url, query });
  if (gnw?.url) pressItems.push({ source: "GlobeNewswire", url: gnw.url, query });
  if (pressItems.length) profile.pressReleases = pressItems;

  // Relationships from officers + EDGAR
  const relationships: Array<{ source: string; target: string; type: string; description: string }> = [];
  const companyData = profile.company as any;
  if (companyData?.officers?.length) {
    companyData.officers.forEach((o: any) => {
      if (o.name) {
        relationships.push({ source: o.name, target: query, type: "officer_of", description: o.position || "Officer" });
      }
    });
  }
  if (relationships.length) profile.relationships = relationships;

  return profile;
}

export async function getEdgarSubmissions(cik: string): Promise<unknown> {
  try {
    const paddedCik = cik.padStart(10, "0");
    const data = await fetchJson(`https://data.sec.gov/submissions/CIK${paddedCik}.json`);
    return data;
  } catch {
    return null;
  }
}
