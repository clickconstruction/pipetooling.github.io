import { describe, expect, it } from 'vitest'
import { canSeeRoadmapTab } from './roadmapVisibility'

describe('canSeeRoadmapTab', () => {
  it('is dev-only and off under Farm Mode (mirrors the Checklist tab gate)', () => {
    expect(canSeeRoadmapTab('dev', false)).toBe(true)
    expect(canSeeRoadmapTab('dev', true)).toBe(false)
    expect(canSeeRoadmapTab('master_technician', false)).toBe(false)
    expect(canSeeRoadmapTab('primary', false)).toBe(false)
    expect(canSeeRoadmapTab(null, false)).toBe(false)
  })
})
