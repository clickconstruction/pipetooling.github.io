// @vitest-environment jsdom
/**
 * The ② money card (v2.4307): the figures, the % done box, a block per line with the % done marker,
 * and the line rows — tick boxes for a bill of picked lines (locked when a bill made by amount
 * covers the line to the cent), Bill it on a ready stage, and the picked-lines button with its
 * cents-exact backstop. Carries the old strip's coverage cases (v2.1132) and Still to bill's (v2.4303).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { JobFormMoneyCard, type MoneyCardPicked } from './JobFormMoneyCard'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'
import { buildJobSegmentsBar, type JobDollarCoverage } from '../../lib/jobs/jobSegmentsCoverage'
import { stagePlanFromForm } from '../../lib/jobs/stagePlanForm'
import { billTabFigures, billTabLines } from '../../lib/jobs/billTabMoney'
import type { StagePlan } from '../../lib/jobs/stagePlan'

afterEach(cleanup)

const row = (over: Partial<FixtureRow> & { id: string; name: string }): FixtureRow => ({ count: 1, line_unit_price: 1000, line_description: '', invoice_id: null, ...over })
const noPick: MoneyCardPicked = { count: 0, netDollars: 0, coveredDollars: 0, over: false }

function renderCard(opts: {
  fixtures: FixtureRow[]
  plan?: StagePlan | null
  coverage?: JobDollarCoverage | null
  bar: { total: number; paid: number; billedUnpaid: number; draft: number; remaining: number }
  pct?: number | null
  statusById?: Record<string, string>
  selected?: Set<string>
  picked?: MoneyCardPicked
  onToggleSegment?: (k: string) => void
  onBillRow?: (k: string) => void
  onBillPicked?: () => void
  onPctCommit?: (n: number | null) => void
}) {
  const segments = buildJobSegmentsBar({ fixtures: opts.fixtures, riderFeesDollars: 0, invoiceStatusById: opts.statusById ?? {} })
  const lines = billTabLines({ segments, coverage: opts.coverage ?? null, plan: opts.plan ?? null })
  return renderWithProviders(
    <JobFormMoneyCard
      figures={billTabFigures(opts.bar, opts.pct ?? null)}
      segments={segments}
      lines={lines}
      plan={opts.plan ?? null}
      coverage={opts.coverage ?? null}
      onPctCommit={opts.onPctCommit ?? (() => {})}
      selectedIds={opts.selected ?? new Set()}
      onToggleSegment={opts.onToggleSegment ?? (() => {})}
      onBillRow={opts.onBillRow ?? (() => {})}
      billingFixtureId={null}
      picked={opts.picked ?? noPick}
      onBillPicked={opts.onBillPicked ?? (() => {})}
      billingPicked={false}
    />,
  )
}

describe('the money card — figures and the % done box', () => {
  it('says Done, Paid, Billed (open) and Left to bill once, with what is done but not billed', () => {
    renderCard({
      fixtures: [row({ id: 'a', name: 'Water heater swap', line_unit_price: 1200, invoice_id: 'inv-a' }), row({ id: 'b', name: 'Repipe', line_unit_price: 3600 })],
      statusById: { 'inv-a': 'billed' },
      bar: { total: 4800, paid: 0, billedUnpaid: 1200, draft: 0, remaining: 3600 },
      pct: 60,
    })
    const card = within(screen.getByTestId('money-card'))
    expect(screen.getByTestId('money-done').textContent).toBe('$2,880')
    expect(card.getByText('Billed, open').nextSibling?.textContent).toBe('$1,200')
    expect(card.getByText('Left to bill').nextSibling?.textContent).toBe('$3,600')
    expect(card.queryByText('Drafted')).toBeNull()
    expect(screen.getByTestId('money-done-not-billed').textContent).toBe('$1,680 done, not billed')
    expect(card.getByText('60% done')).toBeTruthy()
  })

  it('shows Drafted only while a bill waits to go out, so the figures still add up', () => {
    renderCard({ fixtures: [row({ id: 'a', name: 'Repipe', line_unit_price: 1000 })], bar: { total: 1000, paid: 0, billedUnpaid: 0, draft: 400, remaining: 600 } })
    expect(within(screen.getByTestId('money-card')).getByText('Drafted').nextSibling?.textContent).toBe('$400')
  })

  it('commits a typed % done on Enter, and an emptied box as none', () => {
    const onPctCommit = vi.fn()
    renderCard({ fixtures: [row({ id: 'a', name: 'Repipe' })], bar: { total: 1000, paid: 0, billedUnpaid: 0, draft: 0, remaining: 1000 }, pct: 20, onPctCommit })
    const box = screen.getByLabelText('Percent complete') as HTMLInputElement
    fireEvent.change(box, { target: { value: '45' } })
    fireEvent.blur(box)
    expect(onPctCommit).toHaveBeenLastCalledWith(45)
    fireEvent.change(box, { target: { value: '' } })
    fireEvent.blur(box)
    expect(onPctCommit).toHaveBeenLastCalledWith(null)
  })
})

describe('the money card — lines and coverage (v2.1132, v2.4303)', () => {
  const fixtures = [row({ id: 'a', name: 'Rough-in', line_unit_price: 1000 }), row({ id: 'b', name: 'Top-out', line_unit_price: 1000 }), row({ id: 'c', name: 'Trim', line_unit_price: 1000 })]
  const coverage: JobDollarCoverage = {
    unattributedDollars: 1500,
    remainingDollars: 1500,
    bySegmentKey: { a: { coveredDollars: 1000, fullyCovered: true }, b: { coveredDollars: 500, fullyCovered: false } },
  }

  it('locks the fully covered line (no tick box) and keeps the part-covered one tickable, saying how much is covered', () => {
    renderCard({ fixtures, coverage, bar: { total: 3000, paid: 0, billedUnpaid: 1500, draft: 0, remaining: 1500 } })
    expect(within(screen.getByTestId('money-line-a')).queryByRole('checkbox')).toBeNull()
    expect(within(screen.getByTestId('money-line-a')).getByText('covered')).toBeTruthy()
    expect(within(screen.getByTestId('money-line-b')).getByRole('checkbox')).toBeTruthy()
    expect(within(screen.getByTestId('money-line-b')).getByText('$500 of $1,000 covered · not billed')).toBeTruthy()
  })

  it('a tick or a press on a tickable block picks the line; a covered block cannot be picked', () => {
    const onToggleSegment = vi.fn()
    renderCard({ fixtures, coverage, bar: { total: 3000, paid: 0, billedUnpaid: 1500, draft: 0, remaining: 1500 }, onToggleSegment })
    fireEvent.click(within(screen.getByTestId('money-line-c')).getByRole('checkbox'))
    expect(onToggleSegment).toHaveBeenLastCalledWith('c')
    const blocks = screen.getAllByRole('button', { name: /^(Rough-in|Top-out|Trim):/ })
    expect((blocks[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(blocks[1]!)
    expect(onToggleSegment).toHaveBeenLastCalledWith('b')
  })

  it('bills the picked lines for what is left on them, and says what was taken off', () => {
    const onBillPicked = vi.fn()
    renderCard({
      fixtures,
      coverage,
      bar: { total: 3000, paid: 0, billedUnpaid: 1500, draft: 0, remaining: 1500 },
      selected: new Set(['b', 'c']),
      picked: { count: 2, netDollars: 1500, coveredDollars: 500, over: false },
      onBillPicked,
    })
    fireEvent.click(screen.getByTestId('bill-picked'))
    expect(onBillPicked).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('bill-picked').textContent).toBe('Bill the 2 picked · $1,500')
    expect(screen.getByText('A draft for what is left on them. The $500 already covered is taken off.')).toBeTruthy()
  })

  it('backstop: a pick that would bill past what is left is refused, with the red note', () => {
    renderCard({
      fixtures,
      coverage,
      bar: { total: 3000, paid: 0, billedUnpaid: 1500, draft: 0, remaining: 1500 },
      picked: { count: 2, netDollars: 2000, coveredDollars: 0, over: true },
    })
    expect((screen.getByTestId('bill-picked') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('More than the $1,500 left to bill. Money already paid or billed covers the rest.')).toBeTruthy()
  })

  it('job 1059: one line a plain bill covers needs no line list', () => {
    renderCard({
      fixtures: [row({ id: 'pre', name: 'Pretest', stage_kind: 'any', line_unit_price: 250 })],
      coverage: { unattributedDollars: 250, remainingDollars: 0, bySegmentKey: { pre: { coveredDollars: 250, fullyCovered: true } } },
      bar: { total: 250, paid: 0, billedUnpaid: 250, draft: 0, remaining: 0 },
      pct: 100,
    })
    expect(screen.queryByTestId('money-lines')).toBeNull()
    expect(screen.queryByTestId('money-done-not-billed')).toBeNull()
  })
})

describe('the money card — Bill it on a ready stage', () => {
  it('offers Bill it on the ready stage only, and says what the next one waits on', () => {
    const fixtures = [row({ id: 'rough', name: 'Rough-in', stage_kind: 'order' }), row({ id: 'top', name: 'Top-out', stage_kind: 'order' })]
    const plan = stagePlanFromForm({
      fixtures,
      windows: [
        { id: 'w-rough', fixture_id: 'rough', window_start: '2026-09-01', window_end: '2026-09-02' },
        { id: 'w-top', fixture_id: 'top', window_start: '2026-09-08', window_end: '2026-09-09' },
      ],
      orders: [
        { id: 'o-rough', stage_window_id: 'w-rough', status: 'settled', picked_start: '2026-09-01', picked_end: '2026-09-02', labor_job_id: 's-rough' },
        { id: 'o-top', stage_window_id: 'w-top', status: 'settled', picked_start: '2026-09-08', picked_end: '2026-09-09', labor_job_id: 's-top' },
      ],
      sheets: [
        { id: 's-rough', stage: 'customer_pay', progress_pct: 100, stage_changed_at: '2026-09-02T15:00:00Z' },
        { id: 's-top', stage: 'customer_pay', progress_pct: 100, stage_changed_at: '2026-09-09T15:00:00Z' },
      ],
      invoices: [],
      payments: [],
      todayYmd: '2026-09-10',
    })
    const onBillRow = vi.fn()
    renderCard({ fixtures, plan, bar: { total: 2000, paid: 0, billedUnpaid: 0, draft: 0, remaining: 2000 }, onBillRow })
    const bills = screen.getAllByRole('button', { name: 'Bill it' })
    expect(bills).toHaveLength(1)
    fireEvent.click(bills[0]!)
    expect(onBillRow).toHaveBeenCalledWith('rough')
    expect(within(screen.getByTestId('money-line-top')).getByText('passed Sep 9 · waits on stage 1')).toBeTruthy()
  })
})
