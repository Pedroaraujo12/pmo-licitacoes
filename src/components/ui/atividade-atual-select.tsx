'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listEtapasPorModalidade, type EtapaModelo } from '@/lib/simulador-cronograma'

/**
 * Seletor de "Atividade Atual" alimentado pelo modelo de cronograma da
 * modalidade — as mesmas etapas que o processo terá no cronograma e que o
 * Simulador projeta.
 *
 * Antes este campo era uma lista fixa no código, igual para toda modalidade e
 * desalinhada de qualquer rito cadastrado. Isso dava ao sistema duas respostas
 * diferentes para "em que etapa está o processo": este texto e o cronograma.
 *
 * Quando `processoId` é informado, o componente também mostra qual etapa o
 * cronograma considera em andamento, e permite adotá-la com um clique — sem
 * impor, porque a etapa declarada aqui às vezes é ajustada de propósito.
 */

interface Props {
  modalidadeId: string | null
  value: string
  onChange: (value: string) => void
  /** Quando informado, compara com a etapa em andamento no cronograma. */
  processoId?: string
  name?: string
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
  cursor: 'pointer',
}

export default function AtividadeAtualSelect({
  modalidadeId, value, onChange, processoId, name = 'atividade_atual',
}: Props) {
  const [etapas, setEtapas] = useState<EtapaModelo[]>([])
  const [carregando, setCarregando] = useState(false)
  const [etapaCronograma, setEtapaCronograma] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      if (!modalidadeId) {
        setEtapas([])
        return
      }

      setCarregando(true)
      const lista = await listEtapasPorModalidade(createClient(), modalidadeId)
      if (!cancelado) {
        setEtapas(lista)
        setCarregando(false)
      }
    }

    carregar()
    return () => { cancelado = true }
  }, [modalidadeId])

  // Etapa que o cronograma do processo considera em andamento
  useEffect(() => {
    if (!processoId) return

    let cancelado = false
    const supabase = createClient()

    async function carregarCronograma() {
      const { data } = await supabase
        .from('cronograma_atividades')
        .select('descricao, status, ordem')
        .eq('processo_id', processoId as string)
        .neq('status', 'concluido')
        .order('ordem', { ascending: true })
        .limit(1)

      if (!cancelado && data?.[0]) {
        setEtapaCronograma((data[0] as { descricao: string }).descricao)
      }
    }

    carregarCronograma()
    return () => { cancelado = true }
  }, [processoId])

  // Valor gravado que não pertence ao modelo atual (processo antigo, ou
  // modalidade trocada). Vira uma opção própria para não sumir em silêncio.
  const valorForaDoModelo = value && !etapas.some(e => e.descricao === value)

  const divergente =
    etapaCronograma && value && etapaCronograma !== value

  return (
    <div>
      <select
        name={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
        disabled={carregando}
      >
        <option value="">
          {carregando ? 'Carregando etapas...' : 'Selecione...'}
        </option>

        {valorForaDoModelo && (
          <option value={value}>{value} — (fora do rito atual)</option>
        )}

        {etapas.map(e => (
          <option key={e.ordem} value={e.descricao}>
            {e.ordem}. {e.descricao}
          </option>
        ))}
      </select>

      {!modalidadeId && (
        <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>
          Escolha a modalidade para ver as etapas do rito.
        </p>
      )}

      {modalidadeId && !carregando && etapas.length === 0 && (
        <p style={{ fontSize: 11, color: '#fbbf24', margin: '4px 0 0' }}>
          Esta modalidade não tem modelo de cronograma cadastrado.
        </p>
      )}

      {valorForaDoModelo && etapas.length > 0 && (
        <p style={{ fontSize: 11, color: '#fbbf24', margin: '4px 0 0' }}>
          A etapa registrada não pertence ao rito desta modalidade. Selecione a
          correspondente para alinhar com o cronograma.
        </p>
      )}

      {divergente && (
        <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 0 0' }}>
          No cronograma, a etapa em andamento é <strong style={{ color: '#cbd5e1' }}>{etapaCronograma}</strong>.{' '}
          <button
            type="button"
            onClick={() => onChange(etapaCronograma)}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: '#38bdf8', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Usar essa
          </button>
        </p>
      )}
    </div>
  )
}
