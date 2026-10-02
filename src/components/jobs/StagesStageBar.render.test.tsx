// @vitest-environment jsdom
/**
 * Wiring smoke for the Pipeline row's money bar (v2.4351, progress bar pass 4): blocks
 * filled by their money (green paid · blue billed · amber done, not billed · grey), a tick
 * for the % done (hollow when older than the last day worked), stage names under the
 * blocks, the % date beside the box, no words under the bar, a legend without $0 rows,
 * and a job with no price showing Add the price. Without a view it is the classic money bar.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { buildStagesMoneyBarModel } from '../../lib/stagesMoneyBar'
import { crewPositionsFromRpc, type JobCrewPositionRpcRow } from '../../lib/jobs/jobCrewPosition'
import { progressPaymentForJob } from '../../lib/jobs/progressPaymentForJob'
import StagesProgressPaymentCell from './StagesProgressPaymentCell'
import { stageNameLabel } from '../../lib/jobs/jobMoneyBar'

const today = '2026-10-01'
const line = (id: string, name: string, price: number, seq: number, extra: Record<string, unknown> = {}) => ({ id, name, count: 1, line_unit_price: price, sequence_order: seq, invoice_id: null, stage_kind: 'any', progress_pct: null, ...extra })
const stage = (id: string, name: string, price: number, seq: number) => line(id, name, price, seq, { stage_kind: 'order' })
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
const heronCrew = crewPositionsFromRpc([crewRow({ job_ledger_id: 'heron', last_work_date: '2026-09-12', last_day_people: ['Behar Kraja', 'Malachi Jones'], sessions_60d: 14, people_60d: 6, pct_set_at: '2026-08-07T12:00:00Z', pct_source: 'seed' })], today).get('heron')!

// J931 Heron Construction as it stood on 2026-10-01.
const heron = progressPaymentForJob(
  { id: 'heron', revenue: 48_700, payments_made: 24_359.44, pct_complete: 40, status: 'working', fixtures: [stage('r', 'Rough In', 19_480, 0), stage('t', 'Top Out', 19_480, 1), stage('s', 'Trim Set', 9_740, 2)], invoices: [], payments: [] },
  heronCrew,
  today,
)

const slicesOf = (block: Element) => [...block.querySelectorAll('[data-money-slice]')].map((s) => `${s.getAttribute('data-money-slice')} ${Math.round(parseFloat((s as HTMLElement).style.width))}`)

describe('StagesProgressPaymentCell with the pass-4 money bar (v2.4351)', () => {
  it('stages: blocks filled by money, a hollow tick, names under the blocks, the % date beside the box, no words, Paid and Left only', () => {
    render(<StagesProgressPaymentCell model={heron.model} pctComplete={40} view={heron.view} onPctCommit={() => {}} />)
    const bar = screen.getByRole('img', { name: 'Top Out · Behar & Malachi on site Sep 12 · 40% set Aug 7 · $24,359 paid, nothing billed' })
    const blocks = bar.querySelectorAll('[data-money-block]')
    expect(blocks).toHaveLength(3)
    expect(slicesOf(blocks[0]!)).toEqual(['paid 100'])
    expect(slicesOf(blocks[1]!)).toEqual(['paid 25'])
    expect(slicesOf(blocks[2]!)).toEqual([])
    expect(bar.querySelector('[data-progress-tick]')?.getAttribute('data-progress-tick')).toBe('hollow')
    const names = within(screen.getByRole('list', { name: 'Stages' })).getAllByRole('listitem')
    expect(names.map((n) => n.textContent)).toEqual(['1 Rough ✓', '2 Top Out', '3 Trim'])
    expect(names[1]!.style.fontWeight).toBe('700')
    const date = document.querySelector('[data-pct-date]') as HTMLElement
    expect(date.textContent).toBe(' · Aug 7')
    expect(date.getAttribute('data-pct-date')).toBe('stale')
    // No words under the bar: the crew and the day are in Crew & Dates.
    expect(document.querySelector('[data-progress-words]')).toBeNull()
    expect(screen.queryByText(/Worked Sep 12/)).toBeNull()
    expect(screen.getByText(/50% Paid/)).toBeTruthy()
    expect(screen.queryByText(/Billed/)).toBeNull()
    expect(screen.getByText('Left on Job')).toBeTruthy()
    expect(screen.getByText('$48,700 bid')).toBeTruthy()
  })

  it('a single-line job (Stimson-like): paid, done-not-billed amber, a solid tick, and the four rows that carry money', () => {
    const { model, view } = progressPaymentForJob(
      { id: 'st', revenue: 6_720, payments_made: 4_520, pct_complete: 75, status: 'waiting', fixtures: [line('a', 'Handrails', 4_520, 0), line('d', 'Two custom window replacements', 2_200, 1)], invoices: [], payments: [] },
      null,
      today,
    )
    render(<StagesProgressPaymentCell model={model} pctComplete={75} view={view} />)
    expect(screen.queryByRole('list', { name: 'Stages' })).toBeNull()
    const blocks = screen.getByRole('img').querySelectorAll('[data-money-block]')
    expect(slicesOf(blocks[0]!)).toEqual(['paid 100'])
    expect(slicesOf(blocks[1]!)).toEqual(['unbilled 24'])
    expect(screen.getByRole('img').querySelector('[data-progress-tick]')?.getAttribute('data-progress-tick')).toBe('solid')
    expect(screen.getByText(/67% Paid/)).toBeTruthy()
    expect(screen.queryByText(/% Billed/)).toBeNull() // $0 row left out
    expect(screen.getByText(/8% Done, not billed/)).toBeTruthy()
    expect(screen.getByText(/25% Not done/)).toBeTruthy()
  })

  it('a billed one-line job (1009): blue fills the bar, only Billed and Left on Job print', () => {
    const { model, view } = progressPaymentForJob(
      { id: 'lx', revenue: 350, payments_made: 0, pct_complete: 100, status: 'billed', fixtures: [line('t', 'Trip charge', 350, 0, { invoice_id: 'b' })], invoices: [{ id: 'b', status: 'billed', amount: 350 }], payments: [] },
      null,
      today,
    )
    render(<StagesProgressPaymentCell model={model} pctComplete={100} view={view} />)
    expect(slicesOf(screen.getByRole('img').querySelector('[data-money-block]')!)).toEqual(['billed 100'])
    expect(screen.getByText(/100% Billed/)).toBeTruthy()
    expect(screen.queryByText(/Paid/)).toBeNull()
    expect(screen.queryByText(/Done, not billed/)).toBeNull()
    expect(screen.queryByText(/Not done/)).toBeNull()
    expect(screen.getByText('Left on Job')).toBeTruthy()
  })

  it('no price: a dashed track and Add the price in place of the red pill, the sentence and the empty legend', () => {
    const crew = crewPositionsFromRpc([crewRow({ job_ledger_id: 'drf', last_work_date: today, last_day_people: ['Edgar Lopez', 'Jose Cruz'], sessions_60d: 2, people_60d: 2 })], today).get('drf')!
    const { model, view } = progressPaymentForJob({ id: 'drf', revenue: 0, payments_made: 0, pct_complete: null, status: 'working', fixtures: [], invoices: [], payments: [] }, crew, today)
    let opened = 0
    render(<StagesProgressPaymentCell model={model} pctComplete={null} view={view} onNoBidValueClick={() => { opened += 1 }} />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('button', { name: 'no bid value' })).toBeNull()
    expect(screen.getByText('No price yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add the price ›' }))
    expect(opened).toBe(1)
    expect(screen.queryByText('Left on Job')).toBeNull()
    expect(screen.queryByText(/nothing to bill against/)).toBeNull()
  })

  it('compact cards: the same bar and a one-line legend without $0 items', () => {
    render(<StagesProgressPaymentCell compact model={heron.model} pctComplete={40} view={heron.view} />)
    expect(screen.getByRole('list', { name: 'Stages' })).toBeTruthy()
    expect(screen.getByText(/Paid \$24,359/)).toBeTruthy()
    expect(screen.queryByText(/Billed/)).toBeNull()
    expect(screen.getByText(/Left \$24,341/)).toBeTruthy()
  })

  it('keeps the classic money bar when there is no view (older callers)', () => {
    const model = buildStagesMoneyBarModel({ totalBill: 37_745, paymentsMade: 13_211, pctComplete: 55 })
    render(<StagesProgressPaymentCell model={model} pctComplete={55} />)
    expect(screen.queryByRole('list', { name: 'Stages' })).toBeNull()
    expect(screen.getByText(/Done, not billed/)).toBeTruthy()
    expect(screen.getByText(/Billed/)).toBeTruthy() // the classic legend keeps its four rows
  })

  it('with onStageClick the bar is one button into Bill; without it nothing is clickable', () => {
    let opened = 0
    const { unmount } = render(<StagesProgressPaymentCell model={heron.model} pctComplete={40} view={heron.view} onStageClick={() => { opened += 1 }} />)
    fireEvent.click(screen.getByRole('button', { name: /Top Out · Behar & Malachi on site Sep 12/ }))
    expect(opened).toBe(1)
    unmount()
    render(<StagesProgressPaymentCell model={heron.model} pctComplete={40} view={heron.view} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('stageNameLabel', () => {
  it('keeps the name when it fits its block, else the number; a done stage keeps its check', () => {
    const n = { key: 'a', widthPct: 20, number: '3', name: 'Trim', done: false, bold: false }
    expect(stageNameLabel(n, 80)).toBe('3 Trim')
    expect(stageNameLabel(n, 20)).toBe('3')
    expect(stageNameLabel({ ...n, done: true }, 10)).toBe('3 ✓')
    expect(stageNameLabel(n, null)).toBe('3 Trim')
  })
})
