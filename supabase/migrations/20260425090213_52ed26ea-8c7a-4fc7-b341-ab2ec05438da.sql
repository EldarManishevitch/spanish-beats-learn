ALTER TABLE public.lyric_lines ADD COLUMN IF NOT EXISTS english_translation text;

-- Allow public users to see all songs added by anyone (already public-read), but we need INSERT for AI-generated songs.
-- Restrict INSERT to authenticated users so anyone logged in can add a song via the search flow.
CREATE POLICY "Authenticated users can add songs"
ON public.songs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Same for lyric_lines: authenticated users can add lyrics (for songs they create via the AI flow).
CREATE POLICY "Authenticated users can add lyric lines"
ON public.lyric_lines
FOR INSERT
TO authenticated
WITH CHECK (true);