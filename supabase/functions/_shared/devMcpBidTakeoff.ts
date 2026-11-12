// A bid's takeoff from the dev seat (the bid train's PR 3, to-dos/mcp-servers.md → The bid train).
// The owner, 2026-11-11: "fill out all of the line items for counts, takeoffs, labor, pricing." plan_bid_takeoff →
// apply_bid_takeoff writes what the Takeoffs tab holds on a count row: its part lines (bids_takeoff_rough_part_lines,
// every one saved by src/hooks/useTakeoffRoughLines.ts persistTakeoffRoughPartLine) and the quoted materials cost each
// (bid_count_row_custom_costs, one a row, the row QuoteCompare's Apply writes and twin-mcp's paste_counts writes for
// TakeoffTooling's cost). All as rows under RLS as the dev: no RPC exists for either and none is owed.
//
// The screen's rules, kept:
//   · a line's quantity is for ONE counted unit; the row's count multiplies it (roughCountMultiplier).
//   · picking a part prices the line at the catalog's lowest price and remembers which price row (fetchLowestPartPrice;
//     the lowest, a tie to the smaller id, as the batch read breaks it); a typed price forgets the price row; no price
//     in the book is $0 and said.
//   · the line snapshots how the part is sold (effectiveOrderIncrement: the part's own rule, else its type's).
//   · a new line goes after the row's last (sequence max + 1).
//   · the materials total is combinedMaterials, from the kernel copy: Σ count × quantity × price plus the order
//     rounding, pre-tax, the number the tab's strip and Pricing read.
// The screen lets a part sit twice on a row; the seat's key is one line a part on a row, so it changes the one line
// that carries the part, adds when none does, and holds when several do (replace rewrites the row's lines whole).
// Pure: no env reads, no network (src/lib/devMcp/devMcpBidTakeoff.test.ts).

import { combinedMaterials } from './gcKernels/lib/bids/bidMaterials.ts'
import { roughCountMultiplier } from './gcKernels/lib/bids/bidTakeoffHelpers.ts'
import { normalizeGroupTag } from './gcKernels/lib/bids/countSheet.ts'
import { pickActiveVersion } from './gcKernels/lib/bids/pickActiveVersion.ts'
import { effectiveOrderIncrement } from './gcKernels/lib/materials/orderIncrement.ts'
import { rowWords, rowsInScope, type CountRow } from './devMcpBidCounts.ts'

export const BID_TAKEOFF_VERBS = ['plan_bid_takeoff', 'apply_bid_takeoff'] as const
export type BidTakeoffVerb = (typeof BID_TAKEOFF_VERBS)[number]

export function isBidTakeoffVerb(name: string): name is BidTakeoffVerb {
  return (BID_TAKEOFF_VERBS as readonly string[]).includes(name)
}

export const TAKEOFF_MAX_ROWS = 100
export const TAKEOFF_MAX_LINES = 400
/** bid_count_row_custom_costs.source's one allowed value (its CHECK, migration 20260902181208). */
export const CUSTOM_COST_SOURCE = 'quoted'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN)
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const money = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export type AskLine = { n: number; part_id: string | null; part: string | null; quantity: number; unit_price: number | null }
export type AskTakeoffRow = {
  n: number
  fixture: string
  group: string | null
  replace: boolean
  lines: AskLine[]
  /** The quoted materials cost for one counted unit, in dollars; null clears it; undefined leaves it. */
  materials_each?: number | null
  materials_from: string | null
}
export type BidTakeoffPayload = { action: 'takeoff'; bid_id: string; version_id?: string; rows: AskTakeoffRow[] }
export type BidTakeoffInput = { ok: true; p: BidTakeoffPayload; target: string; planHash: string | null } | { ok: false; error: string }

const SHAPE = `needs takeoff — { bid_id (a bids.id — find_bid), rows: [{ fixture, group? (the count row, by the Count Sheet's key), lines?: [{ part_id (a material_parts.id) | part (its exact name in the bid's trade's parts book), quantity (for ONE counted unit, above zero), unit_price? (dollars each; the book's lowest price when left out) }], replace? (true: the row's lines are rewritten whole), materials_each? (dollars: a quoted materials cost for one counted unit; null clears it), materials_from? (who quoted it) }] (up to ${TAKEOFF_MAX_ROWS} rows, ${TAKEOFF_MAX_LINES} lines), version_id? }.`

/** plan_bid_takeoff / apply_bid_takeoff's input, shaped. A row or a line with a fault is kept for the plan to hold. */
export function bidTakeoffInput(verb: BidTakeoffVerb, input: Json): BidTakeoffInput {
  const shape = `${verb} ${SHAPE}`
  const src = obj(input.takeoff)
  if (!src) return { ok: false, error: shape }
  const bidId = typeof src.bid_id === 'string' ? src.bid_id.trim().toLowerCase() : ''
  if (!UUID_RE.test(bidId) || !Array.isArray(src.rows) || !src.rows.length) return { ok: false, error: shape }
  if (src.rows.length > TAKEOFF_MAX_ROWS) return { ok: false, error: `${verb}: at most ${TAKEOFF_MAX_ROWS} rows a call.` }
  const rows: AskTakeoffRow[] = []
  let lineCount = 0
  for (const [i, raw] of src.rows.entries()) {
    const r = obj(raw)
    if (!r) return { ok: false, error: `${verb}: row ${i + 1} is not an object. ${SHAPE}` }
    if (r.lines !== undefined && !Array.isArray(r.lines)) return { ok: false, error: `${verb}: row ${i + 1}'s lines is a list. ${SHAPE}` }
    const lines: AskLine[] = []
    for (const [j, rawLine] of ((r.lines as unknown[] | undefined) ?? []).entries()) {
      const l = obj(rawLine)
      if (!l) return { ok: false, error: `${verb}: row ${i + 1}, line ${j + 1} is not an object. ${SHAPE}` }
      const partId = text(l.part_id, 60).toLowerCase()
      lines.push({ n: j + 1, part_id: partId || null, part: text(l.part, 300) || null, quantity: num(l.quantity), unit_price: l.unit_price == null ? null : num(l.unit_price) })
    }
    lineCount += lines.length
    const row: AskTakeoffRow = { n: i + 1, fixture: text(r.fixture, 300), group: text(r.group, 80) || null, replace: r.replace === true, lines, materials_from: text(r.materials_from, 120) || null }
    if (Object.prototype.hasOwnProperty.call(r, 'materials_each')) row.materials_each = r.materials_each === null ? null : num(r.materials_each)
    rows.push(row)
  }
  if (lineCount > TAKEOFF_MAX_LINES) return { ok: false, error: `${verb}: at most ${TAKEOFF_MAX_LINES} lines a call.` }
  const p: BidTakeoffPayload = { action: 'takeoff', bid_id: bidId, rows }
  if (src.version_id != null) {
    const v = typeof src.version_id === 'string' ? src.version_id.trim().toLowerCase() : ''
    if (!UUID_RE.test(v)) return { ok: false, error: `${verb}: version_id is a bid_versions.id — get_bid lists the bid's versions.` }
    p.version_id = v
  }
  let planHash: string | null = null
  if (verb === 'apply_bid_takeoff') {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value plan_bid_takeoff replied with.` }
    planHash = h
  }
  return { ok: true, p, target: bidId, planHash }
}

// ── the world the plan reads ─────────────────────────────────────────────────────────────────────────────────────

export type TakeoffReads = {
  /** GET /rest/v1/<table>?<query> as the dev; the rows. Throws on a refused read. */
  rows(table: string, query: string): Promise<Json[]>
}

export type TakeoffBid = { id: string; bid_number: string | null; project_name: string | null; service_type_id: string; selected_bid_version_id: string | null; alternate_group_tags: string[] | null; bid_date_sent: string | null }
export type TakeoffVersion = { id: string; name: string | null; sort_order: number; locked_at: string | null }
export type TakeoffLine = { id: string; count_row_id: string; part_id: string | null; quantity: number; unit_price: number; sequence_order: number; source_material_part_price_id: string | null; source_template_id: string | null; order_increment: number | null; order_increment_unit: string | null }
export type PartRow = { id: string; name: string | null; manufacturer: string | null; service_type_id: string | null; order_increment: number | string | null; order_increment_unit: string | null; part_types: { order_increment: number | string | null; order_increment_unit: string | null } | null }
export type CustomCost = { id: string; count_row_id: string; unit_materials_cents: number; house_name: string | null }
export type BidTakeoffWorld = {
  me: { userId: string }
  bid: TakeoffBid | null
  versions: TakeoffVersion[]
  versionId: string | null
  countRows: CountRow[]
  lines: TakeoffLine[]
  /** The parts the ask names, by id and by name; a name may find several. */
  parts: PartRow[]
  /** The book's lowest price per part: the lowest, a tie to the smaller id. */
  lowest: Record<string, { priceId: string; price: number }>
  customCosts: CustomCost[]
}

const BID_COLS = 'id,bid_number,project_name,service_type_id,selected_bid_version_id,alternate_group_tags,bid_date_sent'
const ROW_COLS = 'id,fixture,count,unit,page,group_tag,sequence_order'
export const LINE_COLS = 'id,count_row_id,part_id,quantity,unit_price,sequence_order,source_material_part_price_id,source_template_id,order_increment,order_increment_unit'
const PART_COLS = 'id,name,manufacturer,service_type_id,order_increment,order_increment_unit,part_types(order_increment,order_increment_unit)'

async function paged(reads: TakeoffReads, table: string, query: string): Promise<Json[]> {
  const all: Json[] = []
  for (let offset = 0; offset < 4000; offset += 200) {
    const page = await reads.rows(table, `${query}&limit=200&offset=${offset}`)
    all.push(...page)
    if (page.length < 200) break
  }
  return all
}

/** The reads the dry run needs: the bid, its versions, the active version's count rows and lines, the parts and their lowest prices, the rows' quoted costs. */
export async function readBidTakeoffWorld(reads: TakeoffReads, p: BidTakeoffPayload, me: { userId: string }): Promise<BidTakeoffWorld> {
  const [bidRows, versionRows] = await Promise.all([
    reads.rows('bids', `select=${BID_COLS}&id=eq.${p.bid_id}`),
    reads.rows('bid_versions', `select=id,name,sort_order,locked_at&bid_id=eq.${p.bid_id}&order=sort_order.asc`),
  ])
  const bid = (bidRows[0] as TakeoffBid | undefined) ?? null
  const versions = (versionRows as TakeoffVersion[]).map((v) => ({ ...v, sort_order: Number(v.sort_order) }))
  const versionId = p.version_id ?? pickActiveVersion({ savedVersionId: bid?.selected_bid_version_id ?? null, bidVersions: versions })
  if (!bid) return { me, bid, versions, versionId, countRows: [], lines: [], parts: [], lowest: {}, customCosts: [] }
  const versionFilter = `bid_version_id=${versionId ? `eq.${versionId}` : 'is.null'}`
  // The tab's own loads (useBidPricingEngine loadTakeoffCountRows): the active version's count rows and its lines.
  const [countRows, lineRows, costRows] = await Promise.all([
    paged(reads, 'bids_count_rows', `select=${ROW_COLS}&bid_id=eq.${p.bid_id}&${versionFilter}&order=sequence_order.asc,id.asc`),
    paged(reads, 'bids_takeoff_rough_part_lines', `select=${LINE_COLS}&bid_id=eq.${p.bid_id}&${versionFilter}&order=count_row_id.asc,sequence_order.asc,id.asc`),
    paged(reads, 'bid_count_row_custom_costs', `select=id,count_row_id,unit_materials_cents,house_name&bid_id=eq.${p.bid_id}&order=id.asc`),
  ])
  const ids = [...new Set(p.rows.flatMap((r) => r.lines.map((l) => l.part_id)).filter((v): v is string => !!v && UUID_RE.test(v)))]
  const names = [...new Set(p.rows.flatMap((r) => r.lines.filter((l) => !l.part_id && l.part).map((l) => (l.part as string).toLowerCase())))]
  const parts: PartRow[] = []
  if (ids.length) parts.push(...((await reads.rows('material_parts', `select=${PART_COLS}&id=in.(${ids.join(',')})&limit=1000`)) as PartRow[]))
  for (const name of names) {
    // ilike with no wildcard is a case-blind equals; `*`, `%` and `_` are taken out and the answer is checked again here.
    const found = (await reads.rows('material_parts', `select=${PART_COLS}&service_type_id=eq.${bid.service_type_id}&name=ilike.${encodeURIComponent(name.replace(/[%*_,()]/g, ' '))}&order=id.asc&limit=50`)) as PartRow[]
    for (const part of found) if ((part.name ?? '').trim().toLowerCase() === name && !parts.some((x) => x.id === part.id)) parts.push(part)
  }
  const lowest: BidTakeoffWorld['lowest'] = {}
  if (parts.length) {
    const prices = await paged(reads, 'material_part_prices', `select=id,part_id,price&part_id=in.(${parts.map((x) => x.id).join(',')})&order=price.asc,id.asc`)
    for (const r of prices) {
      const partId = String(r.part_id)
      const price = Number(r.price)
      const prev = lowest[partId]
      if (!prev || price < prev.price || (price === prev.price && String(r.id) < prev.priceId)) lowest[partId] = { priceId: String(r.id), price }
    }
  }
  return {
    me, bid, versions, versionId,
    countRows: countRows.map((r) => ({ ...(r as CountRow), count: Number(r.count), sequence_order: Number(r.sequence_order) })),
    lines: lineRows.map((r) => ({ ...(r as TakeoffLine), quantity: Number(r.quantity), unit_price: Number(r.unit_price), sequence_order: Number(r.sequence_order), order_increment: r.order_increment == null ? null : Number(r.order_increment) })),
    parts, lowest,
    customCosts: costRows.map((r) => ({ ...(r as CustomCost), unit_materials_cents: Number(r.unit_materials_cents) })),
  }
}

// ── the dry run ──────────────────────────────────────────────────────────────────────────────────────────────────

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }
export type PlanLine =
  | { status: 'add'; n: number; reads: string; row: Json }
  | { status: 'change'; n: number; id: string; reads: string; patch: Json }
  | { status: 'unchanged'; n: number; id: string; reads: string }
  | { status: 'held'; n: number; reads: string; why: string }
export type PlanCost =
  | { status: 'set'; reads: string; row: Json }
  | { status: 'clear'; id: string; reads: string }
  | { status: 'unchanged'; reads: string }
  | { status: 'held'; reads: string; why: string }
export type PlanTakeoffRow = {
  n: number
  status: 'ready' | 'unchanged' | 'held'
  why?: string
  count_row_id: string | null
  reads: string
  /** The saved lines a replace removes first. */
  remove_line_ids: string[]
  lines: PlanLine[]
  cost: PlanCost | null
  /** One counted unit's materials off the lines, before and after, and the row's total after. */
  each_before?: string
  each_after?: string
  row_after?: string
}

const partWords = (part: PartRow): string => [part.name?.trim() || 'a part with no name', part.manufacturer?.trim() ? `(${part.manufacturer.trim()})` : ''].filter(Boolean).join(' ')
const lineWords = (part: PartRow | null, quantity: number, unitPrice: number): string => `${quantity} × ${part ? partWords(part) : 'a part'} at ${money(unitPrice)}`

function pickCountRow(matches: CountRow[], group: string | null): CountRow | null {
  if (matches.length === 1) return matches[0] ?? null
  if (!group) return null
  const same = matches.filter((r) => normalizeGroupTag(r.group_tag) === normalizeGroupTag(group))
  return same.length === 1 ? (same[0] ?? null) : null
}

export function takeoffBidLabel(bid: { bid_number: string | null; project_name: string | null }): string {
  return [bid.bid_number?.trim() ? `b${bid.bid_number.trim()}` : '', bid.project_name?.trim() ?? ''].filter(Boolean).join(' ') || 'this bid'
}

/** The bid's materials off its part lines, pre-tax, with the order rounding: the Takeoffs strip's and Pricing's number. */
export function materialsTotal(lines: ReadonlyArray<Pick<TakeoffLine, 'count_row_id' | 'part_id' | 'quantity' | 'unit_price' | 'order_increment' | 'order_increment_unit'>>, countRows: CountRow[]): { total: number; byRow: Record<string, number> } {
  const m = combinedMaterials(lines, new Map(countRows.map((r) => [r.id, r.count])))
  return { total: m.total, byRow: m.byCountRowId }
}

/**
 * What the plan says and what the hash commits to: each asked count row with its lines as add, change, unchanged or
 * held, the lines a replace removes, the quoted cost set or cleared, one unit's materials before and after, and the
 * bid's materials total before and after through the tab's own kernel. A line or a row with a fault is held and the
 * rest goes on; a replace with a held line holds the whole row; a plan with nothing ready is refused.
 */
export function bidTakeoffDryRun(p: BidTakeoffPayload, world: BidTakeoffWorld): DryRun {
  const bid = world.bid
  if (!bid) return { ok: false, refused: `No bid ${p.bid_id} is visible to you — find_bid resolves a number or a name.` }
  const label = takeoffBidLabel(bid)
  if (p.version_id && !world.versions.some((v) => v.id === p.version_id)) return { ok: false, refused: `${label} has no version ${p.version_id}. ${world.versions.length ? `Its versions: ${world.versions.map((v) => `${v.name ?? 'unnamed'} (${v.id})`).join(', ')}.` : 'It has never been split into versions: leave version_id out.'}` }
  const version = world.versions.find((v) => v.id === world.versionId) ?? null
  const tags = bid.alternate_group_tags ?? []
  const partById = new Map(world.parts.map((x) => [x.id, x]))

  const picked = new Map<string, number[]>()
  const resolved = p.rows.map((ask) => {
    const matches = ask.fixture ? rowsInScope(world.countRows, ask.fixture, ask.group, tags) : []
    const row = pickCountRow(matches, ask.group)
    if (row) picked.set(row.id, [...(picked.get(row.id) ?? []), ask.n])
    return { ask, matches, row }
  })

  const afterLines: TakeoffLine[] = world.lines.map((l) => ({ ...l }))
  const rows: PlanTakeoffRow[] = []
  for (const { ask, matches, row } of resolved) {
    const shown = `${ask.fixture || '(no fixture)'}${ask.group ? ` (${ask.group})` : ''}`
    const holdRow = (why: string): void => { rows.push({ n: ask.n, status: 'held', why, count_row_id: row?.id ?? null, reads: row ? rowWords(row) : shown, remove_line_ids: [], lines: [], cost: null }) }
    if (!ask.fixture) { holdRow('a row names its fixture'); continue }
    if (!matches.length) { holdRow('no count row wears that fixture there: add it with plan_bid_counts first'); continue }
    if (!row) { holdRow(`${matches.length} count rows wear that fixture there (${matches.map((m) => rowWords(m)).join('; ')}): name the group of the one you mean`); continue }
    if ((picked.get(row.id) ?? []).length > 1) { holdRow(`rows ${(picked.get(row.id) ?? []).join(' and ')} of the ask name the same count row: give its lines once`); continue }
    if (!ask.lines.length && ask.materials_each === undefined && !ask.replace) { holdRow('the row asks for nothing: give lines, materials_each, or replace'); continue }

    const existing = world.lines.filter((l) => l.count_row_id === row.id)
    const seen = new Map<string, number[]>()
    // First pass: each line's part and its faults.
    const firstPass = ask.lines.map((l) => {
      const part = l.part_id ? (UUID_RE.test(l.part_id) ? partById.get(l.part_id) ?? null : null) : null
      const byName = !l.part_id && l.part ? world.parts.filter((x) => (x.name ?? '').trim().toLowerCase() === (l.part as string).toLowerCase() && x.service_type_id === bid.service_type_id) : []
      const found = part ?? (byName.length === 1 ? byName[0] ?? null : null)
      let why: string | null = null
      if (!l.part_id && !l.part) why = 'a line names its part: part_id, or part (its exact name)'
      else if (l.part_id && !UUID_RE.test(l.part_id)) why = 'part_id is a material_parts.id'
      else if (l.part_id && !part) why = `no part ${l.part_id} is visible to you`
      else if (!l.part_id && !byName.length) why = `no part named "${l.part}" in this bid's trade's parts book: read_rows on material_parts finds it, or give part_id`
      else if (!l.part_id && byName.length > 1) why = `${byName.length} parts are named "${l.part}" (${byName.map((x) => `${x.id}${x.manufacturer ? ` ${x.manufacturer}` : ''}`).join('; ')}): give part_id`
      else if (found && found.service_type_id !== bid.service_type_id) why = 'that part is in another trade\'s book: the tab lists only this bid\'s trade'
      else if (!Number.isFinite(l.quantity) || l.quantity <= 0) why = 'quantity is for one counted unit, a number above zero'
      else if (l.unit_price != null && (!Number.isFinite(l.unit_price) || l.unit_price < 0)) why = 'unit_price is dollars each, 0 or more'
      if (!why && found) seen.set(found.id, [...(seen.get(found.id) ?? []), l.n])
      return { l, part: found, why }
    })
    const lines: PlanLine[] = []
    let seq = existing.length ? Math.max(...existing.map((l) => l.sequence_order), 0) : 0
    if (ask.replace) seq = 0
    const rowAfter: TakeoffLine[] = ask.replace ? [] : existing.map((l) => ({ ...l }))
    for (const { l, part, why: fault } of firstPass) {
      const quantity = l.quantity
      const shownLine = part ? lineWords(part, Number.isFinite(quantity) ? quantity : 0, l.unit_price ?? world.lowest[part.id]?.price ?? 0) : (l.part ?? l.part_id ?? 'a line')
      let why = fault
      if (!why && part && (seen.get(part.id) ?? []).length > 1) why = `lines ${(seen.get(part.id) ?? []).join(' and ')} name the same part: the seat keeps one line a part on a row, so add the quantities together`
      const carrying = part && !ask.replace ? existing.filter((x) => x.part_id === part.id) : []
      if (!why && carrying.length > 1) why = `${carrying.length} lines on this row already carry that part: replace: true rewrites the row's lines whole`
      if (why || !part) { lines.push({ status: 'held', n: l.n, reads: shownLine, why: why ?? 'no part' }); continue }
      const low = world.lowest[part.id] ?? null
      const one = carrying[0]
      if (one) {
        const patch: Json = {}
        if (one.quantity !== quantity) patch.quantity = quantity
        // A typed price forgets the price row it came from, as typing in the tab's price box does.
        if (l.unit_price != null && one.unit_price !== l.unit_price) { patch.unit_price = l.unit_price; patch.source_material_part_price_id = null }
        const after = { ...one, ...(patch as Partial<TakeoffLine>) }
        const idx = rowAfter.findIndex((x) => x.id === one.id)
        if (idx >= 0) rowAfter[idx] = after
        if (!Object.keys(patch).length) lines.push({ status: 'unchanged', n: l.n, id: one.id, reads: lineWords(part, one.quantity, one.unit_price) })
        else lines.push({ status: 'change', n: l.n, id: one.id, reads: `${lineWords(part, one.quantity, one.unit_price)} → ${lineWords(part, after.quantity, after.unit_price)}`, patch })
        continue
      }
      seq += 1
      const inc = effectiveOrderIncrement(part, part.part_types).value
      const unitPrice = l.unit_price ?? low?.price ?? 0
      const insert = {
        bid_id: bid.id, bid_version_id: world.versionId, count_row_id: row.id, part_id: part.id, quantity, unit_price: unitPrice, sequence_order: seq,
        source_material_part_price_id: l.unit_price == null ? low?.priceId ?? null : null, source_template_id: null,
        order_increment: inc?.increment ?? null, order_increment_unit: inc ? inc.unit : null,
      }
      rowAfter.push({ id: `new-${ask.n}-${l.n}`, count_row_id: row.id, part_id: part.id, quantity, unit_price: unitPrice, sequence_order: seq, source_material_part_price_id: insert.source_material_part_price_id, source_template_id: null, order_increment: insert.order_increment, order_increment_unit: insert.order_increment_unit })
      lines.push({ status: 'add', n: l.n, reads: `${lineWords(part, quantity, unitPrice)}${l.unit_price == null ? (low ? ' (the book\'s lowest)' : ' — no price in the book for this part: $0 until one is typed') : ''}`, row: insert })
    }
    const heldLines = lines.filter((x) => x.status === 'held')
    if (ask.replace && heldLines.length) { holdRow(`a replace goes whole or not at all, and ${heldLines.length === 1 ? 'a line is' : `${heldLines.length} lines are`} held: ${heldLines.map((h) => (h.status === 'held' ? `line ${h.n} — ${h.why}` : '')).join('; ')}`); continue }

    // The quoted materials cost for one counted unit.
    let cost: PlanCost | null = null
    const has = world.customCosts.find((c) => c.count_row_id === row.id) ?? null
    if (ask.materials_each !== undefined) {
      if (ask.materials_each === null) {
        cost = has ? { status: 'clear', id: has.id, reads: `the quoted cost of ${money(has.unit_materials_cents / 100)} each comes off` } : { status: 'unchanged', reads: 'no quoted cost on this row' }
      } else if (!Number.isFinite(ask.materials_each) || ask.materials_each < 0) {
        cost = { status: 'held', reads: 'materials_each', why: 'materials_each is dollars for one counted unit, 0 or more, or null to clear it' }
      } else {
        const cents = Math.round(ask.materials_each * 100)
        if (has && has.unit_materials_cents === cents && (has.house_name ?? null) === (ask.materials_from ?? has.house_name ?? null)) cost = { status: 'unchanged', reads: `${money(cents / 100)} each already quoted` }
        else cost = { status: 'set', reads: `${has ? `${money(has.unit_materials_cents / 100)} → ` : ''}${money(cents / 100)} each quoted${ask.materials_from ? ` by ${ask.materials_from}` : ''}`, row: { bid_id: bid.id, count_row_id: row.id, unit_materials_cents: cents, source: CUSTOM_COST_SOURCE, quote_line_id: null, lot_group_id: null, house_name: ask.materials_from ?? has?.house_name ?? null, applied_by: world.me.userId } }
      }
    }
    const removeIds = ask.replace ? existing.map((l) => l.id) : []
    const moving = removeIds.length > 0 || lines.some((x) => x.status === 'add' || x.status === 'change') || cost?.status === 'set' || cost?.status === 'clear'
    // The bid's lines after this row's part of the plan.
    for (let i = afterLines.length - 1; i >= 0; i--) if (afterLines[i]?.count_row_id === row.id) afterLines.splice(i, 1)
    afterLines.push(...rowAfter)
    const each = (list: TakeoffLine[]) => list.reduce((s, l) => s + l.quantity * l.unit_price, 0)
    rows.push({
      n: ask.n, status: moving ? 'ready' : 'unchanged', count_row_id: row.id, reads: rowWords(row), remove_line_ids: removeIds, lines, cost,
      each_before: money(each(existing)), each_after: money(each(rowAfter)), row_after: money(each(rowAfter) * roughCountMultiplier(row.count)),
    })
  }

  const ready = rows.filter((r) => r.status === 'ready')
  if (!ready.length) {
    const held = rows.filter((r) => r.status === 'held')
    return { ok: false, refused: `Nothing ready on ${label}.${held.length ? ` Held: ${held.map((h) => `${h.reads} — ${h.why}`).join('; ')}.` : ' Every row already reads that way.'}` }
  }
  const before = materialsTotal(world.lines, world.countRows)
  const after = materialsTotal(afterLines, world.countRows)
  const count = (pred: (l: PlanLine) => boolean) => ready.reduce((s, r) => s + r.lines.filter(pred).length, 0)
  const warnings: string[] = []
  const zero = count((l) => l.status === 'add' && Number((l as { row: Json }).row.unit_price) === 0)
  if (zero) warnings.push(`${zero} new ${zero === 1 ? 'line has' : 'lines have'} no price in the parts book and land at $0. The tab's "$0 lines" tile counts them.`)
  if (ready.some((r) => (r.cost?.status === 'set' || (r.cost == null && world.customCosts.some((c) => c.count_row_id === r.count_row_id))) && (r.lines.some((l) => l.status !== 'held') || world.lines.some((l) => l.count_row_id === r.count_row_id)))) {
    warnings.push('A row with both part lines and a quoted cost: Pricing reads the quoted cost for that row, and the Takeoffs tab still totals the lines.')
  }
  if (bid.bid_date_sent) warnings.push(`${label} was sent on ${bid.bid_date_sent}: its takeoff is what the sent number was costed from.`)
  if (version?.locked_at) warnings.push(`The version "${version.name ?? 'unnamed'}" is locked. A dev's write passes the lock; the person who locked it is not asked.`)

  return {
    ok: true,
    reply: {
      action: 'takeoff',
      bid: { id: bid.id, label, sent_on: bid.bid_date_sent },
      version: world.versionId ? { id: world.versionId, name: version?.name ?? null } : null,
      counts: {
        rows_ready: ready.length, rows_unchanged: rows.filter((r) => r.status === 'unchanged').length, rows_held: rows.filter((r) => r.status === 'held').length,
        lines_added: count((l) => l.status === 'add'), lines_changed: count((l) => l.status === 'change'), lines_removed: ready.reduce((s, r) => s + r.remove_line_ids.length, 0), lines_held: count((l) => l.status === 'held'),
        costs_set: ready.filter((r) => r.cost?.status === 'set').length, costs_cleared: ready.filter((r) => r.cost?.status === 'clear').length,
      },
      rows,
      materials: { before: money(before.total), after: money(after.total), words: `Materials on this bid, before tax and with order rounding: ${money(before.total)} → ${money(after.total)} (the Takeoffs tab's Materials tile and what Pricing sees).` },
      after_write: [
        'A line\'s quantity is for one counted unit: the row\'s count multiplies it.',
        'The bid\'s History records each line under your name.',
        'Pricing costs each row from these lines, or from its quoted cost where one is set; the Labor tab and the approval PDF read the lines\' total.',
      ],
      warnings,
      not_done: [
        'an assembly expanded into its parts, or bought as one bundle line (Add assembly on the Takeoffs tab)',
        'a part made new in the parts book, and a price filed in it (Materials)',
        'the drag order of a row\'s lines, and removing one line without rewriting the row',
        'the tax rate, the stage split and the takeoff book',
        'labor and prices — the train\'s next pairs',
      ],
    },
  }
}

/** The apply's reply: what landed row by row, what failed with its reason, and the materials as they read now. */
export function bidTakeoffAppliedWords(label: string, done: { rows: number; added: number; changed: number; removed: number; costs_set: number; costs_cleared: number }, failed: Array<{ n: number; what: string; why: string }>, heldRows: number, materialsNow: string | null): Json {
  const parts = [done.added ? `${done.added} line${done.added === 1 ? '' : 's'} added` : '', done.changed ? `${done.changed} changed` : '', done.removed ? `${done.removed} removed` : '', done.costs_set ? `${done.costs_set} quoted cost${done.costs_set === 1 ? '' : 's'} set` : '', done.costs_cleared ? `${done.costs_cleared} cleared` : ''].filter(Boolean)
  return {
    label,
    landed: parts.length ? `${parts.join(', ')} on ${done.rows} count row${done.rows === 1 ? '' : 's'}` : 'nothing',
    ...done,
    failed,
    held_in_plan: heldRows,
    materials_now: materialsNow,
    next: failed.length
      ? `${label}: ${parts.join(', ') || 'nothing'} landed and ${failed.length} did not (named in failed, each with its reason). Plan again for what is left.`
      : `${label}'s takeoff reads as planned${materialsNow ? `: materials ${materialsNow} before tax` : ''}. Labor and prices are the next pairs.`,
  }
}
