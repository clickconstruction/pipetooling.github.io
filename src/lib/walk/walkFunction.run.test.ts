/**
 * The walk function's own handler, run here (punch list #142 PR 7): the gate, each action's request as the plan
 * shapes it, the tester made once, and no answer carrying any value from the function's environment. The URL imports
 * are stood in for, the database is a fake that applies the function's filters, the Google token is a stub, and
 * `fetch` is caught so nothing leaves: Gmail, Quo and the estimate function each answer from here.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, makeFakeDb, type FakeDb } from '../../test/edgeFakeDb'
import { BROWSER_USER_AGENT, TESTER_EMAIL, TESTER_NAME, leakedSecret } from './walkFunction'

type Handler = (req: Request) => Promise<Response>
type Row = Record<string, unknown>

interface Box {
  handler: Handler | null
  db: FakeDb
  /** Every rpc with its args. */
  rpcs: Array<{ name: string; args: Row | undefined }>
  /** Every auth.admin call. */
  auth: Array<{ op: string; args: Row }>
  /** Auth users by email (listUsers reads them). */
  authUsers: Array<{ id: string; email: string }>
  /** Every fetch, with its parsed JSON body when it had one. */
  fetches: Array<{ url: string; method: string; headers: Record<string, string>; body: Row | null }>
  /** Gmail's search answer, then each message by id. */
  gmail: { search: { id: string }[]; messages: Record<string, unknown> }
}

/** The kit as `walk_setup` answers it (`app_settings` `walk_kit_v1`). */
const KIT = {
  customerId: '11111111-1111-4111-8111-111111111111',
  contactId: '22222222-2222-4222-8222-222222222222',
  emailChannelId: '33333333-3333-4333-8333-333333333333',
  phoneChannelId: '44444444-4444-4444-8444-444444444444',
  estimateId: '55555555-5555-4555-8555-555555555555',
  email: 'bids@clickplumbing.example',
  phone: '(737) 300-9478',
  testerId: 'u-tester',
  sharedPhone: false,
  madeAt: '2026-10-22T14:00:00.000Z',
}
const KIT_ROW = { key: 'walk_kit_v1', value_text: JSON.stringify(KIT) }

const box: Box = { handler: null, db: makeFakeDb(), rpcs: [], auth: [], authUsers: [], fetches: [], gmail: { search: [], messages: {} } }

const ENV: Record<string, string> = {
  DEV_LOGIN_SECRET: 'dev-login-secret-value',
  SUPABASE_URL: 'http://supabase.local:9',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-value',
  SUPABASE_ANON_KEY: 'anon-key-value-1234',
  GOOGLE_SERVICE_ACCOUNT_JSON: '{"client_email":"sa@walk.example","private_key":"PRIVATE-KEY-BYTES"}',
  GMAIL_IMPERSONATE_USER: 'bids@clickplumbing.example',
  QUO_API_KEY: 'quo_live_key_value',
  EMAIL_FROM: 'team@noreply.clicktooling.example',
}

/** What no answer may carry: the environment's secrets, the Google token the stub mints, the Quo key. */
const SECRETS = {
  DEV_LOGIN_SECRET: ENV.DEV_LOGIN_SECRET,
  SUPABASE_SERVICE_ROLE_KEY: ENV.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY: ENV.SUPABASE_ANON_KEY,
  GOOGLE_SERVICE_ACCOUNT_JSON: ENV.GOOGLE_SERVICE_ACCOUNT_JSON,
  PRIVATE_KEY: 'PRIVATE-KEY-BYTES',
  QUO_API_KEY: ENV.QUO_API_KEY,
  GOOGLE_TOKEN: 'google-token-value-xyz',
}

const BOXES_ROW = {
  key: 'messages_boxes_v1',
  value_text: JSON.stringify({
    team: { address: 'team@clickplumbing.example', phone: '(512) 994-2774', numberId: 'PN-team' },
    bids: { address: 'bids@clickplumbing.example', phone: '(737) 300-9478', numberId: 'PN-bids' },
  }),
}

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: () => {
    const base = fakeClient(box.db, {}, () => null)
    return {
      ...base,
      rpc: async (name: string, args?: Row) => {
        box.rpcs.push({ name, args })
        box.db.calls.push(`rpc ${name}`)
        const r = box.db.rpcs[name]
        return typeof r === 'function' ? (r as () => unknown)() : { data: r ?? null, error: null }
      },
      auth: {
        ...base.auth,
        admin: {
          listUsers: async (args: Row) => {
            box.auth.push({ op: 'listUsers', args })
            return { data: { users: box.authUsers, nextPage: null }, error: null }
          },
          createUser: async (args: Row) => {
            box.auth.push({ op: 'createUser', args })
            const id = 'u-tester-new'
            box.authUsers.push({ id, email: String(args.email) })
            return { data: { user: { id } }, error: null }
          },
        },
      },
    }
  },
}))
vi.mock('../../../supabase/functions/_shared/googleToken.ts', () => ({ googleServiceToken: async () => 'google-token-value-xyz' }))

const FUNCTION_FILE = '../../../supabase/functions/walk/index.ts'

const realFetch = globalThis.fetch
beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const headers = Object.fromEntries(new Headers(init?.headers ?? {}).entries())
    const body = init?.body ? (JSON.parse(String(init.body)) as Row) : null
    box.fetches.push({ url, method: init?.method ?? 'GET', headers, body })
    const answer = (status: number, json: unknown) => new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } })
    if (url.includes('/gmail/v1/users/me/messages/send')) return answer(200, { id: 'gm-sent-1', threadId: 'th-1' })
    if (url.includes('/gmail/v1/users/me/messages?')) return answer(200, { messages: box.gmail.search })
    const m = /\/gmail\/v1\/users\/me\/messages\/([^?]+)/.exec(url)
    if (m) return answer(200, box.gmail.messages[m[1]!] ?? {})
    if (url.includes('api.quo.com/v1/messages')) return answer(200, { id: 'quo-msg-1' })
    if (url.includes('get-estimate-for-customer')) return answer(200, { estimate_number: 7, status: 'sent' })
    return answer(404, { error: `unexpected ${url}` })
  }) as typeof fetch
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
afterAll(() => {
  globalThis.fetch = realFetch
})

/** The estimate email as Gmail hands it back: from the app's sender, the subject the letterhead makes, the accept link. */
function estimateGmail(estimateNumber: number) {
  const text = `Your estimate is ready.\n\nhttps://clicktooling.example/estimate/accept?t=tok-abcdef-9f2e\n\nThanks`
  return {
    id: 'gm-est-1',
    threadId: 'th-est-1',
    labelIds: ['INBOX'],
    internalDate: String(Date.parse('2026-10-22T14:01:00.000Z')),
    payload: {
      mimeType: 'text/plain',
      headers: [
        { name: 'From', value: `Click Plumbing <${ENV.EMAIL_FROM}>` },
        { name: 'To', value: 'bids@clickplumbing.example' },
        { name: 'Subject', value: `Estimate #${estimateNumber} — ZZ walk estimate (delete me) — $1.00 · Click Plumbing` },
        { name: 'Message-ID', value: '<est-1@noreply.clicktooling.example>' },
        { name: 'Date', value: 'Thu, 22 Oct 2026 14:01:00 +0000' },
      ],
      body: { data: Buffer.from(text, 'utf8').toString('base64url'), size: text.length },
    },
  }
}

beforeEach(() => {
  box.db = makeFakeDb()
  box.db.tables.users = []
  box.db.tables.app_settings = [{ ...BOXES_ROW }, { ...KIT_ROW }]
  box.db.tables.estimates = [{ id: KIT.estimateId, estimate_number: 7, status: 'draft' }]
  box.db.tables.messages = []
  box.db.rpcs = { walk_setup: { ...KIT, made: true }, walk_cleanup: { cleaned: true, counts: { messages: 4, contacts: 1 }, kit: KIT }, quo_secret_get: null }
  box.rpcs = []
  box.auth = []
  box.authUsers = []
  box.fetches = []
  box.gmail = { search: [{ id: 'gm-est-1' }], messages: { 'gm-est-1': estimateGmail(7) } }
})

async function ask(body: unknown, secret: string | null = ENV.DEV_LOGIN_SECRET ?? null) {
  const res = await box.handler!(new Request('http://localhost/functions/v1/walk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(secret ? { 'X-Dev-Login-Secret': secret } : {}) },
    body: JSON.stringify(body),
  }))
  const json = (await res.json()) as Record<string, unknown>
  expect(leakedSecret(json, SECRETS), `no secret in the answer to ${JSON.stringify(body)}`).toBeNull()
  return { status: res.status, body: json }
}

describe('walk (punch list #142 PR 7)', () => {
  it('refuses a wrong or missing secret before reading anything, and an unknown action', async () => {
    expect((await ask({ action: 'setup' }, 'wrong')).status).toBe(401)
    expect((await ask({ action: 'setup' }, null)).status).toBe(401)
    expect(box.db.calls).toEqual([])
    expect((await ask({ action: 'nope' })).status).toBe(400)
  })

  it('setup makes the tester once (the auth user, then the row with its flags) and calls walk_setup with it', async () => {
    const first = await ask({ action: 'setup' })
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ ok: true, kit: { contactId: KIT.contactId, made: true }, tester: { id: 'u-tester-new', email: TESTER_EMAIL, made: true } })
    expect(box.auth.map((a) => a.op)).toEqual(['listUsers', 'createUser'])
    expect(box.auth[1]!.args).toEqual({ email: TESTER_EMAIL, email_confirm: true, user_metadata: { invited_role: 'assistant', name: TESTER_NAME } })
    const upsert = box.db.writes.find((w) => w.table === 'users')
    expect(upsert?.values).toEqual({ id: 'u-tester-new', email: TESTER_EMAIL, name: TESTER_NAME, role: 'assistant', read_only: true, is_sample: false, is_digital_twin: false, is_walk_tester: true })
    expect(box.rpcs).toEqual([{ name: 'walk_setup', args: { p_tester: 'u-tester-new', p_app_from: ENV.EMAIL_FROM, p_phone: null, p_shared_phone_ok: false } }])

    // The row exists now: no auth call, the same tester, kept.
    box.db.tables.users = [{ id: 'u-tester-new', email: TESTER_EMAIL, is_walk_tester: true }]
    box.auth = []
    box.db.rpcs.walk_setup = { ...KIT, made: false }
    const second = await ask({ action: 'setup' })
    expect(second.body).toMatchObject({ ok: true, kit: { made: false }, tester: { id: 'u-tester-new', made: false } })
    expect(box.auth).toEqual([])
  })

  it('setup finds an auth user with no row on any page, and makes none', async () => {
    box.authUsers = [{ id: 'u-tester-old', email: TESTER_EMAIL.toUpperCase() }]
    const res = await ask({ action: 'setup' })
    expect(res.body).toMatchObject({ tester: { id: 'u-tester-old', made: true } })
    expect(box.auth.map((a) => a.op)).toEqual(['listUsers'])
  })

  it('setup in the fallback walk takes the owner’s own phone and tells walk_setup the number is shared', async () => {
    box.db.tables.users = [{ id: 'u-robert', email: 'robert@example.com', phone: '(512) 555-0100', is_walk_tester: false }]
    const res = await ask({ action: 'setup', fallback: true, ownerEmail: 'Robert@Example.com' })
    expect(res.status).toBe(200)
    expect(box.rpcs[0]).toMatchObject({ name: 'walk_setup', args: { p_phone: '(512) 555-0100', p_shared_phone_ok: true } })
    box.db.tables.users = [{ id: 'u-robert', email: 'robert@example.com', phone: null }]
    expect((await ask({ action: 'setup', fallback: true, ownerEmail: 'robert@example.com' })).status).toBe(409)
    expect((await ask({ action: 'setup', fallback: true })).status).toBe(400)
  })

  it('setup says walk_setup’s refusal in its words', async () => {
    box.db.rpcs.walk_setup = () => ({ data: null, error: { message: 'The walk kit cannot be set up: contacts abc carries bids@.' } })
    const res = await ask({ action: 'setup' })
    expect(res).toEqual({ status: 409, body: { ok: false, error: 'setupRefused', words: 'The walk kit cannot be set up: contacts abc carries bids@.' } })
  })

  it('open finds the estimate email as bids@ and opens its link with a browser’s user agent, never as a preview', async () => {
    const res = await ask({ action: 'open' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      arrived: true,
      arrivedAt: '2026-10-22T14:01:00.000Z',
      gmailId: 'gm-est-1',
      threadId: 'th-est-1',
      messageId: '<est-1@noreply.clicktooling.example>',
      estimateNumber: 7,
      link: true,
      linkTail: '…9f2e',
      open: { status: 200, ok: true, estimateNumber: 7, error: null },
    })
    const search = box.fetches.find((f) => f.url.includes('/messages?'))!
    expect(decodeURIComponent(search.url)).toContain(`q=from:${ENV.EMAIL_FROM} subject:"Estimate #7" newer_than:7d`)
    expect(search.headers.authorization).toBe('Bearer google-token-value-xyz')
    const opened = box.fetches.find((f) => f.url.includes('get-estimate-for-customer'))!
    expect(opened.url).toBe(`${ENV.SUPABASE_URL}/functions/v1/get-estimate-for-customer?token=tok-abcdef-9f2e`)
    expect(opened.url).not.toContain('preview')
    expect(opened.headers['user-agent']).toBe(BROWSER_USER_AGENT)
    expect(opened.headers.apikey).toBe(ENV.SUPABASE_ANON_KEY)
  })

  it('open says the email has not arrived while Gmail finds none, and opens nothing', async () => {
    box.gmail.search = []
    expect((await ask({ action: 'open' })).body).toMatchObject({ ok: true, arrived: false, checked: 0 })
    expect(box.fetches.some((f) => f.url.includes('get-estimate-for-customer'))).toBe(false)
  })

  it('reply-email sends the words from bids@ to the team box, in the estimate email’s thread', async () => {
    const res = await ask({ action: 'reply-email', words: 'Can you do it Thursday?' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, to: 'team@clickplumbing.example', subject: 'Re: Estimate #7 — ZZ walk estimate (delete me) — $1.00 · Click Plumbing', gmailId: 'gm-sent-1', threadId: 'th-1' })
    const sent = box.fetches.find((f) => f.url.includes('/messages/send'))!
    expect(sent.method).toBe('POST')
    expect(sent.body?.threadId).toBe('th-est-1')
    const raw = Buffer.from(String(sent.body?.raw).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    expect(raw).toContain('From: bids@clickplumbing.example\r\n')
    expect(raw).toContain('To: team@clickplumbing.example\r\n')
    expect(raw).toContain('In-Reply-To: <est-1@noreply.clicktooling.example>\r\n')
    expect(raw).toContain(`Message-ID: ${String(res.body.messageId)}\r\n`)
    expect(raw.endsWith('\r\n\r\nCan you do it Thursday?')).toBe(true)
  })

  it('reply-email waits for the estimate email, and needs a team box', async () => {
    box.gmail.search = []
    expect((await ask({ action: 'reply-email', words: 'x' })).status).toBe(409)
    box.db.tables.app_settings = [{ key: 'messages_boxes_v1', value_text: JSON.stringify({ team: { address: '', phone: '', numberId: '' }, bids: { address: 'bids@clickplumbing.example', phone: '', numberId: '' } }) }, { ...KIT_ROW }]
    expect((await ask({ action: 'reply-email', words: 'x' })).body).toMatchObject({ error: 'noTeamBox' })
  })

  it('text goes from the bids number to the team box’s number through Quo, with the key and nothing else', async () => {
    const res = await ask({ action: 'text', words: 'Thursday works' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, status: 200, from: '(737) 300-9478', to: '+15129942774', quoId: 'quo-msg-1', words: null })
    const quo = box.fetches.find((f) => f.url.includes('api.quo.com'))!
    expect(quo).toMatchObject({ url: 'https://api.quo.com/v1/messages', method: 'POST', body: { content: 'Thursday works', from: 'PN-bids', to: ['+15129942774'] } })
    expect(quo.headers.authorization).toBe(ENV.QUO_API_KEY)
    expect(box.rpcs.map((r) => r.name)).toContain('quo_secret_get')
  })

  it('text is refused in the fallback walk, and without words', async () => {
    box.db.tables.app_settings = [{ ...BOXES_ROW }, { key: 'walk_kit_v1', value_text: JSON.stringify({ ...KIT, sharedPhone: true }) }]
    expect((await ask({ action: 'text', words: 'STOP' })).body).toMatchObject({ error: 'fallback' })
    expect((await ask({ action: 'text' })).status).toBe(400)
    expect(box.fetches.some((f) => f.url.includes('api.quo.com'))).toBe(false)
  })

  it('seed-old writes one three-day-old out text on the kit’s phone channel', async () => {
    const before = Date.now()
    const res = await ask({ action: 'seed-old' })
    expect(res.status).toBe(200)
    const row = box.db.writes.find((w) => w.table === 'messages')!
    expect(row.values).toMatchObject({ contact_id: KIT.contactId, channel_id: KIT.phoneChannelId, channel: 'text', direction: 'out', who_text: 'ZZ walk seed', delivery: 'delivered', mailbox: 'team' })
    const at = Date.parse(String(row.values.at))
    expect(before - at).toBeGreaterThanOrEqual(3 * 86_400_000 - 1)
    expect(before - at).toBeLessThan(3 * 86_400_000 + 60_000)
  })

  it('every action but setup and cleanup needs a kit', async () => {
    box.db.tables.app_settings = [{ ...BOXES_ROW }]
    for (const action of ['open', 'reply-email', 'text', 'seed-old']) {
      expect((await ask({ action, words: 'x' })).body, action).toMatchObject({ ok: false, error: 'noKit' })
    }
    expect(box.fetches).toEqual([])
  })

  it('cleanup answers walk_cleanup’s counts, or its refusal in words', async () => {
    expect((await ask({ action: 'cleanup' })).body).toMatchObject({ ok: true, cleaned: true, counts: { messages: 4, contacts: 1 } })
    box.db.rpcs.walk_cleanup = () => ({ data: null, error: { message: 'The walk kit cannot be cleaned up: a job is on the kit’s customer.' } })
    expect(await ask({ action: 'cleanup' })).toEqual({ status: 409, body: { ok: false, error: 'cleanupRefused', words: 'The walk kit cannot be cleaned up: a job is on the kit’s customer.' } })
  })

  it('holds back an answer that would carry a secret', async () => {
    box.db.rpcs.walk_cleanup = { cleaned: true, note: `key ${ENV.QUO_API_KEY}` }
    const res = await box.handler!(new Request('http://localhost/functions/v1/walk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dev-Login-Secret': ENV.DEV_LOGIN_SECRET! },
      body: JSON.stringify({ action: 'cleanup' }),
    }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ ok: false, error: 'held', words: 'The answer was held back: it carried a secret.' })
  })
})
