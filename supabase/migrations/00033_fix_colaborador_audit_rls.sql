-- Ensure colaborador audit logging never blocks valid colaborador writes.
-- The trigger runs as a definer-owned function so it can insert the audit row
-- while RLS on colaborador_logs still restricts direct client access.

CREATE OR REPLACE FUNCTION public.audit_colaborador_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(NEW.updated_by, NEW.created_by, auth.uid());

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.colaborador_logs (colaborador_id, acao, user_id, dados_novos)
    VALUES (NEW.id, 'criou', v_user_id, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.colaborador_logs (colaborador_id, acao, user_id, dados_anteriores, dados_novos)
    VALUES (NEW.id, 'editou', v_user_id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_colaborador_changes() FROM PUBLIC;
