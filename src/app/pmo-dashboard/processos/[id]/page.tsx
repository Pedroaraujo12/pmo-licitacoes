import ProcessoViewClient from './view-client'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default function ProcessoViewPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProcessoViewClient params={params} />
}
