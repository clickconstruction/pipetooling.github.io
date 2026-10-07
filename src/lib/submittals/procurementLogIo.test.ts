/**
 * The log's lines as read from a revision's rows and parts (`procurementItemsFrom`): which call
 * each part's line carries. No house and no takeoff row here, so the reader asks the database nothing.
 */
import { describe, expect, it } from 'vitest'
import { procurementItemsFrom } from './procurementLogIo'
import { buildProcurementLog } from './procurementLog'
import type { SubmittalPartRow } from './itemParts'

type Client = Parameters<typeof procurementItemsFrom>[0]
type Items = Parameters<typeof procurementItemsFrom>[1]
const noDb = {} as Client

const row = (o: Record<string, unknown> = {}) => ({ id: 'wc', tag: 'WC-1, WC-2', submitted_manufacturer: null, submitted_model: null, submitted_label: 'TOTO CT728CUVG#01', specified_manufacturer: null, specified_model: null, specified_description: null, supply_house_id: null, lead_time_days: null, source_count_row_id: null, review_decision: null, reviewed_at: null, ...o })
const part = (id: string, label: string, seq: number, extra: Partial<SubmittalPartRow> = {}): SubmittalPartRow => ({ id, item_id: 'wc', bid_id: 'b1', sequence_order: seq, label, manufacturer: null, model: null, description: null, quantity: 1, on_submittal: true, source: 'takeoff', part_id: null, source_line_id: null, source_template_item_id: null, assembly: null, priced_label: null, reason_note: null, supply_house_id: null, lead_time_days: null, stage: null, sheet_file: null, sheet_pages: [], review_decision: null, review_note: null, reviewed_at: null, reviewed_by_name: null, reviewed_by_email: null, reviewed_by_person_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, procure_key: `k-${id}`, carried_from_part_id: null, created_at: '', updated_at: '', ...extra })
const lines = async (r: ReturnType<typeof row>, parts: SubmittalPartRow[]) => procurementItemsFrom(noDb, [r] as unknown as Items, true, parts)

describe('2026-10-02 · a part’s line reads its own call, not its neighbour’s', () => {
  it('BP375’s WC-1, WC-2: the flush valve was rejected, so the row reads Rejected; the bowl, the seat and the carriers stay open', async () => {
    const at = '2026-10-02T19:11:00Z'
    const parts = [
      part('bowl', 'TOTO CT728CUVG#01 TORNADO FLUSH', 1),
      part('valve', 'TOTO TET2UB31#SS', 2, { review_decision: 'rejected', reviewed_at: at, decision_source: 'entered' }),
      part('seat', 'MAINLINE ML1055SSC000 WHT ELONG', 3),
      part('carrier', 'ZURN Z1201-NR4-CL12-RYK17', 4),
      part('stop', 'BRASSCRA PLB113XP ANG', 5, { on_submittal: false }),
    ]
    const out = await lines(row({ review_decision: 'rejected', reviewed_at: at }), parts)
    expect(out.map((l) => [l.partKey, l.decision?.kind ?? null])).toEqual([['k-bowl', null], ['k-valve', 'rejected'], ['k-seat', null], ['k-carrier', null], ['k-stop', null]])
    // On the log: one line sent back, the rest still waiting on the GC.
    const log = buildProcurementLog({ items: out, records: [], tagStage: {}, stageDates: {} })
    expect(log.map((l) => l.status)).toEqual(['awaiting', 'sent_back', 'awaiting', 'awaiting', 'awaiting'])
  })

  it('a row called whole before its parts were called one by one still covers every part', async () => {
    const at = '2026-09-22T15:00:00Z'
    const parts = [part('bowl', 'TOTO CT728CUVG#01', 1), part('stop', 'BRASSCRA PLB113XP ANG', 2, { on_submittal: false })]
    const out = await lines(row({ review_decision: 'approved', reviewed_at: at }), parts)
    expect(out.map((l) => l.decision)).toEqual([{ kind: 'approved', at }, { kind: 'approved', at }])
  })

  it('every part approved: the order-only part is released with them, on the row’s date', async () => {
    const at = '2026-09-22T15:00:00Z'
    const parts = [part('bowl', 'TOTO CT728CUVG#01', 1, { review_decision: 'approved', reviewed_at: at }), part('stop', 'BRASSCRA PLB113XP ANG', 2, { on_submittal: false })]
    const out = await lines(row({ review_decision: 'approved', reviewed_at: '2026-09-23T09:00:00Z' }), parts)
    expect(out.map((l) => l.decision)).toEqual([{ kind: 'approved', at }, { kind: 'approved', at: '2026-09-23T09:00:00Z' }])
  })
})

describe('2026-10-02 · an order-only fixture waits for no call', () => {
  it('every line of it is the office’s: no call read, off the GC’s copy, ready to order, on a draft too', async () => {
    const parts = [part('bowl', 'TOTO CT728CUVG#01', 1), part('stop', 'BRASSCRA PLB113XP ANG', 2, { on_submittal: false })]
    const out = await procurementItemsFrom(noDb, [row({ order_only: true })] as unknown as Items, false, parts)
    // Its parts keep their own picks underneath; the fixture's flag rules while it is set.
    expect(out.map((l) => [l.partKey, l.orderOnly, l.noGc, l.decision])).toEqual([['k-bowl', true, true, null], ['k-stop', true, true, null]])
    const log = buildProcurementLog({ items: out, records: [], tagStage: {}, stageDates: {} })
    expect(log.map((l) => [l.status, l.releasedOn])).toEqual([['released', null], ['released', null]])
  })

  it('a row with no parts gets the same; a call left on it from before is not read', async () => {
    const out = await procurementItemsFrom(noDb, [row({ order_only: true, review_decision: 'rejected', reviewed_at: '2026-10-01T00:00:00Z' })] as unknown as Items, true, [])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ orderOnly: true, noGc: true, decision: null })
  })

  it('a row the GC sees is untouched', async () => {
    const out = await procurementItemsFrom(noDb, [row({ order_only: false })] as unknown as Items, false, [part('bowl', 'TOTO CT728CUVG#01', 1)])
    expect(out[0]!.noGc).toBeUndefined()
    expect(out[0]!.orderOnly).toBe(false)
    expect(buildProcurementLog({ items: out, records: [], tagStage: {}, stageDates: {} })[0]!.status).toBe('not_submitted')
  })
})

describe('v2.4685 · a house\'s usual lead time stands in for a part that has none', () => {
  // A client that answers the one query the reader makes for houses; no takeoff row is asked for.
  const withHouses = (houses: Array<{ id: string; name: string; default_lead_time_days: number | null }>) =>
    ({ from: () => ({ select: () => ({ in: async () => ({ data: houses, error: null }) }) }) }) as unknown as Client
  const houses = [{ id: 'h-nw', name: 'National Wholesale', default_lead_time_days: 21 }, { id: 'h-moore', name: 'Moore Supply', default_lead_time_days: null }]

  it('a part with no lead time reads its house\'s usual; a typed number wins; a house with no usual leaves it blank; the row\'s own lead still comes before the house', async () => {
    const parts = [
      part('bowl', 'TOTO CT728CUVG#01', 1, { supply_house_id: 'h-nw', lead_time_days: null }),
      part('valve', 'TOTO TET2UB31#SS', 2, { supply_house_id: 'h-nw', lead_time_days: 7 }),
      part('seat', 'MAINLINE ML1055SSC000', 3, { supply_house_id: 'h-moore', lead_time_days: null }),
      part('stop', 'BRASSCRA PLB113XP', 4, { supply_house_id: null, lead_time_days: null }),
    ]
    const out = await procurementItemsFrom(withHouses(houses), [row({ lead_time_days: null })] as unknown as Items, true, parts)
    expect(out.map((l) => [l.partKey, l.supplyHouse, l.leadTimeDays])).toEqual([['k-bowl', 'National Wholesale', 21], ['k-valve', 'National Wholesale', 7], ['k-seat', 'Moore Supply', null], ['k-stop', null, null]])
    // The row's own lead time (the roll-up) still comes before the house's usual.
    const rolled = await procurementItemsFrom(withHouses(houses), [row({ lead_time_days: 14 })] as unknown as Items, true, parts.slice(0, 1))
    expect(rolled[0]!.leadTimeDays).toBe(14)
    // A row with no parts reads its own house the same way.
    const bare = await procurementItemsFrom(withHouses(houses), [row({ lead_time_days: null, supply_house_id: 'h-nw' })] as unknown as Items, true, [])
    expect(bare[0]!.leadTimeDays).toBe(21)
  })
})
