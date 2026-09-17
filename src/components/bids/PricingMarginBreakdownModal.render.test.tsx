// @vitest-environment jsdom
/**
 * Render smoke for the Pricing grid's margin-breakdown dialog (Pricing decomposition PR 2):
 * the per-unit column only when the count multiplies, the fixed-price note, the margin band,
 * the uncosted warning, and the jump chips that close first.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PricingMarginBreakdownModal, type PricingBreakdownRow } from './PricingMarginBreakdownModal'

const row = (o: Partial<PricingBreakdownRow> = {}): PricingBreakdownRow => ({
  countRowId: 'r1',
  fixture: 'Toilet',
  count: 3,
  unitPrice: 150,
  isFixedPrice: false,
  revenue: 450,
  materialsBeforeTax: 120,
  taxAmount: 9.9,
  taxPercent: 8.25,
  laborCost: 60,
  cost: 189.9,
  margin: 57.8,
  materialsFromTakeoff: 120,
  ...o,
})

describe('PricingMarginBreakdownModal', () => {
  it('shows the per-unit column for a multiplied count, the margin band, and closes', () => {
    const onClose = vi.fn()
    render(<PricingMarginBreakdownModal row={row()} onClose={onClose} />)
    expect(screen.getByText('Margin breakdown: Toilet')).toBeTruthy()
    expect(screen.getByText('3 units')).toBeTruthy()
    expect(screen.getByText('Per unit')).toBeTruthy()
    expect(screen.getByText('Total (× 3)')).toBeTruthy()
    expect(screen.getByText('57.8%')).toBeTruthy()
    expect(screen.queryByText(/no Takeoffs cost/)).toBeNull()
    expect(screen.queryByText('# Counts')).toBeNull()
    fireEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('hides per-unit for a single unit, notes a fixed price, and warns when uncosted', () => {
    render(<PricingMarginBreakdownModal row={row({ count: 1, isFixedPrice: true, materialsFromTakeoff: null, materialsBeforeTax: 0, cost: 60, revenue: 450 })} onClose={vi.fn()} />)
    expect(screen.getByText('1 unit')).toBeTruthy()
    expect(screen.queryByText('Per unit')).toBeNull()
    expect(screen.getByText('Sale Price (fixed)')).toBeTruthy()
    expect(screen.getByText('Fixed price — not multiplied by count')).toBeTruthy()
    expect(screen.getByText(/no Takeoffs cost/)).toBeTruthy()
  })

  it('the jump chips close first and hand the fixture reference to the tab', () => {
    const onClose = vi.fn()
    const onJumpToTab = vi.fn()
    render(<PricingMarginBreakdownModal row={row()} onClose={onClose} onJumpToTab={onJumpToTab} />)
    fireEvent.click(screen.getByText('🛠 Labor'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onJumpToTab).toHaveBeenCalledWith('labor', { countRowId: 'r1', fixture: 'Toilet' })
  })
})
