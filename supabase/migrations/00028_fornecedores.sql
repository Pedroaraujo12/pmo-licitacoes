-- Módulo Fornecedores
-- Extrai dados de fornecedores dos contratos para visualização consolidada.

-- Tabela opcional para dados complementares de fornecedores (quando houver necessidade)
CREATE TABLE IF NOT EXISTS fornecedores (
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

CREATE INDEX IF NOT EXISTS idx_fornecedores_nome ON fornecedores(nome);
CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj ON fornecedores(cnpj);

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fornecedores SELECT autenticados"
  ON fornecedores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Fornecedores INSERT admin_gestor"
  ON fornecedores FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'gestor'));

CREATE POLICY "Fornecedores UPDATE admin_gestor"
  ON fornecedores FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'gestor'));

CREATE POLICY "Fornecedores DELETE admin"
  ON fornecedores FOR DELETE
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE OR REPLACE FUNCTION get_fornecedores_list()
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
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
    FROM contratos c
    WHERE c.contratada_nome IS NOT NULL AND c.contratada_nome != ''
    GROUP BY c.contratada_nome, c.contratada_cnpj, c.contratada_representante, c.contratada_email, c.contratada_telefone
    HAVING COUNT(*) > 0
  ) fornecedores_data;
$$;

CREATE OR REPLACE FUNCTION get_fornecedor_contratos(p_nome text)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT COALESCE(json_agg(contratos ORDER BY created_at DESC), '[]'::json)
  FROM (
    SELECT
      id, numero_contrato, objeto, valor_atual, valor_executado, status,
      data_inicio_vigencia, data_fim_vigencia
    FROM contratos
    WHERE contratada_nome = p_nome
  ) contratos;
$$;
