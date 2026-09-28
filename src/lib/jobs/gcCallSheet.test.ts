import { describe, expect, it } from 'vitest'
import {
  EMPTY_CALL_SHEET_DRAFT,
  buildCallSheet,
  buildCallSheetPrintHtml,
  callSheetAnswers,
  callSheetDraftProblem,
  callSheetWeekEnds,
  isNoChangeNote,
  noChangeNote,
  payPromiseLabel,
  payPromiseStatus,
  type CallSheetDraft,
} from './gcCallSheet'
import type { GcWorklistRow } from './gcWorklist'

const TODAY = '2026-09-27'

const row = (gcId: string, amount: number, over: Partial<GcWorklistRow> = {}): GcWorklistRow =>
  ({ gcId, gcName: `GC ${gcId}`, amount, jobCount: 2, oldestAgeDays: 40, ownerUserId: 'u-malachi', checked: 'done', sent: false, word: false, skipped: false, overLine: true, next: 'send', mark: null, group: {} as never, ...over }) as GcWorklistRow

const board = (over: Record<string, unknown> = {}) => ({ now: 'warm' as const, nowAt: '2026-09-18T15:00:00Z', nowBy: 'Malachi', lastWord: { note: 'Check run is the 20th.', by: 'Malachi', at: '2026-09-18T15:00:00Z', action: 'contacted' }, expectedPayBy: '2026-09-20', ...over })

const draft = (over: Partial<CallSheetDraft>): CallSheetDraft => ({ ...EMPTY_CALL_SHEET_DRAFT, ...over })

describe('payPromiseStatus', () => {
  it('is late the day after the date, while money is open', () => {
    expect(payPromiseStatus('2026-09-20', TODAY, 81500)).toEqual({ payBy: '2026-09-20', late: true, daysLate: 7 })
    expect(payPromiseStatus('2026-09-26', TODAY, 100)).toEqual({ payBy: '2026-09-26', late: true, daysLate: 1 })
  })

  it('is not late on the day itself, nor before it', () => {
    expect(payPromiseStatus('2026-09-27', TODAY, 100)?.late).toBe(false)
    expect(payPromiseStatus('2026-10-10', TODAY, 100)).toEqual({ payBy: '2026-10-10', late: false, daysLate: 0 })
  })

  it('a paid GC kept its word', () => {
    expect(payPromiseStatus('2026-09-20', TODAY, 0)?.late).toBe(false)
  })

  it('no date, no promise', () => {
    expect(payPromiseStatus(null, TODAY, 100)).toBeNull()
    expect(payPromiseStatus('soon', TODAY, 100)).toBeNull()
  })

  it('reads as a sentence', () => {
    expect(payPromiseLabel({ payBy: '2026-09-20', late: true, daysLate: 7 })).toBe('promised Sep 20 — 7 days late')
    expect(payPromiseLabel({ payBy: '2026-09-26', late: true, daysLate: 1 })).toBe('promised Sep 26 — 1 day late')
    expect(payPromiseLabel({ payBy: '2026-10-10', late: false, daysLate: 0 })).toBe('pays by Oct 10')
  })
})

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
