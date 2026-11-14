import { describe, expect, it } from 'vitest'
import { withJobLastWork, withJobsLastWork } from './lienLastWorkJobs'
import { buildLienPayRunway } from './lienPayRunway'

type Job = { id: string; job_name: string; last_work_date: string | null; lien_last_work_on: string | null; lien_last_work_note?: string | null; lien_last_work_set_at?: string | null; lien_last_work_set_by?: string | null }
const jobs = (): Job[] => [
  { id: 'j226', job_name: 'Dudley Mason', last_work_date: '2026-02-11', lien_last_work_on: null, lien_last_work_note: '' },
  { id: 'j608', job_name: 'Other', last_work_date: '2026-04-02', lien_last_work_on: null },
]
const SAVED = { last_work_date: '2026-02-11', lien_last_work_on: '2026-09-04', lien_last_work_note: 'went back for the valve', lien_last_work_set_at: '2026-11-13T20:00:00+00:00', lien_last_work_set_by: 'u1' }

describe('withJobLastWork — a saved last day reaches the list already on screen', () => {
  it('puts the fresh facts on the one job, and leaves every other job the same object', () => {
    const before = jobs()
    const after = withJobLastWork(before, 'j226', SAVED)
    expect(after).not.toBe(before)
    expect(after[0]).toEqual({ id: 'j226', job_name: 'Dudley Mason', ...SAVED })
    expect(after[1]).toBe(before[1])
    // The list it was given is not written on.
    expect(before[0]!.lien_last_work_on).toBeNull()
  })

  it('is the same array when nothing changed, so a page that holds the list does not draw again', () => {
    const before = jobs()
    const once = withJobLastWork(before, 'j226', SAVED)
    expect(withJobLastWork(once, 'j226', SAVED)).toBe(once)
    // A missing value, a null and an empty string are one value.
    expect(withJobLastWork(before, 'j226', { lien_last_work_on: null, lien_last_work_note: null, lien_last_work_set_at: null })).toBe(before)
    expect(withJobLastWork(before, 'j608', { lien_last_work_on: '', lien_last_work_note: '' })).toBe(before)
  })

  it('is the same array for a job the list does not hold, for no job and for no facts', () => {
    const before = jobs()
    expect(withJobLastWork(before, 'j999', SAVED)).toBe(before)
    expect(withJobLastWork(before, null, SAVED)).toBe(before)
    expect(withJobLastWork(before, 'j226', null)).toBe(before)
    expect(withJobLastWork([], 'j226', SAVED)).toEqual([])
  })

  it('a day cleared goes back to nothing: the four hand columns empty, the clock’s day kept', () => {
    const set = withJobLastWork(jobs(), 'j226', SAVED)
    const cleared = withJobLastWork(set, 'j226', { last_work_date: '2026-02-11', lien_last_work_on: null, lien_last_work_note: '', lien_last_work_set_at: null, lien_last_work_set_by: null })
    expect(cleared[0]).toMatchObject({ last_work_date: '2026-02-11', lien_last_work_on: null, lien_last_work_note: '', lien_last_work_set_at: null, lien_last_work_set_by: null })
  })

  it('only the columns a reader carries are written: a read of two leaves the other three as they were', () => {
    const set = withJobLastWork(jobs(), 'j226', SAVED)
    const after = withJobLastWork(set, 'j226', { last_work_date: '2026-02-11', lien_last_work_on: '2026-09-18' })
    expect(after[0]).toMatchObject({ lien_last_work_on: '2026-09-18', lien_last_work_note: 'went back for the valve', lien_last_work_set_by: 'u1' })
    // An undefined column is a column the reader did not carry, never a clear.
    expect(withJobLastWork(set, 'j226', { lien_last_work_on: undefined })).toBe(set)
  })

  it('the row behind the window moves: a February job read Lien gone, and with the day set in September it has a date ahead', () => {
    const clock = (j: Job) => buildLienPayRunway({ todayYmd: '2026-11-13', openBalance: 650, lastWorkYmd: j.last_work_date, handLastWorkYmd: j.lien_last_work_on, propertyKind: 'non_residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null, isSub: false })
    const before = jobs()
    expect(clock(before[0]!).state).toBe('closed')
    const after = withJobLastWork(before, 'j226', SAVED)
    expect(clock(after[0]!)).toMatchObject({ state: 'no_pay', lienByYmd: '2027-01-15', datedByHand: true })
  })
})

describe('withJobsLastWork — a fresh copy of several jobs at once', () => {
  it('patches each job the list holds, passes over the rest, and keeps the array when none changed', () => {
    const before = jobs()
    const after = withJobsLastWork(before, [
      { id: 'j608', last_work_date: '2026-04-02', lien_last_work_on: '2026-05-01' },
      { id: 'j226', last_work_date: '2026-02-11', lien_last_work_on: null },
      { id: 'elsewhere', lien_last_work_on: '2026-01-01' },
    ])
    expect(after[0]).toBe(before[0])
    expect(after[1]).toMatchObject({ id: 'j608', lien_last_work_on: '2026-05-01' })
    expect(withJobsLastWork(after, [{ id: 'j608', last_work_date: '2026-04-02', lien_last_work_on: '2026-05-01' }])).toBe(after)
    expect(withJobsLastWork(before, [])).toBe(before)
    expect(withJobsLastWork(before, null)).toBe(before)
  })
})
