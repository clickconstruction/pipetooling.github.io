import { describe, expect, it } from 'vitest'
import { diffPaymentRows } from './paymentRowsDiff'
import type { PaymentRow } from './jobFormTypes'

const JOB = 'job-1'

function row(id: string, amount: number, extra: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id,
    amount,
    paid_on: '2026-07-30',
    sent_on: null,
    note: null,
    payment_type: null,
    reference_number: null,
    invoice_id: null,
    mercury_transaction_id: null,
    ...extra,
  }
}

describe('diffPaymentRows (B5)', () => {
  it('upserts every persist-worthy row under its own id, renumbered in form order', () => {
    const { deleteIds, upserts } = diffPaymentRows(JOB, ['a', 'b'], [row('b', 50), row('a', 100)])
    expect(deleteIds).toEqual([])
    expect(upserts.map((u) => [u.id, u.sequence_order, u.amount])).toEqual([
      ['b', 0, 50],
      ['a', 1, 100],
    ])
    expect(upserts.every((u) => u.job_id === JOB)).toBe(true)
  })

  it('deletes persisted rows the user removed', () => {
    const { deleteIds, upserts } = diffPaymentRows(JOB, ['a', 'b'], [row('a', 100)])
    expect(deleteIds).toEqual(['b'])
    expect(upserts.map((u) => u.id)).toEqual(['a'])
  })

  it('zeroing a persisted row deletes it (the amount>0 filter defines truth)', () => {
    const { deleteIds, upserts } = diffPaymentRows(JOB, ['a'], [row('a', 0)])
    expect(deleteIds).toEqual(['a'])
    expect(upserts).toEqual([])
  })

  it('never touches foreign rows born after hydration (the webhook race fix)', () => {
    // 'webhook-row' exists in the DB but was never hydrated into the form:
    // it appears in neither persistedIds nor current, so the diff cannot
    // delete or overwrite it.
    const { deleteIds, upserts } = diffPaymentRows(JOB, ['a'], [row('a', 100), row('new-1', 25)])
    expect(deleteIds).toEqual([])
    expect(upserts.map((u) => u.id)).toEqual(['a', 'new-1'])
  })

  it('new empty scaffold rows never persist and never delete anything', () => {
    const { deleteIds, upserts } = diffPaymentRows(JOB, [], [row('scaffold', 0)])
    expect(deleteIds).toEqual([])
    expect(upserts).toEqual([])
  })

  it('maps optional fields exactly like paymentInsertRows (trim-or-null)', () => {
    const { upserts } = diffPaymentRows(
      JOB,
      [],
      [row('a', 10, { paid_on: ' 2026-07-01 ', note: '  ', payment_type: 'check ', reference_number: null, invoice_id: 'inv-1', mercury_transaction_id: 'mt-1' })],
    )
    expect(upserts[0]).toMatchObject({
      paid_on: '2026-07-01',
      note: null,
      payment_type: 'check',
      reference_number: null,
      invoice_id: 'inv-1',
      mercury_transaction_id: 'mt-1',
    })
  })
})
