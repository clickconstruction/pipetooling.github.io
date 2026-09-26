// @vitest-environment jsdom
/**
 * Render smoke for the price-book entry form (Pricing decomposition PR 5): Combined mode's
 * one box lands in Rough In (v2.2644), Stage mode's three boxes and the read-only total, the
 * tab's error line, Delete only while editing, and the form closing itself after a delete
 * that went through.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PricingEntryFormModal, type PricingEntryFormProps } from './PricingEntryFormModal'
import type { PriceBookEntryWithFixture } from '../../lib/bids/bidPricingEngineTypes'
import { settle } from '../../test/renderSmokeMocks'

const toilet = { id: 'e1', version_id: 't1', fixture_type_id: 'f1', fixture_types: { name: 'Toilet' }, rough_in_price: 100, top_out_price: 50, trim_set_price: 25, total_price: 175 } as unknown as PriceBookEntryWithFixture

function props(over: Partial<PricingEntryFormProps> = {}): PricingEntryFormProps {
  return {
    editing: null,
    error: null,
    fixtureName: '',
    onFixtureNameChange: vi.fn(),
    fixtureTypes: [{ id: 'f1', name: 'Toilet' }],
    priceMode: 'combined',
    combinedPrice: '',
    onCombinedPriceChange: vi.fn(),
    roughIn: '0',
    onRoughInChange: vi.fn(),
    topOut: '50',
    onTopOutChange: vi.fn(),
    trimSet: '25',
    onTrimSetChange: vi.fn(),
    total: '75',
    saving: false,
    onSubmit: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
    onClose: vi.fn(),
    onDelete: vi.fn(async () => true),
    ...over,
  }
}

describe('PricingEntryFormModal', () => {
  it('Combined mode: one Price box, and a typed price lands in Rough In net of the other stages', async () => {
    // A fixture name so the required field lets the form submit.
    const p = props({ fixtureName: 'Lavatory' })
    render(<PricingEntryFormModal {...p} />)
    await settle()
    expect(screen.getByText('New entry')).toBeTruthy()
    expect(screen.getByText('Price')).toBeTruthy()
    expect(screen.queryByText('Rough In')).toBeNull()
    expect(screen.queryByText('Delete')).toBeNull()
    const price = screen.getByText('Price').parentElement!.querySelector('input')!
    fireEvent.change(price, { target: { value: '200' } })
    expect(p.onCombinedPriceChange).toHaveBeenCalledWith('200')
    expect(p.onRoughInChange).toHaveBeenCalledWith('125')
    fireEvent.change(screen.getByPlaceholderText('Type or select fixture type...'), { target: { value: 'Lav' } })
    expect(p.onFixtureNameChange).toHaveBeenCalledWith('Lav')
    fireEvent.click(screen.getByText('Save'))
    expect(p.onSubmit).toHaveBeenCalledTimes(1)
  })

  it('Stage mode: three stage boxes plus a read-only total; the tab’s error shows above the form', async () => {
    render(<PricingEntryFormModal {...props({ priceMode: 'stage', error: 'Fixture name is required' })} />)
    await settle()
    expect(screen.getByText('Fixture name is required')).toBeTruthy()
    expect(screen.getByText('Rough In')).toBeTruthy()
    expect(screen.getByText('Trim Set')).toBeTruthy()
    const total = screen.getByText('Total (auto-calculated)').parentElement!.querySelector('input')!
    expect(total.readOnly).toBe(true)
    expect(total.value).toBe('75')
  })

  it('editing: Delete is offered, and the form closes itself once the delete went through', async () => {
    const p = props({ editing: toilet, fixtureName: 'Toilet' })
    render(<PricingEntryFormModal {...p} />)
    await settle()
    expect(screen.getByText('Edit entry')).toBeTruthy()
    fireEvent.click(screen.getByText('Delete'))
    expect(p.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }))
    await waitFor(() => expect(p.onClose).toHaveBeenCalledTimes(1))
  })

  it('a refused delete leaves the form open', async () => {
    const p = props({ editing: toilet, onDelete: vi.fn(async () => false) })
    render(<PricingEntryFormModal {...p} />)
    await settle()
    fireEvent.click(screen.getByText('Delete'))
    await Promise.resolve()
    expect(p.onClose).not.toHaveBeenCalled()
  })
})
