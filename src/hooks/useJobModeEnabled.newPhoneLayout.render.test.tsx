// @vitest-environment jsdom
/**
 * Job Mode as the phone's home (the new phone layout): the hook reads the device's tick and the width
 * through `useNewPhoneLayout`, so a master technician and a superintendent with nothing stored are in
 * Job Mode on a phone with the tick on, and nowhere else. The viewport hook is mocked per case and the
 * tick is the device's stored one, so the hook's own listening is what turns the probe.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

const scenario = { phone: true }
vi.mock('./useNarrowViewport640', () => ({ useNarrowViewport640: () => scenario.phone }))

import { useJobModeEnabled } from './useJobModeEnabled'
import { useNewPhoneLayout } from './useNewPhoneLayout'
import { jobModeStorageKey } from '../lib/jobModeToggle'
import { NEW_PHONE_LAYOUT_STORAGE_KEY } from '../lib/phoneLayout/newPhoneLayout'

const ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']
const USER = 'u-1'

function Probe({ role }: { role: string }) {
  const [enabled, set] = useJobModeEnabled(USER, role)
  const layout = useNewPhoneLayout()
  return (
    <div data-testid="probe" data-job-mode={enabled ? 'on' : 'off'}>
      <button type="button" onClick={() => set(false)}>off</button>
      <button type="button" onClick={() => set(true)}>on</button>
      <button type="button" onClick={() => layout.setStored(!layout.stored)}>tick</button>
    </div>
  )
}

const jobMode = () => screen.getByTestId('probe').getAttribute('data-job-mode')
const inJobMode = (role: string) => {
  const r = render(<Probe role={role} />)
  const on = jobMode() === 'on'
  r.unmount()
  return on
}

beforeEach(() => {
  localStorage.clear()
  scenario.phone = true
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('useJobModeEnabled · the new phone layout', () => {
  it('tick off: every role with nothing stored is where it was, the sub-like roles in Job Mode and nobody else', () => {
    expect(ROLES.filter(inJobMode)).toEqual(['subcontractor', 'helpers'])
  })

  it('tick on, on a phone: a master technician and a superintendent with nothing stored are in Job Mode too', () => {
    localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
    expect(ROLES.filter(inJobMode)).toEqual(['master_technician', 'superintendent', 'subcontractor', 'helpers'])
    // A default, not a choice: nothing was written for anyone.
    expect(localStorage.getItem(jobModeStorageKey(USER))).toBeNull()
  })

  it('tick on, at a desk: nothing changes', () => {
    localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
    scenario.phone = false
    expect(ROLES.filter(inJobMode)).toEqual(['subcontractor', 'helpers'])
  })

  it('tick on: a stored off wins for every role, and a stored on is on for every role', () => {
    localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
    localStorage.setItem(jobModeStorageKey(USER), '0')
    expect(ROLES.filter(inJobMode)).toEqual([])
    for (const value of ['1', 'card']) {
      localStorage.setItem(jobModeStorageKey(USER), value)
      expect(ROLES.filter(inJobMode), value).toEqual(ROLES)
    }
  })

  it('a master technician who switches it off stays off: the press stores 0, and on brings it back', () => {
    localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
    render(<Probe role="master_technician" />)
    expect(jobMode()).toBe('on')
    act(() => screen.getByText('off').click())
    expect(jobMode()).toBe('off')
    expect(localStorage.getItem(jobModeStorageKey(USER))).toBe('0')
    cleanup()
    // The next visit on that phone: still off.
    render(<Probe role="master_technician" />)
    expect(jobMode()).toBe('off')
    act(() => screen.getByText('on').click())
    expect(jobMode()).toBe('on')
    expect(localStorage.getItem(jobModeStorageKey(USER))).toBe('1')
  })

  it('ticking the switch turns the page at once, and unticking turns it back', () => {
    render(<Probe role="superintendent" />)
    expect(jobMode()).toBe('off')
    act(() => screen.getByText('tick').click())
    expect(jobMode()).toBe('on')
    act(() => screen.getByText('tick').click())
    expect(jobMode()).toBe('off')
    // Still nothing stored for Job Mode: the tick alone moved it.
    expect(localStorage.getItem(jobModeStorageKey(USER))).toBeNull()
  })
})
