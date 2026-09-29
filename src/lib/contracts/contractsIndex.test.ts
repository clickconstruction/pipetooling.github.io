import { describe, expect, it } from 'vitest'
import { CONTRACT_AREA_ORDER, contractLensCounts, contractLensLabel, entryIdFromHash, indexRowMatches, indexSection, needsLookReasons, reviewWord, type IndexCard } from './contractsIndex'
import { CUSTOMER_CONTRACT_CATALOG } from './customerContractCatalog'

const card = (id: string, over: Partial<IndexCard> = {}): IndexCard => {
  const entry = CUSTOMER_CONTRACT_CATALOG.find((e) => e.id === id)!
  return { entry, text: { key: id, title: entry.name, text: 'Some wording here.', status: 'yours' }, sent: null, review: { status: 'never' }, ...over }
}

describe('contractsIndex', () => {
  it('orders the sections the way a customer meets them, and every catalog area has one', () => {
    expect(CONTRACT_AREA_ORDER).toEqual(['estimates', 'bids', 'jobs', 'signing', 'billing', 'liens'])
    for (const e of CUSTOMER_CONTRACT_CATALOG) expect(CONTRACT_AREA_ORDER).toContain(e.area)
  })

  it('a card needs a look when what went out differs, nothing is set, or the review is due — never for "never reviewed"', () => {
    expect(needsLookReasons(card('bid-terms'))).toEqual([])
    expect(needsLookReasons(card('bid-terms', { sent: { status: 'differs', staleDrafts: 0 } }))).toEqual(['differs'])
    expect(needsLookReasons(card('bid-terms', { sent: { status: 'same', staleDrafts: 2 } }))).toEqual(['differs'])
    expect(needsLookReasons(card('estimate-terms', { text: { key: 'estimate-terms', title: 'Estimate Terms', text: '', status: 'blank' } }))).toEqual(['blank'])
    expect(needsLookReasons(card('esign-consent', { review: { status: 'due' } }))).toEqual(['review_due'])
  })

  it('the lens counts every card once per lens, and a row matches its lens and the find box', () => {
    const cards = [card('bid-terms', { sent: { status: 'differs', staleDrafts: 0 } }), card('bid-exclusions', { text: { key: 'bid-exclusions', title: 'Bid exclusions', text: 'Concrete cutting is excluded.', status: 'built_in' } }), card('job-standard-terms')]
    const counts = contractLensCounts(cards)
    expect(counts.all).toBe(3)
    expect(counts.needs_look).toBe(1)
    expect(counts.yours).toBe(2)
    expect(counts.built_in).toBe(1)
    expect(contractLensLabel('needs_look')).toBe('Needs a look')
    expect(contractLensLabel('built_in')).toBe('Built-in wording')
    expect(indexRowMatches(cards[0]!, 'needs_look', '')).toBe(true)
    expect(indexRowMatches(cards[2]!, 'needs_look', '')).toBe(false)
    expect(indexRowMatches(cards[1]!, 'built_in', 'concrete')).toBe(true)
    expect(indexRowMatches(cards[1]!, 'built_in', 'warranty')).toBe(false)
    expect(indexSection(cards, 'bids', 'all', 'exclus').map((c) => c.entry.id)).toEqual(['bid-exclusions'])
    expect(indexSection(cards, 'jobs', 'all', '').map((c) => c.entry.id)).toEqual(['job-standard-terms'])
  })

  it('a row’s review word is short, and the hash names the row to open', () => {
    expect(reviewWord({ status: 'never', last: null })).toBe('Never')
    expect(reviewWord({ status: 'due', last: null })).toBe('Due')
    expect(reviewWord({ status: 'ok', last: { reviewed_on: '2026-09-28' } as never })).toBe('Reviewed 9/28/26')
    expect(entryIdFromHash('#settings-contract-job-standard-terms')).toBe('job-standard-terms')
    expect(entryIdFromHash('settings-contract-bid-terms')).toBe('bid-terms')
    expect(entryIdFromHash('#settings-bid-cover-letter-defaults')).toBeNull()
    expect(entryIdFromHash('')).toBeNull()
  })
})
