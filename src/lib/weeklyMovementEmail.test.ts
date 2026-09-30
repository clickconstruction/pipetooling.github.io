import { describe, expect, it } from 'vitest'
import { renderWeeklyMovementHtml, renderWeeklyMovementText, weekLabelFromMonday, weeklyMovementSubject } from '../../supabase/functions/_shared/weeklyMovementEmail'
import { sampleWeeklyMovementPayload } from './teamSampleEmails'

const MONDAY = '2026-09-28'
const p = sampleWeeklyMovementPayload(MONDAY)
const week = weekLabelFromMonday(MONDAY)

describe('weeklyMovementEmail (the report’s renderer, lifted v2.4172)', () => {
  it('the subject names the week and the company', () => {
    expect(weeklyMovementSubject(week)).toBe('Weekly movement — Sep 28 – Oct 4 — Click Plumbing and Electrical')
    expect(p.move_count).toBe(6)
    expect(p.job_count).toBe(5)
  })
  it('text: one section per stage in order, then the send-backs with their from → to', () => {
    const t = renderWeeklyMovementText(p, week)
    expect(t.split('\n')[1]).toBe('6 moves · 5 jobs')
    expect(t).toContain('Moved to Billed · 2 jobs · $90,380.00')
    expect(t).toContain('- 1041 · Cedar Bend Apartments — rough-in — Thu — Malachi Sample — $86,000.00')
    expect(t).toContain('Sent back · 1\n- 1039 · Structura — pretest — Fri · Ready to bill → Working — Wendi Douglas')
    expect(t.indexOf('Moved to Working')).toBeLessThan(t.indexOf('Moved to Billed'))
  })
  it('html has the stage sections, the send-back arrow, the sender; an empty week says so', () => {
    const html = renderWeeklyMovementHtml(p, week, 'Wendi')
    expect(html).toContain('Moved to Ready to bill')
    expect(html).toContain('Ready to bill → Working')
    expect(html).toContain('Sent by Wendi')
    expect(renderWeeklyMovementHtml({ ...p, sections: [], send_backs: [], move_count: 0, job_count: 0 }, week)).toContain('No stage moves this week.')
  })
})
