-- Fix PostgREST relationship names to match the queries
-- The queries use singular names (coordenacao, status, responsavel, etc.)
-- but tables are plural (coordenacoes, status_processo, responsaveis, etc.)
-- PostgREST names relationships after the referenced table by default.
-- These @name comments override the default relationship names.

COMMENT ON CONSTRAINT processos_coordenacao_id_fkey ON processos IS E'@name coordenacao';
COMMENT ON CONSTRAINT processos_status_id_fkey ON processos IS E'@name status';
COMMENT ON CONSTRAINT processos_responsavel_id_fkey ON processos IS E'@name responsavel';
COMMENT ON CONSTRAINT processos_demandante_id_fkey ON processos IS E'@name demandante';
COMMENT ON CONSTRAINT processos_modalidade_id_fkey ON processos IS E'@name modalidade';

-- Refresh the schema cache so PostgREST picks up the new names
NOTIFY pgrst, 'reload schema';

-- Fix trigger function to handle NULL data_entrada (avoid infinite loop in somar_dias_uteis)
CREATE OR REPLACE FUNCTION trigger_criar_cronograma()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM criar_cronograma_para_processo(NEW.id, COALESCE(NEW.data_entrada, CURRENT_DATE));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add UNIQUE constraint on id_processo
ALTER TABLE processos ADD CONSTRAINT processos_id_processo_key UNIQUE (id_processo);

-- Create a function to get responsavel_id by name
CREATE OR REPLACE FUNCTION get_responsavel_id(p_nome text)
RETURNS uuid AS $$
  SELECT id FROM responsaveis WHERE nome = p_nome LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Migrate licitacoes data into processos (only columns that exist in licitacoes)
INSERT INTO processos (
  id_processo, objeto_resumido, data_entrada, data_entrega,
  valor_estimado, valor_homologado, responsavel_id
)
SELECT
  l.id_processo,
  l.objeto_resumido,
  COALESCE(l.data_entrada::date, CURRENT_DATE),
  l.data_prevista::date,
  l.vlr_estimado_anual,
  l.vlr_homologado,
  get_responsavel_id(l.responsavel)
FROM licitacoes l
WHERE l.id_processo IS NOT NULL
ON CONFLICT (id_processo) DO NOTHING;
