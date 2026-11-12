// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  TASK_MODE_EXIT_CONTROL,
  TASK_MODE_HOME,
  taskModeBounceTarget,
  taskModeStorageKey,
  readTaskModeEnabled,
  writeTaskModeEnabled,
  TASK_MODE_CHIP_LABEL,
  taskModeToggleTip,
} from './taskModeToggle'

describe('taskModeBounceTarget (journey-map Tier-2 #41)', () => {
  it('leaves the checklist alone and lands every other route there', () => {
    expect(taskModeBounceTarget('/checklist')).toBeNull()
    expect(taskModeBounceTarget('/checklist/')).toBeNull()
    for (const p of ['/', '/dashboard', '/roadmap', '/roadmap?roadmap=r1', '/people', '/jobs']) {
      expect(taskModeBounceTarget(p), p).toBe(TASK_MODE_HOME)
    }
  })

  it('the exit control name is the telemetry contract', () => {
    expect(TASK_MODE_EXIT_CONTROL).toBe('farm_mode_exit')
  })
})

describe('taskModeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to off when unset or for a missing user id', () => {
    expect(readTaskModeEnabled('user-a')).toBe(false)
    expect(readTaskModeEnabled(null)).toBe(false)
    expect(readTaskModeEnabled(undefined)).toBe(false)
  })

  it('round-trips on and off', () => {
    writeTaskModeEnabled('user-a', true)
    expect(readTaskModeEnabled('user-a')).toBe(true)
    writeTaskModeEnabled('user-a', false)
    expect(readTaskModeEnabled('user-a')).toBe(false)
  })

  it('off removes the key instead of storing "0"', () => {
    writeTaskModeEnabled('user-a', true)
    writeTaskModeEnabled('user-a', false)
    expect(localStorage.getItem(taskModeStorageKey('user-a'))).toBeNull()
  })

  it('keys are per-user so a shared device does not leak the toggle', () => {
    writeTaskModeEnabled('user-a', true)
    expect(readTaskModeEnabled('user-b')).toBe(false)
  })

  it('a device that had the mode on as Farm Mode still has it on: the saved key keeps its name (v2.7050)', () => {
    expect(taskModeStorageKey('user-a')).toBe('farm_mode_user-a')
    localStorage.setItem('farm_mode_user-a', '1')
    expect(readTaskModeEnabled('user-a')).toBe(true)
  })

  it('ignores writes with no user id', () => {
    writeTaskModeEnabled(null, true)
    writeTaskModeEnabled(undefined, true)
    expect(localStorage.length).toBe(0)
  })
})

describe('the words a person reads (v2.7050)', () => {
  it('the strip names the mode', () => {
    expect(TASK_MODE_CHIP_LABEL).toBe('Task Mode')
  })

  it('the gear row\'s tip says what the press does and what the mode is for', () => {
    expect(taskModeToggleTip(false)).toBe('Turn Task Mode on. This device shows only your checklist.')
    expect(taskModeToggleTip(true)).toBe('Turn Task Mode off. The full app comes back.')
  })
})
