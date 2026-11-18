// @vitest-environment jsdom
/**
 * ① Line Items: the door back to its trip under a line that came from one (punch list #391, PR 4). A line
 * with a door says *Open Trip 14 ›* under its words, and the press runs the door. Every other line is as it was.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { JobFormFixturesSection } from './JobFormFixturesSection'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'
import { renderWithProviders } from '../../test/renderSmokeMocks'

afterEach(() => cleanup())

const fixtures: FixtureRow[] = [
  { id: 'fx-bid', name: 'Bid price', count: 1, line_unit_price: 184000, line_description: '', invoice_id: null, stage_kind: 'any' },
  { id: 'fx-trip', name: 'Trip 14, crew of 4, Nov 2 to 8', count: 1, line_unit_price: 6800, line_description: 'Reset the riser the framers moved. Asked by Walt, by phone.', invoice_id: null, stage_kind: 'any' },
  { id: 'fx-trip-bare', name: 'Trip 15, 1 person, Nov 20', count: 1, line_unit_price: 900, line_description: '', invoice_id: null, stage_kind: 'any' },
]

function renderSection(tripDoors: ReadonlyMap<string, { label: string; onOpen: () => void }> | null) {
  return renderWithProviders(
    <JobFormFixturesSection
      fixtures={fixtures}
      fixtureScopeExpandedById={{}}
      setFixtureScopeExpandedById={() => {}}
      fixturesSectionHighlight={false}
      fixturesSectionHighlightRef={{ current: null }}
      updateFixtureRow={() => {}}
      addFixtureRow={() => {}}
      removeFixtureRow={() => {}}
      moveFixtureRow={() => {}}
      onOpenSegmentGenerator={() => {}}
      onOpenStripeFixturePreview={() => {}}
      jobTotalDollars={191700}
      tripDoors={tripDoors}
    />,
  )
}

describe('① Line Items — the door back to a line’s trip', () => {
  it('draws the door under a trip’s line, with words under it or without, and the press opens the trip', () => {
    const open14 = vi.fn()
    const open15 = vi.fn()
    renderSection(
      new Map([
        ['fx-trip', { label: 'Open Trip 14', onOpen: open14 }],
        ['fx-trip-bare', { label: 'Open Trip 15', onOpen: open15 }],
      ]),
    )
    const doors = screen.getAllByTestId('line-trip-door')
    expect(doors.map((d) => d.textContent)).toEqual(['Open Trip 14 ›', 'Open Trip 15 ›'])
    fireEvent.click(screen.getByRole('button', { name: 'Open Trip 14 ›' }))
    expect(open14).toHaveBeenCalledTimes(1)
    expect(open15).not.toHaveBeenCalled()
  })

  it('draws no door when none is handed in, and none on a line that came from no trip', () => {
    renderSection(null)
    expect(screen.queryByTestId('line-trip-door')).toBeNull()
    cleanup()
    renderSection(new Map([['fx-trip', { label: 'Open Trip 14', onOpen: () => {} }]]))
    expect(screen.getAllByTestId('line-trip-door')).toHaveLength(1)
  })
})
