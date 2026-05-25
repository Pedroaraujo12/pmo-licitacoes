import { describe, it, expect } from 'vitest'
import { PT_BR } from '../pt-br'

describe('dicionário PT-BR', () => {
  it('não contém "Email" (deve ser "E-mail")', () => {
    expect(PT_BR.labels.email).toBe('E-mail')
  })

  it('não contém "CRUD" nas descrições de roles', () => {
    const roleValues = Object.values(PT_BR.roles)
    for (const desc of roleValues) {
      expect(desc).not.toContain('CRUD')
    }
  })

  it('não contém "N/A"', () => {
    expect(PT_BR.aging.na).toBe('Não aplicável')
  })

  it('não contém "7d"', () => {
    expect(PT_BR.filters.days7).toBe('7 dias')
  })

  it('não contém "30d"', () => {
    expect(PT_BR.filters.days30).toBe('30 dias')
  })

  it('não contém "Drive (Google Docs)"', () => {
    expect(PT_BR.googleDrive).not.toContain('(Google Docs)')
  })

  it('contém label E-mail', () => {
    expect(PT_BR.labels.email).toBe('E-mail')
  })

  it('contém label Nível de acesso', () => {
    expect(PT_BR.labels.accessLevel).toBe('Nível de acesso')
  })

  it('contém "Todos os status"', () => {
    expect(PT_BR.filters.allStatus).toBe('Todos os status')
  })
})
