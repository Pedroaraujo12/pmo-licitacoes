-- 1. Replace responsaveis with correct names
DELETE FROM responsaveis;

INSERT INTO responsaveis (nome) VALUES ('Bárbara');
INSERT INTO responsaveis (nome) VALUES ('Thiago');
INSERT INTO responsaveis (nome) VALUES ('Viviane');
INSERT INTO responsaveis (nome) VALUES ('Guilherme');
INSERT INTO responsaveis (nome) VALUES ('Ilma');

-- 2. Add UNIQUE constraint on id_processo
ALTER TABLE processos ADD CONSTRAINT processos_id_processo_key UNIQUE (id_processo);

-- 3. Create a function to get responsavel_id by name
CREATE OR REPLACE FUNCTION get_responsavel_id(p_nome text)
RETURNS uuid AS $$
  SELECT id FROM responsaveis WHERE nome = p_nome LIMIT 1;
$$ LANGUAGE sql STABLE;

-- 4. Migrate licitacoes data into processos (ON CONFLICT DO NOTHING to skip existing)
INSERT INTO processos (
  id_processo, objeto_resumido, data_entrada, data_entrega,
  valor_estimado, valor_homologado, progresso, prioridade, observacoes,
  drive, atividade_atual, responsavel_id
)
SELECT
  l.id_processo,
  l.objeto_resumido,
  l.data_entrada::date,
  l.data_prevista::date,
  l.vlr_estimado_anual,
  l.vlr_homologado,
  l.progresso,
  l.prioridade,
  l.observacoes,
  l.processo_link,
  l.fase_atual,
  get_responsavel_id(l.responsavel)
FROM licitacoes l
WHERE l.id_processo IS NOT NULL
ON CONFLICT (id_processo) DO NOTHING;

-- 5. Insert licitacoes without id_processo using their UUID as a generated ID
INSERT INTO processos (
  id_processo, objeto_resumido, data_entrada, data_entrega,
  valor_estimado, valor_homologado, progresso, prioridade, observacoes,
  drive, atividade_atual, responsavel_id
)
SELECT
  'LIC-' || SUBSTRING(l.id::text, 1, 8),
  l.objeto_resumido,
  l.data_entrada::date,
  l.data_prevista::date,
  l.vlr_estimado_anual,
  l.vlr_homologado,
  l.progresso,
  l.prioridade,
  l.observacoes,
  l.processo_link,
  l.fase_atual,
  get_responsavel_id(l.responsavel)
FROM licitacoes l
WHERE l.id_processo IS NULL
ON CONFLICT (id_processo) DO NOTHING;

-- 6. Verify
SELECT COUNT(*) AS total_processos FROM processos;
SELECT id_processo, responsaveis.nome AS responsavel
FROM processos
LEFT JOIN responsaveis ON processos.responsavel_id = responsaveis.id
ORDER BY id_processo;
