'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listTemplates, listVersions, generateDocument } from '@/lib/documentos'
import { TIPO_DOCUMENTO_LABELS } from '@/types/documentos'
import type { DocumentTemplate, TemplateVersion } from '@/types/documentos'

interface Props {
  open: boolean
  onClose: () => void
  processoId: string
  onGenerated?: (doc: { id: string; titulo: string }) => void
}

export default function GerarDocumentoModal({ open, onClose, processoId, onGenerated }: Props) {
  const supabase = createClient()
  const [step, setStep] = useState<'select' | 'preview' | 'done'>('select')
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [selectedTipo, setSelectedTipo] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [selectedVersion, setSelectedVersion] = useState('')
  const [versions, setVersions] = useState<TemplateVersion[]>([])
  const [preview, setPreview] = useState('')
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [titulo, setTitulo] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    setStep('select')
    setSelectedTipo('')
    setSelectedTemplate('')
    setSelectedVersion('')
    setPreview('')
    setTitulo('')
    setError('')
    setLoadingTemplates(true)
    listTemplates(supabase, { status: 'aprovado' }).then(({ data }) => {
      if (data) setTemplates(data)
      setLoadingTemplates(false)
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedTemplate) { setVersions([]); return }
    listVersions(supabase, selectedTemplate).then(({ data }) => {
      if (data) {
        const active = data.filter(v => v.status === 'aprovado')
        setVersions(active)
        if (active.length > 0) setSelectedVersion(active[0].id)
      }
    })
  }, [selectedTemplate]) // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const filteredTemplates = selectedTipo
    ? templates.filter(t => t.tipo_documento === selectedTipo)
    : templates

  async function handleGenerate() {
    if (!selectedVersion) { setError('Selecione uma versão do modelo'); return }
    setGenerating(true)
    setError('')
    try {
      const doc = await generateDocument(supabase, processoId, selectedVersion)
      if (doc) {
        setTitulo(doc.titulo_documento)
        setPreview(doc.conteudo_gerado)
        setStep('preview')
        if (onGenerated) onGenerated(doc)
      }
    } catch (err) {
      setError((err as Error).message || 'Erro ao gerar documento')
    } finally { setGenerating(false) }
  }

  function handleExport() {
    const win = window.open('')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo}</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; color: #000; }
        @media print { @page { margin: 2.5cm; } }
      </style></head><body>${preview}</body></html>
    `)
    win.document.close()
  }

  function handlePrint() {
    const win = window.open('')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo}</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; padding: 0; max-width: 800px; margin: 0 auto; color: #000; }
        @media print { @page { margin: 2.5cm; } body { padding: 0; } }
      </style></head><body>${preview}</body></html>
    `)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  if (!open) return null

  const modalStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
  }

  const cardStyle: React.CSSProperties = {
    background: '#1e293b', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)',
    padding: 28, width: '90%', maxWidth: 720, maxHeight: '85vh', overflow: 'auto',
    position: 'relative',
  }

  const baseInput = {
    width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, fontSize: 13, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1', outline: 'none',
  } as const

  const tipos = [...new Set(templates.map(t => t.tipo_documento))]

  return (
    <div ref={overlayRef} style={modalStyle} onClick={e => { if (e.target === overlayRef.current) onClose() }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            {step === 'select' ? 'Gerar Documento' : step === 'preview' ? 'Documento Gerado' : 'Concluído'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {step === 'select' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo de Documento</label>
              <select value={selectedTipo} onChange={e => { setSelectedTipo(e.target.value); setSelectedTemplate('') }} style={{ ...baseInput, cursor: 'pointer' }}>
                <option value="">Todos os tipos</option>
                {tipos.map(t => <option key={t} value={t}>{TIPO_DOCUMENTO_LABELS[t as keyof typeof TIPO_DOCUMENTO_LABELS] || t}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modelo</label>
              {loadingTemplates ? (
                <div className="loading-spinner" style={{ margin: '10px auto' }} />
              ) : filteredTemplates.length === 0 ? (
                <p style={{ fontSize: 13, color: '#64748b' }}>Nenhum modelo aprovado disponível.</p>
              ) : (
                <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)} style={{ ...baseInput, cursor: 'pointer' }}>
                  <option value="">Selecione um modelo...</option>
                  {filteredTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.title}{t.base_legal ? ` (${t.base_legal})` : ''}</option>
                  ))}
                </select>
              )}
            </div>

            {versions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Versão</label>
                <select value={selectedVersion} onChange={e => setSelectedVersion(e.target.value)} style={{ ...baseInput, cursor: 'pointer' }}>
                  {versions.map(v => (
                    <option key={v.id} value={v.id}>v{v.version_number}{v.resumo_alteracao ? ` - ${v.resumo_alteracao}` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={onClose} style={{ padding: '10px 18px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleGenerate} disabled={!selectedVersion || generating}
                style={{ padding: '10px 18px', background: !selectedVersion ? '#475569' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: !selectedVersion ? 'not-allowed' : 'pointer', opacity: generating ? 0.6 : 1 }}>
                {generating ? 'Gerando...' : 'Gerar Documento'}
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div>
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              ✓ Documento gerado com sucesso!
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>Título do Documento</label>
              <input value={titulo} onChange={e => setTitulo(e.target.value)} style={baseInput} />
            </div>

            <div style={{
              background: '#fff', color: '#1e293b', borderRadius: 10, padding: 24,
              fontSize: 13, lineHeight: 1.6, maxHeight: 400, overflow: 'auto', marginBottom: 16,
              fontFamily: 'Times New Roman, serif',
            }} dangerouslySetInnerHTML={{ __html: preview }} />

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={handleExport} style={{ padding: '10px 18px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                Visualizar em outra aba
              </button>
              <button onClick={handlePrint} style={{ padding: '10px 18px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Exportar PDF
              </button>
              <button onClick={() => { setStep('select'); setSelectedVersion(''); setPreview('') }}
                style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Gerar outro
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
