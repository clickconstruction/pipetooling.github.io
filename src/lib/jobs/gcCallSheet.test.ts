import { describe, expect, it } from 'vitest'
import {
  EMPTY_CALL_SHEET_DRAFT,
  buildCallSheet,
  buildCallSheetPrintHtml,
  callSheetAnswers,
  callSheetBillsLabel,
  callSheetBillsSummary,
  callSheetDraftProblem,
  callSheetWeekEnds,
  isNoChangeNote,
  noChangeNote,
  type CallSheetDraft,
} from './gcCallSheet'
import type { GcReviewRow } from '../gcReviewRollup'
import type { GcWorklistRow } from './gcWorklist'

const TODAY = '2026-09-27'

const row = (gcId: string, amount: number, over: Partial<GcWorklistRow> = {}): GcWorklistRow =>
  ({ gcId, gcName: `GC ${gcId}`, amount, jobCount: 2, oldestAgeDays: 40, ownerUserId: 'u-malachi', checked: 'done', sent: false, word: false, skipped: false, overLine: true, next: 'send', mark: null, group: { rows: [] } as never, ...over }) as GcWorklistRow

const board = (over: Record<string, unknown> = {}) => ({ now: 'warm' as const, nowAt: '2026-09-18T15:00:00Z', nowBy: 'Malachi', lastWord: { note: 'Check run is the 20th.', by: 'Malachi', at: '2026-09-18T15:00:00Z', action: 'contacted' }, expectedPayBy: '2026-09-20', ...over })

const draft = (over: Partial<CallSheetDraft>): CallSheetDraft => ({ ...EMPTY_CALL_SHEET_DRAFT, ...over })

describe('buildCallSheet', () => {
  it('puts broken promises first, then the GCs with no word, then the largest', () => {
    const sheet = buildCallSheet({
      group: { ownerUserId: 'u-malachi', rows: [row('big', 98000), row('late', 30000), row('in', 99000, { word: true }), row('skip', 50000, { skipped: true })] },
      boardRowByGc: new Map([['late', board()]]),
      todayYmd: TODAY,
    })
    expect(sheet.rows.map((r) => r.gcId)).toEqual(['late', 'big', 'in'])
    expect(sheet.total).toBe(227000)
    expect(sheet.rows[0]?.promise).toEqual({ payBy: '2026-09-20', late: true, daysLate: 7 })
    expect(sheet.rows[0]?.lastWord).toEqual({ temperature: 'warm', note: 'Check run is the 20th.', by: 'Malachi', at: '2026-09-18T15:00:00Z' })
    expect(sheet.rows[1]?.lastWord).toBeNull()
  })

  it('allows "no change" once: not with nothing to repeat, not after a repeat', () => {
    const sheet = buildCallSheet({
      group: { ownerUserId: 'u-malachi', rows: [row('fresh', 3), row('none', 2), row('repeated', 1)] },
      boardRowByGc: new Map([
        ['fresh', board()],
        ['repeated', board({ lastWord: { note: noChangeNote({ note: 'Check run is the 20th.', at: '2026-09-11T15:00:00Z' }), by: 'Malachi', at: '2026-09-18T15:00:00Z', action: 'contacted' } })],
      ]),
      todayYmd: TODAY,
    })
    expect(Object.fromEntries(sheet.rows.map((r) => [r.gcId, r.noChangeAllowed]))).toEqual({ fresh: true, none: false, repeated: false })
  })
})

describe('the no-change sentence', () => {
  it('says what it repeats and from when, and is recognised afterwards', () => {
    const note = noChangeNote({ note: ' Check run is the 20th. ', at: '2026-09-18T15:00:00Z' })
    expect(note).toBe('No change since Sep 18: “Check run is the 20th.”')
    expect(isNoChangeNote(note)).toBe(true)
    expect(isNoChangeNote('Warm — no change in their tone.')).toBe(false)
  })
})

describe('callSheetDraftProblem', () => {
  it('leaves an untouched row alone', () => {
    expect(callSheetDraftProblem(EMPTY_CALL_SHEET_DRAFT, { noChangeAllowed: false })).toBeNull()
  })

  it('a started row needs a read and a sentence', () => {
    expect(callSheetDraftProblem(draft({ note: 'Says the check is coming.' }), { noChangeAllowed: true })).toBe('Pick their temperature.')
    expect(callSheetDraftProblem(draft({ temperature: 'warm', note: 'fine' }), { noChangeAllowed: true })).toBe('A sentence, not a word.')
    expect(callSheetDraftProblem(draft({ payBy: '2026-10-10' }), { noChangeAllowed: true })).toBe('Pick their temperature.')
    expect(callSheetDraftProblem(draft({ temperature: 'warm', note: 'Check run is the 10th.' }), { noChangeAllowed: true })).toBeNull()
  })

  it('refuses a second "no change"', () => {
    expect(callSheetDraftProblem(draft({ noChange: true }), { noChangeAllowed: true })).toBeNull()
    expect(callSheetDraftProblem(draft({ noChange: true }), { noChangeAllowed: false })).toMatch(/already “no change”/)
  })
})

describe('callSheetAnswers', () => {
  const sheet = buildCallSheet({
    group: { ownerUserId: 'u-malachi', rows: [row('a', 3), row('b', 2), row('c', 1)] },
    boardRowByGc: new Map([['b', board()]]),
    todayYmd: TODAY,
  })

  it('saves the rows that were answered and leaves the rest', () => {
    const out = callSheetAnswers(sheet, { a: draft({ temperature: 'hot', note: ' Draw funded Friday, check this week. ', payBy: '2026-10-02' }) }, 'call')
    expect(out).toEqual({ answers: [{ gcId: 'a', channel: 'call', note: 'Draw funded Friday, check this week.', temperature: 'hot', expectedPayBy: '2026-10-02' }], problems: {} })
  })

  it('"no change" repeats the last read and its pay date under a sentence that says so', () => {
    const out = callSheetAnswers(sheet, { b: draft({ noChange: true }) }, 'text')
    expect(out.answers).toEqual([{ gcId: 'b', channel: 'text', note: 'No change since Sep 18: “Check run is the 20th.”', temperature: 'warm', expectedPayBy: '2026-09-20' }])
  })

  it('holds back a half-filled row and says why', () => {
    const out = callSheetAnswers(sheet, { a: draft({ temperature: 'cool' }), c: draft({ temperature: 'warm', note: 'Fine, no date given.' }) }, 'call')
    expect(out.answers.map((a) => a.gcId)).toEqual(['c'])
    expect(out.problems).toEqual({ a: 'A sentence, not a word.' })
  })
})

describe('the printed sheet', () => {
  it('lists each GC with what was last said and room to write', () => {
    const sheet = buildCallSheet({ group: { ownerUserId: 'u-malachi', rows: [row('late', 30000, { gcName: 'Knight & Sons <LLC>' })] }, boardRowByGc: new Map([['late', board()]]), todayYmd: TODAY })
    const html = buildCallSheetPrintHtml(sheet, { ownerName: 'Malachi', dateStr: 'Sep 27, 2026', weekEndsYmd: callSheetWeekEnds('2026-09-21') })
    expect(html).toContain('Call sheet — Malachi')
    expect(html).toContain('Knight &amp; Sons &lt;LLC&gt;')
    expect(html).toContain('promised Sep 20 — 7 days late')
    expect(html).toContain('“Check run is the 20th.”')
    expect(html).toContain('week ends 2026-09-25')
    expect(html).toContain('data-theme="light"')
  })
})

const bill = (key: string, jobId: string, remaining: number, ageDays: number | null, over: Partial<GcReviewRow> = {}): GcReviewRow => ({
  key,
  jobId,
  hcp: key,
  jobName: `Job ${key}`,
  jobAddress: '',
  customerName: 'Cust',
  referenceDateDisplay: 'Sep 2, 2026',
  ageDays,
  remaining,
  inCollections: false,
  ...over,
})

describe('the bills behind a total', () => {
  const bills = [bill('651', 'j1', 8780, 7), bill('186', 'j2', 6200.1, 35), bill('790', 'j3', 1712.5, 136), bill('791', 'j3', 300.2, 90)]

  it('a row carries its GC’s bills in the statement’s order, each with the date its job was promised', () => {
    const sheet = buildCallSheet({
      group: { ownerUserId: 'u-malachi', rows: [row('rmc', 16992.8, { group: { rows: bills } as never })] },
      boardRowByGc: new Map(),
      todayYmd: TODAY,
      promisedPayDates: { j1: { promisedYmd: '2026-09-15' }, j2: { promisedYmd: 'soon' } },
    })
    expect(sheet.rows[0]?.bills?.map((b) => [b.key, b.promisedYmd])).toEqual([
      ['651', '2026-09-15'],
      ['186', null],
      ['790', null],
      ['791', null],
    ])
    expect(sheet.rows[0]?.collections).toEqual([])
  })

  it('the bills come to the total on the row', () => {
    const sheet = buildCallSheet({ group: { ownerUserId: null, rows: [row('rmc', 16992.8, { group: { rows: bills } as never })] }, boardRowByGc: new Map(), todayYmd: TODAY })
    expect(callSheetBillsSummary(sheet.rows[0]!.bills!).total).toBe(sheet.rows[0]!.amount)
  })

  it('lists the GC’s Collections bills apart — they are owed, and not in the total', () => {
    const inCollections = [bill('412', 'j9', 1712.5, 200, { inCollections: true })]
    const sheet = buildCallSheet({
      group: { ownerUserId: null, rows: [row('rmc', 16992.8, { group: { rows: bills } as never }), row('other', 500, { group: { rows: [bill('1', 'j5', 500, 3)] } as never })] },
      boardRowByGc: new Map(),
      todayYmd: TODAY,
      collectionsByGc: new Map([['rmc', inCollections]]),
    })
    expect(sheet.rows[0]?.collections?.map((b) => b.key)).toEqual(['412'])
    expect(sheet.rows[0]?.amount).toBe(16992.8)
    expect(sheet.total).toBe(17492.8)
    expect(sheet.rows[1]?.collections).toEqual([])
  })

  it('sums in cents, counts the jobs, and says how much is 90 days old or more', () => {
    expect(callSheetBillsSummary(bills.map((b) => ({ ...b, promisedYmd: b.jobId === 'j1' ? '2026-09-15' : null })))).toEqual({
      count: 4,
      jobs: 3,
      total: 16992.8,
      old: { count: 2, total: 2012.7 },
      promised: 1,
    })
    expect(callSheetBillsSummary([])).toEqual({ count: 0, jobs: 0, total: 0, old: { count: 0, total: 0 }, promised: 0 })
  })

  it('a bill with no bill-out date is not called old', () => {
    expect(callSheetBillsSummary([{ jobId: 'j1', remaining: 100, ageDays: null, promisedYmd: null }]).old).toEqual({ count: 0, total: 0 })
  })

  it('reads as one line', () => {
    const money = (n: number) => `$${n.toFixed(2)}`
    expect(callSheetBillsLabel({ count: 19, jobs: 12, total: 84601, old: { count: 4, total: 39490 }, promised: 0 }, money)).toBe('19 bills on 12 jobs · 4 over 90 days, $39490.00')
    expect(callSheetBillsLabel({ count: 2, jobs: 2, total: 100, old: { count: 0, total: 0 }, promised: 0 }, money)).toBe('2 bills')
    expect(callSheetBillsLabel({ count: 1, jobs: 1, total: 100, old: { count: 1, total: 100 }, promised: 0 }, money)).toBe('1 bill · 1 over 90 days, $100.00')
    expect(callSheetBillsLabel({ count: 3, jobs: 1, total: 100, old: { count: 0, total: 0 }, promised: 0 }, money)).toBe('3 bills on 1 job')
  })
})
