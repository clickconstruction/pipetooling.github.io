/**
 * dev-mcp's own handler, run here for plan_lien_receipt_off → apply_lien_receipt_off (v2.7909): the function's
 * index.ts with its three URL imports stood in for, and one `fetch` behind which sit a recording fake database and
 * drive-link's trash door. Nothing reaches a network. Each case proves what a real clean-up leans on: a plan writes
 * nothing; an apply writes the filing's sends and nothing else, then sends each file to the trash; and every way it
 * stops leaves the record, and the files, as they were.
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
const OWNER_FILE = '1ownOwnOwnOwnOwnOwnOwnOwnOwn'
const GC_FILE = '1gcGcGcGcGcGcGcGcGcGcGcGcGcG'
const OWNER_URL = `https://drive.google.com/file/d/${OWNER_FILE}/view`
const GC_URL = `https://drive.google.com/file/d/${GC_FILE}/view`
const BECAUSE = 'The file on record is the stamped lien, not a mail receipt.'

const world = {
  tables: {} as Record<string, Row[]>,
  writes: [] as Array<{ method: string; table: string; query: string; body: unknown }>,
  log: [] as Row[],
  drive: [] as Row[],
  /** The trash door's answer for a file id, when it is not a plain yes. */
  refuseTrash: {} as Record<string, string>,
  refuseWrite: false,
}

function matches(row: Row, key: string, expr: string): boolean {
  const v = row[key]
  if (expr === 'is.null') return v === null || v === undefined
  if (expr === 'not.is.null') return v !== null && v !== undefined
  if (expr.startsWith('eq.')) return String(v ?? '') === expr.slice(3)
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
      if (world.refuseWrite) return json({ message: 'new row violates row-level security policy' }, 403)
      const hit = filtered(table, query)
      for (const r of hit) Object.assign(r, body as Row)
      return json(hit.map((r) => ({ id: r.id })))
    }
  }
  if (path === '/functions/v1/drive-link') {
    const body = JSON.parse(String(init?.body)) as Row
    world.drive.push(body)
    const id = String(body.driveFileId ?? '')
    // The door's own fence, as drive-link keeps it: never a file a lien record of the job still names.
    const named = JSON.stringify((world.tables.job_lien_filings ?? []).filter((r) => r.job_id === (body.job as Row | undefined)?.jobs_ledger_id)).includes(id)
    if (named) return json({ error: 'A lien record still uses it.', why: 'in_use', retry: false }, 409)
    if (world.refuseTrash[id]) return json({ error: world.refuseTrash[id] }, 409)
    return json({ trashed: true, name: 'receipt.pdf', url: `https://drive.google.com/file/d/${id}/view` })
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

// No GOOGLE_SERVICE_ACCOUNT_JSON: the plan's file facts read as unread here, and the plan must stand without them.
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

const wrong = (): Row[] => [
  { recipient: 'owner', method: 'certified_mail', tracking: '', receipt_url: OWNER_URL },
  { recipient: 'original_contractor', method: 'certified_mail', tracking: '', receipt_url: GC_URL },
]
const filed = (id: string, jobId: string, over: Row = {}): Row => ({ id, job_id: jobId, kind: 'affidavit', fields: { form: 'short', isSub: true }, filed_at: '2026-11-16', recording_number: 'ZZ-0001', county: 'Marlow', document_url: 'https://example.test/stamped.pdf', serve_due: '2026-11-23', served_at: null, sends: wrong(), voided_at: null, created_at: '2026-11-16T15:00:00Z', ...over })

beforeEach(() => {
  world.tables = {
    jobs_ledger: [
      { id: JOB, job_name: 'ZZ Test Maple Court', job_address: '14 Maple Ct, Marlow, TX 78000', hcp_number: '2291', click_number: '', gc_customer_id: GC },
      { id: JOB_B, job_name: 'ZZ Test Birch Lane', job_address: '22 Birch Ln, Marlow, TX 78000', hcp_number: '2304', click_number: '', gc_customer_id: null },
    ],
    job_lien_filings: [filed(FILING, JOB), filed(FILING_B, JOB_B, { fields: { form: 'short', isSub: false }, sends: [] })],
  }
  world.writes = []
  world.log = []
  world.drive = []
  world.refuseTrash = {}
  world.refuseWrite = false
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

const TARGET = `id=eq.${FILING}&kind=eq.affidavit&voided_at=is.null&served_at=is.null&select=id`
const both = (): Row => ({ job_id: JOB, copies: ['owner', 'original_contractor'], because: BECAUSE })
const planned = async (receipt: Row) => {
  const out = await call('plan_lien_receipt_off', { receipt })
  return (out.body!.entries as Row[])[0]!
}
const sendsOf = (id: string) => world.tables.job_lien_filings!.find((r) => r.id === id)!.sends

describe('plan_lien_receipt_off → apply_lien_receipt_off', () => {
  it('a plan writes nothing, answers each filing on its own and stands without the file facts', async () => {
    const out = await call('plan_lien_receipt_off', { receipts: [both(), { job_id: JOB_B, copies: ['owner'], because: BECAUSE }, { job_id: JOB }] })
    expect(out.isError).toBe(false)
    expect(out.body!.receipts).toBe('3 filings: 1 ready, 2 refused.')
    const [ready, bare, shape] = out.body!.entries as Row[]
    expect(ready).toMatchObject({ entry: 1, status: 'ready', says: 'JP2291: the receipt comes off the owner’s copy and the original contractor’s copy.', writes: { filing: FILING, sends: [] } })
    expect(String(ready!.plan_hash)).toMatch(/^[0-9a-f]{64}$/)
    expect(ready!.files_on_record).toMatchObject({ files: [{ copy: 'owner', unread: 'Drive is not set up on this project, so the file was not read.' }, { copy: 'original_contractor', unread: 'Drive is not set up on this project, so the file was not read.' }], saved_copy: { unread: 'Not a Drive file link, so no file was read.' }, reading: [] })
    expect(bare).toMatchObject({ entry: 2, status: 'refused' })
    expect(String(bare!.why)).toContain('JP2304: the owner’s copy carries no receipt on the filing')
    expect(shape).toMatchObject({ entry: 3, status: 'refused' })
    expect(world.writes).toEqual([])
    expect(world.drive).toEqual([])
  })

  it('an apply writes the sends alone, reads back, then sends each file to the trash', async () => {
    const entry = await planned(both())
    const out = await call('apply_lien_receipt_off', { receipt: both(), plan_hash: entry.plan_hash })
    expect(out.isError).toBe(false)
    expect(world.writes).toEqual([{ method: 'PATCH', table: 'job_lien_filings', query: TARGET, body: { sends: [] } }])
    expect(sendsOf(FILING)).toEqual([])
    expect(world.tables.job_lien_filings!.find((r) => r.id === FILING)).toMatchObject({ served_at: null, recording_number: 'ZZ-0001', document_url: 'https://example.test/stamped.pdf' })
    expect(world.drive).toEqual([
      { action: 'trash', job: { jobs_ledger_id: JOB }, driveFileId: OWNER_FILE },
      { action: 'trash', job: { jobs_ledger_id: JOB }, driveFileId: GC_FILE },
    ])
    expect(out.body).toMatchObject({
      ok: true,
      filing_id: FILING,
      took_off: [{ copy: 'owner', receipt_was: OWNER_URL, file: 'in Drive’s trash, where Drive keeps it 30 days' }, { copy: 'original_contractor', receipt_was: GC_URL, file: 'in Drive’s trash, where Drive keeps it 30 days' }],
      served_on: null,
      proof: [],
    })
    // The same plan cannot land twice: by then the copies carry no receipt, and the dry run says so.
    const again = await call('apply_lien_receipt_off', { receipt: both(), plan_hash: entry.plan_hash })
    expect(again.isError).toBe(true)
    expect(again.text).toContain('carry no receipt on the filing')
    expect(world.writes).toHaveLength(1)
    expect(world.drive).toHaveLength(2)
  })

  it('one copy taken off leaves the other copy’s send, and its file, alone', async () => {
    const receipt = { job_id: JOB, copies: ['owner'], because: BECAUSE }
    const entry = await planned(receipt)
    const out = await call('apply_lien_receipt_off', { receipt, plan_hash: entry.plan_hash })
    expect(out.isError).toBe(false)
    expect(sendsOf(FILING)).toEqual([wrong()[1]])
    expect(world.drive).toEqual([{ action: 'trash', job: { jobs_ledger_id: JOB }, driveFileId: OWNER_FILE }])
    expect(out.body!.proof).toEqual([{ copy: 'original_contractor', tracking: null, receipt: GC_URL }])
  })

  it('on a lien recorded as mailed, keeps the day, the numbers and each send, and is held to that day', async () => {
    const sends = wrong().map((s) => ({ ...s, tracking: `${String(s.recipient)}-1`, sent_on: '2026-11-18' }))
    Object.assign(world.tables.job_lien_filings![0]!, { served_at: '2026-11-18', sends })
    const entry = await planned(both())
    expect(String(entry.leaves_no_receipt)).toContain('recorded as mailed on 2026-11-18')
    const out = await call('apply_lien_receipt_off', { receipt: both(), plan_hash: entry.plan_hash })
    expect(out.isError).toBe(false)
    expect(world.writes[0]!.query).toBe(`id=eq.${FILING}&kind=eq.affidavit&voided_at=is.null&served_at=eq.2026-11-18&select=id`)
    expect(world.writes[0]!.body).toEqual({ sends: [{ recipient: 'owner', method: 'certified_mail', tracking: 'owner-1', sent_on: '2026-11-18' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: 'original_contractor-1', sent_on: '2026-11-18' }] })
    expect(world.tables.job_lien_filings![0]).toMatchObject({ served_at: '2026-11-18' })
    expect(out.body).toMatchObject({ ok: true, served_on: '2026-11-18', proof: [{ copy: 'owner', tracking: 'owner-1', receipt: null }, { copy: 'original_contractor', tracking: 'original_contractor-1', receipt: null }] })
  })

  it('a filing that changed since the plan stops the apply before anything is written', async () => {
    const entry = await planned(both())
    Object.assign(world.tables.job_lien_filings![0]!, { served_at: '2026-11-19', sends: wrong().map((s) => ({ ...s, sent_on: '2026-11-19' })) })
    const out = await call('apply_lien_receipt_off', { receipt: both(), plan_hash: entry.plan_hash })
    expect(out.isError).toBe(true)
    expect(out.text).toContain('plan')
    expect(world.writes).toEqual([])
    expect(world.drive).toEqual([])
  })

  it('a write the database refuses moves no file', async () => {
    const entry = await planned(both())
    world.refuseWrite = true
    const out = await call('apply_lien_receipt_off', { receipt: both(), plan_hash: entry.plan_hash })
    expect(out.isError).toBe(true)
    expect(out.text).toContain('JP2291: the receipt was not taken off, and nothing was written')
    expect(sendsOf(FILING)).toEqual(wrong())
    expect(world.drive).toEqual([])
  })

  it('a file the door leaves is named with its reason, and the receipt is still off the filing', async () => {
    world.refuseTrash[GC_FILE] = 'That file is not in the job’s Sent by us folder, so the app leaves it alone.'
    const entry = await planned(both())
    const out = await call('apply_lien_receipt_off', { receipt: both(), plan_hash: entry.plan_hash })
    expect(out.isError).toBe(false)
    expect(sendsOf(FILING)).toEqual([])
    expect(out.body!.took_off).toEqual([
      { copy: 'owner', receipt_was: OWNER_URL, file: 'in Drive’s trash, where Drive keeps it 30 days' },
      { copy: 'original_contractor', receipt_was: GC_URL, file: 'left where it is: That file is not in the job’s Sent by us folder, so the app leaves it alone.' },
    ])
    expect(String(out.body!.files_left)).toContain('trashed in Drive by hand')
  })

  it('one file on both copies: taking one off leaves the file, which the other copy still names', async () => {
    Object.assign(world.tables.job_lien_filings![0]!, { sends: wrong().map((s) => ({ ...s, receipt_url: OWNER_URL })) })
    const receipt = { job_id: JOB, copies: ['owner'], because: BECAUSE }
    const entry = await planned(receipt)
    const out = await call('apply_lien_receipt_off', { receipt, plan_hash: entry.plan_hash })
    expect(out.isError).toBe(false)
    expect(out.body!.took_off).toEqual([{ copy: 'owner', receipt_was: OWNER_URL, file: 'left where it is: A lien record still uses it.' }])
    // Both taken off in one call: the door is asked once for the one file.
    Object.assign(world.tables.job_lien_filings![0]!, { sends: wrong().map((s) => ({ ...s, receipt_url: OWNER_URL })) })
    world.drive = []
    const second = await planned(both())
    const done = await call('apply_lien_receipt_off', { receipt: both(), plan_hash: second.plan_hash })
    expect(done.isError).toBe(false)
    expect(world.drive).toEqual([{ action: 'trash', job: { jobs_ledger_id: JOB }, driveFileId: OWNER_FILE }])
    expect((done.body!.took_off as Row[]).map((t) => t.file)).toEqual(['in Drive’s trash, where Drive keeps it 30 days', 'in Drive’s trash, where Drive keeps it 30 days'])
  })

  it('writes only as the dev: view_as refuses the pair', async () => {
    const out = await call('view_as', { verb: 'apply_lien_receipt_off', role: 'assistant', args: { receipt: both(), plan_hash: 'a'.repeat(64) } })
    expect(out.isError).toBe(true)
    expect(world.writes).toEqual([])
  })
})
