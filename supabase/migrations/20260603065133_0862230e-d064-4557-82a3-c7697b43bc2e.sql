ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_practice_date date;

CREATE OR REPLACE FUNCTION public.touch_streak(p_tz text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date;
  v_last date;
  v_current int;
  v_longest int;
  v_changed boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  BEGIN
    v_today := (now() AT TIME ZONE p_tz)::date;
  EXCEPTION WHEN OTHERS THEN
    v_today := (now() AT TIME ZONE 'UTC')::date;
  END;

  SELECT last_practice_date, current_streak, longest_streak
    INTO v_last, v_current, v_longest
    FROM public.profiles WHERE id = v_uid;

  IF v_last = v_today THEN
    -- no-op
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
    WHERE id = v_uid;

  RETURN jsonb_build_object(
    'current_streak', v_current,
    'longest_streak', v_longest,
    'last_practice_date', v_today,
    'changed', v_changed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_streak(text) TO authenticated;