import { useEffect, useMemo, useRef, useState } from "react";
import YouTubePlayerFactory from "youtube-player";
import type { YouTubePlayer as YouTubePlayerInstance } from "youtube-player/dist/types";

import { TranslateWord } from "./TranslateWord";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Sparkles, Music } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { checkYouTubeVideoBroken, healSongYoutubeVideo } from "@/lib/youtubeHealing";
import { useLyricsSync } from "@/hooks/useLyricsSync";
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

type YouTubePlayer = YouTubePlayerInstance;


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
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const sectionEndTimer = useRef<number | null>(null);

  const [videoReady, setVideoReady] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);
  const [hintActive, setHintActive] = useState(true);
  // Active YouTube id (may be hot-swapped if the original is unavailable).
  const [activeYoutubeId, setActiveYoutubeId] = useState<string | null>(youtubeId ?? null);
  const [healing, setHealing] = useState(false);
  const [checkingVideo, setCheckingVideo] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  // Video duration in seconds — captured on player ready. Used to build a
  // fallback timing map for songs whose lyric_lines were saved with 0/0.
  const [videoDuration, setVideoDuration] = useState<number>(0);
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

  // A song is "synced" when at least one line carries a real LRC timestamp.
  const hasTimestamps = useMemo(
    () => liveLines.some((l) => (l.start_seconds ?? 0) > 0),
    [liveLines],
  );

  // Three-state UI flow: lyrics render instantly; sync resolution is decided
  // in the background so the user never waits on a blank screen.
  const [syncStatus, setSyncStatus] = useState<"checking" | "synced" | "static">(
    hasTimestamps ? "synced" : "checking",
  );
  const autoResyncAttempted = useRef<string | null>(null);

  // Shared re-sync handler used by both the auto-attempt and the manual
  // button. `silent=true` suppresses toasts (auto-attempt on mount).
  const runResync = async (opts: { silent: boolean }): Promise<boolean> => {
    setResyncing(true);
    setSyncStatus("checking");
    try {
      const { data, error } = await supabase.functions.invoke("resync-lyrics", {
        body: { song_id: songId },
      });
      if (error) throw error;
      if (!data?.success) {
        if (!opts.silent) {
          toast.info(data?.message ?? "Still no synced lyrics found. Try again later.");
        }
        return false;
      }
      const { data: fresh } = await supabase
        .from("lyric_lines")
        .select("id, line_index, spanish_text, pronunciation, english_translation, start_seconds, end_seconds, is_chorus")
        .eq("song_id", songId)
        .order("line_index");
      if (fresh) setLiveLines(fresh as Line[]);
      if (!opts.silent) {
        toast.success(`Synced via ${data.source} (${data.updated_lines} lines)`);
      }
      return true;
    } catch (e) {
      console.error("resync error:", e);
      if (!opts.silent) toast.error("Re-sync failed. Please try again.");
      return false;
    } finally {
      setResyncing(false);
    }
  };

  useEffect(() => {
    // Reset when the song changes
    autoResyncAttempted.current = null;
    setSyncStatus(hasTimestamps ? "synced" : "checking");
  }, [songId]);

  useEffect(() => {
    if (hasTimestamps) {
      setSyncStatus("synced");
      return;
    }
    // No timestamps yet — try one silent auto re-sync, then fall back to static.
    if (syncStatus !== "checking") return;
    if (autoResyncAttempted.current === songId) return;
    autoResyncAttempted.current = songId;

    let cancelled = false;
    (async () => {
      const ok = await runResync({ silent: true });
      if (cancelled) return;
      if (!ok) setSyncStatus("static");
      // If ok, the fresh liveLines will flip hasTimestamps and the effect
      // above sets 'synced' automatically.
    })();
    return () => { cancelled = true; };
    // runResync is stable enough — depends only on songId via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTimestamps, syncStatus, songId]);

  const isSynced = syncStatus === "synced";

  // Cap each line's active window to its realistic sung duration so the
  // highlight drops during instrumental gaps (mid-song breaks, bridges,
  // outros) instead of camping on the previous line until the next sung
  // line. Works on legacy rows where end_seconds was saved as nextStart.
  const effectiveTimings = useMemo<Map<string, { start: number; end: number }>>(() => {
    const map = new Map<string, { start: number; end: number }>();
    if (!isSynced) return map;
    for (const line of liveLines) {
      const start = line.start_seconds ?? 0;
      const wordCount = (line.spanish_text || "").trim().split(/\s+/).filter(Boolean).length || 1;
      const estimatedSung = Math.max(1.8, Math.min(7, wordCount * 0.45 + 0.8));
      const rawEnd = line.end_seconds ?? 0;
      const cappedByEstimate = start + estimatedSung;
      const end = rawEnd > start ? Math.min(rawEnd, cappedByEstimate) : cappedByEstimate;
      map.set(line.id, { start, end });
    }
    return map;
  }, [isSynced, liveLines]);

  // First real sung moment in the currently active section. Used to render
  // the intro indicator and to suppress highlighting before the singer
  // starts. We compute it lazily off the active section below.
  void videoDuration;



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

  // Time-synced active line highlighting — event-driven via useLyricsSync.
  // The hook subscribes to YT.PlayerState changes and runs a rAF loop only
  // while the player is in state PLAYING (1), reading getCurrentTime() each
  // frame and pushing it into `currentPlaybackTime`.
  const {
    currentPlaybackTime,
    registerPlayer,
    handlePlayerStateChange,
    syncNow,
  } = useLyricsSync();
  const lastScrolledLineId = useRef<string | null>(null);






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
      registerPlayer(null);
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
      const host = playerHostRef.current;
      if (!host) return;
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }

      // Programmatic init via the official `youtube-player` wrapper.
      // It auto-injects the IFrame API, builds a stable iframe inside the
      // ref'd <div>, and exposes a clean async API with .on() events.
      const player = YouTubePlayerFactory(host, {
        videoId: currentId,
        playerVars: { controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
      });
      playerRef.current = player;

      player.on("ready", async () => {
        if (cancelled) return;
        setVideoReady(true);
        registerPlayer(player);
        syncNow();
        try {
          const d = await player.getDuration();
          if (!cancelled && typeof d === "number" && d > 0) setVideoDuration(d);
        } catch { /* ignore */ }
      });


      player.on("stateChange", (event) => {
        if (cancelled) return;
        handlePlayerStateChange({ data: (event as unknown as { data: number }).data });
      });


      player.on("error", (event) => {
        const code = (event as unknown as { data: number })?.data;
        console.log("YouTube Player Error Intercepted:", code, "for videoId:", currentId);
        if ([2, 5, 100, 101, 150].includes(code)) {
          healVideo(currentId, code);
        }
      });

    });
    return () => {
      cancelled = true;
      setCheckingVideo(false);
      if (sectionEndTimer.current) window.clearTimeout(sectionEndTimer.current);
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
      registerPlayer(null);
    };
  }, [activeYoutubeId, handlePlayerStateChange, registerPlayer, syncNow]);




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

  // NOTE: no early-return for empty tabSections. The player container is a
  // single stable <div ref={playerHostRef}> rendered exactly once in the main
  // tree below — unmounting / remounting it (as the previous early-return
  // did) orphans the iframe and silently breaks getCurrentTime().


  return (
    <div className="space-y-5">
      <div className="sticky top-16 z-30 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-md border-b border-border/40 shadow-sm">
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
            <div ref={playerHostRef} className="w-full h-full" />
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

        <div className="lg:col-span-2 relative bg-[#FBF9F6] ritmo-border shadow-soft rounded-2xl max-h-[min(70vh,560px)] overflow-y-auto overscroll-contain">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border sticky top-0 bg-[#FBF9F6] z-[1]">
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

          <div className="space-y-3 px-5 py-4">
            {!active && (
              <p className="text-sm text-muted-foreground">Lyrics are still loading…</p>
            )}

            {active && syncStatus === "checking" && (
              <div className="flex justify-center mb-2 animate-pulse transition-all duration-300">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#2C2A29]/10 bg-white px-3 py-1 text-xs text-[#2C2A29]/80"
                  role="status"
                >
                  🔄 Checking for time-sync database markers…
                </span>
              </div>
            )}

            {active && syncStatus === "static" && (
              <div className="flex flex-col items-center gap-2 mb-1 transition-all duration-300">
                <span className="text-xs text-[#2C2A29]/80" role="status">
                  Static lyrics — sync unavailable for this track
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resyncing}
                  onClick={async () => {
                    const ok = await runResync({ silent: false });
                    if (!ok) setSyncStatus("static");
                  }}
                  className="h-7 text-xs"
                >
                  {resyncing ? (
                    <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Re-syncing…</>
                  ) : (
                    <><Sparkles className="h-3 w-3 mr-1.5" />Re-sync this song</>
                  )}
                </Button>
              </div>
            )}

            {active && isSynced && (() => {
              const firstStart = active.lines.reduce((min, l) => {
                const t = effectiveTimings.get(l.id)?.start ?? l.start_seconds ?? 0;
                return t > 0 && (min === null || t < min) ? t : min;
              }, null as number | null);
              const isIntro =
                videoReady &&
                firstStart !== null &&
                currentPlaybackTime < firstStart - 0.2;
              if (!isIntro) return null;
              return (
                <div className="flex justify-center mb-1 animate-fade-in">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#2C2A29]/15 bg-[#FBF9F6] px-3 py-1 text-xs font-medium text-[#2C2A29]/70 transition-opacity duration-300"
                    role="status"
                    aria-live="polite"
                  >
                    🎵 Instrumental…
                  </span>
                </div>
              );
            })()}

            {active?.lines.map((line, lineIdx) => {
              const words = line.spanish_text.split(/\s+/);
              // For synced songs, use the capped active window so highlight
              // drops during instrumental gaps. For unsynced songs, render
              // every line in static (non-active) style.
              const t = effectiveTimings.get(line.id);
              const isActive =
                isSynced &&
                !!t &&
                t.end > t.start &&
                currentPlaybackTime >= t.start &&
                currentPlaybackTime <= t.end;
              return (
                <div
                  key={line.id}
                  ref={(el) => {
                    if (isActive && el && lastScrolledLineId.current !== line.id) {
                      lastScrolledLineId.current = line.id;
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }}
                  className={`rounded-xl px-4 py-3 transition-all duration-300 border-2 ${
                    isActive
                      ? "scale-[1.02] border-[#D96B43] bg-[#2C2A29]/5 shadow-sm"
                      : "border-transparent bg-transparent"
                  }`}
                >
                  <p
                    className={`text-base md:text-lg leading-relaxed transition-all duration-300 text-[#2C2A29] ${
                      isActive
                        ? "font-extrabold text-xl opacity-100"
                        : "font-normal opacity-70"
                    }`}
                  >
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
                  {showEnglish && (
                    line.english_translation ? (
                      <p
                        className={`text-sm italic transition-opacity duration-300 mt-1 text-[#2C2A29] opacity-100 ${
                          isActive ? "opacity-90 font-medium" : "opacity-50"
                        }`}
                      >
                        {line.english_translation}
                      </p>
                    ) : (
                      <div
                        className="h-4 w-2/3 bg-[#2C2A29]/10 animate-pulse rounded mt-1 transition-opacity duration-300"
                        role="status"
                        aria-label="Translation loading"
                      />
                    )
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
