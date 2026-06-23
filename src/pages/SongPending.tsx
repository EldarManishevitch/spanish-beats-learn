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
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!youtubeId) {
      navigate("/", { replace: true });
      return;
    }
    const e = getCachedByYoutubeId(youtubeId);
    // No active generation in this tab (e.g. direct link / refresh): stay on
    // the pending screen with whatever optimistic metadata we have rather
    // than bouncing the user back to the dashboard.
    if (!e?.generation) {
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
          const msg = res?.error ?? "Unknown error";
          toast({ title: "Generation failed", description: msg, variant: "destructive" });
          // Do NOT redirect home — keep the user here so backend hiccups
          // (e.g. YOUTUBE_QUOTA_EXCEEDED) don't kick them out of the flow.
          setFailed(msg);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast({ title: "Generation failed", description: msg, variant: "destructive" });
        setFailed(msg);
      });
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [youtubeId, navigate, done]);

  const pct = Math.round(progress);

  return (
    <AppLayout>
      <Helmet>
        <title>{`Preparing ${meta?.title ?? "your song"} — Ritmo`}</title>
        <meta name="description" content="Fetching lyrics, generating English translation and phonetics, and saving your song to your library." />
        <meta name="robots" content="noindex" />
        <link rel="canonical" href={`https://spanish-beats-learn.lovable.app/song/pending/${youtubeId ?? ""}`} />
        <meta property="og:title" content={`Preparing ${meta?.title ?? "your song"} — Ritmo`} />
        <meta property="og:description" content="Generating Spanish lyrics, English translation and phonetics." />
        <meta property="og:url" content={`https://spanish-beats-learn.lovable.app/song/pending/${youtubeId ?? ""}`} />
        <meta property="og:type" content="website" />
      </Helmet>
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
