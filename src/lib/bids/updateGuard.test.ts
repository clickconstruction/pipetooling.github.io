import { describe, expect, it } from 'vitest'
import { updateApplied } from './updateGuard'

describe('updateApplied', () => {
  it('true when the update returned rows', () => {
    expect(updateApplied([{ id: 'a' }])).toBe(true)
    expect(updateApplied([{ id: 'a' }, { id: 'b' }])).toBe(true)
  })

  it('false on the RLS silent no-op shape: success with zero rows', () => {
    expect(updateApplied([])).toBe(false)
  })

  it('false on null/undefined data', () => {
    expect(updateApplied(null)).toBe(false)
    expect(updateApplied(undefined)).toBe(false)
  })
})
