'use client'

import { useState, useCallback, createContext, useContext } from 'react'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextType {
  toast: (message: string, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: t.type === 'error' ? 'rgba(239,68,68,0.95)' : t.type === 'success' ? 'rgba(5,150,105,0.95)' : 'rgba(30,41,59,0.95)',
            color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)',
            pointerEvents: 'auto', maxWidth: 360,
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
