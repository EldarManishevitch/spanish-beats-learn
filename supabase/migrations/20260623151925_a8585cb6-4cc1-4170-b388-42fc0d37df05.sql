
CREATE OR REPLACE FUNCTION public.enforce_vocab_mastery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.fail_count := GREATEST(COALESCE(NEW.fail_count, 0), 0);
  NEW.correct_count := GREATEST(COALESCE(NEW.correct_count, 0), 0);
  NEW.is_mastered := (NEW.correct_count >= 3 AND NEW.fail_count = 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_vocab_mastery_ins ON public.user_vocab_stats;
DROP TRIGGER IF EXISTS enforce_vocab_mastery_upd ON public.user_vocab_stats;

CREATE TRIGGER enforce_vocab_mastery_ins
BEFORE INSERT ON public.user_vocab_stats
FOR EACH ROW EXECUTE FUNCTION public.enforce_vocab_mastery();

CREATE TRIGGER enforce_vocab_mastery_upd
BEFORE UPDATE ON public.user_vocab_stats
FOR EACH ROW EXECUTE FUNCTION public.enforce_vocab_mastery();

-- Re-baseline existing rows so any previously-injected mastery is recomputed from real counters.
UPDATE public.user_vocab_stats
SET is_mastered = (correct_count >= 3 AND fail_count = 0)
WHERE is_mastered IS DISTINCT FROM (correct_count >= 3 AND fail_count = 0);
