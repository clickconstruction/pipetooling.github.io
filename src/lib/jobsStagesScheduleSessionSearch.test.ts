import { describe, expect, it } from 'vitest'
import {
  shouldFetchStagesScheduleSessionSearch,
  STAGES_SCHEDULE_SESSION_SEARCH_MIN_CHARS,
} from './jobsStagesScheduleSessionSearch'

describe('shouldFetchStagesScheduleSessionSearch', () => {
  it('returns false when preference is off', () => {
    expect(shouldFetchStagesScheduleSessionSearch(false, 'ab')).toBe(false)
    expect(shouldFetchStagesScheduleSessionSearch(false, 'abc')).toBe(false)
  })

  it('returns false when query is shorter than min chars', () => {
    expect(shouldFetchStagesScheduleSessionSearch(true, '')).toBe(false)
    expect(shouldFetchStagesScheduleSessionSearch(true, 'a')).toBe(false)
    expect(shouldFetchStagesScheduleSessionSearch(true, ' '.repeat(20))).toBe(false)
  })

  it(`returns true when preference is on and length >= ${STAGES_SCHEDULE_SESSION_SEARCH_MIN_CHARS}`, () => {
    expect(shouldFetchStagesScheduleSessionSearch(true, 'ab')).toBe(true)
    expect(shouldFetchStagesScheduleSessionSearch(true, 'foo')).toBe(true)
  })
})
