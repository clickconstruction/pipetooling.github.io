import { describe, expect, it } from 'vitest'
import {
  LIEN_CLOSED_BIN_WORDS,
  LIEN_CLOSED_COUNT_NOTE,
  buildLienClosedWindow,
  lienAffidavitDayPassed,
  lienClosedAnswerPress,
  lienClosedDates,
  lienClosedFacts,
  lienClosedLetGoConfirm,
  lienClosedDayWords,
  lienClosedKeepToast,
  lienClosedKind,
  lienClosedLetGoToast,
  lienClosedReason,
  lienClosedRecordToast,
  lienClosedRuleWords,
  lienClosedWalkWords,
  lienLateNoticeStillCounts,
  lienNoticeWindowClosed,
  type LienClosedFacts,
} from './lienClosedEnd'
import type { LienDeskEntry } from './lienDesk'
import type { LienAffidavitEntry } from './lienDeskAffidavits'
import { UNCOLLECTIBLE_REASON_MIN } from '../setJobUncollectible'

/** A made-up job whose lien day passed two days ago with nothing filed. */
function gone(over: Partial<LienClosedFacts> = {}): LienClosedFacts {
  return { number: '4127', name: 'Cedar Park Dental', gcName: 'Ridgeway Builders', unpaid: 2918, months: [], lienDay: '2026-11-16', lienDaysLeft: -2, lastMonth: '2026-08', source: 'hours', commercial: false, hasPaper: false, collectionsSince: '2026-11-10T15:00:00Z', status: 'billed', canAnswer: true, canSetLastWork: true, ...over }
}
/** A made-up job with one closed month and its lien day ahead. */
function month(over: Partial<LienClosedFacts> = {}): LienClosedFacts {
  return gone({ number: '4093', name: 'Maple Street Lofts', unpaid: 6400, months: [{ key: '2026-08', deadline: '2026-10-15' }], lienDay: '2026-12-15', lienDaysLeft: 27, source: 'bill', collectionsSince: null, ...over })
}

describe('who stands at a closed end', () => {
  it('an affidavit past its day with nothing filed, whatever pile it stands in', () => {
    for (const pile of ['needs_property', 'needs_notice', 'to_draft', 'awaiting', 'ready', 'held', 'missed'] as const) expect(lienAffidavitDayPassed({ pile, daysLeft: -1 })).toBe(true)
    // On its last day it can still be filed, and a filed one is never closed.
    expect(lienAffidavitDayPassed({ pile: 'ready', daysLeft: 0 })).toBe(false)
    expect(lienAffidavitDayPassed({ pile: 'filed', daysLeft: -9 })).toBe(false)
  })

  it('a notice whose every month closed, until someone records the months', () => {
    expect(lienNoticeWindowClosed({ pile: 'missed', missedUnrecorded: ['2026-08'] })).toBe(true)
    expect(lienNoticeWindowClosed({ pile: 'missed', missedUnrecorded: [] })).toBe(false)
    // A job with a closed month and an open one stays in its flow bin: its open month is work to do.
    expect(lienNoticeWindowClosed({ pile: 'to_draft', missedUnrecorded: ['2026-08'] })).toBe(false)
  })

  it('a late notice counts only while the lien day is known and ahead', () => {
    expect(lienLateNoticeStillCounts({ affidavitDaysLeft: 0 })).toBe(true)
    expect(lienLateNoticeStillCounts({ affidavitDaysLeft: -1 })).toBe(false)
    expect(lienLateNoticeStillCounts({ affidavitDaysLeft: null })).toBe(false)
  })

  it('names each bin for what closed', () => {
    expect(LIEN_CLOSED_BIN_WORDS).toEqual({ notice: 'Window closed · no notice', affidavit: 'Lien day passed · not filed' })
  })
})

describe('which end', () => {
  it('the lien day passed wins over a closed month', () => {
    expect(lienClosedKind({ months: [{ key: '2026-08', deadline: '2026-10-15' }], lienDaysLeft: -1 })).toBe('gone')
    expect(lienClosedKind({ months: [{ key: '2026-08', deadline: '2026-10-15' }], lienDaysLeft: 3 })).toBe('month')
    expect(lienClosedKind({ months: [{ key: '2026-08', deadline: '2026-10-15' }], lienDaysLeft: null })).toBe('month')
    expect(lienClosedKind({ months: [], lienDaysLeft: 3 })).toBeNull()
    expect(buildLienClosedWindow(gone({ lienDaysLeft: 4 }))).toBeNull()
  })
})

describe('the window when the lien day has passed', () => {
  it('says what closed, the day, and where the day comes from', () => {
    const w = buildLienClosedWindow(gone())!
    expect(w.kind).toBe('gone')
    expect(w.title).toBe('The lien day has passed')
    expect(w.sub).toBe('4127 · Cedar Park Dental · Ridgeway Builders · $2,918 unpaid')
    expect(w.closed).toEqual(['The last day to file a lien on this job was Monday, Nov 16.', 'No filing is on record.', 'As the dates stand, no lien can be filed for this job.', 'The money is still owed.'])
    expect(w.open).toBeNull()
    expect(w.from.words).toBe('The last month of work is August 2026. It comes from the job’s approved hours.')
    expect(w.from.note).toBe(`On a house the lien day is the 15th of the third month after it. ${LIEN_CLOSED_COUNT_NOTE}`)
  })

  it('names the source of the month, and the later clock on a commercial property', () => {
    expect(buildLienClosedWindow(gone({ source: 'bill' }))!.from.words).toBe('The last month of work is August 2026. It comes from the job’s bill. Nobody clocked on this job.')
    expect(buildLienClosedWindow(gone({ source: 'hand' }))!.from.words).toContain('set by hand')
    expect(buildLienClosedWindow(gone({ source: 'created' }))!.from.words).toContain('the month the job was made')
    expect(lienClosedRuleWords(true)).toBe('On a commercial property the lien day is the 15th of the fourth month after it.')
    expect(buildLienClosedWindow(gone({ commercial: true }))!.from.note).toContain('fourth month')
  })

  it('says an affidavit was made when one was sent, approved or held', () => {
    expect(buildLienClosedWindow(gone({ hasPaper: true }))!.closed[1]).toBe('An affidavit was made for it, and no filing is on record.')
  })

  it('offers the date, keep collecting as the filled press, and Uncollectible as the deliberate one', () => {
    const w = buildLienClosedWindow(gone())!
    expect(w.answers.map((a) => [a.key, a.look, a.press, a.dead])).toEqual([
      ['date', 'door', 'Set the last day of work ›', null],
      ['keep', 'filled', 'Keep collecting 4127', null],
      ['let_go', 'plain', 'Mark 4127 Uncollectible', null],
    ])
    expect(w.answers[0]!.also).toEqual({ key: 'filed', ask: 'Was it filed in time?', door: 'Record the filing ›' })
    expect(w.answers[0]!.words).toBe('Set the right last day of work. A later day puts this paper back in the flow by itself.')
    expect(w.answers[1]!.words).toBe('The job stays in Collections and leaves the Lien desk. Nothing is filed or deleted.')
    expect(w.answers[2]!.words).toBe('The job is marked Uncollectible. The office stops chasing it.')
  })

  it('says where Collections stands for a job that is not in it', () => {
    const billed = buildLienClosedWindow(gone({ collectionsSince: null }))!
    expect(billed.answers[1]!.words).toBe('The job goes to Collections and leaves the Lien desk. Nothing is filed or deleted.')
    expect(billed.answers[2]!.words).toBe('The job goes to Collections and is marked Uncollectible. The office stops chasing it.')
    expect(billed.answers[2]!.dead).toBeNull()
    // Collections takes a billed job only: the job still leaves the desk, and Uncollectible is dead with its reason.
    const working = buildLienClosedWindow(gone({ collectionsSince: null, status: 'working' }))!
    expect(working.answers[1]!.words).toBe('The job leaves the Lien desk. 4127 is still being worked, so it does not go to Collections yet. Nothing is filed or deleted.')
    expect(working.answers[1]!.dead).toBeNull()
    expect(working.answers[2]!.dead).toBe('4127 is still being worked. Only a billed job can be marked Uncollectible.')
  })

  it('leaves the answers dead with a reason for a viewer outside the lien office', () => {
    const w = buildLienClosedWindow(gone({ canAnswer: false, canSetLastWork: false }))!
    expect(w.answers.map((a) => a.dead)).toEqual(['The office sets the last day of work.', 'The office answers this.', 'The office answers this.'])
  })
})

describe('the window when one month closed and the lien can still be saved', () => {
  it('says what closed and what is still open, with no let-go answer', () => {
    const w = buildLienClosedWindow(month())!
    expect(w.kind).toBe('month')
    expect(w.title).toBe('A notice window closed')
    expect(w.closed).toEqual(['The last day to send the notice for August 2026 work was Thursday, Oct 15.', 'No notice went out.'])
    expect(w.open).toBe('A late notice still counts while the lien day is ahead. This job’s lien day is Dec 15.')
    expect(w.from).toEqual({ words: 'The month is counted from the job’s work. It comes from the job’s bill. Nobody clocked on this job.', note: LIEN_CLOSED_COUNT_NOTE })
    expect(w.answers.map((a) => [a.key, a.look, a.press])).toEqual([
      ['late_notice', 'filled', 'Draft the late notice ›'],
      ['date', 'door', 'Set the last day of work ›'],
      ['record', 'plain', 'Record August 2026 closed'],
    ])
    expect(w.answers[1]!.also).toBeUndefined()
    expect(w.answers[2]!.words).toBe('No notice goes for August 2026. The job stays on the Lien desk for its lien day.')
  })

  it('names every closed month, the earliest first', () => {
    const w = buildLienClosedWindow(month({ months: [{ key: '2026-08', deadline: '2026-10-15' }, { key: '2026-07', deadline: '2026-09-15' }] }))!
    expect(w.title).toBe('2 notice windows closed')
    expect(w.closed.slice(0, 2)).toEqual(['The last day to send the notice for July 2026 work was Tuesday, Sep 15.', 'The last day to send the notice for August 2026 work was Thursday, Oct 15.'])
    expect(w.answers[2]!.press).toBe('Record July and August 2026 closed')
  })

  it('lets anyone open the late notice, and keeps recording for the office', () => {
    const w = buildLienClosedWindow(month({ canAnswer: false, canSetLastWork: false }))!
    expect(w.answers.map((a) => a.dead)).toEqual([null, 'The office sets the last day of work.', 'The office answers this.'])
  })
})

describe('what is kept and said after an answer', () => {
  it('keeps the day, the choice and the person’s own note as the reason', () => {
    expect(lienClosedReason({ lienDay: '2026-11-16' }, 'keep')).toBe('The lien day passed on Nov 16 with no lien filed. The office keeps collecting.')
    expect(lienClosedReason({ lienDay: '2026-11-16' }, 'let_go', ' The builder closed its doors ')).toBe('The lien day passed on Nov 16 with no lien filed. The office let it go. The builder closed its doors.')
    expect(lienClosedReason({ lienDay: null }, 'keep', 'Paying in January.')).toBe('The lien day passed with no lien filed. The office keeps collecting. Paying in January.')
    // The Uncollectible mark refuses a short reason: the shortest one this writes is long enough.
    expect(lienClosedReason({ lienDay: null }, 'let_go').length).toBeGreaterThanOrEqual(UNCOLLECTIBLE_REASON_MIN)
  })

  it('says what Collections answered after Keep collecting', () => {
    expect(lienClosedKeepToast({ number: '4127', collectionsSince: '2026-11-10T15:00:00Z' }, { onAttorneyList: true, held: null })).toEqual({ words: '4127 is off the Lien desk. It stays in Collections.', tone: 'success' })
    expect(lienClosedKeepToast({ number: '4127', collectionsSince: null }, { onAttorneyList: true, held: null })).toEqual({ words: '4127 is off the Lien desk. It is in Collections.', tone: 'success' })
    expect(lienClosedKeepToast({ number: '4127', collectionsSince: null }, { onAttorneyList: false, held: 'the job is not billed' })).toEqual({ words: '4127 is off the Lien desk. It did not go to Collections: the job is not billed.', tone: 'warning' })
  })

  it('words the other two toasts and the walk', () => {
    expect(lienClosedLetGoToast('4127')).toEqual({ words: '4127 is marked Uncollectible. It is off the Lien desk.', tone: 'success' })
    // The mark stands when Stripe could not be marked, and the toast says so.
    expect(lienClosedLetGoToast('4127', ['No such invoice'])).toEqual({ words: '4127 is marked Uncollectible. It is off the Lien desk. Stripe could not be marked: No such invoice.', tone: 'warning' })
    expect(lienClosedLetGoConfirm('4127')).toEqual({ ask: 'Mark 4127 Uncollectible? It leaves every total. The Pipeline can put it back in Collections.', yes: 'Yes, mark 4127 Uncollectible', no: 'Not yet' })
    expect(lienClosedAnswerPress(2)).toBe('Answer 2 ›')
    expect(lienClosedRecordToast('4093', ['2026-08'])).toBe('Recorded. No notice goes for August 2026 on 4093.')
    expect(lienClosedWalkWords(0, 3)).toBe('1 of 3')
    expect(lienClosedWalkWords(0, 1)).toBe('')
    expect(lienClosedDayWords('2026-11-16')).toBe('Monday, Nov 16')
  })
})

describe('the dates off the desk’s entries', () => {
  const noticeEntry = (over: Partial<LienDeskEntry> = {}) =>
    ({ jobId: 'j1', propertyKind: 'non_residential', months: [{ key: '2026-07', deadline: '2026-10-15', daysLeft: -34, noticed: false }, { key: '2026-08', deadline: '2026-11-16', daysLeft: -2, noticed: false }], missedMonths: ['2026-07', '2026-08'], missedUnrecorded: ['2026-08'], affidavitDay: '2026-12-15', affidavitDaysLeft: 27, datedFromCreation: true, datedFromBill: true, pile: 'missed', ...over }) as unknown as LienDeskEntry
  const affidavitEntry = (over: Partial<LienAffidavitEntry> = {}) => ({ jobId: 'j1', lastMonth: '2026-08', lastMonthFromCreation: false, deadline: '2026-11-16', daysLeft: -2, propertyKind: '', item: null, pile: 'missed', ...over }) as unknown as LienAffidavitEntry

  it('reads the unrecorded months with their days, and the lien day the notice reckons', () => {
    expect(lienClosedDates(noticeEntry(), null)).toEqual({ months: [{ key: '2026-08', deadline: '2026-11-16' }], lienDay: '2026-12-15', lienDaysLeft: 27, lastMonth: '2026-08', source: 'bill', commercial: true, hasPaper: false })
  })

  it('takes the affidavit’s own day, month and source when the job has one on the desk', () => {
    const d = lienClosedDates(noticeEntry(), affidavitEntry({ lastMonthByHand: true, item: { status: 'approved', voided_at: null } as never }))
    expect(d).toMatchObject({ lienDay: '2026-11-16', lienDaysLeft: -2, lastMonth: '2026-08', source: 'hand', commercial: false, hasPaper: true })
    expect(lienClosedDates(null, affidavitEntry()).months).toEqual([])
    expect(lienClosedDates(null, affidavitEntry({ item: { status: 'draft', voided_at: null } as never })).hasPaper).toBe(false)
  })

  it('builds the window’s facts for the viewer: the lien office answers, and the date door needs the desk’s door too', () => {
    const base = { number: '4127', name: ' Cedar Park Dental ', gcName: 'Ridgeway Builders', unpaid: 2918, notice: null, affidavit: affidavitEntry(), collectionsSince: undefined, status: 'billed' }
    const office = lienClosedFacts({ ...base, role: 'assistant', lastWorkDoor: true })
    expect(office).toMatchObject({ number: '4127', name: 'Cedar Park Dental', lienDay: '2026-11-16', lienDaysLeft: -2, collectionsSince: null, status: 'billed', canAnswer: true, canSetLastWork: true })
    expect(buildLienClosedWindow(office)!.kind).toBe('gone')
    expect(lienClosedFacts({ ...base, role: 'assistant', lastWorkDoor: false }).canSetLastWork).toBe(false)
    expect(lienClosedFacts({ ...base, role: 'estimator', lastWorkDoor: true })).toMatchObject({ canAnswer: false, canSetLastWork: false })
  })
})
