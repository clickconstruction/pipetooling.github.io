// @vitest-environment jsdom
/**
 * Render smoke for how to get days back (the Gantt's G-82; mock-up `to-dos/gc-mode/mockups/G-82.md`):
 * the Days back card under the measures on a late job and its worth in the Projected finish
 * measure, the window a recovery is saved from, who has to agree on the Follow up sheet, and a
 * side-by-side wait read in words in the editor and on the chart.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { addDays } from '../../lib/gcMode/gcBuilding'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'
import { CREW_RULE } from '../../lib/gcMode/gcRecovery'
import type { GcState, ScheduleActivity, ScheduleMoveReason } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
  }
})

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!

function moveBy(s: GcState, label: string, days: number, reason: ScheduleMoveReason, note: string): GcState {
  const a = scheduleMeasures(s, job(s)).items.find((i) => i.label === label)!.activity
  return gcReducer(s, { type: 'setScheduleActivity', projectId: ID, lineId: a.lineId, start: addDays(a.start, days), finish: addDays(a.finish, days), after: a.after, why: { reason, note, by: 'Robert' } })
}

/** G-98's late job: Tue Dec 15, 4 days past the contract. */
function lateJob(): GcState {
  const s = moveBy(initialGcState(), 'Trim', 7, 'customer', 'Waiting on the restroom tile decision.')
  return moveBy(s, 'Test and balance', 9, 'weather', 'Rain kept the roof open a week.')
}

/** Sheet metal and flashing, then Controls, then Trim, nothing else on the schedule: 7 days past the contract. */
function chain(): GcState {
  const s = initialGcState()
  const keep = new Map(job(s).schedule!.activities.map((a) => [a.lineId, a]))
  const line = (id: string, start: string, finish: string, after: string[]): ScheduleActivity => {
    const { lag: _lag, ...base } = keep.get(id) as ScheduleActivity
    return { ...base, lineId: id, start, finish, after }
  }
  const activities = [line('froof-3', '2026-11-30', '2026-12-06', []), line('fhvac-3', '2026-12-07', '2026-12-13', ['froof-3']), line('fplumb-4', '2026-12-14', '2026-12-18', ['fhvac-3'])]
  return { ...s, projects: s.projects.map((p) => (p.id === ID && p.schedule ? { ...p, schedule: { ...p.schedule, activities, moves: [], walks: [], baseline: null }, waits: [], submittals: [], rfis: [] } : p)) }
}

/** Press a `tel:` link without jsdom trying to follow it. */
function press(link: Element) {
  link.addEventListener('click', (e) => e.preventDefault(), { once: true })
  fireEvent.click(link)
}

describe('days back on the Schedule tab', () => {
  it('the late job: the card under the measures, and the best offer’s worth in the Projected finish measure', () => {
    const { container } = render(<GcBuildingScheduleTab state={lateJob()} project={job(lateJob())} dispatch={vi.fn()} />)
    const card = container.querySelector('[data-tour="gc-days-back"]') as HTMLElement
    expect(card).toBeTruthy()
    const inCard = within(card)
    expect(inCard.getByText('1 way to bring the finish in. Each stands alone: save one and the list reads again.')).toBeTruthy()
    expect(inCard.getByText('A second crew on Test and balance.')).toBeTruthy()
    expect(inCard.getByText('1 day back')).toBeTruthy()
    expect(inCard.getByText(`It would finish Sat Dec 12, not Sun Dec 13. ${CREW_RULE}`)).toBeTruthy()
    expect(inCard.getByText('Cool Breeze Mechanical has to agree: Andre Wallace.')).toBeTruthy()
    expect(inCard.getByText('Call Andre')).toBeTruthy()
    expect(screen.getByText('Getting 1 day back brings the finish to Mon Dec 14, still 3 days past the contract.')).toBeTruthy()
  })

  it('on time there is no card', () => {
    const s = initialGcState()
    const { container } = render(<GcBuildingScheduleTab state={s} project={job(s)} dispatch={vi.fn()} />)
    expect(container.querySelector('[data-tour="gc-days-back"]')).toBeNull()
  })

  it('Look at it opens the window; Save the move sends the offer by its key, Getting days back preset', () => {
    const dispatch = vi.fn()
    const s = lateJob()
    render(<GcBuildingScheduleTab state={s} project={job(s)} dispatch={dispatch} />)
    fireEvent.click(screen.getByText('Look at it'))
    const dialog = screen.getByRole('dialog', { name: 'Get days back' })
    expect(within(dialog).getByText('Comes in behind it')).toBeTruthy()
    expect(within(dialog).getByText('The finish: Tue Dec 15 → Mon Dec 14.')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Getting days back' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(dialog).getByText('Save the move'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'recoverScheduleDays', projectId: ID, key: 'crew:fhvac-4', why: { reason: 'recovery', note: 'A second crew on Test and balance, to finish it Sat Dec 12.', by: 'The office' } })
  })

  it('who has to agree: Call and Follow up open the Follow up sheet on the days back', () => {
    const s = lateJob()
    const { container } = render(<GcBuildingScheduleTab state={s} project={job(s)} dispatch={vi.fn()} />)
    const card = container.querySelector('[data-tour="gc-days-back"]') as HTMLElement
    press(within(card).getByText('Call Andre'))
    const sheet = screen.getByRole('dialog', { name: 'Follow up' })
    expect(within(sheet).getByText('What did Andre say?')).toBeTruthy()
    expect(within(sheet).getAllByText('Days back · Fair Oaks Shops, Building D').length).toBeGreaterThan(0)
  })

  it('a saved side-by-side wait reads in words in the editor, and −3 on the chart', () => {
    const s = gcReducer(chain(), { type: 'recoverScheduleDays', projectId: ID, key: 'side:fhvac-3:froof-3', why: { reason: 'recovery', note: 'Controls starts beside the flashing.', by: 'Robert' } })
    const { container } = render(<GcBuildingScheduleTab state={s} project={job(s)} dispatch={vi.fn()} />)
    expect([...container.querySelectorAll('svg text')].some((t) => t.textContent === '−3')).toBe(true)
    fireEvent.click(container.querySelector('[data-gantt-bar="fhvac-3"]') as HTMLElement)
    expect(screen.getByText(': starts 3 days before Sheet metal and flashing finishes')).toBeTruthy()
  })
})
