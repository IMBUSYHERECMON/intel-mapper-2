import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import {
  Bell, BellOff, Trash2, Building2, User, Globe,
  Calendar, CheckCircle2, Clock, AlertTriangle, Loader2, Plus, Eye
} from "lucide-react";
import { useLocation } from "wouter";

export default function Monitor() {
  const [, navigate] = useLocation();
  const { data, isLoading, refetch } = trpc.subscriptions.list.useQuery();
  const subs = Array.isArray(data) ? data : [];

  const deleteSub = trpc.subscriptions.delete.useMutation({
    onSuccess: () => {
      toast.success("Subscription removed");
      refetch();
    },
    onError: (err: { message: string }) => toast.error(`Failed: ${err.message}`),
  });

  const ENTITY_ICONS: Record<string, React.ElementType> = {
    company: Building2,
    person: User,
    domain: Globe,
    organization: Building2,
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" />
              Monitor & Alerts
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track entities for new SEC filings, ownership changes, and connection updates.
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add Monitor
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : subs.length === 0 ? (
          <div className="intel-card rounded-xl p-12 text-center">
            <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No active monitors</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Search for an entity and click "Monitor" to track changes over time.
            </p>
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Start a Search
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {subs.map((sub: {
              id: number;
              entityId: number;
              entityName: string;
              active: boolean;
              lastChecked: Date | null;
              createdAt: Date;
              notifyOnFilings: boolean;
              notifyOnOwnership: boolean;
              notifyOnConnections: boolean;
              notifyOnNews: boolean;
            }) => {
              const Icon = ENTITY_ICONS[(sub as any).entityType as string] || Building2;
              return (
                <div key={sub.id} className="intel-card rounded-xl p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    sub.active ? "bg-primary/15 border border-primary/30" : "bg-secondary border border-border"
                  }`}>
                    <Icon className={`w-5 h-5 ${sub.active ? "text-primary" : "text-muted-foreground"}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{sub.entityName}</div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Added {new Date(sub.createdAt).toLocaleDateString()}
                      </span>
                      {sub.lastChecked && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Checked {new Date(sub.lastChecked).toLocaleDateString()}
                        </span>
                      )}
                      <div className="flex gap-1">
                        {sub.notifyOnFilings && <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs">Filings</span>}
                        {sub.notifyOnOwnership && <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-xs">Ownership</span>}
                        {sub.notifyOnConnections && <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-xs">Connections</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                      sub.active
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : "bg-secondary text-muted-foreground border-border"
                    }`}>
                      {sub.active ? (
                        <><CheckCircle2 className="w-3 h-3" /> Active</>
                      ) : (
                        <><BellOff className="w-3 h-3" /> Paused</>
                      )}
                    </span>

                    <button
                      onClick={() => navigate(`/entity/${sub.entityId}`)}
                      className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="View profile"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => deleteSub.mutate({ id: sub.id })}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      title="Remove monitor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info box */}
        <div className="mt-6 intel-card rounded-xl p-4 border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <span className="text-amber-400 font-medium">Monitoring note:</span>{" "}
              Alerts are generated when new SEC filings are detected, ownership structures change, or new relationships are discovered in public records. Checks run periodically based on entity activity.
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
