import { useEffect, useMemo, useRef, useState } from "react";
import { TranslateWord } from "./TranslateWord";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Sparkles, Music } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { checkYouTubeVideoBroken, healSongYoutubeVideo } from "@/lib/youtubeHealing";

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
  songTitle,
  songArtist,
  lines,
  songId,
  onPracticeQuiz,
}: {
  youtubeId: string | null;
  songTitle?: string;
  songArtist?: string;
  lines: Line[];
  songId: string;
  onPracticeQuiz?: (sectionId: "chorus" | "verse_1" | "verse_2" | "full") => void;
}) => {
  const { user } = useAuth();
  const playerRef = useRef<YouTubePlayer | null>(null);
  const sectionEndTimer = useRef<number | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);
  const [hintActive, setHintActive] = useState(true);
  // Active YouTube id (may be hot-swapped if the original is unavailable).
  const [activeYoutubeId, setActiveYoutubeId] = useState<string | null>(youtubeId ?? null);
  const [healing, setHealing] = useState(false);
  const [checkingVideo, setCheckingVideo] = useState(false);
  const healedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { setActiveYoutubeId(youtubeId ?? null); healedIdsRef.current = new Set(); }, [youtubeId, songId]);


  // Live copy of lines — seeded from props, then kept in sync via realtime so
  // section tags (is_chorus) unlock tabs without a page refresh.
  const [liveLines, setLiveLines] = useState<Line[]>(lines);
  useEffect(() => { setLiveLines(lines); }, [lines]);

  const sections = useMemo(() => splitSections(liveLines), [liveLines]);
  const fullSong = useMemo<Section | null>(() => {
    const sorted = [...liveLines].sort((a, b) => a.line_index - b.line_index);
    return sorted.length ? { id: "full", label: "Full Song", lines: sorted } : null;
  }, [liveLines]);

  // Sections are "ready" once at least one line is tagged is_chorus=true.
  // Until then we still render Full Song immediately and show a neon indicator
  // where the chorus / verse tabs will appear.
  const sectionsReady = sections.length > 0;

  // Tab order: Full Song → Verse 1 → Verse 2 → Chorus
  const tabSections = useMemo(() => {
    const order = ["full", "verse_1", "verse_2", "chorus"] as const;
    const all = fullSong ? [fullSong, ...sections] : sections;
    return order
      .map((id) => all.find((s) => s.id === id))
      .filter((s): s is Section => Boolean(s));
  }, [sections, fullSong]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = tabSections.find((s) => s.id === activeId) ?? tabSections[0] ?? null;

  // Completion is derived strictly from the quiz_attempts table — users cannot
  // mark a section complete manually. A passing quiz attempt for this song
  // (score === total) flags every section as complete in the UI.
  const [quizPassed, setQuizPassed] = useState(false);

  useEffect(() => { setHintActive(true); }, [songId]);

  useEffect(() => {
    if (tabSections.length && !activeId) setActiveId(tabSections[0].id);
  }, [tabSections, activeId]);

  // Realtime: refetch lines whenever any lyric_line for this song changes
  // (e.g. background section-tagging flips is_chorus from false → true).
  useEffect(() => {
    if (!songId) return;
    const refetch = async () => {
      const { data } = await supabase
        .from("lyric_lines")
        .select("id, line_index, spanish_text, pronunciation, english_translation, start_seconds, end_seconds, is_chorus")
        .eq("song_id", songId)
        .order("line_index");
      if (data && data.length) setLiveLines(data as Line[]);
    };
    const channel = supabase
      .channel(`lyric-lines-${songId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lyric_lines", filter: `song_id=eq.${songId}` },
        () => { refetch(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [songId]);

  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => {
      if (!user || !songId) { setQuizPassed(false); return; }
      const { data } = await supabase
        .from("quiz_attempts")
        .select("score,total")
        .eq("user_id", user.id)
        .eq("song_id", songId);
      if (cancelled) return;
      const passed = (data ?? []).some((a) => a.total > 0 && a.score >= a.total);
      setQuizPassed(passed);
    };
    loadStatus();
    return () => { cancelled = true; };
  }, [user, songId]);

  // Ref-based lock so the closure inside the YT.Player onError callback
  // (created once at mount) always sees the latest value and we never queue
  // multiple parallel heals → no infinite search loops.
  const healingRef = useRef(false);
  const healVideo = async (brokenId: string, errorCode: number) => {
    if (healingRef.current) {
      console.log("Auto-heal already in progress, skipping duplicate trigger");
      return;
    }
    healingRef.current = true;
    setHealing(true);
    healedIdsRef.current.add(brokenId);
    try {
      console.log("Auto-heal: healing trigger", { brokenId, errorCode });
      const next = await healSongYoutubeVideo({
        id: songId,
        title: songTitle,
        artist: songArtist,
        youtube_id: brokenId,
      });
      if (!next) {
        setActiveYoutubeId(null);
        return;
      }
      console.log("Auto-heal: hot-swapping video", { from: brokenId, to: next.youtube_id });
      healedIdsRef.current.add(next.youtube_id);
      setActiveYoutubeId(next.youtube_id);
    } catch (err) {
      console.error("auto-heal: unexpected error", err);
    } finally {
      healingRef.current = false;
      setHealing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setVideoReady(false);
    const currentId = activeYoutubeId;
    if (!currentId) {
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
      return () => { cancelled = true; };
    }
    setCheckingVideo(true);
    checkYouTubeVideoBroken(currentId).then((isBroken) => {
      if (cancelled) return;
      setCheckingVideo(false);
      if (isBroken) {
        console.log("YouTube thumbnail availability check failed:", currentId);
        healVideo(currentId, 90);
        return;
      }
    loadYouTubeAPI().then(() => {
      if (cancelled) return;
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = new window.YT.Player("yt-player", {
        videoId: currentId,
        playerVars: { controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: () => { if (!cancelled) setVideoReady(true); },
          // Bound directly to the native YT IFrame API onError event.
          // Codes: 2 = invalid videoId, 5 = HTML5 player error,
          // 100 = removed/private, 101/150 = embed/region blocked.
          onError: (event: { data: number }) => {
            console.log("YouTube Player Error Intercepted:", event?.data, "for videoId:", currentId);
            const code = event?.data;
            if ([2, 5, 100, 101, 150].includes(code)) {
              healVideo(currentId, code);
            }
          },
        },
      });
    });
    });
    return () => {
      cancelled = true;
      setCheckingVideo(false);
      if (sectionEndTimer.current) window.clearTimeout(sectionEndTimer.current);
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
    };
  }, [activeYoutubeId]);



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
            {activeYoutubeId ? (!videoReady && <NeonLoader label={healing ? "Finding a working version…" : checkingVideo ? "Checking video availability…" : "Loading video…"} />) : <NeonLoader label="Finding a working version…" />}
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
      <div className="sticky top-0 z-50 -mx-2 px-2 py-3 backdrop-blur-md bg-background/90 border-b border-border/40">
        <div role="tablist" aria-label="Song sections" className="flex flex-wrap gap-2">
          {tabSections.map((s) => {
            const isActive = active?.id === s.id;
            const isDone = quizPassed;
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
                  <span
                    className="ml-1 h-4 w-4 rounded-full bg-accent flex items-center justify-center"
                    title="Quiz completed"
                  >
                    <Check className="h-2.5 w-2.5 text-accent-foreground" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {!sectionsReady && fullSong && (
          <div
            className="mt-2 px-4 py-2 rounded-full text-xs font-medium inline-flex items-center gap-2 border-2 border-primary/40 bg-primary/10 backdrop-blur-md text-primary animate-fade-in"
            role="status"
            aria-live="polite"
            title="Section analysis in progress"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin drop-shadow-[0_0_6px_hsl(var(--primary))]" />
            <span className="drop-shadow-[0_0_4px_hsl(var(--primary)/0.6)]">
              AI is organizing chapters… Advanced learning modes coming up next! 🪄
            </span>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-white ritmo-border shadow-soft-lg">
            {activeYoutubeId ? (!videoReady && <NeonLoader label={healing ? "Finding a working version…" : checkingVideo ? "Checking video availability…" : "Loading video…"} />) : <NeonLoader label="Finding a working version…" />}
            <div id="yt-player" className="w-full h-full" />
          </div>
          {active && (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              {onPracticeQuiz && (
                <Button
                  onClick={() => onPracticeQuiz(active.id)}
                  variant="outline"
                  className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                >
                  🎯 Practice with a Quiz
                </Button>
              )}
              <p className="text-xs text-muted-foreground ml-1">
                Listen, tap any unfamiliar word, then ace the quiz to mark this song complete.
              </p>
            </div>
          )}
        </div>

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

          <div className="space-y-3">
            {active?.lines.map((line, lineIdx) => {
              const words = line.spanish_text.split(/\s+/);
              return (
                <div key={line.id}>
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
                  {showEnglish && line.english_translation && (
                    <p className="text-sm text-muted-foreground italic">{line.english_translation}</p>
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
