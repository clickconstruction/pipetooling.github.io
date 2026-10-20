// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PriceBreakdownCard } from './PriceBreakdownCard'
import type { PriceBreakdownInput } from '../../lib/bids/priceBreakdown'

afterEach(() => {
  cleanup()
  try {
    localStorage.clear()
  } catch {
    /* jsdom */
  }
})

const marginColor = () => 'green'
const rows: PriceBreakdownInput['rows'] = [
  { id: 'wc', name: 'WC', count: 2, revenue: 6600, materialsBeforeTax: 482.72, hours: 15, isEquipment: false },
  { id: 'lift', name: 'Scissor lift', count: 1, revenue: 2000, materialsBeforeTax: 0, hours: 0, isEquipment: true },
]
const input: PriceBreakdownInput = { rows, markup: 0.5, taxPercent: 8.25, laborRate: 58, laborRateSource: 'company', equipmentCost: 1500, smallCosts: 100 }

describe('PriceBreakdownCard', () => {
  it('draws the five lines with cost, price and profit, and the bid line matching the inputs', () => {
    render(<PriceBreakdownCard input={input} companyMarkup={0.5} onMarkupChange={() => {}} marginColor={marginColor} />)
    expect(screen.getByText('Traditional breakdown')).toBeTruthy()
    for (const name of ['Material', 'Sales tax', 'Equipment', 'Labor', 'Driving, travel, permits, subs', 'The bid']) expect(screen.getByText(name)).toBeTruthy()
    expect(screen.getByText('$8,600.00')).toBeTruthy()
    expect(screen.getByText(/crew rate/)).toBeTruthy()
  })
  it('with no hours the labor line reads Labor and margin and offers Labor', () => {
    const onOpenLabor = vi.fn()
    render(<PriceBreakdownCard input={{ ...input, rows: rows.map((r) => ({ ...r, hours: 0 })) }} companyMarkup={0.5} onMarkupChange={() => {}} onOpenLabor={onOpenLabor} marginColor={marginColor} />)
    expect(screen.getByText('Labor and margin')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open Labor' }))
    expect(onOpenLabor).toHaveBeenCalledTimes(1)
  })
  it("the markup chip writes the bid's number as you type, and null for the company's", () => {
    const onMarkupChange = vi.fn()
    render(<PriceBreakdownCard input={input} companyMarkup={0.5} onMarkupChange={onMarkupChange} marginColor={marginColor} />)
    const chip = screen.getByLabelText("This bid's material markup, percent") as HTMLInputElement
    fireEvent.change(chip, { target: { value: '40' } })
    expect(onMarkupChange).toHaveBeenLastCalledWith(0.4)
    fireEvent.change(chip, { target: { value: '50' } })
    expect(onMarkupChange).toHaveBeenLastCalledWith(null)
  })
  it('folds to one line and remembers it', () => {
    render(<PriceBreakdownCard input={input} companyMarkup={0.5} onMarkupChange={() => {}} marginColor={marginColor} />)
    const fold = screen.getByRole('button', { name: /Traditional breakdown/ })
    expect(fold.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(fold)
    expect(screen.queryByText('Driving, travel, permits, subs')).toBeNull()
    expect(screen.getByRole('button', { name: /Traditional breakdown/ }).getAttribute('aria-expanded')).toBe('false')
    expect(localStorage.getItem('pt.pricing.card.traditional')).toBe('folded')
  })
})
