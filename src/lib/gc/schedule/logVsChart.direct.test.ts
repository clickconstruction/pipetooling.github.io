/**
 * Main's own tests for the days a bar runs on (G-55; the schedule's PR 1b), the rule the log against
 * the chart, people on site and the morning list read, run through the kernels on the test data. On
 * Fair Oaks D, today Fri Oct 2, TPO membrane runs Sep 21 to Oct 9 at 50%.
 */
import { describe, expect, it } from 'vitest'
import type { GcState } from '../types'
import { runsOn } from './logVsChart'
import { scheduleItems } from './schedule'
import { initialGcState } from './testState'

const job = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!
const itemOf = (lineId: string) => {
  const s = initialGcState()
  return scheduleItems(s, job(s)).find((i) => i.activity.lineId === lineId)!
}

describe('the days a bar runs on', () => {
  it('runs inside its planned dates, and past its finish while it is not done', () => {
    const tpo = itemOf('froof-1')
    expect([tpo.activity.start, tpo.activity.finish, tpo.actual]).toEqual(['2026-09-21', '2026-10-09', 50])
    expect(runsOn(tpo, '2026-09-20')).toBe(false)
    expect(runsOn(tpo, '2026-10-02')).toBe(true)
    expect(runsOn(tpo, '2026-10-12')).toBe(true)
    const done = { ...tpo, actual: 100 }
    expect(runsOn(done, '2026-10-09')).toBe(true)
    expect(runsOn(done, '2026-10-12')).toBe(false)
  })

  it('runs inside its real dates when they differ from the plan', () => {
    const tpo = itemOf('froof-1')
    const early = { ...tpo, actual: 100, activity: { ...tpo.activity, actualStart: '2026-09-17', actualFinish: '2026-10-05' } }
    expect(runsOn(early, '2026-09-18')).toBe(true)
    expect(runsOn(early, '2026-09-16')).toBe(false)
    const startedEarly = { ...tpo, activity: { ...tpo.activity, actualStart: '2026-09-17' } }
    expect(runsOn(startedEarly, '2026-09-18')).toBe(true)
  })
})
