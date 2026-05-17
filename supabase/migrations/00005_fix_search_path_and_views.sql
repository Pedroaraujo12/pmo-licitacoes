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

-- Recreate views as SECURITY INVOKER
DROP VIEW IF EXISTS public.vw_cronograma_processo CASCADE;
DROP VIEW IF EXISTS public.vw_status_processo_cronograma CASCADE;

CREATE VIEW public.vw_cronograma_processo WITH (security_invoker = true) AS
SELECT
  p.id,
  p.id_processo,
  p.modalidade_id,
  p.data_entrada,
  ca.id as atividade_id,
  ca.ordem,
  ca.dias_uteis,
  ca.fase,
  ca.descricao,
  ca.setor,
  ca.status,
  ca.data_inicio,
  ca.data_fim,
  CASE WHEN ca.dias_uteis > 0 THEN ca.data_fim ELSE NULL END as data_prevista
FROM processos p
LEFT JOIN cronograma_atividades ca ON ca.processo_id = p.id;

CREATE VIEW public.vw_status_processo_cronograma WITH (security_invoker = true) AS
WITH atividade_status AS (
  SELECT
    p.id,
    p.id_processo,
    COUNT(ca.id) as total_atividades,
    COUNT(ca.id) FILTER (WHERE ca.status = 'concluido') as concluidas,
    COUNT(ca.id) FILTER (WHERE ca.status = 'em_andamento') as em_andamento,
    COUNT(ca.id) FILTER (WHERE ca.status = 'nao_iniciado') as nao_iniciadas
  FROM processos p
  LEFT JOIN cronograma_atividades ca ON ca.processo_id = p.id
  GROUP BY p.id, p.id_processo
)
SELECT
  id,
  id_processo,
  total_atividades,
  concluidas,
  em_andamento,
  nao_iniciadas,
  CASE
    WHEN total_atividades = 0 THEN 'sem_cronograma'
    WHEN concluidas = total_atividades THEN 'concluido'
    WHEN em_andamento > 0 THEN 'em_andamento'
    ELSE 'nao_iniciado'
  END as status_cronograma
FROM atividade_status;
