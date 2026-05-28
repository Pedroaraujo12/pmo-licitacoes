DO $$
BEGIN
  CREATE POLICY profiles_select_authenticated ON profiles FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY processos_select_authenticated ON processos FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY atividades_select_authenticated ON atividades FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY cronograma_atividades_select_authenticated ON cronograma_atividades FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY coordenacoes_select_authenticated ON coordenacoes FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY modalidades_select_authenticated ON modalidades FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY demandantes_select_authenticated ON demandantes FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY responsaveis_select_authenticated ON responsaveis FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY status_processo_select_authenticated ON status_processo FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP POLICY IF EXISTS notes_own ON notes;
DROP POLICY IF EXISTS notes_read_authenticated ON notes;
DROP POLICY IF EXISTS notes_insert_own ON notes;
DROP POLICY IF EXISTS notes_update_own ON notes;
DROP POLICY IF EXISTS notes_delete_own ON notes;

CREATE POLICY notes_read_authenticated ON notes
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      user_id = auth.uid()
      OR compartilhada = true
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'gestor')
      )
    )
  );

CREATE POLICY notes_insert_own ON notes
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notes_update_own ON notes
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'gestor')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'gestor')
    )
  );

CREATE POLICY notes_delete_own ON notes
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'gestor')
    )
  );
;
