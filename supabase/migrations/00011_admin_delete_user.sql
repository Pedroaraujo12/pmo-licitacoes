-- ============================================
-- RPC function for admin to delete a user
-- SECURITY DEFINER so it runs with owner privileges
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_delete_user(user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;
