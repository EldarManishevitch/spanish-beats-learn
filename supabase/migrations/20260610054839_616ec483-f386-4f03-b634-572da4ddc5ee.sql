ALTER TABLE public.lyric_lines REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lyric_lines;