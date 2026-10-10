/**
 * The test of `gcStaleSchedules.test.ts` on branch spike/gc-mode that reads the ring's card, moved word for word (the Board's
 * B2b-vi). The data is `schedule/testState.ts`.
 */
import { describe, expect, it } from 'vitest'
import { stageProgress } from './progress'
import { gcStaleSchedulesNeedsYou, staleSchedules } from './schedule/staleSchedules'
import { initialGcState } from './schedule/testState'

/** Fair Oaks Shops, Building D is being built and has never been walked. */
describe('a stale schedule says so on the dashboard and the ring card (G-59)', () => {
  it('lists the jobs being built whose schedule nobody walked this week', () => {
    const state = initialGcState()
    expect(staleSchedules(state).map((s) => [s.project.id, s.days])).toEqual([['fairoaksd', null]])
    expect(gcStaleSchedulesNeedsYou(state)).toEqual({
      count: 1,
      late: true,
      title: '1 schedule not walked this week in GC mode',
      detail: 'Fair Oaks Shops, Building D: Not walked yet. Nobody has checked these dates against the job.',
      projectId: 'fairoaksd',
    })
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    const also = stageProgress(state, project).also
    // After the schedule's line and the failed inspection, which lead the card.
    expect(also[2]).toBe('Not walked yet. Nobody has checked these dates against the job. Open the Schedule tab and tap Update the week.')
    expect(also[1]).toMatch(/^The electrical service inspection failed/)
  })
})
