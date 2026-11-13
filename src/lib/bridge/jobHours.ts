/**
 * The hours that have gone into one job, and whose they are (punch list #334, PR 10).
 *
 * The owner, of the list *Set a percent on the jobs without one*: "let the user know how many man hours have been
 * spent on the job and by who and if they click on it a modal should open showing the details of it."
 *
 * A percent is a judgement, and the hours are what it is judged from. So each job on that list says its hours and
 * the people behind them, and a press opens them: a line for each person, then every day worked, newest first.
 *
 * Approved hours are the ones the page's own sums use (`loadEarnedJobs`), so they are the total. Hours still waiting
 * on approval are said beside it, never added in. Pure: no React, no Supabase (`jobHoursIo.ts` reads).
 */

/** One closed clock session on a job. */
export type JobHoursSession = { jobId: string; userId: string; name: string; ymd: string; hours: number; approved: boolean }

export type JobHoursPerson = { userId: string; name: string; hours: number; waitingHours: number; days: number; lastYmd: string }
export type JobHoursDay = { ymd: string; userId: string; name: string; hours: number; waiting: boolean }

export type JobHours = {
  /** Approved hours, the ones the page's sums use. */
  hours: number
  /** Hours worked and not yet approved. */
  waitingHours: number
  /** Everyone with a session on the job, the most hours first. */
  people: JobHoursPerson[]
  /** A row for each person on each day, newest day first. */
  days: JobHoursDay[]
  firstYmd: string | null
  lastYmd: string | null
  /** Distinct days anyone worked. */
  dayCount: number
}

export const NO_JOB_HOURS: JobHours = { hours: 0, waitingHours: 0, people: [], days: [], firstYmd: null, lastYmd: null, dayCount: 0 }

/** Every job's hours from its sessions. A job with no session is not in the map. */
export function jobHoursByJob(sessions: ReadonlyArray<JobHoursSession>): Map<string, JobHours> {
  const byJob = new Map<string, JobHoursSession[]>()
  for (const s of sessions) {
    if (!(s.hours > 0)) continue
    const list = byJob.get(s.jobId)
    if (list) list.push(s)
    else byJob.set(s.jobId, [s])
  }
  const out = new Map<string, JobHours>()
  for (const [jobId, list] of byJob) {
    const people = new Map<string, JobHoursPerson & { daySet: Set<string> }>()
    const days = new Map<string, JobHoursDay>()
    let hours = 0
    let waitingHours = 0
    for (const s of list) {
      if (s.approved) hours += s.hours
      else waitingHours += s.hours
      const p = people.get(s.userId) ?? { userId: s.userId, name: s.name, hours: 0, waitingHours: 0, days: 0, lastYmd: s.ymd, daySet: new Set<string>() }
      if (s.approved) p.hours += s.hours
      else p.waitingHours += s.hours
      p.daySet.add(s.ymd)
      if (s.ymd > p.lastYmd) p.lastYmd = s.ymd
      people.set(s.userId, p)
      // A day's approved and waiting hours are kept apart, so a row never mixes the two.
      const key = `${s.ymd}|${s.userId}|${s.approved ? 'a' : 'w'}`
      const d = days.get(key) ?? { ymd: s.ymd, userId: s.userId, name: s.name, hours: 0, waiting: !s.approved }
      d.hours += s.hours
      days.set(key, d)
    }
    const allDays = [...new Set(list.map((s) => s.ymd))].sort()
    out.set(jobId, {
      hours,
      waitingHours,
      people: [...people.values()].map(({ daySet, ...p }) => ({ ...p, days: daySet.size })).sort((a, b) => b.hours + b.waitingHours - (a.hours + a.waitingHours) || a.name.localeCompare(b.name)),
      days: [...days.values()].sort((a, b) => (a.ymd < b.ymd ? 1 : a.ymd > b.ymd ? -1 : b.hours - a.hours || a.name.localeCompare(b.name))),
      firstYmd: allDays[0] ?? null,
      lastYmd: allDays[allDays.length - 1] ?? null,
      dayCount: allDays.length,
    })
  }
  return out
}

/** Hours as a person says them: whole above ten, one decimal under, never *0 hours* for real time. */
export function hoursWords(h: number): string {
  if (!(h > 0)) return '0 hours'
  const n = h >= 10 ? Math.round(h) : Math.max(0.1, Math.round(h * 10) / 10)
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'hour' : 'hours'}`
}

const first = (name: string): string => name.trim().split(/\s+/)[0] ?? ''

/** The people in a few words, the most hours first: *Dana*, *Dana and Sam*, *Dana, Sam and 2 more*. */
export function hoursPeopleWords(people: ReadonlyArray<Pick<JobHoursPerson, 'name'>>): string {
  const names = people.map((p) => first(p.name)).filter(Boolean)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`
}

/** The words on the job's line, which are its press: *42 hours by Dana and Sam*. */
export function jobHoursLine(h: JobHours | null | undefined): string {
  if (!h || (h.hours <= 0 && h.waitingHours <= 0)) return 'No hours yet'
  const who = hoursPeopleWords(h.people)
  // Nothing approved yet: say what waits, so the line is never *0 hours* over real work.
  if (h.hours <= 0) return `${hoursWords(h.waitingHours)} waiting on approval${who ? `, by ${who}` : ''}`
  return `${hoursWords(h.hours)}${who ? ` by ${who}` : ''}`
}

/** The same as a table's cells: the approved hours as a figure, the figure with its unit, and the people. */
export function jobHoursCell(h: JobHours | null | undefined): { text: string; phone: string; by: string } {
  if (!h || (h.hours <= 0 && h.waitingHours <= 0)) return { text: '0', phone: 'No hours yet', by: '' }
  const who = hoursPeopleWords(h.people)
  const waiting = h.waitingHours > 0 ? `${hoursWords(h.waitingHours)} waiting on approval` : ''
  return { text: hoursWords(h.hours).replace(/ hours?$/, ''), phone: hoursWords(h.hours), by: [who, waiting].filter(Boolean).join(', ') }
}

/** The window's lead under the job's name: how much, over how long, and what still waits. */
export function jobHoursLead(h: JobHours, dayLabel: (ymd: string) => string): string[] {
  if (h.hours <= 0 && h.waitingHours <= 0) return ['Nobody has clocked time on this job yet.']
  const out: string[] = []
  const span = h.firstYmd && h.lastYmd ? (h.firstYmd === h.lastYmd ? ` on ${dayLabel(h.firstYmd)}` : ` over ${h.dayCount} days, from ${dayLabel(h.firstYmd)} to ${dayLabel(h.lastYmd)}`) : ''
  out.push(`${hoursWords(h.hours)} approved${span}.`)
  if (h.waitingHours > 0) out.push(`${hoursWords(h.waitingHours)} more still wait on approval. They are not in the total.`)
  return out
}

/** How many day rows the window shows before *Show all*. */
export const JOB_HOURS_DAYS_SHOWN = 12
