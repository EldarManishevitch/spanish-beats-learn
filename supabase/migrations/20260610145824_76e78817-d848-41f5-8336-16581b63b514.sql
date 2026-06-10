REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM PUBLIC;

GRANT UPDATE (display_name, avatar_url, learning_level, learning_goal, fav_genres, notifications_enabled, notifications_time, onboarding_completed) ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;