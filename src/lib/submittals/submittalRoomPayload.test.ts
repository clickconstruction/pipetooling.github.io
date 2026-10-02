import { describe, expect, it } from 'vitest'

import { asRoomRole, gcRoomItems, officeOnlyTags, rollUpPartDecisions, roomCounts, roomHeadline, roomKindOf, roomPartsFrom, roomRowFrom, roomRowsFrom, roomSubline, splitPartLabel, whySentence, type RoomItemSource, type RoomPartSource } from '../../../supabase/functions/_shared/submittalRoomPayload'

const item = (o: Partial<RoomItemSource>): RoomItemSource => ({
  id: 'i', tag: 'X-1', sequence_order: 1, specified_manufacturer: null, specified_model: null, specified_description: null, submitted_manufacturer: null, submitted_model: null, submitted_label: null,
  status: 'as_specified', reason_kind: null, reason_note: null, lead_time_days: null, sheet_pages: [], review_decision: null, review_note: null, reviewed_by_name: null, reviewed_by_person_id: null, reviewed_at: null, ...o,
})

describe('the customer\'s words', () => {
  it('maps the estimator\'s seven statuses onto four words', () => {
    expect(roomKindOf('as_specified')).toBe('matches')
    for (const s of ['superseded', 'equal', 'alternate', 'design_change']) expect(roomKindOf(s)).toBe('differs')
    expect(roomKindOf('missing')).toBe('not_quoted')
    expect(roomKindOf('accessory')).toBe('added')
  })

  it('writes the why in one sentence: the status\'s words, the reason, the note, the lead time', () => {
    expect(whySentence({ status: 'alternate', reason_kind: 'lead_time', reason_note: 'spec bowl is 8 weeks out', lead_time_days: 14 })).toBe('The specified product has a long lead time · spec bowl is 8 weeks out · about 2 weeks.')
    expect(whySentence({ status: 'superseded', reason_kind: null, reason_note: null, lead_time_days: 0 })).toBe('The manufacturer replaced the specified model · in stock.')
    expect(whySentence({ status: 'design_change', reason_kind: 'in_stock', reason_note: null, lead_time_days: null })).toBe('A performance value differs from the plans · this one is in stock.')
    expect(whySentence({ status: 'alternate', reason_kind: null, reason_note: null, lead_time_days: null })).toBe('')
    expect(whySentence({ status: 'alternate', reason_kind: 'other', reason_note: 'Kim says so.', lead_time_days: 10 })).toBe('Kim says so. · about 10 days.')
  })

  it('never carries a price, a house or a chip word onto the row', () => {
    const row = roomRowFrom(item({ tag: 'DWH-1', status: 'alternate', specified_manufacturer: 'Rheem', specified_model: 'RH375', specified_description: '40 gal', submitted_label: 'BRADFORD WHITE RE2HP50 50 GAL', reason_kind: 'lead_time', lead_time_days: 7, sheet_pages: [5] }))
    expect(row).toEqual({ id: 'i', tag: 'DWH-1', kind: 'differs', plans: 'Rheem RH375 · 40 gal', proposed: 'BRADFORD WHITE RE2HP50 50 GAL', why: 'The specified product has a long lead time · about 1 week.', performanceChange: false, sheetPages: 1, decision: null, leadTimeDays: 7 })
    expect(JSON.stringify(row)).not.toMatch(/alternate|\$|NWS/i)
  })

  it('carries a decision with who made it', () => {
    const row = roomRowFrom(item({ status: 'design_change', review_decision: 'revise', review_note: 'hold 1.0 gpf', reviewed_by_name: 'Dana W.', reviewed_by_person_id: 'p1', reviewed_at: '2026-09-16T00:00:00Z' }))
    expect(row.performanceChange).toBe(true)
    expect(row.decision).toEqual({ kind: 'revise', note: 'hold 1.0 gpf', byName: 'Dana W.', byPersonId: 'p1', at: '2026-09-16T00:00:00Z' })
    expect(roomRowFrom(item({ review_decision: 'maybe' })).decision).toBeNull()
  })
})

describe('the room\'s rows, counts and headline', () => {
  const items = [
    item({ id: 'a', tag: 'WC-1', sequence_order: 1, status: 'as_specified' }),
    item({ id: 'b', tag: 'DWH-1', sequence_order: 2, status: 'alternate', reason_kind: 'cost' }),
    item({ id: 'c', tag: 'PRV-1', sequence_order: 3, status: 'missing' }),
    item({ id: 'd', tag: '', sequence_order: 4, status: 'accessory', submitted_label: 'Josam carrier' }),
    item({ id: 'e', tag: 'FV-1', sequence_order: 5, status: 'design_change', review_decision: 'approved', reviewed_by_name: 'Dana' }),
  ]
  it('puts the differing rows first, then added, then not quoted, and folds the matches', () => {
    expect(roomRowsFrom(items).map((r) => r.id)).toEqual(['b', 'e', 'd', 'c', 'a'])
  })
  it('counts and words the headline', () => {
    const c = roomCounts(roomRowsFrom(items))
    expect(c).toEqual({ total: 5, matches: 1, differs: 2, notQuoted: 1, added: 1, proposed: 0, decided: 1, open: 1 })
    expect(roomHeadline(c)).toBe('1 row needs a call')
    expect(roomSubline(c)).toBe('1 row match the plans and is marked approved. 2 differ — each says why. 1 has no product yet. 1 is accessory the plans leave to us.')
    expect(roomHeadline({ ...c, open: 0 })).toBe('All 2 decided — thank you')
    expect(roomHeadline({ total: 3, matches: 3, differs: 0, notQuoted: 0, added: 0, decided: 0, open: 0 })).toBe('Everything matches the plans')
    expect(roomHeadline({ total: 0, matches: 0, differs: 0, notQuoted: 0, added: 0, decided: 0, open: 0 })).toBe('Nothing to review yet')
  })
  it('roles fall back to other', () => {
    expect(asRoomRole('architect')).toBe('architect')
    expect(asRoomRole('gc')).toBe('other')
  })
})

describe('the GC calls each part (2026-10-01)', () => {
  // WC-1, WC-2 on SpaceX: the four parts in National Wholesale's file, the seat order only here for the test.
  const part = (id: string, label: string, seq: number, extra: Partial<RoomPartSource> = {}): RoomPartSource => ({ id, item_id: 'wc', sequence_order: seq, label, quantity: 1, on_submittal: true, review_decision: null, review_note: null, reviewed_by_name: null, reviewed_by_person_id: null, reviewed_at: null, ...extra })
  const bowl = part('bowl', 'TOTO CT728CUVG#01 TORNADO FLUSH COMMERCIAL FLUSHOMETER WALL MOUNTED TOILET', 1)
  const valve = part('valve', 'TOTO TET2LBI31#SS ECOPOWER 1.28 GPF FLUSHOMETER VALVE', 2)
  const carrier = part('carrier', 'JOSAM 12694 4" NH double adjustable horizontal closet carrier', 3)
  const stop = part('stop', 'BRASSCRA PLB113XP ANG', 4, { on_submittal: false })
  const call = (p: RoomPartSource, review_decision: string, at: string, extra: Partial<RoomPartSource> = {}) => ({ ...p, review_decision, reviewed_at: at, reviewed_by_name: 'Dana Whitfield', reviewed_by_person_id: 'p1', ...extra })

  it('reads a label model first, as the office does', () => {
    expect(splitPartLabel(bowl.label)).toEqual({ head: 'TOTO CT728CUVG#01', words: 'TORNADO FLUSH COMMERCIAL FLUSHOMETER WALL MOUNTED TOILET' })
  })

  it('the card lists only the parts the GC sees, each with its own call; a carried call says so', () => {
    const parts = roomPartsFrom([stop, call(valve, 'revise', '2026-10-08T15:00:00Z', { review_note: 'plans call 1.0 gpf' }), call(bowl, 'approved', '2026-10-01T15:00:00Z', { decision_source: 'carried' }), carrier])
    expect(parts.map((p) => [p.id, p.head, p.decision?.kind ?? null, p.carried ?? false])).toEqual([['bowl', 'TOTO CT728CUVG#01', 'approved', true], ['valve', 'TOTO TET2LBI31#SS', 'revise', false], ['carrier', 'JOSAM 12694', null, false]])
    const item = { id: 'wc', tag: 'WC-1, WC-2', sequence_order: 1, specified_manufacturer: null, specified_model: null, specified_description: 'WC 1&2', submitted_manufacturer: null, submitted_model: null, submitted_label: 'A + B', status: 'proposed', reason_kind: null, reason_note: null, lead_time_days: null, sheet_pages: [], review_decision: null, review_note: null, reviewed_by_name: null, reviewed_by_person_id: null, reviewed_at: null }
    expect(roomRowFrom(item, [bowl, valve, carrier, stop]).parts!.map((p) => p.id)).toEqual(['bowl', 'valve', 'carrier'])
    expect('parts' in roomRowFrom(item)).toBe(false)
    expect(roomRowsFrom([item], new Map([['wc', [stop]]]))[0]!.parts).toBeUndefined()
  })

  it('a part sent back sends the row back at once; every part approved approves it; otherwise it is open', () => {
    expect(rollUpPartDecisions([bowl, valve, carrier, stop]).review_decision).toBeNull()
    expect(rollUpPartDecisions([call(bowl, 'approved', '2026-10-08T15:00:00Z'), valve, carrier]).review_decision).toBeNull()
    const sentBack = rollUpPartDecisions([call(bowl, 'approved', '2026-10-08T15:00:00Z'), call(valve, 'revise', '2026-10-08T16:00:00Z', { review_note: 'plans call 1.0 gpf' }), carrier, stop])
    expect(sentBack).toMatchObject({ review_decision: 'revise', review_note: 'TOTO TET2LBI31#SS: plans call 1.0 gpf', reviewed_by_name: 'Dana Whitfield', reviewed_at: '2026-10-08T16:00:00Z', decision_source: 'room' })
    expect(rollUpPartDecisions([call(bowl, 'rejected', '2026-10-08T15:00:00Z'), call(valve, 'revise', '2026-10-08T16:00:00Z')]).review_decision).toBe('rejected')
    const all = rollUpPartDecisions([call(bowl, 'approved', '2026-10-08T15:00:00Z'), call(valve, 'approved', '2026-10-08T15:00:00Z'), call(carrier, 'approved', '2026-10-09T15:00:00Z', { decision_source: 'entered', decision_entered_by: 'u1', decision_entered_by_name: 'Wendi' }), stop])
    expect(all).toMatchObject({ review_decision: 'approved', review_note: null, reviewed_at: '2026-10-09T15:00:00Z', decision_source: 'entered', decision_entered_by_name: 'Wendi' })
    expect(rollUpPartDecisions([stop]).review_decision).toBeNull()
  })
})

describe('an order-only row is the office\'s alone (2026-10-02)', () => {
  const rows = [
    item({ id: 'wc', tag: 'WC-1', sequence_order: 1, status: 'alternate', submitted_label: 'TOTO CT728' }),
    item({ id: 'fco', tag: 'FCO', sequence_order: 2, status: 'proposed', submitted_label: 'ZURN ZN1400-2NL', order_only: true }),
    item({ id: 'hb', tag: 'HB-3', sequence_order: 3, order_only: false }),
  ]

  it('never reaches the room: not as a row, and not in a count or the headline', () => {
    const room = roomRowsFrom(rows)
    expect(room.map((r) => r.tag)).toEqual(['WC-1', 'HB-3'])
    expect(JSON.stringify(room)).not.toContain('ZURN')
    expect(roomCounts(room).total).toBe(2)
    // A row read before the column's push has no flag and stays.
    expect(roomRowsFrom([item({ id: 'old', tag: 'OLD-1' })]).map((r) => r.tag)).toEqual(['OLD-1'])
  })

  it('cannot be called by a reviewer, and its log lines stay in the office', () => {
    expect(gcRoomItems(rows).map((r) => r.id)).toEqual(['wc', 'hb'])
    const stored = [
      { tag: 'FCO', submittal_id: 'rev2', order_only: true },
      { tag: 'WC-1', submittal_id: 'rev2', order_only: false },
      { tag: 'FD', submittal_id: 'rev1', order_only: true }, // an older revision's row
    ]
    expect([...officeOnlyTags(stored, 'rev2')]).toEqual(['FCO'])
    expect(officeOnlyTags(stored, null).size).toBe(0)
  })
})
