
-- 1. Normalise all existing songs.album_art_url to the deterministic
--    server-side YouTube thumbnail. This wipes any client-supplied URL
--    that may have been persisted into the publicly readable songs table.
UPDATE public.songs
SET album_art_url = 'https://i.ytimg.com/vi/' || youtube_id || '/hqdefault.jpg'
WHERE youtube_id ~ '^[A-Za-z0-9_-]{11}$'
  AND (
    album_art_url IS NULL
    OR album_art_url <> 'https://i.ytimg.com/vi/' || youtube_id || '/hqdefault.jpg'
  );

-- 2. Lock down xp_ledger with explicit restrictive deny policies so
--    authenticated users can never write to the ledger via PostgREST —
--    only the service role (used by the add-xp edge function) can.
CREATE POLICY "Block direct inserts to xp_ledger"
ON public.xp_ledger
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "Block direct updates to xp_ledger"
ON public.xp_ledger
AS RESTRICTIVE
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Block direct deletes from xp_ledger"
ON public.xp_ledger
AS RESTRICTIVE
FOR DELETE
TO authenticated, anon
USING (false);
