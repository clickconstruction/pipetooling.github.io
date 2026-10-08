// @vitest-environment jsdom
/** People → Hours → Due by Team (#46 row 6, v2.4953): each team's period cost from the `teams` value, and its ledger window. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PeopleHoursDueSummaries } from './PeopleHoursDueSummaries'

afterEach(cleanup)

const TEAMS = {
  teamsFiltered: [
    { id: 't1', name: 'Service', members: ['Sam Lee', 'Jo Park'] },
    { id: 't2', name: 'Rough-in', members: ['Ana Ruiz'] },
  ],
  teamPeriodStart: '2026-09-21',
  teamPeriodEnd: '2026-09-22',
  getCostForPersonDateTeams: (_name: string, _day: string) => 100,
}

describe('PeopleHoursDueSummaries', () => {
  it('closed, it is a toggle only', () => {
    const onToggle = vi.fn()
    render(<PeopleHoursDueSummaries open={false} onToggle={onToggle} teams={TEAMS} />)
    const toggle = screen.getByRole('button', { name: /Due by Team/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Service: $400')).toBeNull()
    fireEvent.click(toggle)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it("lists each team's period cost and opens its ledger", () => {
    render(<PeopleHoursDueSummaries open onToggle={vi.fn()} teams={TEAMS} />)
    expect(screen.getByText('Service: $400')).toBeTruthy()
    expect(screen.getByText('Rough-in: $200')).toBeTruthy()
    fireEvent.click(screen.getByText('Service: $400'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Service — 2026-09-21 to 2026-09-22')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
