import { supabase } from '../supabase'
import { kindNeedsTeam, type BringBackFacts } from './bringBack'
import { loadPayConfigFacts } from './personDeskFacts'
import type { PersonKey } from './personKey'

/**
 * The reads behind the Bring back window (punch list #256 PR 3, v2.6523), the mirror of
 * `loadStartEmploymentFacts`. Every query is one a desk section already runs; RLS decides what
 * the viewer sees, and a table they cannot read degrades to "unknown" (a null count, an empty
 * list), never to a false "all clear". Nothing here writes.
 */

export type StintRow = { id: string; start_date: string | null; end_date: string | null }

export type BringBackLoad = {
  facts: BringBackFacts
  /** The day their employment ended. Null when the roster row has no end date: Bring back is not the door then. */
  leftYmd: string | null
  /** The account half is archived (a login or a #260 row with none). */
  loginArchived: boolean
  personArchived: boolean
  /** Every stint kept, oldest first (`employment_stints`, v2.6481). */
  stints: StintRow[]
  /** Their open roadmap tasks parked when they were archived; null when the viewer cannot read the table (a dev's). */
  parkedTasks: number | null
  /** Training mode as the account has it now. */
  trainingOn: boolean
}

type UserRow = { id: string; email: string | null; archived_at: string | null; read_only: boolean | null; last_sign_in_at: string | null; login_attached_at?: string | null }
type PersonRow = { start_date: string | null; end_date: string | null; archived_at: string | null; kind: string | null }
type DocRow = { signed_at: string | null; created_at: string | null }
type TeamMemberRow = { team_id: string; people_teams: { id: string; name: string } | null }

function ymd(iso: string | null | undefined): string | null {
  if (!iso) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
  return m?.[1] ?? null
}

export async function loadBringBackFacts(key: PersonKey, backYmd: string): Promise<BringBackLoad> {
  const userId = key.userId
  const personId = key.personId
  const payName = key.payName

  const [userRes, personRes, stintsRes, pay, licensesRes, docsRes, assignmentsRes, vehiclesRes, housingRes, teamByIdRes, teamByNameRes, parkedRes] = await Promise.all([
    userId ? supabase.from('users').select('id, email, archived_at, read_only, last_sign_in_at, login_attached_at').eq('id', userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    personId ? supabase.from('people').select('start_date, end_date, archived_at, kind').eq('id', personId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    personId ? supabase.from('employment_stints').select('id, start_date, end_date').eq('person_id', personId).order('start_date', { ascending: true, nullsFirst: true }) : Promise.resolve({ data: [], error: null }),
    loadPayConfigFacts(payName),
    payName ? supabase.from('person_licenses').select('license_type, date_of_expiry').eq('person_name', payName) : Promise.resolve({ data: [], error: null }),
    personId ? supabase.from('person_contract_documents').select('signed_at, created_at').eq('person_id', personId) : Promise.resolve({ data: [], error: null }),
    payName ? supabase.from('person_contract_assignments').select('created_at').eq('person_name', payName) : Promise.resolve({ data: [], error: null }),
    userId ? supabase.from('vehicle_possessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('end_date', null) : Promise.resolve({ count: 0 }),
    userId ? supabase.from('housing_possessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('end_date', null) : Promise.resolve({ count: 0 }),
    personId ? supabase.from('people_team_members').select('team_id, people_teams(id, name)').eq('person_id', personId).limit(1) : Promise.resolve({ data: [], error: null }),
    payName ? supabase.from('people_team_members').select('team_id, people_teams(id, name)').eq('person_name', payName).limit(1) : Promise.resolve({ data: [], error: null }),
    userId ? supabase.from('checklist_tech_tree_task_assignees_parked').select('task_id', { count: 'exact', head: true }).eq('user_id', userId) : Promise.resolve({ count: null, error: null }),
  ])

  const user = ((userRes as { data: UserRow | null }).data ?? null) as UserRow | null
  const person = ((personRes as { data: PersonRow | null }).data ?? null) as PersonRow | null
  const stints = (((stintsRes as { data: StintRow[] | null }).data ?? []) as StintRow[]).slice()
  // The oldest first, a stint with no start before any dated one.
  stints.sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))

  // The day they left: the roster row's end date, else the last closed stint's.
  const leftYmd = person?.end_date ?? [...stints].reverse().find((s) => s.end_date)?.end_date ?? null
  const boundary = leftYmd ?? backYmd

  const licenses = (((licensesRes as { data: Array<{ license_type: string; date_of_expiry: string | null }> | null }).data ?? []) as Array<{ license_type: string; date_of_expiry: string | null }>).map((l) => ({
    name: l.license_type,
    date_of_expiry: l.date_of_expiry,
  }))

  const docs = ((docsRes as { data: DocRow[] | null }).data ?? []) as DocRow[]
  const signedEarlier = docs.map((d) => ymd(d.signed_at)).filter((d): d is string => d != null && d <= boundary)
  const assignments = ((assignmentsRes as { data: Array<{ created_at: string | null }> | null }).data ?? []) as Array<{ created_at: string | null }>
  const assignedSinceBack =
    assignments.some((a) => (ymd(a.created_at) ?? '') > boundary) || docs.some((d) => (ymd(d.created_at) ?? '') > boundary)

  const teamRows = [
    ...(((teamByIdRes as { data: TeamMemberRow[] | null }).data ?? []) as TeamMemberRow[]),
    ...(((teamByNameRes as { data: TeamMemberRow[] | null }).data ?? []) as TeamMemberRow[]),
  ]
  const teamRow = teamRows.find((t) => t.people_teams) ?? null
  const team = teamRow && teamRow.people_teams ? { id: teamRow.people_teams.id, name: teamRow.people_teams.name } : null

  const parked = parkedRes as { count: number | null; error: unknown }
  const parkedTasks = parked.error ? null : (parked.count ?? null)

  const hasLogin = Boolean(userId) && user?.login_attached_at !== null && user?.login_attached_at !== undefined

  const facts: BringBackFacts = {
    backYmd,
    leftYmd: boundary,
    hasLogin: Boolean(userId) && hasLogin,
    hasRosterRow: Boolean(personId),
    signInEmail: hasLogin ? (user?.email ?? null) : null,
    lastSignInYmd: ymd(user?.last_sign_in_at),
    pay: pay && pay.exists ? { hourlyWage: pay.hourlyWage, isSalary: pay.isSalary, setYmd: null } : null,
    needsTeam: kindNeedsTeam(person?.kind ?? key.personKind),
    team,
    licenses,
    paperworkSignedEarlier: { count: signedEarlier.length, lastYmd: signedEarlier.length > 0 ? (signedEarlier.sort()[signedEarlier.length - 1] ?? null) : null },
    paperworkAssignedSinceBack: assignedSinceBack,
    vehiclesHeld: (vehiclesRes as { count: number | null }).count ?? 0,
    housing: (housingRes as { count: number | null }).count ?? 0,
  }

  return {
    facts,
    leftYmd,
    loginArchived: Boolean(userId) && Boolean(user?.archived_at),
    personArchived: Boolean(personId) && Boolean(person?.archived_at),
    stints,
    parkedTasks,
    trainingOn: Boolean(user?.read_only),
  }
}
