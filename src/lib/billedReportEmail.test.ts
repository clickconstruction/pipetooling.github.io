import { describe, expect, it } from 'vitest'
import { billedReportEmailSubject, billedReportEmailText, groupBilledRows, renderBilledReportEmail } from '../../supabase/functions/_shared/billedReportEmail'
import { sampleBilledReportPayload } from './teamSampleEmails'

const p = sampleBilledReportPayload('2026-09-29')

describe('billedReportEmail (the report’s renderer, lifted v2.4167)', () => {
  it('subject carries the date and the grand total', () => {
    expect(billedReportEmailSubject(p)).toBe('Billed awaiting payment — Tue, Sep 29, 2026 — $56,944.00 due')
    expect(p.totals).toEqual({ row_count: 5, grand_total: 56944, count30_90: 3, sum30_90: 43020, count90: 0, sum90: 0 })
  })
  it('groups customers A→Z, oldest bill first, every job linked at the given origin', () => {
    expect(groupBilledRows(p.rows).map((g) => g.displayName)).toEqual(['Hunter Homes', 'Sam Sample', 'Sample Contracting', 'Structura'])
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
