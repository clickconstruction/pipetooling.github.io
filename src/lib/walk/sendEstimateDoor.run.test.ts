/**
 * send-estimate-to-customer's own handler, run here on its new account check (punch list #142 PR 5; README found
 * item 4): a View-as sample, a twin or a training account could read a draft and send it to a real customer. Now a
 * real account that is not in training mode sends as before; the walk tester, a training account, sends only the
 * kit's estimate at the kit's address; a sample, a twin and any other training account are refused. The fake holds no
 * RESEND_API_KEY, so a send that passes every check ends on the function's *link not emailed* answer with the link
 * minted and the row marked sent, before anything would reach Resend.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, makeFakeDb, type FakeDb } from '../../test/edgeFakeDb'
import { KIT, KIT_ROW, OTHER, SESSIONS, USERS } from './kitDoorFixtures'
import { KIT_DOOR_WORDS } from './kitDoor'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null; db: FakeDb; bearer: string | null } = { handler: null, db: makeFakeDb(), bearer: null }

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => fakeClient(box.db, SESSIONS, () => box.bearer),
}))

const ENV: Record<string, string> = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'service-key', SUPABASE_ANON_KEY: 'anon-key' }

// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/send-estimate-to-customer/index.ts'

const draft = (id: string, customerEmail: string) => ({
  id,
  customer_id: KIT.customerId,
  job_ledger_id: null,
  bid_id: null,
  title: 'ZZ walk estimate (delete me)',
  status: 'draft',
  sent_at: null,
  customer_email: customerEmail,
  bid_room_id: null,
  customer_experience_sent: null,
  line_items_snapshot: [{ description: 'One line', quantity: 1, unit_price_cents: 100 }],
  terms_snapshot: null,
  total_cents: 100,
  estimate_number: 1,
  customer_experience_overrides: null,
  accept_header_brand: null,
  customer_attachment_url: null,
  customer_attachment_label: null,
  doc_kind: 'estimate',
  options_snapshot: null,
  valid_until: null,
  for_address: null,
})

beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
beforeEach(() => {
  box.db = makeFakeDb()
  box.db.tables.users = USERS.map((u) => ({ ...u }))
  box.db.tables.app_settings = [{ ...KIT_ROW }]
  box.db.tables.estimates = [draft(KIT.estimateId, KIT.email), draft(OTHER.estimateId, 'dana@example.com')]
  box.db.tables.dispatch_requests = []
})

async function send(bearer: string, body: Record<string, unknown>) {
  box.bearer = bearer
  const res = await box.handler!(new Request('http://localhost/functions/v1/send-estimate-to-customer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: JSON.stringify(body),
  }))
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

const kitSend = { estimate_id: KIT.estimateId, customer_email: KIT.email, public_origin: 'https://clicktooling.example' }

describe('send-estimate-to-customer and the walk tester (punch list #142 PR 5)', () => {
  it('lets the tester send the kit’s estimate at the kit’s address: the link is minted, the row marked sent, and the answer carries no key', async () => {
    const res = await send('tester-jwt', kitSend)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, emailed: false, sent_to: KIT.email })
    expect(String(res.body.accept_url)).toMatch(/^https:\/\/clicktooling\.example\/estimate\/accept\?t=[0-9a-f]{64}$/)
    expect(box.db.calls.slice(0, 5)).toEqual(['auth.getUser', 'select users', 'select estimates', 'select app_settings', 'select app_settings'])
    const marked = box.db.writes.find((w) => w.table === 'estimates')
    expect(marked?.values).toMatchObject({ status: 'sent', customer_email: KIT.email })
    expect(marked?.matched.map((r) => r.id)).toEqual([KIT.estimateId])
  })

  it('refuses the tester at any other address, any other estimate, and with no kit', async () => {
    expect(await send('tester-jwt', { ...kitSend, customer_email: 'dana@example.com' })).toEqual({ status: 403, body: { error: KIT_DOOR_WORDS, code: 'walkTesterOnly' } })
    expect(box.db.writes).toEqual([])
    expect(await send('tester-jwt', { ...kitSend, estimate_id: OTHER.estimateId, customer_email: 'dana@example.com' })).toMatchObject({ status: 403, body: { code: 'walkTesterOnly' } })
    box.db.tables.app_settings = []
    expect(await send('tester-jwt', kitSend)).toMatchObject({ status: 403, body: { code: 'walkTesterOnly' } })
    expect(box.db.writes).toEqual([])
  })

  it('refuses a sample and a twin before the estimate is read, and a training account that is not the tester', async () => {
    for (const jwt of ['sample-jwt', 'twin-jwt']) {
      box.db.calls = []
      expect(await send(jwt, kitSend), jwt).toEqual({ status: 403, body: { error: 'Only a real account sends an estimate', code: 'not_a_real_account' } })
      expect(box.db.calls, jwt).toEqual(['auth.getUser', 'select users'])
    }
    expect(await send('training-jwt', kitSend)).toEqual({ status: 403, body: { error: 'A training account cannot send an estimate', code: 'read_only' } })
    expect(box.db.writes).toEqual([])
  })

  it('lets the office send as before, with no kit read', async () => {
    const res = await send('office-jwt', { estimate_id: OTHER.estimateId, customer_email: 'dana@example.com', public_origin: 'https://clicktooling.example' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, emailed: false, sent_to: 'dana@example.com' })
    expect(box.db.calls.slice(0, 4)).toEqual(['auth.getUser', 'select users', 'select estimates', 'select app_settings'])
    expect(box.db.calls.filter((c) => c === 'select app_settings')).toHaveLength(1)
  })
})
