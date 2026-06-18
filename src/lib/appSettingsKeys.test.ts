import { describe, expect, it } from 'vitest'
import { parseHideDevTallyFlag } from './appSettingsKeys'

describe('parseHideDevTallyFlag', () => {
  it("is true only for the literal 'true' (trimmed)", () => {
    expect(parseHideDevTallyFlag('true')).toBe(true)
    expect(parseHideDevTallyFlag('  true  ')).toBe(true)
  })

  it('is false for any other value', () => {
    expect(parseHideDevTallyFlag('false')).toBe(false)
    expect(parseHideDevTallyFlag('1')).toBe(false)
    expect(parseHideDevTallyFlag('TRUE')).toBe(false)
    expect(parseHideDevTallyFlag('yes')).toBe(false)
    expect(parseHideDevTallyFlag('')).toBe(false)
  })

  it('is false for null/undefined (missing setting)', () => {
    expect(parseHideDevTallyFlag(null)).toBe(false)
    expect(parseHideDevTallyFlag(undefined)).toBe(false)
  })
})
