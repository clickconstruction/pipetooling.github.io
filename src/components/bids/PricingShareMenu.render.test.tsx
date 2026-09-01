// @vitest-environment jsdom
/** Render tests for the Pricing header's split Share button (v2.2198). */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { PricingShareMenu } from './PricingShareMenu'

function setup(over: Partial<Parameters<typeof PricingShareMenu>[0]> = {}) {
  const handlers = { onShare: vi.fn(), onPrint: vi.fn(), onCsv: vi.fn(), onReview: vi.fn(), onCopyFixtures: vi.fn() }
  render(
    <PricingShareMenu
      canShare
      shareDisabled={false}
      shareTitle="Share pricing"
      csvDisabled={false}
      csvTitle=""
      fixturesDisabled={false}
      fixturesTitle=""
      {...handlers}
      {...over}
    />,
  )
  return handlers
}

describe('PricingShareMenu', () => {
  it('Share stays one click; the caret opens the menu with Print / CSV / review', () => {
    const h = setup()
    fireEvent.click(screen.getByText('Share'))
    expect(h.onShare).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByLabelText(/More ways/))
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.click(screen.getByText('Print'))
    expect(h.onPrint).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull() // picking closes
  })
  it('review row fires and Escape closes', () => {
    const h = setup()
    fireEvent.click(screen.getByLabelText(/More ways/))
    fireEvent.click(screen.getByText('Print all prices — review'))
    expect(h.onReview).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText(/More ways/))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })
  it('a disabled CSV row keeps its tooltip and does not fire', () => {
    const h = setup({ csvDisabled: true, csvTitle: 'Select a price book and ensure Counts and Labor exist' })
    fireEvent.click(screen.getByLabelText(/More ways/))
    const row = screen.getByText('Download CSV').closest('button')!
    expect(row.disabled).toBe(true)
    expect(row.title).toMatch(/Select a price book/)
    fireEvent.click(row)
    expect(h.onCsv).not.toHaveBeenCalled()
  })
  it('Copy fixtures for text fires, and disables with its own tooltip', () => {
    const h = setup()
    fireEvent.click(screen.getByLabelText(/More ways/))
    fireEvent.click(screen.getByText('Copy fixtures for text'))
    expect(h.onCopyFixtures).toHaveBeenCalledTimes(1)
  })
  it('a disabled fixtures row keeps its tooltip and does not fire', () => {
    const h = setup({ fixturesDisabled: true, fixturesTitle: 'Add Counts first — nothing to copy yet' })
    fireEvent.click(screen.getByLabelText(/More ways/))
    const row = screen.getByText('Copy fixtures for text').closest('button')!
    expect(row.disabled).toBe(true)
    expect(row.title).toMatch(/Add Counts first/)
    fireEvent.click(row)
    expect(h.onCopyFixtures).not.toHaveBeenCalled()
  })
  it('without the share role it renders as a single Export ▾ over the same menu', () => {
    setup({ canShare: false })
    expect(screen.queryByText('Share')).toBeNull()
    fireEvent.click(screen.getByText('Export ▾'))
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByText('Print all prices — review')).toBeTruthy()
  })
})
