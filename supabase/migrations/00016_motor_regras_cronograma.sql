-- ============================================
-- 00016: Motor de Regras — Cronograma Dinâmico
-- ============================================

-- 1. Nova coluna tipo_prazo em cronograma_atividades
ALTER TABLE cronograma_atividades ADD COLUMN IF NOT EXISTS tipo_prazo TEXT DEFAULT 'fixo'
  CHECK (tipo_prazo IN ('fixo','variavel_por_modalidade','indeterminado'));
ALTER TABLE cronograma_atividades ADD COLUMN IF NOT EXISTS regra_prazo JSONB;
ALTER TABLE cronograma_atividades ADD COLUMN IF NOT EXISTS tolerancia_atraso_dias INT DEFAULT 0;
ALTER TABLE cronograma_atividades ADD COLUMN IF NOT EXISTS overridden BOOLEAN DEFAULT false;
ALTER TABLE cronograma_atividades ADD COLUMN IF NOT EXISTS data_inicio_original DATE;
ALTER TABLE cronograma_atividades ADD COLUMN IF NOT EXISTS data_fim_original DATE;
ALTER TABLE cronograma_atividades ADD COLUMN IF NOT EXISTS justificativa_override TEXT;
ALTER TABLE cronograma_atividades ADD COLUMN IF NOT EXISTS dias_uteis_efetivos INT;

-- 2. Tabela de template por modalidade
CREATE TABLE IF NOT EXISTS modalidade_cronograma_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modalidade_id UUID NOT NULL REFERENCES modalidades(id) ON DELETE CASCADE,
  ordem INT NOT NULL CHECK (ordem > 0),
  fase TEXT NOT NULL,
  descricao TEXT NOT NULL,
  setor TEXT NOT NULL,
  dias_uteis INT NOT NULL DEFAULT 0,
  tipo_prazo TEXT NOT NULL DEFAULT 'fixo'
    CHECK (tipo_prazo IN ('fixo','variavel_por_modalidade','indeterminado')),
  regra_prazo JSONB,
  tolerancia_atraso_dias INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (modalidade_id, ordem)
);

-- 3. Tabela de override com auditoria
CREATE TABLE IF NOT EXISTS cronograma_override_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  cronograma_atividade_id UUID NOT NULL REFERENCES cronograma_atividades(id) ON DELETE CASCADE,
  campo_alterado TEXT NOT NULL,
  valor_anterior JSONB NOT NULL,
  valor_novo JSONB NOT NULL,
  justificativa TEXT NOT NULL CHECK (justificativa <> ''),
  alterado_por UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_override_log_processo ON cronograma_override_log(processo_id, created_at DESC);

-- 4. View de vencimentos próximos
CREATE OR REPLACE VIEW vw_vencimentos_proximos AS
SELECT
  p.id AS processo_id,
  p.id_processo,
  ca.id AS atividade_id,
  ca.descricao AS atividade,
  ca.fase,
  ca.data_fim,
  ca.data_fim - CURRENT_DATE AS dias_restantes,
  ca.ordem,
  CASE
    WHEN ca.data_fim < CURRENT_DATE AND ca.status != 'concluido' THEN 'atrasado'
    WHEN ca.data_fim <= CURRENT_DATE + 3 AND ca.status != 'concluido' THEN 'proximo_vencimento'
    ELSE 'normal'
  END AS alerta
FROM cronograma_atividades ca
JOIN processos p ON p.id = ca.processo_id
WHERE ca.status != 'concluido'
  AND (ca.data_fim IS NOT NULL AND ca.data_fim <= CURRENT_DATE + 3);

-- 5. Função de recálculo em cascata
CREATE OR REPLACE FUNCTION recalcular_cronograma_dinamico(p_processo_id UUID)
RETURNS void AS $$
DECLARE
  v_modalidade_nome TEXT;
  v_atividade RECORD;
  v_data_corrente DATE;
  v_data_fim_calc DATE;
  v_dias INT;
  v_regra JSONB;
BEGIN
  -- Obtém modalidade do processo
  SELECT m.nome INTO v_modalidade_nome
  FROM processos p
  JOIN modalidades m ON m.id = p.modalidade_id
  WHERE p.id = p_processo_id;

  -- Encontra a primeira atividade não concluída para começar
  SELECT data_inicio, data_inicio_real
  INTO v_data_corrente, v_data_fim_calc
  FROM cronograma_atividades
  WHERE processo_id = p_processo_id AND status != 'concluido'
  ORDER BY ordem LIMIT 1;

  IF v_data_corrente IS NULL THEN RETURN; END IF;

  -- Usa data_inicio_real se disponível
  IF v_data_fim_calc IS NOT NULL THEN
    v_data_corrente := v_data_fim_calc;
  END IF;

  FOR v_atividade IN
    SELECT ca.id, ca.ordem, ca.dias_uteis, ca.tipo_prazo, ca.regra_prazo,
           ca.overridden, ca.status, ca.data_fim_real,
           ca.data_inicio_real
    FROM cronograma_atividades ca
    WHERE ca.processo_id = p_processo_id
    ORDER BY ca.ordem
  LOOP
    CONTINUE WHEN v_atividade.status = 'concluido' AND v_atividade.data_fim_real IS NOT NULL;

    -- Determina dias úteis
    v_dias := v_atividade.dias_uteis;

    IF v_atividade.tipo_prazo = 'variavel_por_modalidade' AND NOT v_atividade.overridden THEN
      v_regra := v_atividade.regra_prazo;
      IF v_regra ? 'modalidade_map' AND v_regra ? v_modalidade_nome THEN
        v_dias := (v_regra->>v_modalidade_nome)::INT;
      ELSIF v_regra ? 'base' THEN
        v_dias := (v_regra->>'base')::INT;
      END IF;
    END IF;

    -- Indeterminado
    IF v_atividade.tipo_prazo = 'indeterminado' THEN
      UPDATE cronograma_atividades
      SET data_fim = NULL, dias_uteis_efetivos = NULL
      WHERE id = v_atividade.id;
      CONTINUE;
    END IF;

    -- Override de data_inicio
    IF v_atividade.data_inicio_real IS NOT NULL THEN
      v_data_corrente := v_atividade.data_inicio_real;
    END IF;

    -- Calcula
    IF v_dias > 0 THEN
      v_data_fim_calc := somar_dias_uteis(v_data_corrente, v_dias);
    ELSE
      v_data_fim_calc := v_data_corrente;
    END IF;

    UPDATE cronograma_atividades
    SET data_inicio = v_data_corrente,
        data_fim = v_data_fim_calc,
        dias_uteis_efetivos = v_dias
    WHERE id = v_atividade.id AND status != 'concluido';

    v_data_corrente := v_data_fim_calc + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
