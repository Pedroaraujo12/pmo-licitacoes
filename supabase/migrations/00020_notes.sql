-- ============================================================
-- Migration 00020: Bloco de Anotações e Lembretes Diários
-- ============================================================

DO $$ BEGIN
  CREATE TYPE note_priority AS ENUM ('baixa', 'media', 'alta');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE note_status AS ENUM ('ativa', 'arquivada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT '',
  content         TEXT NOT NULL DEFAULT '',
  priority        note_priority NOT NULL DEFAULT 'media',
  status          note_status NOT NULL DEFAULT 'ativa',
  destacado       BOOLEAN NOT NULL DEFAULT false,
  compartilhada   BOOLEAN NOT NULL DEFAULT false,
  reminder_at     TIMESTAMPTZ,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  processo_id     UUID REFERENCES processos(id) ON DELETE SET NULL,
  colaborador_id  UUID REFERENCES colaboradores(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
CREATE INDEX IF NOT EXISTS idx_notes_priority ON notes(priority);
CREATE INDEX IF NOT EXISTS idx_notes_reminder_at ON notes(reminder_at);
CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_notes_processo_id ON notes(processo_id);
CREATE INDEX IF NOT EXISTS idx_notes_colaborador_id ON notes(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);
CREATE INDEX IF NOT EXISTS idx_notes_destacado ON notes(destacado);

CREATE OR REPLACE FUNCTION search_notes(search_term TEXT, p_user_id UUID)
RETURNS SETOF notes
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY SELECT *
  FROM notes
  WHERE user_id = p_user_id
    AND (title ILIKE '%' || search_term || '%' OR content ILIKE '%' || search_term || '%')
  ORDER BY
    CASE WHEN title ILIKE '%' || search_term || '%' THEN 0 ELSE 1 END,
    created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notes_updated_at ON notes;
CREATE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_notes_updated_at();
