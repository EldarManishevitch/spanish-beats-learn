import { supabase } from "@/integrations/supabase/client";

type Entry = { song?: any; lines?: any[]; promise?: Promise<void> };
const cache = new Map<string, Entry>();

export const prefetchSong = (id: string) => {
  if (!id || cache.get(id)?.song) return;
  const existing = cache.get(id);
  if (existing?.promise) return;
  const entry: Entry = {};
  entry.promise = (async () => {
    const [{ data: song }, { data: lines }] = await Promise.all([
      supabase.from("songs").select("*").eq("id", id).maybeSingle(),
      supabase.from("lyric_lines").select("*").eq("song_id", id).order("line_index"),
    ]);
    entry.song = song;
    entry.lines = lines ?? [];
  })();
  cache.set(id, entry);
};

export const getCachedSong = (id: string) => cache.get(id);
