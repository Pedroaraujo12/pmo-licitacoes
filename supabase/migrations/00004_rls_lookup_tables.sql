-- ============================================
-- Fix RLS for lookup tables
-- ============================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['coordenacoes', 'status_processo', 'responsaveis', 'demandantes', 'modalidades']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);

    EXECUTE format('
      CREATE POLICY "Todos podem ver %I" ON %I
      FOR SELECT USING (true);
    ', tbl, tbl);

    EXECUTE format('
      CREATE POLICY "Admins podem gerenciar %I" ON %I
      FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN (''admin'', ''gestor'')));
    ', tbl, tbl);

    EXECUTE format('
      CREATE POLICY "Admins podem editar %I" ON %I
      FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN (''admin'', ''gestor'')));
    ', tbl, tbl);

    EXECUTE format('
      CREATE POLICY "Admins podem deletar %I" ON %I
      FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN (''admin'', ''gestor'')));
    ', tbl, tbl);
  END LOOP;
END $$;
