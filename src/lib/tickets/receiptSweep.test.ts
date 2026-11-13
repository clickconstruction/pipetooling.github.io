/**
 * The receipt text's sweep (punch list #299, PR 2) over a database and a sender that are stood in. What these prove:
 * the switch off sends and writes nothing, a charge is texted once, charges that wait together share a text, every
 * reason a text cannot go is written and never texted, a trial texts only its people, a refused text loses nothing,
 * and the one reminder goes in its evening. Every name and number is made up.
 */
import { describe, expect, it } from 'vitest'
import { runReceiptSweep, type ReceiptPlaced, type ReceiptSendOutcome, type ReceiptSweepDoors } from '../../../supabase/functions/_shared/receiptSweep'
import { RECEIPT_TEXTS_KEY } from './receiptText'

type Row = Record<string, unknown>

/** The little of PostgREST the sweep uses, over arrays in memory. */
class Query implements PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> {
  private tests: ((r: Row) => boolean)[] = []
  private op: 'select' | 'update' | 'insert' | 'delete' = 'select'
  private payload: Row = {}
  private sort: { col: string; asc: boolean } | null = null
  private max = Infinity
  private one = false
  constructor(private db: FakeDb, private table: string) {}
  select() {
    return this
  }
  update(payload: Row) {
    this.op = 'update'
    this.payload = payload
    return this
  }
  insert(payload: Row) {
    this.op = 'insert'
    this.payload = payload
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }
  in(col: string, vals: unknown[]) {
    this.tests.push((r) => vals.includes(r[col]))
    return this
  }
  eq(col: string, v: unknown) {
    this.tests.push((r) => r[col] === v)
    return this
  }
  is(col: string, v: null) {
    this.tests.push((r) => (r[col] ?? null) === v)
    return this
  }
  not(col: string, _op: 'is', v: null) {
    this.tests.push((r) => (r[col] ?? null) !== v)
    return this
  }
  gt(col: string, v: string | number) {
    this.tests.push((r) => (r[col] as string | number) > v)
    return this
  }
  gte(col: string, v: string | number) {
    this.tests.push((r) => r[col] != null && (r[col] as string | number) >= v)
    return this
  }
  lt(col: string, v: string | number) {
    this.tests.push((r) => r[col] != null && (r[col] as string | number) < v)
    return this
  }
  order(col: string, o: { ascending: boolean }) {
    this.sort = { col, asc: o.ascending }
    return this
  }
  limit(n: number) {
    this.max = n
    return this
  }
  single() {
    this.one = true
    return this
  }
  private run(): { data: unknown; error: { message: string; code?: string } | null } {
    const list = (this.db.tables[this.table] ??= [])
    if (this.op === 'insert') {
      const row = { id: `${this.table}-${list.length + 1}`, ...this.payload }
      list.push(row)
      this.db.writes.push({ table: this.table, op: 'insert' })
      return { data: this.one ? { ...row } : [{ ...row }], error: null }
    }
    const hit = list.filter((r) => this.tests.every((t) => t(r)))
    if (this.op === 'delete') {
      this.db.tables[this.table] = list.filter((r) => !hit.includes(r))
      this.db.writes.push({ table: this.table, op: 'delete' })
      return { data: null, error: null }
    }
    if (this.op === 'update') {
      for (const r of hit) Object.assign(r, this.payload)
      if (hit.length > 0) this.db.writes.push({ table: this.table, op: 'update' })
      return { data: hit.map((r) => ({ ...r })), error: null }
    }
    let out = hit.map((r) => ({ ...r }))
    if (this.sort) {
      const { col, asc } = this.sort
      out = out.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1))
    }
    return { data: out.slice(0, this.max), error: null }
  }
  then<A, B>(ok?: ((v: { data: unknown; error: { message: string; code?: string } | null }) => A | PromiseLike<A>) | null, no?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.run()).then(ok, no)
  }
}

class FakeDb {
  writes: { table: string; op: string }[] = []
  constructor(
    public tables: Record<string, Row[]>,
    /** Whose card each charge is on, for the ensure. */
    private holderOf: Record<string, string | null>,
  ) {}
  from(table: string) {
    return new Query(this, table)
  }
  async rpc(fn: string, args: { p_transaction_id: string }) {
    if (fn !== 'receipt_request_ensure') return { data: null, error: { message: `no such function ${fn}` } }
    const list = (this.tables.receipt_requests ??= [])
    let row = list.find((r) => r.mercury_transaction_id === args.p_transaction_id)
    if (!row) {
      const holder = this.holderOf[args.p_transaction_id] ?? null
      const name = (this.tables.users ?? []).find((u) => u.id === holder)?.name ?? ''
      row = { id: `req-${args.p_transaction_id}`, mercury_transaction_id: args.p_transaction_id, holder_user_id: holder, holder_name: name, no_text_why: null, cell: null, texted_at: null, reminded_at: null, answered_at: null, closed_at: null, ticket_id: null, closes_at: '2026-11-18T00:00:00.000Z', text_tries: 0, text_fail_why: null, created_at: '2026-11-04T00:00:00.000Z' }
      list.push(row)
      this.writes.push({ table: 'receipt_requests', op: 'insert' })
    }
    return { data: { ...row }, error: null }
  }
}

const JORDAN = '00000000-0000-0000-0000-0000000000b1'
const SAM = '00000000-0000-0000-0000-0000000000b2'
const SINCE = '2026-11-04T12:00:00.000Z'
// Wed Nov 4, 2:30 PM on the company's clock.
const NOW = Date.parse('2026-11-04T20:30:00.000Z')

const charge = (id: string, postedAt: string | null, more: Row = {}): Row => ({ id, kind: 'debitCardTransaction', amount: -228.58, status: 'sent', posted_at: postedAt, counterparty_name: 'Ridgeway Supply', duplicate_of_transaction_id: null, ...more })
const user = (id: string, name: string, phone: string | null, more: Row = {}): Row => ({ id, name, phone, archived_at: null, ...more })

function world(a: { charges: Row[]; holderOf?: Record<string, string | null>; users?: Row[]; requests?: Row[]; tickets?: Row[]; setting?: string | null; textsOn?: boolean; stopped?: string[]; send?: (body: string) => ReceiptSendOutcome; now?: number }) {
  const db = new FakeDb({ mercury_transactions: a.charges, users: a.users ?? [user(JORDAN, 'Jordan Vance', '(512) 555-0100'), user(SAM, 'Sam Okoro', '512-555-0101')], receipt_requests: a.requests ?? [], receipt_links: [], counter_tickets: a.tickets ?? [] }, a.holderOf ?? {})
  const sent: { to: string; body: string; first: boolean }[] = []
  const texted = new Set<string>()
  let settingReads = 0
  const doors: ReceiptSweepDoors = {
    admin: db,
    nowMs: a.now ?? NOW,
    settingText: async (key) => {
      settingReads += 1
      expect(key).toBe(RECEIPT_TEXTS_KEY)
      return a.setting === undefined ? JSON.stringify({ on: true, since: SINCE, only: [] }) : a.setting
    },
    textsOn: async () => a.textsOn ?? true,
    cellOf: (raw) => {
      const d = raw.replace(/\D/g, '')
      return d.length === 10 ? `+1${d}` : null
    },
    place: async (cell): Promise<ReceiptPlaced> => ({ contactId: `contact-${cell}`, channelId: `channel-${cell}`, number: cell, optedOut: (a.stopped ?? []).includes(cell) }),
    lastTextAt: async (channelId) => (texted.has(channelId) ? 1 : null),
    send: async (to, body, last) => {
      const out = a.send ? a.send(body) : ({ ok: true, segments: 1 } as const)
      if (out.ok) {
        sent.push({ to: to.number, body, first: last === null })
        texted.add(to.channelId)
      }
      return out
    },
    companyName: 'Click Plumbing',
    randomBytes: (n) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + sent.length * 13 + db.tables.receipt_links!.length * 29) % 248),
    sha256Hex: async (value) => `hash-of-${value}`.padEnd(64, '0'),
  }
  const requests = () => db.tables.receipt_requests as Row[]
  return { db, doors, sent, requests, links: () => db.tables.receipt_links as Row[], settingReads: () => settingReads }
}

describe('the switch', () => {
  it('off: nothing is read past the switch, nothing is written, nothing is sent', async () => {
    const w = world({ charges: [charge('c1', '2026-11-04T19:00:00.000Z')], holderOf: { c1: JORDAN }, setting: '{"on":false}' })
    // Any touch of the database would throw.
    w.doors.admin = new Proxy({}, { get: () => () => { throw new Error('the database was touched') } })
    expect(await runReceiptSweep(w.doors)).toEqual({ ok: true, state: 'off' })
    expect(w.sent).toEqual([])
    expect(w.db.writes).toEqual([])
    // No row, no words, the other switch's word, on with no day, not JSON, and a trial list that does not read.
    for (const stored of [null, '', 'true', '{"on":true}', 'not json', `{"on":true,"since":"${SINCE}","only":["jordan"]}`, `{"on":true,"since":"${SINCE}","only":"everyone"}`]) {
      const again = world({ charges: [], setting: stored })
      again.doors.admin = w.doors.admin
      expect(await runReceiptSweep(again.doors), String(stored)).toEqual({ ok: true, state: 'off' })
    }
  })

  it('on, with Send texts off: the same nothing, so the first sweep after it is on asks as usual', async () => {
    const w = world({ charges: [charge('c1', '2026-11-04T19:00:00.000Z')], holderOf: { c1: JORDAN }, textsOn: false })
    expect(await runReceiptSweep(w.doors)).toEqual({ ok: true, state: 'texts_off' })
    expect(w.sent).toEqual([])
    expect(w.db.writes).toEqual([])
  })

  it('a dry run counts and writes and sends nothing, whatever the switch says', async () => {
    const w = world({ charges: [charge('c1', '2026-11-04T19:00:00.000Z'), charge('c2', '2026-11-04T19:05:00.000Z'), charge('old', '2026-11-01T19:00:00.000Z')], tickets: [{ id: 't1', mercury_transaction_id: 'c2', removed_at: null }], setting: '{"on":false}' })
    expect(await runReceiptSweep(w.doors, { dry: true })).toEqual({ ok: true, state: 'dry', posted: 2, asked: 0, withTicket: 1, wouldAsk: 1 })
    expect(w.sent).toEqual([])
    expect(w.db.writes).toEqual([])
  })
})

describe('a charge that posts', () => {
  it('is asked once: the first text names the person and the company, and a second sweep sends nothing', async () => {
    const w = world({ charges: [charge('c1', '2026-11-04T19:00:00.000Z')], holderOf: { c1: JORDAN } })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ state: 'on', made: 1, texted: 1, reminded: 0, held: 0 })
    expect(w.sent).toHaveLength(1)
    expect(w.sent[0]!.to).toBe('+15125550100')
    expect(w.sent[0]!.body).toMatch(/^Hi Jordan, this is Click Plumbing\. \$228\.58 at Ridgeway Supply posted to your card today\. Snap the receipt here: https:\/\/clicktooling\.com\/r\/[2-9a-z]{10}$/)
    expect(w.requests()[0]).toMatchObject({ cell: '+15125550100', texted_at: new Date(NOW).toISOString(), no_text_why: null })
    expect(w.links()).toHaveLength(1)
    expect(w.links()[0]).toMatchObject({ made_for: 'text', request_ids: ['req-c1'] })
    // The code itself is never kept: the link row holds its hash alone.
    const code = w.sent[0]!.body.slice(-10)
    expect(JSON.stringify(w.links())).not.toContain(`"${code}"`)
    expect(w.links()[0]!.code_hash).toBe(`hash-of-${code}`.padEnd(64, '0'))
    expect(await runReceiptSweep(w.doors)).toMatchObject({ made: 0, texted: 0 })
    expect(w.sent).toHaveLength(1)
  })

  it('two sweeps that overlap text the charge once', async () => {
    const w = world({ charges: [charge('c1', '2026-11-04T19:00:00.000Z')], holderOf: { c1: JORDAN } })
    await Promise.all([runReceiptSweep(w.doors), runReceiptSweep(w.doors)])
    expect(w.sent).toHaveLength(1)
  })

  it('is never asked when it is pending, money back, failed, a duplicate, from before the switch, or has its ticket', async () => {
    const w = world({
      charges: [
        charge('pending', null),
        charge('refund', '2026-11-04T19:00:00.000Z', { amount: 41.17 }),
        charge('failed', '2026-11-04T19:00:00.000Z', { status: 'failed' }),
        charge('twin', '2026-11-04T19:00:00.000Z', { duplicate_of_transaction_id: 'c0' }),
        charge('before', '2026-11-04T11:59:00.000Z'),
        charge('check', '2026-11-04T19:00:00.000Z', { kind: 'outgoingPayment' }),
        charge('ticketed', '2026-11-04T19:00:00.000Z'),
      ],
      holderOf: { pending: JORDAN, refund: JORDAN, failed: JORDAN, twin: JORDAN, before: JORDAN, check: JORDAN, ticketed: JORDAN },
      tickets: [{ id: 't1', mercury_transaction_id: 'ticketed', removed_at: null }],
    })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ made: 0, texted: 0, held: 0 })
    expect(w.sent).toEqual([])
    expect(w.requests()).toEqual([])
  })

  it('never reaches past 48 hours, even when the switch has been on for a month', async () => {
    const w = world({ charges: [charge('old', '2026-11-02T20:00:00.000Z'), charge('new', '2026-11-03T21:00:00.000Z')], holderOf: { old: JORDAN, new: JORDAN }, setting: JSON.stringify({ on: true, since: '2026-10-01T00:00:00.000Z', only: [] }) })
    await runReceiptSweep(w.doors)
    expect(w.requests().map((r) => r.mercury_transaction_id)).toEqual(['new'])
    expect(w.sent[0]!.body).toContain('posted to your card on Tuesday')
  })
})

describe('a charge the office already made a link for', () => {
  it('is texted once like any other: the hand-made request is the one the text stamps', async () => {
    const byHand = { id: 'req-c1', mercury_transaction_id: 'c1', holder_user_id: JORDAN, holder_name: 'Jordan Vance', no_text_why: null, cell: null, texted_at: null, reminded_at: null, answered_at: null, closed_at: null, ticket_id: null, closes_at: '2026-11-18T00:00:00.000Z', text_tries: 0, text_fail_why: null, made_by: SAM, created_at: '2026-11-04T19:30:00.000Z' }
    const w = world({ charges: [charge('c1', '2026-11-04T19:00:00.000Z')], requests: [byHand] })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ made: 0, texted: 1 })
    expect(w.requests()).toHaveLength(1)
    expect(w.requests()[0]).toMatchObject({ id: 'req-c1', texted_at: new Date(NOW).toISOString(), made_by: SAM })
  })

  it('and never when its receipt came through that link first', async () => {
    const answered = { id: 'req-c1', mercury_transaction_id: 'c1', holder_user_id: JORDAN, holder_name: 'Jordan Vance', no_text_why: null, texted_at: null, reminded_at: null, answered_at: '2026-11-04T19:45:00.000Z', closed_at: null, ticket_id: 't1', closes_at: '2026-11-18T00:00:00.000Z', text_tries: 0, created_at: '2026-11-04T19:30:00.000Z' }
    const w = world({ charges: [charge('c1', '2026-11-04T19:00:00.000Z')], requests: [answered], tickets: [{ id: 't1', mercury_transaction_id: 'c1', removed_at: null }] })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ made: 0, texted: 0, held: 0 })
    expect(w.sent).toEqual([])
  })

  it('nor when a Tally ticket landed on the charge after its request was made', async () => {
    const waiting = { id: 'req-c1', mercury_transaction_id: 'c1', holder_user_id: JORDAN, holder_name: 'Jordan Vance', no_text_why: null, texted_at: null, reminded_at: null, answered_at: null, closed_at: null, ticket_id: null, closes_at: '2026-11-18T00:00:00.000Z', text_tries: 1, created_at: '2026-11-04T19:30:00.000Z' }
    const w = world({ charges: [charge('c1', '2026-11-04T19:00:00.000Z')], requests: [waiting], tickets: [{ id: 't1', mercury_transaction_id: 'c1', removed_at: null }] })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ texted: 0, held: 0 })
    expect(w.sent).toEqual([])
    expect(w.db.writes).toEqual([])
  })
})

describe('a busy night', () => {
  it('is taken sixty charges a sweep and ten a text, and no charge is asked or texted twice', async () => {
    // 170 charges, one a second, on one card: more than one read of ids carries, and more than one sweep makes.
    const charges = Array.from({ length: 170 }, (_, i) => charge(`c${String(i).padStart(3, '0')}`, new Date(Date.parse('2026-11-04T19:00:00.000Z') + i * 1000).toISOString()))
    const w = world({ charges, holderOf: Object.fromEntries(charges.map((c) => [c.id as string, JORDAN])) })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ made: 60, texted: 60 })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ made: 60, texted: 60 })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ made: 50, texted: 50 })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ made: 0, texted: 0 })
    expect(w.requests()).toHaveLength(170)
    expect(w.requests().every((r) => r.texted_at)).toBe(true)
    expect(w.sent).toHaveLength(17)
    // Each request is opened by exactly one link.
    const opened = w.links().flatMap((l) => l.request_ids as string[])
    expect(opened).toHaveLength(170)
    expect(new Set(opened).size).toBe(170)
    expect(w.sent.filter((t) => t.first)).toHaveLength(1)
  })
})

describe('charges that wait together', () => {
  it('inside one hour share one text and one link; a later one gets its own, without the hello', async () => {
    const w = world({
      charges: [charge('c1', '2026-11-04T19:00:00.000Z'), charge('c2', '2026-11-04T19:40:00.000Z', { amount: -41.17, counterparty_name: 'Cedar Bend Hardware' }), charge('c3', '2026-11-04T20:20:00.000Z', { amount: -12, counterparty_name: 'Corner Fuel' })],
      holderOf: { c1: JORDAN, c2: JORDAN, c3: JORDAN },
    })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ made: 3, texted: 3 })
    expect(w.sent).toHaveLength(2)
    expect(w.sent[0]!.body).toMatch(/^Hi Jordan, this is Click Plumbing\. \$228\.58 at Ridgeway Supply and \$41\.17 at Cedar Bend Hardware posted to your card today\. Snap the receipts here: /)
    expect(w.sent[1]!.body).toMatch(/^\$12\.00 at Corner Fuel posted to your card today\. Snap the receipt here: /)
    expect(w.links().map((l) => l.request_ids)).toEqual([['req-c1', 'req-c2'], ['req-c3']])
  })

  it('two holders are never folded into one text', async () => {
    const w = world({ charges: [charge('c1', '2026-11-04T19:00:00.000Z'), charge('c2', '2026-11-04T19:01:00.000Z')], holderOf: { c1: JORDAN, c2: SAM } })
    await runReceiptSweep(w.doors)
    expect(w.sent.map((s) => s.to).sort()).toEqual(['+15125550100', '+15125550101'])
    expect(w.sent.every((s) => s.first)).toBe(true)
  })
})

describe('a text that cannot go', () => {
  it('writes its reason and sends nothing: no one on the card, gone, no cell, a STOP', async () => {
    const GONE = '00000000-0000-0000-0000-0000000000b3'
    const NOCELL = '00000000-0000-0000-0000-0000000000b4'
    const w = world({
      charges: ['nobody', 'gone', 'nocell', 'badcell', 'stopped'].map((id) => charge(id, '2026-11-04T19:00:00.000Z')),
      holderOf: { nobody: null, gone: GONE, nocell: NOCELL, badcell: SAM, stopped: JORDAN },
      users: [user(JORDAN, 'Jordan Vance', '(512) 555-0100'), user(SAM, 'Sam Okoro', '555-0101'), user(GONE, 'Pat Left', '(512) 555-0102', { archived_at: '2026-11-03T00:00:00.000Z' }), user(NOCELL, 'Lee Quiet', null)],
      stopped: ['+15125550100'],
    })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ made: 5, texted: 0, held: 5 })
    expect(w.sent).toEqual([])
    expect(Object.fromEntries(w.requests().map((r) => [r.mercury_transaction_id, r.no_text_why]))).toEqual({ nobody: 'no_person', gone: 'archived', nocell: 'no_cell', badcell: 'no_cell', stopped: 'opted_out' })
    expect(w.links()).toEqual([])
    // A reason is final for that charge: the next sweep does not look again.
    expect(await runReceiptSweep(w.doors)).toMatchObject({ made: 0, texted: 0, held: 0 })
  })

  it('a trial texts the people it names and leaves everyone else untouched, with no reason written', async () => {
    const w = world({ charges: [charge('c1', '2026-11-04T19:00:00.000Z'), charge('c2', '2026-11-04T19:00:00.000Z'), charge('c3', '2026-11-04T19:00:00.000Z')], holderOf: { c1: JORDAN, c2: SAM, c3: null }, setting: JSON.stringify({ on: true, since: SINCE, only: [JORDAN] }) })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ texted: 1, held: 0 })
    expect(w.sent.map((s) => s.to)).toEqual(['+15125550100'])
    expect(w.requests().filter((r) => r.mercury_transaction_id !== 'c1').map((r) => [r.texted_at, r.no_text_why])).toEqual([[null, null], [null, null]])
  })

  it('texts off, paused, no number, not registered or the day’s cap: the sweep stops, the claim and the link are given back, and the next sweep texts', async () => {
    for (const refused of ['textsOff', 'paused', 'not-set-up', 'not-registered', 'daily-cap']) {
      let fail = true
      const w = world({ charges: [charge('c1', '2026-11-04T19:00:00.000Z'), charge('c2', '2026-11-04T19:00:00.000Z')], holderOf: { c1: JORDAN, c2: SAM }, send: () => (fail ? { ok: false, refused, words: 'Not now.' } : { ok: true, segments: 1 }) })
      expect(await runReceiptSweep(w.doors), refused).toEqual({ ok: true, state: refused })
      expect(w.requests().map((r) => [r.texted_at, r.text_tries, r.no_text_why])).toEqual([[null, 0, null], [null, 0, null]])
      expect(w.links()).toEqual([])
      fail = false
      expect(await runReceiptSweep(w.doors)).toMatchObject({ state: 'on', texted: 2 })
    }
  })

  it('a text Quo turns away is tried three times in all, then left for the office', async () => {
    let tries = 0
    const w = world({ charges: [charge('c1', '2026-11-04T19:00:00.000Z')], holderOf: { c1: JORDAN }, send: () => { tries += 1; return { ok: false, refused: 'quo', words: 'Quo answered 500.' } } })
    for (let i = 0; i < 5; i++) await runReceiptSweep(w.doors)
    expect(tries).toBe(3)
    expect(w.requests()[0]).toMatchObject({ texted_at: null, text_tries: 3, text_fail_why: 'Quo answered 500.', no_text_why: null })
    expect(w.links()).toEqual([])
  })

  it('a STOP or a bad number found at the send becomes the reason', async () => {
    const stop = world({ charges: [charge('c1', '2026-11-04T19:00:00.000Z')], holderOf: { c1: JORDAN }, send: () => ({ ok: false, refused: 'stopped', words: 'They sent STOP.' }) })
    await runReceiptSweep(stop.doors)
    expect(stop.requests()[0]).toMatchObject({ texted_at: null, no_text_why: 'opted_out' })
    const bad = world({ charges: [charge('c1', '2026-11-04T19:00:00.000Z')], holderOf: { c1: JORDAN }, send: () => ({ ok: false, refused: 'not-a-number', words: 'Not a number.' }) })
    await runReceiptSweep(bad.doors)
    expect(bad.requests()[0]).toMatchObject({ texted_at: null, no_text_why: 'no_cell' })
  })

  it('a send that throws is a try that failed, never a sweep that died', async () => {
    const w = world({ charges: [charge('c1', '2026-11-04T19:00:00.000Z')], holderOf: { c1: JORDAN }, send: () => { throw new Error('the network dropped') } })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ state: 'on', texted: 0 })
    expect(w.requests()[0]).toMatchObject({ texted_at: null, text_tries: 1, text_fail_why: 'the network dropped' })
  })
})

describe('a charge the bank takes back', () => {
  it('closes its request and is never texted or reminded', async () => {
    const texted = { id: 'req-c1', mercury_transaction_id: 'c1', holder_user_id: JORDAN, holder_name: 'Jordan Vance', no_text_why: null, texted_at: '2026-11-04T00:14:00.000Z', reminded_at: null, answered_at: null, closed_at: null, closes_at: '2026-11-18T00:14:00.000Z', text_tries: 0, created_at: '2026-11-04T00:10:00.000Z' }
    // Wed Nov 4, 6:30 PM on the company's clock: the reminder's evening.
    const w = world({ charges: [charge('c1', '2026-11-03T23:00:00.000Z', { status: 'reversed' })], requests: [texted], now: Date.parse('2026-11-05T00:30:00.000Z') })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ closed: 1, reminded: 0, texted: 0 })
    expect(w.requests()[0]!.closed_at).toBe('2026-11-05T00:30:00.000Z')
    expect(w.sent).toEqual([])
  })
})

describe('the one reminder', () => {
  const texted = (id: string, more: Row = {}): Row => ({ id: `req-${id}`, mercury_transaction_id: id, holder_user_id: JORDAN, holder_name: 'Jordan Vance', no_text_why: null, texted_at: '2026-11-04T00:14:00.000Z', reminded_at: null, answered_at: null, closed_at: null, closes_at: '2026-11-18T00:14:00.000Z', text_tries: 0, created_at: '2026-11-04T00:10:00.000Z', ...more })
  const EVENING = Date.parse('2026-11-05T00:30:00.000Z')

  it('goes once, the next evening, on its own link that closes with the request', async () => {
    const w = world({ charges: [charge('c1', '2026-11-03T23:00:00.000Z')], requests: [texted('c1')], now: EVENING })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ reminded: 1, texted: 0 })
    expect(w.sent[0]!.body).toMatch(/^Still no receipt for \$228\.58 at Ridgeway Supply\. Snap it here: https:\/\/clicktooling\.com\/r\/[2-9a-z]{10}$/)
    expect(w.links()[0]).toMatchObject({ made_for: 'reminder', request_ids: ['req-c1'], expires_at: '2026-11-18T00:14:00.000Z' })
    expect(w.requests()[0]!.reminded_at).toBe('2026-11-05T00:30:00.000Z')
    expect(await runReceiptSweep(w.doors)).toMatchObject({ reminded: 0 })
    expect(w.sent).toHaveLength(1)
  })

  it('folds a holder’s waiting charges into one reminder', async () => {
    const w = world({ charges: [charge('c1', '2026-11-03T23:00:00.000Z'), charge('c2', '2026-11-03T23:10:00.000Z', { amount: -41.17, counterparty_name: 'Cedar Bend Hardware' })], requests: [texted('c1'), texted('c2')], now: EVENING })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ reminded: 2 })
    expect(w.sent).toHaveLength(1)
    expect(w.sent[0]!.body).toMatch(/^Still no receipt for \$228\.58 at Ridgeway Supply and \$41\.17 at Cedar Bend Hardware\. Snap them here: /)
  })

  it('waits for its evening: not at noon, not at midnight, not inside twelve hours', async () => {
    for (const now of ['2026-11-04T18:00:00.000Z', '2026-11-05T06:00:00.000Z', '2026-11-04T03:00:00.000Z']) {
      const w = world({ charges: [charge('c1', '2026-11-03T23:00:00.000Z')], requests: [texted('c1')], now: Date.parse(now) })
      expect(await runReceiptSweep(w.doors), now).toMatchObject({ reminded: 0 })
      expect(w.sent).toEqual([])
    }
  })

  it('a receipt that came through Tally meanwhile marks the request answered, and nobody is reminded', async () => {
    const w = world({ charges: [charge('c1', '2026-11-03T23:00:00.000Z')], requests: [texted('c1')], tickets: [{ id: 't9', mercury_transaction_id: 'c1', removed_at: null }], now: EVENING })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ reminded: 0 })
    expect(w.requests()[0]).toMatchObject({ answered_at: '2026-11-05T00:30:00.000Z', ticket_id: 't9', reminded_at: null })
    expect(w.sent).toEqual([])
  })

  it('a STOP since the first text holds the reminder and says so', async () => {
    const w = world({ charges: [charge('c1', '2026-11-03T23:00:00.000Z')], requests: [texted('c1')], stopped: ['+15125550100'], now: EVENING })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ reminded: 0, held: 1 })
    expect(w.requests()[0]).toMatchObject({ no_text_why: 'opted_out', reminded_at: null })
    expect(w.sent).toEqual([])
  })

  it('a trial reminds its people and nobody else', async () => {
    const w = world({ charges: [charge('c1', '2026-11-03T23:00:00.000Z'), charge('c2', '2026-11-03T23:00:00.000Z')], requests: [texted('c1'), texted('c2', { holder_user_id: SAM, holder_name: 'Sam Okoro' })], setting: JSON.stringify({ on: true, since: '2026-11-03T00:00:00.000Z', only: [SAM] }), now: EVENING })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ reminded: 1 })
    expect(w.sent.map((t) => t.to)).toEqual(['+15125550101'])
    expect(w.requests().map((r) => r.reminded_at)).toEqual([null, '2026-11-05T00:30:00.000Z'])
  })

  it('nobody who has left since the first text is reminded', async () => {
    const w = world({ charges: [charge('c1', '2026-11-03T23:00:00.000Z')], requests: [texted('c1')], users: [user(JORDAN, 'Jordan Vance', '(512) 555-0100', { archived_at: '2026-11-04T15:00:00.000Z' })], now: EVENING })
    expect(await runReceiptSweep(w.doors)).toMatchObject({ reminded: 0 })
    expect(w.sent).toEqual([])
  })

  it('the switch off, or Send texts off, holds the reminder too', async () => {
    const off = world({ charges: [charge('c1', '2026-11-03T23:00:00.000Z')], requests: [texted('c1')], setting: '{"on":false}', now: EVENING })
    expect(await runReceiptSweep(off.doors)).toEqual({ ok: true, state: 'off' })
    const textsOff = world({ charges: [charge('c1', '2026-11-03T23:00:00.000Z')], requests: [texted('c1')], textsOn: false, now: EVENING })
    expect(await runReceiptSweep(textsOff.doors)).toEqual({ ok: true, state: 'texts_off' })
    expect([...off.sent, ...textsOff.sent]).toEqual([])
    expect(off.requests()[0]!.reminded_at).toBeNull()
  })

  it('a reminder that fails is not tried again all evening', async () => {
    let tries = 0
    const w = world({ charges: [charge('c1', '2026-11-03T23:00:00.000Z')], requests: [texted('c1')], now: EVENING, send: () => { tries += 1; return { ok: false, refused: 'quo', words: 'Quo answered 500.' } } })
    for (let i = 0; i < 4; i++) await runReceiptSweep(w.doors)
    expect(tries).toBe(1)
    expect(w.links()).toEqual([])
  })
})
