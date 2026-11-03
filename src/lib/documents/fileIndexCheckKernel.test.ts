import { describe, expect, it } from 'vitest'
import {
  addFillAnswer,
  addFillRefusal,
  addRehomeAnswer,
  addRehomeRefusal,
  askAgainAfter,
  CHECK_SAMPLE_DEFAULT,
  CHECK_SAMPLE_MAX,
  checkSample,
  checkWantsAPass,
  checkWords,
  emptyFill,
  emptyRehome,
  fillContinues,
  fillWords,
  FILL_ROUNDS_MAX,
  reconcile,
  rehomeWords,
  type CheckFile,
  type CheckRow,
} from '../../../supabase/functions/_shared/fileIndexCheckKernel'

/**
 * supabase/functions/_shared/fileIndexCheckKernel.ts answers the owner's question after the backfill (punch list #240,
 * v2.6364): which files are in the index and which are not. These pin the reconciliation, its words and the fill's rules.
 */
const file = (id: string, modified = '2026-11-01T10:00:00.000Z', name = `${id}.pdf`): CheckFile => ({ id, name, mimeType: 'application/pdf', modifiedTime: modified })
const row = (id: string, over: Partial<CheckRow> = {}): CheckRow => ({ drive_file_id: id, modified_at: '2026-11-01T10:00:00+00:00', text_why: null, text_source: 'pdf_layer', jobs_ledger_id: 'job', bid_id: null, ...over })

describe('reconcile', () => {
  it('counts files with no row, files changed since their row, and a file listed twice once', () => {
    const c = reconcile([file('a'), file('b', '2026-11-02T09:00:00.000Z'), file('c'), file('c')], [row('a'), row('b')], false)
    expect(c).toMatchObject({ filesInDrive: 3, capped: false, rows: 2, filesWithNoRow: 1, filesChangedSinceRow: 1, rowsOutsideListing: 0, rowsWithText: 2, rowsByWhy: {} })
    expect(c.missing).toEqual([{ id: 'c', name: 'c.pdf', mime: 'application/pdf', modified: '2026-11-01T10:00:00.000Z' }])
  })
  it('compares modified times as instants: Drive’s Z against PostgREST’s +00:00 is current', () => {
    expect(reconcile([file('a', '2026-11-01T10:00:00.000Z')], [row('a', { modified_at: '2026-11-01T10:00:00+00:00' })], false).filesChangedSinceRow).toBe(0)
  })
  it('never calls a row outside the listing gone: it counts them by what they belong to', () => {
    const c = reconcile([file('a')], [row('a'), row('bid-file', { jobs_ledger_id: null, bid_id: 'bid' }), row('job-file'), row('orphan', { jobs_ledger_id: null })], false)
    expect(c.rowsOutsideListing).toBe(3)
    expect(c.rowsOutsideListingOn).toEqual({ job: 1, bid: 1, none: 1 })
  })
  it('counts rows with no text by reason, and the sample is newest first and as big as it was asked to be', () => {
    const files = Array.from({ length: 30 }, (_, i) => file(`f${i}`, `2026-10-${String(1 + (i % 28)).padStart(2, '0')}T00:00:00.000Z`))
    const rows = [row('x', { text_source: null, text_why: 'scan' }), row('y', { text_source: null, text_why: 'scan' }), row('z', { text_source: null, text_why: 'big' })]
    const c = reconcile(files, rows, true)
    expect(c.rowsByWhy).toEqual({ scan: 2, big: 1 })
    expect(c.rowsWithText).toBe(0)
    expect(c.capped).toBe(true)
    expect(c.filesWithNoRow).toBe(30)
    expect(c.missing).toHaveLength(CHECK_SAMPLE_DEFAULT)
    expect(c.missing[0]!.modified! >= c.missing[1]!.modified!).toBe(true)
    expect(reconcile(files, rows, false, 5).missing).toHaveLength(5)
    expect(reconcile(files, rows, false, 0).missing).toHaveLength(0)
  })
})

describe('the sample an ask may take', () => {
  it('is the default for nothing or nonsense, zero for counts alone, and never past the most', () => {
    expect(checkSample(undefined)).toBe(CHECK_SAMPLE_DEFAULT)
    expect(checkSample('200')).toBe(CHECK_SAMPLE_DEFAULT)
    expect(checkSample(-1)).toBe(CHECK_SAMPLE_DEFAULT)
    expect(checkSample(Number.NaN)).toBe(CHECK_SAMPLE_DEFAULT)
    expect(checkSample(0)).toBe(0)
    expect(checkSample(200.9)).toBe(200)
    expect(checkSample(99_999)).toBe(CHECK_SAMPLE_MAX)
  })
})

describe('the words', () => {
  it('say the counts and every reason, merge the two cut-short stamps, and name no file', () => {
    const c = reconcile(
      [file('a'), file('b'), file('secret-name')],
      [row('a'), row('b', { text_source: null, text_why: 'scan' }), row('d', { text_source: null, text_why: 'reading', jobs_ledger_id: null, bid_id: 'bid' }), row('e', { text_source: null, text_why: 'slow', jobs_ledger_id: null, bid_id: 'bid' })],
      false,
    )
    const words = checkWords(c)
    expect(words).toBe('Drive holds 3 files and the index holds 4 rows. 1 file has no row, and 0 files have changed since its row. 1 with text, 3 with none (2 cut short, 1 scan). 2 rows are for a file the Shared Drive\'s listing did not show (2 on bids): outside the drive, or trashed since, which the sweep\'s recheck settles.')
    expect(words).not.toContain('secret-name')
    expect(checkWantsAPass(c)).toBe(true)
  })
  it('a whole index wants no pass, and rows outside the listing alone want none', () => {
    const whole = reconcile([file('a')], [row('a')], false)
    expect(checkWords(whole)).toBe('Drive holds 1 file and the index holds 1 row. 0 files have no row, and 0 files have changed since its row. 1 with text, 0 with none.')
    expect(checkWantsAPass(whole)).toBe(false)
    expect(checkWantsAPass(reconcile([file('a')], [row('a'), row('elsewhere')], false))).toBe(false)
  })
  it('a file changed since its row wants a pass, and a capped listing says so', () => {
    expect(checkWantsAPass(reconcile([file('a', '2026-11-02T09:00:00.000Z')], [row('a')], false))).toBe(true)
    expect(checkWords(reconcile([file('a')], [], true))).toMatch(/^Drive holds 1 file \(the first of more\) and the index holds 0 rows\./)
  })
})

describe('the fill', () => {
  it('asks again after a lost signal, the rate limit or the platform’s failure, and never after the function’s refusal', () => {
    expect(askAgainAfter(0)).toBe(true)
    expect(askAgainAfter(429)).toBe(true)
    expect(askAgainAfter(500)).toBe(true)
    expect(askAgainAfter(546)).toBe(true)
    expect(askAgainAfter(400)).toBe(false)
    expect(askAgainAfter(403)).toBe(false)
    expect(askAgainAfter(409)).toBe(false)
  })
  it('goes round while a round gains and files remain, and stops at the most', () => {
    expect(fillContinues(100, 40, 1)).toBe(true)
    expect(fillContinues(100, 0, 1)).toBe(false)
    expect(fillContinues(100, 100, 1)).toBe(false)
    expect(fillContinues(100, 120, 1)).toBe(false)
    expect(fillContinues(100, 40, FILL_ROUNDS_MAX)).toBe(false)
  })
  it('counts rows, reasons and refusals, and reads a strange answer as one file asked about', () => {
    let t = emptyFill()
    t = addFillAnswer(t, { indexed: 1, held: [], remaining: 0 })
    t = addFillAnswer(t, { indexed: 1, held: [{ id: 'x', name: 'never-printed.pdf', why: 'scan' }], remaining: 0 })
    t = addFillAnswer(t, null)
    t = addFillRefusal(t, 'HTTP 546')
    t = addFillRefusal(t, 'HTTP 546')
    expect(t).toEqual({ asked: 5, rows: 2, held: { scan: 1 }, refused: { 'HTTP 546': 2 } })
    expect(fillWords(t)).toBe('Asked about 5 files: 2 rows written; of them with no text 1 scan; refused 2 × HTTP 546.')
    expect(fillWords(t)).not.toContain('never-printed')
    expect(fillWords(emptyFill())).toBe('Asked about 0 files: 0 rows written.')
  })
})

describe('a row’s home again', () => {
  it('adds the calls up, reads a strange answer as nothing done, and names no file', () => {
    let t = emptyRehome()
    t = addRehomeAnswer(t, 40, { homed: 30, none: 9, unanswered: 1, failed: 0 })
    t = addRehomeAnswer(t, 2, null)
    t = addRehomeRefusal(t, 40, 'HTTP 546')
    expect(t).toEqual({ asked: 82, homed: 30, none: 9, unanswered: 1, failed: 0, refused: { 'HTTP 546': 1 } })
    expect(rehomeWords(t)).toBe('Walked 82 rows up: 30 on a job or bid, 9 still on nothing; Drive did not answer for 1; refused 1 × HTTP 546.')
    expect(rehomeWords(emptyRehome())).toBe('Walked 0 rows up: 0 on a job or bid, 0 still on nothing.')
  })
})
