-- ============================================
-- Pregão Eletrônico: descrições conforme a planilha oficial
-- ============================================
-- As 20 etapas e os 69 dias úteis já estavam corretos. O que divergia era a
-- redação de 8 delas — prazos escritos por extenso no banco e abreviados na
-- planilha, "Análise do TR" contra "Análise TR", diferenças de caixa. Basta
-- para atrapalhar a conferência etapa a etapa.
--
-- Só o texto muda. Ordem, fase, setor e duração permanecem.
-- ============================================

DO $$
DECLARE
  v_modelo UUID;
BEGIN
  SELECT mc.id INTO v_modelo
    FROM modelo_cronograma mc
    JOIN modalidades m ON m.id = mc.modalidade_id
   WHERE mc.ativo = true
     AND m.nome ILIKE '%preg%'
   ORDER BY mc.created_at DESC
   LIMIT 1;

  IF v_modelo IS NULL THEN
    RAISE EXCEPTION 'Modelo ativo de Pregão não encontrado';
  END IF;

  UPDATE modelo_etapa SET descricao = 'Análise TR/UAC'
   WHERE modelo_cronograma_id = v_modelo AND ordem = 1;

  UPDATE modelo_etapa SET descricao = 'Publicação do Edital (8D - Aquisição/10D - Serviço)'
   WHERE modelo_cronograma_id = v_modelo AND ordem = 8;

  UPDATE modelo_etapa SET descricao = 'Envio da Proposta e doc. de qualificação Técnica para análise'
   WHERE modelo_cronograma_id = v_modelo AND ordem = 11;

  UPDATE modelo_etapa SET descricao = 'Prazo Recursal (3D)'
   WHERE modelo_cronograma_id = v_modelo AND ordem = 14;

  UPDATE modelo_etapa SET descricao = 'Prazo Contrarrazões (3D)'
   WHERE modelo_cronograma_id = v_modelo AND ordem = 15;

  UPDATE modelo_etapa SET descricao = 'Decisão quanto ao recurso (5D)'
   WHERE modelo_cronograma_id = v_modelo AND ordem = 16;

  UPDATE modelo_etapa SET descricao = 'Envio do Recurso (2d)'
   WHERE modelo_cronograma_id = v_modelo AND ordem = 17;

  UPDATE modelo_etapa SET descricao = 'Adjudicação (1D - s/recurso)'
   WHERE modelo_cronograma_id = v_modelo AND ordem = 18;
END $$;

-- ============================================
-- Conferência: deve devolver as 20 etapas na redação da planilha, somando 69
-- ============================================

SELECT me.ordem, me.descricao, me.duracao_dias_uteis, me.setor
  FROM modelo_etapa me
  JOIN modelo_cronograma mc ON mc.id = me.modelo_cronograma_id
  JOIN modalidades m ON m.id = mc.modalidade_id
 WHERE mc.ativo = true AND m.nome ILIKE '%preg%'
 ORDER BY me.ordem;

SELECT count(*) AS etapas, sum(me.duracao_dias_uteis) AS dias_uteis
  FROM modelo_etapa me
  JOIN modelo_cronograma mc ON mc.id = me.modelo_cronograma_id
  JOIN modalidades m ON m.id = mc.modalidade_id
 WHERE mc.ativo = true AND m.nome ILIKE '%preg%';
