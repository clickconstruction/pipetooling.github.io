import { describe, expect, it } from 'vitest'
import { finishAfterWorkingDays, jobPlannedOf, jobPlannedWords, plannedFinishOptions, plannedFinishPayload, plannedFinishPick, plannedFinishPressWords, workingDaysFor, type PlannedFinishInput } from './plannedFinish'

const base: PlannedFinishInput = { rough: null, bidStartYmd: '2026-10-06', todayYmd: '2026-11-07', hours: 480, typedFinishYmd: null }

describe('plannedFinish (punch list #234 PR 2)', () => {
  it('counts working days at the crew day and lands the finish past the weekends', () => {
    expect(workingDaysFor(480)).toBe(20)
    expect(workingDaysFor(1)).toBe(1)
    expect(workingDaysFor(0)).toBe(0)
    expect(workingDaysFor(30, 24)).toBe(2)
    // Tue Oct 6 2026 counts as day one; 20 working days end Mon Nov 2.
    expect(finishAfterWorkingDays('2026-10-06', 20)).toBe('2026-11-02')
    expect(finishAfterWorkingDays('2026-10-06', 1)).toBe('2026-10-06')
    // Friday plus one day is Monday.
    expect(finishAfterWorkingDays('2026-10-09', 2)).toBe('2026-10-12')
  })
  it('the rough schedule is the pick when kept, the hours stand in else, the typed day last', () => {
    const o = plannedFinishOptions({ ...base, rough: { start: '2026-09-28', finish: '2026-11-14', weeks: 7, keptAt: 'bid', keptOn: '2026-09-20' } })
    expect(o[0]).toMatchObject({ source: 'rough', usable: true, finishYmd: '2026-11-14', head: 'Nov 14 · from the rough schedule' })
    expect(o[0]!.why).toBe("7 weeks from Sep 28, kept when the bid went in on Sep 20. The GC's own plan. This is the one the days read against.")
    expect(o[1]).toMatchObject({ source: 'assumed', usable: true, startYmd: '2026-10-06', finishYmd: '2026-11-02', head: 'Nov 2 · assumed from the hours' })
    expect(o[1]!.why).toBe('480 h at 24 crew hours a day is 20 working days from Oct 6, the start the bid assumed. A guess, read as one.')
    expect(plannedFinishPick(o)).toBe('rough')
    expect(plannedFinishPressWords(o, 'rough')).toBe('planned finish Nov 14 from the rough schedule')
    expect(plannedFinishPayload({ ...base, rough: { start: '2026-09-28', finish: '2026-11-14', weeks: 7, keptAt: 'bid', keptOn: '2026-09-20' } }, o, 'rough')).toEqual({ source: 'rough', start: '2026-09-28', finish: '2026-11-14', detail: { weeks: 7, kept_at: 'bid', kept_on: '2026-09-20' } })
  })
  it('no rough: the hours from the award day when the bid assumed no start; no hours: only a typed day', () => {
    const o = plannedFinishOptions({ ...base, bidStartYmd: null })
    expect(o[0]).toMatchObject({ usable: false, why: 'No GC project with a kept rough schedule behind this job.' })
    expect(o[1]).toMatchObject({ usable: true, startYmd: '2026-11-07' })
    expect(o[1]!.why).toContain('from Nov 7, the day of the award')
    expect(plannedFinishPick(o)).toBe('assumed')
    expect(plannedFinishPressWords(o, 'assumed')).toMatch(/^planned finish Dec \d+, assumed$/)
    expect(plannedFinishPayload({ ...base, bidStartYmd: null }, o, 'assumed')).toMatchObject({ source: 'assumed', start: '2026-11-07', detail: { hours: 480, crew_hours_per_day: 24, working_days: 20, start_from: 'award' } })
    const none = plannedFinishOptions({ ...base, hours: null })
    expect(none[1]).toMatchObject({ usable: false, why: 'Needs an hours baseline to count the days from.' })
    expect(plannedFinishPick(none)).toBe('typed')
    expect(plannedFinishPressWords(none, 'typed')).toBe('no planned finish yet')
    expect(plannedFinishPayload(base, none, 'typed')).toBeNull()
    const typed = plannedFinishOptions({ ...base, hours: null, typedFinishYmd: '2026-12-15' })
    expect(typed[2]).toMatchObject({ usable: true, finishYmd: '2026-12-15', head: 'Dec 15 · typed' })
    expect(plannedFinishPressWords(typed, 'typed')).toBe('planned finish Dec 15, typed')
  })
  it('reads the frozen plan off the row and words it', () => {
    expect(jobPlannedOf({ planned_finish: '2026-11-14', planned_source: 'rough', planned_start: '2026-09-28', planned_detail: { weeks: 7, kept_at: 'bid' } })).toMatchObject({ finishYmd: '2026-11-14', source: 'rough', startYmd: '2026-09-28' })
    expect(jobPlannedWords(jobPlannedOf({ planned_finish: '2026-11-14', planned_source: 'rough', planned_detail: { weeks: 7, kept_at: 'bid' } })!)).toBe('planned finish Nov 14 from the rough schedule (7 weeks kept at bid)')
    expect(jobPlannedWords(jobPlannedOf({ planned_finish: '2026-11-02', planned_source: 'assumed', planned_detail: { working_days: 20, crew_hours_per_day: 24 } })!)).toBe('planned finish Nov 2, assumed (20 working days at 24 h a day)')
    expect(jobPlannedWords(jobPlannedOf({ planned_finish: '2026-12-15', planned_source: 'typed' })!)).toBe('planned finish Dec 15, typed')
    expect(jobPlannedOf({ planned_finish: null, planned_source: 'typed' })).toBeNull()
    expect(jobPlannedOf({ planned_finish: '2026-12-15', planned_source: 'guess' })).toBeNull()
    expect(jobPlannedOf(null)).toBeNull()
  })
})
