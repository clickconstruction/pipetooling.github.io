import { describe, expect, it } from 'vitest'
import {
  BULK_DELETE_ALERT_DEFAULTS,
  parseBulkDeleteAlertEnabled,
  parseBulkDeleteAlertThreshold,
} from './appSettingsKeys'

describe('parseBulkDeleteAlertThreshold', () => {
  const FB = BULK_DELETE_ALERT_DEFAULTS.bundles // 5

  it('takes a sensible configured value', () => {
    expect(parseBulkDeleteAlertThreshold(12, FB)).toBe(12)
    expect(parseBulkDeleteAlertThreshold('12', FB)).toBe(12)
    expect(parseBulkDeleteAlertThreshold(' 12 ', FB)).toBe(12)
  })

  // The safety property: a mistyped threshold must never silence the alarm, and must never
  // turn it into 0 (which would fire on literally every delete).
  it.each([
    ['missing', null],
    ['undefined', undefined],
    ['blank', ''],
    ['garbage', 'abc'],
    ['zero', 0],
    ['negative', -5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('falls back to the default for %s rather than silencing or over-firing', (_label, input) => {
    expect(parseBulkDeleteAlertThreshold(input as number | string | null | undefined, FB)).toBe(FB)
  })

  it('floors fractional values (value_num is numeric(10,2), a threshold is a count)', () => {
    expect(parseBulkDeleteAlertThreshold(5.75, FB)).toBe(5)
  })

  it('clamps absurd values to the numeric(10,2) ceiling instead of overflowing', () => {
    expect(parseBulkDeleteAlertThreshold(1e12, FB)).toBe(99_999_999)
  })

  it('uses whichever fallback the caller passes', () => {
    expect(parseBulkDeleteAlertThreshold(null, BULK_DELETE_ALERT_DEFAULTS.rows)).toBe(200)
    expect(parseBulkDeleteAlertThreshold(null, BULK_DELETE_ALERT_DEFAULTS.lookbackHours)).toBe(168)
  })
})

describe('parseBulkDeleteAlertEnabled', () => {
  it('defaults to ON when unset — a missing setting must not silence the alarm', () => {
    expect(parseBulkDeleteAlertEnabled(null)).toBe(true)
    expect(parseBulkDeleteAlertEnabled(undefined)).toBe(true)
    expect(parseBulkDeleteAlertEnabled('')).toBe(true)
  })

  it('only the literal "false" turns it off', () => {
    expect(parseBulkDeleteAlertEnabled('false')).toBe(false)
    expect(parseBulkDeleteAlertEnabled('  false  ')).toBe(false)
    expect(parseBulkDeleteAlertEnabled('true')).toBe(true)
    expect(parseBulkDeleteAlertEnabled('nonsense')).toBe(true)
  })
})
