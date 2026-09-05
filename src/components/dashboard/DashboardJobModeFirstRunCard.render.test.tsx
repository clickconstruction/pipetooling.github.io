// @vitest-environment jsdom
/**
 * Render smoke for the first-run "Working in the field? Turn on Job Mode" card
 * (v2.2877, journey-map Tier-2 #26 / J24-P4): shows only for masters and
 * superintendents with nothing stored; one tap enables (stored as `card`) and
 * records `job_mode_enabled{card}`; "Not now" hides it for good on this device.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

import { recordNavClick } from '../../lib/navClickTelemetry'
import DashboardJobModeFirstRunCard from './DashboardJobModeFirstRunCard'
import { jobModeCardDismissedKey, jobModeStorageKey, writeJobModeEnabled } from '../../lib/jobModeToggle'

describe('DashboardJobModeFirstRunCard', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.mocked(recordNavClick).mockClear()
    // jsdom has no scrollTo; the card's scroll-to-top is best-effort.
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  })
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('renders for a master with nothing stored', () => {
    render(<DashboardJobModeFirstRunCard userId="m1" role="master_technician" onEnable={() => {}} />)
    expect(screen.getByTestId('job-mode-first-run-card')).toBeTruthy()
    expect(screen.getByText('Working in the field? Turn on Job Mode.')).toBeTruthy()
  })

  it('renders for a superintendent with nothing stored', () => {
    render(<DashboardJobModeFirstRunCard userId="s1" role="superintendent" onEnable={() => {}} />)
    expect(screen.getByTestId('job-mode-first-run-card')).toBeTruthy()
  })

  it('never renders for sub-like roles (already on) or office roles', () => {
    for (const role of ['helpers', 'subcontractor', 'dev', 'assistant', 'controller', 'estimator', 'primary']) {
      const r = render(<DashboardJobModeFirstRunCard userId="x" role={role} onEnable={() => {}} />)
      expect(screen.queryByTestId('job-mode-first-run-card'), role).toBeNull()
      r.unmount()
    }
  })

  it('does not render once the user has decided via the gear menu', () => {
    writeJobModeEnabled('m1', false)
    render(<DashboardJobModeFirstRunCard userId="m1" role="master_technician" onEnable={() => {}} />)
    expect(screen.queryByTestId('job-mode-first-run-card')).toBeNull()
  })

  it('one tap calls onEnable and records job_mode_enabled{card}', () => {
    const onEnable = vi.fn(() => writeJobModeEnabled('m1', true, 'card'))
    render(<DashboardJobModeFirstRunCard userId="m1" role="master_technician" onEnable={onEnable} />)
    fireEvent.click(screen.getByText('Turn on Job Mode'))
    expect(onEnable).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(jobModeStorageKey('m1'))).toBe('card')
    expect(recordNavClick).toHaveBeenCalledWith('m1', 'master_technician', 'job_mode_enabled', '#card')
  })

  it('"Not now" hides the card and remembers the dismissal per user', () => {
    const first = render(<DashboardJobModeFirstRunCard userId="m1" role="master_technician" onEnable={() => {}} />)
    fireEvent.click(screen.getByText('Not now'))
    expect(screen.queryByTestId('job-mode-first-run-card')).toBeNull()
    expect(localStorage.getItem(jobModeCardDismissedKey('m1'))).toBe('1')
    expect(localStorage.getItem(jobModeStorageKey('m1'))).toBeNull()
    first.unmount()
    // Same device, m1 again: still hidden. A different user on the same phone still gets the card.
    const again = render(<DashboardJobModeFirstRunCard userId="m1" role="master_technician" onEnable={() => {}} />)
    expect(screen.queryByTestId('job-mode-first-run-card')).toBeNull()
    again.unmount()
    render(<DashboardJobModeFirstRunCard userId="m2" role="master_technician" onEnable={() => {}} />)
    expect(screen.getByTestId('job-mode-first-run-card')).toBeTruthy()
  })
})
