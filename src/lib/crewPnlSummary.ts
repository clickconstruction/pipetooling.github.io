/** Jobs → Crew P&L (formerly "Teams") kernel. Pure — no React/supabase.
 *
 * Per-person rollup of labor cost vs billing credit:
 * - Billing credit is HOURS-WEIGHTED: each job's revenue is credited as
 *   revenue × (person's in-range crew hours on the job ÷ the job's all-time crew hours).
 *   Jobs with revenue but zero clocked crew hours fall back to an equal split among the
 *   job's team members (marked `estimated`), included when the job's fallback date is in range.
 * - Identity is PERSON-KEYED: account users, crew person_names, and sub-sheet free-text names
 *   resolve to a roster person where possible; unresolvable names key on the normalized string.
 * - The date range filters labor by work date / sub-job date; billing follows the hours, so a
 *   window attributes the slice of revenue earned in it.
 */

export type CrewPnlRosterPerson = {
  id: string
  name: string | null
  accountUserId: string | null
}

export type CrewPnlJobInput = {
  id: string
  /** Display label for drill-down lines (effective job #). */
  jobLabel: string
  revenue: number | null
  teamMembers: Array<{ userId: string | null; userName: string | null }>
  /** Date used to window equal-split fallback jobs (e.g. last_work_date). */
  fallbackDate: string | null
}

export type CrewPnlTeamLaborInput = {
  jobId: string
  breakdown: Array<{
    personName: string
    byWorkDate: Array<{ workDate: string; hours: number; cost: number }>
  }>
}

export type CrewPnlSubLaborInput = {
  id: string
  jobLabel: string
  jobDate: string | null
  assignedNames: string[]
  cost: number
  hours: number
}

/** Inclusive YMD range; null = open-ended. */
export type CrewPnlRange = { start: string | null; end: string | null }

export type CrewPnlJobLine = {
  kind: 'crew' | 'sub' | 'billing-fallback'
  jobId: string | null
  label: string
  hours: number
  laborCost: number
  billing: number
  /** Equal-split billing estimate (no clocked crew hours on the job). */
  estimated: boolean
}

export type CrewPnlPersonRow = {
  key: string
  displayName: string
  hours: number
  laborCost: number
  billing: number
  profit: number
  /** billing ÷ hours; null when no hours. */
  billingPerHour: number | null
  /** True when any billing line is an equal-split estimate. */
  hasEstimatedBilling: boolean
  /** True when the identity did not resolve to a roster person. */
  unmatched: boolean
  perJob: CrewPnlJobLine[]
}

export type CrewPnlSummary = {
  rows: CrewPnlPersonRow[]
  totals: { hours: number; laborCost: number; billing: number; profit: number }
}

export function ymdInRange(ymd: string | null | undefined, range: CrewPnlRange): boolean {
  const t = (ymd ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return range.start == null && range.end == null
  if (range.start != null && t < range.start) return false
  if (range.end != null && t > range.end) return false
  return true
}

function normName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase()
}

export type CrewPnlPersonResolver = {
  keyForName: (name: string | null | undefined) => string
  keyForUser: (userId: string | null | undefined, fallbackName: string | null | undefined) => string
  displayName: (key: string) => string
  isUnmatched: (key: string) => boolean
}

/** Roster-based identity: person id when a name/account matches, normalized name otherwise. */
export function buildCrewPnlPersonResolver(people: CrewPnlRosterPerson[]): CrewPnlPersonResolver {
  const byName = new Map<string, CrewPnlRosterPerson>()
  const byUserId = new Map<string, CrewPnlRosterPerson>()
  for (const p of people) {
    const n = normName(p.name)
    if (n && !byName.has(n)) byName.set(n, p)
    if (p.accountUserId) byUserId.set(p.accountUserId, p)
  }
  const displayByKey = new Map<string, string>()
  function keyForName(name: string | null | undefined): string {
    const n = normName(name)
    if (!n) return rememberKey('n:', 'Unknown')
    const p = byName.get(n)
    if (p) return rememberKey(`p:${p.id}`, (p.name ?? '').trim() || 'Unknown')
    return rememberKey(`n:${n}`, (name ?? '').trim())
  }
  function keyForUser(userId: string | null | undefined, fallbackName: string | null | undefined): string {
    if (userId) {
      const p = byUserId.get(userId)
      if (p) return rememberKey(`p:${p.id}`, (p.name ?? '').trim() || 'Unknown')
    }
    return keyForName(fallbackName)
  }
  function rememberKey(key: string, display: string): string {
    if (!displayByKey.has(key)) displayByKey.set(key, display)
    return key
  }
  return {
    keyForName,
    keyForUser,
    displayName: (key) => displayByKey.get(key) ?? key.replace(/^n:/, ''),
    isUnmatched: (key) => key.startsWith('n:'),
  }
}

export function buildCrewPnlSummary(args: {
  jobs: CrewPnlJobInput[]
  teamLabor: CrewPnlTeamLaborInput[]
  subLabor: CrewPnlSubLaborInput[]
  people: CrewPnlRosterPerson[]
  range: CrewPnlRange
}): CrewPnlSummary {
  const { jobs, teamLabor, subLabor, people, range } = args
  const resolver = buildCrewPnlPersonResolver(people)
  const jobById = new Map(jobs.map((j) => [j.id, j]))

  type Acc = { hours: number; laborCost: number; billing: number; perJob: CrewPnlJobLine[]; hasEstimated: boolean }
  const byKey = new Map<string, Acc>()
  function acc(key: string): Acc {
    let a = byKey.get(key)
    if (!a) {
      a = { hours: 0, laborCost: 0, billing: 0, perJob: [], hasEstimated: false }
      byKey.set(key, a)
    }
    return a
  }

  // Crew labor + hours-weighted billing.
  const jobsWithCrewHours = new Set<string>()
  for (const row of teamLabor) {
    const job = jobById.get(row.jobId)
    const revenue = job?.revenue != null && Number(job.revenue) > 0 ? Number(job.revenue) : 0
    const jobAllTimeHours = row.breakdown.reduce(
      (s, p) => s + p.byWorkDate.reduce((h, d) => h + d.hours, 0),
      0,
    )
    if (jobAllTimeHours > 0) jobsWithCrewHours.add(row.jobId)
    for (const p of row.breakdown) {
      let inHours = 0
      let inCost = 0
      for (const d of p.byWorkDate) {
        if (!ymdInRange(d.workDate, range)) continue
        inHours += d.hours
        inCost += d.cost
      }
      if (inHours === 0 && inCost === 0) continue
      const key = resolver.keyForName(p.personName)
      const billing = revenue > 0 && jobAllTimeHours > 0 ? revenue * (inHours / jobAllTimeHours) : 0
      const a = acc(key)
      a.hours += inHours
      a.laborCost += inCost
      a.billing += billing
      a.perJob.push({
        kind: 'crew',
        jobId: row.jobId,
        label: job?.jobLabel ?? row.jobId,
        hours: inHours,
        laborCost: inCost,
        billing,
        estimated: false,
      })
    }
  }

  // Equal-split fallback billing for revenue jobs with no clocked crew hours.
  for (const job of jobs) {
    const revenue = job.revenue != null ? Number(job.revenue) : 0
    if (revenue <= 0 || job.teamMembers.length === 0 || jobsWithCrewHours.has(job.id)) continue
    if (!ymdInRange(job.fallbackDate, range)) continue
    const share = revenue / job.teamMembers.length
    for (const tm of job.teamMembers) {
      const key = resolver.keyForUser(tm.userId, tm.userName)
      const a = acc(key)
      a.billing += share
      a.hasEstimated = true
      a.perJob.push({
        kind: 'billing-fallback',
        jobId: job.id,
        label: job.jobLabel,
        hours: 0,
        laborCost: 0,
        billing: share,
        estimated: true,
      })
    }
  }

  // Sub-sheet labor: cost/hours split equally among the assigned names.
  for (const lj of subLabor) {
    if (lj.assignedNames.length === 0 || lj.cost <= 0) continue
    if (!ymdInRange(lj.jobDate, range)) continue
    const costShare = lj.cost / lj.assignedNames.length
    const hoursShare = lj.hours / lj.assignedNames.length
    for (const name of lj.assignedNames) {
      const key = resolver.keyForName(name)
      const a = acc(key)
      a.laborCost += costShare
      a.hours += hoursShare
      a.perJob.push({
        kind: 'sub',
        jobId: null,
        label: lj.jobLabel,
        hours: hoursShare,
        laborCost: costShare,
        billing: 0,
        estimated: false,
      })
    }
  }

  const rows: CrewPnlPersonRow[] = [...byKey.entries()].map(([key, a]) => {
    const profit = a.billing - a.laborCost
    return {
      key,
      displayName: resolver.displayName(key),
      hours: a.hours,
      laborCost: a.laborCost,
      billing: a.billing,
      profit,
      billingPerHour: a.hours > 0 ? a.billing / a.hours : null,
      hasEstimatedBilling: a.hasEstimated,
      unmatched: resolver.isUnmatched(key),
      perJob: a.perJob,
    }
  })
  rows.sort((x, y) => y.profit - x.profit)

  const totals = rows.reduce(
    (t, r) => ({
      hours: t.hours + r.hours,
      laborCost: t.laborCost + r.laborCost,
      billing: t.billing + r.billing,
      profit: t.profit + r.profit,
    }),
    { hours: 0, laborCost: 0, billing: 0, profit: 0 },
  )

  return { rows, totals }
}

export type CrewPnlRangePreset = 'all' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year'

/** Preset → inclusive YMD range, from a caller-supplied "today" YMD (APP_CALENDAR_TZ). Pure string math. */
export function crewPnlRangeForPreset(todayYmd: string, preset: CrewPnlRangePreset): CrewPnlRange {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayYmd)
  if (!m || preset === 'all') return { start: null, end: null }
  const year = Number(m[1])
  const month = Number(m[2])
  const mm = (n: number) => String(n).padStart(2, '0')
  if (preset === 'this_month') return { start: `${year}-${mm(month)}-01`, end: todayYmd }
  if (preset === 'last_month') {
    const y = month === 1 ? year - 1 : year
    const mo = month === 1 ? 12 : month - 1
    const lastDay = new Date(y, mo, 0).getDate()
    return { start: `${y}-${mm(mo)}-01`, end: `${y}-${mm(mo)}-${mm(lastDay)}` }
  }
  if (preset === 'this_quarter') {
    const qStartMonth = Math.floor((month - 1) / 3) * 3 + 1
    return { start: `${year}-${mm(qStartMonth)}-01`, end: todayYmd }
  }
  return { start: `${year}-01-01`, end: todayYmd }
}
