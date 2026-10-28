/**
 * quo-webhook's own handler, run here on a call nobody answered (punch list #195 PR 1, `to-dos/missed-call-text/README.md`).
 * Dana calls the company number on a Friday afternoon and lets it ring out; Quo posts `call.completed` with
 * `status: 'unanswered'`. With the card on, the webhook writes the missed call's line, claims the call in
 * `missed_call_replies`, reads the gates and texts her back through Quo as the app, the line marked `auto`. Quo's retry
 * of the same event finds the claim and sends nothing. With the card off nothing is claimed. With Send texts off the
 * claim says why. A voicemail gets the voicemail line.
 *
 * The URL imports are stood in for, the database is a fake that applies the function's filters and keeps what the
 * webhook writes to `missed_call_replies`, and `fetch` is caught so nothing leaves: Quo's send answers an id.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { QUO_API_VERSION } from './events'
import { MISSED_REPLY_DEFAULTS } from './missedReply'

type Handler = (req: Request) => Promise<Response>
type Row = Record<string, unknown>

interface Fake {
  tables: Record<string, Row[]>
  rpcs: Array<{ name: string; args: Row | undefined }>
  /** Every POST to Quo: the request's body. */
  sends: Row[]
  /** The claims as the webhook left them. */
  claims: Row[]
  /** The lines a plain insert wrote (the app's text when Quo answers no id, the team events). */
  inserted: Array<{ table: string; row: Row }>
}

const DANA = '+15125550187'
const BOXES_ROW = JSON.stringify({ team: { address: 'team@clickplumbing.example', phone: '(512) 994-2774', numberId: 'PN-team' }, bids: {} })
const settingRow = (on: boolean) => JSON.stringify({ ...MISSED_REPLY_DEFAULTS, on })

function freshFake(over: { cardOn?: boolean; textsOn?: boolean; lastText?: string | null } = {}): Fake {
  const { cardOn = true, textsOn = true, lastText = null } = over
  return {
    tables: {
      app_settings: [
        { key: 'messages_boxes_v1', value_text: BOXES_ROW },
        { key: 'messages_missed_call_reply_v1', value_text: settingRow(cardOn) },
        { key: 'messages_texts_on_v1', value_text: textsOn ? 'true' : 'false' },
        { key: 'messages_office_hours_v1', value_text: JSON.stringify({ days: [0, 1, 2, 3, 4, 5, 6], opens: '00:00', closes: '23:59', techUntil: '17:00', emergency: null, always: false }) },
      ],
      users: [],
      contact_jobs: [],
      contacts: [{ id: 'c-dana', prospect_id: null, customer_id: null }],
      contact_channels: [{ id: 'ch-dana', opted_out_by_box: {} }],
      messages: lastText ? [{ id: 'm-old', channel_id: 'ch-dana', channel: 'text', direction: 'out', mailbox: 'team', at: lastText }] : [],
      message_attachments: [],
      missed_call_replies: [],
    },
    rpcs: [],
    sends: [],
    claims: [],
    inserted: [],
  }
}

/** A query chain with the filters the webhook uses. `missed_call_replies` keeps its writes; every other write changes nothing. */
function table(fake: Fake, name: string) {
  const where: Array<(r: Row) => boolean> = []
  let writing: null | { kind: 'upsert' | 'update' | 'insert'; row: Row; ignoreDuplicates?: boolean } = null
  const rows = () => (fake.tables[name] ?? []).filter((r) => where.every((w) => w(r)))
  const chain: Record<string, unknown> = {}
  const self = () => chain
  for (const m of ['select', 'order', 'limit', 'not', 'or', 'neq', 'gt', 'gte', 'lt', 'lte']) chain[m] = self
  chain.eq = (c: string, v: unknown) => (where.push((r) => r[c] === v), chain)
  chain.in = (c: string, vs: unknown[]) => (where.push((r) => vs.includes(r[c])), chain)
  chain.is = (c: string, v: unknown) => (where.push((r) => (r[c] ?? null) === v), chain)
  chain.update = (row: Row) => ((writing = { kind: 'update', row }), chain)
  chain.insert = (row: Row) => ((writing = { kind: 'insert', row }), chain)
  chain.upsert = (row: Row, opts?: { ignoreDuplicates?: boolean }) => ((writing = { kind: 'upsert', row, ignoreDuplicates: opts?.ignoreDuplicates }), chain)
  /** What a write answers: PostgREST's rows for the claims table, nothing for the rest. */
  const written = (): Row[] => {
    if (!writing) return rows()
    if (name !== 'missed_call_replies') {
      if (writing.kind === 'insert') fake.inserted.push({ table: name, row: writing.row })
      return writing.kind === 'insert' ? [{ id: `m-ins-${fake.inserted.length}` }] : []
    }
    const list = fake.tables[name]!
    if (writing.kind === 'upsert') {
      const key = writing.row.call_quo_id
      if (list.some((r) => r.call_quo_id === key)) return []
      const row = { outcome: 'claimed', ...writing.row }
      list.push(row)
      fake.claims = list
      return [row]
    }
    const hit = list.filter((r) => where.every((w) => w(r)))
    for (const r of hit) Object.assign(r, writing.row)
    return hit
  }
  chain.maybeSingle = () => Promise.resolve({ data: written()[0] ?? null, error: null })
  chain.single = () => {
    const row = written()[0]
    return Promise.resolve(row ? { data: row, error: null } : { data: null, error: { message: `no ${name} row` } })
  }
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve({ data: written(), error: null }).then(resolve, reject)
  return chain
}

function client(fake: Fake) {
  return {
    from: (name: string) => table(fake, name),
    rpc: async (name: string, args?: Row) => {
      fake.rpcs.push({ name, args })
      switch (name) {
        case 'quo_webhook_claim':
          return { data: true, error: null }
        case 'quo_place_number':
          return { data: [{ placed_contact: 'c-dana', placed_channel: 'ch-dana', stopped_at: null, placed_kind: 'unknown', placed_name: String(args?.p_value), placed_goes_by: null }], error: null }
        case 'quo_write_line':
          return { data: [{ written: true, id: `m-${fake.rpcs.length}` }], error: null }
        default:
          return { data: null, error: null }
      }
    },
  }
}

const box: { handler: Handler | null; fake: Fake } = { handler: null, fake: freshFake() }

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({ createClient: () => client(box.fake) }))

const SECRET_BYTES = new TextEncoder().encode('missed-call-webhook-secret-bytes')
const SECRET = 'whsec_' + Buffer.from(SECRET_BYTES).toString('base64')
const ENV: Record<string, string> = {
  SUPABASE_URL: 'http://127.0.0.1:9',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  QUO_WEBHOOK_SECRET: SECRET,
  QUO_API_KEY: 'quo-key',
  QUO_PHONE_NUMBER_ID: 'PN-team',
  QUO_COMPANY_NAME: 'Click Plumbing',
  QUO_COMPANY_PHONE: '(512) 994-2774',
}

const FUNCTION_FILE = '../../../supabase/functions/quo-webhook/index.ts'

const realFetch = globalThis.fetch
beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    box.fake.sends.push(JSON.parse(String(init?.body ?? '{}')) as Row)
    return new Response(JSON.stringify({ data: { id: `MS-back-${box.fake.sends.length}` } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  await import(/* @vite-ignore */ FUNCTION_FILE)
})
afterAll(() => {
  globalThis.fetch = realFetch
})

let deliveries = 0

async function sign(id: string, stamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', SECRET_BYTES, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${stamp}.${body}`)))
  return 'v1,' + Buffer.from(bytes).toString('base64')
}

async function deliver(type: string, resource: Row, context: Row): Promise<{ status: number; body: Row }> {
  deliveries += 1
  const body = JSON.stringify({
    id: `EV-${deliveries}`,
    apiVersion: QUO_API_VERSION,
    createdAt: '2026-10-23T21:11:30.000Z',
    type,
    data: { resource, context: { orgId: 'OR-click', ...context }, links: { quo: null } },
  })
  const id = `wh-${deliveries}`
  const stamp = String(Math.floor(Date.now() / 1000))
  const res = await box.handler!(
    new Request('http://localhost/functions/v1/quo-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'webhook-id': id, 'webhook-timestamp': stamp, 'webhook-signature': await sign(id, stamp, body) },
      body,
    }),
  )
  return { status: res.status, body: (await res.json()) as Row }
}

/** Dana's call rang out: Quo's `call.completed`, unanswered, with or without a voicemail. */
const rangOut = (hasVoicemail = false, id = 'CA-dana') =>
  deliver(
    'call.completed',
    { id, direction: 'incoming', status: 'unanswered', createdAt: '2026-10-23T21:11:00.000Z', duration: 0, hasVoicemail, userId: null },
    { phoneNumberId: 'PN-team', userId: null, participants: { workspace: [], external: [DANA], resolution: 'available' } },
  )

const linesWritten = () => box.fake.rpcs.filter((r) => r.name === 'quo_write_line').map((r) => r.args?.p_row as Row)

describe('quo-webhook texts back after a missed call (punch list #195)', () => {
  beforeEach(() => {
    box.fake = freshFake()
  })

  it('writes the missed call, claims it, texts Dana the in-hours line as the app, and marks the line auto', async () => {
    expect(await rangOut()).toEqual({ status: 200, body: { ok: true } })
    const lines = linesWritten()
    expect(lines.map((l) => [l.channel, l.direction, l.who_text, l.auto])).toEqual([
      ['missed', 'in', 'rang everyone · no voicemail', false],
      ['text', 'out', 'The app texted back · from the company number', true],
    ])
    expect(box.fake.sends).toEqual([{ content: `${MISSED_REPLY_DEFAULTS.inHours}\n\nClick Plumbing. Reply STOP to opt out.`, from: 'PN-team', to: [DANA] }])
    expect(box.fake.claims).toEqual([
      expect.objectContaining({ call_quo_id: 'CA-dana', contact_id: 'c-dana', channel_id: 'ch-dana', outcome: 'sent', line: 'in_hours', reason: null, words: MISSED_REPLY_DEFAULTS.inHours, message_id: expect.any(String) }),
    ])
  })

  it('answers the same call once: Quo’s retry finds the claim and sends nothing', async () => {
    await rangOut()
    await rangOut()
    expect(box.fake.sends).toHaveLength(1)
    expect(box.fake.claims).toHaveLength(1)
  })

  it('sends the voicemail line when they left one', async () => {
    await rangOut(true)
    expect(linesWritten()[0]).toMatchObject({ channel: 'voicemail' })
    expect(box.fake.sends[0]?.content).toContain(MISSED_REPLY_DEFAULTS.voicemail)
    expect(box.fake.claims[0]).toMatchObject({ outcome: 'sent', line: 'voicemail' })
  })

  it('claims nothing while the card is off', async () => {
    box.fake = freshFake({ cardOn: false })
    expect(await rangOut()).toEqual({ status: 200, body: { ok: true } })
    expect(linesWritten()).toHaveLength(1)
    expect(box.fake.sends).toEqual([])
    expect(box.fake.claims).toEqual([])
  })

  it('writes why nothing went: Send texts off, and a text of ours in the last three hours', async () => {
    box.fake = freshFake({ textsOn: false })
    await rangOut()
    expect(box.fake.sends).toEqual([])
    expect(box.fake.claims[0]).toMatchObject({ outcome: 'not_sent', reason: 'texts-off', words: 'Send texts is off.', line: null })

    box.fake = freshFake({ lastText: new Date(Date.now() - 40 * 60_000).toISOString() })
    await rangOut(false, 'CA-dana-2')
    expect(box.fake.sends).toEqual([])
    expect(box.fake.claims[0]).toMatchObject({ outcome: 'not_sent', reason: 'recent-text' })
    expect(String(box.fake.claims[0]?.words)).toMatch(/^We texted this number at \d{1,2}:\d{2} [AP]M\.$/)
  })

  it('texts back on call.missed alone, the only event Quo sends for a call that reaches the greeting and hangs up (v2.6035)', async () => {
    const res = await deliver('call.missed', { id: 'CA-hangup', createdAt: '2026-10-23T21:11:00.000Z' }, { phoneNumberId: 'PN-team', participants: { workspace: [], external: [DANA], resolution: 'available' } })
    expect(res).toEqual({ status: 200, body: { ok: true } })
    expect(linesWritten().map((l) => [l.channel, l.direction, l.auto])).toEqual([
      ['missed', 'in', false],
      ['text', 'out', true],
    ])
    expect(box.fake.sends).toHaveLength(1)
    expect(box.fake.claims[0]).toMatchObject({ call_quo_id: 'CA-hangup', outcome: 'sent', line: 'in_hours' })
  })

  it('texts once when both call.missed and call.completed arrive for one call', async () => {
    await deliver('call.missed', { id: 'CA-both', createdAt: '2026-10-23T21:11:00.000Z' }, { phoneNumberId: 'PN-team', participants: { workspace: [], external: [DANA], resolution: 'available' } })
    await rangOut(false, 'CA-both')
    expect(box.fake.sends).toHaveLength(1)
    expect(box.fake.claims).toHaveLength(1)
    expect(box.fake.claims[0]).toMatchObject({ call_quo_id: 'CA-both', outcome: 'sent' })
  })

  it('texts nobody back on a call someone answered', async () => {
    await deliver(
      'call.completed',
      { id: 'CA-taken', direction: 'incoming', status: 'answered', createdAt: '2026-10-23T21:11:00.000Z', duration: 90, hasVoicemail: false, userId: null },
      { phoneNumberId: 'PN-team', userId: null, participants: { workspace: [], external: [DANA], resolution: 'available' } },
    )
    expect(box.fake.sends).toEqual([])
    expect(box.fake.claims).toEqual([])
  })
})
