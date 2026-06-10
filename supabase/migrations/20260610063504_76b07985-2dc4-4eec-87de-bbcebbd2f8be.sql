-- 1. Revoke any blanket UPDATE on profiles
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM PUBLIC;

-- 2. Grant column-scoped UPDATE only on safe user-managed columns
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