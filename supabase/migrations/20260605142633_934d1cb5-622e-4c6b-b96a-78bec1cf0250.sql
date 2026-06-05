-- Recreate touch_streak so it takes an explicit user id and no longer depends on auth.uid().
-- It will be invoked exclusively by the `touch-streak` edge function using the service role.
DROP FUNCTION IF EXISTS public.touch_streak(text);
DROP FUNCTION IF EXISTS public.touch_streak(uuid, text);

CREATE OR REPLACE FUNCTION public.touch_streak(p_user_id uuid, p_tz text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date;
  v_last date;
  v_current int;
  v_longest int;
  v_changed boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user id required';
  END IF;

  BEGIN
    v_today := (now() AT TIME ZONE p_tz)::date;
  EXCEPTION WHEN OTHERS THEN
    v_today := (now() AT TIME ZONE 'UTC')::date;
  END;

  SELECT last_practice_date, current_streak, longest_streak
    INTO v_last, v_current, v_longest
    FROM public.profiles WHERE id = p_user_id;

  IF v_last = v_today THEN
    NULL;
  ELSIF v_last = v_today - INTERVAL '1 day' THEN
    v_current := COALESCE(v_current, 0) + 1;
    v_changed := true;
  ELSE
    v_current := 1;
    v_changed := true;
  END IF;

  IF v_current > COALESCE(v_longest, 0) THEN
    v_longest := v_current;
  END IF;

  UPDATE public.profiles
    SET current_streak = v_current,
        longest_streak = v_longest,
        last_practice_date = v_today,
        updated_at = now()
    WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'current_streak', v_current,
    'longest_streak', v_longest,
    'last_practice_date', v_today,
    'changed', v_changed
  );
END;
$function$;

-- Lock down execute privileges. Only service_role (used by edge functions) may call it.
REVOKE ALL ON FUNCTION public.touch_streak(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_streak(uuid, text) TO service_role;

-- recompute_cefr: drop the auth.uid() self-check; access is gated by EXECUTE privilege instead.
CREATE OR REPLACE FUNCTION public.recompute_cefr(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mastered int;
  v_accuracy numeric;
  v_old_tier text;
  v_old_unlock boolean;
  v_new_tier text;
  v_new_unlock boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user id required';
  END IF;

  SELECT count(*) INTO v_mastered
    FROM public.user_vocab_stats
    WHERE user_id = p_user_id AND is_mastered = true;

  SELECT COALESCE(avg(score::numeric / NULLIF(total,0)), 0) INTO v_accuracy
    FROM (
      SELECT score, total FROM public.quiz_attempts
        WHERE user_id = p_user_id
        ORDER BY completed_at DESC
        LIMIT 20
    ) q;

  SELECT cefr_level, unlocked_conversations
    INTO v_old_tier, v_old_unlock
    FROM public.profiles WHERE id = p_user_id;

  v_new_tier := CASE
    WHEN v_mastered > 300 THEN 'B1'
    WHEN v_mastered >= 100 AND v_accuracy >= 0.8 THEN 'A2'
    ELSE 'A1'
  END;

  v_new_unlock := v_mastered >= 50;

  UPDATE public.profiles
    SET mastered_count = v_mastered,
        cefr_level = v_new_tier,
        unlocked_conversations = v_new_unlock OR unlocked_conversations,
        updated_at = now()
    WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'mastered_count', v_mastered,
    'accuracy', v_accuracy,
    'cefr_level', v_new_tier,
    'unlocked_conversations', (v_new_unlock OR COALESCE(v_old_unlock, false)),
    'tier_changed', v_new_tier IS DISTINCT FROM v_old_tier,
    'unlock_changed', (v_new_unlock AND NOT COALESCE(v_old_unlock, false))
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.recompute_cefr(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_cefr(uuid) TO service_role;