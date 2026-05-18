-- ============================================
-- Fix handle_new_user trigger function
-- Issue: migration 00005 used 'email' column (doesn't exist)
--        and 'membro' (invalid user_role enum value)
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'visualizador')
  );
  RETURN NEW;
END;
$$;
