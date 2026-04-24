import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TranslateWord } from "./TranslateWord";

type Line = { id: string; line_index: number; spanish_text: string; hebrew_translation: string; start_seconds: number; end_seconds: number; is_chorus: boolean };

declare global { interface Window { YT: any; onYouTubeIframeAPIReady: any; } }

export const LyricsPlayer = ({ youtubeId, lines, songId }: { youtubeId: string; lines: Line[]; songId: string }) => {
  const [activeIdx, setActiveIdx] = useState(-1);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  const firstChorusIdx = useMemo(() => lines.findIndex((l) => l.is_chorus), [lines]);

  useEffect(() => {
    const init = () => {
      playerRef.current = new window.YT.Player("yt-player", {
        videoId: youtubeId,
        playerVars: { controls: 1, modestbranding: 1, rel: 0 },
      });
    };
    if (window.YT?.Player) init();
    else {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = init;
    }
    const interval = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      const t = p.getCurrentTime();
      const idx = lines.findIndex((l) => t >= l.start_seconds && t < l.end_seconds);
      if (idx !== activeIdx) setActiveIdx(idx);
    }, 250);
    return () => clearInterval(interval);
  }, [youtubeId, lines, activeIdx]);

  useEffect(() => {
    if (activeIdx < 0) return;
    const el = lineRefs.current[activeIdx];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx]);

  const jumpToChorus = () => {
    if (firstChorusIdx < 0) return;
    const line = lines[firstChorusIdx];
    const p = playerRef.current;
    if (p?.seekTo) {
      p.seekTo(line.start_seconds, true);
      p.playVideo?.();
    }
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
              className="bg-gradient-neon animate-gradient text-background font-semibold shadow-neon-pink hover:opacity-90"
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
