/**
 * Days on the job (v2.4694): the job window's History tab as a calendar — one
 * month grid for every month the job had work, the number in a day being how
 * many people clocked in, with the hours, who was there and for how many days.
 * Pure kernel over the same approved clock-session rows the Projects Gantt
 * aggregates, so the two never disagree about which days were worked.
 *
 * Replaces, for one job, the many-jobs Gantt (36 px a day, 181 days wide) and
 * the phone's day list (v2.3235). The owner, 2026-10-06: *a calendar of the
 * days people were on the job and how many people.*
 */

import type { ProjectsJobHistoryClockRow } from '../projectsJobHistoryData'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type CrewDay = {
  ymd: string
  /** Day of the month, 1–31. */
  n: number
  /** 0 = Sunday … 6 = Saturday. */
  dow: number
  weekend: boolean
  today: boolean
  /** Distinct people clocked in that day; 0 = nobody. */
  people: number
  /** The people, in first-seen order. */
  userIds: string[]
  minutes: number
  /** Today, with a session not clocked out yet. */
  open: boolean
  /** A person is picked and was not here that day — drawn faint. */
  dimmed: boolean
}

export type CrewMonth = {
  /** 'YYYY-MM' */
  key: string
  /** `Jul 2026` */
  name: string
  /** Empty cells before the 1st, Sunday-first. */
  leadBlanks: number
  days: CrewDay[]
  daysWorked: number
  minutes: number
  maxPeople: number
  /** Months with no work skipped between this month and the one before it. */
  quietMonthsBefore: number
}

export type CrewPerson = { userId: string; days: number; minutes: number }

export type CrewCalendar = {
  months: CrewMonth[]
  daysWorked: number
  maxPeople: number
  minutes: number
  /** Everyone on the job in the range, most days first. */
  people: CrewPerson[]
  /** First and last day worked in the range; '' when none. */
  firstYmd: string
  lastYmd: string
}

export type CrewRangeMode = 'whole' | 90 | 365 | 'custom'

/** Minutes a session counts for: a quick-add's own minutes, else clock-in to clock-out, else 0 (an open session never guesses). */
export function sessionMinutes(row: Pick<ProjectsJobHistoryClockRow, 'clocked_in_at' | 'clocked_out_at' | 'quick_add_minutes'>): number {
  if (row.quick_add_minutes != null && row.quick_add_minutes > 0) return Math.round(row.quick_add_minutes)
  if (!row.clocked_in_at || !row.clocked_out_at) return 0
  const a = new Date(row.clocked_in_at).getTime()
  const b = new Date(row.clocked_out_at).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  return Math.round((b - a) / 60000)
}

/** `380 h` · `9.5 h` · `0 h` — whole hours over ten, one decimal under. */
export function crewHoursWords(minutes: number): string {
  const h = Math.max(0, minutes) / 60
  if (h >= 10) return `${Math.round(h)} h`
  const one = Math.round(h * 10) / 10
  return `${Number.isInteger(one) ? one.toFixed(0) : one.toFixed(1)} h`
}

function dowOf(ymd: string): number {
  const y = Number(ymd.slice(0, 4))
  const m = Number(ymd.slice(5, 7))
  const d = Number(ymd.slice(8, 10))
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function daysInMonth(key: string): number {
  const y = Number(key.slice(0, 4))
  const m = Number(key.slice(5, 7))
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function monthsBetween(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7))
}

/** `2026-07` → `Jul 2026`. */
export function crewMonthName(key: string): string {
  return `${MONTH_SHORT[Number(key.slice(5, 7)) - 1] ?? key.slice(5, 7)} ${key.slice(0, 4)}`
}

/** `Wed Aug 5` */
export function crewDayWords(ymd: string): string {
  return `${WEEKDAY_SHORT[dowOf(ymd)]} ${MONTH_SHORT[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`
}

export function buildCrewCalendar(
  rows: ReadonlyArray<ProjectsJobHistoryClockRow>,
  opts: { jobId: string; todayYmd: string; startYmd: string; endYmd: string; onlyUserId?: string | null },
): CrewCalendar {
  const byDay = new Map<string, { users: string[]; minutes: number; open: boolean; perUser: Map<string, number> }>()
  for (const r of rows) {
    if (r.job_ledger_id !== opts.jobId) continue
    const ymd = r.work_date
    if (!ymd || ymd < opts.startYmd || ymd > opts.endYmd) continue
    let d = byDay.get(ymd)
    if (!d) {
      d = { users: [], minutes: 0, open: false, perUser: new Map() }
      byDay.set(ymd, d)
    }
    if (!d.users.includes(r.user_id)) d.users.push(r.user_id)
    const mins = sessionMinutes(r)
    d.minutes += mins
    d.perUser.set(r.user_id, (d.perUser.get(r.user_id) ?? 0) + mins)
    if (!r.clocked_out_at && ymd === opts.todayYmd) d.open = true
  }
  const worked = [...byDay.keys()].sort()
  const firstYmd = worked[0] ?? ''
  const lastYmd = worked[worked.length - 1] ?? ''

  // Who, most days first (ties: more minutes, then first seen).
  const peopleMap = new Map<string, CrewPerson>()
  for (const ymd of worked) {
    const d = byDay.get(ymd)!
    for (const uid of d.users) {
      const p = peopleMap.get(uid) ?? { userId: uid, days: 0, minutes: 0 }
      p.days += 1
      p.minutes += d.perUser.get(uid) ?? 0
      peopleMap.set(uid, p)
    }
  }
  const people = [...peopleMap.values()].sort((a, b) => b.days - a.days || b.minutes - a.minutes)

  const months: CrewMonth[] = []
  if (firstYmd) {
    const workedMonths = [...new Set(worked.map((y) => y.slice(0, 7)))]
    let prev = ''
    for (const key of workedMonths) {
      const n = daysInMonth(key)
      const days: CrewDay[] = []
      let daysWorked = 0
      let minutes = 0
      let maxPeople = 0
      for (let i = 1; i <= n; i++) {
        const ymd = `${key}-${String(i).padStart(2, '0')}`
        const dow = dowOf(ymd)
        const d = byDay.get(ymd)
        const people = d ? d.users.length : 0
        if (d) {
          daysWorked += 1
          minutes += d.minutes
          if (people > maxPeople) maxPeople = people
        }
        days.push({
          ymd,
          n: i,
          dow,
          weekend: dow === 0 || dow === 6,
          today: ymd === opts.todayYmd,
          people,
          userIds: d ? d.users : [],
          minutes: d ? d.minutes : 0,
          open: d ? d.open : false,
          dimmed: !!opts.onlyUserId && (!d || !d.users.includes(opts.onlyUserId)),
        })
      }
      months.push({ key, name: crewMonthName(key), leadBlanks: dowOf(`${key}-01`), days, daysWorked, minutes, maxPeople, quietMonthsBefore: prev ? monthsBetween(prev, key) - 1 : 0 })
      prev = key
    }
  }

  let minutes = 0
  let maxPeople = 0
  for (const m of months) {
    minutes += m.minutes
    if (m.maxPeople > maxPeople) maxPeople = m.maxPeople
  }
  return { months, daysWorked: worked.length, maxPeople, minutes, people, firstYmd, lastYmd }
}

/** `23 days · Jul 14 → today · 4 people at most · 380 h`; `No days worked in this range.` when none. */
export function crewSummaryWords(cal: CrewCalendar, todayYmd: string): string {
  if (cal.daysWorked === 0) return 'No days worked in this range.'
  const from = crewDayWords(cal.firstYmd).replace(/^\w+ /, '')
  const to = cal.lastYmd === todayYmd ? 'today' : crewDayWords(cal.lastYmd).replace(/^\w+ /, '')
  const span = cal.firstYmd === cal.lastYmd ? from : `${from} → ${to}`
  return `${cal.daysWorked} ${cal.daysWorked === 1 ? 'day' : 'days'} · ${span} · ${cal.maxPeople} ${cal.maxPeople === 1 ? 'person' : 'people'} at most · ${crewHoursWords(cal.minutes)}`
}

/** A day's label — `Wed Aug 5 · 4 people · 34.5 h · Malachi, Jose, Edgar, Luis`; `· still clocked in` when open. */
export function crewDayLabel(day: CrewDay, namesById: Readonly<Record<string, string>>): string {
  if (day.people === 0) return `${crewDayWords(day.ymd)} · nobody`
  const names = day.userIds.map((id) => namesById[id]).filter((n): n is string => !!n)
  return [
    crewDayWords(day.ymd),
    `${day.people} ${day.people === 1 ? 'person' : 'people'}`,
    day.minutes > 0 ? crewHoursWords(day.minutes) : '',
    names.join(', '),
    day.open ? 'still clocked in' : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/** The range a mode means; 'whole' is the job's first day worked (or today) through today. */
export function crewRangeFor(mode: CrewRangeMode, todayYmd: string, wholeStartYmd: string, custom: { start: string; end: string }, addDays: (ymd: string, n: number) => string): { start: string; end: string } {
  if (mode === 'whole') return { start: wholeStartYmd || todayYmd, end: todayYmd }
  if (mode === 'custom') return custom
  return { start: addDays(todayYmd, -mode), end: todayYmd }
}

/** `after 2 quiet months` · `after a quiet month` · ''. */
export function crewQuietWords(n: number): string {
  if (n <= 0) return ''
  return n === 1 ? 'after a quiet month' : `after ${n} quiet months`
}
