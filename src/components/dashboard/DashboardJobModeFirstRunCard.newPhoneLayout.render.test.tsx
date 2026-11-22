// @vitest-environment jsdom
/**
 * The first-run card under the new phone layout: Job Mode is on for a master technician and a superintendent
 * with nothing stored, so the card that offers it is not drawn. The page behind Show full dashboard is where
 * it would have shown. With the tick off, or at a desk, the card is the card it was.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))
const scenario = vi.hoisted(() => ({ phone: true }))
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => scenario.phone }))

import DashboardJobModeFirstRunCard from './DashboardJobModeFirstRunCard'
import { jobModeStorageKey } from '../../lib/jobModeToggle'
import { NEW_PHONE_LAYOUT_STORAGE_KEY } from '../../lib/phoneLayout/newPhoneLayout'

const ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']
const drawnFor = () =>
  ROLES.filter((role) => {
    const r = render(<DashboardJobModeFirstRunCard userId="u-1" role={role} onEnable={() => {}} />)
    const drawn = screen.queryByTestId('job-mode-first-run-card') != null
    r.unmount()
    return drawn
  })

beforeEach(() => {
  localStorage.clear()
  scenario.phone = true
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('DashboardJobModeFirstRunCard · the new phone layout', () => {
  it('tick off, on a phone: drawn for a master technician and a superintendent, as before', () => {
    expect(drawnFor()).toEqual(['master_technician', 'superintendent'])
  })

  it('tick on, on a phone: drawn for nobody, since Job Mode is already on for the two', () => {
    localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
    expect(drawnFor()).toEqual([])
  })

  it('tick on, at a desk: drawn as before', () => {
    localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
    scenario.phone = false
    expect(drawnFor()).toEqual(['master_technician', 'superintendent'])
  })

  it('tick on, with Job Mode stored off: still not drawn, since the person has decided', () => {
    localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
    localStorage.setItem(jobModeStorageKey('u-1'), '0')
    expect(drawnFor()).toEqual([])
  })
})
