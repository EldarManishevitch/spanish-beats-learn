-- Fix 1: Restrict UPDATE on profiles to user-editable columns only.
-- Server-only fields (xp, streaks, cefr_level, unlocked_conversations, mastered_count,
-- last_practice_date, last_sent_variant_id) must be written by edge functions / DB functions
-- using the service role, not by clients.
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;
GRANT UPDATE (
  display_name,
  avatar_url,
  learning_level,
  learning_goal,
  fav_genres,
  notifications_enabled,
  notifications_time,
  onboarding_completed
) ON public.profiles TO authenticated;

-- Fix 2: Restrict lyric_lines SELECT (and Realtime broadcasts) to authenticated users only.
DROP POLICY IF EXISTS "Lyric lines are viewable by everyone" ON public.lyric_lines;
DROP POLICY IF EXISTS "Public can read lyric lines" ON public.lyric_lines;
DROP POLICY IF EXISTS "Anyone can read lyric_lines" ON public.lyric_lines;
DROP POLICY IF EXISTS "lyric_lines are viewable by everyone" ON public.lyric_lines;

CREATE POLICY "Authenticated users can read lyric lines"
ON public.lyric_lines
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.lyric_lines FROM anon;
GRANT SELECT ON public.lyric_lines TO authenticated;
