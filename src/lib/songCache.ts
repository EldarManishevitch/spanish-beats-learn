import { supabase } from "@/integrations/supabase/client";

type OptimisticMeta = { title: string; artist: string; thumbnail?: string | null };
type Entry = {
  song?: any;
  lines?: any[];
  promise?: Promise<void>;
  optimistic?: OptimisticMeta;
  generation?: Promise<{ song_id?: string; error?: string }>;
  resolvedSongId?: string;
};

const cache = new Map<string, Entry>();
const ytCache = new Map<string, Entry>();

export const prefetchSong = (id: string) => {
  if (!id || cache.get(id)?.song) return;
  const existing = cache.get(id);
  if (existing?.promise) return;
  const entry: Entry = existing ?? {};
  entry.promise = (async () => {
    const [{ data: song }, { data: lines }] = await Promise.all([
      supabase.from("songs").select("*").eq("id", id).maybeSingle(),
      supabase.from("lyric_lines").select("*").eq("song_id", id).order("line_index"),
    ]);
    entry.song = song;
    entry.lines = entry.lines ?? lines ?? [];
  })();
  cache.set(id, entry);
};

export const getCachedSong = (id: string) => cache.get(id);

export const prefetchByYoutubeId = (youtube_id: string, meta: OptimisticMeta) => {
  if (!youtube_id) return;
  const existing = ytCache.get(youtube_id) ?? {};
  existing.optimistic = meta;
  existing.song = existing.song ?? {
    id: "",
    title: meta.title,
    artist: meta.artist,
    genre: "",
    youtube_id,
    album_art_url: meta.thumbnail ?? null,
  };
  ytCache.set(youtube_id, existing);
};

export const getCachedByYoutubeId = (youtube_id: string) => ytCache.get(youtube_id);

export const registerGeneration = (
  youtube_id: string,
  generation: Promise<{ song_id?: string; lines?: any[]; error?: string }>,
) => {
  const entry = ytCache.get(youtube_id) ?? {};
  entry.generation = generation.then((res) => {
    if (res?.song_id) {
      entry.resolvedSongId = res.song_id;
      // Seed the id-keyed cache so SongPage renders instantly.
      const idEntry: Entry = cache.get(res.song_id) ?? {};
      if (entry.optimistic) {
        idEntry.song = idEntry.song ?? {
          id: res.song_id,
          title: entry.optimistic.title,
          artist: entry.optimistic.artist,
          genre: "",
          youtube_id,
          album_art_url: entry.optimistic.thumbnail ?? null,
        };
      }
      if (res.lines && !idEntry.lines) idEntry.lines = res.lines;
      cache.set(res.song_id, idEntry);
      // Trigger a background full song fetch so we have the real row.
      prefetchSong(res.song_id);
    }
    return res;
  });
  ytCache.set(youtube_id, entry);
  return entry.generation;
};
