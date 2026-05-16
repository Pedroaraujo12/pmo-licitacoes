import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PMO Licitações | AgSUS CCS-RD',
  description: 'Gestão de Processos de Licitação',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
