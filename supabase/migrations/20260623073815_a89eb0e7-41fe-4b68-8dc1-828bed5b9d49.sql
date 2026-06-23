ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS is_synced boolean NOT NULL DEFAULT false;

UPDATE public.songs s
   SET is_synced = true
 WHERE EXISTS (
   SELECT 1 FROM public.lyric_lines l
    WHERE l.song_id = s.id AND l.start_seconds > 0
 );