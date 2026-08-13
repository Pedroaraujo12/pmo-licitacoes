-- PMO Licitações — correções essenciais do cronograma
-- Aditivo e idempotente. Não reescreve nenhum cronograma existente.

-- 1. Feriados até 2030 + Consciência Negra nos anos já cadastrados
INSERT INTO feriados (data, nome, tipo) VALUES
 ('2026-11-20','Consciência Negra','nacional'),('2027-11-20','Consciência Negra','nacional'),
 ('2028-01-01','Confraternização Universal','nacional'),('2028-02-28','Carnaval','nacional'),
 ('2028-02-29','Carnaval','nacional'),('2028-04-14','Sexta-Feira Santa','nacional'),
 ('2028-04-21','Tiradentes','nacional'),('2028-05-01','Dia do Trabalho','nacional'),
 ('2028-06-15','Corpus Christi','nacional'),('2028-09-07','Independência do Brasil','nacional'),
 ('2028-10-12','Nossa Sra. Aparecida','nacional'),('2028-11-02','Finados','nacional'),
 ('2028-11-15','Proclamação da República','nacional'),('2028-11-20','Consciência Negra','nacional'),
 ('2028-12-25','Natal','nacional'),
 ('2029-01-01','Confraternização Universal','nacional'),('2029-02-12','Carnaval','nacional'),
 ('2029-02-13','Carnaval','nacional'),('2029-03-30','Sexta-Feira Santa','nacional'),
 ('2029-04-21','Tiradentes','nacional'),('2029-05-01','Dia do Trabalho','nacional'),
 ('2029-05-31','Corpus Christi','nacional'),('2029-09-07','Independência do Brasil','nacional'),
 ('2029-10-12','Nossa Sra. Aparecida','nacional'),('2029-11-02','Finados','nacional'),
 ('2029-11-15','Proclamação da República','nacional'),('2029-11-20','Consciência Negra','nacional'),
 ('2029-12-25','Natal','nacional'),
 ('2030-01-01','Confraternização Universal','nacional'),('2030-03-04','Carnaval','nacional'),
 ('2030-03-05','Carnaval','nacional'),('2030-04-19','Sexta-Feira Santa','nacional'),
 ('2030-04-21','Tiradentes','nacional'),('2030-05-01','Dia do Trabalho','nacional'),
 ('2030-06-20','Corpus Christi','nacional'),('2030-09-07','Independência do Brasil','nacional'),
 ('2030-10-12','Nossa Sra. Aparecida','nacional'),('2030-11-02','Finados','nacional'),
 ('2030-11-15','Proclamação da República','nacional'),('2030-11-20','Consciência Negra','nacional'),
 ('2030-12-25','Natal','nacional')
ON CONFLICT (data) DO NOTHING;

-- 2. somar_dias_uteis: marco cai em dia útil e entrada nula não trava
CREATE OR REPLACE FUNCTION somar_dias_uteis(data_inicio DATE, qtd_dias INT)
RETURNS DATE AS $$
DECLARE d DATE := data_inicio; n INT := 0; g INT := 0;
BEGIN
  IF data_inicio IS NULL THEN RETURN NULL; END IF;
  IF qtd_dias IS NULL OR qtd_dias <= 0 THEN
    WHILE (EXTRACT(DOW FROM d) IN (0,6)
           OR EXISTS (SELECT 1 FROM feriados f WHERE f.data = d)) AND g < 400 LOOP
      d := d + 1; g := g + 1;
    END LOOP;
    RETURN d;
  END IF;
  LOOP
    IF EXTRACT(DOW FROM d) NOT IN (0,6)
       AND NOT EXISTS (SELECT 1 FROM feriados f WHERE f.data = d) THEN
      n := n + 1;
      IF n >= qtd_dias THEN RETURN d; END IF;
    END IF;
    d := d + 1; g := g + 1;
    EXIT WHEN g > 4000;
  END LOOP;
  RETURN d;
END; $$ LANGUAGE plpgsql;

-- 3. criar_cronograma_para_processo: marco deixa de interromper a cadeia
CREATE OR REPLACE FUNCTION criar_cronograma_para_processo(p_processo_id UUID, p_data_inicio DATE)
RETURNS void AS $$
DECLARE v_mod UUID; v_modelo UUID; e RECORD; d_ini DATE := p_data_inicio; d_fim DATE;
BEGIN
  IF p_data_inicio IS NULL THEN RETURN; END IF;
  DELETE FROM cronograma_atividades WHERE processo_id = p_processo_id;
  SELECT modalidade_id INTO v_mod FROM processos WHERE id = p_processo_id;
  SELECT id INTO v_modelo FROM modelo_cronograma
   WHERE modalidade_id = v_mod AND ativo = true ORDER BY created_at DESC LIMIT 1;
  IF v_modelo IS NULL THEN RETURN; END IF;

  FOR e IN SELECT * FROM modelo_etapa WHERE modelo_cronograma_id = v_modelo ORDER BY ordem LOOP
    IF e.ordem = 1 THEN d_ini := p_data_inicio; ELSE d_ini := d_fim + 1; END IF;
    d_fim := somar_dias_uteis(d_ini, e.duracao_dias_uteis);
    INSERT INTO cronograma_atividades
      (processo_id, ordem, dias_uteis, fase, descricao, setor, status,
       data_inicio, data_fim, modelo_etapa_id)
    VALUES
      (p_processo_id, e.ordem, e.duracao_dias_uteis, e.fase, e.descricao, e.setor,
       'nao_iniciado', somar_dias_uteis(d_ini, 0), d_fim, e.id);
  END LOOP;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Conferência
SELECT somar_dias_uteis('2026-08-08'::date,0) AS marco_sabado,
       somar_dias_uteis('2026-09-01'::date,5) AS com_feriado,
       somar_dias_uteis(NULL,5) AS nulo;
SELECT extract(year from data)::int AS ano, count(*) FROM feriados
 WHERE data >= '2026-01-01' GROUP BY 1 ORDER BY 1;
