import { describe, expect, it } from 'vitest'
import { userInitials } from './userInitials'

describe('userInitials', () => {
  it('nombre y apellido en mayúsculas', () => {
    expect(userInitials({ first_name: 'ana', last_name: 'pérez', email: 'x@y.es' })).toBe('AP')
  })
  it('solo nombre', () => {
    expect(userInitials({ first_name: 'Ana', last_name: '', email: 'x@y.es' })).toBe('A')
  })
  it('sin nombre cae en el email', () => {
    expect(userInitials({ first_name: '', last_name: '', email: 'oscar@y.es' })).toBe('O')
  })
  it('sin usuario o sin datos devuelve vacío', () => {
    expect(userInitials(null)).toBe('')
    expect(userInitials({ first_name: ' ', last_name: null, email: '' })).toBe('')
  })
})
