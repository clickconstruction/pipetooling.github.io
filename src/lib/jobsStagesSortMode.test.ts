// @vitest-environment jsdom
// (localStorage-backed persistence helpers; the global vitest environment is node)
import { beforeEach, describe, expect, it } from 'vitest'
import { loadStagesSortMode, saveStagesSortMode, stagesAddedStampLabel, toggleStagesNextFirstSort, toggleStagesProgressSort } from './jobsStagesSortMode'

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

  it("'next' round-trips like added, and its toggle returns to the classic order (v2.3788)", () => {
    saveStagesSortMode('next')
    expect(loadStagesSortMode()).toBe('next')
    expect(toggleStagesNextFirstSort('number')).toBe('next')
    expect(toggleStagesNextFirstSort('progress')).toBe('next')
    expect(toggleStagesNextFirstSort('next')).toBe('number')
  })

  it("'progress' is session-only: never stored, never loaded, and leaves the remembered pick alone (v2.3408)", () => {
    saveStagesSortMode('progress')
    expect(localStorage.getItem('pipetooling_pipeline_sort_v1')).toBeNull()
    expect(loadStagesSortMode()).toBe('number')
    // A device that remembers time added keeps it through a progress look.
    saveStagesSortMode('added')
    saveStagesSortMode('progress')
    expect(loadStagesSortMode()).toBe('added')
    // Even a hand-planted value never comes back as progress.
    localStorage.setItem('pipetooling_pipeline_sort_v1', 'progress')
    expect(loadStagesSortMode()).toBe('number')
  })
})

describe('toggleStagesProgressSort', () => {
  it('turns progress on from either remembered order and back to classic from progress', () => {
    expect(toggleStagesProgressSort('number')).toBe('progress')
    expect(toggleStagesProgressSort('added')).toBe('progress')
    expect(toggleStagesProgressSort('progress')).toBe('number')
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
