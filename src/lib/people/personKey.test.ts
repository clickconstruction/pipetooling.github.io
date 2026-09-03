import { describe, expect, it } from 'vitest'
import {
  describeLastSeen,
  describePersonGap,
  parsePersonDeskParam,
  personDeskParam,
  resolvePersonKey,
  type PersonKeyPersonRow,
  type PersonKeyUserRow,
} from './personKey'

const U = 'c0ffee00-0000-4000-8000-000000000001'
const P = 'c0ffee00-0000-4000-8000-000000000002'

function user(p: Partial<PersonKeyUserRow> = {}): PersonKeyUserRow {
  return { id: U, name: 'Isiah', email: 'isiah@example.com', role: 'helpers', archived_at: null, ...p }
}
function person(p: Partial<PersonKeyPersonRow> = {}): PersonKeyPersonRow {
  return { id: P, name: 'Isiah', email: 'isiah@example.com', kind: 'helper', archived_at: null, account_user_id: U, ...p }
}

describe('resolvePersonKey', () => {
  it('a fully linked person has no gaps and pays under the account name', () => {
    const k = resolvePersonKey({ user: user(), person: person(), payConfigNames: ['Isiah'] })
    expect(k.userId).toBe(U)
    expect(k.personId).toBe(P)
    expect(k.payName).toBe('Isiah')
    expect(k.gaps).toEqual([])
    expect(k.isSub).toBe(false)
    expect(k.archived).toBe(false)
  })

  it('an account with no roster row reports the gap and still resolves a pay name', () => {
    const k = resolvePersonKey({ user: user({ name: ' Taunya ' }), person: null, payConfigNames: ['Taunya'] })
    expect(k.gaps).toEqual(['no_roster_row'])
    expect(k.payName).toBe('Taunya')
    expect(k.displayName).toBe('Taunya')
  })

  it('a roster-only sub reports no login and keys pay on the roster name', () => {
    const k = resolvePersonKey({ user: null, person: person({ kind: 'sub', name: 'DV Mechanical', account_user_id: null }), payConfigNames: [] })
    expect(k.gaps).toEqual(['no_login', 'no_pay_config'])
    expect(k.isSub).toBe(true)
    expect(k.payName).toBe('DV Mechanical')
    expect(k.userId).toBeNull()
  })

  it('an email-matched but unlinked roster row is a link gap, not a roster row', () => {
    const k = resolvePersonKey({
      user: user(),
      person: null,
      emailMatchedPerson: person({ account_user_id: null, name: 'Isiah W' }),
      payConfigNames: ['Isiah'],
    })
    expect(k.personId).toBeNull()
    expect(k.gaps).toEqual(['unlinked_email_match'])
    expect(k.emailMatchedPersonId).toBe(P)
    expect(k.emailMatchedPersonName).toBe('Isiah W')
  })

  it('an email-matched row that is already linked elsewhere is ignored', () => {
    const k = resolvePersonKey({ user: user(), person: null, emailMatchedPerson: person({ account_user_id: 'someone-else' }), payConfigNames: ['Isiah'] })
    expect(k.gaps).toEqual(['no_roster_row'])
    expect(k.emailMatchedPersonId).toBeNull()
  })

  it('name drift between account and roster is a pay-name gap, and the account name wins', () => {
    const k = resolvePersonKey({ user: user({ name: 'Michael A' }), person: person({ name: 'MIke Rodriguez' }), payConfigNames: ['Michael A'] })
    expect(k.gaps).toEqual(['pay_name_mismatch'])
    expect(k.payName).toBe('Michael A')
    expect(k.rosterName).toBe('MIke Rodriguez')
    expect(describePersonGap('pay_name_mismatch', k).action).toBe('Reconcile to "Michael A"')
  })

  it('a primary never gets a pay-config gap; an unreadable pay table raises none either', () => {
    expect(resolvePersonKey({ user: user({ role: 'primary', name: 'Bryan' }), person: null, payConfigNames: [] }).gaps).toEqual(['no_roster_row'])
    expect(resolvePersonKey({ user: user(), person: person(), payConfigNames: null }).gaps).toEqual([])
  })

  it('archived on either row marks the key archived', () => {
    expect(resolvePersonKey({ user: user({ archived_at: '2026-08-01T00:00:00Z' }), person: person(), payConfigNames: ['Isiah'] }).archived).toBe(true)
    expect(resolvePersonKey({ user: null, person: person({ archived_at: '2026-08-01T00:00:00Z', account_user_id: null }), payConfigNames: ['Isiah'] }).archived).toBe(true)
  })
})

describe('deep link param', () => {
  it('prefers the account id and round-trips both forms', () => {
    expect(personDeskParam({ userId: U, personId: P })).toBe(`u:${U}`)
    expect(personDeskParam({ personId: P })).toBe(`p:${P}`)
    expect(personDeskParam({})).toBeNull()
    expect(parsePersonDeskParam(`u:${U}`)).toEqual({ userId: U })
    expect(parsePersonDeskParam(`P:${P}`)).toEqual({ personId: P })
    expect(parsePersonDeskParam('u:not-a-uuid')).toBeNull()
    expect(parsePersonDeskParam(null)).toBeNull()
  })
})

describe('describeLastSeen', () => {
  const now = Date.parse('2026-09-03T18:00:00Z')
  it('reads in days, months, or never', () => {
    expect(describeLastSeen(null, now)).toBe('never signed in')
    expect(describeLastSeen('2026-09-03T08:00:00Z', now)).toBe('signed in today')
    expect(describeLastSeen('2026-08-30T08:00:00Z', now)).toBe('signed in 4d ago')
    expect(describeLastSeen('2026-07-01T08:00:00Z', now)).toBe('signed in 2mo ago')
  })
})
