// @vitest-environment jsdom
/**
 * Stage Plan PR 2 render smokes: with a plan, every named row carries its
 * badge and the In order / Any time selector (the state words moved to the ②
 * money card's rows in v2.4307, and the note to a tap); picking a kind
 * writes stage_kind through updateFixtureRow; a row on an invoice keeps its
 * selector disabled; without a plan the grid renders exactly as before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { JobFormFixturesSection } from './JobFormFixturesSection'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'
import { stagePlanFromForm } from '../../lib/jobs/stagePlanForm'
import { renderWithProviders } from '../../test/renderSmokeMocks'

afterEach(() => cleanup())

const fixtures: FixtureRow[] = [
  { id: 'a', name: 'Rough-in', count: 1, line_unit_price: 8400, line_description: '', invoice_id: 'inv-1', stage_kind: 'order', shared_with_gc: true },
  { id: 'b', name: 'Top-out', count: 1, line_unit_price: 8400, line_description: '', invoice_id: null, stage_kind: 'order', shared_with_gc: false },
  { id: 'c', name: 'Relocate water heater', count: 1, line_unit_price: 1850, line_description: '', invoice_id: null, stage_kind: 'any', shared_with_gc: false },
  { id: 'd', name: 'Permit & misc', count: 1, line_unit_price: 600, line_description: '', invoice_id: null, stage_kind: null, shared_with_gc: false },
]
const plan = stagePlanFromForm({
  fixtures,
  windows: [{ id: 'w-c', fixture_id: 'c', window_start: '2026-09-15', window_end: '2026-09-19' }],
  orders: [{ id: 'o-c', stage_window_id: 'w-c', status: 'accepted', picked_start: '2026-09-15', picked_end: '2026-09-16', labor_job_id: 's-c' }],
  sheets: [{ id: 's-c', stage: 'walkthrough', progress_pct: 100, stage_changed_at: '2026-09-16T20:00:00Z' }],
  invoices: [{ id: 'inv-1', status: 'paid' }],
  payments: [{ invoice_id: 'inv-1', paid_on: '2026-08-29' }],
  todayYmd: '2026-09-09',
})

function renderSection(withPlan: boolean, updateFixtureRow = vi.fn()) {
  renderWithProviders(
    <JobFormFixturesSection
      fixtures={fixtures}
      fixtureScopeExpandedById={{}}
      setFixtureScopeExpandedById={() => {}}
      fixturesSectionHighlight={false}
      fixturesSectionHighlightRef={{ current: null }}
      updateFixtureRow={updateFixtureRow}
      addFixtureRow={() => {}}
      removeFixtureRow={() => {}}
      moveFixtureRow={() => {}}
      invoiceStatusById={{ 'inv-1': 'paid' }}
      onOpenSegmentGenerator={() => {}}
      onOpenStripeFixturePreview={() => {}}
      jobTotalDollars={19250}
      plan={withPlan ? plan : null}
    />,
  )
  return updateFixtureRow
}

describe('JobFormFixturesSection with a Stage Plan', () => {
  it('draws a badge on every row, the kind press on every stage; the stage note opens on a tap', () => {
    renderSection(true)
    expect(screen.getAllByTestId('stage-badge')).toHaveLength(4)
    // The badge is the press (spike): three stages carry it, the discount row keeps the plain badge.
    expect(screen.getAllByTestId('stage-kind-press')).toHaveLength(3)
    expect(screen.queryAllByTestId('stage-line')).toHaveLength(0)
    expect(screen.getByLabelText('Stage 1, done')).toBeTruthy()
    expect(screen.getByLabelText('Stage 2, current')).toBeTruthy()
    expect(screen.getByLabelText('Any-time stage, done')).toBeTruthy()
    expect(screen.getByLabelText('Plain line item')).toBeTruthy()
    // v2.4307: where the work and money stand is said on the ② money card, not here.
    expect(screen.queryByText('draw 1 paid Aug 29')).toBeNull()
    expect(screen.queryByTestId('stages-note')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'ⓘ How stages work' }))
    expect(screen.getByTestId('stages-note').textContent).toMatch(/^Tap the badge beside a line to flip it between In order and Any time\./)
  })

  it('tapping the badge flips stage_kind for that row; an invoiced row keeps its press disabled', () => {
    const update = renderSection(true)
    // Two kinds, In order / Any time — no "—" door (null = a discount, set by code); the press names both.
    const topOut = screen.getByRole('button', { name: 'Stage kind for Top-out: In order. Tap for Any time' })
    expect(topOut.textContent).toContain('In order')
    fireEvent.click(topOut)
    expect(update).toHaveBeenCalledWith('b', { stage_kind: 'any' })
    expect(update).not.toHaveBeenCalledWith('b', { stage_kind: null })
    expect(update).toHaveBeenCalledTimes(1)
    const roughIn = screen.getByRole('button', { name: 'Stage kind for Rough-in: In order. Tap for Any time' })
    expect((roughIn as HTMLButtonElement).disabled).toBe(true)
  })

  it('without a plan the grid has no badges and no presses', () => {
    renderSection(false)
    expect(screen.queryAllByTestId('stage-badge')).toHaveLength(0)
    expect(screen.queryAllByTestId('stage-kind-press')).toHaveLength(0)
  })
})
