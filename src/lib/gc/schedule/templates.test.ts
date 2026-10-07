/**
 * The tests of `gcScheduleTemplates.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1b). The data is `testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { scheduleDraft } from './draft'
import { scheduleLinesOf } from './schedule'
import { templateShape } from './templates'
import { initialGcState } from './testState'
import type { GcProject, GcState } from '../types'

const job = (s: GcState, id: string) => s.projects.find((p) => p.id === id)!

const lineIdOf = (p: GcProject, trade: string, label: string) => scheduleLinesOf(p.packages.find((k) => k.trade === trade)!).find((l) => l.label === label)!.lineId

describe('saving a job’s shape (G-44)', () => {
  it('keeps a gap the office set on a wait, and the draw sets it again', () => {
    const base = initialGcState()
    const fo = job(base, 'fairoaksd')
    const steel = lineIdOf(fo, 'Structural steel', 'Structural steel')
    const footings = lineIdOf(fo, 'Concrete', 'Foundations')
    // Seven days of cure after the foundations: steel still starts Aug 17, 9 days after they finished.
    const cured: GcState = { ...base, projects: base.projects.map((p) => (p.id === 'fairoaksd' && p.schedule ? { ...p, schedule: { ...p.schedule, activities: p.schedule.activities.map((a) => (a.lineId === steel ? { ...a, lag: { [footings]: 7 } } : a)) } } : p)) }
    const t = templateShape(cured, job(cured, 'fairoaksd'))
    expect(t?.lines.find((l) => l.label === 'Structural steel')).toMatchObject({ after: [{ trade: 'Concrete', label: 'Foundations', gap: 7 }], offset: 9 })
    const redrawn = scheduleDraft(job(cured, 'fairoaksd'), '2026-07-06', undefined, t?.lines)
    expect(redrawn.activities.find((a) => a.lineId === steel)).toMatchObject({ start: '2026-08-17', lag: { [footings]: 7 } })
  })
})

describe('the pin: a job redrawn from its own template lands on its own dates', () => {
  it('draws exactly today’s first draft with no template: the empty one changes nothing on any job', () => {
    // With neither optional argument the draw is G-45's, and its snapshot of every fixture job holds that (gcRoughSchedule.test.ts).
    const s = initialGcState()
    for (const p of s.projects) expect(scheduleDraft(p, '2026-10-12', undefined, [])).toEqual(scheduleDraft(p, '2026-10-12'))
  })
})
