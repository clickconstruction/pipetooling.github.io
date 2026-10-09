// @vitest-environment jsdom
/**
 * Render smoke for what we expect to bill each month as the schedule stands (the Gantt, G-97): the
 * job's card with its months, a month's trades and the final-bill line; every job's months on the
 * Money tab; the customer's bills ahead, rounded and with no trade; and what a move does to the
 * bills, in Why it moved and on its row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcBillingForecastCard, GcBillingForecastMoney, GcBillingForecastPortal } from './GcBillingForecast'
import { GcMoveExplain, GcMoveHistory } from './GcScheduleMoves.proto'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import type { GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

const ID = 'fairoaksd'
const job = (s: GcState, id = ID) => s.projects.find((p) => p.id === id)!
/** Summit's late day taken: TPO membrane to Wed Oct 14, which pushes the rooftop units past Oct 25. */
const moved = () =>
  gcReducer(initialGcState(), { type: 'setScheduleActivity', projectId: ID, lineId: 'froof-1', start: '2026-09-21', finish: '2026-10-14', after: ['fsteel-2'], why: { reason: 'materials', note: 'The membrane ships Oct 12.', by: 'Robert' } })

describe('What we expect to bill, on Bill the customer', () => {
  it('lists the months as the schedule stands, a month’s trades, and what comes with the final bill', () => {
    const state = initialGcState()
    render(<GcBillingForecastCard state={state} project={job(state)} />)
    expect(screen.getByText('What we expect to bill')).toBeTruthy()
    expect(screen.getByText('92%')).toBeTruthy()
    expect(screen.getByText('$368,744')).toBeTruthy()
    expect(screen.getByText('$70,405')).toBeTruthy()
    expect(screen.getByText('$40,043')).toBeTruthy()
    // No move this week: no column for it.
    expect(screen.queryByText('Moved this week')).toBeNull()
    expect(screen.queryByText('Roofing $122,230')).toBeNull()
    fireEvent.click(screen.getByText('Sun Oct 25'))
    expect(screen.getByText('Roofing $122,230')).toBeTruthy()
    expect(screen.getByText('Then the $148,876 Cibolo Creek Partners holds comes with the final bill, once they accept the work.')).toBeTruthy()
    expect(
      screen.getByText('The draft above bills the work reported so far, $98,566. Oct 25 comes to about $368,744 if the trades report the work the schedule has done by then.'),
    ).toBeTruthy()
  })

  it('shows what this week’s moves changed', () => {
    const state = moved()
    render(<GcBillingForecastCard state={state} project={job(state)} />)
    expect(screen.getByText('Moved this week')).toBeTruthy()
    expect(screen.getByText('−$6,600')).toBeTruthy()
    expect(screen.getByText('+$6,600')).toBeTruthy()
  })

  it('says so when the work is all billed, or there is no schedule', () => {
    const state = initialGcState()
    render(<GcBillingForecastCard state={state} project={job(state, 'stoneoak')} />)
    expect(screen.getByText('All the work is billed. The $18,241 they hold comes with the final bill.')).toBeTruthy()
    cleanup()
    render(<GcBillingForecastCard state={state} project={job(state, 'helotes')} />)
    expect(screen.getByText('Draw the schedule and the months show here.')).toBeTruthy()
  })
})

describe('What we bill, month by month, on the Money tab', () => {
  it('adds every job’s months up, and opens a job’s bills from its name', () => {
    const state = initialGcState()
    const onOpenBill = vi.fn()
    render(<GcBillingForecastMoney state={state} onOpenBill={onOpenBill} />)
    expect(screen.getByText('What we bill, month by month')).toBeTruthy()
    expect(screen.getByText('$368,744')).toBeTruthy()
    expect(screen.getByText('Customers hold $167,118 until the final bills.')).toBeTruthy()
    expect(screen.getByText('Helotes Dental Office has no schedule yet, so its bills are not here.')).toBeTruthy()
    fireEvent.click(screen.getByText('Fair Oaks Shops, Building D $368,744'))
    expect(onOpenBill).toHaveBeenCalledWith(ID)
  })
})

describe('the customer’s bills ahead, in their portal', () => {
  it('is rounded, by bill day, and names no trade', () => {
    const state = initialGcState()
    const { container } = render(<GcBillingForecastPortal state={state} project={job(state)} />)
    expect(screen.getByText('What we expect to bill you, as the schedule stands today')).toBeTruthy()
    expect(screen.getByText('about $368,700')).toBeTruthy()
    expect(screen.getByText('about $70,400')).toBeTruthy()
    expect(screen.getByText('about $40,000')).toBeTruthy()
    expect(screen.getByText('What you hold, about $148,900, comes with the final bill.')).toBeTruthy()
    expect(container.textContent).not.toMatch(/Roofing|Summit|Electrical|HVAC/)
  })

  it('says what this week’s moves did to their bills', () => {
    const state = moved()
    render(<GcBillingForecastPortal state={state} project={job(state)} />)
    expect(screen.getByText("This week's schedule moves shifted about $6,600 from your Oct 25 bill to Nov 25.")).toBeTruthy()
  })

  it('shows nothing on a job with no months', () => {
    const state = initialGcState()
    const { container } = render(<GcBillingForecastPortal state={state} project={job(state, 'stoneoak')} />)
    expect(container.textContent).toBe('')
  })
})

describe('what a move does to the bills', () => {
  it('says it in Why it moved, before the move is saved', () => {
    const state = initialGcState()
    render(<GcMoveExplain state={state} project={job(state)} pending={{ lineId: 'froof-1', start: '2026-09-21', finish: '2026-10-14', after: ['fsteel-2'] }} dispatch={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Billing: $6,600 of the Oct 25 bill moves to Nov 25.')).toBeTruthy()
  })

  it('says nothing about bills without the state, or when the move moves no money', () => {
    const state = initialGcState()
    render(<GcMoveExplain project={job(state)} pending={{ lineId: 'froof-1', start: '2026-09-21', finish: '2026-10-14', after: ['fsteel-2'] }} dispatch={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByText(/^Billing:/)).toBeNull()
    cleanup()
    render(<GcMoveExplain state={state} project={job(state)} pending={{ lineId: 'froof-1', start: '2026-09-21', finish: '2026-10-11', after: ['fsteel-2'] }} dispatch={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByText(/^Billing:/)).toBeNull()
  })

  it('says it on the move’s row in Changes to the schedule', () => {
    const state = moved()
    render(<GcMoveHistory state={state} project={job(state)} dispatch={vi.fn()} />)
    expect(screen.getByText('Billing: it moved $6,600 of the Oct 25 bill to Nov 25.')).toBeTruthy()
  })
})
