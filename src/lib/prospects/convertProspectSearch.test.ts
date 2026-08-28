import { describe, expect, it } from 'vitest'
import { searchConvertProspects, suggestRecentlyAnswered, type ConvertSearchProspect } from './convertProspectSearch'

const NOW = new Date('2026-08-28T12:00:00Z').getTime()

function daysAgo(n: number): string {
  return new Date(NOW - n * 86_400_000).toISOString()
}

function prospect(overrides: Partial<ConvertSearchProspect> & { id: string }): ConvertSearchProspect {
  return {
    company_name: null,
    contact_name: null,
    phone_number: null,
    email: null,
    prospect_fit_status: null,
    ...overrides,
  }
}

describe('searchConvertProspects', () => {
  const rows = [
    prospect({ id: 'sub', company_name: 'Big Drywall Co' }),
    prospect({ id: 'pre', company_name: 'Drymalla Construction' }),
    prospect({ id: 'contact', company_name: 'Acme', contact_name: 'Dryden Smith' }),
    prospect({ id: 'conv', company_name: 'Drylock Inc', prospect_fit_status: 'converted' }),
    prospect({ id: 'phone', company_name: 'Beta', phone_number: '979-732-5731' }),
  ]

  it('returns nothing for a blank query', () => {
    expect(searchConvertProspects(rows, '   ')).toEqual([])
  })

  it('ranks company prefix over company substring over contact matches', () => {
    expect(searchConvertProspects(rows, 'dry').map((p) => p.id)).toEqual(['pre', 'sub', 'contact'])
  })

  it('matches phone and email substrings', () => {
    expect(searchConvertProspects(rows, '732-5731').map((p) => p.id)).toEqual(['phone'])
  })

  it('never returns converted prospects', () => {
    expect(searchConvertProspects(rows, 'drylock')).toEqual([])
  })

  it('honors the limit', () => {
    expect(searchConvertProspects(rows, 'dry', 1).map((p) => p.id)).toEqual(['pre'])
  })
})

describe('suggestRecentlyAnswered', () => {
  const rows = [
    prospect({ id: 'a' }),
    prospect({ id: 'b' }),
    prospect({ id: 'old' }),
    prospect({ id: 'noanswer' }),
    prospect({ id: 'conv', prospect_fit_status: 'converted' }),
  ]
  const calls = {
    a: { interaction_type: 'answered', created_at: daysAgo(2) },
    b: { interaction_type: 'answered', created_at: daysAgo(1) },
    old: { interaction_type: 'answered', created_at: daysAgo(45) },
    noanswer: { interaction_type: 'didnt_answer', created_at: daysAgo(1) },
    conv: { interaction_type: 'answered', created_at: daysAgo(1) },
  }

  it('returns answered-within-30d prospects, newest first, excluding converted', () => {
    expect(suggestRecentlyAnswered(rows, calls, NOW).map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('honors the limit', () => {
    expect(suggestRecentlyAnswered(rows, calls, NOW, 1).map((p) => p.id)).toEqual(['b'])
  })

  it('returns nothing when there are no recent answers', () => {
    expect(suggestRecentlyAnswered(rows, { a: { interaction_type: 'answered', created_at: null } }, NOW)).toEqual([])
  })
})
