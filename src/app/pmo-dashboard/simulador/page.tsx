'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useIsMobile } from '@/hooks/useIsMobile'
import { formatDateBR, exportCSV } from '@/lib/utils'
import { getAtividadeBadgeColor, getFaseAgrupada } from '@/lib/cronograma-engine'
import {
  listModalidadesComModelo,
  listEtapasDeModelos,
  listFeriados,
  projetarCronograma,
  ultimoAnoComFeriados,
  type EtapaModelo,
  type ModalidadeComModelo,
} from '@/lib/simulador-cronograma'
import { CalendarClock, Download, AlertTriangle } from 'lucide-react'

const ORDEM_FASES = ['Planejamento', 'Produção', 'Análise', 'Revisão', 'Execução', 'Aprovação']

function hojeISO(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function porExtenso(iso: string | null): string {
  if (!iso) return '—'
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const [ano, mes, dia] = iso.split('-').map(Number)
  if (!ano || !mes || !dia) return iso
  return `${dia} de ${meses[mes - 1]} de ${ano}`
}

function diaDaSemana(iso: string | null): string {
  if (!iso) return ''
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado']
  const [ano, mes, dia] = iso.split('-').map(Number)
  return dias[new Date(ano, mes - 1, dia).getDay()]
}

export default function SimuladorPage() {
  const isMobile = useIsMobile()

  const [modalidades, setModalidades] = useState<ModalidadeComModelo[]>([])
  const [etapasPorModelo, setEtapasPorModelo] = useState<Record<string, EtapaModelo[]>>({})
  const [feriados, setFeriados] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const [modalidadeId, setModalidadeId] = useState('')
  const [dataInicio, setDataInicio] = useState(hojeISO())
  const [aPartirDe, setAPartirDe] = useState(1)

  useEffect(() => {
    let cancelado = false
    const supabase = createClient()

    async function carregar() {
      try {
        const [mods, fers] = await Promise.all([
          listModalidadesComModelo(supabase),
          listFeriados(supabase),
        ])
        if (cancelado) return

        if (mods.length === 0) {
          setErro('Nenhuma modalidade possui modelo de cronograma ativo.')
          setLoading(false)
          return
        }

        const etapas = await listEtapasDeModelos(supabase, mods.map(m => m.modelo_id))
        if (cancelado) return

        setModalidades(mods)
        setEtapasPorModelo(etapas)
        setFeriados(fers)
        setModalidadeId(mods[0].modalidade_id)
        setLoading(false)
      } catch {
        if (!cancelado) {
          setErro('Erro ao carregar os modelos de cronograma.')
          setLoading(false)
        }
      }
    }

    carregar()
    return () => { cancelado = true }
  }, [])

  const modalidadeAtual = useMemo(
    () => modalidades.find(m => m.modalidade_id === modalidadeId) ?? null,
    [modalidades, modalidadeId],
  )

  const etapasAtuais = useMemo(
    () => (modalidadeAtual ? etapasPorModelo[modalidadeAtual.modelo_id] ?? [] : []),
    [modalidadeAtual, etapasPorModelo],
  )

  const projecao = useMemo(() => {
    if (etapasAtuais.length === 0) return null
    return projetarCronograma(etapasAtuais, dataInicio, feriados, aPartirDe)
  }, [etapasAtuais, dataInicio, feriados, aPartirDe])

  const comparativo = useMemo(() => {
    return modalidades.map(m => {
      const etapas = etapasPorModelo[m.modelo_id] ?? []
      const proj = etapas.length ? projetarCronograma(etapas, dataInicio, feriados, 1) : null
      return { modalidade: m, projecao: proj }
    })
  }, [modalidades, etapasPorModelo, dataInicio, feriados])

  // A tabela `feriados` é semeada por período. Fora dele, só fins de semana
  // são descontados — o usuário precisa saber.
  const avisoFeriados = useMemo(() => {
    if (!projecao?.data_conclusao) return null
    const ultimoAno = ultimoAnoComFeriados(feriados)
    const anoFim = Number(projecao.data_conclusao.slice(0, 4))
    if (ultimoAno === null) return 'Nenhum feriado cadastrado — a contagem desconta apenas fins de semana.'
    if (anoFim > ultimoAno) {
      return `O calendário de feriados vai até ${ultimoAno}. A partir de ${ultimoAno + 1} a contagem desconta apenas fins de semana.`
    }
    return null
  }, [projecao, feriados])

  const parcial = aPartirDe > 1

  function trocarModalidade(id: string) {
    setModalidadeId(id)
    setAPartirDe(1)
  }

  function baixarCSV() {
    if (!projecao || !modalidadeAtual) return
    const linhas = projecao.etapas
      .filter(e => !e.cumprida)
      .map(e => ({
        Ordem: e.ordem,
        Etapa: e.descricao,
        Fase: e.fase,
        Setor: e.setor,
        'Dias Úteis': e.duracao_dias_uteis,
        Início: formatDateBR(e.data_inicio),
        Fim: formatDateBR(e.data_fim),
      }))
    exportCSV(linhas, `simulacao_${modalidadeAtual.modalidade_nome.toLowerCase().replace(/\s+/g, '_')}`)
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
  }

  if (erro) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
        <AlertTriangle size={28} style={{ color: '#f59e0b', marginBottom: 12 }} />
        <p style={{ fontSize: 14 }}>{erro}</p>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
          Cadastre um modelo em Modelos de Cronograma para simular esta modalidade.
        </p>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(15,23,42,0.5)',
    color: '#e2e8f0',
    fontSize: 13,
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#64748b',
    marginBottom: 4,
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <CalendarClock size={22} style={{ color: '#38bdf8' }} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
          Simulador de Cronograma
        </h1>
      </div>
      <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20 }}>
        Projete a data de conclusão antes de cadastrar o processo. Para um processo
        já em andamento, escolha a etapa em que ele está hoje.
      </p>

      {/* --- controles --- */}
      <div
        style={{
          background: 'rgba(30,41,59,0.7)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr',
          gap: 14,
        }}
      >
        <div>
          <label style={labelStyle} htmlFor="sim-modalidade">Modalidade</label>
          <select
            id="sim-modalidade"
            value={modalidadeId}
            onChange={e => trocarModalidade(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {modalidades.map(m => (
              <option key={m.modalidade_id} value={m.modalidade_id}>
                {m.modalidade_nome} · {m.total_dias_uteis} dias úteis
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle} htmlFor="sim-data">Data de início</label>
          <input
            id="sim-data"
            type="date"
            value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
          <label style={labelStyle} htmlFor="sim-etapa">A partir da etapa</label>
          <select
            id="sim-etapa"
            value={aPartirDe}
            onChange={e => setAPartirDe(Number(e.target.value))}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {etapasAtuais.map(e => (
              <option key={e.ordem} value={e.ordem}>
                {e.ordem === 1
                  ? 'Início do processo — etapa 1'
                  : `Etapa ${e.ordem} — ${e.descricao}`}
                {e.duracao_dias_uteis > 0 ? ` (${e.duracao_dias_uteis}D)` : ' (marco)'}
              </option>
            ))}
          </select>
          <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>
            {parcial
              ? `As etapas 1 a ${aPartirDe - 1} são tratadas como já cumpridas.`
              : 'Escolha outra etapa se o processo já estiver em andamento.'}
          </p>
        </div>
      </div>

      {/* --- resultado --- */}
      {projecao && (
        <div
          style={{
            background: 'rgba(30,41,59,0.7)',
            border: '1px solid rgba(56,189,248,0.25)',
            borderLeft: '4px solid #38bdf8',
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr',
            gap: 20,
            alignItems: 'center',
          }}
        >
          <div>
            <div style={labelStyle}>Conclusão prevista</div>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: '#e0f2fe', lineHeight: 1.1 }}>
              {porExtenso(projecao.data_conclusao)}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
              {diaDaSemana(projecao.data_conclusao)}
              {projecao.data_inicio ? ` · início em ${formatDateBR(projecao.data_inicio)}` : ''}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>{projecao.pendentes}</div>
              <div style={labelStyle}>{parcial ? 'Etapas restantes' : 'Etapas'}</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>{projecao.dias_uteis}</div>
              <div style={labelStyle}>{parcial ? 'Dias úteis restantes' : 'Dias úteis'}</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>{projecao.dias_corridos}</div>
              <div style={labelStyle}>Dias corridos</div>
            </div>
          </div>
        </div>
      )}

      {avisoFeriados && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 12,
            color: '#fbbf24',
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          {avisoFeriados}
        </div>
      )}

      {/* --- comparativo entre modalidades --- */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>
        Se fosse outra modalidade
      </h2>
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
        {parcial
          ? 'Rito completo de cada modalidade, do início, para a mesma data.'
          : 'Mesma data de início, ritos diferentes. Clique para simular.'}
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 10,
          marginBottom: 24,
        }}
      >
        {comparativo.map(({ modalidade, projecao: proj }) => {
          const ativo = modalidade.modalidade_id === modalidadeId
          return (
            <button
              key={modalidade.modalidade_id}
              type="button"
              onClick={() => trocarModalidade(modalidade.modalidade_id)}
              style={{
                background: ativo ? 'rgba(56,189,248,0.1)' : 'rgba(30,41,59,0.7)',
                border: `1px solid ${ativo ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 10,
                padding: '12px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
                {modalidade.modalidade_nome}
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8' }}>
                {formatDateBR(proj?.data_conclusao ?? null)}
              </span>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {modalidade.total_dias_uteis} dias úteis · {proj?.dias_corridos ?? 0} corridos
              </span>
            </button>
          )
        })}
      </div>

      {/* --- linha do tempo --- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: '0 0 2px' }}>Etapa a etapa</h2>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
            {modalidadeAtual?.modalidade_nome} · {projecao?.pendentes ?? 0}
            {(projecao?.pendentes ?? 0) === 1 ? ' etapa pendente' : ' etapas pendentes'}
            {parcial ? ` de ${etapasAtuais.length}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={baixarCSV}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(30,41,59,0.7)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '8px 12px',
            color: '#38bdf8',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Download size={12} /> CSV
        </button>
      </div>

      {ORDEM_FASES.map(fase => {
        const doGrupo = projecao?.etapas.filter(e => e.fase === fase) ?? []
        if (doGrupo.length === 0) return null

        const pendentes = doGrupo.filter(e => !e.cumprida)
        const soma = pendentes.reduce((acc, e) => acc + e.duracao_dias_uteis, 0)
        const cor = getAtividadeBadgeColor(fase)

        return (
          <div key={fase} style={{ marginBottom: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                marginBottom: 8,
                paddingBottom: 6,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: cor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {getFaseAgrupada(fase)}
              </span>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {pendentes.length > 0
                  ? `${pendentes.length} ${pendentes.length === 1 ? 'etapa' : 'etapas'} · ${soma} ${soma === 1 ? 'dia útil' : 'dias úteis'}`
                  : 'concluída'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {doGrupo.map(etapa => (
                <div
                  key={etapa.ordem}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: etapa.cumprida ? 'transparent' : 'rgba(30,41,59,0.4)',
                    borderRadius: 10,
                    borderLeft: `3px solid ${etapa.cumprida ? '#475569' : cor}`,
                    border: '1px solid rgba(255,255,255,0.06)',
                    opacity: etapa.cumprida ? 0.5 : 1,
                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', minWidth: 20 }}>
                    #{etapa.ordem}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: etapa.cumprida ? '#64748b' : '#e2e8f0',
                        textDecoration: etapa.cumprida ? 'line-through' : 'none',
                      }}
                    >
                      {etapa.descricao}
                      {etapa.duracao_dias_uteis === 0 && !etapa.cumprida && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', border: '1px solid #f59e0b', borderRadius: 4, padding: '1px 5px', marginLeft: 7, textTransform: 'uppercase' }}>
                          marco
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginTop: 2 }}>
                      {etapa.setor}
                    </div>
                  </div>

                  <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {etapa.cumprida
                      ? '—'
                      : etapa.duracao_dias_uteis > 0
                        ? `${etapa.duracao_dias_uteis}d úteis`
                        : 'marco'}
                  </span>

                  <span style={{ fontSize: 12, color: etapa.cumprida ? '#64748b' : '#f1f5f9', whiteSpace: 'nowrap' }}>
                    {etapa.cumprida
                      ? 'já cumprida'
                      : `${formatDateBR(etapa.data_inicio)} → ${formatDateBR(etapa.data_fim)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <p style={{ fontSize: 11, color: '#64748b', marginTop: 24, maxWidth: 720, lineHeight: 1.6 }}>
        A contagem é em dias úteis, descontando feriados cadastrados. Uma etapa de 1 dia
        começa e termina no mesmo dia; etapas de duração zero são marcos. Esta é uma
        projeção do rito — no processo, cada etapa pode ser ajustada com justificativa.
      </p>
    </div>
  )
}
