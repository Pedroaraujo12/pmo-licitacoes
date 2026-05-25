import AditivosClient from './page-client'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default function AditivosWrapper({ params }: { params: Promise<{ id: string }> }) {
  return <AditivosClient params={params} />
}
