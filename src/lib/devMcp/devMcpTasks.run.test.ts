/**
 * dev-mcp's own handler, run here for find_task / get_task and plan_task → apply_task (v2.7584): the function's
 * index.ts with its three URL imports stood in for, and one `fetch` behind which sits a recording fake database.
 * Nothing reaches a network. The proof that matters most is the first: a plan writes nothing.
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
const BASE = 'http://127.0.0.1:9'
// The fake clock: 2026-11-17 12:00 in Chicago, a Tuesday.
const TODAY = '2026-11-17'

const world = {
  tables: {} as Record<string, Row[]>,
  writes: [] as Array<{ method: string; table: string; query: string; body: unknown; prefer: string }>,
  log: [] as Row[],
  /** A table whose next POST is refused, with the words PostgREST would answer. */
  refuse: {} as Record<string, string>,
  made: 0,
}

function matches(row: Row, key: string, expr: string): boolean {
  const v = row[key]
  if (expr === 'is.null') return v === null || v === undefined
  if (expr === 'is.false') return v === false
  if (expr.startsWith('eq.')) return String(v ?? '') === expr.slice(3)
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
      if (world.refuse[table]) return json({ message: world.refuse[table] }, 403)
      const rows = (Array.isArray(body) ? body : [body]).map((r: Row) => ({ id: `made-${++world.made}`, created_at: '2026-11-17T18:00:00Z', ...r }))
      world.tables[table] = [...(world.tables[table] ?? []), ...rows]
      return prefer.includes('return=representation') ? json(rows.map((r) => ({ id: r.id }))) : new Response(null, { status: 201 })
    }
    if (method === 'DELETE') {
      const hit = filtered(table, query)
      world.tables[table] = (world.tables[table] ?? []).filter((r) => !hit.includes(r))
      return json(hit.map((r) => ({ id: r.id })))
    }
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
      { id: OLD_TASK, title: 'ZZ walk the yard', links: [], start_date: '2026-11-10', due_date: null, repeat_type: 'once', repeat_days_of_week: null, repeat_days_after: null, repeat_end_date: null, show_until_completed: true, asks_for_photo: true, reminder_time: null, created_at: '2026-11-10T15:00:00Z', created_by_user_id: DEV, place_name: 'ZZ gate', place_lat: 30.2, place_lng: -97.7, place_accuracy_m: null, place_set_by: DEV, place_set_at: '2026-11-10T15:00:00Z', spot_photo_path: `item/${OLD_TASK}/p1.jpg`, notify_creator_on_complete: true },
    ],
    checklist_instances: [{ id: OLD_DAY, checklist_item_id: OLD_TASK, scheduled_date: '2026-11-10', completed_at: null, completed_by_user_id: null, percent_complete: 50, notes: null }],
    checklist_instance_events: [{ instance_id: OLD_DAY, event_type: 'comment', actor_user_id: ANA, body: 'ZZ half done', percent: null, created_at: '2026-11-10T19:00:00Z' }],
    task_criteria: [{ id: 'l1', checklist_item_id: OLD_TASK, body: 'ZZ the gate is shut', sort_index: 0, retired_at: null }],
    task_photos: [],
    checklist_instance_assignees: [],
    checklist_tech_tree_group_tasks: [],
  }
  world.writes = []
  world.log = []
  world.refuse = {}
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
    expect((world.tables.checklist_items as Row[]).map((r) => r.id)).toEqual([OLD_TASK])
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
