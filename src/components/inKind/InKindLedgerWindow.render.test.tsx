// @vitest-environment jsdom
/**
 * The ledger for one partner (punch list #301): each line with what it counts as and the bills it went to, the
 * payments typed by hand before the ledger, the lines taken back, the bills oldest first with the next in line, and
 * taking a line back through a window whose press names the act.
 */
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import InKindLedgerWindow from './InKindLedgerWindow'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { concreteDeal, rentDeal } from './inKindTestData'

const noop = () => undefined

describe('InKindLedgerWindow', () => {
  it('shows a line with what it counts as and where it went', async () => {
    renderWithProviders(<InKindLedgerWindow data={concreteDeal()} onClose={noop} onChanged={noop} onAddLine={noop} onChangeTerms={noop} />)
    await settle()
    expect(screen.getByText('Lone Oak Concrete · Concrete, as delivered')).toBeTruthy()
    expect(screen.getByText('10 yards, the slab patch at Oak Hollow')).toBeTruthy()
    expect(screen.getByText('1158 Oak Hollow Building C')).toBeTruthy() // the chip of the job it counts on
    expect(screen.getAllByText('Overhead')).toHaveLength(2)
    expect(screen.getByText('Went to 1171 $1,475.00.')).toBeTruthy()
    expect(screen.getByText('$2,065.00 counts as overhead. $1,475.00 counts on a job.')).toBeTruthy()
    expect(screen.getByText('$3,260.00 left')).toBeTruthy()
  })

  it('counts a payment typed by hand as paid, and lists it on the press', async () => {
    renderWithProviders(<InKindLedgerWindow data={rentDeal()} onClose={noop} onChanged={noop} onAddLine={noop} onChangeTerms={noop} />)
    await settle()
    expect(screen.getByText(/1 In kind payment was typed on the bills by hand, \$1,439.50 in all\./)).toBeTruthy()
    expect(screen.queryByText(/Rent credit, May 2026/)).toBeNull()
    fireEvent.click(screen.getByText('Show them'))
    expect(screen.getByText(/Rent credit, May 2026/)).toBeTruthy()
  })

  it('keeps a line that was taken back behind a press, crossed out', async () => {
    renderWithProviders(<InKindLedgerWindow data={rentDeal()} onClose={noop} onChanged={noop} onAddLine={noop} onChangeTerms={noop} />)
    await settle()
    expect(screen.getAllByTestId('in-kind-line')).toHaveLength(1)
    fireEvent.click(screen.getByText('Show 1 line taken back'))
    expect(screen.getAllByTestId('in-kind-line')).toHaveLength(2)
    expect(screen.getByText('Taken back.')).toBeTruthy()
  })

  it('lists the bills oldest first and marks the next in line', async () => {
    renderWithProviders(<InKindLedgerWindow data={rentDeal()} onClose={noop} onChanged={noop} onAddLine={noop} onChangeTerms={noop} />)
    await settle()
    expect(screen.getByText('· next in line')).toBeTruthy()
    expect(screen.getByText('$680.50 left')).toBeTruthy()
    expect(screen.getByText('Paid')).toBeTruthy()
  })

  it('takes a line back through a window whose press names the act', async () => {
    const removeLine = vi.fn().mockResolvedValue(undefined)
    const onChanged = vi.fn()
    renderWithProviders(<InKindLedgerWindow data={concreteDeal()} onClose={noop} onChanged={onChanged} onAddLine={noop} onChangeTerms={noop} io={{ removeLine, setLineCost: vi.fn() }} />)
    await settle()
    fireEvent.click(screen.getAllByText('Take back')[0]!)
    expect(screen.getByText('Take this line back?')).toBeTruthy()
    fireEvent.click(screen.getByText('Take back $885.00'))
    await settle()
    expect(removeLine).toHaveBeenCalledWith('c3')
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('moves a line on a job back to overhead', async () => {
    const setLineCost = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<InKindLedgerWindow data={concreteDeal()} onClose={noop} onChanged={noop} onAddLine={noop} onChangeTerms={noop} io={{ removeLine: vi.fn(), setLineCost }} />)
    await settle()
    fireEvent.click(screen.getByText('Count as overhead'))
    await settle()
    expect(setLineCost).toHaveBeenCalledWith('c2', null)
  })

  it('says the reason when taking a line back is refused', async () => {
    const removeLine = vi.fn().mockRejectedValue(new Error('The line was not taken back. Stripe shows this bill as paid.'))
    renderWithProviders(<InKindLedgerWindow data={concreteDeal()} onClose={noop} onChanged={noop} onAddLine={noop} onChangeTerms={noop} io={{ removeLine, setLineCost: vi.fn() }} />)
    await settle()
    fireEvent.click(screen.getAllByText('Take back')[0]!)
    fireEvent.click(screen.getByText('Take back $885.00'))
    await settle()
    expect(await screen.findByText('The line was not taken back. Stripe shows this bill as paid.')).toBeTruthy()
  })

  it('lets a month that is not due yet be entered early, and offers no press on a month already entered', async () => {
    const onEnterMonth = vi.fn()
    const data = rentDeal()
    renderWithProviders(
      <InKindLedgerWindow
        data={data}
        months={[
          { month: '2026-11-01', state: 'waiting', line: null, bankPaid: 0 },
          { month: '2026-10-01', state: 'due', line: null, bankPaid: 1500 },
        ]}
        onEnterMonth={onEnterMonth}
        onClose={noop}
        onChanged={noop}
        onAddLine={noop}
        onChangeTerms={noop}
      />,
    )
    await settle()
    expect(screen.getByText('Not due yet.')).toBeTruthy()
    expect(screen.getAllByTestId('in-kind-month-early-press')).toHaveLength(1)
    fireEvent.click(screen.getByText('Enter it early'))
    expect(onEnterMonth).toHaveBeenCalledWith('2026-11-01')
  })

  it('offers no write on an ended deal', async () => {
    const d = concreteDeal()
    d.arrangement.ended_at = '2026-11-09T00:00:00Z'
    renderWithProviders(<InKindLedgerWindow data={d} onClose={noop} onChanged={noop} onAddLine={noop} onChangeTerms={noop} />)
    await settle()
    expect(screen.queryByTestId('in-kind-ledger-add-line')).toBeNull()
    expect(screen.queryByText('Take back')).toBeNull()
    expect(screen.getByText('In kind · Ended')).toBeTruthy()
  })
})
