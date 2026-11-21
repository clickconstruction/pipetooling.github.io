/**
 * dev-mcp's own handler, run here for read_trips and plan_trip → apply_trip (v2.7670, punch list #379 PR 4): the
 * function's index.ts with its three URL imports stood in for, and one `fetch` behind which sits a fake database.
 * `trip_save` is stood in for too, by a few lines that answer as the migration's function answers: a dry run says
 * add or change and counts, a real run saves the trip whole. Nothing reaches a network. Every name here is made up.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (req: Request) => Promise<Response>
type Row = Record<string, unknown>
const box: { handler: Handler | null } = { handler: null }

const DEV = 'ffffffff-2222-4222-8222-222222222222'
const SITE = 'aaaaaaaa-1111-4111-8111-111111111111' // Heron Point
const JOB = 'dddddddd-1111-4111-8111-111111111111'
const DANA = 'bbbbbbbb-1111-4111-8111-111111111111'
const DANA_LOGIN = 'cccccccc-1111-4111-8111-111111111111'
const LUIS = 'bbbbbbbb-2222-4222-8222-222222222222'
const BASE = 'http://127.0.0.1:9'
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const world = {
  tables: {} as Record<string, Row[]>,
  /** Every call of trip_save, dry or real, as it was POSTed. */
  saves: [] as Array<{ p: Row; dry: boolean }>,
  /** Every other write the server tried. None is expected. */
  writes: [] as Array<{ method: string; path: string }>,
  /** Tables whose read answers 500, for a read that fails. */
  broken: [] as string[],
  log: [] as Row[],
}

function matches(row: Row, key: string, expr: string): boolean {
  const v = row[key]
  if (expr === 'is.null') return v === null || v === undefined
  if (expr.startsWith('eq.')) return String(v ?? '') === expr.slice(3)
  if (expr.startsWith('gt.')) return String(v ?? '') > expr.slice(3)
  if (expr.startsWith('in.(')) return expr.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(v ?? ''))
  throw new Error(`fake REST: no filter "${expr}"`)
}
const RESERVED = ['select', 'order', 'limit']
function filtered(table: string, query: string): Row[] {
  const all = [...new URLSearchParams(query).entries()]
  const rows = (world.tables[table] ?? []).filter((r) => all.filter(([k]) => !RESERVED.includes(k)).every(([k, expr]) => matches(r, k, expr)))
  const order = all.find(([k]) => k === 'order')?.[1]
  if (order) {
    const [col, way] = order.split(',')[0]!.split('.') as [string, string | undefined]
    rows.sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * (way === 'desc' ? -1 : 1))
  }
  const limit = Number(all.find(([k]) => k === 'limit')?.[1] ?? 1000)
  const page = rows.slice(0, limit)
  // A trip is read whole: its people and its jobs ride on the row, as the select's embeds ask.
  if (table !== 'trips') return page
  return page.map((t) => ({ ...t, trip_people: (world.tables.trip_people ?? []).filter((x) => x.trip_id === t.id), trip_jobs: (world.tables.trip_jobs ?? []).filter((x) => x.trip_id === t.id) }))
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/**
 * trip_save as the migration's function answers (20261117234500): the counts, add or change, and a whole save. Since
 * 20261118040000 it names the trip's number: the one a kept trip has, null on a dry run of a new one, and the next on
 * its site when one is added.
 */
/**
 * The trigger on trips as migration 20261120130000 writes it (trips_refuse_joined_back): a trip made again under the
 * id of a trip that was joined into another is refused, in words, with code 22023. The words are written out here
 * and not taken from the seat, so the plan's sentence is held to the database's and not to itself.
 */
function refusedAsJoined(id: string): Row | null {
  const gone = (world.tables.deleted_records_archive ?? []).filter((a) => a.table_name === 'trips' && a.record_id === id && a.restored_at == null).sort((a, b) => String(b.deleted_at).localeCompare(String(a.deleted_at)))[0]
  const data = (gone?.row_data ?? {}) as { trip_number?: number; joined_into?: { trip_id?: string; trip_number?: number } }
  if (!data.joined_into?.trip_id) return null
  const there = (world.tables.trips ?? []).some((t) => t.id === data.joined_into!.trip_id)
  const head = `Trip ${data.trip_number} was joined into Trip ${data.joined_into.trip_number}, which holds its days.`
  return { code: '22023', message: there ? `${head} To take the join back, press Split in two on Trip ${data.joined_into.trip_number}.` : `${head} Put Trip ${data.joined_into.trip_number} back, then press Split in two on it.`, details: null, hint: null }
}

function tripSave(p: Row, dry: boolean): Row {
  const people = (p.people as Array<{ name: string; person_id?: string; user_id?: string; days: Record<string, string> }>) ?? []
  const jobs = [...new Set((p.job_ids as string[]) ?? [])]
  const days = people.flatMap((x) => Object.keys(x.days)).sort()
  const id = String(p.id ?? 'a-random-id')
  const was = (world.tables.trips ?? []).find((t) => t.id === id)
  const exists = !!was
  const number = was ? Number(was.trip_number) : (world.tables.trips ?? []).length + 1
  const counts = { trip_id: id, people: people.length, person_days: days.length, first_day: days[0] ?? null, last_day: days[days.length - 1] ?? null, jobs: jobs.length }
  if (dry) return { dry_run: true, would: exists ? 'change' : 'add', ...counts, trip_number: exists ? number : null }
  const words = { development_id: p.development_id ?? null, job_id: p.job_id ?? null, purpose: p.purpose ?? '', asked_by: p.asked_by ?? null, asked_who: p.asked_who ?? '', asked_how: p.asked_how ?? '', outcome: p.outcome ?? '', billing: p.billing ?? null }
  world.tables.trips = exists
    ? world.tables.trips!.map((t) => (t.id === id ? { ...t, ...words, updated_at: '2026-11-17T18:00:00Z' } : t))
    : [...(world.tables.trips ?? []), { id, trip_number: number, ...words, via: p.via ?? 'app', agent_label: p.agent_label ?? null, created_at: '2026-11-17T18:00:00Z', updated_at: '2026-11-17T18:00:00Z' }]
  world.tables.trip_people = [...(world.tables.trip_people ?? []).filter((x) => x.trip_id !== id), ...people.map((x) => ({ trip_id: id, person_id: x.person_id ?? null, user_id: x.user_id ?? null, person_name: x.name, days: x.days }))]
  world.tables.trip_jobs = [...(world.tables.trip_jobs ?? []).filter((x) => x.trip_id !== id), ...jobs.map((job_id) => ({ trip_id: id, job_id }))]
  return { dry_run: false, did: exists ? 'changed' : 'added', ...counts, trip_number: number }
}

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input))
  const method = (init?.method ?? 'GET').toUpperCase()
  const path = decodeURIComponent(url.pathname)
  if (path.startsWith('/rest/v1/') && method === 'GET') {
    const table = path.slice('/rest/v1/'.length)
    if (world.broken.includes(table)) return json({ code: 'XX000', message: 'the read failed', details: null, hint: null }, 500)
    return json(filtered(table, url.search.slice(1)))
  }
  if (path === '/rest/v1/rpc/trip_save' && method === 'POST') {
    const body = JSON.parse(String(init?.body)) as { p: Row; p_dry_run: boolean }
    world.saves.push({ p: body.p, dry: body.p_dry_run })
    // The dry run writes nothing, so it never reaches the trigger: only the save itself is refused.
    const refusal = !body.p_dry_run && !(world.tables.trips ?? []).some((t) => t.id === body.p.id) ? refusedAsJoined(String(body.p.id)) : null
    if (refusal) return json(refusal, 400)
    return json(tripSave(body.p, body.p_dry_run))
  }
  world.writes.push({ method, path })
  throw new Error(`fake fetch: no route for ${method} ${path}`)
}

function adminTable(name: string) {
  const eqs: Array<[string, unknown]> = []
  const chain = {
    select: () => chain,
    eq: (k: string, v: unknown) => (eqs.push([k, v]), chain),
    order: () => chain,
    limit: () => chain,
    update: () => chain,
    insert: async (row: Row) => {
      if (name === 'dev_mcp_calls') world.log.push({ ...row, created_at: '2026-11-17T18:00:00Z' })
      return { error: null }
    },
    maybeSingle: async () => {
      if (name === 'dev_mcp_credentials') return { data: { id: 'cred-1', user_id: DEV, revoked_at: null }, error: null }
      if (name === 'users') return { data: { id: DEV, email: 'dev@example.test', name: 'Dev Person', role: 'dev', archived_at: null, is_digital_twin: false }, error: null }
      return { data: null, error: null }
    },
    then: (resolve: (v: { data: Row[] }) => unknown, reject?: (e: unknown) => unknown) => {
      const want = Object.fromEntries(eqs)
      const rows = name === 'dev_mcp_calls' ? world.log.filter((r) => r.verb === want.verb && r.status === want.status && (r.args as Row | undefined)?.plan_hash === want['args->>plan_hash']) : []
      return Promise.resolve({ data: rows }).then(resolve, reject)
    },
  }
  return chain
}

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/pdf-lib@1.17.1', () => ({ PDFDocument: {} }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => ({
    auth: {
      admin: { generateLink: async () => ({ data: { properties: { hashed_token: 'hashed' } }, error: null }) },
      verifyOtp: async () => ({ data: { session: { access_token: 'jwt-dev', expires_at: 4102444800 } }, error: null }),
    },
    from: (name: string) => adminTable(name),
  }),
}))

const ENV: Record<string, string> = { SUPABASE_URL: BASE, SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' }
const FUNCTION_FILE = '../../../supabase/functions/dev-mcp/index.ts'
const realFetch = globalThis.fetch

beforeAll(async () => {
  // 2026-11-17 12:00 in the company's calendar.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-17T18:00:00Z'))
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  globalThis.fetch = fakeFetch as typeof fetch
  await import(/* @vite-ignore */ FUNCTION_FILE)
}, 120_000)
afterAll(() => {
  globalThis.fetch = realFetch
  vi.useRealTimers()
})

beforeEach(() => {
  world.tables = {
    developments: [{ id: SITE, name: 'Heron Point', city: 'Marlow' }],
    jobs_ledger: [{ id: JOB, job_name: 'Heron Point rough in', click_number: '9001', hcp_number: '' }],
    people: [
      { id: DANA, name: 'Dana', account_user_id: DANA_LOGIN, archived_at: null },
      { id: LUIS, name: 'Luis', account_user_id: null, archived_at: null },
    ],
    trips: [],
    trip_people: [],
    trip_jobs: [],
    deleted_records_archive: [],
  }
  world.saves = []
  world.writes = []
  world.broken = []
  world.log = []
})

async function call(name: string, args: Row): Promise<{ isError: boolean; text: string; body: Row | null }> {
  const res = await box.handler!(new Request('http://fn/dev-mcp', { method: 'POST', headers: { 'X-Dev-Token': 'ptd_test', 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) }))
  const out = (await res.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean } }
  const text = out.result?.content?.[0]?.text ?? ''
  let body: Row | null = null
  try {
    body = JSON.parse(text) as Row
  } catch {
    body = null
  }
  return { isError: out.result?.isError === true, text, body }
}

/** Dana out six days across the month end with one off in the middle, Luis two days, Ray a name alone. */
const TRIP: Row = {
  development_id: SITE,
  agent_label: 'the ledger robot',
  purpose: 'Rough in, building C',
  asked_by: 'them',
  asked_who: 'Walt, the super',
  billing: 'extra',
  job_ids: [JOB],
  people: [
    { name: 'Dana', days: [{ from: '2026-10-29', kind: 'ready' }, { from: '2026-10-30', kind: 'road' }, { from: '2026-10-31', kind: 'site' }, { from: '2026-11-02', kind: 'site' }, { from: '2026-11-03', kind: 'road' }] },
    { name: 'Luis', days: { '2026-10-31': 'site', '2026-11-02': 'site' } },
    { name: 'Ray', days: [{ from: '2026-10-31', kind: 'site' }] },
  ],
}
const realSaves = () => world.saves.filter((s) => !s.dry)

describe('plan_trip → apply_trip, through the function', () => {
  it('a plan writes nothing, and reads as a person would say it', async () => {
    const out = await call('plan_trip', { trip: TRIP })
    expect(out.isError).toBe(false)
    expect(realSaves()).toEqual([])
    expect(world.saves).toHaveLength(1)
    expect(out.body).toMatchObject({
      would: 'add',
      people: 3,
      person_days: 8,
      first_day: '2026-10-29',
      last_day: '2026-11-03',
      jobs: 1,
      reads: 'Would add a trip to Heron Point, 2026-10-29 to 2026-11-03: 5 days (2 at the site, 2 on the road, 1 getting ready), 3 people. Today (2026-11-17) it would read Back.',
      trip: { on: { development: { id: SITE, name: 'Heron Point' } }, standing: 'back', days: { site: 2, road: 2, ready: 1, days: 5 }, via: 'mcp', agent_label: 'the ledger robot' },
    })
    expect(String(out.body!.plan_hash)).toMatch(/^[0-9a-f]{64}$/)
    expect(String(out.body!.trip_id)).toMatch(UUID_V4)
    expect(((out.body!.trip as Row).people as Row[]).map((x) => [x.name, x.roster, x.person_id, x.user_id])).toEqual([
      ['Dana', 'on the roster', DANA, DANA_LOGIN],
      ['Luis', 'on the roster', LUIS, null],
      ['Ray', 'a name alone: not on the roster', null, null],
    ])
    // The payload the database saw: the id made by the server, the roster filled, via mcp and the robot's name.
    expect(world.saves[0]).toMatchObject({ dry: true, p: { id: out.body!.trip_id, via: 'mcp', agent_label: 'the ledger robot', development_id: SITE } })
    // Planning the same trip again lands on the same id and the same hash.
    const again = await call('plan_trip', { trip: TRIP })
    expect([again.body!.trip_id, again.body!.plan_hash]).toEqual([out.body!.trip_id, out.body!.plan_hash])
    expect(world.log[world.log.length - 1]).toMatchObject({ verb: 'plan_trip', status: 'ok', target: out.body!.trip_id, args: { trip: { development_id: SITE, people: [{ name: 'Dana', days: '5 days' }, { name: 'Luis', days: '2 days' }, { name: 'Ray', days: '1 day' }] } } })
  })

  it('an apply quoting the plan saves the trip whole, and read_trips reads it back', async () => {
    const plan = await call('plan_trip', { trip: TRIP })
    const done = await call('apply_trip', { trip: TRIP, plan_hash: plan.body!.plan_hash })
    expect(done.isError).toBe(false)
    expect(done.body).toMatchObject({ did: 'added', trip_id: plan.body!.trip_id, people: 3, trip_number: 1, reads: 'Added a trip to Heron Point: 3 people, 2026-10-29 to 2026-11-03. It is Trip 1.' })
    expect(realSaves()).toHaveLength(1)
    expect(realSaves()[0]!.p).toMatchObject({
      id: plan.body!.trip_id,
      via: 'mcp',
      agent_label: 'the ledger robot',
      job_ids: [JOB],
      people: [
        { name: 'Dana', person_id: DANA, user_id: DANA_LOGIN, days: { '2026-10-29': 'ready', '2026-10-30': 'road', '2026-10-31': 'site', '2026-11-02': 'site', '2026-11-03': 'road' } },
        { name: 'Luis', person_id: LUIS, days: { '2026-10-31': 'site', '2026-11-02': 'site' } },
        { name: 'Ray', days: { '2026-10-31': 'site' } },
      ],
    })
    expect(world.log[world.log.length - 1]).toMatchObject({ verb: 'apply_trip', status: 'ok', target: plan.body!.trip_id, args: { plan_hash: plan.body!.plan_hash } })

    const read = await call('read_trips', { development_id: SITE })
    expect(read.isError).toBe(false)
    expect(read.body).toMatchObject({ count: 1, today: '2026-11-17', on: { kind: 'development', id: SITE, name: 'Heron Point' }, reading: '1 trip on Heron Point: 1 back. In the order they went out.' })
    expect((read.body!.trips as Row[])[0]).toMatchObject({ id: plan.body!.trip_id, trip_number: 1, first_day: '2026-10-29', last_day: '2026-11-03', standing: 'back', days: { site: 2, road: 2, ready: 1, days: 5 }, via: 'mcp', agent_label: 'the ledger robot', billing: 'extra', asked_by: 'them', job_ids: [JOB] })
    expect(((read.body!.trips as Row[])[0]!.people as Row[]).map((x) => x.name)).toEqual(['Dana', 'Luis', 'Ray'])
    // The job's door finds it too: its work goes on that job.
    expect((await call('read_trips', { job_id: JOB })).body).toMatchObject({ count: 1, on: { kind: 'job', name: 'Heron Point rough in' } })
    expect(world.writes).toEqual([])
  })

  it('a new trip applied twice is refused the second time: the plan then reads change', async () => {
    const plan = await call('plan_trip', { trip: TRIP })
    await call('apply_trip', { trip: TRIP, plan_hash: plan.body!.plan_hash })
    const twice = await call('apply_trip', { trip: TRIP, plan_hash: plan.body!.plan_hash })
    expect(twice.isError).toBe(true)
    expect(twice.text).toContain('Nothing written: the plan you quoted')
    expect(twice.text).toContain('Call plan_trip again and read it.')
    expect(realSaves()).toHaveLength(1)
    // The plan read again says change, on the same id.
    expect((await call('plan_trip', { trip: TRIP })).body).toMatchObject({ would: 'change', trip_id: plan.body!.trip_id })
  })

  it('a trip deleted in the app is filed again by the same plan: the database’s answer, not the log, holds one apply', async () => {
    const plan = await call('plan_trip', { trip: TRIP })
    await call('apply_trip', { trip: TRIP, plan_hash: plan.body!.plan_hash })
    world.tables.trips = []
    world.tables.trip_people = []
    world.tables.trip_jobs = []
    const back = await call('apply_trip', { trip: TRIP, plan_hash: plan.body!.plan_hash })
    expect(back.isError).toBe(false)
    expect(back.body).toMatchObject({ did: 'added', trip_id: plan.body!.trip_id })
    expect(realSaves()).toHaveLength(2)
  })

  it('a roster that changed between the plan and the apply refuses the apply', async () => {
    const plan = await call('plan_trip', { trip: TRIP })
    world.tables.people = [...world.tables.people!, { id: 'bbbbbbbb-9999-4999-8999-999999999999', name: 'luis', account_user_id: null, archived_at: null }]
    const out = await call('apply_trip', { trip: TRIP, plan_hash: plan.body!.plan_hash })
    expect(out.isError).toBe(true)
    expect(out.text).toContain('Nothing written: the plan you quoted')
    expect(realSaves()).toEqual([])
    const fresh = await call('plan_trip', { trip: TRIP })
    expect(((fresh.body!.trip as Row).people as Row[])[1]).toMatchObject({ name: 'Luis', roster: 'a name alone: two people have this name', person_id: null })
    // The id is read from the ask, so it is the same trip still.
    expect(fresh.body!.trip_id).toBe(plan.body!.trip_id)
  })

  it('a change takes the trip’s id and the trip whole, and names a day another trip there already claims', async () => {
    const plan = await call('plan_trip', { trip: TRIP })
    await call('apply_trip', { trip: TRIP, plan_hash: plan.body!.plan_hash })
    const id = String(plan.body!.trip_id)
    // A word changed and no id: a second trip, and the plan says whose days the first already holds.
    const second = await call('plan_trip', { trip: { ...TRIP, outcome: 'Passed.' } })
    expect(second.body).toMatchObject({ would: 'add' })
    expect(second.body!.trip_id).not.toBe(id)
    expect(second.body!.overlaps).toEqual([
      { trip_id: id, trip_number: 1, name: 'Dana', days: 5, first_day: '2026-10-29', last_day: '2026-11-03' },
      { trip_id: id, trip_number: 1, name: 'Luis', days: 2, first_day: '2026-10-31', last_day: '2026-11-02' },
      { trip_id: id, trip_number: 1, name: 'Ray', days: 1, first_day: '2026-10-31', last_day: '2026-10-31' },
    ])
    // The same change under the trip's id: one trip, changed.
    const change = await call('plan_trip', { trip: { ...TRIP, id, outcome: 'Passed.' } })
    expect(change.body).toMatchObject({ would: 'change', trip_id: id, trip: { trip_number: 1 } })
    expect(change.body).not.toHaveProperty('overlaps')
    const done = await call('apply_trip', { trip: { ...TRIP, id, outcome: 'Passed.' }, plan_hash: change.body!.plan_hash })
    expect(done.body).toMatchObject({ did: 'changed', trip_id: id, trip_number: 1 })
    expect(String(done.body!.reads)).toContain('It is Trip 1.')
    expect(world.tables.trips).toHaveLength(1)
    expect(world.tables.trips![0]).toMatchObject({ id, outcome: 'Passed.' })
  })

  it('refuses a payload that changed after the plan, a missing hash, and a site nobody can find, before any write', async () => {
    const plan = await call('plan_trip', { trip: TRIP })
    const other = await call('apply_trip', { trip: { ...TRIP, purpose: 'Top out' }, plan_hash: plan.body!.plan_hash })
    expect(other.isError).toBe(true)
    expect(other.text).toContain('Nothing written: the plan you quoted')
    expect((await call('apply_trip', { trip: TRIP })).text).toContain('apply_trip needs plan_hash')
    expect((await call('plan_trip', { trip: { ...TRIP, development_id: 'aaaaaaaa-0000-4000-8000-000000000000' } })).text).toContain('no development has the id')
    expect((await call('plan_trip', { trip: { ...TRIP, people: [{ name: 'Dana', days: { '2026-02-30': 'site' } }] } })).text).toBe('plan_trip: Dana’s days: "2026-02-30" is not a real calendar day (YYYY-MM-DD).')
    expect(realSaves()).toEqual([])
  })

  describe('a trip that was joined into another', () => {
    const SECOND: Row = { ...TRIP, purpose: 'Top out, building C', people: [{ name: 'Dana', days: [{ from: '2026-11-05', to: '2026-11-06', kind: 'site' }] }] }
    /** Two trips kept, then Trip 2 joined into Trip 1 as the app's Join with next leaves it: gone, and marked in the archive. */
    async function joined(): Promise<{ one: string; two: string; planOfTwo: string }> {
      const first = await call('plan_trip', { trip: TRIP })
      await call('apply_trip', { trip: TRIP, plan_hash: first.body!.plan_hash })
      const second = await call('plan_trip', { trip: SECOND })
      await call('apply_trip', { trip: SECOND, plan_hash: second.body!.plan_hash })
      const one = String(first.body!.trip_id)
      const two = String(second.body!.trip_id)
      expect(world.tables.trips!.map((t) => [t.id, t.trip_number])).toEqual([[one, 1], [two, 2]])
      world.tables.trips = world.tables.trips!.filter((t) => t.id !== two)
      world.tables.trip_people = world.tables.trip_people!.filter((x) => x.trip_id !== two)
      world.tables.trip_jobs = world.tables.trip_jobs!.filter((x) => x.trip_id !== two)
      world.tables.deleted_records_archive = [{ id: 'archive-1', table_name: 'trips', record_id: two, deleted_at: '2026-11-17T17:00:00Z', restored_at: null, row_data: { id: two, trip_number: 2, development_id: SITE, joined_into: { trip_id: one, trip_number: 1 } } }]
      world.saves = []
      world.log = []
      return { one, two, planOfTwo: String(second.body!.plan_hash) }
    }
    const SENTENCE = 'Trip 2 was joined into Trip 1, which holds its days. To take the join back, press Split in two on Trip 1.'

    it('is refused at the plan in the words the save is refused with, and never reads add', async () => {
      const { two, planOfTwo } = await joined()
      const plan = await call('plan_trip', { trip: SECOND })
      expect(plan.isError).toBe(true)
      expect(plan.text).toBe(`plan_trip: this trip would not be saved. ${SENTENCE} The database refuses the save (22023), and apply_trip would be answered in the same words. Split in two is a press in the app, and this seat has no verb for it.`)
      expect(plan.text).not.toContain('add')
      expect(plan.text).not.toContain('plan_hash')
      // The one call the database had was the dry run, and nothing was written.
      expect(world.saves.map((s) => s.dry)).toEqual([true])
      expect(world.writes).toEqual([])
      expect(world.log[world.log.length - 1]).toMatchObject({ verb: 'plan_trip', status: 'refused', target: two })
      // The same under the trip's own id, the way a deleted trip is put back.
      expect((await call('plan_trip', { trip: { ...SECOND, id: two } })).text).toContain(SENTENCE)

      // The apply of a plan made before the join is what the database answers: the same sentence, from the trigger.
      const apply = await call('apply_trip', { trip: SECOND, plan_hash: planOfTwo })
      expect(apply.isError).toBe(true)
      expect(apply.text).toBe(`The app's API answered 400 (22023): ${SENTENCE}`)
      expect(plan.text).toContain(apply.text.slice(apply.text.indexOf('Trip 2')))
      expect(world.tables.trips!.map((t) => t.trip_number)).toEqual([1])
    })

    it('names the way back when the joined trip is deleted too', async () => {
      const { one } = await joined()
      world.tables.trips = world.tables.trips!.filter((t) => t.id !== one)
      const plan = await call('plan_trip', { trip: SECOND })
      expect(plan.isError).toBe(true)
      expect(plan.text).toContain('Trip 2 was joined into Trip 1, which holds its days. Put Trip 1 back, then press Split in two on it.')
      expect(realSaves()).toEqual([])
    })

    it('plans as before once the join is taken back, and for a trip somebody deleted', async () => {
      const { two } = await joined()
      // A trip somebody deleted carries no mark: its plan reads add, and that is how it is put back.
      world.tables.deleted_records_archive = [{ id: 'archive-2', table_name: 'trips', record_id: two, deleted_at: '2026-11-17T17:30:00Z', restored_at: null, row_data: { id: two, trip_number: 2 } }]
      const back = await call('plan_trip', { trip: { ...SECOND, id: two } })
      expect(back.isError).toBe(false)
      expect(back.body).toMatchObject({ would: 'add', trip_id: two })
      expect(JSON.stringify(back.body)).not.toContain('could not check')
      const done = await call('apply_trip', { trip: { ...SECOND, id: two }, plan_hash: back.body!.plan_hash })
      expect(done.body).toMatchObject({ did: 'added', trip_id: two })
    })

    it('still plans when the archive does not read, and says it could not check', async () => {
      await joined()
      world.broken = ['deleted_records_archive']
      const plan = await call('plan_trip', { trip: SECOND })
      expect(plan.isError).toBe(false)
      expect(plan.body).toMatchObject({ would: 'add' })
      expect((plan.body!.notes as string[]).join(' ')).toContain('The deleted trips did not read, so this plan could not check whether the trip was joined into another. The database refuses that save itself.')
      // The save itself is still refused, by the database.
      const apply = await call('apply_trip', { trip: SECOND, plan_hash: plan.body!.plan_hash })
      expect(apply.text).toBe(`The app's API answered 400 (22023): ${SENTENCE}`)
      expect(realSaves()).toHaveLength(1)
      expect(world.tables.trips).toHaveLength(1)
    })
  })

  it('view_as never runs either write verb', async () => {
    for (const verb of ['plan_trip', 'apply_trip']) {
      const out = await call('view_as', { role: 'helpers', verb, args: { trip: TRIP } })
      expect(out.isError).toBe(true)
      expect(out.text).toBe(`view_as never writes: ${verb} runs only as you, with your own key.`)
    }
    expect(world.saves).toEqual([])
  })
})

describe('read_trips, through the function', () => {
  it('says so when a site has no trip, and refuses a call with no site and no job', async () => {
    expect((await call('read_trips', { development_id: SITE })).body).toMatchObject({ count: 0, trips: [], reading: 'No trip is kept on Heron Point, or none this reader may read.' })
    const none = await call('read_trips', {})
    expect(none.isError).toBe(true)
    expect(none.text).toContain('read_trips needs development_id')
    expect(world.saves).toEqual([])
  })
})
