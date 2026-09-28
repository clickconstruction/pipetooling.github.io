import { describe, expect, it } from 'vitest'
import {
  billPaidByWords,
  buildGcChecksReport,
  checkAppliedSentence,
  checkHeadline,
  checkLabel,
  checkMoveWords,
  checkWasOnWords,
  checksJobLabel,
  findChecks,
  formatYmdLong,
  paymentKind,
  type ChecksInvoiceIn,
  type ChecksJobIn,
  type ChecksPaymentIn,
} from './gcChecksApplied'

const GC = 'gc-structura'

const inv = (id: string, job_id: string, sequence_order: number, amount: number, over: Partial<ChecksInvoiceIn> = {}): ChecksInvoiceIn => ({
  id,
  job_id,
  sequence_order,
  amount,
  status: 'billed',
  billed_at: `2026-0${sequence_order}-01T00:00:00Z`,
  ...over,
})

const pay = (id: string, job_id: string, amount: number, over: Partial<ChecksPaymentIn> = {}): ChecksPaymentIn => ({
  id,
  job_id,
  invoice_id: null,
  amount,
  paid_on: '2026-09-24',
  sent_on: null,
  payment_type: 'check',
  reference_number: '48211',
  mercury_transaction_id: null,
  sequence_order: 1,
  created_at: '2026-09-24T15:00:00Z',
  ...over,
})

const job = (id: string, over: Partial<ChecksJobIn> = {}): ChecksJobIn => ({
  id,
  click_number: id.toUpperCase(),
  job_name: `Job ${id}`,
  job_address: `${id} Main St`,
  customer_id: 'owner-1',
  gc_customer_id: GC,
  bill_to_party: 'gc',
  lien_retainage_held: null,
  invoices: [],
  payments: [],
  ...over,
})

describe('paymentKind / checkLabel / labels', () => {
  it('reads the office vocabulary', () => {
    expect(paymentKind('check')).toBe('check')
    expect(paymentKind('Cheque')).toBe('check')
    expect(paymentKind('ach')).toBe('ach')
    expect(paymentKind('wire')).toBe('wire')
    expect(paymentKind('stripe card')).toBe('card')
    expect(paymentKind('other')).toBe('other')
    expect(paymentKind(null)).toBe('other')
  })
  it('names a check by its number, and says when the number is missing', () => {
    expect(checkLabel('check', '48211')).toBe('#48211')
    expect(checkLabel('check', '')).toBe('check · no number recorded')
    expect(checkLabel('ach', '')).toBe('ACH')
    expect(checkLabel('card', '')).toBe('Card')
    expect(checkLabel('other', '')).toBe('Payment')
    expect(checkLabel('other', '', { deposit: true })).toBe('Bank deposit')
  })
  it('leads the job label with the address, as on the statement', () => {
    expect(checksJobLabel({ hcp_number: null, click_number: '1041', job_name: 'Oak Ridge Ph 2', job_address: '4410 Oak Ridge Dr' })).toBe('4410 Oak Ridge Dr · 1041 Oak Ridge Ph 2')
    expect(checksJobLabel({ hcp_number: null, click_number: null, job_name: null, job_address: '' })).toBe('Job')
    expect(formatYmdLong('2026-09-24')).toBe('Sep 24, 2026')
  })
})

describe('buildGcChecksReport', () => {
  const oak = job('oak', {
    invoices: [inv('oak-1', 'oak', 1, 9750), inv('oak-2', 'oak', 2, 13333), inv('oak-3', 'oak', 3, 14250)],
    payments: [pay('p1', 'oak', 9750, { invoice_id: 'oak-1', reference_number: '48102', paid_on: '2026-09-10' }), pay('p2', 'oak', 12000, { invoice_id: 'oak-2', sent_on: '2026-09-19' })],
    lien_retainage_held: 1333,
  })
  const maple = job('maple', {
    invoices: [inv('maple-1', 'maple', 1, 6400)],
    payments: [pay('p3', 'maple', 6400, { invoice_id: 'maple-1', sent_on: '2026-09-19' })],
  })

  it('folds the rows of one check into one check with a line per job, newest check first', () => {
    const r = buildGcChecksReport({ gcId: GC, jobs: [oak, maple] })
    expect(r.checks.map((c) => c.label)).toEqual(['#48211', '#48102'])
    const c = r.checks[0]!
    expect(c.amount).toBe(18400)
    expect(c.receivedYmd).toBe('2026-09-24')
    expect(c.sentYmd).toBe('2026-09-19')
    expect(c.lines.map((l) => [l.jobLabel, l.invoiceLabel, l.amount, l.billPaidInFull, l.jobPaidInFull])).toEqual([
      ['maple Main St · MAPLE Job maple', 'Invoice 1 of 1', 6400, true, true],
      ['oak Main St · OAK Job oak', 'Invoice 2 of 3', 12000, false, false],
    ])
    expect(r.summary).toEqual({ payments: 2, received: 28150, appliedLines: 3, jobsPaid: 2, unapplied: 0, stillOpen: 15583, retainageHeld: 1333, noNumber: 0 })
  })

  it('rolls each job up: billed, who paid it, the last check applied, retainage, what is open', () => {
    const r = buildGcChecksReport({ gcId: GC, jobs: [oak, maple] })
    expect(r.jobs.map((j) => [j.jobLabel, j.billed, j.paidBy, j.lastApplied?.label, j.retainageHeld, j.stillOpen, j.paid])).toEqual([
      ['oak Main St · OAK Job oak', 37333, ['#48102', '#48211'], '#48211', 1333, 15583, false],
      ['maple Main St · MAPLE Job maple', 6400, ['#48211'], '#48211', 0, 0, true],
    ])
  })

  it('splits an unlinked payment across the sent bills oldest first and names the rest as job money', () => {
    const river = job('river', {
      invoices: [inv('r-1', 'river', 1, 11000), inv('r-2', 'river', 2, 15000), inv('r-draft', 'river', 3, 5000, { status: 'ready_to_bill' })],
      payments: [pay('p9', 'river', 27500, { payment_type: 'ach', reference_number: null, paid_on: '2026-09-03', mercury_transaction_id: 'dep-1' })],
    })
    const r = buildGcChecksReport({ gcId: GC, jobs: [river], deposits: [{ id: 'dep-1', posted_at: '2026-09-03T14:00:00Z', amount: 28000, applied: 27500 }] })
    const c = r.checks[0]!
    expect(c.label).toBe('ACH')
    expect(c.depositedYmd).toBe('2026-09-03')
    expect(c.unapplied).toBe(500)
    expect(c.lines.map((l) => [l.invoiceLabel, l.amount])).toEqual([
      ['Invoice 1 of 2', 11000],
      ['Invoice 2 of 2', 15000],
      ['on the job, no bill yet', 1500],
    ])
    expect(r.summary.unapplied).toBe(500)
    expect(r.jobs[0]!.paid).toBe(true)
  })

  it('leaves out money the owner pays on a GC job, and counts a GC billed as the customer', () => {
    const split = job('split', {
      customer_id: 'owner-1',
      bill_to_party: 'customer',
      invoices: [inv('s-1', 'split', 1, 1000, { bill_to_party: 'gc' }), inv('s-2', 'split', 2, 2000)],
      payments: [pay('pa', 'split', 1000, { invoice_id: 's-1', reference_number: '100' }), pay('pb', 'split', 2000, { invoice_id: 's-2', reference_number: '200' })],
    })
    const asCustomer = job('direct', { customer_id: GC, gc_customer_id: null, bill_to_party: null, invoices: [inv('d-1', 'direct', 1, 300)], payments: [pay('pc', 'direct', 300, { invoice_id: 'd-1', reference_number: '300' })] })
    const r = buildGcChecksReport({ gcId: GC, jobs: [split, asCustomer] })
    expect(r.checks.map((c) => c.label)).toEqual(['#100', '#300'])
    expect(r.jobs.map((j) => [j.jobId, j.billed, j.stillOpen])).toEqual([
      ['direct', 300, 0],
      ['split', 1000, 0],
    ])
  })

  it('carries the trail: a moved payment says where it was and until when', () => {
    const r = buildGcChecksReport({
      gcId: GC,
      jobs: [oak, maple],
      events: [
        { id: 'e1', kind: 'moved', payment_id: 'p2', from_job_id: 'maple', to_job_id: 'oak', amount: 12000, created_at: '2026-09-26T16:00:00Z' },
        { id: 'e2', kind: 'removed', payment_id: 'p2', from_job_id: 'oak', to_job_id: null, amount: 12000, created_at: '2026-09-27T16:00:00Z' },
      ],
    })
    const c = r.checks[0]!
    expect(c.wasOn).toEqual([{ amount: 12000, fromJobLabel: 'maple Main St · MAPLE Job maple', toJobLabel: 'oak Main St · OAK Job oak', onYmd: '2026-09-26' }])
    expect(checkWasOnWords(c.wasOn[0]!)).toBe('$12,000.00 was on maple Main St · MAPLE Job maple until Sep 26')
    expect(checkMoveWords(c.wasOn[0]!)).toBe('$12,000.00 moved from maple Main St · MAPLE Job maple to oak Main St · OAK Job oak on Sep 26')
  })

  it('keeps only the period asked for and counts what it left out; undated checks stay', () => {
    const undated = job('u', { invoices: [inv('u-1', 'u', 1, 50)], payments: [pay('pu', 'u', 50, { invoice_id: 'u-1', paid_on: null, reference_number: '7' })] })
    const r = buildGcChecksReport({ gcId: GC, jobs: [oak, maple, undated], sinceYmd: '2026-09-20' })
    expect(r.checks.map((c) => c.label)).toEqual(['#48211', '#7'])
    expect(r.earlierCount).toBe(1)
    expect(r.jobs.find((j) => j.jobId === 'oak')?.paidBy).toEqual(['#48102', '#48211'])
  })

  it('a bank-recorded payment folds on the deposit id but never shows it as a number', () => {
    const dep = '170d8e0e-b2ad-11f1-96cf-4bc155fcb88b'
    const a = job('a', { invoices: [inv('a-1', 'a', 1, 2090)], payments: [pay('pa', 'a', 2090, { invoice_id: 'a-1', reference_number: dep, paid_on: '2026-09-17' })] })
    const b = job('b', { invoices: [inv('b-1', 'b', 1, 1980)], payments: [pay('pb', 'b', 1980, { invoice_id: 'b-1', reference_number: dep.toUpperCase(), paid_on: '2026-09-17' })] })
    const r = buildGcChecksReport({ gcId: GC, jobs: [a, b] })
    expect(r.checks).toHaveLength(1)
    expect(r.checks[0]!.amount).toBe(4070)
    expect(r.checks[0]!.number).toBe('')
    expect(r.checks[0]!.label).toBe('check · no number recorded')
    expect(r.checks[0]!.noNumber).toBe(true)
    expect(findChecks(r.checks, '170d8e0e')).toEqual([])
    const untyped = buildGcChecksReport({ gcId: GC, jobs: [{ ...a, payments: [{ ...a.payments[0]!, payment_type: null }] }] })
    expect(untyped.checks[0]!.label).toBe('Bank deposit')
    expect(untyped.checks[0]!.noNumber).toBe(false)
    expect(findChecks(r.checks, '4,070').map((c) => c.amount)).toEqual([4070])
  })

  it('flags a check recorded without its number, one row per payment', () => {
    const j = job('elm', { invoices: [inv('e-1', 'elm', 1, 4200)], payments: [pay('pe', 'elm', 4200, { invoice_id: 'e-1', reference_number: '  ' })] })
    const r = buildGcChecksReport({ gcId: GC, jobs: [j] })
    expect(r.checks[0]!.label).toBe('check · no number recorded')
    expect(r.checks[0]!.noNumber).toBe(true)
    expect(r.summary.noNumber).toBe(1)
  })

  it('words a check as a sentence the office can read out', () => {
    const r = buildGcChecksReport({ gcId: GC, jobs: [oak, maple] })
    const c = r.checks[0]!
    expect(checkHeadline(c)).toBe('Check #48211 · $18,400.00 · received Sep 24, 2026 (mailed Sep 19)')
    expect(checkAppliedSentence(c)).toBe('Applied now to $6,400.00 on maple Main St · MAPLE Job maple, Invoice 1 of 1, which it paid in full and $12,000.00 on oak Main St · OAK Job oak, Invoice 2 of 3.')
    expect(checkHeadline({ ...c, kind: 'ach', label: 'ACH', number: '', receivedYmd: null, depositedYmd: '2026-09-03' })).toBe('ACH · $18,400.00 · no received date · deposited Sep 3')
    expect(checkAppliedSentence({ ...c, unapplied: 500 })).toMatch(/\$500\.00 of the deposit is not yet on a bill\.$/)
  })
})

describe('findChecks', () => {
  const r = buildGcChecksReport({
    gcId: GC,
    jobs: [
      job('oak', { invoices: [inv('oak-1', 'oak', 1, 9750), inv('oak-2', 'oak', 2, 12000)], payments: [pay('p1', 'oak', 9750, { invoice_id: 'oak-1', reference_number: '48102', paid_on: '2026-09-10' }), pay('p2', 'oak', 12000, { invoice_id: 'oak-2' })] }),
      job('maple', { invoices: [inv('maple-1', 'maple', 1, 6400)], payments: [pay('p3', 'maple', 6400, { invoice_id: 'maple-1', sent_on: '2026-09-19' })] }),
    ],
  })
  it('finds by number, by amount (the check or a line), by day and by month and day', () => {
    expect(findChecks(r.checks, '48211').map((c) => c.label)).toEqual(['#48211'])
    expect(findChecks(r.checks, '#482').map((c) => c.label)).toEqual(['#48211'])
    expect(findChecks(r.checks, '$6,400').map((c) => c.label)).toEqual(['#48211'])
    expect(findChecks(r.checks, '9750.00').map((c) => c.label)).toEqual(['#48102'])
    expect(findChecks(r.checks, '2026-09-19').map((c) => c.label)).toEqual(['#48211'])
    expect(findChecks(r.checks, 'Sep 10').map((c) => c.label)).toEqual(['#48102'])
    expect(findChecks(r.checks, '')).toEqual([])
    expect(findChecks(r.checks, 'nothing')).toEqual([])
  })
})

describe('billPaidByWords', () => {
  const j = job('oak', {
    lien_retainage_held: 1333,
    invoices: [inv('oak-1', 'oak', 1, 9750), inv('oak-2', 'oak', 2, 13333), inv('oak-3', 'oak', 3, 14250)],
    payments: [pay('p1', 'oak', 9750, { invoice_id: 'oak-1', reference_number: '48102', paid_on: '2026-09-10' }), pay('p2', 'oak', 12000, { invoice_id: 'oak-2' })],
  })
  it('says what paid the bill, and what is still open — naming retainage when that is what is left', () => {
    expect(billPaidByWords(j, j.invoices[0]!)).toBe('paid in full by #48102 on Sep 10')
    expect(billPaidByWords(j, j.invoices[1]!)).toBe('$12,000.00 paid by #48211 on Sep 24 · $1,333.00 still open, the retainage you hold')
    expect(billPaidByWords(j, j.invoices[2]!)).toBe('nothing applied yet')
    expect(billPaidByWords({ ...j, lien_retainage_held: null }, j.invoices[1]!)).toBe('$12,000.00 paid by #48211 on Sep 24 · $1,333.00 still open')
  })
  it('a job balance with no bill reads what the job has been paid so far', () => {
    expect(billPaidByWords(j, null)).toBe('paid $21,750.00 so far by #48102 on Sep 10 and #48211 on Sep 24')
    expect(billPaidByWords({ ...j, payments: [] }, null)).toBe('nothing applied yet')
  })
  it('an unlinked payment counts for the oldest bill that needed it', () => {
    const u = job('u', { invoices: [inv('u-1', 'u', 1, 500), inv('u-2', 'u', 2, 700)], payments: [pay('pu', 'u', 900, { payment_type: 'ach', reference_number: null, paid_on: '2026-09-03' })] })
    expect(billPaidByWords(u, u.invoices[0]!)).toBe('paid in full by ACH on Sep 3')
    expect(billPaidByWords(u, u.invoices[1]!)).toBe('$400.00 paid by ACH on Sep 3 · $300.00 still open')
  })
})
