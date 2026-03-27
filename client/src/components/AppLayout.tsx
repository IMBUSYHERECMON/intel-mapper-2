import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Network, Bell, History, Home, ExternalLink } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home", exact: true },
  { href: "/history", icon: History, label: "History" },
  { href: "/monitor", icon: Bell, label: "Monitor" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top nav */}
      <header className="h-14 border-b border-border flex items-center px-4 gap-4 sticky top-0 z-50 bg-background/95 backdrop-blur">
        <Link href="/" className="flex items-center gap-2 mr-4">
          <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
            <Network className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-sm tracking-tight text-gradient-cyan">IntelMapper</span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? location === item.href
              : location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            All systems operational
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>IntelMapper — Open-source intelligence platform. All data from public records.</span>
        <div className="flex items-center gap-4">
          <a href="https://data.sec.gov" target="_blank" rel="noopener noreferrer" className="hover:text-foreground flex items-center gap-1">
            SEC EDGAR <ExternalLink className="w-3 h-3" />
          </a>
          <a href="https://opencorporates.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground flex items-center gap-1">
            OpenCorporates <ExternalLink className="w-3 h-3" />
          </a>
          <a href="https://api.open.fec.gov" target="_blank" rel="noopener noreferrer" className="hover:text-foreground flex items-center gap-1">
            FEC <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}
