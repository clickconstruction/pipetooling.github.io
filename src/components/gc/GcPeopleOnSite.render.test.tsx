// @vitest-environment jsdom
/**
 * Render smoke for people on site per week (G-84): the toggle only on the office's chart, the strip
 * with Fair Oaks D's weeks, its hover card, the same totals whatever the chart filters or folds, no
 * strip when it is off or in List view, and the office's Schedule tab passing a trade's own count
 * (G-142) to it.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcGantt } from './GcGantt'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
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
    const tab = (s: GcState) => render(<GcBuildingScheduleTab state={s} project={s.projects.find((p) => p.id === 'fairoaksd')!} dispatch={() => undefined} />)
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
    const card = screen.getAllByRole('tooltip').map((t) => t.textContent ?? '').find((t) => t.startsWith('Week of')) ?? ''
    expect(card).toContain('Summit Roofing 6, its own count')
    expect(card).toContain("A trade's own count for the week comes first")
  })
})
