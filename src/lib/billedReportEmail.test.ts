import { describe, expect, it } from 'vitest'
import { billedReportEmailSubject, billedReportEmailText, billedReportInKindLine, groupBilledRows, renderBilledReportEmail, withInKindApart, type BilledReportPayload, type BilledReportRow } from '../../supabase/functions/_shared/billedReportEmail'
import { stampInKindDeals } from '../../supabase/functions/_shared/inKindPayloadRows'
import { sampleBilledReportPayload } from './teamSampleEmails'

const p = sampleBilledReportPayload('2026-09-29')

describe('billedReportEmail (the report’s renderer, lifted v2.4167)', () => {
  it('subject carries the date and the grand total', () => {
    expect(billedReportEmailSubject(p)).toBe('Billed awaiting payment — Tue, Sep 29, 2026 — $56,944.00 due')
    expect(p.totals).toEqual({ row_count: 5, grand_total: 56944, count30_90: 3, sum30_90: 43020, count90: 0, sum90: 0 })
  })
  it('groups customers A→Z, oldest bill first, every job linked at the given origin', () => {
    expect(groupBilledRows(p.rows).map((g) => g.displayName)).toEqual(['Hunter Homes', 'Sam Sample', 'Sample Contracting', 'Sheffield'])
    const t = billedReportEmailText(p, 'https://clicktooling.com')
    expect(t.split('\n')[1]).toBe('5 open billing lines · $56,944.00 due')
    expect(t).toContain('  1041 · Cedar Bend Apartments — rough-in · 41d · $26,000.00 · https://clicktooling.com/jobs?jobDetail=job-1')
    expect(t.indexOf('1041 ·')).toBeLessThan(t.indexOf('1046 ·'))
    expect(t).toContain('Grand total due: $56,944.00')
  })
  it('html has the aging chips, tel and mailto contacts, the board door and the sender', () => {
    const html = renderBilledReportEmail(p, 'https://clicktooling.com', 'Wendi')
    expect(html).toContain('30&ndash;90 days &middot; 3 &middot; $43,020.00')
    expect(html).toContain('90+ days &middot; 0 &middot; $0.00')
    expect(html).toContain('href="tel:5125550199"')
    expect(html).toContain('href="mailto:sam.sample@example.com"')
    expect(html).toContain('href="https://clicktooling.com/jobs?tab=stages"')
    expect(html).toContain('Sent by Wendi from ClickTooling')
    expect(renderBilledReportEmail({ ...p, rows: [] }, 'https://x')).toContain('Nothing billed awaiting payment. Nice.')
  })
})

describe('the report leaves out a bill an in kind deal pays (punch list #301)', () => {
  const row = (over: Partial<BilledReportRow> & { job_id: string; remaining: number }): BilledReportRow => ({
    display_number: over.job_id,
    job_name: `Job ${over.job_id}`,
    job_address: null,
    customer_id: 'c1',
    customer_name: 'Harbor Row Rentals',
    customer_email: null,
    customer_phone: null,
    detail: 'Billed line',
    ref_date: '2026-04-01',
    ref_is_estimate: false,
    days_past: 234,
    aging_bucket: '90',
    ...over,
  })
  const payload = (rows: BilledReportRow[]): BilledReportPayload => ({
    generated_at: '2026-11-21T15:00:00Z',
    // The RPC's own totals, over every row it listed.
    totals: { row_count: rows.length, grand_total: rows.reduce((s, r) => s + r.remaining, 0), count30_90: 0, sum30_90: 0, count90: rows.length, sum90: rows.reduce((s, r) => s + r.remaining, 0) },
    rows,
  })

  it('a covered bill is in no row and no total, and the header says where it went', () => {
    const p = withInKindApart(payload([row({ job_id: '901', remaining: 4200, in_kind_arrangement_id: 'deal-1' })]))
    expect(p.rows).toEqual([])
    expect(p.totals).toEqual({ row_count: 0, grand_total: 0, count30_90: 0, sum30_90: 0, count90: 0, sum90: 0 })
    expect(p.inKind).toEqual({ count: 1, dollars: 4200 })
    expect(billedReportInKindLine(p)).toBe('$4,200 on 1 bill is scheduled in kind, not money due')
    const html = renderBilledReportEmail(p, 'https://x')
    expect(html).toContain('$4,200 on 1 bill is scheduled in kind, not money due.')
    expect(html).toContain('90+ days &middot; 0 &middot; $0.00')
    expect(html).toContain('No bill is waiting on money.')
    expect(html).not.toContain('Nice.')
    expect(billedReportEmailSubject(p)).toContain('$0.00 due')
  })

  it('a payer part covered: the bill off the deal is listed, aged and totalled, and the line counts the covered one', () => {
    const p = withInKindApart(
      payload([row({ job_id: '901', remaining: 4200, in_kind_arrangement_id: 'deal-1' }), row({ job_id: '902', remaining: 900, days_past: 45, aging_bucket: '30_90' }), row({ job_id: '903', remaining: 1800.555 })]),
    )
    expect(p.rows.map((r) => r.job_id)).toEqual(['902', '903'])
    expect(p.totals).toEqual({ row_count: 2, grand_total: 2700.56, count30_90: 1, sum30_90: 900, count90: 1, sum90: 1800.56 })
    const t = billedReportEmailText(p, 'https://x')
    expect(t).toContain('2 open billing lines · $2,700.56 due')
    expect(t).not.toContain('901 ·')
    expect(t.trim().endsWith('$4,200 on 1 bill is scheduled in kind, not money due.')).toBe(true)
  })

  it('an ordinary late bill: the payload is the RPC’s own, with no line', () => {
    const before = payload([row({ job_id: '903', remaining: 1800 })])
    const p = withInKindApart(before)
    expect(p.rows).toEqual(before.rows)
    expect(p.totals).toEqual(before.totals)
    expect(billedReportInKindLine(p)).toBeNull()
    const html = renderBilledReportEmail(p, 'https://x')
    expect(html).not.toContain('scheduled in kind')
    expect(html).toContain('<span style="color:#b91c1c;font-weight:bold;">234</span>')
  })

  it('the function’s stamp feeds the split: a job on a deal by the column, read 100 ids at a time', async () => {
    const admin = { from: () => ({ select: () => ({ in: () => ({ not: async () => ({ data: [{ id: '901', in_kind_arrangement_id: 'deal-1' }], error: null }) }) }) }) }
    const stamped = await stampInKindDeals(admin, payload([row({ job_id: '901', remaining: 4200 }), row({ job_id: '902', remaining: 900 })]))
    expect(withInKindApart(stamped).rows.map((r) => r.job_id)).toEqual(['902'])
  })
})
