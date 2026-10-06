import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import type { GcState } from './gcTypes'
import { actualProblem, actualWords } from './gcActualDates'

const ID = 'fairoaksd'
const job = (state: GcState) => state.projects.find((p) => p.id === ID)!
const tpo = (state: GcState) => job(state).schedule!.activities.find((a) => a.lineId === 'froof-1')!

describe('actual start and finish (G-55)', () => {
  it('keeps the real days beside the planned ones, set one at a time', () => {
    let state = initialGcState()
    expect(actualWords(tpo(state))).toBeNull()
    state = gcReducer(state, { type: 'setActualDates', projectId: ID, lineId: 'froof-1', actualStart: '2026-09-23', by: 'Luis Ortega' })
    expect(tpo(state)).toMatchObject({ start: '2026-09-21', actualStart: '2026-09-23' })
    expect(tpo(state)).not.toHaveProperty('actualFinish')
    expect(actualWords(tpo(state))).toBe('Started Wed Sep 23, 2 days late; not finished.')
    expect(state.log[0]?.text).toBe('Roofing · TPO membrane on Fair Oaks Shops, Building D: started Wed Sep 23, by Luis Ortega.')
    state = gcReducer(state, { type: 'setActualDates', projectId: ID, lineId: 'froof-1', actualFinish: '2026-10-02', by: 'Luis Ortega' })
    expect(actualWords(tpo(state))).toBe('Sep 23 to Oct 2, 7 days before the planned finish.')
    state = gcReducer(state, { type: 'setActualDates', projectId: ID, lineId: 'froof-1', actualStart: null, actualFinish: null, by: 'Luis Ortega' })
    expect(actualWords(tpo(state))).toBeNull()
  })

  it('refuses a day after today, a finish before the start, or a finish with no start', () => {
    const state = initialGcState()
    expect(actualProblem('2026-10-03', undefined, state.today)).toBe('A start cannot be after today.')
    expect(actualProblem('2026-09-23', '2026-09-22', state.today)).toBe('It has to finish on or after it started.')
    expect(actualProblem(undefined, '2026-10-01', state.today)).toBe('Say when it started first.')
    expect(gcReducer(state, { type: 'setActualDates', projectId: ID, lineId: 'froof-1', actualFinish: '2026-10-01', by: 'Luis' })).toBe(state)
    expect(gcReducer(state, { type: 'setActualDates', projectId: ID, lineId: 'froof-1', actualStart: '2026-10-09', by: 'Luis' })).toBe(state)
  })
})
