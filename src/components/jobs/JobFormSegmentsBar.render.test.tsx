// @vitest-environment jsdom
/**
 * Render-smoke tests for the ② Invoices segment strip's "How invoices and
 * jobs move" explainer (v2.1074): the ⓘ toggle expands the green-card /
 * blue-card story with the job's real first-segment amount and job label,
 * and collapses again.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { JobFormSegmentsBar } from './JobFormSegmentsBar'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const fixtures: FixtureRow[] = [
  { id: 'a', name: 'Rough In', count: 1, line_unit_price: 400, line_description: '', invoice_id: null },
  { id: 'b', name: 'Top Out', count: 1, line_unit_price: 600, line_description: '', invoice_id: null },
]

function renderBar() {
  return renderWithProviders(
    <JobFormSegmentsBar
      fixtures={fixtures}
      riderFeesDollars={0}
      invoiceStatusById={{}}
      selectedIds={new Set<string>()}
      onToggleSegment={() => {}}
      onCreateInvoiceFromSelection={() => {}}
      creatingFromSelection={false}
      jobLabel="Job 742"
    />,
  )
}

describe('JobFormSegmentsBar flow explainer', () => {
  it('is collapsed by default and expands with the sample chips', () => {
    renderBar()
    expect(screen.queryByText(/green card/)).toBeNull()
    fireEvent.click(screen.getByText(/How invoices and jobs move/))
    expect(screen.getByText(/green card/)).toBeTruthy()
    expect(screen.getByText(/blue card/)).toBeTruthy()
    expect(screen.getByText('$400.00')).toBeTruthy()
    expect(screen.getByText('Job 742')).toBeTruthy()
    expect(screen.getByText(/Ready to Bill → Billed → Paid/)).toBeTruthy()
  })

  it('collapses again on a second click', () => {
    renderBar()
    const toggle = screen.getByText(/How invoices and jobs move/)
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(screen.queryByText(/green card/)).toBeNull()
  })
})
