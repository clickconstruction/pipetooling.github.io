// @vitest-environment jsdom
/**
 * Render smokes for One price (punch list #308, PR 3). The stub answers every read with no rows, so
 * no number is on file and no price is on file: the cards here rest on the model number and the words.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { QuickPriceWindow } from './QuickPriceWindow'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

// Every house, part, number and price here is made up.
const houses = [{ id: 'hill', name: 'Hillcrest Supply' }, { id: 'bord', name: 'Borden Pipe & Supply' }]
const parts = [
  { id: 'kit', name: 'AX8802XL-LR-PC ARLO SUPPLY KIT 1/2IPS X 3/8OD', manufacturer: 'Arlo' },
  { id: 'trap', name: 'AX87029-BPC ARLO 1-1/2 17GA P-TRAP', manufacturer: 'Arlo' },
  { id: 'trapBare', name: 'AX8702-9BPC', manufacturer: null },
]

function paste(text: string) {
  fireEvent.change(screen.getByLabelText('A row from a quote or a mail'), { target: { value: text } })
}

describe('QuickPriceWindow', () => {
  it('a pasted row finds its part by the model number, asks the house, then offers the one press', async () => {
    renderWithProviders(<QuickPriceWindow onClose={() => {}} serviceTypeId="st1" supplyHouses={houses} knownParts={parts} />)
    await settle()
    paste('512207  ARLO AX8802XL LR PC SUPPLY KIT  18.40')
    expect(await screen.findByText('Which house?')).toBeTruthy()
    expect(screen.getByText('Say which supply house this price is from.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Supply house'), { target: { value: 'hill' } })
    expect(await screen.findByText('Same model number')).toBeTruthy()
    expect(screen.getByText('AX8802XL-LR-PC ARLO SUPPLY KIT 1/2IPS X 3/8OD')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Same part · file $18.40' })).toBeTruthy()
  })

  it('a model number on two parts asks which one, and a pick becomes the press', async () => {
    renderWithProviders(<QuickPriceWindow onClose={() => {}} serviceTypeId="st1" supplyHouses={houses} knownParts={parts} />)
    await settle()
    fireEvent.change(screen.getByLabelText('Supply house'), { target: { value: 'hill' } })
    paste('318002 AX87029BPC ARLO P-TRAP 14.25')
    expect(await screen.findByText('Two parts on file')).toBeTruthy()
    const picks = screen.getAllByRole('button', { name: 'Use this one' })
    expect(picks).toHaveLength(2)
    fireEvent.click(picks[0]!)
    expect(await screen.findByText('Your pick')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'File $14.25' })).toBeTruthy()
  })

  it('nothing on file offers a new part on a press; a price by the hundred asks its unit', async () => {
    renderWithProviders(<QuickPriceWindow onClose={() => {}} serviceTypeId="st1" supplyHouses={houses} knownParts={parts} />)
    await settle()
    fireEvent.change(screen.getByLabelText('Supply house'), { target: { value: 'bord' } })
    paste('702291 NORDIC NW-2BL BI-LEVEL COOLER 1,284.00\nAX8802XL-LR-PC ARLO SUPPLY KIT 38.40 C')
    expect(await screen.findByText('Nothing on file')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New part in the book · file $1,284.00' })).toBeTruthy()
    expect(screen.getByText('Unit differs')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'File $0.38 each' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'It is $38.40 each' })).toBeTruthy()
  })

  it('opened from a part, it asks only the house, the number and the price', async () => {
    renderWithProviders(<QuickPriceWindow onClose={() => {}} serviceTypeId="" presetPart={{ id: 'kit', name: 'AX8802XL-LR-PC ARLO SUPPLY KIT' }} supplyHouses={houses} />)
    await settle()
    expect(screen.getByRole('heading', { name: 'A price for this part' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Phone' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.change(screen.getByLabelText('Supply house'), { target: { value: 'hill' } })
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '312.50' } })
    expect(await screen.findByRole('button', { name: 'File $312.50' })).toBeTruthy()
    expect(screen.queryByLabelText('A row from a quote or a mail')).toBeNull()
  })
})
