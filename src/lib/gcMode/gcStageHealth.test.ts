import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { stageHealth } from './gcStageHealth'
import type { GcState } from './gcTypes'

const project = (state: GcState, id: string) => {
  const p = state.projects.find((x) => x.id === id)
  if (!p) throw new Error(`no project ${id}`)
  return p
}

describe('how the stage is going: bidding', () => {
  it('says nothing for a bid we lost', () => {
    const state = gcReducer(initialGcState(), { type: 'markLost', projectId: 'boerne', why: 'price', wonBy: null, note: '' })
    expect(stageHealth(state, project(state, 'boerne'))).toBeNull()
  })
})

describe('how the stage is going: buying out', () => {
  it('is behind when the start is a week off and a trade is not ready', () => {
    const state = gcReducer(initialGcState(), { type: 'setStartDate', projectId: 'helotes', date: '2026-10-06' })
    const h = stageHealth(state, project(state, 'helotes'))
    expect(h?.verdict).toBe('behind')
    expect(h?.why).toBe('Start in 4 days and 3 of 5 trades are not ready.')
    expect(h?.askStartDate).toBe(false)
    const start = h?.calendar.weeks.flat().find((d) => d.on === '2026-10-06')
    expect(start?.deadline).toBe('due')
    expect(h?.calendar.summary[0]).toMatchObject({ value: '3', label: 'working days to the start' })
  })
})
