// @vitest-environment jsdom
/**
 * The sub sheet's Move and Remove dialogs (v2.3562) and the owner's call of 2026-10-09: a
 * backcharge stays on the sheet it was raised on, so `openMove` refuses it and its Remove dialog
 * says why where a payment's offers "Wrong job → Move it instead".
 */
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import { makeLaborJob, renderWithProviders } from '../../test/renderSmokeMocks'
import SubLaborPaymentMoveRemoveModals, { type SubLaborPaymentMoveRemoveHandle } from './SubLaborPaymentMoveRemoveModals'
import type { EditingPaymentTarget } from './SubLaborPaymentModals'

const sheet = makeLaborJob({ id: 's-12', job_number: 'HCP-12', payments: [{ id: 'pay-1', amount: 250, memo: null, created_at: '2026-09-20T01:50:00Z' }, { id: 'bc-1', amount: -75, memo: 'cracked tub', created_at: '2026-09-21T15:00:00Z' }] })
const other = makeLaborJob({ id: 's-13', job_number: 'HCP-13' })
const target = (id: string, amount: number): EditingPaymentTarget => ({ id, jobId: 's-12', amount, memo: null, isBackcharge: amount < 0, paymentDate: null, createdAt: '2026-09-21T15:00:00Z' })

function mount() {
  const ref = createRef<SubLaborPaymentMoveRemoveHandle>()
  renderWithProviders(
    <SubLaborPaymentMoveRemoveModals
      ref={ref}
      laborJobs={[sheet, other]}
      laborJobAssigneesByJobId={new Map()}
      laborJobNamesByJobId={{}}
      moveLaborJobPayment={vi.fn(async () => true)}
      removeLaborJobPayment={vi.fn(async () => true)}
    />,
  )
  return ref
}

describe('SubLaborPaymentMoveRemoveModals — a backcharge stays on its sheet', () => {
  it('Move opens for a payment and refuses a backcharge', () => {
    const ref = mount()
    act(() => ref.current!.openMove(target('bc-1', -75)))
    expect(screen.queryByTestId('sub-payment-move-dialog')).toBeNull()
    act(() => ref.current!.openMove(target('pay-1', 250)))
    expect(screen.getByTestId('sub-payment-move-dialog')).toBeTruthy()
  })

  it('a backcharge’s Remove dialog says why in place of the door to Move; a payment’s keeps the door', () => {
    const ref = mount()
    act(() => ref.current!.openRemove(target('bc-1', -75)))
    const dialog = screen.getByTestId('sub-payment-remove-dialog')
    expect(within(dialog).queryByRole('button', { name: 'Wrong job → Move it instead' })).toBeNull()
    expect(within(dialog).getByText('A backcharge stays on the sheet it was raised on.')).toBeTruthy()

    act(() => ref.current!.openRemove(target('pay-1', 250)))
    const again = screen.getByTestId('sub-payment-remove-dialog')
    expect(within(again).getByRole('button', { name: 'Wrong job → Move it instead' })).toBeTruthy()
    expect(within(again).queryByText('A backcharge stays on the sheet it was raised on.')).toBeNull()
  })
})
