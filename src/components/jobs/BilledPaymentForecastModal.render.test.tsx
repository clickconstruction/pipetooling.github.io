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
import { buildWorkMonthsByJob, type WorkSessionInput } from '../../lib/jobs/forecastWorkMonths'

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
    // Money waiting replaced the drift dumbbells (v2.2382) — one view, no pills.
    expect(dialog.textContent).toContain('Money waiting')
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

// ---- Work months under a row (the lien clock's evidence) ----

function subRow(): StageRow {
  const job = {
    id: 'j650',
    hcp_number: '650',
    click_number: null,
    job_name: 'ATI Schertz',
    customer_name: 'ATI Schertz',
    customer_id: 'ati',
    gc_customer_id: 'gc1',
    revenue: 33500,
    payments_made: 0,
    payments: [],
    invoices: [],
  } as unknown as JobWithDetails
  return {
    kind: 'invoice',
    job,
    inv: { id: 'inv650', job_id: 'j650', amount: 26800, status: 'billed', sequence_order: 1, estimated_bill_date: null, billed_at: '2026-07-21T15:00:00Z' },
  } as unknown as StageRow
}

function session(jobId: string, workDate: string, userId: string, hours: number, approved = true): WorkSessionInput {
  return {
    jobId,
    userId,
    workDate,
    clockedInAt: `${workDate}T13:00:00Z`,
    clockedOutAt: `${workDate}T${String(13 + hours).padStart(2, '0')}:00:00Z`,
    approved,
  }
}

const TODAY = '2026-09-14'
const NAMES = { u1: 'Tristen Vela', u2: 'Malachi Ray' }
const workMonths = buildWorkMonthsByJob(
  [
    session('j650', '2026-06-08', 'u1', 6),
    session('j650', '2026-06-08', 'u2', 6),
    session('j650', '2026-08-20', 'u1', 8),
    session('j650', '2026-09-08', 'u2', 8, false),
    session('j1', '2026-08-04', 'u1', 8),
  ],
  [
    { jobId: 'j650', isSub: true, propertyKind: '', noticedMonths: new Set() },
    { jobId: 'j1', isSub: false, propertyKind: '', noticedMonths: new Set() },
  ],
  NAMES,
  TODAY,
)

describe('BilledPaymentForecastModal work months', () => {
  it('shows the notice chip on a sub row whose month is closing, the quiet line above the buckets, and none on a direct row', () => {
    render(
      <BilledPaymentForecastModal
        rows={[subRow(), billedRow()]}
        paySpeeds={speeds}
        todayYmd={TODAY}
        onClose={vi.fn()}
        onOpenInvoice={vi.fn()}
        workMonths={workMonths}
      />,
    )
    // June's notice (commercial: 15th of the 3rd month) is due tomorrow.
    expect(screen.getByText('⏱ Jun notice due tomorrow')).toBeTruthy()
    expect(screen.getByRole('note').textContent).toContain('1 work month on 1 sub job has a lien notice closing within 14 days')
    expect(screen.getByRole('note').textContent).toContain('$26,800 open')
    expect(screen.getByRole('note').textContent).toContain('650 · ATI Schertz Jun 2026 work, notice due tomorrow')
    // Both rows have sessions → both get a chevron; the direct row has no chip.
    expect(screen.getByRole('button', { name: 'Show work months for 650 · ATI Schertz' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show work months for 964 · Pondhill demo' })).toBeTruthy()
    expect(screen.getAllByText(/^⏱ /)).toHaveLength(1)
  })

  it('opening a sub row lists each month with people, hours, pending hours and its notice; Send notice… opens the Lien window for the job', () => {
    const onOpenLienNotice = vi.fn()
    render(
      <BilledPaymentForecastModal
        rows={[subRow()]}
        paySpeeds={speeds}
        todayYmd={TODAY}
        onClose={vi.fn()}
        onOpenInvoice={vi.fn()}
        workMonths={workMonths}
        onOpenLienNotice={onOpenLienNotice}
      />,
    )
    expect(screen.queryByRole('region', { name: 'Work months' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show work months for 650 · ATI Schertz' }))
    const panel = screen.getByRole('region', { name: 'Work months' })
    expect(panel.textContent).toContain('Jun2026')
    expect(screen.getByTestId('work-month-2026-06').textContent).toContain('2 people · 12 h · 1 day · 43% of hours')
    expect(screen.getByTestId('work-month-2026-06').textContent).toContain('due tomorrow')
    expect(screen.getByTestId('work-month-2026-06').textContent).toContain('by Sep 15')
    // September's session is unapproved → pending hours called out, week bar hatched (title says so).
    expect(screen.getByTestId('work-month-2026-09').textContent).toContain('8 h pending')
    expect(screen.getByTitle(/Week of Sep 7 \(7d ago\) · Malachi · 8 h · 1 day · 8 h awaiting approval/)).toBeTruthy()
    // The role line teaches the rule and the affidavit date from the last month.
    expect(panel.textContent).toContain('Sub job')
    expect(panel.textContent).toContain('affidavit for all of it by Jan 15, 2027')
    expect(panel.textContent).toContain('property kind unknown')
    fireEvent.click(screen.getAllByRole('button', { name: 'Send notice…' })[0]!)
    expect(onOpenLienNotice).toHaveBeenCalledWith('j650')
    fireEvent.click(screen.getByRole('button', { name: 'Hide work months for 650 · ATI Schertz' }))
    expect(screen.queryByRole('region', { name: 'Work months' })).toBeNull()
  })

  it('a direct-with-owner row explains it has no monthly notice and shows one affidavit date', () => {
    render(
      <BilledPaymentForecastModal
        rows={[billedRow()]}
        paySpeeds={speeds}
        todayYmd={TODAY}
        onClose={vi.fn()}
        onOpenInvoice={vi.fn()}
        workMonths={workMonths}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show work months for 964 · Pondhill demo' }))
    const panel = screen.getByRole('region', { name: 'Work months' })
    expect(panel.textContent).toContain('Direct with owner')
    expect(panel.textContent).toContain('no monthly notice')
    expect(panel.textContent).toContain('one affidavit by Dec 15, 2026')
    // Knight is commercial: the "set the GC on the job" prompt shows.
    expect(panel.textContent).toContain('if Knight Contracting is a GC and someone else owns the site')
    expect(screen.queryByRole('button', { name: 'Send notice…' })).toBeNull()
  })

  it('rows without sessions get no chevron, and the footer says when months are still loading', () => {
    const { container, rerender } = render(
      <BilledPaymentForecastModal rows={[billedRow()]} paySpeeds={speeds} todayYmd={TODAY} onClose={vi.fn()} onOpenInvoice={vi.fn()} workMonths={null} />,
    )
    expect(container.textContent).toContain('loading the months worked…')
    rerender(
      <BilledPaymentForecastModal rows={[billedRow()]} paySpeeds={speeds} todayYmd={TODAY} onClose={vi.fn()} onOpenInvoice={vi.fn()} workMonths={{}} />,
    )
    expect(container.textContent).not.toContain('loading the months worked')
    expect(screen.queryByRole('button', { name: /work months for/ })).toBeNull()
  })
})
