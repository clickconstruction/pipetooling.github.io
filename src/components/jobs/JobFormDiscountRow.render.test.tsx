// @vitest-environment jsdom
/**
 * Render smoke for the discount row in ① Line Items (v2.3252+): the smart
 * field reads "10%" as a percent and "500" as dollars, the twin label shows
 * the other form, the second line says what it applies to, the reason chips
 * fill an empty name, the over-cap message appears, and a row whose basis
 * is on a bill locks.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { JobFormFixturesSection } from './JobFormFixturesSection'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'
import { syncDiscountRows } from '../../lib/jobs/discountLine'
import { renderWithProviders } from '../../test/renderSmokeMocks'

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

afterEach(() => cleanup())

const work: FixtureRow[] = [
  { id: 'a', name: 'Rough In', count: 1, line_unit_price: 15098, line_description: '', invoice_id: null },
  { id: 'b', name: 'Top Out', count: 1, line_unit_price: 15098, line_description: '', invoice_id: null },
  { id: 'c', name: 'Trim Set', count: 1, line_unit_price: 7549, line_description: '', invoice_id: null },
]
const discount = (o: Partial<FixtureRow> = {}): FixtureRow => ({
  id: 'd',
  name: 'Negotiated discount',
  count: 1,
  line_unit_price: null,
  line_description: '',
  invoice_id: null,
  line_kind: 'discount',
  discount_pct: 10,
  discount_basis_ids: null,
  discount_reason: 'Negotiated',
  stage_kind: null,
  shared_with_gc: false,
  ...o,
})

function renderSection(fixtures: FixtureRow[], update = vi.fn(), addDiscountRow: (() => void) | null = vi.fn()) {
  const synced = syncDiscountRows(fixtures)
  renderWithProviders(
    <JobFormFixturesSection
      fixtures={synced}
      fixtureScopeExpandedById={{}}
      setFixtureScopeExpandedById={() => {}}
      fixturesSectionHighlight={false}
      fixturesSectionHighlightRef={{ current: null }}
      updateFixtureRow={update}
      addFixtureRow={() => {}}
      addDiscountRow={addDiscountRow ?? undefined}
      removeFixtureRow={() => {}}
      moveFixtureRow={() => {}}
      onOpenSegmentGenerator={() => {}}
      onOpenStripeFixturePreview={() => {}}
      jobTotalDollars={33970.5}
    />,
  )
  return { update }
}

describe('JobFormDiscountRow', () => {
  it('shows the percent, its dollar twin, the readout, the bill line, and the footer equation', () => {
    renderSection([...work, discount()])
    expect((screen.getByLabelText('Discount amount') as HTMLInputElement).value).toBe('10')
    expect(screen.getByText('−$3,774.50')).toBeTruthy()
    expect(screen.getByTestId('discount-readout').textContent).toContain('10% off')
    expect(screen.getByTestId('discount-readout').textContent).toContain('all 3 work lines')
    expect(screen.getByTestId('discount-bill-line').textContent).toContain('Negotiated discount (10%)')
    expect(screen.getByTestId('discount-bill-line').textContent).toContain('−$1,509.80 with Rough In')
    expect(screen.getByTestId('job-total-equation').textContent).toBe('$37,745.00 work − $3,774.50 discount')
    expect(screen.getByText('Job Total: $33,970.50')).toBeTruthy()
    expect(screen.getByText('− Add discount')).toBeTruthy()
  })

  it('typing "500" asks for a dollar discount; typing "7.5%" asks for a percent', () => {
    const { update } = renderSection([...work, discount()])
    const field = screen.getByLabelText('Discount amount') as HTMLInputElement
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: '500' } })
    expect(update).toHaveBeenLastCalledWith('d', { discount_pct: null, line_unit_price: -500 })
    fireEvent.change(field, { target: { value: '7.5%' } })
    expect(update).toHaveBeenLastCalledWith('d', { discount_pct: 7.5 })
  })

  it('tapping the twin swaps a percent into dollars', () => {
    const { update } = renderSection([...work, discount()])
    fireEvent.click(screen.getByText('−$3,774.50'))
    expect(update).toHaveBeenLastCalledWith('d', { discount_pct: null, line_unit_price: -3774.5 })
  })

  it('an empty name offers reason chips that fill the name and the reason', () => {
    const { update } = renderSection([...work, discount({ name: '', discount_reason: null })])
    fireEvent.click(screen.getByText('Referral'))
    expect(update).toHaveBeenLastCalledWith('d', { name: 'Referral thank-you', discount_reason: 'Referral' })
  })

  it('a dollar amount above the work shows the cap', () => {
    renderSection([...work, discount({ discount_pct: null, line_unit_price: -40000 })])
    expect(screen.getByTestId('discount-cap').textContent).toContain("Can't exceed $37,745.00")
  })

  it('the basis link opens a checklist and unticking a row narrows the basis', () => {
    const { update } = renderSection([...work, discount()])
    fireEvent.click(screen.getByText('all 3 work lines'))
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes).toHaveLength(3)
    fireEvent.click(boxes[2]!)
    expect(update).toHaveBeenLastCalledWith('d', { discount_basis_ids: ['a', 'b'] })
  })

  it('locks once a basis row is on a bill', () => {
    const billed = work.map((w) => (w.id === 'a' ? { ...w, invoice_id: 'inv1' } : w))
    renderSection([...billed, discount()])
    expect((screen.getByLabelText('Discount amount') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText('On a bill · locked')).toBeTruthy()
    expect(screen.getByTestId('discount-readout').textContent).toContain('already on a bill')
  })

  it('hides the add button when the shell offers no handler', () => {
    renderSection(work, vi.fn(), null)
    expect(screen.queryByText('− Add discount')).toBeNull()
  })
})
