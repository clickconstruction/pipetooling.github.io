import { describe, expect, it } from 'vitest'
import { APP_SETTINGS_KEY_HOURLY_CHARGE_RATE_V1, DEFAULT_HOURLY_CHARGE_RATE, parseHourlyChargeRate } from './appSettingsKeys'

describe('the rate charged for an hour (punch list #251)', () => {
  it('names its row and seeds the owner’s number', () => {
    expect(APP_SETTINGS_KEY_HOURLY_CHARGE_RATE_V1).toBe('hourly_charge_rate_v1')
    expect(DEFAULT_HOURLY_CHARGE_RATE).toBe(285)
  })

  it('reads a number over zero to the cent and falls back to the default for anything else', () => {
    expect(parseHourlyChargeRate(310)).toBe(310)
    expect(parseHourlyChargeRate('295.505')).toBe(295.51)
    expect(parseHourlyChargeRate(0)).toBe(285)
    expect(parseHourlyChargeRate(-4)).toBe(285)
    expect(parseHourlyChargeRate(null)).toBe(285)
    expect(parseHourlyChargeRate(undefined)).toBe(285)
    expect(parseHourlyChargeRate('')).toBe(285)
    expect(parseHourlyChargeRate('abc')).toBe(285)
  })
})
