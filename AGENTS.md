<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Workflow

### Before committing
```bash
npm run lint      # 0 errors, 0 warnings
npm run typecheck # 0 errors
npm run test      # 200 tests, all pass
npm run coverage  # ~79% stmts, 86% lines
npm run build     # static export must succeed
```

### Deploy
```bash
export CLOUDFLARE_API_TOKEN='...'  # token com permissão Cloudflare Pages: Edit
npm run deploy                       # build + deploy via wrangler
```
URL de produção: `https://pmo-licitacoes.pages.dev` (ou preview: `https://<hash>.pmo-licitacoes.pages.dev`)

## Arquitetura

### Static Export
- `output: "export"` em `next.config.ts` — sem SSR, middleware, API routes ou cookies
- Autenticação 100% client-side via `@supabase/supabase-js` com sessão em `localStorage`
- `pmo-dashboard/layout.tsx` usa estado `checkingAuth: true` para evitar flash da sidebar antes de verificar sessão
- Proteção server-side via Cloudflare Pages Function removida (ineficaz com localStorage)

### Localização
- Todas as labels em `src/lib/pt-br.ts` (dicionário centralizado)
- Erros do Supabase Auth mapeados em `src/lib/auth-errors.ts` com `translateAuthError()`
- Datas: usar `formatDateBR()` (date-only, parse manual YYYY-MM-DD) ou `formatDate()` (ISO/dates)

### ESLint (Next.js 16)
- `react-hooks/set-state-in-effect` — suprimido com `eslint-disable` block/line em padrões legítimos de data-fetching
- `@typescript-eslint/no-explicit-any` — preferir `Record<string, unknown>`, `unknown` em `catch`, ou tipos específicos

## Módulo Colaboradores

### Banco (Migration 00019)
- `colaboradores` — tabela principal (35 campos: identificação, funcionais, contatos, endereço, user_id)
- `colaborador_favoritos` — favoritos por usuário
- `colaborador_logs` — auditoria com JSONB de dados anteriores/novos
- `vw_aniversariantes` — view com periodo_aniversario (hoje/essa_semana/esse_mes)
- `vw_colaboradores_metricas` — view com contadores agregados
- `search_colaboradores(search_term)` — função de busca textual
- `responsaveis.colaborador_id` FK adicionada via alter table

### API (src/lib/colaboradores.ts)
| Função | Descrição |
|--------|-----------|
| `listColaboradores(supabase, filters?)` | Lista com filtros (search, unidade, cargo, situacao, regime) |
| `getColaborador(supabase, id)` | Detalhe com joins |
| `createColaborador(supabase, data)` | Cria com created_by/updated_by do usuário logado |
| `updateColaborador(supabase, id, data)` | Atualiza parcial |
| `deleteColaborador(supabase, id)` | Remove |
| `vincularUsuario/desvincularUsuario` | Vincula user_id (1:1) |
| `getColaboradorByUserId(supabase, userId)` | Busca por user_id |
| `listUsersWithoutColaborador(supabase)` | Para dropdown de vinculação |
| `listFavoritos/toggleFavorito/isFavorito` | Favoritos |
| `listAniversariantes(supabase, periodo?, unidade?)` | Da vw_aniversariantes |
| `getMetricas(supabase)` | Da vw_colaboradores_metricas |
| `listProcessosColaborador(supabase, id)` | Cruza user_id com processos/cronograma |

### Frontend
| Rota | Descrição |
|------|-----------|
| `/colaboradores` | Lista/agenda com busca, filtros, favoritos, métricas |
| `/colaboradores/[id]` | Ficha funcional completa com inline editing, vinculação, processos |
| `/colaboradores/novo` | Formulário de cadastro |
| `/colaboradores/aniversariantes` | Lista com filtro por período + unidade |
| Dashboard | `AniversariantesWidget` abaixo dos KPIs |

### LGPD
- CPF, endereço, email pessoal, celular → visível apenas para admin/gestor
- Demais perfis veem nome, unidade, cargo, email institucional, telefone/ramal

### Integração com Processos
- `responsaveis.colaborador_id` FK → permite exibir "Ver ficha" na view do processo
- `view-client.tsx` busca colaborador vinculado ao responsável e exibe cargo/unidade + link

## Módulo Bloco de Anotações

### Banco (Migration 00020)
- `notes` — tabela principal (id, user_id FK → profiles, title, content, priority enum, status enum, destacado, compartilhada, reminder_at TIMESTAMPTZ, tags TEXT[], processo_id FK, colaborador_id FK)
- Índices: user_id, status, priority, reminder_at, tags (GIN), processo_id, colaborador_id, created_at, destacado
- `search_notes(search_term, p_user_id)` — busca textual
- Trigger `update_notes_updated_at`
- Notas são privadas por user_id — cada usuário vê apenas as suas

### API (src/lib/notes.ts)
| Função | Descrição |
|--------|-----------|
| `listNotes(filters)` | Lista com filtros (status, priority, tag, dateRange, search, destacado) |
| `getNote(id)` | Detalhe por ID (with user_id check) |
| `createNote(data)` | Cria com user_id do usuário logado |
| `updateNote(id, data)` | Atualiza parcial |
| `archiveNote(id)` / `unarchiveNote(id)` | Alterna status |
| `deleteNote(id)` | Remove fisicamente |
| `getNoteCounts()` | Contagens: ativas, hoje, prioridade alta |
| `getTodayNotes()` | Notas do dia (alta prioridade, destacadas, lembrete hoje, tag "Hoje") |
| `getNotesByProcesso(id)` | Notas vinculadas a um processo |
| `getNotesByColaborador(id)` | Notas vinculadas a um colaborador |

### Frontend
| Rota | Descrição |
|------|-----------|
| `/notas` | Lista com toggle lista/cartões, filtros (prioridade, tag, status, data, busca) |
| `/notas/hoje` | Painel do Dia — notas com alta prioridade, destacadas, lembrete hoje, tag "Hoje" |
| Dashboard | `NotesWidget` — contagens ativas/hoje/alta + link "Ver Painel do Dia" |
| Processo view | `RelatedNotes` exibido após atividades, com botão "Nova" vinculado ao processo |
| Colaborador view | `RelatedNotes` exibido após processos associados |

### Integração
- Sidebar: "Notas" (StickyNote) + "Painel do Dia" (Sun) entre Colaboradores e Usuários
- _redirects: `/notas/hoje` explícita, `/notas/*` → `/notas`
- NoteModal aceita props `defaultProcessoId` e `defaultColaboradorId` para criação vinculada
- RelatedNotes aceita `processoId` ou `colaboradorId` para exibir anotações relacionadas

## Módulo Gestão de Contratos

### Banco (Migration 00022)
| Tabela | Descrição |
|--------|-----------|
| `contratos` | Contratos (38 campos: identificação, partes, valores, datas, gestão, status, documentos) |
| `ordens_servico` | Ordens de serviço vinculadas a contratos |
| `contrato_aditivos` | Aditivos (prazo, valor, reequilíbrio, apostilamento, prorrogação) |
| `contrato_medicoes` | Medições vinculadas a contratos e OS |
| `contrato_pagamentos` | Pagamentos vinculados a contratos, OS e medições |
| `contrato_documentos` | Documentos do contrato com checklist documental |
| `contrato_historico` | Audit trail de todas as operações |
- RLS: SELECT para todos autenticados; INSERT/UPDATE/DELETE por role

### API (src/lib/)
| Arquivo | Funções principais |
|---------|-------------------|
| `contratos.ts` | listContratos, getContrato, createContrato, updateContrato, deleteContrato, getContratoMetricas, computeContratoAlertas, computeSaldoContrato, computeDiasRestantes |
| `ordens-servico.ts` | listOrdensServico, getOrdemServico, createOrdemServico, updateOrdemServico, deleteOrdemServico, getMetricasOS |
| `contrato-aditivos.ts` | listAditivos, createAditivo, updateAditivo, deleteAditivo |
| `contrato-medicoes.ts` | listMedicoes, createMedicao, updateMedicao, deleteMedicao |
| `contrato-pagamentos.ts` | listPagamentos, createPagamento, updatePagamento, deletePagamento |
| `contrato-historico.ts` | logHistorico (usado internamente por todas as funções CRUD) |

### Frontend (14 páginas)
| Rota | Descrição |
|------|-----------|
| `/contratos` | Painel geral com métricas e cards de alerta |
| `/contratos/lista` | Lista completa com busca, filtros (status, fiscal, vigência) |
| `/contratos/novo` | Cadastro com herança de dados do processo |
| `/contratos/[id]` | Detalhe com 6 abas (Resumo, OS, Aditivos, Medições, Pagamentos, Histórico) |
| `/contratos/[id]/editar` | Edição completa |
| `/contratos/[id]/ordens-servico` | OS do contrato |
| `/contratos/[id]/aditivos` | Aditivos do contrato |
| `/contratos/[id]/medicoes` | Medições do contrato |
| `/contratos/[id]/pagamentos` | Pagamentos do contrato |
| `/contratos/relatorios` | 8 relatórios operacionais/financeiros com exportação CSV |
| `/ordens-servico` | Lista geral de OS |
| `/ordens-servico/nova` | Nova OS com vínculo a contrato vigente |
| `/ordens-servico/[id]` | Detalhe da OS |

### Integrações
- **Sidebar**: "Contratos" (FileSignature) entre Processos e Cronograma — badge vermelho com total de contratos vencidos + OS atrasadas
- **Processo detail**: Seção "Contratação" com botão "Criar Contrato" ou "Ver Contrato" + dados resumidos
- **Painel do Dia**: Alertas de contratos vencendo em 30 dias, OS atrasadas, medições aguardando análise
- **_redirects**: 18 regras para rotas dinâmicas de contratos, OS e subpáginas
- **Sidebar badges**: contratos vencidos + OS atrasadas contadas em tempo real

### Status records (src/types/contratos.ts)
- `CONTRATO_STATUS_RECORDS` — 9 status (minuta → rescindido) com labels e cores
- `OS_STATUS_RECORDS` — 9 status (rascunho → cancelada)
- `ADITIVO_TIPO_RECORDS` — 8 tipos
- `MEDICAO_STATUS_RECORDS` — 7 status
- `PAGAMENTO_STATUS_RECORDS` — 8 status
- `TIPO_DOCUMENTO_CONTRATO_RECORDS` — 12 tipos
