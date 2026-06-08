import { useEffect, useMemo, useRef, useState } from "react";
import { TranslateWord } from "./TranslateWord";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Sparkles, Music } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProgress } from "@/hooks/useProgress";
import { toast } from "sonner";

type Line = {
  id: string;
  line_index: number;
  spanish_text: string;
  pronunciation: string | null;
  english_translation: string | null;
  start_seconds: number;
  end_seconds: number;
  is_chorus: boolean;
};

type Section = {
  id: "chorus" | "verse_1" | "verse_2" | "full";
  label: string;
  lines: Line[];
};

type YouTubePlayer = {
  destroy?: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
};

declare global {
  interface Window {
    __ytApiLoading?: boolean;
    __ytApiReady?: boolean;
    __ytReadyCallbacks?: Array<() => void>;
  }
}

const loadYouTubeAPI = (): Promise<void> =>
  new Promise((resolve) => {
    if (window.__ytApiReady && window.YT?.Player) return resolve();
    window.__ytReadyCallbacks = window.__ytReadyCallbacks || [];
    window.__ytReadyCallbacks.push(resolve);
    if (window.__ytApiLoading) return;
    window.__ytApiLoading = true;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => {
      window.__ytApiReady = true;
      window.__ytReadyCallbacks?.forEach((cb) => cb());
      window.__ytReadyCallbacks = [];
    };
  });

const NeonLoader = ({ label }: { label: string }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/40 backdrop-blur-sm rounded-2xl z-10">
    <div className="relative">
      <div className="absolute inset-0 rounded-full bg-primary/40 blur-xl animate-pulse" />
      <Loader2 className="relative h-10 w-10 text-primary animate-spin drop-shadow-[0_0_12px_hsl(var(--primary))]" />
    </div>
    <p className="text-sm font-medium text-primary animate-pulse">{label}</p>
  </div>
);

/**
 * Splits a song into 3 micro-loop sections:
 *   - Chorus = lines flagged is_chorus
 *   - Verse 1 = first half of non-chorus lines (ordered by line_index)
 *   - Verse 2 = remaining non-chorus lines
 * Empty sections are dropped.
 */
const splitSections = (lines: Line[]): Section[] => {
  const sorted = [...lines].sort((a, b) => a.line_index - b.line_index);
  const chorus = sorted.filter((l) => l.is_chorus);
  const verses = sorted.filter((l) => !l.is_chorus);
  const mid = Math.ceil(verses.length / 2);
  const v1 = verses.slice(0, mid);
  const v2 = verses.slice(mid);
  const out: Section[] = [];
  if (chorus.length) out.push({ id: "chorus", label: "The Chorus", lines: chorus });
  if (v1.length) out.push({ id: "verse_1", label: "Verse 1", lines: v1 });
  if (v2.length) out.push({ id: "verse_2", label: "Verse 2", lines: v2 });
  return out;
};

export const SectionedSongPlayer = ({
  youtubeId,
  lines,
  songId,
}: {
  youtubeId: string;
  lines: Line[];
  songId: string;
}) => {
  const { user } = useAuth();
  const { addXp } = useProgress();
  const playerRef = useRef<YouTubePlayer | null>(null);
  const sectionEndTimer = useRef<number | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);
  const [hintActive, setHintActive] = useState(true);

  const sections = useMemo(() => splitSections(lines), [lines]);
  const fullSong = useMemo<Section | null>(() => {
    const sorted = [...lines].sort((a, b) => a.line_index - b.line_index);
    return sorted.length ? { id: "full", label: "Full Song", lines: sorted } : null;
  }, [lines]);
  const tabSections = useMemo(() => fullSong ? [...sections, fullSong] : sections, [sections, fullSong]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = tabSections.find((s) => s.id === activeId) ?? sections[0] ?? fullSong ?? null;

  // Per-session local memory of which sections have been "completed" so the
  // user gets the dopamine animation once per visit per section.
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [celebrating, setCelebrating] = useState<string | null>(null);

  useEffect(() => { setHintActive(true); }, [songId]);

  useEffect(() => {
    if (sections.length && !activeId) setActiveId(sections[0].id);
  }, [sections, activeId]);

  // Single YouTube player, re-built only on song change.
  useEffect(() => {
    let cancelled = false;
    setVideoReady(false);
    loadYouTubeAPI().then(() => {
      if (cancelled) return;
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = new window.YT.Player("yt-player", {
        videoId: youtubeId,
        playerVars: { controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
        events: { onReady: () => { if (!cancelled) setVideoReady(true); } },
      });
    });
    return () => {
      cancelled = true;
      if (sectionEndTimer.current) window.clearTimeout(sectionEndTimer.current);
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
    };
  }, [youtubeId]);

  const playSection = (s: Section) => {
    if (!playerRef.current || !videoReady || s.lines.length === 0) return;
    const start = s.lines[0].start_seconds;
    const end = s.lines[s.lines.length - 1].end_seconds;
    try {
      playerRef.current.seekTo(Math.max(0, start - 0.2), true);
      playerRef.current.playVideo();
      if (sectionEndTimer.current) window.clearTimeout(sectionEndTimer.current);
      const durationMs = Math.max(1000, (end - start + 0.5) * 1000);
      sectionEndTimer.current = window.setTimeout(() => {
        try { playerRef.current?.pauseVideo(); } catch { /* ignore */ }
      }, durationMs);
    } catch (e) {
      console.error("section play failed", e);
    }
  };

  const completeSection = async (s: Section) => {
    if (completed[s.id]) return;
    setCompleted((c) => ({ ...c, [s.id]: true }));
    setCelebrating(s.id);
    window.setTimeout(() => setCelebrating(null), 1600);
    if (user) {
      // ref_id ties the XP to this specific song + section so the same
      // reward can't be farmed by tapping the button repeatedly.
      await addXp("section_completed", `${songId}:${s.id}`);
    } else {
      toast.success("+10 XP");
    }
  };

  const switchTo = (id: string) => {
    if (sectionEndTimer.current) window.clearTimeout(sectionEndTimer.current);
    try { playerRef.current?.pauseVideo(); } catch { /* ignore */ }
    setActiveId(id);
  };

  if (!tabSections.length) {
    return (
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-white ritmo-border shadow-soft-lg">
            {!videoReady && <NeonLoader label="Loading video…" />}
            <div id="yt-player" className="w-full h-full" />
          </div>
        </div>
        <div className="lg:col-span-2 bg-white ritmo-border shadow-soft rounded-2xl p-5 text-sm text-muted-foreground">
          Lyrics are still loading…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Section tabs */}
      <div role="tablist" aria-label="Song sections" className="flex flex-wrap gap-2">
        {tabSections.map((s) => {
          const isActive = active?.id === s.id;
          const isDone = completed[s.id];
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => switchTo(s.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all flex items-center gap-1.5 ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-soft"
                  : "bg-card border-border hover:border-primary/40"
              }`}
            >
              {s.id === "chorus" || s.id === "full" ? <Sparkles className="h-3.5 w-3.5" /> : <Music className="h-3.5 w-3.5" />}
              {s.label}
              {isDone && (
                <span className="ml-1 h-4 w-4 rounded-full bg-accent flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-accent-foreground" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Player */}
        <div className="lg:col-span-3">
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-white ritmo-border shadow-soft-lg">
            {!videoReady && <NeonLoader label="Loading video…" />}
            <div id="yt-player" className="w-full h-full" />
          </div>
          {active && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() => playSection(active)}
                disabled={!videoReady}
                className="bg-primary hover:bg-primary/90"
              >
                ▶ Play {active.label}
              </Button>
              <Button
                onClick={() => completeSection(active)}
                disabled={completed[active.id]}
                variant="outline"
                className={completed[active.id] ? "" : "border-accent text-accent hover:bg-accent hover:text-accent-foreground"}
              >
                {completed[active.id] ? "✓ Section complete" : "Mark complete · +10 XP"}
              </Button>
              <p className="text-xs text-muted-foreground self-center ml-1">
                A 2–3 min mini-session. Listen, tap unfamiliar words, then claim your XP.
              </p>
            </div>
          )}
        </div>

        {/* Active section lyrics */}
        <div className="lg:col-span-2 relative bg-white ritmo-border shadow-soft rounded-2xl p-5 max-h-[480px] overflow-y-auto">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border sticky top-0 bg-white z-[1]">
            <span className="text-sm font-semibold">{active?.label}</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className={`text-xs font-medium ${showEnglish ? "text-primary" : "text-muted-foreground"}`}>
                English
              </span>
              <Switch
                checked={showEnglish}
                onCheckedChange={setShowEnglish}
                className="data-[state=checked]:bg-primary"
              />
            </label>
          </div>

          {celebrating === active?.id && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/85 backdrop-blur-sm rounded-2xl animate-fade-in">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-accent/30 blur-2xl animate-pulse" />
                  <div className="relative h-20 w-20 rounded-full bg-gradient-neon animate-gradient flex items-center justify-center shadow-soft-lg animate-scale-in">
                    <Check className="h-10 w-10 text-primary-foreground" strokeWidth={3} />
                  </div>
                </div>
                <p className="text-xl font-bold neon-text">+10 XP</p>
                <p className="text-sm text-muted-foreground">{active?.label} complete!</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {active?.lines.map((line, lineIdx) => {
              const words = line.spanish_text.split(/\s+/);
              return (
                <div key={line.id} className="rounded-xl p-3">
                  <p className="text-base md:text-lg font-medium leading-relaxed">
                    {words.map((w, j) => (
                      <span key={j}>
                        <TranslateWord
                          word={w}
                          songId={songId}
                          showHint={hintActive && lineIdx === 0 && j === 0}
                          onInteract={() => setHintActive(false)}
                        />{" "}
                      </span>
                    ))}
                  </p>
                  {line.pronunciation && (
                    <p className="text-sm text-secondary/80 mt-1 italic">{line.pronunciation}</p>
                  )}
                  {showEnglish && line.english_translation && (
                    <p className="text-sm text-muted-foreground mt-1 italic">{line.english_translation}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
