-- ============================================
-- Feriados nacionais 2028-2030
-- ============================================
-- O seed original (00002_cronograma.sql) cobre 2026-2027. Fora do período
-- cadastrado, `somar_dias_uteis` desconta apenas fins de semana e projeta
-- datas otimistas — um cronograma longo (Concorrência, 107 dias úteis)
-- iniciado no fim de 2027 já ultrapassa esse limite.
--
-- Feriados móveis calculados a partir do Domingo de Páscoa:
--   Carnaval        = Páscoa - 48 e - 47
--   Sexta-Feira Santa = Páscoa - 2
--   Corpus Christi  = Páscoa + 60
--   Páscoa: 2028-04-16 | 2029-04-01 | 2030-04-21
--
-- Consciência Negra (20/11) entra como feriado nacional (Lei 14.759/2023),
-- ausente do seed original.

INSERT INTO feriados (data, nome, tipo) VALUES
  ('2028-01-01', 'Confraternização Universal', 'nacional'),
  ('2028-02-28', 'Carnaval', 'nacional'),
  ('2028-02-29', 'Carnaval', 'nacional'),
  ('2028-04-14', 'Sexta-Feira Santa', 'nacional'),
  ('2028-04-21', 'Tiradentes', 'nacional'),
  ('2028-05-01', 'Dia do Trabalho', 'nacional'),
  ('2028-06-15', 'Corpus Christi', 'nacional'),
  ('2028-09-07', 'Independência do Brasil', 'nacional'),
  ('2028-10-12', 'Nossa Sra. Aparecida', 'nacional'),
  ('2028-11-02', 'Finados', 'nacional'),
  ('2028-11-15', 'Proclamação da República', 'nacional'),
  ('2028-11-20', 'Consciência Negra', 'nacional'),
  ('2028-12-25', 'Natal', 'nacional'),

  ('2029-01-01', 'Confraternização Universal', 'nacional'),
  ('2029-02-12', 'Carnaval', 'nacional'),
  ('2029-02-13', 'Carnaval', 'nacional'),
  ('2029-03-30', 'Sexta-Feira Santa', 'nacional'),
  ('2029-04-21', 'Tiradentes', 'nacional'),
  ('2029-05-01', 'Dia do Trabalho', 'nacional'),
  ('2029-05-31', 'Corpus Christi', 'nacional'),
  ('2029-09-07', 'Independência do Brasil', 'nacional'),
  ('2029-10-12', 'Nossa Sra. Aparecida', 'nacional'),
  ('2029-11-02', 'Finados', 'nacional'),
  ('2029-11-15', 'Proclamação da República', 'nacional'),
  ('2029-11-20', 'Consciência Negra', 'nacional'),
  ('2029-12-25', 'Natal', 'nacional'),

  ('2030-01-01', 'Confraternização Universal', 'nacional'),
  ('2030-03-04', 'Carnaval', 'nacional'),
  ('2030-03-05', 'Carnaval', 'nacional'),
  ('2030-04-19', 'Sexta-Feira Santa', 'nacional'),
  ('2030-04-21', 'Tiradentes', 'nacional'),
  ('2030-05-01', 'Dia do Trabalho', 'nacional'),
  ('2030-06-20', 'Corpus Christi', 'nacional'),
  ('2030-09-07', 'Independência do Brasil', 'nacional'),
  ('2030-10-12', 'Nossa Sra. Aparecida', 'nacional'),
  ('2030-11-02', 'Finados', 'nacional'),
  ('2030-11-15', 'Proclamação da República', 'nacional'),
  ('2030-11-20', 'Consciência Negra', 'nacional'),
  ('2030-12-25', 'Natal', 'nacional')
ON CONFLICT (data) DO NOTHING;

-- Consciência Negra nos anos já cadastrados (o seed 00002 não o incluía)
INSERT INTO feriados (data, nome, tipo) VALUES
  ('2026-11-20', 'Consciência Negra', 'nacional'),
  ('2027-11-20', 'Consciência Negra', 'nacional')
ON CONFLICT (data) DO NOTHING;
