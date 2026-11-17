/**
 * dev-mcp's own handler, run here for find_task / get_task, plan_task → apply_task (v2.7584), plan_task_place →
 * apply_task_place (v2.7589) and plan_task_photo → apply_task_photo (v2.7592, behind the fake staging and photo buckets): the function's index.ts with its three URL imports stood in for, and one `fetch` behind
 * which sit a recording fake database and a fake Census geocoder. Nothing reaches a network. The proof that matters
 * most is the first of each: a plan writes nothing.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { newTaskSend } from '../tasks/newTaskSend'

type Handler = (req: Request) => Promise<Response>
type Row = Record<string, unknown>
const box: { handler: Handler | null } = { handler: null }

const DEV = 'ffffffff-2222-4222-8222-222222222222'
const ANA = 'aaaaaaaa-1111-4111-8111-111111111111'
const BEN = 'bbbbbbbb-1111-4111-8111-111111111111'
const GONE = 'cccccccc-1111-4111-8111-111111111111'
const NO_LOGIN = 'dddddddd-1111-4111-8111-111111111111'
const TWIN = 'eeeeeeee-1111-4111-8111-111111111111'
const OLD_TASK = '99999999-1111-4111-8111-111111111111'
const OLD_DAY = '99999999-2222-4222-8222-222222222222'
const BARE_TASK = '99999999-3333-4333-8333-333333333333'
const ROADMAP_ITEM = '99999999-4444-4444-8444-444444444444'
const ROADMAP_TASK = '99999999-5555-4555-8555-555555555555'
const JOB = '77777777-1111-4111-8111-111111111111'
const MAP = '66666666-1111-4111-8111-111111111111'
const BASE = 'http://127.0.0.1:9'
// The fake clock: 2026-11-17 12:00 in Chicago, a Tuesday.
const TODAY = '2026-11-17'

const world = {
  tables: {} as Record<string, Row[]>,
  writes: [] as Array<{ method: string; table: string; query: string; body: unknown; prefer: string }>,
  log: [] as Row[],
  /** A table whose next POST is refused, with the words PostgREST would answer. */
  refuse: {} as Record<string, string>,
  /** A table whose next POST never reaches the database: the fetch itself throws. */
  drop: '' as string,
  made: 0,
  /** What the fake Census geocoder knows, by the address asked, and every address it was asked. */
  census: {} as Record<string, { x: number; y: number }>,
  censusAsked: [] as string[],
  /** The staging bucket and the photo bucket, by path, and what was signed, put and removed. */
  staged: {} as Record<string, Uint8Array>,
  bucket: {} as Record<string, Uint8Array>,
  storage: [] as string[],
  /** The next put into the photo bucket is refused. */
  refusePut: false,
}

function matches(row: Row, key: string, expr: string): boolean {
  const v = row[key]
  if (expr === 'is.null') return v === null || v === undefined
  if (expr === 'is.false') return v === false
  if (expr.startsWith('eq.')) return String(v ?? '') === expr.slice(3)
  if (expr.startsWith('gte.')) return typeof v === 'number' && v >= Number(expr.slice(4))
  if (expr.startsWith('lte.')) return typeof v === 'number' ? v <= Number(expr.slice(4)) : String(v ?? '') <= expr.slice(4)
  if (expr.startsWith('gt.')) return String(v ?? '') > expr.slice(3)
  if (expr.startsWith('in.(')) return expr.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(v ?? ''))
  if (expr.startsWith('ilike.')) return new RegExp(`^${expr.slice(6).split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 'i').test(String(v ?? ''))
  throw new Error(`fake REST: no filter "${expr}"`)
}
const RESERVED = ['select', 'order', 'limit', 'on_conflict']
function filtered(table: string, query: string): Row[] {
  const all = [...new URLSearchParams(query).entries()]
  const rows = (world.tables[table] ?? []).filter((r) => all.filter(([k]) => !RESERVED.includes(k)).every(([k, expr]) => matches(r, k, expr)))
  const order = all.find(([k]) => k === 'order')?.[1]
  if (order) {
    const [col, dir] = order.split(',')[0]!.split('.') as [string, string]
    rows.sort((a, b) => (String(a[col] ?? '') < String(b[col] ?? '') ? -1 : String(a[col] ?? '') > String(b[col] ?? '') ? 1 : 0) * (dir === 'desc' ? -1 : 1))
    if (rows.every((r) => typeof r[col] === 'number')) rows.sort((a, b) => ((a[col] as number) - (b[col] as number)) * (dir === 'desc' ? -1 : 1))
  }
  const limit = Number(all.find(([k]) => k === 'limit')?.[1] ?? 1000)
  return rows.slice(0, limit)
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input))
  const method = (init?.method ?? 'GET').toUpperCase()
  const path = decodeURIComponent(url.pathname)
  const query = url.search.slice(1)
  if (path.startsWith('/rest/v1/')) {
    const table = path.slice('/rest/v1/'.length)
    if (method === 'GET') return json(filtered(table, query))
    const body = init?.body ? JSON.parse(String(init.body)) : null
    const prefer = String((init?.headers as Record<string, string> | undefined)?.Prefer ?? '')
    world.writes.push({ method, table, query, body, prefer })
    if (method === 'POST') {
      if (world.drop === table) throw new TypeError('fetch failed')
      if (world.refuse[table]) return json({ message: world.refuse[table] }, 403)
      const rows = (Array.isArray(body) ? body : [body]).map((r: Row) => ({ id: `made-${++world.made}`, created_at: '2026-11-17T18:00:00Z', ...r }))
      world.tables[table] = [...(world.tables[table] ?? []), ...rows]
      return prefer.includes('return=representation') ? json(rows.map((r) => ({ id: r.id }))) : new Response(null, { status: 201 })
    }
    if (method === 'PATCH') {
      if (world.refuse[table]) return json([])
      const hit = filtered(table, query)
      for (const r of hit) Object.assign(r, body as Row)
      return json(hit.map((r) => ({ id: r.id })))
    }
    if (method === 'DELETE') {
      const hit = filtered(table, query)
      world.tables[table] = (world.tables[table] ?? []).filter((r) => !hit.includes(r))
      return json(hit.map((r) => ({ id: r.id })))
    }
  }
  const OBJECT = '/storage/v1/object/'
  if (path.startsWith(`${OBJECT}upload/sign/dev-seat-staging/`)) {
    const at = path.slice(`${OBJECT}upload/sign/dev-seat-staging/`.length)
    world.storage.push(`sign ${at}`)
    return json({ url: `/object/upload/sign/dev-seat-staging/${at}?token=tok` })
  }
  if (path.startsWith(`${OBJECT}authenticated/dev-seat-staging/`)) {
    const bytes = world.staged[path.slice(`${OBJECT}authenticated/dev-seat-staging/`.length)]
    return bytes ? new Response(bytes, { status: 200 }) : json({ message: 'Object not found' }, 404)
  }
  for (const [name, store] of [['dev-seat-staging', world.staged], ['task-spot-photos', world.bucket]] as const) {
    if (!path.startsWith(`${OBJECT}${name}/`)) continue
    const at = path.slice(`${OBJECT}${name}/`.length)
    if (method === 'DELETE') {
      world.storage.push(`remove ${name}/${at}`)
      delete store[at]
      return json({})
    }
    if (method === 'POST') {
      world.storage.push(`put ${name}/${at}`)
      if (world.refusePut) return json({ message: 'new row violates row-level security policy' }, 403)
      store[at] = new Uint8Array(init?.body as ArrayBuffer)
      return json({ Key: `${name}/${at}` })
    }
  }
  if (url.hostname === 'geocoding.geo.census.gov') {
    const asked = url.searchParams.get('address') ?? ''
    world.censusAsked.push(asked)
    const hit = world.census[asked]
    return json({ result: { addressMatches: hit ? [{ coordinates: hit }] : [] } })
  }
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

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
async function sha256(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const person = (id: string, name: string, over: Row = {}): Row => ({ id, name, role: 'master_technician', archived_at: null, is_digital_twin: false, is_sample: false, is_walk_tester: false, login_attached_at: '2026-01-05T00:00:00Z', ...over })

beforeEach(() => {
  world.tables = {
    users: [
      person(DEV, 'Dev Person', { role: 'dev' }),
      person(ANA, 'ZZ Ana Field'),
      person(BEN, 'ZZ Ben Field'),
      person(GONE, 'ZZ Gone Away', { archived_at: '2026-06-01T00:00:00Z' }),
      person(NO_LOGIN, 'ZZ No Login', { login_attached_at: null }),
      person(TWIN, 'ZZ Twin One', { is_digital_twin: true }),
    ],
    checklist_item_assignees: [
      { checklist_item_id: OLD_TASK, user_id: ANA, display_order: 7 },
      { checklist_item_id: 'older', user_id: ANA, display_order: 3 },
    ],
    checklist_items: [
      { id: OLD_TASK, title: 'ZZ walk the yard', links: [], start_date: '2026-11-10', due_date: null, repeat_type: 'once', repeat_days_of_week: null, repeat_days_after: null, repeat_end_date: null, show_until_completed: true, asks_for_photo: true, reminder_time: null, created_at: '2026-11-10T15:00:00Z', created_by_user_id: DEV, place_name: 'ZZ gate', place_lat: 30.2, place_lng: -97.7, place_accuracy_m: null, place_set_by: DEV, place_set_at: '2026-11-10T15:00:00Z', spot_photo_path: `item/${OLD_TASK}/p1.jpg`, notify_creator_on_complete: true, roadmap_group_task_id: null, painted_map_id: MAP },
    ],
    address_geocodes: [{ address_normalized: '14 maple ct, marlow, tx 78000', lat: 30.31, lng: -97.61, geocode_error: null }],
    jobs_ledger: [{ id: JOB, job_name: 'ZZ Test Maple Court', job_address: '14 Maple Ct,  Marlow, TX 78000' }],
    checklist_instances: [{ id: OLD_DAY, checklist_item_id: OLD_TASK, scheduled_date: '2026-11-10', completed_at: null, completed_by_user_id: null, percent_complete: 50, notes: null }],
    checklist_instance_events: [{ instance_id: OLD_DAY, event_type: 'comment', actor_user_id: ANA, body: 'ZZ half done', percent: null, created_at: '2026-11-10T19:00:00Z' }],
    task_criteria: [{ id: 'l1', checklist_item_id: OLD_TASK, body: 'ZZ the gate is shut', sort_index: 0, retired_at: null }],
    task_photos: [],
    checklist_instance_assignees: [],
    checklist_tech_tree_group_tasks: [{ id: ROADMAP_TASK, spot_photo_path: null, place_name: null, place_lat: null, place_lng: null, place_accuracy_m: null, place_set_by: null, place_set_at: null, painted_map_id: null }],
  }
  ;(world.tables.checklist_items as Row[]).push(
    { id: BARE_TASK, title: 'ZZ bare task', start_date: '2026-11-12', created_at: '2026-11-12T15:00:00Z', created_by_user_id: DEV, roadmap_group_task_id: null, spot_photo_path: null, place_name: null, place_lat: null, place_lng: null, place_accuracy_m: null, place_set_by: null, place_set_at: null, painted_map_id: MAP },
    { id: ROADMAP_ITEM, title: 'ZZ roadmap step', start_date: '2026-11-12', created_at: '2026-11-12T16:00:00Z', created_by_user_id: DEV, roadmap_group_task_id: ROADMAP_TASK, place_name: null, place_lat: null, place_lng: null },
  )
  world.census = { '9 Elm St, Marlow, TX 78000': { x: -97.52, y: 30.44 } }
  world.censusAsked = []
  world.staged = {}
  world.bucket = { [`item/${OLD_TASK}/p1.jpg`]: JPG }
  world.storage = []
  world.refusePut = false
  world.writes = []
  world.log = []
  world.refuse = {}
  world.drop = ''
  world.made = 0
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

const TASK: Row = { for: ANA, text: 'ZZ check the pump house', done_when: ['ZZ the valve is tagged', 'ZZ the door is locked'], place: { name: 'ZZ pump house', lat: 30.25, lng: -97.75 } }
const written = (table: string) => world.writes.filter((w) => w.table === table)

describe('find_task and get_task', () => {
  it('find a task by its words or its person, and read one whole, writing nothing', async () => {
    const byWords = await call('find_task', { text: 'walk the yard' })
    expect(byWords.isError).toBe(false)
    expect(byWords.body!.matches).toEqual([expect.objectContaining({ id: OLD_TASK, name: 'ZZ walk the yard', for: ['ZZ Ana Field'], given_by: 'Dev Person', open_days: 1, next_open_day: '2026-11-10', place: 'ZZ gate', photo_of_the_spot: true, repeats: 'once' })])
    const byPerson = await call('find_task', { for: 'ZZ Ana Field' })
    expect((byPerson.body!.matches as Row[]).map((m) => m.id)).toEqual([OLD_TASK])
    expect((await call('find_task', { for: BEN })).body).toMatchObject({ matches: [], reading: 'ZZ Ben Field has no task.' })
    expect((await call('find_task', {})).isError).toBe(true)

    const whole = await call('get_task', { task: OLD_TASK })
    expect(whole.isError).toBe(false)
    expect(whole.body).toMatchObject({
      task: { id: OLD_TASK, words: 'ZZ walk the yard', for: [{ id: ANA, name: 'ZZ Ana Field' }], given_by: 'Dev Person', starts: '2026-11-10', repeats: 'once', asks_for_photo: true },
      done_when: ['ZZ the gate is shut'],
      place: { name: 'ZZ gate', lat: 30.2, lng: -97.7, on: 'task', map: 'https://www.google.com/maps?q=30.2,-97.7' },
      photo_of_the_spot: true,
      days: [{ id: OLD_DAY, day: '2026-11-10', percent: 50, done_at: null }],
      thread: [{ by: 'ZZ Ana Field', kind: 'comment', text: 'ZZ half done', day: '2026-11-10' }],
    })
    expect((await call('get_task', { task: 'walk the yard' })).body!.task).toMatchObject({ id: OLD_TASK })
    expect((await call('get_task', { task: 'no such words' })).isError).toBe(true)
    expect(world.writes).toEqual([])
  })
})

describe('plan_task → apply_task', () => {
  it('a plan writes nothing, and says what would land', async () => {
    const out = await call('plan_task', { task: TASK })
    expect(out.isError).toBe(false)
    expect(world.writes).toEqual([])
    expect(out.body!.plan_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(out.body).toMatchObject({
      reads: `ZZ Ana Field gets "ZZ check the pump house" today (${TODAY}).`,
      for: [{ id: ANA, name: 'ZZ Ana Field' }],
      days: { count: 1, first: TODAY, last: TODAY },
      done_when: ['ZZ the valve is tagged', 'ZZ the door is locked'],
      asks_for_photo: true,
      place: { name: 'ZZ pump house', lat: 30.25, lng: -97.75, check_it_here: 'https://www.google.com/maps?q=30.25,-97.75' },
      stamped_at_apply: ['place_set_at'],
    })
    // The plan's row is the window's own send, less the stamp the write makes.
    const row = out.body!.row as Row
    expect(row).toMatchObject({ title: 'ZZ check the pump house', created_by_user_id: DEV, start_date: TODAY, repeat_type: 'once', asks_for_photo: true, place_name: 'ZZ pump house', place_lat: 30.25, place_lng: -97.75, place_set_by: DEV })
    expect('place_set_at' in row).toBe(false)
    expect(String((out.body!.tells as string[])[0])).toContain('Nobody is told when the task is given')
    // A plan read twice gives the same hash: no clock is in it.
    expect((await call('plan_task', { task: TASK })).body!.plan_hash).toBe(out.body!.plan_hash)
    expect(world.writes).toEqual([])
  })

  it('an apply writes the window\'s rows in the window\'s order, and the row is the window\'s own', async () => {
    const plan = await call('plan_task', { task: TASK })
    const out = await call('apply_task', { task: TASK, plan_hash: plan.body!.plan_hash })
    expect(out.isError).toBe(false)
    expect(world.writes.map((w) => `${w.method} ${w.table}`)).toEqual(['POST checklist_items', 'POST checklist_item_assignees', 'POST checklist_instances', 'POST checklist_instance_assignees', 'POST task_criteria'])

    const expected = newTaskSend(
      { typed: 'ZZ check the pump house', title: 'ZZ check the pump house', links: [], assigneeIds: [ANA], when: 'today', repeatMode: 'weekly', startDate: TODAY, repeatDaysOfWeek: [], repeatDaysAfter: 1, repeatEndDate: '', dueDate: '', showUntilCompleted: true, notifyOnCompleteUserId: '', notifyCreatorOnComplete: true, reminderTime: '', reminderDaily: true, remindDayBefore: false, escalateEnabled: false, escalateDays: 3, asksForPhoto: true, place: { lat: 30.25, lng: -97.75, name: 'ZZ pump house', accuracyM: null }, map: null },
      { userId: DEV },
      { today: TODAY, now: '2026-11-17T18:00:00.000Z' },
    )
    if (!expected.ok) throw new Error(expected.error)
    expect(written('checklist_items')[0]!.body).toEqual(expected.row)

    const id = out.body!.task_id as string
    // Under the highest place Ana already holds, as the window puts a new task at the bottom.
    expect(written('checklist_item_assignees')[0]!.body).toEqual([{ checklist_item_id: id, user_id: ANA, display_order: 8 }])
    expect(written('checklist_instances')[0]).toMatchObject({ query: 'on_conflict=checklist_item_id,scheduled_date&select=id', body: [{ checklist_item_id: id, scheduled_date: TODAY }], prefer: 'resolution=merge-duplicates,return=representation' })
    const day = (world.tables.checklist_instances as Row[]).find((r) => r.checklist_item_id === id)!
    expect(written('checklist_instance_assignees')[0]!.body).toEqual([{ checklist_instance_id: day.id, user_id: ANA }])
    expect(written('task_criteria')[0]!.body).toEqual([
      { checklist_item_id: id, roadmap_task_id: null, body: 'ZZ the valve is tagged', sort_index: 0, created_by: DEV },
      { checklist_item_id: id, roadmap_task_id: null, body: 'ZZ the door is locked', sort_index: 1, created_by: DEV },
    ])
    expect(out.body!.steps).toEqual([
      { step: 'the task', ok: true, rows: 1 },
      { step: 'the people', ok: true, rows: 1 },
      { step: 'the day rows', ok: true, rows: 1 },
      { step: 'the people on each day', ok: true, rows: 1 },
      { step: 'the Done when… lines', ok: true, rows: 2 },
    ])
    expect('not_landed' in out.body!).toBe(false)
    // The log keeps the hash the one-apply rule reads.
    expect((world.log[world.log.length - 1]!.args as Row).plan_hash).toBe(plan.body!.plan_hash)
  })

  it('a second apply of the same plan writes nothing', async () => {
    const plan = await call('plan_task', { task: TASK })
    await call('apply_task', { task: TASK, plan_hash: plan.body!.plan_hash })
    const before = world.writes.length
    const again = await call('apply_task', { task: TASK, plan_hash: plan.body!.plan_hash })
    expect(again.isError).toBe(true)
    expect(again.text).toContain('You already gave a task with these exact words')
    expect(world.writes).toHaveLength(before)
    // Meant twice: a new plan says so, and names the one already given.
    const meant = await call('plan_task', { task: { ...TASK, allow_duplicate: true } })
    expect(meant.isError).toBe(false)
    expect(meant.body!.already_given).toHaveLength(1)
  })

  it('an apply quoting another plan\'s hash, or a changed task, writes nothing', async () => {
    const plan = await call('plan_task', { task: TASK })
    const changed = await call('apply_task', { task: { ...TASK, text: 'ZZ check the other pump house' }, plan_hash: plan.body!.plan_hash })
    expect(changed.isError).toBe(true)
    expect(changed.text).toContain('Nothing written')
    expect((await call('apply_task', { task: TASK })).isError).toBe(true)
    expect(world.writes).toEqual([])
  })

  it('a weekly task for two people gets five weeks of days, each with both', async () => {
    const task = { for: [ANA, 'ZZ Ben Field'], text: 'ZZ flush the line', repeat: { weekdays: ['tue', 'thu'], until: '2026-12-01' } }
    const plan = await call('plan_task', { task })
    expect(plan.body).toMatchObject({ reads: 'ZZ Ana Field, ZZ Ben Field get "ZZ flush the line" every Tuesday, Thursday from 2026-11-17 until 2026-12-01.', days: { count: 5, first: '2026-11-17', last: '2026-12-01' }, asks_for_photo: false, place: null })
    expect((plan.body!.row as Row)).toMatchObject({ repeat_type: 'day_of_week', repeat_days_of_week: [2, 4], repeat_end_date: '2026-12-01', show_until_completed: false, due_date: null })
    const out = await call('apply_task', { task, plan_hash: plan.body!.plan_hash })
    expect(out.isError).toBe(false)
    expect((written('checklist_item_assignees')[0]!.body as Row[]).map((r) => [r.user_id, r.display_order])).toEqual([[ANA, 8], [BEN, 1]])
    expect((written('checklist_instances')[0]!.body as Row[]).map((r) => r.scheduled_date)).toEqual(['2026-11-17', '2026-11-19', '2026-11-24', '2026-11-26', '2026-12-01'])
    expect(written('checklist_instance_assignees')[0]!.body).toHaveLength(10)
    expect(written('task_criteria')).toEqual([])
  })

  it('refuses a person the window would not offer, in words, and whatever the window itself refuses', async () => {
    for (const [who, words] of [[GONE, 'is archived'], [NO_LOGIN, 'has no login'], [TWIN, 'digital twin'], ['ZZ Nobody', 'No one the New task window offers'], ['Field', 'matches 2 people']] as const) {
      const out = await call('plan_task', { task: { for: who, text: 'ZZ a task' } })
      expect(out.isError, who).toBe(true)
      expect(out.text, who).toContain(words)
    }
    const due = await call('plan_task', { task: { for: ANA, text: 'ZZ a task', on: '2026-11-20', due: '2026-11-18' } })
    expect(due.text).toContain('The New task window refuses this: The due date can’t be before the task starts.')
    expect((await call('plan_task', { task: { for: ANA, text: 'ZZ a task', on: '2026-11-01' } })).text).toContain('behind today')
    expect((await call('plan_task', { task: { for: ANA, text: 'ZZ a task', repeat: { weekdays: [] } } })).text).toContain('Pick at least one weekday.')
    expect(world.writes).toEqual([])
  })

  it('takes the task back when the people\'s rows do not land, so no task is left that nobody can see', async () => {
    const plan = await call('plan_task', { task: TASK })
    world.refuse = { checklist_item_assignees: 'new row violates row-level security policy' }
    const out = await call('apply_task', { task: TASK, plan_hash: plan.body!.plan_hash })
    expect(out.isError).toBe(true)
    expect(out.text).toContain('Nothing was given')
    expect(world.writes.map((w) => `${w.method} ${w.table}`)).toEqual(['POST checklist_items', 'POST checklist_item_assignees', 'DELETE checklist_items'])
    expect((world.tables.checklist_items as Row[]).map((r) => r.id)).toEqual([OLD_TASK, BARE_TASK, ROADMAP_ITEM])
  })

  it('names a later step that did not land and leaves the task standing', async () => {
    const plan = await call('plan_task', { task: TASK })
    world.refuse = { task_criteria: 'new row violates row-level security policy' }
    const out = await call('apply_task', { task: TASK, plan_hash: plan.body!.plan_hash })
    expect(out.isError).toBe(false)
    expect(out.body!.not_landed).toContain('the Done when… lines did not land')
    expect((out.body!.steps as Row[]).filter((s) => s.ok === false)).toHaveLength(1)
  })

  it('keeps a long task\'s hash in the log, where the one-apply rule reads it', async () => {
    // Words that triple in a URL: the duplicate read must not carry them as a filter.
    const task = { for: ANA, text: `ZZ ${'long, words (née) & more; '.repeat(74)}`.trim(), done_when: Array.from({ length: 12 }, (_, i) => `ZZ line ${i} ${'x'.repeat(180)}`) }
    const plan = await call('plan_task', { task })
    expect(plan.isError).toBe(false)
    const out = await call('apply_task', { task, plan_hash: plan.body!.plan_hash })
    expect(out.isError).toBe(false)
    const logged = world.log[world.log.length - 1]!.args as Row
    expect(logged.plan_hash).toBe(plan.body!.plan_hash)
    expect(JSON.stringify(logged).length).toBeLessThan(4000)
  })
})

describe('plan_task with a place said in words', () => {
  it('an address is the app\'s saved point, read and never filled, and the row carries it', async () => {
    const task = { for: ANA, text: 'ZZ meet the inspector', place: { address: '14 Maple Ct, Marlow, TX 78000' } }
    const plan = await call('plan_task', { task })
    expect(plan.isError).toBe(false)
    expect(plan.body!.place).toEqual({ name: '14 Maple Ct', lat: 30.31, lng: -97.61, found_by: 'the app\'s saved point for "14 Maple Ct, Marlow, TX 78000"', check_it_here: 'https://www.google.com/maps?q=30.31,-97.61' })
    expect(world.censusAsked).toEqual([])
    expect(world.writes).toEqual([])
    const out = await call('apply_task', { task, plan_hash: plan.body!.plan_hash })
    expect(out.isError).toBe(false)
    expect(written('checklist_items')[0]!.body).toMatchObject({ place_name: '14 Maple Ct', place_lat: 30.31, place_lng: -97.61, place_accuracy_m: null, place_set_by: DEV, place_set_at: '2026-11-17T18:00:00.000Z' })
    expect(written('address_geocodes')).toEqual([])
  })

  it('an address the app has not seen goes to the Census, and one nobody knows turns the plan away', async () => {
    const known = await call('plan_task', { task: { for: ANA, text: 'ZZ a task', place: { address: '9 Elm St, Marlow, TX 78000', name: 'ZZ back lot' } } })
    expect(known.body!.place).toMatchObject({ name: 'ZZ back lot', lat: 30.44, lng: -97.52, found_by: 'the Census geocoder, for "9 Elm St, Marlow, TX 78000"' })
    const lost = await call('plan_task', { task: { for: ANA, text: 'ZZ a task', place: { address: '1 Nowhere Rd, Marlow, TX' } } })
    expect(lost.isError).toBe(true)
    expect(lost.text).toContain('place: No point was found for "1 Nowhere Rd, Marlow, TX"')
    expect(world.writes).toEqual([])
  })
})

describe('plan_task_place → apply_task_place', () => {
  const placeOf = (id: string) => {
    const r = [...(world.tables.checklist_items as Row[]), ...(world.tables.checklist_tech_tree_group_tasks as Row[])].find((x) => x.id === id)!
    return { name: r.place_name, lat: r.place_lat, lng: r.place_lng, by: r.place_set_by, at: r.place_set_at, map: r.painted_map_id }
  }

  it('a plan writes nothing, and shows the place before, the place after and how far it moves', async () => {
    const out = await call('plan_task_place', { place: { task: OLD_TASK, lat: 30.21, lng: -97.7, name: 'ZZ north gate' } })
    expect(out.isError).toBe(false)
    expect(world.writes).toEqual([])
    expect(out.body).toMatchObject({
      action: 'set',
      task: { id: OLD_TASK, words: 'ZZ walk the yard' },
      on: 'task',
      before: { name: 'ZZ gate', lat: 30.2, lng: -97.7, painted_map: MAP },
      after: { name: 'ZZ north gate', lat: 30.21, lng: -97.7, check_it_here: 'https://www.google.com/maps?q=30.21,-97.7' },
      found_by: 'the point you gave',
      stamped_at_apply: ['place_set_at', 'updated_at'],
    })
    expect(String(out.body!.reads)).toMatch(/^The place of "ZZ walk the yard" moves 0\.7 mi from "ZZ gate" to "ZZ north gate"\.$/)
    expect(String(out.body!.painted_map)).toContain('comes off')
    expect(out.body!.patch).toEqual({ place_name: 'ZZ north gate', place_lat: 30.21, place_lng: -97.7, place_accuracy_m: null, place_set_by: DEV, painted_map_id: null })
    expect((await call('plan_task_place', { place: { task: OLD_TASK, lat: 30.21, lng: -97.7, name: 'ZZ north gate' } })).body!.plan_hash).toBe(out.body!.plan_hash)
  })

  it('an apply is one update of the task\'s own row, stamped with the writer and the moment', async () => {
    const place = { task: 'walk the yard', lat: 30.21, lng: -97.7, name: 'ZZ north gate' }
    const plan = await call('plan_task_place', { place })
    const out = await call('apply_task_place', { place, plan_hash: plan.body!.plan_hash })
    expect(out.isError).toBe(false)
    expect(world.writes).toEqual([
      { method: 'PATCH', table: 'checklist_items', query: `id=eq.${OLD_TASK}&select=id`, prefer: 'return=representation', body: { place_name: 'ZZ north gate', place_lat: 30.21, place_lng: -97.7, place_accuracy_m: null, place_set_by: DEV, painted_map_id: null, place_set_at: '2026-11-17T18:00:00.000Z', updated_at: '2026-11-17T18:00:00.000Z' } },
    ])
    expect(placeOf(OLD_TASK)).toEqual({ name: 'ZZ north gate', lat: 30.21, lng: -97.7, by: DEV, at: '2026-11-17T18:00:00.000Z', map: null })
    expect(out.body).toMatchObject({ task_id: OLD_TASK, on: 'task', place: { name: 'ZZ north gate' } })
    // The same plan again finds the place already there, and writes nothing.
    const again = await call('apply_task_place', { place, plan_hash: plan.body!.plan_hash })
    expect(again.isError).toBe(true)
    expect(again.text).toContain('already has this place')
    expect(world.writes).toHaveLength(1)
  })

  it('a job, an address and the name of a place in use each end as a point', async () => {
    const byJob = await call('plan_task_place', { place: { task: BARE_TASK, job: JOB } })
    expect(byJob.body).toMatchObject({ before: null, after: { name: 'ZZ Test Maple Court', lat: 30.31, lng: -97.61 }, painted_map: 'The task\'s painted map stays.' })
    expect(String(byJob.body!.found_by)).toContain('the job "ZZ Test Maple Court": the app\'s saved point for "14 Maple Ct, Marlow, TX 78000"')
    expect((byJob.body!.patch as Row).painted_map_id).toBe(MAP)
    const byAddress = await call('plan_task_place', { place: { task: BARE_TASK, address: '9 Elm St, Marlow, TX 78000' } })
    expect(byAddress.body!.after).toMatchObject({ name: '9 Elm St', lat: 30.44, lng: -97.52 })
    const like = await call('plan_task_place', { place: { task: BARE_TASK, like: 'zz gate' } })
    expect(like.body).toMatchObject({ after: { name: 'ZZ gate', lat: 30.2, lng: -97.7 }, found_by: 'the place "ZZ gate" another task already carries' })
    const none = await call('plan_task_place', { place: { task: BARE_TASK, like: 'ZZ no such place' } })
    expect(none.isError).toBe(true)
    expect(none.text).toContain('The names in use: ZZ gate.')
    expect(world.writes).toEqual([])
  })

  it('a task from a roadmap keeps its place on the roadmap task', async () => {
    const place = { task: ROADMAP_ITEM, lat: 30.5, lng: -97.5, name: 'ZZ slab' }
    const plan = await call('plan_task_place', { place })
    expect(plan.body).toMatchObject({ on: 'roadmap task', stamped_at_apply: ['place_set_at'] })
    const out = await call('apply_task_place', { place, plan_hash: plan.body!.plan_hash })
    expect(out.isError).toBe(false)
    expect(world.writes.map((w) => `${w.method} ${w.table} ${w.query}`)).toEqual([`PATCH checklist_tech_tree_group_tasks id=eq.${ROADMAP_TASK}&select=id`])
    expect('updated_at' in (world.writes[0]!.body as Row)).toBe(false)
    expect(placeOf(ROADMAP_TASK)).toMatchObject({ name: 'ZZ slab', lat: 30.5, lng: -97.5, by: DEV })
    expect(placeOf(ROADMAP_ITEM).lat).toBeNull()
  })

  it('clear takes the place off with its map, and is refused where there is none', async () => {
    const plan = await call('plan_task_place', { place: { task: OLD_TASK, clear: true } })
    expect(plan.body).toMatchObject({ action: 'clear', reads: 'The place "ZZ gate" comes off "ZZ walk the yard".', after: null, stamped_at_apply: ['updated_at'] })
    const out = await call('apply_task_place', { place: { task: OLD_TASK, clear: true }, plan_hash: plan.body!.plan_hash })
    expect(out.isError).toBe(false)
    expect(placeOf(OLD_TASK)).toEqual({ name: null, lat: null, lng: null, by: null, at: null, map: null })
    const none = await call('plan_task_place', { place: { task: BARE_TASK, clear: true } })
    expect(none.isError).toBe(true)
    expect(none.text).toContain('has no place to take off')
  })

  it('refuses the place it already has, a changed call, a missing hash, and says so when RLS keeps the row', async () => {
    expect((await call('plan_task_place', { place: { task: OLD_TASK, lat: 30.2, lng: -97.7, name: 'ZZ gate' } })).text).toContain('already has this place')
    const place = { task: OLD_TASK, lat: 30.21, lng: -97.7, name: 'ZZ north gate' }
    const plan = await call('plan_task_place', { place })
    expect((await call('apply_task_place', { place: { ...place, name: 'ZZ south gate' }, plan_hash: plan.body!.plan_hash })).text).toContain('Nothing written')
    expect((await call('apply_task_place', { place })).isError).toBe(true)
    expect(world.writes).toEqual([])
    world.refuse = { checklist_items: 'kept' }
    const kept = await call('apply_task_place', { place, plan_hash: plan.body!.plan_hash })
    expect(kept.isError).toBe(true)
    expect(kept.text).toContain('RLS let no row through')
  })
})

describe('what an independent review found (v2.7589)', () => {
  it('a place set, taken off and set again is a second act, and the call log does not turn it away', async () => {
    // No map on the task, so the world after the place comes off is the world before it went on.
    ;(world.tables.checklist_items as Row[]).find((r) => r.id === BARE_TASK)!.painted_map_id = null
    const set = { task: BARE_TASK, lat: 30.4, lng: -97.4, name: 'ZZ tank' }
    const first = await call('plan_task_place', { place: set })
    expect((await call('apply_task_place', { place: set, plan_hash: first.body!.plan_hash })).isError).toBe(false)
    const off = await call('plan_task_place', { place: { task: BARE_TASK, clear: true } })
    expect((await call('apply_task_place', { place: { task: BARE_TASK, clear: true }, plan_hash: off.body!.plan_hash })).isError).toBe(false)
    const second = await call('plan_task_place', { place: set })
    // The same world and the same call hash the same, and the apply still lands.
    expect(second.body!.plan_hash).toBe(first.body!.plan_hash)
    const again = await call('apply_task_place', { place: set, plan_hash: second.body!.plan_hash })
    expect(again.isError).toBe(false)
    expect(world.writes.filter((w) => w.method === 'PATCH')).toHaveLength(3)
  })

  it('a task given, deleted in the app and given again the same day is given', async () => {
    const plan = await call('plan_task', { task: TASK })
    const first = await call('apply_task', { task: TASK, plan_hash: plan.body!.plan_hash })
    const id = first.body!.task_id
    for (const [table, key] of [['checklist_items', 'id'], ['checklist_item_assignees', 'checklist_item_id'], ['checklist_instances', 'checklist_item_id'], ['task_criteria', 'checklist_item_id']] as const) {
      world.tables[table] = (world.tables[table] as Row[]).filter((r) => r[key] !== id)
    }
    const again = await call('apply_task', { task: TASK, plan_hash: plan.body!.plan_hash })
    expect(again.isError).toBe(false)
    expect(again.body!.task_id).not.toBe(id)
  })

  it('a roadmap task whose own row holds a place has that place moved: it is the one the card reads', async () => {
    const own = (world.tables.checklist_items as Row[]).find((r) => r.id === ROADMAP_ITEM)!
    Object.assign(own, { place_name: 'ZZ own spot', place_lat: 30.7, place_lng: -97.3, place_accuracy_m: null, place_set_by: DEV, place_set_at: '2026-11-12T16:00:00Z', painted_map_id: null })
    const clear = await call('plan_task_place', { place: { task: ROADMAP_ITEM, clear: true } })
    expect(clear.body).toMatchObject({ on: 'task', before: { name: 'ZZ own spot' } })
    const move = { task: ROADMAP_ITEM, lat: 30.8, lng: -97.3, name: 'ZZ own spot' }
    const plan = await call('plan_task_place', { place: move })
    expect(plan.body).toMatchObject({ on: 'task' })
    await call('apply_task_place', { place: move, plan_hash: plan.body!.plan_hash })
    expect(world.writes.map((w) => `${w.table} ${w.query}`)).toEqual([`checklist_items id=eq.${ROADMAP_ITEM}&select=id`])
  })

  it('a write that never reaches the database is a named step with the task\'s id, not a bare tool error', async () => {
    const plan = await call('plan_task', { task: TASK })
    world.drop = 'checklist_instances'
    const out = await call('apply_task', { task: TASK, plan_hash: plan.body!.plan_hash })
    expect(out.isError).toBe(false)
    expect(out.body!.task_id).toBeTruthy()
    expect(String(out.body!.not_landed)).toMatch(/the day rows did not land \(.*the write did not reach the database: fetch failed\)/)
    // The people's rows throwing takes the task back, as a refusal does.
    world.tables.checklist_items = (world.tables.checklist_items as Row[]).filter((r) => r.id !== out.body!.task_id)
    world.tables.checklist_item_assignees = (world.tables.checklist_item_assignees as Row[]).filter((r) => r.checklist_item_id !== out.body!.task_id)
    world.drop = 'checklist_item_assignees'
    const lost = await call('apply_task', { task: TASK, plan_hash: plan.body!.plan_hash })
    expect(lost.isError).toBe(true)
    expect(lost.text).toContain('Nothing was given')
    expect((world.tables.checklist_items as Row[]).some((r) => r.title === TASK.text)).toBe(false)
  })

  it('get_task shows today\'s row of a weekly task, with its thread, and not only the weeks ahead', async () => {
    const task = { for: ANA, text: 'ZZ daily round', repeat: { weekdays: [0, 1, 2, 3, 4, 5, 6] } }
    const plan = await call('plan_task', { task })
    const given = await call('apply_task', { task, plan_hash: plan.body!.plan_hash })
    const id = given.body!.task_id as string
    const todayRow = (world.tables.checklist_instances as Row[]).find((r) => r.checklist_item_id === id && r.scheduled_date === TODAY)!
    Object.assign(todayRow, { completed_at: null, percent_complete: 25 })
    ;(world.tables.checklist_instance_events as Row[]).push({ instance_id: todayRow.id, event_type: 'comment', actor_user_id: ANA, body: 'ZZ started', percent: null, created_at: '2026-11-17T17:00:00Z' })
    // The fake's ids are not UUIDs, so the task is named by its words here.
    const whole = await call('get_task', { task: 'ZZ daily round' })
    const days = (whole.body!.days as Row[]).map((d) => d.day)
    expect(days).toEqual(['2026-11-21', '2026-11-20', '2026-11-19', '2026-11-18', TODAY])
    expect(whole.body!.thread).toEqual([expect.objectContaining({ text: 'ZZ started', day: TODAY })])
    expect(String(whole.body!.reading)).toContain(`the next on ${TODAY}`)
    // find_task counts each task's open days in a read of its own.
    const found = await call('find_task', { text: 'daily round' })
    expect((found.body!.matches as Row[])[0]).toMatchObject({ open_days: 36, next_open_day: TODAY })
  })

  it('a person is found by a short name though archived accounts and twins share it', async () => {
    for (let i = 0; i < 25; i += 1) (world.tables.users as Row[]).push(person(`00000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`, `ZZ Aa Gone ${i}`, { archived_at: '2026-01-01T00:00:00Z' }))
    ;(world.tables.users as Row[]).push(person('00000000-0000-4000-8000-000000000099', 'ZZ Zed Live'))
    const out = await call('plan_task', { task: { for: 'ZZ', text: 'ZZ a task' } })
    // Three live people hold "ZZ"; the archived twenty-five never crowd them out of the read.
    expect(out.text).toContain('matches 3 people')
    expect((await call('plan_task', { task: { for: 'ZZ Gone Away', text: 'ZZ a task' } })).text).toContain('is archived')

describe('plan_task_photo → apply_task_photo', () => {
  const fileOf = async (bytes: Uint8Array, name = 'spot.jpg') => ({ name, size_bytes: bytes.length, sha256: await sha256(bytes) })
  const stageOf = async (bytes: Uint8Array) => `${DEV}/task-spot-photos/${(await sha256(bytes)).slice(0, 32)}.jpg`
  const pathOn = (id: string) => [...(world.tables.checklist_items as Row[]), ...(world.tables.checklist_tech_tree_group_tasks as Row[])].find((x) => x.id === id)!.spot_photo_path as string | null

  it('a plan writes nothing, puts nothing in a bucket, and hands back where to PUT the file', async () => {
    const photo = { task: BARE_TASK, file: await fileOf(JPG) }
    const out = await call('plan_task_photo', { photo })
    expect(out.isError).toBe(false)
    expect(world.writes).toEqual([])
    // The one storage call is the signed address, in the dev's own staging folder.
    expect(world.storage).toEqual([`sign ${await stageOf(JPG)}`])
    expect(out.body).toMatchObject({
      action: 'put',
      task: { id: BARE_TASK, words: 'ZZ bare task' },
      on: 'task',
      has_a_photo_now: false,
      reads: '"ZZ bare task" gets a photo of the spot.',
      file: { name: 'spot.jpg', mime: 'image/jpeg', size_bytes: JPG.length },
      upload: { upload_url: `${BASE}/storage/v1/object/upload/sign/dev-seat-staging/${await stageOf(JPG)}?token=tok`, upload_expires_in: '2 hours' },
    })
    expect(String(out.body!.what_it_is)).toContain('never counts as the finishing photo')
    // The signed address is no part of the hash: a second plan gives the same one.
    expect((await call('plan_task_photo', { photo })).body!.plan_hash).toBe(out.body!.plan_hash)
  })

  it('an apply checks the staged copy, puts the picture under the task\'s own name, points the task at it and clears the staging', async () => {
    const photo = { task: BARE_TASK, file: await fileOf(JPG) }
    const plan = await call('plan_task_photo', { photo })
    // Before the file is PUT, the apply has nothing to read.
    const early = await call('apply_task_photo', { photo, plan_hash: plan.body!.plan_hash })
    expect(early.isError).toBe(true)
    expect(early.text).toContain('Nothing is staged for this plan')
    expect(world.writes).toEqual([])
    world.staged[await stageOf(JPG)] = JPG
    world.storage = []
    const out = await call('apply_task_photo', { photo, plan_hash: plan.body!.plan_hash })
    expect(out.isError).toBe(false)
    const path = pathOn(BARE_TASK)!
    expect(path).toMatch(new RegExp(`^item/${BARE_TASK}/[0-9a-f-]{36}\\.jpg$`))
    expect(world.writes).toEqual([{ method: 'PATCH', table: 'checklist_items', query: `id=eq.${BARE_TASK}&select=id`, prefer: 'return=representation', body: { spot_photo_path: path } }])
    expect(world.storage).toEqual([`put task-spot-photos/${path}`, `remove dev-seat-staging/${await stageOf(JPG)}`])
    expect(world.bucket[path]).toEqual(JPG)
    expect(out.body).toMatchObject({ task_id: BARE_TASK, photo: path, staged_copy: 'removed', on: 'task' })
    // The task has a photo now: the same plan again is turned away, and writes nothing more.
    const again = await call('apply_task_photo', { photo, plan_hash: plan.body!.plan_hash })
    expect(again.isError).toBe(true)
    expect(again.text).toContain('already has a photo of the spot')
    expect(world.writes).toHaveLength(1)
  })

  it('a task that has a photo takes another only with replace, and the old picture leaves the bucket', async () => {
    const file = await fileOf(JPG)
    const refused = await call('plan_task_photo', { photo: { task: OLD_TASK, file } })
    expect(refused.isError).toBe(true)
    expect(refused.text).toContain('Pass replace: true')
    const photo = { task: OLD_TASK, file, replace: true }
    const plan = await call('plan_task_photo', { photo })
    expect(plan.body).toMatchObject({ has_a_photo_now: true, replaces: `item/${OLD_TASK}/p1.jpg`, reads: 'A new photo of the spot replaces the one on "ZZ walk the yard".' })
    world.staged[await stageOf(JPG)] = JPG
    world.storage = []
    const out = await call('apply_task_photo', { photo, plan_hash: plan.body!.plan_hash })
    expect(out.isError).toBe(false)
    const path = pathOn(OLD_TASK)!
    expect(world.storage).toEqual([`put task-spot-photos/${path}`, `remove task-spot-photos/item/${OLD_TASK}/p1.jpg`, `remove dev-seat-staging/${await stageOf(JPG)}`])
    expect(Object.keys(world.bucket)).toEqual([path])
  })

  it('a file that is not the one planned, or not a JPEG, is turned away before anything is written', async () => {
    const photo = { task: BARE_TASK, file: await fileOf(JPG) }
    const plan = await call('plan_task_photo', { photo })
    world.staged[await stageOf(JPG)] = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x99])
    expect((await call('apply_task_photo', { photo, plan_hash: plan.body!.plan_hash })).text).toContain("sha256")
    world.staged[await stageOf(JPG)] = new Uint8Array([0xff, 0xd8, 0xff])
    expect((await call('apply_task_photo', { photo, plan_hash: plan.body!.plan_hash })).text).toContain('The staged file is 3 bytes; the plan says 10')
    // A PNG wearing a .jpg name.
    const fake = { task: BARE_TASK, file: await fileOf(PNG) }
    const fakePlan = await call('plan_task_photo', { photo: fake })
    world.staged[await stageOf(PNG)] = PNG
    expect((await call('apply_task_photo', { photo: fake, plan_hash: fakePlan.body!.plan_hash })).text).toContain('is not a JPEG')
    expect(world.writes).toEqual([])
    expect(world.storage.filter((l) => l.startsWith('put '))).toEqual([])
    expect(pathOn(BARE_TASK)).toBeNull()
  })

  it('a path that does not save takes the new picture back out, and a put the bucket refuses writes no row', async () => {
    const photo = { task: BARE_TASK, file: await fileOf(JPG) }
    const plan = await call('plan_task_photo', { photo })
    world.staged[await stageOf(JPG)] = JPG
    world.refuse = { checklist_items: 'kept' }
    const kept = await call('apply_task_photo', { photo, plan_hash: plan.body!.plan_hash })
    expect(kept.isError).toBe(true)
    expect(kept.text).toContain('The picture was taken back out of the bucket')
    expect(Object.keys(world.bucket)).toEqual([`item/${OLD_TASK}/p1.jpg`])
    // The staged copy is still there, so the same plan can be applied once it is put right.
    expect(world.staged[await stageOf(JPG)]).toEqual(JPG)
    world.refuse = {}
    world.refusePut = true
    world.writes = []
    const noPut = await call('apply_task_photo', { photo, plan_hash: plan.body!.plan_hash })
    expect(noPut.isError).toBe(true)
    expect(noPut.text).toContain('Could not store the file')
    expect(world.writes).toEqual([])
  })

  it('remove takes the photo off and its file out, and is refused where there is none', async () => {
    const photo = { task: OLD_TASK, remove: true }
    const plan = await call('plan_task_photo', { photo })
    expect(plan.body).toMatchObject({ action: 'remove', removes: `item/${OLD_TASK}/p1.jpg` })
    expect('upload' in plan.body!).toBe(false)
    expect(world.storage).toEqual([])
    const out = await call('apply_task_photo', { photo, plan_hash: plan.body!.plan_hash })
    expect(out.isError).toBe(false)
    expect(pathOn(OLD_TASK)).toBeNull()
    expect(world.storage).toEqual([`remove task-spot-photos/item/${OLD_TASK}/p1.jpg`])
    expect((await call('plan_task_photo', { photo: { task: BARE_TASK, remove: true } })).text).toContain('has no photo of the spot to take off')
  })

  it('a task from a roadmap keeps its photo on the roadmap task', async () => {
    const photo = { task: ROADMAP_ITEM, file: await fileOf(JPG) }
    const plan = await call('plan_task_photo', { photo })
    expect(plan.body).toMatchObject({ on: 'roadmap task' })
    expect(String(plan.body!.lands)).toContain(`roadmap/${ROADMAP_TASK}/`)
    world.staged[await stageOf(JPG)] = JPG
    const out = await call('apply_task_photo', { photo, plan_hash: plan.body!.plan_hash })
    expect(out.isError).toBe(false)
    expect(pathOn(ROADMAP_TASK)).toMatch(new RegExp(`^roadmap/${ROADMAP_TASK}/[0-9a-f-]{36}\\.jpg$`))
    expect(world.writes.map((w) => w.table)).toEqual(['checklist_tech_tree_group_tasks'])
  })
})
