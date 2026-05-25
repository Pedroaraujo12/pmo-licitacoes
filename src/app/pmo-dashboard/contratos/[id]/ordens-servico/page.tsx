import OrdensServicoClient from './page-client'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default function ContratoOrdensServicoWrapper({ params }: { params: Promise<{ id: string }> }) {
  return <OrdensServicoClient params={params} />
}
