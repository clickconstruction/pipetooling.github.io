import { describe, it, expect } from 'vitest'
import { detectIsIOS, detectIsStandalone } from './iosPwa'

describe('detectIsIOS', () => {
  it('detects iPhone', () => {
    expect(
      detectIsIOS({
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        platform: 'iPhone',
        maxTouchPoints: 5,
      })
    ).toBe(true)
  })

  it('detects iPad with legacy user agent', () => {
    expect(
      detectIsIOS({
        ua: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        platform: 'iPad',
        maxTouchPoints: 5,
      })
    ).toBe(true)
  })

  it('detects iPadOS that masquerades as a Mac (has touch points)', () => {
    expect(
      detectIsIOS({
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      })
    ).toBe(true)
  })

  it('does not flag a real Mac (no touch points)', () => {
    expect(
      detectIsIOS({
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      })
    ).toBe(false)
  })

  it('does not flag Android', () => {
    expect(
      detectIsIOS({
        ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome',
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
      })
    ).toBe(false)
  })

  it('does not flag desktop Windows', () => {
    expect(
      detectIsIOS({
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome',
        platform: 'Win32',
        maxTouchPoints: 0,
      })
    ).toBe(false)
  })
})

describe('detectIsStandalone', () => {
  it('true when navigator.standalone is true (iOS webclip)', () => {
    expect(detectIsStandalone({ navStandalone: true, displayModeStandalone: false })).toBe(true)
  })

  it('true when display-mode is standalone', () => {
    expect(detectIsStandalone({ navStandalone: undefined, displayModeStandalone: true })).toBe(true)
  })

  it('false in a normal browser tab', () => {
    expect(detectIsStandalone({ navStandalone: false, displayModeStandalone: false })).toBe(false)
  })

  it('false when no signal is present', () => {
    expect(detectIsStandalone({ navStandalone: undefined, displayModeStandalone: false })).toBe(false)
  })
})
