/**
 * The tests of `gcRoughSchedule.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1b). The data is `testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { scheduleDraft } from './draft'
import { initialGcState } from './testState'

/** Every fixture job's first draft from one day, as `scheduleDraft` drew it before G-45 gave it the optional stage days. */
function draws(days?: Record<string, number>) {
  const state = initialGcState()
  return state.projects.map((p) => {
    const s = days === undefined ? scheduleDraft(p, '2026-11-02') : scheduleDraft(p, '2026-11-02', days)
    return {
      job: p.name,
      activities: s.activities.map((a) => `${a.lineId} ${a.start} ${a.finish} after ${a.after.join(',')}${a.inspection ? ` (${a.inspection.label})` : ''}`),
      milestones: s.milestones.map((m) => `${m.label} ${m.planned}`),
    }
  })
}

describe('the first draft is unchanged for every caller that passes no stage days (G-45)', () => {
  it('draws every fixture job exactly as it drew before the optional argument', () => {
    expect(draws()).toMatchSnapshot()
  })
})
