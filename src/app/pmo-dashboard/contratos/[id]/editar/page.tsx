import EditContratoClient from './edit-client'

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default function EditContratoPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditContratoClient params={params} />
}
