import { describe, expect, it } from 'vitest'
import { isLienOffice } from './lienDesk'
import { lienLastWorkClearedWords, lienLastWorkDoorOffered, lienLastWorkDoorWords, lienLastWorkOpeningDay, lienLastWorkSavedWords } from './lienLastWorkDoor'

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
    expect(lienLastWorkClearedWords(true)).toBe('Back to the clock hours.')
    expect(lienLastWorkClearedWords(false)).toBe("Back to the job's creation day.")
  })
})
