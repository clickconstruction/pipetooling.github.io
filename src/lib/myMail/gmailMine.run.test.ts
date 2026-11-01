/**
 * gmail-mine's own handler, run here (punch list #230 PR 2) on the fakes in `gmailMineFakes.ts`: the caller's gates (a
 * sample, the switch off, an address off the Workspace refused at Google's token exchange), a page of the list with a
 * tagged row, a row the boxes already hold, guessed rows and a folded one, an open, a tag of a three-mail conversation
 * with one file, a second tag that writes nothing twice, a tag onto another job, and an untag. Since PR 4 the tag's grey
 * line on the thread, the untag's `keptForMatter`, and the cron's follow: a later reply landing by itself, a box's line
 * tied, the window and the order, a person whose switch is off, a token Google refuses, a conversation gone from Gmail,
 * the run's limit, and the door the cron alone opens; since its follow-up, the newest mail the window keys on, kept by
 * the tag and moved on by the follow, a conversation tagged with old mail, and a failed row read again in its turn
 * past a run's worth of healthy ones. Since v2.6292: an untag that keeps the lines the office wrote on, marks its row
 * first so the follow lands nothing back, unties the lines its row records and no line tied by hand, and counts the
 * label it could not take off; a tag and a follow that skip a mail under a label the person leaves out, put each
 * written line's person on the job's people, find a mail with no Message-ID by its Gmail id, take back the copies no
 * line holds, and read the person's mail sent from an alias as theirs. The token is signed by the real
 * `_shared/googleToken.ts` with a key made for the run; Google answers from the fake behind `fetch`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MY_MAIL_REFUSAL_WORDS } from './contract'
import { FakeDb, FakeGoogle, fakeServiceAccountJson, type FakeMail, type Row } from './gmailMineFakes'
import { FOLLOW_ROWS_PER_RUN, MY_MAIL_FOLLOW_GONE } from './mineFunction'

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
  CRON_SECRET: 'cron-secret-for-the-run',
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

/** A post as the cron makes it: its secret in `X-Cron-Secret` and no session. */
async function cron(body: unknown, secret: string = ENV.CRON_SECRET!, bearer: string | null = null): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Cron-Secret': secret }
  if (bearer) headers.Authorization = `Bearer ${bearer}`
  const res = await box.handler!(new Request('http://localhost/functions/v1/gmail-mine', { method: 'POST', headers, body: JSON.stringify(body) }))
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
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

  it('reads a page as the person, fills each row from the database, and answers every row of All, the folded one last with its kind', async () => {
    const res = await post('marisol-jwt', { action: 'list', view: 'all' })
    expect(res.status).toBe(200)
    const rows = res.body.rows as Row[]
    // The rows the view draws, then the newsletter behind the fold line, flagged, so the tab draws the line (v2.6292;
    // until then the folded rows never left the function).
    expect(rows.map((r) => r.gmailId)).toEqual(['g-dale-3', 'g-sam', 'g-priya-1', 'g-board', 'g-elm-old', 'g-jo', 'g-news'])
    expect(res.body).toMatchObject({ ok: true, address: MARISOL, nextPageToken: 'page-2', folded: 1 })
    const by = Object.fromEntries(rows.map((r) => [r.gmailId, r]))
    expect(by['g-news']).toMatchObject({ folded: 'bulk', who: { address: 'news@tradeweekly.example' }, tagged: null, guess: null, inMessages: null })
    expect(rows.filter((r) => r.folded !== null).map((r) => r.gmailId)).toEqual(['g-news'])
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
    // What is left to tag, then the newsletter behind the fold line with its kind.
    expect((res.body.rows as Row[]).map((r) => [r.gmailId, r.folded])).toEqual([
      ['g-dale-3', null],
      ['g-sam', null],
      ['g-board', null],
      ['g-jo', null],
      ['g-news', 'bulk'],
    ])
    expect(res.body.folded).toBe(1)
    // Tagged has no fold: what is on a job alone.
    expect((await post('marisol-jwt', { action: 'list', view: 'tagged' })).body).toMatchObject({ folded: 0, rows: [expect.objectContaining({ gmailId: 'g-elm-old', folded: null })] })
    // To tag reads past the tag's label: the database's own record hides what is tagged, so a label left behind never
    // hides a mail. Tagged still reads by the label.
    expect(google.queries[0]).toBe('(in:inbox OR in:sent) -in:drafts -in:spam -in:trash -in:chats -label:"Personal"')
    expect(google.calls[0]).toBe(`${MARISOL} GET /messages?q=${encodeURIComponent(google.queries[0]!)}&maxResults=50`)
    expect(google.queries[1]).toBe('(in:inbox OR in:sent) -in:drafts -in:spam -in:trash -in:chats -label:"Personal" label:"Tagged in ClickTooling"')
  })

  it('draws a mail a stale label is left on in To tag, since no tag row holds its conversation', async () => {
    // The Elm conversation's job was deleted, and its tag row with it; its mail still carries the label in Gmail.
    db.tables.email_tag_threads = []
    google.boxes[MARISOL]!.labels.push({ id: 'Label_tag', name: LABEL })
    google.boxes[MARISOL]!.mails.find((m) => m.id === 'g-elm-old')!.labelIds.push('Label_tag')
    const res = await post('marisol-jwt', { action: 'list', view: 'toTag' })
    expect((res.body.rows as Row[]).map((r) => r.gmailId)).toContain('g-elm-old')
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

  it('moves the person’s own lines with a second tag onto another job, the box’s line the first tag tied, and the row with them', async () => {
    await post('marisol-jwt', tagElm)
    expect(db.rows('email_tag_threads')).toEqual([expect.objectContaining({ tied_line_ids: ['m-box-1'] })])
    const moved = await post('marisol-jwt', { ...tagElm, job: { kind: 'pipeline', id: HARBOR } })
    expect(moved.body).toMatchObject({ ok: true, jobKey: `pipeline:${HARBOR}`, lines: 0, tied: 3, files: 0 })
    expect(mine().map((l) => l.jobs_ledger_id)).toEqual([HARBOR, HARBOR])
    // The boxes' line the first tag tied is the tag's own (its row records it), so it moves too; v2.6292. Until then it
    // stayed on 4 Elm Ct, and an untag after the move left it there.
    expect(lines().find((l) => l.id === 'm-box-1')).toMatchObject({ jobs_ledger_id: HARBOR, tied_by: 'u-marisol' })
    expect(db.rows('email_tag_threads')).toEqual([expect.objectContaining({ gmail_thread_id: 't-elm', jobs_ledger_id: HARBOR, tied_line_ids: ['m-box-1'] })])
    await post('marisol-jwt', { action: 'untag', threadId: 't-elm' })
    expect(lines().find((l) => l.id === 'm-box-1')).toMatchObject({ jobs_ledger_id: null })
  })

  it('keeps the conversation’s newest mail on its row for the follow’s window: a draft left out, the tag’s own time when no mail has one', async () => {
    await post('marisol-jwt', tagElm)
    const [row] = db.rows('email_tag_threads')
    // Ana's spec sheet at 08:15 is the newest mail; Marisol's draft at 09:00 is not mail.
    expect(row).toMatchObject({ last_mail_at: '2026-11-01T08:15:00.000Z', last_read_at: null, last_error: null })
    expect(Date.now() - Date.parse(String(row!.tagged_at))).toBeLessThan(60_000)
    // A conversation whose one mail carries no time: the tag's own time stands in.
    google.boxes[MARISOL]!.mails.push(mail('g-undated', 't-undated', '', { From: DALE, Subject: 'Hello', 'Message-ID': '<undated@ridgeway.example>' }, 'No time on this one.'))
    await post('marisol-jwt', { ...tagElm, threadId: 't-undated' })
    const undated = db.rows('email_tag_threads').find((r) => r.gmail_thread_id === 't-undated')
    expect(undated?.last_mail_at).toBe(undated?.tagged_at)
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
    expect(res.body).toEqual({ ok: true, removed: 0, keptForMatter: false, held: 2, labelLeft: 0 })
    expect(mine()).toHaveLength(2)
    expect(Object.keys(db.files)).toHaveLength(3)
    expect(db.rows('email_tag_threads')).toEqual([])
  })

  const events = () => lines().filter((l) => l.channel === 'event')

  it('writes one grey line in the other party’s thread, tied to the job, and the untag takes it off', async () => {
    await post('marisol-jwt', tagElm)
    const [row] = db.rows('email_tag_threads')
    expect(events()).toEqual([
      expect.objectContaining({
        contact_id: 'c-dale',
        channel: 'event',
        direction: 'team',
        who_text: 'The app',
        body: 'Marisol Vega tagged this conversation from their mail. Later mail in it lands here by itself.',
        quo_id: `mytag:${row!.id}`,
        jobs_ledger_id: ELM,
        bid_id: null,
        project_id: null,
      }),
    ])
    // A second tag writes no second line.
    await post('marisol-jwt', tagElm)
    expect(events()).toHaveLength(1)
    await post('marisol-jwt', { action: 'untag', threadId: 't-elm' })
    expect(events()).toEqual([])
  })

  it('moves the grey line with a tag onto another job, and clears the follow’s place for its next run', async () => {
    await post('marisol-jwt', tagElm)
    Object.assign(db.rows('email_tag_threads')[0]!, { last_read_at: '2026-11-01T15:00:00.000Z', last_error: 'Google did not answer the app.' })
    await post('marisol-jwt', { ...tagElm, job: { kind: 'pipeline', id: HARBOR } })
    expect(events()).toEqual([expect.objectContaining({ jobs_ledger_id: HARBOR, contact_id: 'c-dale' })])
    expect(db.rows('email_tag_threads')).toEqual([expect.objectContaining({ jobs_ledger_id: HARBOR, last_read_at: null, last_error: null })])
  })

  it('says the matter keeps its copy when the Legal desk made a live document from one of the lines, and not otherwise', async () => {
    const untagWith = async (doc: Row | null) => {
      await post('marisol-jwt', tagElm)
      const ana = mine().find((l) => l.gmail_id === 'g-ana-1')!
      db.tables.legal_matter_documents = doc ? [{ id: 'doc-1', matter_id: 'matter-1', source_message_id: ana.id, ...doc }] : []
      return post('marisol-jwt', { action: 'untag', threadId: 't-elm' })
    }
    expect((await untagWith({ voided_at: null })).body).toEqual({ ok: true, removed: 2, keptForMatter: true, held: 0, labelLeft: 0 })
    // The matter's copy stays (ON DELETE SET NULL in the database); the line is gone from the thread.
    expect(mine()).toEqual([])
    expect((await untagWith({ voided_at: '2026-11-01T12:00:00.000Z' })).body).toEqual({ ok: true, removed: 2, keptForMatter: false, held: 0, labelLeft: 0 })
    expect((await untagWith(null)).body).toEqual({ ok: true, removed: 2, keptForMatter: false, held: 0, labelLeft: 0 })
  })

  it('reads no matter copies before the Legal desk’s column is pushed, and still untags', async () => {
    await post('marisol-jwt', tagElm)
    db.refuse['admin select legal_matter_documents'] = { message: 'column legal_matter_documents.source_message_id does not exist', code: '42703' }
    const res = await post('marisol-jwt', { action: 'untag', threadId: 't-elm' })
    expect(res).toMatchObject({ status: 200, body: { ok: true, removed: 2, keptForMatter: false } })
    expect(mine()).toEqual([])
    expect(logged.some((l) => l.includes('"event":"gmail_mine_matters_unread"') && l.includes('"code":"42703"'))).toBe(true)
  })

  // ---------- v2.6292: the review's findings ----------

  it('keeps the lines the office wrote on, a promise and a highlight, with their files, and still takes the tag off', async () => {
    await post('marisol-jwt', tagElm)
    const [out, ana] = mine()
    db.tables.message_promises = [{ id: 'mp-1', message_id: ana!.id, kind: 'payment', state: 'written', day: '2026-11-06' }]
    db.tables.message_highlights = [{ id: 'mh-1', message_id: out!.id, text: '$340 more for the 50.' }]
    const res = await post('marisol-jwt', { action: 'untag', threadId: 't-elm' })
    expect(res.body).toEqual({ ok: true, removed: 0, keptForMatter: false, held: 2, labelLeft: 0 })
    expect(mine().map((l) => l.id)).toEqual([out!.id, ana!.id])
    // What the office wrote stands (a line's delete takes both with it), and so do the spec sheet and both raw copies.
    expect(db.rows('message_promises')).toHaveLength(1)
    expect(db.rows('message_highlights')).toHaveLength(1)
    expect(Object.keys(db.files)).toHaveLength(3)
    expect(db.rows('email_tag_threads')).toEqual([])
    expect(labelled()).toEqual([])
  })

  it('holds a line what we owe was done by, as the database refuses its delete, and removes the rest', async () => {
    await post('marisol-jwt', tagElm)
    const [out] = mine()
    db.tables.contact_owed = [{ id: 'co-1', contact_id: 'c-dale', what: 'The price for the 50', done_at: '2026-11-01T10:00:00.000Z', done_how: 'message', done_note_message_id: out!.id }]
    const res = await post('marisol-jwt', { action: 'untag', threadId: 't-elm' })
    expect(res.body).toEqual({ ok: true, removed: 1, keptForMatter: false, held: 1, labelLeft: 0 })
    expect(mine().map((l) => l.id)).toEqual([out!.id])
    // Its raw copy stays; Ana's line goes with its spec sheet and its raw copy.
    expect(Object.keys(db.files)).toEqual([`message-attachments/mine/${out!.id}.eml`])
  })

  it('marks the row before it takes anything off: the follow lands nothing back on a stopped untag, and the next untag finishes it', async () => {
    await post('marisol-jwt', tagElm)
    const [row] = db.rows('email_tag_threads')
    db.refuse['admin delete email_tag_threads'] = 'canceling statement due to statement timeout'
    const from = db.calls.length
    const stopped = await post('marisol-jwt', { action: 'untag', threadId: 't-elm' })
    expect(stopped).toMatchObject({ status: 500, body: { ok: false, error: 'google' } })
    expect(stopped.body.words).toContain('The untag stopped before the tag came off.')
    const calls = db.calls.slice(from)
    expect(calls.indexOf('admin update email_tag_threads')).toBeGreaterThanOrEqual(0)
    expect(calls.indexOf('admin update email_tag_threads')).toBeLessThan(calls.indexOf('admin delete messages'))
    expect(mine()).toEqual([])
    expect(db.rows('email_tag_threads')).toEqual([expect.objectContaining({ id: row!.id, untagging_at: expect.any(String) })])

    // A run of the follow passes the marked row by: Gmail still holds every mail, and none lands back.
    const written = rpcs('email_write_line').length
    expect((await cron({ action: 'follow' })).body).toEqual({ ok: true, rows: 0, lines: 0, tied: 0, failed: 0 })
    expect(rpcs('email_write_line')).toHaveLength(written)
    expect(mine()).toEqual([])

    // The next untag finds the row, marked, and finishes.
    delete db.refuse['admin delete email_tag_threads']
    expect(await post('marisol-jwt', { action: 'untag', threadId: 't-elm' })).toMatchObject({ status: 200, body: { ok: true, removed: 0 } })
    expect(db.rows('email_tag_threads')).toEqual([])
    expect(labelled()).toEqual([])
  })

  it('clears the mark when the conversation is tagged again after a stopped untag, so the follow reads it again', async () => {
    await post('marisol-jwt', tagElm)
    db.refuse['admin delete email_tag_threads'] = 'canceling statement due to statement timeout'
    await post('marisol-jwt', { action: 'untag', threadId: 't-elm' })
    delete db.refuse['admin delete email_tag_threads']
    expect(await post('marisol-jwt', tagElm)).toMatchObject({ status: 200, body: { ok: true, lines: 2, tied: 1 } })
    expect(db.rows('email_tag_threads')).toEqual([expect.objectContaining({ untagging_at: null, tied_line_ids: ['m-box-1'] })])
    expect((await cron({ action: 'follow' })).body).toEqual({ ok: true, rows: 1, lines: 0, tied: 0, failed: 0 })
  })

  it('never copies a mail under a label the person leaves out, the name read case-blind from their box’s labels', async () => {
    // Marisol leaves out Personal; her box spells it personal, and Ana's mail with the spec sheet carries it.
    google.boxes[MARISOL]!.labels.push({ id: 'Label_7', name: 'personal' })
    google.boxes[MARISOL]!.mails.find((m) => m.id === 'g-ana-1')!.labelIds.push('Label_7')
    const res = await post('marisol-jwt', tagElm)
    expect(res.body).toEqual({ ok: true, jobKey: `pipeline:${ELM}`, lines: 1, tied: 1, files: 0, contactId: 'c-dale', unknownSender: null })
    expect(lines().some((l) => l.gmail_id === 'g-ana-1')).toBe(false)
    expect(db.rows('contacts').some((c) => c.name === 'Ana Ruiz')).toBe(false)
    expect(Object.keys(db.files).some((k) => k.includes('g-ana-1'))).toBe(false)
    expect(labelled()).toEqual(['g-dale-1', 'g-marisol-1'])
  })

  it('stops a tag before anything is written when Gmail will not list the labels the person leaves out', async () => {
    google.labelsDown = true
    const res = await post('marisol-jwt', tagElm)
    expect(res).toMatchObject({ status: 502, body: { ok: false, error: 'google' } })
    expect(writes()).toEqual([])
    expect(lines()).toEqual([expect.objectContaining({ id: 'm-box-1', jobs_ledger_id: null })])
  })

  it('puts each written line’s person on the job’s people once, as a tie does, so their thread draws the job', async () => {
    await post('marisol-jwt', tagElm)
    const ana = db.rows('contacts').find((c) => c.name === 'Ana Ruiz')!
    expect(db.rows('contact_jobs').filter((j) => j.jobs_ledger_id === ELM).map((j) => j.contact_id).sort()).toEqual([ana.id, 'c-dale'].sort())
    // Dale was on it by the tie of the box's line: the insert for his own line stood back on the unique index.
    expect(db.calls.filter((c) => c === 'admin insert contact_jobs')).toHaveLength(2)
    expect(logged.filter((l) => l.includes('"event":"gmail_mine_tag"'))).toEqual([expect.stringContaining('"listed":1,"unlisted":0')])
    await post('marisol-jwt', tagElm)
    expect(db.rows('contact_jobs').filter((j) => j.jobs_ledger_id === ELM)).toHaveLength(2)
  })

  it('unties on an untag the lines its row records, and never one the person tied by hand before the tag', async () => {
    // Before the tag Marisol tied the box's copy of Ana's mail to 4 Elm Ct on the thread herself.
    db.rows('messages').push({ id: 'm-box-ana', contact_id: 'c-dale', gmail_id: 'bx-ana-1', gmail_thread_id: 'bx-t-3', rfc_message_id: '<ana-1@ridgeway.example>', mailbox: 'bids', mail_user_id: null, bid_id: null, project_id: null, jobs_ledger_id: ELM, tied_by: 'u-marisol' })
    await post('marisol-jwt', tagElm)
    expect(db.rows('email_tag_threads')).toEqual([expect.objectContaining({ tied_line_ids: ['m-box-1'] })])
    await post('marisol-jwt', { action: 'untag', threadId: 't-elm' })
    expect(lines().find((l) => l.id === 'm-box-1')).toMatchObject({ jobs_ledger_id: null })
    expect(lines().find((l) => l.id === 'm-box-ana')).toMatchObject({ jobs_ledger_id: ELM, tied_by: 'u-marisol' })
    expect(rpcs('tie_message').map((c) => [c.args.p_message_id, c.args.p_job_id])).toEqual([
      ['m-box-1', ELM],
      ['m-box-1', null],
    ])
  })

  it('leaves a recorded line someone has placed since where they put it, on a tag onto another job and on an untag', async () => {
    await post('marisol-jwt', tagElm)
    Object.assign(lines().find((l) => l.id === 'm-box-1')!, { jobs_ledger_id: null, bid_id: CLUB, tied_by: 'u-rosa' })
    await post('marisol-jwt', { ...tagElm, job: { kind: 'pipeline', id: HARBOR } })
    expect(lines().find((l) => l.id === 'm-box-1')).toMatchObject({ bid_id: CLUB, jobs_ledger_id: null, tied_by: 'u-rosa' })
    await post('marisol-jwt', { action: 'untag', threadId: 't-elm' })
    expect(lines().find((l) => l.id === 'm-box-1')).toMatchObject({ bid_id: CLUB, tied_by: 'u-rosa' })
  })

  it('lists and tags the person’s mail sent from an alias as theirs, going out to the customer', async () => {
    google.boxes[MARISOL]!.mails = [
      mail('g-alias', 't-alias', '2026-11-01T09:00:00.000Z', { From: 'Click Estimating <estimating@clickplumbing.example>', To: DALE, Subject: 'Elm Ct numbers', 'Message-ID': '<alias-1@clickplumbing.example>' }, 'Numbers for the 50.', {
        labelIds: ['SENT'],
      }),
    ]
    const listed = await post('marisol-jwt', { action: 'list', view: 'all' })
    expect(listed.body.rows).toEqual([expect.objectContaining({ gmailId: 'g-alias', direction: 'out', who: { name: 'Dale Okafor', address: 'dale@ridgeway.example' }, folded: null })])
    await post('marisol-jwt', { action: 'tag', threadId: 't-alias', job: { kind: 'pipeline', id: ELM } })
    expect(mine()).toEqual([expect.objectContaining({ gmail_id: 'g-alias', direction: 'out', contact_id: 'c-dale', who_user_id: 'u-marisol' })])
    expect(db.rows('contacts').some((c) => c.name === 'Click Estimating')).toBe(false)
  })

  it('counts in its answer the mails the label would not come off, and logs the count alone', async () => {
    await post('marisol-jwt', tagElm)
    google.stuck.add('g-ana-1')
    logged.length = 0
    const res = await post('marisol-jwt', { action: 'untag', threadId: 't-elm' })
    expect(res.body).toEqual({ ok: true, removed: 2, keptForMatter: false, held: 0, labelLeft: 1 })
    expect(labelled()).toEqual(['g-ana-1'])
    expect(logged.filter((l) => l.includes('"event":"gmail_mine_label_left"'))).toEqual([JSON.stringify({ event: 'gmail_mine_label_left', user: 'u-marisol', left: 1, mails: 4 })])
    // A box whose labels cannot be read may still carry the label on every mail a tag labels, never the draft.
    google.stuck.clear()
    await post('marisol-jwt', tagElm)
    google.labelsDown = true
    expect((await post('marisol-jwt', { action: 'untag', threadId: 't-elm' })).body).toEqual({ ok: true, removed: 2, keptForMatter: false, held: 0, labelLeft: 3 })
  })

  it('finds the line of a mail with no Message-ID by its Gmail id, so a tag onto another job moves it and copies nothing again', async () => {
    google.boxes[MARISOL]!.mails = [
      mail('g-bare', 't-bare', '2026-11-01T10:00:00.000Z', { From: DALE, Subject: 'Closet photos' }, 'Two photos of the closet.', {
        files: [{ partId: '1', name: 'closet.jpg', mime: 'image/jpeg', bytes: SPEC, attachmentId: 'att-closet' }],
      }),
    ]
    await post('marisol-jwt', { action: 'tag', threadId: 't-bare', job: { kind: 'pipeline', id: ELM } })
    const [bare] = mine()
    expect(bare).toMatchObject({ gmail_id: 'g-bare', rfc_message_id: null, jobs_ledger_id: ELM })
    const uploads = db.calls.filter((c) => c.includes('storage upload')).length
    const moved = await post('marisol-jwt', { action: 'tag', threadId: 't-bare', job: { kind: 'pipeline', id: HARBOR } })
    expect(moved.body).toMatchObject({ ok: true, lines: 0, tied: 1, files: 0 })
    expect(mine()).toEqual([expect.objectContaining({ id: bare!.id, jobs_ledger_id: HARBOR })])
    expect(rpcs('email_write_line')).toHaveLength(1)
    expect(db.calls.filter((c) => c.includes('storage upload'))).toHaveLength(uploads)
  })

  it('takes back the copies when a box wrote the line a moment before, as no line names them', async () => {
    const path = 'mine/u-marisol/g-ana-1/1-elm-ct-spec-sheet.pdf'
    // bids@ takes Ana's mail between the tag's read and its write.
    db.onRpc = (fn, args) => {
      if (fn !== 'email_write_line' || args.p_gmail_id !== 'g-ana-1' || lines().some((l) => l.id === 'm-box-ana')) return
      db.rows('messages').push({ id: 'm-box-ana', contact_id: 'c-dale', gmail_id: 'bx-ana-1', gmail_thread_id: 'bx-t-3', rfc_message_id: '<ana-1@ridgeway.example>', mailbox: 'bids', mail_user_id: null, bid_id: null, project_id: null, jobs_ledger_id: null, tied_by: null })
      db.rows('message_attachments').push({ id: 'ma-box', message_id: 'm-box-ana', kind: 'file', name: 'elm-ct-spec-sheet.pdf', bucket_path: 'bx-ana-1/1-elm-ct-spec-sheet.pdf' })
    }
    const res = await post('marisol-jwt', tagElm)
    expect(res.body).toMatchObject({ ok: true, lines: 1, tied: 1, files: 0 })
    expect(db.files[`message-attachments/${path}`]).toBeUndefined()
    expect(db.calls).toContain('admin storage remove 1')
    expect(logged.filter((l) => l.includes('"event":"gmail_mine_tag"'))).toEqual([expect.stringContaining('"copiesRemoved":1,"copiesLeft":0')])
  })

  it('keeps every copy the line that stood names, when this person’s own write landed the same mail a moment before', async () => {
    const path = 'mine/u-marisol/g-ana-1/1-elm-ct-spec-sheet.pdf'
    db.onRpc = (fn, args) => {
      if (fn !== 'email_write_line' || args.p_gmail_id !== 'g-ana-1' || lines().some((l) => l.id === 'm-mine-ana')) return
      db.rows('messages').push({ id: 'm-mine-ana', contact_id: 'c-ana', gmail_id: 'g-ana-1', gmail_thread_id: 't-elm', rfc_message_id: '<ana-1@ridgeway.example>', mailbox: 'mine', mail_user_id: 'u-marisol', bid_id: null, project_id: null, jobs_ledger_id: ELM, tied_by: null })
      db.rows('message_attachments').push({ id: 'ma-mine', message_id: 'm-mine-ana', kind: 'file', name: 'elm-ct-spec-sheet.pdf', bucket_path: path })
    }
    await post('marisol-jwt', tagElm)
    expect(db.files[`message-attachments/${path}`]?.bytes).toEqual(SPEC)
    expect(db.calls.some((c) => c.startsWith('admin storage remove'))).toBe(false)
  })
})

describe('gmail-mine: follow, the cron’s', () => {
  const tagElm = { action: 'tag', threadId: 't-elm', job: { kind: 'pipeline', id: ELM } }
  const ROSA = 'rosa@clickplumbing.example'
  const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
  const tagRow = (id: string, userId: string, threadId: string, over: Row = {}): Row => ({
    id,
    user_id: userId,
    gmail_thread_id: threadId,
    bid_id: null,
    project_id: null,
    jobs_ledger_id: ELM,
    tagged_by: userId,
    tagged_at: ago(1),
    last_mail_at: null,
    last_read_at: null,
    last_error: null,
    ...over,
  })
  const threadReads = () => google.calls.filter((c) => c.includes(' GET /threads/')).map((c) => /\/threads\/([^?]+)/.exec(c)![1])
  const fullReads = () => google.calls.filter((c) => /GET \/messages\/[^/?]+\?format=full/.test(c)).map((c) => /\/messages\/([^?]+)/.exec(c)![1])
  const rowOf = (id: string) => db.rows('email_tag_threads').find((r) => r.id === id)
  const labelOf = () => google.boxes[MARISOL]!.labels.find((l) => l.name === LABEL)?.id

  describe('after a tag', () => {
    beforeEach(async () => {
      google.boxes[MARISOL]!.mails = elmThread()
      db.tables.messages = [{ id: 'm-box-1', contact_id: 'c-dale', gmail_id: 'bx-dale-1', gmail_thread_id: 'bx-t-1', rfc_message_id: '<dale-1@ridgeway.example>', mailbox: 'bids', mail_user_id: null, bid_id: null, project_id: null, jobs_ledger_id: null, tied_by: null }]
      await post('marisol-jwt', tagElm)
      // Later: Dale answers in Marisol's box alone; Ana writes again with bids@ copied, which took it first and left it on no job.
      google.boxes[MARISOL]!.mails.push(
        mail('g-dale-2', 't-elm', '2026-11-01T16:00:00.000Z', { From: DALE, Subject: 'Re: 4 Elm Ct water heater', 'Message-ID': '<dale-2@ridgeway.example>' }, 'Go with the 50 then.'),
        mail('g-ana-2', 't-elm', '2026-11-01T16:30:00.000Z', { From: 'Ana Ruiz <ana@ridgeway.example>', Cc: 'bids@clickplumbing.example', Subject: 'Re: 4 Elm Ct water heater', 'Message-ID': '<ana-2@ridgeway.example>' }, 'Delivery is Friday.'),
      )
      const ana = db.rows('contacts').find((c) => c.name === 'Ana Ruiz')!
      db.rows('messages').push({ id: 'm-box-2', contact_id: ana.id, gmail_id: 'bx-ana-2', gmail_thread_id: 'bx-t-2', rfc_message_id: '<ana-2@ridgeway.example>', mailbox: 'bids', mail_user_id: null, bid_id: null, project_id: null, jobs_ledger_id: null, tied_by: null })
      google.calls.length = 0
      logged.length = 0
    })

    it('lands a new reply on the job by itself, ties the one a box holds, and passes over what is already a line', async () => {
      const writesBefore = rpcs('email_write_line').length
      const res = await cron({ action: 'follow' })
      expect(res).toEqual({ status: 200, body: { ok: true, rows: 1, lines: 1, tied: 1, failed: 0 } })

      // Dale's reply, as the tag writes a mail: on Dale, from Marisol's box, on the job, with its raw copy.
      const dale2 = lines().find((l) => l.gmail_id === 'g-dale-2')
      expect(dale2).toMatchObject({
        direction: 'in',
        contact_id: 'c-dale',
        channel_id: 'ch-dale',
        who_text: "Dale Okafor <dale@ridgeway.example> to Marisol Vega's mail",
        body: 'Go with the 50 then.',
        gmail_thread_id: 't-elm',
        mailbox: 'mine',
        rfc_message_id: '<dale-2@ridgeway.example>',
        mail_user_id: 'u-marisol',
        jobs_ledger_id: ELM,
      })
      expect(db.files[`message-attachments/mine/${dale2!.id}.eml`]?.contentType).toBe('message/rfc822')
      expect(rpcs('email_write_line')).toHaveLength(writesBefore + 1)

      // The box's line of Ana's mail is tied as the service role, stamped with who tagged it; the job joins Ana's jobs.
      expect(rpcs('tie_message').slice(-1)).toEqual([{ who: 'admin', fn: 'tie_message', args: { p_message_id: 'm-box-2', p_job_kind: 'pipeline', p_job_id: ELM }, uid: null }])
      expect(lines().find((l) => l.id === 'm-box-2')).toMatchObject({ jobs_ledger_id: ELM, tied_by: 'u-marisol', mail_user_id: null })
      expect(lines().some((l) => l.gmail_id === 'g-ana-2')).toBe(false)

      // Read by the headers, and only the new mail whole; both now carry the label.
      expect(threadReads()).toEqual(['t-elm'])
      expect(google.calls.find((c) => c.includes('/threads/t-elm'))).toContain('format=metadata&metadataHeaders=From')
      expect(fullReads()).toEqual(['g-dale-2'])
      const labelled = google.boxes[MARISOL]!.mails.filter((m) => m.labelIds.includes(labelOf() ?? '-')).map((m) => m.id)
      expect(labelled).toEqual(expect.arrayContaining(['g-dale-2', 'g-ana-2']))

      // The row's place moves, and nothing is wrong with it.
      const row = db.rows('email_tag_threads')[0]!
      expect(row.last_error).toBeNull()
      expect(Date.now() - Date.parse(String(row.last_read_at))).toBeLessThan(60_000)

      // One line of counts, never a subject, a body or an address.
      expect(logged.filter((l) => l.includes('"event":"gmail_mine_follow"'))).toEqual([expect.stringContaining('"rows":1,"people":1,"lines":1,"tied":1,"failed":0')])
      for (const line of logged) for (const secret of ['water heater', 'Go with the 50', 'Delivery', 'ridgeway.example', MARISOL]) expect(line, line).not.toContain(secret)

      // The next run finds every mail a line and writes nothing.
      const again = await cron({ action: 'follow' })
      expect(again.body).toEqual({ ok: true, rows: 1, lines: 0, tied: 0, failed: 0 })
      expect(rpcs('email_write_line')).toHaveLength(writesBefore + 1)
    })

    it('moves the newest mail on when later mail comes, and never back when none does or a mail is gone', async () => {
      const row = db.rows('email_tag_threads')[0]!
      expect(row.last_mail_at).toBe('2026-11-01T08:15:00.000Z')
      await cron({ action: 'follow' })
      // Dale's reply landed at 16:00 and Ana's mail at 16:30 was tied: Ana's is the newest.
      expect(row.last_mail_at).toBe('2026-11-01T16:30:00.000Z')
      // A run with nothing new moves the read and leaves the newest mail.
      row.last_read_at = '2026-11-01T16:45:00.000Z'
      expect((await cron({ action: 'follow' })).body).toEqual({ ok: true, rows: 1, lines: 0, tied: 0, failed: 0 })
      expect(row).toMatchObject({ last_mail_at: '2026-11-01T16:30:00.000Z', last_error: null })
      expect(row.last_read_at).not.toBe('2026-11-01T16:45:00.000Z')
      // Ana's last mail deleted from Gmail since: the window stays where that mail put it.
      google.boxes[MARISOL]!.mails = google.boxes[MARISOL]!.mails.filter((m) => m.id !== 'g-ana-2')
      await cron({ action: 'follow' })
      expect(row.last_mail_at).toBe('2026-11-01T16:30:00.000Z')
    })

    it('never moves a line a person placed: one the office untied, one tied elsewhere, the person’s own moved by hand', async () => {
      Object.assign(lines().find((l) => l.id === 'm-box-2')!, { tied_by: 'u-rosa' })
      Object.assign(lines().find((l) => l.id === 'm-box-1')!, { jobs_ledger_id: null, bid_id: CLUB, tied_by: 'u-rosa' })
      Object.assign(lines().find((l) => l.gmail_id === 'g-marisol-1')!, { jobs_ledger_id: HARBOR, tied_by: 'u-rosa' })
      google.boxes[MARISOL]!.mails = google.boxes[MARISOL]!.mails.filter((m) => m.id !== 'g-dale-2')
      const ties = rpcs('tie_message').length
      const res = await cron({ action: 'follow' })
      expect(res.body).toEqual({ ok: true, rows: 1, lines: 0, tied: 0, failed: 0 })
      expect(rpcs('tie_message')).toHaveLength(ties)
      expect(lines().find((l) => l.id === 'm-box-2')).toMatchObject({ jobs_ledger_id: null, tied_by: 'u-rosa' })
      expect(lines().find((l) => l.gmail_id === 'g-marisol-1')).toMatchObject({ jobs_ledger_id: HARBOR })
    })

    it('records the box’s line it ties on the row, so an untag unties it, and puts a new person of later mail on the job', async () => {
      google.boxes[MARISOL]!.mails.push(
        mail('g-lee', 't-elm', '2026-11-01T17:00:00.000Z', { From: 'Lee Tran <lee@ridgeway.example>', Subject: 'Re: 4 Elm Ct water heater', 'Message-ID': '<lee-1@ridgeway.example>' }, 'Adding Lee for the install.'),
      )
      await cron({ action: 'follow' })
      // Recorded before the tie, beside the tag's own.
      expect(db.rows('email_tag_threads')[0]).toMatchObject({ tied_line_ids: ['m-box-1', 'm-box-2'] })
      const lee = db.rows('contacts').find((c) => c.name === 'Lee Tran')!
      expect(db.rows('contact_jobs')).toContainEqual(expect.objectContaining({ contact_id: lee.id, jobs_ledger_id: ELM }))
      await post('marisol-jwt', { action: 'untag', threadId: 't-elm' })
      expect(lines().filter((l) => l.mailbox === 'bids').map((l) => [l.id, l.jobs_ledger_id])).toEqual([
        ['m-box-1', null],
        ['m-box-2', null],
      ])
    })

    it('passes over later mail under a label the person leaves out, held by a box’s line or not', async () => {
      google.boxes[MARISOL]!.labels.push({ id: 'Label_7', name: 'Personal' })
      for (const id of ['g-dale-2', 'g-ana-2']) google.boxes[MARISOL]!.mails.find((m) => m.id === id)!.labelIds.push('Label_7')
      expect((await cron({ action: 'follow' })).body).toEqual({ ok: true, rows: 1, lines: 0, tied: 0, failed: 0 })
      expect(lines().some((l) => l.gmail_id === 'g-dale-2')).toBe(false)
      expect(lines().find((l) => l.id === 'm-box-2')).toMatchObject({ jobs_ledger_id: null, tied_by: null })
      expect(fullReads()).toEqual([])
    })

    it('marks a person’s rows as a failed read when Gmail will not list the labels they leave out', async () => {
      google.labelsDown = true
      expect((await cron({ action: 'follow' })).body).toEqual({ ok: true, rows: 1, lines: 0, tied: 0, failed: 1 })
      expect(db.rows('email_tag_threads')[0]).toMatchObject({ last_error: expect.stringContaining(MY_MAIL_REFUSAL_WORDS.google), last_read_at: expect.any(String) })
      expect(threadReads()).toEqual([])
    })
  })

  it('reads the least recently read first in the window, skips a switch that is off, and runs on past a failure, marking it read', async () => {
    google.boxes[MARISOL]!.mails = elmThread()
    google.refuse[ROSA] = { status: 401, body: { error: 'unauthorized_client', error_description: 'Client is unauthorized to retrieve access tokens using this method.' } }
    const [errAt, rosaAt, oldAt] = [ago(4), ago(3), ago(70)]
    db.tables.email_tag_threads = [
      tagRow('tag-elm', 'u-marisol', 't-elm', { tagged_at: ago(1) }),
      tagRow('tag-err', 'u-marisol', 't-err', { tagged_at: ago(20), last_read_at: errAt, last_error: 'Google did not answer the app.' }),
      tagRow('tag-gone', 'u-marisol', 't-gone', { tagged_at: ago(5) }),
      tagRow('tag-rosa', 'u-rosa', 't-rosa', { tagged_at: ago(10), last_read_at: rosaAt }),
      tagRow('tag-old', 'u-marisol', 't-old', { tagged_at: ago(90), last_read_at: oldAt }),
      tagRow('tag-olive', 'u-off', 't-olive', { tagged_at: ago(1) }),
    ]
    const res = await cron({ action: 'follow' })
    // The Elm conversation's three mails land (no line held them); the gone ones and Rosa's fail, and the run goes on.
    expect(res.body).toEqual({ ok: true, rows: 4, lines: 3, tied: 0, failed: 3 })
    expect(google.subs).toEqual([MARISOL, ROSA])
    expect(threadReads()).toEqual(['t-gone', 't-elm', 't-err'])

    // A failed read is a read: its time moves with its reason, so it waits its turn again behind the rest.
    expect(rowOf('tag-gone')).toMatchObject({ last_read_at: expect.any(String), last_error: MY_MAIL_FOLLOW_GONE })
    expect(rowOf('tag-elm')).toMatchObject({ last_read_at: expect.any(String), last_error: null })
    expect(rowOf('tag-err')).toMatchObject({ last_error: MY_MAIL_FOLLOW_GONE })
    expect(rowOf('tag-err')!.last_read_at).not.toBe(errAt)
    expect(rowOf('tag-rosa')).toMatchObject({
      last_read_at: expect.any(String),
      last_error: `${MY_MAIL_REFUSAL_WORDS.offWorkspace} Google said: Client is unauthorized to retrieve access tokens using this method.`,
    })
    expect(rowOf('tag-rosa')!.last_read_at).not.toBe(rosaAt)
    // Out of the window, and a person whose switch is off: never read, never marked.
    expect(rowOf('tag-old')).toMatchObject({ last_read_at: oldAt, last_error: null })
    expect(rowOf('tag-olive')).toMatchObject({ last_read_at: null, last_error: null })
    expect(google.subs).not.toContain('olive@clickplumbing.example')
    expect(lines().filter((l) => l.mail_user_id === 'u-marisol')).toHaveLength(3)
  })

  it('stops 60 days after a conversation’s newest mail however lately it was read, and 60 days after a tag with nothing new', async () => {
    const [quietAt, dormantAt, liveAt, readAt] = [ago(61), ago(90), ago(59), ago(1)]
    google.boxes[MARISOL]!.mails = [
      mail('g-quiet', 't-quiet', quietAt, { From: DALE, Subject: 'Old walk', 'Message-ID': '<quiet@ridgeway.example>' }, 'See you then.'),
      mail('g-dormant', 't-dormant', dormantAt, { From: DALE, Subject: 'Older walk', 'Message-ID': '<dormant@ridgeway.example>' }, 'Thanks.'),
      mail('g-live', 't-live', liveAt, { From: DALE, Subject: 'Elm punch list', 'Message-ID': '<live@ridgeway.example>' }, 'Two items left.'),
    ]
    db.tables.email_tag_threads = [
      // Read yesterday, as PR 4 read it for good, but its newest mail is 61 days old and its tag older: quiet.
      tagRow('tag-quiet', 'u-marisol', 't-quiet', { tagged_at: ago(70), last_mail_at: quietAt, last_read_at: readAt }),
      // Tagged 61 days ago onto a conversation whose newest mail was older, and nothing since: the tag's 60 days ran out.
      tagRow('tag-dormant', 'u-marisol', 't-dormant', { tagged_at: ago(61), last_mail_at: dormantAt, last_read_at: readAt }),
      // Its newest mail 59 days old: still followed.
      tagRow('tag-live', 'u-marisol', 't-live', { tagged_at: ago(70), last_mail_at: liveAt, last_read_at: readAt }),
    ]
    const res = await cron({ action: 'follow' })
    expect(res.body).toEqual({ ok: true, rows: 1, lines: 1, tied: 0, failed: 0 })
    expect(threadReads()).toEqual(['t-live'])
    expect(rowOf('tag-live')).toMatchObject({ last_mail_at: liveAt, last_error: null })
    expect(rowOf('tag-live')!.last_read_at).not.toBe(readAt)
    for (const id of ['tag-quiet', 'tag-dormant']) expect(rowOf(id), id).toMatchObject({ last_read_at: readAt, last_error: null })
    expect([rowOf('tag-quiet')!.last_mail_at, rowOf('tag-dormant')!.last_mail_at]).toEqual([quietAt, dormantAt])
  })

  it('follows a conversation tagged today whose newest mail is 90 days old, so a reply after the tag lands', async () => {
    const [firstAt, answerAt] = [ago(95), ago(90)]
    google.boxes[MARISOL]!.mails = [
      mail('g-old-1', 't-old', firstAt, { From: DALE, Subject: 'Harbor Ln sewer line', 'Message-ID': '<old-1@ridgeway.example>' }, 'Can you scope the sewer line?'),
      mail('g-old-2', 't-old', answerAt, { From: `Marisol Vega <${MARISOL}>`, To: DALE, Subject: 'Re: Harbor Ln sewer line', 'Message-ID': '<old-2@clickplumbing.example>' }, 'Next month works.', { labelIds: ['SENT'] }),
    ]
    await post('marisol-jwt', { action: 'tag', threadId: 't-old', job: { kind: 'pipeline', id: HARBOR } })
    const row = db.rows('email_tag_threads')[0]!
    expect(row).toMatchObject({ gmail_thread_id: 't-old', last_mail_at: answerAt })
    // The tag's grey line says later mail lands by itself, so the tag holds the conversation for 60 days: Dale answers
    // after the tag, and the next run lands his reply and moves the window on from it.
    const replyAt = ago(0.001)
    google.boxes[MARISOL]!.mails.push(mail('g-old-3', 't-old', replyAt, { From: DALE, Subject: 'Re: Harbor Ln sewer line', 'Message-ID': '<old-3@ridgeway.example>' }, 'Still want it done. Thursday?'))
    google.calls.length = 0
    const res = await cron({ action: 'follow' })
    expect(res.body).toEqual({ ok: true, rows: 1, lines: 1, tied: 0, failed: 0 })
    expect(threadReads()).toEqual(['t-old'])
    expect(lines().find((l) => l.gmail_id === 'g-old-3')).toMatchObject({ jobs_ledger_id: HARBOR, mail_user_id: 'u-marisol', direction: 'in' })
    expect(row.last_mail_at).toBe(replyAt)
  })

  it('reads in turn past a run’s worth: a row Google stumbled on is read again the next run, never starved by healthy ones', async () => {
    // A run's worth of healthy conversations, every mail a line already, and one older than all of them.
    const box = google.boxes[MARISOL]!
    for (let i = 0; i < FOLLOW_ROWS_PER_RUN; i++) {
      const rfc = `<steady-${i}@ridgeway.example>`
      box.mails.push(mail(`g-steady-${i}`, `t-steady-${i}`, ago(2), { From: DALE, Subject: `Punch item ${i}`, 'Message-ID': rfc }, 'Done.'))
      db.rows('messages').push({ id: `m-steady-${i}`, contact_id: 'c-dale', gmail_id: `g-steady-${i}`, gmail_thread_id: `t-steady-${i}`, rfc_message_id: rfc, mailbox: 'mine', mail_user_id: 'u-marisol', bid_id: null, project_id: null, jobs_ledger_id: ELM, tied_by: null })
    }
    box.mails.push(mail('g-blip', 't-blip', ago(2), { From: DALE, Subject: 'Walk on Friday', 'Message-ID': '<blip@ridgeway.example>' }, 'Friday at nine works.'))
    db.tables.email_tag_threads = [
      tagRow('tag-blip', 'u-marisol', 't-blip', { tagged_at: ago(30) }),
      ...Array.from({ length: FOLLOW_ROWS_PER_RUN }, (_, i) => tagRow(`tag-steady-${i}`, 'u-marisol', `t-steady-${i}`, { tagged_at: ago(29 - i * 0.01) })),
    ]
    const last = `tag-steady-${FOLLOW_ROWS_PER_RUN - 1}`

    // The first run: Google stumbles on the oldest conversation, and the newest healthy one waits for the next run.
    google.down.add('t-blip')
    expect((await cron({ action: 'follow' })).body).toEqual({ ok: true, rows: FOLLOW_ROWS_PER_RUN, lines: 0, tied: 0, failed: 1 })
    expect(threadReads()[0]).toBe('t-blip')
    expect(rowOf('tag-blip')).toMatchObject({ last_read_at: expect.any(String), last_error: expect.stringContaining(MY_MAIL_REFUSAL_WORDS.google), last_mail_at: null })
    expect(rowOf('tag-blip')!.last_error).toContain('Backend Error')
    expect(rowOf(last)).toMatchObject({ last_read_at: null })

    // The next run, Google back: the one never read first, then the stumbled one in its turn, ahead of the rows read
    // after it, so Dale's mail lands and the reason clears. Ordered failed-last, a run's worth of healthy rows would
    // have kept it out of every run.
    google.down.delete('t-blip')
    google.calls.length = 0
    expect((await cron({ action: 'follow' })).body).toEqual({ ok: true, rows: FOLLOW_ROWS_PER_RUN, lines: 1, tied: 0, failed: 0 })
    expect(threadReads().slice(0, 2)).toEqual([`t-steady-${FOLLOW_ROWS_PER_RUN - 1}`, 't-blip'])
    expect(rowOf('tag-blip')).toMatchObject({ last_error: null })
    expect(lines().find((l) => l.gmail_id === 'g-blip')).toMatchObject({ jobs_ledger_id: ELM, mail_user_id: 'u-marisol' })
  })

  it('reads at most a run’s worth of conversations, and leaves the newest for the next run', async () => {
    db.tables.email_tag_threads = Array.from({ length: FOLLOW_ROWS_PER_RUN + 2 }, (_, i) => tagRow(`tag-${i}`, 'u-marisol', `t-none-${i}`, { tagged_at: ago(30 - i * 0.01) }))
    const res = await cron({ action: 'follow' })
    expect(res.body).toEqual({ ok: true, rows: FOLLOW_ROWS_PER_RUN, lines: 0, tied: 0, failed: FOLLOW_ROWS_PER_RUN })
    expect(threadReads()).toHaveLength(FOLLOW_ROWS_PER_RUN)
    expect(google.subs).toEqual([MARISOL])
    expect([rowOf(`tag-${FOLLOW_ROWS_PER_RUN}`), rowOf(`tag-${FOLLOW_ROWS_PER_RUN + 1}`)]).toEqual([
      expect.objectContaining({ last_error: null }),
      expect.objectContaining({ last_error: null }),
    ])
  })

  it('puts a person of later mail on each job whose conversation they write in, in one run', async () => {
    const LEE = 'Lee Tran <lee@ridgeway.example>'
    google.boxes[MARISOL]!.mails = [
      mail('g-lee-elm', 't-lee-elm', ago(1), { From: LEE, Subject: 'Elm install', 'Message-ID': '<lee-elm@ridgeway.example>' }, 'Elm is Tuesday.'),
      mail('g-lee-harbor', 't-lee-harbor', ago(1), { From: LEE, Subject: 'Harbor install', 'Message-ID': '<lee-harbor@ridgeway.example>' }, 'Harbor is Thursday.'),
    ]
    db.tables.email_tag_threads = [tagRow('tag-elm', 'u-marisol', 't-lee-elm', { tagged_at: ago(2) }), tagRow('tag-harbor', 'u-marisol', 't-lee-harbor', { tagged_at: ago(1), jobs_ledger_id: HARBOR })]
    expect((await cron({ action: 'follow' })).body).toEqual({ ok: true, rows: 2, lines: 2, tied: 0, failed: 0 })
    const lee = db.rows('contacts').find((c) => c.name === 'Lee Tran')!
    expect(db.rows('contact_jobs').filter((j) => j.contact_id === lee.id).map((j) => j.jobs_ledger_id)).toEqual([ELM, HARBOR])
  })

  it('passes by a row an untag marks after the run picked it, before its read or before anything lands', async () => {
    google.boxes[MARISOL]!.mails = ['a', 'b', 'c'].map((x) => mail(`g-${x}`, `t-${x}`, ago(1), { From: DALE, Subject: `Walk ${x}`, 'Message-ID': `<${x}@ridgeway.example>` }, 'See you there.'))
    db.tables.email_tag_threads = [tagRow('tag-a', 'u-marisol', 't-a', { tagged_at: ago(3) }), tagRow('tag-b', 'u-marisol', 't-b', { tagged_at: ago(2) }), tagRow('tag-c', 'u-marisol', 't-c', { tagged_at: ago(1) })]
    // Marisol presses Untag on B while the run reads A, and on C while the run reads C itself.
    google.onThreadRead = (id) => {
      if (id === 't-a') rowOf('tag-b')!.untagging_at = new Date().toISOString()
      if (id === 't-c') rowOf('tag-c')!.untagging_at = new Date().toISOString()
    }
    const res = await cron({ action: 'follow' })
    expect(res.body).toEqual({ ok: true, rows: 3, lines: 1, tied: 0, failed: 0 })
    expect(threadReads()).toEqual(['t-a', 't-c'])
    expect(lines().map((l) => l.gmail_id)).toEqual(['g-a'])
    for (const id of ['tag-b', 'tag-c']) expect(rowOf(id), id).toMatchObject({ last_read_at: null, last_error: null })
    expect(logged.filter((l) => l.includes('"event":"gmail_mine_follow"'))).toEqual([expect.stringContaining('"untagging":2')])
  })

  it('opens to the cron’s secret alone: a signed-in person and a wrong secret are refused, and the secret runs nothing else', async () => {
    db.tables.email_tag_threads = [tagRow('tag-elm', 'u-marisol', 't-elm')]
    expect(await post('marisol-jwt', { action: 'follow' })).toMatchObject({ status: 400, body: { ok: false, error: 'badRequest', words: MY_MAIL_REFUSAL_WORDS.badRequest } })
    expect(await cron({ action: 'follow' }, 'not-the-secret')).toMatchObject({ status: 401, body: { ok: false, error: 'signIn' } })
    expect(await cron({ action: 'follow' }, 'not-the-secret', 'marisol-jwt')).toMatchObject({ status: 400, body: { error: 'badRequest' } })
    expect(await cron({ action: 'list', view: 'all' })).toMatchObject({ status: 400, body: { error: 'badRequest' } })
    expect(google.subs).toEqual([])
    expect(writes()).toEqual([])
    expect(rowOf('tag-elm')).toMatchObject({ last_read_at: null, last_error: null })
  })
})
