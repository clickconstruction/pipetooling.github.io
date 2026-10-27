/**
 * The lens's PostgREST against the real supabase-js client (punch list #194): every request here is
 * built by the client the app uses, so the grammar under test is the client's own, not a copy.
 */
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { LENS_PEOPLE } from '../lensPeople'
import { lensSession } from '../lensAuth'
import type { LensMood } from '../lensName'
import { MapStore, type LensWorld } from '../world/lensWorld'
import { createLensEngine, type LensAsk } from './lensEngine'
import type { LensSchema } from './lensSchemaTypes'
import type { Row } from './postgrest'

const BASE = 'https://lenstest.supabase.co'

const schema: LensSchema = {
  tables: {
    customers: { columns: ['id', 'name', 'kind', 'tags', 'meta'], rel: [] },
    jobs: {
      columns: ['id', 'number', 'name', 'customer_id', 'status', 'amount', 'due', 'created_at', 'updated_at'],
      rel: [{ fk: 'jobs_customer_id_fkey', columns: ['customer_id'], ref: 'customers', refColumns: ['id'], one: false }],
    },
    people: { columns: ['id', 'name'], rel: [] },
    job_crew: {
      columns: ['job_id', 'person_id'],
      rel: [
        { fk: 'job_crew_job_id_fkey', columns: ['job_id'], ref: 'jobs', refColumns: ['id'], one: false },
        { fk: 'job_crew_person_id_fkey', columns: ['person_id'], ref: 'people', refColumns: ['id'], one: false },
      ],
    },
    users: { columns: ['id', 'name', 'role', 'read_only'], rel: [] },
    clock_sessions: { columns: ['id', 'user_id', 'clocked_in_at'], rel: [] },
  },
  rpcs: { list_open: 'set', open_rows: 'set', count_open: 'scalar', board: 'json', touch: 'void' },
}

const C1 = 'c1'
const C2 = 'c2'
const C3 = 'c3'

function seed(): Record<string, Row[]> {
  return {
    customers: [
      { id: C1, name: 'Sam Sample', kind: 'homeowner', tags: ['vip', 'kyle'], meta: { source: 'web', level: 2 } },
      { id: C2, name: 'Sample Contracting', kind: 'gc', tags: ['gc'], meta: { source: 'referral' } },
      { id: C3, name: 'Sample Owner LLC', kind: 'owner', tags: [], meta: null },
    ],
    jobs: [
      { id: 'j1', number: '1312', name: 'Water heater replacement', customer_id: C1, status: 'paid', amount: 4380, due: '2026-10-01', created_at: '2026-09-01T15:00:00+00:00', updated_at: null },
      { id: 'j2', number: '1318', name: 'Sample Retail Shell rough-in', customer_id: C3, status: 'working', amount: 86400, due: '2026-11-15', created_at: '2026-09-02T15:00:00+00:00', updated_at: null },
      { id: 'j3', number: '1321', name: 'Cedar Bend Apartments, building C', customer_id: C2, status: 'billed', amount: 212950, due: null, created_at: '2026-09-03T15:00:00+00:00', updated_at: null },
      { id: 'j4', number: '1324', name: 'Kitchen repipe', customer_id: C1, status: 'waiting', amount: 18725, due: '2026-12-01', created_at: '2026-09-04T15:00:00+00:00', updated_at: null },
      { id: 'j5', number: '1327', name: 'Leak under slab', customer_id: C1, status: 'ready_to_bill', amount: 1250, due: '2026-10-20', created_at: '2026-09-05T15:00:00+00:00', updated_at: null },
      { id: 'j6', number: '1330', name: 'No status yet', customer_id: null, status: null, amount: null, due: null, created_at: '2026-09-06T15:00:00+00:00', updated_at: null },
    ],
    people: [
      { id: 'p1', name: 'Paco Sample' },
      { id: 'p2', name: 'Hal Sample' },
    ],
    job_crew: [
      { job_id: 'j2', person_id: 'p1' },
      { job_id: 'j2', person_id: 'p2' },
      { job_id: 'j5', person_id: 'p1' },
    ],
    users: [{ id: LENS_PEOPLE.estimator.id, name: 'Eli Sample', role: 'estimator', read_only: false }],
  }
}

function setup(opts: { mood?: LensMood; readOnly?: boolean; rpc?: LensWorld['rpc']; functions?: LensWorld['functions'] } = {}) {
  const asks: LensAsk[] = []
  const mood = opts.mood ?? 'full'
  const world: LensWorld = {
    viewer: LENS_PEOPLE.estimator,
    mood,
    store: new MapStore(seed()),
    readOnly: opts.readOnly ?? false,
    rpc: opts.rpc ?? {},
    functions: opts.functions ?? {},
  }
  const engine = createLensEngine({ as: 'estimator', mood, theme: 'light' }, { schema, world, report: (a) => asks.push(a), now: () => new Date('2026-10-26T15:00:00Z'), slowMs: 5 })
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const body = init?.body
    return engine.handle(new URL(href), { method: (init?.method ?? 'GET').toUpperCase(), headers: new Headers(init?.headers), bodyText: typeof body === 'string' ? body : null })
  }
  const client = createClient(BASE, 'anon-key', { global: { fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  return { client, asks, world }
}

describe('lens PostgREST · reads', () => {
  it('reads a whole table, every column, in stored order', async () => {
    const { client } = setup()
    const { data, error } = await client.from('jobs').select('*')
    expect(error).toBeNull()
    expect(data?.map((r) => r.number)).toEqual(['1312', '1318', '1321', '1324', '1327', '1330'])
    expect(Object.keys(data?.[0] ?? {})).toEqual(schema.tables.jobs!.columns)
  })

  it('filters with eq, in, is, gte on dates, ilike and not', async () => {
    const { client } = setup()
    const nums = async (q: PromiseLike<{ data: { number: string }[] | null }>) => (await q).data?.map((r) => r.number)
    expect(await nums(client.from('jobs').select('number').eq('status', 'paid'))).toEqual(['1312'])
    expect(await nums(client.from('jobs').select('number').in('number', ['1312', '1327']))).toEqual(['1312', '1327'])
    expect(await nums(client.from('jobs').select('number').is('due', null))).toEqual(['1321', '1330'])
    expect(await nums(client.from('jobs').select('number').gte('due', '2026-11-01'))).toEqual(['1318', '1324'])
    expect(await nums(client.from('jobs').select('number').ilike('name', '%WATER%'))).toEqual(['1312'])
    expect(await nums(client.from('jobs').select('number').not('status', 'in', '(paid,billed)'))).toEqual(['1318', '1324', '1327'])
  })

  it('drops a null as Postgres does: neq and not on an unknown value keep nothing', async () => {
    const { client } = setup()
    const { data } = await client.from('jobs').select('number').neq('status', 'paid')
    expect(data?.map((r) => r.number)).toEqual(['1318', '1321', '1324', '1327'])
  })

  it('reads or, and nested and, and a timestamp against a date', async () => {
    const { client } = setup()
    const a = await client.from('jobs').select('number').or('status.eq.paid,amount.gt.100000')
    expect(a.data?.map((r) => r.number)).toEqual(['1312', '1321'])
    const b = await client.from('jobs').select('number').or('and(status.eq.working,amount.gt.1000),number.eq.1327')
    expect(b.data?.map((r) => r.number)).toEqual(['1318', '1327'])
    const c = await client.from('jobs').select('number').gte('created_at', '2026-09-05')
    expect(c.data?.map((r) => r.number)).toEqual(['1327', '1330'])
  })

  it('reads containment on arrays and on JSON, and a JSON path', async () => {
    const { client } = setup()
    const tags = await client.from('customers').select('name').contains('tags', ['vip'])
    expect(tags.data).toEqual([{ name: 'Sam Sample' }])
    const meta = await client.from('customers').select('name').contains('meta', { source: 'referral' })
    expect(meta.data).toEqual([{ name: 'Sample Contracting' }])
    const path = await client.from('customers').select('name, source:meta->>source').eq('id', C1)
    expect(path.data).toEqual([{ name: 'Sam Sample', source: 'web' }])
  })

  it('orders, ranges and counts exactly, and a head request counts without rows', async () => {
    const { client } = setup()
    const r = await client.from('jobs').select('number', { count: 'exact' }).order('number', { ascending: false }).range(1, 2)
    expect(r.count).toBe(6)
    expect(r.data?.map((x) => x.number)).toEqual(['1327', '1324'])
    const h = await client.from('jobs').select('*', { count: 'exact', head: true }).eq('customer_id', C1)
    expect(h.count).toBe(3)
    expect(h.data).toBeNull()
    const n = await client.from('jobs').select('number').order('due', { ascending: false, nullsFirst: false }).limit(3)
    expect(n.data?.map((x) => x.number)).toEqual(['1324', '1318', '1327'])
  })

  it('answers single and maybeSingle as PostgREST does', async () => {
    const { client } = setup()
    const one = await client.from('jobs').select('number').eq('number', '1312').single()
    expect(one.data).toEqual({ number: '1312' })
    const none = await client.from('jobs').select('number').eq('number', 'nope').single()
    expect(none.error?.code).toBe('PGRST116')
    const maybe = await client.from('jobs').select('number').eq('number', 'nope').maybeSingle()
    expect(maybe.error).toBeNull()
    expect(maybe.data).toBeNull()
  })
})

describe('lens PostgREST · embeds', () => {
  it('embeds to-one and to-many along the foreign key', async () => {
    const { client } = setup()
    const one = await client.from('jobs').select('number, customers(name)').eq('number', '1318')
    expect(one.data).toEqual([{ number: '1318', customers: { name: 'Sample Owner LLC' } }])
    const many = await client.from('customers').select('name, jobs(number)').eq('id', C1)
    expect(many.data).toEqual([{ name: 'Sam Sample', jobs: [{ number: '1312' }, { number: '1324' }, { number: '1327' }] }])
  })

  it('filters an inner embed, so a parent with no match is dropped', async () => {
    const { client } = setup()
    const { data } = await client.from('customers').select('name, jobs!inner(number)').eq('jobs.status', 'working')
    expect(data).toEqual([{ name: 'Sample Owner LLC', jobs: [{ number: '1318' }] }])
  })

  it('follows a junction table, counts an embed, spreads a to-one and aliases it', async () => {
    const { client } = setup()
    const crew = await client.from('jobs').select('number, people(name)').eq('number', '1318')
    expect(crew.data).toEqual([{ number: '1318', people: [{ name: 'Paco Sample' }, { name: 'Hal Sample' }] }])
    const count = await client.from('customers').select('name, jobs(count)').eq('id', C1)
    expect(count.data).toEqual([{ name: 'Sam Sample', jobs: [{ count: 3 }] }])
    const spread = await client.from('jobs').select('number, ...customers(customer_name:name)').eq('number', '1321')
    expect(spread.data).toEqual([{ number: '1321', customer_name: 'Sample Contracting' }])
    const alias = await client.from('jobs').select('number, owner:customers(name)').eq('number', '1312')
    expect(alias.data).toEqual([{ number: '1312', owner: { name: 'Sam Sample' } }])
  })

  it('refuses an embed with no relationship and a column that does not exist, with their codes', async () => {
    const { client } = setup()
    const rel = await client.from('customers').select('name, people(name)')
    expect(rel.error?.code).toBe('PGRST200')
    const col = await client.from('jobs').select('number').eq('nope', 1)
    expect(col.error?.code).toBe('42703')
    const table = await client.from('nope').select('*')
    expect(table.error?.code).toBe('PGRST205')
  })
})

describe('lens PostgREST · writes change the frame only', () => {
  it('inserts with the defaults and returns the row', async () => {
    const { client } = setup()
    const { data, error } = await client.from('jobs').insert({ number: '1333', name: 'New', customer_id: C2 }).select('id, number, status, created_at, customers(name)').single()
    expect(error).toBeNull()
    expect(data?.number).toBe('1333')
    expect(data?.status).toBeNull()
    expect(typeof data?.id).toBe('string')
    expect(data?.created_at).toBe('2026-10-26T15:00:00.000Z')
    expect(data?.customers).toEqual({ name: 'Sample Contracting' })
    const back = await client.from('jobs').select('number', { count: 'exact', head: true })
    expect(back.count).toBe(7)
  })

  it('upserts by the key, updates by a filter and deletes by a filter', async () => {
    const { client } = setup()
    await client.from('jobs').upsert({ id: 'j1', status: 'billed' })
    const up = await client.from('jobs').select('status').eq('id', 'j1').single()
    expect(up.data).toEqual({ status: 'billed' })
    const upd = await client.from('jobs').update({ status: 'paid' }).eq('number', '1327').select('number, status, updated_at')
    expect(upd.data).toEqual([{ number: '1327', status: 'paid', updated_at: '2026-10-26T15:00:00.000Z' }])
    const del = await client.from('jobs').delete().eq('number', '1324')
    expect(del.error).toBeNull()
    const left = await client.from('jobs').select('*', { count: 'exact', head: true })
    expect(left.count).toBe(5)
  })

  it('refuses a duplicate key without a resolution', async () => {
    const { client } = setup()
    const { error } = await client.from('jobs').insert({ id: 'j1', number: 'dup' })
    expect(error?.code).toBe('23505')
  })

  it('refuses writes in training mode with the database\'s own words, but lets a clock punch through', async () => {
    const { client } = setup({ readOnly: true, mood: 'training' })
    const { error } = await client.from('jobs').update({ status: 'paid' }).eq('id', 'j2')
    expect(error?.message).toBe('Read-only (training) mode: changes are blocked.')
    const punch = await client.from('clock_sessions').insert({ user_id: LENS_PEOPLE.estimator.id })
    expect(punch.error).toBeNull()
  })
})

describe('lens engine · RPCs, functions and sign-in', () => {
  it('answers an RPC from its handler and filters its rows', async () => {
    const { client } = setup({ rpc: { open_rows: () => [{ n: 1, kind: 'a' }, { n: 2, kind: 'b' }, { n: 3, kind: 'a' }] } })
    const { data } = await client.rpc('open_rows').eq('kind', 'a').order('n', { ascending: false })
    expect(data).toEqual([{ n: 3, kind: 'a' }, { n: 1, kind: 'a' }])
  })

  it('answers an RPC with no handler by what it returns: no rows, null, nothing, or an error', async () => {
    const { client, asks } = setup()
    expect((await client.rpc('list_open')).data).toEqual([])
    const scalar = await client.rpc('count_open')
    expect(scalar.error).toBeNull()
    expect(scalar.data).toBeNull()
    const voided = await client.rpc('touch')
    expect(voided.error).toBeNull()
    const object = await client.rpc('board')
    expect(object.error?.code).toBe('LENS')
    const unknown = await client.rpc('nope')
    expect(unknown.error?.code).toBe('PGRST202')
    expect(asks.filter((a) => a.kind === 'rpc').map((a) => a.by)).toEqual(['rule', 'rule', 'rule', 'missing', 'refused'])
  })

  it('answers a function from its handler, and says when it has none', async () => {
    const { client } = setup({ functions: { 'job-rating': (body) => ({ ok: true, echo: body }) } })
    const ok = await client.functions.invoke('job-rating', { body: { t: 'x' } })
    expect(ok.data).toEqual({ ok: true, echo: { t: 'x' } })
    const none = await client.functions.invoke('customer-portal', { body: {} })
    expect(none.error).not.toBeNull()
  })

  it('signs the client in as the frame\'s person', async () => {
    const { client } = setup()
    const s = lensSession(LENS_PEOPLE.estimator, Math.floor(Date.now() / 1000))
    const set = await client.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token })
    expect(set.error).toBeNull()
    const { data } = await client.auth.getUser()
    expect(data.user?.id).toBe(LENS_PEOPLE.estimator.id)
    expect(data.user?.email).toBe('eli@lens.example.com')
  })
})

describe('lens engine · the state knob', () => {
  it('fails every read but the person\'s own when failing', async () => {
    const { client } = setup({ mood: 'error' })
    const jobs = await client.from('jobs').select('*')
    expect(jobs.error?.message).toBe('The lens is failing this read on purpose.')
    const me = await client.from('users').select('name').single()
    expect(me.data).toEqual({ name: 'Eli Sample' })
  })

  it('never answers while loading, and answers late when slow', async () => {
    const loading = setup({ mood: 'loading' })
    const pending = loading.client.from('jobs').select('*').then(() => 'answered')
    const raced = await Promise.race([pending, new Promise((r) => setTimeout(() => r('still waiting'), 30))])
    expect(raced).toBe('still waiting')
    const slow = setup({ mood: 'slow' })
    const { data } = await slow.client.from('jobs').select('number').eq('number', '1312')
    expect(data).toEqual([{ number: '1312' }])
  })

  it('fails every request the way a dropped connection does when offline', async () => {
    const { client } = setup({ mood: 'offline' })
    const { error } = await client.from('users').select('*')
    expect(error?.message).toMatch(/Failed to fetch/)
  })

  it('reports who answered each ask', async () => {
    const { client, asks } = setup()
    await client.from('jobs').select('*')
    await client.from('people').select('*')
    await client.from('clock_sessions').select('*')
    expect(asks.map((a) => `${a.kind}:${a.name}:${a.by}`)).toEqual(['table:jobs:world', 'table:people:world', 'table:clock_sessions:rule'])
  })
})
