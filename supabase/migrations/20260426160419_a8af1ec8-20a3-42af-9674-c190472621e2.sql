ALTER TABLE public.songs DROP CONSTRAINT IF EXISTS songs_genre_check;
ALTER TABLE public.songs ADD CONSTRAINT songs_genre_check
  CHECK (genre IN ('reggaeton','bachata','pop latino','trap latino','merengue','salsa','rock latino'));