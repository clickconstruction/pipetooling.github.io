/**
 * mail-send-docsmit's own handler, run here (the Docsmit train, PR 3): the function's index.ts
 * with its two URL imports stood in for, a recording fake database, a fake Docsmit and a fake
 * bucket behind one `fetch`. Nothing reaches a network. Each case proves what the run window
 * will lean on: ping, prepare (CASS, the row, the message, the upload, the price), send with a
 * credit shortfall stopping the batch, and refresh writing the number into the filing.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDb, FakeDocsmit, FakeStorage, routeFetch } from './mailRunFakes'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null } = { handler: null }
const db = new FakeDb()
const docsmit = new FakeDocsmit()
const storage = new FakeStorage()
const auth = { user: { id: 'u-taunya' } as { id: string } | null }

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: auth.user }, error: auth.user ? null : { message: 'no' } }) },
    from: (name: string) => db.from(name),
  }),
}))

const ENV: Record<string, string> = {
  SUPABASE_URL: 'http://127.0.0.1:9',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  DOCSMIT_EMAIL: 'bids@example.test',
  DOCSMIT_PASSWORD_SHA512: 'ABCDEF',
  DOCSMIT_SOFTWARE_ID: 'soft-1',
}
const FUNCTION_FILE = '../../../supabase/functions/mail-send-docsmit/index.ts'
const realFetch = globalThis.fetch

beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  globalThis.fetch = routeFetch(docsmit, storage)
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
afterAll(() => {
  globalThis.fetch = realFetch
})
beforeEach(() => {
  db.tables = { users: [{ id: 'u-taunya', role: 'assistant', read_only: false }], app_settings: [], mail_pieces: [], job_lien_filings: [] }
  db.writes = []
  db.nextId = 1
  docsmit.calls = []
  docsmit.answers = {}
  docsmit.tokenCount = 0
  storage.files = {}
  auth.user = { id: 'u-taunya' }
})

function post(body: unknown, bearer = 'Bearer jwt'): Promise<Response> {
  return box.handler!(new Request('http://fn/mail-send-docsmit', { method: 'POST', headers: { Authorization: bearer, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
}

const piece = { kind: 'lien_notice_53_056', source_ids: ['f1'], job_id: 'j650', recipient: 'owner', name: '', organization: 'ATI Schertz Holdings LLC', address1: '17300 IH 35 N', address2: '', city: 'Schertz', state: 'TX', postal_code: '78154', send_type: 'Certified, Electronic Return Receipt', envelope: '#10', sheets: 4 }

describe('mail-send-docsmit (the Docsmit train, PR 3)', () => {
  it('refuses without a signed-in office user, and says when Docsmit is not set up', async () => {
    auth.user = null
    expect((await post({ action: 'ping' })).status).toBe(401)
    auth.user = { id: 'u-taunya' }
    db.tables.users = [{ id: 'u-taunya', role: 'technician', read_only: false }]
    expect((await post({ action: 'ping' })).status).toBe(403)
    db.tables.users = [{ id: 'u-taunya', role: 'assistant', read_only: true }]
    expect((await post({ action: 'ping' })).status).toBe(403)
    db.tables.users = [{ id: 'u-taunya', role: 'dev', read_only: false }]
    const saved = ENV.DOCSMIT_SOFTWARE_ID ?? ''
    delete ENV.DOCSMIT_SOFTWARE_ID
    const res = await post({ action: 'ping' })
    ENV.DOCSMIT_SOFTWARE_ID = saved
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/DOCSMIT_SOFTWARE_ID/)
  })

  it('ping: one token, the account read, nothing secret back, and which Docsmit', async () => {
    docsmit.answers['GET /account/info'] = { body: { firstName: 'Click', lastName: 'Plumbing', creditBalance: 42.5 } }
    const res = await post({ action: 'ping' })
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(await res.json()).toEqual({ ok: true, env: 'tracksmit', account: { name: 'Click Plumbing', credit_balance: 42.5 } })
    expect(docsmit.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /token', 'GET /account/info'])
    expect(docsmit.calls[0]!.body).toEqual({ email: 'bids@example.test', password: 'abcdef', softwareID: 'soft-1' })
  })

  it('paused in Developer settings: everything but ping answers 409', async () => {
    db.tables.app_settings = [{ key: 'docsmit_paused', value_text: 'true' }]
    docsmit.answers['GET /account/info'] = { body: { creditBalance: 1 } }
    expect((await post({ action: 'ping' })).status).toBe(200)
    const res = await post({ action: 'prepare', piece, pdf_path: 'mail/x.pdf' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/paused/)
  })

  it('prepare: the address through CASS, the row as prepared, the message, the upload, the price, the balance', async () => {
    storage.files['lien-release-documents/mail/env-1.pdf'] = new TextEncoder().encode('%PDF-1.4 fake')
    docsmit.answers['POST /utils/multiCASS'] = { body: [{ nonMailable: false, coarseCorrectionMsg: 'ZIP+4: 78154-2011' }] }
    docsmit.answers['POST /messages/new'] = { body: { messageID: 'm-77' } }
    docsmit.answers['POST /messages/m-77/upload'] = { body: { ok: true } }
    docsmit.answers['GET /messages/m-77/priceCheck'] = { body: { netPrice: 9.85, details: { total: '$ 9.85' } } }
    docsmit.answers['GET /account/info'] = { body: { creditBalance: 120 } }
    const res = await post({ action: 'prepare', piece, pdf_path: 'mail/env-1.pdf', job_number: '650' })
    expect(res.status).toBe(200)
    const out = await res.json()
    expect(out).toMatchObject({ ok: true, piece_id: 'id-1', provider_message_id: 'm-77', price: 9.85, correction: 'ZIP+4: 78154-2011', credit_balance: 120, env: 'tracksmit' })
    const row = db.tables.mail_pieces![0]!
    expect(row).toMatchObject({ kind: 'lien_notice_53_056', provider: 'docsmit', status: 'prepared', recipient: 'owner', organization: 'ATI Schertz Holdings LLC', pdf_bucket: 'lien-release-documents', pdf_path: 'mail/env-1.pdf', created_by: 'u-taunya', provider_message_id: 'm-77', client_msg_id: 'lien_notice_53_056:id-1', price: 9.85 })
    expect((row.events as Array<{ kind: string }>).map((e) => e.kind)).toEqual(['prepared', 'message_made'])
    const made = docsmit.calls.find((c) => c.path === '/messages/new')!.body as Record<string, unknown>
    // billTo = the job number (6b, the cost line), so Docsmit's own invoices group by job.
    expect(made).toMatchObject({ title: 'Job 650 · lien notice 53 056 · owner · ATI Schertz Holdings LLC · id-1', clientMsgID: 'lien_notice_53_056:id-1', billTo: '650' })
    expect((made.physicalParties as unknown[])[0]).toMatchObject({ organization: 'ATI Schertz Holdings LLC', postalCode: '78154', sendType: 'Certified, Electronic Return Receipt', envelope: '#10' })
    expect(docsmit.calls.find((c) => c.path === '/messages/m-77/upload')!.body).toEqual({ file: 'id-1.pdf' })
  })

  it('prepare: a priceCheck that answers 400, or fails outright, leaves the piece prepared with no price (the send’s 402 is the real word on credit)', async () => {
    storage.files['lien-release-documents/mail/env-1.pdf'] = new TextEncoder().encode('%PDF')
    docsmit.answers['POST /utils/multiCASS'] = { body: [{ nonMailable: false }] }
    docsmit.answers['POST /messages/new'] = { body: { messageID: 'm-78' } }
    docsmit.answers['POST /messages/m-78/upload'] = { body: { ok: true } }
    docsmit.answers['GET /messages/m-78/priceCheck'] = { status: 400, body: { message: 'Invalid MessageID,certify,months,sendType parameters.' } }
    docsmit.answers['GET /account/info'] = { body: { creditBalance: 50 } }
    const res = await post({ action: 'prepare', piece, pdf_path: 'mail/env-1.pdf' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, piece_id: 'id-1', price: null, credit_balance: 50 })
    expect(db.tables.mail_pieces![0]).toMatchObject({ status: 'prepared', provider_message_id: 'm-78', price: null })
    const q = docsmit.calls.find((c) => c.path === '/messages/m-78/priceCheck')
    expect(q).toBeTruthy()
    docsmit.answers['GET /messages/m-78/priceCheck'] = { status: 500, body: { message: 'boom' } }
    db.tables.mail_pieces = []
    const again = await post({ action: 'prepare', piece, pdf_path: 'mail/env-1.pdf' })
    expect(again.status).toBe(200)
    expect(db.tables.mail_pieces![0]!.status).toBe('prepared')
  })

  it('prepare: an address CASS calls non-mailable is held with the correction, and no row is made', async () => {
    storage.files['lien-release-documents/mail/env-1.pdf'] = new TextEncoder().encode('%PDF')
    docsmit.answers['POST /utils/multiCASS'] = { body: [{ nonMailable: true, coarseCorrectionMsg: 'No such street number' }] }
    const res = await post({ action: 'prepare', piece, pdf_path: 'mail/env-1.pdf' })
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ non_mailable: true, correction: 'No such street number' })
    expect(db.tables.mail_pieces).toEqual([])
  })

  it('prepare: a missing PDF or a short envelope is refused before any Docsmit call', async () => {
    const missing = await post({ action: 'prepare', piece, pdf_path: 'mail/nope.pdf' })
    expect(missing.status).toBe(400)
    expect((await missing.json()).error).toMatch(/not in the bucket/)
    const short = await post({ action: 'prepare', piece: { ...piece, state: 'Texas', sheets: 0 }, pdf_path: 'mail/x.pdf' })
    expect(short.status).toBe(400)
    expect((await short.json()).error).toMatch(/a two-letter state, a sheet count/)
    expect(docsmit.calls).toEqual([])
  })

  it('prepare: Docsmit failing after the row exists marks the piece failed with the reason', async () => {
    storage.files['lien-release-documents/mail/env-1.pdf'] = new TextEncoder().encode('%PDF')
    docsmit.answers['POST /utils/multiCASS'] = { body: [{ nonMailable: false }] }
    docsmit.answers['POST /messages/new'] = { status: 500, body: { message: 'boom' } }
    const res = await post({ action: 'prepare', piece, pdf_path: 'mail/env-1.pdf' })
    expect(res.status).toBe(502)
    expect(db.tables.mail_pieces![0]).toMatchObject({ status: 'failed', problem: expect.stringMatching(/messages\/new answered 500: boom/) })
  })

  it('send: one at a time in order; a 402 stops the batch with the shortfall; a sent piece reads /parties once and marks the filing', async () => {
    const base = { kind: 'lien_notice_53_056', source_ids: ['f1'], provider: 'docsmit', status: 'prepared', events: [], usps_tracking: null, mailed_at: null, delivered_at: null, signed_by: null, delivery_status: null, delivery_as_of: null, pdf_bucket: 'lien-release-documents', certification_path: null }
    db.tables.mail_pieces = [
      { ...base, id: 'p1', recipient: 'owner', provider_message_id: 'm-1' },
      { ...base, id: 'p2', recipient: 'original_contractor', provider_message_id: 'm-2' },
      { ...base, id: 'p3', recipient: 'owner', provider_message_id: 'm-3' },
    ]
    db.tables.job_lien_filings = [{ id: 'f1', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-10-13' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '', sent_on: '2026-10-13' }] }]
    docsmit.answers['POST /messages/m-1/send'] = { status: 201, body: {} }
    docsmit.answers['GET /messages/m-1/parties'] = { body: { physicalParties: [{ USPSTrackingID: '9407 1118 9876 5432 1098', DeliveryStatus: '', DStatusao: null }] } }
    docsmit.answers['POST /messages/m-2/send'] = { status: 402, body: { shortfall: 7.25 } }
    const res = await post({ action: 'send', piece_ids: ['p1', 'p2', 'p3'] })
    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({ ok: false, sent: ['p1'], stopped_at: 'p2', shortfall: 7.25, error: 'Docsmit credit is short by $7.25, nothing more was sent.' })
    expect(db.tables.mail_pieces![0]).toMatchObject({ status: 'mailed', usps_tracking: '9407 1118 9876 5432 1098' })
    expect(db.tables.mail_pieces![1]!.status).toBe('prepared')
    expect(db.tables.mail_pieces![2]!.status).toBe('prepared')
    expect(docsmit.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /token', 'POST /messages/m-1/send', 'GET /messages/m-1/parties', 'POST /messages/m-2/send'])
    const sends = db.tables.job_lien_filings![0]!.sends as Array<Record<string, unknown>>
    expect(sends[0]).toMatchObject({ recipient: 'owner', tracking: '9407 1118 9876 5432 1098', via: 'docsmit', piece_id: 'p1' })
    expect(sends[1]).toEqual({ recipient: 'original_contractor', method: 'certified_mail', tracking: '', sent_on: '2026-10-13' })
  })

  it('refresh: every open Docsmit piece reads /parties; delivered files the Certification PDF beside the mailed copy', async () => {
    db.tables.mail_pieces = [
      { id: 'p1', kind: 'lien_notice_53_056', source_ids: ['f1'], provider: 'docsmit', recipient: 'owner', status: 'in_transit', provider_message_id: 'm-1', events: [{ at: 'x', kind: 'sent' }], usps_tracking: '9407', mailed_at: '2026-10-13T14:10:00Z', delivered_at: null, signed_by: null, delivery_status: 'In Transit', delivery_as_of: '2026-10-14T01:00:00Z', pdf_bucket: 'lien-release-documents', certification_path: null },
      { id: 'p9', kind: 'lien_notice_53_056', source_ids: [], provider: 'docsmit', recipient: 'owner', status: 'delivered', provider_message_id: 'm-9', events: [], usps_tracking: '9', mailed_at: 'x', delivered_at: 'y', signed_by: null, delivery_status: null, delivery_as_of: null, pdf_bucket: 'lien-release-documents', certification_path: 'mail/p9/certification.pdf' },
    ]
    db.tables.job_lien_filings = [{ id: 'f1', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407', sent_on: '2026-10-13', via: 'docsmit', piece_id: 'p1' }] }]
    docsmit.answers['GET /messages/m-1/parties'] = { body: [{ USPSTrackingID: '9407', DeliveryStatus: 'Delivered, Left with Individual', DStatusao: '2026-10-16T17:02:00Z', signedFor: 'R SMITH' }] }
    docsmit.answers['GET /messages/m-1/documentation'] = { raw: new TextEncoder().encode('%PDF cert') }
    const res = await post({ action: 'refresh' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, read: 1, updated: ['p1'], errors: [] })
    expect(db.tables.mail_pieces![0]).toMatchObject({ status: 'delivered', delivered_at: '2026-10-16T17:02:00Z', signed_by: 'R SMITH', certification_path: 'mail/p1/certification.pdf' })
    expect(Object.keys(storage.files)).toEqual(['lien-release-documents/mail/p1/certification.pdf'])
    expect(docsmit.calls.filter((c) => c.path.includes('m-9'))).toEqual([])
  })
})
