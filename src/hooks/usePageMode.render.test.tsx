// @vitest-environment jsdom
/**
 * The page mode on a device, read off what the device has stored (the owner's walk, 2026-11-20).
 *
 * `pageMode.test.ts` holds the rule. This holds the wiring: the three toggles' own storage, a device
 * that kept two values from before the rule, the events the other screens listen for, and that a
 * press never writes Dispatch Mode to the server unless Dispatch Mode itself changed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

const serverWrite = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../lib/dispatchModeToggle', async (original) => ({
  ...(await original<typeof import('../lib/dispatchModeToggle')>()),
  // No answer from the server: the device's own value stands, as on a phone with no signal.
  fetchDispatchModeEnabledFromServer: vi.fn(async () => null),
  writeDispatchModeEnabledToServer: serverWrite,
}))

import { usePageMode } from './usePageMode'
import { dispatchModeStorageKey } from '../lib/dispatchModeToggle'
import { JOB_MODE_CHANGED_EVENT, jobModeStorageKey } from '../lib/jobModeToggle'
import type { PageModeKey } from '../lib/pageMode'
import { TASK_MODE_CHANGED_EVENT, taskModeStorageKey } from '../lib/taskModeToggle'

const USER = 'u-1'
const KEYS: PageModeKey[] = ['job', 'dispatch', 'task']

/** The menu, as bare as it gets: one row per mode with its tick, pressed the way the gear presses it. */
function Menu({ id = 'menu', role }: { id?: string; role: string }) {
  const { mode, ticks, set } = usePageMode(USER, role)
  return (
    <div data-testid={id} data-mode={mode}>
      {KEYS.map((key) => (
        <button key={key} type="button" aria-pressed={ticks[key]} onClick={() => set(key, !ticks[key])}>
          {`${id} ${key}`}
        </button>
      ))}
      <button type="button" onClick={() => set('job', true, 'card')}>{`${id} card`}</button>
    </div>
  )
}

const mode = (id = 'menu') => screen.getByTestId(id).getAttribute('data-mode')
const ticked = (id = 'menu') => KEYS.filter((key) => screen.getByText(`${id} ${key}`).getAttribute('aria-pressed') === 'true')
const press = (key: PageModeKey | 'card', id = 'menu') => act(() => screen.getByText(`${id} ${key}`).click())
const stored = () => ({
  job: localStorage.getItem(jobModeStorageKey(USER)),
  task: localStorage.getItem(taskModeStorageKey(USER)),
  dispatch: localStorage.getItem(dispatchModeStorageKey(USER)),
})

describe('usePageMode', () => {
  beforeEach(() => {
    localStorage.clear()
    serverWrite.mockClear()
  })
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('reads a device that held Job Mode and Task Mode together as Task Mode alone, with nothing rewritten', () => {
    localStorage.setItem(jobModeStorageKey(USER), '1')
    localStorage.setItem(taskModeStorageKey(USER), '1')
    render(<Menu role="helpers" />)
    expect(mode()).toBe('task')
    expect(ticked()).toEqual(['task'])
    expect(stored()).toEqual({ job: '1', task: '1', dispatch: null })
  })

  it('Task Mode off goes back to the Job Mode stored under it', () => {
    localStorage.setItem(jobModeStorageKey(USER), '1')
    localStorage.setItem(taskModeStorageKey(USER), '1')
    render(<Menu role="helpers" />)
    press('task')
    expect(mode()).toBe('job')
    expect(ticked()).toEqual(['job'])
    expect(stored()).toEqual({ job: '1', task: null, dispatch: null })
  })

  it('a sub with nothing stored drops into Task Mode and comes back to Job Mode, never the full Dashboard', () => {
    render(<Menu role="subcontractor" />)
    expect(ticked()).toEqual(['job'])
    press('task')
    expect(ticked()).toEqual(['task'])
    expect(stored().job).toBeNull()
    press('task')
    expect(mode()).toBe('job')
    expect(stored()).toEqual({ job: null, task: null, dispatch: null })
  })

  it('pressing Job Mode from Task Mode takes Task Mode off', () => {
    localStorage.setItem(taskModeStorageKey(USER), '1')
    render(<Menu role="estimator" />)
    expect(ticked()).toEqual(['task'])
    press('job')
    expect(ticked()).toEqual(['job'])
    expect(stored()).toEqual({ job: '1', task: null, dispatch: null })
    press('job')
    expect(mode()).toBe('full')
    expect(ticked()).toEqual([])
  })

  it('an office role goes from the full app to Task Mode and back', () => {
    render(<Menu role="estimator" />)
    expect(mode()).toBe('full')
    press('task')
    expect(ticked()).toEqual(['task'])
    press('task')
    expect(mode()).toBe('full')
    expect(stored()).toEqual({ job: null, task: null, dispatch: null })
  })

  it('reads a master who took Job Mode from the card as Job Mode, over a Dispatch Mode nobody chose', () => {
    localStorage.setItem(jobModeStorageKey(USER), 'card')
    render(<Menu role="master_technician" />)
    expect(mode()).toBe('job')
    expect(ticked()).toEqual(['job'])
    // Job Mode off: back to Dispatch Mode, which was on for the role all along.
    press('job')
    expect(ticked()).toEqual(['dispatch'])
    expect(stored()).toEqual({ job: '0', task: null, dispatch: null })
    expect(serverWrite).not.toHaveBeenCalled()
  })

  it('the Dashboard card switches a master from Dispatch Mode to Job Mode and remembers the door', () => {
    render(<Menu role="master_technician" />)
    expect(ticked()).toEqual(['dispatch'])
    press('card')
    expect(ticked()).toEqual(['job'])
    expect(stored().job).toBe('card')
    expect(serverWrite).not.toHaveBeenCalled()
  })

  it('pressing Dispatch Mode from Job Mode takes Job Mode off on this device', () => {
    localStorage.setItem(jobModeStorageKey(USER), '1')
    render(<Menu role="master_technician" />)
    press('dispatch')
    expect(ticked()).toEqual(['dispatch'])
    expect(stored().job).toBe('0')
    // Dispatch Mode off: the full app, and that one is the person's own choice, so the server hears it.
    press('dispatch')
    expect(mode()).toBe('full')
    expect(serverWrite).toHaveBeenCalledTimes(1)
    expect(serverWrite).toHaveBeenCalledWith(USER, false)
  })

  it('reads all three stored together as Task Mode, then Job Mode, then Dispatch Mode as each is switched off', () => {
    localStorage.setItem(jobModeStorageKey(USER), '1')
    localStorage.setItem(taskModeStorageKey(USER), '1')
    localStorage.setItem(dispatchModeStorageKey(USER), '1')
    render(<Menu role="dev" />)
    expect(ticked()).toEqual(['task'])
    press('task')
    expect(ticked()).toEqual(['job'])
    press('job')
    expect(ticked()).toEqual(['dispatch'])
    press('dispatch')
    expect(ticked()).toEqual([])
  })

  it('does not offer a mode to a role that cannot hold it, whatever the device stored', () => {
    localStorage.setItem(dispatchModeStorageKey(USER), '1')
    render(<Menu role="helpers" />)
    expect(ticked()).toEqual(['job'])
    press('dispatch')
    expect(ticked()).toEqual(['job'])
    expect(serverWrite).not.toHaveBeenCalled()
  })

  it('fires the events the other screens listen for, and a second screen follows', () => {
    const heard: string[] = []
    const onJob = () => heard.push('job')
    const onTask = () => heard.push('task')
    window.addEventListener(JOB_MODE_CHANGED_EVENT, onJob)
    window.addEventListener(TASK_MODE_CHANGED_EVENT, onTask)
    try {
      render(
        <>
          <Menu id="shell" role="estimator" />
          <Menu id="page" role="estimator" />
        </>,
      )
      press('task', 'shell')
      expect(heard).toEqual(['task'])
      expect(ticked('page')).toEqual(['task'])
      // Job Mode from Task Mode: both values change, so both events fire and the other screen lands in Job Mode.
      press('job', 'page')
      expect(heard).toEqual(['task', 'job', 'task'])
      expect(ticked('shell')).toEqual(['job'])
      expect(ticked('page')).toEqual(['job'])
    } finally {
      window.removeEventListener(JOB_MODE_CHANGED_EVENT, onJob)
      window.removeEventListener(TASK_MODE_CHANGED_EVENT, onTask)
    }
  })
})
