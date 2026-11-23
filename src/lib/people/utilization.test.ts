import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  answerInForce,
  buildUtilizationBoard,
  hoursOfWords,
  parseHoursPerWeek,
  payWeeksEndingAt,
  recordedSessionHours,
  utilizationBand,
  UTILIZATION_ASSUMED_HOURS,
  type AvailableHoursAnswer,
  type UtilizationPerson,
  type UtilizationSession,
} from './utilization'

// 2026-11-08 is a Sunday: the current pay week is Nov 8–14, the last full one Nov 1–7.
const TODAY = '2026-11-08'
const NOW = new Date('2026-11-08T15:00:00-06:00').getTime()

const isiah: UtilizationPerson = { id: 'u-isiah', name: 'Isiah Reyes', role: 'helpers', isSalary: false, recordsHoursButSalary: false }
const grace: UtilizationPerson = { id: 'u-grace', name: 'Grace Lee', role: 'assistant', isSalary: true, recordsHoursButSalary: false }
const malachi: UtilizationPerson = { id: 'u-malachi', name: 'Malachi Whites', role: 'master_technician', isSalary: false, recordsHoursButSalary: false }
const abraham: UtilizationPerson = { id: 'u-abraham', name: 'Abraham Cole', role: 'superintendent', isSalary: true, recordsHoursButSalary: true }
const wendi: UtilizationPerson = { id: 'u-wendi', name: 'Wendi Park', role: 'estimator', isSalary: false, recordsHoursButSalary: false }

function session(user: string, ymd: string, hours: number, extra: Partial<UtilizationSession> = {}): UtilizationSession {
  const start = new Date(`${ymd}T07:00:00-06:00`)
  const end = new Date(start.getTime() + hours * 3_600_000)
  return { user_id: user, work_date: ymd, clocked_in_at: start.toISOString(), clocked_out_at: end.toISOString(), approved_at: '2026-01-01T00:00:00Z', rejected_at: null, revoked_at: null, origin: 'user_punch', ...extra }
}

/** `hoursByWeekday` is Mon..Fri for the week starting on the Sunday `weekStart`. */
function week(user: string, weekStart: string, hoursByWeekday: number[]): UtilizationSession[] {
  return hoursByWeekday.map((h, i) => {
    const d = new Date(`${weekStart}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i + 1)
    return session(user, d.toISOString().slice(0, 10), h)
  })
}

describe('payWeeksEndingAt', () => {
  it('gives eight Sunday–Saturday weeks ending with the one holding today', () => {
    const weeks = payWeeksEndingAt(TODAY)
    expect(weeks).toHaveLength(8)
    expect(weeks[7]).toEqual({ start: '2026-11-08', end: '2026-11-14' })
    expect(weeks[6]).toEqual({ start: '2026-11-01', end: '2026-11-07' })
    expect(weeks[0]).toEqual({ start: '2026-09-20', end: '2026-09-26' })
  })
})

describe('answerInForce', () => {
  const answers: AvailableHoursAnswer[] = [
    { user_id: 'u', hours_per_week: 40, effective_from: '2026-09-01', set_by: 'u', set_at: '2026-09-01T10:00:00Z' },
    { user_id: 'u', hours_per_week: 30, effective_from: '2026-10-25', set_by: 'office', set_at: '2026-10-24T10:00:00Z' },
  ]
  it('takes the newest answer on or before the day, and the first answer for the days before any', () => {
    expect(answerInForce(answers, '2026-10-24')?.hours_per_week).toBe(40)
    expect(answerInForce(answers, '2026-10-25')?.hours_per_week).toBe(30)
    expect(answerInForce(answers, '2026-08-01')?.hours_per_week).toBe(40)
    expect(answerInForce([], '2026-08-01')).toBeNull()
  })
})

describe('parseHoursPerWeek', () => {
  it('accepts 0 to 80 in halves and refuses the rest', () => {
    expect(parseHoursPerWeek('40')).toBe(40)
    expect(parseHoursPerWeek(' 32.5 ')).toBe(32.5)
    expect(parseHoursPerWeek('32.3')).toBe(32.5)
    expect(parseHoursPerWeek('81')).toBeNull()
    expect(parseHoursPerWeek('-1')).toBeNull()
    expect(parseHoursPerWeek('forty')).toBeNull()
  })
})

describe('recordedSessionHours', () => {
  it('counts a closed session whole, the one open today to now, and an older open one as nothing', () => {
    expect(recordedSessionHours(session('u', '2026-11-02', 8), TODAY, NOW)).toBe(8)
    const openToday = session('u', TODAY, 0, { clocked_out_at: null, approved_at: null })
    const openTodayAt7 = { ...openToday, clocked_in_at: new Date('2026-11-08T07:00:00-06:00').toISOString() }
    expect(recordedSessionHours(openTodayAt7, TODAY, NOW)).toBe(8)
    expect(recordedSessionHours({ ...openTodayAt7, work_date: '2026-11-05' }, TODAY, NOW)).toBe(0)
    expect(recordedSessionHours(session('u', '2026-11-02', 8, { rejected_at: '2026-11-03T00:00:00Z' }), TODAY, NOW)).toBe(0)
  })
})

describe('utilizationBand', () => {
  it('reads over above 100, full from 85, steady from 60, light below, nothing at zero', () => {
    expect(utilizationBand(110, 44)).toBe('over')
    expect(utilizationBand(100, 40)).toBe('full')
    expect(utilizationBand(85, 34)).toBe('full')
    expect(utilizationBand(70, 28)).toBe('ok')
    expect(utilizationBand(40, 16)).toBe('light')
    expect(utilizationBand(0, 0)).toBe('none')
    expect(utilizationBand(null, 0)).toBe('none')
  })
})

describe('buildUtilizationBoard', () => {
  it('assumes 40 for a person with no answer and says so', () => {
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [isiah], sessions: week('u-isiah', '2026-11-01', [8, 8, 8, 8, 8]), answers: [] })
    const row = board.people[0]!
    expect(row.canWork).toEqual({ hours: UTILIZATION_ASSUMED_HOURS, source: 'assumed', setAt: null, setBy: null, days: null })
    expect(row.lastFullWeek?.workedHours).toBe(40)
    expect(row.lastFullWeek?.pct).toBe(100)
    expect(row.lastFullWeek?.band).toBe('full')
    expect(board.counts.unanswered).toBe(1)
    expect(board.lines.some((l) => l.includes('not said their hours'))).toBe(true)
  })

  it('reads a person against their own answer, counts long days, and flags three weeks over', () => {
    const answers: AvailableHoursAnswer[] = [{ user_id: 'u-isiah', hours_per_week: 32, effective_from: '2026-09-01', set_by: 'u-isiah', set_at: '2026-09-01T10:00:00Z' }]
    const sessions = [
      ...week('u-isiah', '2026-10-18', [9, 9, 9, 9, 0]), // 36 of 32 → over
      ...week('u-isiah', '2026-10-25', [10, 10, 10, 6, 0]), // 36 of 32 → over, 3 long days
      ...week('u-isiah', '2026-11-01', [8, 8, 8, 8, 4]), // 36 of 32 → over
    ]
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [isiah], sessions, answers })
    const row = board.people[0]!
    expect(row.canWork.hours).toBe(32)
    expect(row.canWork.source).toBe('answered')
    expect(row.lastFullWeek?.pct).toBe(113)
    expect(row.overStreak).toBe(3)
    expect(row.verdict).toBe('add')
    expect(row.longDays).toBe(7)
    expect(row.weeks[5]!.longestDayHours).toBe(10)
    expect(board.counts.over).toBe(1)
    expect(board.lines).toContain('Isiah ran over their hours three weeks running. That is the sign to add people.')
    expect(board.lines[0]).toBe('The field crew worked 113 percent of its hours last week.')
  })

  it('takes recorded days off out of the week and marks the current week partial', () => {
    const answers: AvailableHoursAnswer[] = [{ user_id: 'u-isiah', hours_per_week: 40, effective_from: '2026-09-01', set_by: 'u-isiah', set_at: '2026-09-01T10:00:00Z' }]
    const board = buildUtilizationBoard({
      todayYmd: TODAY,
      nowMs: NOW,
      people: [isiah],
      sessions: week('u-isiah', '2026-11-01', [8, 8, 8, 0, 0]),
      answers,
      timeOff: [{ user_id: 'u-isiah', startYmd: '2026-11-05', endYmd: '2026-11-06' }],
    })
    const last = board.people[0]!.lastFullWeek!
    expect(last.hoursOff).toBe(16)
    expect(last.availableHours).toBe(24)
    expect(last.pct).toBe(100)
    const current = board.people[0]!.weeks[7]!
    expect(current.partial).toBe(true)
    expect(current.workedHours).toBe(0)
  })

  it('keeps a salaried person on the schedule and out of the counts', () => {
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [grace, isiah], sessions: [...week('u-grace', '2026-11-01', [8, 8, 8, 8, 8]).map((s) => ({ ...s, origin: 'salary_schedule' })), ...week('u-isiah', '2026-11-01', [12, 12, 12, 12, 0])], answers: [] })
    const g = board.people.find((p) => p.person.id === 'u-grace')!
    expect(g.kind).toBe('salaried')
    expect(g.canWork.source).toBe('schedule')
    expect(g.verdict).toBe('salaried')
    expect(board.counts.salaried).toBe(1)
    expect(board.counts.over).toBe(1)
    expect(board.team[6]!.availableHours).toBe(40)
    expect(board.team[6]!.workedHours).toBe(48)
    expect(board.team[6]!.pct).toBe(120)
  })

  it('reads a salaried person as hourly only when they may record hours and a punch of theirs is in the window', () => {
    const scheduleOnly = week('u-abraham', '2026-11-01', [8, 8, 8, 8, 8]).map((s) => ({ ...s, origin: 'salary_schedule' }))
    const a1 = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [abraham], sessions: scheduleOnly, answers: [] }).people[0]!
    expect(a1.kind).toBe('salaried')
    expect(a1.canWork.source).toBe('schedule')
    const withPunch = [...scheduleOnly.slice(0, 4), session('u-abraham', '2026-11-06', 10)]
    const a2 = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [abraham], sessions: withPunch, answers: [] }).people[0]!
    expect(a2.kind).toBe('hourly')
    expect(a2.lastFullWeek?.workedHours).toBe(42)
  })

  it('holds a salaried person to their own set week from pay, and to the default week when the row has none', () => {
    const six = [0, 6, 6, 6, 6, 6, 0]
    const sessions = week('u-grace', '2026-11-01', [6, 6, 6, 6, 6]).map((s) => ({ ...s, origin: 'salary_schedule' }))
    const g = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [{ ...grace, salariedWeek: six }], sessions, answers: [] }).people[0]!
    expect(g.kind).toBe('salaried')
    expect(g.canWork).toEqual({ hours: 30, source: 'schedule', setAt: null, setBy: null, days: null, salariedWeek: six })
    expect(g.lastFullWeek).toMatchObject({ canWorkHours: 30, availableHours: 30, workedHours: 30, pct: 100, band: 'full' })
    const d = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [grace], sessions, answers: [] }).people[0]!
    expect(d.canWork).toMatchObject({ hours: 40, source: 'schedule', salariedWeek: [0, 8, 8, 8, 8, 8, 0] })
    expect(d.lastFullWeek?.pct).toBe(75)
  })

  it("takes a day off in a set week at that day's hours, and nothing for a day the week does not pay", () => {
    const shortFriday = [0, 8, 8, 8, 8, 4, 0]
    const sessions = week('u-grace', '2026-11-01', [8, 8, 8, 8, 0]).map((s) => ({ ...s, origin: 'salary_schedule' }))
    const g = buildUtilizationBoard({
      todayYmd: TODAY,
      nowMs: NOW,
      people: [{ ...grace, salariedWeek: shortFriday }],
      sessions,
      answers: [],
      // Friday Nov 6 and Saturday Nov 7.
      timeOff: [{ user_id: 'u-grace', startYmd: '2026-11-06', endYmd: '2026-11-07' }],
    }).people[0]!
    expect(g.lastFullWeek).toMatchObject({ canWorkHours: 36, hoursOff: 4, availableHours: 32, workedHours: 32, pct: 100 })
  })

  it('reads a salaried person who records real hours against their set week until someone draws one, never an assumed 40', () => {
    const six = [0, 6, 6, 6, 6, 6, 0]
    const sessions = week('u-abraham', '2026-11-01', [6, 6, 6, 6, 6])
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [{ ...abraham, salariedWeek: six }], sessions, answers: [] })
    const a = board.people[0]!
    expect(a.kind).toBe('hourly')
    expect(a.canWork).toMatchObject({ hours: 30, source: 'schedule', salariedWeek: six })
    expect(a.lastFullWeek).toMatchObject({ availableHours: 30, pct: 100 })
    expect(board.team[6]!.availableHours).toBe(30)
    expect(board.counts.unanswered).toBe(0)
    expect(board.lines.some((l) => l.includes('not said their hours'))).toBe(false)
    // A drawn answer still wins over the set week.
    const answers: AvailableHoursAnswer[] = [{ user_id: 'u-abraham', hours_per_week: 24, effective_from: '2026-09-01', set_by: 'u-office', set_at: '2026-09-01T10:00:00Z' }]
    const drawn = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [{ ...abraham, salariedWeek: six }], sessions, answers }).people[0]!
    expect(drawn.canWork).toMatchObject({ hours: 24, source: 'answered' })
    expect(drawn.lastFullWeek?.pct).toBe(125)
  })

  it('keeps the office on its own side: the crew line, tiles and verdicts read the field alone', () => {
    const sessions = [
      ...['2026-10-18', '2026-10-25', '2026-11-01'].flatMap((s) => week('u-wendi', s, [10, 10, 10, 10, 10])),
      ...week('u-isiah', '2026-11-01', [8, 8, 8, 8, 0]),
    ]
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [wendi, isiah], sessions, answers: [] })
    expect(board.people.map((p) => p.side)).toEqual(['field', 'office'])
    expect(board.team[6]!.workedHours).toBe(32)
    expect(board.team[6]!.availableHours).toBe(40)
    expect(board.office[6]!.workedHours).toBe(50)
    expect(board.counts.over).toBe(0)
    expect(board.counts.longDays).toBe(0)
    expect(board.lines).toContain('The field crew worked 80 percent of its hours last week.')
    expect(board.lines).toContain('The office clocked 125 percent of its hours last week.')
    expect(board.lines.some((l) => l.includes('sign to add people'))).toBe(false)
  })

  it('leaves out a person with nothing recorded and no answer, sorts the people who need adding first', () => {
    const answers: AvailableHoursAnswer[] = [{ user_id: 'u-isiah', hours_per_week: 20, effective_from: '2026-09-01', set_by: 'u-isiah', set_at: '2026-09-01T10:00:00Z' }]
    const sessions = [...week('u-isiah', '2026-10-18', [8, 8, 8, 0, 0]), ...week('u-isiah', '2026-10-25', [8, 8, 8, 0, 0]), ...week('u-isiah', '2026-11-01', [8, 8, 8, 0, 0]), ...week('u-grace', '2026-11-01', [8, 8, 8, 8, 8])]
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [malachi, grace, isiah], sessions, answers })
    expect(board.people.map((p) => p.person.id)).toEqual(['u-isiah', 'u-grace'])
    expect(board.people[0]!.verdict).toBe('add')
  })

  it('counts a roster week with nothing recorded as light, so a helper left idle reads use them more', () => {
    const sessions = [...week('u-isiah', '2026-10-04', [8, 8, 8, 8, 8]), ...week('u-isiah', '2026-11-01', [3, 0, 0, 0, 0])]
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [isiah], sessions, answers: [] })
    expect(board.people[0]!.lightStreak).toBe(4)
    expect(board.people[0]!.verdict).toBe('use_more')
  })

  it('never tells the office to be used more, since office people clock unevenly', () => {
    const sessions = ['2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01'].flatMap((s) => week('u-wendi', s, [4, 4, 4, 0, 0]))
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [wendi], sessions, answers: [] })
    expect(board.people[0]!.verdict).toBe('steady')
    expect(board.lines.some((l) => l.includes('Use them more'))).toBe(false)
  })

  it('keeps a person who left inside the window on the board, with no verdict to act on', () => {
    const sessions = ['2026-10-11', '2026-10-18', '2026-10-25'].flatMap((s) => week('u-isiah', s, [10, 10, 10, 10, 10]))
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [{ ...isiah, endYmd: '2026-11-03' }], sessions, answers: [] })
    const row = board.people[0]!
    expect(row.verdict).toBe('left')
    expect(row.weeks[5]!.onRoster).toBe(true)
    expect(row.weeks[7]!.onRoster).toBe(false)
    expect(board.counts.unanswered).toBe(0)
    expect(board.lines.some((l) => l.includes('sign to add people'))).toBe(false)
  })

  it('says use them more after four light weeks, counting from the day they started', () => {
    const sessions = ['2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01'].flatMap((s) => week('u-isiah', s, [4, 4, 4, 0, 0]))
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [{ ...isiah, startYmd: '2026-10-11' }], sessions, answers: [] })
    expect(board.people[0]!.lightStreak).toBe(4)
    expect(board.people[0]!.verdict).toBe('use_more')
    expect(board.lines.some((l) => l.startsWith('Isiah worked under 60 percent'))).toBe(true)
  })

  it('writes every line in plain words', () => {
    const sessions = [...week('u-isiah', '2026-10-18', [9, 9, 9, 9, 9]), ...week('u-isiah', '2026-10-25', [9, 9, 9, 9, 9]), ...week('u-isiah', '2026-11-01', [9, 9, 9, 9, 9]), ...week('u-malachi', '2026-11-01', [4, 4, 0, 0, 0])]
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [isiah, malachi, grace], sessions, answers: [] })
    for (const line of board.lines) expect(plainWordsFailures(line), line).toEqual([])
  })
})

describe('a drawn week', () => {
  // Mon–Thu 7a–3:30p, Fri 7a–3p: 42 hours, Friday ends at 3.
  const drawn = [[], [[420, 930]], [[420, 930]], [[420, 930]], [[420, 930]], [[420, 900]], []] as AvailableHoursAnswer['days']
  const answers: AvailableHoursAnswer[] = [{ user_id: 'u-isiah', hours_per_week: 42, days: drawn, effective_from: '2026-09-01', set_by: 'u-isiah', set_at: '2026-09-01T10:00:00Z' }]

  it('reads the hours off the drawing and measures the clock outside it', () => {
    // Friday Nov 6: 7 AM to 6 PM, three hours past the drawn 3 PM.
    const sessions = [...week('u-isiah', '2026-11-01', [8.5, 8.5, 8.5, 8.5, 0]), session('u-isiah', '2026-11-06', 11)]
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [isiah], sessions, answers })
    const row = board.people[0]!
    expect(row.canWork.hours).toBe(42)
    expect(row.canWork.days).toEqual(drawn)
    expect(row.lastFullWeek?.availableHours).toBe(42)
    expect(row.lastFullWeek?.outsideHours).toBe(3)
    expect(row.outsideHours).toBe(3)
    expect(board.counts.outsideHours).toBe(3)
    expect(board.lines).toContain('Isiah worked 3 hours outside the hours they drew last week.')
  })

  it("takes a day off out at that day's drawn length", () => {
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [isiah], sessions: week('u-isiah', '2026-11-01', [8.5, 8.5, 8.5, 8.5, 0]), answers, timeOff: [{ user_id: 'u-isiah', startYmd: '2026-11-06', endYmd: '2026-11-07' }] })
    const last = board.people[0]!.lastFullWeek!
    expect(last.hoursOff).toBe(8)
    expect(last.availableHours).toBe(34)
    expect(last.pct).toBe(100)
  })
})

describe('hoursOfWords', () => {
  it('reads whole hours plainly and halves to one place', () => {
    expect(hoursOfWords(32, 40)).toBe('32 of 40 h')
    expect(hoursOfWords(31.5, 40)).toBe('31.5 of 40 h')
  })
})

describe('working hours on the board', () => {
  // Six to noon on five days, set by the office from the Sunday of Nov 1.
  const sixToNoon = [[], [[360, 720]], [[360, 720]], [[360, 720]], [[360, 720]], [[360, 720]], []] as [number, number][][]
  const set = (over: Partial<AvailableHoursAnswer> = {}): AvailableHoursAnswer => ({ user_id: 'u-isiah', hours_per_week: 30, days: sixToNoon, effective_from: '2026-11-01', set_by: 'office', set_at: '2026-11-02T10:00:00Z', kind: 'set', ...over })
  const own: AvailableHoursAnswer = { user_id: 'u-isiah', hours_per_week: 45, effective_from: '2026-09-20', set_by: 'u-isiah', set_at: '2026-09-20T10:00:00Z' }

  it('win over a person’s own answer, from their Sunday on and not before', () => {
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [isiah], sessions: [...week('u-isiah', '2026-10-25', [9, 9, 9, 9, 9]), ...week('u-isiah', '2026-11-01', [6, 6, 6, 6, 6])], answers: [own, set()] })
    const p = board.people[0]!
    expect(p.canWork).toMatchObject({ hours: 30, source: 'set', setBy: 'office' })
    expect(p.canWork.days).toEqual(sixToNoon)
    const last = p.weeks[6]!
    expect([last.source, last.canWorkHours, last.pct]).toEqual(['set', 30, 100])
    const before = p.weeks[5]!
    expect([before.source, before.canWorkHours, before.pct]).toEqual(['answered', 45, 100])
  })

  it('count the minutes a punch fell outside them', () => {
    // The sessions start at 7:00 and run 6 hours, so the last hour of each day is past noon.
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [isiah], sessions: week('u-isiah', '2026-11-01', [6, 6, 6, 6, 6]), answers: [set()] })
    expect(board.people[0]!.weeks[6]!.outsideHours).toBe(5)
  })

  it('hold a salaried person too, and an answer is never read as working hours', () => {
    const salaried = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [{ ...abraham, salariedWeek: [0, 6, 6, 6, 6, 6, 0] }], sessions: week('u-abraham', '2026-11-01', [6, 6, 6, 6, 6]), answers: [set({ user_id: 'u-abraham' })] })
    expect(salaried.people[0]!.canWork).toMatchObject({ hours: 30, source: 'set' })
    expect(answerInForce([own, set()], TODAY)).toBe(own)
    expect(answerInForce([set()], TODAY)).toBeNull()
  })

  it('fall back to the answer once they are taken off again', () => {
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [isiah], sessions: week('u-isiah', '2026-11-01', [6, 6, 6, 6, 6]), answers: [own, set(), set({ days: null, hours_per_week: 0, effective_from: '2026-11-08', set_at: '2026-11-08T09:00:00Z' })] })
    const p = board.people[0]!
    expect(p.canWork).toMatchObject({ hours: 45, source: 'answered' })
    expect(p.weeks[6]!.source).toBe('set')
    expect(p.weeks[7]!.source).toBe('answered')
  })

  it('add up in quarter hours', () => {
    const short = [[], [[360, 615]], [[360, 720]], [[360, 720]], [[360, 720]], [[360, 720]], []] as [number, number][][]
    const board = buildUtilizationBoard({ todayYmd: TODAY, nowMs: NOW, people: [isiah], sessions: week('u-isiah', '2026-11-01', [4, 6, 6, 6, 6]), answers: [set({ days: short, hours_per_week: 28.25 })] })
    expect(board.people[0]!.canWork.hours).toBe(28.25)
  })
})
