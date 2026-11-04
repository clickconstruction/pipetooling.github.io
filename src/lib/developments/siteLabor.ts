/**
 * The clock's hours on a site's jobs, by job and by person (v2.6407, punch list #250, the
 * Development page's scoreboard). The same split the Job window and Job Summary make
 * (`utils/teamLabor.ts`, which MUST stay in parity): a salaried person's day is 8 h Monday to
 * Friday, an hourly person's day is the recorded hours, and a crew day is split over its jobs by
 * each assignment's percent. Days are counted once each, at every level: a person's days on a
 * job, a job's days, the site's days. The crew row names the day's lead, so a person's lead days
 * are kept for the Lead tag. Pure; `fetchSiteLabor.ts` reads the rows.
 */
import { buildHoursMap, hoursForCrewRow, type CrewJobAssignment } from '../../utils/teamLabor'

export type SiteCrewRow = {
  work_date: string
  person_name: string
  person_id: string | null
  job_assignments: CrewJobAssignment[] | null
  crew_lead_person_name?: string | null
}

export type SiteHoursRow = { person_name: string; person_id: string | null; work_date: string; hours: number }

export type SitePayConfig = Record<string, { hourly_wage: number; is_salary: boolean }>

export type SiteLaborPerson = {
  personName: string
  personId: string | null
  /** The login the roster person signs in with (`people.account_user_id`), for the viewer's gold row (v2.6457); null when none or unread. */
  userId: string | null
  hours: number
  costUsd: number
  /** Days with hours on this job, counted once each. */
  days: number
  /** Days this person was the crew's lead on this job. */
  leadDays: number
  /**
   * The person's hours and labor dollars on this job by day (v2.6493, the Development page's Timeline), in
   * date order; absent on the man-hours read, which has no days.
   */
  byWorkDate?: Array<{ ymd: string; hours: number; costUsd: number }>
}

export type SiteLaborJob = {
  jobId: string
  hours: number
  costUsd: number
  /** Days with hours on the job, counted once each, whoever worked. */
  days: number
  people: SiteLaborPerson[]
}

export type SiteLabor = {
  byJobId: Map<string, SiteLaborJob>
  /**
   * Whether the days are known (v2.6457): the clock's rows give days; a reader those rows are closed to (a
   * master without payroll approval) gets the hours from `get_man_hours_by_job` alone, and the board leaves
   * the Days column out rather than show a false zero.
   */
  daysKnown: boolean
  /** Days with hours on any of the site's jobs, counted once each. */
  siteDays: number
  /** People with hours on the site. */
  people: number
}

/** What the page holds: reading, read, or failed (the cells say so, never a false zero). */
export type SiteLaborRead = { state: 'reading' } | { state: 'read'; labor: SiteLabor } | { state: 'failed' }

/** A crew day's hours: 8 on a weekday for a salaried person, the recorded hours for an hourly one. */
export function crewDayHours(cfg: { is_salary: boolean } | undefined, row: SiteCrewRow, hoursMap: Record<string, number>): number {
  if (cfg?.is_salary) {
    const day = new Date(row.work_date + 'T12:00:00').getDay()
    return day >= 1 && day <= 5 ? 8 : 0
  }
  return hoursForCrewRow(hoursMap, row)
}

export function allocateSiteLabor(args: { jobIds: ReadonlyArray<string>; crewRows: ReadonlyArray<SiteCrewRow>; hoursRows: ReadonlyArray<SiteHoursRow>; config: SitePayConfig; userIdByPersonId?: ReadonlyMap<string, string> }): SiteLabor {
  const jobSet = new Set(args.jobIds)
  const hoursMap = buildHoursMap([...args.hoursRows])
  // A crew row holds a whole day's assignments, so the same row comes back for every job of the site it names: keep it once.
  const seen = new Set<string>()
  type Acc = { hours: number; costUsd: number; days: Set<string>; leadDays: number; personId: string | null; byDay: Map<string, { hours: number; costUsd: number }> }
  const byJob = new Map<string, Map<string, Acc>>()
  const jobDays = new Map<string, Set<string>>()
  const siteDays = new Set<string>()
  const sitePeople = new Set<string>()
  for (const r of args.crewRows) {
    const key = `${r.work_date}:${r.person_name}`
    if (seen.has(key)) continue
    seen.add(key)
    const assignments = Array.isArray(r.job_assignments) ? r.job_assignments : []
    const cfg = (r.person_id ? args.config[`id:${r.person_id}`] : undefined) ?? args.config[r.person_name]
    const hours = crewDayHours(cfg, r, hoursMap)
    const rate = cfg?.hourly_wage ?? 0
    const lead = r.crew_lead_person_name != null && r.crew_lead_person_name.trim() === r.person_name.trim()
    for (const a of assignments) {
      if (!jobSet.has(a.job_id)) continue
      const pctHrs = hours * (a.pct / 100)
      if (!(pctHrs > 0)) continue
      let people = byJob.get(a.job_id)
      if (!people) {
        people = new Map()
        byJob.set(a.job_id, people)
      }
      let acc = people.get(r.person_name)
      if (!acc) {
        acc = { hours: 0, costUsd: 0, days: new Set(), leadDays: 0, personId: r.person_id ?? null, byDay: new Map() }
        people.set(r.person_name, acc)
      }
      acc.hours += pctHrs
      acc.costUsd += pctHrs * rate
      acc.days.add(r.work_date)
      const day = acc.byDay.get(r.work_date) ?? { hours: 0, costUsd: 0 }
      day.hours += pctHrs
      day.costUsd += pctHrs * rate
      acc.byDay.set(r.work_date, day)
      if (lead) acc.leadDays += 1
      if (!acc.personId && r.person_id) acc.personId = r.person_id
      let jd = jobDays.get(a.job_id)
      if (!jd) {
        jd = new Set()
        jobDays.set(a.job_id, jd)
      }
      jd.add(r.work_date)
      siteDays.add(r.work_date)
      sitePeople.add(r.person_name)
    }
  }
  const byJobId = new Map<string, SiteLaborJob>()
  for (const jobId of args.jobIds) {
    const people = byJob.get(jobId)
    if (!people) continue
    const rows: SiteLaborPerson[] = [...people.entries()]
      .map(([personName, a]) => ({
        personName,
        personId: a.personId,
        userId: (a.personId ? args.userIdByPersonId?.get(a.personId) : undefined) ?? null,
        hours: a.hours,
        costUsd: a.costUsd,
        days: a.days.size,
        leadDays: a.leadDays,
        byWorkDate: [...a.byDay.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([ymd, d]) => ({ ymd, hours: d.hours, costUsd: d.costUsd })),
      }))
      .sort((x, y) => y.hours - x.hours || x.personName.localeCompare(y.personName))
    byJobId.set(jobId, {
      jobId,
      hours: rows.reduce((s, p) => s + p.hours, 0),
      costUsd: rows.reduce((s, p) => s + p.costUsd, 0),
      days: jobDays.get(jobId)?.size ?? 0,
      people: rows,
    })
  }
  return { byJobId, siteDays: siteDays.size, people: sitePeople.size, daysKnown: true }
}

/**
 * The hours alone, from the man-hours read (v2.6457), for a reader the clock's rows are closed to: each
 * person's hours on each job, no wage, no days, no lead. The board then leaves Days out.
 */
export function siteLaborFromManHours(jobIds: ReadonlyArray<string>, rows: ReadonlyArray<{ job_id: string; person_name: string; man_hours: number | string }>): SiteLabor {
  const jobSet = new Set(jobIds)
  const byJob = new Map<string, Map<string, number>>()
  const names = new Set<string>()
  for (const r of rows) {
    const hours = Number(r.man_hours) || 0
    if (!jobSet.has(r.job_id) || !(hours > 0)) continue
    const people = byJob.get(r.job_id) ?? new Map<string, number>()
    people.set(r.person_name, (people.get(r.person_name) ?? 0) + hours)
    byJob.set(r.job_id, people)
    names.add(r.person_name)
  }
  const byJobId = new Map<string, SiteLaborJob>()
  for (const jobId of jobIds) {
    const people = byJob.get(jobId)
    if (!people) continue
    const list: SiteLaborPerson[] = [...people.entries()]
      .map(([personName, hours]) => ({ personName, personId: null, userId: null, hours, costUsd: 0, days: 0, leadDays: 0 }))
      .sort((a, b) => b.hours - a.hours || a.personName.localeCompare(b.personName))
    byJobId.set(jobId, { jobId, hours: list.reduce((t, p) => t + p.hours, 0), costUsd: 0, days: 0, people: list })
  }
  return { byJobId, siteDays: 0, people: names.size, daysKnown: false }
}
