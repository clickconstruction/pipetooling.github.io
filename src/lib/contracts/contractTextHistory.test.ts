import { describe, expect, it } from 'vitest'
import { CUSTOMER_CONTRACT_CATALOG, resolveContractTexts, type ContractCatalogData, type ContractCatalogEntry } from './customerContractCatalog'
import {
  REVIEW_EVERY_MONTHS,
  contractSourceRef,
  inForceLine,
  lastChanged,
  lastReview,
  reviewCounts,
  reviewCountsLine,
  reviewState,
  versionCompareKey,
  versionKind,
  versionLine,
  versionsFor,
  wordingInForceOn,
  ymdAddMonths,
  type ContractTextReview,
  type ContractTextVersion,
} from './contractTextHistory'

const entry = (id: string): ContractCatalogEntry => {
  const e = CUSTOMER_CONTRACT_CATALOG.find((x) => x.id === id)
  if (!e) throw new Error(`no catalog entry ${id}`)
  return e
}
const DOC = { id: 'doc-1', document_name: 'Service agreement', book_body_html: '1. Scope.', book_body_format: 'plain', book_version_date: '2026-09-20' }
const DATA: ContractCatalogData = { settings: new Map(), bookDocs: [DOC] }
const text = (id: string, data: ContractCatalogData = DATA) => resolveContractTexts(entry(id), data)[0]!

let seq = 0
const v = (over: Partial<ContractTextVersion>): ContractTextVersion => ({
  id: `v${++seq}`,
  source_kind: 'app_setting',
  source_key: 'bid_cover_letter_terms_default_v1',
  name: null,
  body: 'Net 30.',
  body_format: 'plain',
  version_date: null,
  change_kind: 'changed',
  // 18:00 UTC is the afternoon of the same day in the company's zone.
  changed_at: '2026-09-28T18:00:00Z',
  changed_by: 'u1',
  ...over,
})
const r = (over: Partial<ContractTextReview>): ContractTextReview => ({ id: `r${++seq}`, entry_id: 'bid-terms', reviewed_on: '2026-09-28', note: null, reviewed_by: 'u1', created_at: '2026-09-28T18:00:00Z', ...over })
const nameOf = (id: string | null) => (id === 'u1' ? 'Taunya' : null)

describe('contractSourceRef', () => {
  it('a Settings text and a Book document have a history; the rest do not', () => {
    expect(contractSourceRef(entry('bid-terms'), text('bid-terms'))).toEqual({ kind: 'app_setting', key: 'bid_cover_letter_terms_default_v1' })
    expect(contractSourceRef(entry('job-standard-terms'), text('job-standard-terms'))).toEqual({ kind: 'contract_book', key: 'doc-1' })
    expect(contractSourceRef(entry('job-standard-terms'), text('job-standard-terms', { settings: new Map(), bookDocs: [] }))).toBeNull()
    expect(contractSourceRef(entry('esign-consent'), text('esign-consent'))).toBeNull()
    expect(contractSourceRef(entry('estimate-terms-box'), text('estimate-terms-box'))).toBeNull()
    expect(contractSourceRef(entry('invoice-footers'), text('invoice-footers'))).toBeNull()
  })
})

describe('versionsFor', () => {
  it('keeps one source, newest first', () => {
    const rows = [v({ id: 'a', changed_at: '2026-09-01T18:00:00Z' }), v({ id: 'b', changed_at: '2026-09-28T18:00:00Z' }), v({ id: 'c', source_key: 'other' }), v({ id: 'd', source_kind: 'contract_book' })]
    expect(versionsFor({ kind: 'app_setting', key: 'bid_cover_letter_terms_default_v1' }, rows).map((x) => x.id)).toEqual(['b', 'a'])
    expect(versionsFor(null, rows)).toEqual([])
  })
})

describe('a history row in words', () => {
  it('a change names the day and the person', () => {
    expect(versionKind(v({}))).toBe('changed')
    expect(versionLine(v({}), nameOf)).toBe('Changed Sep 28, 2026 by Taunya.')
    expect(versionLine(v({ changed_by: null }), nameOf)).toBe('Changed Sep 28, 2026.')
    expect(versionLine(v({ changed_by: 'someone-gone' }), nameOf)).toBe('Changed Sep 28, 2026.')
  })

  it('wording taken away is cleared, whether the row was blanked or deleted', () => {
    expect(versionKind(v({ body: '  ' }))).toBe('cleared')
    expect(versionKind(v({ change_kind: 'removed', body: '' }))).toBe('cleared')
    expect(versionLine(v({ body: '' }), nameOf)).toBe('Cleared Sep 28, 2026 by Taunya.')
  })

  it('a Settings text\'s first record dates the history, not the wording', () => {
    const first = v({ change_kind: 'baseline', changed_by: null })
    expect(versionKind(first)).toBe('first')
    expect(versionLine(first, nameOf)).toBe('On record since Sep 28, 2026. Changes before that were not kept.')
    expect(lastChanged([first], nameOf)).toEqual({ line: 'On record since Sep 28, 2026. Changes before that were not kept.', ymd: null })
  })

  it('a Book document\'s first record carries the day it was last saved', () => {
    const first = v({ source_kind: 'contract_book', source_key: 'doc-1', change_kind: 'baseline', changed_at: '2026-09-20T17:00:00Z', changed_by: null })
    expect(lastChanged([first], nameOf)).toEqual({ line: 'Sep 20, 2026 — as it stood when the history began.', ymd: '2026-09-20' })
  })

  it('reads the day in the company\'s zone', () => {
    // 03:00 UTC on the 29th is the evening of the 28th in the company's zone.
    expect(versionLine(v({ changed_at: '2026-09-29T03:00:00Z' }), nameOf)).toBe('Changed Sep 28, 2026 by Taunya.')
  })

  it('no history, nothing to say', () => {
    expect(lastChanged([], nameOf)).toBeNull()
  })

  it('a compare key of its own', () => {
    expect(versionCompareKey('abc')).toBe('version:abc')
  })
})

describe('the wording in force on a day', () => {
  const history = [
    v({ id: 'third', body: 'Net 45.', changed_at: '2026-09-28T18:00:00Z' }),
    v({ id: 'second', body: '', changed_at: '2026-09-10T18:00:00Z' }),
    v({ id: 'first', body: 'Net 30.', change_kind: 'baseline', changed_at: '2026-09-01T18:00:00Z' }),
  ]

  it('is the newest record made on or before it', () => {
    expect(wordingInForceOn(history, '2026-09-28')?.id).toBe('third')
    expect(wordingInForceOn(history, '2026-09-27')?.id).toBe('second')
    expect(wordingInForceOn(history, '2026-09-05')?.id).toBe('first')
    expect(wordingInForceOn(history, '2026-09-01')?.id).toBe('first')
    expect(wordingInForceOn(history, '2026-08-31')).toBeNull()
    expect(wordingInForceOn(history, 'soon')).toBeNull()
  })

  it('says what it found, and what was not kept', () => {
    expect(inForceLine(history, '2026-10-15')).toBe('On Oct 15, 2026 it read as recorded Sep 28, 2026.')
    expect(inForceLine(history, '2026-09-12')).toBe('On Sep 12, 2026 nothing was set — it had been cleared Sep 10, 2026.')
    expect(inForceLine(history, '2026-08-01')).toBe('The history starts Sep 1, 2026. What it said on Aug 1, 2026 was not kept.')
    expect(inForceLine([], '2026-08-01')).toBe('No history is kept for this wording.')
    expect(inForceLine(history, '')).toBe('Pick a day.')
  })
})

describe('ymdAddMonths', () => {
  it('adds months across a year and lands inside a short month', () => {
    expect(ymdAddMonths('2026-09-28', 12)).toBe('2027-09-28')
    expect(ymdAddMonths('2026-11-30', 3)).toBe('2027-02-28')
    expect(ymdAddMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(ymdAddMonths('2026-03-15', -4)).toBe('2025-11-15')
    expect(ymdAddMonths('nope', 1)).toBe('nope')
  })
})

describe('reviewState', () => {
  const base = { entryId: 'bid-terms', nameOf, todayYmd: '2026-09-28' }

  it('never read, never changed on record', () => {
    expect(reviewState({ ...base, reviews: [], lastChangedYmd: null })).toEqual({ status: 'never', last: null, dueOn: null, line: 'Never reviewed.' })
    // Another entry's review is not this one's.
    expect(reviewState({ ...base, reviews: [r({ entry_id: 'bid-exclusions' })], lastChangedYmd: null }).status).toBe('never')
  })

  it('reviewed, and in date for a year', () => {
    expect(REVIEW_EVERY_MONTHS).toBe(12)
    const s = reviewState({ ...base, reviews: [r({})], lastChangedYmd: null })
    expect(s).toMatchObject({ status: 'ok', dueOn: '2027-09-28' })
    expect(s.line).toBe('Reviewed Sep 28, 2026 by Taunya. Next by Sep 28, 2027.')
  })

  it('due on the day, not the day before', () => {
    const reviews = [r({ reviewed_on: '2025-09-28' })]
    expect(reviewState({ ...base, reviews, lastChangedYmd: null, todayYmd: '2026-09-27' }).status).toBe('ok')
    const due = reviewState({ ...base, reviews, lastChangedYmd: null, todayYmd: '2026-09-28' })
    expect(due.status).toBe('due')
    expect(due.line).toBe('Reviewed Sep 28, 2025 by Taunya. Due since Sep 28, 2026.')
  })

  it('a change counts as a read, and restarts the clock', () => {
    const changedOnly = reviewState({ ...base, reviews: [], lastChangedYmd: '2026-06-01' })
    expect(changedOnly).toMatchObject({ status: 'ok', dueOn: '2027-06-01' })
    expect(changedOnly.line).toBe('Not reviewed since it changed. Next by Jun 1, 2027.')
    const after = reviewState({ ...base, reviews: [r({ reviewed_on: '2025-01-10' })], lastChangedYmd: '2026-06-01' })
    expect(after).toMatchObject({ status: 'ok', dueOn: '2027-06-01' })
    expect(after.line).toBe('Reviewed Jan 10, 2025 by Taunya. Changed since, Jun 1, 2026. Next by Jun 1, 2027.')
    // A change before the last review does not move it.
    expect(reviewState({ ...base, reviews: [r({ reviewed_on: '2026-08-01' })], lastChangedYmd: '2026-06-01' }).dueOn).toBe('2027-08-01')
  })

  it('reads the newest review, and the later of two on one day', () => {
    const reviews = [r({ id: 'old', reviewed_on: '2026-01-01' }), r({ id: 'am', created_at: '2026-09-28T14:00:00Z' }), r({ id: 'pm', created_at: '2026-09-28T20:00:00Z' })]
    expect(lastReview('bid-terms', reviews)?.id).toBe('pm')
    expect(lastReview('nothing', reviews)).toBeNull()
  })

  it('a shorter interval can be asked for', () => {
    expect(reviewState({ ...base, reviews: [r({})], lastChangedYmd: null, everyMonths: 6 }).dueOn).toBe('2027-03-28')
  })
})

describe('the count', () => {
  it('says how many are due and how many were never read, or nothing', () => {
    const states = [
      reviewState({ entryId: 'a', reviews: [], lastChangedYmd: null, todayYmd: '2026-09-28', nameOf }),
      reviewState({ entryId: 'bid-terms', reviews: [r({ reviewed_on: '2025-01-01' })], lastChangedYmd: null, todayYmd: '2026-09-28', nameOf }),
      reviewState({ entryId: 'bid-terms', reviews: [r({})], lastChangedYmd: null, todayYmd: '2026-09-28', nameOf }),
    ]
    expect(reviewCounts(states)).toEqual({ never: 1, due: 1 })
    expect(reviewCountsLine(reviewCounts(states))).toBe('1 due for review · 1 never reviewed')
    expect(reviewCountsLine({ never: 0, due: 0 })).toBeNull()
  })
})
