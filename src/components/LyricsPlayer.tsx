import { useEffect, useRef, useState } from "react";
import { TranslateWord } from "./TranslateWord";

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

  useEffect(() => { setHintActive(true); }, [songId]);

  useEffect(() => {
    let cancelled = false;
    loadYouTubeAPI().then(() => {
      if (cancelled) return;
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = new window.YT.Player("yt-player", {
        videoId: youtubeId,
        playerVars: { controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
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
        <div className="aspect-video rounded-2xl overflow-hidden glass shadow-card-deep">
          <div id="yt-player" className="w-full h-full" />
        </div>
      </div>
      <div className="lg:col-span-2 glass rounded-2xl p-5 max-h-[480px] overflow-y-auto">
        <div className="space-y-4">
          {lines.map((line, lineIdx) => {
            const words = line.spanish_text.split(/\s+/);
            return (
              <div
                key={line.id}
                className={`rounded-xl p-3 ${line.is_chorus ? "border-l-2 border-accent/60 pl-4" : ""}`}
              >
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
                  <p className="text-sm text-accent/90 mt-1 italic tracking-wide">
                    {line.pronunciation}
                  </p>
                )}
                {line.english_translation && (
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
