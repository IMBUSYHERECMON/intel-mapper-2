import { useState } from "react";
import { useLocation } from "wouter";
import { Search, User, Globe, Bell, Shield, Database, Network, Activity, Zap, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";

type SearchMode = "deep_research" | "build_profile" | "investigate_domain" | "monitor";

const SEARCH_MODES = [
  {
    id: "deep_research" as SearchMode,
    icon: Search,
    title: "Deep Research",
    description: "Ask anything — we search the web and synthesize answers.",
    placeholder: "e.g. music industry, BlackRock, Elon Musk...",
    color: "oklch(0.65 0.18 210)",
    accent: "from-blue-500/10 to-cyan-500/5",
    border: "border-blue-500/20 hover:border-blue-400/40",
  },
  {
    id: "build_profile" as SearchMode,
    icon: User,
    title: "Build a Profile",
    description: "Enter a name, handle, domain, or organization.",
    placeholder: "e.g. Jeff Bezos, Amazon, Vanguard...",
    color: "oklch(0.65 0.18 280)",
    accent: "from-purple-500/10 to-violet-500/5",
    border: "border-purple-500/20 hover:border-purple-400/40",
  },
  {
    id: "investigate_domain" as SearchMode,
    icon: Globe,
    title: "Investigate a Domain",
    description: "Enter a website or domain to investigate.",
    placeholder: "e.g. amazon.com, sec.gov...",
    color: "oklch(0.65 0.18 160)",
    accent: "from-emerald-500/10 to-teal-500/5",
    border: "border-emerald-500/20 hover:border-emerald-400/40",
  },
  {
    id: "monitor" as SearchMode,
    icon: Bell,
    title: "Monitor & Alerts",
    description: "Describe what you want to track.",
    placeholder: "e.g. Tesla SEC filings, Pfizer board changes...",
    color: "oklch(0.65 0.18 50)",
    accent: "from-amber-500/10 to-orange-500/5",
    border: "border-amber-500/20 hover:border-amber-400/40",
  },
];

const STATS = [
  { label: "Data Sources", value: "70+", icon: Database },
  { label: "APIs Integrated", value: "20+", icon: Network },
  { label: "Records Indexed", value: "Millions", icon: Shield },
  { label: "Real-time Updates", value: "Live", icon: Activity },
];

const RECENT_EXAMPLES = [
  "BlackRock ownership network",
  "Pfizer board of directors",
  "Koch Industries political donations",
  "Goldman Sachs SEC filings",
  "Vanguard fund relationships",
  "Lockheed Martin federal contracts",
];

export default function Home() {
  const [activeMode, setActiveMode] = useState<SearchMode>("deep_research");
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();

  const initSearch = trpc.search.initiate.useMutation({
    onSuccess: (data) => {
      navigate(`/search/${data.searchId}`);
    },
    onError: (err) => {
      toast.error(`Search failed: ${err.message}`);
    },
  });

  const handleSearch = () => {
    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }
    initSearch.mutate({ query: query.trim(), searchType: activeMode });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const activeConfig = SEARCH_MODES.find((m) => m.id === activeMode)!;

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        {/* Hero section */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pt-16 pb-8">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3 mb-8">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center intel-glow">
                <Network className="w-6 h-6 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 border-2 border-background animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gradient-cyan">IntelMapper</h1>
              <p className="text-xs text-muted-foreground tracking-widest uppercase">Intelligence Platform</p>
            </div>
          </div>

          {/* Tagline */}
          <div className="text-center mb-12 max-w-2xl">
            <h2 className="text-4xl font-bold text-foreground mb-3 leading-tight">
              Map who really controls{" "}
              <span className="text-gradient-cyan">any industry</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              SEC filings, corporate registries, campaign finance, WHOIS data, and 70+ OSINT sources — all in one place.
            </p>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mb-10 flex-wrap justify-center">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2 text-sm">
                <stat.icon className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground">{stat.value}</span>
                <span className="text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Search Mode Cards */}
          <div className="w-full max-w-3xl">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {SEARCH_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setActiveMode(mode.id)}
                  className={`
                    relative p-4 rounded-xl text-left transition-all duration-200
                    bg-gradient-to-br ${mode.accent}
                    border ${mode.border}
                    ${activeMode === mode.id ? "ring-1 ring-primary/50 shadow-lg" : ""}
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${mode.color}20`, border: `1px solid ${mode.color}40` }}
                    >
                      <mode.icon className="w-4 h-4" style={{ color: mode.color }} />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground text-sm">{mode.title}</div>
                      <div className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{mode.description}</div>
                    </div>
                  </div>
                  {activeMode === mode.id && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <activeConfig.icon
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none"
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={activeConfig.placeholder}
                    className="w-full pl-12 pr-10 py-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-base transition-all"
                    autoFocus
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  onClick={handleSearch}
                  disabled={initSearch.isPending}
                  className="px-6 py-4 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed intel-glow"
                >
                  {initSearch.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Investigate
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick examples */}
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <span className="text-xs text-muted-foreground mr-1">Try:</span>
              {RECENT_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    setQuery(ex);
                    setActiveMode("deep_research");
                  }}
                  className="text-xs px-3 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors border border-border"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="border-t border-border px-4 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: Database,
                  title: "20+ Data Sources",
                  desc: "SEC EDGAR, OpenCorporates, FEC, WHOIS, OpenSanctions, USASpending, ProPublica, Wikipedia, and more.",
                },
                {
                  icon: Network,
                  title: "Relationship Graphs",
                  desc: "Interactive D3.js force graphs showing ownership chains, board seats, executive connections, and influence networks.",
                },
                {
                  icon: Shield,
                  title: "AI-Powered Analysis",
                  desc: "LLM-generated executive summaries, risk assessments, connection analysis, and chronological timelines.",
                },
              ].map((feat) => (
                <div key={feat.title} className="intel-card rounded-xl p-5">
                  <feat.icon className="w-6 h-6 text-primary mb-3" />
                  <h3 className="font-semibold text-foreground mb-1">{feat.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
