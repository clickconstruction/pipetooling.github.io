// @vitest-environment jsdom
/**
 * Render smokes for Their numbers and the House numbers window (punch list #308, PR 2). The stub
 * answers every read with no rows and no error, which is the table live and empty.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { PartHouseNumbers } from './PartHouseNumbers'
import { HouseNumbersWindow } from './HouseNumbersWindow'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const houses = [{ id: 'hill', name: 'Hillcrest Supply' }, { id: 'bord', name: 'Borden Pipe & Supply' }]

describe('PartHouseNumbers', () => {
  it('draws a row for each house that prices the part, with a field for its number', async () => {
    renderWithProviders(<PartHouseNumbers partId="kit" supplyHouses={houses} pricedHouseIds={['hill']} />)
    expect(await screen.findByText('Their numbers')).toBeTruthy()
    expect(screen.getByText('Hillcrest Supply')).toBeTruthy()
    expect(screen.getByLabelText('Hillcrest Supply: their number for this part')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Keep' })).toBeTruthy()
    // Borden prices nothing here and has no number, so it waits under Another house.
    expect(screen.getByRole('option', { name: 'Borden Pipe & Supply' })).toBeTruthy()
  })
})

describe('HouseNumbersWindow', () => {
  it('opens on the count on file and says nothing is waiting when no name carries a number', async () => {
    renderWithProviders(<HouseNumbersWindow onClose={() => {}} />)
    expect(await screen.findByText('0 numbers on file.')).toBeTruthy()
    expect(screen.getByText('Nothing waiting on a number.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Keep numbers' }).hasAttribute('disabled')).toBe(true)
  })
})
