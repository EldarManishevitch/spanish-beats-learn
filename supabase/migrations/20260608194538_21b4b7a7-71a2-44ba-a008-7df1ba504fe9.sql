REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url, learning_level, notifications_enabled, notifications_time, fav_genres, learning_goal, onboarding_completed) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;