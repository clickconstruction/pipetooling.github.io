// @vitest-environment jsdom
/**
 * The page mode under the new phone layout: a master technician and a superintendent with nothing stored
 * are drawn in Job Mode on a phone, over a Dispatch Mode nobody chose, and the gear menu's two rows still
 * do what they did. The tick is the device's stored one and the width is mocked per case.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

const serverWrite = vi.hoisted(() => vi.fn(async () => {}))
const scenario = vi.hoisted(() => ({ phone: true }))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../lib/dispatchModeToggle', async (original) => ({
  ...(await original<typeof import('../lib/dispatchModeToggle')>()),
  fetchDispatchModeEnabledFromServer: vi.fn(async () => null),
  writeDispatchModeEnabledToServer: serverWrite,
}))
vi.mock('./useNarrowViewport640', () => ({ useNarrowViewport640: () => scenario.phone }))

import { usePageMode } from './usePageMode'
import { dispatchModeStorageKey } from '../lib/dispatchModeToggle'
import { jobModeStorageKey } from '../lib/jobModeToggle'
import type { PageModeKey } from '../lib/pageMode'
import { NEW_PHONE_LAYOUT_STORAGE_KEY } from '../lib/phoneLayout/newPhoneLayout'
import { taskModeStorageKey } from '../lib/taskModeToggle'

const USER = 'u-1'
const KEYS: PageModeKey[] = ['job', 'dispatch', 'task']
const ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']

function Menu({ role }: { role: string }) {
  const { mode, ticks, set } = usePageMode(USER, role)
  return (
    <div data-testid="menu" data-mode={mode}>
      {KEYS.map((key) => (
        <button key={key} type="button" aria-pressed={ticks[key]} onClick={() => set(key, !ticks[key])}>
          {key}
        </button>
      ))}
    </div>
  )
}

const mode = () => screen.getByTestId('menu').getAttribute('data-mode')
const ticked = () => KEYS.filter((key) => screen.getByText(key).getAttribute('aria-pressed') === 'true')
const press = (key: PageModeKey) => act(() => screen.getByText(key).click())
const stored = () => ({
  job: localStorage.getItem(jobModeStorageKey(USER)),
  task: localStorage.getItem(taskModeStorageKey(USER)),
  dispatch: localStorage.getItem(dispatchModeStorageKey(USER)),
})
const startMode = (role: string) => {
  const r = render(<Menu role={role} />)
  const m = mode()
  r.unmount()
  return m
}

beforeEach(() => {
  localStorage.clear()
  serverWrite.mockClear()
  scenario.phone = true
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('usePageMode · the new phone layout', () => {
  it('tick off: the mode every role starts in, with nothing stored, is the one it started in before', () => {
    expect(Object.fromEntries(ROLES.map((r) => [r, startMode(r)]))).toEqual({
      dev: 'full',
      master_technician: 'dispatch',
      assistant: 'dispatch',
      controller: 'dispatch',
      estimator: 'full',
      primary: 'full',
      superintendent: 'full',
      subcontractor: 'job',
      helpers: 'job',
    })
  })

  it('tick on, on a phone: a master technician and a superintendent start in Job Mode, and nobody else moves', () => {
    localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
    expect(Object.fromEntries(ROLES.map((r) => [r, startMode(r)]))).toEqual({
      dev: 'full',
      master_technician: 'job',
      assistant: 'dispatch',
      controller: 'dispatch',
      estimator: 'full',
      primary: 'full',
      superintendent: 'job',
      subcontractor: 'job',
      helpers: 'job',
    })
    expect(stored()).toEqual({ job: null, task: null, dispatch: null })
  })

  it('tick on, at a desk: every role starts where it started before', () => {
    localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
    scenario.phone = false
    expect(startMode('master_technician')).toBe('dispatch')
    expect(startMode('superintendent')).toBe('full')
  })

  it('a master technician’s Job Mode row: ticked, and one press goes back to the Dispatch Mode under it and stays there', () => {
    localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
    render(<Menu role="master_technician" />)
    expect(ticked()).toEqual(['job'])
    press('job')
    expect(ticked()).toEqual(['dispatch'])
    expect(stored()).toEqual({ job: '0', task: null, dispatch: null })
    // Dispatch Mode was never written: it was on for the role all along.
    expect(serverWrite).not.toHaveBeenCalled()
    cleanup()
    render(<Menu role="master_technician" />)
    expect(mode()).toBe('dispatch')
  })

  it('a master technician’s Dispatch Mode row: one press switches to Dispatch Mode and stores Job Mode off', () => {
    localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
    render(<Menu role="master_technician" />)
    press('dispatch')
    expect(ticked()).toEqual(['dispatch'])
    expect(stored().job).toBe('0')
  })

  it('a superintendent’s Job Mode row: one press goes to the full app and stays there', () => {
    localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
    render(<Menu role="superintendent" />)
    expect(ticked()).toEqual(['job'])
    press('job')
    expect(mode()).toBe('full')
    expect(stored().job).toBe('0')
    press('job')
    expect(mode()).toBe('job')
    expect(stored().job).toBe('1')
  })

  it('a master technician who drops into Task Mode comes back to Job Mode, as a helper does', () => {
    localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
    render(<Menu role="master_technician" />)
    press('task')
    expect(ticked()).toEqual(['task'])
    press('task')
    expect(mode()).toBe('job')
    expect(stored().job).toBeNull()
  })

  it('a stored off from before the switch keeps a master technician in Dispatch Mode', () => {
    localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
    localStorage.setItem(jobModeStorageKey(USER), '0')
    render(<Menu role="master_technician" />)
    expect(mode()).toBe('dispatch')
  })
})
