-- Trigger: auto-calcula despesa_evitada e alerta quando processo é concluído sem homologação
CREATE OR REPLACE FUNCTION check_homologacao_on_concluir()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-calcular despesa evitada
  NEW.despesa_evitada := COALESCE(NEW.valor_estimado, 0) - COALESCE(NEW.valor_homologado, 0);

  -- Warn if marked as concluído without homologado value
  IF NEW.status_id = (SELECT id FROM status_processo WHERE nome = 'Concluído' LIMIT 1)
     AND (NEW.valor_homologado IS NULL OR NEW.valor_homologado = 0) THEN
    RAISE WARNING 'Processo concluído sem valor homologado: %', NEW.id_processo;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_check_homologacao ON processos;
CREATE TRIGGER trig_check_homologacao
  BEFORE UPDATE ON processos
  FOR EACH ROW
  EXECUTE FUNCTION check_homologacao_on_concluir();
