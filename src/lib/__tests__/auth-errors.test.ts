import { describe, it, expect } from 'vitest'
import { translateAuthError } from '../auth-errors'

describe('translateAuthError', () => {
  it('traduz Invalid login credentials', () => {
    expect(translateAuthError('Invalid login credentials')).toBe('E-mail ou senha inválidos.')
  })

  it('traduz Email not confirmed', () => {
    expect(translateAuthError('Email not confirmed')).toBe('E-mail ainda não confirmado. Verifique sua caixa de entrada.')
  })

  it('traduz User already registered', () => {
    expect(translateAuthError('User already registered')).toBe('Este e-mail já está cadastrado.')
  })

  it('traduz Rate limit exceeded', () => {
    expect(translateAuthError('Rate limit exceeded')).toBe('Muitas tentativas. Aguarde alguns minutos.')
  })

  it('retorna mensagem genérica se não mapeada', () => {
    expect(translateAuthError('Unknown error')).toBe('Não foi possível concluir a operação. Tente novamente.')
  })

  it('retorna string vazia se vazia', () => {
    expect(translateAuthError('')).toBe('')
  })
})
