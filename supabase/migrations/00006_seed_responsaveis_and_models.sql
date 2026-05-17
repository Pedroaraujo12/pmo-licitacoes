-- ============================================
-- Seed responsaveis and missing cronograma models
-- ============================================

INSERT INTO responsaveis (nome) VALUES
  ('João Silva'),
  ('Maria Santos'),
  ('Pedro Oliveira'),
  ('Ana Costa'),
  ('Carlos Souza')
ON CONFLICT (nome) DO NOTHING;

DO $$
DECLARE
  v_dispensa_id UUID;
  v_inexigibilidade_id UUID;
  v_modelo_id UUID;
BEGIN
  SELECT id INTO v_dispensa_id FROM modalidades WHERE nome = 'Dispensa' LIMIT 1;
  SELECT id INTO v_inexigibilidade_id FROM modalidades WHERE nome = 'Inexigibilidade' LIMIT 1;

  IF v_dispensa_id IS NOT NULL THEN
    SELECT id INTO v_modelo_id FROM modelo_cronograma
    WHERE modalidade_id = v_dispensa_id AND nome = 'Cronograma Padrão Dispensa' LIMIT 1;

    IF v_modelo_id IS NULL THEN
      INSERT INTO modelo_cronograma (modalidade_id, nome, total_dias_uteis)
      VALUES (v_dispensa_id, 'Cronograma Padrão Dispensa', 15)
      RETURNING id INTO v_modelo_id;

      INSERT INTO modelo_etapa (modelo_cronograma_id, ordem, fase, descricao, setor, duracao_dias_uteis) VALUES
        (v_modelo_id, 1, 'Planejamento', 'Análise do Termo de Referência e anexos', 'UAC', 2),
        (v_modelo_id, 2, 'Produção',     'Pesquisa de Preços e levantamento do custo estimado', 'UAC', 2),
        (v_modelo_id, 3, 'Análise',      'Disponibilidade orçamentária', 'UFOC', 1),
        (v_modelo_id, 4, 'Produção',     'Elaboração da Minuta de Edital e anexos', 'UAC', 3),
        (v_modelo_id, 5, 'Análise',      'Análise jurídica e Emissão de Parecer', 'UJUR', 3),
        (v_modelo_id, 6, 'Execução',     'Publicação do Edital (3 dias úteis)', 'UAC', 3),
        (v_modelo_id, 7, 'Análise',      'Prazo recursal (3 dias úteis)', 'UAC', 2),
        (v_modelo_id, 8, 'Aprovação',    'Homologação e Adjudicação', 'UAC', 1);
    END IF;
  END IF;

  IF v_inexigibilidade_id IS NOT NULL THEN
    SELECT id INTO v_modelo_id FROM modelo_cronograma
    WHERE modalidade_id = v_inexigibilidade_id AND nome = 'Cronograma Padrão Inexigibilidade' LIMIT 1;

    IF v_modelo_id IS NULL THEN
      INSERT INTO modelo_cronograma (modalidade_id, nome, total_dias_uteis)
      VALUES (v_inexigibilidade_id, 'Cronograma Padrão Inexigibilidade', 25)
      RETURNING id INTO v_modelo_id;

      INSERT INTO modelo_etapa (modelo_cronograma_id, ordem, fase, descricao, setor, duracao_dias_uteis) VALUES
        (v_modelo_id, 1,  'Planejamento', 'Análise do Termo de Referência e anexos', 'UAC', 2),
        (v_modelo_id, 2,  'Produção',     'Justificativa da Inexigibilidade', 'UAC', 3),
        (v_modelo_id, 3,  'Produção',     'Pesquisa de Preços e levantamento do custo estimado', 'UAC', 3),
        (v_modelo_id, 4,  'Análise',      'Disponibilidade orçamentária', 'UFOC', 1),
        (v_modelo_id, 5,  'Produção',     'Elaboração da Minuta de Edital e anexos', 'UAC', 4),
        (v_modelo_id, 6,  'Análise',      'Análise jurídica e Emissão de Parecer', 'UJUR', 4),
        (v_modelo_id, 7,  'Produção',     'Publicação do Edital (3 dias úteis)', 'UAC', 3),
        (v_modelo_id, 8,  'Execução',     'Abertura e Fase de Lances', 'UAC', 1),
        (v_modelo_id, 9,  'Análise',      'Prazo recursal (3 dias úteis)', 'UAC', 3),
        (v_modelo_id, 10, 'Aprovação',    'Homologação e Adjudicação', 'UAC', 1);
    END IF;
  END IF;
END $$;
