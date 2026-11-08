/**
 * Utilization (People → People → Utilization, and My Time's "Your hours"): what each person said
 * they can work in a week against what the clock recorded, week by week, so the office can see
 * who is over their hours, who is under them, and when the crew itself is full.
 *
 * The one rule: a person's hours are what they (or the office) answered — `person_available_hours`,
 * the newest answer in force on the week's Sunday. With no answer the board assumes the company
 * day, 8 hours × 5 weekdays, and says so. A day over 8 hours is a long day. The week is the pay
 * week, Sunday to Saturday (`payWeekAnchor`). Worked time is recorded time, as costing reads it:
 * every closed session not rejected or revoked, approved or waiting, plus the session open right
 * now on today. Recorded days off (`user_time_off`) come off the week's hours.
 *
 * Two sides: the **field** (leaders, helpers, subs, superintendents) is the crew the hiring question
 * is about, so the team line, the tiles and the add / use-more verdicts read the field; the
 * **office** (assistants, controllers, estimators, primaries, devs) lists under it with a line of
 * its own, since office people clock unevenly and should not sway a crew decision.
 *
 * Salaried people's sessions are made by their schedule, so their percent would always read full:
 * the board keeps them on the schedule's hours and out of the counts unless the pay desk lets them
 * record real hours (`record_hours_but_salary`) AND the window holds a punch of theirs.
 *
 * Pure. The components draw it; nothing here reads a table.
 */
import { addDaysYmd } from '../emailSchedule/emailScheduleWeek'
import { payWeekContaining, type PayWeek } from '../payWeekAnchor'
import { sessionHours } from './approvalsQueue'
import { dayHours, dowOfYmd, outsideMinutes, weekHours, type WeekDays } from './weekAvailability'

export const UTILIZATION_WEEKS = 8
/** The company day: a day past it is a long day. */
export const UTILIZATION_LONG_DAY_HOURS = 8
export const UTILIZATION_WEEKDAYS = 5
/** The hours the board assumes for a person who has not answered yet. */
export const UTILIZATION_ASSUMED_HOURS = UTILIZATION_LONG_DAY_HOURS * UTILIZATION_WEEKDAYS
/** Full weeks in a row over their hours before the board says to add people. */
export const UTILIZATION_OVER_STREAK = 3
/** Full weeks in a row under the light line before the board says to use people more. */
export const UTILIZATION_LIGHT_STREAK = 4
export const UTILIZATION_FULL_PCT = 85
export const UTILIZATION_LIGHT_PCT = 60
export const UTILIZATION_MAX_HOURS_PER_WEEK = 80
/** The sync's own sessions; anything else is a punch the person (or a dev's import) made. */
export const SALARY_SCHEDULE_ORIGIN = 'salary_schedule'

export type UtilizationSession = {
  user_id: string
  /** YYYY-MM-DD on the company calendar. */
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  approved_at: string | null
  rejected_at: string | null
  revoked_at: string | null
  /** `user_punch`, `salary_schedule` or `imported`. */
  origin: string
}

export type UtilizationPerson = {
  /** `users.id`, the key sessions and answers carry. */
  id: string
  name: string
  role: string
  isSalary: boolean
  recordsHoursButSalary: boolean
  startYmd?: string | null
  endYmd?: string | null
}

/** One answer: the hours a person can work in a week, from a day on. Append-only; the newest in force wins. */
export type AvailableHoursAnswer = {
  user_id: string
  hours_per_week: number
  /** The week as drawn, seven days Sunday first, each a list of [start, end] minutes; null when only a number was given. */
  days?: WeekDays | null
  /** YYYY-MM-DD; the answer holds from this Sunday's week on. */
  effective_from: string
  set_by: string | null
  set_at: string
  note?: string | null
}

export type UtilizationTimeOff = { user_id: string; startYmd: string; endYmd: string }

export type AvailabilitySource = 'answered' | 'assumed' | 'schedule'
export type UtilizationBand = 'over' | 'full' | 'ok' | 'light' | 'none'
export type UtilizationSide = 'field' | 'office'

export type PersonWeek = {
  week: PayWeek
  /** The week is still running (today is inside it). */
  partial: boolean
  /** The person was on the roster for some of the week. */
  onRoster: boolean
  workedHours: number
  pendingHours: number
  openNow: boolean
  daysWorked: number
  longDays: number
  longestDayHours: number
  canWorkHours: number
  source: AvailabilitySource
  hoursOff: number
  availableHours: number
  pct: number | null
  band: UtilizationBand
  /** Hours the clock ran outside the drawn week; null when the week was not drawn. */
  outsideHours: number | null
}

export type CanWork = { hours: number; source: AvailabilitySource; setAt: string | null; setBy: string | null; days: WeekDays | null }

export type PersonVerdict = 'add' | 'use_more' | 'steady' | 'salaried' | 'quiet' | 'left'

export type PersonUtilization = {
  person: UtilizationPerson
  side: UtilizationSide
  kind: 'hourly' | 'salaried'
  canWork: CanWork
  /** Oldest first, `UTILIZATION_WEEKS` of them, the current week last. */
  weeks: PersonWeek[]
  lastFullWeek: PersonWeek | null
  /** Over the full weeks the person was on the roster for, worked or not. */
  avgPct: number | null
  overStreak: number
  lightStreak: number
  longDays: number
  /** Over the window; null when no week was drawn. */
  outsideHours: number | null
  verdict: PersonVerdict
  answers: AvailableHoursAnswer[]
}

export type TeamWeek = {
  week: PayWeek
  partial: boolean
  workedHours: number
  availableHours: number
  pct: number | null
  peopleOver: number
  peopleLight: number
  longDays: number
}

export type UtilizationCounts = {
  /** Everyone on the board. */
  people: number
  /** Field, hourly: over or light last week; long days in the window. */
  over: number
  light: number
  longDays: number
  /** Hourly people on either side with no answer yet. */
  unanswered: number
  salaried: number
  /** Field, hourly: hours worked outside the drawn week in the window, over the people who drew one. */
  outsideHours: number
}

export type UtilizationBoard = {
  weeks: PayWeek[]
  people: PersonUtilization[]
  /** The field crew by week (hourly people only). */
  team: TeamWeek[]
  /** The office by week (hourly people only). */
  office: TeamWeek[]
  counts: UtilizationCounts
  lines: string[]
}

export type UtilizationInput = {
  todayYmd: string
  /** Now as epoch ms, for the session open on today. */
  nowMs: number
  people: readonly UtilizationPerson[]
  sessions: readonly UtilizationSession[]
  answers: readonly AvailableHoursAnswer[]
  timeOff?: readonly UtilizationTimeOff[]
  /** A salaried person's weekly hours from their workday template, by user id (8 h × 5 when missing). */
  scheduleHoursByUser?: ReadonlyMap<string, number>
  weeks?: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Which side a role swings for: tools or desks. */
export function utilizationSide(role: string): UtilizationSide {
  switch (role) {
    case 'master_technician':
    case 'helpers':
    case 'helper':
    case 'subcontractor':
    case 'sub':
    case 'superintendent':
      return 'field'
    default:
      return 'office'
  }
}

/** The `n` pay weeks ending with the one holding `todayYmd`, oldest first. */
export function payWeeksEndingAt(todayYmd: string, n: number = UTILIZATION_WEEKS): PayWeek[] {
  const current = payWeekContaining(todayYmd)
  const weeks: PayWeek[] = []
  for (let i = n - 1; i >= 0; i--) {
    const start = addDaysYmd(current.start, -7 * i)
    weeks.push({ start, end: addDaysYmd(start, 6) })
  }
  return weeks
}

function isWeekday(ymd: string): boolean {
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay()
  return dow >= 1 && dow <= 5
}

/**
 * The answer in force on a day: the newest with `effective_from` on or before it. Before the first
 * answer there was no other, so the first one holds for the weeks before it too: the office's
 * first drawing of a person reads their past weeks, which is what the board is for.
 */
export function answerInForce(answers: readonly AvailableHoursAnswer[], ymd: string): AvailableHoursAnswer | null {
  let best: AvailableHoursAnswer | null = null
  let first: AvailableHoursAnswer | null = null
  for (const a of answers) {
    if (!first || a.effective_from < first.effective_from || (a.effective_from === first.effective_from && a.set_at < first.set_at)) first = a
    if (a.effective_from > ymd) continue
    if (!best || a.effective_from > best.effective_from || (a.effective_from === best.effective_from && a.set_at > best.set_at)) best = a
  }
  return best ?? first
}

/** The hours a typed answer may hold: a number from 0 to 80, in halves. */
export function parseHoursPerWeek(raw: string): number | null {
  const n = Number(raw.trim())
  if (!Number.isFinite(n) || n < 0 || n > UTILIZATION_MAX_HOURS_PER_WEEK) return null
  return Math.round(n * 2) / 2
}

export function utilizationBand(pct: number | null, workedHours: number): UtilizationBand {
  if (pct == null || workedHours <= 0) return 'none'
  if (pct > 100) return 'over'
  if (pct >= UTILIZATION_FULL_PCT) return 'full'
  if (pct >= UTILIZATION_LIGHT_PCT) return 'ok'
  return 'light'
}

export const BAND_WORDS: Record<UtilizationBand, string> = {
  over: 'Over their hours',
  full: 'Full',
  ok: 'Steady',
  light: 'Light',
  none: 'Nothing recorded',
}

/** The hours a session puts on its day: closed ones whole, the one open on today up to now, an older open one nothing. */
export function recordedSessionHours(s: UtilizationSession, todayYmd: string, nowMs: number): number {
  if (s.rejected_at || s.revoked_at) return 0
  if (s.clocked_out_at) return Math.max(0, sessionHours(s))
  if (s.work_date !== todayYmd) return 0
  const ms = nowMs - new Date(s.clocked_in_at).getTime()
  return Number.isFinite(ms) && ms > 0 ? ms / 3_600_000 : 0
}

function onRosterFor(p: UtilizationPerson, week: PayWeek): boolean {
  if (p.startYmd && p.startYmd.slice(0, 10) > week.end) return false
  if (p.endYmd && p.endYmd.slice(0, 10) < week.start) return false
  return true
}

function personWeek(args: {
  person: UtilizationPerson
  kind: 'hourly' | 'salaried'
  week: PayWeek
  todayYmd: string
  nowMs: number
  sessions: readonly UtilizationSession[]
  answers: readonly AvailableHoursAnswer[]
  timeOff: readonly UtilizationTimeOff[]
  scheduleHours: number | undefined
}): PersonWeek {
  const { person, kind, week, todayYmd, nowMs, sessions, answers, timeOff, scheduleHours } = args
  const partial = todayYmd >= week.start && todayYmd <= week.end
  const answer = kind === 'salaried' ? null : answerInForce(answers, week.start)
  const drawn = answer?.days ?? null
  const byDay = new Map<string, number>()
  let pendingHours = 0
  let openNow = false
  let outsideMin = 0
  for (const s of sessions) {
    if (s.work_date < week.start || s.work_date > week.end) continue
    const h = recordedSessionHours(s, todayYmd, nowMs)
    if (h <= 0) continue
    byDay.set(s.work_date, (byDay.get(s.work_date) ?? 0) + h)
    if (!s.clocked_out_at) openNow = true
    else if (!s.approved_at) pendingHours += h
    if (drawn) {
      const inMs = new Date(s.clocked_in_at).getTime()
      const outMs = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : nowMs
      outsideMin += outsideMinutes({ ymd: s.work_date, inMs, outMs, segs: drawn[dowOfYmd(s.work_date)] ?? [] })
    }
  }
  let workedHours = 0
  let longDays = 0
  let longestDayHours = 0
  for (const h of byDay.values()) {
    workedHours += h
    if (h > UTILIZATION_LONG_DAY_HOURS) longDays += 1
    if (h > longestDayHours) longestDayHours = h
  }
  let canWorkHours: number
  let source: AvailabilitySource
  if (kind === 'salaried') {
    canWorkHours = scheduleHours ?? UTILIZATION_ASSUMED_HOURS
    source = 'schedule'
  } else {
    canWorkHours = answer ? (drawn ? weekHours(drawn) : answer.hours_per_week) : UTILIZATION_ASSUMED_HOURS
    source = answer ? 'answered' : 'assumed'
  }
  // A recorded day off takes that day's drawn hours out of the week, or a fifth of the week when only a number was given.
  let hoursOffRaw = 0
  for (let d = week.start; d <= week.end; d = addDaysYmd(d, 1)) {
    if (!timeOff.some((t) => t.user_id === person.id && d >= t.startYmd && d <= t.endYmd)) continue
    if (drawn) hoursOffRaw += dayHours(drawn, dowOfYmd(d))
    else if (isWeekday(d)) hoursOffRaw += canWorkHours / UTILIZATION_WEEKDAYS
  }
  const hoursOff = round1(hoursOffRaw)
  const availableHours = Math.max(0, round1(canWorkHours - hoursOff))
  const onRoster = onRosterFor(person, week)
  const worked = round1(workedHours)
  const pct = availableHours > 0 ? Math.round((worked / availableHours) * 100) : null
  return {
    week,
    partial,
    onRoster,
    workedHours: worked,
    pendingHours: round1(pendingHours),
    openNow,
    daysWorked: byDay.size,
    longDays,
    longestDayHours: round1(longestDayHours),
    canWorkHours,
    source,
    hoursOff,
    availableHours,
    pct,
    band: utilizationBand(pct, worked),
    outsideHours: drawn ? round1(outsideMin / 60) : null,
  }
}

/** Full weeks in a row ending at the last full week. A week with nothing recorded while on the roster counts as light: the lightest week there is. */
function streak(fullWeeks: readonly PersonWeek[], band: UtilizationBand): number {
  let n = 0
  for (let i = fullWeeks.length - 1; i >= 0; i--) {
    const w = fullWeeks[i]!
    if (!w.onRoster) break
    const matches = w.band === band || (band === 'light' && w.band === 'none')
    if (!matches) break
    n += 1
  }
  return n
}

function firstNames(people: readonly PersonUtilization[]): string {
  const names = people.map((p) => p.person.name.trim().split(/\s+/)[0] || p.person.name)
  if (names.length <= 1) return names.join('')
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n)
const capital = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`

function teamWeeks(weeks: readonly PayWeek[], people: readonly PersonUtilization[], todayYmd: string): TeamWeek[] {
  return weeks.map((week, i) => {
    let workedHours = 0
    let availableHours = 0
    let peopleOver = 0
    let peopleLight = 0
    let longDays = 0
    for (const p of people) {
      const w = p.weeks[i]!
      if (p.kind === 'salaried' || !w.onRoster) continue
      workedHours += w.workedHours
      availableHours += w.availableHours
      longDays += w.longDays
      if (w.band === 'over') peopleOver += 1
      if (w.band === 'light') peopleLight += 1
    }
    workedHours = round1(workedHours)
    availableHours = round1(availableHours)
    return { week, partial: todayYmd >= week.start && todayYmd <= week.end, workedHours, availableHours, pct: availableHours > 0 ? Math.round((workedHours / availableHours) * 100) : null, peopleOver, peopleLight, longDays }
  })
}

/** The board's lines, in plain words: the crew last week, who to add for, who to use more, the office, who has not answered. */
export function utilizationLines(board: Pick<UtilizationBoard, 'people' | 'team' | 'office' | 'counts'>): string[] {
  const lines: string[] = []
  const lastFull = [...board.team].reverse().find((w) => !w.partial)
  if (lastFull && lastFull.pct != null) {
    lines.push(`The field crew worked ${lastFull.pct} percent of its hours last week.`)
  }
  const field = board.people.filter((p) => p.side === 'field')
  const add = field.filter((p) => p.verdict === 'add')
  if (add.length) {
    lines.push(`${firstNames(add)} ran over their hours ${countWord(UTILIZATION_OVER_STREAK)} weeks running. That is the sign to add people.`)
  }
  const useMore = field.filter((p) => p.verdict === 'use_more')
  if (useMore.length) {
    lines.push(`${firstNames(useMore)} worked under ${UTILIZATION_LIGHT_PCT} percent of their hours ${countWord(UTILIZATION_LIGHT_STREAK)} weeks running. Use them more, or sell more.`)
  }
  const outside = field.filter((p) => p.verdict !== 'left' && p.kind === 'hourly' && (p.lastFullWeek?.outsideHours ?? 0) >= 1).sort((a, b) => (b.lastFullWeek?.outsideHours ?? 0) - (a.lastFullWeek?.outsideHours ?? 0))
  if (outside.length) {
    const total = round1(outside.reduce((a, p) => a + (p.lastFullWeek?.outsideHours ?? 0), 0))
    lines.push(`${firstNames(outside)} worked ${total} hours outside the hours they drew last week.`)
  }
  const lastOffice = [...board.office].reverse().find((w) => !w.partial)
  if (lastOffice && lastOffice.pct != null && lastOffice.availableHours > 0) {
    lines.push(`The office clocked ${lastOffice.pct} percent of its hours last week.`)
  }
  const officeAdd = board.people.filter((p) => p.side === 'office' && p.verdict === 'add')
  if (officeAdd.length) {
    lines.push(`In the office, ${firstNames(officeAdd)} ran over their hours ${countWord(UTILIZATION_OVER_STREAK)} weeks running.`)
  }
  if (board.counts.unanswered) {
    const n = board.counts.unanswered
    lines.push(`${n === 1 ? 'One person has' : `${capital(countWord(n))} people have`} not said their hours yet. The board assumes ${UTILIZATION_ASSUMED_HOURS} for them.`)
  }
  if (!lines.length) lines.push('Nobody is over their hours and nobody is light. The crew is steady.')
  return lines
}

/** The whole board: every person with a recorded week or an answer, week by week, both sides' totals and the lines. */
export function buildUtilizationBoard(input: UtilizationInput): UtilizationBoard {
  const weeks = payWeeksEndingAt(input.todayYmd, input.weeks ?? UTILIZATION_WEEKS)
  const timeOff = input.timeOff ?? []
  const sessionsByUser = new Map<string, UtilizationSession[]>()
  for (const s of input.sessions) {
    const list = sessionsByUser.get(s.user_id)
    if (list) list.push(s)
    else sessionsByUser.set(s.user_id, [s])
  }
  const answersByUser = new Map<string, AvailableHoursAnswer[]>()
  for (const a of input.answers) {
    const list = answersByUser.get(a.user_id)
    if (list) list.push(a)
    else answersByUser.set(a.user_id, [a])
  }
  const people: PersonUtilization[] = []
  for (const person of input.people) {
    const sessions = sessionsByUser.get(person.id) ?? []
    const answers = (answersByUser.get(person.id) ?? []).slice().sort((a, b) => a.effective_from.localeCompare(b.effective_from) || a.set_at.localeCompare(b.set_at))
    const punches = sessions.some((s) => s.origin !== SALARY_SCHEDULE_ORIGIN)
    const kind: PersonUtilization['kind'] = person.isSalary && !(person.recordsHoursButSalary && punches) ? 'salaried' : 'hourly'
    const personWeeks = weeks.map((week) =>
      personWeek({ person, kind, week, todayYmd: input.todayYmd, nowMs: input.nowMs, sessions, answers, timeOff, scheduleHours: input.scheduleHoursByUser?.get(person.id) }),
    )
    const anyRecorded = personWeeks.some((w) => w.workedHours > 0)
    if (!anyRecorded && answers.length === 0) continue
    const fullWeeks = personWeeks.filter((w) => !w.partial)
    const lastFullWeek = fullWeeks.length ? fullWeeks[fullWeeks.length - 1]! : null
    const rated = fullWeeks.filter((w) => w.onRoster && w.pct != null)
    const avgPct = rated.length ? Math.round(rated.reduce((a, w) => a + (w.pct ?? 0), 0) / rated.length) : null
    const overStreak = streak(fullWeeks, 'over')
    const lightStreak = streak(fullWeeks, 'light')
    const longDays = personWeeks.reduce((a, w) => a + w.longDays, 0)
    const current = personWeeks[personWeeks.length - 1]!
    const outsideWeeks = personWeeks.filter((w) => w.outsideHours != null)
    const outsideHours = outsideWeeks.length ? round1(outsideWeeks.reduce((a, w) => a + (w.outsideHours ?? 0), 0)) : null
    const canWork: CanWork =
      kind === 'salaried'
        ? { hours: current.canWorkHours, source: 'schedule', setAt: null, setBy: null, days: null }
        : (() => {
            const a = answerInForce(answers, input.todayYmd)
            return a
              ? { hours: a.days ? weekHours(a.days) : a.hours_per_week, source: 'answered', setAt: a.set_at, setBy: a.set_by, days: a.days ?? null }
              : { hours: UTILIZATION_ASSUMED_HOURS, source: 'assumed', setAt: null, setBy: null, days: null }
          })()
    const side = utilizationSide(person.role)
    // A person who left inside the window keeps the weeks they worked on the board, with no verdict to act on.
    const left = Boolean(person.endYmd && person.endYmd.slice(0, 10) < input.todayYmd)
    let verdict: PersonVerdict
    if (left) verdict = 'left'
    else if (kind === 'salaried') verdict = 'salaried'
    else if (overStreak >= UTILIZATION_OVER_STREAK) verdict = 'add'
    // Office people clock unevenly, so a light run is not "use them more"; only the field reads that way.
    else if (side === 'field' && lightStreak >= UTILIZATION_LIGHT_STREAK) verdict = 'use_more'
    else if (!anyRecorded) verdict = 'quiet'
    else verdict = 'steady'
    people.push({ person, side, kind, canWork, weeks: personWeeks, lastFullWeek, avgPct, overStreak, lightStreak, longDays, outsideHours, verdict, answers })
  }
  const verdictRank: Record<PersonVerdict, number> = { add: 0, use_more: 1, steady: 2, quiet: 3, salaried: 4, left: 5 }
  people.sort((a, b) => {
    if (a.side !== b.side) return a.side === 'field' ? -1 : 1
    const r = verdictRank[a.verdict] - verdictRank[b.verdict]
    if (r) return r
    if (a.verdict === 'add' && b.overStreak !== a.overStreak) return b.overStreak - a.overStreak
    const pa = a.lastFullWeek?.pct ?? -1
    const pb = b.lastFullWeek?.pct ?? -1
    if (pb !== pa) return pb - pa
    return a.person.name.localeCompare(b.person.name)
  })
  const field = people.filter((p) => p.side === 'field')
  const office = people.filter((p) => p.side === 'office')
  const team = teamWeeks(weeks, field, input.todayYmd)
  const officeWeeks = teamWeeks(weeks, office, input.todayYmd)
  const fieldHourly = field.filter((p) => p.kind === 'hourly')
  const hourly = people.filter((p) => p.kind === 'hourly')
  const counts: UtilizationCounts = {
    people: people.length,
    over: fieldHourly.filter((p) => p.lastFullWeek?.band === 'over').length,
    light: fieldHourly.filter((p) => p.lastFullWeek?.band === 'light').length,
    longDays: fieldHourly.reduce((a, p) => a + p.longDays, 0),
    unanswered: hourly.filter((p) => p.verdict !== 'left' && p.canWork.source === 'assumed').length,
    salaried: people.length - hourly.length,
    outsideHours: round1(fieldHourly.reduce((a, p) => a + (p.outsideHours ?? 0), 0)),
  }
  const board: UtilizationBoard = { weeks, people, team, office: officeWeeks, counts, lines: [] }
  board.lines = utilizationLines(board)
  return board
}

/** "32 of 40 h" */
export function hoursOfWords(worked: number, available: number): string {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
  return `${fmt(worked)} of ${fmt(available)} h`
}

/** The verdict a row wears, in plain words. */
export const VERDICT_WORDS: Record<PersonVerdict, string> = {
  add: 'Over three weeks running',
  use_more: 'Light four weeks running',
  steady: 'Steady',
  quiet: 'No hours recorded',
  salaried: 'Salaried, on the schedule',
  left: 'Left the roster',
}

export const SIDE_WORDS: Record<UtilizationSide, string> = { field: 'Field crew', office: 'Office' }
