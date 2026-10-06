import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { portalSchedule, portalScheduleX } from './gcPortalSchedule'

describe("a company's own chart in its portal", () => {
  it('shows its bars, what they wait on and what waits on them, with no prices', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    const summit = state.partners.find((p) => p.company === 'Summit Roofing')!
    const s = portalSchedule(state, summit.id, project)!
    expect(s.mine.map((b) => b.label)).toEqual(['Insulation', 'TPO membrane', 'Sheet metal and flashing', 'Roof curbs'])
    expect(s.mine.every((b) => b.mine)).toBe(true)
    expect(s.before.map((b) => b.label)).toContain('Joists and deck')
    expect(s.before.every((b) => !b.mine && b.company !== 'Summit Roofing')).toBe(true)
    expect(s.after.map((b) => b.label)).toContain('Rooftop units')
    expect(JSON.stringify(s)).not.toMatch(/amount|worth|\$/)
    expect(s.first <= s.mine[0]!.start).toBe(true)
    expect(portalScheduleX(s, s.first)).toBe(0)
    expect(portalScheduleX(s, s.last)).toBeLessThanOrEqual(100)
  })

  it('is nothing for a company with no work on the job', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    const stranger = state.partners.find((p) => p.company === 'Hillside Excavation')!
    expect(portalSchedule(state, stranger.id, project)).toBeNull()
  })
})
