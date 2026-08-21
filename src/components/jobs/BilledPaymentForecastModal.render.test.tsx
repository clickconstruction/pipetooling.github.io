// @vitest-environment jsdom
/**
 * Render-smoke tests for BilledPaymentForecastModal — the Billed Awaiting
 * Payment "Payment forecast" (v2.1925) with the pay-speeds strip and
 * Res/Comm row tags (v2.1930).
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import BilledPaymentForecastModal from './BilledPaymentForecastModal'
import type { PaySpeedData } from '../../lib/jobs/billedExpectedPay'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const speeds: PaySpeedData = {
  company: { medianDays: 27, samples: 240 },
  customers: { knight: { medianDays: 35, samples: 12 } },
  segments: {
    residential: { medianDays: 14, samples: 96 },
    commercial: { medianDays: 38, samples: 131 },
  },
  customerTypes: { knight: 'commercial' },
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
