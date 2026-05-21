import { Link, useLocation } from "react-router-dom";
import { Music, BookOpen, LogOut, Sparkles, RotateCcw, MessageCircle, Mic } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { CefrBadge } from "@/components/CefrBadge";
import { ReactNode } from "react";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const loc = useLocation();

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
    return (
      <Link to={to} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${active ? "bg-primary/10 text-primary" : "text-secondary hover:text-foreground hover:bg-muted"}`}>
        <Icon className="h-4 w-4" />
        <span className="hidden md:inline">{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-border">
        <div className="container flex h-16 items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-soft">
              <Music className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground hidden sm:inline">Ritmo</span>
          </Link>
          <nav className="flex items-center gap-1 flex-wrap">
            <NavItem to="/" icon={Sparkles} label="Discover" />
            <NavItem to="/vocab" icon={BookOpen} label="Vocab" />
            <span id="tour-review"><NavItem to="/review" icon={RotateCcw} label="Review" /></span>
            <NavItem to="/conversations" icon={MessageCircle} label="Talk" />
            <NavItem to="/roleplay" icon={Mic} label="Roleplay" />
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <CefrBadge />
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container py-6 md:py-10">{children}</main>
    </div>
  );
};
