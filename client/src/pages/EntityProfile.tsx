import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import {
  Building2, User, Globe, FileText, DollarSign, Network,
  Shield, Download, Bell, ChevronRight, ExternalLink,
  Calendar, MapPin, Hash, TrendingUp, AlertTriangle,
  Loader2, Brain, Clock, BookOpen, Microscope, Newspaper,
  Github, MessageSquare, Scale, Heart, Lightbulb, Flag,
  BarChart3, Search, Gavel, Radio
} from "lucide-react";
import { Streamdown } from "streamdown";

type Tab =
  | "overview" | "filings" | "relationships" | "domains" | "finance"
  | "sanctions" | "contracts" | "lobbying" | "court" | "nonprofits"
  | "patents" | "academic" | "news" | "social" | "global" | "knowledge"
  | "analysis";

interface TabDef { id: Tab; label: string; icon: React.ElementType; dataKey?: string }

const TABS: TabDef[] = [
  { id: "overview",      label: "Overview",          icon: Building2 },
  { id: "filings",       label: "SEC Filings",        icon: FileText,     dataKey: "filings" },
  { id: "relationships", label: "Relationships",      icon: Network,      dataKey: "relationships" },
  { id: "sanctions",     label: "Sanctions",          icon: Shield },
  { id: "contracts",     label: "Gov Contracts",      icon: TrendingUp },
  { id: "finance",       label: "Campaign Finance",   icon: DollarSign,   dataKey: "campaignFinance" },
  { id: "lobbying",      label: "Lobbying",           icon: Radio },
  { id: "court",         label: "Court Records",      icon: Gavel },
  { id: "nonprofits",    label: "Nonprofits",         icon: Heart },
  { id: "patents",       label: "Patents",            icon: Lightbulb },
  { id: "academic",      label: "Academic",           icon: Microscope },
  { id: "news",          label: "News & Media",       icon: Newspaper },
  { id: "social",        label: "Social & Web",       icon: Github },
  { id: "global",        label: "Global Intel",       icon: Flag },
  { id: "knowledge",     label: "Knowledge Graph",    icon: BookOpen },
  { id: "domains",       label: "Domain Intel",       icon: Globe,        dataKey: "domainIntel" },
  { id: "analysis",      label: "AI Analysis",        icon: Brain },
];

function EmptyState({ icon: Icon, label, hint }: { icon: React.ElementType; label: string; hint?: string }) {
  return (
    <div className="text-center py-10 text-muted-foreground">
      <Icon className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm">{label}</p>
      {hint && <p className="text-xs mt-1 opacity-70">{hint}</p>}
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number | null | undefined)[][] }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border">
            {headers.map((h) => <th key={h} className="text-left pb-2 pr-4">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/40 hover:bg-accent/20 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 text-foreground text-xs">{cell ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EntityProfile() {
  const params = useParams<{ id: string }>();
  const entityId = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [analysisType, setAnalysisType] = useState<"summary" | "connections" | "risks" | "timeline">("summary");

  const { data, isLoading } = trpc.entity.getProfile.useQuery({ id: entityId }, { enabled: !!entityId });
  const entity = data?.entity;

  const analyzeEntity = trpc.intel.analyze.useMutation({
    onSuccess: () => { toast.success("Analysis complete"); setActiveTab("analysis"); },
    onError: (err) => toast.error(`Analysis failed: ${err.message}`),
  });

  const createSub = trpc.subscriptions.create.useMutation({
    onSuccess: () => toast.success("Monitoring subscription created"),
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  // Two separate queries (one per format) to avoid setState race condition on export
  const exportJsonQuery = trpc.entity.exportProfile.useQuery(
    { id: entityId, format: "json" },
    { enabled: false }
  );
  const exportCsvQuery = trpc.entity.exportProfile.useQuery(
    { id: entityId, format: "csv" },
    { enabled: false }
  );

  const handleExport = async (format: "json" | "csv") => {
    try {
      const query = format === "json" ? exportJsonQuery : exportCsvQuery;
      const result = await query.refetch();
      if (result.data) {
        const blob = new Blob([result.data.data], {
          type: format === "json" ? "application/json" : "text/csv",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.data.filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported as ${format.toUpperCase()}`);
      }
    } catch {
      toast.error("Export failed");
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!entity) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <AlertTriangle className="w-8 h-8 mb-2" />
          <p>Entity not found</p>
        </div>
      </AppLayout>
    );
  }

  const profileData = entity.profileData as any;

  // Count badges for tabs
  const badgeCounts: Partial<Record<Tab, number>> = {
    filings: data?.filings?.length || 0,
    relationships: data?.relationships?.length || 0,
    finance: data?.campaignFinance?.length || 0,
    sanctions: profileData?.sanctions?.length || 0,
    contracts: (profileData?.contracts?.length || 0) + (profileData?.grants?.length || 0),
    lobbying: profileData?.lobbying?.length || 0,
    court: profileData?.courtCases?.length || 0,
    nonprofits: profileData?.nonprofits?.length || 0,
    patents: profileData?.patents?.length || 0,
    academic: profileData?.academicPapers?.length || 0,
    news: profileData?.news?.length || 0,
    social: profileData?.socialProfiles?.length || 0,
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground font-medium">{entity.name}</span>
        </div>

        {/* Entity Header */}
        <div className="intel-card rounded-xl p-6 mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                {entity.entityType === "person" ? <User className="w-7 h-7 text-primary" /> :
                 entity.entityType === "domain" ? <Globe className="w-7 h-7 text-primary" /> :
                 <Building2 className="w-7 h-7 text-primary" />}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{entity.name}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 capitalize">
                    {entity.entityType}
                  </span>
                  {entity.status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${
                      entity.status.toLowerCase().includes("active")
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : "bg-secondary text-muted-foreground border-border"
                    }`}>{entity.status}</span>
                  )}
                  {entity.ticker && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 mono">
                      ${entity.ticker}
                    </span>
                  )}
                  {(badgeCounts.sanctions ?? 0) > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Sanctions Match
                    </span>
                  )}
                </div>
                {entity.description && (
                  <p className="text-sm text-muted-foreground mt-2 max-w-2xl line-clamp-2">{entity.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => navigate(`/graph/${entityId}`)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-colors text-sm">
                <Network className="w-4 h-4" /> Graph
              </button>
              <button onClick={() => createSub.mutate({ entityId, entityName: entity.name })}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors text-sm">
                <Bell className="w-4 h-4" /> Monitor
              </button>
              <button onClick={() => handleExport("json")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-sm">
                <Download className="w-4 h-4" /> JSON
              </button>
              <button onClick={() => handleExport("csv")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-sm">
                <Download className="w-4 h-4" /> CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
            {[
              { label: "CIK", value: entity.cik || "—", icon: Hash },
              { label: "Jurisdiction", value: entity.jurisdiction || "—", icon: MapPin },
              { label: "Incorporated", value: entity.incorporationDate || "—", icon: Calendar },
              { label: "Relationships", value: String(data?.relationships?.length || 0), icon: Network },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <stat.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                  <div className="text-sm font-medium text-foreground mono">{stat.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs — scrollable */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1 scrollbar-thin">
          {TABS.map((tab) => {
            const count = badgeCounts[tab.id as keyof typeof badgeCounts] ?? 0;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  activeTab === tab.id
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent"
                }`}>
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {count > 0 && (
                  <span className={`ml-0.5 text-xs px-1.5 py-0.5 rounded-full ${
                    tab.id === "sanctions" ? "bg-red-500/20 text-red-400" : "bg-primary/20 text-primary"
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="intel-card rounded-xl p-6">

          {/* ── Overview ─────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {entity.llmSummary && (
                <div>
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" /> AI Intelligence Summary
                  </h3>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <Streamdown>{entity.llmSummary}</Streamdown>
                  </div>
                </div>
              )}

              {profileData?.company && (
                <div>
                  <h3 className="font-semibold text-foreground mb-3">Company Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(Object.entries(profileData.company) as [string, unknown][])
                      .filter(([k]) => k !== "officers")
                      .map(([key, val]) => (
                        <div key={key} className="flex gap-2">
                          <span className="text-xs text-muted-foreground capitalize min-w-[110px]">{key.replace(/([A-Z])/g, " $1")}:</span>
                          <span className="text-xs text-foreground">{String(val || "—")}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {profileData?.company?.officers?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" /> Officers & Directors
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {profileData.company.officers.map((o: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium text-foreground">{o.name}</div>
                          {o.position && <div className="text-xs text-muted-foreground">{o.position}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-border">
                {[
                  { label: "SEC Filings", value: data?.filings?.length || 0, color: "text-blue-400" },
                  { label: "Sanctions Hits", value: profileData?.sanctions?.length || 0, color: "text-red-400" },
                  { label: "Gov Contracts", value: profileData?.contracts?.length || 0, color: "text-green-400" },
                  { label: "Court Cases", value: profileData?.courtCases?.length || 0, color: "text-yellow-400" },
                ].map((s) => (
                  <div key={s.label} className="bg-secondary/40 rounded-lg p-3 text-center">
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SEC Filings ───────────────────────────────────────────── */}
          {activeTab === "filings" && (
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> SEC Filing History
                {entity.cik && (
                  <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${entity.cik}&type=&dateb=&owner=include&count=40`}
                    target="_blank" rel="noopener noreferrer"
                    className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
                    View on EDGAR <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </h3>
              {data?.filings?.length ? (
                <div className="space-y-1.5">
                  {data.filings.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 border border-transparent hover:border-border transition-all">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/20 text-primary mono w-16 text-center">{f.formType}</span>
                      <div className="flex-1">
                        <div className="text-sm text-foreground">{f.description || f.formType}</div>
                        {f.accessionNumber && <div className="text-xs text-muted-foreground mono">{f.accessionNumber}</div>}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{f.filingDate}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={FileText} label="No SEC filings found" hint={entity.cik ? "Check EDGAR directly" : "No CIK identified"} />
              )}

              {/* State Business Filings */}
              {profileData?.stateBusinessFilings?.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-purple-400" /> State Business Filings
                  </h4>
                  <DataTable
                    headers={["State", "Entity Name", "Status", "Type"]}
                    rows={profileData.stateBusinessFilings.map((f: any) => [f.state, f.name, f.status, f.type])}
                  />
                </div>
              )}

              {/* GLEIF Corporate Relationships */}
              {profileData?.gleifRelationships && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Network className="w-3.5 h-3.5 text-cyan-400" /> GLEIF Corporate Hierarchy
                  </h4>
                  <div className="space-y-2">
                    <div className="px-4 py-2 rounded-lg bg-secondary/40 border border-border/50">
                      <span className="text-xs text-muted-foreground">LEI: </span>
                      <span className="text-xs font-mono text-foreground">{profileData.gleifRelationships.lei}</span>
                    </div>
                    {profileData.gleifRelationships.directParent && (
                      <div className="px-4 py-2 rounded-lg bg-secondary/40 border border-border/50">
                        <span className="text-xs text-muted-foreground">Direct Parent: </span>
                        <span className="text-xs text-foreground">{profileData.gleifRelationships.directParent}</span>
                      </div>
                    )}
                    {profileData.gleifRelationships.directChildren?.length > 0 && (
                      <div className="px-4 py-2 rounded-lg bg-secondary/40 border border-border/50">
                        <div className="text-xs text-muted-foreground mb-1">Direct Children:</div>
                        {profileData.gleifRelationships.directChildren.map((c: string, i: number) => (
                          <div key={i} className="text-xs text-foreground">• {c}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Global Company Search Links */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" /> Global Business Registries
                </h4>
                <div className="flex flex-wrap gap-3">
                  {[
                    { name: "OpenCorporates", url: `https://opencorporates.com/companies?q=${encodeURIComponent(entity?.name || "")}` },
                    { name: "UK Companies House", url: `https://find-and-update.company-information.service.gov.uk/search?q=${encodeURIComponent(entity?.name || "")}` },
                    { name: "German Handelsregister", url: `https://www.handelsregister.de/rp_web/mask.do?Typ=e&Registergericht=&Registerart=&Registernummer=&Schlagwoerter=${encodeURIComponent(entity?.name || "")}` },
                    { name: "Delaware SOS", url: `https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx?searchname=${encodeURIComponent(entity?.name || "")}` },
                    { name: "Florida Sunbiz", url: `https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?inquiryType=EntityName&searchTerm=${encodeURIComponent(entity?.name || "")}` },
                  ].map((src) => (
                    <a key={src.name} href={src.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 px-3 py-1.5 rounded-md bg-secondary/50 border border-border/50">
                      {src.name} <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Relationships ─────────────────────────────────────────── */}
          {activeTab === "relationships" && (
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Network className="w-4 h-4 text-primary" /> Known Relationships
              </h3>
              {data?.relationships?.length ? (
                <div className="space-y-2">
                  {data.relationships.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/30 border border-border/50">
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm text-foreground">
                          <span className="text-primary">{r.sourceId === entityId ? "→" : "←"}</span>{" "}
                          <span className="font-medium capitalize">{r.relationshipType.replace(/_/g, " ")}</span>
                        </div>
                        {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                      </div>
                      {r.confidence != null && (
                        <div className="text-xs text-muted-foreground">{r.confidence}% confidence</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Network} label="No relationships mapped yet" hint="Run a search to discover connections" />
              )}
            </div>
          )}

          {/* ── Sanctions ─────────────────────────────────────────────── */}
          {activeTab === "sanctions" && (
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-400" /> Sanctions & Watchlist Matches
              </h3>
              {profileData?.sanctions?.length > 0 ? (
                <div className="space-y-2">
                  {profileData.sanctions.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <Shield className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-red-300">{s.name}</div>
                        <div className="text-xs text-red-400/70 mt-0.5">
                          {s.schema && <span className="mr-2">Schema: {s.schema}</span>}
                          {s.score != null && <span>Match Score: {s.score}</span>}
                          {s.lists && <span className="ml-2">Lists: {s.lists.join(", ")}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Shield} label="No sanctions or watchlist matches found" hint="Checked OpenSanctions, Interpol, and OFAC databases" />
              )}

              {/* Interpol notices */}
              {profileData?.sources?.interpol_notices && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400" /> Interpol Notices
                  </h4>
                  <pre className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3 overflow-auto max-h-40">
                    {JSON.stringify(profileData.sources.interpol_notices, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* ── Government Contracts ──────────────────────────────────── */}
          {activeTab === "contracts" && (
            <div className="space-y-6">
              {/* USASpending Contracts */}
              <div>
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Federal Contracts (USASpending)
                  <a href="https://usaspending.gov" target="_blank" rel="noopener noreferrer"
                    className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
                    USASpending.gov <ExternalLink className="w-3 h-3" />
                  </a>
                </h3>
                {profileData?.contracts?.length > 0 ? (
                  <DataTable
                    headers={["Award ID", "Recipient", "Amount", "Agency", "Date"]}
                    rows={profileData.contracts.map((c: any) => [
                      c.awardId, c.recipient,
                      c.amount ? `$${Number(c.amount).toLocaleString()}` : null,
                      c.agency, c.date
                    ])}
                  />
                ) : (
                  <EmptyState icon={TrendingUp} label="No federal contracts found" />
                )}
              </div>

              {/* FPDS Contracts */}
              {profileData?.fpdsContracts && (
                <div>
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" /> FPDS Federal Contract Awards
                    <a href={profileData.fpdsContracts.url} target="_blank" rel="noopener noreferrer"
                      className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
                      FPDS.gov <ExternalLink className="w-3 h-3" />
                    </a>
                  </h3>
                  <p className="text-xs text-muted-foreground">Real-time federal contract award data from the Federal Procurement Data System (FPDS-NG).</p>
                </div>
              )}

              {/* USASpending Grants */}
              <div>
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-green-400" /> Federal Grants (USASpending)
                </h3>
                {profileData?.grants?.length > 0 ? (
                  <DataTable
                    headers={["Award ID", "Recipient", "Amount", "Agency", "Date"]}
                    rows={profileData.grants.map((c: any) => [
                      c.awardId, c.recipient,
                      c.amount ? `$${Number(c.amount).toLocaleString()}` : null,
                      c.agency, c.date
                    ])}
                  />
                ) : (
                  <EmptyState icon={BarChart3} label="No federal grants found" />
                )}
              </div>

              {/* Grants.gov Opportunities */}
              {profileData?.federalGrants?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Search className="w-4 h-4 text-yellow-400" /> Grant Opportunities (Grants.gov)
                    <a href="https://grants.gov" target="_blank" rel="noopener noreferrer"
                      className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
                      Grants.gov <ExternalLink className="w-3 h-3" />
                    </a>
                  </h3>
                  <DataTable
                    headers={["Title", "Agency", "Status", "Close Date", "Award Ceiling"]}
                    rows={profileData.federalGrants.map((g: any) => [
                      g.title, g.agency, g.status, g.closeDate,
                      g.awardCeiling ? `$${Number(g.awardCeiling).toLocaleString()}` : null
                    ])}
                  />
                </div>
              )}

              {/* SAM.gov Exclusions */}
              {profileData?.samExclusions?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" /> SAM.gov Exclusions / Debarment
                  </h3>
                  <DataTable
                    headers={["Name", "Type", "Agency", "Active Date", "Termination Date"]}
                    rows={profileData.samExclusions.map((e: any) => [
                      e.name, e.type, e.agency, e.activeDate, e.terminationDate
                    ])}
                  />
                </div>
              )}

              {/* State Procurement Links */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-purple-400" /> State Procurement Databases
                </h3>
                <div className="flex flex-wrap gap-3">
                  <a href="https://caleprocure.ca.gov" target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 px-3 py-1.5 rounded-md bg-secondary/50 border border-border/50">
                    California eProcure <ExternalLink className="w-3 h-3" />
                  </a>
                  <a href="https://www.txsmartbuy.gov" target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 px-3 py-1.5 rounded-md bg-secondary/50 border border-border/50">
                    Texas SmartBuy <ExternalLink className="w-3 h-3" />
                  </a>
                  <a href="https://www.defense.gov/News/Contracts/" target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 px-3 py-1.5 rounded-md bg-secondary/50 border border-border/50">
                    Defense.gov Contracts <ExternalLink className="w-3 h-3" />
                  </a>
                  <a href="https://usafacts.org" target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 px-3 py-1.5 rounded-md bg-secondary/50 border border-border/50">
                    USAFacts <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ── Campaign Finance ──────────────────────────────────────── */}
          {activeTab === "finance" && (
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" /> Campaign Finance Records
                <a href="https://www.fec.gov" target="_blank" rel="noopener noreferrer"
                  className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
                  FEC.gov <ExternalLink className="w-3 h-3" />
                </a>
              </h3>
              {data?.campaignFinance?.length ? (
                <div className="space-y-6">
                  {/* Individual Contributions */}
                  {(() => {
                    const contribs = data.campaignFinance.filter((c: any) => c.type === "contribution" || (!c.type && (c.donor || c.donorName)));
                    if (!contribs.length) return null;
                    return (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <DollarSign className="w-3.5 h-3.5 text-green-500" /> Individual Contributions ({contribs.length})
                        </h4>
                        <DataTable
                          headers={["Contributor", "Recipient Committee", "Amount", "Date", "Employer", "State"]}
                          rows={contribs.map((c: any) => [
                            c.donor || c.donorName || "—",
                            c.recipient || c.recipientName || "—",
                            c.amount ? `$${Number(c.amount).toLocaleString()}` : "—",
                            c.date || "—",
                            c.employer || "—",
                            c.state || "—",
                          ])}
                        />
                      </div>
                    );
                  })()}

                  {/* Candidates */}
                  {(() => {
                    const cands = data.campaignFinance.filter((c: any) => c.type === "candidate");
                    if (!cands.length) return null;
                    return (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-blue-500" /> Candidates ({cands.length})
                        </h4>
                        <DataTable
                          headers={["Name", "Party", "Office", "State", "Total Receipts", "Candidate ID"]}
                          rows={cands.map((c: any) => [
                            c.name, c.party, c.office, c.state,
                            c.totalReceipts ? `$${Number(c.totalReceipts).toLocaleString()}` : "—",
                            c.candidateId,
                          ])}
                        />
                      </div>
                    );
                  })()}

                  {/* Committees */}
                  {(() => {
                    const comms = data.campaignFinance.filter((c: any) => c.type === "committee");
                    if (!comms.length) return null;
                    return (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-purple-500" /> Committees ({comms.length})
                        </h4>
                        <DataTable
                          headers={["Committee Name", "Party", "State", "Total Receipts", "Total Disbursements", "Last Filed"]}
                          rows={comms.map((c: any) => [
                            c.name, c.party, c.state,
                            c.totalReceipts ? `$${Number(c.totalReceipts).toLocaleString()}` : "—",
                            c.totalDisbursements ? `$${Number(c.totalDisbursements).toLocaleString()}` : "—",
                            c.lastFileDate,
                          ])}
                        />
                      </div>
                    );
                  })()}

                  {/* Disbursements */}
                  {(() => {
                    const disbs = data.campaignFinance.filter((c: any) => c.type === "disbursement");
                    if (!disbs.length) return null;
                    return (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <TrendingUp className="w-3.5 h-3.5 text-orange-500" /> Disbursements ({disbs.length})
                        </h4>
                        <DataTable
                          headers={["Spender", "Recipient", "Amount", "Date", "Purpose"]}
                          rows={disbs.map((c: any) => [
                            c.spender, c.recipient,
                            c.amount ? `$${Number(c.amount).toLocaleString()}` : "—",
                            c.date, c.purpose,
                          ])}
                        />
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <EmptyState icon={DollarSign} label="No campaign finance records found"
                  hint="FEC data uses LAST, FIRST name format. Try searching the exact name as it appears on FEC.gov" />
              )}

              {/* Lobbying summary */}
              {profileData?.lobbying?.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-primary" /> Related Lobbying Activity
                  </h4>
                  <DataTable
                    headers={["Registrant", "Client", "Issue", "Year"]}
                    rows={profileData.lobbying.map((l: any) => [l.registrant, l.client, l.issue, l.year])}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Lobbying ──────────────────────────────────────────────── */}
          {activeTab === "lobbying" && (
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" /> Lobbying Disclosure Records
                <a href="https://lda.senate.gov" target="_blank" rel="noopener noreferrer"
                  className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
                  Senate LDA <ExternalLink className="w-3 h-3" />
                </a>
              </h3>
              {profileData?.lobbying?.length > 0 ? (
                <DataTable
                  headers={["Registrant", "Client", "Issue Area", "Year"]}
                  rows={profileData.lobbying.map((l: any) => [l.registrant, l.client, l.issue, l.year])}
                />
              ) : (
                <EmptyState icon={Radio} label="No lobbying disclosures found" hint="Checked Senate LDA database" />
              )}
            </div>
          )}

          {/* ── Court Records ─────────────────────────────────────────── */}
          {activeTab === "court" && (
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Gavel className="w-4 h-4 text-primary" /> Court Records & Legal Proceedings
                <a href="https://www.courtlistener.com" target="_blank" rel="noopener noreferrer"
                  className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
                  CourtListener <ExternalLink className="w-3 h-3" />
                </a>
              </h3>
              {profileData?.courtCases?.length > 0 ? (
                <div className="space-y-2">
                  {profileData.courtCases.map((c: any, i: number) => (
                    <div key={i} className="px-4 py-3 rounded-lg bg-secondary/40 border border-border/50">
                      <div className="text-sm font-medium text-foreground">{c.caseName || "Unnamed Case"}</div>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {c.court && <span className="text-xs text-muted-foreground">Court: {c.court}</span>}
                        {c.docketNumber && <span className="text-xs text-muted-foreground mono">Docket: {c.docketNumber}</span>}
                        {c.date && <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />{c.date}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Gavel} label="No court records found" hint="Checked CourtListener federal court database" />
              )}
            </div>
          )}

          {/* ── Nonprofits ────────────────────────────────────────────── */}
          {activeTab === "nonprofits" && (
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Heart className="w-4 h-4 text-primary" /> Nonprofit Organizations
                <a href="https://projects.propublica.org/nonprofits/" target="_blank" rel="noopener noreferrer"
                  className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
                  ProPublica Nonprofits <ExternalLink className="w-3 h-3" />
                </a>
              </h3>
              {profileData?.nonprofits?.length > 0 ? (
                <DataTable
                  headers={["Organization", "EIN", "Revenue", "State"]}
                  rows={profileData.nonprofits.map((n: any) => [
                    n.name, n.ein,
                    n.revenue ? `$${Number(n.revenue).toLocaleString()}` : null,
                    n.state
                  ])}
                />
              ) : (
                <EmptyState icon={Heart} label="No nonprofit records found" />
              )}
            </div>
          )}

          {/* ── Patents ───────────────────────────────────────────────── */}
          {activeTab === "patents" && (
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-primary" /> Patents & Intellectual Property
              </h3>
              {profileData?.patents?.length > 0 ? (
                <div className="space-y-2">
                  {profileData.patents.map((p: any, i: number) => (
                    <div key={i} className="px-4 py-3 rounded-lg bg-secondary/40 border border-border/50">
                      <div className="text-sm font-medium text-foreground">{p.title || "Untitled Patent"}</div>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {p.patentId && <span className="text-xs text-muted-foreground mono">ID: {p.patentId}</span>}
                        {p.assignee && <span className="text-xs text-muted-foreground">Assignee: {p.assignee}</span>}
                        {p.date && <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />{p.date}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Lightbulb} label="No patents found" hint="Checked USPTO PatentsView database" />
              )}
            </div>
          )}

          {/* ── Academic ──────────────────────────────────────────────── */}
          {activeTab === "academic" && (
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Microscope className="w-4 h-4 text-primary" /> Academic Publications & Research
              </h3>
              {profileData?.academicPapers?.length > 0 ? (
                <div className="space-y-2">
                  {profileData.academicPapers.map((p: any, i: number) => (
                    <div key={i} className="px-4 py-3 rounded-lg bg-secondary/40 border border-border/50">
                      <div className="text-sm font-medium text-foreground">{p.title || "Untitled"}</div>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {p.authors?.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {p.authors.slice(0, 3).join(", ")}{p.authors.length > 3 ? " et al." : ""}
                          </span>
                        )}
                        {p.year && <span className="text-xs text-muted-foreground">{p.year}</span>}
                        {p.doi && (
                          <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1">
                            DOI <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Microscope} label="No academic publications found" hint="Checked Crossref, OpenAlex, and Semantic Scholar" />
              )}
            </div>
          )}

          {/* ── News & Media ──────────────────────────────────────────── */}
          {activeTab === "news" && (
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-primary" /> News & Media Coverage
              </h3>
              {profileData?.news?.length > 0 ? (
                <div className="space-y-2">
                  {profileData.news.map((n: any, i: number) => (
                    <div key={i} className="px-4 py-3 rounded-lg bg-secondary/40 border border-border/50 hover:border-border transition-colors">
                      <a href={n.url} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-foreground hover:text-primary transition-colors flex items-start gap-2">
                        {n.title || "Untitled Article"}
                        <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      </a>
                      <div className="flex gap-3 mt-1">
                        {n.source && <span className="text-xs text-muted-foreground">{n.source}</span>}
                        {n.date && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{n.date}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Newspaper} label="No news coverage found" hint="Checked GDELT and Hacker News" />
              )}

              {/* GDELT Geographic Distribution */}
              {profileData?.newsGeography?.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-blue-400" /> Geographic News Distribution (GDELT)
                  </h4>
                  <DataTable
                    headers={["Country", "Mention Count"]}
                    rows={profileData.newsGeography.map((g: any) => [g.country, g.count])}
                  />
                </div>
              )}

              {/* Historic Newspaper Archives */}
              {profileData?.historicNews?.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" /> Historic Newspaper Archives (Library of Congress)
                  </h4>
                  <div className="space-y-2">
                    {profileData.historicNews.map((a: any, i: number) => (
                      <div key={i} className="px-4 py-3 rounded-lg bg-secondary/40 border border-border/50">
                        <a href={a.url} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-medium text-foreground hover:text-primary flex items-start gap-2">
                          {a.title || "Untitled"} <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        </a>
                        <div className="flex gap-3 mt-1">
                          {a.newspaper && <span className="text-xs text-muted-foreground">{a.newspaper}</span>}
                          {a.state && <span className="text-xs text-muted-foreground">{a.state}</span>}
                          {a.date && <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />{a.date}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Press Releases */}
              {profileData?.pressReleases?.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-green-400" /> Press Release Databases
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {profileData.pressReleases.map((pr: any, i: number) => (
                      <a key={i} href={pr.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 px-3 py-1.5 rounded-md bg-secondary/50 border border-border/50">
                        {pr.source} <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional News Sources */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Newspaper className="w-3.5 h-3.5 text-muted-foreground" /> Additional News Sources
                </h4>
                <div className="flex flex-wrap gap-3">
                  {[
                    { name: "Reuters", url: `https://www.reuters.com/search/news?blob=${encodeURIComponent(entity?.name || "")}` },
                    { name: "AP News", url: `https://apnews.com/search?q=${encodeURIComponent(entity?.name || "")}` },
                    { name: "Google News", url: `https://news.google.com/search?q=${encodeURIComponent(entity?.name || "")}&hl=en-US&gl=US&ceid=US:en` },
                    { name: "Event Registry", url: `https://eventregistry.org/search?query=${encodeURIComponent(entity?.name || "")}&lang=eng` },
                    { name: "MediaCloud", url: `https://search.mediacloud.org/search?q=${encodeURIComponent(entity?.name || "")}` },
                  ].map((src) => (
                    <a key={src.name} href={src.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 px-3 py-1.5 rounded-md bg-secondary/50 border border-border/50">
                      {src.name} <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Hacker News */}
              {profileData?.sources?.hackernews?.hits?.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Hacker News Discussions</h4>
                  <div className="space-y-1.5">
                    {profileData.sources.hackernews.hits.slice(0, 5).map((h: any, i: number) => (
                      <a key={i} href={`https://news.ycombinator.com/item?id=${h.objectID}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors text-sm text-foreground hover:text-primary">
                        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                        {h.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Social & Web ──────────────────────────────────────────── */}
          {activeTab === "social" && (
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Github className="w-4 h-4 text-primary" /> Social Media & Web Presence
              </h3>
              {profileData?.socialProfiles?.length > 0 ? (
                <div className="space-y-2">
                  {profileData.socialProfiles.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/40 border border-border/50">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        {s.platform === "GitHub" ? <Github className="w-4 h-4 text-primary" /> :
                         s.platform === "Reddit" ? <MessageSquare className="w-4 h-4 text-orange-400" /> :
                         <Globe className="w-4 h-4 text-primary" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{s.name || s.platform}</div>
                        {s.description && <div className="text-xs text-muted-foreground line-clamp-1">{s.description}</div>}
                        <div className="text-xs text-muted-foreground">{s.platform}</div>
                      </div>
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Github} label="No social profiles found" hint="Checked GitHub, Reddit, and web archives" />
              )}
            </div>
          )}

          {/* ── Global Intel ──────────────────────────────────────────── */}
          {activeTab === "global" && (
            <div className="space-y-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Flag className="w-4 h-4 text-primary" /> Global Intelligence
              </h3>

              {/* World Bank */}
              {profileData?.sources?.worldbank && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">World Bank Data</h4>
                  <pre className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3 overflow-auto max-h-40">
                    {JSON.stringify(profileData.sources.worldbank, null, 2)}
                  </pre>
                </div>
              )}

              {/* OCCRP Aleph */}
              {profileData?.sources?.aleph && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-primary" /> OCCRP Aleph Database
                  </h4>
                  <pre className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3 overflow-auto max-h-40">
                    {JSON.stringify(profileData.sources.aleph, null, 2)}
                  </pre>
                </div>
              )}

              {/* ICIJ */}
              {profileData?.sources?.icij_leaks && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /> ICIJ Offshore Leaks
                  </h4>
                  <pre className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3 overflow-auto max-h-40">
                    {JSON.stringify(profileData.sources.icij_leaks, null, 2)}
                  </pre>
                </div>
              )}

              {!profileData?.sources?.worldbank && !profileData?.sources?.aleph && !profileData?.sources?.icij_leaks && (
                <EmptyState icon={Flag} label="No global intelligence data found" hint="Checked World Bank, OCCRP Aleph, ICIJ Offshore Leaks, IMF, and UN Comtrade" />
              )}
            </div>
          )}

          {/* ── Knowledge Graph ───────────────────────────────────────── */}
          {activeTab === "knowledge" && (
            <div className="space-y-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> Knowledge Graph & Encyclopedia
              </h3>

              {profileData?.wikiSummary && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-primary" /> Wikipedia
                  </h4>
                  <div className="prose prose-sm prose-invert max-w-none bg-secondary/30 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{profileData.wikiSummary}</p>
                  </div>
                </div>
              )}

              {profileData?.sources?.wikidata?.search?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Wikidata Entities</h4>
                  <div className="space-y-1.5">
                    {profileData.sources.wikidata.search.slice(0, 8).map((e: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/40">
                        <div className="text-xs mono text-muted-foreground w-16">{e.id}</div>
                        <div className="flex-1">
                          <div className="text-sm text-foreground">{e.label}</div>
                          {e.description && <div className="text-xs text-muted-foreground">{e.description}</div>}
                        </div>
                        <a href={`https://www.wikidata.org/wiki/${e.id}`} target="_blank" rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!profileData?.wikiSummary && !profileData?.sources?.wikidata?.search?.length && (
                <EmptyState icon={BookOpen} label="No knowledge graph data found" hint="Checked Wikipedia, Wikidata, and DBpedia" />
              )}
            </div>
          )}

          {/* ── Domain Intel ──────────────────────────────────────────── */}
          {activeTab === "domains" && (
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" /> Domain Intelligence
              </h3>
              {data?.domainIntel?.length ? (
                <div className="space-y-4">
                  {data.domainIntel.map((d) => (
                    <div key={d.id} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Domain", value: d.domain },
                          { label: "Registrar", value: d.registrar },
                          { label: "Registrant Org", value: d.registrantOrg },
                          { label: "Created", value: d.createdDate },
                          { label: "Expires", value: d.expiresDate },
                        ].filter((item) => item.value).map(({ label, value }) => (
                          <div key={label} className="flex gap-2">
                            <span className="text-xs text-muted-foreground min-w-[110px]">{label}:</span>
                            <span className="text-xs text-foreground mono">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                      {Array.isArray(d.nameservers) && d.nameservers.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Nameservers:</div>
                          <div className="flex flex-wrap gap-1">
                            {(d.nameservers as string[]).map((ns, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded bg-secondary mono">{ns}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(d.ipAddresses) && d.ipAddresses.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">IP Addresses:</div>
                          <div className="flex flex-wrap gap-1">
                            {(d.ipAddresses as string[]).map((ip, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 mono border border-blue-500/20">{ip}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Globe} label="No domain intelligence collected" hint='Use "Investigate a Domain" search type' />
              )}
            </div>
          )}

          {/* ── AI Analysis ───────────────────────────────────────────── */}
          {activeTab === "analysis" && (
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" /> AI Intelligence Analysis
              </h3>
              <div className="flex gap-2 mb-4 flex-wrap">
                {(["summary", "connections", "risks", "timeline"] as const).map((type) => (
                  <button key={type} onClick={() => setAnalysisType(type)}
                    className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                      analysisType === type
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-secondary text-muted-foreground border border-border hover:text-foreground"
                    }`}>{type}</button>
                ))}
                <button onClick={() => analyzeEntity.mutate({ entityId, analysisType })}
                  disabled={analyzeEntity.isPending}
                  className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                  {analyzeEntity.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                  {analyzeEntity.isPending ? "Analyzing..." : "Run Analysis"}
                </button>
              </div>
              {analyzeEntity.data?.analysis ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <Streamdown>{analyzeEntity.data.analysis}</Streamdown>
                </div>
              ) : entity.llmSummary ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <Streamdown>{entity.llmSummary}</Streamdown>
                </div>
              ) : (
                <EmptyState icon={Brain} label="No analysis generated yet" hint='Click "Run Analysis" to generate AI insights' />
              )}
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
