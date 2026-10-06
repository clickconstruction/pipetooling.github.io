import { describe, expect, it } from 'vitest'
import { legalFirmFacts, legalFirmFactsWords, particularsFilled } from './legalFirmFacts'

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
