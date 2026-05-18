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
