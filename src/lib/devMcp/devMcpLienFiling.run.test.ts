/**
 * dev-mcp's own handler, run here for plan_lien_filing → apply_lien_filing (v2.7511): the function's index.ts with its
 * three URL imports stood in for, and one `fetch` behind which sit a recording fake database, the staging bucket and
 * drive-link's door. Nothing reaches a network. Each case proves what a real batch leans on: a plan of several writes
 * nothing and hands each ready filing its own hash and upload address; an apply files the staged scan, writes the
 * window's row and marks the desk's item; and every way it stops leaves the record as it was.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIEN_AFFIDAVIT_SHORT_FORM_MARK } from '../jobs/lienAffidavitForm'
import { LIEN_CLERK_SCAN_NOTE } from '../jobs/lienScanFile'

type Handler = (req: Request) => Promise<Response>
type Row = Record<string, unknown>
const box: { handler: Handler | null } = { handler: null }

const DEV = 'ffffffff-2222-4222-8222-222222222222'
const JOB = '99999999-2222-4222-8222-222222222222'
const JOB_B = '99999999-3333-4333-8333-333333333333'
const PROPERTY = 'aaaaaaaa-2222-4222-8222-222222222222'
const GC = 'cccccccc-2222-4222-8222-222222222222'
const MASTER = 'eeeeeeee-2222-4222-8222-222222222222'
const ITEM = 'dddddddd-2222-4222-8222-222222222222'
const ITEM_B = 'dddddddd-3333-4333-8333-333333333333'
const BASE = 'http://127.0.0.1:9'
/** The Drive id the fake door gives a file it takes: long enough to read as one. */
const NEW_FILE = '1newNewNewNewNewNewNewNewNew'
const NEW_URL = `https://drive.google.com/file/d/${NEW_FILE}/view`
const OLD_FILE = '1oldOldOldOldOldOldOldOldOld'
const OLD_URL = `https://drive.google.com/file/d/${OLD_FILE}/view`

/** The fake world: the tables the REST door reads and writes, the call log, the bucket and drive-link's calls. */
const world = {
  tables: {} as Record<string, Row[]>,
  windows: [] as Row[],
  writes: [] as Array<{ method: string; table: string; query: string; body: unknown }>,
  log: [] as Row[],
  staged: {} as Record<string, Uint8Array>,
  signed: [] as string[],
  removed: [] as string[],
  drive: [] as Row[],
  refuseInsert: false,
  refuseDrive: false,
  refuseLink: false,
  refuseTrash: false,
  afterInsert: null as (() => void) | null,
  nextId: 1,
}

/** A PostgREST filter, as much of it as the seat sends: eq, neq, is.null, in.(…) and a prefix ilike. */
function matches(row: Row, key: string, expr: string): boolean {
  const v = row[key]
  if (expr === 'is.null') return v === null || v === undefined
  if (expr.startsWith('eq.')) return String(v ?? '') === expr.slice(3)
  if (expr.startsWith('neq.')) return String(v ?? '') !== expr.slice(4)
  if (expr.startsWith('in.(')) return expr.slice(4, -1).split(',').includes(String(v ?? ''))
  if (expr.startsWith('ilike.')) return new RegExp(`^${expr.slice(6).split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 'i').test(String(v ?? ''))
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
  if (path.startsWith('/rest/v1/rpc/list_lien_affidavit_windows')) return json(world.windows)
  if (path.startsWith('/rest/v1/')) {
    const table = path.slice('/rest/v1/'.length)
    if (method === 'GET') return json(filtered(table, query))
    const body = init?.body ? JSON.parse(String(init.body)) : null
    world.writes.push({ method, table, query, body })
    if (method === 'POST') {
      if (world.refuseInsert) return json({ message: 'new row violates row-level security policy' }, 403)
      const row = { id: `new-${world.nextId++}`, voided_at: null, created_at: '2026-11-16T18:00:00Z', document_url: '', ...(body as Row) }
      ;(world.tables[table] ??= []).push(row)
      world.afterInsert?.()
      return json([{ id: row.id }], 201)
    }
    if (method === 'PATCH') {
      if (world.refuseLink && table === 'job_lien_filings') return json({ message: 'permission denied for table job_lien_filings' }, 403)
      const hit = filtered(table, query)
      for (const r of hit) Object.assign(r, body as Row)
      // As PostgREST answers: the rows it changed when asked for them, nothing otherwise.
      return String((init?.headers as Record<string, string> | undefined)?.Prefer ?? '').includes('return=representation') ? json(hit.map((r) => ({ id: r.id }))) : new Response(null, { status: 204 })
    }
  }
  if (path.startsWith('/storage/v1/object/upload/sign/dev-seat-staging/')) {
    const at = path.slice('/storage/v1/object/upload/sign/dev-seat-staging/'.length)
    world.signed.push(at)
    return json({ url: `/object/upload/sign/dev-seat-staging/${at}?token=tok` })
  }
  if (path.startsWith('/storage/v1/object/authenticated/dev-seat-staging/')) {
    const bytes = world.staged[path.slice('/storage/v1/object/authenticated/dev-seat-staging/'.length)]
    return bytes ? new Response(bytes, { status: 200 }) : json({ message: 'Object not found' }, 404)
  }
  if (path.startsWith('/storage/v1/object/dev-seat-staging/') && method === 'DELETE') {
    const at = path.slice('/storage/v1/object/dev-seat-staging/'.length)
    world.removed.push(at)
    delete world.staged[at]
    return json({})
  }
  if (path === '/functions/v1/drive-link') {
    if (world.refuseDrive) return json({ error: 'The folder could not be opened.' }, 502)
    const body = JSON.parse(String(init?.body)) as Row
    if (body.action === 'trash') {
      world.drive.push(body)
      return world.refuseTrash ? json({ error: 'A lien record still uses it.', why: 'in_use', retry: false }, 409) : json({ trashed: true, name: 'old.pdf', url: `https://drive.google.com/file/d/${String(body.driveFileId)}/view` })
    }
    world.drive.push({ ...body, base64: `(${String(body.base64).length} characters)` })
    return json({ driveFileId: NEW_FILE, url: `https://drive.google.com/file/d/${NEW_FILE}/view` })
  }
  throw new Error(`fake fetch: no route for ${method} ${path}`)
}

/** The service-role client: the key, the dev, the session and the call log. */
function adminTable(name: string) {
  const eqs: Array<[string, unknown]> = []
  const chain = {
    select: () => chain,
    eq: (k: string, v: unknown) => (eqs.push([k, v]), chain),
    order: () => chain,
    limit: () => chain,
    update: () => chain,
    insert: async (row: Row) => {
      if (name === 'dev_mcp_calls') world.log.push({ ...row, created_at: '2026-11-16T18:00:00Z' })
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
  vi.setSystemTime(new Date('2026-11-16T18:00:00Z'))
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  globalThis.fetch = fakeFetch as typeof fetch
  await import(/* @vite-ignore */ FUNCTION_FILE)
}, 120_000)
afterAll(() => {
  globalThis.fetch = realFetch
  vi.useRealTimers()
})

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x5a, 0x5a])
async function sha256(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
}
let PDF_SHA = ''

const windowRow = (jobId: string, itemId: string, over: Row = {}): Row => ({
  job_id: jobId, last_month: '2026-09', deadline: '2026-12-15', is_sub: true, noticed: true, filed: false, open_balance: 4180, customer_id: null, gc_customer_id: GC,
  property_kind: 'commercial', has_owner: true, has_legal: true, homestead: false, desk_item_id: itemId, desk_status: 'approved', month_source: 'hand', ...over,
})
const job = (id: string, number: string, name: string, address: string): Row => ({
  id, job_name: name, job_address: address, hcp_number: number, click_number: '', customer_name: 'ZZ Test Builders', customer_address_id: PROPERTY, gc_customer_id: GC, master_user_id: MASTER,
  service_type_id: null, revenue: 9000, payments_made: 4820, first_work_date: '2026-09-02', last_work_date: '2026-09-24', lien_last_work_on: null,
})
const item = (id: string, jobId: string): Row => ({ id, job_id: jobId, kind: 'affidavit', status: 'approved', months: ['2026-09'], fields: { notice: { claimAmount: '4180.00' }, ...LIEN_AFFIDAVIT_SHORT_FORM_MARK }, approved_at: '2026-11-10T15:00:00Z', created_at: '2026-11-09T15:00:00Z', voided_at: null })
const notice = (jobId: string): Row => ({ id: `n-${jobId.slice(9, 13)}`, job_id: jobId, kind: 'notice_53_056', months_covered: ['2026-09'], sends: [{ recipient: 'owner', method: 'certified_mail', sent_on: '2026-10-09' }], filed_at: null, recording_number: '', county: '', document_url: '', serve_due: null, served_at: null, voided_at: null, created_at: '2026-10-09T15:00:00Z' })

beforeEach(async () => {
  PDF_SHA ||= await sha256(PDF)
  world.tables = {
    jobs_ledger: [job(JOB, '2291', 'ZZ Test Maple Court', '14 Maple Ct, Marlow, TX 78000'), job(JOB_B, '2304', 'ZZ Test Birch Lane', '22 Birch Ln, Marlow, TX 78000')],
    job_lien_desk_items: [item(ITEM, JOB), item(ITEM_B, JOB_B)],
    customer_addresses: [{ id: PROPERTY, county: 'Marlow', legal_description: 'LOT 4 BLK 7', property_kind: 'commercial', homestead: false, homestead_answered_at: '2026-11-01T00:00:00Z', owner_name: 'Pat Sample', owner_company: '', owner_mailing_address: '9 Owner Ln, Marlow, TX 78000', owner_mode: 'person' }],
    job_property_owners: [],
    customers: [{ id: GC, name: 'ZZ Test Builders', address: '5 Builder Way, Marlow, TX 78000' }],
    job_lien_claim_corrections: [],
    job_lien_affidavit_months: [],
    job_lien_filings: [notice(JOB), notice(JOB_B)],
    users: [{ id: MASTER, name: 'Sam Sample', notes: 'Sam Sample, Master Plumber' }],
    app_settings: [{ key: 'physical_invoice_issuer_v1', value_text: JSON.stringify({ companyName: 'ZZ Test Plumbing', addressText: '1 Main St\nMarlow, TX 78000', signingCounty: 'Marlow' }) }],
    service_types: [],
  }
  world.windows = [windowRow(JOB, ITEM), windowRow(JOB_B, ITEM_B)]
  world.writes = []
  world.log = []
  world.staged = {}
  world.signed = []
  world.removed = []
  world.drive = []
  world.refuseInsert = false
  world.refuseDrive = false
  world.refuseLink = false
  world.refuseTrash = false
  world.afterInsert = null
  world.nextId = 1
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

const filing = (over: Row = {}): Row => ({
  job_id: JOB,
  county: 'Marlow',
  recording_number: '20269990001',
  filed_on: '2026-11-16',
  scan: { name: 'maple-court.pdf', size_bytes: PDF.length, sha256: PDF_SHA },
  paper_states: { claim: 4180, months: ['2026-09'], notice_sent_on: ['2026-10-09'], property_address: '14 Maple Ct, Marlow, TX 78000', owner: 'Pat Sample' },
  matched_because: 'The paper names 14 Maple Ct and Pat Sample, and swears $4,180.00.',
  ...over,
})
/** The newest row of the call log. */
const lastLog = (): Row | undefined => world.log[world.log.length - 1]
const STAGE = `${DEV}/lien-scans/`
const stagePath = () => `${STAGE}${PDF_SHA.slice(0, 32)}.pdf`

describe('plan_lien_filing — a visit to the clerk', () => {
  it('judges each filing on its own, writes nothing, and signs an upload for the ready one alone', async () => {
    const birch = filing({ job_id: JOB_B, recording_number: '20269990002', scan: { name: 'birch.pdf', size_bytes: 9, sha256: 'd'.repeat(64) }, paper_states: { claim: 2650, months: ['2026-08', '2026-09'] }, matched_because: 'The paper names 22 Birch Ln and swears $2,650.00.' })
    const out = await call('plan_lien_filing', { filings: [filing(), birch, { job_id: 'nope' }] })
    expect(out.isError).toBe(false)
    expect(out.body!.filings).toBe('3 filings: 1 ready, 1 held on differences, 1 refused.')
    const [ready, held, refused] = out.body!.entries as Row[]
    expect(ready).toMatchObject({ entry: 1, status: 'ready', serve_by: '2026-11-23' })
    expect(String(ready!.plan_hash)).toMatch(/^[0-9a-f]{64}$/)
    expect(ready!.upload).toMatchObject({ upload_url: `${BASE}/storage/v1/object/upload/sign/dev-seat-staging/${stagePath()}?token=tok`, upload_expires_in: '2 hours' })
    // A plan of several shows the row without its snapshot.
    expect(String(((ready!.writes as Row).filing as Row).fields)).toContain('the paper as the desk reads it')
    expect(held).toMatchObject({ entry: 2, status: 'held' })
    expect(held).not.toHaveProperty('plan_hash')
    expect(held).not.toHaveProperty('upload')
    expect((held!.differences as Row[]).map((d) => d.what)).toEqual(['claim', 'months'])
    expect(refused).toMatchObject({ entry: 3, status: 'refused' })
    expect(world.writes).toEqual([])
    expect(world.signed).toEqual([stagePath()])
    expect(world.drive).toEqual([])
    expect(lastLog()).toMatchObject({ verb: 'plan_lien_filing', status: 'ok', target: '3 filings', row_count: 1 })
  })

  it('a plan of one reads the whole row back', async () => {
    const out = await call('plan_lien_filing', { filing: filing() })
    const [ready] = out.body!.entries as Row[]
    expect((((ready!.writes as Row).filing as Row).fields as Row).unpaidAmount).toBe('4180.00')
  })

  it('never runs as someone else', async () => {
    const out = await call('view_as', { verb: 'plan_lien_filing', role: 'assistant', args: { filing: filing() } })
    expect(out.isError).toBe(true)
    expect(world.writes).toEqual([])
  })
})

describe('apply_lien_filing — one filing', () => {
  const planned = async (over: Row = {}) => {
    const f = filing(over)
    const out = await call('plan_lien_filing', { filing: f })
    const entry = (out.body!.entries as Row[])[0]!
    return { f, hash: String(entry.plan_hash) }
  }

  it('files the staged scan, writes the window’s row with it, marks the desk’s item and removes the staged copy', async () => {
    const { f, hash } = await planned()
    world.staged[stagePath()] = PDF
    const out = await call('apply_lien_filing', { filing: f, plan_hash: hash })
    expect(out.isError).toBe(false)
    expect(out.body).toMatchObject({ ok: true, filing_id: 'new-1', wrote: 'the filing', serve_by: '2026-11-23', saved_copy: NEW_URL, desk_item: 'marked sent' })
    // drive-link's put, the scan press's own landing and name.
    expect(world.drive).toEqual([{ action: 'put', job: { jobs_ledger_id: JOB }, name: `Lien affidavit, Job 2291, ${LIEN_CLERK_SCAN_NOTE}, 2026-11-16.pdf`, mime: 'application/pdf', where: 'sent', base64: '(16 characters)' }])
    // The row first, then the desk's item, then the scan's link: a Drive door that fails never leaves a file with no filing.
    const [insert, patch, link] = world.writes
    expect(insert).toMatchObject({ method: 'POST', table: 'job_lien_filings' })
    expect(insert!.body).toMatchObject({ job_id: JOB, created_by: DEV, kind: 'affidavit', amount: 4180, county: 'Marlow', recording_number: '20269990001', filed_at: '2026-11-16', serve_due: '2026-11-23' })
    expect(Object.keys(insert!.body as Row).sort()).toEqual(['amount', 'county', 'created_by', 'fields', 'filed_at', 'job_id', 'kind', 'recording_number', 'serve_due'])
    expect(patch).toMatchObject({ method: 'PATCH', table: 'job_lien_desk_items', query: `id=eq.${ITEM}&kind=eq.affidavit&status=eq.approved&select=id`, body: { status: 'sent', sent_filing_id: 'new-1' } })
    expect(link).toEqual({ method: 'PATCH', table: 'job_lien_filings', query: 'id=eq.new-1&document_url=eq.&select=id', body: { document_url: NEW_URL, document_note: LIEN_CLERK_SCAN_NOTE } })
    expect(world.writes).toHaveLength(3)
    expect(world.removed).toEqual([stagePath()])
    expect(world.tables.job_lien_desk_items!.find((i) => i.id === ITEM)).toMatchObject({ status: 'sent', sent_filing_id: 'new-1' })
    expect(lastLog()).toMatchObject({ verb: 'apply_lien_filing', status: 'ok', target: JOB })
    // The log keeps the hash and the clerk's facts, never the long words: one apply per plan reads the hash back.
    expect(lastLog()!.args).toEqual({ filing: { job_id: JOB, county: 'Marlow', recording_number: '20269990001', filed_on: '2026-11-16', scan: f.scan, saved_copy: null, filed_outside_the_desk: false, accept_differences: false }, plan_hash: hash })
  })

  it('cannot land twice: the job now holds its filing, and the other job is untouched', async () => {
    const { f, hash } = await planned()
    world.staged[stagePath()] = PDF
    await call('apply_lien_filing', { filing: f, plan_hash: hash })
    world.staged[stagePath()] = PDF
    const again = await call('apply_lien_filing', { filing: f, plan_hash: hash })
    expect(again.isError).toBe(true)
    expect(again.text).toContain('JP2291: instrument 20269990001 is on record, filed 2026-11-16 in Marlow County')
    expect(again.text).toContain('There is nothing to apply.')
    expect(world.writes).toHaveLength(3)
    expect(world.drive).toHaveLength(1)
    expect(world.tables.job_lien_desk_items!.find((i) => i.id === ITEM_B)).toMatchObject({ status: 'approved' })
  })

  it('stops before any write when nothing is staged, when the bytes are not the plan’s, and when the hash is not this plan’s', async () => {
    const { f, hash } = await planned()
    const nothing = await call('apply_lien_filing', { filing: f, plan_hash: hash })
    expect(nothing.text).toContain('Nothing is staged for this plan: PUT the file to the upload_url plan_lien_filing gave you')
    world.staged[stagePath()] = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x5a, 0x58])
    const other = await call('apply_lien_filing', { filing: f, plan_hash: hash })
    expect(other.text).toContain("is not the plan's")
    const stale = await call('apply_lien_filing', { filing: f, plan_hash: 'b'.repeat(64) })
    expect(stale.isError).toBe(true)
    expect(world.writes).toEqual([])
    expect(world.drive).toEqual([])
    expect(world.removed).toEqual([])
  })

  it('a held filing cannot be applied, whatever hash is sent', async () => {
    const out = await call('apply_lien_filing', { filing: filing({ paper_states: { claim: 4500 } }), plan_hash: 'b'.repeat(64) })
    expect(out.isError).toBe(true)
    expect(out.text).toContain('The paper and the desk differ on claim')
    expect(world.writes).toEqual([])
  })

  it('a row the database refuses answers as an error before the scan is filed, so the plan is not spent', async () => {
    const { f, hash } = await planned()
    world.staged[stagePath()] = PDF
    world.refuseInsert = true
    const out = await call('apply_lien_filing', { filing: f, plan_hash: hash })
    expect(out.isError).toBe(true)
    expect(out.text).toContain('the filing was not recorded, and nothing else was written')
    expect(world.drive).toEqual([])
    expect(world.removed).toEqual([])
    expect(lastLog()).toMatchObject({ verb: 'apply_lien_filing', status: 'error' })
    expect(world.tables.job_lien_desk_items!.find((i) => i.id === ITEM)).toMatchObject({ status: 'approved' })
  })

  it('a Drive door that refuses leaves the filing recorded with no saved copy, and the next plan takes the scan alone', async () => {
    const { f, hash } = await planned()
    world.staged[stagePath()] = PDF
    world.refuseDrive = true
    const out = await call('apply_lien_filing', { filing: f, plan_hash: hash })
    expect(out.isError).toBe(false)
    expect(out.body).toMatchObject({ ok: true, filing_id: 'new-1', saved_copy: null, desk_item: 'marked sent' })
    expect(String(out.body!.saved_copy_not_added)).toContain('did not take the file')
    // The staged copy is kept for the plan that adds it.
    expect(world.removed).toEqual([])
    world.refuseDrive = false
    const again = await call('plan_lien_filing', { filing: f })
    const entry = (again.body!.entries as Row[])[0]!
    expect(entry).toMatchObject({ status: 'ready', mode: 'attach_scan' })
    const added = await call('apply_lien_filing', { filing: f, plan_hash: String(entry.plan_hash) })
    expect(added.body).toMatchObject({ ok: true, filing_id: 'new-1', saved_copy: NEW_URL })
    expect(world.tables.job_lien_filings!.filter((r) => r.kind === 'affidavit')).toHaveLength(1)
  })

  it('a file in Drive whose link did not save is never uploaded twice: the next plan carries its link', async () => {
    const { f, hash } = await planned()
    world.staged[stagePath()] = PDF
    world.refuseLink = true
    const out = await call('apply_lien_filing', { filing: f, plan_hash: hash })
    expect(out.isError).toBe(false)
    expect(out.body).toMatchObject({ ok: true, filing_id: 'new-1', saved_copy: null })
    expect(String(out.body!.saved_copy_not_added)).toContain(`saved_copy: { link: "${NEW_URL}" }`)
    // The file landed, so the staged copy is gone and the same apply is spent.
    expect(world.removed).toEqual([stagePath()])
    world.refuseLink = false
    const spent = await call('apply_lien_filing', { filing: f, plan_hash: hash })
    expect(spent.isError).toBe(true)
    const linkOnly = filing({ scan: undefined, saved_copy: { link: NEW_URL } })
    const again = await call('plan_lien_filing', { filing: linkOnly })
    const entry = (again.body!.entries as Row[])[0]!
    expect(entry).toMatchObject({ status: 'ready', mode: 'attach_link' })
    expect(entry).not.toHaveProperty('upload')
    const added = await call('apply_lien_filing', { filing: linkOnly, plan_hash: String(entry.plan_hash) })
    expect(added.body).toMatchObject({ ok: true, filing_id: 'new-1', wrote: 'the link, as the saved copy of the filing on record', saved_copy: NEW_URL })
    expect(world.drive).toHaveLength(1)
    expect(world.tables.job_lien_filings!.find((r) => r.id === 'new-1')).toMatchObject({ document_note: LIEN_CLERK_SCAN_NOTE })
  })

  it('a desk item that moved on since the plan is named, never reported as marked', async () => {
    const { f, hash } = await planned()
    world.staged[stagePath()] = PDF
    world.afterInsert = () => void (world.tables.job_lien_desk_items!.find((i) => i.id === ITEM)!.status = 'held')
    const out = await call('apply_lien_filing', { filing: f, plan_hash: hash })
    expect(out.body).toMatchObject({ ok: true, filing_id: 'new-1', desk_item: { failed: 'the item was no longer approved when the mark was made' } })
    expect(String(out.body!.desk_item_not_marked)).toContain('was not marked sent')
  })

  it('an affidavit that lands on the job while the scan is being read stops the insert', async () => {
    const { f, hash } = await planned()
    world.staged[stagePath()] = PDF
    // The dry run reads the job's filings whole; the last look before the insert reads the affidavits alone.
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/storage/v1/object/authenticated/')) world.tables.job_lien_filings!.push({ id: 'raced', job_id: JOB, kind: 'affidavit', filed_at: '2026-11-16', recording_number: '555', county: 'Marlow', document_url: '', voided_at: null, created_at: '2026-11-16T18:00:01Z' })
      return fakeFetch(input, init)
    }) as typeof fetch
    const out = await call('apply_lien_filing', { filing: f, plan_hash: hash })
    globalThis.fetch = realFetch
    expect(out.isError).toBe(true)
    expect(out.text).toContain('an affidavit landed on this job since the plan was read (raced)')
    expect(world.writes).toEqual([])
    expect(world.drive).toEqual([])
  })

  it('the same instrument number on another job is refused however it was punctuated', async () => {
    world.tables.job_lien_filings!.push({ id: 'other', job_id: JOB_B, kind: 'affidavit', filed_at: '2026-11-16', recording_number: '2026-9990001', county: 'Marlow', document_url: '', voided_at: null, created_at: '2026-11-16T17:00:00Z' })
    const out = await call('plan_lien_filing', { filing: filing() })
    expect((out.body!.entries as Row[])[0]).toMatchObject({ status: 'refused', why: expect.stringContaining('is already on JP2304') })
  })

  it('a link typed in place of a file rides on the row, with no upload and no Drive call', async () => {
    const { f, hash } = await planned({ scan: undefined, saved_copy: { link: 'https://drive.google.com/file/d/abc/view', note: 'the clerk’s copy' }, filed_on: '2026-11-13' })
    const out = await call('apply_lien_filing', { filing: f, plan_hash: hash })
    expect(out.body).toMatchObject({ ok: true, saved_copy: 'https://drive.google.com/file/d/abc/view', serve_by: '2026-11-18' })
    expect(world.signed).toEqual([])
    expect(world.drive).toEqual([])
    expect(world.writes[0]!.body).toMatchObject({ document_url: 'https://drive.google.com/file/d/abc/view', document_note: 'the clerk’s copy' })
    // A day before today rides onto the desk's item, as the window's sync sets it.
    expect((world.writes[1]!.body as Row).sent_at).toMatch(/^2026-11-13T/)
  })

  it('a filing already on record with no saved copy takes the scan alone', async () => {
    world.tables.job_lien_filings!.push({ id: 'on-file', job_id: JOB, kind: 'affidavit', months_covered: [], sends: [], filed_at: '2026-11-16', recording_number: '2026 9990001', county: 'Marlow', document_url: '', document_note: '', serve_due: '2026-11-23', served_at: null, voided_at: null, created_at: '2026-11-16T17:00:00Z' })
    world.tables.job_lien_desk_items!.find((i) => i.id === ITEM)!.status = 'sent'
    const { f, hash } = await planned()
    world.staged[stagePath()] = PDF
    const out = await call('apply_lien_filing', { filing: f, plan_hash: hash })
    expect(out.body).toMatchObject({ ok: true, filing_id: 'on-file', wrote: 'the scan, as the saved copy of the filing on record' })
    expect(world.writes).toEqual([{ method: 'PATCH', table: 'job_lien_filings', query: 'id=eq.on-file&document_url=eq.&select=id', body: { document_url: NEW_URL, document_note: LIEN_CLERK_SCAN_NOTE } }])
  })
})

describe('a paper already on record (v2.7837)', () => {
  const FIELDS = { isSub: true, workMonthsWords: 'September 2026', noticesSentWords: 'certified mail on October 9, 2026', propertyAddress: '14 Maple Ct, Marlow, TX 78000', legalDescription: 'LOT 4 BLK 7', ownerName: 'Pat Sample', unpaidAmount: '4180.00' }
  const onFile = (over: Row = {}): Row => ({ id: 'on-file', job_id: JOB, kind: 'affidavit', months_covered: [], sends: [], filed_at: '2026-11-16', recording_number: '2026 9990001', county: 'Marlow', document_url: OLD_URL, document_note: LIEN_CLERK_SCAN_NOTE, serve_due: '2026-11-23', served_at: null, voided_at: null, created_at: '2026-11-16T17:00:00Z', amount: 4180, fields: FIELDS, ...over })
  const REPLACE = { replace_saved_copy: true, replace_because: 'The copy on record is the whole stack, not this lien’s two pages.' }
  beforeEach(() => {
    world.tables.job_lien_filings!.push(onFile())
    world.tables.job_lien_desk_items!.find((i) => i.id === ITEM)!.status = 'sent'
  })

  it('a plan checks the paper against the record, signs nothing and writes nothing', async () => {
    const august = filing({ paper_states: { claim: 4180, months: ['2026-08'], notice_sent_on: ['2026-10-09'], property_address: '14 Maple Ct, Marlow, TX 78000', owner: 'Pat Sample' } })
    const birch = filing({ job_id: JOB_B, recording_number: '20269990002', scan: { name: 'birch.pdf', size_bytes: 9, sha256: 'd'.repeat(64) }, paper_states: { claim: 4180, months: ['2026-09'], notice_sent_on: ['2026-10-09'] }, matched_because: 'The paper names 22 Birch Ln and swears $4,180.00.' })
    const out = await call('plan_lien_filing', { filings: [august, birch] })
    expect(out.isError).toBe(false)
    expect(out.body!.filings).toBe('2 filings: 1 ready, 1 already on record (1 whose record and paper differ).')
    const [checked] = out.body!.entries as Row[]
    expect(checked).toMatchObject({ entry: 1, status: 'on_record', mode: 'check', agrees: false, differences: [{ what: 'months', paper: 'August 2026', record: 'September 2026' }] })
    expect(checked).not.toHaveProperty('plan_hash')
    expect(checked).not.toHaveProperty('upload')
    // No Drive key in this world: the saved copy's file is named as not read, and the check stands.
    expect((checked!.saved_copy_file as Row).unread).toContain('Drive is not set up')
    expect(world.writes).toEqual([])
    expect(world.signed).toEqual([`${STAGE}${'d'.repeat(32)}.pdf`])
    expect(world.drive).toEqual([])
  })

  it('an entry on record cannot be applied, whatever hash is sent', async () => {
    const out = await call('apply_lien_filing', { filing: filing(), plan_hash: 'b'.repeat(64) })
    expect(out.isError).toBe(true)
    expect(out.text).toContain('its record says what the paper says. There is nothing to apply.')
    expect(world.writes).toEqual([])
    expect(world.drive).toEqual([])
  })

  it('a replace files the new scan, sets it on the filing that still carries the old copy, and sends the old file to Drive’s trash', async () => {
    const f = filing(REPLACE)
    const plan = await call('plan_lien_filing', { filing: f })
    const entry = (plan.body!.entries as Row[])[0]!
    expect(entry).toMatchObject({ status: 'ready', mode: 'replace_scan', replaces: OLD_URL, agrees: true })
    expect(entry.upload).toMatchObject({ upload_expires_in: '2 hours' })
    world.staged[stagePath()] = PDF
    const out = await call('apply_lien_filing', { filing: f, plan_hash: String(entry.plan_hash) })
    expect(out.isError).toBe(false)
    expect(out.body).toMatchObject({ ok: true, filing_id: 'on-file', wrote: 'the scan, in place of the saved copy the filing carried', saved_copy: NEW_URL, old_copy: { was: OLD_URL, now: 'in Drive’s trash, where Drive keeps it 30 days' } })
    // One write: the link, held to the copy the plan read.
    expect(world.writes).toEqual([{ method: 'PATCH', table: 'job_lien_filings', query: `id=eq.on-file&document_url=eq.${encodeURIComponent(OLD_URL)}&select=id`, body: { document_url: NEW_URL, document_note: LIEN_CLERK_SCAN_NOTE } }])
    // The put first, the trash last: the old file leaves only once the filing names the new one.
    expect(world.drive.map((d) => d.action)).toEqual(['put', 'trash'])
    expect(world.drive[1]).toEqual({ action: 'trash', job: { jobs_ledger_id: JOB }, driveFileId: OLD_FILE })
    expect(world.removed).toEqual([stagePath()])
    expect(lastLog()!.args).toMatchObject({ filing: { replace_saved_copy: true, replace_because: REPLACE.replace_because } })
    expect(world.tables.job_lien_filings!.filter((r) => r.kind === 'affidavit')).toHaveLength(1)
  })

  it('a copy that changed since the plan is left as it is, and the old file is never trashed', async () => {
    const f = filing(REPLACE)
    const plan = await call('plan_lien_filing', { filing: f })
    const hash = String((plan.body!.entries as Row[])[0]!.plan_hash)
    world.staged[stagePath()] = PDF
    // Someone changes the saved copy while the staged scan is being read: the hash matched, the held write does not.
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/storage/v1/object/authenticated/')) world.tables.job_lien_filings!.find((r) => r.id === 'on-file')!.document_url = 'https://drive.google.com/file/d/1otherOtherOtherOtherOther/view'
      return fakeFetch(input, init)
    }) as typeof fetch
    const out = await call('apply_lien_filing', { filing: f, plan_hash: hash })
    globalThis.fetch = real
    expect(out.body).toMatchObject({ ok: true, saved_copy: 'https://drive.google.com/file/d/1otherOtherOtherOtherOther/view' })
    expect(String(out.body!.saved_copy_not_added)).toContain('the filing no longer carried the copy the plan read')
    expect(out.body).not.toHaveProperty('old_copy')
    expect(world.drive.map((d) => d.action)).toEqual(['put'])
  })

  it('a file the trash door leaves is named with the door’s reason, and the replace stands', async () => {
    const f = filing(REPLACE)
    const plan = await call('plan_lien_filing', { filing: f })
    world.staged[stagePath()] = PDF
    world.refuseTrash = true
    const out = await call('apply_lien_filing', { filing: f, plan_hash: String((plan.body!.entries as Row[])[0]!.plan_hash) })
    expect(out.body).toMatchObject({ ok: true, saved_copy: NEW_URL, old_copy: { was: OLD_URL, now: 'left where it is: A lien record still uses it.' } })
  })

  it('a Drive door that refuses the new file changes nothing, and the same apply can be sent again', async () => {
    const f = filing(REPLACE)
    const plan = await call('plan_lien_filing', { filing: f })
    world.staged[stagePath()] = PDF
    world.refuseDrive = true
    const out = await call('apply_lien_filing', { filing: f, plan_hash: String((plan.body!.entries as Row[])[0]!.plan_hash) })
    expect(out.isError).toBe(true)
    expect(out.text).toContain('the scan was not put in place of the saved copy')
    expect(world.writes).toEqual([])
    expect(world.tables.job_lien_filings!.find((r) => r.id === 'on-file')).toMatchObject({ document_url: OLD_URL })
  })
})
