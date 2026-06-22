-- 1) Drop redundant public SELECT policy on lyric_lines (kept authenticated-only policy)
DROP POLICY IF EXISTS "Lyrics are public" ON public.lyric_lines;

-- 2) Harden translations_cache: only service_role may mutate
REVOKE INSERT, UPDATE, DELETE ON public.translations_cache FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.translations_cache FROM authenticated;
GRANT ALL ON public.translations_cache TO service_role;

-- Explicit deny policies (defense in depth) so even if a future GRANT is added,
-- PostgREST writes from anon/authenticated are still blocked by RLS.
DROP POLICY IF EXISTS "No client inserts on translations_cache" ON public.translations_cache;
CREATE POLICY "No client inserts on translations_cache"
  ON public.translations_cache
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "No client updates on translations_cache" ON public.translations_cache;
CREATE POLICY "No client updates on translations_cache"
  ON public.translations_cache
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "No client deletes on translations_cache" ON public.translations_cache;
CREATE POLICY "No client deletes on translations_cache"
  ON public.translations_cache
  FOR DELETE
  TO anon, authenticated
  USING (false);