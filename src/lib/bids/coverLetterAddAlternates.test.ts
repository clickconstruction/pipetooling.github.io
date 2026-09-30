import { describe, expect, it } from 'vitest'
import type { ComputedBidPricingRow } from '../bidPricingRowCalculations'
import { alternateIsPriced, boardAlternateAddOn, buildAddAlternatesBlock, offeredAddAlternates, splitLetterTotalsByAlternate, stampAddAlternateAmounts } from './coverLetterAddAlternates'
import { buildCoverLetterHtml, buildCoverLetterText } from '../bidDocuments/coverLetter'

const row = (id: string, fixture: string, count: number, revenue: number, omit = false): ComputedBidPricingRow =>
  ({ countRow: { id, fixture, count }, count, revenue, omitFromSubmissionDocuments: omit, cost: 0 } as unknown as ComputedBidPricingRow)
const rows = [row('a', 'WC', 4, 2720), row('b', 'ft of 2" PVC', 112, 4704), row('c', 'WH', 1, 3100), row('d', 'WC', 1, 680), row('e', 'ft of 2" PVC', 48.5, 2037)]
const countRows = [
  { id: 'a', group_tag: 'Restroom A' }, { id: 'b', group_tag: 'Restroom A' }, { id: 'c', group_tag: null }, { id: 'd', group_tag: 'Break room' }, { id: 'e', group_tag: 'break room' },
]
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

describe('coverLetterAddAlternates (v2.4195)', () => {
  it('splits the letter totals into the base and each alternate; null without one', () => {
    const s = splitLetterTotalsByAlternate(rows, countRows, ['Break room'])!
    expect(s.base.revenueSum).toBe(10524)
    expect(s.base.fixtureRows).toEqual([{ fixture: 'WC', count: 4 }, { fixture: 'ft of 2" PVC', count: 112 }, { fixture: 'WH', count: 1 }])
    expect(s.alternates).toEqual([{ key: 'group:break room', label: 'Break room', revenueSum: 2717, fixtureRows: [{ fixture: 'WC', count: 1 }, { fixture: 'ft of 2" PVC', count: 48.5 }] }])
    expect(splitLetterTotalsByAlternate(rows, countRows, [])).toBeNull()
    expect(splitLetterTotalsByAlternate(rows, countRows, ['Nowhere'])).toBeNull()
  })

  it('offers every alternate unless its offered flag is false, and the block reads add / with it', () => {
    const s = splitLetterTotalsByAlternate(rows, countRows, ['Break room'])!
    expect(offeredAddAlternates(s, { groups: { 'group:break room': { offered: false } } })).toEqual([])
    const offered = offeredAddAlternates(s, {})
    const block = buildAddAlternatesBlock(offered, s.base.revenueSum, {}, fmt)!
    expect(block.heading).toBe('Alternates — priced in addition to the proposal above:')
    expect(block.items).toEqual([{ label: 'Alternate 1 — Break room', deltaText: 'add $2,717', amountFormatted: 'with it, $13,241.00', note: '[1] WC · [48.5] ft of 2" PVC' }])
    const worded = buildAddAlternatesBlock(offered, 10524, { sections: { 'group:break room': { label: 'Alternate 1 — Break room plumbing', note: 'The break room sink and its drain.' } } }, fmt, true)!
    expect(worded.items[0]).toMatchObject({ label: 'Alternate 1 — Break room plumbing', note: 'The break room sink and its drain.', editKey: 'group:break room' })
    expect(buildAddAlternatesBlock([], 10524, {}, fmt)).toBeNull()
  })

  it('v2.4224: an unpriced alternate reads "price to follow" — never "add $0 (with it, <the base>)"', () => {
    const s = splitLetterTotalsByAlternate(rows, countRows, ['Break room'])!
    const unpriced = offeredAddAlternates(s, {}).map((g) => ({ ...g, revenueSum: 0 }))
    const block = buildAddAlternatesBlock(unpriced, s.base.revenueSum, {}, fmt)!
    expect(block.items[0]).toMatchObject({ label: 'Alternate 1 — Break room', deltaText: null, amountFormatted: 'price to follow' })
    const html = buildCoverLetterHtml('GC', 'addr', 'Sunridge Dental', 'proj', 'TEN THOUSAND', '$10,524.00', s.base.fixtureRows, '', '', '', null, 'Plumbing', true, true, null, null, null, null, null, null, block)
    expect(html).toContain('price to follow')
    expect(html).not.toContain('add $0')
    expect(alternateIsPriced({ revenueSum: 0 })).toBe(false)
    expect(alternateIsPriced({ revenueSum: Number.NaN })).toBe(false)
    expect(alternateIsPriced({ revenueSum: 2717 })).toBe(true)
    // nothing to stamp for it either
    expect(stampAddAlternateAmounts({}, { ...s, alternates: s.alternates.map((a) => ({ ...a, revenueSum: 0 })) })).toEqual({})
  })

  it('prints after the in-lieu block in the html and the text', () => {
    const s = splitLetterTotalsByAlternate(rows, countRows, ['Break room'])!
    const block = buildAddAlternatesBlock(offeredAddAlternates(s, {}), s.base.revenueSum, {}, fmt)
    const html = buildCoverLetterHtml('GC', 'addr', 'Sunridge Dental', 'proj', 'TEN THOUSAND', '$10,524.00', s.base.fixtureRows, '', '', '', null, 'Plumbing', true, true, null, null, null, null, null, null, block)
    expect(html).toContain('Alternates — priced in addition to the proposal above:')
    expect(html).toContain('<strong>Alternate 1 — Break room</strong>: <strong>add $2,717</strong> (with it, $13,241.00)')
    expect(html).toContain('[1] WC · [48.5] ft of 2&quot; PVC')
    const text = buildCoverLetterText('GC', 'addr', 'Sunridge Dental', 'proj', 'TEN THOUSAND', '$10,524.00', s.base.fixtureRows, '', '', '', null, 'Plumbing', true, true, null, null, null, null, null, null, block)
    expect(text).toContain('     • Alternate 1 — Break room: add $2,717 (with it, $13,241.00)')
    expect(text.indexOf('Alternates — priced in addition')).toBeLessThan(text.indexOf('Exclusions and Scope:'))
  })

  it('stamps the offered add-ons on a send and the board reads them back', () => {
    const s = splitLetterTotalsByAlternate(rows, countRows, ['Break room'])!
    const stamped = stampAddAlternateAmounts({ groups: { 'group:break room': { offered: true } } }, s)
    expect(stamped.groups).toEqual({ 'group:break room': { offered: true, amount: 2717 } })
    expect(boardAlternateAddOn(stamped)).toEqual({ total: 2717, parts: [{ key: 'group:break room', amount: 2717 }] })
    const off = stampAddAlternateAmounts({ groups: { 'group:break room': { offered: false, amount: 2717 } } }, s)
    expect(off.groups).toEqual({ 'group:break room': { offered: false } })
    expect(boardAlternateAddOn(off)).toBeNull()
    expect(stampAddAlternateAmounts({}, null).groups).toBeUndefined()
  })
})
