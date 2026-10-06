import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { gcStaleSchedulesNeedsYou, staleSchedules } from './gcStaleSchedules'
import { stageProgress } from './gcProgress'

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

  it('goes quiet once the schedule is walked', () => {
    const state = gcReducer(initialGcState(), { type: 'recordScheduleWalk', projectId: 'fairoaksd', by: 'Robert', kept: ['froof-1'], moveIds: [], skipped: 0 })
    expect(gcStaleSchedulesNeedsYou(state)).toBeNull()
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    expect(stageProgress(state, project).also.some((l) => l.includes('Update the week'))).toBe(false)
  })
})
