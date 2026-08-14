// @vitest-environment jsdom
/**
 * Render smoke for the v2.1644 Vehicles fleet board: canned vehicles +
 * possessions + readings render as cards with holder, mileage/freshness, and
 * summary chips; clicking a card opens the ledger panel with the quick
 * odometer entry.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import PeopleVehiclesTab from './PeopleVehiclesTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const now = new Date()
const TODAY = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

const TABLE_ROWS: Record<string, unknown[]> = {
  vehicles: [
    { id: 'v1', year: 2019, make: 'Ram', model: 'ProMaster', vin: '3C6TRVDG7KE503K92', weekly_insurance_cost: 48, weekly_registration_cost: 13.5 },
    { id: 'v2', year: 2024, make: 'Chevy', model: 'Silverado', vin: null, weekly_insurance_cost: 0, weekly_registration_cost: 0 },
    { id: 'v3', year: 2000, make: 'Ford', model: 'F650', vin: null, weekly_insurance_cost: 0, weekly_registration_cost: 0 },
  ],
  vehicle_possessions: [
    { id: 'p1', vehicle_id: 'v1', user_id: 'u2', start_date: '2026-01-03', end_date: null, created_at: null },
    { id: 'p2', vehicle_id: 'v3', user_id: null, start_date: '2026-08-01', end_date: null, created_at: null },
  ],
  vehicle_odometer_entries: [
    { id: 'r1', vehicle_id: 'v1', odometer_value: 121480, read_date: TODAY, created_at: null, created_by: 'u3' },
  ],
  vehicle_replacement_value_entries: [],
  vehicle_service_events: [
    { id: 's1', vehicle_id: 'v1', service_type: 'oil_change', service_date: '2026-05-02', odometer_value: 115000, cost: 89, note: 'Take 5', created_at: null, created_by: null },
  ],
  vehicle_problem_reports: [
    { id: 'q1', vehicle_id: 'v1', description: 'Brakes grinding front left', severity: 'needs_service', report_date: '2026-08-09', reported_by: 'u2', resolved_at: null, resolved_by: null, resolution_note: null, created_at: null },
  ],
  vehicle_insurance_plans: [
    { id: 'plan1', name: 'Progressive Commercial', carrier: 'Progressive', policy_number: '83-JX2-99', renewal_date: null, note: null },
  ],
  vehicle_insurance_periods: [
    { id: 'i1', vehicle_id: 'v1', plan_id: 'plan1', start_date: '2026-06-12', end_date: null, created_at: null },
    { id: 'i0', vehicle_id: 'v2', plan_id: 'plan1', start_date: '2026-01-09', end_date: '2026-05-30', created_at: null },
    { id: 'i2', vehicle_id: 'v3', plan_id: 'plan1', start_date: '2026-02-01', end_date: null, created_at: null },
  ],
}

vi.mock('../../lib/supabase', () => {
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

const USERS = [
  { id: 'u2', email: null, name: 'Tristen', role: 'master_technician', notes: null, phone: null },
  { id: 'u3', email: null, name: 'Danielle', role: 'assistant', notes: null, phone: null },
]

describe('PeopleVehiclesTab fleet board', () => {
  it('renders cards with holder + freshness and opens the ledger panel with quick entry', async () => {
    renderWithProviders(<PeopleVehiclesTab users={USERS} />)

    // Board: both vehicles render as cards; the held one shows its holder, the
    // other shows Unassigned + amber chips in the summary row.
    expect(await screen.findByText('2019 Ram ProMaster')).toBeTruthy()
    expect(screen.getByText('2024 Chevy Silverado')).toBeTruthy()
    expect(screen.getByText('Tristen')).toBeTruthy()
    expect(screen.getByText('Unassigned')).toBeTruthy()
    expect(screen.getByText('3 vehicles')).toBeTruthy()
    expect(await screen.findByText(/121,480 mi · today/)).toBeTruthy()
    expect(screen.getByText('1 unassigned')).toBeTruthy()
    expect(screen.getByText('2 need a reading')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Hand off' }).length).toBe(2)
    expect(screen.getAllByRole('button', { name: 'Assign' }).length).toBe(1)

    // Motor pool (fleet phase 6): the board groups Active vs Inactive; the
    // parked card reads Motor pool (calm, dated) while Unassigned stays amber,
    // and the summary counts the pool separately.
    expect(screen.getByText('Active (1)')).toBeTruthy()
    expect(screen.getByText('Inactive (2)')).toBeTruthy()
    expect(screen.getByText('Motor pool')).toBeTruthy()
    expect(screen.getByText(/parked since/)).toBeTruthy()
    expect(screen.getByText('1 in motor pool')).toBeTruthy()

    // Insurance (fleet phase 5): the covered card names its plan with the on
    // date, the lapsed one shows the amber line with the off date, the summary
    // row counts it, and the header offers the plans manager. The parked-but-
    // covered card carries the "still insured while parked" nudge.
    expect(screen.getAllByText('Progressive Commercial').length).toBe(2)
    expect(screen.getAllByText(/on plan since/).length).toBe(2)
    expect(screen.getByText('Not on insurance')).toBeTruthy()
    expect(screen.getByText(/off since/)).toBeTruthy()
    expect(screen.getByText('1 not on insurance')).toBeTruthy()
    expect(screen.getByText(/still insured while parked/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Insurance plans' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add to plan' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Change' }).length).toBe(2)

    // Click through to the panel: quick odometer entry + ledger rows appear.
    fireEvent.click(screen.getByText('2019 Ram ProMaster'))
    expect(await screen.findByText('Current odometer')).toBeTruthy()
    expect(screen.getByPlaceholderText('Miles')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save reading' })).toBeTruthy()
    expect(screen.getByText('Ledger')).toBeTruthy()
    expect(await screen.findByText('Reading entered by Danielle')).toBeTruthy()
    expect(screen.getByText('Assigned to Tristen')).toBeTruthy()
    expect(screen.getByRole('button', { name: '← All vehicles' })).toBeTruthy()

    // v2.1645: service stream — the Log service action, the ledger row with
    // note + cost, and the oil chip derived from last oil change vs latest
    // reading (115,000 + 5,000 interval vs 121,480 → overdue 1,480).
    expect(screen.getByRole('button', { name: 'Log service' })).toBeTruthy()
    expect(screen.getByText('Oil change · Take 5 · $89.00')).toBeTruthy()
    expect(screen.getAllByText('Oil overdue 1,480 mi').length).toBeGreaterThan(0)

    // v2.1647: problem reports — Report problem action, the Open problems
    // block with severity chip + Resolve, and the ledger's Problem row.
    expect(screen.getByRole('button', { name: 'Report problem' })).toBeTruthy()
    expect(screen.getByText('Open problems (1)')).toBeTruthy()
    expect(screen.getByText('Needs service')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeTruthy()
    expect(screen.getByText('Brakes grinding front left — reported by Tristen')).toBeTruthy()
  })
})
