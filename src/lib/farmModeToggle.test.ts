// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  FARM_MODE_EXIT_CONTROL,
  FARM_MODE_HOME,
  farmModeBounceTarget,
  farmModeStorageKey,
  readFarmModeEnabled,
  writeFarmModeEnabled,
} from './farmModeToggle'

describe('farmModeBounceTarget (journey-map Tier-2 #41)', () => {
  it('leaves the checklist alone and lands every other route there', () => {
    expect(farmModeBounceTarget('/checklist')).toBeNull()
    expect(farmModeBounceTarget('/checklist/')).toBeNull()
    for (const p of ['/', '/dashboard', '/roadmap', '/roadmap?roadmap=r1', '/people', '/jobs']) {
      expect(farmModeBounceTarget(p), p).toBe(FARM_MODE_HOME)
    }
  })

  it('the exit control name is the telemetry contract', () => {
    expect(FARM_MODE_EXIT_CONTROL).toBe('farm_mode_exit')
  })
})

describe('farmModeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to off when unset or for a missing user id', () => {
    expect(readFarmModeEnabled('user-a')).toBe(false)
    expect(readFarmModeEnabled(null)).toBe(false)
    expect(readFarmModeEnabled(undefined)).toBe(false)
  })

  it('round-trips on and off', () => {
    writeFarmModeEnabled('user-a', true)
    expect(readFarmModeEnabled('user-a')).toBe(true)
    writeFarmModeEnabled('user-a', false)
    expect(readFarmModeEnabled('user-a')).toBe(false)
  })

  it('off removes the key instead of storing "0"', () => {
    writeFarmModeEnabled('user-a', true)
    writeFarmModeEnabled('user-a', false)
    expect(localStorage.getItem(farmModeStorageKey('user-a'))).toBeNull()
  })

  it('keys are per-user so a shared device does not leak the toggle', () => {
    writeFarmModeEnabled('user-a', true)
    expect(readFarmModeEnabled('user-b')).toBe(false)
  })

  it('ignores writes with no user id', () => {
    writeFarmModeEnabled(null, true)
    writeFarmModeEnabled(undefined, true)
    expect(localStorage.length).toBe(0)
  })
})
