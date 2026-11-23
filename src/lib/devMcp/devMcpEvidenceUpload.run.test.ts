/**
 * dev-mcp's own handler, run here for a file declared on plan_person_evidence (0.130.0): the function's index.ts with
 * its URL imports stood in for, and one `fetch` behind which sit a recording fake of the database's evidence function,
 * the private bucket and the Drive filer. Nothing reaches a network. Each case proves what filing a large file leans
 * on: a plan stores nothing and answers where each declared file goes; the apply writes the record only when every
 * declared file is in the bucket and is the planned file; a file that is not is taken out; and a counsel-only record
 * never asks Drive.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (req: Request) => Promise<Response>
type Row = Record<string, unknown>
const box: { handler: Handler | null } = { handler: null }

const DEV = 'ffffffff-2222-4222-8222-222222222222'
const PERSON = '11111111-2222-4222-8222-222222222222'
const BASE = 'http://127.0.0.1:9'
const SIGN = '/storage/v1/object/upload/sign/hr-files/'
const READ = '/storage/v1/object/authenticated/hr-files/'
const PLAIN = '/storage/v1/object/hr-files/'

const enc = new TextEncoder()
const RECORDING = enc.encode('ZZ test recording, the planned bytes')
const OTHER_SAME_SIZE = enc.encode('ZZ test recording, some other bytes!')
const PHOTO = enc.encode('a small photo')

async function sha(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
}
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))

const world = {
  objects: new Map<string, Uint8Array>(),
  records: [] as Row[],
  rpc: [] as Array<{ dry: boolean; body: Row }>,
  signed: [] as string[],
  removed: [] as string[],
  drive: [] as Row[],
  log: [] as Row[],
  refuseSign: false,
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input))
  const method = (init?.method ?? 'GET').toUpperCase()
  const path = decodeURIComponent(url.pathname)
  if (path === '/rest/v1/rpc/dev_person_evidence_write' && method === 'POST') {
    const body = JSON.parse(String(init?.body)) as { p: Row; p_dry_run: boolean; p_files?: { evidence_id: string; files: Row[] } }
    world.rpc.push({ dry: body.p_dry_run, body: body as unknown as Row })
    const after = { title: body.p.title, files: body.p.files, counsel_only: body.p.counsel_only === true }
    if (body.p_dry_run) return json({ ok: true, dry_run: true, person_id: PERSON, person_name: 'ZZ Test Person', evidence_on_person: world.records.length, after })
    // The database's own fence, as the function keeps it: every staged file must be in the bucket under the record's folder.
    for (const f of body.p_files?.files ?? []) {
      const stored = typeof f.storage_path === 'string' ? f.storage_path : null
      if (stored && !world.objects.has(stored)) return json({ message: `dev_person_evidence_write: ${stored} is not in the hr-files bucket` }, 400)
    }
    world.records.push({ id: body.p_files!.evidence_id, ...body.p, stored: body.p_files!.files })
    return json({ ok: true, evidence_id: body.p_files!.evidence_id, person_id: PERSON, files: body.p_files!.files })
  }
  if (path === '/rest/v1/rpc/person_file_next_exhibit_no') return json(7)
  if (path === '/rest/v1/person_file_evidence') return json([{ id: 'x', exhibit_no: 7 }])
  if (path.startsWith(SIGN) && method === 'POST') {
    const object = path.slice(SIGN.length)
    if (world.refuseSign) return json({ statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }, 400)
    if (world.objects.has(object)) return json({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }, 400)
    world.signed.push(object)
    return json({ url: `/object/upload/sign/hr-files/${object.split('/').map(encodeURIComponent).join('/')}?token=ticket-${world.signed.length}` })
  }
  if (path.startsWith(READ) && method === 'GET') {
    const bytes = world.objects.get(path.slice(READ.length))
    if (!bytes) return json({ statusCode: '404', error: 'not_found', message: 'Object not found' }, 400)
    return new Response(bytes, { status: 200, headers: { 'Content-Length': String(bytes.length) } })
  }
  if (path.startsWith(PLAIN) && method === 'POST') {
    world.objects.set(path.slice(PLAIN.length), new Uint8Array(init!.body as Uint8Array))
    return json({ Key: path })
  }
  if (path.startsWith(PLAIN) && method === 'DELETE') {
    const object = path.slice(PLAIN.length)
    world.objects.delete(object)
    world.removed.push(object)
    return json({ message: 'Successfully deleted' })
  }
  if (path === '/functions/v1/hr-evidence-drive') {
    world.drive.push(JSON.parse(String(init?.body)) as Row)
    return json({ filed: 1, remaining: 0, fail_why: null, folder_url: 'https://drive.google.com/drive/folders/zz-test' })
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

beforeEach(() => {
  world.objects = new Map()
  world.records = []
  world.rpc = []
  world.signed = []
  world.removed = []
  world.drive = []
  world.log = []
  world.refuseSign = false
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

const declared = async (over: Row = {}): Promise<Row> => ({ name: 'site walk.m4a', staged: true, size_bytes: RECORDING.length, sha256: await sha(RECORDING), ...over })
const evidenceOf = (files: Row[], over: Row = {}): Row => ({ person_id: PERSON, dated_on: '2026-11-02', title: 'ZZ test recording of a site walk', memo: 'A test file, to prove the upload.', files, ...over })
type Slot = { name: string; path: string; state: string; send_to?: string; run?: string }
const slotsOf = (body: Row | null) => ((body?.upload as { files: Slot[] } | undefined)?.files ?? []) as Slot[]

describe('plan_person_evidence with a declared file', () => {
  it('stores nothing and answers the address the file goes to', async () => {
    const evidence = evidenceOf([await declared()])
    const plan = await call('plan_person_evidence', { evidence })
    expect(plan.isError).toBe(false)
    expect(plan.body!.plan_hash).toMatch(/^[0-9a-f]{64}$/)
    const [slot] = slotsOf(plan.body)
    expect(slot).toMatchObject({ name: 'site walk.m4a', state: 'waiting for its bytes' })
    expect(slot!.path).toMatch(new RegExp(`^${PERSON}/evidence/[0-9a-f-]{36}/[0-9a-f-]{36}-site walk\\.m4a$`))
    expect(slot!.send_to).toBe(`${BASE}/storage/v1/object/upload/sign/hr-files/${slot!.path.split('/').map(encodeURIComponent).join('/')}?token=ticket-1`)
    expect(slot!.run).toContain("-H 'Content-Type: audio/mp4' -T 'site walk.m4a'")
    // The database heard a dry run and nothing else; the bucket holds nothing; Drive was not asked.
    expect(world.rpc.map((c) => c.dry)).toEqual([true])
    expect((world.rpc[0]!.body.p as { files: Row[] }).files).toEqual([{ name: 'site walk.m4a', mime: 'audio/mp4', size_bytes: RECORDING.length, sha256: await sha(RECORDING) }])
    expect(world.objects.size).toBe(0)
    expect(world.records).toEqual([])
    expect(world.drive).toEqual([])
  })

  it('answers the same path for the same plan, and a fresh address', async () => {
    const evidence = evidenceOf([await declared()])
    const a = await call('plan_person_evidence', { evidence })
    const b = await call('plan_person_evidence', { evidence })
    expect(b.body!.plan_hash).toBe(a.body!.plan_hash)
    expect(slotsOf(b.body)[0]!.path).toBe(slotsOf(a.body)[0]!.path)
    expect(slotsOf(b.body)[0]!.send_to).not.toBe(slotsOf(a.body)[0]!.send_to)
  })

  it('says a file already sent is in place, and hands out no second address', async () => {
    const evidence = evidenceOf([await declared()])
    const first = await call('plan_person_evidence', { evidence })
    world.objects.set(slotsOf(first.body)[0]!.path, RECORDING)
    const again = await call('plan_person_evidence', { evidence })
    expect(slotsOf(again.body)[0]).toMatchObject({ state: 'already in place' })
    expect(slotsOf(again.body)[0]).not.toHaveProperty('send_to')
    expect(world.signed).toHaveLength(1)
  })

  it('says why when storage will give no address', async () => {
    world.refuseSign = true
    const plan = await call('plan_person_evidence', { evidence: evidenceOf([await declared()]) })
    expect(plan.isError).toBe(false)
    expect(slotsOf(plan.body)[0]!.state).toBe('no address')
    expect(String((plan.body!.upload as { how: string }).how)).toMatch(/No upload address could be made/)
  })

  it('refuses a declared file that is also sent, has no size, or is over the cap', async () => {
    const both = await call('plan_person_evidence', { evidence: evidenceOf([await declared({ content_base64: b64(PHOTO) })]) })
    expect(both.isError).toBe(true)
    expect(both.text).toMatch(/not both/)
    const noSize = await call('plan_person_evidence', { evidence: evidenceOf([{ name: 'a.m4a', staged: true, sha256: await sha(RECORDING) }]) })
    expect(noSize.text).toMatch(/size_bytes/)
    const over = await call('plan_person_evidence', { evidence: evidenceOf([await declared({ size_bytes: 50 * 1024 * 1024 + 1 })]) })
    expect(over.text).toMatch(/at most 50 MB/)
    expect(world.rpc).toEqual([])
    expect(world.signed).toEqual([])
  })
})

describe('apply_person_evidence with a declared file', () => {
  const planned = async (evidence: Row) => {
    const plan = await call('plan_person_evidence', { evidence })
    return { plan_hash: String(plan.body!.plan_hash), slots: slotsOf(plan.body) }
  }

  it('writes the record once the planned file is in the bucket, at the plan\'s own path', async () => {
    const evidence = evidenceOf([await declared()])
    const { plan_hash, slots } = await planned(evidence)
    world.objects.set(slots[0]!.path, RECORDING)
    const out = await call('apply_person_evidence', { evidence, plan_hash })
    expect(out.isError).toBe(false)
    expect(world.records).toHaveLength(1)
    const record = world.records[0]!
    const [, , recordId, fileName] = slots[0]!.path.split('/')
    expect(record.id).toBe(recordId)
    expect(record.stored).toEqual([{ id: fileName!.slice(0, 36), storage_path: slots[0]!.path }])
    expect(out.body).toMatchObject({ evidence_id: recordId, exhibit_no: 7 })
    expect(world.drive).toEqual([{ evidence_id: recordId }])
    expect(world.removed).toEqual([])
    expect(world.objects.has(slots[0]!.path)).toBe(true)
  })

  it('refuses before the file is sent, and writes nothing', async () => {
    const evidence = evidenceOf([await declared()])
    const { plan_hash } = await planned(evidence)
    const out = await call('apply_person_evidence', { evidence, plan_hash })
    expect(out.isError).toBe(true)
    expect(out.text).toMatch(/site walk\.m4a is not in the bucket yet.*Nothing was written\./)
    expect(world.records).toEqual([])
    expect(world.rpc.every((c) => c.dry)).toBe(true)
    expect(world.removed).toEqual([])
  })

  it('refuses a file of the right size and the wrong bytes, and takes it out', async () => {
    const evidence = evidenceOf([await declared()])
    const { plan_hash, slots } = await planned(evidence)
    expect(OTHER_SAME_SIZE.length).toBe(RECORDING.length)
    world.objects.set(slots[0]!.path, OTHER_SAME_SIZE)
    const out = await call('apply_person_evidence', { evidence, plan_hash })
    expect(out.isError).toBe(true)
    expect(out.text).toMatch(/It is not the planned file\. It was taken out of the bucket\. Plan again.*Nothing was written\./)
    expect(world.records).toEqual([])
    expect(world.removed).toEqual([slots[0]!.path])
    expect(world.objects.size).toBe(0)
  })

  it('refuses a file of the wrong size the same way', async () => {
    const evidence = evidenceOf([await declared()])
    const { plan_hash, slots } = await planned(evidence)
    world.objects.set(slots[0]!.path, PHOTO)
    const out = await call('apply_person_evidence', { evidence, plan_hash })
    expect(out.isError).toBe(true)
    expect(out.text).toMatch(new RegExp(`is ${PHOTO.length} bytes and the plan says ${RECORDING.length}`))
    expect(world.records).toEqual([])
    expect(world.removed).toEqual([slots[0]!.path])
  })

  it('keeps a counsel-only record out of Drive', async () => {
    const evidence = evidenceOf([await declared()], { counsel_only: true })
    const { plan_hash, slots } = await planned(evidence)
    world.objects.set(slots[0]!.path, RECORDING)
    const out = await call('apply_person_evidence', { evidence, plan_hash })
    expect(out.isError).toBe(false)
    expect(world.records).toHaveLength(1)
    expect(world.records[0]!.counsel_only).toBe(true)
    expect(world.drive).toEqual([])
    expect(out.body!.drive).toMatchObject({ asked: false, counsel_only: true })
  })

  it('takes a sent file back out when a declared one beside it is missing', async () => {
    const evidence = evidenceOf([{ name: 'photo.jpg', content_base64: b64(PHOTO) }, await declared()])
    const { plan_hash, slots } = await planned(evidence)
    expect(slots).toHaveLength(1) // an address for the declared file alone
    const out = await call('apply_person_evidence', { evidence, plan_hash })
    expect(out.isError).toBe(true)
    expect(out.text).toMatch(/is not in the bucket yet/)
    expect(world.records).toEqual([])
    expect(world.objects.size).toBe(0)
    expect(world.removed).toHaveLength(1)
    expect(world.removed[0]).toMatch(/-photo\.jpg$/)
  })

  it('files a sent file and a declared one on one record', async () => {
    const evidence = evidenceOf([{ name: 'photo.jpg', content_base64: b64(PHOTO) }, await declared()])
    const { plan_hash, slots } = await planned(evidence)
    world.objects.set(slots[0]!.path, RECORDING)
    const out = await call('apply_person_evidence', { evidence, plan_hash })
    expect(out.isError).toBe(false)
    const stored = world.records[0]!.stored as Array<{ id: string; storage_path: string }>
    expect(stored).toHaveLength(2)
    expect(stored[0]!.storage_path).toMatch(/-photo\.jpg$/)
    expect(stored[1]!.storage_path).toBe(slots[0]!.path)
    // Both sit under the one record's folder, the one the plan's address named.
    expect(stored[0]!.storage_path.split('/')[2]).toBe(slots[0]!.path.split('/')[2])
  })

  it('still files a record with no declared file as before', async () => {
    const evidence = evidenceOf([{ name: 'photo.jpg', content_base64: b64(PHOTO) }])
    const plan = await call('plan_person_evidence', { evidence })
    expect(plan.body).not.toHaveProperty('upload')
    expect(world.signed).toEqual([])
    const out = await call('apply_person_evidence', { evidence, plan_hash: String(plan.body!.plan_hash) })
    expect(out.isError).toBe(false)
    expect(world.records).toHaveLength(1)
    expect(world.objects.size).toBe(1)
  })
})
