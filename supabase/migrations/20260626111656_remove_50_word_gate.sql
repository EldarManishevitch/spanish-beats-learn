-- Remove the 50-word mastery gate: unlocked_conversations is now always true.

UPDATE public.profiles SET unlocked_conversations = true WHERE unlocked_conversations = false;

ALTER TABLE public.profiles ALTER COLUMN unlocked_conversations SET DEFAULT true;

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

  UPDATE public.profiles
    SET mastered_count = v_mastered,
        cefr_level = v_new_tier,
        unlocked_conversations = true,
        updated_at = now()
    WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'mastered_count', v_mastered,
    'accuracy', v_accuracy,
    'cefr_level', v_new_tier,
    'unlocked_conversations', true,
    'tier_changed', v_new_tier IS DISTINCT FROM v_old_tier,
    'unlock_changed', false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_profile_progression()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  IF v_role = 'service_role' OR v_role IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.total_xp := OLD.total_xp;
  NEW.cefr_level := OLD.cefr_level;
  NEW.current_streak := OLD.current_streak;
  NEW.longest_streak := OLD.longest_streak;
  NEW.last_practice_date := OLD.last_practice_date;
  NEW.mastered_count := OLD.mastered_count;
  RETURN NEW;
END;
$$;
