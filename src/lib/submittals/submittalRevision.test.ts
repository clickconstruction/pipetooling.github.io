import { describe, expect, it } from 'vitest'

import { asDecision, asReason, asStatus, buildPackageLabel, rowsOwingSheet, sheetsToFollowConfirm, carriedRowInsert, rowsToCarry, describeRevision, describeRevisionChip, describeWhatIsLeft, draftToItemInsert, formatPages, itemToPrevious, needsSheet, parsePageRange, parseSourceFiles, revisionAnsweredAt, revisionTiles, sentByEmailLine, serializeSourceFiles } from './submittalRevision'
import type { SubmittalItemRow } from './submittalRevision'
import type { SubmittalRowDraft } from './buildSubmittalRows'

const item = (o: Partial<SubmittalItemRow>): SubmittalItemRow => ({
  id: 'i1',
  submittal_id: 's1',
  source_count_row_id: null,
  tag: 'WC-1',
  sequence_order: 1,
  specified_manufacturer: 'TOTO',
  specified_model: 'CT708UVG',
  specified_description: null,
  submitted_manufacturer: null,
  submitted_model: 'CT728CUVG',
  submitted_label: 'TOTO CT728CUVG#01',
  supply_house_id: 'h1',
  source_quote_line_id: 'q1',
  status: 'alternate',
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
  created_at: '2026-09-15T00:00:00Z',
  updated_at: '2026-09-15T00:00:00Z',
  ...o,
})

describe('stored enums', () => {
  it('unknown values fall back rather than throw', () => {
    expect(asStatus('equal')).toBe('equal')
    expect(asStatus('bogus')).toBe('alternate')
    expect(asReason('cost')).toBe('cost')
    expect(asReason('')).toBeNull()
    expect(asDecision('revise')).toBe('revise')
    expect(asDecision('maybe')).toBeNull()
  })
})

describe('source files', () => {
  it('round-trips the jsonb shape and drops malformed entries', () => {
    const parsed = parseSourceFiles([
      { path: 'b/s/0.pdf', house_id: 'h1', house_name: 'NWS', name: 'NWS-S6277623.pdf', pages: 31, trimmed_at: null },
      { path: 'b/s/1.pdf', pages: '3', trimmed_at: '2026-09-15T00:00:00Z', dropped_pages: 24, names_rows: 4, sectioned: true },
      { nope: true },
      null,
    ])
    expect(parsed).toEqual([
      { path: 'b/s/0.pdf', houseId: 'h1', houseName: 'NWS', name: 'NWS-S6277623.pdf', pages: 31, trimmedAt: null, droppedPages: null, namesRows: null, sectioned: null },
      { path: 'b/s/1.pdf', houseId: null, houseName: null, name: '1.pdf', pages: 0, trimmedAt: '2026-09-15T00:00:00Z', droppedPages: 24, namesRows: 4, sectioned: true },
    ])
    expect(serializeSourceFiles(parsed)[0]).toEqual({ path: 'b/s/0.pdf', house_id: 'h1', house_name: 'NWS', name: 'NWS-S6277623.pdf', pages: 31, trimmed_at: null, dropped_pages: null, names_rows: null, sectioned: null })
    expect(parseSourceFiles(null)).toEqual([])
  })
})

describe('row ↔ item', () => {
  it('itemToPrevious carries what the next revision needs', () => {
    const prev = itemToPrevious(item({ reason_kind: 'lead_time', lead_time_days: 14, sheet_file: 0, sheet_pages: [3, 4], review_decision: 'revise', review_note: 'hold 1.0 gpf' }))
    expect(prev).toEqual({ id: 'i1', tag: 'WC-1', submittedModel: 'CT728CUVG', submittedLabel: 'TOTO CT728CUVG#01', status: 'alternate', reasonKind: 'lead_time', reasonNote: null, leadTimeDays: 14, sheetFile: 0, sheetPages: [3, 4], reviewDecision: 'revise', reviewNote: 'hold 1.0 gpf', supplyHouseId: 'h1', sourceQuoteLineId: 'q1', orderOnly: false })
  })

  it('draftToItemInsert writes every column the kernel decided, and stamps the sheet source when pages carried', () => {
    const draft: SubmittalRowDraft = {
      tag: 'DWH-1', sequenceOrder: 3, specifiedManufacturer: 'Rheem', specifiedModel: 'RH375', specifiedDescription: '40 gal',
      submittedManufacturer: null, submittedModel: 'BW RE2HP50', submittedLabel: 'BRADFORD WHITE RE2HP50 50 GAL', supplyHouseId: 'h1', houseName: 'NWS', sourceQuoteLineId: 'q9',
      status: 'alternate', near: false, reasonKind: 'lead_time', reasonNote: 'spec 3–4 wk out', leadTimeDays: 7, sheetFile: 0, sheetPages: [5], carriedFromItemId: 'old', changed: false, changeNote: null,
    }
    expect(draftToItemInsert(draft, 's2')).toEqual({
      submittal_id: 's2', tag: 'DWH-1', sequence_order: 3, specified_manufacturer: 'Rheem', specified_model: 'RH375', specified_description: '40 gal',
      submitted_manufacturer: null, submitted_model: 'BW RE2HP50', submitted_label: 'BRADFORD WHITE RE2HP50 50 GAL', supply_house_id: 'h1', source_quote_line_id: 'q9',
      status: 'alternate', reason_kind: 'lead_time', reason_note: 'spec 3–4 wk out', lead_time_days: 7, sheet_file: 0, sheet_pages: [5], sheet_source: 'estimator', carried_from_item_id: 'old',
    })
    expect(draftToItemInsert({ ...draft, sheetPages: [], sheetFile: null }, 's2').sheet_source).toBeNull()
  })
})

describe('tiles and the header line', () => {
  const items = [
    item({ tag: 'WC-1', status: 'as_specified', sheet_pages: [1, 2] }),
    item({ tag: 'WC-2', status: 'superseded', sheet_pages: [1, 2] }),
    item({ tag: 'LAV-1', status: 'equal' }),
    item({ tag: 'DWH-1', status: 'alternate', reason_kind: 'lead_time', sheet_pages: [5] }),
    item({ tag: 'RPZ-1', status: 'alternate' }),
    item({ tag: 'FV-1', status: 'design_change' }),
    item({ tag: 'PRV-1', status: 'missing' }),
    item({ tag: '', status: 'accessory', sheet_pages: [11] }),
  ]
  it('counts every bucket, the unreasoned, and the sheets (missing rows want none)', () => {
    const t = revisionTiles(items)
    expect(t).toEqual({ rows: 8, tagged: 7, accessories: 1, asSpecified: 1, superseded: 1, equal: 1, alternates: 2, alternatesWithoutReason: 1, designChanges: 1, designChangesWithoutReason: 1, missing: 1, proposed: 0, sheetsIn: 4, sheetsWanted: 7, sheetsNeeded: 3 })
    expect(describeRevision(t)).toBe('8 rows · 1 as specified · 1 superseded · 1 equal · 2 alternates · 1 without a reason · 1 design change · 1 missing · 1 accessory · 4 of 7 sheets in')
    expect(needsSheet(item({ status: 'missing' }))).toBe(false)
    expect(needsSheet(item({ status: 'alternate' }))).toBe(true)
    expect(needsSheet(item({ status: 'alternate', sheet_pages: [2] }))).toBe(false)
  })
})

describe('pages', () => {
  it('parses ranges and lists, bounds by the page count, and prints runs', () => {
    expect(parsePageRange('1-2, 5')).toEqual([1, 2, 5])
    expect(parsePageRange('4–3 7 7')).toEqual([3, 4, 7])
    expect(parsePageRange('0, 9, x', 8)).toEqual([])
    expect(parsePageRange('')).toEqual([])
    expect(formatPages([5, 1, 2, 3])).toBe('p.1–3, 5')
    expect(formatPages([7])).toBe('p.7')
    expect(formatPages([])).toBe('')
  })
})

describe('the revision chip', () => {
  it('names the rev, the status and the right date', () => {
    expect(describeRevisionChip({ rev_number: 3, status: 'draft', created_at: '2026-09-15T20:00:00Z', shared_at: null })).toBe('Rev 3 · draft · Sep 15')
    expect(describeRevisionChip({ rev_number: 2, status: 'shared', created_at: '2026-09-10T20:00:00Z', shared_at: '2026-09-12T20:00:00Z' })).toBe('Rev 2 · shared · Sep 12')
    expect(describeRevisionChip({ rev_number: 1, status: 'nonsense', created_at: '', shared_at: null })).toBe('Rev 1 · draft')
  })
  it('2026-10-03 · a replaced draft that holds answers reads answered, with the day of the newest one', () => {
    const rev = { rev_number: 3, status: 'superseded', created_at: '2026-09-15T20:00:00Z', shared_at: null }
    expect(describeRevisionChip(rev)).toBe('Rev 3 · superseded · Sep 15')
    expect(describeRevisionChip(rev, '2026-10-02T17:00:00Z')).toBe('Rev 3 · answered Oct 2')
    // A draft or a shared revision keeps its own words whatever it holds.
    expect(describeRevisionChip({ ...rev, status: 'draft' }, '2026-10-02T17:00:00Z')).toBe('Rev 3 · draft · Sep 15')
    expect(revisionAnsweredAt([{ review_decision: 'approved', reviewed_at: '2026-09-17T12:00:00Z' }, { review_decision: null, reviewed_at: null }], [{ review_decision: 'rejected', reviewed_at: '2026-10-02T17:00:00Z' }])).toBe('2026-10-02T17:00:00Z')
    expect(revisionAnsweredAt([{ review_decision: null, reviewed_at: '2026-10-02T17:00:00Z' }])).toBeNull()
  })
  it('v2.4705 · a draft the office sent by email reads sent by email with that day, not draft; shared from the app it keeps its share; a replaced draft that was answered still reads answered', () => {
    const rev = { rev_number: 1, status: 'draft', created_at: '2026-09-29T20:00:00Z', shared_at: null, sent_outside_at: '2026-09-29T22:00:00Z' }
    expect(describeRevisionChip(rev)).toBe('Rev 1 · sent by email · Sep 29')
    expect(describeRevisionChip(rev, '2026-10-02T17:00:00Z')).toBe('Rev 1 · sent by email · Sep 29')
    expect(describeRevisionChip({ ...rev, status: 'superseded' })).toBe('Rev 1 · sent by email · Sep 29')
    expect(describeRevisionChip({ ...rev, status: 'superseded' }, '2026-10-02T17:00:00Z')).toBe('Rev 1 · answered Oct 2')
    expect(describeRevisionChip({ ...rev, status: 'shared', shared_at: '2026-10-01T20:00:00Z' })).toBe('Rev 2 · shared · Oct 1'.replace('Rev 2', 'Rev 1'))
    expect(describeRevisionChip({ ...rev, sent_outside_at: null })).toBe('Rev 1 · draft · Sep 29')
    expect(sentByEmailLine('2026-09-29T22:00:00Z')).toBe('Sent by email · Sep 29')
    expect(sentByEmailLine('2026-09-29T22:00:00Z', 4)).toBe('Sent by email · Sep 29 · answers typed in')
  })
})

describe('describeWhatIsLeft (v2.4125)', () => {
  const tiles = { rows: 22, tagged: 20, accessories: 2, asSpecified: 6, superseded: 1, equal: 1, alternates: 8, alternatesWithoutReason: 2, designChanges: 1, designChangesWithoutReason: 1, missing: 1, proposed: 0, sheetsIn: 14, sheetsWanted: 22, sheetsNeeded: 8 }
  it('says what is still to do, one short sentence each', () => {
    expect(describeWhatIsLeft(tiles)).toBe('22 rows. 3 still need a reason. 1 still needs a product. 8 still need a cut sheet.')
  })
  it('says so when nothing is left', () => {
    expect(describeWhatIsLeft({ ...tiles, alternatesWithoutReason: 0, designChangesWithoutReason: 0, missing: 0, sheetsNeeded: 0 })).toBe('22 rows. Every row has its reason and its cut sheet.')
    expect(describeWhatIsLeft({ ...tiles, rows: 0, alternatesWithoutReason: 0, designChangesWithoutReason: 0, missing: 0, sheetsNeeded: 0 })).toBe('0 rows.')
  })
})

describe('a new revision carries the rows the picks do not rebuild (2026-10-01)', () => {
  // BP375: Rev 1 built from the takeoff, a carrier typed by hand, and one row a pick built.
  const fromTakeoff = item({ id: 'lav1', tag: 'LAV-1', source_quote_line_id: null, source_count_row_id: 'cr-lav1', specified_manufacturer: null, specified_model: null, specified_description: 'LAV 1', status: 'proposed', review_decision: 'approved', reviewed_by_name: 'Dana', sheet_file: 0, sheet_pages: [30, 31] })
  const byHand = item({ id: 'carrier', tag: 'WC CARRIER', source_quote_line_id: null, specified_manufacturer: null, specified_model: null, status: 'accessory' })
  const fromPick = item({ id: 'wc', tag: 'WC-1' })

  it('carries the takeoff row and the hand row; leaves the picked row to the rebuild, and a row it already carried', () => {
    expect(rowsToCarry([fromTakeoff, byHand, fromPick], []).map((r) => r.id)).toEqual(['lav1', 'carrier'])
    expect(rowsToCarry([fromTakeoff, byHand], [{ carriedFromItemId: 'carrier' }]).map((r) => r.id)).toEqual(['lav1'])
  })

  it('a schedule row the schedule no longer lists is not carried', () => {
    const scheduleRow = item({ id: 'old', tag: 'HB-9', source_quote_line_id: null, specified_manufacturer: 'WOODFORD', specified_model: 'B74C' })
    expect(rowsToCarry([scheduleRow], [])).toEqual([])
  })

  it('the carried row stands as it was, points back, and its call starts blank', () => {
    const ins = carriedRowInsert(fromTakeoff, 's2', 4)
    expect(ins).toMatchObject({ submittal_id: 's2', tag: 'LAV-1', sequence_order: 4, source_count_row_id: 'cr-lav1', status: 'proposed', sheet_file: 0, sheet_pages: [30, 31], carried_from_item_id: 'lav1' })
    expect('review_decision' in ins).toBe(false)
  })
})

describe('an order-only row keeps its state from revision to revision (2026-10-02)', () => {
  it('a carried row names the column only when it is true', () => {
    expect(carriedRowInsert(item({ order_only: true, source_quote_line_id: null, source_count_row_id: 'c1' }), 's2', 1).order_only).toBe(true)
    expect('order_only' in carriedRowInsert(item({ order_only: false, source_quote_line_id: null, source_count_row_id: 'c1' }), 's2', 1)).toBe(false)
  })

  it('a row the picks rebuild takes it from the row before', () => {
    expect(itemToPrevious(item({ order_only: true })).orderOnly).toBe(true)
    expect(itemToPrevious(item({})).orderOnly).toBe(false)
    const draft = { tag: 'WC-1', sequenceOrder: 1, specifiedManufacturer: null, specifiedModel: null, specifiedDescription: null, submittedManufacturer: null, submittedModel: null, submittedLabel: 'x', supplyHouseId: null, houseName: null, sourceQuoteLineId: null, status: 'as_specified', near: false, reasonKind: null, reasonNote: null, leadTimeDays: null, sheetFile: null, sheetPages: [], carriedFromItemId: 'i1', changed: false, changeNote: null } satisfies SubmittalRowDraft
    expect(draftToItemInsert({ ...draft, orderOnly: true }, 's2').order_only).toBe(true)
    expect('order_only' in draftToItemInsert(draft, 's2')).toBe(false)
  })
})

describe('v2.5023 · a design change keeps its call and sign-off when the row moves', () => {
  const rec = { call_by: 'engineer', signoff_name: 'Pat Lee', signoff_on: '2026-10-09', signoff_via: 'email' }
  const signed = item({ status: 'design_change', source_quote_line_id: null, source_count_row_id: 'c1', ...rec } as Partial<SubmittalItemRow>)
  it('the next revision reads it from the row before, only on a design change that holds one', () => {
    expect(itemToPrevious(signed).designCall).toEqual(rec)
    expect('designCall' in itemToPrevious(item({ status: 'design_change' }))).toBe(false)
    expect('designCall' in itemToPrevious(item({ status: 'alternate', ...rec } as Partial<SubmittalItemRow>))).toBe(false)
  })
  it('a carried row and a rebuilt row write the four columns, and a row with none names none of them', () => {
    expect(carriedRowInsert(signed, 's2', 1)).toMatchObject(rec)
    expect('call_by' in carriedRowInsert(item({ status: 'design_change', source_quote_line_id: null, source_count_row_id: 'c1' }), 's2', 1)).toBe(false)
    const draft = { tag: 'FV-1', sequenceOrder: 1, specifiedManufacturer: null, specifiedModel: null, specifiedDescription: null, submittedManufacturer: null, submittedModel: null, submittedLabel: 'x', supplyHouseId: null, houseName: null, sourceQuoteLineId: null, status: 'design_change', near: false, reasonKind: null, reasonNote: null, leadTimeDays: null, sheetFile: null, sheetPages: [], carriedFromItemId: 'i1', changed: false, changeNote: null } satisfies SubmittalRowDraft
    expect(draftToItemInsert({ ...draft, designCall: rec }, 's2')).toMatchObject(rec)
    expect('call_by' in draftToItemInsert(draft, 's2')).toBe(false)
  })
})

describe('2026-10-04 · a package built with cut sheets still to follow', () => {
  it('names the rows that want a cut sheet and have none; a row with no product is not one of them', () => {
    const rows = [
      item({ tag: 'DWH-1', status: 'proposed', sheet_pages: [6, 7] }),
      item({ tag: 'FCO', status: 'proposed', sheet_pages: [] }),
      item({ tag: 'UTILITY SINK', status: 'missing', sheet_pages: [] }),
      item({ tag: '', status: 'accessory', sheet_pages: [] }),
    ]
    expect(rowsOwingSheet(rows)).toEqual(['FCO', 'accessory'])
  })

  it('the question names them, and says what the cover will read', () => {
    expect(sheetsToFollowConfirm(['FCO', 'FD', 'HB-3', 'WHA-200', 'WHA-300', 'WHA-500'])).toEqual({
      title: 'Build the package with 6 cut sheets to follow',
      message: 'These rows have no cut sheet yet: FCO, FD, HB-3, WHA-200, WHA-300, WHA-500. The cover will read cut sheet to follow for them. The GC may hold their answer on those rows until the sheet arrives.',
      confirmLabel: 'Build package',
    })
    expect(sheetsToFollowConfirm(['FCO']).message).toBe('This row has no cut sheet yet: FCO. The cover will read cut sheet to follow for it. The GC may hold their answer on that row until the sheet arrives.')
    expect(sheetsToFollowConfirm(Array.from({ length: 15 }, (_, i) => `T-${i + 1}`)).message).toContain('T-12 and 3 more.')
  })

  it('the button counts them', () => {
    expect(buildPackageLabel(false, 0)).toBe('Build package')
    expect(buildPackageLabel(false, 6)).toBe('Build package · 6 cut sheets to follow')
    expect(buildPackageLabel(true, 1)).toBe('Rebuild package · 1 cut sheet to follow')
  })
})
