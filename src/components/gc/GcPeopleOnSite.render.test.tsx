// @vitest-environment jsdom
/**
 * Render smoke for people on site per week (G-84): the toggle only on the office's chart, the strip
 * with Fair Oaks D's weeks, its hover card, the same totals whatever the chart filters or folds, and
 * no strip when it is off or in List view.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcGantt } from './GcGantt'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { scheduleMeasures } from '../../lib/gcMode/gcBuildingSchedule'
import { chartHolds } from '../../lib/gcMode/gcChartHolds'
import { peopleOnSite } from '../../lib/gcMode/gcPeopleOnSite'

afterEach(cleanup)

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
})
