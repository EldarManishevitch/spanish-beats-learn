import { Flame } from "lucide-react";
import { useProgress } from "@/hooks/useProgress";

export const StreakBadge = () => {
  const { progress } = useProgress();
  const current = progress?.current_streak ?? 0;
  const best = progress?.longest_streak ?? 0;
  const active = current > 0;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
        active
          ? "border-[hsl(25_95%_55%)] bg-[hsl(25_95%_55%/0.08)] shadow-[0_0_12px_hsl(25_95%_55%/0.45)]"
          : "border-border bg-muted/40"
      }`}
      title={`Current streak: ${current} days · Best: ${best}`}
      aria-label={`Daily streak: ${current} days. Best: ${best} days.`}
    >
      <Flame
        className={`h-4 w-4 ${active ? "text-[hsl(25_95%_55%)] drop-shadow-[0_0_4px_hsl(25_95%_55%)]" : "text-muted-foreground"}`}
        fill={active ? "currentColor" : "none"}
      />
      <span className="text-sm font-bold leading-none">
        <span className={active ? "text-[hsl(25_95%_60%)]" : "text-foreground"}>{current}</span>
        <span className="hidden sm:inline text-foreground/80 font-medium"> Days</span>
      </span>
      <span className="hidden md:inline text-[11px] text-muted-foreground leading-none border-l border-border/60 pl-2">
        Best: {best}
      </span>
    </div>
  );
};
