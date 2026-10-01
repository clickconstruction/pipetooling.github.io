// @vitest-environment jsdom
/**
 * Render-smoke tests for the ② heading's "How invoices and jobs move"
 * explainer (v2.1074): the ⓘ toggle expands the green-card / blue-card story
 * with the job's real first-segment amount and job label, and collapses
 * again; and the By bill / By date switch. The strip they sat beside became
 * the money card in v2.4307 (`JobFormMoneyCard.render.test.tsx`).
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { BillsViewSwitch, InvoicesSectionHeading } from './JobFormSegmentsBar'
import { renderWithProviders } from '../../test/renderSmokeMocks'

describe('InvoicesSectionHeading flow explainer (moved beside the ② heading, v2.1146)', () => {
  it('is collapsed by default and expands with the sample chips', () => {
    renderWithProviders(<InvoicesSectionHeading sampleDollars={400} jobLabel="Job 742" />)
    expect(screen.getByText('② Bills and payments')).toBeTruthy()
    expect(screen.queryByText(/green card/)).toBeNull()
    fireEvent.click(screen.getByText(/How invoices and jobs move/))
    expect(screen.getByText(/green card/)).toBeTruthy()
    expect(screen.getByText(/blue card/)).toBeTruthy()
    expect(screen.getByText('$400.00')).toBeTruthy()
    expect(screen.getByText('Job 742')).toBeTruthy()
    expect(screen.getByText(/Ready to Bill → Billed → Paid/)).toBeTruthy()
  })

  it('collapses again on a second click', () => {
    renderWithProviders(<InvoicesSectionHeading sampleDollars={400} jobLabel="Job 742" />)
    const toggle = screen.getByText(/How invoices and jobs move/)
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(screen.queryByText(/green card/)).toBeNull()
  })
})

describe('BillsViewSwitch — By bill / By date (v2.4294; on the Bills row since v2.4298)', () => {
  it('says which view is on and reports a press', () => {
    const picked: string[] = []
    renderWithProviders(<BillsViewSwitch view="bill" onViewChange={(v) => picked.push(v)} />)
    const byBill = screen.getByRole('button', { name: 'By bill' })
    const byDate = screen.getByRole('button', { name: 'By date' })
    expect(byBill.getAttribute('aria-pressed')).toBe('true')
    expect(byDate.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(byDate)
    expect(picked).toEqual(['date'])
  })

  it('is no longer on the ② heading', () => {
    renderWithProviders(<InvoicesSectionHeading sampleDollars={400} jobLabel="Job 742" />)
    expect(screen.getByText('② Bills and payments')).toBeTruthy()
    expect(screen.queryByTestId('bills-view-switch')).toBeNull()
  })
})
