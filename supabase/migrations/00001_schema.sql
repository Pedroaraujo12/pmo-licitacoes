-- ============================================
-- PMO Licitações - Schema Completo
-- ============================================

-- 1. ENUM: user roles
CREATE TYPE user_role AS ENUM ('admin', 'gestor', 'consultor', 'visualizador');

-- 2. PROFILES (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'visualizador',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. CATEGORIAS / REFERENCIA
CREATE TABLE coordenacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE modalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE demandantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE responsaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE status_processo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE
);

-- 4. PROCESSOS (main table)
CREATE TABLE processos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_entrada DATE,
  coordenacao_id UUID REFERENCES coordenacoes(id),
  drive TEXT,
  status_id UUID REFERENCES status_processo(id),
  id_processo TEXT UNIQUE,
  qtd_itens NUMERIC,
  responsavel_id UUID REFERENCES responsaveis(id),
  objeto_resumido TEXT,
  demandante_id UUID REFERENCES demandantes(id),
  modalidade_id UUID REFERENCES modalidades(id),
  prioridade TEXT,
  atividade_atual TEXT,
  data_atividade DATE,
  progresso NUMERIC DEFAULT 0,
  data_entrega DATE,
  houve_recurso TEXT,
  valor_estimado NUMERIC DEFAULT 0,
  valor_homologado NUMERIC DEFAULT 0,
  despesa_evitada NUMERIC DEFAULT 0,
  observacoes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE processos ENABLE ROW LEVEL SECURITY;

-- 5. ATIVIDADES (timeline)
CREATE TABLE atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  atividade TEXT NOT NULL,
  data DATE,
  responsavel TEXT,
  observacao TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE atividades ENABLE ROW LEVEL SECURITY;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_processos_id_processo ON processos(id_processo);
CREATE INDEX idx_processos_status ON processos(status_id);
CREATE INDEX idx_processos_responsavel ON processos(responsavel_id);
CREATE INDEX idx_processos_modalidade ON processos(modalidade_id);
CREATE INDEX idx_atividades_processo ON atividades(processo_id);

-- ============================================
-- SEED DATA
-- ============================================
INSERT INTO status_processo (nome) VALUES
  ('Não recebido'),
  ('Em andamento'),
  ('Concluído'),
  ('Devolvido'),
  ('Cancelado');

INSERT INTO modalidades (nome) VALUES
  ('Pregão Eletrônico'),
  ('Cotação de Preços'),
  ('Cotação de preço'),
  ('Concorrência'),
  ('Dispensa'),
  ('Inexigibilidade');

INSERT INTO coordenacoes (nome) VALUES
  ('CCS.RD'),
  ('CCOE.RD');

INSERT INTO demandantes (nome) VALUES
  ('NAAGE'),
  ('UINFRA'),
  ('CDASI - PES Rio Doce'),
  ('COEPI'),
  ('UCOM');

-- ============================================
-- RLS POLICIES
-- ============================================

-- Profiles policies
CREATE POLICY "Usuários podem ver seus próprios perfis"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins podem ver todos os perfis"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins podem inserir perfis"
  ON profiles FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins e gestores podem atualizar perfis"
  ON profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))
  );

-- Processos policies
CREATE POLICY "Visualizador pode ver processos"
  ON processos FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor', 'visualizador'))
  );

CREATE POLICY "Consultor+ pode inserir processos"
  ON processos FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))
  );

CREATE POLICY "Consultor+ pode atualizar processos"
  ON processos FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))
  );

CREATE POLICY "Admin/Gestor pode deletar processos"
  ON processos FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))
  );

-- Atividades policies
CREATE POLICY "Todos autenticados podem ver atividades"
  ON atividades FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários logados podem inserir atividades"
  ON atividades FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admin/Gestor pode editar atividades"
  ON atividades FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))
  );

-- ============================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON processos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'visualizador')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
