import { describe, expect, it } from 'vitest'
import { analyzeCandidates, normalizeEmail, normalizePhone, type HygieneCandidate } from './candidateHygiene'

function cand(overrides: Partial<HygieneCandidate> & { id: string }): HygieneCandidate {
  return {
    phone_number: null,
    email: null,
    role_id: 'hvac',
    rank_order: 0,
    last_contact: null,
    ...overrides,
  }
}

describe('normalizePhone', () => {
  it('keeps digits and drops a leading US 1', () => {
    expect(normalizePhone('(832) 433-4984')).toBe('8324334984')
    expect(normalizePhone('1-832-433-4984')).toBe('8324334984')
    expect(normalizePhone('832 433 4984')).toBe('8324334984')
  })

  it('rejects blanks and too-short fragments', () => {
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone('call me')).toBeNull()
    expect(normalizePhone('12345')).toBeNull()
  })
})

describe('normalizeEmail', () => {
  it('lowercases and trims; requires an @', () => {
    expect(normalizeEmail(' Caid_Lurwick@iCloud.com ')).toBe('caid_lurwick@icloud.com')
    expect(normalizeEmail('not an email')).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
  })
})

describe('analyzeCandidates', () => {
  it('flags a same-column duplicate, keeping the better rank', () => {
    const rows = [
      cand({ id: 'joel4', phone_number: '832 433 4984', rank_order: 4 }),
      cand({ id: 'joel10', phone_number: '832-433-4984', rank_order: 10 }),
    ]
    const h = analyzeCandidates(rows)
    expect(h.duplicateOf).toEqual({ joel10: 'joel4' })
  })

  it('matches on email when phones differ', () => {
    const rows = [
      cand({ id: 'a', email: 'caid@icloud.com', phone_number: '318 632 1034', rank_order: 1 }),
      cand({ id: 'b', email: 'CAID@icloud.com', phone_number: '830-221-7757', rank_order: 2 }),
    ]
    expect(analyzeCandidates(rows).duplicateOf).toEqual({ b: 'a' })
  })

  it('reports cross-role membership instead of duplicates for different columns', () => {
    const rows = [
      cand({ id: 'p', role_id: 'plumber', phone_number: '318 632 1034', rank_order: 1 }),
      cand({ id: 'h', role_id: 'hvac', phone_number: '318 632 1034', rank_order: 9 }),
    ]
    const h = analyzeCandidates(rows)
    expect(h.duplicateOf).toEqual({})
    expect(h.crossRoles.p).toEqual(['hvac'])
    expect(h.crossRoles.h).toEqual(['plumber'])
  })

  it('never matches on missing phone/email', () => {
    const rows = [cand({ id: 'a', rank_order: 1 }), cand({ id: 'b', rank_order: 2 })]
    const h = analyzeCandidates(rows)
    expect(h.duplicateOf).toEqual({})
    expect(h.crossRoles).toEqual({})
  })

  it('counts never-contacted per role and picks the top-ranked as call-next, skipping duplicates', () => {
    const rows = [
      cand({ id: 'contacted', rank_order: 1, last_contact: '2026-08-01T00:00:00Z' }),
      cand({ id: 'next', rank_order: 2 }),
      cand({ id: 'later', rank_order: 3 }),
      cand({ id: 'dup', rank_order: 4, phone_number: '830 992 0236' }),
      cand({ id: 'dupOf', rank_order: 9, phone_number: '(830) 992-0236' }),
      cand({ id: 'other', role_id: 'plumber', rank_order: 1 }),
    ]
    const h = analyzeCandidates(rows)
    expect(h.neverContactedByRole.hvac).toBe(3) // next, later, dup (dupOf excluded as duplicate)
    expect(h.callNextByRole.hvac).toBe('next')
    expect(h.neverContactedByRole.plumber).toBe(1)
    expect(h.callNextByRole.plumber).toBe('other')
  })
})
