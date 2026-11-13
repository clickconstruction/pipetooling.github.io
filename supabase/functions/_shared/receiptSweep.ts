/**
 * The receipt text's sweep (punch list #299, PR 2): everything `receipt-request` does, with its doors handed in, so the
 * app's tests run it over a database and a sender that are stood in. No network import: the function builds the doors
 * (`supabase/functions/receipt-request/index.ts`) and this file decides, reads, writes and sends through them.
 *
 * The order of one sweep, and why a charge is never texted twice, is said on the function.
 */
import { mintReceiptLinkCode, receiptChargeDead, receiptFirstName, receiptLinkExpiry } from './receiptLink.ts'
import {
  RECEIPT_SWEEP_HOURS,
  RECEIPT_TEXTS_KEY,
  RECEIPT_TEXT_TRIES,
  foldReceiptCharges,
  parseReceiptTextsSetting,
  receiptChargeAsks,
  receiptHolderInTrial,
  receiptLinkUrl,
  receiptNoTextWhy,
  receiptReminderBody,
  receiptReminderDue,
  receiptSweepFloor,
  receiptTextBody,
  type ReceiptChargeRow,
  type ReceiptTextsSetting,
} from './receiptText.ts'

/** Where a number sits: its contact, its channel, the number as Quo takes it, and whether it sent STOP to the team box. */
export interface ReceiptPlaced {
  contactId: string
  channelId: string
  number: string
  optedOut: boolean
}

/** What a send answers, as `sendText` does. */
export type ReceiptSendOutcome = { ok: true; segments: number } | { ok: false; refused: string; words: string }

/** The doors a sweep goes through. The function hands in the real ones; a test hands in its own. */
export interface ReceiptSweepDoors {
  // deno-lint-ignore no-explicit-any
  admin: any
  nowMs: number
  /** One `app_settings` row's words, or null. */
  settingText(key: string): Promise<string | null>
  /** Settings → Phone and texts → Send texts. */
  textsOn(): Promise<boolean>
  /** A person's number as ten digits read it, or null. */
  cellOf(raw: string): string | null
  /** The number's own contact and channel, made when nobody has it. */
  place(cell: string): Promise<ReceiptPlaced | null>
  /** Our newest text to this channel from the team box (ms), or null. */
  lastTextAt(channelId: string): Promise<number | null>
  /** One text from the company number, written on the person's thread. */
  send(to: ReceiptPlaced, body: string, lastTextAt: number | null): Promise<ReceiptSendOutcome>
  companyName: string
  randomBytes(n: number): Uint8Array
  sha256Hex(value: string): Promise<string>
  log?(line: Record<string, unknown>): void
}

// deno-lint-ignore no-explicit-any
type Admin = any
type Placed = ReceiptPlaced

const CARD_KINDS = ['debitCardTransaction', 'creditCardTransaction']
/** The most a sweep makes or texts, so one run stays short; the next run takes the rest. */
const MAX_NEW = 60
const MAX_TEXTS = 30

type Charge = ReceiptChargeRow & { counterparty_name: string | null }
type RequestRow = {
  id: string
  mercury_transaction_id: string
  holder_user_id: string | null
  holder_name: string
  no_text_why: string | null
  texted_at: string | null
  reminded_at: string | null
  answered_at: string | null
  closed_at: string | null
  closes_at: string
  text_tries: number
}
type Holder = { id: string; name: string | null; phone: string | null; archived_at: string | null }

const REQUEST_COLUMNS = 'id, mercury_transaction_id, holder_user_id, holder_name, no_text_why, texted_at, reminded_at, answered_at, closed_at, closes_at, text_tries'
const CHARGE_COLUMNS = 'id, kind, amount, status, posted_at, counterparty_name, duplicate_of_transaction_id'

/**
 * A refusal that is about every text, not this one: texts off, texts paused for money, no key or number, a number the
 * carriers have not registered, the day's cap. The whole sweep stops with nothing lost, and the next sweep tries again.
 */
const SWEEP_WIDE: ReadonlySet<string> = new Set(['textsOff', 'not-set-up', 'paused', 'not-registered', 'daily-cap'])

/** The whole sweep stops (`SWEEP_WIDE`). */
class SweepStop extends Error {
  state: string
  constructor(state: string) {
    super(state)
    this.state = state
  }
}

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T[]> {
  const { data, error } = await query
  if (error) throw new Error(`${what}: ${error.message}`)
  return (data ?? []) as T[]
}

/** Reads by a list of ids, 150 at a time: the ids ride the request's address, which has a length it will not pass. */
async function byIds<T>(ids: readonly string[], read: (some: string[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 150) out.push(...(await rows<T>(read(ids.slice(i, i + 150)), what)))
  return out
}

async function chargesPosted(admin: Admin, floorIso: string): Promise<Charge[]> {
  const list = await rows<Charge>(
    admin.from('mercury_transactions').select(CHARGE_COLUMNS).in('kind', CARD_KINDS).gte('posted_at', floorIso).lt('amount', 0).is('duplicate_of_transaction_id', null).order('posted_at', { ascending: true }).limit(400),
    'the charges',
  )
  return list.filter((c) => receiptChargeAsks({ ...c, amount: Number(c.amount) }))
}

async function ticketsByCharge(admin: Admin, chargeIds: readonly string[]): Promise<Map<string, string>> {
  const list = await byIds<{ id: string; mercury_transaction_id: string }>(chargeIds, (some) => admin.from('counter_tickets').select('id, mercury_transaction_id').in('mercury_transaction_id', some).is('removed_at', null), 'the tickets')
  return new Map(list.map((t) => [t.mercury_transaction_id, t.id]))
}

type SendItem = { request: RequestRow; charge: Charge }

/**
 * One text to one holder for the requests it names. Claims them first, mints the link, sends, and stamps what went. A
 * text that could not go gives the claim back and says why on the request.
 */
async function sendRun(doors: ReceiptSweepDoors, kind: 'text' | 'reminder', items: readonly SendItem[], holder: Holder, placed: Placed): Promise<number> {
  const { admin, nowMs } = doors
  const nowIso = new Date(nowMs).toISOString()
  const stamp = kind === 'text' ? 'texted_at' : 'reminded_at'
  const ids = items.map((i) => i.request.id)
  const claimed = await rows<{ id: string }>(admin.from('receipt_requests').update({ [stamp]: nowIso, updated_at: nowIso }).in('id', ids).is(stamp, null).is('answered_at', null).is('closed_at', null).select('id'), 'the claim')
  const mine = items.filter((i) => claimed.some((c) => c.id === i.request.id))
  if (mine.length === 0) return 0
  const mineIds = mine.map((i) => i.request.id)
  const unclaim = async (more: Record<string, unknown> = {}) => {
    await admin.from('receipt_requests').update({ [stamp]: null, updated_at: nowIso, ...more }).in('id', mineIds)
  }

  // A reminder's link closes when its request does; a first text's link opens its fourteen days.
  const expiresAt = kind === 'text' ? receiptLinkExpiry(nowIso) : mine.reduce((m, i) => (i.request.closes_at > m ? i.request.closes_at : m), mine[0]!.request.closes_at)
  let code = ''
  let linkId = ''
  for (let attempt = 0; attempt < 3 && !linkId; attempt++) {
    code = mintReceiptLinkCode(doors.randomBytes)
    const { data, error } = await admin.from('receipt_links').insert({ code_hash: await doors.sha256Hex(code), request_ids: mineIds, made_for: kind, made_at: nowIso, expires_at: expiresAt }).select('id').single()
    if (error?.code === '23505') continue
    if (error) {
      await unclaim()
      throw new Error(`the link: ${error.message}`)
    }
    linkId = (data as { id: string }).id
  }
  if (!linkId) {
    await unclaim()
    throw new Error('no free code after three tries')
  }
  const dropLink = async () => {
    await admin.from('receipt_links').delete().eq('id', linkId)
  }

  const charges = mine.map((i) => ({ amount: Number(i.charge.amount), store: i.charge.counterparty_name, posted_at: i.charge.posted_at }))
  const url = receiptLinkUrl(code)
  let out: ReceiptSendOutcome
  try {
    const last = await doors.lastTextAt(placed.channelId)
    const body = kind === 'text' ? receiptTextBody({ first: last === null, firstName: receiptFirstName(holder.name), company: doors.companyName, charges, url, nowMs }) : receiptReminderBody({ charges, url })
    out = await doors.send(placed, body, last)
  } catch (e) {
    out = { ok: false, refused: 'error', words: e instanceof Error ? e.message : String(e) }
  }

  if (out.ok) {
    if (kind === 'text') await admin.from('receipt_requests').update({ cell: placed.number, closes_at: expiresAt, text_fail_why: null, updated_at: nowIso }).in('id', mineIds)
    doors.log?.({ event: 'receipt_text', kind, requests: mineIds.length, segments: out.segments, link: linkId })
    return mineIds.length
  }

  await dropLink()
  if (SWEEP_WIDE.has(out.refused)) {
    await unclaim()
    throw new SweepStop(out.refused)
  }
  if (out.refused === 'stopped') {
    await unclaim({ no_text_why: 'opted_out' })
  } else if (out.refused === 'not-a-number' || out.refused === 'no-number') {
    await unclaim({ no_text_why: 'no_cell' })
  } else if (kind === 'reminder') {
    // One reminder, and it did not go: the claim stands, so a failing number is not tried every five minutes all evening.
    doors.log?.({ event: 'receipt_text_failed', kind, refused: out.refused })
  } else {
    for (const i of mine) await admin.from('receipt_requests').update({ texted_at: null, text_tries: (i.request.text_tries ?? 0) + 1, text_fail_why: out.words.slice(0, 300), updated_at: nowIso }).eq('id', i.request.id)
    doors.log?.({ event: 'receipt_text_failed', kind, refused: out.refused })
  }
  return 0
}

async function sweep(doors: ReceiptSweepDoors, setting: ReceiptTextsSetting) {
  const { admin, nowMs } = doors
  const nowIso = new Date(nowMs).toISOString()
  const out = { made: 0, texted: 0, reminded: 0, held: 0, closed: 0 }
  const floor = receiptSweepFloor(setting, nowMs)
  if (!floor) return out

  // 1. A request whose charge the bank failed or took back is closed.
  const open = await rows<RequestRow>(admin.from('receipt_requests').select(REQUEST_COLUMNS).is('answered_at', null).is('closed_at', null).gt('closes_at', nowIso).order('created_at', { ascending: false }).limit(400), 'the open requests')
  if (open.length > 0) {
    const status = await byIds<{ id: string; status: string | null }>(open.map((r) => r.mercury_transaction_id), (some) => admin.from('mercury_transactions').select('id, status').in('id', some), 'the open charges')
    const dead = new Set(status.filter((s) => receiptChargeDead(s.status)).map((s) => s.id))
    const close = open.filter((r) => dead.has(r.mercury_transaction_id)).map((r) => r.id)
    if (close.length > 0) {
      await admin.from('receipt_requests').update({ closed_at: nowIso, updated_at: nowIso }).in('id', close)
      out.closed = close.length
    }
  }

  // 2. A posted purchase with no request and no ticket gets its request.
  const charges = await chargesPosted(admin, floor)
  const chargeById = new Map(charges.map((c) => [c.id, c]))
  const ids = charges.map((c) => c.id)
  const tickets = await ticketsByCharge(admin, ids)
  const requests = await byIds<RequestRow>(ids, (some) => admin.from('receipt_requests').select(REQUEST_COLUMNS).in('mercury_transaction_id', some), 'the requests')
  const asked = new Set(requests.map((r) => r.mercury_transaction_id))
  for (const c of charges) {
    if (out.made >= MAX_NEW) break
    if (asked.has(c.id) || tickets.has(c.id)) continue
    const { data, error } = await admin.rpc('receipt_request_ensure', { p_transaction_id: c.id })
    if (error) {
      doors.log?.({ event: 'receipt_request_failed', why: error.message })
      continue
    }
    const made = (Array.isArray(data) ? data[0] : data) as RequestRow | null
    if (made?.id) {
      requests.push({ ...made, text_tries: made.text_tries ?? 0 })
      asked.add(c.id)
      out.made += 1
    }
  }

  // 3. Each request that waits is texted, or says why not.
  const waiting = requests.filter((r) => !r.texted_at && !r.no_text_why && !r.answered_at && !r.closed_at && (r.text_tries ?? 0) < RECEIPT_TEXT_TRIES && !tickets.has(r.mercury_transaction_id) && chargeById.has(r.mercury_transaction_id))
  const holderIds = [...new Set(waiting.map((r) => r.holder_user_id).filter((id): id is string => Boolean(id)))]
  const holders = new Map<string, Holder>()
  for (const h of await byIds<Holder>(holderIds, (some) => admin.from('users').select('id, name, phone, archived_at').in('id', some), 'the holders')) holders.set(h.id, h)
  const placedByHolder = new Map<string, Placed | null>()
  const placeFor = async (h: Holder): Promise<Placed | null> => {
    if (placedByHolder.has(h.id)) return placedByHolder.get(h.id) ?? null
    const cell = doors.cellOf(h.phone ?? '')
    const placed = cell ? await doors.place(cell) : null
    placedByHolder.set(h.id, placed)
    return placed
  }

  const textable: { requestId: string; holderUserId: string; postedAtMs: number; item: SendItem }[] = []
  for (const r of waiting) {
    // A trial texts the people it names; everyone else's charges wait untouched, with no reason written.
    if (!receiptHolderInTrial(setting, r.holder_user_id)) continue
    const holder = r.holder_user_id ? (holders.get(r.holder_user_id) ?? null) : null
    const placed = holder && !holder.archived_at ? await placeFor(holder) : null
    const why = receiptNoTextWhy({ holderUserId: holder ? holder.id : null, archived: Boolean(holder?.archived_at), cell: placed?.number ?? null, optedOut: placed?.optedOut ?? false })
    if (why) {
      await admin.from('receipt_requests').update({ no_text_why: why, updated_at: nowIso }).eq('id', r.id).is('texted_at', null)
      out.held += 1
      continue
    }
    const charge = chargeById.get(r.mercury_transaction_id)!
    textable.push({ requestId: r.id, holderUserId: holder!.id, postedAtMs: Date.parse(charge.posted_at!), item: { request: r, charge } })
  }
  let sent = 0
  for (const run of foldReceiptCharges(textable)) {
    if (sent >= MAX_TEXTS) break
    const holder = holders.get(run[0]!.holderUserId)!
    const placed = (await placeFor(holder))!
    out.texted += await sendRun(doors, 'text', run.map((w) => w.item), holder, placed)
    sent += 1
  }

  // 4. The one reminder, the next evening.
  const texted = await rows<RequestRow>(
    admin.from('receipt_requests').select(REQUEST_COLUMNS).not('texted_at', 'is', null).is('reminded_at', null).is('answered_at', null).is('closed_at', null).is('no_text_why', null).gt('closes_at', nowIso).order('texted_at', { ascending: true }).limit(200),
    'the texted requests',
  )
  const due = texted.filter((r) => receiptReminderDue(r, nowMs) && r.holder_user_id && receiptHolderInTrial(setting, r.holder_user_id))
  if (due.length > 0) {
    const dueCharges = await byIds<Charge>(due.map((r) => r.mercury_transaction_id), (some) => admin.from('mercury_transactions').select(CHARGE_COLUMNS).in('id', some), 'the reminded charges')
    const dueChargeById = new Map(dueCharges.map((c) => [c.id, c]))
    const dueTickets = await ticketsByCharge(admin, due.map((r) => r.mercury_transaction_id))
    const dueHolderIds = [...new Set(due.map((r) => r.holder_user_id as string))].filter((id) => !holders.has(id))
    for (const h of await byIds<Holder>(dueHolderIds, (some) => admin.from('users').select('id, name, phone, archived_at').in('id', some), 'the reminded holders')) holders.set(h.id, h)
    const byHolder = new Map<string, SendItem[]>()
    for (const r of due) {
      const ticketId = dueTickets.get(r.mercury_transaction_id)
      if (ticketId) {
        // The receipt came through another door after the text went: the request is answered, and nobody is reminded.
        await admin.from('receipt_requests').update({ answered_at: nowIso, ticket_id: ticketId, updated_at: nowIso }).eq('id', r.id).is('answered_at', null)
        continue
      }
      const charge = dueChargeById.get(r.mercury_transaction_id)
      if (!charge || receiptChargeDead(charge.status)) continue
      byHolder.set(r.holder_user_id as string, [...(byHolder.get(r.holder_user_id as string) ?? []), { request: r, charge }])
    }
    for (const [holderId, items] of byHolder) {
      if (sent >= MAX_TEXTS) break
      const holder = holders.get(holderId)
      if (!holder || holder.archived_at) continue
      const placed = await placeFor(holder)
      if (!placed) continue
      if (placed.optedOut) {
        await admin.from('receipt_requests').update({ no_text_why: 'opted_out', updated_at: nowIso }).in('id', items.map((i) => i.request.id))
        out.held += items.length
        continue
      }
      for (let i = 0; i < items.length; i += 10) {
        out.reminded += await sendRun(doors, 'reminder', items.slice(i, i + 10), holder, placed)
        sent += 1
      }
    }
  }
  return out
}

export type ReceiptSweepAnswer =
  | { ok: true; state: 'off' | 'texts_off' | 'textsOff' | 'not-set-up' | 'paused' | 'not-registered' | 'daily-cap' }
  | { ok: true; state: 'on'; made: number; texted: number; reminded: number; held: number; closed: number }
  | { ok: true; state: 'dry'; posted: number; asked: number; withTicket: number; wouldAsk: number }

/**
 * One call of the sweep. With the switch off, or Send texts off, it answers at once: nothing is read past the two
 * settings, nothing is written and nothing is sent. `dry` counts the look-back as if the switch were on and writes and
 * sends nothing either.
 */
export async function runReceiptSweep(doors: ReceiptSweepDoors, ask: { dry?: boolean } = {}): Promise<ReceiptSweepAnswer> {
  const { admin, nowMs } = doors
  if (ask.dry === true) {
    const charges = await chargesPosted(admin, new Date(nowMs - RECEIPT_SWEEP_HOURS * 60 * 60 * 1000).toISOString())
    const ids = charges.map((c) => c.id)
    const tickets = await ticketsByCharge(admin, ids)
    const asked = await byIds<{ mercury_transaction_id: string }>(ids, (some) => admin.from('receipt_requests').select('mercury_transaction_id').in('mercury_transaction_id', some), 'the requests')
    const askedIds = new Set(asked.map((r) => r.mercury_transaction_id))
    return { ok: true, state: 'dry', posted: charges.length, asked: askedIds.size, withTicket: tickets.size, wouldAsk: charges.filter((c) => !askedIds.has(c.id) && !tickets.has(c.id)).length }
  }
  const setting = parseReceiptTextsSetting(await doors.settingText(RECEIPT_TEXTS_KEY))
  if (!setting.on) return { ok: true, state: 'off' }
  // Send texts off holds every text: nothing is made or stamped, so the first sweep after it is on asks as usual.
  if (!(await doors.textsOn())) return { ok: true, state: 'texts_off' }
  try {
    const out = await sweep(doors, setting)
    doors.log?.({ event: 'receipt_sweep', ...out, trial: setting.only.length })
    return { ok: true, state: 'on', ...out }
  } catch (e) {
    if (e instanceof SweepStop) return { ok: true, state: e.state as 'textsOff' | 'not-set-up' | 'paused' | 'not-registered' | 'daily-cap' }
    throw e
  }
}
