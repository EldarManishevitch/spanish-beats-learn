-- Allow users to delete their own daily phrases cache rows
CREATE POLICY "Users can delete own daily phrases cache"
ON public.daily_phrases_cache
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Re-assert column-scoped UPDATE on profiles (defensive; previous migration set this).
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM PUBLIC;
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