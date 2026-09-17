// @vitest-environment jsdom
/**
 * Render smoke for the price-version form (Pricing decomposition PR 5): the four titles,
 * Delete version offered only when renaming a non-Default book, and every door reports.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PricingVersionFormModal } from './PricingVersionFormModal'
import type { PriceBookVersion } from '../../lib/bids/bidPricingEngineTypes'

const version = (id: string, name: string) => ({ id, name, bid_id: null, is_robot: false, sort_order: 0 }) as unknown as PriceBookVersion

function props(over: Partial<Parameters<typeof PricingVersionFormModal>[0]> = {}) {
  return {
    editing: null,
    templatesMode: true,
    formMode: 'template' as const,
    nameInput: '',
    onNameChange: vi.fn(),
    saving: false,
    onSubmit: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
    onClose: vi.fn(),
    onDelete: vi.fn(),
    ...over,
  }
}

describe('PricingVersionFormModal', () => {
  it('titles a new template, a new pricing and a copy; the name input and the doors report', () => {
    const p = props()
    const { unmount } = render(<PricingVersionFormModal {...p} />)
    expect(screen.getByText('New template')).toBeTruthy()
    expect(screen.queryByText('Delete version')).toBeNull()
    fireEvent.change(screen.getByPlaceholderText('e.g. 2025 Standard'), { target: { value: 'Fall 2026' } })
    expect(p.onNameChange).toHaveBeenCalledWith('Fall 2026')
    fireEvent.click(screen.getByText('Save'))
    expect(p.onSubmit).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Cancel'))
    expect(p.onClose).toHaveBeenCalledTimes(1)
    unmount()
    render(<PricingVersionFormModal {...props({ formMode: 'pricing-clone' })} />)
    expect(screen.getByText('New pricing (copy)')).toBeTruthy()
  })

  it('renaming: the title follows templates mode, and Delete version is offered only off Default', () => {
    const p = props({ editing: version('t2', 'WENDI'), nameInput: 'WENDI' })
    const { unmount } = render(<PricingVersionFormModal {...p} />)
    expect(screen.getByText('Edit template name')).toBeTruthy()
    fireEvent.click(screen.getByText('Delete version'))
    expect(p.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 't2' }))
    unmount()
    render(<PricingVersionFormModal {...props({ editing: version('t1', 'Default'), nameInput: 'Default', templatesMode: false })} />)
    expect(screen.getByText('Edit pricing name')).toBeTruthy()
    expect(screen.queryByText('Delete version')).toBeNull()
  })

  it('saving disables the submit and says so', () => {
    render(<PricingVersionFormModal {...props({ saving: true })} />)
    expect((screen.getByText('Saving…') as HTMLButtonElement).disabled).toBe(true)
  })
})
