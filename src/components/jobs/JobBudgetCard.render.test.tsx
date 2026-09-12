// @vitest-environment jsdom
/**
 * Wiring smoke for the Budget card (Burn against the bid, PR 2 — v2.3299):
 * Frame A reads the snapshot's source line, the component rows and the why
 * sentence; Frame B shows the assumption, the ranked candidates with Link,
 * and the typed form. Supabase is stubbed (the bid finder never runs here).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { JobBudgetCard } from './JobBudgetCard'
import { resolveJobBudget } from '../../lib/jobs/jobBudget'
import type { JobBudgetState } from '../../hooks/useJobBudget'
import type { JobChargesTimelineInputs } from '../../hooks/useJobChargesTimelineInputs'

const inputs: JobChargesTimelineInputs = {
  chargeEvents: [
    { source: 'team_labor', dateKey: '2026-09-01', amount: 38_760, label: 't' },
    { source: 'sub_labor', dateKey: '2026-09-02', amount: 3_700, label: 's' },
    { source: 'mercury_card', dateKey: '2026-09-03', amount: 37_900, label: 'p' },
  ],
  valueEvents: [{ dateKey: '2026-09-05', percent: 77, label: 'r' }],
  paymentEvents: [],
  revenue: 123_600,
  fallbackPercent: null,
  teamHours: 1_020,
  cardChargesExcluded: false,
}

const bidRow = { job_id: 'j1', kind: 'bid', bid_id: 'b66', bid_version_id: null, labor_hours: 1180, labor_rate: 38, labor_usd: 44_840, materials_usd: 31_200, subs_usd: 6_500, other_usd: 2_900, total_direct_usd: 85_440, completeness: { rows_total: 26, rows_with_hours: 23, rate_set: true, materials_source: 'takeoff', usable: false }, taken_at: '2026-09-11T15:00:00Z', taken_by: 'u1', note: null, created_at: '', updated_at: '' }

function state(over: Partial<JobBudgetState> = {}): JobBudgetState {
  return { loading: false, busy: false, error: null, row: null, candidates: [], linkedBreakdown: null, reload: vi.fn(async () => {}), linkAndSnapshot: vi.fn(async () => true), setTyped: vi.fn(async () => true), clear: vi.fn(async () => true), ...over }
}

function renderCard(budget: JobBudgetState, over: Partial<Parameters<typeof JobBudgetCard>[0]> = {}) {
  const resolved = resolveJobBudget({ row: budget.row, priceUsd: 123_600, targetMarginPct: 35 })
  return render(<JobBudgetCard jobId="j1" jobLabel="Mission Hill Park" priceUsd={123_600} pctDone={77} inputs={inputs} budget={budget} resolved={resolved} companyRate={31.23} canWrite currentUserId="u1" linkedBid={null} {...over} />)
}

describe('JobBudgetCard · Frame A', () => {
  it('reads the source line, the rows in hours-first order, and the why sentence off a bid snapshot', () => {
    renderCard(state({ row: bidRow as never, linkedBreakdown: { bid_id: 'b66', bid_number: '66', project_name: 'Mission Hill Park', bid_value: 123_600, agreed_value: null, has_estimate: true, labor_hours: 1180, labor_rate: 38, labor_usd: 44_840, materials_usd: 31_200, subs_usd: 6_500, other_usd: 2_900, total_direct_usd: 85_440, completeness: { rows_total: 26, rows_with_hours: 23, rate_set: true, materials_source: 'takeoff', usable: false } } }))
    const card = screen.getByTestId('job-budget-card')
    expect(within(card).getByText('◆ Budget from bid B66')).toBeTruthy()
    expect(within(card).getByText('bid $123,600 = job price')).toBeTruthy()
    expect(within(card).getByText('estimate taken Sep 11 · by you')).toBeTruthy()
    expect(within(card).getByText('3 rows without hours')).toBeTruthy()
    expect(within(card).getByText('materials from takeoff')).toBeTruthy()
    const labor = within(card).getByTestId('budget-row-labor')
    expect(within(labor).getByText('1,020 h')).toBeTruthy()
    expect(within(labor).getByText('1,180 h')).toBeTruthy()
    expect(within(labor).getByText('$44,840 @ $38.00')).toBeTruthy()
    const materials = within(card).getByTestId('budget-row-materials')
    expect(within(materials).getByText('$37,900')).toBeTruthy()
    expect(within(materials).getByText('$31,200')).toBeTruthy()
    expect(within(materials).getByText('$49,221')).toBeTruthy() // 37,900 ÷ 0.77 at today's pace
    expect(within(card).getByTestId('budget-why').textContent).toContain('Materials are $6,700 over the estimate with 23 % of the work left, labor is 9 points ahead of progress, and subs are 20 points under.')
    expect(within(card).getByRole('button', { name: 'Refresh from bid ↻' })).toBeTruthy()
    expect(within(card).getByRole('button', { name: 'Clear' })).toBeTruthy()
  })
})

describe('JobBudgetCard · Frame B', () => {
  it('names the assumption, lists the ranked candidates with Link, and takes a typed budget', async () => {
    const s = state({ candidates: [{ bid_id: 'b375', bid_number: '375', project_name: 'SPACEX BA-02N Architectural', bid_value: 249_715.66, agreed_value: null, outcome: 'won', customer_name: 'Structura, Inc.', rank: 1, reason: "matches the job's price to the dollar", has_estimate: true, estimate_hours: 0, linked_jobs: 0 }] })
    renderCard(s)
    const banner = screen.getByTestId('job-budget-banner')
    // v2.3361: the card is the folded "Link the bid ▾" doorway on the honest Costs tab — it no longer names an assumed budget.
    expect(within(banner).getByText('Link the bid this job came from')).toBeTruthy()
    expect(within(banner).getByText('No bid is linked to this job — its hours and materials will not reach the labor book until it is.')).toBeTruthy()
    expect(within(banner).getByText('One bid matches this job:')).toBeTruthy()
    const cand = within(banner).getByTestId('budget-candidate')
    expect(within(cand).getByText('B375 SPACEX BA-02N Architectural')).toBeTruthy()
    expect(cand.textContent).toContain("matches the job's price to the dollar")
    expect(cand.textContent).toContain('estimate without hours')
    fireEvent.click(within(cand).getByRole('button', { name: 'Link this bid' }))
    expect(s.linkAndSnapshot).toHaveBeenCalledWith('b375')
    fireEvent.click(within(banner).getByRole('button', { name: 'or type a budget…' }))
    fireEvent.change(screen.getByLabelText('Budget labor hours'), { target: { value: '2400' } })
    fireEvent.change(screen.getByLabelText('Budget materials dollars'), { target: { value: '68000' } })
    fireEvent.change(screen.getByLabelText('Budget subs dollars'), { target: { value: '12500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use this budget' }))
    await Promise.resolve()
    expect(s.setTyped).toHaveBeenCalledWith({ laborHours: 2400, laborRate: 31.23, materialsUsd: 68_000, subsUsd: 12_500 })
  })
  it('a linked bid without a snapshot offers to take its estimate', () => {
    renderCard(state({ linkedBreakdown: { bid_id: 'b375', bid_number: '375', project_name: 'SPACEX', bid_value: 249_715.66, agreed_value: null, has_estimate: false, labor_hours: 0, labor_rate: null, labor_usd: 0, materials_usd: 0, subs_usd: 0, other_usd: 0, total_direct_usd: 0, completeness: { rows_total: 0, rows_with_hours: 0, rate_set: false, materials_source: 'none', usable: false } } }), { linkedBid: { id: 'b375', bid_number: '375', project_name: 'SPACEX' } })
    const linked = screen.getByTestId('budget-linked-no-snapshot')
    expect(linked.textContent).toContain('Linked to B375 SPACEX · no cost estimate yet')
    expect(within(linked).getByRole('button', { name: 'Take its estimate as the budget' })).toBeTruthy()
  })
  it('read-only roles see the candidates but no Link or typed form', () => {
    renderCard(state({ candidates: [{ bid_id: 'b1', bid_number: '1', project_name: 'X', bid_value: 1, agreed_value: null, outcome: 'won', customer_name: null, rank: 2, reason: 'same GC, won', has_estimate: false, estimate_hours: 0, linked_jobs: 0 }] }), { canWrite: false })
    expect(screen.queryByRole('button', { name: 'Link this bid' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'or type a budget…' })).toBeNull()
  })
})
