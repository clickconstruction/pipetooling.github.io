// @vitest-environment jsdom
/**
 * Render smoke for the v2.1648 Dashboard "My Vehicle" card: a held vehicle
 * renders with mileage/oil/problem chips and the two field actions; the
 * report form opens inline with severity pills.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import DashboardMyVehicleCard from './DashboardMyVehicleCard'
import { renderWithProviders } from '../test/renderSmokeMocks'

const now = new Date()
const TODAY = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

const TABLE_ROWS: Record<string, unknown[]> = {
  vehicle_possessions: [
    { vehicle_id: 'v1', start_date: '2026-01-03', end_date: null },
  ],
  vehicles: [
    { id: 'v1', year: 2019, make: 'Ram', model: 'ProMaster', vin: null, oil_change_interval_miles: 5000 },
    { id: 'v2', year: 2021, make: 'Ford', model: 'F250', vin: null, oil_change_interval_miles: 5000, oil_suggest_window_miles: 1000, oil_require_past_due_miles: 0 },
    { id: 'v3', year: 2016, make: 'Chevy', model: 'Express', vin: null, oil_change_interval_miles: 5000, oil_suggest_window_miles: 1000, oil_require_past_due_miles: 0 },
  ],
  vehicle_odometer_entries: [
    { id: 'r1', vehicle_id: 'v1', odometer_value: 121480, read_date: TODAY, created_at: null, created_by: 'u2' },
    { id: 'r2', vehicle_id: 'v2', odometer_value: 120600, read_date: TODAY, created_at: null, created_by: 'u2' },
    { id: 'r3', vehicle_id: 'v3', odometer_value: 122100, read_date: TODAY, created_at: null, created_by: 'u2' },
  ],
  vehicle_service_events: [
    { id: 's1', vehicle_id: 'v1', service_type: 'oil_change', service_date: '2026-05-02', odometer_value: 118000, cost: null, note: null, created_at: null, created_by: null },
    { id: 's2', vehicle_id: 'v2', service_type: 'oil_change', service_date: '2026-05-02', odometer_value: 115000, cost: null, note: null, created_at: null, created_by: null },
    { id: 's3', vehicle_id: 'v3', service_type: 'oil_change', service_date: '2026-06-02', odometer_value: 118000, cost: null, note: null, created_at: null, created_by: null },
  ],
  vehicle_problem_reports: [
    { id: 'q1', vehicle_id: 'v1', description: 'Slow leak rear right', severity: 'monitor', report_date: '2026-08-01', reported_by: 'u2', resolved_at: null, resolved_by: null, resolution_note: null, created_at: null },
  ],
}

vi.mock('../lib/supabase', () => {
  function makeBuilder(rows: unknown[]): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'order', 'range', 'limit', 'or', 'lte', 'is']) {
      builder[m] = () => builder
    }
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null, count: rows.length }).then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []),
    },
  }
})

describe('DashboardMyVehicleCard', () => {
  it('renders the held vehicle with chips and field actions', async () => {
    renderWithProviders(<DashboardMyVehicleCard userId="u2" />)

    expect(await screen.findByText('My Vehicle')).toBeTruthy()
    expect(screen.getByText('2019 Ram ProMaster')).toBeTruthy()
    expect(screen.getByText(/121,480 mi · today/)).toBeTruthy()
    // Oil: last change 118,000 + 5,000 interval vs 121,480 → due in 1,520? No —
    // 123,000 - 121,480 = 1,520 > 1,000 → OK chip.
    expect(screen.getByText('Oil OK · next 123,000')).toBeTruthy()
    expect(screen.getByText('1 open problem')).toBeTruthy()
    expect(screen.getAllByPlaceholderText('Odometer today').length).toBe(3)
    expect(screen.getAllByRole('button', { name: 'Send reading' }).length).toBe(3)

    // Oil banners (fleet phase 7): v2 is 600 mi past due with require=0 →
    // required (red); v3 has 900 mi remaining inside the 1,000 window →
    // suggested (amber).
    expect(screen.getByText('Oil change required')).toBeTruthy()
    expect(screen.getByText(/600 mi overdue/)).toBeTruthy()
    expect(screen.getByText('Oil change suggested')).toBeTruthy()
    expect(screen.getByText(/due in 900 mi/)).toBeTruthy()

    // The report form opens inline with severity pills.
    fireEvent.click(screen.getAllByRole('button', { name: 'Report problem' })[0]!)
    expect(await screen.findByPlaceholderText(/What's wrong/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Urgent' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send to the office' })).toBeTruthy()
  })
})
