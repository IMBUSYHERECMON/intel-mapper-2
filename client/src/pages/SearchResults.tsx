import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import {
  CheckCircle2, XCircle, Clock, Loader2, ChevronRight,
  Database, FileText, Globe, Users, DollarSign, Shield,
  Network, AlertTriangle, Eye
} from "lucide-react";

const SOURCE_ICONS: Record<string, React.ElementType> = {
  sec_edgar: FileText,
  sec_fulltext: FileText,
  opencorporates: Database,
  oc_officers: Users,
  fec_contributions: DollarSign,
  fec_committees: DollarSign,
  wikipedia: Globe,
  wikidata: Globe,
  opensanctions: Shield,
  usaspending: DollarSign,
  nonprofits: Database,
  whois: Globe,
  dns: Network,
  certificates: Shield,
  subdomains: Network,
};

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-400" />;
  if (status === "running") return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />;
  if (status === "skipped") return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

export default function SearchResults() {
  const params = useParams<{ searchId: string }>();
  const searchId = parseInt(params.searchId || "0");
  const [, navigate] = useLocation();
  const [pollingActive, setPollingActive] = useState(true);

  const { data, refetch } = trpc.search.status.useQuery(
    { searchId },
    { enabled: !!searchId, refetchInterval: pollingActive ? 2000 : false }
  );

  const search = data?.search;
  const rawProgress = data?.progress || [];
  const allSources = data?.allSources || [];

  // Deduplicate: keep latest status per source name
  const progressMap = new Map<string, typeof rawProgress[0]>();
  for (const p of rawProgress) {
    const existing = progressMap.get(p.source);
    if (!existing || p.id > existing.id) progressMap.set(p.source, p);
  }

  type ProgressItem = typeof rawProgress[0] & { label: string; category: string };

  // Merge allSources with progress so every source shows from the start
  const progress: ProgressItem[] = allSources.length > 0
    ? allSources.map((s: { name: string; label: string; category: string }) => {
        const prog = progressMap.get(s.name);
        return prog
          ? { ...prog, label: s.label, category: s.category }
          : { id: 0, source: s.name, label: s.label, category: s.category, status: "pending" as const, resultCount: 0, message: null };
      })
    : Array.from(progressMap.values()).map((p) => ({ ...p, label: p.source.replace(/_/g, " "), category: "" }));

  useEffect(() => {
    if (search?.status === "completed" || search?.status === "failed") {
      setPollingActive(false);
    }
  }, [search?.status]);

  const completedCount = progress.filter((p) => p.status === "completed" || p.status === "failed").length;
  const totalCount = progress.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleViewProfile = () => {
    if (search?.entityId) {
      navigate(`/entity/${search.entityId}`);
    }
  };

  const handleViewGraph = () => {
    if (search?.entityId) {
      navigate(`/graph/${search.entityId}`);
    }
  };

  if (!searchId) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Invalid search ID</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <span>Search</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">{search?.query || "Loading..."}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {search?.query ? `Investigating: ${search.query}` : "Loading search..."}
          </h1>
          {search?.searchType && (
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
              {search.searchType.replace(/_/g, " ")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Progress Panel */}
          <div className="lg:col-span-1">
            <div className="intel-card rounded-xl p-5 sticky top-20">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Data Sources
              </h2>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{completedCount} / {totalCount} sources</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Status badge */}
              <div className={`flex items-center gap-2 text-sm mb-4 px-3 py-2 rounded-lg ${
                search?.status === "completed" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                search?.status === "failed" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                search?.status === "running" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
                "bg-secondary text-muted-foreground border border-border"
              }`}>
                {search?.status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {search?.status === "completed" && <CheckCircle2 className="w-3.5 h-3.5" />}
                {search?.status === "failed" && <XCircle className="w-3.5 h-3.5" />}
                {search?.status === "pending" && <Clock className="w-3.5 h-3.5" />}
                <span className="capitalize font-medium">{search?.status || "Loading"}</span>
              </div>

              {/* Source list grouped by category */}
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {progress.map((p) => {
                  const Icon = SOURCE_ICONS[p.source] || Database;
                  return (
                    <div
                      key={p.source}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <StatusIcon status={p.status} />
                      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-medium truncate source-${p.status}`}>
                          {p.label}
                        </div>
                        {p.resultCount != null && p.resultCount > 0 && (
                          <div className="text-xs text-muted-foreground">{p.resultCount} records</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {progress.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    Initializing sources...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* AI Summary */}
            {search?.resultSummary && (
              <div className="intel-card rounded-xl p-5">
                <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Intelligence Summary
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {search.resultSummary}
                </p>
              </div>
            )}

            {/* Actions */}
            {search?.status === "completed" && search.entityId && (
              <div className="intel-card rounded-xl p-5">
                <h2 className="font-semibold text-foreground mb-3">Explore Results</h2>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleViewProfile}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <div className="text-left">
                      <div className="font-medium text-sm">View Full Profile</div>
                      <div className="text-xs opacity-70">Dossier, filings, connections</div>
                    </div>
                  </button>
                  <button
                    onClick={handleViewGraph}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-colors"
                  >
                    <Network className="w-4 h-4" />
                    <div className="text-left">
                      <div className="font-medium text-sm">Relationship Graph</div>
                      <div className="text-xs opacity-70">Interactive network map</div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Loading state */}
            {(search?.status === "running" || search?.status === "pending") && (
              <div className="intel-card rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <div className="relative mb-4">
                  <div className="w-16 h-16 rounded-full border-2 border-primary/20 flex items-center justify-center">
                    <Network className="w-7 h-7 text-primary" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-pulse-ring" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Collecting Intelligence</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Querying {totalCount} data sources simultaneously...
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                  {progress.filter((p) => p.status === "running").slice(0, 4).map((p) => (
                    <span key={p.source} className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                      {p.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Source breakdown */}
            {progress.length > 0 && (
              <div className="intel-card rounded-xl p-5">
                <h2 className="font-semibold text-foreground mb-3">Source Breakdown</h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Completed", count: progress.filter(p => p.status === "completed").length, color: "text-green-400" },
                    { label: "Running", count: progress.filter(p => p.status === "running").length, color: "text-yellow-400" },
                    { label: "Failed", count: progress.filter(p => p.status === "failed").length, color: "text-red-400" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-secondary/50 rounded-lg p-3 text-center">
                      <div className={`text-2xl font-bold ${stat.color}`}>{stat.count}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
