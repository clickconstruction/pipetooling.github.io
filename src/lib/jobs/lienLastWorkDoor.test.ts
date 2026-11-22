import { describe, expect, it } from 'vitest'
import { isLienOffice } from './lienDesk'
import { lienLastWorkDay } from './lienLastWorkDay'
import { LIEN_LAST_WORK_KEEP_HINT, LIEN_LAST_WORK_SET_BY_HAND_WORDS, LIEN_LAST_WORK_VALUE_LABEL, lienLastWorkBackTo, lienLastWorkBackWords, lienLastWorkClearedWords, lienLastWorkDoorOffered, lienLastWorkDoorWords, lienLastWorkOpeningDay, lienLastWorkSavedWords } from './lienLastWorkDoor'

describe('the press under the timeline’s LAST WORK stop (v2.7684)', () => {
  it('reads change › over hours or a hand day, and set the day › over a stand-in', () => {
    expect(lienLastWorkDoorWords(false)).toBe('change ›')
    expect(lienLastWorkDoorWords(true)).toBe('set the day ›')
  })
  it('is offered to the lien office on a job the screen holds, and to no one else', () => {
    expect(lienLastWorkDoorOffered({ office: true, hasJob: true })).toBe(true)
    expect(lienLastWorkDoorOffered({ office: false, hasJob: true })).toBe(false)
    expect(lienLastWorkDoorOffered({ office: true, hasJob: false })).toBe(false)
    // The roles behind `office`, as the desk's two panes ask them.
    const offered = (role: string | null) => lienLastWorkDoorOffered({ office: isLienOffice(role), hasJob: true })
    expect(['dev', 'master_technician', 'assistant', 'controller'].map(offered)).toEqual([true, true, true, true])
    expect(['subcontractor', 'estimator', 'primary', 'superintendent', 'law_firm', null].map(offered)).toEqual([false, false, false, false, false, false])
  })
  it('opens the window on the job’s day over hours or a hand day, and empty over a stand-in', () => {
    expect(lienLastWorkOpeningDay({ day: '2026-07-24', source: 'hand' })).toBe('2026-07-24')
    expect(lienLastWorkOpeningDay({ day: '2026-08-20', source: 'hours' })).toBe('2026-08-20')
    expect(lienLastWorkOpeningDay({ day: '2026-07-24', source: 'bill' })).toBe('')
    expect(lienLastWorkOpeningDay({ day: '2026-08-03', source: 'created' })).toBe('')
    expect(lienLastWorkOpeningDay({ day: null, source: 'created' })).toBe('')
  })
  it('says the same words after a save and after a clear, from the line and from the press', () => {
    expect(lienLastWorkSavedWords('2026-07-24')).toBe('Last day of work set to Jul 24. The lien months follow it; clock hours are untouched.')
    expect(lienLastWorkClearedWords('hours')).toBe('Back to the clock hours.')
    expect(lienLastWorkClearedWords('created')).toBe("Back to the job's creation day.")
  })
})

describe('the last day of work as a value in place (punch list #399)', () => {
  it('names the press beside a default day, and the field, apart from the window’s own field', () => {
    expect(LIEN_LAST_WORK_SET_BY_HAND_WORDS).toBe('Set by hand')
    expect(LIEN_LAST_WORK_VALUE_LABEL).toBe('last day of work')
    expect(LIEN_LAST_WORK_VALUE_LABEL).not.toBe('Last day of work')
  })
  it('says under the open field that Keep writes nothing by itself', () => {
    expect(LIEN_LAST_WORK_KEEP_HINT).toBe('Keep shows what moves with the day and asks why before anything is saved. Clock hours and pay are not changed.')
  })
  it('names what a day set by hand goes back to: clock hours, the bill, the creation day, or neither where the bills are not held', () => {
    const hand = { lien_last_work_on: '2026-09-30', created_at: '2026-07-01T15:00:00Z' }
    const bill = { status: 'billed', billed_at: '2026-08-20T15:00:00Z', sent_to_customer_at: '2026-08-21T15:00:00Z' }
    // Clock hours come first, whatever else the job holds.
    expect(lienLastWorkBackTo({ ...hand, last_work_date: '2026-09-24', invoices: [bill] })).toBe('hours')
    expect(lienLastWorkBackTo({ ...hand, last_work_date: '2026-09-24' })).toBe('hours')
    // No hours: the latest sent, unpaid bill dates the job (v2.7224), and the press says so.
    expect(lienLastWorkBackTo({ ...hand, invoices: [bill] })).toBe('bill')
    // No hours and no bill that dates it: the creation day.
    expect(lienLastWorkBackTo({ ...hand, invoices: [] })).toBe('created')
    expect(lienLastWorkBackTo({ ...hand, invoices: [{ ...bill, status: 'paid' }] })).toBe('created')
    // No hours and the caller holds no bills (Edit Job's row): it cannot tell the two apart, so it names neither.
    expect(lienLastWorkBackTo(hand)).toBe('worked_out')
    expect(lienLastWorkBackTo({ ...hand, invoices: null })).toBe('worked_out')
    expect(lienLastWorkBackTo(null)).toBe('worked_out')
  })
  it('agrees with the day the job reads once the hand day is off', () => {
    const bill = { status: 'billed', billed_at: '2026-08-20T15:00:00Z', sent_to_customer_at: '2026-08-21T15:00:00Z' }
    for (const job of [{ last_work_date: '2026-09-24', invoices: [bill] }, { invoices: [bill], created_at: '2026-07-01T15:00:00Z' }, { invoices: [], created_at: '2026-07-01T15:00:00Z' }]) {
      expect(lienLastWorkBackTo({ ...job, lien_last_work_on: '2026-09-30' })).toBe(lienLastWorkDay(job).source)
    }
  })
  it('says it on the press and in the message after it, in the same words', () => {
    expect(lienLastWorkBackWords('hours')).toBe('Back to clock hours')
    expect(lienLastWorkBackWords('bill')).toBe("Back to the bill's day")
    expect(lienLastWorkBackWords('created')).toBe("Back to the job's creation day")
    expect(lienLastWorkBackWords('worked_out')).toBe('Back to the day the app works out')
    expect(lienLastWorkClearedWords('hours')).toBe('Back to the clock hours.')
    for (const to of ['bill', 'created', 'worked_out'] as const) expect(lienLastWorkClearedWords(to)).toBe(`${lienLastWorkBackWords(to)}.`)
  })
})
