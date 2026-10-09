// @vitest-environment jsdom
/**
 * Wiring smoke for People → Vehicles → Wheels (Wheels PR 3, v2.5039): the trucks table shows each
 * truck's wear (a dash with no replacement value on file), the parked trucks carry it, and the
 * fleet's rate — the number Bids shows — sits under the trucks. The loader's suite holds the math.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const cost = (over: Record<string, unknown>) => ({ fuel: 0, insurance: 0, registration: 0, service: 0, wear: 0, hasReplacementValue: false, total: 0, ratePerFieldHour: null, fixedRatePerFieldHour: null, ...over })
const snapshot = {
  window: { start: '2026-07-12', end: '2026-10-09', days: 90 },
  rows: [],
  trucks: [
    { vehicleId: 'f1', name: '2021 Ford F-250', holderUserId: 'u-a', holderName: 'Mike Z', holderFieldHours: 8, cost: cost({ insurance: 642.86, registration: 64.29, service: 200, wear: 1800, hasReplacementValue: true, total: 2707.15, ratePerFieldHour: 338.39, fixedRatePerFieldHour: 338.39 }) },
    { vehicleId: 'f2', name: '2019 Ram 1500', holderUserId: 'u-b', holderName: 'Ana', holderFieldHours: 7.5, cost: cost({ registration: 45, total: 45, ratePerFieldHour: 6, fixedRatePerFieldHour: 6 }) },
    { vehicleId: 'f4', name: '2024 Ford Transit', holderUserId: null, holderName: null, holderFieldHours: 0, cost: cost({ wear: 493.15, hasReplacementValue: true, total: 493.15 }) },
  ],
  fuelTag: null,
  comparison: { ownAvg: null, companyAvg: null },
  unattributedFuelUsd: 0,
  unattributedCards: [],
  offCardFuelFamily: { usd: 0, n: 0, top: [] },
  companyCardSpend: { usd: 0, n: 0, byCard: [] },
  fleet: { fixedUsd: 3245.45, ratePerFieldHour: 180.3, fieldHours: 18, trucks: 3 },
}
const loadWheelsSnapshot = vi.fn(async () => snapshot)
vi.mock('../../lib/people/wheelsData', () => ({ loadWheelsSnapshot: () => loadWheelsSnapshot(), saveVehicleRateOverride: vi.fn() }))

import { PeopleVehiclesWheelsSection } from './PeopleVehiclesWheelsSection'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

describe('PeopleVehiclesWheelsSection · wear and the fleet rate (v2.5039)', () => {
  it('shows each truck’s wear, a dash with no value on file, and the fleet’s rate for Bids', async () => {
    renderWithProviders(<PeopleVehiclesWheelsSection users={[]} />)
    await settle()
    expect(screen.getByRole('columnheader', { name: 'Wear' })).toBeTruthy()
    const f1 = screen.getByText('2021 Ford F-250').closest('tr')!
    expect(within(f1).getByText('$1,800.00')).toBeTruthy()
    const f2 = screen.getByText('2019 Ram 1500').closest('tr')!
    expect(within(f2).getByTitle('No replacement value on file: add one on the vehicle and its wear counts').textContent).toBe('—')
    // a parked truck still carries its wear
    expect(screen.getByText('1 parked or unassigned: 2024 Ford Transit ($493.15 carried in the window)')).toBeTruthy()
    const fleet = screen.getByTestId('wheels-fleet-rate')
    expect(fleet.textContent).toBe('All 3 vehicles: $3,245.45 insurance, registration, service and wear ÷ 18 crew field h = $180.30/field h. Bids shows this beside the crew rate and never adds it.')
  })
})
