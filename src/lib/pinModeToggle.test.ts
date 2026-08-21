// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { pinModeStorageKey, readPinModeEnabled, writePinModeEnabled } from './pinModeToggle'

describe('pinModeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to off when unset or for a missing user id', () => {
    expect(readPinModeEnabled('user-a')).toBe(false)
    expect(readPinModeEnabled(null)).toBe(false)
    expect(readPinModeEnabled(undefined)).toBe(false)
  })

  it('round-trips on and off', () => {
    writePinModeEnabled('user-a', true)
    expect(readPinModeEnabled('user-a')).toBe(true)
    writePinModeEnabled('user-a', false)
    expect(readPinModeEnabled('user-a')).toBe(false)
  })

  it('off removes the key instead of storing "0"', () => {
    writePinModeEnabled('user-a', true)
    writePinModeEnabled('user-a', false)
    expect(localStorage.getItem(pinModeStorageKey('user-a'))).toBeNull()
  })

  it('keys are per-user so a shared device does not leak the toggle', () => {
    writePinModeEnabled('user-a', true)
    expect(readPinModeEnabled('user-b')).toBe(false)
  })

  it('ignores writes with no user id', () => {
    writePinModeEnabled(null, true)
    writePinModeEnabled(undefined, true)
    expect(localStorage.length).toBe(0)
  })
})
