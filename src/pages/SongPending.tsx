import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getCachedByYoutubeId } from "@/lib/songCache";
import { toast } from "@/hooks/use-toast";

const SongPending = () => {
  const { youtubeId } = useParams();
  const navigate = useNavigate();
  const entry = youtubeId ? getCachedByYoutubeId(youtubeId) : undefined;
  const meta = entry?.optimistic;

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
    e.generation
      .then((res) => {
        if (cancelled) return;
        if (res?.song_id) {
          navigate(`/song/${res.song_id}`, { replace: true });
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
    };
  }, [youtubeId, navigate]);

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
      <p className="text-sm text-muted-foreground mt-6 text-center animate-pulse">
        Crafting lyrics, pronunciation, and translations…
      </p>
    </AppLayout>
  );
};

export default SongPending;
