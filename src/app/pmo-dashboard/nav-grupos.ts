import {
  LayoutDashboard, FileText, Users, Calendar, FileEdit, Contact2,
  StickyNote, Sun, FileSignature, Building2, CalendarClock,
} from 'lucide-react'

/*
 * Onze itens numa lista plana obrigam a varrer tudo para achar qualquer coisa.
 * Os grupos abaixo respeitam a ordem que ja existia — nenhum item mudou de
 * lugar, inclusive Cronograma e Simulador, promovidos ao topo de proposito —
 * e apenas nomeiam as fronteiras que a propria sequencia ja tinha.
 */
export const navGrupos = [
  {
    titulo: 'Visão geral',
    itens: [
      { href: '/pmo-dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/pmo-dashboard/cronograma', label: 'Cronograma', icon: Calendar },
      { href: '/pmo-dashboard/simulador', label: 'Simulador', icon: CalendarClock },
    ],
  },
  {
    titulo: 'Processos',
    itens: [
      { href: '/pmo-dashboard/processos', label: 'Processos', icon: FileText },
      { href: '/pmo-dashboard/contratos', label: 'Contratos', icon: FileSignature },
      { href: '/pmo-dashboard/fornecedores', label: 'Fornecedores', icon: Building2 },
      { href: '/pmo-dashboard/documentos', label: 'Documentos', icon: FileEdit },
    ],
  },
  {
    titulo: 'Apoio',
    itens: [
      { href: '/pmo-dashboard/colaboradores', label: 'Colaboradores', icon: Contact2 },
      { href: '/pmo-dashboard/notas', label: 'Notas', icon: StickyNote },
      { href: '/pmo-dashboard/notas/hoje', label: 'Painel do Dia', icon: Sun },
      { href: '/pmo-dashboard/usuarios', label: 'Usuários', icon: Users },
    ],
  },
]
