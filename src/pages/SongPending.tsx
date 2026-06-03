import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getCachedByYoutubeId } from "@/lib/songCache";
import { toast } from "@/hooks/use-toast";

const STAGES = [
  { from: 0, to: 30, label: "Searching YouTube & Genius..." },
  { from: 31, to: 75, label: "AI Generating English Translation & Phonetics..." },
  { from: 76, to: 100, label: "Saving to Database & Rendering..." },
];

const stageLabel = (p: number) =>
  STAGES.find((s) => p >= s.from && p <= s.to)?.label ?? STAGES[0].label;

const SongPending = () => {
  const { youtubeId } = useParams();
  const navigate = useNavigate();
  const entry = youtubeId ? getCachedByYoutubeId(youtubeId) : undefined;
  const meta = entry?.optimistic;
  const [progress, setProgress] = useState(4);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!youtubeId) {
      navigate("/", { replace: true });
      return;
    }
    const e = getCachedByYoutubeId(youtubeId);
    if (!e?.generation) {
      navigate("/", { replace: true });
      return;
    }
    let cancelled = false;

    // Simulated staged progress: creep through stages 1 & 2 until the
    // generation promise resolves, then jump to stage 3 and complete.
    const tick = setInterval(() => {
      setProgress((p) => {
        if (done) return p;
        // Cap creep at 72% until generation resolves.
        if (p >= 72) return p;
        // Slower as we approach the cap.
        const delta = p < 28 ? 3 : p < 60 ? 1.5 : 0.6;
        return Math.min(72, p + delta);
      });
    }, 350);

    e.generation
      .then((res) => {
        if (cancelled) return;
        if (res?.song_id) {
          setDone(true);
          setProgress(85);
          // Brief final stage flourish before navigating.
          setTimeout(() => !cancelled && setProgress(100), 250);
          setTimeout(() => !cancelled && navigate(`/song/${res.song_id}`, { replace: true }), 600);
        } else {
          toast({ title: "Generation failed", description: res?.error ?? "Unknown error", variant: "destructive" });
          navigate("/", { replace: true });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        toast({
          title: "Generation failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
        navigate("/", { replace: true });
      });
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [youtubeId, navigate, done]);

  const pct = Math.round(progress);

  return (
    <AppLayout>
      <header className="flex flex-col sm:flex-row gap-4 items-start sm:items-end mb-6 animate-fade-in">
        {meta?.thumbnail && (
          <img src={meta.thumbnail} alt={meta.title} className="h-24 w-24 rounded-xl object-cover shadow-neon-pink" />
        )}
        <div>
          <Badge className="mb-2 bg-primary/20 text-primary border-primary/30">Generating…</Badge>
          <h1 className="text-3xl md:text-4xl font-bold neon-text">{meta?.title ?? "Loading…"}</h1>
          {meta?.artist && <p className="text-lg text-muted-foreground">{meta.artist}</p>}
        </div>
      </header>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-primary drop-shadow-[0_0_8px_hsl(var(--primary))] animate-pulse">
            {stageLabel(pct)}
          </p>
          <span className="text-sm font-mono text-primary drop-shadow-[0_0_6px_hsl(var(--primary))]">{pct}%</span>
        </div>
        <div className="relative h-3 w-full rounded-full bg-primary/10 overflow-hidden ritmo-border">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-primary to-accent shadow-[0_0_18px_hsl(var(--primary)),0_0_36px_hsl(var(--primary)/0.6)] transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/20 blur-sm transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Skeleton className="aspect-video w-full rounded-2xl bg-primary/10 animate-pulse" />
        </div>
        <div className="lg:col-span-2 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl bg-primary/10 animate-pulse" />
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default SongPending;
