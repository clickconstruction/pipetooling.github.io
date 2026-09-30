import { describe, expect, it } from 'vitest'
import { diffPaymentRows, paymentUpsertStatements, unfinishedPaymentDateBoxes } from './paymentRowsDiff'
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

describe('paymentUpsertStatements', () => {
  const upsertsFor = (rows: PaymentRow[]) => diffPaymentRows(JOB, [], rows).upserts

  it('is the one statement it always was when every date is finished or empty', () => {
    const upserts = upsertsFor([row('a', 100), row('b', 50, { paid_on: null, sent_on: '2026-07-28' })])
    expect(paymentUpsertStatements(upserts)).toEqual([upserts])
  })

  it('is no statement at all when there is nothing to upsert', () => {
    expect(paymentUpsertStatements([])).toEqual([])
  })

  it('a Received date caught mid-year is left out of its row — never written as null — and the rest of the row saves', () => {
    const [full, held] = paymentUpsertStatements(upsertsFor([row('a', 100), row('b', 75, { paid_on: '0002-07-30', note: 'check 1182' })]))
    expect(full?.map((r) => r.id)).toEqual(['a'])
    expect(held).toHaveLength(1)
    expect(held?.[0]).toMatchObject({ id: 'b', amount: 75, note: 'check 1182', sent_on: null, sequence_order: 1 })
    expect('paid_on' in held![0]!).toBe(false)
  })

  it('every row of a statement carries the same columns, so no row is written a null it did not hold', () => {
    const statements = paymentUpsertStatements(
      upsertsFor([
        row('a', 100),
        row('b', 75, { paid_on: '0020-07-30' }),
        row('c', 60, { sent_on: '0202-07-28' }),
        row('d', 40, { paid_on: '0026-07-30', sent_on: '0026-07-28' }),
        row('e', 30, { paid_on: '0002-08-01' }),
      ]),
    )
    expect(statements.map((rows) => rows.map((r) => r.id))).toEqual([['a'], ['b', 'e'], ['c'], ['d']])
    for (const rows of statements) {
      const columns = rows.map((r) => Object.keys(r).sort().join(','))
      expect(new Set(columns).size).toBe(1)
    }
    expect(statements[1]?.every((r) => !('paid_on' in r) && 'sent_on' in r)).toBe(true)
    expect(statements[2]?.every((r) => 'paid_on' in r && !('sent_on' in r))).toBe(true)
    expect(statements[3]?.every((r) => !('paid_on' in r) && !('sent_on' in r))).toBe(true)
  })

  it('names the boxes held, row by row', () => {
    const upserts = upsertsFor([row('a', 100), row('b', 75, { paid_on: '0002-07-30' }), row('c', 60, { paid_on: '0026-07-30', sent_on: '0202-07-28' })])
    expect(unfinishedPaymentDateBoxes(upserts)).toEqual(['b:paid_on', 'c:paid_on', 'c:sent_on'])
    expect(unfinishedPaymentDateBoxes(upsertsFor([row('a', 100)]))).toEqual([])
  })

  it('a row with no amount is never written, so its half-typed date holds nothing', () => {
    expect(unfinishedPaymentDateBoxes(upsertsFor([row('scaffold', 0, { paid_on: '0002-07-30' })]))).toEqual([])
  })
})
