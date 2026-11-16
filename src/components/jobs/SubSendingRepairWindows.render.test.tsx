// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const rpc = vi.fn()
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))

import { GatherSendingsWindow, GatherSendingsWindowView, OverToCreditWindow, OverToCreditWindowView } from './SubSendingRepairWindows'
import { overToCreditPlan, proposeSendingGroups, type GatherLine } from '../../lib/subWorkOrders/subSendingRepair'

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

// Made-up payments: one $2,100.00 check typed as three rows, a $500.00 transfer typed as two, and two rows typed in
// one sitting with no Date sent, which is held.
const gl = (id: string, sheetId: string, ymd: string, amount: number, o: Partial<GatherLine> = {}): GatherLine => ({ id, sheetId, paidToKey: 'id:harlan', paidTo: 'Harlan Mechanical', job: `Job ${sheetId}`, ymd, recorded: false, method: 'Check', methodRef: '1167', amount, hasSending: false, fromCredit: false, ...o })
const GROUPS = proposeSendingGroups([
  gl('a', 's1', '2026-08-14', 500),
  gl('b', 's2', '2026-08-14', 700),
  gl('c', 's3', '2026-08-14', 900),
  gl('d', 's4', '2026-08-10', 200, { method: 'Zelle', methodRef: '' }),
  gl('e', 's5', '2026-08-10', 300, { method: 'Zelle', methodRef: '' }),
  gl('f', 's6', '2026-07-02', 400, { recorded: true, method: '', methodRef: '' }),
  gl('g', 's7', '2026-07-02', 600, { recorded: true, method: '', methodRef: '' }),
])
const boxes = () => screen.getAllByRole('checkbox') as HTMLInputElement[]

describe('GatherSendingsWindowView', () => {
  it('ticks the ready groups, holds the unsure one with its reason, and the press says its count and what it leaves', () => {
    render(<GatherSendingsWindowView groups={GROUPS} busy={false} outcome={null} onGather={() => {}} onClose={() => {}} />)
    expect(boxes().map((b) => b.checked)).toEqual([true, true, false])
    expect(screen.getAllByTestId('gather-group')[2]!.textContent).toContain('Held: No Date sent on these')
    expect(screen.getByTestId('gather-sum').textContent).toBe('5 payments become 2 sendings. No amount, date or sheet changes.')
    expect(screen.getByRole('button', { name: 'Gather 2 sendings · 1 left as it is ▸' })).toBeTruthy()
    expect(screen.getByText('1 group is left as it is. Tick one to gather it too.')).toBeTruthy()
  })
  it('hands the press only the ticked groups, and is dead with nothing ticked', () => {
    const onGather = vi.fn()
    render(<GatherSendingsWindowView groups={GROUPS} busy={false} outcome={null} onGather={onGather} onClose={() => {}} />)
    fireEvent.click(boxes()[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Gather 1 sending · 2 left as it is ▸' }))
    expect(onGather).toHaveBeenCalledTimes(1)
    expect(onGather.mock.calls[0]![0].map((g: { lines: GatherLine[] }) => g.lines.map((l) => l.id).join(''))).toEqual(['de'])
    fireEvent.click(boxes()[1]!)
    expect((screen.getByRole('button', { name: 'Gather ▸' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByTestId('gather-sum')).toBeNull()
  })
})

describe('GatherSendingsWindow', () => {
  const mount = () => {
    const onDone = vi.fn()
    render(<GatherSendingsWindow groups={GROUPS} onDone={onDone} onClose={() => {}} />)
    return { onDone }
  }
  it('makes one call per group, goes on past a refusal, and keeps the refused group on the screen with its reason', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'these payments are matched to 2 different bank lines, so they were not one payment' } }).mockResolvedValueOnce({ data: { payments: 2 }, error: null })
    const { onDone } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Gather 2 sendings · 1 left as it is ▸' }))
    await waitFor(() => expect(screen.getByTestId('gather-outcome').textContent).toContain('Gathered 1 sending. 1 did not gather.'))
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls.map((c) => c[1])).toEqual([
      { p_person_id: 'harlan', p_payment_ids: ['a', 'b', 'c'] },
      { p_person_id: 'harlan', p_payment_ids: ['d', 'e'] },
    ])
    const said = screen.getByTestId('gather-outcome').textContent ?? ''
    expect(said).toContain('1 sending did not gather. It stays here with the reason.')
    expect(said).toContain('these payments are matched to 2 different bank lines, so they were not one payment')
    expect(onDone).toHaveBeenCalledTimes(1)
  })
  it('a function its migration has not created yet reads as not switched on, and nothing reloads', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.gather_sub_payments_into_sending' } })
    const { onDone } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Gather 2 sendings · 1 left as it is ▸' }))
    await waitFor(() => expect(screen.getByTestId('gather-outcome').textContent).toContain('Nothing gathered. 2 did not gather.'))
    expect(screen.getByTestId('gather-outcome').textContent).toContain('Gathering is not switched on yet.')
    expect(onDone).not.toHaveBeenCalled()
  })
})
