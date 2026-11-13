// @vitest-environment jsdom
/**
 * Render-smoke tests for PaySpeedsBreakdownModal — the pay-speeds drill-down
 * (v2.2022) with per-customer payment receipts (billed → paid → gap chips).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import PaySpeedsBreakdownModal from './PaySpeedsBreakdownModal'

// The Data health drill-down (v2.2290) fetches + writes through supabase and
// reads useAuth; stub both so the strip-click test can mount it in jsdom.
// The portal globe (v2.2564) needs Toast/Confirm/Router providers — it has
// its own surface; stub it so this smoke stays provider-free.
vi.mock('../customers/CustomerPortalGlobeButton', () => ({ default: () => null }))
// The payer card's Pay calendar line (punch list #323) is a door to another window, with its own render test.
vi.mock('../customers/PayCalendarLine', () => ({ default: () => null }))

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: vi.fn(async () => ({ data: null })), from: vi.fn() },
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, profileName: 'Robert' }),
}))
import type { PaySpeedData } from '../../lib/jobs/billedExpectedPay'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { settle } from '../../test/renderSmokeMocks'

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
  describe('opened on one payer, from a Pipeline row’s Pays in line (v2.7013)', () => {
    const payer = { id: 'knight', name: 'Made Up Builders' }

    it('names the payer, leads with their range in the row’s words and shows every payment behind it with no click', async () => {
      render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={vi.fn()} focusPayer={payer} />)
      await settle()
      expect(screen.getByRole('dialog', { name: 'Pay speeds for Made Up Builders' })).toBeTruthy()
      const card = within(screen.getByTestId('pay-speeds-payer'))
      expect(card.getByRole('heading', { name: 'Made Up Builders' })).toBeTruthy()
      // 12, 16, 20 and 31 days: the middle half is 15 to 23, the middle one 18.
      expect(card.getByTestId('pay-speeds-payer-range').textContent).toBe('Pays in 15–23d')
      expect(card.getByText(/^The middle half of their last 4 measured payments came 15 to 23 days after the bill\. The middle one took 18 days\./)).toBeTruthy()
      for (const gap of ['+12', '+16', '+20', '+31']) expect(card.getByText(gap)).toBeTruthy()
      expect(card.getByText('05/01–05/17')).toBeTruthy()
      // What they owe now, from the board's rows.
      expect(card.getByText('Owes now — by job')).toBeTruthy()
      // Once as the card's open total, once on the bill's own line.
      expect(card.getAllByText('$75,585')).toHaveLength(2)
    })

    it('keeps the whole window one press away: All customers opens it under the card and closes it again', async () => {
      render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={vi.fn()} focusPayer={payer} />)
      await settle()
      expect(screen.queryByText('By customer — slowest first')).toBeNull()
      expect(screen.queryByText('Data health')).toBeNull()
      const all = screen.getByRole('button', { name: /^All customers/ })
      expect(all.getAttribute('aria-expanded')).toBe('false')
      expect(all.className).toBe('paySpeedsAllPress')
      expect(all.textContent).toContain('3 with open bills')
      fireEvent.click(all)
      expect(all.getAttribute('aria-expanded')).toBe('true')
      expect(screen.getByText('By customer — slowest first')).toBeTruthy()
      expect(screen.getByText('Data health')).toBeTruthy()
      expect(screen.getByText('Money waiting')).toBeTruthy()
      // The payer's card stays on top.
      expect(screen.getByTestId('pay-speeds-payer')).toBeTruthy()
      fireEvent.click(all)
      expect(screen.queryByText('By customer — slowest first')).toBeNull()
    })

    it('a payment in the card opens its job, as in the list', async () => {
      const onOpenJobDetail = vi.fn()
      const withJob: PaySpeedData = {
        ...speeds,
        receipts: { ...speeds.receipts, knight: [{ billedYmd: '2026-06-03', paidYmd: '2026-06-15', gapDays: 12, jobId: 'job-9', jobName: 'Made-up panel swap', address: '1 Example St' }, ...speeds.receipts.knight!.slice(1)] },
      }
      render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={withJob} onClose={vi.fn()} onOpenJobDetail={onOpenJobDetail} focusPayer={payer} />)
      await settle()
      fireEvent.click(within(screen.getByTestId('pay-speeds-payer')).getByText('Made-up panel swap'))
      expect(onOpenJobDetail).toHaveBeenCalledWith('job-9')
    })

    it('a payer with nothing measured says so, and what the forecast uses instead', async () => {
      render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={vi.fn()} focusPayer={{ id: 'rmc', name: 'Made Up Mechanical' }} />)
      await settle()
      const card = within(screen.getByTestId('pay-speeds-payer'))
      expect(card.getByTestId('pay-speeds-payer-range').textContent).toBe('No pay speed of their own yet')
      expect(card.getByText(/^No payment of theirs can be measured yet\./)).toBeTruthy()
    })

    it('finds the payer’s open bills in the wider rows it is handed (a Collections row’s payer)', async () => {
      const chased = invRow('chased', 'Made Up Chased Co', 4200)
      const withChased: PaySpeedData = { ...speeds, receipts: { ...speeds.receipts, chased: [{ billedYmd: '2026-02-01', paidYmd: '2026-03-13', gapDays: 40, jobId: null, jobName: null, address: null }] } }
      render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} focusRows={[...rows, chased]} paySpeeds={withChased} onClose={vi.fn()} focusPayer={{ id: 'chased', name: 'Made Up Chased Co' }} />)
      await settle()
      const card = within(screen.getByTestId('pay-speeds-payer'))
      expect(card.getByTestId('pay-speeds-payer-range').textContent).toBe('Pays in ~40d')
      expect(card.getAllByText('$4,200')).toHaveLength(2)
    })

    it('with no payer the window opens whole, as Payment forecast opens it', async () => {
      render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={vi.fn()} />)
      await settle()
      expect(screen.getByRole('dialog', { name: 'Pay speeds breakdown' })).toBeTruthy()
      expect(screen.queryByTestId('pay-speeds-payer')).toBeNull()
      expect(screen.queryByRole('button', { name: /^All customers/ })).toBeNull()
      expect(screen.getByText('By customer — slowest first')).toBeTruthy()
    })
  })

  it('clicking a ranked row reveals its receipt chips; clicking again hides them', async () => {
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={vi.fn()} />)
    await settle()
    expect(screen.queryByText('05/01–05/17')).toBeNull()
    const row = screen.getAllByTitle('Show the payments behind this median')[0]!
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

  it('a receipt that knows its job shows name · address and opens the job detail on click (v2.2288)', async () => {
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
    await settle()
    fireEvent.click(screen.getAllByTitle('Show the payments behind this median')[0]!)
    expect(screen.getByText('Panel swap')).toBeTruthy()
    expect(screen.getByText(/1207 Kingsbury Ln/)).toBeTruthy()
    fireEvent.click(screen.getByTitle('Billed Jun 3 → paid Jun 15 (+12 days) — open the job'))
    expect(openJob).toHaveBeenCalledWith('job-9')
    // Jobless receipts render dates only, unclickable — no stray chevron handler.
    expect(screen.getByTitle('Billed May 1 → paid May 17 (+16 days)')).toBeTruthy()
  })

  it('a one-payment customer ranks on it (v2.4376); the thin rows are customers with none, and say why', async () => {
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={vi.fn()} />)
    await settle()
    const ranked = screen.getAllByTitle('Show the payments behind this median')
    expect(ranked).toHaveLength(2) // Knight (4 pmts), then Ingram (1 pmt)
    fireEvent.click(ranked[1]!)
    expect(screen.getByText('04/28–05/05')).toBeTruthy()
    const thinRows = screen.getAllByTitle('Show this customer’s payments')
    expect(thinRows).toHaveLength(1) // RMC (0 pmts)
    fireEvent.click(thinRows[0]!)
    expect(screen.getByText(/nothing measurable yet/)).toBeTruthy()
  })

  it('a ranked customer on a pre-receipts payload shows the reload hint instead of chips', async () => {
    const v2speeds: PaySpeedData = { ...speeds, receipts: {} }
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={[invRow('knight', 'Knight Contracting', 100)]} paySpeeds={v2speeds} onClose={vi.fn()} />)
    await settle()
    fireEvent.click(screen.getAllByTitle('Show the payments behind this median')[0]!)
    expect(screen.getByText(/Payment dates aren’t available yet/)).toBeTruthy()
  })

  it('the expanded panel offers the board jump when onOpenCustomerBills is provided', async () => {
    const onOpen = vi.fn()
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={vi.fn()} onOpenCustomerBills={onOpen} />)
    await settle()
    fireEvent.click(screen.getAllByTitle('Show the payments behind this median')[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'See these bills on the board →' }))
    expect(onOpen).toHaveBeenCalledWith('Knight Contracting')
  })

  it('the Data health strip is a button — clicking it opens the transactions drill-down (v2.2290)', async () => {
    const withQuality: PaySpeedData = {
      ...speeds,
      quality: { payments12mo: 545, measurable: 238, unlinked: 164, undatedInvoices: 84, quarantined: 58, excluded: 0 },
    }
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={withQuality} onClose={vi.fn()} />)
    await settle()
    expect(screen.getByText('see the transactions ›')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'See the transactions behind the data health numbers' }))
    expect(screen.getByRole('dialog', { name: 'Data health transactions' })).toBeTruthy()
    // Gate-refused / pre-push payload → the fail-soft copy, not a crash.
    expect(await screen.findByText(/isn’t available yet/)).toBeTruthy()
  })

  it('Money waiting (v2.2382): undated bills chase nobody — everyone collapses to the on-pace line', async () => {
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={vi.fn()} />)
    await settle()
    expect(screen.getByText('Money waiting')).toBeTruthy()
    expect(screen.getByText(/3 more customers are on their usual pace/)).toBeTruthy()
  })

  it('Money waiting: a late bill an in kind deal pays makes no row, and one line counts it (punch list #301)', async () => {
    // The same 86-day bill as the next test, on a deal: nobody is off pace over it.
    const onDeal: StageRow = (() => {
      const base = invRow('knight', 'Knight Contracting', 75585)
      if (base.kind === 'job') throw new Error('fixture')
      return {
        ...base,
        job: { ...base.job, job_name: 'Knight Ph 1', in_kind_arrangement_id: 'deal-a' },
        inv: { ...base.inv, billed_at: '2026-06-01T12:00:00Z' },
      } as StageRow
    })()
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={[onDeal, invRow('ingram', 'Johnny Ingram', 786)]} paySpeeds={speeds} onClose={vi.fn()} />)
    await settle()
    expect(screen.queryByText('86d waiting')).toBeNull()
    expect(screen.getByTestId('money-waiting-in-kind').textContent).toBe('$75,585 on 1 bill is scheduled in kind, not money waiting')
    expect(screen.getByText(/1 more customer is on their usual pace/)).toBeTruthy()
  })

  it('Money waiting: a dated bill past the baseline makes a row, and expanding lists each job owed', async () => {
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
    await settle()
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

  it('mobile restack (v2.2252): ranked rows show payments and open dollars on one combined line', async () => {
    narrowMatches = true
    try {
      render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={() => {}} />)
      await settle()
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
  it('renders the measurability meter and counts from the quality block', async () => {
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={speeds} onClose={vi.fn()} />)
    await settle()
    expect(screen.getByText(/238 of 545/)).toBeTruthy()
    expect(screen.getByText(/measurable \(44%\)/)).toBeTruthy()
    expect(screen.getByText('164')).toBeTruthy()
    expect(screen.getByText(/payments missing info/)).toBeTruthy()
    expect(screen.getByText(/undated bills/)).toBeTruthy()
    expect(screen.getByText(/quarantined/)).toBeTruthy()
  })

  it('hides the line entirely on pre-v6 payloads', async () => {
    render(<PaySpeedsBreakdownModal todayYmd="2026-08-26" rows={rows} paySpeeds={{ ...speeds, quality: null }} onClose={vi.fn()} />)
    await settle()
    expect(screen.queryByText(/Data health/)).toBeNull()
  })
})
