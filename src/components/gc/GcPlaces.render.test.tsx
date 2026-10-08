// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 7a: the chart's lane's render tests. Their places are
 * kept through main's own kernels, as the prototype's reducer keeps them; the card's, the place
 * line's and the tab's tests stay on the spike. Moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `GcPlaces.render.test.tsx`); the plan is
 * to-dos/gc-mode/mockups/schedule-pr7.md on that branch.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcCrowdedLane } from './GcPlaces'
import { GcGantt } from './GcGantt'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { scheduleMeasures } from '../../lib/gc/schedule/schedule'
import { crowdedWeeks, placeChanges, placeRows, withPlaces } from '../../lib/gc/schedule/places'
import type { GcState } from '../../lib/gc/types'

afterEach(cleanup)

const ID = 'fairoaksd'

const job = (s: GcState) => s.projects.find((p) => p.id === ID)!

const s0 = initialGcState()

/** Fair Oaks D with every place guess kept, as Keep the guesses keeps them (the prototype's `setActivityPlaces`). */
const kept: GcState = (() => {
  const p = job(s0)
  const sch = p.schedule!
  const changes = placeChanges(sch.activities, Object.fromEntries(placeRows(s0, p).flatMap((r) => (r.guess ? [[r.lineId, r.guess.place]] : []))))!
  return { ...s0, projects: s0.projects.map((x) => (x.id === ID ? { ...x, schedule: { ...sch, activities: withPlaces(sch.activities, changes) } } : x)) }
})()

describe('the chart’s lane', () => {
  it('draws inside’s two weeks with the most at once, and a hover card in G-84’s look', () => {
    const m = scheduleMeasures(kept, job(kept))
    const { container } = render(<GcGantt items={m.items} float={m.float} milestones={m.milestones} holds={new Map()} today={kept.today} building picked={null} onPick={vi.fn()} crowded={crowdedWeeks(kept, job(kept))} />)
    expect(container.querySelector('[data-crowded-place="Inside"]')).toBeTruthy()
    expect([...container.querySelectorAll('[data-crowded-week]')].map((n) => [n.getAttribute('data-crowded-week'), n.getAttribute('aria-label')])).toEqual([
      ['2026-09-28', 'Inside has 3 trades at once, Fri Oct 2 to Sun Oct 4.'],
      ['2026-10-05', 'Inside has 3 trades at once, Mon Oct 5 to Fri Oct 9.'],
    ])
    expect(screen.getByText('3 trades')).toBeTruthy()
    fireEvent.mouseEnter(container.querySelector('[data-crowded-week="2026-10-05"]')!, { clientX: 300, clientY: 200 })
    const card = screen.getByRole('tooltip')
    expect(card.textContent).toContain('About 8 a day.')
    expect(card.textContent).toContain('Our own crew 3')
  })

  it('draws no lane with no place kept', () => {
    const m = scheduleMeasures(s0, job(s0))
    const { container } = render(<GcGantt items={m.items} float={m.float} milestones={m.milestones} holds={new Map()} today={s0.today} building picked={null} onPick={vi.fn()} crowded={crowdedWeeks(s0, job(s0))} />)
    expect(container.querySelector('[data-crowded-lane]')).toBeNull()
    cleanup()
    const lane = render(<GcCrowdedLane weeks={crowdedWeeks(kept, job(kept))} first="2026-09-28" px={9} labelW={168} width={900} phone rowH={32} />)
    expect(lane.container.textContent).toContain('Crowded')
  })
})
