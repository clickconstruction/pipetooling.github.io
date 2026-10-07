import { describe, expect, it } from 'vitest'
import type { BidSchedule } from './aiaBidSchedule'
import { aiaLineSources, defaultLineSource, lineItemValue, linesFromJobLineItems, namedLineItems } from './aiaLineSources'
import type { PayApplicationLine } from './aiaPayApplicationLines'

const row = (p: Partial<PayApplicationLine>): PayApplicationLine => ({ id: 'line-1', label: '', scheduledValue: 0, labor: null, stage: null, fromPrevious: 0, thisPeriod: 0, stored: 0, ...p })
const ONE = [row({ label: 'Rough In × 1; Top Out × 1; Trim Set × 1', scheduledValue: 37745 })]
// Job 892 on 2026-10-05: three stage Line Items that add to the job's $37,745.
const STAGES = [
  { id: 'f1', name: 'Rough In', count: 1, line_unit_price: 15098, sequence_order: 0 },
  { id: 'f2', name: 'Top Out', count: 1, line_unit_price: 15098, sequence_order: 1 },
  { id: 'f3', name: 'Trim Set', count: 1, line_unit_price: 7549, sequence_order: 2 },
]
const BID: BidSchedule = {
  shape: 'stage',
  splitLaborMaterial: true,
  lines: [row({ id: 'stage-rough_in', label: 'Rough In', scheduledValue: 33600, labor: 15120, stage: 'rough_in' }), row({ id: 'stage-top_out', label: 'Top Out', scheduledValue: 62400, labor: 28080, stage: 'top_out' })],
}

describe('a row per Line Item', () => {
  it('names each row for its Line Item, prices it, and reads its stage', () => {
    expect(linesFromJobLineItems(STAGES).map((l) => [l.id, l.label, l.scheduledValue, l.stage, l.thisPeriod])).toEqual([
      ['item-f1', 'Rough In', 15098, 'rough_in', 0],
      ['item-f2', 'Top Out', 15098, 'top_out', 0],
      ['item-f3', 'Trim Set', 7549, 'trim_set', 0],
    ])
  })

  it('shows the count when there is more than one, and prices count times unit price to the cent', () => {
    const [l] = linesFromJobLineItems([{ id: 'a', name: ' Lavatory ', count: 4, line_unit_price: 312.335 }])
    expect([l!.label, l!.scheduledValue, l!.stage]).toEqual(['Lavatory × 4', 1249.34, null])
    expect(lineItemValue({ count: null, line_unit_price: 500 })).toBe(0)
  })

  it('keeps the Bill tab\'s order and leaves a Line Item with no name behind', () => {
    const items = [
      { id: 'c', name: 'Trim Set', count: 1, line_unit_price: 1, sequence_order: 2 },
      { id: 'x', name: '  ', count: 1, line_unit_price: 1, sequence_order: 1 },
      { id: 'a', name: 'Rough In', count: 1, line_unit_price: 1, sequence_order: 0 },
    ]
    expect(namedLineItems(items).map((i) => i.id)).toEqual(['a', 'c'])
  })
})

describe('the starts a job has', () => {
  it('offers one row and a row per Line Item on a job with stage Line Items and no bid schedule, one row picked', () => {
    const sources = aiaLineSources({ oneLine: ONE, lineItems: STAGES, bidSchedule: null })
    expect(sources.map((s) => [s.key, s.title, s.detail, s.lines?.length ?? null])).toEqual([
      ['one', 'One row', 'The whole contract, $37,745.00', 1],
      ['items', 'A row per Line Item', '3 rows: Rough In, Top Out, Trim Set', 3],
    ])
    expect(defaultLineSource(sources)).toBe('one')
  })

  it('has only one row on a job with fewer than two Line Items', () => {
    expect(aiaLineSources({ oneLine: ONE, lineItems: STAGES.slice(0, 1), bidSchedule: null }).map((s) => s.key)).toEqual(['one'])
    expect(aiaLineSources({ oneLine: ONE, lineItems: [], bidSchedule: null }).map((s) => s.key)).toEqual(['one'])
  })

  it('lists a row per Line Item but turns it off, with the reason, when a Line Item has no price', () => {
    const one = aiaLineSources({ oneLine: ONE, lineItems: [STAGES[0]!, { ...STAGES[1]!, line_unit_price: null }, STAGES[2]!], bidSchedule: null })[1]!
    expect([one.lines, one.detail]).toEqual([null, '1 Line Item has no price. Price it on the Bill tab to use this.'])
    const two = aiaLineSources({ oneLine: ONE, lineItems: STAGES.map((s) => ({ ...s, line_unit_price: 0 })).slice(0, 2), bidSchedule: null })[1]!
    expect(two.detail).toBe('2 Line Items have no price. Price them on the Bill tab to use this.')
  })

  it('adds the bid\'s schedule, with the bid\'s split, and picks it when the job has one', () => {
    const sources = aiaLineSources({ oneLine: ONE, lineItems: STAGES, bidSchedule: BID })
    expect(sources.map((s) => s.key)).toEqual(['one', 'items', 'bid'])
    expect([sources[2]!.detail, sources[2]!.splitLaborMaterial]).toEqual(['2 rows: Rough In, Top Out', true])
    expect(defaultLineSource(sources)).toBe('bid')
    expect(aiaLineSources({ oneLine: ONE, lineItems: [], bidSchedule: { ...BID, lines: [] } }).map((s) => s.key)).toEqual(['one'])
  })

  it('cuts a long list of rows short in the detail', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ id: `f${i}`, name: `Unit ${i + 1}`, count: 1, line_unit_price: 100, sequence_order: i }))
    expect(aiaLineSources({ oneLine: ONE, lineItems: many, bidSchedule: null })[1]!.detail).toBe('6 rows: Unit 1, Unit 2, Unit 3, Unit 4, and 2 more')
  })
})
