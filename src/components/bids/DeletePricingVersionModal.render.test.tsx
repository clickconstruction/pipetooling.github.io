// @vitest-environment jsdom
/**
 * Render smoke for the delete-a-price-option dialog (Pricing decomposition PR 5): the book
 * is named, Delete stays off until something is typed, the tab's mismatch line shows, and
 * both doors report.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DeletePricingVersionModal } from './DeletePricingVersionModal'
import type { PriceBookVersion } from '../../lib/bids/bidPricingEngineTypes'

const wendi = { id: 't2', name: 'WENDI', bid_id: null, is_robot: false, sort_order: 0 } as unknown as PriceBookVersion

function props(over: Partial<Parameters<typeof DeletePricingVersionModal>[0]> = {}) {
  return { version: wendi, nameInput: '', onNameChange: vi.fn(), error: null, onConfirm: vi.fn(), onClose: vi.fn(), ...over }
}

describe('DeletePricingVersionModal', () => {
  it('names the book and keeps Delete off until a name is typed', () => {
    const p = props()
    render(<DeletePricingVersionModal {...p} />)
    expect(screen.getByText('Delete price option')).toBeTruthy()
    expect(screen.getByText('WENDI')).toBeTruthy()
    const del = screen.getByText('Delete') as HTMLButtonElement
    expect(del.disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText('WENDI'), { target: { value: 'W' } })
    expect(p.onNameChange).toHaveBeenCalledWith('W')
    fireEvent.click(screen.getByText('Cancel'))
    expect(p.onClose).toHaveBeenCalledTimes(1)
  })

  it('with a name typed, Delete confirms; the tab’s error line shows', () => {
    const p = props({ nameInput: 'WENDI', error: 'The name does not match.' })
    render(<DeletePricingVersionModal {...p} />)
    expect(screen.getByText('The name does not match.')).toBeTruthy()
    const del = screen.getByText('Delete') as HTMLButtonElement
    expect(del.disabled).toBe(false)
    fireEvent.click(del)
    expect(p.onConfirm).toHaveBeenCalledTimes(1)
  })
})
