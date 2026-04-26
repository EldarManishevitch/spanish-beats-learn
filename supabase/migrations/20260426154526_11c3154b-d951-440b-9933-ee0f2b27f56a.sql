ALTER TABLE public.slang_dictionary
  ADD COLUMN IF NOT EXISTS example_song_title text,
  ADD COLUMN IF NOT EXISTS example_song_artist text,
  ADD COLUMN IF NOT EXISTS lyrics_snippet text;