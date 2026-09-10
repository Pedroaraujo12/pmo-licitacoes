'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Edit, Trash2, ExternalLink, AlertTriangle, Download, Search } from 'lucide-react'
import DeleteConfirmDialog from '@/components/ui/delete-confirm-dialog'
import { formatBRL, exportCSV, fetchAllSeiLinks } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/components/ui/toast'
import Pagination from '@/components/ui/pagination'
import AniversariantesWidget from '@/components/ui/colaboradores/aniversariantes-widget'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import StatusCards from '@/components/dashboard/status-cards'
import KpiCards from '@/components/dashboard/kpi-cards'
import PrazoECiclo from '@/components/dashboard/prazo-e-ciclo'
import CargaETendencia from '@/components/dashboard/carga-e-tendencia'
import FilterChips, { type Chip } from '@/components/dashboard/filter-chips'
import { CORES, corDoStatus } from '@/lib/dashboard-tokens'
import {
  agruparPorFaixaDePrazo,
  agruparCargaPorResponsavel,
  agruparConcluidosPorMes,
  calcularLeadTimePorEtapa,
  mapearConclusaoPorCronograma,
  mapearEtapaAtualDoCronograma,
  mapearEtapasDoProcesso,
  diagnosticarAtividade,
  cronogramasNuncaIniciados,
  calcularTaxaHomologacao,
  calcularEconomiaPercentual,
  classificarPrazo,
  rotuloPrazo,
  isStatusConcluido,
  FAIXAS_PRAZO,
  ROTULO_FILTRO_PRAZO,
  combinaFiltroPrazo,
  type FiltroPrazo,
  type AtividadeCronograma,
} from '@/lib/dashboard-metrics'

interface DashboardSummary {
  total_processos: number
  processos_atrasados: number
  processos_vencendo_7_dias: number
  valor_estimado_total: number
  valor_homologado_total: number
  economia_total: number
  por_status: { status: string | null; total: number; valor_estimado: number; valor_homologado: number }[]
  por_modalidade: { modalidade: string | null; total: number }[]
  etapa_distribuicao: { fase: string | null; qtd: number }[]
  aniversariantes_15_dias: { id: string; nome: string; dia: number; mes: number; unidade: string | null }[]
}

interface ProcessoRow {
  id: string
  id_processo: string
  objeto_resumido: string
  data_entrada: string
  data_entrega: string
  valor_estimado: number
  valor_homologado: number
  prioridade: string
  atividade_atual: string | null
  observacoes: string | null
  status_nome: string
  modalidade_nome: string
  responsavel_nome: string
  coordenacao_nome: string
  demandante_nome: string
  total_count: number
  /** Derivada do fim da última atividade de cronograma concluída. */
  data_conclusao?: string | null
}

/* Doze linhas por página em vez de cinco: com 5, uma carteira de 74 processos
   virava 15 páginas para folhear. */
const PAGE_SIZE = 12

/* Teto herdado do carregamento que já existia para o gráfico por responsável.
   Acima disso a agregação no cliente precisaria virar RPC. */
const TETO_CARREGAMENTO = 1000

/* As atividades de cronograma alimentam o tempo por etapa e a data de
   conclusão. São ~19 por processo, então a carteira atual (74 processos, 261
   atividades concluídas) cabe folgado — mas o PostgREST corta em 1000 por
   padrão, e um corte silencioso aqui viraria média calculada sobre parte dos
   dados. O teto fica explícito e a tela avisa quando encostar nele. */
const TETO_ATIVIDADES = 5000

const PRIORIDADES = ['Baixa', 'Média', 'Alta', 'Urgente']

export default function DashboardContent({ userRole }: { userRole?: string | null }) {
  const { toast } = useToast()
  const router = useRouter()

  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [summaryError, setSummaryError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [todos, setTodos] = useState<ProcessoRow[]>([])
  const [atividades, setAtividades] = useState<(AtividadeCronograma & { processo_id: string; ordem: number })[]>([])
  const [loadingSummary, setLoadingSummary] = useState(true)
  const summaryResolved = useRef(false)
  const [loadingRows, setLoadingRows] = useState(true)
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 200)
  const [modalidadeFilter, setModalidadeFilter] = useState('')
  const [prioridadeFilter, setPrioridadeFilter] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [prazoFilter, setPrazoFilter] = useState<FiltroPrazo | null>(null)
  const [page, setPage] = useState(1)
  const [seiLinks, setSeiLinks] = useState<Record<string, string>>({})

  const [modalProcesso, setModalProcesso] = useState<ProcessoRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProcessoRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const canEdit = Boolean(userRole && ['admin', 'gestor', 'consultor'].includes(userRole))
  const canDelete = Boolean(userRole && ['admin', 'gestor'].includes(userRole))

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }, [])

  /* `hoje` fixado no carregamento: todas as contas de prazo têm que usar a
     mesma referência, senão um render à meia-noite muda o número no meio da
     tela. Só anda quando os dados são recarregados. */
  const [hoje, setHoje] = useState(() => new Date())

  const recarregar = useCallback(() => {
    setHoje(new Date())
    setReloadKey(k => k + 1)
  }, [])

  /* Todo filtro volta para a primeira página. Sem isso, filtrar estando na
     página 7 mostra uma tabela vazia sem explicar por quê. */
  function comReset<T>(set: (valor: T) => void) {
    return (valor: T) => { set(valor); setPage(1) }
  }
  const aplicarBusca = comReset(setSearch)
  const aplicarStatus = comReset<string | null>(setStatusFilter)
  const aplicarPrazo = comReset<FiltroPrazo | null>(setPrazoFilter)
  const aplicarResponsavel = comReset<string | null>(setResponsavelFilter)
  const aplicarModalidade = comReset(setModalidadeFilter)
  const aplicarPrioridade = comReset(setPrioridadeFilter)

  // --- Indicadores agregados -------------------------------------------------
  useEffect(() => {
    let cancelled = false
    summaryResolved.current = false
    setSummaryError(false) /* eslint-disable-line react-hooks/set-state-in-effect */
    setLoadingSummary(true)
    const watchdog = window.setTimeout(() => {
      if (!cancelled && !summaryResolved.current) setSummaryError(true)
      if (!cancelled) setLoadingSummary(false)
    }, 12000)
    getSupabase().rpc('get_dashboard_summary').then(
      ({ data, error }: { data: DashboardSummary | null; error: unknown }) => {
        if (cancelled) return
        if (error) {
          console.warn('Dashboard summary RPC error:', error)
          setSummaryError(true)
        } else if (data) {
          summaryResolved.current = true
          setSummary(data)
          setAtualizadoEm(new Date())
        } else {
          setSummaryError(true)
        }
        setLoadingSummary(false)
      },
      (err: unknown) => {
        if (cancelled) return
        console.warn('Dashboard summary failure:', err)
        setSummaryError(true)
        setLoadingSummary(false)
      },
    )
    return () => { cancelled = true; window.clearTimeout(watchdog) }
  }, [reloadKey, getSupabase])

  /* Carteira inteira numa chamada só. A versão anterior já buscava 1000 linhas
     para montar o gráfico por responsável e ainda fazia uma segunda chamada
     paginada a cada tecla digitada — agora busca uma vez e deriva tudo daqui:
     faixas de prazo, carga, tendência, tabela e busca. */
  useEffect(() => {
    let cancelled = false
    setLoadingRows(true) /* eslint-disable-line react-hooks/set-state-in-effect */
    const supabase = getSupabase()

    ;(async () => {
      try {
        const [processos, cronograma] = await Promise.all([
          supabase.rpc('search_processos', { p_limit: TETO_CARREGAMENTO, p_offset: 0 }),
          supabase
            .from('cronograma_atividades')
            /* Todas as etapas, nao so as concluidas: o tempo por etapa usa as
               concluidas (e filtra sozinho), mas o diagnostico de aderencia
               precisa das pendentes para saber qual etapa o cronograma aponta
               e quais existem no rito do processo. */
            .select('processo_id, fase, descricao, status, ordem, data_inicio, data_fim')
            .limit(TETO_ATIVIDADES),
        ])
        if (cancelled) return

        const ativs = (cronograma.data as (AtividadeCronograma & { processo_id: string; ordem: number })[] | null) || []
        const conclusao = mapearConclusaoPorCronograma(ativs)
        const linhas = ((processos.data as ProcessoRow[] | null) || []).map(p => ({
          ...p,
          data_conclusao: conclusao.get(p.id) ?? null,
        }))

        setTodos(linhas)
        setAtividades(ativs)
      } catch (err) {
        if (!cancelled) console.warn('Falha ao carregar processos do dashboard:', err)
      } finally {
        if (!cancelled) setLoadingRows(false)
      }
    })()

    return () => { cancelled = true }
  }, [reloadKey, getSupabase])

  useEffect(() => {
    fetchAllSeiLinks(getSupabase()).then(setSeiLinks).catch(() => setSeiLinks({}))
  }, [getSupabase])

  // --- Atalho de busca, na tecla certa para a plataforma ---------------------
  const searchRef = useRef<HTMLInputElement>(null)
  const [isMac, setIsMac] = useState(false)
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent)) /* eslint-disable-line react-hooks/set-state-in-effect */
  }, [])
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalProcesso(null)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // --- Derivações ------------------------------------------------------------
  const estimadoConcluidos = useMemo(
    () => (summary?.por_status || [])
      .filter(s => isStatusConcluido(s.status))
      .reduce((soma, s) => soma + s.valor_estimado, 0),
    [summary],
  )

  const taxaHomologacao = calcularTaxaHomologacao(
    summary?.valor_estimado_total || 0,
    summary?.valor_homologado_total || 0,
  )
  const economiaPercentual = calcularEconomiaPercentual(summary?.economia_total || 0, estimadoConcluidos)

  const faixasPrazo = useMemo(() => agruparPorFaixaDePrazo(todos, hoje), [todos, hoje])
  const carga = useMemo(() => agruparCargaPorResponsavel(todos, hoje), [todos, hoje])
  const concluidosPorMes = useMemo(
    () => agruparConcluidosPorMes(
      todos.map(p => ({ status_nome: p.status_nome, data_conclusao: p.data_conclusao ?? null })),
      hoje,
    ),
    [todos, hoje],
  )
  const leadTime = useMemo(() => calcularLeadTimePorEtapa(atividades), [atividades])
  /* Aderência entre o que o processo declara e o que o cronograma aponta.
     Depois da migração para os ritos DIOP, o texto de muitos processos ficou
     no rito antigo — sem isso na tela, ninguém tem como saber qual das duas
     respostas está velha. */
  const etapaAtual = useMemo(() => mapearEtapaAtualDoCronograma(atividades), [atividades])
  const etapasPorProcesso = useMemo(() => mapearEtapasDoProcesso(atividades), [atividades])
  const ritosParados = useMemo(() => cronogramasNuncaIniciados(atividades), [atividades])

  const diagnosticoPorProcesso = useMemo(() => {
    const m = new Map<string, ReturnType<typeof diagnosticarAtividade>>()
    for (const p of todos) {
      m.set(p.id, diagnosticarAtividade(p.id, p.atividade_atual, etapaAtual, etapasPorProcesso))
    }
    return m
  }, [todos, etapaAtual, etapasPorProcesso])

  const foraDoRito = useMemo(
    () => todos.filter(p => diagnosticoPorProcesso.get(p.id)?.aderencia === 'fora_do_rito').length,
    [todos, diagnosticoPorProcesso],
  )
  const semDeclarar = useMemo(
    () => todos.filter(p => diagnosticoPorProcesso.get(p.id)?.aderencia === 'nao_declarada').length,
    [todos, diagnosticoPorProcesso],
  )
  const ritosParadosEmAndamento = useMemo(
    () => todos.filter(p => (p.status_nome || '').trim() === 'Em andamento' && ritosParados.has(p.id)).length,
    [todos, ritosParados],
  )

  /* Quantos concluídos têm cronograma registrado — o gráfico de tendência só
     enxerga esses, e omitir isso faria a série parecer mais rasa do que é. */
  const concluidosComData = useMemo(
    () => todos.filter(p => isStatusConcluido(p.status_nome) && p.data_conclusao).length,
    [todos],
  )

  const atrasados = summary?.processos_atrasados ?? faixasPrazo.filter(f => f.atrasada).reduce((s, f) => s + f.total, 0)
  const totalProcessos = summary?.total_processos ?? todos.length
  const concluidos = (summary?.por_status || []).filter(s => isStatusConcluido(s.status)).reduce((s, x) => s + x.total, 0)
  const acimaDoTeto = todos.length >= TETO_CARREGAMENTO
  const atividadesNoTeto = atividades.length >= TETO_ATIVIDADES

  // --- Filtros ---------------------------------------------------------------
  const filtrados = useMemo(() => {
    const termo = debouncedSearch.trim().toLowerCase()
    return todos.filter(p => {
      if (statusFilter !== null && (p.status_nome || '').trim() !== statusFilter) return false
      if (responsavelFilter && ((p.responsavel_nome || '').trim() || 'Sem responsável') !== responsavelFilter) return false
      if (modalidadeFilter && (p.modalidade_nome || '').trim() !== modalidadeFilter) return false
      if (prioridadeFilter && (p.prioridade || '').trim() !== prioridadeFilter) return false
      if (prazoFilter && !combinaFiltroPrazo(classificarPrazo(p, hoje), prazoFilter)) return false
      if (termo) {
        const alvo = `${p.id_processo || ''} ${p.objeto_resumido || ''} ${p.responsavel_nome || ''}`.toLowerCase()
        if (!alvo.includes(termo)) return false
      }
      return true
    })
  }, [todos, statusFilter, responsavelFilter, modalidadeFilter, prioridadeFilter, prazoFilter, debouncedSearch, hoje])

  const totalCount = filtrados.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const paginaAtual = Math.min(page, totalPages)
  const rows = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE)
  const somaFiltrada = filtrados.reduce((s, p) => s + (Number(p.valor_estimado) || 0), 0)

  function limparTudo() {
    setSearch('')
    setModalidadeFilter('')
    setPrioridadeFilter('')
    setResponsavelFilter(null)
    setStatusFilter(null)
    setPrazoFilter(null)
    setPage(1)
  }

  const chips: Chip[] = []
  if (statusFilter !== null) chips.push({ chave: 'status', rotulo: `Status: ${statusFilter || 'Sem status'}`, onRemove: () => aplicarStatus(null) })
  if (prazoFilter) chips.push({
    chave: 'prazo',
    rotulo: ROTULO_FILTRO_PRAZO[prazoFilter] || 'Prazo',
    onRemove: () => aplicarPrazo(null),
  })
  if (responsavelFilter) chips.push({ chave: 'resp', rotulo: `Responsável: ${responsavelFilter}`, onRemove: () => aplicarResponsavel(null) })
  if (modalidadeFilter) chips.push({ chave: 'mod', rotulo: modalidadeFilter, onRemove: () => aplicarModalidade('') })
  if (prioridadeFilter) chips.push({ chave: 'pri', rotulo: `Prioridade ${prioridadeFilter}`, onRemove: () => aplicarPrioridade('') })
  if (debouncedSearch.trim()) chips.push({ chave: 'q', rotulo: `Busca: "${debouncedSearch.trim()}"`, onRemove: () => aplicarBusca('') })

  function irParaAtrasados() {
    setStatusFilter(null)
    aplicarPrazo('atrasados')
    document.getElementById('prazos')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await getSupabase().from('processos').delete().eq('id', deleteTarget.id)
      if (error) {
        console.warn('Erro ao excluir:', error)
        setDeleting(false)
        return
      }
      toast('Processo excluído com sucesso', 'success')
      setTodos(prev => prev.filter(p => p.id !== deleteTarget.id))
      setDeleteTarget(null)
      setDeleting(false)
    } catch (err) {
      console.warn('Erro inesperado ao excluir:', err)
      setDeleting(false)
    }
  }

  const carregando = loadingSummary || loadingRows

  return (
    <div>
      {/* Cabeçalho da página — a versão anterior não tinha título nem carimbo
          de atualização: a única pista de onde você estava era o item aceso
          no menu, e nada dizia de quando eram os números. */}
      <header
        style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 20, flexWrap: 'wrap', marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.015em', color: CORES.ink }}>
            Dashboard
          </h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '5px 0 0', fontSize: 12, color: CORES.ink3 }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: carregando ? CORES.warning : CORES.good }} />
            {atualizadoEm
              ? `Atualizado em ${atualizadoEm.toLocaleDateString('pt-BR')} às ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : 'Carregando indicadores…'}
          </p>
        </div>
        <button
          type="button"
          onClick={recarregar}
          style={{
            background: CORES.surface2, border: `1px solid ${CORES.line}`, color: CORES.ink2,
            borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Atualizar agora
        </button>
      </header>

      {/* O alerta agora aponta para um gráfico que existe. */}
      {atrasados > 0 && (
        <div
          role="alert"
          style={{
            display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap',
            padding: '12px 16px', borderRadius: 12, marginBottom: 20,
            background: 'linear-gradient(90deg, #2a1420, #1a1526 60%, ' + CORES.surface + ')',
            border: '1px solid #4a2530', borderLeft: `3px solid ${CORES.critical}`,
          }}
        >
          <AlertTriangle size={19} style={{ color: CORES.critical, flexShrink: 0 }} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: 13.5, color: CORES.ink }}>
            <strong style={{ fontWeight: 800 }}>
              {atrasados} processo{atrasados !== 1 ? 's' : ''} em atraso
            </strong>
            {(() => {
              const graves = faixasPrazo.find(f => f.faixa === 'atraso_acima_30')?.total || 0
              return graves > 0 ? `, sendo ${graves} com mais de 30 dias` : ''
            })()}
            {' — veja a distribuição por faixa de prazo abaixo.'}
          </p>
          <button
            type="button"
            onClick={irParaAtrasados}
            style={{
              marginLeft: 'auto', background: CORES.critical, border: `1px solid ${CORES.critical}`,
              color: '#2a0d12', borderRadius: 8, padding: '7px 12px',
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Ver os {atrasados} atrasados
          </button>
        </div>
      )}

      {/* A divergencia entre o texto declarado e o cronograma nao aparecia em
          lugar nenhum: era preciso abrir processo a processo para descobrir. */}
      {!loadingRows && (foraDoRito > 0 || semDeclarar > 0 || ritosParadosEmAndamento > 0) && (
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap',
            padding: '11px 16px', borderRadius: 12, marginBottom: 20,
            background: CORES.surface, border: `1px solid ${CORES.line}`,
            borderLeft: `3px solid ${CORES.warning}`,
          }}
        >
          <AlertTriangle size={17} style={{ color: CORES.warning, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, color: CORES.ink }}>
              <strong style={{ fontWeight: 700 }}>Atividade atual e cronograma divergem.</strong>{' '}
              {foraDoRito > 0 && `${foraDoRito} processo${foraDoRito === 1 ? ' declara uma etapa que não existe' : 's declaram uma etapa que não existe'} no próprio rito`}
              {foraDoRito > 0 && (semDeclarar > 0 || ritosParadosEmAndamento > 0) && '; '}
              {semDeclarar > 0 && `${semDeclarar} não ${semDeclarar === 1 ? 'declara' : 'declaram'} atividade`}
              {semDeclarar > 0 && ritosParadosEmAndamento > 0 && '; '}
              {ritosParadosEmAndamento > 0 && `${ritosParadosEmAndamento} em andamento com cronograma sem nenhuma etapa concluída`}.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11.5, color: CORES.ink3 }}>
              Enquanto divergirem, a coluna Atividade atual e o tempo por etapa falam de coisas diferentes.
              A coluna marca cada caso; abrir o processo mostra a etapa que o cronograma aponta.
            </p>
          </div>
        </div>
      )}

      {summaryError ? (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            background: CORES.surface, border: `1px solid ${CORES.lineSoft}`,
            borderRadius: 12, padding: '16px 18px', marginBottom: 20,
          }}
        >
          <p style={{ margin: 0, fontSize: 12.5, color: CORES.ink2 }}>
            Não foi possível carregar os indicadores do dashboard.
          </p>
          <button
            type="button"
            onClick={recarregar}
            style={{
              background: CORES.accentDim, border: 'none', color: '#fff', borderRadius: 8,
              padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <section style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 11 }}>
            <h2 style={{
              margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.11em',
              textTransform: 'uppercase', color: CORES.ink2,
            }}>Indicadores da carteira</h2>
          </div>
          <KpiCards
            atrasados={atrasados}
            total={totalProcessos}
            taxaHomologacao={taxaHomologacao}
            estimadoTotal={summary?.valor_estimado_total || 0}
            homologadoTotal={summary?.valor_homologado_total || 0}
            economia={summary?.economia_total || 0}
            economiaPercentual={economiaPercentual}
            concluidos={concluidos}
            onVerAtrasados={irParaAtrasados}
          />
        </section>
      )}

      <div id="prazos">
        <PrazoECiclo
          faixas={faixasPrazo}
          leadTime={leadTime}
          faixaSelecionada={prazoFilter}
          onSelecionarFaixa={aplicarPrazo}
          carregando={loadingRows}
        />
      </div>

      {summary && (
        <StatusCards
          porStatus={summary.por_status}
          totalEstimado={summary.valor_estimado_total}
          totalHomologado={summary.valor_homologado_total}
          totalProcessos={summary.total_processos}
          economia={summary.economia_total}
          taxaHomologacao={taxaHomologacao}
          selected={statusFilter}
          onSelect={aplicarStatus}
        />
      )}

      <CargaETendencia
        porResponsavel={carga}
        concluidosPorMes={concluidosPorMes}
        concluidosComData={concluidosComData}
        concluidosTotal={concluidos}
        responsavelSelecionado={responsavelFilter}
        onSelecionarResponsavel={aplicarResponsavel}
        carregando={loadingRows}
      />

      {/* Fluxo de execução */}
      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 11 }}>
          <h2 style={{
            margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.11em',
            textTransform: 'uppercase', color: CORES.ink2,
          }}>Fluxo de execução</h2>
          <span style={{ fontSize: 11.5, color: CORES.ink3 }}>
            {totalCount} processo{totalCount === 1 ? '' : 's'} · {formatBRL(somaFiltrada)} estimados
          </span>
        </div>

        <div style={{ background: CORES.surface, border: `1px solid ${CORES.lineSoft}`, borderRadius: 12, overflow: 'hidden' }}>
          {/* Uma barra de filtros só, com chips do que está ativo. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', padding: '11px 14px' }}>
            <label
              style={{
                flex: '1 1 250px', minWidth: 180, display: 'flex', alignItems: 'center', gap: 8,
                background: CORES.surface2, border: `1px solid ${CORES.line}`, borderRadius: 8, padding: '0 11px',
              }}
            >
              <Search size={15} style={{ color: CORES.ink3, flexShrink: 0 }} aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={e => aplicarBusca(e.target.value)}
                placeholder="Buscar por ID, objeto ou responsável"
                aria-label="Buscar processos"
                style={{
                  flex: 1, background: 'none', border: 0, color: CORES.ink,
                  font: 'inherit', fontSize: 13, padding: '8px 0', outline: 'none', minWidth: 0,
                }}
              />
              <kbd style={{
                fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 10.5, color: CORES.ink3,
                background: CORES.surface3, borderRadius: 4, padding: '2px 5px', flexShrink: 0,
              }}>{isMac ? '⌘ K' : 'Ctrl K'}</kbd>
            </label>

            <select
              value={modalidadeFilter}
              onChange={e => aplicarModalidade(e.target.value)}
              aria-label="Filtrar por modalidade"
              style={selectStyle}
            >
              <option value="">Modalidade</option>
              {summary?.por_modalidade.filter(m => m.modalidade).map(m => (
                <option key={m.modalidade} value={m.modalidade || ''}>{m.modalidade}</option>
              ))}
            </select>

            <select
              value={prioridadeFilter}
              onChange={e => aplicarPrioridade(e.target.value)}
              aria-label="Filtrar por prioridade"
              style={selectStyle}
            >
              <option value="">Prioridade</option>
              {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <select
              value={prazoFilter || ''}
              onChange={e => aplicarPrazo((e.target.value || null) as FiltroPrazo | null)}
              aria-label="Filtrar por prazo"
              style={selectStyle}
            >
              <option value="">Prazo</option>
              <option value="atrasados">Em atraso (todas as faixas)</option>
              {FAIXAS_PRAZO.map(f => <option key={f.faixa} value={f.faixa}>{f.rotulo}</option>)}
              <option value="no_prazo">No prazo</option>
              <option value="sem_prazo">Sem prazo definido</option>
            </select>

            {rows.length > 0 && (
              <button
                type="button"
                onClick={() => exportCSV(filtrados.map(p => ({
                  'ID Processo': p.id_processo || '',
                  'Objeto': p.objeto_resumido || '',
                  'Status': p.status_nome || '',
                  'Responsável': p.responsavel_nome || '',
                  'Atividade Atual': p.atividade_atual || '',
                  'Prazo': rotuloPrazo(p, hoje).texto,
                  'Valor Estimado': p.valor_estimado,
                })), 'processos_dashboard')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: CORES.surface2, border: `1px solid ${CORES.line}`, color: CORES.ink2,
                  borderRadius: 8, padding: '7px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Download size={13} aria-hidden="true" /> CSV
              </button>
            )}
          </div>

          <FilterChips chips={chips} onLimparTudo={limparTudo} />

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900, textAlign: 'left' }}>
              <thead>
                <tr>
                  <Th>Processo</Th>
                  <Th>Objeto / atividade atual</Th>
                  <Th>Status</Th>
                  <Th>Responsável</Th>
                  <Th>Prazo</Th>
                  <Th alinhar="right">Estimado</Th>
                  {canEdit && <Th alinhar="right">Ações</Th>}
                </tr>
              </thead>
              <tbody>
                {loadingRows ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={canEdit ? 7 : 6} style={{ padding: '12px 13px', borderBottom: `1px solid ${CORES.lineSoft}` }}>
                        <div className="animate-pulse" style={{ height: 12, background: CORES.surface3, borderRadius: 4, width: `${90 - i * 6}%` }} />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} style={{ padding: '26px 13px', color: CORES.ink3, fontSize: 12.5 }}>
                      Nenhum processo atende a esses filtros. Remova um chip acima para ampliar a busca.
                    </td>
                  </tr>
                ) : rows.map(p => {
                  const prazo = rotuloPrazo(p, hoje)
                  const corPrazo = prazo.tom === 'atraso' ? CORES.critical : prazo.tom === 'alerta' ? CORES.warning : CORES.ink3
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setModalProcesso(p)}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = CORES.surface2 }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <Td>
                        <a
                          href={seiLinks[p.id] || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => { e.stopPropagation(); if (!seiLinks[p.id]) e.preventDefault() }}
                          title={seiLinks[p.id] ? 'Abrir no SEI' : 'Link SEI não cadastrado'}
                          style={{
                            fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 11.5,
                            color: CORES.accent, whiteSpace: 'nowrap', textDecoration: 'none',
                          }}
                        >
                          {p.id_processo || '-'}
                        </a>
                      </Td>
                      <Td>
                        <span style={{ display: 'block', fontWeight: 600, color: CORES.ink, maxWidth: '34ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.objeto_resumido || '-'}>
                          {p.objeto_resumido || '-'}
                        </span>
                        {(() => {
                          const d = diagnosticoPorProcesso.get(p.id)
                          const divergente = d?.aderencia === 'fora_do_rito' || d?.aderencia === 'outra_etapa'
                          const titulo = d?.etapaDoCronograma
                            ? `Declarado: ${p.atividade_atual || '—'}
Cronograma aponta: ${d.etapaDoCronograma}`
                            : (p.atividade_atual || 'Sem atividade atual')
                          return (
                            <span
                              title={titulo}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
                                color: p.atividade_atual ? CORES.ink2 : CORES.ink3,
                                maxWidth: '34ch',
                              }}
                            >
                              {divergente && (
                                <i
                                  aria-label="Diverge do cronograma"
                                  style={{
                                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                                    background: CORES.warning,
                                  }}
                                />
                              )}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.atividade_atual || 'Sem atividade atual'}
                              </span>
                            </span>
                          )
                        })()}
                      </Td>
                      <Td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                          fontSize: 11, fontWeight: 700, padding: '2px 9px 2px 7px', borderRadius: 999,
                          background: CORES.surface3, color: CORES.ink2,
                        }}>
                          <i aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: corDoStatus(p.status_nome), flexShrink: 0 }} />
                          {p.status_nome || 'Sem status'}
                        </span>
                      </Td>
                      <Td>
                        {p.responsavel_nome
                          ? <span style={{ color: CORES.ink2 }}>{p.responsavel_nome}</span>
                          : <span style={{ color: CORES.ink3 }}>não atribuído</span>}
                      </Td>
                      <Td>
                        <span style={{ fontSize: 11.5, fontWeight: prazo.tom === 'neutro' ? 600 : 700, color: corPrazo, whiteSpace: 'nowrap' }}>
                          {prazo.tom === 'atraso' && '▲ '}{prazo.texto}
                        </span>
                      </Td>
                      <Td alinhar="right">
                        {p.valor_estimado > 0
                          ? <span style={{ color: CORES.ink, fontWeight: 600 }}>{formatBRL(p.valor_estimado)}</span>
                          : <span style={{ color: CORES.ink3 }}>não informado</span>}
                      </Td>
                      {canEdit && (
                        <Td alinhar="right">
                          <span style={{ display: 'inline-flex', gap: 2, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                            <IconBtn label="Ver detalhes" cor={CORES.accent} onClick={() => setModalProcesso(p)}><ExternalLink size={14} /></IconBtn>
                            <IconBtn label="Editar" cor="#d9a441" onClick={() => router.push(`/pmo-dashboard/processos/editar?id=${p.id}`)}><Edit size={14} /></IconBtn>
                            {canDelete && (
                              <IconBtn label="Excluir" cor={CORES.critical} onClick={() => setDeleteTarget(p)}><Trash2 size={14} /></IconBtn>
                            )}
                          </span>
                        </Td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={paginaAtual}
            totalPages={totalPages}
            total={totalCount}
            showingFrom={totalCount === 0 ? 0 : (paginaAtual - 1) * PAGE_SIZE + 1}
            showingTo={Math.min(paginaAtual * PAGE_SIZE, totalCount)}
            onPageChange={setPage}
            compact
          />
        </div>

        {acimaDoTeto && (
          <p style={{ margin: '8px 0 0', fontSize: 11, color: CORES.ink3 }}>
            Exibindo os primeiros {TETO_CARREGAMENTO} processos da carteira.
          </p>
        )}
        {atividadesNoTeto && (
          <p style={{ margin: '8px 0 0', fontSize: 11, color: CORES.warning }}>
            O tempo por etapa está calculado sobre as primeiras {TETO_ATIVIDADES} atividades
            concluídas — a média pode não refletir a carteira inteira.
          </p>
        )}
      </section>

      {/* Aniversariantes e modalidade saem da faixa nobre: informação de apoio,
          peso visual de apoio. */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 8 }}>
        <ErrorBoundary><AniversariantesWidget /></ErrorBoundary>
        <div className="lg:col-span-2" style={{ background: CORES.surface, border: `1px solid ${CORES.lineSoft}`, borderRadius: 12, padding: '15px 17px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 12.5, fontWeight: 700, color: CORES.ink }}>Distribuição por modalidade</h2>
          {/* Quatro categorias não justificam um gráfico: os números com a
              participação ao lado leem mais rápido no mesmo espaço. */}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {/* Sem corte: sao 6 modalidades cadastradas e o corte anterior era
                em 6 — a proxima cadastrada sumiria da lista sem aviso, como
                aconteceu com o 11o responsavel. */}
            {(summary?.por_modalidade || []).map(m => {
              const nome = m.modalidade || 'Sem modalidade'
              const share = totalProcessos > 0 ? (m.total / totalProcessos) * 100 : 0
              const ativo = modalidadeFilter === nome
              return (
                <li key={nome}>
                  <button
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => aplicarModalidade(ativo ? '' : (m.modalidade || ''))}
                    style={{
                      width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 46px 56px',
                      alignItems: 'center', gap: 12, background: 'none', border: 0, padding: '2px 0',
                      cursor: 'pointer', font: 'inherit', textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <span style={{ fontSize: 12, color: ativo ? CORES.ink : CORES.ink2, fontWeight: ativo ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {nome}
                      </span>
                      <span style={{ display: 'block', height: 4, borderRadius: 2, background: CORES.surface3, overflow: 'hidden' }}>
                        <i style={{ display: 'block', height: '100%', width: `${share.toFixed(1)}%`, background: CORES.accentDim, borderRadius: 2 }} />
                      </span>
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: CORES.ink, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m.total}</span>
                    <span style={{ fontSize: 11.5, color: CORES.ink3, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{share.toFixed(0)}%</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {modalProcesso && (
        <div
          role="dialog" aria-modal="true" aria-label="Detalhes do processo"
          onClick={() => setModalProcesso(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100, padding: 16,
            background: 'rgba(9,13,24,0.82)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
              background: CORES.surface, border: `1px solid ${CORES.line}`, borderRadius: 14, overflow: 'hidden',
            }}
          >
            <div style={{ padding: 20, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
              <Campo rotulo="Objeto" valor={modalProcesso.objeto_resumido || '-'} largo />
              <Campo rotulo="ID" valor={modalProcesso.id_processo || '-'} />
              <Campo rotulo="Status" valor={modalProcesso.status_nome || '-'} cor={corDoStatus(modalProcesso.status_nome)} />
              <Campo rotulo="Prazo" valor={rotuloPrazo(modalProcesso, hoje).texto} />
              <Campo rotulo="Responsável" valor={modalProcesso.responsavel_nome || 'Não atribuído'} />
              <Campo rotulo="Coordenação" valor={modalProcesso.coordenacao_nome || '-'} />
              <Campo rotulo="Modalidade" valor={modalProcesso.modalidade_nome || '-'} />
              <Campo rotulo="Estimado" valor={modalProcesso.valor_estimado > 0 ? formatBRL(modalProcesso.valor_estimado) : 'Não informado'} />
              <Campo rotulo="Homologado" valor={modalProcesso.valor_homologado > 0 ? formatBRL(modalProcesso.valor_homologado) : 'Não informado'} />
              <Campo rotulo="Demandante" valor={modalProcesso.demandante_nome || '-'} largo />
              <Campo rotulo="Atividade atual" valor={modalProcesso.atividade_atual || 'Sem atividade atual'} largo />
              <Campo rotulo="Observações" valor={modalProcesso.observacoes || 'Sem observações'} largo />
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${CORES.lineSoft}`, display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
              <BotaoModal cor={CORES.accentDim} onClick={() => router.push(`/pmo-dashboard/processos/detalhe?id=${modalProcesso.id}`)}>
                <ExternalLink size={13} aria-hidden="true" /> Ver detalhes
              </BotaoModal>
              {canEdit && (
                <BotaoModal cor="#b8871f" onClick={() => router.push(`/pmo-dashboard/processos/editar?id=${modalProcesso.id}`)}>
                  <Edit size={13} aria-hidden="true" /> Editar
                </BotaoModal>
              )}
              {canDelete && (
                <BotaoModal cor="#b8323f" onClick={() => { setDeleteTarget(modalProcesso); setModalProcesso(null) }}>
                  <Trash2 size={13} aria-hidden="true" /> Excluir
                </BotaoModal>
              )}
              <BotaoModal cor={CORES.surface3} onClick={() => setModalProcesso(null)}>Fechar</BotaoModal>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleting(false) }}
        onConfirm={handleDelete}
        loading={deleting}
        titulo="Excluir Processo"
        mensagem={`Tem certeza que deseja excluir o processo "${deleteTarget?.id_processo}"? Esta ação é irreversível.`}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

const selectStyle: React.CSSProperties = {
  background: CORES.surface2, border: `1px solid ${CORES.line}`, color: CORES.ink2,
  borderRadius: 8, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', outline: 'none',
}

function Th({ children, alinhar = 'left' }: { children: React.ReactNode; alinhar?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      style={{
        position: 'sticky', top: 0, zIndex: 1, background: CORES.surface2,
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: CORES.ink3, textAlign: alinhar, padding: '9px 13px', whiteSpace: 'nowrap',
        borderBottom: `1px solid ${CORES.line}`,
      }}
    >
      {children}
    </th>
  )
}

function Td({ children, alinhar = 'left' }: { children: React.ReactNode; alinhar?: 'left' | 'right' }) {
  return (
    <td style={{
      padding: '10px 13px', fontSize: 12.5, textAlign: alinhar, verticalAlign: 'top',
      borderBottom: `1px solid ${CORES.lineSoft}`,
      fontVariantNumeric: alinhar === 'right' ? 'tabular-nums' : undefined,
      whiteSpace: alinhar === 'right' ? 'nowrap' : undefined,
    }}>
      {children}
    </td>
  )
}

function IconBtn({ children, label, cor, onClick }: { children: React.ReactNode; label: string; cor: string; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick} title={label} aria-label={label}
      style={{ padding: 6, borderRadius: 6, color: cor, background: 'transparent', border: 0, cursor: 'pointer', lineHeight: 0 }}
    >
      {children}
    </button>
  )
}

function Campo({ rotulo, valor, largo, cor }: { rotulo: string; valor: string; largo?: boolean; cor?: string }) {
  return (
    <div style={{
      gridColumn: largo ? '1 / -1' : undefined,
      background: CORES.surface2, border: `1px solid ${CORES.lineSoft}`, borderRadius: 10, padding: '10px 12px',
    }}>
      <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: CORES.ink3 }}>{rotulo}</p>
      <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: cor || CORES.ink, whiteSpace: 'pre-wrap' }}>{valor}</p>
    </div>
  )
}

function BotaoModal({ children, cor, onClick }: { children: React.ReactNode; cor: string; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, background: cor, border: 0,
        color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
