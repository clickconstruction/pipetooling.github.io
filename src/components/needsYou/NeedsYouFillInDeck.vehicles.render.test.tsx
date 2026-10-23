// @vitest-environment jsdom
/**
 * The Fill them in deck's vehicle kind (v2.5775, punch list #146): a vehicle row asks only for
 * its missing records, Save waits until each has a usable answer, the save goes through the io
 * with the Vehicles tab's writes, the trail says what was entered, and Undo hands the saved ids
 * back.
 */
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { vehicleFillInRows } from '../../lib/needsYou/fillInVehicles'
import type { VehicleFillInIo, VehicleSaved } from '../../lib/needsYou/fillInVehiclesIo'
import { NeedsYouFillInDeck } from './NeedsYouFillInDeck'
import type { FillInRow } from '../../hooks/useFillInRows'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))

const PLANS = [{ id: 'plan-1', name: 'Progressive fleet' }]
const rowsOf = () =>
  vehicleFillInRows(
    [
      { vehicleId: 'v-1', name: '2019 Ford F-250', holderUserId: 'u-m', holderName: 'Marco', missing: ['insurance', 'registration'], insuranceOnPlan: false },
      { vehicleId: 'v-2', name: '2017 Ram 2500', holderUserId: 'u-l', holderName: 'Luis', missing: ['service'], insuranceOnPlan: true },
    ],
    PLANS,
  )

function harness() {
  const saves: unknown[] = []
  const undos: VehicleSaved[] = []
  const io: VehicleFillInIo = {
    fetchGaps: async () => [],
    fetchPlans: async () => PLANS,
    save: async (w) => {
      saves.push(w)
      return { vehicleId: w.vehicleId, costsSet: Object.keys(w.vehiclePatch) as VehicleSaved['costsSet'], insurancePeriodId: w.insurancePeriod ? 'period-1' : null, serviceEventId: w.serviceEvent ? 'service-1' : null, odometerEntryId: w.odometerEntry ? 'odo-1' : null }
    },
    undo: async (s) => {
      undos.push(s)
    },
  }
  let rows: FillInRow[] = rowsOf()
  const lostBids = { fetchSources: async () => [], save: async () => ({ entryId: null }), undo: async () => {} }
  // The host drops a saved row and puts it back on Undo; the harness does the same and re-renders.
  function Host() {
    const [, bump] = useState(0)
    return (
      <NeedsYouFillInDeck
        rows={rows}
        loading={false}
        userId="u-1"
        role="assistant"
        startKind="vehicle"
        onRowSaved={(r) => {
          rows = rows.filter((x) => x.key !== r.key)
          bump((n) => n + 1)
        }}
        onRowRestored={(r) => {
          rows = [r, ...rows]
          bump((n) => n + 1)
        }}
        onExit={() => {}}
        io={{ lostBids, vehicles: io }}
      />
    )
  }
  const render = () => renderWithProviders(<Host />)
  return { render, saves, undos }
}

const trail = () => document.querySelector('[data-fill-in-trail]')?.textContent ?? ''

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  navigate.mockClear()
})

describe('NeedsYouFillInDeck · vehicles', () => {
  it('asks only for the missing records: the plan and both costs here, and Save waits for all of them', async () => {
    const h = harness()
    h.render()
    await settle()
    expect(screen.getByText('2019 Ford F-250 · Marco drives it · no insurance or registration on file')).toBeTruthy()
    expect(document.querySelector('[data-vehicle-part="insurance"]')).toBeTruthy()
    expect(document.querySelector('[data-vehicle-part="registration"]')).toBeTruthy()
    expect(document.querySelector('[data-vehicle-part="service"]')).toBeNull()
    expect(screen.getByText('It is not on an insurance plan.')).toBeTruthy()
    const save = () => screen.getByRole('button', { name: 'Save and next' }) as HTMLButtonElement
    expect(save().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Insurance cost'), { target: { value: '225' } })
    fireEvent.change(screen.getByLabelText('Registration cost'), { target: { value: '80' } })
    expect(save().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'plan-1' } })
    expect(save().disabled).toBe(false)
    fireEvent.click(save())
    await waitFor(() => expect(h.saves.length).toBe(1))
    await settle()
    expect(h.saves[0]).toMatchObject({ vehicleId: 'v-1', vehiclePatch: { weekly_insurance_cost: 51.92, weekly_registration_cost: 1.54 }, insurancePeriod: { plan_id: 'plan-1' }, serviceEvent: null })
    expect(trail()).toContain('insurance $51.92/wk on Progressive fleet · registration $1.54/wk · People → Vehicles has it')
    // The next row is the service-only truck, with its own block alone.
    expect(screen.getByText('2017 Ram 2500 · Luis drives it · no service on file')).toBeTruthy()
    expect(document.querySelector('[data-vehicle-part="service"]')).toBeTruthy()
    expect(document.querySelector('[data-vehicle-part="insurance"]')).toBeNull()
  })

  it('a service entry is ready as it opens (today, an oil change), takes the miles, and Undo hands the ids back', async () => {
    const h = harness()
    h.render()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await settle()
    expect(screen.getByText('2017 Ram 2500 · Luis drives it · no service on file')).toBeTruthy()
    const save = () => screen.getByRole('button', { name: 'Save and next' }) as HTMLButtonElement
    expect(save().disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('Odometer'), { target: { value: 'lots' } })
    expect(save().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Odometer'), { target: { value: '147,600' } })
    fireEvent.change(screen.getByLabelText('Service note'), { target: { value: 'Oil, filters' } })
    fireEvent.click(save())
    await waitFor(() => expect(h.saves.length).toBe(1))
    await settle()
    expect(h.saves[0]).toMatchObject({ vehicleId: 'v-2', vehiclePatch: {}, serviceEvent: { service_type: 'oil_change', odometer_value: 147_600, note: 'Oil, filters' }, odometerEntry: { odometer_value: 147_600 } })
    expect(trail()).toContain('oil change')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(h.undos.length).toBe(1))
    expect(h.undos[0]).toEqual({ vehicleId: 'v-2', costsSet: [], insurancePeriodId: null, serviceEventId: 'service-1', odometerEntryId: 'odo-1' })
  })
})
