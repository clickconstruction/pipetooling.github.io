import { describe, expect, it } from 'vitest'
import {
  parseStagesIncludeScheduleTimePref,
  scheduleClockSearchRpcJobIdSet,
  shouldFetchStagesScheduleSessionSearch,
  STAGES_SCHEDULE_SESSION_SEARCH_MIN_CHARS,
} from './jobsStagesScheduleSessionSearch'

describe('scheduleClockSearchRpcJobIdSet', () => {
  it('maps a uuid[] payload to a set', () => {
    expect(scheduleClockSearchRpcJobIdSet(['a', 'b', 'a'])).toEqual(new Set(['a', 'b']))
    expect(scheduleClockSearchRpcJobIdSet([])).toEqual(new Set())
  })

  it('returns null for non-array payloads so the caller falls back to the client-side path', () => {
    expect(scheduleClockSearchRpcJobIdSet(null)).toBeNull()
    expect(scheduleClockSearchRpcJobIdSet(undefined)).toBeNull()
    expect(scheduleClockSearchRpcJobIdSet('a')).toBeNull()
    expect(scheduleClockSearchRpcJobIdSet({ ids: ['a'] })).toBeNull()
  })

  it('drops non-string entries', () => {
    expect(scheduleClockSearchRpcJobIdSet(['a', 1, null, 'b'])).toEqual(new Set(['a', 'b']))
  })
})

describe('parseStagesIncludeScheduleTimePref', () => {
  it('defaults OFF when no stored value (v2.1184 — schedule/clock search is opt-in)', () => {
    expect(parseStagesIncludeScheduleTimePref(null)).toBe(false)
  })

  it('honors an explicit opt-in', () => {
    expect(parseStagesIncludeScheduleTimePref('true')).toBe(true)
  })

  it('treats anything else as off', () => {
    expect(parseStagesIncludeScheduleTimePref('false')).toBe(false)
    expect(parseStagesIncludeScheduleTimePref('')).toBe(false)
    expect(parseStagesIncludeScheduleTimePref('TRUE')).toBe(false)
  })
})

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
