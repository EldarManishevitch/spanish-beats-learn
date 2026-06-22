import { Link, useLocation } from "react-router-dom";
import { Music, BookOpen, LogOut, Sparkles, RotateCcw, MessageCircle, Mic, Menu, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { CefrBadge } from "@/components/CefrBadge";
import { StreakBadge } from "@/components/StreakBadge";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ReactNode, useState } from "react";

const NAV_ITEMS = [
  { to: "/", icon: Sparkles, label: "Discover" },
  { to: "/vocab", icon: BookOpen, label: "Vocab" },
  { to: "/review", icon: RotateCcw, label: "Review", id: "tour-review" },
  { to: "/conversations", icon: MessageCircle, label: "Talk" },
  { to: "/roleplay", icon: Mic, label: "Roleplay" },
  { to: "/settings", icon: SettingsIcon, label: "Settings" },
];

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { signOut } = useAuth();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = (to: string) =>
    loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));

  const DesktopNavItem = ({ to, icon: Icon, label, id }: { to: string; icon: any; label: string; id?: string }) => {
    const active = isActive(to);
    const link = (
      <Link
        to={to}
        aria-label={label}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
          active ? "bg-primary/10 text-primary" : "text-secondary hover:text-foreground hover:bg-muted"
        }`}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </Link>
    );
    return id ? <span id={id}>{link}</span> : link;
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <header className="sticky top-0 z-40 bg-white border-b border-border shadow-sm">
        <div className="container flex h-16 items-center justify-between gap-2 flex-nowrap">
          <Link to="/" aria-label="Ritmo home" className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-soft">
              <Music className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground hidden sm:inline">Ritmo</span>
          </Link>

          {/* Desktop nav (lg+) */}
          <nav className="hidden lg:flex items-center gap-1 flex-nowrap">
            {NAV_ITEMS.map((item) => (
              <DesktopNavItem key={item.to} {...item} />
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0 flex-nowrap">
            <StreakBadge />
            <CefrBadge />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out" className="hidden sm:inline-flex">
              <LogOut className="h-4 w-4" />
            </Button>

            {/* Hamburger (below lg) */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 max-w-[85vw]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
                    const active = isActive(to);
                    return (
                      <Link
                        key={to}
                        to={to}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                          active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </Link>
                    );
                  })}
                  <button
                    onClick={() => {
                      setOpen(false);
                      signOut();
                    }}
                    className="mt-4 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted text-left"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="flex-1 container py-6 md:py-10">{children}</main>
    </div>
  );
};
