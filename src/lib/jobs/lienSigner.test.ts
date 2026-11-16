import { describe, expect, it } from 'vitest'
import { lienSignatureName, lienSignatureNameFor, lienSignerNameFor, lienSignerPhoneFor } from './lienSigner'
import { lienWaiverSignerName } from './lienWaiverSigners'

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

describe('the name a signature carries (v2.7395)', () => {
  const malachi = { id: 'u-malachi', name: 'Malachi', notes: 'Malachi Whites, Master Plumber (#RMP41130)', role: 'master_technician' }
  const robert = { id: 'u-robert', name: 'Robert', notes: 'PLUM APP: 184614 02/28/27 | A/C TEC: 160601 02/19/27', role: 'dev' }

  it('a leader signs by his full name, the title line up to its first comma, not the short name on his account', () => {
    expect(lienSignatureName(malachi)).toBe('Malachi Whites')
    expect(lienSignatureName({ ...malachi, notes: '  ' })).toBe('Malachi')
    expect(lienSignatureName({ ...malachi, notes: null })).toBe('Malachi')
    // A title line that opens on a comma leaves nothing: the account name stands.
    expect(lienSignatureName({ ...malachi, notes: ', Master Plumber' })).toBe('Malachi')
    expect(lienSignatureName({ name: ' ', notes: '', role: 'master_technician' })).toBe('')
  })

  it('a dev signs by his account name: his notes are licences, not a title line', () => {
    expect(lienSignatureName(robert)).toBe('Robert')
  })

  it('it is the waiver’s rule wherever the row has a name', () => {
    for (const u of [malachi, robert, { ...malachi, notes: null }]) expect(lienSignatureName(u)).toBe(lienWaiverSignerName({ name: u.name, notes: u.notes, role: u.role }))
  })

  it('by id off the desk’s list, with the fallback for a user who is not on it', () => {
    expect(lienSignatureNameFor([malachi, robert], 'u-malachi', 'Malachi')).toBe('Malachi Whites')
    expect(lienSignatureNameFor([malachi, robert], 'u-nobody', ' Wendi ')).toBe('Wendi')
    expect(lienSignatureNameFor([malachi, robert], null, '')).toBe('')
  })
})
