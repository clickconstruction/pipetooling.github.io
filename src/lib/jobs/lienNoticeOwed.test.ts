import { describe, expect, it } from 'vitest'
import { LIEN_NOTICE_OWED_DOORS, lienAffidavitNoticeDueLine, lienLastMonthNoticeDue, lienNoticeMonthsAfter, lienNoticeNamedMonths, lienNoticeOwedConfirmWords, lienNoticeOwedMonths, lienNoticeOwedWords, lienNoticeToExtend } from './lienNoticeOwed'
import { formatYmdMonthDay } from './billedExpectedPay'
import { plainWordsFailures } from '../plainWords'

const notice = (months: string[], over: Record<string, unknown> = {}) => ({ kind: 'notice_53_056', months_covered: months, sends: [{ recipient: 'owner', method: 'certified_mail', sent_on: '2026-09-22' }], voided_at: null, ...over })
const EARLIER = ['2026-04', '2026-06', '2026-07', '2026-08']

describe('lienNoticeOwedWords · the To do row on a job with a recorded notice that still owes one (punch list #353, part 2)', () => {
  it('names the owed month, then the months the notice on record names', () => {
    expect(lienNoticeOwedWords(['2026-09'], EARLIER)).toBe('September 2026 has no notice. The one on record names April, June, July and August 2026.')
    expect(lienNoticeOwedWords(['2026-09', '2026-10'], ['2026-06', '2026-07', '2026-08'])).toBe('September and October 2026 have no notice. The one on record names June to August 2026.')
  })
  it('says nothing with no notice on record, or nothing owed: the row keeps its plain words', () => {
    expect(lienNoticeOwedWords(['2026-09'], [])).toBeNull()
    expect(lienNoticeOwedWords([], EARLIER)).toBeNull()
    expect(lienNoticeOwedWords(['bad'], EARLIER)).toBeNull()
  })
  it('reads the named months off the live notices, and the owed months off the entry', () => {
    expect(lienNoticeNamedMonths([notice(EARLIER), notice(['2026-08'], { voided_at: '2026-10-01T00:00:00Z' })])).toEqual(EARLIER)
    expect(lienNoticeOwedMonths({ dueMonths: ['2026-10', '2026-09', '2026-09'] })).toEqual(['2026-09', '2026-10'])
  })
  it('the doors read in plain words', () => {
    for (const s of [lienNoticeOwedWords(['2026-09'], EARLIER)!, LIEN_NOTICE_OWED_DOORS.named(['2026-09']), LIEN_NOTICE_OWED_DOORS.lastDay]) expect(plainWordsFailures(s), s).toEqual([])
    expect(LIEN_NOTICE_OWED_DOORS.named(['2026-09'])).toBe('The paper named September 2026 too')
  })
})

describe('lienLastMonthNoticeDue · the last work month’s own notice still due (punch list #353, part 2)', () => {
  const f = { isSub: true, lastMonth: '2026-09', propertyKind: 'residential', filings: [notice(EARLIER)], todayYmd: '2026-11-14' }
  it('a house: September’s notice is due by the 15th of the second month, rolled off the weekend', () => {
    expect(lienLastMonthNoticeDue(f)).toEqual({ month: '2026-09', dueOn: '2026-11-16' })
    expect(lienLastMonthNoticeDue({ ...f, propertyKind: 'non_residential' })).toEqual({ month: '2026-09', dueOn: '2026-12-15' })
  })
  it('is nothing once a notice names the month, once the window has closed, on a job contracted with the owner, or with no month', () => {
    expect(lienLastMonthNoticeDue({ ...f, filings: [notice([...EARLIER, '2026-09'])] })).toBeNull()
    expect(lienLastMonthNoticeDue({ ...f, todayYmd: '2026-11-17' })).toBeNull()
    expect(lienLastMonthNoticeDue({ ...f, isSub: false })).toBeNull()
    expect(lienLastMonthNoticeDue({ ...f, lastMonth: '' })).toBeNull()
    expect(lienLastMonthNoticeDue({ ...f, filings: [] })).toEqual({ month: '2026-09', dueOn: '2026-11-16' })
  })
  it('the pane’s line says the month, the day and what the paper will not name', () => {
    const line = lienAffidavitNoticeDueLine({ month: '2026-09', dueOn: '2026-11-16' }, formatYmdMonthDay)
    expect(line).toBe("September 2026's notice is still due, by Nov 16. The paper will not name that month until the notice is recorded.")
    expect(plainWordsFailures(line)).toEqual([])
  })
})

describe('the *paper named it too* door (punch list #353, part 2)', () => {
  const f = (id: string, created_at: string, months: string[], voided_at: string | null = null) => ({ id, kind: 'notice_53_056', months_covered: months, voided_at, created_at })
  it('corrects the newest live notice on the job, never a voided one or another paper', () => {
    expect(lienNoticeToExtend([f('old', '2026-10-01', ['2026-06']), f('new', '2026-11-14', ['2026-07']), f('gone', '2026-11-15', ['2026-08'], '2026-11-15T01:00:00Z'), { ...f('aff', '2026-11-16', []), kind: 'affidavit' }])?.id).toBe('new')
    expect(lienNoticeToExtend([])).toBeNull()
    expect(lienNoticeToExtend(null)).toBeNull()
  })
  it('adds the owed months once, oldest first', () => {
    expect(lienNoticeMonthsAfter({ months_covered: ['2026-08', '2026-06'] }, ['2026-09', '2026-08'])).toEqual(['2026-06', '2026-08', '2026-09'])
  })
  it('the confirm window says what it adds and carries the verb', () => {
    const w = lienNoticeOwedConfirmWords(['2026-09'], ['2026-04', '2026-06', '2026-07', '2026-08'])
    expect(w).toEqual({ title: 'The paper named September 2026 too?', message: 'The notice on record names April, June, July and August 2026. This adds September 2026 to its record, and the row clears. Only if the paper as mailed named it.', confirmLabel: 'Add September 2026 to the record' })
    for (const s of [w.title, w.message]) expect(plainWordsFailures(s), s).toEqual([])
  })
})
