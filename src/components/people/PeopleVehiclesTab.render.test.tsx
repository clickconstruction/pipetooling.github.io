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
  ],
  vehicle_possessions: [
    { id: 'p1', vehicle_id: 'v1', user_id: 'u2', start_date: '2026-01-03', end_date: null, created_at: null },
  ],
  vehicle_odometer_entries: [
    { id: 'r1', vehicle_id: 'v1', odometer_value: 121480, read_date: TODAY, created_at: null, created_by: 'u3' },
  ],
  vehicle_replacement_value_entries: [],
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
    expect(screen.getByText('2 vehicles')).toBeTruthy()
    expect(await screen.findByText(/121,480 mi · today/)).toBeTruthy()
    expect(screen.getByText('1 unassigned')).toBeTruthy()
    expect(screen.getByText('1 need a reading')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Hand off' }).length).toBe(1)
    expect(screen.getAllByRole('button', { name: 'Assign' }).length).toBe(1)

    // Click through to the panel: quick odometer entry + ledger rows appear.
    fireEvent.click(screen.getByText('2019 Ram ProMaster'))
    expect(await screen.findByText('Current odometer')).toBeTruthy()
    expect(screen.getByPlaceholderText('Miles')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save reading' })).toBeTruthy()
    expect(screen.getByText('Ledger')).toBeTruthy()
    expect(await screen.findByText('Reading entered by Danielle')).toBeTruthy()
    expect(screen.getByText('Assigned to Tristen')).toBeTruthy()
    expect(screen.getByRole('button', { name: '← All vehicles' })).toBeTruthy()
  })
})
