import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StageRow } from '../jobsStagesBoard'
import { buildBilledAwaitingPaymentReportHtml } from './billedAwaitingPaymentReport'

function job(p: Partial<Record<string, unknown>>): JobWithDetails {
  return {
    id: 'j1',
    hcp_number: 'HCP-1',
    job_name: 'Job One',
    job_address: '1 Main',
    customer_id: null,
    customer_name: null,
    customer_phone: null,
    customer_email: null,
    revenue: 0,
    payments_made: 0,
    last_bill_date: null,
    payments: [],
    invoices: [],
    ...p,
  } as unknown as JobWithDetails
}

const jobRow = (p: Partial<Record<string, unknown>>): StageRow => ({ kind: 'job', job: job(p) })

describe('buildBilledAwaitingPaymentReportHtml', () => {
  it('groups rows by customer, sorts groups by name, and totals remainders', () => {
    const rows: StageRow[] = [
      jobRow({ id: 'a', customer_id: 'c2', customer_name: 'Zeta LLC', revenue: 300, payments_made: 100 }),
      jobRow({ id: 'b', customer_id: 'c1', customer_name: 'Acme', revenue: 50 }),
      jobRow({ id: 'c', customer_id: 'c2', customer_name: 'Zeta LLC', revenue: 25 }),
    ]
    const html = buildBilledAwaitingPaymentReportHtml(rows, { dateStr: '7/20/2026' })
    expect(html).toContain('<h1>Billed awaiting payment — 7/20/2026</h1>')
    // Acme section sorts before Zeta
    expect(html.indexOf('Acme')).toBeLessThan(html.indexOf('Zeta LLC'))
    // Zeta subtotal 200 + 25; grand total 275 + 50
    expect(html).toContain('$225.00')
    expect(html).toContain('Grand total: $275.00')
  })

  it('groups no-customer rows under the fallback heading', () => {
    const html = buildBilledAwaitingPaymentReportHtml([jobRow({ revenue: 10 })], { dateStr: 'd' })
    expect(html).toContain('Jobs with no customer linked')
  })

  it('renders the contact block and search-filter note when present', () => {
    const html = buildBilledAwaitingPaymentReportHtml(
      [jobRow({ customer_id: 'c1', customer_name: 'Acme', customer_phone: '555', customer_email: 'a@b.c', revenue: 10 })],
      { searchFilter: '  roof  ', dateStr: 'd' },
    )
    expect(html).toContain('Phone: 555 · Email: a@b.c')
    expect(html).toContain('Filtered (stages search): roof')
  })

  it('escapes customer and job fields', () => {
    const html = buildBilledAwaitingPaymentReportHtml(
      [jobRow({ customer_id: 'c1', customer_name: 'A & <B>', job_name: '<Job>', revenue: 10 })],
      { dateStr: 'd' },
    )
    expect(html).toContain('A &amp; &lt;B&gt;')
    expect(html).toContain('&lt;Job&gt;')
  })
})
