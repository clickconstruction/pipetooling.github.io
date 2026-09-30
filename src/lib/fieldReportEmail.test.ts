import { describe, expect, it } from 'vitest'
import { buildReportEmail } from '../../supabase/functions/_shared/fieldReportEmail'
import { sampleFieldReportContent } from './teamSampleEmails'

// The Field report email (v2.4180 lift): Ana's sample job-completion report.
describe('fieldReportEmail kernel', () => {
  const content = sampleFieldReportContent('2026-09-29')
  const built = buildReportEmail(content)

  it('the subject is the template and the job', () => {
    expect(built.subject).toBe('Job completion — 1054 · Water heater replacement')
  })

  it('the header carries the template, the job, the Chicago time and the author', () => {
    expect(built.html).toContain('<h2 style="font-size:18px;margin:0 0 4px">Job completion</h2>')
    expect(built.html).toContain('>1054 · Water heater replacement</div>')
    expect(built.html).toContain('9/29/2026, 12:40:00 PM · Ana Lead')
  })

  it('every non-empty field renders in order; the signature is a placeholder; arrays join', () => {
    const h = built.html
    expect(h.indexOf('Work done')).toBeLessThan(h.indexOf('Parts used'))
    expect(h.indexOf('Parts used')).toBeLessThan(h.indexOf('Follow-up'))
    expect(h).toContain('Bradford White 50-gal, Expansion tank, 2× flex lines')
    expect(h).toContain('[signature captured]')
    expect(h).not.toContain('data:image')
    expect(h).not.toContain('Photos')
  })

  it('a report with no filled fields says No content', () => {
    const empty = buildReportEmail({ ...content, fieldValues: { Photos: '', Notes: null } })
    expect(empty.html).toContain('No content')
    expect(empty.text.endsWith('\nNo content')).toBe(true)
  })

  it('the text lists each field as label, then value', () => {
    expect(built.text.startsWith('Job completion\n1054 · Water heater replacement\n9/29/2026, 12:40:00 PM · Ana Lead\n\nWork done:\nReplaced 50-gal gas heater')).toBe(true)
    expect(built.text).toContain('Customer signature:\n[signature captured]\n')
  })
})
