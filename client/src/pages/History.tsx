import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import {
  History as HistoryIcon, Search, User, Globe, Bell,
  ChevronRight, Clock, CheckCircle2, XCircle, Loader2,
  Building2, Network
} from "lucide-react";
import { useLocation } from "wouter";

const TYPE_ICONS: Record<string, React.ElementType> = {
  deep_research: Search,
  build_profile: User,
  investigate_domain: Globe,
  monitor: Bell,
};

const TYPE_COLORS: Record<string, string> = {
  deep_research: "text-blue-400",
  build_profile: "text-purple-400",
  investigate_domain: "text-emerald-400",
  monitor: "text-amber-400",
};

export default function History() {
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.search.history.useQuery();
  const searches = Array.isArray(data) ? data : [];

  const { data: entitiesData } = trpc.entity.getRecent.useQuery();
  const entities = Array.isArray(entitiesData) ? entitiesData : [];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <HistoryIcon className="w-6 h-6 text-primary" />
            Search History
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your recent intelligence searches and discovered entities.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Searches */}
          <div className="lg:col-span-2">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              Recent Searches
            </h2>

            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : searches.length === 0 ? (
              <div className="intel-card rounded-xl p-8 text-center text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No searches yet</p>
                <button
                  onClick={() => navigate("/")}
                  className="mt-3 text-primary text-sm hover:underline"
                >
                  Start your first search
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {searches.map((s: {
                  id: number;
                  query: string;
                  searchType: string;
                  status: string;
                  entityId: number | null;
                  createdAt: Date;
                }) => {
                  const Icon = TYPE_ICONS[s.searchType] || Search;
                  const colorClass = TYPE_COLORS[s.searchType] || "text-blue-400";
                  return (
                    <div
                      key={s.id}
                      onClick={() => navigate(`/search/${s.id}`)}
                      className="intel-card rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:border-primary/30 transition-all"
                    >
                      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                        <Icon className={`w-4 h-4 ${colorClass}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">{s.query}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span className={`capitalize ${colorClass}`}>{s.searchType.replace(/_/g, " ")}</span>
                          <span>·</span>
                          <Clock className="w-3 h-3" />
                          <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.status === "completed" && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                        {s.status === "failed" && <XCircle className="w-4 h-4 text-red-400" />}
                        {s.status === "running" && <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />}
                        {s.entityId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/entity/${s.entityId}`);
                            }}
                            className="text-xs px-2 py-1 rounded bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors"
                          >
                            Profile
                          </button>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Entities */}
          <div>
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Discovered Entities
            </h2>

            {entities.length === 0 ? (
              <div className="intel-card rounded-xl p-6 text-center text-muted-foreground text-sm">
                <Building2 className="w-6 h-6 mx-auto mb-2 opacity-30" />
                No entities yet
              </div>
            ) : (
              <div className="space-y-2">
                {entities.map((e: {
                  id: number;
                  name: string;
                  entityType: string;
                  status: string | null;
                  createdAt: Date;
                }) => (
                  <div
                    key={e.id}
                    onClick={() => navigate(`/entity/${e.id}`)}
                    className="intel-card rounded-xl p-3 flex items-center gap-2 cursor-pointer hover:border-primary/30 transition-all"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      {e.entityType === "person" ? (
                        <User className="w-3.5 h-3.5 text-primary" />
                      ) : e.entityType === "domain" ? (
                        <Globe className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Building2 className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{e.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{e.entityType}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          navigate(`/graph/${e.id}`);
                        }}
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="View graph"
                      >
                        <Network className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
