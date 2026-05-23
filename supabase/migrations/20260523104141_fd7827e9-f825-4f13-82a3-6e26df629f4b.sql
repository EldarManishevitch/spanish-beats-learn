-- Restrict EXECUTE on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_cefr(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_cefr(uuid) TO authenticated;