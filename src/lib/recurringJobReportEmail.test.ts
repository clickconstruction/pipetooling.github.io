import { describe, expect, it } from 'vitest'
import { buildRecurringJobReportHtml, buildRecurringJobReportTextFallback, recurringJobReportEmailSubject } from '../../supabase/functions/_shared/recurringJobReportEmail'
import { sunSatWeekOf } from './teamEmails'
import { sampleRecurringJobReportPayload } from './teamSampleEmails'

// The Job activity report email (v2.4179 lift): the sample Sun–Sat week over two jobs.
describe('recurringJobReportEmail kernel', () => {
  const p = sampleRecurringJobReportPayload('2026-09-29')

  it('sunSatWeekOf finds the Sunday and Saturday around a day', () => {
    expect(sunSatWeekOf('2026-09-29')).toEqual({ start: '2026-09-27', end: '2026-10-03' })
    expect(sunSatWeekOf('2026-09-27')).toEqual({ start: '2026-09-27', end: '2026-10-03' })
    expect(sunSatWeekOf('2026-10-03')).toEqual({ start: '2026-09-27', end: '2026-10-03' })
  })

  it('the subject is weekly with the range, daily with the day', () => {
    expect(recurringJobReportEmailSubject(p)).toBe('Job activity summary — week 2026-09-27 to 2026-10-03')
    expect(recurringJobReportEmailSubject({ reportingDate: '2026-09-29', periodKind: 'daily' })).toBe('Job activity summary — 2026-09-29')
  })

  it('the HTML has the weekly headline, a card per job, the clock table sorted by name, and the filed report', () => {
    const html = buildRecurringJobReportHtml(p)
    expect(html).toContain('<strong>Weekly summary (Sun–Sat)</strong> — 2026-09-27 – 2026-10-03')
    expect(html).toContain('<h2 style="margin:0 0 8px;font-size:16px;">1054 · Water heater replacement</h2>')
    expect(html).toContain('77 Hunter Loop<br/>Kyle, TX 78640')
    expect(html.indexOf('Ana Lead')).toBeLessThan(html.indexOf('Max Helper'))
    expect(html).toContain('Old unit drained and out by 9')
    expect(html).toContain('<strong>Job completion</strong>')
    expect(html).toContain('Replaced 50-gal gas heater')
    expect(html).not.toContain('>Cost</th>')
  })

  it('costs appear only when asked, and a banner note leads', () => {
    const html = buildRecurringJobReportHtml(p, 'Sent by hand', true)
    expect(html).toContain('Sent by hand')
    expect(html).toContain('>Cost</th>')
    expect(html).toContain('$168.00')
  })

  it('an empty window says so', () => {
    expect(buildRecurringJobReportHtml({ ...p, jobs: [] })).toContain('No org job activity in this window')
  })

  it('the text fallback lists each job, its address and each person’s hours', () => {
    const text = buildRecurringJobReportTextFallback(p, false)
    expect(text).toContain('1057 Hunter Homes — gas line\n  77 Hunter Loop\n  Kyle, TX 78640\n  Ana Lead: 18.50h\n  Max Helper: 18.50h\n')
    expect(buildRecurringJobReportTextFallback(p, true)).toContain('  Ana Lead: 4.00h  $168.00')
  })
})
