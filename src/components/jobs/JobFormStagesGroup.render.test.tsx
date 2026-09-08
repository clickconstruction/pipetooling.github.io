// @vitest-environment jsdom
/**
 * Stage Plan PR 4 render smokes: the Edit tab's Stages read-out (summary
 * line, In order / Any time lists, the eye writing shared_with_gc, the two
 * doors) and the customer drawer drawing the GC card from the same plan —
 * shared rows only, numbered, one askable, never a name.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { JobFormStagesGroup } from './JobFormStagesGroup'
import { JobFormStagesDrawer } from './JobFormStagesDrawer'
import { PortalStagesCard } from '../portal/PortalStagesCard'
import { gcView, type StagePlanOrder } from '../../lib/jobs/stagePlan'
import { stagePlanFromForm } from '../../lib/jobs/stagePlanForm'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'

afterEach(() => cleanup())

const fixtures: FixtureRow[] = [
  { id: 'a', name: 'Rough-in', count: 1, line_unit_price: 12465, line_description: '', invoice_id: 'inv-1', stage_kind: 'order', shared_with_gc: true },
  { id: 'b', name: 'Top-out', count: 1, line_unit_price: 12465, line_description: '', invoice_id: null, stage_kind: 'order', shared_with_gc: true },
  { id: 'c', name: 'Trim & final', count: 2, line_unit_price: 8310, line_description: '', invoice_id: null, stage_kind: 'order', shared_with_gc: true },
  { id: 'd', name: 'Final inspection', count: 1, line_unit_price: 0, line_description: '', invoice_id: null, stage_kind: 'order', shared_with_gc: false },
  { id: 'e', name: 'Relocate water heater', count: 1, line_unit_price: 1850, line_description: '', invoice_id: null, stage_kind: 'any', shared_with_gc: true },
  { id: 'f', name: 'Permit & misc', count: 1, line_unit_price: 600, line_description: '', invoice_id: null, stage_kind: null, shared_with_gc: false },
]
type OrderWithName = StagePlanOrder & { display_name: string }
const orders: OrderWithName[] = [
  { id: 'o-a', stage_window_id: 'w-a', status: 'settled', picked_start: '2026-09-01', picked_end: '2026-09-03', labor_job_id: 's-a', display_name: "Sam's Plumbing" },
  { id: 'o-b', stage_window_id: 'w-b', status: 'accepted', picked_start: '2026-09-09', picked_end: '2026-09-10', labor_job_id: 's-b', display_name: "Sam's Plumbing" },
]
const plan = stagePlanFromForm({
  fixtures,
  windows: [
    { id: 'w-a', fixture_id: 'a', window_start: '2026-09-01', window_end: '2026-09-05' },
    { id: 'w-b', fixture_id: 'b', window_start: '2026-09-08', window_end: '2026-09-12' },
    { id: 'w-c', fixture_id: 'c', window_start: '2026-09-22', window_end: '2026-10-02' },
  ],
  orders,
  sheets: [
    { id: 's-a', stage: 'customer_pay', progress_pct: 100, stage_changed_at: '2026-09-04T15:00:00Z' },
    { id: 's-b', stage: 'working', progress_pct: 50 },
  ],
  invoices: [{ id: 'inv-1', status: 'paid' }],
  payments: [{ invoice_id: 'inv-1', paid_on: '2026-08-29' }],
  todayYmd: '2026-09-09',
})

describe('JobFormStagesGroup', () => {
  it('summarises, lists In order then Any time, and the eye writes shared_with_gc for that row', () => {
    const onToggleShared = vi.fn()
    const onSeeAsCustomer = vi.fn()
    const onGoToBill = vi.fn()
    render(<JobFormStagesGroup plan={plan} gcName="Sample Contracting" sharesWithGc onToggleShared={onToggleShared} onSeeAsCustomer={onSeeAsCustomer} onGoToBill={onGoToBill} />)
    expect(screen.getByTestId('stages-group-summary').textContent).toBe('4 in order · 1 any time · 4 shown to Sample Contracting')
    expect(screen.getAllByTestId('stages-group-row-order')).toHaveLength(4)
    expect(screen.getAllByTestId('stages-group-row-any')).toHaveLength(1)
    expect(screen.queryByText('Permit & misc')).toBeNull()
    expect(screen.getByText('draw 2 · $12,465.00')).toBeTruthy()
    expect(screen.getByText('Sep 9 – 10 · 50%')).toBeTruthy()
    fireEvent.click(screen.getByRole('switch', { name: 'Hidden from Sample Contracting — show Final inspection' }))
    expect(onToggleShared).toHaveBeenCalledWith('d', true)
    fireEvent.click(screen.getByRole('switch', { name: 'Shown to Sample Contracting — hide Top-out' }))
    expect(onToggleShared).toHaveBeenCalledWith('b', false)
    fireEvent.click(screen.getByRole('button', { name: 'See it as the customer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set stages on Bill →' }))
    expect(onSeeAsCustomer).toHaveBeenCalledTimes(1)
    expect(onGoToBill).toHaveBeenCalledTimes(1)
  })

  it('collapses to the summary line', () => {
    render(<JobFormStagesGroup plan={plan} gcName={null} sharesWithGc={false} onToggleShared={() => {}} onSeeAsCustomer={() => {}} defaultOpen={false} />)
    expect(screen.getByTestId('stages-group-summary').textContent).toBe('4 in order · 1 any time · 4 shown to the GC')
    expect(screen.queryAllByTestId('stages-group-row-order')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /Stages/ }))
    expect(screen.getAllByTestId('stages-group-row-order')).toHaveLength(4)
  })
})

describe('the customer card and drawer', () => {
  it('draws the shared Order rows as a numbered sequence — done, now, next (askable), never the unshared or a name', () => {
    const view = gcView(plan)
    render(<PortalStagesCard view={view} jobLabel="#1004 · 407 E 6th St" askSlot={(s) => <a href="#ask">Need other dates? ({s.name})</a>} />)
    expect(screen.getByTestId('portal-stages-headline').textContent).toBe('Stage 2 of 3 · Top-out · on site now')
    expect(screen.getByTestId('portal-step-done').textContent).toContain('Passed inspection Sep 4')
    expect(screen.getByTestId('portal-step-now').textContent).toContain('On site Sep 9 – 10 · about halfway')
    expect(screen.getByTestId('portal-step-next').textContent).toContain('Planned Sep 22 – Oct 2')
    expect(screen.getByText('Need other dates? (Trim & final)')).toBeTruthy()
    expect(screen.queryByText(/Final inspection/)).toBeNull()
    expect(screen.getByTestId('portal-also-later').textContent).toContain('Relocate water heater')
    expect(document.body.textContent).not.toContain('Sam')
    expect(screen.getByLabelText('50 percent along')).toBeTruthy()
  })

  it('the drawer names the GC, pins light, and closes', () => {
    const onClose = vi.fn()
    render(<JobFormStagesDrawer open onClose={onClose} plan={plan} gcName="Sample Contracting" jobLabel="#1004 · 407 E 6th St" jobAddress={null} portalUrl="http://x/portal?t=sample-gc" portalIsSample zIndex={5} />)
    const drawer = screen.getByTestId('stages-drawer')
    expect(drawer.getAttribute('data-theme')).toBe('light')
    expect(screen.getByText('As Sample Contracting sees it')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open the sample portal ↗' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close the customer preview' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
