import { describe, expect, it } from 'vitest'
import { buildCrewDayEmailView, crewDayEmailSubject, crewDayEmailText, renderCrewDayEmail } from '../../supabase/functions/_shared/crewDayEmail'
import { sampleCrewDayPayload } from './teamSampleEmails'

const DAY = '2026-09-29'
const view = buildCrewDayEmailView(sampleCrewDayPayload(DAY), new Date(`${DAY}T16:30:00-05:00`).getTime())

describe('crewDayEmail (the digest’s renderer, lifted v2.4163)', () => {
  it('the view counts the day: six people on three jobs, three reports, the open clock flagged', () => {
    expect(view.summary.people).toBe(6)
    expect(view.summary.jobs).toBe(3)
    expect(view.summary.reports).toBe(3)
    expect(view.summary.flags).toBeGreaterThanOrEqual(1)
    expect(view.subsToday).toEqual([{ personName: "Sam's Plumbing LLC", label: 'Rough-in · 1041 · Cedar Bend Apartments', span: 'Sep 29' }])
  })
  it('subject and text read the day', () => {
    expect(crewDayEmailSubject(view)).toBe('Crew Day — Tue, Sep 29 · 6 people · 40.4 h · 3 reports · 3 flags')
    const t = crewDayEmailText(view)
    expect(t).toContain('Subs on site today')
    expect(t).toContain('(on the clock)')
    expect(t).toContain('water heater in, tested, customer paid at the door')
  })
  it('html carries the jobs, the reports and the sender', () => {
    const html = renderCrewDayEmail(view, 'Wendi')
    expect(html).toContain('Cedar Bend Apartments')
    expect(html).toContain('Held 15 min at 80 psi')
    expect(html).toContain('no report left today')
    expect(html).toContain('Wendi')
  })
})
