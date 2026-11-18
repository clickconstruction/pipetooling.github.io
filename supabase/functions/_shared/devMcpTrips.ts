// A trip to a site away from home, from the dev seat (v2.7670 / 0.100.0, punch list #379 PR 4). A trip is one going-out
// to a site and coming back, kept on a development (or on a job that has none): who went, and for each person their
// days, each Getting ready, On the road or At the site. The seat reads a site's trips (read_trips) and files one
// (plan_trip → apply_trip) so trips already known from a ledger can be kept on the owner's word.
//
// One write door, the app's own: `trip_save(p, p_dry_run)` (migration 20261117234500), SECURITY INVOKER, so the trip
// lands under the dev's own RLS, whole or not at all. The seat adds nothing to it but `via: 'mcp'` and the robot's
// name. A trip is a reading laid over the clock: nothing here names a clock row, a bill or a cost. There is no delete
// verb; deleting a trip is done in the app.
//
// The rules are not written twice: where a trip stands, its first and last day and its counts by kind come from the
// kernel copy of `src/lib/trips/tripDays.ts`, the file the Trips look reads.
//
// Three things happen before the dry run, the same way at plan and at apply, so the two hash alike:
//   - the days are read into the one stored form, `{ "YYYY-MM-DD": kind }`, whether they came that way or as runs;
//   - a trip with no id is given one made from its own words (`tripStableId`), because `trip_save` makes a random id
//     for a dry run with none and a plan and its apply would then never agree;
//   - a person given by name alone is looked for on the roster (`fillTripPeople`); one match ties them to their
//     roster row and login, and anything else leaves a name alone. A roster that changed between plan and apply
//     changes the payload, so the apply is refused and the plan is read again.
//
// Pure: no env reads, no network. The reads come in through the Reader, so the tests run over a fake
// (src/lib/devMcp/devMcpTrips.test.ts). The id's hash uses the platform's crypto.subtle, which Deno and Node both have.

import { readAllRows, readRowsByIds, type Reader, type Row } from './devMcpComposites.ts'
import type { RowFilter } from './devMcpDoor.ts'
import {
  TRIP_STANDING_LABEL,
  daysBetween,
  daysInRange,
  isTripDayKind,
  isYmd,
  parseTripDays,
  personDayCounts,
  sortTrips,
  tripDayCounts,
  tripSpan,
  tripStanding,
  type Trip,
  type TripDayCounts,
  type TripDayKind,
  type TripStanding,
} from './gcKernels/lib/trips/tripDays.ts'

export const TRIP_VERBS = ['plan_trip', 'apply_trip'] as const
export type TripVerb = (typeof TRIP_VERBS)[number]

export function isTripVerb(name: string): name is TripVerb {
  return (TRIP_VERBS as readonly string[]).includes(name)
}

/** The table's own limits (migration 20261117234500), said in words before the ask leaves. */
export const TRIP_PURPOSE_MAX = 500
export const TRIP_ASKED_MAX = 200
export const TRIP_OUTCOME_MAX = 2000
export const TRIP_NAME_MAX = 200
export const TRIP_AGENT_LABEL_MAX = 120
/** The longest run of days one `{ from, to, kind }` may paint. */
export const TRIP_RUN_MAX_DAYS = 120
/** The seat's own ceilings, so one call stays a trip and not a calendar. */
export const TRIP_PEOPLE_MAX = 50
export const TRIP_PERSON_DAYS_MAX = 366
export const TRIP_JOBS_MAX = 50

/**
 * The three tables' columns the reads filter and order by. The tables are younger than the generated catalog, so until
 * a types PR brings them in the server reads them by these lists; after it, the catalog's own entry is used.
 */
export const TRIP_TABLE_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  trips: ['id', 'development_id', 'job_id', 'purpose', 'asked_by', 'asked_who', 'asked_how', 'outcome', 'billing', 'via', 'agent_label', 'created_by', 'updated_by', 'created_at', 'updated_at'],
  trip_people: ['id', 'trip_id', 'person_id', 'user_id', 'person_name', 'days', 'created_at'],
  trip_jobs: ['trip_id', 'job_id', 'created_at'],
}

/** A trip whole in one read: the row with its people and its jobs, as the Trips look asks for it. */
export const TRIP_SELECT = 'id,development_id,job_id,purpose,asked_by,asked_who,asked_how,outcome,billing,via,agent_label,created_at,updated_at,trip_people(person_id,user_id,person_name,days),trip_jobs(job_id)'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const by = (column: string, value: string): RowFilter[] => [{ column, op: 'eq', value }]
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const nameKey = (name: string) => name.trim().toLowerCase()

// ── the input ────────────────────────────────────────────────────────────────────────────────────────────────────

export type TripAskedBy = 'us' | 'them'
export type TripBilling = 'inside' | 'extra' | 'ours'

export type TripPersonPayload = {
  name: string
  /** The roster person (people.id). */
  person_id?: string
  /** The person's login (users.id), which is how the clock names them. */
  user_id?: string
  /** The stored form: the day, and its kind. A day off is a day that is not here. */
  days: Record<string, TripDayKind>
}

/** What `trip_save` takes as `p`, as the seat sends it. */
export type TripPayload = {
  id?: string
  development_id?: string
  job_id?: string
  purpose?: string
  asked_by?: TripAskedBy
  asked_who?: string
  asked_how?: string
  outcome?: string
  billing?: TripBilling
  via: 'mcp'
  agent_label: string
  people: TripPersonPayload[]
  job_ids: string[]
}

export type TripInput = { ok: true; p: TripPayload; target: string } | { ok: false; error: string }

const SHAPE = `needs trip — { development_id (a developments.id: read_rows on developments by name) OR job_id (a jobs_ledger.id, for a job with no development: find_job), people: [{ name, days, person_id?, user_id? }] (who went; a name alone is looked for on the roster), agent_label (the robot's name as the trip shows it, at most ${TRIP_AGENT_LABEL_MAX} characters), id? (a trips.id, to change that trip whole: read_trips lists them), purpose? (what for), asked_by? (us | them), asked_who? and asked_how? (with them: who asked, and how), outcome? (how it went), billing? (inside | extra | ours), job_ids? (the jobs its work goes on) }. days is { "YYYY-MM-DD": "ready" | "road" | "site" }, or a list of runs [{ from, to?, kind }] where a run with no to is one day and a later run wins a day two runs name.`

/**
 * A person's days in the one stored form, from either form a call may give: an object of day to kind, or a list of
 * runs `{ from, to?, kind }` (no `to` is one day; a later run wins a day two runs name). `why` says what is wrong, in
 * words, and names the day or the kind.
 */
export function tripDaysFrom(raw: unknown): { ok: true; days: Record<string, TripDayKind> } | { ok: false; why: string } {
  const out: Record<string, TripDayKind> = {}
  const notAKind = (kind: unknown) => `${JSON.stringify(kind ?? null)} is not a kind of day; a day is ready, road or site`
  const notADay = (day: unknown) => `${JSON.stringify(day ?? null)} is not a real calendar day (YYYY-MM-DD)`
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const run = obj(item)
      if (!run) return { ok: false, why: 'a run is { from, to?, kind }' }
      const from = typeof run.from === 'string' ? run.from.trim() : run.from
      const to = run.to == null || run.to === '' ? from : typeof run.to === 'string' ? run.to.trim() : run.to
      const kind = typeof run.kind === 'string' ? run.kind.trim().toLowerCase() : run.kind
      if (!isYmd(from)) return { ok: false, why: notADay(run.from) }
      if (!isYmd(to)) return { ok: false, why: notADay(run.to) }
      if (!isTripDayKind(kind)) return { ok: false, why: notAKind(run.kind) }
      if (to < from) return { ok: false, why: `a run ends on or after the day it starts; ${from} to ${to} does not` }
      const length = daysBetween(from, to) + 1
      if (length > TRIP_RUN_MAX_DAYS) return { ok: false, why: `a run is at most ${TRIP_RUN_MAX_DAYS} days; ${from} to ${to} is ${length}` }
      for (const day of daysInRange(from, to)) out[day] = kind
    }
  } else {
    const days = obj(raw)
    if (!days) return { ok: false, why: 'days is an object of day to kind, or a list of runs { from, to?, kind }' }
    for (const [day, value] of Object.entries(days)) {
      const kind = typeof value === 'string' ? value.trim().toLowerCase() : value
      if (!isYmd(day)) return { ok: false, why: notADay(day) }
      if (!isTripDayKind(kind)) return { ok: false, why: notAKind(value) }
      out[day] = kind
    }
  }
  const sorted: Record<string, TripDayKind> = {}
  for (const day of Object.keys(out).sort()) sorted[day] = out[day]!
  if (Object.keys(sorted).length > TRIP_PERSON_DAYS_MAX) return { ok: false, why: `one person's days are at most ${TRIP_PERSON_DAYS_MAX}; these are ${Object.keys(sorted).length}` }
  return { ok: true, days: sorted }
}

/**
 * plan_trip / apply_trip's input, shaped into what `trip_save` takes: the home a development or a job, the people
 * each with a name and their days in the stored form, the words trimmed and held to the table's limits, `via: 'mcp'`
 * and the robot's name always. Shaping a shaped trip gives the same trip, so the server's own preparation (the id,
 * the roster) passes through it unchanged. Refuses in plain words.
 */
export function tripInput(verb: TripVerb, input: Json): TripInput {
  const src = obj(input.trip)
  if (!src) return { ok: false, error: `${verb} ${SHAPE}` }
  const no = (error: string): TripInput => ({ ok: false, error: `${verb}: ${error}` })
  const words = (key: string): string | null => (src[key] == null ? '' : typeof src[key] === 'string' ? (src[key] as string).trim().replace(/\r\n/g, '\n') : null)
  const id = (key: string, what: string): { value: string } | { error: string } => {
    const v = words(key)
    if (v === '') return { value: '' }
    return v != null && UUID_RE.test(v) ? { value: v.toLowerCase() } : { error: `${key} is ${what}.` }
  }

  const tripId = id('id', 'a trips.id, the trip to change (read_trips lists them); leave it out for a new trip')
  if ('error' in tripId) return no(tripId.error)
  const development = id('development_id', 'a developments.id (read_rows on developments by name)')
  if ('error' in development) return no(development.error)
  const job = id('job_id', 'a jobs_ledger.id (find_job)')
  if ('error' in job) return no(job.error)
  if (!development.value && !job.value) return no('a trip belongs to a development, or to a job with no development. Give development_id or job_id.')
  if (development.value && job.value) return no('give development_id or job_id, not both. A job holds a trip only when it has no development; the jobs a trip’s work goes on are job_ids.')

  const agentLabel = words('agent_label')
  if (!agentLabel) return no('agent_label is the robot’s name as the trip shows it; it is missing.')
  if (agentLabel.length > TRIP_AGENT_LABEL_MAX) return no(`agent_label is ${agentLabel.length} characters; the most is ${TRIP_AGENT_LABEL_MAX}.`)

  const p: TripPayload = { via: 'mcp', agent_label: agentLabel, people: [], job_ids: [] }
  if (tripId.value) p.id = tripId.value
  if (development.value) p.development_id = development.value
  if (job.value) p.job_id = job.value

  for (const [key, max] of [['purpose', TRIP_PURPOSE_MAX], ['asked_who', TRIP_ASKED_MAX], ['asked_how', TRIP_ASKED_MAX], ['outcome', TRIP_OUTCOME_MAX]] as const) {
    const v = words(key)
    if (v == null) return no(`${key} is words.`)
    if (v.length > max) return no(`${key} is ${v.length} characters; the most is ${max}.`)
    if (v) p[key] = v
  }
  const askedBy = words('asked_by')?.toLowerCase() ?? null
  if (askedBy) {
    if (askedBy !== 'us' && askedBy !== 'them') return no('asked_by is us or them.')
    p.asked_by = askedBy
  } else if (askedBy == null) return no('asked_by is us or them.')
  if ((p.asked_who || p.asked_how) && p.asked_by !== 'them') return no('asked_who and asked_how say who of them asked and how; they go with asked_by: "them".')
  const billing = words('billing')?.toLowerCase() ?? null
  if (billing) {
    if (billing !== 'inside' && billing !== 'extra' && billing !== 'ours') return no('billing is inside, extra or ours.')
    p.billing = billing
  } else if (billing == null) return no('billing is inside, extra or ours.')

  if (!Array.isArray(src.people) || src.people.length === 0) return no('people is the list of who went, each { name, days }; it is empty.')
  if (src.people.length > TRIP_PEOPLE_MAX) return no(`people has ${src.people.length} on it; the most is ${TRIP_PEOPLE_MAX}.`)
  const seen = new Set<string>()
  let personDays = 0
  for (const [index, raw] of src.people.entries()) {
    const person = obj(raw)
    const name = person && typeof person.name === 'string' ? person.name.trim() : ''
    if (!person || !name) return no(`everyone on a trip has a name; person ${index + 1} has none.`)
    if (name.length > TRIP_NAME_MAX) return no(`a name is at most ${TRIP_NAME_MAX} characters; person ${index + 1}’s is ${name.length}.`)
    if (seen.has(nameKey(name))) return no(`${name} is on this trip twice.`)
    seen.add(nameKey(name))
    const built: TripPersonPayload = { name, days: {} }
    for (const [key, what] of [['person_id', 'a people.id (find_person); leave it out and the roster is searched by name'], ['user_id', 'a users.id (find_person)']] as const) {
      const v = person[key]
      if (v == null || v === '') continue
      if (typeof v !== 'string' || !UUID_RE.test(v.trim())) return no(`${name}’s ${key} is ${what}.`)
      built[key] = v.trim().toLowerCase()
    }
    const days = tripDaysFrom(person.days ?? {})
    if (!days.ok) return no(`${name}’s days: ${days.why}.`)
    built.days = days.days
    personDays += Object.keys(days.days).length
    p.people.push(built)
  }
  if (personDays === 0) return no('a trip needs one person and one day; nobody here has a day.')

  if (src.job_ids != null) {
    if (!Array.isArray(src.job_ids) || src.job_ids.some((j) => typeof j !== 'string' || !UUID_RE.test(j.trim()))) return no('job_ids is a list of jobs_ledger ids (find_job): the jobs the trip’s work goes on.')
    p.job_ids = [...new Set((src.job_ids as string[]).map((j) => j.trim().toLowerCase()))]
    if (p.job_ids.length > TRIP_JOBS_MAX) return no(`job_ids names ${p.job_ids.length} jobs; the most is ${TRIP_JOBS_MAX}.`)
  }
  return { ok: true, p, target: p.id ?? p.development_id ?? p.job_id ?? '' }
}

// ── the stable id ────────────────────────────────────────────────────────────────────────────────────────────────

/** JSON with object keys sorted at every depth, so the same value always reads the same. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const o = obj(value)
  if (o) return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`).join(',')}}`
  return value === undefined ? 'null' : JSON.stringify(value)
}

/**
 * What a trip's made id is read from: the trip as it was asked for, without an id, its people in name order and its
 * jobs in id order, so the same trip written in another order is the same trip.
 */
export function tripIdBasis(p: TripPayload): string {
  const { id: _id, ...rest } = p
  return stableJson({ ...rest, people: [...p.people].sort((a, b) => nameKey(a.name).localeCompare(nameKey(b.name))), job_ids: [...p.job_ids].sort() })
}

/**
 * The id a trip with none is saved under: sha256 of `tripIdBasis`, its first sixteen bytes written as a uuid with the
 * version and variant bits set, so it is a well-formed one. The same trip gives the same id at plan and at apply, and
 * again tomorrow: filing a trip twice lands on one trip, never two.
 */
export async function tripStableId(p: TripPayload): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tripIdBasis(p))))
  const bytes = digest.slice(0, 16)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// ── people by name ───────────────────────────────────────────────────────────────────────────────────────────────

export type RosterPerson = { id: string; name: string; account_user_id: string | null }

/** How a person on the trip was tied to the roster, or was not. */
export type TripPersonFit = {
  name: string
  fit: 'roster' | 'given' | 'unknown' | 'several'
  /** The same, in the words the plan shows. */
  roster: string
  person_id: string | null
  user_id: string | null
}

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n)

/**
 * Each person tied to the roster, or left a name alone. A person with no `person_id` is looked for among the roster's
 * unarchived people by name, trimmed and whatever its case: exactly one match fills `person_id` and, when the call
 * gave none, `user_id` from the roster row's login. No match, or more than one, leaves the name alone and says which.
 * A `person_id` the call gave is kept as given; it must name someone (`given` holds the rows read by those ids), and
 * a missing `user_id` is filled from that row.
 */
export function fillTripPeople(people: ReadonlyArray<TripPersonPayload>, roster: ReadonlyArray<RosterPerson>, given: ReadonlyArray<RosterPerson> = []): { people: TripPersonPayload[]; fits: TripPersonFit[] } | { refused: string } {
  const byName = new Map<string, RosterPerson[]>()
  for (const r of roster) {
    const key = nameKey(r.name)
    if (!key) continue
    byName.set(key, [...(byName.get(key) ?? []), r])
  }
  const out: TripPersonPayload[] = []
  const fits: TripPersonFit[] = []
  for (const person of people) {
    if (person.person_id) {
      const row = given.find((r) => r.id.toLowerCase() === person.person_id)
      if (!row) return { refused: `${person.name}’s person_id names nobody on the roster. find_person gives a people.id; leave it out and the roster is searched by name.` }
      const userId = person.user_id ?? row.account_user_id?.toLowerCase() ?? null
      const sameName = nameKey(row.name) === nameKey(person.name)
      out.push({ name: person.name, person_id: person.person_id, ...(userId ? { user_id: userId } : {}), days: person.days })
      fits.push({ name: person.name, fit: 'given', roster: sameName ? 'on the roster, by the id given' : `on the roster, by the id given: the roster names them ${row.name.trim()}`, person_id: person.person_id, user_id: userId })
      continue
    }
    const matches = byName.get(nameKey(person.name)) ?? []
    if (matches.length === 1) {
      const row = matches[0]!
      const userId = person.user_id ?? row.account_user_id?.toLowerCase() ?? null
      out.push({ name: person.name, person_id: row.id.toLowerCase(), ...(userId ? { user_id: userId } : {}), days: person.days })
      fits.push({ name: person.name, fit: 'roster', roster: 'on the roster', person_id: row.id.toLowerCase(), user_id: userId })
      continue
    }
    out.push({ name: person.name, ...(person.user_id ? { user_id: person.user_id } : {}), days: person.days })
    fits.push({
      name: person.name,
      fit: matches.length === 0 ? 'unknown' : 'several',
      roster: matches.length === 0 ? 'a name alone: not on the roster' : `a name alone: ${countWord(matches.length)} people have this name`,
      person_id: null,
      user_id: person.user_id ?? null,
    })
  }
  return { people: out, fits }
}

// ── the preparation: the id, the home, the roster ────────────────────────────────────────────────────────────────

/** Where a trip is kept: a development (with its city) or a job that has none (with its number). */
export type TripHome = { kind: 'development' | 'job'; id: string; name: string | null; city: string | null; number: string | null }
export type TripJobName = { id: string; name: string | null; number: string | null }

export type TripPrepared = {
  ok: true
  /** The call's own args with the trip as `trip_save` takes it: the id set, the roster filled. What `writeRpcBody` shapes. */
  args: Json
  p: TripPayload
  /** Whether the id came with the call or was made from the trip's own words. */
  idWas: 'given' | 'made'
  home: TripHome
  jobs: TripJobName[]
  people: TripPersonFit[]
  /** A plan alone: days this trip's people already have on another trip kept in the same place. */
  overlaps: TripOverlap[]
}

/** One person's days that another trip already kept in the same place also claims. */
export type TripOverlap = { trip_id: string; name: string; days: number; first_day: string; last_day: string }

/**
 * The days this trip's people already have on another trip, by the roster person when both name one and by name
 * otherwise. Two trips that claim one person's day is a mistake to fix, and most often it is the same trip filed
 * again with a word changed and no id.
 */
export function tripOverlaps(p: TripPayload, kept: ReadonlyArray<TripRead>): TripOverlap[] {
  const out: TripOverlap[] = []
  for (const other of kept) {
    if (other.id === p.id) continue
    for (const person of p.people) {
      const same = other.people.find((x) => (person.person_id && x.person_id ? x.person_id.toLowerCase() === person.person_id : nameKey(x.name) === nameKey(person.name)))
      if (!same) continue
      const shared = Object.keys(person.days).filter((day) => same.days[day] != null)
      if (shared.length) out.push({ trip_id: other.id, name: person.name, days: shared.length, first_day: shared[0]!, last_day: shared[shared.length - 1]! })
    }
  }
  return out
}

const rosterRow = (r: Row): RosterPerson => ({ id: str(r.id), name: str(r.name), account_user_id: strOrNull(r.account_user_id) })
const jobName = (r: Row): TripJobName => ({ id: str(r.id), name: strOrNull(r.job_name), number: strOrNull(r.click_number) ?? strOrNull(r.hcp_number) })

/**
 * Everything a trip's write needs before the dry run, read as the dev: the development or the job it is kept on (so a
 * wrong id is refused in words here and not by a foreign key at the write), the jobs its work goes on, and the roster
 * for the people given by name. The id is made here when the call gave none. Throws on a refused read.
 */
export async function prepareTripWrite(verb: TripVerb, args: Json, reader: Reader): Promise<TripPrepared | { ok: false; error: string }> {
  const built = tripInput(verb, args)
  if (!built.ok) return built
  const asked = built.p
  const no = (error: string) => ({ ok: false as const, error: `${verb}: ${error}` })

  let home: TripHome
  if (asked.development_id) {
    const rows = await reader.rows('developments', { select: 'id,name,city', filters: by('id', asked.development_id), limit: 1 })
    if (!rows[0]) return no(`no development has the id ${asked.development_id}, or this account cannot read it (read_rows on developments by name).`)
    home = { kind: 'development', id: asked.development_id, name: strOrNull(rows[0].name), city: strOrNull(rows[0].city), number: null }
  } else {
    const jobId = asked.job_id ?? ''
    const rows = await reader.rows('jobs_ledger', { select: 'id,job_name,click_number,hcp_number', filters: by('id', jobId), limit: 1 })
    if (!rows[0]) return no(`no job has the id ${jobId}, or this account cannot read it (find_job).`)
    const named = jobName(rows[0])
    home = { kind: 'job', id: jobId, name: named.name, city: null, number: named.number }
  }

  const jobRows = asked.job_ids.length ? await readRowsByIds(reader, 'jobs_ledger', 'id,job_name,click_number,hcp_number', asked.job_ids) : []
  const jobs = asked.job_ids.map((id) => jobRows.find((r) => str(r.id).toLowerCase() === id)).map((r, i) => (r ? jobName(r) : { id: asked.job_ids[i]!, name: null, number: null }))
  const missing = asked.job_ids.filter((id) => !jobRows.some((r) => str(r.id).toLowerCase() === id))
  if (missing.length) return no(`job_ids names ${plural(missing.length, 'job')} nobody can find: ${missing.join(', ')} (find_job).`)

  const givenIds = asked.people.flatMap((x) => (x.person_id ? [x.person_id] : []))
  const given = givenIds.length ? (await readRowsByIds(reader, 'people', 'id,name,account_user_id', givenIds)).map(rosterRow) : []
  const roster = asked.people.some((x) => !x.person_id)
    ? (await readAllRows(reader, 'people', { select: 'id,name,account_user_id', filters: [{ column: 'archived_at', op: 'is', value: null }] })).rows.map(rosterRow)
    : []
  const filled = fillTripPeople(asked.people, roster, given)
  if ('refused' in filled) return no(filled.refused)

  // The id is read from the trip as it was asked for, before the roster is laid over it: the same ask is the same
  // trip, whoever has joined or left the roster since.
  const id = asked.id ?? (await tripStableId(asked))
  const p: TripPayload = { ...asked, id, people: filled.people }
  // A plan also reads the trips already kept in the same place, for the days two trips would both claim. The apply
  // does not: the words are the plan's, and nothing of them is in the hash.
  let overlaps: TripOverlap[] = []
  if (verb === 'plan_trip') {
    // No day is passed: where the kept trips stand is not read here, only whose days they hold.
    const kept = await readTrips(reader, home.kind === 'development' ? { development_id: home.id } : { job_id: home.id }, '')
    if (!('refused' in kept)) overlaps = tripOverlaps(p, kept.trips)
  }
  return { ok: true, args: { ...args, trip: p }, p, idWas: asked.id ? 'given' : 'made', home, jobs, people: filled.fits, overlaps }
}

// ── the words around the database's own reply ────────────────────────────────────────────────────────────────────

const tripOf = (id: string, people: ReadonlyArray<{ name: string; person_id?: string | null; user_id?: string | null; days: Record<string, TripDayKind> }>, jobIds: ReadonlyArray<string>): Trip => ({
  id,
  people: people.map((x) => ({ personKey: x.person_id ?? x.user_id ?? nameKey(x.name), name: x.name, days: x.days })),
  jobIds,
})

/** "3 at the site, 1 on the road, 1 getting ready", the kinds with no day left out. */
export function tripCountsWords(c: TripDayCounts): string {
  const parts = [c.site ? `${c.site} at the site` : '', c.road ? `${c.road} on the road` : '', c.ready ? `${c.ready} getting ready` : ''].filter(Boolean)
  return parts.join(', ')
}

const homeWords = (home: TripHome): string => {
  const name = home.name ?? (home.kind === 'development' ? 'a development with no name' : 'a job with no name')
  return home.kind === 'development' ? name : `the job ${home.number ? `${home.number} ` : ''}${name}`
}

/** What `trip_save`'s dry run said it would do: add a trip or change one. */
export function tripSaveWould(reply: unknown): 'add' | 'change' | null {
  const would = obj(reply)?.would
  return would === 'add' || would === 'change' ? would : null
}

/**
 * What the plan adds for the person reading it, beside the database's own reply and never inside the hash: the site
 * or the job by name, the days from first to last, where the trip would stand today, each person with how they were
 * tied to the roster and their days by kind, what it was for, who asked, billing and the jobs. `today` is the
 * company's calendar day; it is in these words alone, so no clock is in the hash.
 */
export function tripPlanWords(prep: TripPrepared, reply: unknown, todayYmd: string): Json {
  const p = prep.p
  const trip = tripOf(p.id ?? '', p.people, p.job_ids)
  const span = tripSpan(trip)
  const counts = tripDayCounts(trip)
  const standing = tripStanding(trip, todayYmd)
  const would = tripSaveWould(reply)
  const lead = would === 'change' ? 'Would change the trip' : would === 'add' ? 'Would add a trip' : 'A trip'
  const notes: string[] = []
  if (would === 'change') notes.push('A change replaces the trip whole: its words, its people and its jobs become what this plan says, and anything left out is cleared. Its via and agent_label stay as the trip was first kept.')
  if (would === 'add' && prep.idWas === 'made') notes.push('No id came with the call, so the id is made from the trip’s own words: the same trip planned again lands on this id and reads change. To change a trip already kept, pass its id (read_trips lists them).')
  if (would === 'add' && prep.idWas === 'given') notes.push('No trip has this id, so one is made under it. That is how a deleted trip is put back.')
  const alone = prep.people.filter((x) => x.fit === 'unknown' || x.fit === 'several')
  if (alone.length) notes.push(`${alone.map((x) => x.name).join(', ')} ${alone.length === 1 ? 'is a name alone' : 'are names alone'}: a name alone has no roster row and no login, so no hours can be laid over their days. Pass person_id (find_person) to tie one to the roster.`)
  for (const o of prep.overlaps) notes.push(`${o.name} already has ${o.days === 1 ? o.first_day : `${o.days} of these days (${o.first_day} to ${o.last_day})`} on another trip kept here, ${o.trip_id}. If this is that trip, pass its id; two trips should not claim one person’s day.`)
  notes.push('A trip is a reading over the clock. It changes no clock row, bill or cost.')
  return {
    reads: `${lead} to ${homeWords(prep.home)}${span ? `, ${span.first === span.last ? span.first : `${span.first} to ${span.last}`}: ${plural(counts.days, 'day')} (${tripCountsWords(counts)})` : ''}, ${plural(p.people.length, 'person', 'people')}. Today (${todayYmd}) it would read ${TRIP_STANDING_LABEL[standing]}.`,
    trip: {
      id: p.id ?? null,
      id_was: prep.idWas === 'made' ? 'made from the trip’s own words' : 'given',
      on: { [prep.home.kind]: { id: prep.home.id, name: prep.home.name, ...(prep.home.kind === 'development' ? { city: prep.home.city } : { number: prep.home.number }) } },
      first_day: span?.first ?? null,
      last_day: span?.last ?? null,
      standing,
      standing_words: TRIP_STANDING_LABEL[standing],
      days: counts,
      people: p.people.map((x) => {
        const fit = prep.people.find((f) => nameKey(f.name) === nameKey(x.name))
        const own = personDayCounts(x.days)
        const days = Object.keys(x.days)
        return { name: x.name, roster: fit?.roster ?? null, person_id: x.person_id ?? null, user_id: x.user_id ?? null, first_day: days[0] ?? null, last_day: days[days.length - 1] ?? null, days: own, reads: own.days ? `${plural(own.days, 'day')}: ${tripCountsWords(own)}` : 'no day yet' }
      }),
      purpose: p.purpose ?? '',
      asked: { by: p.asked_by ?? null, who: p.asked_who ?? '', how: p.asked_how ?? '' },
      outcome: p.outcome ?? '',
      billing: p.billing ?? null,
      jobs: prep.jobs,
      via: p.via,
      agent_label: p.agent_label,
    },
    ...(prep.overlaps.length ? { overlaps: prep.overlaps } : {}),
    notes,
  }
}

/** The apply's reply with where to read the trip back. */
export function tripAppliedWords(prep: TripPrepared, reply: unknown): Json {
  const r = obj(reply) ?? {}
  const did = r.did === 'changed' ? 'Changed the trip' : 'Added a trip'
  const door = prep.home.kind === 'development' ? `read_trips { development_id: "${prep.home.id}" }` : `read_trips { job_id: "${prep.home.id}" }`
  return {
    ...r,
    reads: `${did} to ${homeWords(prep.home)}: ${plural(prep.p.people.length, 'person', 'people')}${typeof r.first_day === 'string' && typeof r.last_day === 'string' ? `, ${r.first_day === r.last_day ? r.first_day : `${r.first_day} to ${r.last_day}`}` : ''}.`,
    next: `${door} reads it back, and the Trips look on the Development page shows it. To change it, plan_trip with id: "${str(r.trip_id) || prep.p.id || ''}" and the trip whole. Deleting a trip is done in the app.`,
  }
}

/**
 * A trip verb's args as the call log keeps them: the home, each person's name with a count of their days, the first
 * of the words, and an apply's plan_hash. A crew's days written out can pass the log's 4,000-character cut.
 */
export function tripArgsForLog(name: string, args: Json): Json {
  const t = obj(args.trip)
  const short = (v: unknown) => (typeof v === 'string' && v.length > 200 ? `${v.slice(0, 200)}… (${v.length} characters)` : v ?? null)
  const dayCount = (days: unknown) => {
    const read = tripDaysFrom(days ?? {})
    return read.ok ? plural(Object.keys(read.days).length, 'day') : 'days not read'
  }
  return {
    trip: t
      ? {
          id: t.id ?? null,
          development_id: t.development_id ?? null,
          job_id: t.job_id ?? null,
          agent_label: short(t.agent_label),
          purpose: short(t.purpose),
          asked_by: t.asked_by ?? null,
          billing: t.billing ?? null,
          people: Array.isArray(t.people) ? t.people.slice(0, TRIP_PEOPLE_MAX).map((x) => ({ name: short(obj(x)?.name), person_id: obj(x)?.person_id ?? null, days: dayCount(obj(x)?.days) })) : null,
          job_ids: Array.isArray(t.job_ids) ? `${t.job_ids.length} jobs` : null,
        }
      : null,
    ...(name === 'apply_trip' ? { plan_hash: typeof args.plan_hash === 'string' ? args.plan_hash.trim().toLowerCase() : args.plan_hash } : {}),
  }
}

// ── the read ─────────────────────────────────────────────────────────────────────────────────────────────────────

export type TripRead = {
  id: string
  first_day: string | null
  last_day: string | null
  standing: TripStanding
  standing_words: string
  /** The trip's days by kind, a day counted once however many people were on it. */
  days: TripDayCounts
  people: Array<{ name: string; person_id: string | null; user_id: string | null; days: Record<string, TripDayKind> }>
  purpose: string
  asked_by: string | null
  asked_who: string
  asked_how: string
  outcome: string
  billing: string | null
  job_ids: string[]
  via: string
  agent_label: string | null
  development_id: string | null
  job_id: string | null
  created_at: string | null
  updated_at: string | null
}

export type TripsReply = {
  reading: string
  on: { kind: 'development' | 'job'; id: string; name: string | null }
  today: string
  count: number
  standing: Record<TripStanding, number>
  trips: TripRead[]
  /** Only when the read stopped short of every trip. */
  capped?: true
}

const READ_SHAPE = 'read_trips needs development_id (a developments.id: read_rows on developments by name) or job_id (a jobs_ledger.id: find_job), one of the two.'

/** One stored trip, its people and jobs embedded, as the reply gives it. */
export function tripReadOf(row: Row, todayYmd: string): TripRead {
  const people = (Array.isArray(row.trip_people) ? (row.trip_people as Row[]) : [])
    .map((x) => ({ name: str(x.person_name), person_id: strOrNull(x.person_id), user_id: strOrNull(x.user_id), days: { ...parseTripDays(x.days) } }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const jobIds = (Array.isArray(row.trip_jobs) ? (row.trip_jobs as Row[]) : []).map((j) => str(j.job_id)).filter(Boolean)
  const trip = tripOf(str(row.id), people, jobIds)
  const span = tripSpan(trip)
  const standing = tripStanding(trip, todayYmd)
  return {
    id: trip.id,
    first_day: span?.first ?? null,
    last_day: span?.last ?? null,
    standing,
    standing_words: TRIP_STANDING_LABEL[standing],
    days: tripDayCounts(trip),
    people,
    purpose: str(row.purpose),
    asked_by: strOrNull(row.asked_by),
    asked_who: str(row.asked_who),
    asked_how: str(row.asked_how),
    outcome: str(row.outcome),
    billing: strOrNull(row.billing),
    job_ids: jobIds,
    via: str(row.via) || 'app',
    agent_label: strOrNull(row.agent_label),
    development_id: strOrNull(row.development_id),
    job_id: strOrNull(row.job_id),
    created_at: strOrNull(row.created_at),
    updated_at: strOrNull(row.updated_at),
  }
}

/**
 * read_trips: a site's trips, or a job's, as the reader (RLS applies), in the order they went out. A site's trips are
 * the ones kept on the development. A job's are the ones the job holds by itself (no development) and the ones whose
 * work goes on it. Where each stands is read from its days and `todayYmd`, the company's calendar day. Throws on a
 * refused read; the name of the site or the job is left out when the reader cannot read it.
 */
export async function readTrips(reader: Reader, args: Json, todayYmd: string): Promise<TripsReply | { refused: string }> {
  const developmentId = typeof args.development_id === 'string' ? args.development_id.trim().toLowerCase() : ''
  const jobId = typeof args.job_id === 'string' ? args.job_id.trim().toLowerCase() : ''
  if ((!developmentId && !jobId) || (developmentId && jobId)) return { refused: READ_SHAPE }
  if (!UUID_RE.test(developmentId || jobId)) return { refused: READ_SHAPE }

  let rows: Row[]
  let capped = false
  let name: string | null = null
  if (developmentId) {
    const read = await readAllRows(reader, 'trips', { select: TRIP_SELECT, filters: by('development_id', developmentId) })
    rows = read.rows
    capped = read.capped
    try {
      name = strOrNull((await reader.rows('developments', { select: 'id,name', filters: by('id', developmentId), limit: 1 }))[0]?.name)
    } catch { /* the name is a courtesy: a reader who cannot read developments still reads their own trips */ }
  } else {
    const held = await readAllRows(reader, 'trips', { select: TRIP_SELECT, filters: [...by('job_id', jobId), { column: 'development_id', op: 'is', value: null }] })
    const named = await readAllRows(reader, 'trip_jobs', { select: 'trip_id,job_id', filters: by('job_id', jobId) }, 'trip_id')
    const heldIds = new Set(held.rows.map((r) => str(r.id)))
    const moreIds = [...new Set(named.rows.map((r) => str(r.trip_id)).filter((id) => id && !heldIds.has(id)))]
    const more = moreIds.length ? await readRowsByIds(reader, 'trips', TRIP_SELECT, moreIds) : []
    rows = [...held.rows, ...more]
    capped = held.capped || named.capped
    try {
      name = strOrNull((await reader.rows('jobs_ledger', { select: 'id,job_name', filters: by('id', jobId), limit: 1 }))[0]?.job_name)
    } catch { /* as above */ }
  }

  const seen = new Set<string>()
  const read = rows.filter((r) => (seen.has(str(r.id)) ? false : (seen.add(str(r.id)), true))).map((r) => tripReadOf(r, todayYmd))
  const byId = new Map(read.map((t) => [t.id, t]))
  const trips = sortTrips(read.map((t) => tripOf(t.id, t.people, t.job_ids))).map((t) => byId.get(t.id)!)
  const standing: Record<TripStanding, number> = { planned: 0, out: 0, back: 0 }
  for (const t of trips) standing[t.standing] += 1
  const where = developmentId ? (name ?? 'this development') : `the job ${name ?? jobId}`
  const stands = (['out', 'planned', 'back'] as const).filter((s) => standing[s] > 0).map((s) => `${standing[s]} ${TRIP_STANDING_LABEL[s].toLowerCase()}`)
  return {
    reading: trips.length === 0 ? `No trip is kept on ${where}, or none this reader may read.` : `${plural(trips.length, 'trip')} on ${where}: ${stands.join(', ')}. In the order they went out.`,
    on: { kind: developmentId ? 'development' : 'job', id: developmentId || jobId, name },
    today: todayYmd,
    count: trips.length,
    standing,
    trips,
    ...(capped ? { capped: true as const } : {}),
  }
}
