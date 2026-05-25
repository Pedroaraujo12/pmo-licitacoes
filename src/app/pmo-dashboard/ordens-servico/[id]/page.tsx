import OrdemServicoDetailClient from './detail-client'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default function OrdemServicoPage({ params }: { params: Promise<{ id: string }> }) {
  return <OrdemServicoDetailClient params={params} />
}
