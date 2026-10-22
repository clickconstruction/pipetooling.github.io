/**
 * quo-webhook's own handler, run here on the four events of the walk kit's text legs (punch list #142 PR 1;
 * `to-dos/walk-kit/README.md` steps 3 and 6). The estimate text goes from the company number to the bids number, and
 * Quo reports it twice: `message.delivered` on the company number (to the bids number) and its mirror,
 * `message.received` on the bids number (from the company number). The reply goes the other way, reported twice too.
 * With the kit carrying the bids number, the two events on the company number land as two lines on the kit's contact
 * and the two mirrors are ignored; no contact is made. With no kit, all four are ignored and no contact is made either.
 * Before this rule, each of the four would have made a Who is this? row for one of our own numbers.
 *
 * The URL imports are stood in for, the database is a fake that applies the function's filters, and `fetch` is caught
 * so nothing leaves. Every delivery is signed the Standard Webhooks way, since the handler verifies first.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { QUO_API_VERSION } from './events'

type Handler = (req: Request) => Promise<Response>
type Row = Record<string, unknown>

interface Fake {
  tables: Record<string, Row[]>
  /** Every rpc, with its args. */
  rpcs: Array<{ name: string; args: Row | undefined }>
  /** Contacts quo_place_number would have made: a number nobody carries. */
  made: string[]
  /** The kit's rows, or none. */
  kit: boolean
}

const TEAM = '+15129942774'
const BIDS = '+17373009478'
const BOXES_ROW = JSON.stringify({
  team: { address: 'team@clickplumbing.example', phone: '(512) 994-2774', numberId: 'PN-team' },
  bids: { address: 'bids@clickplumbing.example', phone: '(737) 300-9478', numberId: 'PN-bids' },
})
const KIT_ROW = JSON.stringify({
  customerId: 'cu-walk',
  contactId: 'c-walk',
  emailChannelId: 'ch-walk-email',
  phoneChannelId: 'ch-walk-phone',
  estimateId: 'e-walk',
  email: 'bids@clickplumbing.example',
  phone: '(737) 300-9478',
  testerId: 'u-tester',
  sharedPhone: false,
  madeAt: '2026-10-22T14:00:00.000Z',
})

const box: { handler: Handler | null; fake: Fake } = { handler: null, fake: freshFake(true) }

function freshFake(kit: boolean): Fake {
  return {
    kit,
    tables: {
      app_settings: [{ key: 'messages_boxes_v1', value_text: BOXES_ROW }, ...(kit ? [{ key: 'walk_kit_v1', value_text: KIT_ROW }] : [])],
      users: [],
      contact_jobs: [],
      contact_channels: [{ id: 'ch-walk-phone', opted_out_by_box: {} }],
      messages: [],
      message_attachments: [],
    },
    rpcs: [],
    made: [],
  }
}

/** A query chain with the filters the webhook uses; a write answers like PostgREST and changes nothing. */
function table(fake: Fake, name: string) {
  const where: Array<(r: Row) => boolean> = []
  let writing = false
  const rows = () => (writing ? [] : (fake.tables[name] ?? []).filter((r) => where.every((w) => w(r))))
  const chain: Record<string, unknown> = {}
  const self = () => chain
  for (const m of ['select', 'order', 'limit', 'not', 'or', 'neq', 'gt', 'gte', 'lt', 'lte']) chain[m] = self
  chain.eq = (c: string, v: unknown) => (where.push((r) => r[c] === v), chain)
  chain.in = (c: string, vs: unknown[]) => (where.push((r) => vs.includes(r[c])), chain)
  chain.is = (c: string, v: unknown) => (where.push((r) => (r[c] ?? null) === v), chain)
  chain.update = () => ((writing = true), chain)
  chain.insert = () => ((writing = true), chain)
  chain.upsert = () => ((writing = true), chain)
  chain.maybeSingle = () => Promise.resolve({ data: rows()[0] ?? null, error: null })
  chain.single = () => {
    const row = rows()[0]
    return Promise.resolve(row ? { data: row, error: null } : { data: null, error: { message: `no ${name} row` } })
  }
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(resolve, reject)
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
        case 'quo_place_number': {
          const value = String(args?.p_value)
          if (value === BIDS && fake.kit) {
            return { data: [{ placed_contact: 'c-walk', placed_channel: 'ch-walk-phone', stopped_at: null, placed_kind: 'customer', placed_name: 'ZZ Walk Messages Desk', placed_goes_by: null }], error: null }
          }
          // Nobody carries it: the Who is this? row this rule exists to prevent.
          fake.made.push(value)
          const n = fake.made.length
          fake.tables.contact_channels!.push({ id: `ch-made-${n}`, opted_out_by_box: {} })
          return { data: [{ placed_contact: `c-made-${n}`, placed_channel: `ch-made-${n}`, stopped_at: null, placed_kind: 'unknown', placed_name: value, placed_goes_by: null }], error: null }
        }
        case 'quo_write_line':
          return { data: [{ written: true, id: `m-${fake.rpcs.length}` }], error: null }
        default:
          return { data: null, error: null }
      }
    },
  }
}

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (h: Handler) => void (box.handler = h) }))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({ createClient: () => client(box.fake) }))

const SECRET_BYTES = new TextEncoder().encode('walk-kit-webhook-secret-bytes')
const SECRET = 'whsec_' + Buffer.from(SECRET_BYTES).toString('base64')
const ENV: Record<string, string> = {
  SUPABASE_URL: 'http://127.0.0.1:9',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  QUO_WEBHOOK_SECRET: SECRET,
  QUO_COMPANY_NAME: 'Click Plumbing',
  QUO_COMPANY_PHONE: '(512) 994-2774',
}

const FUNCTION_FILE = '../../../supabase/functions/quo-webhook/index.ts'

const realFetch = globalThis.fetch
beforeAll(async () => {
  ;(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => ENV[k] } }
  globalThis.fetch = (async () => new Response('{}', { status: 503 })) as typeof fetch
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

/** One signed delivery to the handler: its status and body. */
async function deliver(type: string, resource: Row, context: Row): Promise<{ status: number; body: Row }> {
  deliveries += 1
  const body = JSON.stringify({
    id: `EV-${deliveries}`,
    apiVersion: QUO_API_VERSION,
    createdAt: '2026-10-22T14:05:00.000Z',
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

/** README step 3: the estimate text, company number → bids number, and Quo's mirror of it on the bids number. */
const estimateOut = () =>
  deliver('message.delivered', { id: 'MS-estimate', direction: 'outgoing', text: 'Your estimate is ready.', createdAt: '2026-10-22T14:05:00.000Z' }, {
    phoneNumberId: 'PN-team',
    recipientIdentifiers: [BIDS],
    userId: null,
  })
const estimateMirror = () =>
  deliver('message.received', { id: 'MS-estimate-mirror', direction: 'incoming', text: 'Your estimate is ready.', createdAt: '2026-10-22T14:05:01.000Z' }, {
    phoneNumberId: 'PN-bids',
    senderIdentifier: TEAM,
    recipientIdentifiers: [BIDS],
  })
/** README step 6: the reply, bids number → company number, and its mirror on the bids number. */
const replyIn = () =>
  deliver('message.received', { id: 'MS-reply', direction: 'incoming', text: 'Thursday works', createdAt: '2026-10-22T14:06:00.000Z' }, {
    phoneNumberId: 'PN-team',
    senderIdentifier: BIDS,
    recipientIdentifiers: [TEAM],
  })
const replyMirror = () =>
  deliver('message.delivered', { id: 'MS-reply-mirror', direction: 'outgoing', text: 'Thursday works', createdAt: '2026-10-22T14:06:01.000Z' }, {
    phoneNumberId: 'PN-bids',
    recipientIdentifiers: [TEAM],
    userId: null,
  })

const placedNumbers = () => box.fake.rpcs.filter((r) => r.name === 'quo_place_number').map((r) => String(r.args?.p_value))
const linesWritten = () => box.fake.rpcs.filter((r) => r.name === 'quo_write_line').map((r) => r.args?.p_row as Row)

describe("quo-webhook under the walk kit's rule (punch list #142 PR 1)", () => {
  beforeEach(() => {
    box.fake = freshFake(true)
  })

  it('lands the estimate text and the reply as two lines on the kit’s contact, ignores their mirrors, and makes no contact', async () => {
    expect(await estimateOut()).toEqual({ status: 200, body: { ok: true } })
    expect(await estimateMirror()).toEqual({ status: 200, body: { ok: true, ignored: 'our own number, the kit does not carry it' } })
    expect(await replyIn()).toEqual({ status: 200, body: { ok: true } })
    expect(await replyMirror()).toEqual({ status: 200, body: { ok: true, ignored: 'our own numbers' } })

    expect(placedNumbers()).toEqual([BIDS, BIDS])
    const lines = linesWritten()
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => [l.contact_id, l.channel_id, l.direction, l.body, l.mailbox])).toEqual([
      ['c-walk', 'ch-walk-phone', 'out', 'Your estimate is ready.', 'team'],
      ['c-walk', 'ch-walk-phone', 'in', 'Thursday works', 'team'],
    ])
    expect(box.fake.made).toEqual([])
  })

  it('with no kit, ignores all four and makes no contact either', async () => {
    box.fake = freshFake(false)
    expect(await estimateOut()).toEqual({ status: 200, body: { ok: true, ignored: 'our own numbers' } })
    expect(await estimateMirror()).toEqual({ status: 200, body: { ok: true, ignored: 'our own number, the kit does not carry it' } })
    expect(await replyIn()).toEqual({ status: 200, body: { ok: true, ignored: 'our own number, the kit does not carry it' } })
    expect(await replyMirror()).toEqual({ status: 200, body: { ok: true, ignored: 'our own numbers' } })
    expect(placedNumbers()).toEqual([])
    expect(linesWritten()).toEqual([])
    expect(box.fake.made).toEqual([])
  })

  it('still places a customer’s number as always, with or without a kit', async () => {
    const greg = '+12105550100'
    const customerIn = () =>
      deliver('message.received', { id: 'MS-greg', direction: 'incoming', text: 'Running late', createdAt: '2026-10-22T14:07:00.000Z' }, {
        phoneNumberId: 'PN-team',
        senderIdentifier: greg,
        recipientIdentifiers: [TEAM],
      })
    expect(await customerIn()).toEqual({ status: 200, body: { ok: true } })
    box.fake = freshFake(false)
    expect(await customerIn()).toEqual({ status: 200, body: { ok: true } })
    expect(placedNumbers()).toEqual([greg])
    expect(linesWritten().map((l) => [l.contact_id, l.direction, l.body])).toEqual([['c-made-1', 'in', 'Running late']])
  })

  it('ignores our own number placed on a record that is not the kit’s, and writes nothing there', async () => {
    // The kit names another contact: the bids number now lands on c-walk by the database's pick, which is not the kit's.
    box.fake.tables.app_settings = box.fake.tables.app_settings!.map((r) => (r.key === 'walk_kit_v1' ? { ...r, value_text: KIT_ROW.replace('"contactId":"c-walk"', '"contactId":"c-other"') } : r))
    expect(await replyIn()).toEqual({ status: 200, body: { ok: true, ignored: "our own number was placed on c-walk, not the walk kit's contact" } })
    expect(await estimateOut()).toEqual({ status: 200, body: { ok: true, ignored: 'our own numbers' } })
    expect(linesWritten()).toEqual([])
    expect(box.fake.made).toEqual([])
  })
})
