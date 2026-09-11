import { describe, expect, it } from 'vitest'
import { parseHideDevTallyFlag, DEFAULT_LABOR_BURDEN_FACTOR, parseLaborBurdenFactor } from './appSettingsKeys'

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

describe('parseLaborBurdenFactor', () => {
  it('reads a sane factor and falls back to 1.20 for blanks, garbage, or anything outside 1–3', () => {
    expect(parseLaborBurdenFactor(1.35)).toBe(1.35)
    expect(parseLaborBurdenFactor('1.2')).toBe(1.2)
    expect(parseLaborBurdenFactor(null)).toBe(DEFAULT_LABOR_BURDEN_FACTOR)
    expect(parseLaborBurdenFactor('')).toBe(DEFAULT_LABOR_BURDEN_FACTOR)
    expect(parseLaborBurdenFactor('x')).toBe(DEFAULT_LABOR_BURDEN_FACTOR)
    expect(parseLaborBurdenFactor(0.8)).toBe(DEFAULT_LABOR_BURDEN_FACTOR)
    expect(parseLaborBurdenFactor(5)).toBe(DEFAULT_LABOR_BURDEN_FACTOR)
  })
})
