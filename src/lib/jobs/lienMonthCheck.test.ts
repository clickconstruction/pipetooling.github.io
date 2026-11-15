import { describe, expect, it } from 'vitest'
import {
  LIEN_MONTH_CHECK_CLEAR,
  LIEN_MONTH_CHECK_SAVES_WORDS,
  LIEN_MONTH_SET_LAST_DAY_WORDS,
  lienMonthAskWords,
  lienMonthCheckPatch,
  lienMonthCheckProblem,
  lienMonthCheckState,
  lienMonthCheckedFor,
  lienMonthCheckedRowWords,
  lienMonthCheckedSheetRow,
  lienMonthCheckedWords,
  lienMonthConfirmWords,
  lienMonthName,
  lienMonthQuestion,
  lienMonthYesWords,
  parseLienMonthCheck,
} from './lienMonthCheck'
import { DATED_FROM_BILL_WORDS, MONTH_FROM_BILL_LINE, MONTH_FROM_CREATION_LINE } from './lienBillMonths'
import { lienHelpChecks } from './lienHelpSheet'
import { lienNoticeRecord } from './lienNoticeRecord'
import { formatYmdMonthDay } from './billedExpectedPay'
import { plainWordsFailures } from '../plainWords'

const ROW = { lien_month_checked_month: '2026-08', lien_month_checked_at: '2026-11-14T17:00:00Z', lien_month_checked_by_name: ' Robert ', lien_month_check_note: 'The owner, Nov 14: the work was done in August.' }
const CHECK = parseLienMonthCheck(ROW)!

describe('the stand-in lien month, confirmed by a person (v2.7280, punch list #358)', () => {
  it('reads the check off the job row, trimmed, and nothing from a row without one or read without the columns', () => {
    expect(CHECK).toEqual({ month: '2026-08', at: '2026-11-14T17:00:00Z', byName: 'Robert', note: 'The owner, Nov 14: the work was done in August.' })
    expect(parseLienMonthCheck({ lien_month_checked_month: null })).toBeNull()
    expect(parseLienMonthCheck({ lien_month_checked_month: '2026-13' })).toBeNull()
    expect(parseLienMonthCheck({ id: 'j1', job_name: 'ZZ Test' })).toBeNull()
    expect(parseLienMonthCheck(null)).toBeNull()
    expect(parseLienMonthCheck({ lien_month_checked_month: '2026-08' })).toEqual({ month: '2026-08', at: '', byName: '', note: '' })
  })

  it('a month from hours or a hand day asks nothing; a stand-in nobody confirmed is flagged; the confirmed month is checked only while it is still the stand-in', () => {
    expect(lienMonthCheckState({ source: null, month: '2026-08', check: CHECK })).toEqual({ kind: 'none' })
    expect(lienMonthCheckState({ source: 'bill', month: '', check: CHECK })).toEqual({ kind: 'none' })
    expect(lienMonthCheckState({ source: 'bill', month: '2026-08', check: null })).toEqual({ kind: 'flag', source: 'bill', month: '2026-08' })
    expect(lienMonthCheckState({ source: 'bill', month: '2026-08', check: CHECK })).toEqual({ kind: 'checked', source: 'bill', month: '2026-08', check: CHECK })
    // A later bill moved the month: the question comes back.
    expect(lienMonthCheckState({ source: 'bill', month: '2026-09', check: CHECK })).toEqual({ kind: 'flag', source: 'bill', month: '2026-09' })
    expect(lienMonthCheckedFor({ source: 'job_created', month: '2026-08', check: CHECK })).toEqual(CHECK)
    expect(lienMonthCheckedFor({ source: 'job_created', month: '2026-07', check: CHECK })).toBeNull()
  })

  it('the question, the two presses, the ask and its press name the month in full, in plain words', () => {
    expect(lienMonthName('2026-08')).toBe('August')
    expect(lienMonthQuestion('bill', '2026-08')).toBe(`${MONTH_FROM_BILL_LINE} Is August the month the work was done?`)
    expect(lienMonthQuestion('job_created', '2026-08')).toBe(`${MONTH_FROM_CREATION_LINE} Is August the month the work was done?`)
    expect(lienMonthYesWords('2026-08')).toBe('Yes, August is right ›')
    expect(LIEN_MONTH_SET_LAST_DAY_WORDS).toBe('Set the last day of work ›')
    expect(lienMonthAskWords('2026-08')).toBe('Who said August is the month, and when?')
    expect(lienMonthConfirmWords('2026-08')).toBe('Confirm August')
    for (const text of [lienMonthQuestion('bill', '2026-08'), lienMonthAskWords('2026-08'), LIEN_MONTH_CHECK_SAVES_WORDS]) expect(plainWordsFailures(text)).toEqual([])
  })

  it('the ask needs who said so', () => {
    expect(lienMonthCheckProblem('  ')).toBe('Type who said the month is right, and when.')
    expect(lienMonthCheckProblem('The owner, Nov 14.')).toBeNull()
  })

  it('the quiet line, the grid words and the help sheet’s ✓ row carry who, when and the note', () => {
    expect(lienMonthCheckedWords(CHECK, formatYmdMonthDay)).toBe('August checked · Robert · Nov 14 · The owner, Nov 14: the work was done in August.')
    expect(lienMonthCheckedWords({ ...CHECK, at: '', byName: '', note: '' }, formatYmdMonthDay)).toBe('August checked')
    expect(lienMonthCheckedRowWords(`${DATED_FROM_BILL_WORDS} · notice sent Oct 14`, CHECK, formatYmdMonthDay)).toBe('from the bill · checked Nov 14 · notice sent Oct 14')
    expect(lienMonthCheckedRowWords('dated from the job’s creation · no clock hours', CHECK, formatYmdMonthDay)).toBe('from the job’s creation · checked Nov 14')
    expect(lienMonthCheckedRowWords('82.6h · notice sent Oct 14', CHECK, formatYmdMonthDay)).toBe('82.6h · notice sent Oct 14')
    const row = lienMonthCheckedSheetRow(CHECK, formatYmdMonthDay)
    expect(row).toEqual({ lead: 'Work month.', words: 'August 2026, checked by Robert on Nov 14: The owner, Nov 14: the work was done in August.', row: 'Work month August 2026, checked by Robert.' })
    expect(plainWordsFailures(row.row)).toEqual([])
    expect(lienMonthCheckedSheetRow({ ...CHECK, at: '', byName: '', note: '' }, formatYmdMonthDay)).toEqual({ lead: 'Work month.', words: 'August 2026, checked.', row: 'Work month August 2026, checked.' })
  })

  it('the help sheet reads ✓ Work month. in place of the ⚠ row, and the notice record drops the flag and names the check', () => {
    const base = { ownerName: 'Jordan Sample', propertyKind: 'residential', homestead: false, isSub: true, monthsWords: 'August 2026', noticeLines: [], contractorName: 'Ridgeway Builders', monthStandIn: 'bill' as const }
    const flagged = lienHelpChecks(base)
    expect(flagged[flagged.length - 1]).toMatchObject({ state: 'ask', lead: 'Work month.' })
    const checked = lienHelpChecks({ ...base, monthCheck: lienMonthCheckedSheetRow(CHECK, formatYmdMonthDay) })
    expect(checked.filter((c) => c.lead === 'Work month.')).toEqual([{ state: 'ok', lead: 'Work month.', words: 'August 2026, checked by Robert on Nov 14: The owner, Nov 14: the work was done in August.' }])
    expect(checked.some((c) => c.state === 'ask')).toBe(false)

    const filing = { kind: 'notice_53_056', months_covered: ['2026-08'], sends: [{ recipient: 'owner', method: 'certified_mail', sent_on: '2026-09-10' }, { recipient: 'original_contractor', method: 'certified_mail', sent_on: '2026-09-10' }], voided_at: null }
    const input = { isSub: true, propertyKind: 'residential', swornMonths: ['2026-08'], filings: [filing], paperMonthsWords: 'August 2026', paperNoticesWords: 'certified mail on September 10, 2026', monthStandIn: 'bill' as const }
    expect(lienNoticeRecord(input)!.flags).toEqual([`${MONTH_FROM_BILL_LINE} Set the last day of work on the job if the work ran in another month.`])
    const record = lienNoticeRecord({ ...input, monthCheck: lienMonthCheckedSheetRow(CHECK, formatYmdMonthDay) })!
    expect(record.flags).toEqual([])
    expect(record.flagsShort).toEqual([])
    expect(record.lines[record.lines.length - 1]).toEqual({ state: 'note', lead: 'Work month.', words: 'August 2026, checked by Robert on Nov 14: The owner, Nov 14: the work was done in August.' })
  })

  it('the patch writes the five columns and the clear empties them', () => {
    expect(lienMonthCheckPatch({ month: '2026-08', note: ' The owner said so. ', userId: 'u1', userName: ' Robert ', nowIso: '2026-11-14T17:00:00Z' })).toEqual({
      lien_month_checked_month: '2026-08',
      lien_month_checked_at: '2026-11-14T17:00:00Z',
      lien_month_checked_by: 'u1',
      lien_month_checked_by_name: 'Robert',
      lien_month_check_note: 'The owner said so.',
    })
    expect(LIEN_MONTH_CHECK_CLEAR).toEqual({ lien_month_checked_month: null, lien_month_checked_at: null, lien_month_checked_by: null, lien_month_checked_by_name: '', lien_month_check_note: '' })
  })
})
