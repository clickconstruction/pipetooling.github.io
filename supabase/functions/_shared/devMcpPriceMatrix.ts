// dev-mcp's plan_price_matrix_request / apply_price_matrix_request (v2.7958 / 0.113.0): the ask a person makes with
// Price it with the robot on Bids → Pricing (PriceWithRobotModal queueIt), and its Take it back while the ask is still
// queued (takeBack). The pricing robot works the queue through the twin seat (next_price_matrix … finish_price_matrix);
// queueing was a person's press and the last step of the pricing loop the seat could not make.
//
// A request is a snapshot, as the window makes it: the bid's counted fixture rows by name and count, and the quote
// links ticked off the bid's Price requests. The seat queues what the window would queue, by the window's own rules
// (_shared/priceMatrixAsk.ts): the rows of the pricing the tab opens on, every readable link ticked unless the caller
// names fewer, a house asked with nothing linked listed as skipped. One row is written and nothing else: no email, no
// cost, no change to the bid. One ask a bid at a time, as the window shows its status face while one is open.
// No new RPC and no dry-run wrapper: the dry run is the server's read of the bid, its count rows, its price requests,
// its asks and whether a pricing robot holds a live key, and the plan hash commits to the snapshot.
// Pure: no env, no network; the reads come in through the pricing reader (src/lib/devMcp/devMcpPriceMatrix.test.ts).

import type { RowFilter } from './devMcpDoor.ts'
import { pricesBidLabel, readBidPricesWorld, type BidPricesWorld } from './devMcpBidPrices.ts'
import type { PricingReader } from './devMcpBidPricing.ts'
import { activePriceMatrixRequest, buildPriceMatrixScope, buildPriceMatrixSources, canTakeBack, type PriceMatrixScopeLine, type PriceMatrixSource, type PriceMatrixStatus, type PriceRequestLinkRow } from './priceMatrixAsk.ts'

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const PRICE_MATRIX_VERBS = ['plan_price_matrix_request', 'apply_price_matrix_request'] as const
export type PriceMatrixVerb = (typeof PRICE_MATRIX_VERBS)[number]
export function isPriceMatrixVerb(verb: string): verb is PriceMatrixVerb {
  return (PRICE_MATRIX_VERBS as readonly string[]).includes(verb)
}

/** Queue an ask, or take the open one back: the window's two presses. */
export type PriceMatrixPayload = { action: 'queue'; bid_id: string; sources: string[] | null } | { action: 'take_back'; bid_id: string }
export type PriceMatrixInput = { ok: true; p: PriceMatrixPayload; target: string } | { ok: false; error: string }

export const PRICE_MATRIX_SOURCES_MAX = 50

/** The ask's shape, refused in words: a bid, and either the links to tick or take_back. */
export function priceMatrixInput(verb: PriceMatrixVerb, input: Json): PriceMatrixInput {
  const src = obj(input.request)
  const shape = `${verb} needs request — { bid_id (a bids.id — find_bid), and either nothing more (every readable quote link on the bid's Price requests is ticked, as the window opens), sources ([rfq_id] — the links to tick, each a bid_rfqs.id the plan lists as readable), or take_back: true (the open ask taken back, while it is still queued) }.`
  if (!src) return { ok: false, error: shape }
  const bidId = typeof src.bid_id === 'string' ? src.bid_id.trim().toLowerCase() : ''
  if (!UUID_RE.test(bidId)) return { ok: false, error: shape }
  const extra = Object.keys(src).filter((k) => !['bid_id', 'sources', 'take_back'].includes(k))
  if (extra.length) return { ok: false, error: `${verb}: request takes bid_id, sources and take_back, not ${extra.join(', ')}. The fixture rows and the links are read off the bid: a request is a snapshot of it, never a list you give.` }
  if (src.take_back !== undefined && src.take_back !== true) return { ok: false, error: `${verb}: take_back is true, or left out.` }
  if (src.take_back === true) {
    if (src.sources !== undefined && src.sources !== null) return { ok: false, error: `${verb}: take_back takes no sources. It takes back the bid's open ask.` }
    return { ok: true, p: { action: 'take_back', bid_id: bidId }, target: bidId }
  }
  let sources: string[] | null = null
  if (src.sources !== undefined && src.sources !== null) {
    if (!Array.isArray(src.sources) || src.sources.length === 0 || src.sources.length > PRICE_MATRIX_SOURCES_MAX) return { ok: false, error: `${verb}: sources is a list of bid_rfqs ids, 1 to ${PRICE_MATRIX_SOURCES_MAX}. Leave it out to tick every readable link.` }
    const ids = src.sources.map((s) => (typeof s === 'string' ? s.trim().toLowerCase() : ''))
    if (ids.some((id) => !UUID_RE.test(id))) return { ok: false, error: `${verb}: every source is a bid_rfqs.id, as the plan lists them.` }
    if (new Set(ids).size !== ids.length) return { ok: false, error: `${verb}: a source is named twice.` }
    sources = ids
  }
  return { ok: true, p: { action: 'queue', bid_id: bidId, sources }, target: bidId }
}

// ── the world the plan reads ─────────────────────────────────────────────────────────────────────────────────────

export type PriceMatrixAskRow = { id: string; status: PriceMatrixStatus; requested_at: string; requested_by: string | null; reviewed_at: string | null }
/** A pricing robot and how many live keys it holds: with none, nothing claims the queue. */
export type PricerSeat = { email: string; name: string | null; live_keys: number }

export type PriceMatrixWorld = {
  /** The bid, the pricing the tab opens on and that pricing's count rows, as plan_bid_pricing reads them. */
  prices: BidPricesWorld
  rfqs: PriceRequestLinkRow[]
  houseNames: Record<string, string>
  /** The bid's asks, newest first. */
  asks: PriceMatrixAskRow[]
  /** The pricing robots that stand; null when the server could not read them. */
  pricers?: PricerSeat[] | null
}

/** The columns the server reads of a pricing robot, and of its live keys: an id to count by, never a hash. */
export const PRICER_SEAT_SELECT = 'id,name,email'
export const PRICER_KEY_SELECT = 'id,twin_user_id'

/** The pricing robots with their live keys counted, from the two reads. */
export function pricerSeats(seats: ReadonlyArray<{ id: string; name: string | null; email: string }>, liveKeys: ReadonlyArray<{ twin_user_id: string }>): PricerSeat[] {
  return seats.map((s) => ({ email: s.email, name: s.name, live_keys: liveKeys.filter((k) => k.twin_user_id === s.id).length }))
}

/** The columns the window reads of the bid's price requests (PriceWithRobotModal). */
export const PRICE_MATRIX_RFQ_SELECT = 'id,status,supply_house_id,sent_to,created_at,sent_via,requested_on,request_url,quote_url'
export const PRICE_MATRIX_ASK_SELECT = 'id,status,requested_at,requested_by,reviewed_at'

/** The reads the dry run needs, in one place, so the test pins the queries the door will see. */
export async function readPriceMatrixWorld(reader: PricingReader, bidId: string): Promise<PriceMatrixWorld> {
  const eq = (column: string, value: unknown): RowFilter => ({ column, op: 'eq', value })
  const prices = await readBidPricesWorld(reader, bidId)
  if (!prices.bid) return { prices, rfqs: [], houseNames: {}, asks: [] }
  const [rfqRows, askRows] = await Promise.all([
    reader.rows('bid_rfqs', { select: PRICE_MATRIX_RFQ_SELECT, filters: [eq('bid_id', bidId)], order: [{ column: 'created_at', ascending: false }], limit: 200 }),
    reader.rows('bid_price_matrix_requests', { select: PRICE_MATRIX_ASK_SELECT, filters: [eq('bid_id', bidId)], order: [{ column: 'requested_at', ascending: false }], limit: 50 }),
  ])
  const rfqs = rfqRows as unknown as PriceRequestLinkRow[]
  const houseIds = [...new Set(rfqs.map((r) => r.supply_house_id).filter((id): id is string => typeof id === 'string' && !!id))]
  const houses = houseIds.length ? await reader.rows('supply_houses', { select: 'id,name', filters: [{ column: 'id', op: 'in', value: houseIds }], limit: 200 }) : []
  const houseNames: Record<string, string> = {}
  for (const h of houses) if (typeof h.id === 'string' && typeof h.name === 'string') houseNames[h.id] = h.name
  return { prices, rfqs, houseNames, asks: askRows as unknown as PriceMatrixAskRow[] }
}

// ── the dry run ──────────────────────────────────────────────────────────────────────────────────────────────────

export type PriceMatrixDryRun =
  | { ok: true; action: 'queue'; reply: Json; row: Json }
  | { ok: true; action: 'take_back'; reply: Json; ask: PriceMatrixAskRow }
  | { ok: false; refused: string }

/** How many fixture rows a plan lists by name; the count beside them is whole. */
export const PRICE_MATRIX_ROWS_SHOWN = 40
const PRICE_REQUESTS_DOOR = 'Edit Bid → Files & Links → Price requests'

const askWords = (a: PriceMatrixAskRow): string =>
  a.status === 'queued' ? 'queued, waiting on the robot' : a.status === 'working' ? 'being worked by the robot' : a.status === 'blocked' ? 'blocked: the robot could not read a source' : 'ready and not reviewed yet'

/** What stands between the queue and a robot: nothing, or no live key on any pricing robot. */
function pricerWords(pricers: PricerSeat[] | null | undefined): { words: string; warning: string | null } {
  if (pricers == null) return { words: 'Whether a pricing robot holds a live key could not be read: read_twin_keys says.', warning: null }
  if (pricers.length === 0) return { words: '', warning: 'No pricing robot stands in the fleet, so nothing would claim this ask: plan_twin { twin: { kind: "pricer" } } makes one, then mint_twin_setup_code gives it a key.' }
  const live = pricers.filter((s) => s.live_keys > 0)
  if (live.length === 0) return { words: '', warning: `No pricing robot holds a live key (${pricers.map((s) => s.email).join(', ')}), so the ask would wait in the queue until one is minted: mint_twin_setup_code { label, twin: "${pricers[0]!.email}" }.` }
  return { words: `${live.map((s) => s.name ?? s.email).join(', ')} ${live.length === 1 ? 'holds' : 'hold'} a live key and ${live.length === 1 ? 'claims' : 'claim'} the oldest queued ask at ${live.length === 1 ? 'its' : 'their'} next round.`, warning: null }
}

/**
 * The dry run. Queue: the snapshot the window would write, the links ticked and not, the houses skipped, and whether
 * a robot can claim it. Take back: the open ask, when it is still queued. Refused in words: no such bid, an ask
 * already open, no counted rows, no readable link, a source the bid does not offer, nothing to take back.
 */
export function priceMatrixDryRun(p: PriceMatrixPayload, world: PriceMatrixWorld, me: { userId: string }): PriceMatrixDryRun {
  const bid = world.prices.bid
  if (!bid) return { ok: false, refused: `No bid ${p.bid_id} is visible to you — find_bid resolves a number or a name.` }
  const label = pricesBidLabel(bid)
  const active = activePriceMatrixRequest(world.asks)

  if (p.action === 'take_back') {
    if (!active) return { ok: false, refused: `Nothing to take back: ${label} has no ask open with the robot.` }
    if (!canTakeBack(active)) return { ok: false, refused: `${label}'s ask is ${askWords(active)}. Take it back is only honest before the robot starts writing: the window offers it on a queued ask alone.` }
    return {
      ok: true,
      action: 'take_back',
      ask: active,
      reply: {
        dry_run: true,
        action: 'take_back',
        bid: { id: bid.id, label },
        request: { id: active.id, status: active.status, requested_at: active.requested_at, requested_by: active.requested_by },
        then: `apply sets that ask to cancelled as you, held to an ask still queued, as Take it back on the Price it with the robot window does. The robot will not pick it up. A robot that claimed it a moment ago keeps it, and the apply says so.`,
      },
    }
  }

  if (active) return { ok: false, refused: `${label} has an ask open with the robot already: ${askWords(active)} (asked ${active.requested_at}, request ${active.id}). One at a time, as the window shows its status in place of the form. ${canTakeBack(active) ? 'take_back: true takes it back while it is queued.' : 'It is past taking back.'}` }
  const open = world.prices.open
  const scope: PriceMatrixScopeLine[] = buildPriceMatrixScope(world.prices.countRows.map((r) => ({ id: r.id, fixture: r.fixture, count: r.count, unit: r.unit ?? null })))
  if (scope.length === 0) return { ok: false, refused: `${label} has no counted fixture rows yet${open?.pricingId ? '' : ', and no pricing the tab would open on'}: the window's Queue it is dead until the takeoff has rows with a count. plan_bid_counts writes them.` }
  const { readable, waiting } = buildPriceMatrixSources(world.rfqs, new Map(Object.entries(world.houseNames)))
  if (readable.length === 0) {
    return { ok: false, refused: `${label} has no readable quote link: ${waiting.length ? `${waiting.map((w) => w.house_name).join(', ')} ${waiting.length === 1 ? 'was' : 'were'} asked with nothing linked yet` : 'no price request is on the bid'}. The robot reads the links pasted at ${PRICE_REQUESTS_DOOR}, and never invents a quote.` }
  }
  let selected: PriceMatrixSource[] = readable
  if (p.sources) {
    const byId = new Map(readable.map((s) => [s.rfq_id.toLowerCase(), s]))
    const unknown = p.sources.filter((id) => !byId.has(id))
    if (unknown.length) return { ok: false, refused: `${unknown.length === 1 ? 'This source is' : 'These sources are'} not a readable link on ${label}: ${unknown.join(', ')}. The readable ones: ${readable.map((s) => `${s.house_name} (${s.rfq_id})`).join(', ')}.` }
    selected = readable.filter((s) => p.sources!.includes(s.rfq_id.toLowerCase()))
  }
  const notTicked = readable.filter((s) => !selected.includes(s))
  const pricer = pricerWords(world.pricers)
  const warnings: string[] = []
  if (pricer.warning) warnings.push(pricer.warning)
  if (waiting.length) warnings.push(`${waiting.length} house${waiting.length === 1 ? ' was' : 's were'} asked with nothing linked yet and ${waiting.length === 1 ? 'is' : 'are'} skipped: ${waiting.map((w) => w.house_name).join(', ')}. The link goes in at ${PRICE_REQUESTS_DOOR}.`)
  // The row the window inserts: the open pricing's id rides in bid_version_id, as the window writes it.
  const row: Json = { bid_id: bid.id, bid_version_id: open?.pricingId ?? null, requested_by: me.userId, scope, sources: selected, status: 'queued' }
  const n = selected.length
  return {
    ok: true,
    action: 'queue',
    row,
    reply: {
      dry_run: true,
      action: 'queue',
      bid: { id: bid.id, label },
      pricing: open?.pricingId ? { id: open.pricingId, name: open.name, version: open.versionName } : null,
      scope: { rows: scope.length, lines: scope.slice(0, PRICE_MATRIX_ROWS_SHOWN).map((l) => ({ fixture: l.fixture, count: l.count, unit: l.unit })), more: Math.max(0, scope.length - PRICE_MATRIX_ROWS_SHOWN) },
      sources: selected,
      not_ticked: notTicked.map((s) => ({ rfq_id: s.rfq_id, house_name: s.house_name })),
      skipped_houses: waiting,
      row,
      warnings,
      then: `apply writes one ask as you, as Queue it on the Price it with the robot window does: ${n} quote${n === 1 ? '' : 's'} and ${scope.length} fixture row${scope.length === 1 ? '' : 's'}, names and counts only, as they read now. The robot prices this snapshot, never the live bid. Nothing else is written: no email, no cost, no change to the bid. ${pricer.words}${pricer.words ? ' ' : ''}The way back, while it is still queued, is this pair with take_back: true.`,
    },
  }
}

/** The take-back's write: the window's own, the status and its stamp. */
export function priceMatrixTakeBackPatch(nowIso: string): Json {
  return { status: 'cancelled', updated_at: nowIso }
}

/** The filter the take-back is held to: this ask, still queued. */
export function priceMatrixTakeBackQuery(ask: Pick<PriceMatrixAskRow, 'id'>): string {
  return `id=eq.${ask.id}&status=eq.queued`
}

/** The line after the write: the window's own toast, and what comes next. */
export function priceMatrixAppliedWords(action: 'queue' | 'take_back', landed: boolean, facts: { label: string; quotes?: number; rows?: number; requestId?: string | null; heldWords?: string }): string {
  if (action === 'take_back') {
    return landed
      ? `Taken back — the robot will not pick this up. ${facts.label} has no ask open now.`
      : `Not taken back${facts.heldWords ? ` (${facts.heldWords})` : ''}: a robot may have claimed it a moment ago. Plan again to read where it stands.`
  }
  if (!landed) return `Nothing queued for ${facts.label}${facts.heldWords ? `: ${facts.heldWords}` : ''}.`
  const q = facts.quotes ?? 0
  return `Queued for the robot — ${q} quote${q === 1 ? '' : 's'}, ${facts.rows ?? 0} fixture rows, on ${facts.label}${facts.requestId ? ` (request ${facts.requestId})` : ''}. The Pricing header's chip reads Robot pricing · queued. The pricing robot claims it with next_price_matrix on the twin seat; take_back: true takes it back while it is queued.`
}
