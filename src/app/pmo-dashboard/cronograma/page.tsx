'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useDebounce } from '@/hooks/useDebounce'
import { fetchAllSeiLinks, formatDate, formatBRL } from '@/lib/utils'
import {
  listarCronogramaCompleto, calcularDistribuicaoEtapas, distribuicaoComModelo,
  modalidadesPresentes, chaveEtapa, chaveEtapaDaLinha, contarPor, valoresDistintos,
  type LinhaCronograma, type EtapaContagem,
} from '@/lib/cronograma-lista'
import { listModalidadesComModelo, listEtapasDeModelos, type EtapaModelo } from '@/lib/simulador-cronograma'
import { aplicarRitoDaModalidade } from '@/lib/aplicar-rito'

import {
  CheckCircle2, Clock, Circle, ArrowRight, Search,
  ChevronLeft, ChevronRight
} from 'lucide-react'

/** Status de `status_processo` que representam execução em curso. */
const STATUS_ANDAMENTO = ['Em andamento']

type CronogramaRow = LinhaCronograma & { total_count?: number }

function statusBadge(pa: string) {
  switch (pa) {
    case 'concluido': return { label: 'Concluído', color: '#059669', icon: CheckCircle2 }
    case 'em_andamento': return { label: 'Em Andamento', color: '#2563eb', icon: Clock }
    default: return { label: 'Não Iniciado', color: '#64748b', icon: Circle }
  }
}

export default function CronogramaPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const perPage = 50
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [seiLinks, setSeiLinks] = useState<Record<string, string>>({})
  const isMobile = useIsMobile()
  const debouncedSearch = useDebounce(search, 300)
  // A tela existe para acompanhar execução: só processos em andamento por
  // padrão. Concluídos, cancelados e devolvidos ficam atrás do filtro.
  const [apenasAndamento, setApenasAndamento] = useState(true)
  const [semResultadoFiltrado, setSemResultadoFiltrado] = useState(false)
  const [todasLinhas, setTodasLinhas] = useState<LinhaCronograma[]>([])
  const [etapaFiltro, setEtapaFiltro] = useState<string | null>(null)
  const [modalidadeFiltro, setModalidadeFiltro] = useState<string | null>(null)
  const [etapasPorModalidade, setEtapasPorModalidade] = useState<Record<string, EtapaModelo[]>>({})
  const [erroCarga, setErroCarga] = useState('')
  const [coordenacaoFiltro, setCoordenacaoFiltro] = useState<string | null>(null)
  const [responsavelFiltro, setResponsavelFiltro] = useState<string | null>(null)
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<string | null>(null)
  const [aplicandoLote, setAplicandoLote] = useState(false)
  const [progressoLote, setProgressoLote] = useState({ feitos: 0, total: 0, erros: 0 })
  const [erroLote, setErroLote] = useState('')
  const [recarregar, setRecarregar] = useState(0)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        // Dentro do try: se a configuração do Supabase estiver ausente — o que
        // acontece quando o navegador serve um bundle antigo em cache —,
        // createClient() lança, e fora daqui esse erro derrubaria a tela
        // inteira em vez de virar uma mensagem.
        const supabase = createClient()
        const { linhas } = await listarCronogramaCompleto(supabase, {
          statusNomes: apenasAndamento ? STATUS_ANDAMENTO : null,
          busca: debouncedSearch || null,
        })

        if (cancelled) return

        setTodasLinhas(linhas)
        setErroCarga('')
        setSemResultadoFiltrado(apenasAndamento && linhas.length === 0)
      } catch (err) {
        console.warn('Erro ao carregar cronograma:', err)
        if (!cancelled) {
          setTodasLinhas([])
          setErroCarga((err as Error)?.message || 'Não foi possível carregar o cronograma.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [debouncedSearch, apenasAndamento, recarregar])

  // Ritos cadastrados, para exibir o cronograma completo da modalidade —
  // inclusive as etapas onde não há nenhum processo no momento.
  useEffect(() => {
    let cancelado = false

    async function carregarRitos() {
      try {
        const supabase = createClient()
        const mods = await listModalidadesComModelo(supabase)
        if (mods.length === 0 || cancelado) return

        const porModelo = await listEtapasDeModelos(supabase, mods.map(m => m.modelo_id))
        if (cancelado) return

        const porModalidade: Record<string, EtapaModelo[]> = {}
        for (const m of mods) {
          const etapas = porModelo[m.modelo_id]
          if (etapas?.length) porModalidade[m.modalidade_nome] = etapas
        }
        setEtapasPorModalidade(porModalidade)
      } catch (err) {
        // Sem os ritos a tela ainda funciona: a faixa cai para as etapas
        // presentes nos processos.
        console.warn('Ritos indisponíveis:', err)
      }
    }

    carregarRitos()
    return () => { cancelado = true }
  }, [])

  const modalidades = useMemo(() => modalidadesPresentes(todasLinhas), [todasLinhas])

  // Filtros combinam entre si: cada um estreita o conjunto do anterior.
  const linhasDaModalidade = useMemo(() => {
    return todasLinhas.filter(l =>
      (!modalidadeFiltro || l.modalidade_nome === modalidadeFiltro) &&
      (!coordenacaoFiltro || (l.coordenacao_nome || 'Não informado') === coordenacaoFiltro) &&
      (!responsavelFiltro || (l.responsavel_nome || 'Não atribuído') === responsavelFiltro) &&
      (!prioridadeFiltro || (l.prioridade || 'Sem prioridade') === prioridadeFiltro),
    )
  }, [todasLinhas, modalidadeFiltro, coordenacaoFiltro, responsavelFiltro, prioridadeFiltro])

  // Contagens sobre o conjunto sem o próprio filtro de coordenação, para os
  // números continuarem visíveis depois de escolher uma.
  const porCoordenacao = useMemo(() => {
    const base = todasLinhas.filter(l =>
      (!modalidadeFiltro || l.modalidade_nome === modalidadeFiltro) &&
      (!responsavelFiltro || (l.responsavel_nome || 'Não atribuído') === responsavelFiltro) &&
      (!prioridadeFiltro || (l.prioridade || 'Sem prioridade') === prioridadeFiltro),
    )
    return contarPor(base, 'coordenacao_nome', 'Não informado')
  }, [todasLinhas, modalidadeFiltro, responsavelFiltro, prioridadeFiltro])

  const responsaveis = useMemo(() => valoresDistintos(todasLinhas, 'responsavel_nome'), [todasLinhas])
  const prioridades = useMemo(() => valoresDistintos(todasLinhas, 'prioridade'), [todasLinhas])

  // Processos cujo cronograma não corresponde ao rito cadastrado da sua
  // modalidade. Sem filtro de modalidade, considera todas de uma vez — é o
  // caminho para regenerar o sistema inteiro sem percorrer uma a uma.
  const foraDoRito = useMemo(() => {
    return linhasDaModalidade.filter(l => {
      if (!l.modalidade_nome || !l.modalidade_id || !l.data_entrada) return false
      const etapas = etapasPorModalidade[l.modalidade_nome]
      if (!etapas?.length) return false

      // Contagem diferente do rito, ou etapa atual que não existe nele
      if (l.total_atividades !== etapas.length) return true
      if (l.etapa_atual && !etapas.some(e => e.descricao === l.etapa_atual)) return true
      return false
    })
  }, [linhasDaModalidade, etapasPorModalidade])

  const foraDoRitoPorModalidade = useMemo(
    () => contarPor(foraDoRito, 'modalidade_nome'), [foraDoRito])

  async function aplicarRitoEmLote() {
    if (foraDoRito.length === 0) return

    const escopo = modalidadeFiltro
      ? `${foraDoRito.length} processo(s) de ${modalidadeFiltro}`
      : `${foraDoRito.length} processo(s) de ${foraDoRitoPorModalidade.length} modalidade(s)`

    if (!confirm(
      `Regerar o cronograma de ${escopo} com as etapas do rito cadastrado?

` +
      `Status, responsável e datas reais das etapas já trabalhadas são preservados. ` +
      `Prazos ajustados manualmente voltam ao padrão do modelo.

` +
      `Recomendado conferir um processo antes de aplicar a todos.`
    )) return

    setAplicandoLote(true)
    setErroLote('')
    setProgressoLote({ feitos: 0, total: foraDoRito.length, erros: 0 })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let erros = 0

    for (let i = 0; i < foraDoRito.length; i++) {
      const linha = foraDoRito[i]
      try {
        const { data: atividades } = await supabase
          .from('cronograma_atividades')
          .select('*')
          .eq('processo_id', linha.id)
          .order('ordem', { ascending: true })

        await aplicarRitoDaModalidade(supabase, {
          processoId: linha.id,
          modalidadeId: linha.modalidade_id as string,
          dataEntrada: linha.data_entrada as string,
          atividades: (atividades ?? []) as never,
          userId: user?.id ?? null,
        })
      } catch (err) {
        console.warn('Falha ao aplicar rito em', linha.id_processo, err)
        erros++
        // A primeira falha é mostrada na tela: sem isso, a operação parecia
        // não ter efeito e o motivo ficava só no console.
        if (!erros || erros === 1) {
          setErroLote(`${linha.id_processo || linha.id}: ${(err as Error)?.message || 'falha desconhecida'}`)
        }
      }
      setProgressoLote({ feitos: i + 1, total: foraDoRito.length, erros })
    }

    setAplicandoLote(false)
    setRecarregar(v => v + 1)
  }

  function limparFiltros() {
    setModalidadeFiltro(null); setCoordenacaoFiltro(null)
    setResponsavelFiltro(null); setPrioridadeFiltro(null)
    setEtapaFiltro(null); setPage(1)
  }

  const temFiltro = !!(modalidadeFiltro || coordenacaoFiltro || responsavelFiltro || prioridadeFiltro || etapaFiltro)

  // Distribuição sobre o conjunto inteiro, não sobre a página exibida
  const distribuicao: EtapaContagem[] = useMemo(() => {
    const doRito = modalidadeFiltro ? etapasPorModalidade[modalidadeFiltro] : null
    return doRito
      ? distribuicaoComModelo(linhasDaModalidade, doRito)
      : calcularDistribuicaoEtapas(linhasDaModalidade)
  }, [linhasDaModalidade, modalidadeFiltro, etapasPorModalidade])

  const linhasFiltradas = useMemo(
    () => etapaFiltro
      ? linhasDaModalidade.filter(l => chaveEtapaDaLinha(l) === etapaFiltro)
      : linhasDaModalidade,
    [linhasDaModalidade, etapaFiltro])


  useEffect(() => {
    const supabase = createClient()
    fetchAllSeiLinks(supabase).then(setSeiLinks)
  }, [])

  const totalCount = linhasFiltradas.length
  const totalPages = useMemo(() => Math.ceil(totalCount / perPage) || 1, [totalCount])

  const list = useMemo(
    () => linhasFiltradas.slice((page - 1) * perPage, page * perPage) as CronogramaRow[],
    [linhasFiltradas, page])

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
  )

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#f1f5f9' }}>
        Cronograma de Processos
      </h1>
      <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12 }}>
        {totalCount} processo{totalCount !== 1 ? 's' : ''}
        {apenasAndamento ? ' em andamento' : ''}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Em andamento', ativo: apenasAndamento, valor: true },
          { label: 'Todos os processos', ativo: !apenasAndamento, valor: false },
        ].map(opt => (
          <button
            key={opt.label}
            type="button"
            onClick={() => { setApenasAndamento(opt.valor); setPage(1) }}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 999,
              cursor: 'pointer',
              background: opt.ativo ? 'rgba(56,189,248,0.15)' : 'transparent',
              color: opt.ativo ? '#38bdf8' : '#94a3b8',
              border: `1px solid ${opt.ativo ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Filtros combináveis */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: 8, marginBottom: 14,
      }}>
        {([
          { rotulo: 'Modalidade', valor: modalidadeFiltro, definir: setModalidadeFiltro, opcoes: modalidades },
          { rotulo: 'Responsável', valor: responsavelFiltro, definir: setResponsavelFiltro, opcoes: responsaveis },
          { rotulo: 'Prioridade', valor: prioridadeFiltro, definir: setPrioridadeFiltro, opcoes: prioridades },
        ] as const).map(f => (
          <div key={f.rotulo}>
            <label style={{
              display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: '#64748b', marginBottom: 4,
            }}>
              {f.rotulo}
            </label>
            <select
              value={f.valor ?? ''}
              onChange={e => { f.definir(e.target.value || null); setEtapaFiltro(null); setPage(1) }}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                border: `1px solid ${f.valor ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.1)'}`,
                background: f.valor ? 'rgba(56,189,248,0.08)' : 'rgba(15,23,42,0.5)',
                color: '#e2e8f0',
                fontSize: 13, outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="">{f.rotulo === 'Responsável' ? 'Todos' : 'Todas'}</option>
              {f.opcoes.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      {temFiltro && (
        <div style={{ marginBottom: 14 }}>
          <button
            type="button"
            onClick={limparFiltros}
            style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 999,
              cursor: 'pointer', background: 'transparent', color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Processos com cronograma fora do rito cadastrado */}
      {foraDoRito.length > 0 && (
        <div style={{
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 14,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', marginBottom: 2 }}>
              {foraDoRito.length} processo{foraDoRito.length > 1 ? 's' : ''} com cronograma fora do rito
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {modalidadeFiltro
                ? `O rito de ${modalidadeFiltro} tem ${etapasPorModalidade[modalidadeFiltro]?.length} etapas.`
                : foraDoRitoPorModalidade.map(m => `${m.valor}: ${m.total}`).join(' · ')}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              Aplicar substitui as etapas gravadas pelas do modelo, preservando status,
              responsável e datas reais do que já foi trabalhado.
            </div>
            {aplicandoLote && (
              <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 6 }}>
                Aplicando… {progressoLote.feitos} de {progressoLote.total}
                {progressoLote.erros > 0 ? ` · ${progressoLote.erros} com falha` : ''}
              </div>
            )}
            {!aplicandoLote && progressoLote.total > 0 && (
              <div style={{ fontSize: 12, color: progressoLote.erros > 0 ? '#fca5a5' : '#86efac', marginTop: 6 }}>
                {progressoLote.erros > 0
                  ? `${progressoLote.erros} de ${progressoLote.total} falharam`
                  : `${progressoLote.total} processo(s) regenerado(s)`}
              </div>
            )}
            {erroLote && (
              <div style={{
                fontSize: 11, color: '#fca5a5', marginTop: 6,
                wordBreak: 'break-word', background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '6px 8px',
              }}>
                {erroLote}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={aplicarRitoEmLote}
            disabled={aplicandoLote}
            style={{
              padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
              border: '1px solid rgba(245,158,11,0.4)',
              cursor: aplicandoLote ? 'not-allowed' : 'pointer',
              background: 'rgba(245,158,11,0.15)', color: '#e2e8f0',
              whiteSpace: 'nowrap',
            }}
          >
            {aplicandoLote
              ? 'Aplicando…'
              : modalidadeFiltro
                ? `Aplicar rito a ${foraDoRito.length}`
                : `Regenerar todos (${foraDoRito.length})`}
          </button>
        </div>
      )}

      {/* Total por coordenação */}
      {porCoordenacao.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#64748b', marginBottom: 8,
          }}>
            Processos por coordenação
          </div>
          <div className="filtro-rolavel" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {porCoordenacao.map(c => {
              const ativo = coordenacaoFiltro === c.valor
              return (
                <button
                  key={c.valor}
                  type="button"
                  onClick={() => { setCoordenacaoFiltro(ativo ? null : c.valor); setEtapaFiltro(null); setPage(1) }}
                  title={c.valor}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 999,
                    cursor: 'pointer', maxWidth: 300, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    background: ativo ? 'rgba(56,189,248,0.15)' : 'rgba(30,41,59,0.6)',
                    color: '#e2e8f0',
                    border: `1px solid ${ativo ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {c.valor} <span style={{ opacity: 0.75 }}>· {c.total}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {distribuicao.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#64748b', marginBottom: 8,
          }}>
            {modalidadeFiltro && etapasPorModalidade[modalidadeFiltro]
              ? `Etapas do rito · ${modalidadeFiltro}`
              : 'Em que etapa estão'}
          </div>
          {modalidadeFiltro && !etapasPorModalidade[modalidadeFiltro] && (
            <p style={{ fontSize: 11, color: '#fbbf24', margin: '0 0 8px' }}>
              Esta modalidade não tem modelo de cronograma cadastrado — as etapas
              abaixo vêm apenas dos processos existentes.
            </p>
          )}
          <div className="filtro-rolavel" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => { setEtapaFiltro(null); setPage(1) }}
              style={{
                padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 999,
                cursor: 'pointer',
                background: etapaFiltro === null ? 'rgba(56,189,248,0.15)' : 'transparent',
                color: etapaFiltro === null ? '#38bdf8' : '#94a3b8',
                border: `1px solid ${etapaFiltro === null ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              Todas · {linhasDaModalidade.length}
            </button>
            {distribuicao.map(d => {
              const chave = chaveEtapa(d.ordem === Number.MAX_SAFE_INTEGER ? null : d.ordem, d.etapa)
              const ativo = etapaFiltro === chave
              const vazio = d.total === 0
              return (
                <button
                  key={chave}
                  type="button"
                  onClick={() => { if (!vazio) { setEtapaFiltro(ativo ? null : chave); setPage(1) } }}
                  disabled={vazio}
                  title={vazio ? `${d.etapa} — nenhum processo nesta etapa` : d.etapa}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 999,
                    cursor: vazio ? 'default' : 'pointer', maxWidth: 340, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    opacity: vazio ? 0.4 : 1,
                    background: ativo ? 'rgba(56,189,248,0.15)' : 'rgba(30,41,59,0.6)',
                    color: ativo ? '#38bdf8' : (d.noModelo === false ? '#fbbf24' : '#cbd5e1'),
                    border: `1px solid ${ativo ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {d.ordem < Number.MAX_SAFE_INTEGER ? `${d.ordem}. ` : ''}{d.etapa}
                  <span style={{ marginLeft: 6, opacity: 0.75 }}>· {d.total}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {erroCarga && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16,
          fontSize: 12, color: '#fca5a5', wordBreak: 'break-word',
        }}>
          {erroCarga}
        </div>
      )}

      {semResultadoFiltrado && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16,
          fontSize: 12, color: '#fbbf24',
        }}>
          Nenhum processo com status &quot;{STATUS_ANDAMENTO.join('&quot; ou &quot;')}&quot;.
          Confira o status cadastrado nos processos ou veja todos.
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
        background: 'rgba(30,41,59,0.5)', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.1)', padding: '0 12px',
      }}>
        <Search size={16} color="#64748b" />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Buscar por ID ou objeto...  ⌘K"
          style={{
            flex: 1, padding: '10px 0', border: 'none', background: 'transparent',
            color: '#f1f5f9', fontSize: 14, outline: 'none', width: '100%',
          }}
        />
        {search && (
          <button onClick={() => { setSearch(''); setPage(1) }}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }}>
            ×
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          {debouncedSearch ? 'Nenhum processo encontrado para esta busca.' : 'Nenhum processo encontrado.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map(p => {
            const concluded = p.concluidas === p.total_atividades && p.total_atividades > 0
            const badge = statusBadge(concluded ? 'concluido' : (p.total_atividades > 0 ? 'em_andamento' : 'nao_iniciado'))
            const Icon = badge.icon
            return (
              <div
                key={p.id}
                onClick={() => router.push(`/pmo-dashboard/processos/detalhe?id=${p.id}`)}
                style={{
                  background: '#1e293b',
                  borderRadius: 12,
                  padding: isMobile ? 12 : 16,
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  gap: isMobile ? 8 : 16,
                  cursor: 'pointer',
                  border: p.processo_atrasado ? '1px solid #dc2626' : '1px solid #334155',
                }}
              >
                <Icon size={24} color={badge.color} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.objeto_resumido || 'Sem objeto'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>
                    <a href={seiLinks[p.id] || '#'} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: seiLinks[p.id] ? 'underline' : 'none' }}>{p.id_processo || 'Sem ID'}</a>{p.modalidade_nome ? ` · ${p.modalidade_nome}` : ''}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 13 }}>
                    {p.data_entrada ? `Entrada: ${formatDate(p.data_entrada)}` : ''}
                    {p.total_atividades > 0 ? ` · ${p.concluidas}/${p.total_atividades} etapas` : ' · Sem cronograma'}
                    {p.progresso > 0 ? ` · ${p.progresso}%` : ''}
                    {p.atrasadas ? ` · ${p.atrasadas} atrasada(s)` : ''}
                  </div>

                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: isMobile ? 4 : 12,
                    marginTop: 4, fontSize: 12,
                  }}>
                    <span style={{ color: '#94a3b8' }}>
                      Responsável:{' '}
                      <span style={{ color: '#cbd5e1', fontWeight: 500 }}>
                        {p.responsavel_nome || 'não atribuído'}
                      </span>
                    </span>
                    <span style={{ color: '#94a3b8' }}>
                      Valor estimado:{' '}
                      <span style={{ color: '#cbd5e1', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {p.valor_estimado ? formatBRL(p.valor_estimado) : '—'}
                      </span>
                    </span>
                  </div>
                  {/* A etapa em que o processo está: a pendente de menor ordem,
                      a mesma que a faixa de filtros usa. O campo ultima_fase,
                      herdado da RPC, trazia a fase da última etapa pendente —
                      rotulada como "Atual" sem ser a atual. */}
                  {p.etapa_atual ? (
                    <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 4 }}>
                      <span style={{ color: '#94a3b8' }}>Etapa atual: </span>
                      {p.etapa_atual_ordem ? `${p.etapa_atual_ordem}. ` : ''}{p.etapa_atual}
                      {p.ultima_fase ? (
                        <span style={{ color: '#64748b' }}> · {p.ultima_fase}</span>
                      ) : null}

                      {/* Tempo parado na etapa além do previsto, em dias úteis */}
                      {p.dias_uteis_atraso > 0 ? (
                        <div style={{ marginTop: 4 }}>
                          <span style={{
                            display: 'inline-block',
                            background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontSize: 12,
                            color: '#fca5a5',
                            fontWeight: 600,
                          }}>
                            Parada há {p.dias_uteis_atraso} {p.dias_uteis_atraso === 1 ? 'dia útil' : 'dias úteis'}
                          </span>
                          {p.etapa_atual_data_fim ? (
                            <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>
                              prazo era {formatDate(p.etapa_atual_data_fim)}
                            </span>
                          ) : null}
                        </div>
                      ) : p.etapa_atual_data_fim ? (
                        <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                          Prazo da etapa: {formatDate(p.etapa_atual_data_fim)}
                        </div>
                      ) : null}
                    </div>
                  ) : p.total_atividades > 0 ? (
                    <div style={{ color: '#22c55e', fontSize: 13, marginTop: 4 }}>
                      Todas as etapas concluídas
                    </div>
                  ) : null}
                </div>

                {p.total_atividades > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      width: 80, height: 6, background: '#334155', borderRadius: 3, overflow: 'hidden', marginLeft: 'auto', marginBottom: 4,
                    }}>
                      <div style={{
                        width: `${p.progresso}%`,
                        height: '100%',
                        background: p.processo_atrasado ? '#dc2626' : '#22c55e',
                        borderRadius: 3,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>
                      {p.data_entrega ? `Previsão: ${formatDate(p.data_entrega)}` : ''}
                    </div>
                  </div>
                )}

                <ArrowRight size={16} color="#64748b" />
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 24 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              background: 'rgba(30,41,59,0.8)', border: '1px solid #334155',
              color: page <= 1 ? '#475569' : '#f1f5f9', borderRadius: 8, padding: '6px 12px',
              cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: 13,
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              background: 'rgba(30,41,59,0.8)', border: '1px solid #334155',
              color: page >= totalPages ? '#475569' : '#f1f5f9', borderRadius: 8, padding: '6px 12px',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 13,
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
