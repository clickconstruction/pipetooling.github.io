// @vitest-environment jsdom
// (localStorage-backed persistence helpers; the global vitest environment is node)
import { beforeEach, describe, expect, it } from 'vitest'
import { loadStagesSortMode, saveStagesSortMode, stagesAddedStampLabel } from './jobsStagesSortMode'

describe('sort mode persistence', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to number and round-trips added', () => {
    expect(loadStagesSortMode()).toBe('number')
    saveStagesSortMode('added')
    expect(loadStagesSortMode()).toBe('added')
  })

  it('saving number clears the key; malformed values degrade to number', () => {
    saveStagesSortMode('added')
    saveStagesSortMode('number')
    expect(localStorage.getItem('pipetooling_pipeline_sort_v1')).toBeNull()
    localStorage.setItem('pipetooling_pipeline_sort_v1', 'garbage')
    expect(loadStagesSortMode()).toBe('number')
  })
})

describe('stagesAddedStampLabel', () => {
  it('formats the company-calendar day', () => {
    expect(stagesAddedStampLabel('2026-08-18T15:00:00Z')).toBe('added Aug 18')
  })

  it('null/garbage in, null out', () => {
    expect(stagesAddedStampLabel(null)).toBeNull()
    expect(stagesAddedStampLabel('not-a-date')).toBeNull()
  })
})
