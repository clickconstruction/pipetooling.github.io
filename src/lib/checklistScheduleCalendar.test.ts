import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from './plainWords'
import { checklistScheduleCalendar, type ScheduleCalendarInput } from './checklistScheduleCalendar'

/** Fri, Oct 30 2026: the mock-up's day. Nov 1 is a Sunday. */
const TODAY = '2026-10-30'

const base: ScheduleCalendarInput = {
  when: 'repeat',
  repeatMode: 'weekly',
  startDate: '2026-11-03',
  todayStr: TODAY,
  daysOfWeek: [1, 3],
  daysAfter: 7,
  endDate: '2026-12-18',
}

const cells = (input: ScheduleCalendarInput) => checklistScheduleCalendar(input)!.weeks.flatMap((w) => w.days)
const cell = (input: ScheduleCalendarInput, ymd: string) => cells(input).find((d) => d.ymd === ymd)!
const landing = (input: ScheduleCalendarInput) => cells(input).filter((d) => d.lands).map((d) => d.ymd)

describe('the schedule calendar (punch list #217, office-13)', () => {
  it('repeats on weekdays: this week and the next three, every Mon and Wed from the start filled, today ringed', () => {
    const cal = checklistScheduleCalendar(base)!
    expect(cal.weeks.map((w) => w.label)).toEqual(['Oct 25', 'Nov 1', 'Nov 8', 'Nov 15'])
    expect(cal.weeks.every((w) => w.days.length === 7)).toBe(true)
    expect(cal.weeks[0]!.days[0]!.ymd).toBe('2026-10-25')
    expect(landing(base)).toEqual(['2026-11-04', '2026-11-09', '2026-11-11', '2026-11-16', '2026-11-18'])
    expect(cell(base, TODAY).today).toBe(true)
    expect(cells(base).filter((d) => d.today)).toHaveLength(1)
    expect(cell(base, '2026-11-04').words).toBe('Wednesday, Nov 4. The task lands.')
    expect(cell(base, TODAY).words).toBe('Friday, Oct 30. Today.')
  })

  it('a start off the picked days is marked amber and said, with the first day that lands', () => {
    const start = cell(base, '2026-11-03')
    expect(start.start).toBe(true)
    expect(start.startOff).toBe(true)
    expect(start.lands).toBe(false)
    expect(start.dim).toBe(false)
    expect(start.words).toBe('Tuesday, Nov 3. Starts here, which is not a picked day.')
    expect(checklistScheduleCalendar(base)!.notes).toEqual([
      { tone: 'warn', words: 'Starts Tue, Nov 3. The first Mon or Wed is Wed, Nov 4.' },
      { tone: 'plain', words: 'Ends Fri, Dec 18. 13 days in all.' },
    ])
  })

  it('a start on a picked day lands, with no warning', () => {
    const input = { ...base, startDate: '2026-11-02' }
    const start = cell(input, '2026-11-02')
    expect(start.start).toBe(true)
    expect(start.startOff).toBe(false)
    expect(start.lands).toBe(true)
    expect(start.words).toBe('Monday, Nov 2. Starts here. The task lands.')
    expect(checklistScheduleCalendar(input)!.notes).toEqual([{ tone: 'plain', words: 'Ends Fri, Dec 18. 14 days in all.' }])
  })

  it('the days before the start are dim, and so are the days past the end', () => {
    expect(cells(base).filter((d) => d.ymd < '2026-11-03').every((d) => d.dim)).toBe(true)
    expect(cells(base).filter((d) => d.ymd >= '2026-11-03').every((d) => !d.dim)).toBe(true)
    const input = { ...base, endDate: '2026-11-11' }
    expect(landing(input)).toEqual(['2026-11-04', '2026-11-09', '2026-11-11'])
    const end = cell(input, '2026-11-11')
    expect(end.end).toBe(true)
    expect(end.lands).toBe(true)
    expect(end.words).toBe('Wednesday, Nov 11. The task lands. The last day.')
    expect(cell(input, '2026-11-16').dim).toBe(true)
    expect(checklistScheduleCalendar(input)!.notes[1]).toEqual({ tone: 'plain', words: 'Ends Wed, Nov 11. 3 days in all.' })
    const friday = { ...input, endDate: '2026-11-13' }
    expect(cell(friday, '2026-11-13').words).toBe('Friday, Nov 13. Ends here.')
    expect(checklistScheduleCalendar({ ...input, endDate: '2026-11-01' })!.notes).toEqual([{ tone: 'plain', words: 'Ends Sun, Nov 1. No day lands.' }])
  })

  it('no weekday picked: nothing lands and nothing warns', () => {
    const input = { ...base, daysOfWeek: [] }
    expect(landing(input)).toEqual([])
    expect(checklistScheduleCalendar(input)!.notes).toEqual([{ tone: 'plain', words: 'Ends Fri, Dec 18. No day lands.' }])
  })

  it('days after it is done: the first day lands and the chain after it is dashed, each a guess', () => {
    const input: ScheduleCalendarInput = { ...base, repeatMode: 'after_done', startDate: TODAY, daysAfter: 7, endDate: null }
    expect(landing(input)).toEqual([TODAY])
    const first = cell(input, TODAY)
    expect(first.start).toBe(true)
    expect(first.today).toBe(true)
    expect(first.words).toBe('Friday, Oct 30. Today. Starts here. The task lands.')
    expect(cells(input).filter((d) => d.maybe).map((d) => d.ymd)).toEqual(['2026-11-06', '2026-11-13', '2026-11-20'])
    expect(cell(input, '2026-11-06').words).toBe('Friday, Nov 6. Lands here if the one 7 days before is done on its day.')
    expect(cell(input, '2026-11-06').dim).toBe(false)
    expect(checklistScheduleCalendar(input)!.notes).toEqual([{ tone: 'plain', words: 'Then 7 days after each one is done.' }])
    expect(checklistScheduleCalendar({ ...input, daysAfter: 1 })!.notes).toEqual([{ tone: 'plain', words: 'Then 1 day after each one is done.' }])
    expect(cells({ ...input, daysAfter: 0 }).filter((d) => d.maybe)).toHaveLength(22)
  })

  it('a one-off: its day, the due day, and the bar between them', () => {
    const input: ScheduleCalendarInput = { ...base, when: 'date', startDate: '2026-11-02', dueDate: '2026-11-06' }
    expect(landing(input)).toEqual(['2026-11-02'])
    expect(cell(input, '2026-11-02').start).toBe(true)
    expect(cells(input).filter((d) => d.between).map((d) => d.ymd)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05'])
    expect(cell(input, '2026-11-04').words).toBe('Wednesday, Nov 4. On the list.')
    const due = cell(input, '2026-11-06')
    expect(due.due).toBe(true)
    expect(due.words).toBe('Friday, Nov 6. Due.')
    expect(cell(input, '2026-11-07').dim).toBe(true)
    expect(checklistScheduleCalendar(input)!.notes).toEqual([{ tone: 'plain', words: 'Due Fri, Nov 6. 5 days to do it.' }])
    // A due day at or before the day is no due day: the sentence reads it as a plain one-off.
    expect(checklistScheduleCalendar({ ...input, dueDate: '2026-11-02' })!.notes).toEqual([])
    expect(cells({ ...input, dueDate: '2026-11-02' }).filter((d) => d.between)).toHaveLength(0)
  })

  it('a one-off on today draws only with a due day, from today', () => {
    expect(checklistScheduleCalendar({ ...base, when: 'today', dueDate: null })).toBeNull()
    const input: ScheduleCalendarInput = { ...base, when: 'today', startDate: '2099-01-01', dueDate: '2026-11-02' }
    expect(landing(input)).toEqual([TODAY])
    expect(checklistScheduleCalendar(input)!.notes).toEqual([{ tone: 'plain', words: 'Due Mon, Nov 2. 4 days to do it.' }])
  })

  it('a start past next week opens the frame on its own week, and today is off it', () => {
    const input = { ...base, startDate: '2026-12-01' }
    const cal = checklistScheduleCalendar(input)!
    expect(cal.weeks.map((w) => w.label)).toEqual(['Nov 29', 'Dec 6', 'Dec 13', 'Dec 20'])
    expect(cells(input).some((d) => d.today)).toBe(false)
    expect(landing(input)).toEqual(['2026-12-02', '2026-12-07', '2026-12-09', '2026-12-14', '2026-12-16'])
    // A start in the past keeps this week first.
    expect(checklistScheduleCalendar({ ...base, startDate: '2026-09-01' })!.weeks[0]!.label).toBe('Oct 25')
    // Next week is still in the frame of this week.
    expect(checklistScheduleCalendar({ ...base, startDate: '2026-11-07' })!.weeks[0]!.label).toBe('Oct 25')
  })

  it('draws nothing for a start or a today the form cannot read', () => {
    expect(checklistScheduleCalendar({ ...base, startDate: '' })).toBeNull()
    expect(checklistScheduleCalendar({ ...base, startDate: '2026-13-40' })).toBeNull()
    expect(checklistScheduleCalendar({ ...base, todayStr: 'soon' })).toBeNull()
  })

  it('the words, plain', () => {
    const inputs: ScheduleCalendarInput[] = [
      base,
      { ...base, repeatMode: 'after_done', startDate: TODAY },
      { ...base, when: 'date', startDate: '2026-11-02', dueDate: '2026-11-06' },
    ]
    for (const input of inputs) {
      const cal = checklistScheduleCalendar(input)!
      for (const note of cal.notes) expect(plainWordsFailures(note.words)).toEqual([])
      for (const day of cal.weeks.flatMap((w) => w.days)) expect(plainWordsFailures(day.words)).toEqual([])
    }
  })
})
