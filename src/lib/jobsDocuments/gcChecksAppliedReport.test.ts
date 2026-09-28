import { describe, expect, it } from 'vitest'
import { buildGcChecksReport, type ChecksJobIn } from '../jobs/gcChecksApplied'
import { GC_CHECKS_CSV_HEADER, buildGcChecksAppliedCsv, buildGcChecksAppliedReportHtml, gcChecksCsvFileName, gcChecksReportSubtitle } from './gcChecksAppliedReport'

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
  deposits: [{ id: 'dep-1', posted_at: '2026-09-25T00:00:00Z', amount: 18900, applied: 18400 }],
  sinceYmd: '2026-06-01',
})

describe('buildGcChecksAppliedReportHtml', () => {
  const html = buildGcChecksAppliedReportHtml('A&B <Builders>', report, { asOfYmd: '2026-09-28' })
  it('titles the sheet for the GC, escapes, and carries the period', () => {
    expect(html).toContain('A&amp;B &lt;Builders&gt; — where your checks were applied')
    expect(html).toContain('Since Jun 1, 2026 · as of Sep 28, 2026 · Click Plumbing and Electrical')
    expect(gcChecksReportSubtitle({ sinceYmd: null }, '2026-09-28')).toContain('Every payment on record')
  })
  it('sums the period, names the unapplied remainder and the retainage', () => {
    expect(html).toContain('<b>1 payment</b> received · <b>$18,400.00</b>')
    expect(html).toContain('<b>$500.00</b> received, not yet applied')
    expect(html).toContain('<b>$1,333.00</b> still open · of which <b>$1,333.00</b> is retainage you hold')
  })
  it('lists each payment with its lines, its stamps and where it was', () => {
    expect(html).toContain('#48211')
    expect(html).toContain('mailed Sep 19 · deposited Sep 25')
    expect(html).toContain('210 Maple Ct · 1058 Maple, &quot;Ct&quot; · Invoice 1 of 1 <span style="color:#15803d;font-weight:600">job paid in full</span>')
    expect(html).toContain('4410 Oak Ridge Dr · 1041 Oak Ridge Ph 2 · Invoice 2 of 2')
    expect(html).toContain('not yet applied — tell us the invoice')
    expect(html).toContain('$12,000.00 was on 210 Maple Ct · 1058 Maple, &quot;Ct&quot; until Sep 26')
    expect(html).toContain('1 earlier payment is not on this sheet')
  })
  it('rolls each job up and reconciles the open total', () => {
    expect(html).toContain('#47001 · #48211')
    expect(html).toContain('#48211 · Sep 24')
    expect(html).toContain('Open on 1 job (matches your statement)')
    expect(html).toContain('<span style="color:#15803d;font-weight:600">paid</span>')
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
  })
})
