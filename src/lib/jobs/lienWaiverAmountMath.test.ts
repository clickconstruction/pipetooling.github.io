import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobLienReleaseRow } from './lienReleaseTracking'
import {
  lienWaiverAlreadyCovered,
  lienWaiverAmountMath,
  lienWaiverPaidUnwaived,
  waiverCoverageSentence,
  waiverCoversSentence,
  waiverPaymentLabel,
} from './lienWaiverAmountMath'

// Job 650 as it stood on Oct 1, 2026 (read from prod): two bills, two checks on the first.
const BILL1 = { id: 'b1', amount: 26800, status: 'billed', billed_at: '2026-07-15T22:05:23Z', created_at: '2026-07-15T22:05:23Z', sequence_order: 0 }
const BILL2 = { id: 'b2', amount: 6700, status: 'billed', billed_at: '2026-09-10T20:32:42Z', created_at: '2026-09-10T20:32:42Z', sequence_order: 1 }
const PAY = [
  { id: 'p2', invoice_id: 'b1', amount: 6077.51, paid_on: '2026-09-28', sent_on: null, created_at: '2026-09-28T15:00:00Z', payment_type: 'checkDeposit' },
  { id: 'p1', invoice_id: 'b1', amount: 11700, paid_on: '2026-09-14', sent_on: null, created_at: '2026-09-14T15:00:00Z', payment_type: 'checkDeposit' },
]
const job = { id: 'j650', revenue: 33500, payments: PAY, invoices: [BILL1, BILL2] } as unknown as JobWithDetails
const numbered = [BILL1, BILL2] as unknown as JobWithDetails['invoices']
const b1 = [BILL1] as unknown as JobWithDetails['invoices']
const both = numbered

function rel(p: Partial<JobLienReleaseRow>): JobLienReleaseRow {
  return { id: 'r', form_type: 'conditional_final', status: 'signed', amount: 15722.49, invoice_ids: ['b1', 'b2'], voided_at: null, created_at: '2026-10-01T02:17:32Z', signed_at: '2026-10-01T02:19:10Z', signer_printed_name: 'Malachi Whites', minted_at: '2026-10-01T02:17:40Z', ...p } as unknown as JobLienReleaseRow
}

describe('lienWaiverAmountMath — job 650, bill #1', () => {
  it('conditional: the bill less its two checks, oldest first, is what is still owed', () => {
    const m = lienWaiverAmountMath('conditional_progress', job, b1, numbered)!
    expect(m.kind).toBe('owed')
    expect(m.total).toBe(9022.49)
    expect(m.totalLabel).toBe('Still owed on bill #1')
    expect(m.show).toBe(true)
    expect(m.bills[0]).toMatchObject({ n: 1, billedYmd: '2026-07-15', amount: 26800, paid: 17777.51, owed: 9022.49 })
    expect(m.bills[0]!.payments.map((p) => [p.label, p.ymd, p.amount])).toEqual([
      ['Check', '2026-09-14', 11700],
      ['Check', '2026-09-28', 6077.51],
    ])
  })
  it('two bills picked: one line each, the total is the two owed together', () => {
    const m = lienWaiverAmountMath('conditional_final', job, both, numbered)!
    expect(m.total).toBe(15722.49)
    expect(m.totalLabel).toBe('Still owed')
    expect(m.bills.map((b) => [b.n, b.owed])).toEqual([[1, 9022.49], [2, 6700]])
  })
  it('a bill with nothing paid needs no box', () => {
    const m = lienWaiverAmountMath('conditional_progress', job, [BILL2] as unknown as JobWithDetails['invoices'], numbered)!
    expect(m.total).toBe(6700)
    expect(m.show).toBe(false)
  })
  it('unconditional progress: the money in hand', () => {
    const m = lienWaiverAmountMath('unconditional_progress', job, b1, numbered)!
    expect(m).toMatchObject({ kind: 'paid', total: 17777.51, totalLabel: 'Paid so far', show: true })
  })
  it('unconditional final: the whole job, and not yet while money is owed', () => {
    const m = lienWaiverAmountMath('unconditional_final', job, both, numbered)!
    expect(m).toMatchObject({ kind: 'whole', total: 33500, totalLabel: 'The whole job, paid in full', tooEarly: 15722.49, show: true })
  })
  it('nothing picked: no math', () => {
    expect(lienWaiverAmountMath('conditional_progress', job, [], numbered)).toBeNull()
  })
})

describe('lienWaiverAlreadyCovered', () => {
  it('finds the signed conditional final that already covers bill #1 (the draft on 650)', () => {
    const signed = rel({ id: 'signed' })
    const draft = rel({ id: 'draft', status: 'draft', signed_at: null, amount: 9022.49 })
    const c = lienWaiverAlreadyCovered('conditional_progress', ['b1'], numbered, [draft, signed], 'draft')!
    expect(c.release.id).toBe('signed')
    expect(c.billNumbers).toEqual([1])
    expect(c.coversNumbers).toEqual([1, 2])
    expect(waiverCoverageSentence(c, (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, (d) => (d === '2026-09-30' ? 'Sep 30' : d))).toBe(
      'Malachi Whites signed a conditional · final on Sep 30 for $15,722.49.',
    )
    expect(waiverCoversSentence(c)).toBe('It covers bill #1 and bill #2.')
  })
  it('ignores voided rows, drafts, the row being edited, and the other family', () => {
    expect(lienWaiverAlreadyCovered('conditional_progress', ['b1'], numbered, [rel({ voided_at: '2026-10-01T03:00:00Z' })], null)).toBeNull()
    expect(lienWaiverAlreadyCovered('conditional_progress', ['b1'], numbered, [rel({ status: 'draft' })], null)).toBeNull()
    expect(lienWaiverAlreadyCovered('conditional_progress', ['b1'], numbered, [rel({ id: 'me' })], 'me')).toBeNull()
    expect(lienWaiverAlreadyCovered('unconditional_progress', ['b1'], numbered, [rel({})], null)).toBeNull()
    expect(lienWaiverAlreadyCovered('conditional_progress', ['b1'], numbered, [rel({ invoice_ids: ['b2'] })], null)).toBeNull()
  })
})

describe('lienWaiverPaidUnwaived', () => {
  it('under a conditional, the $17,777.51 paid on bill #1 that no unconditional covers', () => {
    expect(lienWaiverPaidUnwaived('conditional_progress', job, b1, [rel({})])).toBe(17777.51)
  })
  it('less what a live unconditional already waives; nothing under an unconditional or with nothing paid', () => {
    expect(lienWaiverPaidUnwaived('conditional_progress', job, b1, [rel({ form_type: 'unconditional_progress', amount: 11700, invoice_ids: ['b1'] })])).toBe(6077.51)
    expect(lienWaiverPaidUnwaived('conditional_progress', job, b1, [rel({ form_type: 'unconditional_progress', amount: 17777.51, invoice_ids: ['b1'] })])).toBeNull()
    expect(lienWaiverPaidUnwaived('unconditional_progress', job, b1, [])).toBeNull()
    expect(lienWaiverPaidUnwaived('conditional_progress', job, [BILL2] as unknown as JobWithDetails['invoices'], [])).toBeNull()
  })
})

describe('waiverPaymentLabel', () => {
  it('names the payment the way a deposit slip does', () => {
    expect(['checkDeposit', 'check', 'Check', 'ach', 'card', 'cash', '', null].map(waiverPaymentLabel)).toEqual(['Check', 'Check', 'Check', 'Transfer', 'Card', 'Cash', 'Payment', 'Payment'])
  })
})
