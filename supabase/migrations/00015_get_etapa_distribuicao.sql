-- RPC for dashboard chart: count processos by their current cronograma fase
CREATE OR REPLACE FUNCTION get_etapa_distribuicao()
RETURNS TABLE(fase TEXT, qtd BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT ca.fase::TEXT, COUNT(*)::BIGINT
  FROM cronograma_atividades ca
  WHERE ca.status = 'nao_iniciado'
    AND ca.ordem = (
      SELECT MIN(ca2.ordem)
      FROM cronograma_atividades ca2
      WHERE ca2.processo_id = ca.processo_id
        AND ca2.status = 'nao_iniciado'
    )
  GROUP BY ca.fase
  ORDER BY qtd DESC;
END;
$$ LANGUAGE plpgsql;
