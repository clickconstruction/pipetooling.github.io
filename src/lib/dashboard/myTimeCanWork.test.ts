import { describe, expect, it } from 'vitest'
import type { AvailableHoursAnswer } from '../people/utilization'
import { DEFAULT_WEEK } from '../people/weekAvailability'
import { canWorkFromAnswers, myTimeCanWorkWords } from './myTimeCanWork'

const answer = (over: Partial<AvailableHoursAnswer>): AvailableHoursAnswer => ({ user_id: 'u-1', hours_per_week: 38, days: null, effective_from: '2026-11-01', set_by: 'u-1', set_at: '2026-11-01T10:00:00Z', ...over })

describe('canWorkFromAnswers', () => {
  it('is null with no answer, and the line asks', () => {
    expect(canWorkFromAnswers([], '2026-11-25')).toBeNull()
    expect(myTimeCanWorkWords(null)).toEqual({ line: 'How many hours a week can you work?', press: 'Set hours' })
  })

  it('reads a typed number as it was typed', () => {
    const cw = canWorkFromAnswers([answer({})], '2026-11-25')
    expect(cw).toMatchObject({ hours: 38, source: 'answered', days: null, setBy: 'u-1' })
    expect(myTimeCanWorkWords(cw)).toEqual({ line: 'The office has your week as 38 h.', press: 'Change' })
  })

  it('adds a drawn week up, whatever number sits beside it', () => {
    expect(canWorkFromAnswers([answer({ hours_per_week: 12, days: DEFAULT_WEEK })], '2026-11-25')?.hours).toBe(40)
  })

  it('takes the newest answer in force today', () => {
    const cw = canWorkFromAnswers([answer({}), answer({ hours_per_week: 30, effective_from: '2026-11-22', set_at: '2026-11-20T10:00:00Z' }), answer({ hours_per_week: 20, effective_from: '2026-11-29' })], '2026-11-25')
    expect(cw?.hours).toBe(30)
  })
})
