/**
 * The tests of `gcPortalSchedule.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1b). The data is `testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { daysBetween } from './schedule'
import { rowsDraft, templateRows } from './builder'
import { portalDates, portalPhases, portalSchedule, portalScheduleX } from './portalSchedule'
import { initialGcState } from './testState'
import { QUICK_LUBE_PHASES, quickLubeTemplate } from './testTemplate'

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

  it('carries the job’s phases with their dates and the dates to meet when the schedule was drawn from phases (#204 PR 6), and nothing of another company’s bars', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    const drawn = rowsDraft(project, '2026-11-02', templateRows(quickLubeTemplate()))
    const job = { ...project, schedule: drawn }
    const summit = state.partners.find((p) => p.company === 'Summit Roofing')!
    const s = portalSchedule(state, summit.id, job)!
    expect(s.phases?.map((p) => p.name)).toEqual(QUICK_LUBE_PHASES.map((p) => p.name))
    for (const p of s.phases ?? []) {
      expect(p.start <= p.finish).toBe(true)
      expect(p.days).toBe(daysBetween(p.start, p.finish) + 1)
    }
    expect(s.phases?.[0]).toMatchObject({ name: 'Preconstruction and procurement', start: '2026-11-02' })
    expect(s.dates?.map((d) => d.label)).toEqual([...drawn.milestones].sort((a, b) => a.planned.localeCompare(b.planned) || a.label.localeCompare(b.label)).map((m) => m.label))
    expect(s.dates?.every((d) => !d.met)).toBe(true)
    expect(JSON.stringify(s.phases) + JSON.stringify(s.dates)).not.toMatch(/company|amount|\$|lineId/)
    expect(portalPhases(job)).toEqual(s.phases)
    expect(portalDates(job)).toEqual(s.dates)
  })

  it('has no phases on a schedule drawn without them, and lists its dates to meet', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    const summit = state.partners.find((p) => p.company === 'Summit Roofing')!
    const s = portalSchedule(state, summit.id, project)!
    expect(s.phases).toBeUndefined()
    expect(portalPhases(project)).toEqual([])
    expect(s.dates?.length).toBe(project.schedule!.milestones.length)
    expect(s.dates?.some((d) => d.met)).toBe(project.schedule!.milestones.some((m) => m.metOn !== null))
  })

  it('is nothing for a company with no work on the job', () => {
    const state = initialGcState()
    const project = state.projects.find((p) => p.id === 'fairoaksd')!
    const stranger = state.partners.find((p) => p.company === 'Hillside Excavation')!
    expect(portalSchedule(state, stranger.id, project)).toBeNull()
  })
})
