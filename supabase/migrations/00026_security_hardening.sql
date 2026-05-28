-- Hardening for user-management and profile authorization.
-- Apply with an owner/service_role connection.

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'name', ''), NEW.email),
    NEW.email,
    'visualizador'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    email = COALESCE(EXCLUDED.email, public.profiles.email);

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Admins e gestores podem atualizar perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem atualizar perfis" ON public.profiles;

CREATE POLICY "Admins podem atualizar perfis"
  ON public.profiles FOR UPDATE
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

CREATE OR REPLACE FUNCTION public.list_users_with_email()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Acesso negado'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    COALESCE(p.email, au.email) AS email,
    p.role::text AS role,
    p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_users_with_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_users_with_email() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_user(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Acesso negado'
      USING ERRCODE = '42501';
  END IF;

  IF user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é permitido excluir o próprio usuário'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_email(user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF user_id <> auth.uid() AND NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Acesso negado'
      USING ERRCODE = '42501';
  END IF;

  RETURN (SELECT email FROM auth.users WHERE id = user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_email(uuid) TO authenticated;
