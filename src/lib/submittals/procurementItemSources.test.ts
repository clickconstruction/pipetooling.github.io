import { describe, expect, it } from 'vitest'
import { procurementItemSources, procurementSourceIds, type ProcurementItemLike, type ProcurementSourceFacts } from './procurementItemSources'
import type { SubmittalPartRow } from './itemParts'

const HOUSE = 'h-1'
const item = (over: Partial<ProcurementItemLike> & { id: string; tag: string }): ProcurementItemLike => ({
  submitted_manufacturer: null,
  submitted_model: null,
  submitted_label: null,
  specified_manufacturer: null,
  specified_model: null,
  specified_description: null,
  lead_time_days: null,
  review_decision: null,
  reviewed_at: null,
  supply_house_id: null,
  ...over,
})
const part = (over: Partial<SubmittalPartRow> & { id: string; item_id: string; procure_key: string; label: string }): SubmittalPartRow =>
  ({ bid_id: 'b', sequence_order: 1, quantity: 1, on_submittal: true, source: 'takeoff', supply_house_id: null, lead_time_days: null, stage: null, review_decision: null, reviewed_at: null, review_note: null, assembly: null, priced_label: null, ...over }) as SubmittalPartRow
const facts = (over: Partial<ProcurementSourceFacts> = {}): ProcurementSourceFacts => ({ houseNames: new Map([[HOUSE, 'Moore Supply']]), usualLead: new Map([[HOUSE, 10]]), counts: new Map([['c-1', 4]]), fixtures: new Map([['c-1', 'WC 1&2']]), ...over })

describe('procurementItemSources', () => {
  it('names the ids the facts must cover', () => {
    const items = [item({ id: 'i1', tag: 'WC-1', supply_house_id: HOUSE, source_count_row_id: 'c-1' }), item({ id: 'i2', tag: 'LAV-1', supply_house_id: HOUSE })]
    expect(procurementSourceIds(items, [part({ id: 'p1', item_id: 'i1', procure_key: 'k1', label: 'Bowl', supply_house_id: 'h-2' })])).toEqual({ houseIds: [HOUSE, 'h-2'], countRowIds: ['c-1'] })
  })

  it('a plain row is one line: its product, its house, the house’s usual lead time when it has none', () => {
    const out = procurementItemSources([item({ id: 'i1', tag: ' WC-1 ', submitted_manufacturer: 'Toto', submitted_model: 'CST744', supply_house_id: HOUSE, review_decision: 'approved', reviewed_at: '2026-10-02T00:00:00Z' })], true, [], facts())
    expect(out).toEqual([expect.objectContaining({ tag: 'WC-1', product: 'Toto CST744', supplyHouse: 'Moore Supply', leadTimeDays: 10, shared: true, itemId: 'i1', decision: { kind: 'approved', at: '2026-10-02T00:00:00Z' } })])
  })

  it('a row with no product reads the plans’ words and says so; a blank tag is skipped; an order-only row waits for no call', () => {
    const out = procurementItemSources(
      [item({ id: 'i1', tag: 'UTILITY SINK', specified_description: 'Utility sink per plans' }), item({ id: 'i2', tag: '  ' }), item({ id: 'i3', tag: 'HB-1', submitted_label: 'Woodford 24', order_only: true, review_decision: 'approved' })],
      false,
      [],
      facts(),
    )
    expect(out.map((s) => s.tag)).toEqual(['UTILITY SINK', 'HB-1'])
    expect(out[0]).toMatchObject({ product: 'Utility sink per plans', noProduct: true, decision: null })
    expect(out[1]).toMatchObject({ orderOnly: true, noGc: true, decision: null })
  })

  it('a row with parts is a line a part: the count times how many go on one, the part’s own call', () => {
    const out = procurementItemSources(
      [item({ id: 'i1', tag: 'WC-1', source_count_row_id: 'c-1', lead_time_days: 14 })],
      true,
      [
        part({ id: 'p2', item_id: 'i1', procure_key: 'k-carrier', label: 'Zurn carrier', sequence_order: 2, on_submittal: false, quantity: 1 }),
        part({ id: 'p1', item_id: 'i1', procure_key: 'k-bowl', label: 'Toto bowl', sequence_order: 1, quantity: 2, review_decision: 'rejected', reviewed_at: '2026-10-02T00:00:00Z', supply_house_id: HOUSE }),
      ],
      facts(),
    )
    expect(out.map((s) => [s.partKey, s.product, s.quantity, s.orderOnly])).toEqual([['k-bowl', 'Toto bowl', 8, false], ['k-carrier', 'Zurn carrier', 4, true]])
    expect(out[0]).toMatchObject({ fixture: 'WC 1&2', fixtureCount: 4, supplyHouse: 'Moore Supply', leadTimeDays: 14, decision: { kind: 'rejected', at: '2026-10-02T00:00:00Z' } })
    // A carrier with no stage of its own is needed at Rough In.
    expect(out[1]).toMatchObject({ stage: 'rough_in' })
  })
})
