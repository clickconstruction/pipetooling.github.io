import { describe, expect, it } from 'vitest'
import { buildGcChecksReport, type ChecksJobIn } from '../jobs/gcChecksApplied'
import { GC_CHECKS_CSV_HEADER, buildGcChecksAppliedCsv, gcChecksCsvFileName, gcChecksPdfFileName, gcChecksReportSubtitle, gcChecksSheetModel, paidByWords, type SheetCell, type SheetRun } from './gcChecksAppliedReport'

const GC = 'gc-1'

const jobs: ChecksJobIn[] = [
  {
    id: 'oak',
    click_number: '1041',
    job_name: 'Oak Ridge Ph 2',
    job_address: '4410 Oak Ridge Dr',
    customer_id: 'owner',
    gc_customer_id: GC,
    bill_to_party: 'gc',
    lien_retainage_held: 1333,
    invoices: [
      { id: 'oak-1', job_id: 'oak', sequence_order: 1, amount: 9750, status: 'paid', billed_at: '2026-08-01' },
      { id: 'oak-2', job_id: 'oak', sequence_order: 2, amount: 13333, status: 'billed', billed_at: '2026-09-08' },
    ],
    payments: [
      { id: 'p1', job_id: 'oak', invoice_id: 'oak-1', amount: 9750, paid_on: '2026-05-10', payment_type: 'check', reference_number: '47001' },
      { id: 'p2', job_id: 'oak', invoice_id: 'oak-2', amount: 12000, paid_on: '2026-09-24', sent_on: '2026-09-19', payment_type: 'check', reference_number: '48211', mercury_transaction_id: 'dep-1' },
    ],
  },
  {
    id: 'maple',
    click_number: '1058',
    job_name: 'Maple, "Ct"',
    job_address: '210 Maple Ct',
    customer_id: 'owner',
    gc_customer_id: GC,
    bill_to_party: 'gc',
    lien_retainage_held: null,
    invoices: [{ id: 'maple-1', job_id: 'maple', sequence_order: 1, amount: 6400, status: 'paid', billed_at: '2026-09-01' }],
    payments: [{ id: 'p3', job_id: 'maple', invoice_id: 'maple-1', amount: 6400, paid_on: '2026-09-24', payment_type: 'check', reference_number: '48211', mercury_transaction_id: 'dep-1' }],
  },
]

const report = buildGcChecksReport({
  gcId: GC,
  jobs,
  events: [{ id: 'e1', kind: 'moved', payment_id: 'p2', from_job_id: 'maple', to_job_id: 'oak', amount: 12000, created_at: '2026-09-26T16:00:00Z' }],
  deposits: [{ id: 'dep-1', posted_at: '2026-09-25T15:00:00Z', amount: 18900, applied: 18400 }],
  sinceYmd: '2026-06-01',
})

/** A cell's words, one string per line ("· amount" on a line that has one). */
const runs = (r: SheetRun[]) => r.map((x) => x.text).join('')
const lines = (c: SheetCell) => c.lines.map((l) => `${runs(l.runs)}${l.amount ? ` · ${l.amount}` : ''}`)
const words = (c: SheetCell) => lines(c).join(' / ')

describe('gcChecksSheetModel', () => {
  const m = gcChecksSheetModel('A&B <Builders>', report, { asOfYmd: '2026-09-28' })
  it('titles the sheet for the GC and carries the period', () => {
    expect(m.title).toBe('A&B <Builders> — where your checks were applied')
    expect(m.subtitle).toBe('Since Jun 1, 2026 · as of Sep 28, 2026 · Click Plumbing and Electrical')
    expect(gcChecksReportSubtitle({ sinceYmd: null }, '2026-09-28')).toContain('Every payment on record')
  })
  it('sums the period, names the unapplied remainder and the retainage, its figures bold', () => {
    expect(m.summary.map(runs)).toEqual(['1 payment received · $18,400.00', 'applied to 2 invoices on 2 jobs', '$500.00 received, not yet applied', '$1,333.00 still open · of which $1,333.00 is retainage you hold'])
    expect(m.summary[0]!.filter((r) => r.tone === 'bold').map((r) => r.text)).toEqual(['1 payment', '$18,400.00'])
  })
  it('lists each payment with its lines grouped under the job, its stamps and where it was', () => {
    const t = m.checks.table
    expect(t.head.map(words)).toEqual(['Payment', 'Received', 'Amount', 'Applied now to', 'Was on'])
    expect(t.widths.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    const [payment, received, amount, applied, wasOn] = t.rows[0]!
    expect(lines(payment!)).toEqual(['#48211', 'mailed Sep 19 · deposited Sep 25'])
    expect(payment!.lines[1]!.small).toBe(true)
    expect(words(received!)).toBe('Sep 24, 2026')
    expect(amount!.align).toBe('right')
    expect(lines(applied!)).toEqual([
      '210 Maple Ct · 1058 Maple, "Ct" job paid in full',
      'Invoice 1 of 1 · $6,400.00',
      '4410 Oak Ridge Dr · 1041 Oak Ridge Ph 2',
      'Invoice 2 of 2 · $12,000.00',
      'not yet applied — tell us the invoice · $500.00',
    ])
    expect(applied!.lines.map((l) => [!!l.indent, !!l.gapBefore])).toEqual([[false, false], [true, false], [false, true], [true, false], [false, true]])
    expect(applied!.lines[0]!.runs[1]).toEqual({ text: ' job paid in full', tone: 'green' })
    expect(words(wasOn!)).toBe('$12,000.00 was on 210 Maple Ct · 1058 Maple, "Ct" until Sep 26')
    expect(t.total.map(words)).toEqual(['Received since Jun 1:', '$18,400.00', '$17,900.00 applied · $500.00 not yet applied'])
    expect(t.total.map((c) => c.span ?? 1)).toEqual([2, 1, 2])
    expect(m.checks.earlier).toBe('1 earlier payment is not on this sheet; the job table counts every payment.')
  })
  it('rolls each job up as Open then Paid in full, with dated paid-by words, and reconciles the open total', () => {
    const open = m.jobs.open!
    expect(open.head.map(words)).toEqual(['Job', 'Billed', 'Paid by', 'Last applied', 'Retainage held', 'Still open'])
    expect(open.rows[0]!.map(words)).toEqual(['4410 Oak Ridge Dr · 1041 Oak Ridge Ph 2 · 2 invoices', '$23,083.00', '#47001 May 10 · #48211 Sep 24', '#48211 · Sep 24', '$1,333.00', '$1,333.00'])
    expect(open.rows[0]![5]!.lines[0]!.runs[0]!.tone).toBe('red')
    expect(open.total.map(words)).toEqual(['Open on 1 job (matches your statement) · retainage held:', '$1,333.00', '$1,333.00'])
    const paid = m.jobs.paid!
    expect(paid.rows[0]![5]!.lines[0]!.runs[0]).toEqual({ text: 'paid', tone: 'green' })
    expect(paid.total.map(words)).toEqual(['1 job paid in full · billed:', '$6,400.00'])
    expect(paid.total[0]!.span).toBe(5)
  })
  it('draws no Was on or Retainage column when nothing would be in them', () => {
    const bare = gcChecksSheetModel('GC', buildGcChecksReport({ gcId: GC, jobs: jobs.map((j) => ({ ...j, lien_retainage_held: null })) }), { asOfYmd: '2026-09-28' })
    expect(bare.checks.table.head.map(words)).not.toContain('Was on')
    expect(bare.jobs.paid!.head.map(words)).not.toContain('Retainage held')
    expect(bare.checks.table.widths.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    expect(bare.jobs.paid!.widths.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    expect(bare.checks.earlier).toBeNull()
  })
  it('words paid-by as dates, and folds four or more into a span', () => {
    expect(paidByWords([])).toBe('—')
    expect(paidByWords([{ label: '#48102', receivedYmd: '2026-09-10', noNumber: false }, { label: 'check · no number recorded', receivedYmd: '2026-09-24', noNumber: true }])).toBe('#48102 Sep 10 · check Sep 24')
    expect(paidByWords([1, 2, 3, 4].map((n) => ({ label: 'Payment', receivedYmd: `2026-0${n}-01`, noNumber: false })))).toBe('4 payments, Jan 1 – Apr 1')
  })
})

describe('buildGcChecksAppliedCsv', () => {
  it('writes one row per applied line with the header, quoting what needs it', () => {
    const csv = buildGcChecksAppliedCsv(report)
    const lines = csv.trimEnd().split('\r\n')
    expect(lines[0]).toBe(GC_CHECKS_CSV_HEADER.join(','))
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe('#48211,check,48211,2026-09-24,2026-09-19,2026-09-25,18400.00,"210 Maple Ct · 1058 Maple, ""Ct""",Invoice 1 of 1,6400.00,yes,"$12,000.00 was on 210 Maple Ct · 1058 Maple, ""Ct"" until Sep 26",500.00')
    expect(lines[2]).toBe('#48211,check,48211,2026-09-24,2026-09-19,2026-09-25,18400.00,4410 Oak Ridge Dr · 1041 Oak Ridge Ph 2,Invoice 2 of 2,12000.00,no,"$12,000.00 was on 210 Maple Ct · 1058 Maple, ""Ct"" until Sep 26",500.00')
  })
  it('names the file after the GC and the day', () => {
    expect(gcChecksCsvFileName('A&B <Builders> LLC', '2026-09-28')).toBe('checks-applied_A-B-Builders-LLC_2026-09-28.csv')
    expect(gcChecksCsvFileName('  ', '2026-09-28')).toBe('checks-applied_gc_2026-09-28.csv')
    expect(gcChecksPdfFileName('A&B <Builders> LLC', '2026-09-28')).toBe('checks-applied_A-B-Builders-LLC_2026-09-28.pdf')
  })
})
