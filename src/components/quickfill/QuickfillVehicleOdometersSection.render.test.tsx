// @vitest-environment jsdom
/**
 * Render smoke for the Quickfill "Vehicle check-ins" station (v2.2199):
 * person-held vehicles with week-stale readings list with holder call links,
 * inline miles entry, and the check-in question checkboxes; motor-pool
 * vehicles ride the monthly cadence ("walk out & check"); fresh and
 * unassigned vehicles are skipped.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { QuickfillVehicleOdometersSection } from './QuickfillVehicleOdometersSection'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const now = new Date()
function ymdMinusDays(days: number): string {
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const TABLE_ROWS: Record<string, unknown[]> = {
  users: [
    { id: 'u1', name: 'Abraham', phone: '210-555-0101', role: 'dev' },
    { id: 'u2', name: 'Trace', phone: null, role: 'master_technician' },
  ],
  pay_approved_masters: [],
  vehicles: [
    { id: 'v1', year: 2019, make: 'Ford', model: 'F250', vin: '1FT7W2BT1KE1641X' },
    { id: 'v2', year: 2021, make: 'Ford', model: 'Transit', vin: null },
    { id: 'v3', year: 2000, make: 'Ford', model: 'F650', vin: null },
    { id: 'v4', year: 2007, make: 'Dodge', model: 'Ram', vin: null },
  ],
  vehicle_possessions: [
    { id: 'p1', vehicle_id: 'v1', user_id: 'u1', start_date: '2026-01-01', end_date: null, created_at: null },
    { id: 'p2', vehicle_id: 'v2', user_id: 'u1', start_date: '2026-01-01', end_date: null, created_at: null },
    { id: 'p3', vehicle_id: 'v3', user_id: null, start_date: '2026-08-01', end_date: null, created_at: null },
    { id: 'p4', vehicle_id: 'v4', user_id: 'u2', start_date: '2026-02-01', end_date: null, created_at: null },
  ],
  vehicle_odometer_entries: [
    { id: 'r1', vehicle_id: 'v1', odometer_value: 229950, read_date: ymdMinusDays(12), created_at: null },
    { id: 'r2', vehicle_id: 'v2', odometer_value: 84120, read_date: ymdMinusDays(2), created_at: null },
  ],
}

vi.mock('../../lib/supabase', () => {
  function makeBuilder(rows: unknown[]): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'order', 'range', 'limit', 'or', 'lte', 'gte', 'is', 'not']) {
      builder[m] = () => builder
    }
    builder.single = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    builder.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null })
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

describe('QuickfillVehicleOdometersSection', () => {
  it('lists stale person-held + motor-pool vehicles with call links, miles entry, and questions', async () => {
    renderWithProviders(<QuickfillVehicleOdometersSection />)

    // v1: Abraham, 12d stale → listed with a tel: link. v4: Trace, never read →
    // listed with the no-phone note. v3 motor pool, never read → listed on the
    // monthly cadence with "walk out & check". v2 fresh is out.
    expect(await screen.findByText('2019 Ford F250')).toBeTruthy()
    expect(screen.getByText('2007 Dodge Ram')).toBeTruthy()
    expect(screen.getByText('2000 Ford F650')).toBeTruthy()
    expect(screen.queryByText('2021 Ford Transit')).toBeNull()

    const call = screen.getByTitle('Call Abraham (210-555-0101)') as HTMLAnchorElement
    expect(call.getAttribute('href')).toBe('tel:210-555-0101')
    expect(screen.getByText('Trace')).toBeTruthy()
    expect(screen.getByText('(no phone)')).toBeTruthy()
    expect(screen.getByText(/walk out & check/)).toBeTruthy()
    expect(screen.getByText('Motor pool · monthly')).toBeTruthy()
    expect(screen.getAllByText('weekly').length).toBe(2)
    expect(screen.getByText(/12d ago/)).toBeTruthy()
    expect(screen.getAllByText('no reading yet').length).toBe(2)

    // Default check-in question renders as a checkbox on every row; the
    // required note box only appears once the box is checked.
    expect(screen.getAllByText('Any lights on the dash?').length).toBe(3)
    expect(screen.queryByPlaceholderText('What did you see? (required)')).toBeNull()

    expect(screen.getByLabelText('Odometer for 2019 Ford F250')).toBeTruthy()
    expect(screen.getByLabelText('Odometer for 2007 Dodge Ram')).toBeTruthy()
    expect(screen.getByLabelText('Odometer for 2000 Ford F650')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Save' }).length).toBe(3)
  })
})
