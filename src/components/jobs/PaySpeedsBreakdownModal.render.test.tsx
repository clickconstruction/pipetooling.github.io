// @vitest-environment jsdom
/**
 * Render-smoke tests for PaySpeedsBreakdownModal — the pay-speeds drill-down
 * (v2.2022) with per-customer payment receipts (billed → paid → gap chips).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PaySpeedsBreakdownModal from './PaySpeedsBreakdownModal'
import type { PaySpeedData } from '../../lib/jobs/billedExpectedPay'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const speeds: PaySpeedData = {
  company: { medianDays: 11, samples: 5 },
  customers: {
    knight: { medianDays: 18, samples: 4 },
    ingram: { medianDays: 7, samples: 1 },
  },
  segments: {
    residential: { medianDays: 7, samples: 1 },
    commercial: { medianDays: 18, samples: 4 },
  },
  customerTypes: { knight: 'commercial', ingram: 'residential', rmc: 'commercial' },
  receipts: {
    knight: [
      { billedYmd: '2026-06-03', paidYmd: '2026-06-15', gapDays: 12 },
      { billedYmd: '2026-05-01', paidYmd: '2026-05-17', gapDays: 16 },
      { billedYmd: '2026-07-22', paidYmd: '2026-08-11', gapDays: 20 },
      { billedYmd: '2026-03-10', paidYmd: '2026-04-10', gapDays: 31 },
    ],
    ingram: [{ billedYmd: '2026-04-28', paidYmd: '2026-05-05', gapDays: 7 }],
  },
}

function invRow(customerId: string, name: string, amount: number): StageRow {
  const job = {
    id: `j-${customerId}`,
    customer_id: customerId,
    customer_name: name,
    payments: [],
    invoices: [],
  } as unknown as JobWithDetails
  return {
    kind: 'invoice',
    job,
    inv: { id: `inv-${customerId}`, job_id: job.id, amount, status: 'billed', sequence_order: 1 },
  } as unknown as StageRow
}

const rows = [invRow('knight', 'Knight Contracting', 75585), invRow('ingram', 'Johnny Ingram', 786), invRow('rmc', 'RMC- Dudley Mason', 49171)]

describe('PaySpeedsBreakdownModal render smoke', () => {
  it('clicking a ranked row reveals its receipt chips; clicking again hides them', () => {
    render(<PaySpeedsBreakdownModal rows={rows} paySpeeds={speeds} onClose={vi.fn()} />)
    expect(screen.queryByText('05/01–05/17')).toBeNull()
    const row = screen.getByTitle('Show the payments behind this median')
    fireEvent.click(row)
    // All four receipts, gap pill + MM/DD–MM/DD dates.
    expect(screen.getByText('+16')).toBeTruthy()
    expect(screen.getByText('05/01–05/17')).toBeTruthy()
    expect(screen.getByText('+31')).toBeTruthy()
    expect(screen.getByText('03/10–04/10')).toBeTruthy()
    // Hover title spells out the math.
    expect(screen.getByTitle('Billed May 1 → paid May 17 (+16 days)')).toBeTruthy()
    fireEvent.click(screen.getByTitle('Hide the payments behind this median'))
    expect(screen.queryByText('05/01–05/17')).toBeNull()
  })

  it('thin-history rows expand too — receipts when they exist, the why-empty note when they do not', () => {
    render(<PaySpeedsBreakdownModal rows={rows} paySpeeds={speeds} onClose={vi.fn()} />)
    const thinRows = screen.getAllByTitle('Show this customer’s payments')
    expect(thinRows).toHaveLength(2) // Ingram (1 pmt) + RMC (0 pmts)
    for (const r of thinRows) fireEvent.click(r)
    expect(screen.getByText('04/28–05/05')).toBeTruthy()
    expect(screen.getByText(/nothing measurable yet/)).toBeTruthy()
  })

  it('a ranked customer on a pre-receipts payload shows the reload hint instead of chips', () => {
    const v2speeds: PaySpeedData = { ...speeds, receipts: {} }
    render(<PaySpeedsBreakdownModal rows={[invRow('knight', 'Knight Contracting', 100)]} paySpeeds={v2speeds} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Show the payments behind this median'))
    expect(screen.getByText(/Payment dates aren’t available yet/)).toBeTruthy()
  })

  it('the expanded panel offers the board jump when onOpenCustomerBills is provided', () => {
    const onOpen = vi.fn()
    render(<PaySpeedsBreakdownModal rows={rows} paySpeeds={speeds} onClose={vi.fn()} onOpenCustomerBills={onOpen} />)
    fireEvent.click(screen.getByTitle('Show the payments behind this median'))
    fireEvent.click(screen.getByRole('button', { name: 'See these bills on the board →' }))
    expect(onOpen).toHaveBeenCalledWith('Knight Contracting')
  })
})
