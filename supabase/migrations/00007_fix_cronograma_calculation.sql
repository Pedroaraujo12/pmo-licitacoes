-- ============================================
-- Fix: cronograma date calculation off-by-one
-- somar_dias_uteis(data_inicio, qtd_dias) returns
-- the qtd_dias-th business day counting from
-- data_inicio inclusive. Callers were passing
-- (dias - 1) instead of dias, shortening every
-- activity's end date by 1 business day.
-- ============================================

CREATE OR REPLACE FUNCTION criar_cronograma_para_processo(p_processo_id UUID, p_data_inicio DATE)
RETURNS void AS $$
DECLARE
  v_modalidade_id UUID;
  v_modelo_id UUID;
  v_etapa RECORD;
  v_data_atual DATE := p_data_inicio;
  v_data_fim_atividade DATE;
BEGIN
  DELETE FROM cronograma_atividades WHERE processo_id = p_processo_id;

  SELECT modalidade_id INTO v_modalidade_id FROM processos WHERE id = p_processo_id;

  SELECT id INTO v_modelo_id FROM modelo_cronograma
  WHERE modalidade_id = v_modalidade_id AND ativo = true
  ORDER BY created_at DESC LIMIT 1;

  IF v_modelo_id IS NULL THEN
    FOR v_etapa IN
      SELECT * FROM (VALUES
        (1, 3,  'Planejamento', 'Análise do Termo de Referência e anexos', 'UAC'),
        (2, 5,  'Produção',     'Pesquisa de Preços e levantamento do custo estimado da Contratação', 'UAC'),
        (3, 1,  'Produção',     'Relatório de Pesquisa Preços', 'UAC'),
        (4, 2,  'Análise',      'Disponibilidade orçamentária', 'UFOC'),
        (5, 1,  'Revisão',      'Designação da Comissão de Seleção', 'UAC'),
        (6, 5,  'Produção',     'Elaboração Da Minuta de Edital e Anexos. Envio à UJUR/AGSUS', 'UAC'),
        (7, 5,  'Análise',      'Análise jurídica e Emissão de Parecer', 'UJUR'),
        (8, 1,  'Produção',     'Adequações e atendimento ao Parecer Jurídico', 'NAAGE'),
        (9, 8,  'Produção',     'Publicação do Edital', 'UAC'),
        (10, 1, 'Execução',     'Abertura e Fase de Lances', 'UAC'),
        (11, 8, 'Execução',     'Fase de Julgamento das Propostas', 'UAC'),
        (12, 1, 'Execução',     'Envio da proposta para análise da área demandante', 'UAC'),
        (13, 1, 'Análise',      'Resposta da Área demandante', 'NAAGE'),
        (14, 3, 'Análise',      'Prazo recursal', 'UAC'),
        (15, 3, 'Aprovação',    'Prazo contrarrazões', 'UAC'),
        (16, 5, 'Aprovação',    'Decisão quanto ao recurso', 'UAC'),
        (17, 2, 'Aprovação',    'Envio do Recurso ao Jurídico e Ratificação', 'DIOP')
      ) AS t(ordem, dias, fase, descricao, setor) ORDER BY t.ordem
    LOOP
      IF v_etapa.ordem = 1 THEN v_data_atual := p_data_inicio;
      ELSE v_data_atual := v_data_fim_atividade + 1; END IF;

      IF v_etapa.dias > 0 THEN
        v_data_fim_atividade := somar_dias_uteis(v_data_atual, v_etapa.dias);
      ELSE
        v_data_fim_atividade := NULL;
      END IF;

      INSERT INTO cronograma_atividades (processo_id, ordem, dias_uteis, fase, descricao, setor, status, data_inicio, data_fim)
      VALUES (p_processo_id, v_etapa.ordem, v_etapa.dias, v_etapa.fase, v_etapa.descricao, v_etapa.setor, 'nao_iniciado', v_data_atual, v_data_fim_atividade);
    END LOOP;
    RETURN;
  END IF;

  FOR v_etapa IN
    SELECT * FROM modelo_etapa
    WHERE modelo_cronograma_id = v_modelo_id
    ORDER BY ordem
  LOOP
    IF v_etapa.ordem = 1 THEN v_data_atual := p_data_inicio;
    ELSE v_data_atual := v_data_fim_atividade + 1; END IF;

    IF v_etapa.duracao_dias_uteis > 0 THEN
      v_data_fim_atividade := somar_dias_uteis(v_data_atual, v_etapa.duracao_dias_uteis);
    ELSE
      v_data_fim_atividade := NULL;
    END IF;

    INSERT INTO cronograma_atividades (processo_id, ordem, dias_uteis, fase, descricao, setor, status, data_inicio, data_fim, modelo_etapa_id)
    VALUES (p_processo_id, v_etapa.ordem, v_etapa.duracao_dias_uteis, v_etapa.fase, v_etapa.descricao, v_etapa.setor, 'nao_iniciado', v_data_atual, v_data_fim_atividade, v_etapa.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
