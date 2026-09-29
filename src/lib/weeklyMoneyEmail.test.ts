import { describe, expect, it } from 'vitest'
import { renderWeeklyMoneyHtml, renderWeeklyMoneyText, weekLabelFromMonday, weeklyMoneySubject } from '../../supabase/functions/_shared/weeklyMoneyEmail'
import { mondayOf, sampleWeeklyMoneyPayload } from './teamSampleEmails'

const MONDAY = '2026-09-28'
const p = sampleWeeklyMoneyPayload(MONDAY)
const week = weekLabelFromMonday(MONDAY)

describe('weeklyMoneyEmail (the report’s renderer, lifted v2.4170)', () => {
  it('the week label crosses the month and the subject carries it', () => {
    expect(week).toBe('Sep 28 – Oct 4')
    expect(weekLabelFromMonday('2026-09-14')).toBe('Sep 14 – 20')
    expect(weeklyMoneySubject(week)).toBe('Weekly money movement — Sep 28 – Oct 4')
    expect(mondayOf('2026-09-29')).toBe('2026-09-28')
    expect(mondayOf('2026-09-27')).toBe('2026-09-21')
  })
  it('text: the five totals, made money first, a job with no report says so, the office line last', () => {
    const t = renderWeeklyMoneyText(p, week)
    const lines = t.split('\n')
    expect(lines[1]).toBe('Out $18,955.00 | In $30,380.00 | Net cash +$11,425.00 | Value created $18,225.00 | Earned net −$730.00')
    expect(t).toContain('Made money this week:\n  1041 · Cedar Bend Apartments — rough-in — 40% → 55%; out $9,600.00; in $26,000.00; net +$3,300.00')
    expect(t).toContain('  1039 · Structura — pretest — no report; out $380.00; in —; net ?')
    expect(lines[lines.length - 1]).toBe('Not on jobs: office+bid labor $2,015.00; office job charges $210.00')
  })
  it('html has both tables, the sign on every net, and who scheduled it', () => {
    const html = renderWeeklyMoneyHtml(p, week, 'Wendi')
    expect(html).toContain('Made money this week')
    expect(html).toContain('Lost money this week')
    expect(html).toContain('−$3,955.00')
    expect(html).toContain('scheduled by Wendi')
    expect(renderWeeklyMoneyHtml({ ...p, jobs: [] }, week)).toContain('No money movement this week.')
  })
})
