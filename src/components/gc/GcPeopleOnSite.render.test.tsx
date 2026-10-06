// @vitest-environment jsdom
/**
 * Render smoke for people on site per week (G-84): the toggle only on the office's chart, the strip
 * with Fair Oaks D's weeks, its hover card, the same totals whatever the chart filters or folds, no
 * strip when it is off or in List view, the office's Schedule tab passing a trade's own count
 * (G-142) to it, a what-if copy's dates read while the copy is shown (G-81), and the strip on our
 * team's printed copy while it is on (G-144).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcGantt } from './GcGantt'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { addDays } from '../../lib/gcMode/gcBuilding'
import type { GcState } from '../../lib/gcMode/gcTypes'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'
import { chartHolds } from '../../lib/gcMode/gcChartHolds'
import { peopleOnSite } from '../../lib/gcMode/gcPeopleOnSite'

afterEach(cleanup)

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
  }
})

const state = initialGcState()
const project = state.projects.find((p) => p.id === 'fairoaksd')!

function chart(withPeople = true) {
  const m = scheduleMeasures(state, project)
  const peopleOf = (from: string, to: string) => peopleOnSite(state, project, from, to)
  return render(<GcGantt items={m.items} float={m.float} milestones={m.milestones} holds={chartHolds(state, project)} today={state.today} building picked={null} onPick={vi.fn()} {...(withPeople ? { peopleOf } : {})} />)
}

/** The office's Schedule tab on Fair Oaks D, with its chart. */
const tab = (s: GcState) => render(<GcBuildingScheduleTab state={s} project={s.projects.find((p) => p.id === 'fairoaksd')!} dispatch={() => undefined} />)

/** A week's two numbers as the strip draws them. */
function week(container: HTMLElement, weekOf: string): [string | null, string | null] {
  const cell = container.querySelector(`[data-people-week="${weekOf}"]`)
  return [cell?.getAttribute('data-planned') ?? null, cell?.getAttribute('data-logged') ?? null]
}

describe('people on site per week, on the office’s chart', () => {
  it('has its toggle only where the office’s tab gives it the counts', () => {
    chart(false)
    expect(screen.queryByRole('button', { name: 'Show people on site' })).toBeNull()
    cleanup()
    chart()
    expect(screen.getByRole('button', { name: 'Show people on site' })).toBeTruthy()
  })

  it('draws Fair Oaks D’s weeks, the plan against the daily log, with a card on hover', () => {
    const { container } = chart()
    expect(container.querySelector('[data-people-strip]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show people on site' }))
    expect(week(container, '2026-09-21')).toEqual(['15', '19'])
    expect(week(container, '2026-09-28')).toEqual(['15', '18'])
    expect(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].map((w) => week(container, w))).toEqual([
      ['12', ''],
      ['9', ''],
      ['9', ''],
      ['2', ''],
    ])
    fireEvent.mouseEnter(container.querySelector('[data-people-week="2026-09-21"]')!, { clientX: 20, clientY: 20 })
    const card = screen.getByRole('tooltip').textContent ?? ''
    expect(card).toContain('Week of Mon Sep 21')
    expect(card).toContain('Plan15 at the busiest, Mon Sep 21.')
    expect(card).toContain('Log19 at the busiest, Tue Sep 22, 5 days logged.')
    expect(screen.getByText(/people on site: the plan's busiest day each week/)).toBeTruthy()
  })

  it('keeps the same totals whatever the chart filters or folds: it counts the whole job', () => {
    const { container } = chart()
    fireEvent.click(screen.getByRole('button', { name: 'Show people on site' }))
    const before = ['2026-09-21', '2026-09-28', '2026-10-05'].map((w) => week(container, w))
    // A filter: only the held bars.
    fireEvent.click(screen.getByRole('button', { name: /^Held/ }))
    expect(['2026-09-21', '2026-09-28', '2026-10-05'].map((w) => week(container, w))).toEqual(before)
    fireEvent.click(screen.getByRole('button', { name: /^Held/ }))
    // Folds: every group opened (finished trades open folded), then every group folded.
    fireEvent.click(screen.getByRole('button', { name: 'Open all' }))
    expect(['2026-09-21', '2026-09-28', '2026-10-05'].map((w) => week(container, w))).toEqual(before)
    fireEvent.click(screen.getByRole('button', { name: 'Fold all' }))
    expect(['2026-09-21', '2026-09-28', '2026-10-05'].map((w) => week(container, w))).toEqual(before)
  })

  it('goes when it is off, and in List view', () => {
    const { container } = chart()
    fireEvent.click(screen.getByRole('button', { name: 'Show people on site' }))
    expect(container.querySelector('[data-people-strip]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide people on site' }))
    expect(container.querySelector('[data-people-strip]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show people on site' }))
    fireEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(container.querySelector('[data-people-strip]')).toBeNull()
  })

  it('reads a trade’s own count for its week on the office’s Schedule tab, over the log’s last count (G-142)', () => {
    // No count given yet: the week of Oct 5 plans 12, Summit Roofing at the log's 4.
    let { container } = tab(state)
    fireEvent.click(screen.getByRole('button', { name: 'Show people on site' }))
    expect(week(container, '2026-10-05')).toEqual(['12', ''])
    cleanup()
    // Summit says 6 a day for that week, from its portal: 14, and the week after keeps the log's 4.
    const said = gcReducer(state, { type: 'tradeSetCrewCount', projectId: 'fairoaksd', partnerId: 'summit', packageId: 'froof', weekOf: '2026-10-05', count: 6 })
    ;({ container } = tab(said))
    fireEvent.click(screen.getByRole('button', { name: 'Show people on site' }))
    expect(['2026-10-05', '2026-10-12'].map((w) => week(container, w))).toEqual([
      ['14', ''],
      ['9', ''],
    ])
    fireEvent.mouseEnter(container.querySelector('[data-people-week="2026-10-05"]')!, { clientX: 20, clientY: 20 })
    const card = screen.getAllByRole('tooltip').find((t) => t.textContent?.startsWith('Week of'))!
    // A company a line: each is an element of its own, so the words match whole.
    expect(within(card).getByText('Summit Roofing 6, its own count')).toBeTruthy()
    expect(within(card).getByText('our own crew 3')).toBeTruthy()
    expect(card.textContent).toContain("A trade's own count for the week comes first")
  })

  it('reads a what-if copy’s dates while the copy is shown, with the same daily log, and stays on (G-81)', () => {
    // Summit's last roof bar, Oct 12 to 21, tried two weeks later in a copy.
    let s = gcReducer(state, { type: 'startWhatIf', projectId: 'fairoaksd', by: 'Robert' })
    const roof = s.projects.find((p) => p.id === 'fairoaksd')!.whatIf!.schedule.activities.find((a) => a.lineId === 'froof-3')!
    expect([roof.start, roof.finish]).toEqual(['2026-10-12', '2026-10-21'])
    s = gcReducer(s, { type: 'inWhatIf', projectId: 'fairoaksd', by: 'Robert', action: { type: 'setScheduleActivity', projectId: 'fairoaksd', lineId: 'froof-3', start: addDays(roof.start, 14), finish: addDays(roof.finish, 14), after: roof.after } })
    const { container } = tab(s)
    fireEvent.click(screen.getByRole('button', { name: 'Show people on site' }))
    const weeks = ['2026-09-21', '2026-09-28', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']
    const real = [
      ['15', '19'],
      ['15', '18'],
      ['9', ''],
      ['9', ''],
      ['2', ''],
      ['5', ''],
    ]
    expect(weeks.map((w) => week(container, w))).toEqual(real)
    // The copy opens: the strip stays on, Summit's 4 move two weeks later, and the log's side stays.
    fireEvent.click(screen.getByRole('button', { name: 'What if · 1' }))
    // The way back is on the toolbar and on the copy's line over the chart.
    expect(screen.getAllByRole('button', { name: 'See the real schedule' })).toHaveLength(2)
    expect(container.querySelector('[data-people-strip]')).toBeTruthy()
    expect(weeks.map((w) => week(container, w))).toEqual([
      ['15', '19'],
      ['15', '18'],
      ['5', ''],
      ['5', ''],
      ['6', ''],
      ['9', ''],
    ])
    // Back on the real schedule, the real weeks.
    fireEvent.click(screen.getAllByRole('button', { name: 'See the real schedule' })[0]!)
    expect(weeks.map((w) => week(container, w))).toEqual(real)
  })

  it('prints on our team’s copy while it is on, under the last page’s rows, and never on the customer’s (G-144)', () => {
    const framed = () => screen.getByRole('dialog', { name: 'Print the chart' }).querySelector('iframe')?.getAttribute('srcdoc') ?? ''
    // The chart toolbar's own: the tab has another for the customer's schedule.
    const print = () => fireEvent.click(within(document.querySelector('[data-tour="gc-gantt-toolbar"]') as HTMLElement).getByRole('button', { name: 'Print or PDF' }))
    // Off: the paper has no strip.
    tab(state)
    print()
    expect(framed()).toContain('<section class="page">')
    expect(framed()).not.toContain('data-people=')
    cleanup()
    // On: Fair Oaks D's weeks on our team's copy, and said in the window.
    tab(state)
    fireEvent.click(screen.getByRole('button', { name: 'Show people on site' }))
    print()
    expect(framed()).toContain('data-people="2026-09-21" data-planned="15" data-logged="19"')
    expect(framed()).toContain('data-people="2026-10-05" data-planned="12" data-logged=""')
    expect(within(screen.getByRole('dialog', { name: 'Print the chart' })).getByText("People on site print under the last page's rows, the plan beside the daily log.")).toBeTruthy()
    // The customer's copy, never.
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Print the chart' })).getByRole('button', { name: 'The customer' }))
    expect(framed()).toContain('<section class="page">')
    expect(framed()).not.toContain('data-people=')
  })
})
