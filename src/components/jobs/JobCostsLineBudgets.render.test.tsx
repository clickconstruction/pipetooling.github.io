// @vitest-environment jsdom
/**
 * The Costs tab's Where we are card (v2.6300, punch list #234): only a project
 * (a line In order) draws it; the Labor and Materials bars read spent of budget
 * with the job's percent as a mark and turn red ten points past the work; a
 * line reads its own columns and never borrows the job's percent.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import { JobCostsLineBudgets } from './JobCostsLineBudgets'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { Database } from '../../types/database'

type Fixture = Database['public']['Tables']['jobs_ledger_fixtures']['Row']

afterEach(() => cleanup())

function fixture(over: Partial<Fixture> & { id: string; name: string }): Fixture {
  return {
    bill_to_party: null,
    budget_labor_pct: null,
    budget_materials_pct: null,
    budget_rate_usd: null,
    budget_reviewed_at: null,
    budget_reviewed_by: null,
    budget_source: null,
    budget_tuned_at: null,
    count: 1,
    created_at: null,
    discount_basis_positions: null,
    discount_pct: null,
    discount_reason: null,
    invoice_id: null,
    job_id: 'j',
    line_description: null,
    line_kind: 'work',
    line_unit_price: 24000,
    progress_at: null,
    progress_by: null,
    progress_pct: null,
    progress_report_id: null,
    sequence_order: 0,
    shared_with_gc: false,
    stage_kind: 'order',
    ...over,
  }
}

const project = [
  fixture({ id: 'a', name: 'Rough In', line_unit_price: 24000 }),
  fixture({ id: 'b', name: 'Top Out', line_unit_price: 16000, budget_labor_pct: 50, budget_materials_pct: 30, budget_source: 'tuned', progress_pct: 40 }),
  fixture({ id: 'c', name: 'Water heater, added', line_unit_price: 4000, stage_kind: 'any' }),
  fixture({ id: 'd', name: 'Negotiated discount', line_kind: 'discount', line_unit_price: -1000, stage_kind: null }),
]

describe('JobCostsLineBudgets', () => {
  it('draws nothing on a service call (no line In order)', () => {
    renderWithProviders(<JobCostsLineBudgets fixtures={[fixture({ id: 'a', name: 'Service', stage_kind: 'any' })]} teamHours={0} spend={{ teamUsd: 0, subUsd: 0, partsUsd: 0 }} jobPctDone={null} />)
    expect(screen.queryByTestId('job-costs-line-budgets')).toBeNull()
  })

  it('reads spent of the whole budget with the job percent, a bar for labor and one for materials, and a row per work line', () => {
    renderWithProviders(<JobCostsLineBudgets fixtures={project} teamHours={12} spend={{ teamUsd: 500, subUsd: 250, partsUsd: 6200 }} jobPctDone={17} jobId="job-1" />)
    // The door to the project's card on the Projects board (punch list #242, PR 5).
    expect(screen.getByTestId('job-costs-board-door').getAttribute('href')).toBe('/projects-board?job=job-1')
    const card = screen.getByTestId('job-costs-line-budgets')
    // labor: 24000×45% + 16000×50% + 4000×45% = 10,800 + 8,000 + 1,800 = 20,600; materials: 8,400 + 4,800 + 1,400 = 14,600
    expect(card.textContent).toContain('$6,950 of $35,200 spent')
    expect(card.textContent).toContain('the job is 17% done')
    expect(within(card).getByTestId('budget-pace-labor').textContent).toContain('$750 of $20,600')
    expect(within(card).getByTestId('budget-pace-labor').textContent).toContain('12 h of 458 h')
    // materials at 42% of its budget, 25 points past the work → red words
    const materials = within(card).getByTestId('budget-pace-materials')
    expect(materials.textContent).toContain('$6,200 of $14,600 · 42%')
    expect((materials.lastElementChild as HTMLElement).style.color).toBe('var(--text-red-700)')
    const rows = within(card).getAllByTestId('job-costs-line-row')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.textContent).toContain('240 h · $10,800 labor · $8,400 mat. · assumed')
    expect(rows[0]!.textContent).toContain('no % of its own yet')
    // the tuned line reads its columns and its own percent, not the job's
    expect(rows[1]!.textContent).toContain('178 h · $8,000 labor · $4,800 mat. · tuned')
    expect(rows[1]!.textContent).toContain('40% done · $3,200 earned')
    expect(card.textContent).toContain('2 ≈ assumed · 1 ✎ tuned')
  })

  it('with nothing spent the kept figure stays quiet', () => {
    renderWithProviders(<JobCostsLineBudgets fixtures={project} teamHours={0} spend={{ teamUsd: 0, subUsd: 0, partsUsd: 0 }} jobPctDone={17} />)
    const card = screen.getByTestId('job-costs-line-budgets')
    expect(card.textContent).toContain('$0 of $35,200 spent')
    expect(card.textContent).not.toContain('kept so far')
  })
})
