import { describe, expect, it } from 'vitest'
import { buildScheduleEmail, formatPgTimeHm } from '../../supabase/functions/_shared/scheduleDayEmail'
import { sampleScheduleDayBlocks } from './teamSampleEmails'

// The one-day Dispatch schedule email (v2.4177 lift): the sample day's four blocks.
describe('scheduleDayEmail kernel', () => {
  const blocks = sampleScheduleDayBlocks('2026-09-29')

  it('prints Postgres times as clock times', () => {
    expect(formatPgTimeHm('07:00:00')).toBe('7:00 AM')
    expect(formatPgTimeHm('13:30:00.5')).toBe('1:30 PM')
    expect(formatPgTimeHm('bad')).toBe('bad')
  })

  it('the subject carries the date and the calendar zone', () => {
    expect(buildScheduleEmail({ workDateYmd: '2026-09-29', blocks }).subject).toBe('Dispatch schedule — 2026-09-29 (America/Chicago)')
  })

  it('an empty day says so in both bodies', () => {
    const e = buildScheduleEmail({ workDateYmd: '2026-09-29', blocks: [] })
    expect(e.text).toBe('No scheduled dispatch blocks for 2026-09-29 (in your visibility).\n')
    expect(e.html).toContain('No scheduled dispatch blocks for <strong>2026-09-29</strong>')
  })

  it('the HTML has a row per block with the window, the person, the job, the address and the note', () => {
    const { html } = buildScheduleEmail({ workDateYmd: '2026-09-29', blocks })
    expect(html.match(/<tr>/g)?.length).toBe(4)
    expect(html).toContain('7:00 AM–12:00 PM')
    expect(html).toContain('Ana Lead')
    expect(html).toContain('1057 · Hunter Homes — gas line')
    expect(html).toContain('77 Hunter Loop<br/>Kyle, TX 78640')
    expect(html).toContain('Meet the GC super at the gate')
  })

  it('the text lists each block on its own lines', () => {
    const { text } = buildScheduleEmail({ workDateYmd: '2026-09-29', blocks })
    expect(text.startsWith('Dispatch schedule for 2026-09-29 (America/Chicago)\n\n')).toBe(true)
    expect(text).toContain('8:30 AM–11:00 AM  Kim Tech  1054 · Water heater replacement')
    expect(text).toContain('  Note: Customer home after 8:30')
  })
})
