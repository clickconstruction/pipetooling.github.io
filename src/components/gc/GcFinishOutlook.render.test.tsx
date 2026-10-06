// @vitest-environment jsdom
/**
 * Render smoke for the projected finish with weather and crews (the Gantt's G-57; mock-up
 * `to-dos/gc-mode/mockups/G-57.md`): the ruled block at the foot of the Projected finish measure,
 * on the fixture and with a short crew, the paper without it, ours and the customer's, and the
 * short crew's line on the call list (pick 2).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { GcCallList } from './GcCallList'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { callList } from '../../lib/gcMode/gcCallList'
import { chartHolds } from '../../lib/gcMode/gcChartHolds'
import type { GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
  }
})

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const block = () => document.querySelector('[data-tour="gc-finish-outlook"]')
const lines = () => [...(block()?.children ?? [])].map((el) => el.textContent ?? '')

/** Today's log with Cool Breeze Mechanical at 1 against its 3 so far, the other trades at theirs. */
function shortHvac(): GcState {
  const s = initialGcState()
  const crews = Object.entries({ fsteel: 4, froof: 5, felec: 3, fplumb: 3, fhvac: 1 }).map(([packageId, workers]) => ({ packageId, workers }))
  return gcReducer(s, { type: 'saveDailyLog', projectId: ID, log: { date: s.today, sky: 'clear', high: 78, low: 61, weatherStop: false, crews, done: 'Work went on.', delays: [], visitors: '' } })
}

describe('the projected finish with weather and crews (G-57)', () => {
  it('is a ruled block at the foot of the Projected finish measure, after its own words', () => {
    const s = initialGcState()
    render(<GcBuildingScheduleTab state={s} project={job(s)} dispatch={vi.fn()} />)
    expect(lines()).toEqual([
      'With weather and crews: Fri Dec 11, the same day.',
      'Weather adds no days. Our rule, 2 a month on roofing and electrical, fits inside their spare days.',
      'Crews add no days. Three trades have fewer on site than so far, and their spare days cover it.',
    ])
    const measure = block()?.parentElement?.parentElement?.textContent ?? ''
    expect(measure.startsWith('Projected finish')).toBe(true)
    expect(measure.indexOf('At that pace it finishes Fri Dec 11.')).toBeGreaterThan(-1)
    expect(measure.indexOf('At that pace it finishes Fri Dec 11.')).toBeLessThan(measure.indexOf('With weather and crews'))
  })

  it('says the days a short crew adds, and the paper leaves it off, ours and the customer’s', () => {
    const s = shortHvac()
    render(<GcBuildingScheduleTab state={s} project={job(s)} dispatch={vi.fn()} />)
    expect(lines()).toEqual([
      'With weather and crews: Thu Dec 31, 20 days later.',
      'Weather adds 1 day: our rule, 2 a month, on the work left of roofing and electrical.',
      'Crews add 19 days: Cool Breeze Mechanical has 1 on site against 3 so far.',
    ])
    const toolbar = document.querySelector('[data-tour="gc-gantt-toolbar"]') as HTMLElement
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Print or PDF' }))
    const dialog = () => screen.getByRole('dialog', { name: 'Print the chart' })
    const framed = () => dialog().querySelector('iframe')?.getAttribute('srcdoc') ?? ''
    expect(framed()).toContain('Fair Oaks Shops, Building D')
    expect(framed()).not.toContain('weather and crews')
    fireEvent.click(within(dialog()).getByRole('button', { name: 'The customer' }))
    expect(framed()).not.toContain('weather and crews')
  })

  it('puts the short crew on the call list under its company, with the same days', () => {
    const s = shortHvac()
    render(<GcCallList list={callList(s, job(s), chartHolds(s, job(s)))} onFollowUp={vi.fn()} onWorkList={vi.fn()} onReason={vi.fn()} />)
    expect(screen.getByText('They have 1 on site this week against 3 so far. At that, the job finishes 19 days later, Wed Dec 30.')).toBeTruthy()
    expect(screen.getByText('Cool Breeze Mechanical')).toBeTruthy()
  })
})
