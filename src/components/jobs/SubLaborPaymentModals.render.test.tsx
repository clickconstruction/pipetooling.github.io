// @vitest-environment jsdom
/**
 * Render-smoke tests for the SubLaborPaymentModals trio (extracted from Jobs.tsx
 * in v2.824). Crash-on-mount / handle-wiring coverage; not a behavior suite.
 */
import { act, createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import SubLaborPaymentModals, {
  type SubLaborPaymentModalsHandle,
  type SubLaborPaymentModalsProps,
} from './SubLaborPaymentModals'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { SubLaborBackchargeTarget, SubLaborPaymentTarget } from '../../types/laborJob'

function makeProps(overrides: Partial<SubLaborPaymentModalsProps> = {}): SubLaborPaymentModalsProps {
  return {
    recordLaborJobPayment: vi.fn(async () => {}),
    recordLaborJobBackcharge: vi.fn(async () => {}),
    deleteLaborJobPayment: vi.fn(async () => {}),
    updateLaborJobPayment: vi.fn(async () => {}),
    ...overrides,
  }
}

const paymentTarget: SubLaborPaymentTarget = {
  id: 'labor-1',
  contractor: 'Sub Sam',
  hcp: 'HCP-77',
  totalCost: 500,
  paid: 100,
  outstanding: 400,
}

const backchargeTarget: SubLaborBackchargeTarget = {
  id: 'labor-1',
  contractor: 'Sub Sam',
  hcp: 'HCP-77',
  totalCost: 500,
  paid: 100,
}

function mountWithRef(props = makeProps()) {
  const ref = createRef<SubLaborPaymentModalsHandle>()
  const view = renderWithProviders(<SubLaborPaymentModals ref={ref} {...props} />)
  return { ref, view }
}

describe('SubLaborPaymentModals render smoke', () => {
  it('renders nothing while closed', () => {
    mountWithRef()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Backcharge')).toBeNull()
    expect(screen.queryByText('Edit Payment')).toBeNull()
  })

  it('openMakePayment shows Record payment on what is left, to the cent; cancel closes it', () => {
    const { ref } = mountWithRef()
    act(() => ref.current!.openMakePayment(paymentTarget, '400'))
    const dialog = screen.getByRole('dialog', { name: 'Record payment' })
    // The one grey line: who, the job, and the three sums.
    expect(dialog.querySelector('[data-record-payment-summary]')!.textContent).toBe('Sub Sam · HCP-77 · Total $500.00 · Paid $100.00 · Remaining $400.00')
    expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe('400.00')
    expect(dialog.querySelector('[data-sub-payment-after]')!.textContent).toBe('This pays the sheet in full.')
    expect(screen.getByRole('group', { name: 'How it was sent' })).toBeTruthy()
    expect([...screen.getByRole('group', { name: 'How it was sent' }).querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Check', 'Zelle', 'Mercury', 'Cash App', 'Apple Pay', 'Cash', 'Client direct', 'Other'])
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a part payment says what stays due and records the amount, the date, the method and its number', async () => {
    const props = makeProps()
    const { ref } = mountWithRef(props)
    act(() => ref.current!.openMakePayment(paymentTarget, '400'))
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '150' } })
    expect(document.querySelector('[data-sub-payment-after]')!.textContent).toBe('A part payment. $250.00 stays due on the sheet.')
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-11-10' } })
    // A check opens a box for its number; a second press on the chip clears the method.
    expect(screen.queryByLabelText('Check number (optional)')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    fireEvent.change(screen.getByLabelText('Check number (optional)'), { target: { value: ' 1187 ' } })
    fireEvent.change(screen.getByLabelText('Memo for the sub (optional)'), { target: { value: 'rough-in draw' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Record payment' }))
    })
    expect(props.recordLaborJobPayment).toHaveBeenCalledWith('labor-1', 150, 'rough-in draw', '2026-11-10', { method: 'check', method_ref: '1187', hidden_from_sub: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('refuses an amount past what is left, with the reason, and records nothing', () => {
    const props = makeProps()
    const { ref } = mountWithRef(props)
    act(() => ref.current!.openMakePayment(paymentTarget, '400'))
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '450' } })
    expect(screen.getByRole('alert').textContent).toBe('$450.00 is $50.00 more than the $400.00 left on this sheet. Record up to $400.00 here.')
    const press = screen.getByRole('button', { name: 'Record payment' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.click(press)
    expect(props.recordLaborJobPayment).not.toHaveBeenCalled()
    // A word in the box is refused too, and a blank box only waits.
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: 'lots' } })
    expect(screen.getByRole('alert').textContent).toBe('Type an amount above zero, in dollars and cents.')
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '' } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect((screen.getByRole('button', { name: 'Record payment' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('a payment with no method is recorded as it always was, and a hidden memo is kept off the portal', async () => {
    const props = makeProps()
    const { ref } = mountWithRef(props)
    act(() => ref.current!.openMakePayment(paymentTarget, '400'))
    fireEvent.change(screen.getByLabelText('Memo for the sub (optional)'), { target: { value: 'office only' } })
    expect(screen.getByText(/Shown to the sub on their portal/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText(/Hide this memo from the sub/))
    expect(screen.getByText('Kept off the sub’s portal. Only the office reads this memo.')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Record payment' }))
    })
    expect(props.recordLaborJobPayment).toHaveBeenCalledWith('labor-1', 400, 'office only', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), { method: null, method_ref: null, hidden_from_sub: true })
  })

  it('openBackcharge shows the modal with an empty amount; cancel closes it', () => {
    const { ref } = mountWithRef()
    act(() => ref.current!.openBackcharge(backchargeTarget))
    expect(screen.getByText('Backcharge')).toBeTruthy()
    expect((screen.getByPlaceholderText('0') as HTMLInputElement).value).toBe('')
    expect(screen.getByPlaceholderText('Required for backcharges')).toBeTruthy()
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Backcharge')).toBeNull()
  })

  it('openEditPayment seeds amount and memo; cancel closes it', () => {
    const { ref } = mountWithRef()
    act(() =>
      ref.current!.openEditPayment(
        { id: 'pay-1', jobId: 'labor-1', amount: 50, memo: 'first draw', isBackcharge: false, paymentDate: '2026-08-10', createdAt: '2026-08-01T12:00:00Z' },
        '50',
        'first draw',
      ),
    )
    expect(screen.getByText('Edit Payment')).toBeTruthy()
    expect((screen.getByPlaceholderText('0') as HTMLInputElement).value).toBe('50')
    expect((screen.getByPlaceholderText('Optional note') as HTMLTextAreaElement).value).toBe('first draw')
    expect((document.querySelector('input[type="date"]') as HTMLInputElement).value).toBe('2026-08-10')
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Edit Payment')).toBeNull()
  })

  it('Edit Payment opens on the row\'s method and saves a new one; a backcharge has no method', async () => {
    const props = makeProps()
    const { ref } = mountWithRef(props)
    act(() =>
      ref.current!.openEditPayment(
        { id: 'pay-1', jobId: 'labor-1', amount: 50, memo: 'first draw', isBackcharge: false, paymentDate: '2026-08-10', createdAt: '2026-08-01T12:00:00Z', method: 'check', methodRef: '1162' },
        '50',
        'first draw',
      ),
    )
    expect(screen.getByRole('button', { name: 'Check' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText('Check number (optional)') as HTMLInputElement).value).toBe('1162')
    fireEvent.click(screen.getByRole('button', { name: 'Zelle' }))
    await act(async () => {
      fireEvent.click(screen.getByText('Save'))
    })
    expect(props.updateLaborJobPayment).toHaveBeenCalledWith('pay-1', 50, 'first draw', false, '2026-08-10', { method: 'zelle', method_ref: '1162' })
    act(() => ref.current!.openEditPayment({ id: 'pay-2', jobId: 'labor-1', amount: 25, memo: 'damage', isBackcharge: true, paymentDate: null, createdAt: null }, '25', 'damage'))
    expect(screen.queryByRole('group', { name: 'How it was sent' })).toBeNull()
  })

  it('openEditPayment for a backcharge titles the modal Edit Backcharge; clearEditPayment closes it', () => {
    const { ref } = mountWithRef()
    act(() =>
      ref.current!.openEditPayment(
        { id: 'pay-2', jobId: 'labor-1', amount: 25, memo: 'damage', isBackcharge: true, paymentDate: null, createdAt: null },
        '25',
        'damage',
      ),
    )
    expect(screen.getByText('Edit Backcharge')).toBeTruthy()
    act(() => ref.current!.clearEditPayment())
    expect(screen.queryByText('Edit Backcharge')).toBeNull()
  })
})
