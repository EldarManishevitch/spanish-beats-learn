
-- 1. user_vocab_stats
CREATE TABLE public.user_vocab_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  word text NOT NULL,
  fail_count int NOT NULL DEFAULT 0,
  correct_count int NOT NULL DEFAULT 0,
  is_mastered boolean NOT NULL DEFAULT false,
  last_reviewed timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, word)
);

CREATE INDEX idx_user_vocab_stats_user ON public.user_vocab_stats(user_id);
CREATE INDEX idx_user_vocab_stats_review ON public.user_vocab_stats(user_id, fail_count) WHERE is_mastered = false;

ALTER TABLE public.user_vocab_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own vocab stats" ON public.user_vocab_stats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own vocab stats" ON public.user_vocab_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own vocab stats" ON public.user_vocab_stats
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own vocab stats" ON public.user_vocab_stats
  FOR DELETE USING (auth.uid() = user_id);

-- 2. daily_phrases_cache
CREATE TABLE public.daily_phrases_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.daily_phrases_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own phrases cache" ON public.daily_phrases_cache
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own phrases cache" ON public.daily_phrases_cache
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own phrases cache" ON public.daily_phrases_cache
  FOR UPDATE USING (auth.uid() = user_id);

-- 3. profiles additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cefr_level text NOT NULL DEFAULT 'A1',
  ADD COLUMN IF NOT EXISTS total_xp int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unlocked_conversations boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mastered_count int NOT NULL DEFAULT 0;

-- 4. recompute_cefr helper
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
