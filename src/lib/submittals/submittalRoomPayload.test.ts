import { describe, expect, it } from 'vitest'

import { asRoomRole, roomCounts, roomHeadline, roomKindOf, roomRowFrom, roomRowsFrom, roomSubline, whySentence, type RoomItemSource } from '../../../supabase/functions/_shared/submittalRoomPayload'

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
    expect(row).toEqual({ id: 'i', tag: 'DWH-1', kind: 'differs', plans: 'Rheem RH375 · 40 gal', proposed: 'BRADFORD WHITE RE2HP50 50 GAL', why: 'The specified product has a long lead time · about 1 week.', performanceChange: false, sheetPages: 1, decision: null })
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
    expect(c).toEqual({ total: 5, matches: 1, differs: 2, notQuoted: 1, added: 1, decided: 1, open: 1 })
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
