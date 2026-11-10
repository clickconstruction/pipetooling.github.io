// @vitest-environment jsdom
/**
 * A month's credit in one press (punch list #301, PR 3): the window opens with the bank's answer picked and its lines
 * shown, the press names the month and the amount, the split is the dry run, "No credit this month" settles the month
 * with a line of zero, and a refusal shows its reason.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import InKindMonthWindow, { type InKindMonthIo } from './InKindMonthWindow'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { parseInKindAddResult } from '../../lib/inKind/inKindLedger'
import { rentDeal } from './inKindTestData'

const plan = parseInKindAddResult({
  ok: true,
  dry_run: true,
  applied: [
    { job_id: 'j2', invoice_id: 'inv-j2', hcp_number: '1120', click_number: null, job_name: 'Hose bibs and yard line', amount: 680.5, left_after: 0, pays_off: true },
    { job_id: 'j3', invoice_id: 'inv-j3', hcp_number: '1126', click_number: null, job_name: 'Gas line to the shop heater', amount: 819.5, left_after: 1092.9, pays_off: false },
  ],
  held: [],
  unapplied: 0,
})
const novBank = [{ id: 't1', day: '2026-11-03', amount: 1500, name: 'Calloway Holdings LLC' }]

function makeIo(over: Partial<InKindMonthIo> = {}): InKindMonthIo {
  return { addLine: vi.fn((_i, dryRun: boolean) => Promise.resolve(dryRun ? plan : parseInKindAddResult({ ok: true, line_id: 'new', applied: plan.applied, held: [], unapplied: 0 }))), ...over }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T18:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('InKindMonthWindow', () => {
  it('opens with the bank’s answer picked, its line shown, and a press that names the month and the amount', async () => {
    renderWithProviders(<InKindMonthWindow data={rentDeal()} month="2026-11-01" bankLines={novBank} onClose={() => undefined} onEntered={() => undefined} io={makeIo()} />)
    await settle()
    expect(screen.getByText('November’s credit')).toBeTruthy()
    expect(screen.getByTestId('in-kind-month-bank').textContent).toBe('What the bank shows. Nov 3, Calloway Holdings LLC, $1,500.00 left the account.')
    expect(screen.getByText('the bank says this one')).toBeTruthy()
    expect(screen.getByText('We paid $1,500.00 of the $3,000.00 bill.')).toBeTruthy()
    expect(screen.getByTestId('in-kind-month-save').textContent).toBe('Record November’s credit of $1,500.00')
    expect((screen.getByLabelText('What was given instead of money') as HTMLInputElement).value).toBe('Rent credit, the shop, November 2026')
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-11-03') // the day the rent left
  })

  it('shows the split from the dry run and records the month in one press', async () => {
    const io = makeIo()
    const onEntered = vi.fn()
    renderWithProviders(<InKindMonthWindow data={rentDeal()} month="2026-11-01" bankLines={novBank} onClose={() => undefined} onEntered={onEntered} io={io} />)
    await settle()
    await waitFor(() => expect(screen.getByTestId('in-kind-month-where')).toBeTruthy(), { timeout: 2000 })
    expect(screen.getByText('1120 Hose bibs and yard line')).toBeTruthy()
    expect(screen.getByText('Pays this bill off.')).toBeTruthy()
    expect(screen.getByText('$1,092.90 is left on it after.')).toBeTruthy()
    fireEvent.click(screen.getByTestId('in-kind-month-save'))
    await settle()
    expect(io.addLine).toHaveBeenLastCalledWith({ arrangementId: 'a1', givenOn: '2026-11-03', amount: 1500, memo: 'Rent credit, the shop, November 2026', costJobId: null, forMonth: '2026-11-01' }, false)
    expect(onEntered).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('November’s credit of $1,500.00 is recorded. 1120 is Paid.')).toBeTruthy()
  })

  it('settles a month with no credit as a line of zero', async () => {
    const io = makeIo()
    renderWithProviders(<InKindMonthWindow data={rentDeal()} month="2026-10-01" bankLines={[{ id: 't0', day: '2026-10-02', amount: 3000, name: 'Calloway Holdings LLC' }]} onClose={() => undefined} onEntered={() => undefined} io={io} />)
    await settle()
    // The bank says the whole bill was paid, so no credit leads.
    expect(screen.getByTestId('in-kind-month-save').textContent).toBe('Settle October with no credit')
    expect((screen.getByLabelText('What was given instead of money') as HTMLInputElement).value).toBe('No credit, October 2026. The whole bill was paid.')
    fireEvent.click(screen.getByTestId('in-kind-month-save'))
    await settle()
    expect(io.addLine).toHaveBeenLastCalledWith(expect.objectContaining({ amount: 0, forMonth: '2026-10-01' }), false)
  })

  it('offers the whole bill in a month nothing left the bank', async () => {
    renderWithProviders(<InKindMonthWindow data={rentDeal()} month="2026-10-01" bankLines={[]} onClose={() => undefined} onEntered={() => undefined} io={makeIo()} />)
    await settle()
    expect(screen.getByTestId('in-kind-month-bank').textContent).toBe('What the bank shows. Nothing left the bank to Calloway in October.')
    expect(screen.getByText('We paid nothing that month.')).toBeTruthy()
    // $2,592.90 is all that is left on the bills, so the whole $3,000.00 is capped to it.
    expect(screen.getByTestId('in-kind-month-save').textContent).toBe('Record October’s credit of $2,592.90')
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-10-31')
  })

  it('takes another amount, and keeps the press dead until it is one', async () => {
    const io = makeIo()
    renderWithProviders(<InKindMonthWindow data={rentDeal()} month="2026-11-01" bankLines={null} onClose={() => undefined} onEntered={() => undefined} io={io} />)
    await settle()
    expect(screen.getByTestId('in-kind-month-bank').textContent).toContain('The bank was not read for this arrangement.')
    fireEvent.click(screen.getByText('Another amount'))
    const press = screen.getByTestId('in-kind-month-save') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('The amount'), { target: { value: '1,000' } })
    expect(press.disabled).toBe(false)
    expect(press.textContent).toBe('Record November’s credit of $1,000.00')
  })

  it('shows the reason when the month is refused', async () => {
    const io = makeIo({ addLine: vi.fn((_i, dryRun: boolean) => (dryRun ? Promise.resolve(plan) : Promise.reject(new Error('That month already has its line.')))) })
    renderWithProviders(<InKindMonthWindow data={rentDeal()} month="2026-11-01" bankLines={novBank} onClose={() => undefined} onEntered={() => undefined} io={io} />)
    await settle()
    fireEvent.click(screen.getByTestId('in-kind-month-save'))
    await settle()
    expect((await screen.findByRole('alert')).textContent).toBe('That month already has its line.')
  })
})
