import PagamentosClient from './page-client'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default function PagamentosWrapper({ params }: { params: Promise<{ id: string }> }) {
  return <PagamentosClient params={params} />
}
