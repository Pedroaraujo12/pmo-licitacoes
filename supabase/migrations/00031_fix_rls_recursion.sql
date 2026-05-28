-- ============================================================
-- Fix RLS infinite recursion on profiles + contratos
-- 
-- Problema:
--   contratos_write era FOR ALL (incluindo SELECT), e sua
--   subconsulta a profiles disparava RLS em profiles, que
--   por sua vez chamava funções que consultavam profiles
--   novamente, gerando recursão infinita.
--
-- Solução:
--   1) Remove políticas FOR ALL de contratos (que são avaliadas
--      até mesmo em SELECT, causando a recursão)
--   2) Cria políticas separadas FOR INSERT / UPDATE / DELETE
--      usando current_user_is_admin() (SECURITY DEFINER) em
--      vez de subconsultas diretas a profiles
--   3) Remove políticas antigas de profiles que usam is_admin()
--      e mantém apenas profiles_select(auth.role() = authenticated)
--   4) Garante que current_user_is_admin() é SECURITY DEFINER
-- ============================================================

-- 1. Remove FOR ALL policies on contratos (causam recursão)
DROP POLICY IF EXISTS contratos_write ON contratos;
DROP POLICY IF EXISTS os_write ON ordens_servico;
DROP POLICY IF EXISTS aditivos_write ON contrato_aditivos;
DROP POLICY IF EXISTS medicoes_write ON contrato_medicoes;
DROP POLICY IF EXISTS pagamentos_write ON contrato_pagamentos;
DROP POLICY IF EXISTS contrato_docs_write ON contrato_documentos;
DROP POLICY IF EXISTS document_templates_write ON document_templates;
DROP POLICY IF EXISTS template_versions_write ON template_versions;
DROP POLICY IF EXISTS colaboradores_write ON colaboradores;
DROP POLICY IF EXISTS colaborador_logs_select ON colaborador_logs;

-- 2. Cria políticas separadas usando current_user_is_admin()
-- contratos
CREATE POLICY contratos_insert ON contratos FOR INSERT WITH CHECK (
  public.current_user_is_admin()
);
CREATE POLICY contratos_update ON contratos FOR UPDATE USING (
  public.current_user_is_admin()
);
CREATE POLICY contratos_delete ON contratos FOR DELETE USING (
  public.current_user_is_admin()
);

-- ordens_servico
CREATE POLICY os_insert ON ordens_servico FOR INSERT WITH CHECK (
  public.current_user_is_admin()
);
CREATE POLICY os_update ON ordens_servico FOR UPDATE USING (
  public.current_user_is_admin()
);
CREATE POLICY os_delete ON ordens_servico FOR DELETE USING (
  public.current_user_is_admin()
);

-- contrato_aditivos
CREATE POLICY aditivos_insert ON contrato_aditivos FOR INSERT WITH CHECK (
  public.current_user_is_admin()
);
CREATE POLICY aditivos_update ON contrato_aditivos FOR UPDATE USING (
  public.current_user_is_admin()
);
CREATE POLICY aditivos_delete ON contrato_aditivos FOR DELETE USING (
  public.current_user_is_admin()
);

-- contrato_medicoes
CREATE POLICY medicoes_insert ON contrato_medicoes FOR INSERT WITH CHECK (
  public.current_user_is_admin()
);
CREATE POLICY medicoes_update ON contrato_medicoes FOR UPDATE USING (
  public.current_user_is_admin()
);
CREATE POLICY medicoes_delete ON contrato_medicoes FOR DELETE USING (
  public.current_user_is_admin()
);

-- contrato_pagamentos
CREATE POLICY pagamentos_insert ON contrato_pagamentos FOR INSERT WITH CHECK (
  public.current_user_is_admin()
);
CREATE POLICY pagamentos_update ON contrato_pagamentos FOR UPDATE USING (
  public.current_user_is_admin()
);
CREATE POLICY pagamentos_delete ON contrato_pagamentos FOR DELETE USING (
  public.current_user_is_admin()
);

-- contrato_documentos
CREATE POLICY contrato_docs_insert ON contrato_documentos FOR INSERT WITH CHECK (
  public.current_user_is_admin()
);
CREATE POLICY contrato_docs_update ON contrato_documentos FOR UPDATE USING (
  public.current_user_is_admin()
);
CREATE POLICY contrato_docs_delete ON contrato_documentos FOR DELETE USING (
  public.current_user_is_admin()
);

-- document_templates
CREATE POLICY document_templates_insert ON document_templates FOR INSERT WITH CHECK (
  public.current_user_is_admin()
);
CREATE POLICY document_templates_update ON document_templates FOR UPDATE USING (
  public.current_user_is_admin()
);
CREATE POLICY document_templates_delete ON document_templates FOR DELETE USING (
  public.current_user_is_admin()
);

-- template_versions
CREATE POLICY template_versions_insert ON template_versions FOR INSERT WITH CHECK (
  public.current_user_is_admin()
);
CREATE POLICY template_versions_update ON template_versions FOR UPDATE USING (
  public.current_user_is_admin()
);
CREATE POLICY template_versions_delete ON template_versions FOR DELETE USING (
  public.current_user_is_admin()
);

-- colaboradores
CREATE POLICY colaboradores_insert ON colaboradores FOR INSERT WITH CHECK (
  public.current_user_is_admin()
);
CREATE POLICY colaboradores_update ON colaboradores FOR UPDATE USING (
  public.current_user_is_admin()
);
CREATE POLICY colaboradores_delete ON colaboradores FOR DELETE USING (
  public.current_user_is_admin()
);

-- colaborador_logs
CREATE POLICY colaborador_logs_select ON colaborador_logs FOR SELECT USING (
  public.current_user_is_admin()
);

-- 3. Remove políticas antigas de profiles que são inseguras
-- (profiles_select existente de 00030 com auth.role() = 'authenticated' é mantida)
DROP POLICY IF EXISTS "Admins podem atualizar perfis" ON profiles;

-- 4. Garante current_user_is_admin SECURITY DEFINER
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
