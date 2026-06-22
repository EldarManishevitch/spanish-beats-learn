import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useLyricsSync — event-driven bridge between the YouTube IFrame Player API
 * and the lyrics view. Subscribes to the player's stateChange events; while
 * the player is in state PLAYING (1) it runs a requestAnimationFrame loop
 * that reads `getCurrentTime()` and pushes the value into `currentPlaybackTime`.
 *
 * Supports the `youtube-player` npm wrapper (async getCurrentTime) and the
 * raw `window.YT.Player` instance (sync getCurrentTime). Both code paths are
 * handled transparently.
 */
type Awaitable<T> = T | Promise<T>;
export type YTPlayerLike = {
  getCurrentTime?: () => Awaitable<number>;
};

export const useLyricsSync = () => {
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const playerRef = useRef<YTPlayerLike | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef(false);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const pushTime = useCallback((t: unknown) => {
    if (typeof t === "number" && !Number.isNaN(t)) {
      setCurrentPlaybackTime(t);
    }
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) return;
    const tick = () => {
      const player = playerRef.current;
      if (player && !pendingRef.current) {
        try {
          const result = player.getCurrentTime?.();
          if (result && typeof (result as Promise<number>).then === "function") {
            pendingRef.current = true;
            (result as Promise<number>)
              .then(pushTime)
              .catch(() => { /* ignore */ })
              .finally(() => { pendingRef.current = false; });
          } else {
            pushTime(result);
          }
        } catch { /* ignore */ }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [pushTime]);

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

  const syncNow = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    try {
      const result = player.getCurrentTime?.();
      if (result && typeof (result as Promise<number>).then === "function") {
        (result as Promise<number>).then(pushTime).catch(() => { /* ignore */ });
      } else {
        pushTime(result);
      }
    } catch { /* ignore */ }
  }, [pushTime]);

  useEffect(() => stopLoop, [stopLoop]);

  return {
    currentPlaybackTime,
    registerPlayer,
    handlePlayerStateChange,
    syncNow,
  };
};
