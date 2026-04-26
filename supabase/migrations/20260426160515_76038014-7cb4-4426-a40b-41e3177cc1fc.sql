ALTER TABLE public.slang_dictionary
  ADD COLUMN IF NOT EXISTS literal_meaning text,
  ADD COLUMN IF NOT EXISTS english_equivalent text,
  ADD COLUMN IF NOT EXISTS lyrics_snippet_translation text;