// @vitest-environment jsdom
/**
 * Render tests for ① Line Items on a phone (v2.4312): under 640 px every line
 * stacks. The name spans the grid's three columns, and the ×/$ boxes (a
 * discount's entry) and the trash sit on a line under it in the same cell, with
 * the In order / Any time switch still on the row under that. Focus no longer
 * moves anything (v2.1229's stack-only-while-focused is gone). Wide screens keep
 * one row with the count and price in their own columns.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, screen, within } from '@testing-library/react'
import { JobFormFixturesSection } from './JobFormFixturesSection'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'
import { syncDiscountRows } from '../../lib/jobs/discountLine'
import type { StagePlan } from '../../lib/jobs/stagePlan'
import { stagePlanFromForm } from '../../lib/jobs/stagePlanForm'
import { renderWithProviders } from '../../test/renderSmokeMocks'

let narrowMatches = true

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: query === '(max-width: 640px)' && narrowMatches,
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

const fixtures: FixtureRow[] = [
  { id: 'a', name: 'Rough In', count: 1, line_unit_price: 8400, line_description: '', invoice_id: null, stage_kind: 'order' },
  { id: 'b', name: 'Top Out', count: 1, line_unit_price: 8400, line_description: '', invoice_id: null, stage_kind: 'order' },
]

function renderSection(rows: FixtureRow[] = fixtures, plan: StagePlan | null = null) {
  return renderWithProviders(
    <JobFormFixturesSection
      fixtures={rows}
      fixtureScopeExpandedById={{}}
      setFixtureScopeExpandedById={() => {}}
      fixturesSectionHighlight={false}
      fixturesSectionHighlightRef={{ current: null }}
      updateFixtureRow={() => {}}
      addFixtureRow={() => {}}
      removeFixtureRow={() => {}}
      moveFixtureRow={() => {}}
      onOpenSegmentGenerator={() => {}}
      onOpenStripeFixturePreview={() => {}}
      jobTotalDollars={16800}
      plan={plan}
    />,
  )
}

function nameField(index: number): HTMLTextAreaElement {
  return screen.getAllByLabelText('Specific work or materials')[index] as HTMLTextAreaElement
}
function countField(index: number): HTMLInputElement {
  return screen.getAllByLabelText('Count')[index] as HTMLInputElement
}
function priceField(index: number): HTMLInputElement {
  return screen.getAllByLabelText('Unit price')[index] as HTMLInputElement
}

describe('JobFormFixturesSection on a phone (v2.4312)', () => {
  it('every row stacks: the name spans the row, the count, price and trash sit on a line under it', () => {
    narrowMatches = true
    const { container } = renderSection()
    expect(container.querySelector('table')?.className).toContain('jobLineItems--stacked')
    for (const i of [0, 1]) {
      const cell = nameField(i).closest('td') as HTMLTableCellElement
      expect(cell.colSpan).toBe(3)
      const line = within(cell).getByTestId('line-numbers')
      expect(line.contains(countField(i))).toBe(true)
      expect(line.contains(priceField(i))).toBe(true)
      expect(within(line).getByRole('button', { name: 'Remove line item' })).toBeTruthy()
      expect(nameField(i).compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // ▲▼ stand beside the name and the line under it, in the same cell.
      expect(within(cell).getByRole('button', { name: 'Move line item up' })).toBeTruthy()
    }
  })

  it('focusing a name leaves the layout alone', () => {
    narrowMatches = true
    renderSection()
    const cell = nameField(0).closest('td')
    act(() => nameField(0).focus())
    expect(nameField(0).closest('td')).toBe(cell)
    expect(countField(0).closest('td')).toBe(cell)
    expect(nameField(0).closest('td')?.colSpan).toBe(3)
  })

  it('numbered placeholders; the ×/$ boxes are as wide as the longest value, the same on every row', () => {
    narrowMatches = true
    renderSection()
    expect(nameField(0).placeholder).toBe('Line item 1')
    expect(nameField(1).placeholder).toBe('Line item 2')
    // Counts are all "1" (1 char); prices are all 8400 → "8,400.00" (8 chars).
    // jsdom reorders calc() terms on serialization — assert the parts.
    expect(countField(0).style.width).toContain('1ch')
    expect(priceField(0).style.width).toContain('8ch')
    expect(priceField(1).style.width).toBe(priceField(0).style.width)
  })

  it('keeps the In order / Any time switch on the row under the line', () => {
    narrowMatches = true
    const plan = stagePlanFromForm({ fixtures, windows: [], orders: [], sheets: [], invoices: [], payments: [], todayYmd: '2026-10-01' })
    renderSection(fixtures, plan)
    const switches = screen.getAllByTestId('stage-line')
    expect(switches).toHaveLength(2)
    for (const i of [0, 1]) {
      const line = within(nameField(i).closest('td') as HTMLElement).getByTestId('line-numbers')
      expect(line.compareDocumentPosition(switches[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(within(switches[i]!).getByRole('radiogroup', { name: `Stage kind for ${fixtures[i]!.name}` })).toBeTruthy()
    }
  })

  it('a discount row stacks the same way: its entry and trash sit under its name', () => {
    narrowMatches = true
    const withDiscount = syncDiscountRows([
      ...fixtures,
      { id: 'd', name: 'Negotiated discount', count: 1, line_unit_price: null, line_description: '', invoice_id: null, line_kind: 'discount', discount_pct: 10, discount_basis_ids: null, discount_reason: 'Negotiated', stage_kind: null, shared_with_gc: false },
    ])
    renderSection(withDiscount)
    const cell = screen.getByLabelText('Discount name').closest('td') as HTMLTableCellElement
    expect(cell.colSpan).toBe(3)
    const line = within(cell).getByTestId('discount-entry-line')
    expect(within(line).getByLabelText('Discount amount')).toBeTruthy()
    expect(within(line).getByRole('button', { name: 'Remove discount' })).toBeTruthy()
  })
})

describe('JobFormFixturesSection on a wide screen', () => {
  it('one row: the count and price keep their own columns at the fixed widths', () => {
    narrowMatches = false
    const { container } = renderSection()
    expect(container.querySelector('table')?.className).not.toContain('jobLineItems--stacked')
    expect(screen.queryByTestId('line-numbers')).toBeNull()
    expect(nameField(0).closest('td')?.colSpan).toBe(1)
    expect(nameField(0).closest('tr')).toBe(countField(0).closest('tr'))
    expect(countField(0).closest('td')).not.toBe(nameField(0).closest('td'))
    expect(nameField(0).placeholder).toBe('Specific work or materials')
    expect(countField(0).style.width).toBe('2.6rem')
    expect(priceField(0).style.width).toBe('5rem')
    const cols = container.querySelectorAll('col')
    expect((cols[1] as HTMLElement).style.width).toBe('4.5rem')
    expect((cols[2] as HTMLElement).style.width).toContain('6.2rem')
  })

  it('focusing a name leaves the row alone', () => {
    narrowMatches = false
    renderSection()
    act(() => nameField(0).focus())
    expect(nameField(0).closest('td')?.colSpan).toBe(1)
    expect(nameField(0).closest('tr')).toBe(countField(0).closest('tr'))
  })

  it('a discount row keeps its entry in the amount cell', () => {
    narrowMatches = false
    const withDiscount = syncDiscountRows([
      ...fixtures,
      { id: 'd', name: 'Negotiated discount', count: 1, line_unit_price: null, line_description: '', invoice_id: null, line_kind: 'discount', discount_pct: 10, discount_basis_ids: null, discount_reason: 'Negotiated', stage_kind: null, shared_with_gc: false },
    ])
    renderSection(withDiscount)
    expect(screen.queryByTestId('discount-entry-line')).toBeNull()
    const nameCell = screen.getByLabelText('Discount name').closest('td')
    expect(screen.getByLabelText('Discount amount').closest('td')).not.toBe(nameCell)
  })
})
