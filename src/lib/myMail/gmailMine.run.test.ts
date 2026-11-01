/**
 * gmail-mine's own handler, run here (punch list #230 PR 2) on the fakes in `gmailMineFakes.ts`: the caller's gates (a
 * sample, the switch off, an address off the Workspace refused at Google's token exchange), a page of the list with a
 * tagged row, a row the boxes already hold, guessed rows and a folded one, an open, a tag of a three-mail conversation
 * with one file, a second tag that writes nothing twice, a tag onto another job, and an untag. The token is signed by
 * the real `_shared/googleToken.ts` with a key made for the run; Google answers from the fake behind `fetch`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MY_MAIL_NOT_SIGN_IN_WORDS } from './imitation'
import { MY_MAIL_REFUSAL_WORDS } from './contract'
import { FakeDb, FakeGoogle, fakeServiceAccountJson, type FakeMail, type Row } from './gmailMineFakes'

type Handler = (req: Request) => Promise<Response>
const box: { handler: Handler | null } = { handler: null }
const db = new FakeDb()
const google = new FakeGoogle()

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: (_url: string, key: string, opts?: { global?: { headers?: Record<string, string> } }) =>
    db.client(key === 'service-key' ? 'admin' : 'caller', (opts?.global?.headers?.Authorization ?? '').replace(/^Bearer\s+/i, '') || null),
}))

const ENV: Record<string, string> = {
  SUPABASE_URL: 'http://127.0.0.1:9',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  SUPABASE_ANON_KEY: 'anon-key',
  GMAIL_IMPERSONATE_USER: 'bids@clickplumbing.example',
  EMAIL_FROM: 'ClickTooling <team@noreply.clicktooling.example>',
}
// A Deno file: loaded by path at run time, so the app's typecheck does not follow it into Deno's globals.
const FUNCTION_FILE = '../../../supabase/functions/gmail-mine/index.ts'
const realFetch = globalThis.fetch
const logged: string[] = []

beforeAll(async () => {
  ENV.GOOGLE_SERVICE_ACCOUNT_JSON = await fakeServiceAccountJson()
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  globalThis.fetch = google.fetch as typeof fetch
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void logged.push(a.map(String).join(' ')))
  vi.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => void logged.push(a.map(String).join(' ')))
  await import(/* @vite-ignore */ FUNCTION_FILE)
}, 30_000)
afterAll(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

// Made-up people, jobs and mail. Marisol Vega is the estimator whose box it is; Dale Okafor at Ridgeway Builders is on
// 4 Elm Ct (JP1077) and starred on 19 Harbor Ln (JP1081); Priya Nair is on the Cedar Bend HOA's clubhouse bid (BP523);
// the HOA's one open Pipeline job is 7 Mill Rd (JP1090).
const ELM = '0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a01'
const HARBOR = '0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a02'
const CLUB = '0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a03'
const MILL = '0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a05'
const GONE = '0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a09'
const MARISOL = 'marisol@clickplumbing.example'
const LABEL = 'Tagged in ClickTooling'

const account = { read_only: false, is_sample: false, is_digital_twin: false, is_walk_tester: false, my_mail_on: true, my_mail_hidden_labels: [] as string[] }
const USERS: Row[] = [
  { ...account, id: 'u-marisol', name: 'Marisol Vega', role: 'estimator', email: MARISOL, my_mail_hidden_labels: ['Personal'] },
  { ...account, id: 'u-rosa', name: 'Rosa Diaz', role: 'assistant', email: 'rosa@clickplumbing.example' },
  { ...account, id: 'u-sample', name: 'Sample estimator', role: 'estimator', email: 'sample-estimator@samples.pipetooling.local', is_sample: true },
  { ...account, id: 'u-twin', name: 'Twin Estimator 1', role: 'estimator', email: 'twin-1@twins.pipetooling.local', is_digital_twin: true },
  { ...account, id: 'u-tester', name: 'ZZ Walk tester', role: 'assistant', email: 'walk-tester@walk.pipetooling.local', read_only: true, is_walk_tester: true },
  { ...account, id: 'u-off', name: 'Olive Ortiz', role: 'assistant', email: 'olive@clickplumbing.example', my_mail_on: false },
  { ...account, id: 'u-trainee', name: 'Trainee Tam', role: 'assistant', email: 'tam@clickplumbing.example', read_only: true },
  { ...account, id: 'u-dev', name: 'Robert', role: 'dev', email: 'robert@douglasmining.example' },
  { ...account, id: 'u-sub', name: 'Sub Sam', role: 'subcontractor', email: 'sam@subs.example' },
]
const pipelineJob = (id: string, hcp: string, name: string, customer: string): Row => ({ id, hcp_number: hcp, click_number: '', job_name: name, service_type_id: 'st-plumb', status: 'working', customer_id: customer, gc_customer_id: null })

const mail = (id: string, threadId: string, at: string, headers: Record<string, string>, text: string, over: Partial<FakeMail> = {}): FakeMail => ({
  id,
  threadId,
  at,
  labelIds: ['INBOX', 'CATEGORY_PERSONAL'],
  headers: { To: MARISOL, ...headers },
  text,
  ...over,
})
const DALE = 'Dale Okafor <dale@ridgeway.example>'
const SPEC = new Uint8Array(2000).fill(37)

/** The conversation the tag reads: Dale (copied to bids@, which took it), Marisol's own answer, Ana with the spec sheet, and a draft. */
const elmThread = (): FakeMail[] => [
  mail('g-dale-1', 't-elm', '2026-10-30T15:00:00.000Z', { From: DALE, Cc: 'bids@clickplumbing.example', Subject: 'Re: 4 Elm Ct water heater', 'Message-ID': '<dale-1@ridgeway.example>' }, 'Owner wants the 50-gal, not the 40.'),
  mail('g-marisol-1', 't-elm', '2026-10-31T09:30:00.000Z', { From: `Marisol Vega <${MARISOL}>`, To: DALE, Subject: 'Re: 4 Elm Ct water heater', 'Message-ID': '<marisol-1@clickplumbing.example>' }, '$340 more for the 50.', { labelIds: ['SENT'] }),
  mail(
    'g-ana-1',
    't-elm',
    '2026-11-01T08:15:00.000Z',
    { From: 'Ana Ruiz <ana@ridgeway.example>', Cc: DALE, Subject: 'Re: 4 Elm Ct water heater', 'Message-ID': '<ana-1@ridgeway.example>' },
    'Here is the spec sheet for the 50.',
    {
      html: '<p>Here is the <b>spec sheet</b> for the 50.</p>',
      files: [
        { partId: '1', name: 'elm-ct-spec-sheet.pdf', mime: 'application/pdf', bytes: SPEC, attachmentId: 'att-spec' },
        { partId: '2', name: 'logo.png', mime: 'image/png', bytes: new Uint8Array(100), attachmentId: 'att-logo', inline: true },
      ],
    },
  ),
  mail('g-draft-elm', 't-elm', '2026-11-01T09:00:00.000Z', { From: MARISOL, To: 'ana@ridgeway.example', Subject: 'Re: 4 Elm Ct water heater' }, 'Thanks Ana', { labelIds: ['DRAFT'] }),
]

/** One page of Marisol's Inbox and Sent, newest first, and a draft Gmail should never have listed. */
const listPage = (): FakeMail[] => [
  mail('g-news', 't-news', '2026-11-01T16:00:00.000Z', { From: 'Trade Weekly <news@tradeweekly.example>', Subject: 'This week in plumbing', 'List-Unsubscribe': '<mailto:u@tradeweekly.example>', 'Message-ID': '<news-1@tradeweekly.example>' }, 'Read more.'),
  mail('g-dale-3', 't-dale-3', '2026-11-01T15:00:00.000Z', { From: DALE, Subject: 'Thursday', 'Message-ID': '<dale-3@ridgeway.example>' }, 'Thursday works for the walk.'),
  mail('g-sam', 't-sam', '2026-11-01T14:00:00.000Z', { From: 'Sam Lee <sam@leesupply.example>', Subject: 'Quote for JP1077', 'Message-ID': '<sam-1@leesupply.example>' }, 'Attached is the quote.'),
  mail('g-priya-1', 't-priya', '2026-11-01T13:00:00.000Z', { From: 'Priya Nair <priya@cedarbend.example>', Cc: 'bids@clickplumbing.example', Subject: 'Clubhouse walk', 'Message-ID': '<priya-1@cedarbend.example>' }, 'The board meets Tuesday.'),
  mail('g-board', 't-board', '2026-11-01T12:00:00.000Z', { From: 'Cedar Bend Treasurer <treasurer@cedarbend.example>', Subject: 'Monday', 'Message-ID': '<board-1@cedarbend.example>' }, 'Is the crew on for Monday?'),
  mail('g-elm-old', 't-tagged', '2026-11-01T11:00:00.000Z', { From: DALE, Subject: 'Re: water heater', 'Message-ID': '<elm-old@ridgeway.example>' }, 'Go ahead.'),
  mail('g-jo', 't-jo', '2026-11-01T10:00:00.000Z', { From: 'Jo Park <jo@parkfamily.example>', Subject: 'Hello', 'Message-ID': '<jo-1@parkfamily.example>' }, 'Hi there.'),
  mail('g-draft', 't-jo', '2026-11-01T17:00:00.000Z', { From: MARISOL, To: 'jo@parkfamily.example', Subject: 'Re: Hello' }, 'Draft words.', { labelIds: ['DRAFT'] }),
]

beforeEach(() => {
  db.reset()
  google.reset()
  logged.length = 0
  for (const u of USERS) db.sessions[`${String(u.id).slice(2)}-jwt`] = String(u.id)
  for (const id of ['u-marisol', 'u-rosa', 'u-off', 'u-trainee', 'u-dev']) db.office.add(id)
  db.tables = {
    users: USERS.map((u) => ({ ...u })),
    app_settings: [{ key: 'messages_boxes_v1', value_text: JSON.stringify({ bids: { address: 'bids@clickplumbing.example' }, team: { address: 'team@clickplumbing.example' } }) }],
    email_left_out_senders: [{ value: 'statements@harlanfreight.example', kind: 'address', mailbox: null }],
    service_types: [{ id: 'st-plumb', ledger_job_prefix: 'JP', ledger_bid_prefix: 'BP' }],
    jobs_ledger: [pipelineJob(ELM, '1077', '4 Elm Ct', 'cust-ridgeway'), pipelineJob(HARBOR, '1081', '19 Harbor Ln', 'cust-harbor'), pipelineJob(MILL, '1090', '7 Mill Rd', 'cust-cedar')],
    bids: [{ id: CLUB, bid_number: '523', project_name: 'Cedar Bend clubhouse', service_type_id: 'st-plumb', outcome: null }],
    projects: [],
    gc_projects: [],
    customers: [
      { id: 'cust-ridgeway', name: 'Ridgeway Builders', contact_info: { email: 'office@ridgeway.example' }, billing_email: null, archived_at: null },
      { id: 'cust-cedar', name: 'Cedar Bend HOA', contact_info: { email: 'board@cedarbend.example' }, billing_email: null, archived_at: null },
      { id: 'cust-harbor', name: 'Harbor Dental', contact_info: null, billing_email: null, archived_at: null },
    ],
    customer_contact_persons: [
      { customer_id: 'cust-ridgeway', email: 'dale@ridgeway.example' },
      { customer_id: 'cust-cedar', email: 'priya@cedarbend.example' },
    ],
    contacts: [
      { id: 'c-dale', kind: 'customer', name: 'Dale Okafor' },
      { id: 'c-priya', kind: 'customer', name: 'Priya Nair' },
    ],
    contact_channels: [
      { id: 'ch-dale', contact_id: 'c-dale', kind: 'email', value: 'dale@ridgeway.example', key: 'dale@ridgeway.example' },
      { id: 'ch-priya', contact_id: 'c-priya', kind: 'email', value: 'priya@cedarbend.example', key: 'priya@cedarbend.example' },
    ],
    contact_jobs: [{ contact_id: 'c-dale', bid_id: null, project_id: null, jobs_ledger_id: HARBOR, is_default: true }],
    messages: [],
    message_attachments: [],
    email_tag_threads: [],
  }
  google.boxes[MARISOL] = { mails: [], labels: [{ id: 'INBOX', name: 'INBOX' }, { id: 'SENT', name: 'SENT' }] }
})

async function post(bearer: string | null, body: unknown): Promise<{ status: number; body: Record<string, unknown>; headers: Headers }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearer) headers.Authorization = `Bearer ${bearer}`
  const res = await box.handler!(new Request('http://localhost/functions/v1/gmail-mine', { method: 'POST', headers, body: JSON.stringify(body) }))
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, headers: res.headers }
}

const writes = () => db.calls.filter((c) => / (insert|upsert|update|delete) /.test(c) || c.includes(' storage upload') || c.includes(' storage remove'))
const rpcs = (fn: string) => db.rpcCalls.filter((c) => c.fn === fn)
const lines = () => db.rows('messages')

describe('gmail-mine: the caller', () => {
  it('answers the browser’s preflight with the CORS headers, and every answer carries them', async () => {
    const res = await box.handler!(new Request('http://localhost/functions/v1/gmail-mine', { method: 'OPTIONS' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('authorization')
    const refused = await post(null, { action: 'list' })
    expect(refused).toMatchObject({ status: 401, body: { ok: false, error: 'signIn', words: MY_MAIL_REFUSAL_WORDS.signIn } })
    expect(refused.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('refuses a sample, a twin and the walk tester before anything reaches Google', async () => {
    for (const jwt of ['sample-jwt', 'twin-jwt', 'tester-jwt']) {
      expect(await post(jwt, { action: 'list', view: 'toTag' }), jwt).toMatchObject({ status: 403, body: { ok: false, error: 'readOnly', words: MY_MAIL_REFUSAL_WORDS.readOnly } })
    }
    expect(google.subs).toEqual([])
  })

  it('refuses someone off the office team, and an office member whose switch is off', async () => {
    expect(await post('sub-jwt', { action: 'list' })).toMatchObject({ status: 403, body: { error: 'officeOnly', words: MY_MAIL_REFUSAL_WORDS.officeOnly } })
    expect(await post('off-jwt', { action: 'list' })).toMatchObject({ status: 403, body: { ok: false, error: 'off', words: MY_MAIL_REFUSAL_WORDS.off } })
    expect(google.subs).toEqual([])
  })

  it('asks Google for the caller’s own address alone, and an address off the Workspace answers with Google’s reason', async () => {
    google.refuse['robert@douglasmining.example'] = {
      status: 401,
      body: { error: 'unauthorized_client', error_description: 'Client is unauthorized to retrieve access tokens using this method, or client not authorized for any of the scopes requested.' },
    }
    const res = await post('dev-jwt', { action: 'list', view: 'toTag' })
    expect(res).toMatchObject({
      status: 403,
      body: {
        ok: false,
        error: 'offWorkspace',
        words: `${MY_MAIL_REFUSAL_WORDS.offWorkspace} Google said: Client is unauthorized to retrieve access tokens using this method, or client not authorized for any of the scopes requested.`,
      },
    })
    expect(google.subs).toEqual(['robert@douglasmining.example'])
    expect(google.calls).toEqual([])
  })

  it('refuses a request it cannot read, and lets a training account read but never tag', async () => {
    expect(await post('marisol-jwt', { action: 'list', view: 'inbox' })).toMatchObject({ status: 400, body: { error: 'badRequest', words: MY_MAIL_REFUSAL_WORDS.badRequest } })
    google.boxes['tam@clickplumbing.example'] = { mails: [], labels: [] }
    expect(await post('trainee-jwt', { action: 'list', view: 'all' })).toMatchObject({ status: 200, body: { ok: true, address: 'tam@clickplumbing.example', rows: [], nextPageToken: null, folded: 0 } })
    expect(await post('trainee-jwt', { action: 'tag', threadId: 't-elm', job: { kind: 'pipeline', id: ELM } })).toMatchObject({ status: 403, body: { error: 'readOnly' } })
    expect(await post('trainee-jwt', { action: 'untag', threadId: 't-elm' })).toMatchObject({ status: 403, body: { error: 'readOnly' } })
    expect(google.subs).toEqual(['tam@clickplumbing.example'])
  })
})

describe('gmail-mine: a session Imitate or View as opened, and the address it reads', () => {
  // A magic-link sign-in at 16:10:06 on 2026-11-01, as GoTrue stamps it in the token's amr, in seconds.
  const SIGNED_IN = Math.floor(Date.parse('2026-11-01T16:10:06.000Z') / 1000)
  const at = (seconds: number) => new Date(seconds * 1000).toISOString()
  const part = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  /** A session's token shaped as GoTrue signs one, refreshed after the sign-in, its amr saying how it signed in. */
  const session = (userId: string, amr: unknown): string => {
    const token = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: userId, role: 'authenticated', aal: 'aal1', amr, iat: SIGNED_IN + 600, exp: SIGNED_IN + 36600 })}.signature`
    db.sessions[token] = userId
    return token
  }
  /** An imitation login-as-user recorded: Rosa's by default. */
  const imitated = (target: string, createdAt: string, operator = 'u-rosa') => db.rows('user_imitations').push({ id: `imitation-${db.nextId++}`, operator_id: operator, target_id: target, created_at: createdAt })

  it('refuses a magic-link session that follows an imitation of the person, on every action, before Google is asked for a token', async () => {
    imitated('u-marisol', at(SIGNED_IN - 20))
    for (const method of ['otp', 'magiclink']) {
      expect(await post(session('u-marisol', [{ method, timestamp: SIGNED_IN }]), { action: 'list', view: 'toTag' }), method).toMatchObject({
        status: 403,
        body: { ok: false, error: 'imitated', words: MY_MAIL_REFUSAL_WORDS.imitated },
      })
    }
    const token = session('u-marisol', [{ method: 'otp', timestamp: SIGNED_IN }])
    for (const body of [{ action: 'open', gmailId: 'g-ana-1' }, { action: 'tag', threadId: 't-elm', job: { kind: 'pipeline', id: ELM } }, { action: 'untag', threadId: 't-elm' }]) {
      expect(await post(token, body), body.action).toMatchObject({ status: 403, body: { error: 'imitated' } })
    }
    expect(google.subs).toEqual([])
    expect(google.calls).toEqual([])
    expect(writes()).toEqual([])
    // The record is read as the service role: nobody signed in reads it but a dev.
    expect(db.calls).toContain('admin select user_imitations')
    expect(db.calls).not.toContain('caller select user_imitations')
    expect(logged.some((l) => l.includes('"event":"gmail_mine_refused"') && l.includes('"error":"imitated"'))).toBe(true)
  })

  it('lets the same magic-link session through when no imitation of the person is in the window', async () => {
    imitated('u-marisol', at(SIGNED_IN - 86400 - 60)) // more than a day before the sign-in
    imitated('u-marisol', at(SIGNED_IN + 3600)) // an hour after it, so not the one that opened it
    imitated('u-rosa', at(SIGNED_IN - 20), 'u-dev') // someone else's
    const res = await post(session('u-marisol', [{ method: 'otp', timestamp: SIGNED_IN }]), { action: 'list', view: 'toTag' })
    expect(res).toMatchObject({ status: 200, body: { ok: true, address: MARISOL } })
    expect(google.subs).toEqual([MARISOL])
  })

  it('lets a password session through with an imitation of the person on record, and never reads the record for it', async () => {
    imitated('u-marisol', at(SIGNED_IN - 20))
    const res = await post(session('u-marisol', [{ method: 'password', timestamp: SIGNED_IN }]), { action: 'list', view: 'toTag' })
    expect(res).toMatchObject({ status: 200, body: { ok: true, address: MARISOL } })
    expect(db.calls.some((c) => c.includes('user_imitations'))).toBe(false)
  })

  it('refuses when the record cannot be read, and logs why', async () => {
    db.refuse['admin select user_imitations'] = 'relation "public.user_imitations" does not exist'
    const res = await post(session('u-marisol', [{ method: 'otp', timestamp: SIGNED_IN }]), { action: 'list', view: 'toTag' })
    expect(res).toMatchObject({ status: 403, body: { ok: false, error: 'imitated', words: MY_MAIL_REFUSAL_WORDS.imitated } })
    expect(google.subs).toEqual([])
    expect(logged.some((l) => l.includes('"event":"gmail_mine_imitations_unread"'))).toBe(true)
  })

  it('reads only the address the person signs in with: a users.email that is not it is refused before Google', async () => {
    db.authEmails['u-marisol'] = 'marisol.vega@clickplumbing.example'
    expect(await post('marisol-jwt', { action: 'list', view: 'toTag' })).toMatchObject({ status: 403, body: { ok: false, error: 'offWorkspace', words: MY_MAIL_NOT_SIGN_IN_WORDS } })
    db.authEmails['u-marisol'] = null
    expect(await post('marisol-jwt', { action: 'list' })).toMatchObject({ status: 403, body: { error: 'offWorkspace', words: MY_MAIL_NOT_SIGN_IN_WORDS } })
    expect(google.subs).toEqual([])
    // The same address in another case, with a space around it, is the same address.
    db.authEmails['u-marisol'] = '  Marisol@ClickPlumbing.example '
    expect(await post('marisol-jwt', { action: 'list', view: 'toTag' })).toMatchObject({ status: 200, body: { ok: true, address: MARISOL } })
    expect(google.subs).toEqual([MARISOL])
  })
})

describe('gmail-mine: list', () => {
  beforeEach(() => {
    const page = listPage()
    google.boxes[MARISOL] = { mails: page, labels: [{ id: 'INBOX', name: 'INBOX' }], pages: { '': { ids: page.map((m) => m.id), next: 'page-2' } } }
    // bids@ read Priya's mail and the office tied it to the clubhouse bid; an earlier tag put the Elm conversation on JP1077.
    db.tables.messages = [
      { id: 'm-box-club', contact_id: 'c-priya', gmail_id: 'bx-priya-1', rfc_message_id: '<priya-1@cedarbend.example>', mailbox: 'bids', mail_user_id: null, bid_id: CLUB, project_id: null, jobs_ledger_id: null },
      { id: 'm-mine-elm', contact_id: 'c-dale', gmail_id: 'g-elm-old', rfc_message_id: '<elm-old@ridgeway.example>', mailbox: 'mine', mail_user_id: 'u-marisol', bid_id: null, project_id: null, jobs_ledger_id: ELM, gmail_thread_id: 't-tagged' },
    ]
    db.tables.email_tag_threads = [{ id: 'tag-1', user_id: 'u-marisol', gmail_thread_id: 't-tagged', bid_id: null, project_id: null, jobs_ledger_id: ELM, tagged_by: 'u-marisol' }]
  })

  const elmChip = { kind: 'pipeline', id: ELM, key: `pipeline:${ELM}`, num: 'JP1077', name: '4 Elm Ct' }

  it('reads a page as the person, fills each row from the database, and answers every row of All with the fold counted', async () => {
    const res = await post('marisol-jwt', { action: 'list', view: 'all' })
    expect(res.status).toBe(200)
    const rows = res.body.rows as Row[]
    expect(rows.map((r) => r.gmailId)).toEqual(['g-dale-3', 'g-sam', 'g-priya-1', 'g-board', 'g-elm-old', 'g-jo'])
    expect(res.body).toMatchObject({ ok: true, address: MARISOL, nextPageToken: 'page-2', folded: 1 })
    const by = Object.fromEntries(rows.map((r) => [r.gmailId, r]))
    // Dale's starred job; the job the subject names; a customer's domain with one open job.
    expect(by['g-dale-3']).toMatchObject({ direction: 'in', who: { name: 'Dale Okafor', address: 'dale@ridgeway.example' }, guess: { kind: 'pipeline', id: HARBOR, num: 'JP1081', why: 'Dale Okafor is on this job' }, tagged: null, inMessages: null })
    expect(by['g-sam']!.guess).toEqual({ ...elmChip, why: 'the subject names JP1077' })
    expect(by['g-board']!.guess).toEqual({ kind: 'pipeline', id: MILL, key: `pipeline:${MILL}`, num: 'JP1090', name: '7 Mill Rd', why: 'cedarbend.example is Cedar Bend HOA' })
    // A mail bids@ already holds, tied by the office: its line and job, no guess.
    expect(by['g-priya-1']).toMatchObject({ inMessages: { messageId: 'm-box-club', jobKey: `bid:${CLUB}` }, guess: null, tagged: null })
    // A tagged conversation: the job's chip with this mail's line, no guess; the person's own tag line is theirs,
    // never a line someone else holds (`inMessages`), so the tab can offer Untag.
    expect(by['g-elm-old']).toMatchObject({ tagged: { ...elmChip, messageId: 'm-mine-elm' }, inMessages: null, guess: null })
    expect(by['g-jo']).toMatchObject({ guess: null, tagged: null, inMessages: null, folded: null })
  })

  it('answers To tag without what is on a job or folded, and searches with the fence and the person’s hidden label', async () => {
    const res = await post('marisol-jwt', { action: 'list', view: 'toTag' })
    expect((res.body.rows as Row[]).map((r) => r.gmailId)).toEqual(['g-dale-3', 'g-sam', 'g-board', 'g-jo'])
    expect(res.body.folded).toBe(1)
    expect(google.queries).toEqual(['(in:inbox OR in:sent) -in:drafts -in:spam -in:trash -in:chats -label:"Personal" -label:"Tagged in ClickTooling"'])
    expect(google.calls[0]).toBe(`${MARISOL} GET /messages?q=${encodeURIComponent(google.queries[0]!)}&maxResults=50`)
  })

  it('leaves the domain step out when its read fails, and still answers the page with the other guesses', async () => {
    db.refuse['admin select customer_contact_persons'] = 'failed to parse logic tree'
    const res = await post('marisol-jwt', { action: 'list', view: 'toTag' })
    expect(res.status).toBe(200)
    const by = Object.fromEntries((res.body.rows as Row[]).map((r) => [r.gmailId, r]))
    expect(by['g-board']!.guess).toBeNull()
    expect(by['g-sam']!.guess).toMatchObject({ id: ELM, why: 'the subject names JP1077' })
    expect(logged.some((l) => l.includes('"event":"gmail_mine_guess_missed"'))).toBe(true)
  })

  it('reads as the person’s own address alone, never draws a draft, and keeps nothing', async () => {
    await post('marisol-jwt', { action: 'list', view: 'all', q: 'from:dale', pageToken: 'page-1' })
    expect(google.subs).toEqual([MARISOL])
    expect(google.queries[0]).toBe('(in:inbox OR in:sent) -in:drafts -in:spam -in:trash -in:chats -label:"Personal" (from:dale)')
    expect(google.calls.every((c) => c.startsWith(`${MARISOL} GET `))).toBe(true)
    expect(writes()).toEqual([])
    const res = await post('marisol-jwt', { action: 'list', view: 'all' })
    expect((res.body.rows as Row[]).some((r) => r.gmailId === 'g-draft')).toBe(false)
  })
})

describe('gmail-mine: open', () => {
  beforeEach(() => {
    google.boxes[MARISOL]!.mails = elmThread()
    db.tables.messages = [{ id: 'm-box-1', contact_id: 'c-dale', gmail_id: 'bx-dale-1', rfc_message_id: '<dale-1@ridgeway.example>', mailbox: 'bids', mail_user_id: null, bid_id: null, project_id: null, jobs_ledger_id: null, tied_by: null }]
  })

  it('reads one mail whole with its conversation as rows, and keeps nothing', async () => {
    const res = await post('marisol-jwt', { action: 'open', gmailId: 'g-ana-1' })
    expect(res.status).toBe(200)
    const m = res.body.mail as Row
    expect(m).toMatchObject({
      gmailId: 'g-ana-1',
      threadId: 't-elm',
      direction: 'in',
      who: { name: 'Ana Ruiz', address: 'ana@ridgeway.example' },
      subject: 'Re: 4 Elm Ct water heater',
      files: 1,
      tagged: null,
      inMessages: null,
      guess: { kind: 'pipeline', id: ELM, num: 'JP1077', why: 'ridgeway.example is Ridgeway Builders' },
      to: [{ name: '', address: MARISOL }],
      cc: [{ name: 'Dale Okafor', address: 'dale@ridgeway.example' }],
      bodyText: 'Here is the spec sheet for the 50.',
      bodyHtml: '<p>Here is the <b>spec sheet</b> for the 50.</p>',
      fileList: [{ name: 'elm-ct-spec-sheet.pdf', mime: 'application/pdf', size: 2000 }],
      threadCount: 3,
    })
    const thread = m.threadRows as Row[]
    expect(thread.map((r) => r.gmailId)).toEqual(['g-dale-1', 'g-marisol-1'])
    expect(thread[0]).toMatchObject({ inMessages: { messageId: 'm-box-1', jobKey: null }, guess: null })
    expect(thread[1]).toMatchObject({ direction: 'out', who: { name: 'Dale Okafor', address: 'dale@ridgeway.example' } })
    expect(google.calls).toContain(`${MARISOL} GET /threads/t-elm?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Id&metadataHeaders=Precedence&metadataHeaders=Auto-Submitted`)
    expect(writes()).toEqual([])
  })

  it('answers not there for a mail Gmail does not have, and for a draft', async () => {
    expect(await post('marisol-jwt', { action: 'open', gmailId: 'g-nope' })).toMatchObject({ status: 404, body: { ok: false, error: 'notFound', words: MY_MAIL_REFUSAL_WORDS.notFound } })
    expect(await post('marisol-jwt', { action: 'open', gmailId: 'g-draft-elm' })).toMatchObject({ status: 404, body: { error: 'notFound' } })
  })
})

describe('gmail-mine: tag and untag', () => {
  beforeEach(() => {
    google.boxes[MARISOL]!.mails = elmThread()
    // bids@ was copied on Dale's first mail and took it; nobody tied it.
    db.tables.messages = [{ id: 'm-box-1', contact_id: 'c-dale', gmail_id: 'bx-dale-1', gmail_thread_id: 'bx-t-1', rfc_message_id: '<dale-1@ridgeway.example>', mailbox: 'bids', mail_user_id: null, bid_id: null, project_id: null, jobs_ledger_id: null, tied_by: null }]
  })

  const tagElm = { action: 'tag', threadId: 't-elm', job: { kind: 'pipeline', id: ELM } }
  const mine = () => lines().filter((l) => l.mail_user_id === 'u-marisol')
  const labelOf = () => google.boxes[MARISOL]!.labels.find((l) => l.name === LABEL)?.id
  const labelled = () => google.boxes[MARISOL]!.mails.filter((m) => m.labelIds.includes(labelOf() ?? '-')).map((m) => m.id)

  it('tags a three-mail conversation with one file: two lines written, the boxes’ line tied, the raw kept, the label on', async () => {
    const res = await post('marisol-jwt', tagElm)
    expect(res.status).toBe(200)
    const newContact = db.rows('contacts').find((c) => c.name === 'Ana Ruiz')
    expect(res.body).toEqual({ ok: true, jobKey: `pipeline:${ELM}`, lines: 2, tied: 1, files: 1, contactId: 'c-dale', unknownSender: { contactId: newContact?.id, address: 'ana@ridgeway.example', name: 'Ana Ruiz' } })
    expect(newContact).toMatchObject({ kind: 'unknown' })

    // The line bids@ held is tied as the caller, who is stamped; the job joins Dale's jobs.
    expect(rpcs('tie_message')).toEqual([{ who: 'caller', fn: 'tie_message', args: { p_message_id: 'm-box-1', p_job_kind: 'pipeline', p_job_id: ELM }, uid: 'u-marisol' }])
    expect(lines().find((l) => l.id === 'm-box-1')).toMatchObject({ jobs_ledger_id: ELM, tied_by: 'u-marisol', mail_user_id: null })
    expect(db.rows('contact_jobs')).toContainEqual(expect.objectContaining({ contact_id: 'c-dale', jobs_ledger_id: ELM }))

    // Marisol's own answer, as ours to Dale; Ana's mail on Ana. Both from her box, on the job, never the draft.
    expect(rpcs('email_write_line').map((c) => c.who)).toEqual(['admin', 'admin'])
    const [out, ana] = mine()
    expect(out).toMatchObject({
      gmail_id: 'g-marisol-1',
      direction: 'out',
      contact_id: 'c-dale',
      channel_id: 'ch-dale',
      who_user_id: 'u-marisol',
      who_text: "Marisol Vega <marisol@clickplumbing.example> to Dale Okafor <dale@ridgeway.example> · from Marisol Vega's mail",
      body: '$340 more for the 50.',
      gmail_thread_id: 't-elm',
      mailbox: 'mine',
      rfc_message_id: '<marisol-1@clickplumbing.example>',
      mail_user_id: 'u-marisol',
      jobs_ledger_id: ELM,
      bid_id: null,
      project_id: null,
      invitation: null,
    })
    expect(ana).toMatchObject({ gmail_id: 'g-ana-1', direction: 'in', contact_id: newContact?.id, who_user_id: null, mailbox: 'mine', jobs_ledger_id: ELM, rfc_message_id: '<ana-1@ridgeway.example>' })
    expect(lines().some((l) => l.gmail_id === 'g-draft-elm' || l.gmail_id === 'g-dale-1')).toBe(false)

    // The spec sheet copied under her and the mail (the signature's logo left out), its row on Ana's line.
    const specPath = 'mine/u-marisol/g-ana-1/1-elm-ct-spec-sheet.pdf'
    expect(db.rows('message_attachments')).toEqual([expect.objectContaining({ message_id: ana!.id, kind: 'file', name: 'elm-ct-spec-sheet.pdf', mime: 'application/pdf', size_bytes: 2000, bucket_path: specPath, paper: null })])
    expect(db.files[`message-attachments/${specPath}`]!.bytes).toEqual(SPEC)
    // The court-ready copy of each written line, raw, as received.
    for (const l of [out!, ana!]) {
      const eml = db.files[`message-attachments/mine/${l.id}.eml`]
      expect(eml?.contentType).toBe('message/rfc822')
      expect(new TextDecoder().decode(eml!.bytes)).toContain(`Message-ID: ${l.rfc_message_id}`)
    }

    // The conversation's row, and the label on every mail now on the job, the draft left alone.
    expect(db.rows('email_tag_threads')).toEqual([expect.objectContaining({ user_id: 'u-marisol', gmail_thread_id: 't-elm', bid_id: null, project_id: null, jobs_ledger_id: ELM, tagged_by: 'u-marisol' })])
    expect(labelled()).toEqual(['g-dale-1', 'g-marisol-1', 'g-ana-1'])

    // One line of counts in the log, and never a subject, a body or an address in any line.
    expect(logged.filter((l) => l.includes('"event":"gmail_mine_tag"'))).toHaveLength(1)
    for (const line of logged) for (const secret of ['water heater', '50-gal', 'spec sheet', 'ridgeway.example', MARISOL]) expect(line, line).not.toContain(secret)
  })

  it('writes nothing twice on a second tag of the same conversation', async () => {
    await post('marisol-jwt', tagElm)
    const before = { lines: lines().length, files: Object.keys(db.files).length, writes: rpcs('email_write_line').length, places: rpcs('email_place_address').length, ties: rpcs('tie_message').length }
    const again = await post('marisol-jwt', tagElm)
    expect(again.body).toEqual({ ok: true, jobKey: `pipeline:${ELM}`, lines: 0, tied: 0, files: 0, contactId: 'c-dale', unknownSender: null })
    expect({ lines: lines().length, files: Object.keys(db.files).length, writes: rpcs('email_write_line').length, places: rpcs('email_place_address').length, ties: rpcs('tie_message').length }).toEqual(before)
    expect(db.calls.filter((c) => c.includes('storage upload'))).toHaveLength(3)
    expect(db.rows('email_tag_threads')).toHaveLength(1)
  })

  it('moves the person’s own lines with a second tag onto another job, and the conversation’s row with them', async () => {
    await post('marisol-jwt', tagElm)
    const moved = await post('marisol-jwt', { ...tagElm, job: { kind: 'pipeline', id: HARBOR } })
    expect(moved.body).toMatchObject({ ok: true, jobKey: `pipeline:${HARBOR}`, lines: 0, tied: 2, files: 0 })
    expect(mine().map((l) => l.jobs_ledger_id)).toEqual([HARBOR, HARBOR])
    // The boxes' line stays where it was tied.
    expect(lines().find((l) => l.id === 'm-box-1')!.jobs_ledger_id).toBe(ELM)
    expect(db.rows('email_tag_threads')).toEqual([expect.objectContaining({ gmail_thread_id: 't-elm', jobs_ledger_id: HARBOR })])
  })

  it('answers not there for a job that is not, before reading the conversation', async () => {
    expect(await post('marisol-jwt', { ...tagElm, job: { kind: 'pipeline', id: GONE } })).toMatchObject({ status: 404, body: { error: 'notFound' } })
    expect(google.calls.some((c) => c.includes('/threads/'))).toBe(false)
    expect(writes()).toEqual([])
  })

  it('untags: the person’s lines, files and raw copies go, the boxes’ line is untied, the row goes and the label comes off', async () => {
    await post('marisol-jwt', tagElm)
    const res = await post('marisol-jwt', { action: 'untag', threadId: 't-elm' })
    expect(res).toMatchObject({ status: 200, body: { ok: true, removed: 2, keptForMatter: false } })
    expect(mine()).toEqual([])
    expect(db.rows('message_attachments')).toEqual([])
    expect(Object.keys(db.files)).toEqual([])
    // Untied as a person unties it on the thread, as the caller.
    expect(rpcs('tie_message').slice(-1)[0]).toEqual({ who: 'caller', fn: 'tie_message', args: { p_message_id: 'm-box-1', p_job_kind: null, p_job_id: null }, uid: 'u-marisol' })
    expect(lines()).toEqual([expect.objectContaining({ id: 'm-box-1', jobs_ledger_id: null })])
    expect(db.rows('email_tag_threads')).toEqual([])
    expect(labelled()).toEqual([])
  })

  it('leaves a line the database will not let go, with its files, and still takes the tag off', async () => {
    await post('marisol-jwt', tagElm)
    db.refuse['admin delete messages'] = 'update or delete on table "messages" violates foreign key constraint "contact_owed_done_note_message_id_fkey"'
    const res = await post('marisol-jwt', { action: 'untag', threadId: 't-elm' })
    expect(res.body).toEqual({ ok: true, removed: 0, keptForMatter: false })
    expect(mine()).toHaveLength(2)
    expect(Object.keys(db.files)).toHaveLength(3)
    expect(db.rows('email_tag_threads')).toEqual([])
  })
})
