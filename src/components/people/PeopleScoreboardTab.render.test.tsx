// @vitest-environment jsdom
/**
 * Render smoke for People → Scoreboard (v2.1312): both gauges present as
 * accessible meters, band labels derive from the kernel, the bonus banner
 * computes its green count instead of hardcoding it, and the sample-data
 * pill is visible (the tab must never look like live numbers while it ships
 * sample data).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { PeopleScoreboardTab } from './PeopleScoreboardTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

afterEach(cleanup)

describe('PeopleScoreboardTab', () => {
  it('renders both gauges as meters with kernel-derived bands', () => {
    renderWithProviders(<PeopleScoreboardTab />)
    const profit = screen.getByRole('meter', { name: /Job profit ratio: 1\.18×, YELLOW/ })
    expect(profit.getAttribute('aria-valuenow')).toBe('1.18')
    const office = screen.getByRole('meter', { name: /Office cost per field dollar: 31%, YELLOW/ })
    expect(office.getAttribute('aria-valuenow')).toBe('31')
  })

  it('computes the bonus banner from the bands (both sample values are yellow)', () => {
    renderWithProviders(<PeopleScoreboardTab />)
    expect(screen.getByRole('status').textContent).toContain('Bonus window: 0 of 2 in green')
  })

  it('labels the surface as sample data and renders both 12-week trends', () => {
    renderWithProviders(<PeopleScoreboardTab />)
    expect(screen.getByText(/Sample data — dev-only/)).toBeTruthy()
    expect(screen.getByRole('img', { name: /Job profit ratio: 5 of 12 weeks green/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /Office cost per field dollar: 5 of 12 weeks green/ })).toBeTruthy()
  })
})
