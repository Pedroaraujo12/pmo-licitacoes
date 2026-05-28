-- Restore role-based write policies without recursive profile lookups.

CREATE OR REPLACE FUNCTION public.current_user_has_role(allowed_roles text[])
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
      AND role::text = ANY(allowed_roles)
  );
$$;
REVOKE ALL ON FUNCTION public.current_user_has_role(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_role(text[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_has_role(ARRAY['admin']);
$$;
REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
DROP POLICY IF EXISTS contratos_write ON public.contratos;
DROP POLICY IF EXISTS contratos_insert ON public.contratos;
DROP POLICY IF EXISTS contratos_update ON public.contratos;
DROP POLICY IF EXISTS contratos_delete ON public.contratos;
CREATE POLICY contratos_insert ON public.contratos FOR INSERT WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor']));
CREATE POLICY contratos_update ON public.contratos FOR UPDATE USING (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor'])) WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']));
CREATE POLICY contratos_delete ON public.contratos FOR DELETE USING (public.current_user_has_role(ARRAY['admin', 'gestor']));
DROP POLICY IF EXISTS os_write ON public.ordens_servico;
DROP POLICY IF EXISTS os_insert ON public.ordens_servico;
DROP POLICY IF EXISTS os_update ON public.ordens_servico;
DROP POLICY IF EXISTS os_delete ON public.ordens_servico;
CREATE POLICY os_insert ON public.ordens_servico FOR INSERT WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']));
CREATE POLICY os_update ON public.ordens_servico FOR UPDATE USING (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor'])) WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']));
CREATE POLICY os_delete ON public.ordens_servico FOR DELETE USING (public.current_user_has_role(ARRAY['admin', 'gestor']));
DROP POLICY IF EXISTS aditivos_write ON public.contrato_aditivos;
DROP POLICY IF EXISTS aditivos_insert ON public.contrato_aditivos;
DROP POLICY IF EXISTS aditivos_update ON public.contrato_aditivos;
DROP POLICY IF EXISTS aditivos_delete ON public.contrato_aditivos;
CREATE POLICY aditivos_insert ON public.contrato_aditivos FOR INSERT WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor']));
CREATE POLICY aditivos_update ON public.contrato_aditivos FOR UPDATE USING (public.current_user_has_role(ARRAY['admin', 'gestor'])) WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor']));
CREATE POLICY aditivos_delete ON public.contrato_aditivos FOR DELETE USING (public.current_user_has_role(ARRAY['admin', 'gestor']));
DROP POLICY IF EXISTS medicoes_write ON public.contrato_medicoes;
DROP POLICY IF EXISTS medicoes_insert ON public.contrato_medicoes;
DROP POLICY IF EXISTS medicoes_update ON public.contrato_medicoes;
DROP POLICY IF EXISTS medicoes_delete ON public.contrato_medicoes;
CREATE POLICY medicoes_insert ON public.contrato_medicoes FOR INSERT WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']));
CREATE POLICY medicoes_update ON public.contrato_medicoes FOR UPDATE USING (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor'])) WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']));
CREATE POLICY medicoes_delete ON public.contrato_medicoes FOR DELETE USING (public.current_user_has_role(ARRAY['admin', 'gestor']));
DROP POLICY IF EXISTS pagamentos_write ON public.contrato_pagamentos;
DROP POLICY IF EXISTS pagamentos_insert ON public.contrato_pagamentos;
DROP POLICY IF EXISTS pagamentos_update ON public.contrato_pagamentos;
DROP POLICY IF EXISTS pagamentos_delete ON public.contrato_pagamentos;
CREATE POLICY pagamentos_insert ON public.contrato_pagamentos FOR INSERT WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']));
CREATE POLICY pagamentos_update ON public.contrato_pagamentos FOR UPDATE USING (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor'])) WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']));
CREATE POLICY pagamentos_delete ON public.contrato_pagamentos FOR DELETE USING (public.current_user_has_role(ARRAY['admin', 'gestor']));
DROP POLICY IF EXISTS contrato_docs_write ON public.contrato_documentos;
DROP POLICY IF EXISTS docs_insert ON public.contrato_documentos;
DROP POLICY IF EXISTS docs_update ON public.contrato_documentos;
DROP POLICY IF EXISTS docs_delete ON public.contrato_documentos;
DROP POLICY IF EXISTS contrato_docs_insert ON public.contrato_documentos;
DROP POLICY IF EXISTS contrato_docs_update ON public.contrato_documentos;
DROP POLICY IF EXISTS contrato_docs_delete ON public.contrato_documentos;
CREATE POLICY contrato_docs_insert ON public.contrato_documentos FOR INSERT WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']));
CREATE POLICY contrato_docs_update ON public.contrato_documentos FOR UPDATE USING (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor'])) WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']));
CREATE POLICY contrato_docs_delete ON public.contrato_documentos FOR DELETE USING (public.current_user_has_role(ARRAY['admin', 'gestor']));
DROP POLICY IF EXISTS document_templates_write ON public.document_templates;
DROP POLICY IF EXISTS document_templates_insert ON public.document_templates;
DROP POLICY IF EXISTS document_templates_update ON public.document_templates;
DROP POLICY IF EXISTS document_templates_delete ON public.document_templates;
CREATE POLICY document_templates_insert ON public.document_templates FOR INSERT WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor']));
CREATE POLICY document_templates_update ON public.document_templates FOR UPDATE USING (public.current_user_has_role(ARRAY['admin', 'gestor'])) WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor']));
CREATE POLICY document_templates_delete ON public.document_templates FOR DELETE USING (public.current_user_has_role(ARRAY['admin', 'gestor']));
DROP POLICY IF EXISTS template_versions_write ON public.template_versions;
DROP POLICY IF EXISTS template_versions_insert ON public.template_versions;
DROP POLICY IF EXISTS template_versions_update ON public.template_versions;
DROP POLICY IF EXISTS template_versions_delete ON public.template_versions;
CREATE POLICY template_versions_insert ON public.template_versions FOR INSERT WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor']));
CREATE POLICY template_versions_update ON public.template_versions FOR UPDATE USING (public.current_user_has_role(ARRAY['admin', 'gestor'])) WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor']));
CREATE POLICY template_versions_delete ON public.template_versions FOR DELETE USING (public.current_user_has_role(ARRAY['admin', 'gestor']));
DROP POLICY IF EXISTS colaboradores_write ON public.colaboradores;
DROP POLICY IF EXISTS colaboradores_insert ON public.colaboradores;
DROP POLICY IF EXISTS colaboradores_update ON public.colaboradores;
DROP POLICY IF EXISTS colaboradores_delete ON public.colaboradores;
CREATE POLICY colaboradores_insert ON public.colaboradores FOR INSERT WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor']));
CREATE POLICY colaboradores_update ON public.colaboradores FOR UPDATE USING (public.current_user_has_role(ARRAY['admin', 'gestor'])) WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor']));
CREATE POLICY colaboradores_delete ON public.colaboradores FOR DELETE USING (public.current_user_has_role(ARRAY['admin', 'gestor']));
DROP POLICY IF EXISTS colaborador_logs_select ON public.colaborador_logs;
CREATE POLICY colaborador_logs_select ON public.colaborador_logs FOR SELECT USING (public.current_user_has_role(ARRAY['admin', 'gestor']));
DROP POLICY IF EXISTS "Admins podem atualizar perfis" ON public.profiles;
CREATE POLICY "Admins podem atualizar perfis" ON public.profiles FOR UPDATE
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  cnpj text,
  representante text,
  email text,
  telefone text,
  endereco text,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fornecedores_nome ON public.fornecedores(nome);
CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj ON public.fornecedores(cnpj);
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Fornecedores SELECT autenticados" ON public.fornecedores;
DROP POLICY IF EXISTS "Fornecedores INSERT admin_gestor" ON public.fornecedores;
DROP POLICY IF EXISTS "Fornecedores UPDATE admin_gestor" ON public.fornecedores;
DROP POLICY IF EXISTS "Fornecedores DELETE admin" ON public.fornecedores;
CREATE POLICY "Fornecedores SELECT autenticados" ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Fornecedores INSERT admin_gestor" ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor']));
CREATE POLICY "Fornecedores UPDATE admin_gestor" ON public.fornecedores FOR UPDATE TO authenticated USING (public.current_user_has_role(ARRAY['admin', 'gestor'])) WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor']));
CREATE POLICY "Fornecedores DELETE admin" ON public.fornecedores FOR DELETE TO authenticated USING (public.current_user_is_admin());
CREATE OR REPLACE FUNCTION public.get_fornecedores_list()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(fornecedores_data ORDER BY nome), '[]'::json)
  FROM (
    SELECT
      c.contratada_nome AS nome,
      c.contratada_cnpj AS cnpj,
      c.contratada_representante AS representante,
      c.contratada_email AS email,
      c.contratada_telefone AS telefone,
      COUNT(*)::int AS total_contratos,
      COALESCE(SUM(c.valor_atual), 0) AS valor_total,
      COALESCE(SUM(c.valor_executado), 0) AS valor_executado,
      MIN(c.data_inicio_vigencia) AS primeiro_contrato,
      MAX(c.data_fim_vigencia) AS ultimo_vencimento
    FROM public.contratos c
    WHERE c.contratada_nome IS NOT NULL AND c.contratada_nome <> ''
    GROUP BY c.contratada_nome, c.contratada_cnpj, c.contratada_representante, c.contratada_email, c.contratada_telefone
  ) fornecedores_data;
$$;
CREATE OR REPLACE FUNCTION public.get_fornecedor_contratos(p_nome text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(contratos ORDER BY created_at DESC), '[]'::json)
  FROM (
    SELECT
      id, numero_contrato, objeto, valor_atual, valor_executado, status,
      data_inicio_vigencia, data_fim_vigencia, created_at
    FROM public.contratos
    WHERE contratada_nome = p_nome
  ) contratos;
$$;
REVOKE ALL ON FUNCTION public.get_fornecedores_list() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_fornecedor_contratos(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fornecedores_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fornecedor_contratos(text) TO authenticated;
