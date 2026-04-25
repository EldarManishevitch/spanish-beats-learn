import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TranslateWord } from "./TranslateWord";

type Line = { id: string; line_index: number; spanish_text: string; hebrew_translation: string; start_seconds: number; end_seconds: number; is_chorus: boolean };

declare global { interface Window { YT: any; onYouTubeIframeAPIReady: any; __ytApiLoading?: boolean; __ytApiReady?: boolean; __ytReadyCallbacks?: Array<() => void>; } }

const loadYouTubeAPI = (): Promise<void> => {
  return new Promise((resolve) => {
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
};

export const LyricsPlayer = ({ youtubeId, lines, songId }: { youtubeId: string; lines: Line[]; songId: string }) => {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [playerReady, setPlayerReady] = useState(false);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  const firstChorusIdx = useMemo(() => lines.findIndex((l) => l.is_chorus), [lines]);

  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;

    loadYouTubeAPI().then(() => {
      if (cancelled) return;
      // Destroy any prior instance (e.g., HMR or song change)
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = new window.YT.Player("yt-player", {
        videoId: youtubeId,
        playerVars: { controls: 1, modestbranding: 1, rel: 0, playsinline: 1, enablejsapi: 1 },
        events: {
          onReady: () => {
            setPlayerReady(true);
            interval = window.setInterval(() => {
              const p = playerRef.current;
              if (!p?.getCurrentTime) return;
              const t = p.getCurrentTime();
              const idx = lines.findIndex((l) => t >= l.start_seconds && t < l.end_seconds);
              setActiveIdx((prev) => (idx !== prev ? idx : prev));
            }, 250);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
      setPlayerReady(false);
    };
  }, [youtubeId, lines]);

  useEffect(() => {
    if (activeIdx < 0) return;
    const el = lineRefs.current[activeIdx];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx]);

  const jumpToChorus = () => {
    if (firstChorusIdx < 0) return;
    const line = lines[firstChorusIdx];
    const p = playerRef.current;
    if (!playerReady || !p?.seekTo) {
      console.warn("[LyricsPlayer] Player not ready yet");
      return;
    }
    p.seekTo(line.start_seconds, true);
    // playVideo can be blocked by autoplay policies; ignore failures
    try { p.playVideo?.(); } catch { /* ignore */ }
    setActiveIdx(firstChorusIdx);
    lineRefs.current[firstChorusIdx]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3">
        <div className="aspect-video rounded-2xl overflow-hidden glass shadow-card-deep">
          <div id="yt-player" className="w-full h-full" />
        </div>
      </div>
      <div ref={containerRef} className="lg:col-span-2 glass rounded-2xl p-4 max-h-[480px] overflow-y-auto scroll-smooth relative">
        {firstChorusIdx >= 0 && (
          <div className="sticky top-0 z-10 flex justify-end mb-2 -mt-1 pb-2">
            <Button
              size="sm"
              onClick={jumpToChorus}
              disabled={!playerReady}
              className="bg-gradient-neon animate-gradient text-background font-semibold shadow-neon-pink hover:opacity-90 disabled:opacity-50"
            >
              <SkipForward className="h-3.5 w-3.5 mr-1" />
              Jump to Chorus
            </Button>
          </div>
        )}
        <div className="space-y-3">
          {lines.map((line, i) => {
            const active = i === activeIdx;
            const words = line.spanish_text.split(/\s+/);
            return (
              <motion.div
                key={line.id}
                ref={(el) => (lineRefs.current[i] = el)}
                animate={{
                  scale: active ? 1.05 : 1,
                  opacity: active ? 1 : 0.5,
                }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                className={`rounded-xl p-3 transition-colors ${active ? "bg-primary/10 shadow-neon-pink" : ""} ${line.is_chorus ? "border-l-2 border-accent/60" : ""}`}
              >
                <p className="text-base md:text-lg font-medium leading-relaxed">
                  {words.map((w, j) => (
                    <span key={j}>
                      <TranslateWord word={w} songId={songId} />
                      {" "}
                    </span>
                  ))}
                </p>
                <p className="text-xs text-muted-foreground mt-1" dir="rtl">{line.hebrew_translation}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
