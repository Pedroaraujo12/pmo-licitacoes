import { useEffect } from 'react'
import { Trash2, X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
  titulo?: string
  mensagem?: string
}

export default function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  loading,
  titulo = 'Excluir Processo',
  mensagem = 'Tem certeza que deseja excluir este processo? Esta ação é irreversível.',
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-md overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h3 className="text-base font-bold text-slate-100">{titulo}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition cursor-pointer bg-transparent border-none"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">
          <p className="text-sm text-slate-300 leading-relaxed">{mensagem}</p>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/5">
          <button
            onClick={onClose}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer border-none disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer border-none disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {loading ? 'Excluindo...' : 'Sim, Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}
