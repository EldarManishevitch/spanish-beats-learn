CREATE OR REPLACE FUNCTION public.recompute_cefr(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mastered int;
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

  SELECT cefr_level, unlocked_conversations
    INTO v_old_tier, v_old_unlock
    FROM public.profiles WHERE id = p_user_id;

  -- Tiers derived only from server-validated mastered_count to prevent
  -- client-forged quiz_attempts from inflating progression.
  v_new_tier := CASE
    WHEN v_mastered > 300 THEN 'B1'
    WHEN v_mastered >= 100 THEN 'A2'
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
    'cefr_level', v_new_tier,
    'unlocked_conversations', (v_new_unlock OR COALESCE(v_old_unlock, false)),
    'tier_changed', v_new_tier IS DISTINCT FROM v_old_tier,
    'unlock_changed', (v_new_unlock AND NOT COALESCE(v_old_unlock, false))
  );
END;
$function$;