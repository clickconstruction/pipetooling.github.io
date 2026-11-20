/**
 * The dev seat's trip verbs (v2.7670, punch list #379 PR 4): the call's shape and its refusals, the two forms of a
 * person's days, the id a trip with none is saved under, the roster laid over the names, the plan's words and the read.
 * Every site, person, day and id here is made up.
 */
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  TRIP_AGENT_LABEL_MAX,
  TRIP_ASKED_MAX,
  TRIP_NAME_MAX,
  TRIP_OUTCOME_MAX,
  TRIP_PURPOSE_MAX,
  TRIP_RUN_MAX_DAYS,
  TRIP_SELECT,
  TRIP_TABLE_COLUMNS,
  TRIP_VERBS,
  fillTripPeople,
  isTripVerb,
  prepareTripWrite,
  readTrips,
  tripAppliedWords,
  tripArgsForLog,
  tripCountsWords,
  tripDaysFrom,
  tripIdBasis,
  tripInput,
  tripOverlaps,
  tripPlanWords,
  tripNumberOf,
  tripReadOf,
  tripSaveWould,
  tripStableId,
  type RosterPerson,
  type TripPayload,
  type TripPrepared,
} from '../../../supabase/functions/_shared/devMcpTrips'
import type { Reader, Row, RowsQuery } from '../../../supabase/functions/_shared/devMcpComposites'
import { WRITE_VERBS, applyVerbFor, isWriteVerb, planHash, planReply, planVerbFor, stateGuarded, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { tripDayCounts, tripSpan, tripStanding } from '../trips/tripDays'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const KERNELS = readFileSync('scripts/edge-kernels.mjs', 'utf8')
const KERNEL = readFileSync('supabase/functions/_shared/devMcpTrips.ts', 'utf8')
/** The table and its one write door are PR 2's. This PR can merge first, so the pins on it run once the file is here. */
const MIGRATION_FILE = 'supabase/migrations/20261117234500_trips.sql'

const SITE = 'aaaaaaaa-1111-4111-8111-111111111111' // Heron Point
const OTHER_SITE = 'aaaaaaaa-2222-4222-8222-222222222222'
const JOB = 'dddddddd-1111-4111-8111-111111111111'
const JOB_2 = 'dddddddd-2222-4222-8222-222222222222'
const DANA = 'bbbbbbbb-1111-4111-8111-111111111111'
const DANA_LOGIN = 'cccccccc-1111-4111-8111-111111111111'
const LUIS = 'bbbbbbbb-2222-4222-8222-222222222222'
const OMAR_1 = 'bbbbbbbb-3333-4333-8333-333333333333'
const OMAR_2 = 'bbbbbbbb-4444-4444-8444-444444444444'
const TRIP = 'eeeeeeee-1111-4111-8111-111111111111'
const HASH = 'a'.repeat(64)
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** A trip across a month end: Dana out six days with one off in the middle, Luis two days at the site. */
const DANA_DAYS = { '2026-10-29': 'ready', '2026-10-30': 'road', '2026-10-31': 'site', '2026-11-02': 'site', '2026-11-03': 'road' }
const LUIS_DAYS = { '2026-10-31': 'site', '2026-11-02': 'site' }
const ASK = { development_id: SITE, agent_label: 'the ledger robot', purpose: 'Rough in, building C', people: [{ name: 'Dana', days: DANA_DAYS }, { name: 'Luis', days: LUIS_DAYS }] }

const shaped = (trip: Record<string, unknown>, verb: 'plan_trip' | 'apply_trip' = 'plan_trip') => tripInput(verb, { trip })
const p = (over: Record<string, unknown> = {}): TripPayload => {
  const built = shaped({ ...ASK, ...over })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const refusal = (over: Record<string, unknown>): string => {
  const built = shaped({ ...ASK, ...over })
  if (built.ok) throw new Error('expected a refusal')
  return built.error
}

/** A small database: eq, is null, in and gt filters, the order and the limit, so the paged reads run as they do on the door. */
function fake(tables: Record<string, Row[]>, log: Array<{ table: string; q: RowsQuery }> = []): Reader {
  return {
    rpc: async () => [],
    rows: async (table, q) => {
      log.push({ table, q })
      let rows = [...(tables[table] ?? [])]
      for (const f of q.filters ?? []) {
        rows = rows.filter((r) => {
          const v = r[f.column]
          if (f.op === 'eq') return v === f.value
          if (f.op === 'is') return f.value === null ? v == null : v === f.value
          if (f.op === 'in') return (f.value as unknown[]).includes(v)
          if (f.op === 'gt') return String(v) > String(f.value)
          throw new Error(`the fake has no ${f.op}`)
        })
      }
      for (const o of [...(q.order ?? [])].reverse()) rows.sort((a, b) => String(a[o.column]).localeCompare(String(b[o.column])) * (o.ascending === false ? -1 : 1))
      return rows.slice(0, q.limit ?? 50)
    },
  }
}

const ROSTER: Row[] = [
  { id: DANA, name: ' Dana ', account_user_id: DANA_LOGIN, archived_at: null },
  { id: LUIS, name: 'LUIS', account_user_id: null, archived_at: null },
  { id: OMAR_1, name: 'Omar', account_user_id: null, archived_at: null },
  { id: OMAR_2, name: 'omar', account_user_id: null, archived_at: null },
  { id: 'bbbbbbbb-5555-4555-8555-555555555555', name: 'Priya', account_user_id: null, archived_at: '2026-06-01T00:00:00Z' },
]
const WORLD: Record<string, Row[]> = {
  developments: [{ id: SITE, name: 'Heron Point', city: 'Marlow' }],
  jobs_ledger: [
    { id: JOB, job_name: 'Heron Point rough in', click_number: '9001', hcp_number: '' },
    { id: JOB_2, job_name: 'Heron Point top out', click_number: '', hcp_number: '' },
  ],
  people: ROSTER,
  trips: [],
  trip_jobs: [],
}

describe('the trip verbs are on the allowlist, over the app’s own door', () => {
  it('are two write verbs over trip_save, plan before apply, with a read beside them, and the server and the docs name all three', () => {
    expect(TRIP_VERBS).toEqual(['plan_trip', 'apply_trip'])
    for (const v of TRIP_VERBS) {
      expect(isTripVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBe('trip_save')
      expect(SERVER).toContain(`name: '${v}',`)
      expect(SERVER).toContain(`case '${v}':`)
    }
    expect(planVerbFor('apply_trip')).toBe('plan_trip')
    expect(applyVerbFor('plan_trip')).toBe('apply_trip')
    expect(isTripVerb('read_trips')).toBe(false)
    expect(isWriteVerb('read_trips')).toBe(false)
    expect(SERVER).toContain("name: 'read_trips',")
    expect(SERVER).toContain("case 'read_trips': {")
    expect(SERVER).toContain('its number on its site (trip_number, since v2.7886')
    expect(SERVER).toContain('// 0.106.0 (v2.7886, punch list #379')
    expect(SERVER).toContain("const SERVER_VERSION = '0.115.0'")
    expect(SERVER).toContain('Writes are one hundred and forty-one verbs and nothing else:')
    expect(SERVER).toContain('plan_trip → apply_trip (a trip to a site away from home')
    expect(SERVER).toContain('read_trips reads a site’s or a job’s trips'.replace(/’/g, "'"))
    expect(README).toContain('`plan_trip(trip)` · `apply_trip(trip, plan_hash)`')
    expect(README).toContain('`read_trips(development_id \\| job_id)`')
    expect(README).toContain("one hundred and twenty-three since v2.7670's trip pair")
    expect(EDGE).toContain('**v2.7670 (server 0.100.0)')
  })
  it('sit above the shared write block, which only a dev’s own key reaches and view_as never does', () => {
    const block = SERVER.indexOf('// The second path: a POST to one hard-coded RPC, as the dev.')
    for (const v of TRIP_VERBS) {
      expect(SERVER.indexOf(`case '${v}':`)).toBeGreaterThan(SERVER.indexOf("case 'plan_cost_batch':"))
      expect(SERVER.indexOf(`case '${v}':`)).toBeLessThan(block)
    }
    expect(SERVER.slice(block, block + 900)).toContain("if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)")
    // view_as refuses every write verb by the one list, WRITE_VERBS, before the target is looked up.
    expect(SERVER).toContain("if (isWriteVerb(verb) || verb === 'mint_twin_setup_code'")
    expect(SERVER).toContain('get_history, read_trips, read_on_site')
  })
  it('prepares the trip before the body is built, hashes the database’s own reply and lays the words beside it', () => {
    const prep = SERVER.indexOf('const prepared = await prepareTripWrite(name, args, tripReaderAs(await jwt()))')
    const body = SERVER.indexOf('const built = writeRpcBody(name, tripPrep ? tripPrep.args : file ? file.args')
    expect(prep).toBeGreaterThan(0)
    expect(body).toBeGreaterThan(prep)
    expect(SERVER).toContain('if (tripPrep) return ok({ ...planned, ...tripPlanWords(tripPrep, res.body, todayYmdInAppTz()) }, { target: built.target })')
    expect(SERVER).toContain('await planHash(name, built.body.p, res.body)')
    expect(SERVER).toContain('if (tripPrep) reply = tripAppliedWords(tripPrep, reply)')
    expect(SERVER).toContain('if (isTripVerb(name)) return tripArgsForLog(name, args)')
  })
  it('reuses the Trips look’s rules from the kernel copy, and reads the young tables by its own columns until the catalog holds them', () => {
    expect(KERNELS).toContain("'lib/trips/tripDays.ts': { values: [], types: [] },")
    expect(KERNEL).toContain("from './gcKernels/lib/trips/tripDays.ts'")
    expect(KERNEL).not.toMatch(/Deno\.env|fetch\(/)
    expect(SERVER).toContain('if (!columns || CATALOG_TABLES[table]) return base.rows(table, query)')
    expect(Object.keys(TRIP_TABLE_COLUMNS)).toEqual(['trips', 'trip_people', 'trip_jobs'])
    // Every column the read selects, filters or pages by is one the list holds.
    for (const col of ['id', 'development_id', 'job_id', 'via', 'agent_label']) expect(TRIP_TABLE_COLUMNS.trips).toContain(col)
    expect(TRIP_TABLE_COLUMNS.trip_jobs).toEqual(expect.arrayContaining(['trip_id', 'job_id']))
    expect(TRIP_SELECT).toContain('trip_people(person_id,user_id,person_name,days)')
    // The number rides the trip's own row (v2.7886). It is younger than the table, so it is not in the young-table list.
    expect(TRIP_SELECT.startsWith('id,trip_number,development_id,')).toBe(true)
    expect(TRIP_TABLE_COLUMNS.trips).not.toContain('trip_number')
    expect(TRIP_SELECT).toContain('trip_jobs(job_id)')
  })
  it('leaves one apply per plan to the database: a landed add reads change, so the log’s rule is not asked', () => {
    expect(stateGuarded('apply_trip')).toBe(true)
    expect(stateGuarded('plan_trip')).toBe(false)
  })
})

describe('the door the verbs post to (the trip table’s migration, once it is on this branch)', () => {
  it.runIf(existsSync(MIGRATION_FILE))('is trip_save(p, p_dry_run) as the caller, answers the keys the plan reads, and holds the limits the seat says first', () => {
    const sql = readFileSync(MIGRATION_FILE, 'utf8')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.trip_save(p jsonb, p_dry_run boolean DEFAULT false)')
    const body = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.trip_save('), sql.indexOf('$fn$;', sql.indexOf('CREATE OR REPLACE FUNCTION public.trip_save(')))
    expect(body).toContain('SECURITY INVOKER')
    expect(body).toContain('IF NOT public.trips_office() THEN')
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.trip_save(jsonb, boolean) FROM PUBLIC, anon;')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.trip_save(jsonb, boolean) TO authenticated, service_role;')
    // The dry run makes a random id for a trip with none, which is why the server makes a stable one first.
    expect(body).toContain('v_id := gen_random_uuid();')
    expect(body).toContain("'dry_run', true, 'would', CASE WHEN v_exists THEN 'change' ELSE 'add' END, 'trip_id', v_id")
    expect(body).toContain("'dry_run', false, 'did', CASE WHEN v_exists THEN 'changed' ELSE 'added' END, 'trip_id', v_id")
    for (const key of ['development_id', 'job_id', 'purpose', 'asked_by', 'asked_who', 'asked_how', 'outcome', 'billing', 'via', 'agent_label', 'people', 'job_ids']) expect(body).toContain(`'${key}'`)
    for (const key of ['person_id', 'user_id', 'name', 'days']) expect(body).toContain(`'${key}'`)
    expect(sql).toContain(`CHECK (char_length(purpose) <= ${TRIP_PURPOSE_MAX})`)
    expect(sql).toContain(`CHECK (char_length(asked_who) <= ${TRIP_ASKED_MAX})`)
    expect(sql).toContain(`CHECK (char_length(asked_how) <= ${TRIP_ASKED_MAX})`)
    expect(sql).toContain(`CHECK (char_length(outcome) <= ${TRIP_OUTCOME_MAX})`)
    expect(sql).toContain(`char_length(agent_label) <= ${TRIP_AGENT_LABEL_MAX}`)
    expect(sql).toContain(`char_length(person_name) <= ${TRIP_NAME_MAX}`)
    // Every column the server reads the young tables by is one the migration makes.
    for (const table of Object.keys(TRIP_TABLE_COLUMNS)) {
      const made = sql.slice(sql.indexOf(`CREATE TABLE IF NOT EXISTS public.${table} (`), sql.indexOf(');', sql.indexOf(`CREATE TABLE IF NOT EXISTS public.${table} (`)))
      for (const column of TRIP_TABLE_COLUMNS[table] ?? []) expect(made).toMatch(new RegExp(`\\n  ${column} `))
    }
  })
})

describe('tripInput — the shape', () => {
  it('shapes a trip into what trip_save takes, always via mcp with the robot’s name', () => {
    const built = shaped({ ...ASK, via: 'app', asked_by: 'THEM', asked_who: ' Walt, the super ', asked_how: 'by phone', outcome: 'Passed.\r\nOne leak fixed.', billing: 'Extra', job_ids: [JOB.toUpperCase(), JOB] })
    expect(built).toMatchObject({
      ok: true,
      target: SITE,
      p: { development_id: SITE, via: 'mcp', agent_label: 'the ledger robot', purpose: 'Rough in, building C', asked_by: 'them', asked_who: 'Walt, the super', asked_how: 'by phone', outcome: 'Passed.\nOne leak fixed.', billing: 'extra', job_ids: [JOB] },
    })
    expect(p().people).toEqual([{ name: 'Dana', days: DANA_DAYS }, { name: 'Luis', days: LUIS_DAYS }])
    expect(p()).not.toHaveProperty('id')
    expect(p({ id: TRIP.toUpperCase() }).id).toBe(TRIP)
    expect(shaped({ ...ASK, id: TRIP })).toMatchObject({ target: TRIP })
    expect(p({ development_id: undefined, job_id: JOB })).toMatchObject({ job_id: JOB })
    expect(p({ people: [{ name: ' Dana ', person_id: DANA.toUpperCase(), user_id: DANA_LOGIN, days: DANA_DAYS }] }).people[0]).toEqual({ name: 'Dana', person_id: DANA, user_id: DANA_LOGIN, days: DANA_DAYS })
  })
  it('a shaped trip shapes to itself, so the server’s preparation passes through writeRpcBody unchanged', () => {
    const once = p({ id: TRIP, job_ids: [JOB_2, JOB], asked_by: 'us', billing: 'ours' })
    expect(tripInput('plan_trip', { trip: once })).toEqual({ ok: true, p: once, target: TRIP })
  })
  it('builds the shared path’s body: the plan a dry run, the apply the write with its own dry run first', () => {
    const plan = writeRpcBody('plan_trip', { trip: ASK })
    expect(plan).toMatchObject({ ok: true, rpc: 'trip_save', step: 'plan', target: SITE, planHash: null, body: { p_dry_run: true, p: { via: 'mcp', agent_label: 'the ledger robot' } } })
    const apply = writeRpcBody('apply_trip', { trip: ASK, plan_hash: HASH.toUpperCase() })
    expect(apply).toMatchObject({ ok: true, rpc: 'trip_save', step: 'apply', planHash: HASH, body: { p_dry_run: false }, dryRunBody: { p_dry_run: true } })
    if (plan.ok && apply.ok) expect(apply.body.p).toEqual(plan.body.p)
    expect(writeRpcBody('apply_trip', { trip: ASK })).toMatchObject({ ok: false, error: expect.stringContaining('apply_trip needs plan_hash') })
    expect(writeRpcBody('plan_trip', {})).toMatchObject({ ok: false, error: expect.stringContaining('plan_trip needs trip') })
  })
  it('refuses, in plain words, what is not a trip', () => {
    expect(refusal({ development_id: undefined })).toBe('plan_trip: a trip belongs to a development, or to a job with no development. Give development_id or job_id.')
    expect(refusal({ job_id: JOB })).toContain('give development_id or job_id, not both')
    expect(refusal({ development_id: 'Heron Point' })).toContain('development_id is a developments.id')
    expect(refusal({ id: 'the last one' })).toContain('id is a trips.id')
    expect(refusal({ agent_label: '  ' })).toContain('agent_label is the robot’s name')
    expect(refusal({ agent_label: 'r'.repeat(TRIP_AGENT_LABEL_MAX + 1) })).toBe(`plan_trip: agent_label is ${TRIP_AGENT_LABEL_MAX + 1} characters; the most is ${TRIP_AGENT_LABEL_MAX}.`)
    expect(refusal({ purpose: 'x'.repeat(TRIP_PURPOSE_MAX + 1) })).toContain(`the most is ${TRIP_PURPOSE_MAX}`)
    expect(refusal({ people: [] })).toContain('people is the list of who went')
    expect(refusal({ people: [{ name: 'Dana', days: DANA_DAYS }, { name: '  ', days: LUIS_DAYS }] })).toBe('plan_trip: everyone on a trip has a name; person 2 has none.')
    expect(refusal({ people: [{ name: 'Dana', days: DANA_DAYS }, { name: ' dana ', days: LUIS_DAYS }] })).toBe('plan_trip: dana is on this trip twice.')
    expect(refusal({ people: [{ name: 'Dana', days: {} }, { name: 'Luis' }] })).toBe('plan_trip: a trip needs one person and one day; nobody here has a day.')
    expect(refusal({ people: [{ name: 'Dana', days: { '2026-02-30': 'site' } }] })).toBe('plan_trip: Dana’s days: "2026-02-30" is not a real calendar day (YYYY-MM-DD).')
    expect(refusal({ people: [{ name: 'Dana', days: { '10/31/2026': 'site' } }] })).toContain('is not a real calendar day')
    expect(refusal({ people: [{ name: 'Dana', days: { '2026-10-31': 'office' } }] })).toBe('plan_trip: Dana’s days: "office" is not a kind of day; a day is ready, road or site.')
    expect(refusal({ people: [{ name: 'Dana', days: [{ from: '2026-01-01', to: '2026-12-31', kind: 'site' }] }] })).toBe(`plan_trip: Dana’s days: a run is at most ${TRIP_RUN_MAX_DAYS} days; 2026-01-01 to 2026-12-31 is 365.`)
    expect(refusal({ people: [{ name: 'Dana', days: [{ from: '2026-11-03', to: '2026-10-31', kind: 'site' }] }] })).toContain('a run ends on or after the day it starts')
    expect(refusal({ people: [{ name: 'Dana', days: 'all week' }] })).toContain('days is an object of day to kind, or a list of runs')
    expect(refusal({ people: [{ name: 'Dana', person_id: 'dana', days: DANA_DAYS }] })).toContain('Dana’s person_id is a people.id')
    expect(refusal({ asked_by: 'the GC' })).toBe('plan_trip: asked_by is us or them.')
    expect(refusal({ asked_by: 'us', asked_who: 'Walt' })).toContain('they go with asked_by: "them"')
    expect(refusal({ billing: 'free' })).toBe('plan_trip: billing is inside, extra or ours.')
    expect(refusal({ job_ids: ['the rough in'] })).toContain('job_ids is a list of jobs_ledger ids')
    expect(shaped({ ...ASK }, 'apply_trip')).toMatchObject({ ok: true })
    expect(tripInput('apply_trip', { trip: null })).toMatchObject({ ok: false, error: expect.stringContaining('apply_trip needs trip') })
  })
})

describe('tripDaysFrom — a person’s days, either way they come', () => {
  it('reads an object of day to kind, and a list of runs, into the same stored form', () => {
    const asObject = tripDaysFrom({ '2026-11-02': 'site', '2026-10-31': 'SITE', '2026-10-30': 'road' })
    const asRuns = tripDaysFrom([{ from: '2026-10-30', kind: 'road' }, { from: '2026-10-31', to: '2026-11-02', kind: 'site' }, { from: '2026-11-01', kind: 'ready' }, { from: '2026-11-01', to: '2026-11-01', kind: 'site' }])
    expect(asObject).toEqual({ ok: true, days: { '2026-10-30': 'road', '2026-10-31': 'site', '2026-11-02': 'site' } })
    // A run with no `to` is one day, a run crosses the month end, and a later run wins the day two runs name.
    expect(asRuns).toEqual({ ok: true, days: { '2026-10-30': 'road', '2026-10-31': 'site', '2026-11-01': 'site', '2026-11-02': 'site' } })
    if (asObject.ok) expect(Object.keys(asObject.days)).toEqual(['2026-10-30', '2026-10-31', '2026-11-02'])
    expect(tripDaysFrom([{ from: '2026-10-31', to: '2026-11-03', kind: 'site' }, { from: '2026-11-01', kind: 'road' }])).toEqual({ ok: true, days: { '2026-10-31': 'site', '2026-11-01': 'road', '2026-11-02': 'site', '2026-11-03': 'site' } })
    expect(tripDaysFrom({})).toEqual({ ok: true, days: {} })
    expect(tripDaysFrom([])).toEqual({ ok: true, days: {} })
  })
  it('takes a run of exactly the most days and refuses one more', () => {
    expect(tripDaysFrom([{ from: '2026-01-01', to: '2026-04-30', kind: 'site' }])).toMatchObject({ ok: true })
    expect(tripDaysFrom([{ from: '2026-01-01', to: '2026-05-01', kind: 'site' }])).toMatchObject({ ok: false, why: expect.stringContaining('is 121') })
    expect(tripDaysFrom([{ from: '2026-02-29', kind: 'site' }])).toMatchObject({ ok: false, why: '"2026-02-29" is not a real calendar day (YYYY-MM-DD)' })
    expect(tripDaysFrom([{ from: '2026-10-31' }])).toMatchObject({ ok: false, why: expect.stringContaining('is not a kind of day') })
    expect(tripDaysFrom(['2026-10-31'])).toMatchObject({ ok: false, why: 'a run is { from, to?, kind }' })
  })
})

describe('tripStableId — the id a trip with none is saved under', () => {
  it('is a well-formed uuid, the same for the same trip and another for a changed day', async () => {
    const id = await tripStableId(p())
    expect(id).toMatch(UUID_V4)
    expect(await tripStableId(p())).toBe(id)
    expect(await tripStableId(p({ people: [{ name: 'Dana', days: { ...DANA_DAYS, '2026-11-03': 'site' } }, { name: 'Luis', days: LUIS_DAYS }] }))).not.toBe(id)
    expect(await tripStableId(p({ purpose: 'Top out, building C' }))).not.toBe(id)
    expect(await tripStableId(p({ development_id: OTHER_SITE }))).not.toBe(id)
  })
  it('reads the same trip written another way as the same trip', async () => {
    const id = await tripStableId(p())
    // People in another order, and Luis's days as a run list: the same trip.
    const other = p({ people: [{ name: 'Luis', days: [{ from: '2026-11-02', kind: 'site' }, { from: '2026-10-31', kind: 'site' }] }, { name: 'Dana', days: DANA_DAYS }] })
    expect(await tripStableId(other)).toBe(id)
    expect(tripIdBasis(other)).toBe(tripIdBasis(p()))
    // An id on the payload is not part of what the id is read from.
    expect(tripIdBasis(p({ id: TRIP }))).toBe(tripIdBasis(p()))
  })
})

describe('fillTripPeople — a name laid over the roster', () => {
  const roster: RosterPerson[] = ROSTER.filter((r) => r.archived_at == null).map((r) => ({ id: String(r.id), name: String(r.name), account_user_id: (r.account_user_id as string | null) ?? null }))
  const person = (name: string, extra: Record<string, unknown> = {}) => ({ name, days: { '2026-10-31': 'site' as const }, ...extra })

  it('one match fills the roster row and the login; no match, or several, leaves a name alone and says which', () => {
    const filled = fillTripPeople([person('dana'), person('Luis'), person('Ray'), person('Omar')], roster)
    if ('refused' in filled) throw new Error(filled.refused)
    expect(filled.people).toEqual([
      { name: 'dana', person_id: DANA, user_id: DANA_LOGIN, days: { '2026-10-31': 'site' } },
      { name: 'Luis', person_id: LUIS, days: { '2026-10-31': 'site' } },
      { name: 'Ray', days: { '2026-10-31': 'site' } },
      { name: 'Omar', days: { '2026-10-31': 'site' } },
    ])
    expect(filled.fits.map((f) => [f.name, f.fit, f.roster])).toEqual([
      ['dana', 'roster', 'on the roster'],
      ['Luis', 'roster', 'on the roster'],
      ['Ray', 'unknown', 'a name alone: not on the roster'],
      ['Omar', 'several', 'a name alone: two people have this name'],
    ])
    expect(filled.fits[0]).toMatchObject({ person_id: DANA, user_id: DANA_LOGIN })
    expect(filled.fits[2]).toMatchObject({ person_id: null, user_id: null })
  })
  it('keeps an id the call gave, fills its login, and refuses one that names nobody', () => {
    const given: RosterPerson[] = [{ id: DANA, name: 'Dana', account_user_id: DANA_LOGIN }, { id: OMAR_2, name: 'omar', account_user_id: null }]
    const filled = fillTripPeople([person('Dana', { person_id: DANA }), person('Omar Reyes', { person_id: OMAR_2 })], roster, given)
    if ('refused' in filled) throw new Error(filled.refused)
    expect(filled.people[0]).toEqual({ name: 'Dana', person_id: DANA, user_id: DANA_LOGIN, days: { '2026-10-31': 'site' } })
    expect(filled.fits.map((f) => f.roster)).toEqual(['on the roster, by the id given', 'on the roster, by the id given: the roster names them omar'])
    expect(fillTripPeople([person('Walt', { person_id: LUIS })], roster, [])).toEqual({ refused: expect.stringContaining('Walt’s person_id names nobody on the roster') })
  })
})

describe('prepareTripWrite — the id, the home and the roster, the same at plan and at apply', () => {
  it('reads the site, the jobs and the unarchived roster as the dev, makes the id, and hands writeRpcBody the trip whole', async () => {
    const log: Array<{ table: string; q: RowsQuery }> = []
    const prep = await prepareTripWrite('plan_trip', { trip: { ...ASK, job_ids: [JOB], people: [...ASK.people, { name: 'Ray', days: [{ from: '2026-10-31', kind: 'site' }] }, { name: 'Priya', days: {} }] } }, fake(WORLD, log))
    if (!prep.ok) throw new Error(prep.error)
    expect(prep.idWas).toBe('made')
    expect(prep.p.id).toMatch(UUID_V4)
    expect(prep.home).toEqual({ kind: 'development', id: SITE, name: 'Heron Point', city: 'Marlow', number: null })
    expect(prep.jobs).toEqual([{ id: JOB, name: 'Heron Point rough in', number: '9001' }])
    expect(prep.p.people.map((x) => [x.name, x.person_id ?? null, x.user_id ?? null])).toEqual([['Dana', DANA, DANA_LOGIN], ['Luis', LUIS, null], ['Ray', null, null], ['Priya', null, null]])
    // Priya is archived on the roster, so she is a name alone.
    expect(prep.people.map((f) => f.roster)).toEqual(['on the roster', 'on the roster', 'a name alone: not on the roster', 'a name alone: not on the roster'])
    expect(log.find((l) => l.table === 'people')?.q.filters).toEqual([{ column: 'archived_at', op: 'is', value: null }])
    const built = writeRpcBody('plan_trip', prep.args)
    expect(built.ok && built.body.p).toEqual(prep.p)
    expect(built).toMatchObject({ ok: true, target: prep.p.id })
  })
  it('gives the plan and the apply the same payload, so the two hash alike; a roster that changed does not', async () => {
    const reply = { dry_run: true, would: 'add', trip_id: 'x', people: 2, person_days: 7, first_day: '2026-10-29', last_day: '2026-11-03', jobs: 0 }
    const plan = await prepareTripWrite('plan_trip', { trip: ASK }, fake(WORLD))
    const apply = await prepareTripWrite('apply_trip', { trip: ASK, plan_hash: HASH }, fake(WORLD))
    if (!plan.ok || !apply.ok) throw new Error('expected both to prepare')
    expect(apply.p).toEqual(plan.p)
    expect(apply.args.plan_hash).toBe(HASH)
    expect(await planHash('apply_trip', apply.p, reply)).toBe(await planHash('plan_trip', plan.p, reply))
    // Luis leaves the roster between the two: the same id (it is read from the ask), another payload, another hash.
    const later = await prepareTripWrite('apply_trip', { trip: ASK, plan_hash: HASH }, fake({ ...WORLD, people: ROSTER.filter((r) => r.id !== LUIS) }))
    if (!later.ok) throw new Error(later.error)
    expect(later.p.id).toBe(plan.p.id)
    expect(later.p.people[1]).toEqual({ name: 'Luis', days: LUIS_DAYS })
    expect(await planHash('apply_trip', later.p, reply)).not.toBe(await planHash('plan_trip', plan.p, reply))
    // Once the trip is kept the database answers change for the same payload, so a second apply no longer matches.
    expect(await planHash('apply_trip', apply.p, { ...reply, would: 'change' })).not.toBe(await planHash('plan_trip', plan.p, reply))
  })
  it('keeps an id the call gave, and reads a job with no development as the home', async () => {
    const prep = await prepareTripWrite('plan_trip', { trip: { ...ASK, development_id: undefined, job_id: JOB, id: TRIP } }, fake(WORLD))
    if (!prep.ok) throw new Error(prep.error)
    expect(prep.p.id).toBe(TRIP)
    expect(prep.idWas).toBe('given')
    expect(prep.home).toEqual({ kind: 'job', id: JOB, name: 'Heron Point rough in', city: null, number: '9001' })
  })
  it('refuses a site, a job or a person nobody can find, in words, before any dry run', async () => {
    expect(await prepareTripWrite('plan_trip', { trip: { ...ASK, development_id: OTHER_SITE } }, fake(WORLD))).toEqual({ ok: false, error: expect.stringContaining(`no development has the id ${OTHER_SITE}`) })
    expect(await prepareTripWrite('plan_trip', { trip: { ...ASK, development_id: undefined, job_id: OTHER_SITE } }, fake(WORLD))).toEqual({ ok: false, error: expect.stringContaining('no job has the id') })
    expect(await prepareTripWrite('plan_trip', { trip: { ...ASK, job_ids: [JOB, OTHER_SITE] } }, fake(WORLD))).toEqual({ ok: false, error: expect.stringContaining(`job_ids names 1 job nobody can find: ${OTHER_SITE}`) })
    expect(await prepareTripWrite('plan_trip', { trip: { ...ASK, people: [{ name: 'Walt', person_id: OTHER_SITE, days: LUIS_DAYS }] } }, fake(WORLD))).toEqual({ ok: false, error: expect.stringContaining('Walt’s person_id names nobody') })
    expect(await prepareTripWrite('plan_trip', { trip: { ...ASK, people: [] } }, fake(WORLD))).toMatchObject({ ok: false, error: expect.stringContaining('people is the list of who went') })
  })
  it('a plan names the days another trip kept there already claims; an apply does not read for them', async () => {
    const kept: Row = { id: TRIP, trip_number: 3, development_id: SITE, job_id: null, via: 'app', trip_people: [{ person_id: DANA, user_id: DANA_LOGIN, person_name: 'Dana', days: { '2026-10-31': 'site', '2026-11-01': 'site' } }, { person_id: null, user_id: null, person_name: 'luis', days: { '2026-11-02': 'road' } }], trip_jobs: [] }
    const world = { ...WORLD, trips: [kept] }
    const plan = await prepareTripWrite('plan_trip', { trip: ASK }, fake(world))
    if (!plan.ok) throw new Error(plan.error)
    expect(plan.overlaps).toEqual([
      { trip_id: TRIP, trip_number: 3, name: 'Dana', days: 1, first_day: '2026-10-31', last_day: '2026-10-31' },
      { trip_id: TRIP, trip_number: 3, name: 'Luis', days: 1, first_day: '2026-11-02', last_day: '2026-11-02' },
    ])
    // The note names the kept trip by its number, with its id beside it.
    expect((tripPlanWords(plan, { dry_run: true, would: 'add', trip_id: plan.p.id }, '2026-11-17').notes as string[]).join(' ')).toContain(`on another trip kept here, Trip 3 (${TRIP}).`)
    // The same trip, changed under its own id, overlaps nothing.
    const change = await prepareTripWrite('plan_trip', { trip: { ...ASK, id: TRIP } }, fake(world))
    expect(change.ok && change.overlaps).toEqual([])
    const log: Array<{ table: string; q: RowsQuery }> = []
    const apply = await prepareTripWrite('apply_trip', { trip: ASK, plan_hash: HASH }, fake(world, log))
    expect(apply.ok && apply.overlaps).toEqual([])
    expect(log.some((l) => l.table === 'trips')).toBe(false)
    expect(tripOverlaps(plan.p, [])).toEqual([])
  })
})

describe('the plan, as a person reads it', () => {
  const prepared = async (over: Record<string, unknown> = {}): Promise<TripPrepared> => {
    const prep = await prepareTripWrite('plan_trip', { trip: { ...ASK, job_ids: [JOB], asked_by: 'them', asked_who: 'Walt, the super', asked_how: 'by phone', billing: 'extra', people: [...ASK.people, { name: 'Ray', days: [{ from: '2026-10-31', kind: 'site' }] }], ...over } }, fake(WORLD))
    if (!prep.ok) throw new Error(prep.error)
    return prep
  }
  const dry = (would: 'add' | 'change', id: string) => ({ dry_run: true, would, trip_id: id, people: 3, person_days: 8, first_day: '2026-10-29', last_day: '2026-11-03', jobs: 1 })

  it('names the site, the days, where it would stand, each person and how they were tied to the roster', async () => {
    const prep = await prepared()
    const words = tripPlanWords(prep, dry('add', prep.p.id ?? ''), '2026-11-17')
    expect(words.reads).toBe('Would add a trip to Heron Point, 2026-10-29 to 2026-11-03: 5 days (2 at the site, 2 on the road, 1 getting ready), 3 people. Today (2026-11-17) it would read Back.')
    expect(words.trip).toMatchObject({
      id: prep.p.id,
      id_was: 'made from the trip’s own words',
      on: { development: { id: SITE, name: 'Heron Point', city: 'Marlow' } },
      first_day: '2026-10-29',
      last_day: '2026-11-03',
      standing: 'back',
      standing_words: 'Back',
      days: { site: 2, road: 2, ready: 1, days: 5 },
      purpose: 'Rough in, building C',
      asked: { by: 'them', who: 'Walt, the super', how: 'by phone' },
      billing: 'extra',
      jobs: [{ id: JOB, name: 'Heron Point rough in', number: '9001' }],
      via: 'mcp',
      agent_label: 'the ledger robot',
    })
    expect((words.trip as { people: unknown[] }).people).toEqual([
      { name: 'Dana', roster: 'on the roster', person_id: DANA, user_id: DANA_LOGIN, first_day: '2026-10-29', last_day: '2026-11-03', days: { site: 2, road: 2, ready: 1, days: 5 }, reads: '5 days: 2 at the site, 2 on the road, 1 getting ready' },
      { name: 'Luis', roster: 'on the roster', person_id: LUIS, user_id: null, first_day: '2026-10-31', last_day: '2026-11-02', days: { site: 2, road: 0, ready: 0, days: 2 }, reads: '2 days: 2 at the site' },
      { name: 'Ray', roster: 'a name alone: not on the roster', person_id: null, user_id: null, first_day: '2026-10-31', last_day: '2026-10-31', days: { site: 1, road: 0, ready: 0, days: 1 }, reads: '1 day: 1 at the site' },
    ])
    const notes = (words.notes as string[]).join(' ')
    expect(notes).toContain('the same trip planned again lands on this id and reads change')
    expect(notes).toContain('Ray is a name alone')
    expect(notes).toContain('It changes no clock row, bill or cost.')
    expect(words).not.toHaveProperty('overlaps')
  })
  it('reads where the trip stands from today, in these words alone', async () => {
    const prep = await prepared()
    const stand = (today: string) => (tripPlanWords(prep, dry('add', prep.p.id ?? ''), today).trip as { standing: string }).standing
    expect([stand('2026-10-28'), stand('2026-10-29'), stand('2026-11-01'), stand('2026-11-03'), stand('2026-11-04')]).toEqual(['planned', 'out', 'out', 'out', 'back'])
    // The hash is of the payload and the database's reply: today is in neither.
    const reply = dry('add', prep.p.id ?? '')
    const hash = await planHash('plan_trip', prep.p, reply)
    const shown = { ...planReply('plan_trip', reply, hash), ...tripPlanWords(prep, reply, '2026-11-17') }
    expect(Object.keys(shown).slice(0, 2)).toEqual(['plan_hash', 'next'])
    expect(shown).toMatchObject({ plan_hash: hash, would: 'add', people: 3, person_days: 8, jobs: 1 })
    expect(String(shown.next)).toContain('apply_trip')
  })
  it('says what a change does, and what a given id that names no trip does', async () => {
    const prep = await prepared({ id: TRIP })
    const change = tripPlanWords(prep, dry('change', TRIP), '2026-11-01')
    expect(change.reads).toContain('Would change the trip to Heron Point')
    expect(change.reads).toContain('it would read Out now.')
    expect((change.notes as string[])[0]).toContain('A change replaces the trip whole')
    expect((tripPlanWords(prep, dry('add', TRIP), '2026-11-01').notes as string[])[0]).toContain('That is how a deleted trip is put back.')
    expect(tripSaveWould(dry('add', TRIP))).toBe('add')
    expect(tripSaveWould(dry('change', TRIP))).toBe('change')
    expect(tripSaveWould({ did: 'added' })).toBeNull()
    expect(tripCountsWords({ site: 0, road: 3, ready: 0, days: 3 })).toBe('3 on the road')
  })
  it('the applied reply says where to read the trip back, and that a delete is the app’s', async () => {
    const prep = await prepared()
    const done = tripAppliedWords(prep, { dry_run: false, did: 'added', trip_id: prep.p.id, people: 3, person_days: 8, first_day: '2026-10-29', last_day: '2026-11-03', jobs: 1 })
    expect(done).toMatchObject({ did: 'added', trip_id: prep.p.id, reads: 'Added a trip to Heron Point: 3 people, 2026-10-29 to 2026-11-03.' })
    expect(String(done.next)).toContain(`read_trips { development_id: "${SITE}" } reads it back`)
    expect(String(done.next)).toContain(`plan_trip with id: "${prep.p.id}"`)
    expect(String(done.next)).toContain('Deleting a trip is done in the app.')
  })
  it('names the trip’s number: a kept trip’s in the plan, the one it was given in the applied reply', async () => {
    const prep = await prepared({ id: TRIP })
    const change = tripPlanWords(prep, { ...dry('change', TRIP), trip_number: 3 }, '2026-11-01')
    expect((change.trip as { trip_number: unknown }).trip_number).toBe(3)
    expect((change.notes as string[]).join(' ')).toContain('It is Trip 3 on its site, and a change keeps that number.')
    // A trip not kept yet has no number: the database hands it out on the save.
    const add = tripPlanWords(prep, { ...dry('add', TRIP), trip_number: null }, '2026-11-01')
    expect((add.trip as { trip_number: unknown }).trip_number).toBeNull()
    expect((add.notes as string[]).join(' ')).toContain('The database hands the trip its number on its site when it is kept')
    const done = tripAppliedWords(prep, { dry_run: false, did: 'added', trip_id: TRIP, people: 3, person_days: 8, first_day: '2026-10-29', last_day: '2026-11-03', jobs: 1, trip_number: 7 })
    expect(done.reads).toBe('Added a trip to Heron Point: 3 people, 2026-10-29 to 2026-11-03. It is Trip 7.')
    expect(done).toMatchObject({ trip_number: 7 })
    expect(tripAppliedWords(prep, { did: 'changed', trip_id: TRIP, first_day: '2026-10-29', last_day: '2026-10-29', trip_number: 3 }).reads).toBe('Changed the trip to Heron Point: 3 people, 2026-10-29. It is Trip 3.')
  })
  it('reads a number only as the database gives one: a whole number from 1', () => {
    expect([tripNumberOf(1), tripNumberOf(14), tripNumberOf(0), tripNumberOf(-2), tripNumberOf(2.5), tripNumberOf('3'), tripNumberOf(null), tripNumberOf(undefined)]).toEqual([1, 14, null, null, null, null, null, null])
  })
  it('the call log keeps the home, the names and a count of days, and an apply’s plan_hash', () => {
    const logged = tripArgsForLog('apply_trip', { trip: { ...ASK, purpose: 'x'.repeat(400) }, plan_hash: ` ${HASH.toUpperCase()} ` })
    expect(logged).toMatchObject({ plan_hash: HASH, trip: { development_id: SITE, agent_label: 'the ledger robot', people: [{ name: 'Dana', days: '5 days' }, { name: 'Luis', days: '2 days' }] } })
    expect(JSON.stringify(logged).length).toBeLessThan(900)
    expect(tripArgsForLog('plan_trip', { trip: ASK })).not.toHaveProperty('plan_hash')
    expect(tripArgsForLog('plan_trip', {})).toEqual({ trip: null })
  })
})

describe('readTrips — a site’s trips, in the order they went out', () => {
  const person = (name: string, days: Record<string, string>, ids: { person_id?: string; user_id?: string } = {}): Row => ({ person_id: ids.person_id ?? null, user_id: ids.user_id ?? null, person_name: name, days })
  const row = (id: string, people: Row[], over: Row = {}): Row => ({ id, development_id: SITE, job_id: null, purpose: '', asked_by: null, asked_who: '', asked_how: '', outcome: '', billing: null, via: 'app', agent_label: null, created_at: '2026-11-05T15:00:00Z', updated_at: '2026-11-05T15:00:00Z', trip_people: people, trip_jobs: [], ...over })
  const MONTH_END = row('eeeeeeee-0002-4000-8000-000000000002', [person('Luis', LUIS_DAYS, { person_id: LUIS }), person('Dana', DANA_DAYS, { person_id: DANA, user_id: DANA_LOGIN })], {
    purpose: 'Rough in, building C',
    asked_by: 'them',
    asked_who: 'Walt, the super',
    asked_how: 'by phone',
    outcome: 'Passed.',
    billing: 'extra',
    via: 'mcp',
    agent_label: 'the ledger robot',
    trip_jobs: [{ job_id: JOB }],
    trip_number: 2,
  })
  const EARLIER = row('eeeeeeee-0001-4000-8000-000000000001', [person('Omar', { '2026-09-14': 'road', '2026-09-15': 'site' })])
  const AHEAD = row('eeeeeeee-0003-4000-8000-000000000003', [person('Priya', { '2026-12-01': 'ready', 'next week': 'site', '2026-12-02': 'flying' })])
  const NO_DAY = row('eeeeeeee-0000-4000-8000-000000000000', [person('Ray', {})])
  const ELSEWHERE = row('eeeeeeee-0009-4000-8000-000000000009', [person('Walt', { '2026-10-01': 'site' })], { development_id: OTHER_SITE })

  it('reads a trip across a month end with a day off in the middle: its span, its counts, and where it stands', async () => {
    const out = await readTrips(fake({ ...WORLD, trips: [MONTH_END] }), { development_id: SITE }, '2026-11-01')
    if ('refused' in out) throw new Error(out.refused)
    expect(out.trips).toHaveLength(1)
    expect(out.trips[0]).toEqual({
      id: MONTH_END.id,
      trip_number: 2,
      first_day: '2026-10-29',
      last_day: '2026-11-03',
      standing: 'out',
      standing_words: 'Out now',
      // Nobody was on it on November 1, so that day is in no count: five days, the site counted once a day.
      days: { site: 2, road: 2, ready: 1, days: 5 },
      people: [
        { name: 'Dana', person_id: DANA, user_id: DANA_LOGIN, days: DANA_DAYS },
        { name: 'Luis', person_id: LUIS, user_id: null, days: LUIS_DAYS },
      ],
      purpose: 'Rough in, building C',
      asked_by: 'them',
      asked_who: 'Walt, the super',
      asked_how: 'by phone',
      outcome: 'Passed.',
      billing: 'extra',
      job_ids: [JOB],
      via: 'mcp',
      agent_label: 'the ledger robot',
      development_id: SITE,
      job_id: null,
      created_at: '2026-11-05T15:00:00Z',
      updated_at: '2026-11-05T15:00:00Z',
    })
    expect(out).toMatchObject({ on: { kind: 'development', id: SITE, name: 'Heron Point' }, today: '2026-11-01', count: 1, standing: { planned: 0, out: 1, back: 0 }, reading: '1 trip on Heron Point: 1 out now. In the order they went out.' })
    expect(out).not.toHaveProperty('capped')
    // The same rules the Trips look reads, not a second copy of them.
    const asTrip = { id: 'x', people: [{ personKey: 'dana', name: 'Dana', days: DANA_DAYS as never }, { personKey: 'luis', name: 'Luis', days: LUIS_DAYS as never }] }
    expect(out.trips[0]?.days).toEqual(tripDayCounts(asTrip))
    expect([out.trips[0]?.first_day, out.trips[0]?.last_day]).toEqual([tripSpan(asTrip)?.first, tripSpan(asTrip)?.last])
    expect(out.trips[0]?.standing).toBe(tripStanding(asTrip, '2026-11-01'))
    expect(tripReadOf(MONTH_END, '2026-10-28').standing).toBe('planned')
    expect(tripReadOf(MONTH_END, '2026-11-03').standing).toBe('out')
    expect(tripReadOf(MONTH_END, '2026-11-04').standing).toBe('back')
  })
  it('reads only the site’s trips, in the order they went out, a trip with no day last, and drops what is not a day', async () => {
    const log: Array<{ table: string; q: RowsQuery }> = []
    const out = await readTrips(fake({ ...WORLD, trips: [AHEAD, NO_DAY, MONTH_END, ELSEWHERE, EARLIER] }, log), { development_id: SITE.toUpperCase() }, '2026-11-17')
    if ('refused' in out) throw new Error(out.refused)
    expect(out.trips.map((t) => [t.id, t.standing])).toEqual([[EARLIER.id, 'back'], [MONTH_END.id, 'back'], [AHEAD.id, 'planned'], [NO_DAY.id, 'planned']])
    expect(out.reading).toBe('4 trips on Heron Point: 2 planned, 2 back. In the order they went out.')
    expect(out.trips[2]?.people[0]?.days).toEqual({ '2026-12-01': 'ready' })
    expect(out.trips[3]).toMatchObject({ first_day: null, last_day: null, days: { site: 0, road: 0, ready: 0, days: 0 } })
    // A row that carries no number reads null, never a made-up one.
    expect(out.trips.map((t) => t.trip_number)).toEqual([null, 2, null, null])
    const read = log.find((l) => l.table === 'trips')
    expect(read?.q.select).toBe(TRIP_SELECT)
    expect(read?.q.filters).toEqual([{ column: 'development_id', op: 'eq', value: SITE }])
    expect(read?.q.order).toEqual([{ column: 'id' }])
  })
  it('for a job: the trips the job holds by itself and the trips whose work goes on it, each once', async () => {
    const HELD = row('eeeeeeee-0004-4000-8000-000000000004', [person('Dana', { '2026-08-03': 'site' })], { development_id: null, job_id: JOB })
    const HELD_WITH_SITE = row('eeeeeeee-0005-4000-8000-000000000005', [person('Dana', { '2026-08-10': 'site' })], { job_id: JOB })
    const OTHER_JOB = row('eeeeeeee-0006-4000-8000-000000000006', [person('Luis', { '2026-08-17': 'site' })], { trip_jobs: [{ job_id: JOB_2 }] })
    const world = { ...WORLD, trips: [MONTH_END, HELD, HELD_WITH_SITE, OTHER_JOB], trip_jobs: [{ trip_id: MONTH_END.id, job_id: JOB }, { trip_id: HELD.id, job_id: JOB }, { trip_id: OTHER_JOB.id, job_id: JOB_2 }] }
    const log: Array<{ table: string; q: RowsQuery }> = []
    const out = await readTrips(fake(world, log), { job_id: JOB }, '2026-11-17')
    if ('refused' in out) throw new Error(out.refused)
    expect(out.trips.map((t) => t.id)).toEqual([HELD.id, MONTH_END.id])
    expect(out.on).toEqual({ kind: 'job', id: JOB, name: 'Heron Point rough in' })
    expect(out.reading).toBe('2 trips on the job Heron Point rough in: 2 back. In the order they went out.')
    expect(log.find((l) => l.table === 'trips')?.q.filters).toEqual([{ column: 'job_id', op: 'eq', value: JOB }, { column: 'development_id', op: 'is', value: null }])
    expect(log.find((l) => l.table === 'trip_jobs')?.q).toMatchObject({ select: 'trip_id,job_id', filters: [{ column: 'job_id', op: 'eq', value: JOB }], order: [{ column: 'trip_id' }] })
  })
  it('says so when nothing is kept, and still answers a reader who cannot read the site’s name', async () => {
    const none = await readTrips(fake(WORLD), { development_id: SITE }, '2026-11-17')
    expect(none).toMatchObject({ count: 0, trips: [], reading: 'No trip is kept on Heron Point, or none this reader may read.' })
    const base = fake({ ...WORLD, trips: [EARLIER] })
    const crew: Reader = { rpc: base.rpc, rows: async (table, q) => (table === 'developments' ? Promise.reject(new Error('not yours')) : base.rows(table, q)) }
    const out = await readTrips(crew, { development_id: SITE }, '2026-11-17')
    expect(out).toMatchObject({ count: 1, on: { name: null }, reading: '1 trip on this development: 1 back. In the order they went out.' })
  })
  it('refuses neither, both, and an id that is not one', async () => {
    const words = 'read_trips needs development_id (a developments.id: read_rows on developments by name) or job_id (a jobs_ledger.id: find_job), one of the two.'
    expect(await readTrips(fake(WORLD), {}, '2026-11-17')).toEqual({ refused: words })
    expect(await readTrips(fake(WORLD), { development_id: SITE, job_id: JOB }, '2026-11-17')).toEqual({ refused: words })
    expect(await readTrips(fake(WORLD), { development_id: 'Heron Point' }, '2026-11-17')).toEqual({ refused: words })
  })
})
