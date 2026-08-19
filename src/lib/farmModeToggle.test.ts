// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  farmModeStorageKey,
  readFarmModeEnabled,
  writeFarmModeEnabled,
} from './farmModeToggle'

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
