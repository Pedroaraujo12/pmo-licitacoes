import EditProcessoClient from './edit-client'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default function EditProcessoPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditProcessoClient params={params} />
}
