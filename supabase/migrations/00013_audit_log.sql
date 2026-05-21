-- Tabela de auditoria para rastrear alterações nos processos
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela TEXT NOT NULL,
  registro_id UUID NOT NULL,
  acao TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_registro_id ON audit_log(registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Função genérica de log
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  BEGIN
    v_usuario_id := current_setting('app.usuario_id', TRUE)::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_usuario_id := NULL;
  END;

  INSERT INTO audit_log (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END,
    v_usuario_id
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para processos
DROP TRIGGER IF EXISTS trig_audit_processos ON processos;
CREATE TRIGGER trig_audit_processos
  AFTER INSERT OR UPDATE OR DELETE ON processos
  FOR EACH ROW EXECUTE FUNCTION log_audit();
