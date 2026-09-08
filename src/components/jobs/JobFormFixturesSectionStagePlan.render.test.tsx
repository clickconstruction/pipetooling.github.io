// @vitest-environment jsdom
/**
 * Stage Plan PR 2 render smokes: with a plan, every named row carries its
 * badge, the Order / Any / — selector and the state line; picking a kind
 * writes stage_kind through updateFixtureRow; a row on an invoice keeps its
 * selector disabled; without a plan the grid renders exactly as before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { JobFormFixturesSection } from './JobFormFixturesSection'
import { JobFormUpcomingDraws } from './JobFormUpcomingDraws'
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
  it('draws a badge, a selector and the state line under every named row', () => {
    renderSection(true)
    expect(screen.getAllByTestId('stage-badge')).toHaveLength(4)
    expect(screen.getAllByTestId('stage-line')).toHaveLength(4)
    expect(screen.getByLabelText('Stage 1, done')).toBeTruthy()
    expect(screen.getByLabelText('Stage 2, current')).toBeTruthy()
    expect(screen.getByLabelText('Any-time stage, done')).toBeTruthy()
    expect(screen.getByLabelText('Plain line item')).toBeTruthy()
    expect(screen.getByText('draw 1 paid Aug 29')).toBeTruthy()
    expect(screen.getByText('◆ done Sep 16')).toBeTruthy()
    expect(screen.getByText('bills with the final draw')).toBeTruthy()
    expect(screen.getByText(/The second line is the stage/)).toBeTruthy()
  })

  it('picking a kind writes stage_kind for that row; an invoiced row keeps its selector disabled', () => {
    const update = renderSection(true)
    const topOut = screen.getByRole('radiogroup', { name: 'Stage kind for Top-out' })
    fireEvent.click(topOut.querySelector('[role="radio"]:nth-child(2)') as HTMLElement)
    expect(update).toHaveBeenCalledWith('b', { stage_kind: 'any' })
    fireEvent.click(topOut.querySelector('[role="radio"]:nth-child(3)') as HTMLElement)
    expect(update).toHaveBeenCalledWith('b', { stage_kind: null })
    // the active option is a no-op
    fireEvent.click(topOut.querySelector('[role="radio"]:nth-child(1)') as HTMLElement)
    expect(update).toHaveBeenCalledTimes(2)
    const roughIn = screen.getByRole('radiogroup', { name: 'Stage kind for Rough-in' })
    for (const b of roughIn.querySelectorAll('button')) expect((b as HTMLButtonElement).disabled).toBe(true)
  })

  it('without a plan the grid has no badges and no second lines', () => {
    renderSection(false)
    expect(screen.queryAllByTestId('stage-badge')).toHaveLength(0)
    expect(screen.queryAllByTestId('stage-line')).toHaveLength(0)
  })
})

describe('JobFormUpcomingDraws', () => {
  it('lists the money still to bill and offers Bill it on the ready row only', () => {
    const onBillRow = vi.fn()
    renderWithProviders(<JobFormUpcomingDraws plan={plan} onBillRow={onBillRow} billingFixtureId={null} />)
    expect(screen.getByText('Still to bill')).toBeTruthy()
    expect(screen.getAllByTestId(/^draw-row-/).map((el) => el.getAttribute('data-testid'))).toEqual(['draw-row-later', 'draw-row-ready', 'draw-row-later'])
    expect(screen.getByText('Draw 2 · Top-out')).toBeTruthy()
    expect(screen.getByText('◆ Relocate water heater')).toBeTruthy()
    const bill = screen.getAllByRole('button', { name: 'Bill it' })
    expect(bill).toHaveLength(1)
    fireEvent.click(bill[0]!)
    expect(onBillRow).toHaveBeenCalledWith('c')
  })
})
