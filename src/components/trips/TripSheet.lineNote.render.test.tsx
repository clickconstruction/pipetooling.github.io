// @vitest-environment jsdom
/**
 * The trip sheet on a trip that is on a job's lines (punch list #391, PR 4): moving its billing off Extra is
 * allowed, and the sheet says the line stays. Every name here is made up.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { newTripRecord, type TripRecord } from '../../lib/trips/tripRecord'
import { TripSheet } from './TripSheet'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const NOTE = 'This trip is on J2101’s lines. Changing the billing leaves the line where it is.'
const TRIP: TripRecord = { ...newTripRecord({ id: 't14', developmentId: 'd1' }), tripNumber: 14, purpose: 'Reset the riser', billing: 'extra', people: [{ personId: null, userId: null, name: 'Dana', days: { '2026-11-03': 'site' } }] }

function draw(lineStaysNote: string | null, record: TripRecord = TRIP) {
  const onSave = vi.fn(async (_: TripRecord) => true)
  renderWithProviders(<TripSheet record={record} isNew={false} siteName="Heron Point" roster={[]} jobs={[]} todayYmd="2026-11-18" busy={false} lineStaysNote={lineStaysNote} onSave={onSave} onClose={vi.fn()} />)
  return { onSave }
}

describe('TripSheet — a trip that is on a job’s lines', () => {
  it('says nothing while the billing is Extra, and says the line stays once it is moved off Extra', async () => {
    const { onSave } = draw(NOTE)
    expect(screen.queryByTestId('trip-sheet-line-stays')).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Inside the price' }))
    expect(screen.getByTestId('trip-sheet-line-stays').textContent).toBe(NOTE)
    // The change is allowed: the trip saves with its new billing.
    fireEvent.click(screen.getByText('Save the trip'))
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ id: 't14', billing: 'inside' })
  })

  it('says it too when the billing is taken off altogether, and stops when Extra is put back', () => {
    draw(NOTE)
    fireEvent.click(screen.getByRole('radio', { name: 'Extra' }))
    expect(screen.getByTestId('trip-sheet-line-stays').textContent).toBe(NOTE)
    fireEvent.click(screen.getByRole('radio', { name: 'Extra' }))
    expect(screen.queryByTestId('trip-sheet-line-stays')).toBeNull()
  })

  it('a trip that holds no line never says it', () => {
    draw(null)
    fireEvent.click(screen.getByRole('radio', { name: 'Ours' }))
    expect(screen.queryByTestId('trip-sheet-line-stays')).toBeNull()
  })
})
