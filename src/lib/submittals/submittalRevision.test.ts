import { describe, expect, it } from 'vitest'

import { asDecision, asReason, asStatus, describeRevision, describeRevisionChip, draftToItemInsert, formatPages, itemToPrevious, needsSheet, parsePageRange, parseSourceFiles, revisionTiles, serializeSourceFiles } from './submittalRevision'
import type { SubmittalItemRow } from './submittalRevision'
import type { SubmittalRowDraft } from './buildSubmittalRows'

const item = (o: Partial<SubmittalItemRow>): SubmittalItemRow => ({
  id: 'i1',
  submittal_id: 's1',
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
  carried_from_item_id: null,
  review_decision: null,
  review_note: null,
  reviewed_by_name: null,
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
      { path: 'b/s/1.pdf', pages: '3' },
      { nope: true },
      null,
    ])
    expect(parsed).toEqual([
      { path: 'b/s/0.pdf', houseId: 'h1', houseName: 'NWS', name: 'NWS-S6277623.pdf', pages: 31, trimmedAt: null },
      { path: 'b/s/1.pdf', houseId: null, houseName: null, name: '1.pdf', pages: 0, trimmedAt: null },
    ])
    expect(serializeSourceFiles(parsed)[0]).toEqual({ path: 'b/s/0.pdf', house_id: 'h1', house_name: 'NWS', name: 'NWS-S6277623.pdf', pages: 31, trimmed_at: null })
    expect(parseSourceFiles(null)).toEqual([])
  })
})

describe('row ↔ item', () => {
  it('itemToPrevious carries what the next revision needs', () => {
    const prev = itemToPrevious(item({ reason_kind: 'lead_time', lead_time_days: 14, sheet_file: 0, sheet_pages: [3, 4], review_decision: 'revise', review_note: 'hold 1.0 gpf' }))
    expect(prev).toEqual({ id: 'i1', tag: 'WC-1', submittedModel: 'CT728CUVG', submittedLabel: 'TOTO CT728CUVG#01', status: 'alternate', reasonKind: 'lead_time', reasonNote: null, leadTimeDays: 14, sheetFile: 0, sheetPages: [3, 4], reviewDecision: 'revise', reviewNote: 'hold 1.0 gpf' })
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
    expect(t).toEqual({ rows: 8, tagged: 7, accessories: 1, asSpecified: 1, superseded: 1, equal: 1, alternates: 2, alternatesWithoutReason: 1, designChanges: 1, designChangesWithoutReason: 1, missing: 1, sheetsIn: 4, sheetsWanted: 7, sheetsNeeded: 3 })
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
})
