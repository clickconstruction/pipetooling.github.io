import { describe, expect, it } from 'vitest'
import {
  BILLABLE_TURNAWAY_REASONS,
  buildTripChargeClosedNote,
  buildTripChargeMemo,
  isBillableTurnawayReason,
  resolveTripChargeDefaultAmount,
  tripChargeSettingsKey,
} from './turnawayTripCharge'

describe('isBillableTurnawayReason', () => {
  it('accepts the two billable reasons and rejects other/null', () => {
    expect(isBillableTurnawayReason('client_not_home')).toBe(true)
    expect(isBillableTurnawayReason('site_not_ready')).toBe(true)
    expect(isBillableTurnawayReason('other')).toBe(false)
    expect(isBillableTurnawayReason(null)).toBe(false)
    expect(isBillableTurnawayReason(undefined)).toBe(false)
  })
})

describe('tripChargeSettingsKey', () => {
  it('maps each billable reason to its seeded app_settings key', () => {
    expect(tripChargeSettingsKey('client_not_home')).toBe('trip_charge_client_not_home')
    expect(tripChargeSettingsKey('site_not_ready')).toBe('trip_charge_site_not_ready')
  })
})

describe('resolveTripChargeDefaultAmount', () => {
  const rows = [
    { key: 'trip_charge_client_not_home', value_num: 95 },
    { key: 'trip_charge_site_not_ready', value_num: null },
  ]

  it('returns the configured positive amount', () => {
    expect(resolveTripChargeDefaultAmount('client_not_home', rows)).toBe(95)
  })

  it('returns null for NULL, missing, zero, or negative values', () => {
    expect(resolveTripChargeDefaultAmount('site_not_ready', rows)).toBeNull()
    expect(resolveTripChargeDefaultAmount('client_not_home', [])).toBeNull()
    expect(
      resolveTripChargeDefaultAmount('client_not_home', [
        { key: 'trip_charge_client_not_home', value_num: 0 },
      ]),
    ).toBeNull()
    expect(
      resolveTripChargeDefaultAmount('client_not_home', [
        { key: 'trip_charge_client_not_home', value_num: -5 },
      ]),
    ).toBeNull()
  })
})

describe('buildTripChargeMemo', () => {
  // Must match the SQL literal `'Trip charge — ' || v_reason_label` in
  // supabase/migrations/20260709130000_turnaway_trip_charge.sql.
  it('matches the RPC memo literal for every billable reason', () => {
    expect(buildTripChargeMemo('client_not_home')).toBe('Trip charge — client not home')
    expect(buildTripChargeMemo('site_not_ready')).toBe('Trip charge — site not ready')
  })
})

describe('buildTripChargeClosedNote', () => {
  // Mirrors the RPC's to_char(v_amount, 'FM999,999,990.00') closed_note.
  it('formats amount with thousands separator and two decimals', () => {
    expect(buildTripChargeClosedNote(1250, 'client_not_home')).toBe(
      'Trip charge created — $1,250.00 (client not home)',
    )
    expect(buildTripChargeClosedNote(95.5, 'site_not_ready')).toBe(
      'Trip charge created — $95.50 (site not ready)',
    )
  })
})

describe('BILLABLE_TURNAWAY_REASONS', () => {
  it('contains exactly the two fee categories', () => {
    expect(BILLABLE_TURNAWAY_REASONS).toEqual(['client_not_home', 'site_not_ready'])
  })
})
