/**
 * The tests of `gcStartReminders.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1b). The data is `testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { firstStartOf } from './startReminders'
import { initialGcState } from './testState'

/**
 * Fair Oaks Shops, Building D started Jul 1; Tri-County's sitework starts Mon Jul 6. The made-up job
 * is read at Oct 2 with its sitework long done, so the job is wound back: nothing reported, no daily log.
 */
const job = (today: string, wound = true) => {
  const fresh = initialGcState()
  const state = {
    ...fresh,
    today,
    projects: fresh.projects.map((p) =>
      p.id !== 'fairoaksd' || !wound
        ? p
        : { ...p, dailyLogs: [], packages: p.packages.map((k) => (k.id === 'fsite' && k.sow ? { ...k, sow: { ...k.sow, sov: k.sow.sov.map((l) => ({ ...l, pctReported: 0 })) } } : k)) },
    ),
  }
  return { state, project: state.projects.find((p) => p.id === 'fairoaksd')! }
}

describe('start reminders (G-114)', () => {
  it('knows a company’s first day on the job', () => {
    const { project } = job('2026-06-25')
    expect(firstStartOf(project, project.packages.find((k) => k.id === 'fsite')!)).toBe('2026-07-06')
  })
})
