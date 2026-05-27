import { useEffect, useRef, useState } from "react";
import { TranslateWord } from "./TranslateWord";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

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

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
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
    <p className="text-sm font-medium text-primary animate-pulse drop-shadow-[0_0_8px_hsl(var(--primary))]">
      {label}
    </p>
  </div>
);

export const LyricsPlayer = ({
  youtubeId,
  lines,
  songId,
}: {
  youtubeId: string;
  lines: Line[];
  songId: string;
}) => {
  const playerRef = useRef<any>(null);
  const [hintActive, setHintActive] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);
  const lyricsReady = lines.length > 0;

  useEffect(() => { setHintActive(true); }, [songId]);

  useEffect(() => {
    let cancelled = false;
    setVideoReady(false);
    loadYouTubeAPI().then(() => {
      if (cancelled) return;
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = new window.YT.Player("yt-player", {
        videoId: youtubeId,
        playerVars: { controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: () => { if (!cancelled) setVideoReady(true); },
        },
      });
    });
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
    };
  }, [youtubeId]);

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3">
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-white ritmo-border shadow-soft-lg">
          {!videoReady && <NeonLoader label="Loading video…" />}
          <div id="yt-player" className="w-full h-full" />
        </div>
      </div>
      <div className="lg:col-span-2 relative bg-white ritmo-border shadow-soft rounded-2xl p-5 max-h-[480px] overflow-y-auto">
        {!lyricsReady && <NeonLoader label="Loading lyrics…" />}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border sticky top-0 bg-white z-[1]">
          <span className="text-sm font-semibold text-foreground">Lyrics</span>
          <label className="flex items-center gap-2 cursor-pointer group">
            <span className={`text-xs font-medium tracking-wide transition-colors ${showEnglish ? "text-primary drop-shadow-[0_0_6px_hsl(var(--primary))]" : "text-muted-foreground"}`}>
              Show English Translation
            </span>
            <Switch
              checked={showEnglish}
              onCheckedChange={setShowEnglish}
              className="data-[state=checked]:bg-primary data-[state=checked]:shadow-[0_0_10px_hsl(var(--primary))]"
            />
          </label>
        </div>
        <div className="space-y-4">
          {lines.map((line, lineIdx) => {
            const words = line.spanish_text.split(/\s+/);
            return (
              <div
                key={line.id}
                className={`rounded-xl p-3 ${line.is_chorus ? "border-l-4 border-primary pl-4 bg-primary/5" : ""}`}
              >
                <p className="text-base md:text-lg font-medium leading-relaxed text-foreground">
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
                  <p className="text-sm text-secondary/80 mt-1 italic tracking-wide">
                    {line.pronunciation}
                  </p>
                )}
                {showEnglish && line.english_translation && (
                  <p className="text-sm text-muted-foreground mt-1 italic">
                    {line.english_translation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
