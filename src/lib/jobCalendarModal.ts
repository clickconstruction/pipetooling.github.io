/**
 * Pure model for the Job Calendar modal (Jobs → Stages → click the "j:" Field /
 * job-activity date): which days a job sits on whose calendar, plus the full
 * appointment list. Inputs are raw `job_schedule_blocks` rows (with assignee
 * names) and the job's clock sessions; output drives a month mini-calendar
 * (person-colored dots, worked-day checks) and an Upcoming / Past list.
 */

/**
 * Minimal job identity the calendar modal (and its header) needs — structurally
 * satisfied by JobWithDetails, so Stages passes jobs straight through while
 * Job Mode / other surfaces can assemble it from leaner rows.
 */
export type JobCalendarJobIdentity = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  serviceType?: { name: string | null } | null
}

export type JobCalendarBlockInput = {
  id: string
  assignee_user_id: string
  work_date: string
  time_start: string
  time_end: string
  note: string | null
  shared_block_group_id: string | null
  users: { name: string | null } | null
}

export type JobCalendarSessionInput = {
  work_date: string | null
  clocked_out_at: string | null
  approved_at: string | null
  rejected_at: string | null
}

export type JobCalendarPerson = {
  userId: string
  name: string
  colorIndex: number
}

export type JobCalendarAppointment = {
  /** shared_block_group_id when set, else the lone block id. */
  key: string
  ymd: string
  timeStart: string
  timeEnd: string
  people: JobCalendarPerson[]
  note: string | null
}

export type JobCalendarModel = {
  /** Everyone with at least one block, name-sorted; colorIndex into JOB_CALENDAR_PERSON_COLORS. */
  people: JobCalendarPerson[]
  /** Today and later, soonest first. */
  upcoming: JobCalendarAppointment[]
  /** Before today, most recent first. */
  past: JobCalendarAppointment[]
  /** ymd → unique person colorIndexes scheduled that day (ascending). */
  scheduledColorIdxByYmd: Record<string, number[]>
  /** Days with an approved, closed clock session (actually worked). */
  workedYmds: Set<string>
  summary: {
    dayCount: number
    peopleCount: number
    firstYmd: string | null
    lastYmd: string | null
    next: JobCalendarAppointment | null
  }
  /** Month the calendar opens on: next upcoming, else latest appointment, else today. */
  initialMonth: { year: number; month: number }
}

/** Saturated per-person dot/legend colors (theme-safe: action colors stay literal). */
export const JOB_CALENDAR_PERSON_COLORS = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
] as const

function ymdParts(ymd: string): { year: number; month: number } {
  const [y, m] = ymd.split('-').map(Number)
  return { year: y || 1970, month: m || 1 }
}

export function buildJobCalendarModel(
  blocks: JobCalendarBlockInput[],
  sessions: JobCalendarSessionInput[],
  todayYmd: string,
): JobCalendarModel {
  const personByUserId = new Map<string, { userId: string; name: string }>()
  for (const b of blocks) {
    if (!personByUserId.has(b.assignee_user_id)) {
      personByUserId.set(b.assignee_user_id, {
        userId: b.assignee_user_id,
        name: b.users?.name?.trim() || 'Unknown',
      })
    }
  }
  const people: JobCalendarPerson[] = [...personByUserId.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p, i) => ({ ...p, colorIndex: i % JOB_CALENDAR_PERSON_COLORS.length }))
  const personById = new Map(people.map((p) => [p.userId, p]))

  // One appointment per shared block group (people merged); lone blocks stand alone.
  const apptByKey = new Map<string, JobCalendarAppointment>()
  for (const b of blocks) {
    const key = b.shared_block_group_id ?? b.id
    const person = personById.get(b.assignee_user_id)
    const existing = apptByKey.get(key)
    if (!existing) {
      apptByKey.set(key, {
        key,
        ymd: b.work_date,
        timeStart: b.time_start,
        timeEnd: b.time_end,
        people: person ? [person] : [],
        note: b.note?.trim() || null,
      })
    } else {
      if (person && !existing.people.some((p) => p.userId === person.userId)) existing.people.push(person)
      if (!existing.note && b.note?.trim()) existing.note = b.note.trim()
    }
  }
  const appointments = [...apptByKey.values()]
  for (const a of appointments) a.people.sort((x, y) => x.name.localeCompare(y.name))
  appointments.sort((a, b) =>
    a.ymd === b.ymd ? a.timeStart.localeCompare(b.timeStart) : a.ymd.localeCompare(b.ymd),
  )

  const upcoming = appointments.filter((a) => a.ymd >= todayYmd)
  const past = appointments.filter((a) => a.ymd < todayYmd).reverse()

  const scheduledColorIdxByYmd: Record<string, number[]> = {}
  for (const a of appointments) {
    const set = new Set(scheduledColorIdxByYmd[a.ymd] ?? [])
    for (const p of a.people) set.add(p.colorIndex)
    scheduledColorIdxByYmd[a.ymd] = [...set].sort((x, y) => x - y)
  }

  const workedYmds = new Set<string>()
  for (const s of sessions) {
    if (s.work_date && s.approved_at && !s.rejected_at && s.clocked_out_at) workedYmds.add(s.work_date)
  }

  const scheduledYmds = Object.keys(scheduledColorIdxByYmd).sort()
  const next = upcoming[0] ?? null
  const anchorYmd = next?.ymd ?? appointments[appointments.length - 1]?.ymd ?? todayYmd

  return {
    people,
    upcoming,
    past,
    scheduledColorIdxByYmd,
    workedYmds,
    summary: {
      dayCount: scheduledYmds.length,
      peopleCount: people.length,
      firstYmd: scheduledYmds[0] ?? null,
      lastYmd: scheduledYmds[scheduledYmds.length - 1] ?? null,
      next,
    },
    initialMonth: ymdParts(anchorYmd),
  }
}

/** Weeks (Sunday-start rows) covering the month; days outside it flagged. Plain local-date math — inputs are calendar ymds. */
export function jobCalendarMonthGrid(
  year: number,
  month: number,
): Array<Array<{ ymd: string; inMonth: boolean }>> {
  const first = new Date(year, month - 1, 1)
  const start = new Date(year, month - 1, 1 - first.getDay())
  const weeks: Array<Array<{ ymd: string; inMonth: boolean }>> = []
  const d = new Date(start)
  do {
    const week: Array<{ ymd: string; inMonth: boolean }> = []
    for (let i = 0; i < 7; i++) {
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      week.push({ ymd, inMonth: d.getMonth() === month - 1 })
      d.setDate(d.getDate() + 1)
    }
    weeks.push(week)
  } while (d.getMonth() === month - 1)
  return weeks
}

export function jobCalendarAddMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
}

export function jobCalendarMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
