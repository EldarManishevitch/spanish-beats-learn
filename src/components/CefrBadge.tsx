import { useProgress, TIER_NAMES } from "@/hooks/useProgress";
import { Sparkles } from "lucide-react";

export const CefrBadge = () => {
  const { progress } = useProgress();
  if (!progress) return null;
  const tier = progress.cefr_level || "A1";
  return (
    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg glass shadow-neon-pink/30">
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs font-bold text-primary">{tier}</span>
      <span className="text-xs text-muted-foreground hidden md:inline">· {TIER_NAMES[tier] ?? ""}</span>
      <span className="text-xs text-accent font-semibold">{progress.total_xp} XP</span>
    </div>
  );
};
