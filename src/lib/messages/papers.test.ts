import { describe, expect, it } from 'vitest'
import { billPapers, defaultEstimatePaper, defaultPaperFills, estimatePapers, listedPapers, PAPER_LINES, paperFills, paperLineWords, paperRowWords, papersFor, papersTitle, type PaperEstimateRow, type PaperInvoiceRow, type PaperJobRow, type PaperPaymentRow } from './papers'

// Made-up jobs, bills and estimates for one customer (Dana Whitfield's, as the mock-ups say).
const BILL_A = '0000000a-0000-4000-8000-000000001042'
const BILL_B = '0000000b-0000-4000-8000-000000001051'
const BILL_PAID = '0000000c-0000-4000-8000-000000001038'
const BILL_ON_PAID_JOB = '0000000d-0000-4000-8000-000000000999'
const BILL_RTB = '0000000e-0000-4000-8000-000000000777'
const BILL_GC = '0000000f-0000-4000-8000-000000000555'
const BILL_LOST = '00000010-0000-4000-8000-000000000444'

const job = (id: string, set: Partial<PaperJobRow> = {}): PaperJobRow => ({
  id,
  status: 'billed',
  revenue: 0,
  payments_made: 0,
  collections_at: null,
  uncollectible_at: null,
  job_name: `Job ${id}`,
  hcp_number: null,
  click_number: null,
  billing_only: false,
  ...set,
})

const bill = (id: string, jobId: string, set: Partial<PaperInvoiceRow> = {}): PaperInvoiceRow => ({
  id,
  job_id: jobId,
  status: 'billed',
  amount: 0,
  sequence_order: 1,
  billed_at: null,
  stripe_invoice_id: 'in_test',
  ...set,
})

const JOBS: PaperJobRow[] = [
  job('j-helotes', { job_name: 'Helotes re-pipe', hcp_number: '1312', revenue: 2260 }),
  job('j-sink', { job_name: 'Kitchen sink', click_number: 'C88', status: 'paid', revenue: 650, payments_made: 650 }),
  job('j-gc', { job_name: 'GC billing', billing_only: true }),
  job('j-lost', { job_name: 'Lost one', collections_at: '2026-09-01T12:00:00Z', uncollectible_at: '2026-10-01T12:00:00Z' }),
]

const INVOICES: PaperInvoiceRow[] = [
  bill(BILL_A, 'j-helotes', { amount: 1840, billed_at: '2026-10-12T15:00:00Z' }),
  bill(BILL_B, 'j-helotes', { amount: 420, sequence_order: 2, billed_at: '2026-10-17T15:00:00Z', stripe_invoice_id: null }),
  bill(BILL_PAID, 'j-helotes', { amount: 300, sequence_order: 0, billed_at: '2026-09-01T15:00:00Z', status: 'paid' }),
  bill(BILL_ON_PAID_JOB, 'j-sink', { amount: 650, billed_at: '2026-09-30T15:00:00Z' }),
  bill(BILL_RTB, 'j-helotes', { amount: 99, status: 'ready_to_bill' }),
  bill(BILL_GC, 'j-gc', { amount: 5000, billed_at: '2026-10-01T15:00:00Z' }),
  bill(BILL_LOST, 'j-lost', { amount: 800, billed_at: '2026-08-01T15:00:00Z' }),
]

const PAYMENTS: PaperPaymentRow[] = [{ invoice_id: BILL_A, job_id: 'j-helotes', amount: 400, paid_on: '2026-10-14', sequence_order: 1 }]

describe('billPapers: a person’s bills as the AR page counts them', () => {
  const papers = billPapers({ jobs: JOBS, invoices: INVOICES, payments: PAYMENTS })

  it('offers the open bills first, newest billed first, then the paid ones; never a draft, Owner Billing’s or an uncollectible one', () => {
    expect(papers.map((p) => [p.id, p.open])).toEqual([
      [BILL_B, true],
      [BILL_A, true],
      [BILL_ON_PAID_JOB, false],
      [BILL_PAID, false],
    ])
  })

  it('says what is still open after the payments, and a paid bill’s own amount', () => {
    expect(papers.find((p) => p.id === BILL_A)?.amount).toBe(1440)
    expect(papers.find((p) => p.id === BILL_B)?.amount).toBe(420)
    expect(papers.find((p) => p.id === BILL_ON_PAID_JOB)?.amount).toBe(650)
  })

  it('names each bill by its job’s number and name, its billed day, and its pay page when it is on Stripe', () => {
    const a = papers.find((p) => p.id === BILL_A)!
    expect([a.number, a.job, a.billedYmd]).toEqual(['1312', 'Helotes re-pipe', '2026-10-12'])
    expect(a.payUrl).toBe(`https://clicktooling.com/pay/${BILL_A}`)
    expect(papers.find((p) => p.id === BILL_B)?.payUrl).toBeNull()
    expect(papers.find((p) => p.id === BILL_ON_PAID_JOB)?.number).toBe('C88')
  })
})

describe('estimatePapers: estimates once sent', () => {
  const row = (id: string, status: string, sentAt: string, set: Partial<PaperEstimateRow> = {}): PaperEstimateRow => ({
    id,
    estimate_number: Number(id.slice(1)),
    title: `Estimate ${id}`,
    total_cents: 320000,
    status,
    sent_at: sentAt,
    job_ledger_id: null,
    ...set,
  })

  it('offers the ones waiting on an answer first, then the approved, the newest sent first; no draft, declined or superseded', () => {
    const papers = estimatePapers([
      row('e1031', 'customer_accepted', '2026-09-18T15:00:00Z', { total_cents: 115000 }),
      row('e1044', 'sent', '2026-10-14T15:00:00Z', { title: 'Kitchen re-pipe' }),
      row('e1040', 'sent', '2026-10-02T15:00:00Z'),
      row('e1050', 'draft', '2026-10-15T15:00:00Z'),
      row('e1020', 'declined', '2026-08-01T15:00:00Z'),
      row('e1010', 'superseded', '2026-07-01T15:00:00Z'),
    ])
    expect(papers.map((p) => [p.id, p.approved])).toEqual([
      ['e1044', false],
      ['e1040', false],
      ['e1031', true],
    ])
    expect(papers[0]).toMatchObject({ kind: 'estimate', number: '1044', job: 'Kitchen re-pipe', amount: 3200, sentYmd: '2026-10-14' })
    expect(papers[2]?.amount).toBe(1150)
  })
})

describe('papersFor, paperFills and defaultPaperFills', () => {
  const bills = billPapers({ jobs: JOBS, invoices: INVOICES, payments: PAYMENTS })
  const other = { ...bills[0]!, id: 'other', jobId: 'j-other', job: 'Water heater', billedYmd: '2026-10-18' }
  const all = [other, ...bills]

  it('puts the job’s own papers first in a job’s box, each kind in its order', () => {
    expect(papersFor(all, 'j-helotes').map((p) => p.id)).toEqual([BILL_B, BILL_A, BILL_PAID, 'other', BILL_ON_PAID_JOB])
    expect(papersFor(all, null).map((p) => p.id)).toEqual(all.map((p) => p.id))
  })

  it('fills a bill’s pay page, what is open, its number and its job; an estimate’s amount, number and title', () => {
    expect(paperFills(bills.find((p) => p.id === BILL_A)!)).toEqual({ bill: `https://clicktooling.com/pay/${BILL_A}`, amount: '$1,440', number: '1312', job: 'Helotes re-pipe' })
    const [estimate] = estimatePapers([{ id: 'e1', estimate_number: 1044, title: 'Kitchen re-pipe', total_cents: 320050, status: 'sent', sent_at: null, job_ledger_id: null }])
    expect(paperFills(estimate!)).toEqual({ amount: '$3,200.50', number: '1044', job: 'Kitchen re-pipe' })
  })

  it('a job’s box speaks of its own newest open bill and no other', () => {
    expect(defaultPaperFills(all, 'j-helotes', true)).toEqual({ bill: null, amount: '$420', number: '1312' })
    expect(defaultPaperFills(all, 'j-sink', true)).toEqual({})
  })

  it('a thread speaks of the tied job’s open bill, else the newest open bill anywhere, and of nothing when nothing is open', () => {
    expect(defaultPaperFills(all, 'j-helotes')).toEqual({ bill: null, amount: '$420', number: '1312' })
    expect(defaultPaperFills(all, 'j-sink').number).toBe('1312')
    expect(defaultPaperFills(all, null).amount).toBe(billsOpenFirstAmount(all))
    expect(defaultPaperFills(bills.filter((p) => !p.open), null)).toEqual({})
  })

  const sent = { kind: 'estimate' as const, id: 'e-sent', jobId: null, job: 'Kitchen re-pipe', number: '1044', approved: false, amount: 3200, sentYmd: '2026-10-14' }
  const made = { ...sent, id: 'e-made', jobId: 'j-helotes', job: 'Helotes re-pipe', number: '900', approved: true, sentYmd: '2026-09-20' }
  const withEstimates = [...all, sent, made]

  it('a job’s box speaks of its own estimate and no other job’s (v2.5645)', () => {
    expect(defaultEstimatePaper(withEstimates, 'j-helotes', true)?.id).toBe('e-made')
    expect(defaultEstimatePaper(withEstimates, 'j-sink', true)).toBeNull()
    expect(defaultEstimatePaper(all, 'j-helotes', true)).toBeNull()
  })

  it('a thread speaks of the tied job’s estimate, else their newest sent one', () => {
    expect(defaultEstimatePaper(withEstimates, 'j-helotes')?.id).toBe('e-made')
    expect(defaultEstimatePaper(withEstimates, 'j-sink')?.id).toBe('e-sent')
    expect(defaultEstimatePaper(withEstimates, null)?.id).toBe('e-sent')
    expect(defaultEstimatePaper(all, null)).toBeNull()
  })
})

/** The first open bill's amount as the fills say it. */
function billsOpenFirstAmount(papers: ReturnType<typeof billPapers>): string {
  const first = papers.find((p) => p.open)!
  return paperFills(first).amount!
}

describe('a paper in the / list (#127 PR 2)', () => {
  const open = (id: string, jobId: string, ymd: string) => ({ kind: 'bill' as const, id, jobId, job: `Job ${jobId}`, number: '1312', open: true, amount: 100, billedYmd: ymd, payUrl: null })
  const paid = (id: string, ymd: string) => ({ ...open(id, 'j-old', ymd), open: false })
  const est = { kind: 'estimate' as const, id: 'e1', jobId: null, job: 'Kitchen re-pipe', number: '1044', approved: false, amount: 3200, sentYmd: '2026-10-14' }
  const papers = [open('o1', 'j-a', '2026-10-17'), open('o2', 'j-b', '2026-10-12'), paid('p1', '2026-09-30'), paid('p2', '2026-09-20'), paid('p3', '2026-09-10'), paid('p4', '2026-09-01'), est]

  it('lists bills open first, the job’s first, then the newest three paid; estimates while their links are on (since PR 3)', () => {
    expect(listedPapers(papers, 'bill', 'j-b').map((p) => p.id)).toEqual(['o2', 'o1', 'p1', 'p2', 'p3'])
    expect(listedPapers(papers, 'estimate', null).map((p) => p.id)).toEqual(['e1'])
    expect(listedPapers(papers, 'estimate', null, false)).toEqual([])
  })

  it('gives each paper the app’s words and its row', () => {
    expect(paperLineWords(papers[0]!)).toBe(PAPER_LINES.openBill)
    expect(paperLineWords(papers[2]!)).toBe(PAPER_LINES.paidBill)
    expect(paperLineWords(est)).toBe(PAPER_LINES.estimate)
    expect(paperLineWords({ ...est, approved: true })).toBe(PAPER_LINES.approvedEstimate)
    expect(paperRowWords({ ...papers[0]!, amount: 1440 })).toEqual({ number: '#1312', what: 'Job j-a', when: 'billed Oct 17', money: '$1,440', state: 'open', tone: 'open' })
    expect(paperRowWords(papers[2]!)).toMatchObject({ state: 'paid', tone: 'paid', when: 'billed Sep 30' })
    expect(paperRowWords(est)).toEqual({ number: 'Estimate 1044', what: 'Kitchen re-pipe', when: 'sent Oct 14', money: '$3,200', state: 'not approved yet', tone: 'sent' })
    expect([papersTitle('Dana', 'bill'), papersTitle(null, 'estimate')]).toEqual(["Dana's bills", 'Their estimates'])
  })
})
