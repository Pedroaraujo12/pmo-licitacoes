-- Adiciona colunas para diferenciar valor original vs aditivos
-- e suportar apostilamentos, acréscimos e supressões

ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS valor_original DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_aditivos DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Popula valor_original com valor_inicial existente
UPDATE contratos SET valor_original = valor_inicial WHERE valor_original = 0;

-- Trigger: ao inserir/atualizar aditivo, recalcula total_aditivos e valor_atual no contrato
CREATE OR REPLACE FUNCTION recalcular_valores_contrato()
RETURNS TRIGGER AS $$
DECLARE
  _contrato_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _contrato_id := OLD.contrato_id;
  ELSE
    _contrato_id := NEW.contrato_id;
  END IF;

  UPDATE contratos c
  SET
    total_aditivos = COALESCE((
      SELECT SUM(
        CASE
          WHEN a.tipo = 'supressao' THEN -ABS(a.valor_alteracao)
          ELSE ABS(a.valor_alteracao)
        END
      )
      FROM contrato_aditivos a
      WHERE a.contrato_id = _contrato_id
        AND a.tipo IN ('acrescimo', 'supressao', 'aditivo_valor', 'aditivo_prazo_valor', 'reequilibrio', 'apostilamento')
    ), 0),
    valor_atual = c.valor_original + COALESCE((
      SELECT SUM(
        CASE
          WHEN a.tipo = 'supressao' THEN -ABS(a.valor_alteracao)
          ELSE ABS(a.valor_alteracao)
        END
      )
      FROM contrato_aditivos a
      WHERE a.contrato_id = _contrato_id
        AND a.tipo IN ('acrescimo', 'supressao', 'aditivo_valor', 'aditivo_prazo_valor', 'reequilibrio', 'apostilamento')
    ), 0)
  WHERE c.id = _contrato_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recalcular_valores_aditivo ON contrato_aditivos;
CREATE TRIGGER trigger_recalcular_valores_aditivo
  AFTER INSERT OR UPDATE OR DELETE ON contrato_aditivos
  FOR EACH ROW
  EXECUTE FUNCTION recalcular_valores_contrato();

-- Recalcula valores existentes
UPDATE contratos c
SET
  total_aditivos = COALESCE((
    SELECT SUM(
      CASE
        WHEN a.tipo = 'supressao' THEN -ABS(a.valor_alteracao)
        ELSE ABS(a.valor_alteracao)
      END
    )
    FROM contrato_aditivos a
    WHERE a.contrato_id = c.id
      AND a.tipo IN ('acrescimo', 'supressao', 'aditivo_valor', 'aditivo_prazo_valor', 'reequilibrio', 'apostilamento')
  ), 0),
  valor_atual = c.valor_original + COALESCE((
    SELECT SUM(
      CASE
        WHEN a.tipo = 'supressao' THEN -ABS(a.valor_alteracao)
        ELSE ABS(a.valor_alteracao)
      END
    )
    FROM contrato_aditivos a
    WHERE a.contrato_id = c.id
      AND a.tipo IN ('acrescimo', 'supressao', 'aditivo_valor', 'aditivo_prazo_valor', 'reequilibrio', 'apostilamento')
  ), 0);

-- Ajusta tipos de aditivo para incluir apostilamento como tipo distinto
-- (apostilamento já existe como valor em ADITIVO_TIPO_RECORDS)
COMMENT ON TABLE contrato_aditivos IS 'Aditivos contratuais, incluindo apostilamentos, acréscimos e supressões';
COMMENT ON COLUMN contratos.valor_original IS 'Valor base do contrato sem considerar aditivos';
COMMENT ON COLUMN contratos.total_aditivos IS 'Saldo total de alterações via aditivos (acréscimos - supressões)';
