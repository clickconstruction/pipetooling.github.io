/**
 * Crew names on the Pipeline (v2.3373): the Crew & Dates cell shows the people
 * still with the company and folds archived accounts into one "and N archived"
 * tail; the whole line opens the crew modal — everyone who has been on the job
 * with their hours, days and last day. Pure: rows in, names / rows out.
 */

export type StagesCrewMember = {
  user_id: string
  users: { name: string; archived_at?: string | null; role?: string | null } | null
}

export type StagesCrewSplit = {
  /** Names of members whose account is live, in the team list's own order. */
  active: string[]
  /** Names of members whose account is archived, same order. */
  archived: string[]
}

function cleanName(m: StagesCrewMember): string {
  return (m.users?.name ?? '').trim()
}

/** Live accounts first (team order kept), archived accounts aside. Nameless rows are dropped. */
export function splitStagesCrew(members: ReadonlyArray<StagesCrewMember> | null | undefined): StagesCrewSplit {
  const active: string[] = []
  const archived: string[] = []
  for (const m of members ?? []) {
    const name = cleanName(m)
    if (!name) continue
    if (m.users?.archived_at) archived.push(name)
    else active.push(name)
  }
  return { active, archived }
}

/** "and 5 archived" / "5 archived" (nobody live) — the folded tail's words; null when nobody is archived. */
export function stagesCrewArchivedTail(split: StagesCrewSplit): string | null {
  if (split.archived.length === 0) return null
  const n = split.archived.length
  return split.active.length > 0 ? `and ${n} archived` : `${n} archived`
}

/** The one-line summary with the tail, for the phone sheet's "Crew: …" header; null when the job has no crew. */
export function stagesCrewSummary(members: ReadonlyArray<StagesCrewMember> | null | undefined): string | null {
  const split = splitStagesCrew(members)
  const tail = stagesCrewArchivedTail(split)
  const parts = [...split.active]
  if (tail) parts.push(tail)
  return parts.length ? parts.join(', ') : null
}

/** One person's hours on the job (the crew-sheet breakdown the Costs tab counts). */
export type StagesCrewHours = {
  personName: string
  hours: number
  byWorkDate: ReadonlyArray<{ workDate: string; hours: number }>
}

export type StagesCrewRow = {
  key: string
  name: string
  userId: string | null
  role: string | null
  /** ISO timestamp when the account was archived; null for a live account. */
  archivedAt: string | null
  hours: number
  /** Work dates with hours on the job. */
  days: number
  /** The latest work date with hours, YYYY-MM-DD; null when none. */
  lastDay: string | null
}

export type StagesCrewModel = {
  /** The job's team: live accounts by hours, then archived accounts by hours. */
  crew: StagesCrewRow[]
  /** People with hours on the job who are not on its team, by hours. */
  others: StagesCrewRow[]
  totalHours: number
}

function nameKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function hoursFacts(h: StagesCrewHours | undefined): Pick<StagesCrewRow, 'hours' | 'days' | 'lastDay'> {
  if (!h) return { hours: 0, days: 0, lastDay: null }
  let days = 0
  let lastDay: string | null = null
  for (const d of h.byWorkDate) {
    if (!(d.hours > 0)) continue
    days += 1
    if (lastDay == null || d.workDate > lastDay) lastDay = d.workDate
  }
  return { hours: Math.round(h.hours * 10) / 10, days, lastDay }
}

function byHoursThenName(a: StagesCrewRow, b: StagesCrewRow): number {
  return b.hours - a.hours || a.name.localeCompare(b.name)
}

/**
 * The modal's rows. Hours match a team member by name (the breakdown is keyed by
 * pay name, as everywhere else); anyone with hours who is not on the team lands
 * in `others`. Live accounts sort before archived ones, each by hours.
 */
export function buildStagesCrewModel(args: {
  members: ReadonlyArray<StagesCrewMember> | null | undefined
  hours: ReadonlyArray<StagesCrewHours> | null | undefined
}): StagesCrewModel {
  const hoursByName = new Map<string, StagesCrewHours>()
  for (const h of args.hours ?? []) hoursByName.set(nameKey(h.personName), h)
  const seen = new Set<string>()
  const live: StagesCrewRow[] = []
  const gone: StagesCrewRow[] = []
  for (const m of args.members ?? []) {
    const name = cleanName(m)
    if (!name) continue
    const k = nameKey(name)
    if (seen.has(k)) continue
    seen.add(k)
    const row: StagesCrewRow = {
      key: `m:${m.user_id}`,
      name,
      userId: m.user_id,
      role: m.users?.role ?? null,
      archivedAt: m.users?.archived_at ?? null,
      ...hoursFacts(hoursByName.get(k)),
    }
    ;(row.archivedAt ? gone : live).push(row)
  }
  const others: StagesCrewRow[] = []
  for (const h of args.hours ?? []) {
    const k = nameKey(h.personName)
    if (seen.has(k)) continue
    const facts = hoursFacts(h)
    // Under three minutes on the job is a crew-sheet rounding artefact, not a person to list.
    if (!(facts.hours > 0)) continue
    seen.add(k)
    others.push({ key: `h:${k}`, name: h.personName.trim(), userId: null, role: null, archivedAt: null, ...facts })
  }
  live.sort(byHoursThenName)
  gone.sort(byHoursThenName)
  others.sort(byHoursThenName)
  const totalHours = Math.round((args.hours ?? []).reduce((s, h) => s + (h.hours > 0 ? h.hours : 0), 0) * 10) / 10
  return { crew: [...live, ...gone], others, totalHours }
}
