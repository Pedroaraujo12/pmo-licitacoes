import MedicoesClient from './page-client'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default function MedicoesWrapper({ params }: { params: Promise<{ id: string }> }) {
  return <MedicoesClient params={params} />
}
