import { describe, expect, it } from 'vitest'
import { lienSignerNameFor, lienSignerPhoneFor } from './lienSigner'

const users = [
  { id: 'u-robert', name: 'Robert Douglas', notes: 'Robert Douglas, Master Plumber', phone: '(830) 555-0142' },
  { id: 'u-nophone', name: 'Rey Salinas', notes: '', phone: '' },
]

describe('the signer and the callback number', () => {
  it('signs as the master (title first), else the session', () => {
    expect(lienSignerNameFor(users, 'u-robert', 'Taunya')).toBe('Robert Douglas, Master Plumber')
    expect(lienSignerNameFor(users, 'u-nophone', 'Taunya')).toBe('Rey Salinas')
    expect(lienSignerNameFor(users, null, ' Taunya ')).toBe('Taunya')
    expect(lienSignerNameFor(users, 'u-missing', 'Taunya')).toBe('Taunya')
  })

  it("{{phone}} is the signer's own phone, the letterhead's only when he has none (counsel, answer 7)", () => {
    expect(lienSignerPhoneFor(users, 'u-robert', '(210) 555-0100')).toBe('(830) 555-0142')
    expect(lienSignerPhoneFor(users, 'u-nophone', '(210) 555-0100')).toBe('(210) 555-0100')
    expect(lienSignerPhoneFor(users, null, '(210) 555-0100')).toBe('(210) 555-0100')
    expect(lienSignerPhoneFor(users, 'u-nophone', null)).toBe('')
  })
})
