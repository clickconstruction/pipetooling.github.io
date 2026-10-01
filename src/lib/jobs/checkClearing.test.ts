import { describe, expect, it } from 'vitest'
import { CHECK_CLEAR_DAYS, billCheckClearsYmd, isCheckPayment } from './checkClearing'
import { lienWaiverCellForBill } from './lienWaiverCell'

const pay = (over: Partial<{ invoice_id: string | null; amount: number; paid_on: string | null; payment_type: string | null }>) => ({
  invoice_id: 'inv-1',
  amount: 4478,
  paid_on: '2026-10-01',
  payment_type: 'Check',
  ...over,
})

describe('billCheckClearsYmd — a check clears a week after it is paid', () => {
  it('the owner’s call is seven days', () => {
    expect(CHECK_CLEAR_DAYS).toBe(7)
  })
  it('a check paid Oct 1 clears Oct 8, and stops holding on Oct 8', () => {
    expect(billCheckClearsYmd('inv-1', [pay({})], '2026-10-01')).toBe('2026-10-08')
    expect(billCheckClearsYmd('inv-1', [pay({})], '2026-10-07')).toBe('2026-10-08')
    expect(billCheckClearsYmd('inv-1', [pay({})], '2026-10-08')).toBeNull()
  })
  it('the newest check decides; Accounts Receivable’s checkDeposit counts; card, transfer and cash never wait', () => {
    expect(billCheckClearsYmd('inv-1', [pay({ paid_on: '2026-09-20' }), pay({ paid_on: '2026-09-29', payment_type: 'checkDeposit' })], '2026-10-01')).toBe('2026-10-06')
    expect(billCheckClearsYmd('inv-1', [pay({ payment_type: 'Card (external)' }), pay({ payment_type: 'ACH' }), pay({ payment_type: 'Cash' })], '2026-10-01')).toBeNull()
    expect(billCheckClearsYmd('inv-1', [pay({ invoice_id: 'inv-2' })], '2026-10-01')).toBeNull()
    expect(billCheckClearsYmd('inv-1', [pay({ paid_on: null })], '2026-10-01')).toBeNull()
  })
  it('isCheckPayment', () => {
    expect(['Check', 'Cheque', 'checkDeposit', 'ck', 'check #2348'].every((t) => isCheckPayment({ payment_type: t }))).toBe(true)
    expect(['Card (external)', 'ACH', 'Cash', null, ''].some((t) => isCheckPayment({ payment_type: t }))).toBe(false)
  })
})

describe('the waiver cell waits for the check', () => {
  it('settled by a clearing check: no next move, and the chip says when', () => {
    const cell = lienWaiverCellForBill([], 'inv-1', true, '2026-10-08')
    expect(cell.next).toBeNull()
    expect(cell.clearsYmd).toBe('2026-10-08')
    expect(cell.chips[1]).toEqual({ half: 'unconditional', text: 'Unconditional · waits for the check · clears Oct 8', tone: 'grey' })
  })
  it('once it clears, the unconditional is the next move again; an unsettled bill ignores the date', () => {
    expect(lienWaiverCellForBill([], 'inv-1', true, null).next).toBe('add_unconditional')
    const open = lienWaiverCellForBill([], 'inv-1', false, '2026-10-08')
    expect(open.clearsYmd).toBeNull()
    expect(open.next).toBe('add_conditional')
  })
})
