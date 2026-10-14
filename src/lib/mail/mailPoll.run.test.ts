/**
 * mail-poll's own handler, run here (the Docsmit train, PR 3): the cron secret, the paused
 * switch, the hourly read-back through the shared refresh, and a message sent by hand from
 * Docsmit's site becoming a piece of kind `other` when the switch says to look.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDb, FakeDocsmit, FakeStorage, routeFetch } from './mailRunFakes'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null } = { handler: null }
const db = new FakeDb()
const docsmit = new FakeDocsmit()
const storage = new FakeStorage()

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({ createClient: () => ({ from: (name: string) => db.from(name) }) }))

const ENV: Record<string, string> = {
  SUPABASE_URL: 'http://127.0.0.1:9',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  CRON_SECRET: 'cron-1',
  DOCSMIT_EMAIL: 'bids@example.test',
  DOCSMIT_PASSWORD_SHA512: 'abc',
  DOCSMIT_SOFTWARE_ID: 'soft-1',
  DOCSMIT_BASE_URL: 'https://secure.docsmit.com/api/v1',
}
const FUNCTION_FILE = '../../../supabase/functions/mail-poll/index.ts'
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
  db.tables = { app_settings: [], mail_pieces: [], job_lien_filings: [] }
  db.writes = []
  db.nextId = 1
  docsmit.calls = []
  docsmit.answers = {}
  storage.files = {}
})

function post(body: unknown, secret: string | null = 'cron-1'): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret) headers['x-cron-secret'] = secret
  return box.handler!(new Request('http://fn/mail-poll', { method: 'POST', headers, body: JSON.stringify(body) }))
}

const open = { id: 'p1', kind: 'lien_notice_53_056', source_ids: ['f1'], provider: 'docsmit', recipient: 'owner', status: 'sent', provider_message_id: 'm-1', events: [], usps_tracking: null, mailed_at: null, delivered_at: null, signed_by: null, delivery_status: null, delivery_as_of: null, pdf_bucket: 'lien-release-documents', certification_path: null }

describe('mail-poll (the Docsmit train, PR 3)', () => {
  it('needs the cron secret, and sits out while paused', async () => {
    expect((await post({}, null)).status).toBe(401)
    expect((await post({}, 'wrong')).status).toBe(401)
    db.tables.app_settings = [{ key: 'docsmit_paused', value_text: 'true' }]
    expect(await (await post({})).json()).toEqual({ ok: true, skipped: 'paused' })
    expect(docsmit.calls).toEqual([])
  })

  it('reads every open piece once, folds it, and writes the number and the mailed day into the filing', async () => {
    db.tables.mail_pieces = [{ ...open }, { ...open, id: 'p2', provider_message_id: 'm-2', status: 'delivered' }]
    db.tables.job_lien_filings = [{ id: 'f1', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-10-12' }] }]
    docsmit.answers['GET /messages/m-1/parties'] = { body: [{ USPSTrackingID: '9407 1118 9876 5432 1098', DeliveryStatus: 'Accepted at USPS Origin Facility', DStatusao: '2026-10-14T00:30:00Z' }] }
    const res = await post({})
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, env: 'prod', read: 1, updated: ['p1'], errors: [], matched_from_site: 0, credit_balance: null })
    expect(db.tables.mail_pieces![0]).toMatchObject({ status: 'in_transit', usps_tracking: '9407 1118 9876 5432 1098', mailed_at: '2026-10-14T00:30:00Z' })
    // 00:30 UTC on Oct 14 is the evening of Oct 13 in Central: the filing's day is the 13th.
    expect((db.tables.job_lien_filings![0]!.sends as unknown[])[0]).toEqual({ recipient: 'owner', method: 'certified_mail', tracking: '9407 1118 9876 5432 1098', sent_on: '2026-10-13', via: 'docsmit', piece_id: 'p1' })
    // USPS has it now, so the charge is asked for once; Docsmit had no answer here, so the price stays unread and is asked again next hour.
    expect(docsmit.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /token', 'GET /messages/m-1/parties', 'GET /messages/m-1/transactions', 'GET /account/info'])
    expect(db.tables.mail_pieces![0]!.price).toBeUndefined()
  })

  it('once USPS has a piece, one /transactions read writes what Docsmit charged, and the next poll does not ask again (6b, the cost line)', async () => {
    db.tables.mail_pieces = [{ ...open, status: 'in_transit', usps_tracking: '9407 1118', mailed_at: '2026-10-14T00:30:00Z', price: null }]
    db.tables.job_lien_filings = [{ id: 'f1', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1118', sent_on: '2026-10-13', via: 'docsmit', piece_id: 'p1' }] }]
    docsmit.answers['GET /messages/m-1/parties'] = { body: [{ USPSTrackingID: '9407 1118', DeliveryStatus: 'In Transit to Next Facility', DStatusao: '2026-10-14T08:00:00Z' }] }
    docsmit.answers['GET /messages/m-1/transactions'] = { body: [{ TransactionID: 1000002165, DateTime: '2026-10-13 15:59:10', CoR: 'C', discount: 0, price: 9.85, MsgID: 1, CertType: 'pre' }] }
    expect((await post({})).status).toBe(200)
    const row = db.tables.mail_pieces![0]!
    expect(row.price).toBe(9.85)
    expect((row.events as Array<{ kind: string; price?: number }>).filter((e) => e.kind === 'charged')).toEqual([expect.objectContaining({ price: 9.85 })])
    docsmit.calls = []
    docsmit.answers['GET /messages/m-1/parties'] = { body: [{ USPSTrackingID: '9407 1118', DeliveryStatus: 'In Transit to Next Facility', DStatusao: '2026-10-14T09:00:00Z' }] }
    expect((await post({})).status).toBe(200)
    expect(docsmit.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /token', 'GET /messages/m-1/parties', 'GET /account/info'])
    expect(db.tables.mail_pieces![0]!.price).toBe(9.85)
  })

  it('a dry run lists the open pieces and writes nothing', async () => {
    db.tables.mail_pieces = [{ ...open }]
    expect(await (await post({ dry_run: true })).json()).toEqual({ ok: true, dry_run: true, env: 'prod', open: [{ id: 'p1', status: 'sent' }] })
    expect(db.writes).toEqual([])
  })

  it('a provider error on one piece is logged on it and the rest still read', async () => {
    db.tables.mail_pieces = [{ ...open }, { ...open, id: 'p2', provider_message_id: 'm-2', source_ids: [] }]
    docsmit.answers['GET /messages/m-1/parties'] = { status: 500, body: { message: 'down' } }
    docsmit.answers['GET /messages/m-2/parties'] = { body: [{ USPSTrackingID: '1', DeliveryStatus: 'In Transit' }] }
    const out = await (await post({})).json()
    expect(out).toMatchObject({ ok: false, updated: ['p2'], errors: [{ id: 'p1', error: expect.stringMatching(/answered 500: down/) }] })
    expect((db.tables.mail_pieces![0]!.events as Array<{ kind: string }>).map((e) => e.kind)).toEqual(['poll_error'])
  })

  it('with the site switch on, a message sent by hand from Docsmit’s site becomes a piece of kind other; ours never a second row', async () => {
    db.tables.app_settings = [{ key: 'docsmit_match_site', value_text: 'true' }]
    db.tables.mail_pieces = [{ ...open, provider_message_id: 'm-1', status: 'delivered' }]
    docsmit.answers['GET /messages/sent'] = { body: { messages: [
      { messageID: 'm-1', clientMsgID: 'lien_notice_53_056:p1', title: 'ours' },
      { messageID: 'm-55', clientMsgID: 'lien_notice_53_056:gone', title: 'ours, reset' },
      { messageID: 'm-88', clientMsgID: '', title: 'Demand to Harlan', physicalParties: [{ organization: 'Harlan Dental PLLC', address1: '2200 Bandera Rd', city: 'San Antonio', state: 'tx', postalCode: '78228', USPSTrackingID: '9407 0000', DeliveryStatus: 'Delivered' }] },
    ] } }
    const out = await (await post({})).json()
    expect(out).toMatchObject({ ok: true, read: 0, matched_from_site: 1, match_errors: [] })
    expect(db.tables.mail_pieces).toHaveLength(2)
    expect(db.tables.mail_pieces![1]).toMatchObject({ kind: 'other', provider: 'docsmit', provider_message_id: 'm-88', recipient: 'unknown', organization: 'Harlan Dental PLLC', state: 'TX', status: 'delivered', usps_tracking: '9407 0000', problem: "Sent from Docsmit's own site (Demand to Harlan). Match it to a job." })
  })

  it('an affidavit copy mailed through the provider serves the affidavit the day USPS accepted it, once (the Docsmit train, PR 8)', async () => {
    db.tables.mail_pieces = [{ ...open, id: 'p5', kind: 'lien_affidavit_copy', source_ids: ['a1', 'a2'], provider_message_id: 'm-5' }]
    db.tables.job_lien_filings = [
      { id: 'a1', kind: 'affidavit', served_at: null, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-10-12' }] },
      { id: 'a2', kind: 'affidavit', served_at: '2026-10-01', sends: [] },
    ]
    docsmit.answers['GET /messages/m-5/parties'] = { body: [{ USPSTrackingID: '9407 5555', DeliveryStatus: 'Accepted at USPS Origin Facility', DStatusao: '2026-10-14T00:30:00Z' }] }
    await post({})
    expect(db.tables.job_lien_filings![0]).toMatchObject({ served_at: '2026-10-13' })
    expect((db.tables.job_lien_filings![0]!.sends as unknown[])[0]).toMatchObject({ tracking: '9407 5555', via: 'docsmit', piece_id: 'p5', sent_on: '2026-10-13' })
    expect(db.tables.job_lien_filings![1]!.served_at).toBe('2026-10-01')
  })

  it('the credit line (6b): the poll keeps the account’s balance and its as-of in app_settings, made on the first read and updated after; a refusal is reported, not fatal', async () => {
    docsmit.answers['GET /account/info'] = { body: { creditBalance: 12.4 } }
    const first = await (await post({})).json()
    expect(first).toMatchObject({ ok: true, credit_balance: 12.4, credit_error: null })
    expect(db.tables.app_settings).toEqual([{ id: 'id-1', key: 'docsmit_credit_balance', value_text: '12.4' }, expect.objectContaining({ key: 'docsmit_credit_as_of' })])
    docsmit.answers['GET /account/info'] = { body: { creditBalance: 9 } }
    await post({})
    expect(db.tables.app_settings!.filter((r) => r.key === 'docsmit_credit_balance')).toEqual([{ id: 'id-1', key: 'docsmit_credit_balance', value_text: '9' }])
    docsmit.answers['GET /account/info'] = { status: 500, body: { message: 'down' } }
    const third = await (await post({})).json()
    expect(third.ok).toBe(true)
    expect(third.credit_balance).toBeNull()
    expect(third.credit_error).toMatch(/500|down/)
    expect(db.tables.app_settings!.find((r) => r.key === 'docsmit_credit_balance')!.value_text).toBe('9')
  })
})
