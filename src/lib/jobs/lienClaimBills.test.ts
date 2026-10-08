import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { LIEN_BILL_FROM_HERE_HINT, LIEN_BILL_FROM_HERE_LABEL, lienBillsCountWords, lienClaimBills, lienClaimBillsOwed, lienNothingBilledWords, lienUnbilled, lienUnbilledWords } from './lienClaimBills'
import { plainWordsFailures } from '../plainWords'

const inv = (id: string, amount: number, seq: number, status = 'billed', over: Record<string, unknown> = {}) =>
  ({ id, amount, sequence_order: seq, status, billed_at: '2026-09-24T14:28:00Z', created_at: '2026-09-24T14:27:00Z', sent_to_customer_at: null, estimated_bill_date: null, stripe_invoice_memo: 'Rough In', external_send_note: '', stripe_invoice_footer: null, stripe_invoice_id: null, ...over }) as unknown as JobWithDetails['invoices'][number]

// Job 922's shape (2026-10-08): a $5,000 job, two $2,000 bills sent, the last $1,000 not billed.
const job = {
  id: 'j922',
  hcp_number: '922',
  job_name: 'Michael Palmer',
  job_address: '1 Example Ln, Austin, TX',
  customer_name: 'Michael Palmer',
  customer_email: '',
  customer_id: 'c1',
  gc_customer_id: 'gc1',
  bill_to_party: 'customer',
  revenue: 5000,
  payments_made: 0,
  fixtures: [],
  materials: [],
  payments: [],
  invoices: [inv('rough', 2000, 0, 'billed', { stripe_invoice_id: 'in_rough' }), inv('top', 2000, 1, 'billed', { stripe_invoice_id: 'in_top', stripe_invoice_memo: 'Top Out', billed_at: '2026-09-30T15:00:00Z' }), inv('final', 1000, 2, 'ready_to_bill')],
} as unknown as JobWithDetails

describe('lienClaimBills (v2.4969)', () => {
  it('lists every sent bill, oldest first, with billed, paid and owed; a draft at Ready to Bill is not a bill', () => {
    const bills = lienClaimBills(job, { rough: { invoiceNumber: '922-2609241309', dueYmd: '2026-09-24' } })
    expect(bills.map((b) => [b.invoiceId, b.billed, b.paid, b.owed, b.stripe])).toEqual([
      ['rough', 2000, 0, 2000, true],
      ['top', 2000, 0, 2000, true],
    ])
    expect(bills[0]!.number).toBe('#922-2609241309')
    expect(bills[0]!.dueYmd).toBe('2026-09-24')
    expect(bills[0]!.sentYmd).toBe('2026-09-24')
    expect(bills[1]!.sentYmd).toBe('2026-09-30')
    expect(bills[1]!.dueYmd).toBe('')
    expect(lienClaimBillsOwed(bills)).toBe(4000)
  })

  it('a part-paid bill shows its payment and owes the rest; a paid bill stays on the list owing nothing', () => {
    const paid = { ...job, payments: [{ invoice_id: 'rough', amount: 2000 }, { invoice_id: 'top', amount: 500.5 }] } as unknown as JobWithDetails
    const bills = lienClaimBills(paid)
    expect(bills.map((b) => [b.invoiceId, b.paid, b.owed])).toEqual([
      ['rough', 2000, 0],
      ['top', 500.5, 1499.5],
    ])
    expect(lienClaimBillsOwed(bills)).toBe(1499.5)
    // 922 later that day: both bills marked paid (status paid) — they stay on the list settled, and nothing is owed.
    const settled = { ...job, payments_made: 4000, invoices: [{ ...inv('rough', 2000, 0, 'paid') }, { ...inv('top', 2000, 1, 'paid') }, inv('final', 1000, 2, 'ready_to_bill')] } as unknown as JobWithDetails
    expect(lienClaimBills(settled).map((b) => [b.invoiceId, b.billed, b.paid, b.owed])).toEqual([
      ['rough', 2000, 2000, 0],
      ['top', 2000, 2000, 0],
    ])
    expect(lienUnbilled(settled, lienClaimBillsOwed(lienClaimBills(settled)))).toBe(1000)
    // A payment on the job with no bill behind it lowers no bill — the Bill tab reads it the same way.
    expect(lienClaimBillsOwed(lienClaimBills({ ...job, payments: [{ invoice_id: null, amount: 1000 }] } as unknown as JobWithDetails))).toBe(4000)
  })

  it('a job billed as one shell lists the job itself as the bill, price less payments (bill truth’s shell row)', () => {
    const shell = { ...job, status: 'billed', revenue: 3500, payments_made: 1000, invoices: [inv('final', 1000, 2, 'ready_to_bill')] } as unknown as JobWithDetails
    expect(lienClaimBills(shell)).toEqual([{ invoiceId: 'job:j922', number: '#922', what: 'billed as one bill', sentYmd: '', stripe: false, dueYmd: '', billed: 3500, paid: 1000, owed: 2500 }])
    expect(lienClaimBills({ ...shell, status: 'working' } as unknown as JobWithDetails)).toEqual([])
  })

  it('the unbilled part is price minus payments minus what the sent bills owe, never below zero', () => {
    expect(lienUnbilled({ revenue: 5000, payments_made: 0 }, 4000)).toBe(1000)
    expect(lienUnbilled({ revenue: 5000, payments_made: 4000 }, 0)).toBe(1000)
    expect(lienUnbilled({ revenue: 4000, payments_made: 0 }, 4000)).toBe(0)
    expect(lienUnbilled({ revenue: 3500, payments_made: 0 }, 4000)).toBe(0)
    expect(lienUnbilled({ revenue: null, payments_made: null }, 0)).toBe(0)
  })

  it('the words', () => {
    expect(lienBillsCountWords(0, 0)).toBe('nothing billed')
    expect(lienBillsCountWords(1)).toBe('1 bill')
    expect(lienBillsCountWords(2)).toBe('2 bills')
    expect(lienBillsCountWords(1, 2)).toBe('1 of 2 bills')
    expect(lienBillsCountWords(0, 2)).toBe('2 bills paid')
    expect(lienBillsCountWords(0, 1)).toBe('1 bill paid')
    expect(lienUnbilledWords(1000, 5000)).toBe('$1,000 of the job’s $5,000 · not claimed until it is billed')
    expect(lienNothingBilledWords(0)).toMatch(/^Nothing is billed on this job yet\./)
    expect(lienNothingBilledWords(2)).toMatch(/^The sent bills are paid\./)
    expect(LIEN_BILL_FROM_HERE_LABEL).toBe('Bill it from here ›')
    for (const words of [lienNothingBilledWords(0), lienNothingBilledWords(2), LIEN_BILL_FROM_HERE_HINT]) expect(plainWordsFailures(words)).toEqual([])
  })
})
