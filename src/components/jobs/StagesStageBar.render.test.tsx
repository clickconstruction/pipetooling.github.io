// @vitest-environment jsdom
/**
 * Wiring smoke for the Pipeline row's bar (v2.3198 chips; v2.3419 the two
 * channels on every row): with stages the cell shows the chips, the segments
 * and the words and drops the amber legend row; a single-line job shows one
 * segment and the four-row legend; a job with no bid value shows the words
 * alone; without a view it is the classic money bar.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { buildStagesMoneyBarModel } from '../../lib/stagesMoneyBar'
import { crewPositionsFromRpc, type JobCrewPositionRpcRow } from '../../lib/jobs/jobCrewPosition'
import { progressPaymentForJob } from '../../lib/jobs/progressPaymentForJob'
import StagesProgressPaymentCell from './StagesProgressPaymentCell'

const today = '2026-09-14'
const line = (id: string, name: string, price: number, seq: number) => ({ id, name, count: 1, line_unit_price: price, sequence_order: seq, invoice_id: null, stage_kind: 'any', progress_pct: null })
const crewRow = (over: Partial<JobCrewPositionRpcRow> & { job_ledger_id: string }): JobCrewPositionRpcRow => ({
  last_work_date: null,
  last_day_people: null,
  sessions_60d: 0,
  people_60d: 0,
  sheet_stage: null,
  sheet_names: null,
  sheet_date: null,
  sheet_progress_pct: null,
  sheet_stage_changed_at: null,
  report_pct: null,
  report_at: null,
  pct_manual_at: null,
  ...over,
})
const heronCrew = crewPositionsFromRpc([crewRow({ job_ledger_id: 'heron', last_work_date: '2026-09-12', last_day_people: ['Behar Kraja', 'Malachi Jones'], sessions_60d: 14, people_60d: 6, sheet_stage: 'working', sheet_names: 'Behar | Malachi', sheet_date: '2026-09-10' })], today).get('heron')!

// J931 Heron Construction as it stood on 2026-09-14.
const heron = progressPaymentForJob(
  { id: 'heron', revenue: 48_700, payments_made: 24_359.44, pct_complete: 40, status: 'working', fixtures: [line('r', 'Rough In', 19_480, 0), line('t', 'Top Out', 19_480, 1), line('s', 'Trim Set', 9_740, 2)], invoices: [], payments: [] },
  heronCrew,
  today,
)

describe('StagesProgressPaymentCell with the v2.3419 view', () => {
  it('stages: the three chips with the live crew, the segments, the words, and Paid / Billed / Left — no amber row', () => {
    render(<StagesProgressPaymentCell model={heron.model} pctComplete={40} view={heron.view} />)
    const strip = screen.getByRole('list', { name: 'Stages' })
    const chips = within(strip).getAllByRole('listitem')
    expect(chips).toHaveLength(3)
    expect(chips[0]!.textContent).toContain('Rough')
    expect(chips[1]!.textContent).toContain('Top Out')
    expect(chips[1]!.textContent).not.toContain('Behar') // v2.3459: no name on the chip
    expect(chips[2]!.textContent).toContain('Trim')
    // v2.3449: the row PRINTS the lead (the legend under it carries the money);
    // v2.3459: without the stage (the lit chip) or the names (the crew column).
    // The bar's accessible name and tooltip keep the whole sentence.
    const printed = 'Worked Sat · 40%'
    const full = 'Top Out · Behar & Malachi on site Sat · 40% typed · $24,359 paid, nothing billed'
    const bar = screen.getByRole('img', { name: full })
    expect(bar.querySelectorAll('[data-segment-state]')).toHaveLength(3)
    expect(bar.querySelector('[data-segment-state="live"]')).toBeTruthy()
    expect(screen.getByText(printed)).toBeTruthy()
    expect(screen.queryByText(/Done, not billed/)).toBeNull()
    expect(screen.queryByText(/Not done/)).toBeNull()
    expect(screen.getByText('Left on Job')).toBeTruthy()
    expect(screen.getByText('$48,700 bid')).toBeTruthy()
  })

  it('a single-line job: one segment, no chips, the four-row legend', () => {
    // J977 Springtown, the owner's screenshot.
    const { model, view } = progressPaymentForJob(
      { id: 'sp', revenue: 40_000, payments_made: 13_412, pct_complete: 80, status: 'working', fixtures: [line('e', 'Electrical', 40_000, 0)], invoices: [{ id: 'i1', status: 'billed', amount: 11_770 }], payments: [] },
      null,
      today,
    )
    render(<StagesProgressPaymentCell model={model} pctComplete={80} view={view} />)
    expect(screen.queryByRole('list', { name: 'Stages' })).toBeNull()
    expect(screen.getByRole('img').querySelectorAll('[data-segment-state]')).toHaveLength(1)
    expect(screen.getByText('Nobody clocked in · 80%')).toBeTruthy()
    expect(screen.getByRole('img', { name: /nobody clocked in · 80% typed · \$13,412 paid · \$11,770 billed · \$6,818 done, not billed/ })).toBeTruthy()
    expect(screen.getByText(/Done, not billed/)).toBeTruthy()
    expect(screen.getByText(/Not done/)).toBeTruthy()
  })

  it('no bid value: the words alone, red when a crew is on site', () => {
    const crew = crewPositionsFromRpc([crewRow({ job_ledger_id: 'drf', last_work_date: today, last_day_people: ['Edgar Lopez', 'Jose Cruz'], sessions_60d: 2, people_60d: 2 })], today).get('drf')!
    const { model, view } = progressPaymentForJob({ id: 'drf', revenue: 0, payments_made: 0, pct_complete: null, status: 'working', fixtures: [], invoices: [], payments: [] }, crew, today)
    render(<StagesProgressPaymentCell model={model} pctComplete={null} view={view} onNoBidValueClick={() => {}} />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('Worked today · no lines on the job · nothing to bill against')).toBeTruthy()
    expect(screen.getByTitle('Edgar & Jose on site today · no lines on the job · nothing to bill against')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'no bid value' })).toBeTruthy()
  })

  it('compact cards show the strip and the condensed line', () => {
    render(<StagesProgressPaymentCell compact model={heron.model} pctComplete={40} view={heron.view} />)
    expect(screen.getByRole('list', { name: 'Stages' })).toBeTruthy()
    expect(screen.queryByText(/Done, not billed/)).toBeNull()
    expect(screen.getByText(/Left/)).toBeTruthy()
  })

  it('keeps the classic money bar when there is no view (older callers)', () => {
    const model = buildStagesMoneyBarModel({ totalBill: 37_745, paymentsMade: 13_211, pctComplete: 55 })
    render(<StagesProgressPaymentCell model={model} pctComplete={55} />)
    expect(screen.queryByRole('list', { name: 'Stages' })).toBeNull()
    expect(screen.getByText(/Done, not billed/)).toBeTruthy()
  })

  it('v2.3461: with onStageClick every chip and the bar are buttons that open Bill; without it nothing is clickable', () => {
    let opened = 0
    render(<StagesProgressPaymentCell model={heron.model} pctComplete={40} view={heron.view} onStageClick={() => { opened += 1 }} />)
    const strip = screen.getByRole('list', { name: 'Stages' })
    const chipButtons = within(strip).getAllByRole('button')
    expect(chipButtons).toHaveLength(3)
    fireEvent.click(chipButtons[2]!)
    expect(opened).toBe(1)
    const bar = screen.getByRole('img', { name: /Top Out · Behar & Malachi on site Sat/ })
    fireEvent.click(bar)
    expect(opened).toBe(2)
    expect(screen.queryByText('Set stages')).toBeNull()
  })
  it('v2.3461: a bar without onStageClick has no buttons', () => {
    render(<StagesProgressPaymentCell model={heron.model} pctComplete={40} view={heron.view} />)
    expect(within(screen.getByRole('list', { name: 'Stages' })).queryByRole('button')).toBeNull()
    expect(screen.queryByRole('button', { name: /Open Bill/ })).toBeNull()
  })
})
