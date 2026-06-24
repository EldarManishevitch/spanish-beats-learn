-- ============================================================
-- 1. Lock down user_vocab_stats progression columns
-- ============================================================
-- Clients can still read their rows (RLS unchanged) and create new
-- bare rows for words they encounter, but correct_count, fail_count
-- and is_mastered may only be written by the service role (i.e. the
-- record-vocab edge function). This stops "INSERT row with
-- correct_count=3, fail_count=0" mastery forgery.
REVOKE INSERT, UPDATE ON public.user_vocab_stats FROM authenticated;
REVOKE INSERT, UPDATE ON public.user_vocab_stats FROM anon;

GRANT INSERT (user_id, word, last_reviewed) ON public.user_vocab_stats TO authenticated;
GRANT UPDATE (last_reviewed) ON public.user_vocab_stats TO authenticated;
GRANT ALL ON public.user_vocab_stats TO service_role;

-- ============================================================
-- 2. Defense-in-depth: prevent direct progression writes on profiles
-- ============================================================
-- Column-level GRANTs already restrict UPDATE on profiles to a safe set
-- of columns, but add a BEFORE UPDATE trigger that hard-reverts the
-- server-only progression columns when the caller is not the service
-- role. Belt-and-suspenders against any future grant regression.
CREATE OR REPLACE FUNCTION public.protect_profile_progression()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  -- Service role (edge functions / DB functions) is allowed through.
  IF v_role = 'service_role' OR v_role IS NULL THEN
    -- v_role is NULL inside SECURITY DEFINER DB functions (e.g.
    -- recompute_cefr, touch_streak), which are themselves trusted.
    RETURN NEW;
  END IF;

  NEW.total_xp := OLD.total_xp;
  NEW.cefr_level := OLD.cefr_level;
  NEW.current_streak := OLD.current_streak;
  NEW.longest_streak := OLD.longest_streak;
  NEW.last_practice_date := OLD.last_practice_date;
  NEW.unlocked_conversations := OLD.unlocked_conversations;
  NEW.mastered_count := OLD.mastered_count;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_progression() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_progression_trg ON public.profiles;
CREATE TRIGGER protect_profile_progression_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_progression();

-- Re-assert column-scoped UPDATE on profiles (defensive).
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
  onboarding_completed,
  last_sent_variant_id
) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;