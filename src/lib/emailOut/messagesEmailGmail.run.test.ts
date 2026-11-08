/**
 * messages-email's own handler, run here through Gmail as the box (punch list #207 PR 2, v2.6702): an office member's
 * email to a trade partner goes from bids@ under the reader's token, named *Marisol Vega · Click Construction*, with
 * no Reply-To; the line keeps the mail's Message-ID and Gmail ids; the sent copy and the send log are the function's
 * own. When Google refuses the box, or the thread names no box the reader reads, Resend sends it as before, with the
 * box as Reply-To. The token is signed by the real `_shared/googleToken.ts` with a key made for the run; Google and
 * Resend answer from fakes behind `fetch`. Every person, address and job is made up.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, makeFakeDb, type FakeDb } from '../../test/edgeFakeDb'
import { FakeGoogle, fakeServiceAccountJson } from '../myMail/gmailMineFakes'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null; db: FakeDb } = { handler: null, db: makeFakeDb() }
const google = new FakeGoogle()
const resend: { calls: Record<string, unknown>[] } = { calls: [] }

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => fakeClient(box.db, { 'marisol-jwt': 'u-marisol' }, () => 'marisol-jwt'),
}))

const BIDS = 'bids@clickplumbing.example'
const ENV: Record<string, string> = {
  SUPABASE_URL: 'http://127.0.0.1:9',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  SUPABASE_ANON_KEY: 'anon-key',
  RESEND_API_KEY: 'resend-key',
  GMAIL_IMPERSONATE_USER: BIDS,
  EMAIL_FROM: 'ClickTooling <team@noreply.clicktooling.example>',
}
const FUNCTION_FILE = '../../../supabase/functions/messages-email/index.ts'
const realFetch = globalThis.fetch

/** Google's fake answers Google; Resend's send is recorded and answered; the function's best-effort rows to Supabase are swallowed. */
const fetchAll = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const href = String(input instanceof Request ? input.url : input)
  if (href.startsWith('https://api.resend.com/')) {
    resend.calls.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)
    return new Response(JSON.stringify({ id: `re_${resend.calls.length}` }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  if (href.startsWith(ENV.SUPABASE_URL!)) return new Response('{}', { status: 201, headers: { 'Content-Type': 'application/json' } })
  return google.fetch(input, init)
}

beforeAll(async () => {
  ENV.GOOGLE_SERVICE_ACCOUNT_JSON = await fakeServiceAccountJson()
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  globalThis.fetch = fetchAll as typeof fetch
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  await import(/* @vite-ignore */ FUNCTION_FILE)
}, 30_000)
afterAll(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

const CONTACT = '0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a11'
const CHANNEL = '0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a12'

beforeEach(() => {
  google.reset()
  google.boxes[BIDS] = { mails: [], labels: [] }
  resend.calls = []
  box.db = makeFakeDb()
  box.db.tables.users = [{ id: 'u-marisol', name: 'Marisol Vega', email: 'marisol@clickplumbing.example', read_only: false, is_sample: false, is_digital_twin: false, is_walk_tester: false, archived_at: null }]
  box.db.tables.app_settings = [{ key: 'messages_boxes_v1', value_text: JSON.stringify({ team: { address: 'team@clickplumbing.example', phone: '', numberId: '' }, bids: { address: BIDS, phone: '', numberId: '' } }) }]
  box.db.tables.contact_channels = [{ id: CHANNEL, contact_id: CONTACT, kind: 'email', value: 'dale@ridgeway.example' }]
  box.db.tables.contacts = [{ id: CONTACT, kind: 'trade', name: 'Dale Okafor', customer_id: null, customer_contact_person_id: null, gc_company_id: null, gc_company_person_id: null }]
  box.db.tables.messages = []
  box.db.rpcs.gc_office_team = true
})

async function send(body: Record<string, unknown>) {
  const res = await box.handler!(new Request('http://localhost/functions/v1/messages-email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer marisol-jwt' }, body: JSON.stringify(body) }))
  return { status: res.status, body: (await res.json()) as { ok?: boolean; messageId?: string; sentAs?: string; error?: string; words?: string } }
}

const decodeWord = (v: string): string => {
  const m = /^=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=(.*)$/.exec(v)
  return m ? new TextDecoder().decode(Uint8Array.from(atob(m[1]!), (c) => c.charCodeAt(0))) + m[2] : v
}
const header = (raw: string, name: string) => decodeWord(new RegExp(`^${name}: (.*)$`, 'm').exec(raw)?.[1]?.trim() ?? '')

const ASK = { contactId: CONTACT, channelId: CHANNEL, subject: 'Cedar Bend clubhouse: Thursday', body: 'Dale,\n\nThursday works for us.', signature: ['Marisol Vega', 'Estimator · Click Construction'] }

describe('messages-email through Gmail as the box (punch list #207 PR 2)', () => {
  it('sends as bids@ under the person’s name with the company’s, keeps the Message-ID and the Gmail ids on the line, and sends nothing through Resend', async () => {
    const answer = await send(ASK)
    expect(answer).toMatchObject({ status: 200, body: { ok: true, sentAs: BIDS } })
    expect(google.subs).toEqual([BIDS])
    expect(google.sent).toHaveLength(1)
    const raw = google.sent[0]!.raw
    expect(header(raw, 'From')).toBe(`Marisol Vega · Click Construction <${BIDS}>`)
    expect(header(raw, 'To')).toBe('dale@ridgeway.example')
    expect(header(raw, 'Subject')).toBe('Cedar Bend clubhouse: Thursday')
    expect(raw).not.toMatch(/^Reply-To:/m)
    const line = box.db.tables.messages![0]!
    expect(line.id).toBe(answer.body.messageId)
    expect(line).toMatchObject({ channel: 'email', direction: 'out', who_user_id: 'u-marisol', mailbox: 'bids', rfc_message_id: `<messages-${line.id}@clickplumbing.example>`, gmail_id: 'sent-1', gmail_thread_id: 't-sent-1' })
    expect(header(raw, 'Message-ID')).toBe(line.rfc_message_id)
    expect(resend.calls).toEqual([])
  })

  it('falls back to Resend, from the company on the app’s address with the box as Reply-To, when Google refuses the box', async () => {
    google.sendRefused.add(BIDS)
    const answer = await send(ASK)
    expect(answer).toMatchObject({ status: 200, body: { ok: true } })
    expect(answer.body.sentAs).toBeUndefined()
    expect(google.sent).toEqual([])
    expect(resend.calls).toHaveLength(1)
    expect(resend.calls[0]).toMatchObject({ from: 'Click Construction <team@noreply.clicktooling.example>', to: ['dale@ridgeway.example'], reply_to: BIDS })
    const line = box.db.tables.messages![0]!
    expect(line.rfc_message_id).toBeUndefined()
    expect(line.mailbox).toBe('bids')
  })

  it('goes through Resend as before when Settings names no box the reader reads for them', async () => {
    box.db.tables.app_settings = []
    ENV.GMAIL_IMPERSONATE_USER = ''
    try {
      const answer = await send(ASK)
      expect(answer).toMatchObject({ status: 200, body: { ok: true } })
      expect(google.subs).toEqual([])
      expect(resend.calls).toHaveLength(1)
      // With no box, the answer comes to the sender's own inbox, as before.
      expect(resend.calls[0]).toMatchObject({ reply_to: 'marisol@clickplumbing.example' })
    } finally {
      ENV.GMAIL_IMPERSONATE_USER = BIDS
    }
  })
})
