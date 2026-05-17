-- ============================================
-- Fix search_path and SECURITY DEFINER views
-- ============================================

-- Recreate functions with explicit search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'membro');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.data_rece_calc()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.data_rece THEN
    NEW.data_rece_3d := NEW.data_rece + INTERVAL '3 days';
    NEW.data_rece_5d := NEW.data_rece + INTERVAL '5 days';
    NEW.data_rece_7d := NEW.data_rece + INTERVAL '7 days';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calcular_data_prevista_sla()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.data_rece THEN
    NEW.data_prevista_3d := NEW.data_rece + INTERVAL '3 days';
    NEW.data_prevista_5d := NEW.data_rece + INTERVAL '5 days';
    NEW.data_prevista_7d := NEW.data_rece + INTERVAL '7 days';
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate views as SECURITY INVOKER (preserving original column names)
DROP VIEW IF EXISTS public.vw_cronograma_processo CASCADE;
DROP VIEW IF EXISTS public.vw_status_processo_cronograma CASCADE;

CREATE VIEW public.vw_cronograma_processo WITH (security_invoker = true) AS
SELECT
  ca.id, ca.processo_id, p.id_processo, p.modalidade_id,
  m.nome AS modalidade_nome,
  ca.ordem, ca.fase, ca.descricao AS atividade_descricao,
  ca.setor, ca.dias_uteis, ca.status,
  ca.data_inicio, ca.data_fim, ca.modelo_etapa_id,
  r.nome AS responsavel_nome,
  ca.data_inicio_real, ca.data_fim_real, ca.observacao,
  CASE
    WHEN ca.status != 'concluido' AND ca.data_fim IS NOT NULL AND ca.data_fim < CURRENT_DATE THEN true
    ELSE false
  END AS em_atraso
FROM cronograma_atividades ca
JOIN processos p ON p.id = ca.processo_id
LEFT JOIN modalidades m ON m.id = p.modalidade_id
LEFT JOIN responsaveis r ON r.id = ca.responsavel_id;

CREATE VIEW public.vw_status_processo_cronograma WITH (security_invoker = true) AS
SELECT
  ca.processo_id,
  p.id_processo,
  p.modalidade_id,
  m.nome AS modalidade_nome,
  (
    SELECT ca2.descricao FROM cronograma_atividades ca2
    WHERE ca2.processo_id = ca.processo_id AND ca2.status != 'concluido'
    ORDER BY ca2.ordem LIMIT 1
  ) AS atividade_atual,
  (
    SELECT ca2.data_fim FROM cronograma_atividades ca2
    WHERE ca2.processo_id = ca.processo_id AND ca2.status != 'concluido'
    ORDER BY ca2.ordem LIMIT 1
  ) AS data_fim_atividade_atual,
  (
    SELECT ca2.ordem FROM cronograma_atividades ca2
    WHERE ca2.processo_id = ca.processo_id AND ca2.status != 'concluido'
    ORDER BY ca2.ordem LIMIT 1
  ) AS ordem_atividade_atual,
  MAX(ca.ordem) AS total_etapas,
  COUNT(ca.status) FILTER (WHERE ca.status = 'concluido') AS etapas_concluidas,
  COUNT(ca.status) FILTER (WHERE ca.status != 'concluido' AND ca.data_fim IS NOT NULL AND ca.data_fim < CURRENT_DATE) AS etapas_atrasadas,
  CASE
    WHEN COUNT(ca.status) FILTER (WHERE ca.status != 'concluido' AND ca.data_fim IS NOT NULL AND ca.data_fim < CURRENT_DATE) > 0 THEN true
    ELSE false
  END AS processo_atrasado,
  CASE
    WHEN COUNT(ca.status) = 0 THEN 0
    ELSE ROUND((COUNT(ca.status) FILTER (WHERE ca.status = 'concluido')::DECIMAL / COUNT(ca.status)::DECIMAL) * 100)
  END AS progresso_calculado,
  MAX(ca.data_fim) AS data_fim_prevista_total
FROM cronograma_atividades ca
JOIN processos p ON p.id = ca.processo_id
LEFT JOIN modalidades m ON m.id = p.modalidade_id
GROUP BY ca.processo_id, p.id_processo, p.modalidade_id, m.nome;
