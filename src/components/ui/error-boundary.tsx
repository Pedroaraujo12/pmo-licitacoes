'use client'

import { Component } from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error) => void
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'erro sem mensagem' }
  }

  componentDidCatch(error: Error) {
    console.warn('[ErrorBoundary]', error.message)
    this.props.onError?.(error)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          Erro ao carregar este componente.
          {/* A mensagem fica visível: em celular não há console para consultar. */}
          <div style={{
            marginTop: 8, color: '#64748b', fontSize: 11,
            wordBreak: 'break-word', maxWidth: 520, marginInline: 'auto',
          }}>
            {this.state.message}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
