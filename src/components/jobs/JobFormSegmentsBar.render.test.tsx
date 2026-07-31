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

describe('JobFormSegmentsBar dollar-invoice coverage (v2.1132)', () => {
  // $500 invoiced by dollar amount on a $1,000 job: Rough In ($400) fully
  // covered, Top Out ($600) covered $100, $500 left to bill.
  const coverage = {
    unattributedDollars: 500,
    remainingDollars: 500,
    bySegmentKey: {
      a: { coveredDollars: 400, fullyCovered: true },
      b: { coveredDollars: 100, fullyCovered: false },
    },
  }

  function renderWithCoverage(selectedIds = new Set<string>()) {
    return renderWithProviders(
      <JobFormSegmentsBar
        fixtures={fixtures}
        riderFeesDollars={0}
        invoiceStatusById={{}}
        selectedIds={selectedIds}
        onToggleSegment={() => {}}
        onCreateInvoiceFromSelection={() => {}}
        creatingFromSelection={false}
        jobLabel="Job 742"
        coverage={coverage}
      />,
    )
  }

  it('shows the legend entry and per-row coverage chips (banner removed v2.1141)', () => {
    renderWithCoverage()
    expect(screen.queryByText(/of this job is already paid or on bills/)).toBeNull()
    expect(screen.getByText('Covered by other bills')).toBeTruthy()
    expect(screen.getByText('covered')).toBeTruthy()
    expect(screen.getByText('$100.00 covered')).toBeTruthy()
  })

  it('locks the fully covered row (no checkbox) but keeps the partial row selectable', () => {
    renderWithCoverage()
    expect(screen.queryByLabelText('Select segment Rough In for invoicing')).toBeNull()
    expect(screen.getByLabelText('Select segment Top Out for invoicing')).toBeTruthy()
  })

  it('disables Create invoice when the selection exceeds the remaining, with the red note', () => {
    renderWithCoverage(new Set(['b']))
    const button = screen.getByText(/Create invoice from 1 segment \(\$600\.00\)/) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText(/Exceeds the \$500\.00 left to bill/)).toBeTruthy()
  })

  it('renders no coverage chrome without the prop', () => {
    renderBar()
    expect(screen.queryByText('Covered by other bills')).toBeNull()
  })
})
