-- ============================================
-- Cronograma de Atividades + Feriados
-- ============================================

-- 1. TABELA FERIADOS NACIONAIS
CREATE TABLE IF NOT EXISTS feriados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'nacional',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed: feriados nacionais (2026-2028)
INSERT INTO feriados (data, nome, tipo) VALUES
  ('2026-01-01', 'Confraternização Universal', 'nacional'),
  ('2026-02-17', 'Carnaval', 'nacional'),
  ('2026-02-18', 'Carnaval', 'nacional'),
  ('2026-04-03', 'Sexta-Feira Santa', 'nacional'),
  ('2026-04-21', 'Tiradentes', 'nacional'),
  ('2026-05-01', 'Dia do Trabalho', 'nacional'),
  ('2026-06-04', 'Corpus Christi', 'nacional'),
  ('2026-09-07', 'Independência do Brasil', 'nacional'),
  ('2026-10-12', 'Nossa Sra. Aparecida', 'nacional'),
  ('2026-11-02', 'Finados', 'nacional'),
  ('2026-11-15', 'Proclamação da República', 'nacional'),
  ('2026-12-25', 'Natal', 'nacional'),
  ('2027-01-01', 'Confraternização Universal', 'nacional'),
  ('2027-02-08', 'Carnaval', 'nacional'),
  ('2027-02-09', 'Carnaval', 'nacional'),
  ('2027-03-26', 'Sexta-Feira Santa', 'nacional'),
  ('2027-04-21', 'Tiradentes', 'nacional'),
  ('2027-05-01', 'Dia do Trabalho', 'nacional'),
  ('2027-06-17', 'Corpus Christi', 'nacional'),
  ('2027-09-07', 'Independência do Brasil', 'nacional'),
  ('2027-10-12', 'Nossa Sra. Aparecida', 'nacional'),
  ('2027-11-02', 'Finados', 'nacional'),
  ('2027-11-15', 'Proclamação da República', 'nacional'),
  ('2027-12-25', 'Natal', 'nacional')
ON CONFLICT (data) DO NOTHING;

ALTER TABLE feriados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver feriados"
  ON feriados FOR SELECT
  USING (true);

-- 2. TABELA CRONOGRAMA ATIVIDADES
CREATE TABLE IF NOT EXISTS cronograma_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  ordem INT NOT NULL,
  dias_uteis INT NOT NULL DEFAULT 0,
  fase TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL,
  setor TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'nao_iniciado',
  data_inicio DATE,
  data_fim DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cronograma_processo ON cronograma_atividades(processo_id);
CREATE INDEX idx_cronograma_ordem ON cronograma_atividades(processo_id, ordem);

ALTER TABLE cronograma_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver cronograma"
  ON cronograma_atividades FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários autenticados podem inserir cronograma"
  ON cronograma_atividades FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários autenticados podem atualizar cronograma"
  ON cronograma_atividades FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários autenticados podem deletar cronograma"
  ON cronograma_atividades FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()));

-- 3. FUNÇÃO: somar_dias_uteis
CREATE OR REPLACE FUNCTION somar_dias_uteis(data_inicio DATE, qtd_dias INT)
RETURNS DATE AS $$
DECLARE
  data_atual DATE := data_inicio;
  dias_contados INT := 0;
BEGIN
  IF qtd_dias <= 0 THEN
    RETURN data_inicio;
  END IF;

  LOOP
    IF EXTRACT(DOW FROM data_atual) NOT IN (0, 6)
       AND data_atual NOT IN (SELECT data FROM feriados) THEN
      dias_contados := dias_contados + 1;
      IF dias_contados >= qtd_dias THEN
        RETURN data_atual;
      END IF;
    END IF;
    data_atual := data_atual + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. FUNÇÃO: criar cronograma para um processo
CREATE OR REPLACE FUNCTION criar_cronograma_para_processo(p_processo_id UUID, p_data_inicio DATE)
RETURNS void AS $$
DECLARE
  atividade RECORD;
  data_atual DATE := p_data_inicio;
  data_fim_atividade DATE;
BEGIN
  DELETE FROM cronograma_atividades WHERE processo_id = p_processo_id;

  FOR atividade IN
    SELECT * FROM (VALUES
      (1, 3,  'Planejamento', 'Análise do Termo de Referência e anexos', 'UAC'),
      (2, 5,  'Produção',     'Pesquisa de Preços e levantamento do custo estimado da Contratação', 'UAC'),
      (3, 1,  'Produção',     'Relatório de Pesquisa Preços', 'UAC'),
      (4, 0,  'Análise',     'Disponibilidade orçamentária', 'UFOC'),
      (5, 1,  'Revisão',     'Designação da Comissão de Seleção', 'UAC'),
      (6, 5,  'Produção',     'Elaboração Da Minuta de Edital e Anexos. Envio à UJUR/AGSUS', 'UAC'),
      (7, 5,  'Análise',     'Análise jurídica e Emissão de Parecer', 'UJUR'),
      (8, 1,  'Produção',     'Adequações e atendimento ao Parecer Jurídico quanto aos aspectos técnicos do Edital e Anexos e Autorização de Governança publicação do Edital', 'NAAGE'),
      (9, 8,  'Produção',     'Publicação do Edital (prazos legais: 3 dias úteis - Cotação de Preços,  8 dias úteis - Pregão bens e materiais, 10 dias úteis - Pregão serviços e 15 dias úteis concorrência)', 'UAC'),
      (10, 1, 'Execução',     'Abertura e Fase de Lances', 'UAC'),
      (11, 8, 'Execução',     'Fase de Julgamento das Propostas, Aceitação e Habilitação', 'UAC'),
      (12, 1, 'Execução',     'Envio da proposta e documentação de qualificação técnica para análise da área demandante', 'UAC'),
      (13, 1, 'Análise',     'Resposta da Área demandante', 'NAAGE'),
      (14, 3, 'Análise',     'Prazo recursal (3 DIAS ÚTEIS)', 'UAC'),
      (15, 3, 'Aprovação',   'Prazo contrarrazões (3 DIAS ÚTEIS)', 'UAC'),
      (16, 5, 'Aprovação',   'Decisão quanto ao recurso (5 dias úteis)', 'UAC'),
      (17, 2, 'Aprovação',   'Envio do Recurso ao Jurídico e Ratificação autoridade competente da decisão do pregoeiro', 'DIOP')
    ) AS t(ordem, dias, fase, descricao, setor) ORDER BY t.ordem
  LOOP
    IF atividade.ordem = 1 THEN
      data_atual := p_data_inicio;
    ELSE
      data_atual := data_fim_atividade + 1;
    END IF;

    IF atividade.dias > 0 THEN
      data_fim_atividade := somar_dias_uteis(data_atual, atividade.dias);
    ELSE
      data_fim_atividade := NULL;
    END IF;

    INSERT INTO cronograma_atividades (processo_id, ordem, dias_uteis, fase, descricao, setor, status, data_inicio, data_fim)
    VALUES (p_processo_id, atividade.ordem, atividade.dias, atividade.fase, atividade.descricao, atividade.setor, 'nao_iniciado', data_atual, data_fim_atividade);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. TRIGGER: auto-criar cronograma ao inserir processo
CREATE OR REPLACE FUNCTION trigger_criar_cronograma()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM criar_cronograma_para_processo(NEW.id, NEW.data_entrada);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_processo_created ON processos;
CREATE TRIGGER on_processo_created
  AFTER INSERT ON processos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_criar_cronograma();
