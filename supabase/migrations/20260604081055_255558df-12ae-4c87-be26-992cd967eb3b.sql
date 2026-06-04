-- Restrict client UPDATE on profiles to safe columns only.
-- Gated/system columns (total_xp, cefr_level, mastered_count, unlocked_conversations,
-- current_streak, longest_streak, last_practice_date) must only be written
-- server-side via the service_role (edge functions / SECURITY DEFINER functions).

REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;

GRANT UPDATE (display_name, avatar_url, learning_level) ON public.profiles TO authenticated;

-- service_role retains full access (already granted via GRANT ALL pattern, but ensure it)
GRANT ALL ON public.profiles TO service_role;