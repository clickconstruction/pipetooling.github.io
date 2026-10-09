/**
 * `fleet_truck_rate_per_field_hour` (Wheels PR 3, v2.5039) gives the Bids crew-rate card the number
 * People → Vehicles computes with `fleetTruckRate`. The SQL cannot run here, so these pin its newest
 * body to the kernel: the window, the wear life, the "field hours" filter, the insurance-plan and
 * replacement-value rules, and no fuel. Both were run over one fixture on a local Postgres and gave
 * $3,245.30 ÷ 18 field h = $180.29 (`wheelsData.test.ts` holds the same rows).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WHEELS_WEAR_LIFE_YEARS, WHEELS_WINDOW_DAYS, fieldHoursByUser, truckWearForWindow } from './wheels'

const MIGRATIONS = resolve(__dirname, '../../../supabase/migrations')
const newest = (() => {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => /CREATE (OR REPLACE )?FUNCTION public\.fleet_truck_rate_per_field_hour\(/.test(readFileSync(resolve(MIGRATIONS, f), 'utf8')))
  return readFileSync(resolve(MIGRATIONS, files[files.length - 1]!), 'utf8')
})()
const body = newest.slice(newest.indexOf('AS $$'), newest.lastIndexOf('$$;'))

describe('fleet_truck_rate_per_field_hour reads the trucks like People → Vehicles (v2.5039)', () => {
  it('the same 90-day window and five-year wear life', () => {
    expect(body).toContain(`v_days constant integer := ${WHEELS_WINDOW_DAYS};`)
    expect(body).toContain(`v_life_years constant integer := ${WHEELS_WEAR_LIFE_YEARS};`)
    expect(body).toContain('v_start := p_today - (v_days - 1);')
    expect(body).toContain('round(greatest(0, r.replacement_value) / (v_life_years * 365) * v_days, 2)')
    expect(truckWearForWindow(36_500, WHEELS_WINDOW_DAYS)).toBe(1800)
  })

  it('field hours are the sessions `fieldHoursByUser` counts: approved, closed, on a job and not a bid', () => {
    for (const clause of [
      's.job_ledger_id IS NOT NULL',
      's.bid_id IS NULL',
      's.approved_at IS NOT NULL',
      's.rejected_at IS NULL',
      's.revoked_at IS NULL',
      's.clocked_out_at IS NOT NULL',
      's.clocked_out_at > s.clocked_in_at',
      's.work_date BETWEEN v_start AND p_today',
    ]) {
      expect(body).toContain(clause)
    }
    const s = { user_id: 'u', job_ledger_id: 'j', bid_id: null, clocked_in_at: '2026-10-01T13:00:00Z', clocked_out_at: '2026-10-01T15:00:00Z', approved_at: 'x', rejected_at: null, revoked_at: null }
    expect(fieldHoursByUser([s, { ...s, bid_id: 'b' }, { ...s, approved_at: null }, { ...s, rejected_at: 'x' }, { ...s, revoked_at: 'x' }, { ...s, clocked_out_at: null }]).get('u')).toBe(2)
  })

  it('premium only while on a plan today; the latest value on or before today, $0 ending the wear; costed service in the window', () => {
    expect(body).toContain('p.start_date <= p_today AND (p.end_date IS NULL OR p.end_date >= p_today)')
    expect(body).toContain('WHERE r.vehicle_id = v.id AND r.read_date <= p_today\n')
    expect(body).toContain('ORDER BY r.read_date DESC')
    expect(body).toContain('e.service_date BETWEEN v_start AND p_today')
  })

  it('no fuel: fuel stays on the jobs', () => {
    expect(body).not.toMatch(/mercury|fuel_usd|card/i)
  })

  it('office and estimators only, returning the keys the card reads', () => {
    expect(body).toContain('IF NOT public.is_office_or_estimator() THEN')
    for (const key of ["'rate'", "'fixed_usd'", "'field_hours'", "'trucks'", "'days'"]) expect(body).toContain(key)
    expect(newest).toContain('SECURITY DEFINER')
    expect(newest).toContain("SET search_path = ''")
    expect(newest).toContain('REVOKE EXECUTE ON FUNCTION public.fleet_truck_rate_per_field_hour(date) FROM PUBLIC, anon;')
  })
})
