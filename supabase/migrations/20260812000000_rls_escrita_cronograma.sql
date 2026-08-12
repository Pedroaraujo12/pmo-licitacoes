-- ============================================
-- Restaura a escrita em cronograma_atividades, processos e atividades
-- ============================================
-- SINTOMA
-- Regenerar o cronograma de 18 processos relatava "18 processos regenerados"
-- e nada mudava. Marcar etapa como concluída, ajustar prazo e reiniciar
-- contagem sofrem do mesmo problema.
--
-- CAUSA
-- Com RLS ativo e sem política de escrita, o PostgREST responde 200 com lista
-- vazia: a operação é aceita e simplesmente não alcança nenhuma linha. Não é
-- erro — é ausência de permissão manifestando-se como silêncio.
--
-- A migration 00032 restaurou políticas de escrita para 11 tabelas
-- (contratos, colaboradores, ordens de serviço, documentos...), mas deixou de
-- fora cronograma_atividades, processos e atividades. Em produção elas
-- ficaram apenas com a política de leitura criada pelo repair de 2026-05-24.
--
-- CORREÇÃO
-- Mesmo padrão do 00032: permissão por papel, via current_user_has_role, sem
-- consulta recursiva a profiles.
-- ============================================

-- ---------------------------------------------------------------- cronograma
-- Quem trabalha o processo precisa mover as etapas: admin, gestor e consultor.
DROP POLICY IF EXISTS cronograma_atividades_insert ON public.cronograma_atividades;
DROP POLICY IF EXISTS cronograma_atividades_update ON public.cronograma_atividades;
DROP POLICY IF EXISTS cronograma_atividades_delete ON public.cronograma_atividades;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir cronograma" ON public.cronograma_atividades;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar cronograma" ON public.cronograma_atividades;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar cronograma" ON public.cronograma_atividades;

CREATE POLICY cronograma_atividades_insert ON public.cronograma_atividades
  FOR INSERT WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']));

CREATE POLICY cronograma_atividades_update ON public.cronograma_atividades
  FOR UPDATE USING (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']))
          WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']));

CREATE POLICY cronograma_atividades_delete ON public.cronograma_atividades
  FOR DELETE USING (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']));

-- ----------------------------------------------------------------- processos
-- Cadastro e edição de processo, e a data de entrega que o cronograma atualiza.
DROP POLICY IF EXISTS processos_insert ON public.processos;
DROP POLICY IF EXISTS processos_update ON public.processos;
DROP POLICY IF EXISTS processos_delete ON public.processos;

CREATE POLICY processos_insert ON public.processos
  FOR INSERT WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']));

CREATE POLICY processos_update ON public.processos
  FOR UPDATE USING (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']))
          WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']));

CREATE POLICY processos_delete ON public.processos
  FOR DELETE USING (public.current_user_has_role(ARRAY['admin', 'gestor']));

-- ---------------------------------------------------------------- atividades
-- Trilha de auditoria: registro de ajuste de prazo, reinício e link do SEI.
-- Só cresce; alterar e apagar ficam com admin.
DROP POLICY IF EXISTS atividades_insert ON public.atividades;
DROP POLICY IF EXISTS atividades_update ON public.atividades;
DROP POLICY IF EXISTS atividades_delete ON public.atividades;

CREATE POLICY atividades_insert ON public.atividades
  FOR INSERT WITH CHECK (public.current_user_has_role(ARRAY['admin', 'gestor', 'consultor']));

CREATE POLICY atividades_update ON public.atividades
  FOR UPDATE USING (public.current_user_is_admin())
          WITH CHECK (public.current_user_is_admin());

CREATE POLICY atividades_delete ON public.atividades
  FOR DELETE USING (public.current_user_is_admin());

-- ============================================
-- Conferência
-- ============================================

-- Políticas de escrita presentes por tabela (esperado: 3, 3 e 3)
SELECT tablename,
       count(*) FILTER (WHERE cmd = 'INSERT') AS insert_policies,
       count(*) FILTER (WHERE cmd = 'UPDATE') AS update_policies,
       count(*) FILTER (WHERE cmd = 'DELETE') AS delete_policies
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('cronograma_atividades', 'processos', 'atividades')
 GROUP BY tablename
 ORDER BY tablename;

-- Qual o seu papel? Precisa ser admin, gestor ou consultor para escrever.
SELECT id, name, email, role FROM public.profiles WHERE id = auth.uid();
