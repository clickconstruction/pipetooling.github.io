// @vitest-environment jsdom
/**
 * Render smoke for the role-aware Job Mode gate (v2.2877, journey-map Tier-2 #26):
 * a probe component renders the "Job Mode" marker exactly when the hook says
 * on. Guards the PROTECTED rule — Job Mode never renders for an office role
 * with no stored key — and the new default for helpers / subs.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useJobModeEnabled } from './useJobModeEnabled'
import { jobModeStorageKey, writeJobModeEnabled } from '../lib/jobModeToggle'

function Probe({ userId, role }: { userId: string; role: string }) {
  const [enabled, set] = useJobModeEnabled(userId, role)
  return (
    <div>
      {enabled ? <div data-testid="job-mode-active">Job Mode</div> : <div data-testid="full-dashboard">Full dashboard</div>}
      <button type="button" onClick={() => set(false)}>
        off
      </button>
      <button type="button" onClick={() => set(true, 'card')}>
        on-card
      </button>
    </div>
  )
}

describe('useJobModeEnabled — role default', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('does NOT render Job Mode for office roles with no stored key', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent']) {
      const r = render(<Probe userId="u-office" role={role} />)
      expect(screen.queryByTestId('job-mode-active'), role).toBeNull()
      expect(screen.getByTestId('full-dashboard'), role).toBeTruthy()
      r.unmount()
    }
  })

  it('renders Job Mode for a helper and a subcontractor with no stored key', () => {
    for (const role of ['helpers', 'subcontractor']) {
      const r = render(<Probe userId="u-field" role={role} />)
      expect(screen.getByTestId('job-mode-active'), role).toBeTruthy()
      r.unmount()
    }
  })

  it("a helper's explicit off sticks: the setter stores '0' and the marker leaves", () => {
    render(<Probe userId="u-helper" role="helpers" />)
    expect(screen.getByTestId('job-mode-active')).toBeTruthy()
    act(() => screen.getByText('off').click())
    expect(screen.queryByTestId('job-mode-active')).toBeNull()
    expect(localStorage.getItem(jobModeStorageKey('u-helper'))).toBe('0')
  })

  it('a master turned on from the card renders Job Mode and remembers the door', () => {
    render(<Probe userId="u-master" role="master_technician" />)
    expect(screen.queryByTestId('job-mode-active')).toBeNull()
    act(() => screen.getByText('on-card').click())
    expect(screen.getByTestId('job-mode-active')).toBeTruthy()
    expect(localStorage.getItem(jobModeStorageKey('u-master'))).toBe('card')
  })

  it("a legacy '1' on the device still reads on for an office role that chose it", () => {
    writeJobModeEnabled('u-legacy', true)
    render(<Probe userId="u-legacy" role="estimator" />)
    expect(screen.getByTestId('job-mode-active')).toBeTruthy()
  })
})
