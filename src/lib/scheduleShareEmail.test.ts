import { describe, expect, it } from 'vitest'
import { buildShareEmail } from '../../supabase/functions/_shared/scheduleShareCore'
import { sampleScheduleShareBlocks } from './teamSampleEmails'

// The shared Dispatch schedule email (v2.4178): three sample days, grouped by person.
describe('scheduleShareCore buildShareEmail', () => {
  const sample = sampleScheduleShareBlocks('2026-09-29')

  it('the subject spans the range', () => {
    expect(buildShareEmail(sample).subject).toBe('Dispatch schedule — Tue, Sep 29 – Thu, Oct 1')
    expect(buildShareEmail({ dates: ['2026-09-29'], blocks: [] }).subject).toBe('Dispatch schedule — Tue, Sep 29')
  })

  it('an empty range says so', () => {
    const e = buildShareEmail({ dates: ['2026-09-29', '2026-09-30'], blocks: [] })
    expect(e.text).toBe('No scheduled dispatch blocks for Tue, Sep 29 – Wed, Sep 30.\n')
    expect(e.html).toContain('No scheduled dispatch blocks for <strong>Tue, Sep 29 – Wed, Sep 30</strong>')
  })

  it('the HTML has one table per person, a date cell on a multi-day share, the address and the note', () => {
    const { html } = buildShareEmail(sample)
    expect(html.match(/<th colspan="3"/g)?.length).toBe(3)
    expect(html).toContain('>Ana Lead</th>')
    expect(html).toContain('>Thu, Oct 1</td>')
    expect(html).toContain('410 Elm Grove<br/>Buda, TX 78610')
    expect(html).toContain('Pressure test before backfill')
  })

  it('a single-day share drops the date column', () => {
    const { html } = buildShareEmail({ dates: ['2026-09-29'], blocks: sample.blocks.filter((b) => b.work_date === '2026-09-29') })
    expect(html).toContain('<th colspan="2"')
    expect(html).not.toContain('>Tue, Sep 29</td>')
  })

  it('the text lists each person, then their days', () => {
    const { text } = buildShareEmail(sample)
    expect(text.startsWith('Dispatch schedule for Tue, Sep 29 – Thu, Oct 1 (America/Chicago)\n\nAna Lead\n')).toBe(true)
    expect(text).toContain('  Thu, Oct 1  9:00 AM–10:30 AM  1058 · Repipe estimate')
    expect(text).toContain('    Note: Estimate only — bring the camera')
  })
})
