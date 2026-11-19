/**
 * dev-mcp's own handler, run here for plan_lien_service → apply_lien_service and read_lien_filings (v2.7515): the
 * function's index.ts with its three URL imports stood in for, and one `fetch` behind which sit a recording fake
 * database, the staging bucket and drive-link's door. Nothing reaches a network.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (req: Request) => Promise<Response>
type Row = Record<string, unknown>
const box: { handler: Handler | null } = { handler: null }

const DEV = 'ffffffff-2222-4222-8222-222222222222'
const JOB = '99999999-2222-4222-8222-222222222222'
const JOB_B = '99999999-3333-4333-8333-333333333333'
const GC = 'cccccccc-2222-4222-8222-222222222222'
const FILING = 'bbbbbbbb-2222-4222-8222-222222222222'
const FILING_B = 'bbbbbbbb-3333-4333-8333-333333333333'
const BASE = 'http://127.0.0.1:9'

const world = {
  tables: {} as Record<string, Row[]>,
  writes: [] as Array<{ method: string; table: string; query: string; body: unknown }>,
  log: [] as Row[],
  staged: {} as Record<string, Uint8Array>,
  signed: [] as string[],
  removed: [] as string[],
  drive: [] as Row[],
}

function matches(row: Row, key: string, expr: string): boolean {
  const v = row[key]
  if (expr === 'is.null') return v === null || v === undefined
  if (expr === 'not.is.null') return v !== null && v !== undefined
  if (expr.startsWith('eq.')) return String(v ?? '') === expr.slice(3)
  if (expr.startsWith('in.(')) return expr.slice(4, -1).split(',').includes(String(v ?? ''))
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
  const STAGE = '/storage/v1/object/'
  if (path.startsWith(`${STAGE}upload/sign/dev-seat-staging/`)) {
    const at = path.slice(`${STAGE}upload/sign/dev-seat-staging/`.length)
    world.signed.push(at)
    return json({ url: `/object/upload/sign/dev-seat-staging/${at}?token=tok` })
  }
  if (path.startsWith(`${STAGE}authenticated/dev-seat-staging/`)) {
    const bytes = world.staged[path.slice(`${STAGE}authenticated/dev-seat-staging/`.length)]
    return bytes ? new Response(bytes, { status: 200 }) : json({ message: 'Object not found' }, 404)
  }
  if (path.startsWith(`${STAGE}dev-seat-staging/`) && method === 'DELETE') {
    const at = path.slice(`${STAGE}dev-seat-staging/`.length)
    world.removed.push(at)
    delete world.staged[at]
    return json({})
  }
  if (path === '/functions/v1/drive-link') {
    const body = JSON.parse(String(init?.body)) as Row
    world.drive.push({ ...body, base64: '(bytes)' })
    return json({ driveFileId: 'rcpt1', url: 'https://drive.google.com/file/d/rcpt1/view' })
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

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
let JPG_SHA = ''
async function sha256(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const filed = (id: string, jobId: string, over: Row = {}): Row => ({ id, job_id: jobId, kind: 'affidavit', fields: { form: 'short', isSub: true }, filed_at: '2026-11-16', recording_number: '20269990001', county: 'Marlow', document_url: 'https://drive.google.com/file/d/abc/view', serve_due: '2026-11-23', served_at: null, sends: [], voided_at: null, created_at: '2026-11-16T18:00:00Z', ...over })

beforeEach(async () => {
  JPG_SHA ||= await sha256(JPG)
  world.tables = {
    jobs_ledger: [
      { id: JOB, job_name: 'ZZ Test Maple Court', job_address: '14 Maple Ct, Marlow, TX 78000', hcp_number: '2291', click_number: '', gc_customer_id: GC },
      { id: JOB_B, job_name: 'ZZ Test Birch Lane', job_address: '22 Birch Ln, Marlow, TX 78000', hcp_number: '2304', click_number: '', gc_customer_id: null },
    ],
    job_lien_filings: [filed(FILING, JOB), filed(FILING_B, JOB_B, { fields: { form: 'short', isSub: false }, document_url: '', recording_number: '' })],
  }
  world.writes = []
  world.log = []
  world.staged = {}
  world.signed = []
  world.removed = []
  world.drive = []
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

const TARGET = `id=eq.${FILING}&kind=eq.affidavit&voided_at=is.null&select=id`
const stagePath = () => `${DEV}/lien-receipts/${JPG_SHA.slice(0, 32)}.jpg`
const numbers = (): Row => ({ job_id: JOB, served_on: '2026-11-18', owner: { tracking: 'OWN-11' }, contractor: { tracking: 'GC-28' } })
const planned = async (service: Row) => {
  const out = await call('plan_lien_service', { service })
  return (out.body!.entries as Row[])[0]!
}

describe('read_lien_filings', () => {
  it('lists the filed liens with what each lacks, and writes nothing', async () => {
    const out = await call('read_lien_filings', {})
    expect(out.isError).toBe(false)
    expect(out.body!.counts).toEqual({ filed: 2, no_recording_number: 1, no_saved_copy: 1, copies_not_served: 2, served_without_proof: 0 })
    const lines = out.body!.filings as Row[]
    expect(lines.find((l) => l.filing_id === FILING)).toMatchObject({ job: 'JP2291', left: ['service'], clock: '3 days left to mail the copies' })
    expect(lines.find((l) => l.filing_id === FILING_B)).toMatchObject({ job: 'JP2304', left: ['recording_number', 'saved_copy', 'service'] })
    expect(world.writes).toEqual([])
    const one = await call('read_lien_filings', { job_id: JOB, show: 'all' })
    expect(one.body!.filings).toHaveLength(1)
  })
})

describe('plan_lien_service → apply_lien_service', () => {
  it('a plan writes nothing and gives each ready service its own hash', async () => {
    const out = await call('plan_lien_service', { services: [numbers(), { job_id: JOB_B, served_on: '2026-11-18', contractor: { tracking: 'X' } }] })
    expect(out.body!.services).toBe('2 services: 1 ready, 1 refused.')
    const [ready, refused] = out.body!.entries as Row[]
    expect(String(ready!.plan_hash)).toMatch(/^[0-9a-f]{64}$/)
    expect(String(refused!.why)).toContain('mails one copy')
    expect(world.writes).toEqual([])
    expect(world.signed).toEqual([])
  })

  it('records the day and each copy’s number with the form’s own sends, in one write', async () => {
    const entry = await planned(numbers())
    const out = await call('apply_lien_service', { service: numbers(), plan_hash: entry.plan_hash })
    expect(out.body).toMatchObject({ ok: true, filing_id: FILING, served_on: '2026-11-18', still_missing: 0 })
    expect(world.writes).toEqual([
      {
        method: 'PATCH',
        table: 'job_lien_filings',
        query: TARGET,
        body: { served_at: '2026-11-18', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: 'OWN-11', sent_on: '2026-11-18' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: 'GC-28', sent_on: '2026-11-18' }] },
      },
    ])
    expect(world.drive).toEqual([])
    // Once is once: the same service again changes nothing and is refused.
    const again = await call('apply_lien_service', { service: numbers(), plan_hash: entry.plan_hash })
    expect(again.isError).toBe(true)
    expect(world.writes).toHaveLength(1)
    const read = await call('read_lien_filings', { job_id: JOB })
    expect(read.body!.filings).toEqual([])
  })

  it('a receipt is checked before anything is written, then filed and linked onto its copy', async () => {
    const service: Row = { job_id: JOB, served_on: '2026-11-18', owner: { tracking: 'OWN-11', receipt: { name: 'owner.jpg', size_bytes: JPG.length, sha256: JPG_SHA } } }
    const entry = await planned(service)
    expect(entry.uploads).toEqual([expect.objectContaining({ copy: 'owner', file: 'owner.jpg', upload_url: `${BASE}/storage/v1/object/upload/sign/dev-seat-staging/${stagePath()}?token=tok` })])
    const nothing = await call('apply_lien_service', { service, plan_hash: entry.plan_hash })
    expect(nothing.isError).toBe(true)
    expect(nothing.text).toContain('Nothing is staged for this plan')
    expect(world.writes).toEqual([])
    world.staged[stagePath()] = JPG
    const out = await call('apply_lien_service', { service, plan_hash: entry.plan_hash })
    expect(out.body).toMatchObject({ ok: true, served_on: '2026-11-18', still_missing: 1 })
    expect(world.drive).toEqual([{ action: 'put', job: { jobs_ledger_id: JOB }, name: 'Lien affidavit, Job 2291, mail receipt, owner, 2026-11-18.jpg', mime: 'image/jpeg', where: 'sent', base64: '(bytes)' }])
    expect(world.writes.map((w) => w.query)).toEqual([TARGET, TARGET])
    // The day and the number land first; the receipt's link follows on the same send.
    expect((world.writes[0]!.body as Row).sends).toEqual([{ recipient: 'owner', method: 'certified_mail', tracking: 'OWN-11', sent_on: '2026-11-18' }])
    expect((world.writes[1]!.body as Row).sends).toEqual([{ recipient: 'owner', method: 'certified_mail', tracking: 'OWN-11', sent_on: '2026-11-18', receipt_url: 'https://drive.google.com/file/d/rcpt1/view' }])
    expect(world.removed).toEqual([stagePath()])
  })

  it('a filing voided since the plan takes no write', async () => {
    const entry = await planned(numbers())
    world.tables.job_lien_filings!.find((f) => f.id === FILING)!.voided_at = '2026-11-20T17:00:00Z'
    const out = await call('apply_lien_service', { service: numbers(), plan_hash: entry.plan_hash })
    expect(out.isError).toBe(true)
    expect(out.text).toContain('no filed lien affidavit is on record')
    expect(world.writes).toEqual([])
  })

  it('never runs as someone else', async () => {
    const out = await call('view_as', { verb: 'apply_lien_service', role: 'assistant', args: { service: numbers(), plan_hash: 'a'.repeat(64) } })
    expect(out.isError).toBe(true)
    expect(world.writes).toEqual([])
  })
})
