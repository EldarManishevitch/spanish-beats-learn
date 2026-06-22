import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useLyricsSync — event-driven bridge between a YouTube IFrame player and
 * the lyrics view. Polls `getCurrentTime()` via requestAnimationFrame while
 * the player is in the PLAYING state, and stops immediately on pause/end.
 *
 * Usage:
 *   const { currentPlaybackTime, handlePlayerStateChange, registerPlayer } =
 *     useLyricsSync();
 *
 *   // In YT.Player events:
 *   onReady:  (e) => registerPlayer(e.target),
 *   onStateChange: handlePlayerStateChange,
 */
export type YTPlayerLike = {
  getCurrentTime?: () => number;
};

export const useLyricsSync = () => {
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const playerRef = useRef<YTPlayerLike | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) return;
    const tick = () => {
      try {
        const t = playerRef.current?.getCurrentTime?.();
        if (typeof t === "number" && !Number.isNaN(t)) {
          setCurrentPlaybackTime(t);
        }
      } catch { /* ignore */ }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const registerPlayer = useCallback((player: YTPlayerLike | null) => {
    playerRef.current = player;
  }, []);

  // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
  const handlePlayerStateChange = useCallback(
    (event: { data: number }) => {
      if (event?.data === 1) startLoop();
      else stopLoop();
    },
    [startLoop, stopLoop],
  );

  // Force an immediate sync (e.g. after a seek without resuming play).
  const syncNow = useCallback(() => {
    try {
      const t = playerRef.current?.getCurrentTime?.();
      if (typeof t === "number") setCurrentPlaybackTime(t);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => stopLoop, [stopLoop]);

  return {
    currentPlaybackTime,
    registerPlayer,
    handlePlayerStateChange,
    syncNow,
  };
};
