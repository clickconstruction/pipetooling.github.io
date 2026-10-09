import { describe, expect, it } from 'vitest'
import { foldReplaceSuggestion, foldSuggestions, foldWrites, planTakeoffRefresh, takeoffRefreshWrites } from './refreshFromTakeoff'
import type { SubmittalPartRow } from './itemParts'
import type { SubmittalItemRow } from './submittalRevision'
import type { ProductPiece, TakeoffCandidate } from './takeoffCandidates'

const row = (o: Partial<SubmittalItemRow> & { id: string; tag: string }): SubmittalItemRow => ({
  submittal_id: 's1',
  source_count_row_id: null,
  sequence_order: 1,
  specified_manufacturer: null,
  specified_model: null,
  specified_description: null,
  submitted_manufacturer: null,
  submitted_model: null,
  submitted_label: null,
  supply_house_id: null,
  source_quote_line_id: null,
  status: 'proposed',
  reason_kind: null,
  reason_note: null,
  lead_time_days: null,
  sheet_file: null,
  sheet_pages: [],
  sheet_source: null,
  carried_from_item_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, order_only: false,
  review_decision: null,
  review_note: null,
  reviewed_by_name: null, reviewed_by_person_id: null,
  reviewed_by_email: null,
  reviewed_at: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  call_by: null,
  signoff_name: null,
  signoff_on: null,
  signoff_via: null,
  ...o,
})

const part = (p: Partial<SubmittalPartRow> & { id: string; label: string }): SubmittalPartRow => ({
  item_id: 'lav',
  bid_id: 'bid-1',
  sequence_order: 1,
  manufacturer: null,
  model: null,
  description: null,
  quantity: 1,
  on_submittal: true,
  source: 'takeoff',
  part_id: null,
  source_line_id: null,
  source_template_item_id: null,
  assembly: null,
  priced_label: null,
  reason_note: null,
  supply_house_id: null,
  lead_time_days: null,
  stage: null,
  sheet_file: null,
  sheet_pages: [],
  review_decision: null,
  review_note: null,
  reviewed_at: null,
  reviewed_by_name: null,
  reviewed_by_email: null,
  reviewed_by_person_id: null,
  decision_source: 'room',
  decision_entered_by: null,
  decision_entered_by_name: null,
  procure_key: `key-${p.id}`,
  carried_from_part_id: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...p,
})

const piece = (o: Partial<ProductPiece> & { key: string; label: string }): ProductPiece => ({
  partId: null, partTypeName: null, trim: false, houseId: null, houseName: null, quantity: 1, lineId: 'line-lav', templateItemId: null, assembly: null, manufacturer: null, ...o,
})

const candidate = (countRowId: string, pieces: ProductPiece[], productKeys: string[]): TakeoffCandidate =>
  ({ countRowId, fixture: 'LAV-1', count: 6, tagText: 'LAV-1', tags: ['LAV-1'], product: null, pieces, storedProductKeys: null, productKeys, partId: null, supplyHouseId: null, supplyHouseName: null, defaultTicked: true, storedTick: null, ticked: true, alreadyOn: true }) as unknown as TakeoffCandidate

// LAV-1 built while its assembly read as one line; the takeoff now opens it into its parts.
const lav = row({ id: 'lav', tag: 'LAV-1', source_count_row_id: 'cr-lav', submitted_label: 'LAV-1 ASSEMBLY' })
const bundle = part({ id: 'bundle', label: 'LAV-1 ASSEMBLY', source_line_id: 'line-lav', supply_house_id: 'h-moore', lead_time_days: 42, stage: 'trim_set', sheet_file: 0, sheet_pages: [3, 4] })
const opened = candidate(
  'cr-lav',
  [
    piece({ key: 'ti-sink', label: 'TSL.MON.B.38.2 MONOLITH B SERIES', templateItemId: 'ti-sink', assembly: 'LAV-1 ASSEMBLY' }),
    piece({ key: 'ti-faucet', label: 'TOTO T25S51E#CP', templateItemId: 'ti-faucet', assembly: 'LAV-1 ASSEMBLY', houseId: 'h-reece' }),
    piece({ key: 'ti-stop', label: 'BRASSCRAFT PLB113XP ANGLE STOP', templateItemId: 'ti-stop', assembly: 'LAV-1 ASSEMBLY', quantity: 2, trim: true }),
  ],
  ['ti-sink', 'ti-faucet'],
)

describe('planTakeoffRefresh', () => {
  it('lists a row whose assembly the takeoff now opens into parts', () => {
    const { rows, skipped } = planTakeoffRefresh([lav], new Map([['lav', [bundle]]]), [opened])
    expect(skipped).toEqual([])
    expect(rows).toEqual([{ itemId: 'lav', tag: 'LAV-1', before: 'LAV-1 ASSEMBLY', after: 'TSL.MON.B.38.2 + TOTO T25S51E#CP', parts: 3, gc: 2 }])
  })

  it('a row with no parts yet says so before its own label', () => {
    const { rows } = planTakeoffRefresh([lav], new Map(), [opened])
    expect(rows[0]?.before).toBe('one line, no parts: LAV-1 ASSEMBLY')
  })

  it('leaves a row the house file built, a row already the same, and a row the takeoff lost', () => {
    const fromFile = row({ id: 'wc', tag: 'WC-1', source_count_row_id: 'cr-wc' })
    const same = row({ id: 'ur', tag: 'UR-1', source_count_row_id: 'cr-ur' })
    const lost = row({ id: 'ewc', tag: 'EWC-1', source_count_row_id: 'cr-gone' })
    const byHand = row({ id: 'car', tag: 'CAR-1' })
    const ur = candidate('cr-ur', [piece({ key: 'line-ur', label: 'SLOAN WEUS-1000', lineId: 'line-ur' })], ['line-ur'])
    const wc = candidate('cr-wc', [piece({ key: 'line-wc', label: 'TOTO CT708', lineId: 'line-wc' })], ['line-wc'])
    const parts = new Map([
      ['wc', [part({ id: 'wc-file', item_id: 'wc', label: 'TOTO CT705ELN', source: 'file' })]],
      ['ur', [part({ id: 'ur-1', item_id: 'ur', label: 'SLOAN WEUS-1000', source_line_id: 'line-ur' })]],
    ])
    const { rows, skipped } = planTakeoffRefresh([fromFile, same, lost, byHand], parts, [ur, wc])
    expect(rows).toEqual([])
    expect(skipped).toEqual([
      { itemId: 'wc', tag: 'WC-1', why: 'house_file' },
      { itemId: 'ur', tag: 'UR-1', why: 'same' },
      { itemId: 'ewc', tag: 'EWC-1', why: 'no_takeoff' },
    ])
  })

  it('a switch flipped on the takeoff is a change', () => {
    const ur = candidate('cr-ur', [piece({ key: 'line-ur', label: 'SLOAN WEUS-1000', lineId: 'line-ur' })], [])
    const parts = new Map([['ur', [part({ id: 'ur-1', item_id: 'ur', label: 'SLOAN WEUS-1000', source_line_id: 'line-ur' })]]])
    const { rows } = planTakeoffRefresh([row({ id: 'ur', tag: 'UR-1', source_count_row_id: 'cr-ur' })], parts, [ur])
    expect(rows[0]?.after).toBe('(every part order only)')
  })
})

describe('takeoffRefreshWrites', () => {
  it('opens a bundle into its parts and hands its log line, house, lead time and pages to the first', () => {
    const hand = part({ id: 'hand', label: 'JOSAM 17000 CARRIER', source: 'hand', sequence_order: 2 })
    const w = takeoffRefreshWrites([bundle, hand], opened, 'lav', 'bid-1')
    expect(w.deletes).toEqual(['bundle'])
    expect(w.inserts.map((p) => [p.label, p.on_submittal, p.sequence_order])).toEqual([
      ['TSL.MON.B.38.2 MONOLITH B SERIES', true, 1],
      ['TOTO T25S51E#CP', true, 2],
      ['BRASSCRAFT PLB113XP ANGLE STOP', false, 3],
    ])
    expect(w.inserts[0]).toMatchObject({ procure_key: 'key-bundle', supply_house_id: 'h-moore', lead_time_days: 42, stage: 'trim_set', sheet_file: 0, sheet_pages: [3, 4] })
    expect(w.inserts[1]?.procure_key).toBeUndefined()
    expect(w.inserts[1]?.supply_house_id).toBe('h-reece')
    // The hand part follows the takeoff's.
    expect(w.updates).toEqual([{ id: 'hand', patch: { sequence_order: 4 } }])
  })

  it('a part the takeoff still has keeps its record and takes the new name, count and switch', () => {
    const kept = part({ id: 'faucet', label: 'TOTO T25S51', source_template_item_id: 'ti-faucet', source_line_id: 'line-lav', lead_time_days: 14, sequence_order: 1, on_submittal: false })
    const w = takeoffRefreshWrites([kept], opened, 'lav', 'bid-1')
    expect(w.deletes).toEqual([])
    expect(w.updates).toEqual([{ id: 'faucet', patch: { sequence_order: 2, label: 'TOTO T25S51E#CP', quantity: 1, on_submittal: true, assembly: 'LAV-1 ASSEMBLY', part_id: null } }])
    expect(w.inserts.map((p) => p.label)).toEqual(['TSL.MON.B.38.2 MONOLITH B SERIES', 'BRASSCRAFT PLB113XP ANGLE STOP'])
    // The kept part held the takeoff line, so nothing new inherits from it.
    expect(w.inserts.every((p) => p.procure_key === undefined)).toBe(true)
  })
})

// BP375: three Josam carriers typed by hand, each for one fixture's tags.
const wc = row({ id: 'wc', tag: 'WC-1, WC-2', source_count_row_id: 'cr-wc', submitted_label: 'TOTO CT708UVG', sequence_order: 1 })
const ur = row({ id: 'ur', tag: 'UR-1', source_count_row_id: 'cr-ur', submitted_label: 'SLOAN WEUS-1000', sequence_order: 2 })
const carWc = row({ id: 'car-wc', tag: 'CAR-1', submitted_label: 'JOSAM 12674 CARRIER', reason_note: 'Carrier for WC-1 and WC-2.', supply_house_id: 'h-moore', lead_time_days: 21, sheet_file: 0, sheet_pages: [40, 41], sequence_order: 3, review_decision: 'approved', reviewed_by_name: 'Pat', decision_source: 'carried' })
const carUr = row({ id: 'car-ur', tag: 'CAR-2', submitted_label: 'JOSAM 17820 CARRIER', reason_note: 'Carrier for UR 1', sequence_order: 4 })

describe('foldSuggestions', () => {
  it('a hand row whose note names every tag of one row folds into it', () => {
    expect(foldSuggestions([wc, ur, carWc, carUr], new Map())).toEqual([
      { fromId: 'car-wc', fromTag: 'CAR-1', intoId: 'wc', intoTag: 'WC-1, WC-2' },
      { fromId: 'car-ur', fromTag: 'CAR-2', intoId: 'ur', intoTag: 'UR-1' },
    ])
  })

  it('no suggestion when the note names only some of the tags, or two rows match, or the row has parts', () => {
    const partial = row({ id: 'p', tag: 'CAR-3', reason_note: 'Carrier for WC-1.' })
    const twin = row({ id: 'ur2', tag: 'UR-1', sequence_order: 5 })
    const withParts = row({ id: 'wp', tag: 'CAR-4', reason_note: 'Carrier for UR-1' })
    const parts = new Map([['wp', [part({ id: 'x', item_id: 'wp', label: 'JOSAM', source: 'hand' })]]])
    expect(foldSuggestions([wc, partial], new Map())).toEqual([])
    expect(foldSuggestions([ur, twin, carUr], new Map())).toEqual([])
    expect(foldSuggestions([ur, withParts], parts)).toEqual([])
  })

  it('a takeoff row is never folded', () => {
    expect(foldSuggestions([wc, row({ id: 't', tag: 'CAR-1', source_count_row_id: 'cr-car', reason_note: 'Carrier for WC-1 and WC-2.' })], new Map())).toEqual([])
  })
})

describe('foldWrites', () => {
  let n = 0
  const mint = () => `minted-${++n}`

  it('onto a row with no parts: the fixture becomes the first part, the carrier the second, both log lines move', () => {
    n = 0
    const plan = foldWrites(carWc, wc, [], 'bid-1', mint)
    expect(plan.inserts.map((p) => [p.label, p.sequence_order, p.source, p.on_submittal, p.procure_key])).toEqual([
      ['TOTO CT708UVG', 1, 'hand', true, 'minted-1'],
      ['JOSAM 12674 CARRIER', 2, 'hand', true, 'minted-2'],
    ])
    expect(plan.inserts[1]).toMatchObject({ item_id: 'wc', supply_house_id: 'h-moore', lead_time_days: 21, sheet_file: 0, sheet_pages: [40, 41], reason_note: 'Carrier for WC-1 and WC-2.', review_decision: 'approved', reviewed_by_name: 'Pat', decision_source: 'carried' })
    expect(plan.inserts[0]?.review_decision).toBeUndefined()
    expect(plan.moveLines).toEqual([{ tag: 'WC-1, WC-2', partKey: 'minted-1' }, { tag: 'CAR-1', partKey: 'minted-2' }])
    expect(plan.after).toBe('TOTO CT708UVG + JOSAM 12674')
  })

  it('onto a row with parts: the carrier goes after them and only its own line moves', () => {
    n = 0
    const have = [part({ id: 'ur-1', item_id: 'ur', label: 'SLOAN WEUS-1000', sequence_order: 1 }), part({ id: 'ur-2', item_id: 'ur', label: 'SLOAN FLUSH', sequence_order: 2, on_submittal: false })]
    const plan = foldWrites(carUr, ur, have, 'bid-1', mint)
    expect(plan.inserts.map((p) => [p.label, p.sequence_order])).toEqual([['JOSAM 17820 CARRIER', 3]])
    expect(plan.moveLines).toEqual([{ tag: 'CAR-2', partKey: 'minted-1' }])
    expect(plan.after).toBe('SLOAN WEUS-1000 + JOSAM 17820')
  })

  it('a carrier goes in at Rough In', () => {
    n = 0
    expect(foldWrites(carWc, wc, [], 'bid-1', mint).inserts[1]!.stage).toBe('rough_in')
    // The fixture's own product is not a carrier: no stage is guessed for it.
    expect(foldWrites(carWc, wc, [], 'bid-1', mint).inserts[0]!.stage).toBeUndefined()
  })

  // 2026-10-02 · BP375: WC-1, WC-2 listed the takeoff's Zurn carrier and Wendi's Josam.
  const bowl = part({ id: 'wc-bowl', item_id: 'wc', label: 'TOTO CT728CUVG#01 TORNADO FLUSH TOILET', sequence_order: 1 })
  const zurn = part({ id: 'wc-zurn', item_id: 'wc', label: 'ZURN Z1201-NR4-CL12-RYK17 NH DURA-COAT CI ADJ HORIZONTAL SIPHON JET EZCARRY W/RT HAND INLET', sequence_order: 4 })
  const seat = part({ id: 'wc-seat', item_id: 'wc', label: 'MAINLINE ML1055SSC000 WHT ELONG', sequence_order: 3 })
  const josam = row({ id: 'car-josam', tag: 'WC CARRIER', submitted_label: 'JOSAM 12694 4" NH double adjustable horizontal closet carrier', reason_note: 'Carrier for WC-1 and WC-2.', supply_house_id: 'h-nws' })

  it('in place of: the carrier takes the Zurn’s place and its name as what was priced; the Zurn comes off', () => {
    n = 0
    const plan = foldWrites(josam, wc, [bowl, seat, zurn], 'bid-1', mint, { replaceId: 'wc-zurn' })
    expect(plan.deletes).toEqual(['wc-zurn'])
    expect(plan.inserts).toHaveLength(1)
    expect(plan.inserts[0]).toMatchObject({ label: 'JOSAM 12694 4" NH double adjustable horizontal closet carrier', sequence_order: 4, priced_label: zurn.label, on_submittal: true, stage: 'rough_in', supply_house_id: 'h-nws' })
    expect(plan.after).toBe('TOTO CT728CUVG#01 + MAINLINE ML1055SSC000 + JOSAM 12694')
    expect(plan.moveLines).toEqual([{ tag: 'WC CARRIER', partKey: 'minted-1' }])
  })

  it('suggests the row’s own carrier for a carrier, and nothing for anything else', () => {
    expect(foldReplaceSuggestion(josam, [bowl, seat, zurn])).toBe('wc-zurn')
    expect(foldReplaceSuggestion(josam, [bowl, seat])).toBeNull()
    // Two carriers already: no guess.
    expect(foldReplaceSuggestion(josam, [bowl, zurn, part({ id: 'wc-zurn2', item_id: 'wc', label: 'ZURN Z1203 CARRIER', sequence_order: 5 })])).toBeNull()
    expect(foldReplaceSuggestion(row({ id: 'x', tag: 'GB-1', submitted_label: 'BOBRICK B-6806 GRAB BAR' }), [bowl, seat, zurn])).toBeNull()
  })
})
