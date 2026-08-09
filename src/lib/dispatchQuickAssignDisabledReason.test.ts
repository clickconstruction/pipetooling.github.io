import { describe, expect, it } from 'vitest'
import { quickAssignDisabledReason } from './dispatchQuickAssignDisabledReason'

const base = { hasJob: true, peopleCount: 2, hasWindow: true, saving: false }

describe('quickAssignDisabledReason', () => {
  it('returns null when everything needed is present', () => {
    expect(quickAssignDisabledReason(base)).toBeNull()
  })

  it('explains an in-flight save first', () => {
    expect(quickAssignDisabledReason({ ...base, saving: true, peopleCount: 0 })).toBe('Hang on — still scheduling.')
  })

  it('points at the job picker when no job is set', () => {
    expect(quickAssignDisabledReason({ ...base, hasJob: false, peopleCount: 0, hasWindow: false })).toBe(
      'Pick a job first — tap Change job.',
    )
  })

  it('names the missing piece: people, window, or both', () => {
    expect(quickAssignDisabledReason({ ...base, peopleCount: 0, hasWindow: false })).toBe(
      'Pick at least one person, then choose a time window.',
    )
    expect(quickAssignDisabledReason({ ...base, peopleCount: 0 })).toBe('Pick at least one person for this crew.')
    expect(quickAssignDisabledReason({ ...base, hasWindow: false })).toBe(
      'Choose a time window — tap a suggested window or set a Custom time.',
    )
  })
})
