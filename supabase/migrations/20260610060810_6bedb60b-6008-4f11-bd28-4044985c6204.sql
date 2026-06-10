
CREATE TABLE public.user_search_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, song_id)
);

CREATE INDEX user_search_history_user_viewed_idx
  ON public.user_search_history (user_id, viewed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_search_history TO authenticated;
GRANT ALL ON public.user_search_history TO service_role;

ALTER TABLE public.user_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own search history"
  ON public.user_search_history
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
