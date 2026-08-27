// @vitest-environment jsdom
/**
 * Render-smoke tests for PaySpeedsBreakdownModal — the pay-speeds drill-down
 * (v2.2022) with per-customer payment receipts (billed → paid → gap chips).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PaySpeedsBreakdownModal from './PaySpeedsBreakdownModal'

// The Data health drill-down (v2.2290) fetches + writes through supabase and
// reads useAuth; stub both so the strip-click test can mount it in jsdom.
vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: vi.fn(async () => ({ data: null })), from: vi.fn() },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, profileName: 'Robert' }),
}))
import type { PaySpeedData } from '../../lib/jobs/billedExpectedPay'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

// jsdom has no matchMedia; useIsMobile (mobile restack, v2.2252) needs a stub.
let narrowMatches = false
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
      { billedYmd: '2026-06-03', paidYmd: '2026-06-15', gapDays: 12, jobId: null, jobName: null, address: null },
      { billedYmd: '2026-05-01', paidYmd: '2026-05-17', gapDays: 16, jobId: null, jobName: null, address: null },
      { billedYmd: '2026-07-22', paidYmd: '2026-08-11', gapDays: 20, jobId: null, jobName: null, address: null },
      { billedYmd: '2026-03-10', paidYmd: '2026-04-10', gapDays: 31, jobId: null, jobName: null, address: null },
    ],
    ingram: [{ billedYmd: '2026-04-28', paidYmd: '2026-05-05', gapDays: 7, jobId: null, jobName: null, address: null }],
  },
  quality: { payments12mo: 545, measurable: 238, unlinked: 164, undatedInvoices: 84, quarantined: 70, excluded: 0 },
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
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={vi.fn()} />)
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

  it('a receipt that knows its job shows name · address and opens the job detail on click (v2.2288)', () => {
    const withJob: PaySpeedData = {
      ...speeds,
      receipts: {
        ...speeds.receipts,
        knight: [
          { billedYmd: '2026-06-03', paidYmd: '2026-06-15', gapDays: 12, jobId: 'job-9', jobName: 'Panel swap', address: '1207 Kingsbury Ln' },
          ...speeds.receipts.knight!.slice(1),
        ],
      },
    }
    const openJob = vi.fn()
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={withJob} onClose={vi.fn()} onOpenJobDetail={openJob} />)
    fireEvent.click(screen.getByTitle('Show the payments behind this median'))
    expect(screen.getByText('Panel swap')).toBeTruthy()
    expect(screen.getByText(/1207 Kingsbury Ln/)).toBeTruthy()
    fireEvent.click(screen.getByTitle('Billed Jun 3 → paid Jun 15 (+12 days) — open the job'))
    expect(openJob).toHaveBeenCalledWith('job-9')
    // Jobless receipts render dates only, unclickable — no stray chevron handler.
    expect(screen.getByTitle('Billed May 1 → paid May 17 (+16 days)')).toBeTruthy()
  })

  it('thin-history rows expand too — receipts when they exist, the why-empty note when they do not', () => {
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={vi.fn()} />)
    const thinRows = screen.getAllByTitle('Show this customer’s payments')
    expect(thinRows).toHaveLength(2) // Ingram (1 pmt) + RMC (0 pmts)
    for (const r of thinRows) fireEvent.click(r)
    expect(screen.getByText('04/28–05/05')).toBeTruthy()
    expect(screen.getByText(/nothing measurable yet/)).toBeTruthy()
  })

  it('a ranked customer on a pre-receipts payload shows the reload hint instead of chips', () => {
    const v2speeds: PaySpeedData = { ...speeds, receipts: {} }
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={[invRow('knight', 'Knight Contracting', 100)]} paySpeeds={v2speeds} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Show the payments behind this median'))
    expect(screen.getByText(/Payment dates aren’t available yet/)).toBeTruthy()
  })

  it('the expanded panel offers the board jump when onOpenCustomerBills is provided', () => {
    const onOpen = vi.fn()
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={vi.fn()} onOpenCustomerBills={onOpen} />)
    fireEvent.click(screen.getByTitle('Show the payments behind this median'))
    fireEvent.click(screen.getByRole('button', { name: 'See these bills on the board →' }))
    expect(onOpen).toHaveBeenCalledWith('Knight Contracting')
  })

  it('the Data health strip is a button — clicking it opens the transactions drill-down (v2.2290)', async () => {
    const withQuality: PaySpeedData = {
      ...speeds,
      quality: { payments12mo: 545, measurable: 238, unlinked: 164, undatedInvoices: 84, quarantined: 58, excluded: 0 },
    }
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={withQuality} onClose={vi.fn()} />)
    expect(screen.getByText('see the transactions ›')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'See the transactions behind the data health numbers' }))
    expect(screen.getByRole('dialog', { name: 'Data health transactions' })).toBeTruthy()
    // Gate-refused / pre-push payload → the fail-soft copy, not a crash.
    expect(await screen.findByText(/isn’t available yet/)).toBeTruthy()
  })

  it('Money waiting (v2.2382): undated bills chase nobody — everyone collapses to the on-pace line', () => {
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={vi.fn()} />)
    expect(screen.getByText('Money waiting')).toBeTruthy()
    expect(screen.getByText(/3 more customers are on their usual pace/)).toBeTruthy()
  })

  it('Money waiting: a dated bill past the baseline makes a row, and expanding lists each job owed', () => {
    // knight (median 18): bill billed 2026-06-01 → waited 86d vs baseline 18 → off pace, late tone.
    const dated: StageRow = (() => {
      const base = invRow('knight', 'Knight Contracting', 75585)
      if (base.kind === 'job') throw new Error('fixture')
      return {
        ...base,
        job: { ...base.job, job_name: 'Knight Ph 1', job_address: '900 Broadway' },
        inv: { ...base.inv, billed_at: '2026-06-01T12:00:00Z' },
      } as StageRow
    })()
    render(
      <PaySpeedsBreakdownModal
        todayYmd="2026-08-26"
        rows={[dated, invRow('ingram', 'Johnny Ingram', 786), invRow('rmc', 'RMC- Dudley Mason', 49171)]}
        paySpeeds={speeds}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Money waiting')).toBeTruthy()
    expect(screen.getByText('86d waiting')).toBeTruthy()
    expect(screen.getByText(/usually ~18d/)).toBeTruthy()
    expect(screen.getByText(/2 more customers are on their usual pace/)).toBeTruthy()
    // Expand the row → the per-job bill list.
    fireEvent.click(screen.getByTitle(/Knight Contracting — oldest open bill has waited 86d/))
    expect(screen.getByText('Knight Ph 1')).toBeTruthy()
    expect(screen.getByText(/billed 0?6\/0?1/)).toBeTruthy()
    expect(screen.getByText('86d')).toBeTruthy()
  })

  it('mobile restack (v2.2252): ranked rows show payments and open dollars on one combined line', () => {
    narrowMatches = true
    try {
      render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={() => {}} />)
      // Two-line card: facts line fuses the desktop columns.
      expect(screen.getByText(/4 pmts · \$[\d,]+ open/)).toBeTruthy()
      // The desktop column header is display:none on mobile but still in the DOM.
      expect(screen.getByText('Median')).toBeTruthy()
    } finally {
      narrowMatches = false
    }
  })
})

describe('data-health line (v2.2259)', () => {
  it('renders the measurability meter and counts from the quality block', () => {
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={vi.fn()} />)
    expect(screen.getByText(/238 of 545/)).toBeTruthy()
    expect(screen.getByText(/measurable \(44%\)/)).toBeTruthy()
    expect(screen.getByText('164')).toBeTruthy()
    expect(screen.getByText(/payments missing info/)).toBeTruthy()
    expect(screen.getByText(/undated bills/)).toBeTruthy()
    expect(screen.getByText(/quarantined/)).toBeTruthy()
  })

  it('hides the line entirely on pre-v6 payloads', () => {
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={{ ...speeds, quality: null }} onClose={vi.fn()} />)
    expect(screen.queryByText(/Data health/)).toBeNull()
  })
})
