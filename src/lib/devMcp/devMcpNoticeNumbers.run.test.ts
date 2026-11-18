/**
 * dev-mcp's own handler, run here for plan_notice_numbers → apply_notice_numbers (v2.7687): the function's index.ts
 * with its three URL imports stood in for, and one `fetch` behind which sits a recording fake database. Nothing
 * reaches a network. Every job, name and mail number here is made up.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (req: Request) => Promise<Response>
type Row = Record<string, unknown>
const box: { handler: Handler | null } = { handler: null }

const DEV = 'ffffffff-2222-4222-8222-222222222222'
const JOB = '99999999-2222-4222-8222-222222222222'
const JOB_B = '99999999-3333-4333-8333-333333333333'
const PACKET = 'dddddddd-2222-4222-8222-222222222222'
const FILING = 'bbbbbbbb-2222-4222-8222-222222222222'
const FILING_B = 'bbbbbbbb-3333-4333-8333-333333333333'
const BASE = 'http://127.0.0.1:9'

const world = {
  tables: {} as Record<string, Row[]>,
  writes: [] as Array<{ method: string; table: string; query: string; body: unknown }>,
  log: [] as Row[],
}

function matches(row: Row, key: string, expr: string): boolean {
  const v = row[key]
  if (expr === 'is.null') return v === null || v === undefined
  if (expr === 'not.is.null') return v !== null && v !== undefined
  if (expr.startsWith('eq.')) return String(v ?? '') === expr.slice(3)
  if (expr.startsWith('in.(')) return expr.slice(4, -1).split(',').includes(String(v ?? ''))
  if (expr.startsWith('cs.')) {
    const want = JSON.parse(expr.slice(3)) as Row[]
    return Array.isArray(v) && want.every((w) => (v as Row[]).some((s) => Object.entries(w).every(([k, x]) => s[k] === x)))
  }
  throw new Error(`fake REST: no filter "${expr}"`)
}
function filtered(table: string, query: string): Row[] {
  const params = [...new URLSearchParams(query).entries()].filter(([k]) => !['select', 'order', 'limit'].includes(k))
  return (world.tables[table] ?? []).filter((r) => params.every(([k, expr]) => matches(r, k, expr)))
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
    world.writes.push({ method, table, query, body })
    if (method === 'PATCH') {
      const hit = filtered(table, query)
      for (const r of hit) Object.assign(r, body as Row)
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
      if (name === 'dev_mcp_calls') world.log.push({ ...row, created_at: '2026-11-20T18:00:00Z' })
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
  vi.setSystemTime(new Date('2026-11-20T18:00:00Z'))
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  globalThis.fetch = fakeFetch as typeof fetch
  await import(/* @vite-ignore */ FUNCTION_FILE)
}, 120_000)
afterAll(() => {
  globalThis.fetch = realFetch
  vi.useRealTimers()
})

const N1 = '9507000000000000000117'
const N2 = '9507000000000000000124'
const N3 = '9507000000000000000131'
const send = (recipient: string, tracking: string): Row => ({ recipient, method: 'certified_mail', tracking, sent_on: '2026-11-16' })
const noticeRow = (id: string, jobId: string, over: Row = {}): Row => ({ id, job_id: jobId, kind: 'notice_53_056', months_covered: ['2026-07', '2026-08'], sends: [send('owner', N2), send('original_contractor', N2)], by_hand: true, packet_id: PACKET, applied_from: null, voided_at: null, created_at: '2026-11-17T16:00:00Z', ...over })

beforeEach(() => {
  world.tables = {
    jobs_ledger: [
      { id: JOB, job_name: 'ZZ Test Maple Court', job_address: '14 Maple Ct, Marlow, TX 78000', hcp_number: '2291', click_number: '' },
      { id: JOB_B, job_name: 'ZZ Test Birch Lane', job_address: '22 Birch Ln, Marlow, TX 78000', hcp_number: '2304', click_number: '' },
    ],
    job_lien_filings: [noticeRow(FILING, JOB), noticeRow(FILING_B, JOB_B, { packet_id: null, months_covered: ['2026-09'], sends: [send('owner', N3), send('original_contractor', '')] })],
    job_lien_desk_items: [{ id: 'item-1', job_id: JOB, status: 'sent', sent_at: '2026-11-16T18:00:00+00:00', sent_filing_id: FILING, voided_at: null }],
  }
  world.writes = []
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

const TARGET = `id=eq.${FILING}&kind=in.(notice_53_056,retainage_53_057)&voided_at=is.null&select=id`
const owner = (): Row => ({ job_id: JOB, owner: { tracking: '9507 0000 0000 0000 0001 17' }, sent_on: '2026-11-16' })
const planned = async (notice: Row) => {
  const out = await call('plan_notice_numbers', { notice })
  return (out.body!.entries as Row[])[0]!
}
const filings = () => world.tables.job_lien_filings!
const sendsOf = (id: string) => (filings().find((r) => r.id === id)!.sends as Row[]).map((s) => s.tracking)

describe('plan_notice_numbers → apply_notice_numbers', () => {
  it('a plan writes nothing, gives each ready notice its own hash and names what it holds', async () => {
    const out = await call('plan_notice_numbers', { notices: [owner(), { job_id: JOB_B, contractor: { tracking: N1 }, sent_on: '2026-11-17' }, { job_id: JOB, contractor: { tracking: N3 } }, { job_id: 'nope' }] })
    expect(out.isError).toBe(false)
    expect(out.body!.notices).toBe('4 notices: 1 ready, 3 refused.')
    const [a, b, c, d] = out.body!.entries as [Row, Row, Row, Row]
    expect(a).toMatchObject({ entry: 1, status: 'ready', job: { label: 'JP2291' }, before: [{ copy: 'owner', tracking: N2 }, { copy: 'original_contractor', tracking: N2 }], after: [{ copy: 'owner', tracking: N1 }, { copy: 'original_contractor', tracking: N2 }] })
    expect(String(a.plan_hash)).toMatch(/^[0-9a-f]{64}$/)
    expect(b).toMatchObject({ entry: 2, status: 'refused' })
    expect(String(b.why)).toContain('the record says this notice was mailed on 2026-11-16, and the call says 2026-11-17')
    // The second entry for one notice is told to join the first: one notice, one write.
    expect(String(c.why)).toContain('names the same notice twice (entry 1)')
    expect(String(d.why)).toContain('find_job')
    expect(world.writes).toEqual([])
  })

  it('an apply writes the sends alone, reads them back, and takes its hash once', async () => {
    const entry = await planned(owner())
    const done = await call('apply_notice_numbers', { notice: owner(), plan_hash: entry.plan_hash })
    expect(done.isError).toBe(false)
    expect(done.body).toMatchObject({ ok: true, filing_id: FILING, still_owed: 0, copies: [{ copy: 'owner', tracking: N1, mailed_on: '2026-11-16' }, { copy: 'original_contractor', tracking: N2 }] })
    expect(world.writes).toEqual([{ method: 'PATCH', table: 'job_lien_filings', query: TARGET, body: { sends: [send('owner', N1), send('original_contractor', N2)] } }])
    expect(sendsOf(FILING)).toEqual([N1, N2])
    // The desk item, the other job and the day are as they were.
    expect(world.tables.job_lien_desk_items![0]).toMatchObject({ status: 'sent', sent_at: '2026-11-16T18:00:00+00:00' })
    expect(sendsOf(FILING_B)).toEqual([N3, ''])
    // The same plan a second time: the world moved, so the hash no longer matches and nothing more is written.
    const again = await call('apply_notice_numbers', { notice: owner(), plan_hash: entry.plan_hash })
    expect(again.isError).toBe(true)
    expect(world.writes).toHaveLength(1)
  })

  it('both copies go in one write, and a number comes off', async () => {
    const notice: Row = { job_id: JOB_B, owner: { tracking: N1 }, contractor: { tracking: N2 } }
    const entry = await planned(notice)
    // The first job's notice already holds N2: the plan says so and still stands.
    expect(entry.also_holds_this_number).toEqual([`JP2291: Owner of record ${N2} · Original contractor ${N2}`])
    const done = await call('apply_notice_numbers', { notice, plan_hash: entry.plan_hash })
    expect(done.body).toMatchObject({ ok: true, still_owed: 0 })
    expect(sendsOf(FILING_B)).toEqual([N1, N2])
    const off: Row = { job_id: JOB_B, contractor: { tracking: '' } }
    const offEntry = await planned(off)
    expect(String(offEntry.takes_off)).toContain('Original contractor')
    const taken = await call('apply_notice_numbers', { notice: off, plan_hash: offEntry.plan_hash })
    expect(taken.body).toMatchObject({ ok: true, still_owed: 1 })
    expect(sendsOf(FILING_B)).toEqual([N1, ''])
  })

  it('an apply refuses a plan the record no longer matches, a hash that is not one, and a notice voided since', async () => {
    const entry = await planned(owner())
    ;(filings()[0]!.sends as Row[])[1]!.tracking = N3
    const moved = await call('apply_notice_numbers', { notice: owner(), plan_hash: entry.plan_hash })
    expect(moved.isError).toBe(true)
    expect(world.writes).toEqual([])
    expect((await call('apply_notice_numbers', { notice: owner(), plan_hash: 'nope' })).isError).toBe(true)
    filings()[0]!.voided_at = '2026-11-18T00:00:00Z'
    const gone = await planned(owner())
    expect(gone).toMatchObject({ status: 'refused' })
    expect(String(gone.why)).toContain('no lien notice is on record')
  })
})
