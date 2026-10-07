// @vitest-environment jsdom
/**
 * Render smoke for the tour's round five (`to-dos/gc-mode/mockups/tour-round-five.md`): every stop
 * of Walk me through this job that names a tab has its anchor on that tab, drawn for a job at a
 * stage the stop belongs to and a day that shows its door, with the controls the stop names inside
 * the anchor as the screen prints them. The trade's stop has its anchor in the trade's portal.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { GcBuildingLogTab } from './GcBuildingLog'
import { GcTradePortal } from './GcTradePortal'
import { GC_PROJECT_TOUR_STEPS } from '../../lib/gcMode/gcTour'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { addDays } from '../../lib/gcMode/gcBuilding'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'
import type { GcState, ScheduleMoveReason } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
  }
})

const job = (s: GcState, id: string) => s.projects.find((p) => p.id === id)!

function moveBy(s: GcState, label: string, days: number, reason: ScheduleMoveReason, note: string): GcState {
  const a = scheduleMeasures(s, job(s, 'fairoaksd')).items.find((i) => i.label === label)!.activity
  return gcReducer(s, { type: 'setScheduleActivity', projectId: 'fairoaksd', lineId: a.lineId, start: addDays(a.start, days), finish: addDays(a.finish, days), after: a.after, why: { reason, note, by: 'Robert' } })
}

/** The made-up data as it starts: Fair Oaks D building on Fri Oct 2, Boerne bidding. */
const madeUp = () => initialGcState()

/** G-98's late job at $500 a day, Trim's move the customer's: Days back and Ask for the days show (as `GcAskForDays.render.test.tsx`). */
function late(): GcState {
  const s = gcReducer(initialGcState(), { type: 'setOwnerLateFinish', projectId: 'fairoaksd', perDay: 500 })
  return moveBy(moveBy(s, 'Trim', 7, 'customer', 'Waiting on the restroom tile decision.'), 'Test and balance', 9, 'weather', 'Rain kept the roof open a week.')
}

/** A hired trade's move nobody has told it about yet: Tell the trades shows under the chart. (Trim is our own crew's: nobody to tell.) */
const moved = () => moveBy(initialGcState(), 'Fire alarm', 2, 'crew', 'Pecan Valley starts the fire alarm two days later.')

/** Helotes started, with our plumbers on the log before any bar of theirs runs: the log against the chart shows (as `GcLogVsChart.render.test.tsx`). */
function mismatch(): GcState {
  let s = gcReducer(initialGcState(), { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-05' })
  s = gcReducer(s, { type: 'startProject', projectId: 'helotes', anyway: { reason: 'The slab before the rain', by: 'Robert' } })
  return gcReducer(s, { type: 'saveDailyLog', projectId: 'helotes', log: { date: '2026-10-02', sky: 'clear', high: 84, low: 63, weatherStop: false, crews: [{ packageId: 'dplumb', workers: 3 }], done: '', delays: [], visitors: '' } })
}

/** Each stop that names a tab, by title: a job and a day that show its door, and the controls it names that sit inside its anchor. */
const CASES: Record<string, { job: string; state: () => GcState; inside: string[] }> = {
  'A rough schedule while we bid': { job: 'boerne', state: madeUp, inside: ['Draw a rough schedule'] },
  'The chart': { job: 'fairoaksd', state: madeUp, inside: ['Days', 'Weeks', 'Months'] },
  'Bars held up, and bars not covered': { job: 'fairoaksd', state: madeUp, inside: [] },
  'A call list from the chart': { job: 'fairoaksd', state: madeUp, inside: ['By company'] },
  'Spare days and people on site': { job: 'fairoaksd', state: madeUp, inside: ['Show spare days', 'Show people on site'] },
  'Print it or send the file': { job: 'fairoaksd', state: madeUp, inside: ['Print or PDF', 'Export'] },
  'Try moves on a copy': { job: 'fairoaksd', state: madeUp, inside: ['What if…'] },
  'Update the week': { job: 'fairoaksd', state: madeUp, inside: ['Update the week'] },
  'Tell the trades': { job: 'fairoaksd', state: moved, inside: ['Tell the trades'] },
  'Where the work is': { job: 'fairoaksd', state: madeUp, inside: ['Look at the places'] },
  'A job running late': { job: 'fairoaksd', state: late, inside: ['Days back', 'Look at it'] },
  'Their dates to meet': { job: 'fairoaksd', state: madeUp, inside: ['Bring in their dates…'] },
  'Save the job as a template': { job: 'fairoaksd', state: madeUp, inside: ['Save as a template'] },
  'Who should be on site': { job: 'fairoaksd', state: madeUp, inside: ['Who should be on site'] },
  'The log against the chart': { job: 'helotes', state: mismatch, inside: ['It started'] },
}

describe('Walk me through this job: each stop’s anchor is on the tab it names', () => {
  const withTab = GC_PROJECT_TOUR_STEPS.filter((s) => s.tab)

  it('every stop that names a tab has a day here that shows it', () => {
    expect(withTab.map((s) => s.title).filter((t) => !CASES[t])).toEqual([])
  })

  for (const stop of withTab) {
    it(`${stop.title}: ${stop.anchor} on the ${stop.tab} tab`, () => {
      const c = CASES[stop.title]!
      const state = c.state()
      const project = job(state, c.job)
      // The day is one the stop belongs to, so the walk would bring this job there.
      expect(stop.stages).toContain(project.stage)
      const Tab = stop.tab === 'log' ? GcBuildingLogTab : GcBuildingScheduleTab
      const { container } = render(<Tab state={state} project={project} dispatch={vi.fn()} />)
      const anchor = container.querySelector(`[data-tour="${stop.anchor}"]`)
      expect(anchor, stop.anchor).toBeTruthy()
      // What the stop marks beside it is on the same tab.
      for (const m of stop.marks ?? []) expect(container.querySelector(`[data-tour="${m.anchor}"]`), m.anchor).toBeTruthy()
      // The control's exact name: on the screen inside the anchor, and in the stop's words.
      for (const words of c.inside) {
        expect(anchor?.textContent, `${words} on the screen`).toContain(words)
        expect(stop.body, `${words} in the stop`).toContain(words)
      }
    })
  }

  it('the held bar and the bar at work without insurance are Pecan Valley’s, as their notes say', () => {
    const state = madeUp()
    const { container } = render(<GcBuildingScheduleTab state={state} project={job(state, 'fairoaksd')} dispatch={vi.fn()} />)
    const held = container.querySelector('[data-tour="gc-held-bar"]')
    const bare = container.querySelector('[data-tour="gc-uninsured-bar"]')
    expect(held?.textContent).toMatch(/waits on/)
    expect(bare?.textContent).toMatch(/insurance ran out Sep 15/)
    // One of each.
    expect(container.querySelectorAll('[data-tour="gc-held-bar"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-tour="gc-uninsured-bar"]')).toHaveLength(1)
    // The first of each down the chart, so the stop lights the one nearest the top. Each bar's own
    // button says its name, company, dates and standing.
    const bars = [...container.querySelectorAll('button[aria-label]')]
    const heldBars = bars.filter((e) => /\. held\.$/.test(e.getAttribute('aria-label') ?? ''))
    expect(heldBars.length).toBeGreaterThan(1)
    expect(held?.contains(heldBars[0]!)).toBe(true)
    // Pecan Valley is at work on Panels and feeders, then Lighting, its insurance run out: the first is lit.
    const atWork = bars.filter((e) => /^(Panels and feeders|Lighting), Pecan Valley Electric\./.test(e.getAttribute('aria-label') ?? ''))
    expect(atWork).toHaveLength(2)
    expect(bare?.contains(atWork[0]!)).toBe(true)
    expect(atWork[0]?.getAttribute('aria-label')).toMatch(/^Panels and feeders,/)
  })

  it('the trade’s own dates: Your jobs in the trade’s portal, its door to We will be late and People a day on site', () => {
    const stop = GC_PROJECT_TOUR_STEPS.find((s) => s.title === 'The trade’s own dates')!
    const state = madeUp()
    render(<GcTradePortal state={state} project={job(state, 'fairoaksd')} partnerId="summit" onPickPartner={() => {}} dispatch={vi.fn()} />)
    const anchor = document.querySelector(`[data-tour="${stop.anchor}"]`)
    expect(anchor?.textContent).toContain('Your jobs')
    expect(anchor?.textContent).toContain('Fair Oaks Shops, Building D')
    expect(stop.stages).toEqual(['building'])
  })
})
