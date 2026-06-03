
-- Fix #1: Restrict updatable columns on profiles so users can't self-grant unlocked_conversations,
-- cefr_level, mastered_count, total_xp, current_streak, longest_streak, or last_practice_date.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url, learning_level, updated_at) ON public.profiles TO authenticated;

-- Fix #2: Lock down SECURITY DEFINER RPCs so anon cannot execute them.
REVOKE EXECUTE ON FUNCTION public.recompute_cefr(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.touch_streak(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_cefr(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_streak(text) TO authenticated;

-- Trigger-only definer functions: ensure they aren't directly callable by anon either.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon;
