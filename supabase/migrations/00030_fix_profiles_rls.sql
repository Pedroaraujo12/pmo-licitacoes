-- ============================================================
-- Fix RLS on profiles: adiciona política SELECT
-- A tabela profiles tinha RLS habilitado mas NENHUMA política
-- SELECT. Isso fazia com que qualquer subconsulta a profiles
-- (ex: na política contratos_insert) retornasse 0 linhas,
-- bloqueando todas as inserções em contratos.
-- ============================================================

-- Permite que usuários autenticados leiam profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Política de INSERT para contrato_historico (estava faltando)
CREATE POLICY "historico_insert" ON contrato_historico FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);
