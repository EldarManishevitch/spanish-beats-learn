
CREATE OR REPLACE FUNCTION public.recompute_cefr(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mastered int;
  v_accuracy numeric;
  v_old_tier text;
  v_old_unlock boolean;
  v_new_tier text;
  v_new_unlock boolean;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not authorized';
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
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_cefr(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_cefr(uuid) TO authenticated;
