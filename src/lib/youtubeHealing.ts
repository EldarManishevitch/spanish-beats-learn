import { supabase } from "@/integrations/supabase/client";

type HealableSong = {
  id: string;
  title?: string | null;
  artist?: string | null;
  youtube_id?: string | null;
};

export type HealedVideo = {
  youtube_id: string;
  thumbnail: string | null;
};

const availabilityCache = new Map<string, Promise<boolean>>();
const healingBySongId = new Map<string, Promise<HealedVideo | null>>();
const knownBrokenIds = new Set<string>();

export const youtubeMqThumbnailUrl = (youtubeId: string) =>
  `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;

export const checkYouTubeVideoBroken = (youtubeId: string): Promise<boolean> => {
  if (!youtubeId) return Promise.resolve(true);
  const cached = availabilityCache.get(youtubeId);
  if (cached) return cached;

  const promise = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const isPlaceholder = img.naturalHeight === 90;
      if (isPlaceholder) knownBrokenIds.add(youtubeId);
      resolve(isPlaceholder);
    };
    img.onerror = () => {
      knownBrokenIds.add(youtubeId);
      resolve(true);
    };
    img.src = `${youtubeMqThumbnailUrl(youtubeId)}?probe=${Date.now()}`;
  });

  availabilityCache.set(youtubeId, promise);
  return promise;
};

export const healSongYoutubeVideo = (song: HealableSong): Promise<HealedVideo | null> => {
  const existing = healingBySongId.get(song.id);
  if (existing) return existing;

  const promise = (async () => {
    const brokenId = song.youtube_id ?? null;
    if (brokenId) knownBrokenIds.add(brokenId);

    let title = song.title ?? null;
    let artist = song.artist ?? null;
    if (!title) {
      const { data, error } = await supabase
        .from("songs")
        .select("title, artist")
        .eq("id", song.id)
        .maybeSingle();
      if (error || !data?.title) {
        console.error("auto-heal: could not load song metadata", error);
        return null;
      }
      title = data.title;
      artist = data.artist;
    }

    const query = `${title} ${artist ?? ""} official audio`.trim();
    console.log("Auto-heal: actively searching YouTube for replacement →", { query, brokenId });
    const { data, error } = await supabase.functions.invoke("youtube-search", { body: { q: query } });
    if (error) {
      console.error("auto-heal search failed", error);
      return null;
    }

    const results: Array<{ youtube_id: string; thumbnail?: string | null }> = data?.results ?? [];
    for (const result of results) {
      const candidateId = result.youtube_id;
      if (!candidateId || candidateId === brokenId || knownBrokenIds.has(candidateId)) continue;
      const isBroken = await checkYouTubeVideoBroken(candidateId);
      if (isBroken) continue;

      const healed = { youtube_id: candidateId, thumbnail: result.thumbnail ?? null };
      console.log("Auto-heal: verified working video", { from: brokenId, to: healed.youtube_id });
      const { error: updateError } = await supabase
        .from("songs")
        .update({ youtube_id: healed.youtube_id, album_art_url: healed.thumbnail } as never)
        .eq("id", song.id);
      if (updateError) console.error("auto-heal: failed to persist new youtube_id", updateError);
      return healed;
    }

    console.warn("auto-heal: no working replacement found, hiding song from catalog", { songId: song.id, brokenId });
    const { error: updateError } = await supabase
      .from("songs")
      .update({ youtube_id: null } as never)
      .eq("id", song.id);
    if (updateError) console.error("auto-heal: failed to null youtube_id", updateError);
    return null;
  })().finally(() => {
    healingBySongId.delete(song.id);
  });

  healingBySongId.set(song.id, promise);
  return promise;
};