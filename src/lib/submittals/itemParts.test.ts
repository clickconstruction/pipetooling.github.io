import { describe, expect, it } from 'vitest'
import { assemblyLine, doubledKinds, isCarrier, carryPartInsert, copyPartInsert, partCallsLine, diffPartDrafts, formatPartQty, orderOnlyLine, partHouseIds, partsByItem, partsFromPieces, partToDraft, rollUpFromParts, splitPartLabel, submittedParts, trimWord, type SubmittalPartRow } from './itemParts'
import type { ProductPiece } from './takeoffCandidates'

const part = (p: Partial<SubmittalPartRow> & { id: string; label: string }): SubmittalPartRow => ({
  item_id: 'item-1',
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

// LAV-1 on BP375 once its assembly opens (2026-10-01).
const lav1 = [
  part({ id: 'tsl', label: 'TSL.MON.B.38.2.PS1.BK MONOLITH B SERIES', sequence_order: 1, lead_time_days: 42 }),
  part({ id: 'faucet', label: 'TOTO T25S51E#CP', sequence_order: 2, supply_house_id: 'h-moore', lead_time_days: 14 }),
  part({ id: 'supply', label: 'BRASSCRAFT/PLUMBSHOP PLS1-16AF 3/8 COMP X 1/2 FIP X 16 IN SS SUPPLY', sequence_order: 3, quantity: 2, on_submittal: false, supply_house_id: 'h-reece', lead_time_days: 120 }),
  part({ id: 'grid', label: 'HYDRAPRO |HYDRAPRO H20008 CP BRASS COMMERCIAL LAVATORY GRID DRAIN WITH OVERFLOW', sequence_order: 4, on_submittal: false }),
  part({ id: 'trap', label: 'MAINLINE MLZ8700 11/4 CHROME PLATED 17 GUAGE SEMI CAST BRASS P-TRAP', sequence_order: 5, on_submittal: false }),
  part({ id: 'stop', label: 'BRASSCRA PLB113XP 1/2 NOM COMPX3/8 OD COMP W/LOOSEKEY ANG', sequence_order: 6, on_submittal: false }),
  part({ id: 'flange', label: 'MAINLINE ML90105 POLISHED CHROME 5/8 OD LOW PATTERN SURE GRIP FLANGE', sequence_order: 7, on_submittal: false }),
  part({ id: 'soap', label: 'BOBRICK B-8236', sequence_order: 8 }),
]

describe('a part read model first', () => {
  it('bolds the maker and the model, and leaves the catalog words quiet', () => {
    expect(splitPartLabel('TOTO CT728CUVG#01 TORNADO FLUSH COMMERCIAL FLUSHOMETER WALL- MOUNTED TOILET')).toEqual({ head: 'TOTO CT728CUVG#01', words: 'TORNADO FLUSH COMMERCIAL FLUSHOMETER WALL- MOUNTED TOILET' })
    expect(splitPartLabel('TSL.MON.B.38.2.PS1.BK MONOLITH B SERIES')).toEqual({ head: 'TSL.MON.B.38.2.PS1.BK', words: 'MONOLITH B SERIES' })
    expect(splitPartLabel('BRASSCRA PLB113XP 1/2 NOM COMPX3/8 OD COMP W/LOOSEKEY ANG')).toEqual({ head: 'BRASSCRA PLB113XP', words: '1/2 NOM COMPX3/8 OD COMP W/LOOSEKEY ANG' })
    expect(splitPartLabel('ELKAY APRON')).toEqual({ head: 'ELKAY APRON', words: '' })
    expect(splitPartLabel('FIAT MOP BSN HOSE & BRKT COMBO PN: 832AA')).toEqual({ head: 'FIAT MOP BSN HOSE & BRKT COMBO PN: 832AA', words: '' })
    expect(splitPartLabel('')).toEqual({ head: '', words: '' })
  })

  it('counts more than one on a fixture, and names trim in a word', () => {
    expect(formatPartQty(1)).toBe('')
    expect(formatPartQty(2)).toBe('× 2')
    expect(formatPartQty(0.5)).toBe('× 0.5')
    expect(trimWord('BRASSCRA PLB113XP 1/2 NOM COMPX3/8 OD COMP W/LOOSEKEY ANG')).toBe('stop')
    expect(trimWord('ZURN Z1700 HAMMER ARRESTOR')).toBe('ZURN Z1700')
    expect(orderOnlyLine(lav1)).toBe('supply × 2, grid drain, P-trap, stop, flange')
  })
})

describe('the row from its parts', () => {
  it('joins the parts the GC sees, takes the first house among them, and the longest lead time among them', () => {
    expect(submittedParts(lav1).map((p) => p.id)).toEqual(['tsl', 'faucet', 'soap'])
    expect(rollUpFromParts(lav1)).toEqual({ submitted_label: 'TSL.MON.B.38.2.PS1.BK MONOLITH B SERIES + TOTO T25S51E#CP + BOBRICK B-8236', supply_house_id: 'h-moore', lead_time_days: 42 })
    expect(partHouseIds(lav1)).toEqual(['h-moore', 'h-reece'])
    expect(assemblyLine([{ assembly: 'LAV 1 assembly SPACEX' }, { assembly: 'LAV 1 assembly SPACEX' }, { assembly: null }])).toBe('from LAV 1 assembly SPACEX')
    expect(assemblyLine([{ assembly: null }])).toBe('')
  })

  it('a row with every part order only has nothing for the GC, and falls back to any house', () => {
    const trimOnly = lav1.filter((p) => !p.on_submittal)
    expect(rollUpFromParts(trimOnly)).toEqual({ submitted_label: null, supply_house_id: 'h-reece', lead_time_days: null })
    expect(rollUpFromParts([])).toEqual({ submitted_label: null, supply_house_id: null, lead_time_days: null })
  })
})

describe('parts from the takeoff, carried to the next revision', () => {
  const piece = (key: string, label: string, extra: Partial<ProductPiece> = {}): ProductPiece => ({ key, label, partId: `p-${key}`, partTypeName: null, trim: false, houseId: null, houseName: null, quantity: 1, lineId: 'l-1', templateItemId: `i-${key}`, assembly: 'LAV 1 assembly SPACEX', manufacturer: null, ...extra })

  it('every piece is a part; the switched-on ones are on the submittal, the rest order only', () => {
    const rows = partsFromPieces([piece('tsl', 'TSL.MON…'), piece('supply', 'SUPPLY', { trim: true, quantity: 2, houseId: 'h-moore' })], ['tsl'], 'item-9', 'bid-9')
    expect(rows).toEqual([
      { item_id: 'item-9', bid_id: 'bid-9', sequence_order: 1, label: 'TSL.MON…', manufacturer: null, quantity: 1, on_submittal: true, source: 'takeoff', part_id: 'p-tsl', source_line_id: 'l-1', source_template_item_id: 'i-tsl', assembly: 'LAV 1 assembly SPACEX', supply_house_id: null },
      { item_id: 'item-9', bid_id: 'bid-9', sequence_order: 2, label: 'SUPPLY', manufacturer: null, quantity: 2, on_submittal: false, source: 'takeoff', part_id: 'p-supply', source_line_id: 'l-1', source_template_item_id: 'i-supply', assembly: 'LAV 1 assembly SPACEX', supply_house_id: 'h-moore' },
    ])
  })

  it('a carried part keeps its procurement key and points back; its call does not come along', () => {
    const was = part({ id: 'old', label: 'TOTO T25S51E#CP', review_decision: 'approved', reviewed_by_name: 'Dana', sheet_pages: [41, 42], sheet_file: 0 })
    const c = carryPartInsert(was, 'item-2')
    expect(c).toMatchObject({ item_id: 'item-2', procure_key: 'key-old', carried_from_part_id: 'old', sheet_pages: [41, 42], sheet_file: 0 })
    expect('review_decision' in c).toBe(false)
    const copy = copyPartInsert(was, 'item-3')
    expect(copy).toMatchObject({ item_id: 'item-3', carried_from_part_id: null, sheet_pages: [41, 42] })
    expect('procure_key' in copy).toBe(false)
  })

  it('groups parts by row, in order', () => {
    const m = partsByItem([part({ id: 'b', label: 'B', sequence_order: 2 }), part({ id: 'a', label: 'A', sequence_order: 1 }), part({ id: 'c', label: 'C', item_id: 'item-2' })])
    expect(m.get('item-1')!.map((p) => p.id)).toEqual(['a', 'b'])
    expect(m.get('item-2')!.map((p) => p.id)).toEqual(['c'])
  })
})

describe('the editor’s save', () => {
  it('writes only what changed: a part taken off, a part moved and switched, a part typed in; blank lines are dropped', () => {
    const before = [part({ id: 'a', label: 'TOTO T25S51E#CP', sequence_order: 1 }), part({ id: 'b', label: 'BOBRICK B-8236', sequence_order: 2 }), part({ id: 'c', label: 'MAINLINE ML90105', sequence_order: 3, on_submittal: false })]
    const drafts = [
      { ...partToDraft(before[1]!), on_submittal: false },
      partToDraft(before[0]!),
      { label: '  LEONARD 170D-LF  ', quantity: 1, on_submittal: true, supply_house_id: 'h-nws', lead_time_days: 21, stage: 'trim_set' as const },
      { label: '   ', quantity: 1, on_submittal: true, supply_house_id: null, lead_time_days: null, stage: null },
    ]
    const d = diffPartDrafts(before, drafts, 'item-1', 'bid-1')
    expect(d.deletes).toEqual(['c'])
    expect(d.updates).toEqual([
      { id: 'b', patch: { sequence_order: 1, on_submittal: false } },
      { id: 'a', patch: { sequence_order: 2 } },
    ])
    expect(d.inserts).toEqual([{ item_id: 'item-1', bid_id: 'bid-1', sequence_order: 3, label: 'LEONARD 170D-LF', quantity: 1, on_submittal: true, source: 'hand', supply_house_id: 'h-nws', lead_time_days: 21, stage: 'trim_set' }])
  })

  it('a renamed part forgets the maker, the model and the catalog part it was', () => {
    const before = [part({ id: 'a', label: 'ZURN Z1201', manufacturer: 'ZURN', model: 'Z1201', part_id: 'p-zurn' })]
    const d = diffPartDrafts(before, [{ ...partToDraft(before[0]!), label: 'JOSAM 12694' }], 'item-1', 'bid-1')
    expect(d.updates).toEqual([{ id: 'a', patch: { label: 'JOSAM 12694', manufacturer: null, model: null, part_id: null } }])
  })
})

describe('calls on parts (2026-10-01)', () => {
  it('a resubmit carries an approved part’s approval, marked carried; a part sent back starts blank', () => {
    const approved = part({ id: 'bowl', label: 'TOTO CT728CUVG#01', review_decision: 'approved', reviewed_by_name: 'Dana', reviewed_at: '2026-10-08T15:00:00Z', reviewed_by_person_id: 'p1' })
    const sent = part({ id: 'valve', label: 'TOTO TET2LBI31#SS', review_decision: 'revise', review_note: '1.0 gpf' })
    expect(carryPartInsert(approved, 'item-2', true)).toMatchObject({ review_decision: 'approved', reviewed_by_name: 'Dana', reviewed_at: '2026-10-08T15:00:00Z', decision_source: 'carried', carried_from_part_id: 'bowl' })
    expect('review_decision' in carryPartInsert(sent, 'item-2', true)).toBe(false)
    expect('review_decision' in carryPartInsert(approved, 'item-2')).toBe(false)
  })

  it('counts the calls over the parts the GC sees', () => {
    expect(partCallsLine([part({ id: 'a', label: 'A', review_decision: 'approved' }), part({ id: 'b', label: 'B', review_decision: 'revise' }), part({ id: 'c', label: 'C' }), part({ id: 'd', label: 'D', on_submittal: false, review_decision: 'approved' })])).toBe('1 approved · 1 revise · 1 to go')
    expect(partCallsLine([part({ id: 'a', label: 'A' })])).toBe('')
  })
})

describe('carriers (2026-10-02)', () => {
  it('reads a carrier from its catalog name', () => {
    expect(isCarrier('JOSAM 12694 4" NH double adjustable horizontal closet carrier')).toBe(true)
    expect(isCarrier('ZURN Z1201-NR4-CL12-RYK17 NH DURA-COAT CI ADJ HORIZONTAL SIPHON JET EZCARRY W/RT HAND INLET')).toBe(true)
    expect(isCarrier('JOSAM 17560-UR floor mount urinal carrier')).toBe(true)
    expect(isCarrier('TOTO CT728CUVG#01 TORNADO FLUSH COMMERCIAL FLUSHOMETER WALL- MOUNTED TOILET')).toBe(false)
    expect(isCarrier('BRASSCRAFT PLS1-20DW F 3/8X20 COMP SS SUPPLY')).toBe(false)
    expect(isCarrier(null)).toBe(false)
  })

  it('two carriers the GC sees on one fixture is one too many; an order-only one does not count', () => {
    const wc = [part({ id: 'a', label: 'ZURN Z1201 EZCARRY' }), part({ id: 'b', label: 'JOSAM 12694 closet carrier' })]
    expect(doubledKinds(wc)).toEqual(['carrier'])
    expect(doubledKinds([wc[0]!])).toEqual([])
    expect(doubledKinds([wc[0]!, { ...wc[1]!, on_submittal: false }])).toEqual([])
  })
})

describe('2026-10-02 · a part is one of three', () => {
  const d = (o: Partial<import('./itemParts').PartDraft> = {}): import('./itemParts').PartDraft => ({ id: 'p1', label: 'TOTO T25S51E#CP', quantity: 1, on_submittal: true, supply_house_id: null, lead_time_days: null, stage: null, ...o })

  it('reads and sets the pick; back from left out it takes whichever was pressed', async () => {
    const { partPickOf, withPartPick, keptPartDrafts } = await import('./itemParts')
    expect([partPickOf(d()), partPickOf(d({ on_submittal: false })), partPickOf(d({ left_out: true }))]).toEqual(['gc', 'order', 'out'])
    const out = withPartPick(d(), 'out')
    expect([out.left_out, out.on_submittal]).toEqual([true, true])
    expect(withPartPick(out, 'order')).toMatchObject({ left_out: false, on_submittal: false })
    expect(keptPartDrafts([d(), out])).toHaveLength(1)
  })

  it('Save takes a left-out part off the row, and the bid remembers it by its place on the takeoff', async () => {
    const { diffPartDrafts, leftOutPieceKeys, partToDraft, partPieceKey } = await import('./itemParts')
    const before = [
      { id: 'a', source_line_id: 'line-1', source_template_item_id: 'tpl-bowl', label: 'BOWL', quantity: 1, on_submittal: true, sequence_order: 1 },
      { id: 'b', source_line_id: 'line-2', source_template_item_id: null, label: 'STOP', quantity: 1, on_submittal: false, sequence_order: 2 },
      { id: 'c', source_line_id: null, source_template_item_id: null, label: 'TYPED BY HAND', quantity: 1, on_submittal: false, sequence_order: 3 },
    ] as unknown as import('./itemParts').SubmittalPartRow[]
    const drafts = before.map(partToDraft).map((x) => (x.id === 'a' ? x : { ...x, left_out: true }))
    expect(diffPartDrafts(before, drafts, 'i1', 'b1').deletes).toEqual(['b', 'c'])
    // The assembly item wins over its line; a part typed by hand has nothing to remember.
    expect(partPieceKey(before[0]!)).toBe('tpl-bowl')
    expect(leftOutPieceKeys(before, drafts)).toEqual(['line-2'])
  })
})
