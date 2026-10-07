import { describe, expect, it } from 'vitest'
import { attributeJobPayments, billPaymentSlices, isSentBill, paymentsAppliedToBill } from './paymentAttribution'

const bill = (id: string, amount: number, status = 'billed', seq: number | null = null, billed_at: string | null = null) => ({ id, amount, status, sequence_order: seq, billed_at })
const pay = (amount: number, invoice_id: string | null, paid_on: string | null = null, seq: number | null = null) => ({ amount, invoice_id, paid_on, sequence_order: seq })

describe('paymentAttribution (v2.3592) — oldest bill first', () => {
  it('a sent bill is billed or paid; a draft was never in the customer\'s hands', () => {
    expect(isSentBill('billed')).toBe(true)
    expect(isSentBill('paid')).toBe(true)
    expect(isSentBill('ready_to_bill')).toBe(false)
    expect(isSentBill(null)).toBe(false)
  })

  // Job 102: one $5,355 bill, one unlinked $3,000 check.
  it('a single-bill job takes the unlinked payment', () => {
    const r = attributeJobPayments([bill('a', 5355)], [pay(3000, null, '2026-02-26')])
    expect(r.byBill.get('a')).toMatchObject({ linked: 0, unlinked: 3000, applied: 3000 })
    expect(r.surplus).toBe(0)
    expect(r.unlinkedTotal).toBe(3000)
    expect(r.byBill.get('a')!.slices).toEqual([{ payment: pay(3000, null, '2026-02-26'), amount: 3000, partial: false }])
  })

  // Job 273: three open bills, $38,780 unlinked across four payments. Oldest first: the first two
  // bills close, the third takes the rest of what it needs, and the surplus is the job's.
  it('a multi-bill job fills bills oldest first and reports the surplus once', () => {
    const bills = [bill('s0', 13420, 'billed', 0), bill('s1', 3500, 'billed', 1), bill('s2', 665, 'billed', 2)]
    const payments = [pay(10000, null, '2026-06-01', 0), pay(10000, null, '2026-07-01', 1), pay(10000, null, '2026-08-01', 2), pay(8780, null, '2026-09-01', 3)]
    const r = attributeJobPayments(bills, payments)
    expect(r.byBill.get('s0')!.applied).toBe(13420)
    expect(r.byBill.get('s1')!.applied).toBe(3500)
    expect(r.byBill.get('s2')!.applied).toBe(665)
    expect(r.surplus).toBe(38780 - 13420 - 3500 - 665)
    // The second $10,000 payment split: $3,420 finishes s0, $3,500 closes s1, $665 closes s2, $2,415 spills.
    const s0 = r.byBill.get('s0')!.slices
    expect(s0.map((x) => [x.amount, x.partial])).toEqual([[10000, false], [3420, true]])
    expect(r.byBill.get('s1')!.slices).toEqual([{ payment: payments[1], amount: 3500, partial: true }])
    expect(r.byBill.get('s2')!.slices).toEqual([{ payment: payments[1], amount: 665, partial: true }])
  })

  // Job 258: the $8,000 check is linked to seq 1; the later $9,800 bill has nothing.
  it('linked money stays with its bill in full and never leaks to a later one', () => {
    const bills = [bill('s0', 8900, 'paid', 0), bill('s1', 8000, 'paid', 1), bill('s2', 9800, 'billed', 2)]
    const r = attributeJobPayments(bills, [pay(8000, 's1', '2026-06-04')])
    expect(r.byBill.get('s2')!.applied).toBe(0)
    expect(r.byBill.get('s1')!.applied).toBe(8000)
    expect(r.byBill.get('s0')!.applied).toBe(0)
    expect(paymentsAppliedToBill(bills, [pay(8000, 's1')], 's2')).toBe(0)
  })

  it('an unlinked payment on job 258 goes to the oldest bill that still needs it, not the one being read', () => {
    const bills = [bill('s0', 8900, 'paid', 0), bill('s1', 8000, 'paid', 1), bill('s2', 9800, 'billed', 2)]
    const r = attributeJobPayments(bills, [pay(8000, 's1'), pay(500, null)])
    expect(r.byBill.get('s0')!.applied).toBe(500)
    expect(r.byBill.get('s2')!.applied).toBe(0)
  })

  // Job 251: two paid bills and one open one against $18,880 unlinked.
  it('paid bills with no linked money absorb unlinked money before the open one', () => {
    const bills = [bill('p0', 23, 'paid', 0), bill('p1', 9440, 'paid', 1), bill('o', 4720, 'billed', 2)]
    const r = attributeJobPayments(bills, [pay(9440, null, '2026-05-01'), pay(9440, null, '2026-06-01')])
    expect(r.byBill.get('p0')!.applied).toBe(23)
    expect(r.byBill.get('p1')!.applied).toBe(9440)
    expect(r.byBill.get('o')!.applied).toBe(4720)
    expect(r.surplus).toBe(18880 - 23 - 9440 - 4720)
  })

  it('a ready-to-bill draft takes nothing, and a linked overpayment does not free money for others', () => {
    const bills = [bill('a', 1000, 'billed', 0), bill('draft', 900, 'ready_to_bill', 1)]
    const r = attributeJobPayments(bills, [pay(1200, 'a'), pay(300, null)])
    expect(r.byBill.get('a')).toMatchObject({ linked: 1200, unlinked: 0, applied: 1200 })
    expect(r.byBill.get('draft')!.applied).toBe(0)
    expect(r.surplus).toBe(300)
  })

  it('orders bills by sequence, then billed date, then id; payments by sequence, then paid date', () => {
    const bills = [bill('late', 100, 'billed', null, '2026-08-01'), bill('early', 100, 'billed', null, '2026-07-01'), bill('first', 100, 'billed', 0, '2026-09-01')]
    const r = attributeJobPayments(bills, [pay(150, null, '2026-09-05', null)])
    expect(r.byBill.get('first')!.applied).toBe(100)
    expect(r.byBill.get('early')!.applied).toBe(50)
    expect(r.byBill.get('late')!.applied).toBe(0)
    const slices = billPaymentSlices([bill('a', 500)], [pay(100, null, '2026-02-01', 1), pay(100, null, '2026-01-01', 0), pay(50, 'a', '2026-03-01', 2)], 'a')
    expect(slices.map((s) => s.payment.paid_on)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01'])
  })

  it('a payment linked to a bill the reader was not given still counts for that bill, and bad numbers read as zero', () => {
    const r = attributeJobPayments([bill('a', 100)], [pay(40, 'elsewhere'), pay(Number.NaN, null), { amount: 'x', invoice_id: null }])
    expect(r.byBill.get('a')!.applied).toBe(0)
    expect(r.byBill.get('elsewhere')).toMatchObject({ linked: 40, applied: 40 })
    expect(r.unlinkedTotal).toBe(0)
    expect(r.surplus).toBe(0)
  })
})

// v2.4534: with the job's total in hand, unlinked money pays the part of the job that is on no
// sent bill before it pays a bill. The four jobs below are the ledger's own (2026-10-05).
describe('paymentAttribution (v2.4534) — off-bill work first', () => {
  // Job 273: a $56,365 job, three open bills adding to $17,585, $38,780 paid before the first was sent.
  it('job 273: money that paid the unbilled part leaves the three bills open in full', () => {
    const bills = [bill('s0', 13420, 'billed', 0, '2026-03-16'), bill('s1', 665, 'billed', 1, '2026-08-21'), bill('s2', 3500, 'billed', 2, '2026-08-21')]
    const payments = [pay(8880, null, '2025-12-19', 0), pay(12000, null, '2025-10-10', 1), pay(1200, null, '2025-11-11', 2), pay(16700, null, '2026-03-10', 3)]
    const r = attributeJobPayments(bills, payments, 56365)
    expect([...r.byBill.values()].map((b) => b.applied)).toEqual([0, 0, 0])
    expect(r.offBill).toBe(38780)
    expect(r.surplus).toBe(0)
    expect(r.unlinkedTotal).toBe(38780)
    expect(paymentsAppliedToBill(bills, payments, 's0', 56365)).toBe(0)
    expect(billPaymentSlices(bills, payments, 's0', 56365)).toEqual([])
    // Without the total: the reading before v2.4534, every bill covered and the rest a surplus.
    const before = attributeJobPayments(bills, payments)
    expect([...before.byBill.values()].map((b) => b.applied)).toEqual([13420, 665, 3500])
    expect(before.surplus).toBe(21195)
    expect(before.offBill).toBe(0)
  })

  // Job 473: $42,868.75; paid bills of $18,640 (no linked money) and $4,900.17 (its own payment), one open $5,723.58.
  it('job 473: the off-bill part fills first, the rest closes the oldest paid bill, the open bill stays open', () => {
    const bills = [bill('old', 18640, 'paid', 0), bill('mid', 4900.17, 'paid', 1, '2026-08-06'), bill('open', 5723.58, 'billed', 2, '2026-09-25')]
    const payments = [pay(13980, null, '2026-01-02', 0), pay(18265, null, '2026-03-12', 1), pay(4900.17, 'mid', '2026-08-17', 2)]
    const r = attributeJobPayments(bills, payments, 42868.75)
    expect(r.offBill).toBe(13605)
    expect(r.byBill.get('old')!.applied).toBe(18640)
    expect(r.byBill.get('mid')).toMatchObject({ linked: 4900.17, unlinked: 0, applied: 4900.17 })
    expect(r.byBill.get('open')!.applied).toBe(0)
    expect(r.surplus).toBe(0)
    // The first payment went wholly off-bill; the second split $-off-bill / the old bill, so its slice is partial.
    expect(r.byBill.get('old')!.slices).toEqual([
      { payment: payments[0], amount: 375, partial: true },
      { payment: payments[1], amount: 18265, partial: false },
    ])
  })

  // Job 251: $23,600; paid bills of $23 and $9,440, one open $4,720; two unlinked $9,440 payments.
  it('job 251: $9,417 off-bill, $9,463 closes the two paid bills, the $4,720 bill is owed', () => {
    const bills = [bill('a', 23, 'paid', 0), bill('b', 9440, 'paid', 1), bill('c', 4720, 'billed', 2, '2026-08-26')]
    const r = attributeJobPayments(bills, [pay(9440, null, '2026-03-12', 0), pay(9440, null, '2026-10-03', 1)], 23600)
    expect(r.offBill).toBe(9417)
    expect([r.byBill.get('a')!.applied, r.byBill.get('b')!.applied, r.byBill.get('c')!.applied]).toEqual([23, 9440, 0])
    expect(r.surplus).toBe(0)
  })

  // Job 102: an $8,355 job whose one bill is the $5,355 left after a $3,000 check.
  it('job 102: the $3,000 check paid the part the bill left out, so the bill is owed in full', () => {
    const r = attributeJobPayments([bill('a', 5355, 'billed', 0, '2026-08-04')], [pay(3000, null, '2026-02-26')], 8355)
    expect(r.byBill.get('a')!.applied).toBe(0)
    expect(r.offBill).toBe(3000)
  })

  it('a job wholly on its bills reads as before: a deposit comes off the bill, and what is left over is a surplus', () => {
    const one = attributeJobPayments([bill('a', 10000)], [pay(3000, null)], 10000)
    expect(one.byBill.get('a')!.applied).toBe(3000)
    expect(one.offBill).toBe(0)
    // Bills past the job's total (a change the total has not caught up with) leave no off-bill part either.
    const over = attributeJobPayments([bill('a', 6000), bill('b', 6000, 'billed', 1)], [pay(13000, null)], 10000)
    expect([over.byBill.get('a')!.applied, over.byBill.get('b')!.applied, over.offBill, over.surplus]).toEqual([6000, 6000, 0, 1000])
  })

  it('money past the off-bill part walks the bills, and a draft bill counts as off-bill work', () => {
    // $10,000 job: $4,000 sent, $2,500 drafted. Off-bill is 10,000 − 4,000 = 6,000 (the draft was never sent).
    const bills = [bill('sent', 4000, 'billed', 0), bill('draft', 2500, 'ready_to_bill', 1)]
    const r = attributeJobPayments(bills, [pay(5000, null, '2026-01-01', 0), pay(2500, null, '2026-02-01', 1)], 10000)
    expect(r.offBill).toBe(6000)
    expect(r.byBill.get('sent')!.applied).toBe(1500)
    expect(r.byBill.get('draft')!.applied).toBe(0)
    expect(r.byBill.get('sent')!.slices).toEqual([{ payment: pay(2500, null, '2026-02-01', 1), amount: 1500, partial: true }])
  })

  it('linked money is untouched by the job total, and a blank total is no total', () => {
    const bills = [bill('a', 1000, 'billed', 0), bill('b', 1000, 'billed', 1)]
    const r = attributeJobPayments(bills, [pay(1000, 'a'), pay(400, null)], 5000)
    expect(r.byBill.get('a')).toMatchObject({ linked: 1000, unlinked: 0 })
    expect(r.byBill.get('b')!.applied).toBe(0)
    expect(r.offBill).toBe(400)
    for (const none of [null, undefined, ''] as const) expect(attributeJobPayments(bills, [pay(400, null)], none).byBill.get('a')!.applied).toBe(400)
  })
})
