import { describe, expect, it } from 'vitest'
import { LIEN_REMINDER_SCHEDULE, LIEN_SCHEDULE_TAIL, lienScheduleMarks, lienSchedulePct, lienScheduleSourceLines, lienScheduleWords } from './lienReminderSchedule'

describe('lienReminderSchedule — our schedule after a notice (v2.6574)', () => {
  it('reads its days from the clocks: packet, courtesy from 7, letter two 10 and overdue 14, then the affidavit’s tail', () => {
    expect(LIEN_REMINDER_SCHEDULE.map((p) => [p.day, p.source])).toEqual([[0, 'law'], [7, 'owner'], [10, 'counsel'], [14, 'counsel']])
    expect(LIEN_SCHEDULE_TAIL.map((t) => t.source)).toEqual(['ours', 'law'])
    expect(lienScheduleWords()).toBe('day 0 the packet goes · day 7 a courtesy notice may go · day 10 letter two is due · day 14 letter two is overdue · 7 days before the affidavit’s day, file it instead of reminding · the affidavit’s day, § 53.052.')
  })
  it('places a day on a four-week axis and gathers the notices’ days into marks, the ones past the axis at its end', () => {
    expect(lienSchedulePct(0)).toBe(0)
    expect(lienSchedulePct(7)).toBe(25)
    expect(lienSchedulePct(14)).toBe(50)
    expect(lienSchedulePct(40)).toBe(100)
    expect(lienScheduleMarks([21, 21, 29, null, 21])).toEqual([
      { day: 21, pct: 75, past: false, n: 3 },
      { day: 29, pct: 100, past: true, n: 1 },
    ])
    expect(lienScheduleMarks([])).toEqual([])
  })
  it('names whose rule each day is, one line each', () => {
    const lines = lienScheduleSourceLines()
    expect(lines).toHaveLength(4)
    expect(lines[0]).toContain('owner’s choice')
    expect(lines[1]).toBe('Day 10 and day 14 are counsel’s rule for the second letter.')
    expect(lines[2]).toContain('our margin')
    expect(lines[3]).toContain('§ 53.052')
  })
})
