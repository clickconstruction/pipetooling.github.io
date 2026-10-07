import { describe, expect, it } from 'vitest'
import { legalFirmFacts, legalFirmFactsWords, legalFirmInputProblem, legalFirmReplaceWords, legalReplaceErrorWords, particularsFilled } from './legalFirmFacts'

const matter = (id: string, firm_id: string | null, stage: string, closed_at: string | null = null) => ({ id, firm_id, stage, closed_at, payer_name: `Payer ${id}`, payer_key: `c:${id}` })

describe('legalFirmFacts', () => {
  it('counts only this firm’s open accounts and listed people', () => {
    const f = legalFirmFacts(
      'firm-1',
      [
        matter('a', 'firm-1', 'referred'),
        matter('b', 'firm-1', 'settled'), // an end the office has not closed: still with the firm
        matter('c', 'firm-1', 'settled', '2026-10-01T00:00:00Z'), // closed
        matter('d', 'firm-1', 'review'), // not released
        matter('e', 'firm-1', 'pulled'),
        matter('f', 'firm-2', 'suit'),
        matter('g', null, 'review'),
      ],
      [{ firm_id: 'firm-1', removed_at: null }, { firm_id: 'firm-1', removed_at: '2026-10-02T00:00:00Z' }, { firm_id: 'firm-2', removed_at: null }, { removed_at: null }],
      false,
    )
    expect(f.withFirm.map((m) => m.id)).toEqual(['a', 'b'])
    expect(f.people).toBe(2)
    expect(legalFirmFactsWords(f)).toEqual(['2 accounts with the firm', '2 people on its email list', 'portal link off'])
  })

  it('says one in the singular and leaves the link out while unknown', () => {
    const f = legalFirmFacts('firm-1', [matter('a', 'firm-1', 'demand')], [{ firm_id: 'firm-1', removed_at: null }], null)
    expect(legalFirmFactsWords(f)).toEqual(['1 account with the firm', '1 person on its email list'])
    expect(legalFirmFactsWords({ withFirm: [], people: 0, linkLive: true })).toEqual(['0 accounts with the firm', '0 people on its email list', 'portal link on'])
  })
})

describe('particularsFilled', () => {
  it('counts the filled particulars out of eight, ignoring blanks', () => {
    expect(particularsFilled({})).toEqual({ filled: 0, total: 8 })
    expect(particularsFilled({ entity: 'Click Plumbing and Electrical, LLC', license: 'M-41207', agent: '  ', phone: '(512) 360-0599' })).toEqual({ filled: 3, total: 8 })
  })
})

describe('legalFirmInputProblem', () => {
  it('asks for a name, a percent and a cost', () => {
    expect(legalFirmInputProblem({ name: 'Example Law Firm, PLLC', contingency_pct: '33', filing_cost: '350' })).toBeNull()
    expect(legalFirmInputProblem({ name: '  ', contingency_pct: '33', filing_cost: '350' })).toBe('Give the firm a name.')
    expect(legalFirmInputProblem({ name: 'X', contingency_pct: '101', filing_cost: '350' })).toMatch(/^Contingency is a percent/)
    expect(legalFirmInputProblem({ name: 'X', contingency_pct: '33', filing_cost: '-1' })).toMatch(/^Contingency is a percent/)
    expect(legalFirmInputProblem({ name: 'X', contingency_pct: '', filing_cost: '350' })).toMatch(/^Contingency is a percent/)
  })
})

describe('legalFirmReplaceWords', () => {
  it('says what retiring the old firm does, by what hangs on it', () => {
    expect(legalFirmReplaceWords('ZZ Test Firm', { people: 2, linkLive: true })).toEqual([
      'ZZ Test Firm is retired. Its history stays on its record.',
      'Its portal link stops working.',
      'Its 2 people on its email list stop getting emails.',
      'The new firm starts with no link and no people. You create its link and send it from the desk.',
    ])
    const none = legalFirmReplaceWords('ZZ Test Firm', { people: 0, linkLive: false })
    expect(none[1]).toBe('It has no live portal link.')
    expect(none[2]).toBe('Nobody is on its email list.')
    expect(legalFirmReplaceWords('A', { people: 1, linkLive: null })[2]).toBe('The 1 person on its email list stops getting emails.')
  })
})

describe('legalReplaceErrorWords', () => {
  it('names a database update not yet pushed and a race, and passes the rest through', () => {
    expect(legalReplaceErrorWords('Could not find the function public.legal_replace_firm(p_contingency_pct, …) in the schema cache')).toMatch(/^Replacing needs a database update/)
    expect(legalReplaceErrorWords('duplicate key value violates unique constraint "legal_firms_one_active"')).toMatch(/^Another firm became active/)
    expect(legalReplaceErrorWords('2 accounts are still with ZZ Test Firm. Pull them back first.')).toBe('2 accounts are still with ZZ Test Firm. Pull them back first.')
    expect(legalReplaceErrorWords(null)).toBe('Could not replace the firm. Try again.')
  })
})
