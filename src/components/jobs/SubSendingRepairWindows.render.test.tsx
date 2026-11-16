// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const rpc = vi.fn()
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))

import { OverToCreditWindow, OverToCreditWindowView } from './SubSendingRepairWindows'
import { overToCreditPlan } from '../../lib/subWorkOrders/subSendingRepair'

// Made-up money: a $300.00 sheet with $350.00 paid on it.
const SHEET = { label: '2033 Alder Court Remodel', total: 300, paid: 350, over: 50 }
const SUB = { personId: 'harlan', name: 'Harlan Mechanical' }
const PAYMENTS = [
  { id: 'p1', amount: 100, dayWords: 'Oct 1', fromCredit: false, carriesCredit: false, at: '2026-10-01' },
  { id: 'p3', amount: 250, dayWords: 'Oct 3', fromCredit: false, carriesCredit: false, at: '2026-10-03' },
]
const PLAN = overToCreditPlan(SHEET, PAYMENTS, SUB)
const TITLE = 'Harlan Mechanical · 2033 Alder Court Remodel'

beforeEach(() => rpc.mockReset())
afterEach(cleanup)

describe('OverToCreditWindowView', () => {
  it('says which payment changes and that the payment adds up as it was, and the press names the act', () => {
    render(<OverToCreditWindowView title={TITLE} plan={PLAN} saving={false} error={null} onConfirm={() => {}} onClose={() => {}} />)
    const plan = screen.getByTestId('over-to-credit-plan').textContent ?? ''
    expect(plan).toContain("The payment of Oct 3 reads $200.00 on this sheet and $50.00 kept as Harlan Mechanical's credit.")
    expect(screen.getByRole('dialog', { name: 'Keep the overpayment as credit' }).textContent).toContain('On the sheet $200.00 + credit $50.00 = $250.00 ✓ the payment, as it was')
    expect(screen.getByRole('button', { name: 'Keep $50.00 as their credit' })).toBeTruthy()
  })
  it('a sheet with no payment large enough shows the reason and no press', () => {
    const none = overToCreditPlan(SHEET, [PAYMENTS[0]!].map((p) => ({ ...p, amount: 40 })), SUB)
    render(<OverToCreditWindowView title={TITLE} plan={none} saving={false} error={null} onConfirm={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('alert').textContent).toContain('No single payment on this sheet is larger than the $50.00 over.')
    expect(screen.queryByRole('button', { name: /as their credit/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })
})

describe('OverToCreditWindow', () => {
  const mount = () => {
    const onDone = vi.fn()
    const onClose = vi.fn()
    render(<OverToCreditWindow title={TITLE} plan={PLAN} personId="harlan" onDone={onDone} onClose={onClose} />)
    return { onDone, onClose }
  }
  it('makes one call with the person, the payment and the amount over, then reloads and closes', async () => {
    rpc.mockResolvedValue({ data: {}, error: null })
    const { onDone, onClose } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Keep $50.00 as their credit' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('convert_sub_overpayment_to_credit', { p_person_id: 'harlan', p_payment_id: 'p3', p_amount: 50 })
    expect(onDone).toHaveBeenCalledTimes(1)
  })
  it('a refusal stays on the screen with its reason, and nothing reloads', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'this payment already carries a credit' } })
    const { onDone, onClose } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Keep $50.00 as their credit' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Nothing was changed: this payment already carries a credit'))
    expect(onDone).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
  it('a function its migration has not created yet reads as not switched on', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.convert_sub_overpayment_to_credit' } })
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Keep $50.00 as their credit' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Turning an overpayment into a credit is not switched on yet. Nothing was changed.'))
  })
})
