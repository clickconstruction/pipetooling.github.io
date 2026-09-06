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
    /** people.id from the source rows (Phase C-1); preferred over name matching when present. */
    personId?: string | null
    byWorkDate: Array<{ workDate: string; hours: number; cost: number }>
  }>
}

export type CrewPnlSubLaborInput = {
  /** Raw sheet job_number text (audit display for unlinked sheets). */
  jobNumberText?: string | null
  /** jobs_ledger id when the sheet's job_number matched a job (HCP or C#); null = unlinked. */
  jobId: string | null
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
  /** Billing from equal-split fallback lines only — the tab's least trustworthy math (B8, J8-F1). */
  fallbackBilling: number
  /** Equal-split guesses are at least half the billing: badged "≈ estimated" and ranked below real rows in every numeric sort (J8-F1 / N1). */
  estimateLed: boolean
  /** True when the identity did not resolve to a roster person. */
  unmatched: boolean
  /** Sub-sheet dollars in range that matched NO job — cost with no billing credit (v2.977). */
  unlinkedSubCost: number
  perJob: CrewPnlJobLine[]
}

export type CrewPnlSummary = {
  rows: CrewPnlPersonRow[]
  totals: { hours: number; laborCost: number; billing: number; profit: number }
  /** Sub-labor linkage audit (v2.977): how much sub money actually reached a job. */
  subLabor: {
    total: number
    linkedTotal: number
    unlinkedSheets: Array<{ id: string; jobNumberText: string | null; assignedNames: string[]; cost: number }>
  }
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

/** Spelling-tolerant form for the loose tiers (B8, J8-F2): no diacritics, no punctuation, one space between words. */
export function looseCrewPnlName(name: string | null | undefined): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nameTokens(loose: string): string[] {
  return loose ? loose.split(' ') : []
}

/** "j" covers "jose" (an initial), otherwise tokens must be equal. */
function tokenCovers(free: string, roster: string): boolean {
  return free === roster || (free.length === 1 && roster.startsWith(free))
}

/** Every `needle` token is covered by a distinct `haystack` token (order-free: "Garcia, Jose" ⊆ "Jose Luis Garcia"). */
function tokensCovered(needle: string[], haystack: string[]): boolean {
  const used = new Set<number>()
  for (const n of needle) {
    const idx = haystack.findIndex((h, i) => !used.has(i) && tokenCovers(n, h))
    if (idx < 0) return false
    used.add(idx)
  }
  return true
}

/**
 * Resolve a free-text spelling to the ONE roster person it can only mean, or null (B8, J8-F2).
 * Tiers, each accepted only on a single candidate — two hits is "ambiguous", which stays unmatched
 * because a wrong merge moves money to the wrong person while a split row is merely annoying:
 *   1. exact normalized name (trim/lower) — the pre-B8 rule, handled by the caller;
 *   2. loose equality ("José García." = "jose garcia");
 *   3. token containment with ≥2 tokens on the shorter side ("Jose Garcia" ⊆ "Jose Luis Garcia",
 *      "J. Garcia" ⊆ "Jose Garcia"). Single first names never merge — too many Joses.
 */
export function resolveCrewPnlNameLoosely(name: string | null | undefined, people: CrewPnlRosterPerson[]): CrewPnlRosterPerson | null {
  const loose = looseCrewPnlName(name)
  if (!loose) return null
  const equal = people.filter((p) => looseCrewPnlName(p.name) === loose)
  if (equal.length === 1) return equal[0] ?? null
  if (equal.length > 1) return null
  const free = nameTokens(loose)
  if (free.length < 2) return null
  const contained = people.filter((p) => {
    const roster = nameTokens(looseCrewPnlName(p.name))
    if (roster.length < 2) return false
    return tokensCovered(free, roster) || tokensCovered(roster, free)
  })
  return contained.length === 1 ? contained[0] ?? null : null
}

export type CrewPnlPersonResolver = {
  keyForName: (name: string | null | undefined) => string
  /** Stored people.id wins outright (Phase C-1); falls back to name matching when absent. */
  keyForPerson: (personId: string | null | undefined, fallbackName: string | null | undefined) => string
  keyForUser: (userId: string | null | undefined, fallbackName: string | null | undefined) => string
  displayName: (key: string) => string
  isUnmatched: (key: string) => boolean
}

/** Roster-based identity: person id when a name/account matches, normalized name otherwise. */
export function buildCrewPnlPersonResolver(people: CrewPnlRosterPerson[]): CrewPnlPersonResolver {
  const byName = new Map<string, CrewPnlRosterPerson>()
  const byUserId = new Map<string, CrewPnlRosterPerson>()
  const byId = new Map<string, CrewPnlRosterPerson>()
  for (const p of people) {
    const n = normName(p.name)
    if (n && !byName.has(n)) byName.set(n, p)
    if (p.accountUserId) byUserId.set(p.accountUserId, p)
    byId.set(p.id, p)
  }
  const displayByKey = new Map<string, string>()
  // Loose resolution is O(roster) per distinct spelling; memoize by normalized name (null = stays free text).
  const looseByNorm = new Map<string, CrewPnlRosterPerson | null>()
  function keyForName(name: string | null | undefined): string {
    const n = normName(name)
    if (!n) return rememberKey('n:', 'Unknown')
    const p = byName.get(n)
    if (p) return rememberKey(`p:${p.id}`, (p.name ?? '').trim() || 'Unknown')
    let loose = looseByNorm.get(n)
    if (loose === undefined) {
      loose = resolveCrewPnlNameLoosely(name, people)
      looseByNorm.set(n, loose)
    }
    if (loose) return rememberKey(`p:${loose.id}`, (loose.name ?? '').trim() || 'Unknown')
    return rememberKey(`n:${n}`, (name ?? '').trim())
  }
  function keyForPerson(personId: string | null | undefined, fallbackName: string | null | undefined): string {
    if (personId) {
      const p = byId.get(personId)
      const display = (p?.name ?? fallbackName ?? '').trim() || 'Unknown'
      return rememberKey(`p:${personId}`, display)
    }
    return keyForName(fallbackName)
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
    keyForPerson,
    keyForUser,
    displayName: (key) => displayByKey.get(key) ?? key.replace(/^n:/, ''),
    isUnmatched: (key) => key.startsWith('n:'),
  }
}

/** $/hr used to impute "equivalent hours" for flat-rate sub sheets (dev-tunable via app_settings). */
export const DEFAULT_SUB_LABOR_EQUIVALENT_RATE = 50

export function buildCrewPnlSummary(args: {
  jobs: CrewPnlJobInput[]
  teamLabor: CrewPnlTeamLaborInput[]
  subLabor: CrewPnlSubLaborInput[]
  people: CrewPnlRosterPerson[]
  range: CrewPnlRange
  /** cost ÷ this rate = a flat-rate sub sheet's equivalent hours (default 50). */
  subLaborEquivalentRate?: number
}): CrewPnlSummary {
  const { jobs, teamLabor, subLabor, people, range } = args
  const equivalentRate = args.subLaborEquivalentRate != null && args.subLaborEquivalentRate > 0
    ? args.subLaborEquivalentRate
    : DEFAULT_SUB_LABOR_EQUIVALENT_RATE
  const resolver = buildCrewPnlPersonResolver(people)
  const jobById = new Map(jobs.map((j) => [j.id, j]))

  type Acc = { hours: number; laborCost: number; billing: number; fallbackBilling: number; perJob: CrewPnlJobLine[]; hasEstimated: boolean; unlinkedSubCost: number }
  const byKey = new Map<string, Acc>()
  function acc(key: string): Acc {
    let a = byKey.get(key)
    if (!a) {
      a = { hours: 0, laborCost: 0, billing: 0, fallbackBilling: 0, perJob: [], hasEstimated: false, unlinkedSubCost: 0 }
      byKey.set(key, a)
    }
    return a
  }

  // Sub-sheet effective hours per linked job (v2.974): real sheet hours when
  // present, else cost ÷ equivalentRate — the common unit that lets flat-rate
  // subs share revenue with clocked crews on equal footing.
  // v2.977: sub shares weight by DOLLARS, always — sheet unit-hours are
  // piece-rate accounting, not effort, and underweighted mixed sheets. All
  // sub equivalent hours are estimates (the ≈ affordance).
  type SubEff = { input: CrewPnlSubLaborInput; effHours: number; imputed: boolean }
  const subEffBySheet = new Map<string, SubEff>()
  const subEffHoursByJob = new Map<string, number>()
  for (const lj of subLabor) {
    const effHours = lj.cost > 0 ? lj.cost / equivalentRate : 0
    const imputed = effHours > 0
    subEffBySheet.set(lj.id, { input: lj, effHours, imputed })
    if (lj.jobId && effHours > 0) {
      subEffHoursByJob.set(lj.jobId, (subEffHoursByJob.get(lj.jobId) ?? 0) + effHours)
    }
  }

  // Crew labor + hours-weighted billing (denominator now includes sub equivalent hours).
  const jobsWithCrewHours = new Set<string>()
  const crewHoursByJob = new Map<string, number>()
  for (const row of teamLabor) {
    const job = jobById.get(row.jobId)
    const revenue = job?.revenue != null && Number(job.revenue) > 0 ? Number(job.revenue) : 0
    const jobAllTimeCrewHours = row.breakdown.reduce(
      (s, p) => s + p.byWorkDate.reduce((h, d) => h + d.hours, 0),
      0,
    )
    const jobAllTimeHours = jobAllTimeCrewHours + (subEffHoursByJob.get(row.jobId) ?? 0)
    if (jobAllTimeCrewHours > 0) jobsWithCrewHours.add(row.jobId)
    crewHoursByJob.set(row.jobId, jobAllTimeHours)
    for (const p of row.breakdown) {
      let inHours = 0
      let inCost = 0
      for (const d of p.byWorkDate) {
        if (!ymdInRange(d.workDate, range)) continue
        inHours += d.hours
        inCost += d.cost
      }
      if (inHours === 0 && inCost === 0) continue
      const key = resolver.keyForPerson(p.personId, p.personName)
      const billing = revenue > 0 && jobAllTimeHours > 0 ? revenue * (inHours / jobAllTimeHours) : 0
      const a = acc(key)
      a.hours += inHours
      a.laborCost += inCost
      a.billing += billing
      a.perJob.push({
        kind: 'crew',
        jobId: row.jobId,
        label: job?.jobLabel ?? 'Unknown job',
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
    if (revenue <= 0 || job.teamMembers.length === 0 || jobsWithCrewHours.has(job.id) || (subEffHoursByJob.get(job.id) ?? 0) > 0) continue
    if (!ymdInRange(job.fallbackDate, range)) continue
    const share = revenue / job.teamMembers.length
    for (const tm of job.teamMembers) {
      const key = resolver.keyForUser(tm.userId, tm.userName)
      const a = acc(key)
      a.billing += share
      a.fallbackBilling += share
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

  // Sub-sheet labor (v2.974): cost + EFFECTIVE hours split equally among the
  // assigned names; sheets linked to a revenue job now receive their
  // hours-weighted revenue share from the same denominator as clocked crew —
  // a $3,000 flat sheet at the equivalent rate weighs like 100 clocked hours.
  // Imputed hours/billing carry estimated=true (the ≈ affordance).
  let subTotal = 0
  let subLinkedTotal = 0
  const unlinkedSheets: CrewPnlSummary['subLabor']['unlinkedSheets'] = []
  for (const lj of subLabor) {
    if (lj.assignedNames.length === 0 || lj.cost <= 0) continue
    if (!ymdInRange(lj.jobDate, range)) continue
    subTotal += lj.cost
    if (lj.jobId) subLinkedTotal += lj.cost
    else unlinkedSheets.push({ id: lj.id, jobNumberText: (lj.jobNumberText ?? '').trim() || null, assignedNames: lj.assignedNames, cost: lj.cost })
    const eff = subEffBySheet.get(lj.id)
    const effHours = eff?.effHours ?? 0
    const imputed = eff?.imputed ?? false
    const job = lj.jobId ? jobById.get(lj.jobId) : undefined
    const revenue = job?.revenue != null && Number(job.revenue) > 0 ? Number(job.revenue) : 0
    const jobDenominator = lj.jobId ? crewHoursByJob.get(lj.jobId) ?? subEffHoursByJob.get(lj.jobId) ?? 0 : 0
    const sheetBilling = revenue > 0 && jobDenominator > 0 ? revenue * (effHours / jobDenominator) : 0
    const costShare = lj.cost / lj.assignedNames.length
    const hoursShare = effHours / lj.assignedNames.length
    const billingShare = sheetBilling / lj.assignedNames.length
    for (const name of lj.assignedNames) {
      const key = resolver.keyForName(name)
      const a = acc(key)
      a.laborCost += costShare
      a.hours += hoursShare
      a.billing += billingShare
      if (!lj.jobId) a.unlinkedSubCost += costShare
      if (imputed && (hoursShare > 0 || billingShare > 0)) a.hasEstimated = true
      a.perJob.push({
        kind: 'sub',
        jobId: lj.jobId,
        label: job?.jobLabel ?? lj.jobLabel,
        hours: hoursShare,
        laborCost: costShare,
        billing: billingShare,
        estimated: imputed,
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
      fallbackBilling: a.fallbackBilling,
      estimateLed: crewPnlRowIsEstimateLed(a.fallbackBilling, a.billing),
      unmatched: resolver.isUnmatched(key),
      unlinkedSubCost: a.unlinkedSubCost,
      perJob: a.perJob,
    }
  })
  rows.sort((x, y) => compareCrewPnlRows(x, y, 'profit', 'desc'))

  const totals = rows.reduce(
    (t, r) => ({
      hours: t.hours + r.hours,
      laborCost: t.laborCost + r.laborCost,
      billing: t.billing + r.billing,
      profit: t.profit + r.profit,
    }),
    { hours: 0, laborCost: 0, billing: 0, profit: 0 },
  )

  unlinkedSheets.sort((a, b) => b.cost - a.cost)
  return { rows, totals, subLabor: { total: subTotal, linkedTotal: subLinkedTotal, unlinkedSheets } }
}

/**
 * Estimate-led (B8, J8-F1 / N1): equal-split guesses are at least half the row's billing. Covers the
 * pure-fallback shape (no hours, no cost, six-figure "profit") and the outlier whose one fallback job
 * dwarfs its real work (≈7.5× the next $/hr live). Sub-sheet ≈ (equivalent hours) is a calibration,
 * not a guess, and never demotes a row on its own.
 */
export function crewPnlRowIsEstimateLed(fallbackBilling: number, billing: number): boolean {
  return fallbackBilling > 0 && fallbackBilling * 2 >= billing
}

export type CrewPnlSortKey = 'name' | 'hours' | 'laborCost' | 'billing' | 'profit' | 'rate'

function crewPnlSortValue(row: CrewPnlPersonRow, key: CrewPnlSortKey): number | string {
  if (key === 'name') return row.displayName.toLowerCase()
  if (key === 'hours') return row.hours
  if (key === 'laborCost') return row.laborCost
  if (key === 'billing') return row.billing
  if (key === 'rate') return row.billingPerHour ?? -Infinity
  return row.profit
}

/**
 * Row order for the table (B8): every NUMERIC sort keeps real rows ahead of estimate-led rows in
 * both directions — the ranking question ("who earns?") must never be answered by an equal-split
 * artifact, and flipping to ascending should not float the artifacts to the top either. Within a
 * band: the key in the asked direction, then name A→Z so the order is stable. The name sort is a
 * lookup, not a ranking, so it is plain alphabetical.
 */
export function compareCrewPnlRows(a: CrewPnlPersonRow, b: CrewPnlPersonRow, key: CrewPnlSortKey, direction: 'asc' | 'desc'): number {
  if (key !== 'name' && a.estimateLed !== b.estimateLed) return a.estimateLed ? 1 : -1
  const dir = direction === 'asc' ? 1 : -1
  const va = crewPnlSortValue(a, key)
  const vb = crewPnlSortValue(b, key)
  if (va < vb) return -1 * dir
  if (va > vb) return 1 * dir
  if (key === 'name') return 0
  const na = a.displayName.toLowerCase()
  const nb = b.displayName.toLowerCase()
  return na < nb ? -1 : na > nb ? 1 : 0
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
