// @vitest-environment jsdom
/**
 * Render-smoke tests for BilledPaymentForecastModal — the Billed Awaiting
 * Payment "Payment forecast" (v2.1925) with the pay-speeds strip and
 * Res/Comm row tags (v2.1930).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import BilledPaymentForecastModal from './BilledPaymentForecastModal'
import type { PaySpeedData } from '../../lib/jobs/billedExpectedPay'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

// jsdom has no matchMedia; useIsMobile (mobile restack, v2.2252) needs a stub.
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

const speeds: PaySpeedData = {
  company: { medianDays: 27, samples: 240 },
  customers: { knight: { medianDays: 35, samples: 12 } },
  segments: {
    residential: { medianDays: 14, samples: 96 },
    commercial: { medianDays: 38, samples: 131 },
  },
  customerTypes: { knight: 'commercial' },
  receipts: {},
  quality: null,
}

function billedRow(): StageRow {
  const job = {
    id: 'j1',
    hcp_number: '964',
    click_number: null,
    job_name: 'Pondhill demo',
    customer_name: 'Knight Contracting',
    customer_id: 'knight',
    revenue: 3013,
    payments_made: 0,
    payments: [],
    invoices: [],
  } as unknown as JobWithDetails
  return {
    kind: 'invoice',
    job,
    inv: {
      id: 'inv1',
      job_id: 'j1',
      amount: 3013,
      status: 'billed',
      sequence_order: 1,
      estimated_bill_date: null,
      billed_at: '2026-08-04T15:00:00Z',
    },
  } as unknown as StageRow
}

describe('BilledPaymentForecastModal render smoke', () => {
  it('renders the pay-speeds strip with company + segment medians and tags rows Res/Comm', () => {
    render(
      <BilledPaymentForecastModal
        rows={[billedRow()]}
        paySpeeds={speeds}
        todayYmd="2026-08-20"
        onClose={vi.fn()}
        onOpenInvoice={vi.fn()}
      />,
    )
    expect(screen.getByText('Pay speeds')).toBeTruthy()
    expect(screen.getByText('~27d')).toBeTruthy()
    expect(screen.getByText('~14d')).toBeTruthy()
    expect(screen.getByText('~38d')).toBeTruthy()
    expect(screen.getByText('240 payments')).toBeTruthy()
    // Strip "Comm" label + the row's own tag.
    expect(screen.getAllByText('Comm')).toHaveLength(2)
    expect(screen.getAllByText('Res')).toHaveLength(1)
    expect(screen.getByText(/964 · Pondhill demo/)).toBeTruthy()
  })

  it('clicking a bucket tile filters the lists to that bucket; clicking again restores all', () => {
    const { container } = render(
      <BilledPaymentForecastModal
        rows={[billedRow()]}
        paySpeeds={speeds}
        todayYmd="2026-08-20"
        onClose={vi.fn()}
        onOpenInvoice={vi.fn()}
      />,
    )
    // The row lands in the following-two-weeks bucket ("Aug 30 – Sep 12").
    fireEvent.click(screen.getByTitle('Show only the Aug 30 – Sep 12 bills'))
    expect(screen.getByRole('status').textContent).toContain('Showing only Aug 30 – Sep 12')
    expect(screen.getByText(/964 · Pondhill demo/)).toBeTruthy()
    // Empty buckets' tiles are disabled while inactive.
    const emptyTiles = screen.getAllByTitle('No bills in this bucket')
    expect(emptyTiles.length).toBeGreaterThan(0)
    expect((emptyTiles[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }))
    expect(container.textContent).not.toContain('Showing only')
  })

  it('clicking the pay-speeds strip opens the per-customer breakdown modal (v2.2022)', () => {
    render(
      <BilledPaymentForecastModal
        rows={[billedRow()]}
        paySpeeds={speeds}
        todayYmd="2026-08-20"
        onClose={vi.fn()}
        onOpenInvoice={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTitle(/Open the pay-speeds breakdown/))
    const dialog = screen.getByRole('dialog', { name: 'Pay speeds breakdown' })
    expect(dialog.textContent).toContain('By customer — slowest first')
    // Knight Contracting has its own median (35d, 12 payments) and $3,013 open.
    expect(dialog.textContent).toContain('Knight Contracting')
    expect(dialog.textContent).toContain('~35d')
    expect(dialog.textContent).toContain('12 pmts')
    expect(dialog.textContent).toContain('$3,013')
    // The drift chart replaced the dot/bucket variants — one view, no pills.
    expect(dialog.textContent).toContain('Above or below their average')
    fireEvent.click(screen.getByRole('button', { name: 'Close pay speeds breakdown' }))
    expect(screen.queryByRole('dialog', { name: 'Pay speeds breakdown' })).toBeNull()
  })

  it('shows the Email… button only when onEmail is passed (v2.2226)', () => {
    const onEmail = vi.fn()
    const { rerender } = render(
      <BilledPaymentForecastModal
        rows={[billedRow()]}
        paySpeeds={speeds}
        todayYmd="2026-08-20"
        onClose={vi.fn()}
        onOpenInvoice={vi.fn()}
        onEmail={onEmail}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Email payment forecast' }))
    expect(onEmail).toHaveBeenCalledTimes(1)
    rerender(
      <BilledPaymentForecastModal
        rows={[billedRow()]}
        paySpeeds={speeds}
        todayYmd="2026-08-20"
        onClose={vi.fn()}
        onOpenInvoice={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Email payment forecast' })).toBeNull()
  })

  it('shows the still-loading hint while non-paid scopes are fetching', () => {
    render(
      <BilledPaymentForecastModal
        rows={[billedRow()]}
        loading
        paySpeeds={speeds}
        todayYmd="2026-08-20"
        onClose={vi.fn()}
        onOpenInvoice={vi.fn()}
      />,
    )
    expect(screen.getByText(/Loading the whole board/)).toBeTruthy()
  })

  it('hides the strip (but still lists rows) when pay speeds are unavailable', () => {
    render(
      <BilledPaymentForecastModal
        rows={[billedRow()]}
        paySpeeds={null}
        todayYmd="2026-08-20"
        onClose={vi.fn()}
        onOpenInvoice={vi.fn()}
      />,
    )
    expect(screen.queryByText('Pay speeds')).toBeNull()
    expect(screen.getByText(/964 · Pondhill demo/)).toBeTruthy()
    expect(screen.getByText('No pay history')).toBeTruthy()
  })
})
