// A bid's prices from the dev seat (the bid train's PR 5b, to-dos/mcp-servers.md → The bid train).
// The owner, 2026-11-11: "fill out all of the line items for counts, takeoffs, labor, pricing." plan_bid_pricing →
// apply_bid_pricing sets the unit price on a count row as Bids → Pricing sets it: the tab's one write rule
// (BidsPricingTab writeUnitPriceOverrideRow) on the pricing the tab opens on (devMcpBidPricing.ts openPricing):
//   · the row has an assignment on that pricing → its unit_price_override changes (null falls back to its entry);
//   · else a book entry prices the row (resolvePricingEntry: its fixture's name) → an assignment is made with the
//     override, since the kernel prefers an entry over a custom price;
//   · else a custom price is set, changed, or cleared with null.
//   A custom price the row also carries is removed when an assignment takes over, as the tab removes it.
// All as rows under RLS as the dev: no RPC but the clone below.
//
// Where it differs from the tab, and why:
//   · a shared price book. The tab writes on the shared book first and then takes the bid's own copy
//     (freezeSharedPricingAfterWrite → clone_price_book_version_to_bid), leaving the written rows on the shared book,
//     inert. The apply clones FIRST, as the dev (the RPC is SECURITY INVOKER), points the bid at the copy (its version's
//     bid_version_id on a split bid, the ★: bids.selected_price_book_version_id and the version's starred id), then
//     plans again on the copy and writes there. The end state is the tab's, with nothing left on the shared book.
//   · a sent bid. The tab refuses a price write until someone presses Revise, a mark kept in that browser tab alone.
//     The plan refuses the same way unless the ask says revise: true.
//   · the robots' book is never cloned (the twin fence lives on it), so a price that would land there is refused.
//   · the margin stamp (bids.priced_*) is not refreshed: the tab stamps after its own price writes, and its cost
//     reads the company crew rate the seat does not compute.
// The plan states each row's price before → after and the grid's revenue total before → after through the tab's own
// kernel (scenarioPricingRows). Pure but for the reads (src/lib/devMcp/devMcpBidPrices.test.ts).

import { normalizeGroupTag } from './gcKernels/lib/bids/countSheet.ts'
import { resolvePricingEntry } from './gcKernels/lib/bids/resolvePricingEntry.ts'
import { scenarioPricingRows } from './gcKernels/lib/bids/scenarioPricingRows.ts'
import { openPricing, readAllById, type BidForPricing, type OpenPricing, type PricingBook, type PricingReader, type PricingRow, type PricingVersion } from './devMcpBidPricing.ts'
import { rowWords, rowsInScope, type CountRow } from './devMcpBidCounts.ts'
import type { RowFilter } from './devMcpDoor.ts'

export const BID_PRICES_VERBS = ['plan_bid_pricing', 'apply_bid_pricing'] as const
export type BidPricesVerb = (typeof BID_PRICES_VERBS)[number]

export function isBidPricesVerb(name: string): name is BidPricesVerb {
  return (BID_PRICES_VERBS as readonly string[]).includes(name)
}

export const PRICES_MAX_ROWS = 200
/** numeric(10,2): a price of 10^8 or more overflows the column. */
const PRICE_MAX = 99_999_999.99
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const money = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const round2 = (n: number): number => Math.round(n * 100) / 100

export type AskPrice = { n: number; fixture: string; group: string | null; price: number | null; bad: boolean }
export type BidPricesPayload = { action: 'pricing'; bid_id: string; rows: AskPrice[]; revise: boolean }
export type BidPricesInput = { ok: true; p: BidPricesPayload; target: string; planHash: string | null } | { ok: false; error: string }

const SHAPE = `needs pricing — { bid_id (a bids.id — find_bid), rows: [{ fixture, group? (the count row, by the Count Sheet's key), price (dollars each for one counted unit, 0 or more; null clears it) }] (up to ${PRICES_MAX_ROWS}), revise? (true on a bid already sent: the Pricing tab's Revise press) }.`

/** plan_bid_pricing / apply_bid_pricing's input, shaped. A row with a bad price is kept for the plan to hold. */
export function bidPricesInput(verb: BidPricesVerb, input: Json): BidPricesInput {
  const shape = `${verb} ${SHAPE}`
  const src = obj(input.pricing)
  if (!src) return { ok: false, error: shape }
  const bidId = typeof src.bid_id === 'string' ? src.bid_id.trim().toLowerCase() : ''
  if (!UUID_RE.test(bidId) || !Array.isArray(src.rows) || !src.rows.length) return { ok: false, error: shape }
  if (src.rows.length > PRICES_MAX_ROWS) return { ok: false, error: `${verb}: at most ${PRICES_MAX_ROWS} rows a call.` }
  const rows: AskPrice[] = []
  for (const [i, raw] of src.rows.entries()) {
    const r = obj(raw)
    if (!r) return { ok: false, error: `${verb}: row ${i + 1} is not an object. ${SHAPE}` }
    if (!Object.prototype.hasOwnProperty.call(r, 'price')) return { ok: false, error: `${verb}: row ${i + 1} names no price: give a number, or null to clear it.` }
    const n = r.price === null ? null : typeof r.price === 'number' ? r.price : typeof r.price === 'string' ? Number(r.price.replace(/[$,]/g, '').trim()) : Number.NaN
    const bad = n !== null && (!Number.isFinite(n) || n < 0 || n > PRICE_MAX)
    rows.push({ n: i + 1, fixture: typeof r.fixture === 'string' ? r.fixture.trim().slice(0, 300) : '', group: typeof r.group === 'string' && r.group.trim() ? r.group.trim().slice(0, 80) : null, price: bad || n === null ? null : round2(n), bad })
  }
  let planHash: string | null = null
  if (verb === 'apply_bid_pricing') {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value plan_bid_pricing replied with.` }
    planHash = h
  }
  return { ok: true, p: { action: 'pricing', bid_id: bidId, rows, revise: src.revise === true }, target: bidId, planHash }
}

// ── the world the plan reads ─────────────────────────────────────────────────────────────────────────────────────

export type PricesBid = BidForPricing & { bid_number: string | null; project_name: string | null; created_by: string | null; alternate_group_tags: string[] | null }
export type Entry = { id: string; total_price: number | string | null; version_id: string | null; fixture_types: { name: string } | null }
export type Assignment = { id: string; count_row_id: string; price_book_entry_id: string; price_book_version_id: string; is_fixed_price: boolean | null; unit_price_override: number | null }
export type CustomPrice = { id: string; count_row_id: string; price_book_version_id: string; unit_price: number }
export type BidPricesWorld = {
  bid: PricesBid | null
  open: OpenPricing | null
  countRows: CountRow[]
  entries: Entry[]
  assignments: Assignment[]
  customPrices: CustomPrice[]
}

const BID_COLS = 'id,bid_number,project_name,created_by,service_type_id,selected_bid_version_id,selected_price_book_version_id,alternate_group_tags,bid_date_sent'

/** The reads the dry run needs: the bid, the tab's pick of the open pricing, the active version's rows, the pricing's entries and overlay rows. */
export async function readBidPricesWorld(reader: PricingReader, bidId: string): Promise<BidPricesWorld> {
  const eq = (column: string, value: unknown): RowFilter => ({ column, op: 'eq', value })
  const bid = ((await reader.rows('bids', { select: BID_COLS, filters: [eq('id', bidId)], limit: 1 }))[0] as PricesBid | undefined) ?? null
  if (!bid) return { bid, open: null, countRows: [], entries: [], assignments: [], customPrices: [] }
  const [v, pr, t] = await Promise.all([
    reader.rows('bid_versions', { select: 'id,name,sort_order,starred_price_book_version_id', filters: [eq('bid_id', bidId)], order: [{ column: 'sort_order' }], limit: 50 }),
    reader.rows('price_book_versions', { select: 'id,name,bid_version_id,is_robot', filters: [eq('bid_id', bidId)], order: [{ column: 'sort_order' }], limit: 200 }),
    bid.service_type_id ? reader.rows('price_book_versions', { select: 'id,name,bid_version_id,is_robot', filters: [eq('service_type_id', bid.service_type_id), { column: 'bid_id', op: 'is', value: null }], order: [{ column: 'name' }], limit: 200 }) : Promise.resolve([]),
  ])
  const versions: PricingVersion[] = v.map((r) => ({ id: String(r.id), name: (r.name as string | null) ?? null, sort_order: Number(r.sort_order) || 0, starred_price_book_version_id: (r.starred_price_book_version_id as string | null) ?? null }))
  const book = (r: PricingRow): PricingBook => ({ id: String(r.id), name: String(r.name ?? ''), bid_version_id: (r.bid_version_id as string | null) ?? null, is_robot: (r.is_robot as boolean | null) ?? null })
  const pricings = pr.map(book)
  const templates = t.map(book)
  let legacyRefs: Array<string | null> = []
  if (!versions.length && !pricings.length) {
    const [a, c] = await Promise.all([readAllById(reader, 'bid_pricing_assignments', 'id,price_book_version_id', [eq('bid_id', bidId)]), readAllById(reader, 'bid_count_row_custom_prices', 'id,price_book_version_id', [eq('bid_id', bidId)])])
    legacyRefs = [...a.rows, ...c.rows].map((r) => (r.price_book_version_id as string | null) ?? null)
  }
  const open = openPricing({ bid, versions, pricings, templates, legacyRefs })
  if (!open.pricingId) return { bid, open, countRows: [], entries: [], assignments: [], customPrices: [] }
  const versionFilter: RowFilter = open.activeVersionId ? eq('bid_version_id', open.activeVersionId) : { column: 'bid_version_id', op: 'is', value: null }
  const [rows, entries, assignments, customPrices] = await Promise.all([
    readAllById(reader, 'bids_count_rows', 'id,fixture,count,unit,page,group_tag,sequence_order', [eq('bid_id', bidId), versionFilter]),
    readAllById(reader, 'price_book_entries', 'id,total_price,version_id,fixture_types(name)', [eq('version_id', open.pricingId)]),
    readAllById(reader, 'bid_pricing_assignments', 'id,count_row_id,price_book_entry_id,price_book_version_id,is_fixed_price,unit_price_override', [eq('bid_id', bidId), eq('price_book_version_id', open.pricingId)]),
    readAllById(reader, 'bid_count_row_custom_prices', 'id,count_row_id,price_book_version_id,unit_price', [eq('bid_id', bidId), eq('price_book_version_id', open.pricingId)]),
  ])
  for (const [what, r] of [['count rows', rows], ['book entries', entries], ['assignments', assignments], ['custom prices', customPrices]] as const) if (!r.whole) throw new Error(`the ${what} run past 5,000 rows: plan a smaller bid by hand`)
  return {
    bid, open,
    countRows: rows.rows.map((r) => ({ ...(r as unknown as CountRow), count: Number(r.count), sequence_order: Number(r.sequence_order) || 0 })),
    entries: entries.rows as unknown as Entry[],
    assignments: assignments.rows.map((r) => ({ ...(r as unknown as Assignment), unit_price_override: r.unit_price_override == null ? null : Number(r.unit_price_override) })),
    customPrices: customPrices.rows.map((r) => ({ ...(r as unknown as CustomPrice), unit_price: Number(r.unit_price) })),
  }
}

// ── the dry run ──────────────────────────────────────────────────────────────────────────────────────────────────

export type PriceOp =
  | { kind: 'override'; assignment_id: string; value: number | null; delete_custom_id: string | null }
  | { kind: 'assign'; row: Json; delete_custom_id: string | null }
  | { kind: 'custom_update'; custom_id: string; value: number }
  | { kind: 'custom_insert'; row: Json }
  | { kind: 'custom_delete'; custom_id: string }
export type PlanPrice =
  | { status: 'ready'; n: number; count_row_id: string; reads: string; op: PriceOp }
  | { status: 'unchanged'; n: number; count_row_id: string; reads: string }
  | { status: 'held'; n: number; reads: string; why: string }
export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }

/** The grid's rows and total for a world, through the tab's own kernel. */
function priceGrid(world: BidPricesWorld, pricingId: string) {
  return scenarioPricingRows({ scenarioId: pricingId, countRows: world.countRows, entries: world.entries, assignments: world.assignments, customPrices: world.customPrices })
}

/** The write the tab's writeUnitPriceOverrideRow makes for one row, on the world as it stands. */
export function priceOp(world: BidPricesWorld, pricingId: string, countRowId: string, value: number | null): PriceOp | null {
  const existing = world.assignments.find((a) => a.count_row_id === countRowId && a.price_book_version_id === pricingId) ?? null
  const entry = resolvePricingEntry({ countRowId, versionId: pricingId, assignments: world.assignments, entries: world.entries as never, countRows: world.countRows }) as Entry | null
  const custom = world.customPrices.find((c) => c.count_row_id === countRowId && c.price_book_version_id === pricingId) ?? null
  if (existing) return { kind: 'override', assignment_id: existing.id, value, delete_custom_id: custom?.id ?? null }
  if (entry) return { kind: 'assign', row: { bid_id: world.bid?.id, count_row_id: countRowId, price_book_entry_id: entry.id, price_book_version_id: pricingId, unit_price_override: value }, delete_custom_id: custom?.id ?? null }
  if (value == null) return custom ? { kind: 'custom_delete', custom_id: custom.id } : null
  return custom ? { kind: 'custom_update', custom_id: custom.id, value } : { kind: 'custom_insert', row: { bid_id: world.bid?.id, count_row_id: countRowId, price_book_version_id: pricingId, unit_price: value } }
}

/** The world after one op, for the after-total and the next row's op. */
function applyOp(world: BidPricesWorld, op: PriceOp, countRowId: string): BidPricesWorld {
  const next = { ...world, assignments: [...world.assignments], customPrices: [...world.customPrices] }
  const dropCustom = (id: string | null) => { if (id) next.customPrices = next.customPrices.filter((c) => c.id !== id) }
  if (op.kind === 'override') {
    next.assignments = next.assignments.map((a) => (a.id === op.assignment_id ? { ...a, unit_price_override: op.value } : a))
    dropCustom(op.delete_custom_id)
  } else if (op.kind === 'assign') {
    next.assignments.push({ id: `new-${countRowId}`, count_row_id: countRowId, price_book_entry_id: String(op.row.price_book_entry_id), price_book_version_id: String(op.row.price_book_version_id), is_fixed_price: false, unit_price_override: (op.row.unit_price_override as number | null) ?? null })
    dropCustom(op.delete_custom_id)
  } else if (op.kind === 'custom_update') next.customPrices = next.customPrices.map((c) => (c.id === op.custom_id ? { ...c, unit_price: op.value } : c))
  else if (op.kind === 'custom_insert') next.customPrices.push({ id: `new-${countRowId}`, count_row_id: countRowId, price_book_version_id: String(op.row.price_book_version_id), unit_price: Number(op.row.unit_price) })
  else dropCustom(op.custom_id)
  return next
}

export function pricesBidLabel(bid: { bid_number: string | null; project_name: string | null }): string {
  return [bid.bid_number?.trim() ? `b${bid.bid_number.trim()}` : '', bid.project_name?.trim() ?? ''].filter(Boolean).join(' ') || 'this bid'
}

const priceWords = (r: { priced: boolean; unitPrice: number } | undefined): string => (r?.priced ? `${money(r.unitPrice)} each` : 'unpriced')

/**
 * What the plan says and what the hash commits to: the bid, the pricing the tab opens on and whether the apply takes
 * the bid's own copy first, every row's price before → after with the write the tab's rule makes, held rows with their
 * reason, and the grid's revenue total before → after. A plan with nothing ready is refused.
 */
export function bidPricesDryRun(p: BidPricesPayload, world: BidPricesWorld): DryRun {
  const bid = world.bid
  if (!bid) return { ok: false, refused: `No bid ${p.bid_id} is visible to you — find_bid resolves a number or a name.` }
  const label = pricesBidLabel(bid)
  if (!bid.created_by) return { ok: false, refused: `${label} has no creator on record, and the database lets nobody write the prices of such a bid (can_access_bid_for_pricing). Nothing can be written until the bid has one.` }
  if (bid.bid_date_sent && !p.revise) return { ok: false, refused: `${label} was sent on ${bid.bid_date_sent}, and the Pricing tab locks a sent bid's prices until someone presses Revise. Plan again with revise: true if the paper's prices are what the bid should read.` }
  const open = world.open
  if (!open?.pricingId) return { ok: false, refused: `${label} has no pricing to write on: no price book of its own and none to fall back on. Open its Pricing tab once and pick a price book, then plan again.` }
  const pricingId = open.pricingId
  if (open.target.kind === 'robot') return { ok: false, refused: `${label} opens on the robots' price book, which is never copied to a bid (the twin fence lives on it). Pick a price book of its own on the Pricing tab first.` }
  if (open.target.kind === 'unknown' || open.target.kind === 'none') return { ok: false, refused: `${label} opens on a price book that is neither its own nor one of its trade's shared books. Open its Pricing tab and pick one, then plan again.` }
  if (!world.countRows.length) return { ok: false, refused: `${label} has no count rows on the version its Pricing tab opens on. plan_bid_counts adds them.` }
  const tags = bid.alternate_group_tags ?? []
  const before = priceGrid(world, pricingId)
  const beforeById = new Map(before.rows.map((r) => [r.countRow.id, r]))
  const picked = new Map<string, number[]>()
  const resolved = p.rows.map((ask) => {
    const matches = ask.fixture ? rowsInScope(world.countRows, ask.fixture, ask.group, tags) : []
    const row = matches.length === 1 ? matches[0] ?? null : ask.group ? (matches.filter((m) => normalizeGroupTag(m.group_tag) === normalizeGroupTag(ask.group)).length === 1 ? matches.find((m) => normalizeGroupTag(m.group_tag) === normalizeGroupTag(ask.group)) ?? null : null) : null
    if (row) picked.set(row.id, [...(picked.get(row.id) ?? []), ask.n])
    return { ask, matches, row }
  })
  let after = world
  const rows: PlanPrice[] = []
  for (const { ask, matches, row } of resolved) {
    const shown = `${ask.fixture || '(no fixture)'}${ask.group ? ` (${ask.group})` : ''}`
    const hold = (why: string): void => { rows.push({ status: 'held', n: ask.n, reads: row ? rowWords(row) : shown, why }) }
    if (!ask.fixture) { hold('a row names its fixture'); continue }
    if (ask.bad) { hold('price is dollars each, 0 or more, under $100,000,000, or null to clear it'); continue }
    if (!matches.length) { hold('no count row wears that fixture there: plan_bid_counts adds it'); continue }
    if (!row) { hold(`${matches.length} count rows wear that fixture there (${matches.map((m) => rowWords(m)).join('; ')}): name the group of the one you mean`); continue }
    if ((picked.get(row.id) ?? []).length > 1) { hold(`rows ${(picked.get(row.id) ?? []).join(' and ')} of the ask price the same count row`); continue }
    const was = beforeById.get(row.id)
    const op = priceOp(after, pricingId, row.id, ask.price)
    if (!op) { rows.push({ status: 'unchanged', n: ask.n, count_row_id: row.id, reads: `${rowWords(row)}: unpriced, and nothing to clear` }); continue }
    const next = applyOp(after, op, row.id)
    const now = priceGrid(next, pricingId).rows.find((r) => r.countRow.id === row.id)
    if ((was?.priced ?? false) === (now?.priced ?? false) && round2(was?.unitPrice ?? 0) === round2(now?.unitPrice ?? 0)) { rows.push({ status: 'unchanged', n: ask.n, count_row_id: row.id, reads: `${rowWords(row)}: already ${priceWords(was)}` }); continue }
    after = next
    rows.push({ status: 'ready', n: ask.n, count_row_id: row.id, reads: `${rowWords(row)}: ${priceWords(was)} → ${priceWords(now)}${ask.price == null && now?.priced ? ' (its book entry\'s price)' : ''}`, op })
  }
  const ready = rows.filter((r) => r.status === 'ready')
  if (!ready.length) {
    const held = rows.filter((r): r is Extract<PlanPrice, { status: 'held' }> => r.status === 'held')
    return { ok: false, refused: `Nothing ready on ${label}.${held.length ? ` Held: ${held.map((h) => `${h.reads} — ${h.why}`).join('; ')}.` : ' Every row already reads that price.'}` }
  }
  const total = priceGrid(after, pricingId)
  const shared = open.target.kind === 'shared'
  const after_write = [
    'Pricing\'s grid and its Workbench read the new prices at once; the Cover Letter and its total follow.',
    'The bid\'s History records each price under your name.',
  ]
  const warnings: string[] = []
  if (shared) after_write.unshift(`The bid prices on the shared book "${open.name}". The apply first takes the bid's own copy of it, as the tab does on its first price write, points the bid at the copy, and writes the prices there: the shared book itself does not change.`)
  if (bid.bid_date_sent) warnings.push(`${label} was sent on ${bid.bid_date_sent}: these prices replace the ones it was sent at, as a Revise does.`)
  warnings.push('The margin the tab last stamped on the bid is not refreshed here: the tab stamps after its own price writes, and its cost reads the company crew rate.')
  return {
    ok: true,
    reply: {
      action: 'pricing',
      bid: { id: bid.id, label, sent_on: bid.bid_date_sent ?? null },
      pricing: { id: pricingId, name: open.name, kind: open.target.kind, version: open.versionName, viewer_dependent: open.viewerDependent, copy_first: shared },
      counts: { ready: ready.length, unchanged: rows.filter((r) => r.status === 'unchanged').length, held: rows.filter((r) => r.status === 'held').length },
      rows,
      revenue: { before: money(round2(before.totalRevenue)), after: money(round2(total.totalRevenue)), words: `The Pricing grid's revenue total: ${money(round2(before.totalRevenue))} → ${money(round2(total.totalRevenue))}.` },
      after_write,
      warnings,
      not_done: [
        'a price on another price book than the one the tab opens on, and the ★ moved between books',
        'a whole book filled from the price book (Fill matching), the margin brush and the Workbench solver',
        'a row hidden from the submission documents',
        'the price book\'s own entries, and the margin stamp',
      ],
    },
  }
}

/** The apply's reply: what landed, what failed with its reason, and the grid's total as it reads now. */
export function bidPricesAppliedWords(label: string, done: { copied: string | null; priced: number }, failed: Array<{ n: number | null; what: string; why: string }>, held: number, totalNow: string | null): Json {
  return {
    label,
    copied_to: done.copied,
    landed: `${done.priced} price${done.priced === 1 ? '' : 's'} written${done.copied ? ', on the bid\'s own copy of the shared book' : ''}`,
    failed,
    held_in_plan: held,
    revenue_now: totalNow,
    next: failed.length ? `${label}: ${done.priced} landed and ${failed.length} did not (named in failed, each with its reason). Plan again for what is left.` : `${label}'s prices read as planned${totalNow ? `: the grid totals ${totalNow}` : ''}. get_bid reads the total.`,
  }
}
