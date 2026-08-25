import { describe, expect, it } from 'vitest'
import {
  appendNoteTag,
  backfillInvoiceNote,
  buildInvoiceReconcilePlan,
  buildJobNumberMap,
  buildPaymentReconcilePlan,
  parseHcpInvoicesExport,
  parseHcpJobsBridge,
  parseHcpPaymentsExport,
  type ReconcileInvoice,
  type ReconcilePayment,
} from './hcpReconcile'

const job = (id: string, hcp: string | null) => ({ id, hcp_number: hcp })
const inv = (
  id: string,
  job_id: string,
  status = 'paid',
  billed_at: string | null = null,
  extra: Partial<ReconcileInvoice> = {},
): ReconcileInvoice => ({
  id,
  job_id,
  status,
  billed_at,
  estimated_bill_date: null,
  stripe_invoice_id: null,
  external_send_note: null,
  ...extra,
})
const pay = (
  id: string,
  job_id: string,
  amount: number,
  paid_on: string | null,
  extra: Partial<ReconcilePayment> = {},
): ReconcilePayment => ({
  id,
  job_id,
  amount,
  paid_on,
  invoice_id: null,
  payment_type: 'HCP import',
  note: null,
  sequence_order: 0,
  mercury_transaction_id: null,
  ...extra,
})

describe('parsers', () => {
  it('parses the invoices export and rejects other files', () => {
    const rows = parseHcpInvoicesExport(
      'Invoice #,Customer name,Invoice status,Amount due,Due date,Latest send date,Job #\n' +
        '612,Michael Palmer,Paid,$0.00,2026-07-18,2026-07-18 17:02:31 -0500,363\n' +
        '614,Curt Hoover,Open,$885.00,"","",833\n',
    )
    expect(rows).toHaveLength(2)
    expect(rows![0]).toMatchObject({ invoiceNo: '612', jobNumber: '363', status: 'Paid' })
    expect(rows![1]!.sentAtIso).toBeNull()
    expect(parseHcpInvoicesExport('Job #,Job created date\n1,2\n')).toBeNull()
  })

  it('parses the payments export into Chicago calendar days', () => {
    const rows = parseHcpPaymentsExport(
      'Job ID,Payment Received Date,Job Created Date,Job Completed Date,Customer ID,Customer Name,Invoice Number,Job Duration,Job Description,Invoice Status,Assigned Employee Name,Job Status,Payment Amount,Tax Amount,Tip Amount,Payment Type,Fee Amount,Fee Type,Job Location Longitude,Job Location Latitude,Job Location Zip Code\n' +
        '360482432,2026-07-23T17:50:00-05:00,2025-04-28T15:07:31-05:00,x,c,Michael Palmer,612,"",d,PAID,e,completed,"6,280.00",0,0,checkout check,0,f,0,0,0\n',
    )
    expect(rows).toHaveLength(1)
    expect(rows![0]).toMatchObject({ customer: 'Michael Palmer', paidYmd: '2026-07-23', amount: 6280 })
  })

  it('parses the jobs-export bridge with Excel-quoted numbers', () => {
    const rows = parseHcpJobsBridge(
      'Job #,Customer name,Job name,Job created date\n' + '"=""363""",Michael Palmer,x,2025-04-28T15:07:31-05:00\n',
    )
    expect(rows).toEqual([{ jobNumber: '363', customer: 'Michael Palmer', createdIso: '2025-04-28T15:07:31-05:00' }])
  })
})

describe('buildJobNumberMap', () => {
  it('normalizes and drops ambiguous numbers', () => {
    const m = buildJobNumberMap([job('a', '066'), job('b', '672'), job('c', '66')])
    expect(m.get('672')).toBe('b')
    expect(m.has('66')).toBe(false) // '066' and '66' collide after zero-strip
  })
})

describe('buildInvoiceReconcilePlan', () => {
  const jobs = [job('j1', '100'), job('j2', '200'), job('j3', '300')]
  const csv = (rows: string[]) =>
    parseHcpInvoicesExport(
      'Invoice #,Customer name,Invoice status,Amount due,Due date,Latest send date,Job #\n' + rows.join('\n') + '\n',
    )!

  it('creates a dated paid invoice for a paid, invoiceless job with payments, linking them', () => {
    const plan = buildInvoiceReconcilePlan(
      csv(['5,X,Paid,$0.00,d,2026-05-01 10:00:00 -0500,100']),
      jobs,
      [],
      [pay('p1', 'j1', 250, '2026-05-02')],
    )
    expect(plan.creates).toHaveLength(1)
    expect(plan.creates[0]).toMatchObject({ jobId: 'j1', amount: 250, linkPaymentIds: ['p1'] })
    expect(plan.stamps).toHaveLength(0)
  })

  it('never imports open invoices, multi-invoice jobs, or paymentless jobs', () => {
    const plan = buildInvoiceReconcilePlan(
      csv([
        '6,X,Open,$10,d,2026-05-01 10:00:00 -0500,100',
        '7,X,Paid,$0,d,2026-05-01 10:00:00 -0500,200',
        '8,X,Paid,$0,d,2026-05-02 10:00:00 -0500,200',
        '9,X,Paid,$0,d,2026-05-01 10:00:00 -0500,300',
      ]),
      jobs,
      [],
      [],
    )
    expect(plan.creates).toHaveLength(0)
    const reasons = plan.skips.map((s) => s.reason).join(' | ')
    expect(reasons).toContain('system of record')
    expect(reasons).toContain('Multiple HCP invoices')
    expect(reasons).toContain('no payments')
  })

  it('stamps a single undated invoice and links unlinked payments on paid singles — idempotently', () => {
    const invoices = [inv('i1', 'j1', 'paid', null)]
    const payments = [pay('p1', 'j1', 250, '2026-05-02')]
    const plan = buildInvoiceReconcilePlan(csv(['5,X,Paid,$0,d,2026-05-01 10:00:00 -0500,100']), jobs, invoices, payments)
    expect(plan.stamps).toEqual([{ invoiceId: 'i1', jobNumber: '100', sentAtIso: '2026-05-01 10:00:00 -0500' }])
    expect(plan.links).toEqual([{ paymentId: 'p1', invoiceId: 'i1', jobNumber: '100' }])

    // after applying: dated invoice, linked payment → empty plan
    const after = buildInvoiceReconcilePlan(
      csv(['5,X,Paid,$0,d,2026-05-01 10:00:00 -0500,100']),
      jobs,
      [inv('i1', 'j1', 'paid', '2026-05-01T15:00:00Z')],
      [pay('p1', 'j1', 250, '2026-05-02', { invoice_id: 'i1' })],
    )
    expect(after.creates).toHaveLength(0)
    expect(after.stamps).toHaveLength(0)
    expect(after.links).toHaveLength(0)
    expect(after.skips.map((s) => s.reason).join(' ')).toContain('Already reconciled')
  })
})

describe('buildPaymentReconcilePlan', () => {
  const jobs = [job('j1', '100'), job('j2', '200')]
  const bridge = parseHcpJobsBridge(
    'Job #,Customer name,Job created date\n' +
      '100,Alice,2025-01-01T10:00:00-06:00\n' +
      '200,Bob,2025-02-02T10:00:00-06:00\n',
  )!
  const payCsv = (rows: string[]) =>
    parseHcpPaymentsExport(
      'Payment Received Date,Job Created Date,Customer Name,Payment Amount,Payment Type\n' + rows.join('\n') + '\n',
    )!

  it('corrects a job-scoped unique amount match and tags the note', () => {
    const plan = buildPaymentReconcilePlan(
      payCsv(['2026-05-10T12:00:00-05:00,2025-01-01T10:00:00-06:00,Alice,100.00,checkout check']),
      bridge,
      jobs,
      [],
      [pay('p1', 'j1', 100, '2026-05-01', { note: 'ck' })],
      '2026-08-25',
    )
    expect(plan.corrections).toHaveLength(1)
    expect(plan.corrections[0]).toMatchObject({
      paymentId: 'p1',
      toYmd: '2026-05-10',
      newNote: 'ck · hcp-paydate-corrected-2026-08-25',
    })
  })

  it('never touches Mercury- or Stripe-dated rows', () => {
    const invoices = [inv('i1', 'j1', 'paid', '2026-05-01T15:00:00Z', { stripe_invoice_id: 'in_x' })]
    const plan = buildPaymentReconcilePlan(
      payCsv([
        '2026-05-10T12:00:00-05:00,2025-01-01T10:00:00-06:00,Alice,100.00,x',
        '2026-05-11T12:00:00-05:00,2025-02-02T10:00:00-06:00,Bob,50.00,x',
      ]),
      bridge,
      jobs,
      invoices,
      [
        pay('p1', 'j1', 100, '2026-05-01', { mercury_transaction_id: 'm1' }),
        pay('p2', 'j2', 50, '2026-05-01', { invoice_id: 'i1' }),
      ],
      '2026-08-25',
    )
    expect(plan.corrections).toHaveLength(0)
    expect(plan.skips.map((s) => s.reason).join(' | ')).toMatch(/Mercury.*|Stripe/)
  })

  it('splits a rollup into its real payments, linking only on/after the bill day', () => {
    const invoices = [inv('i1', 'j1', 'paid', '2026-03-01T15:00:00Z')]
    const plan = buildPaymentReconcilePlan(
      payCsv([
        '2026-02-10T12:00:00-06:00,2025-01-01T10:00:00-06:00,Alice,300.00,checkout check',
        '2026-03-15T12:00:00-05:00,2025-01-01T10:00:00-06:00,Alice,700.00,checkout ach',
      ]),
      bridge,
      jobs,
      invoices,
      [pay('p1', 'j1', 1000, '2026-03-01', { invoice_id: 'i1', sequence_order: 4 })],
      '2026-08-25',
    )
    expect(plan.splits).toHaveLength(1)
    const s = plan.splits[0]!
    expect(s.deletePaymentId).toBe('p1')
    expect(s.inserts).toHaveLength(2)
    expect(s.inserts[0]).toMatchObject({ amount: 300, paidYmd: '2026-02-10', invoiceId: null, sequenceOrder: 4 })
    expect(s.inserts[1]).toMatchObject({ amount: 700, paidYmd: '2026-03-15', invoiceId: 'i1', sequenceOrder: 5 })
  })

  it('leaves near-miss amounts alone and reports why', () => {
    const plan = buildPaymentReconcilePlan(
      payCsv(['2026-05-10T12:00:00-05:00,2025-01-01T10:00:00-06:00,Alice,99.40,x']),
      bridge,
      jobs,
      [],
      [pay('p1', 'j1', 100, '2026-05-01')],
      '2026-08-25',
    )
    expect(plan.corrections).toHaveLength(0)
    expect(plan.splits).toHaveLength(0)
    expect(plan.skips.map((s) => s.reason).join(' ')).toContain('do not reconcile')
  })

  it('is idempotent: corrected dates produce no further corrections', () => {
    const plan = buildPaymentReconcilePlan(
      payCsv(['2026-05-10T12:00:00-05:00,2025-01-01T10:00:00-06:00,Alice,100.00,x']),
      bridge,
      jobs,
      [],
      [pay('p1', 'j1', 100, '2026-05-10', { note: 'ck · hcp-paydate-corrected-2026-08-25' })],
      '2026-08-26',
    )
    expect(plan.corrections).toHaveLength(0)
  })
})

describe('helpers', () => {
  it('appendNoteTag and note builders', () => {
    expect(appendNoteTag(null, 't')).toBe('t')
    expect(appendNoteTag('  ', 't')).toBe('t')
    expect(appendNoteTag('memo', 't')).toBe('memo · t')
    expect(backfillInvoiceNote('2026-08-25', '612')).toBe('hcp-backfill-2026-08-25 (HCP invoice #612)')
  })
})
