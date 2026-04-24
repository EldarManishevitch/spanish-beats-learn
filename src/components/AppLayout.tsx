import { Link, useLocation } from "react-router-dom";
import { Music, BookOpen, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const loc = useLocation();

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
    return (
      <Link to={to} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${active ? "bg-primary/15 text-primary neon-border-pink" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"}`}>
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 glass border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-neon animate-gradient flex items-center justify-center shadow-neon-pink">
              <Music className="h-5 w-5 text-background" />
            </div>
            <span className="text-xl font-bold neon-text">Ritmo</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavItem to="/" icon={Sparkles} label="Discover" />
            <NavItem to="/vocab" icon={BookOpen} label="Vocab" />
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-sm text-muted-foreground truncate max-w-[140px]">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container py-6 md:py-10">{children}</main>
    </div>
  );
};
