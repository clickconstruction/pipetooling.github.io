// A bid's Labor tab from the dev seat (the bid train's PR 4, to-dos/mcp-servers.md → The bid train).
// The owner, 2026-11-11: "fill out all of the line items for counts, takeoffs, labor, pricing." plan_bid_labor →
// apply_bid_labor writes what Bids → Labor holds (the brief's Cost Estimate): the estimate's boxes (cost_estimates:
// the rate, driving, trips, travel, estimator), the hours per unit on its labor rows (cost_estimate_labor_rows), and
// the lines of the five direct cost tables. All as rows under RLS as the dev: no RPC exists and none is owed.
//
// The screen's rules, kept:
//   · a labor row is keyed by the fixture's NAME (UNIQUE (cost_estimate_id, fixture)), and no screen adds one by
//     hand: the tab's load sync mints a row for every counted fixture (planLaborSync) and sets aside the row of a
//     fixture nobody counts. So the seat writes hours only for a fixture the Count Sheet counts: an existing row is
//     changed, a counted fixture with no row yet is minted as the sync mints it (its name, the summed count, after the
//     last row), and a fixture with no count row is held.
//   · hours a person types carry source `typed` and the note the tab's queue writes (`typed on <bid>`), so the
//     database's mint on a first sent date never overwrites them and the chip reads typed. A task is fixed hours, not
//     multiplied by the count; a sub line carries no hours and is priced under direct costs (BidsLaborNewView
//     saveQueueRow).
//   · the estimate's boxes take what buildCostEstimateAutosavePayload takes (a rate of 0 or more, trips above zero,
//     people at least one).
//   · the cost is computeBidCostBreakdown from the kernel copy, the tab's own "Direct cost of this bid" line, at the
//     bid's own rate. The New view prices a bid with no rate at the company crew rate, a ninety-day figure the seat
//     does not compute, so with no rate the plan states hours and leaves labor dollars out.
// The seat never teaches the labor book: a new entry or an alias is the tab's own press.
// Pure: no env reads, no network (src/lib/devMcp/devMcpBidLabor.test.ts).

import { computeBidCostBreakdown, directCostRowsFromTables } from './gcKernels/lib/bids/bidTotalCostBreakdown.ts'
import { DIRECT_COST_KINDS, DIRECT_COST_KIND_TABLE, type DirectCostKind } from './gcKernels/lib/bids/costEstimateDirectCosts.ts'
import { isAlternateRow, normalizeGroupTag } from './gcKernels/lib/bids/countSheet.ts'
import { laborFixtureKey } from './gcKernels/lib/bids/laborSyncPlan.ts'
import { pickActiveVersion } from './gcKernels/lib/bids/pickActiveVersion.ts'
import { LINE_COLS, materialsTotal, type TakeoffLine } from './devMcpBidTakeoff.ts'
import type { CountRow } from './devMcpBidCounts.ts'

export const BID_LABOR_VERBS = ['plan_bid_labor', 'apply_bid_labor'] as const
export type BidLaborVerb = (typeof BID_LABOR_VERBS)[number]

export function isBidLaborVerb(name: string): name is BidLaborVerb {
  return (BID_LABOR_VERBS as readonly string[]).includes(name)
}

export const LABOR_MAX_ROWS = 200
export const LABOR_MAX_DIRECT = 100
/** cost_estimate_labor_rows' kinds and units (their CHECKs, migration 20260911161857). */
export const LABOR_KINDS = ['fixture', 'task', 'sub'] as const
export const LABOR_UNITS = ['each', 'per_100ft'] as const
/** The source hours a person typed carry (the row's source CHECK: book | alias | typed | robot). */
export const TYPED_SOURCE = 'typed'
/** The note the tab's queue writes on a sub line. */
export const SUB_NOTE = 'sub line — priced under direct costs'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN)
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const has = (o: Json, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k)
const money = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const hrs = (n: number): string => `${(Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })} h`

/** The estimate's boxes, each with the rule buildCostEstimateAutosavePayload holds it to. */
export const ESTIMATE_BOXES = {
  labor_rate: { blank: true, min: 0, whole: false, words: 'the labor rate, dollars an hour, 0 or more (null: the company crew rate)' },
  driving_cost_rate: { blank: false, min: 0, whole: false, words: 'dollars a mile, 0 or more' },
  hours_per_trip: { blank: false, min: 0, whole: false, words: 'hours a trip, above zero' },
  estimator_cost_per_count: { blank: false, min: 0, whole: false, words: 'dollars a count row, 0 or more' },
  estimator_cost_flat_amount: { blank: true, min: 0, whole: false, words: 'a flat dollar amount, 0 or more, or null to use the per-count figure' },
  travel_people: { blank: false, min: 1, whole: true, words: 'people, a whole number of 1 or more' },
  travel_nights: { blank: false, min: 0, whole: true, words: 'nights, a whole number of 0 or more' },
  travel_meals_rate: { blank: true, min: 0, whole: false, words: 'meals a person a night in dollars, 0 or more, or null' },
  travel_hotel_rate: { blank: true, min: 0, whole: false, words: 'hotel a person a night in dollars, 0 or more, or null' },
} as const
export type EstimateBox = keyof typeof ESTIMATE_BOXES
const BOX_NAMES = Object.keys(ESTIMATE_BOXES) as EstimateBox[]

export type AskLaborRow = { n: number; fixture: string; rough_in?: number; top_out?: number; trim_set?: number; kind: string | null; unit: string | null }
export type AskDirect = { n: number; kind: string; note: string; rough_in?: number; top_out?: number; trim_set?: number; remove: boolean }
export type BidLaborPayload = { action: 'labor'; bid_id: string; version_id?: string; estimate: Partial<Record<EstimateBox, number | null>>; rows: AskLaborRow[]; direct: AskDirect[] }
export type BidLaborInput = { ok: true; p: BidLaborPayload; target: string; planHash: string | null } | { ok: false; error: string }

const SHAPE = `needs labor — { bid_id (a bids.id — find_bid), estimate?: { ${BOX_NAMES.join('?, ')}? }, rows?: [{ fixture (a counted fixture's name), rough_in?, top_out?, trim_set? (hours for ONE unit; for a task, the whole task's hours), kind? (fixture | task | sub; fixture when left out), unit? (each | per_100ft) }] (up to ${LABOR_MAX_ROWS}), direct?: [{ kind (${DIRECT_COST_KINDS.join(' | ')}), note (what it is — the line's key), rough_in?, top_out?, trim_set? (dollars a stage), remove? }] (up to ${LABOR_MAX_DIRECT}), version_id? }. One of estimate, rows or direct at least.`

/** plan_bid_labor / apply_bid_labor's input, shaped. A box out of range refuses the ask (the tab would not save it); a row or a line with a fault is kept for the plan to hold. */
export function bidLaborInput(verb: BidLaborVerb, input: Json): BidLaborInput {
  const shape = `${verb} ${SHAPE}`
  const src = obj(input.labor)
  if (!src) return { ok: false, error: shape }
  const bidId = typeof src.bid_id === 'string' ? src.bid_id.trim().toLowerCase() : ''
  if (!UUID_RE.test(bidId)) return { ok: false, error: shape }
  const estimate: BidLaborPayload['estimate'] = {}
  if (src.estimate !== undefined) {
    const e = obj(src.estimate)
    if (!e) return { ok: false, error: shape }
    for (const [k, raw] of Object.entries(e)) {
      if (!(BOX_NAMES as string[]).includes(k)) return { ok: false, error: `${verb}: ${k} is not a box on the estimate. The boxes: ${BOX_NAMES.join(', ')}.` }
      const box = ESTIMATE_BOXES[k as EstimateBox]
      if (raw === null) {
        if (!box.blank) return { ok: false, error: `${verb}: ${k} cannot be blank: ${box.words}.` }
        estimate[k as EstimateBox] = null
        continue
      }
      const n = num(raw)
      if (!Number.isFinite(n) || n < box.min || (k === 'hours_per_trip' && n <= 0) || (box.whole && !Number.isInteger(n))) return { ok: false, error: `${verb}: ${k} is ${box.words}.` }
      estimate[k as EstimateBox] = n
    }
  }
  const rawRows = src.rows === undefined ? [] : src.rows
  const rawDirect = src.direct === undefined ? [] : src.direct
  if (!Array.isArray(rawRows) || !Array.isArray(rawDirect)) return { ok: false, error: shape }
  if (rawRows.length > LABOR_MAX_ROWS || rawDirect.length > LABOR_MAX_DIRECT) return { ok: false, error: `${verb}: at most ${LABOR_MAX_ROWS} rows and ${LABOR_MAX_DIRECT} direct cost lines a call.` }
  if (!Object.keys(estimate).length && !rawRows.length && !rawDirect.length) return { ok: false, error: `${verb}: nothing to do — give estimate, rows or direct. ${SHAPE}` }
  const stage = (o: Json, k: string): number | undefined => (has(o, k) && o[k] != null ? num(o[k]) : undefined)
  const rows: AskLaborRow[] = []
  for (const [i, raw] of rawRows.entries()) {
    const r = obj(raw)
    if (!r) return { ok: false, error: `${verb}: row ${i + 1} is not an object. ${SHAPE}` }
    const row: AskLaborRow = { n: i + 1, fixture: typeof r.fixture === 'string' ? r.fixture.trim().slice(0, 300) : '', kind: text(r.kind, 20).toLowerCase() || null, unit: text(r.unit, 20).toLowerCase() || null }
    for (const k of ['rough_in', 'top_out', 'trim_set'] as const) { const v = stage(r, k); if (v !== undefined) row[k] = v }
    rows.push(row)
  }
  const direct: AskDirect[] = []
  for (const [i, raw] of rawDirect.entries()) {
    const d = obj(raw)
    if (!d) return { ok: false, error: `${verb}: direct ${i + 1} is not an object. ${SHAPE}` }
    const line: AskDirect = { n: i + 1, kind: text(d.kind, 20).toLowerCase(), note: text(d.note, 300), remove: d.remove === true }
    for (const k of ['rough_in', 'top_out', 'trim_set'] as const) { const v = stage(d, k); if (v !== undefined) line[k] = v }
    direct.push(line)
  }
  const p: BidLaborPayload = { action: 'labor', bid_id: bidId, estimate, rows, direct }
  if (src.version_id != null) {
    const v = typeof src.version_id === 'string' ? src.version_id.trim().toLowerCase() : ''
    if (!UUID_RE.test(v)) return { ok: false, error: `${verb}: version_id is a bid_versions.id — get_bid lists the bid's versions.` }
    p.version_id = v
  }
  let planHash: string | null = null
  if (verb === 'apply_bid_labor') {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value plan_bid_labor replied with.` }
    planHash = h
  }
  return { ok: true, p, target: bidId, planHash }
}

// ── the world the plan reads ─────────────────────────────────────────────────────────────────────────────────────

export type LaborReads = {
  /** GET /rest/v1/<table>?<query> as the dev; the rows. Throws on a refused read. */
  rows(table: string, query: string): Promise<Json[]>
}

export type LaborBid = { id: string; bid_number: string | null; project_name: string | null; created_by: string | null; selected_bid_version_id: string | null; alternate_group_tags: string[] | null; accepted_alternate_tags: string[] | null; declined_alternate_tags: string[] | null; outcome: string | null; bid_date_sent: string | null; distance_from_office: string | null; bid_value: number | null }
export type Estimate = { id: string } & Partial<Record<EstimateBox, number | null>>
export type LaborRow = { id: string; fixture: string; count: number; rough_in_hrs_per_unit: number; top_out_hrs_per_unit: number; trim_set_hrs_per_unit: number; is_fixed: boolean; kind: string; unit: string; source: string | null; source_note: string | null; sequence_order: number }
export type DirectRow = { id: string; kind: DirectCostKind; note: string | null; rough_in: number; top_out: number; trim_set: number; sequence_order: number }
export type BidLaborWorld = {
  bid: LaborBid | null
  versionId: string | null
  hasVersion: boolean
  /** The active version's count rows, the sheet's order. */
  countRows: CountRow[]
  lines: TakeoffLine[]
  estimate: Estimate | null
  laborRows: LaborRow[]
  /** The fixtures whose labor rows the sync set aside. */
  parked: string[]
  direct: DirectRow[]
}

const BID_COLS = 'id,bid_number,project_name,created_by,selected_bid_version_id,alternate_group_tags,accepted_alternate_tags,declined_alternate_tags,outcome,bid_date_sent,distance_from_office,bid_value'
const ROW_COLS = 'id,fixture,count,unit,page,group_tag,sequence_order'
const ESTIMATE_COLS = `id,${BOX_NAMES.join(',')}`
export const LABOR_ROW_COLS = 'id,fixture,count,rough_in_hrs_per_unit,top_out_hrs_per_unit,trim_set_hrs_per_unit,is_fixed,kind,unit,source,source_note,sequence_order'

async function paged(reads: LaborReads, table: string, query: string): Promise<Json[]> {
  const all: Json[] = []
  for (let offset = 0; offset < 4000; offset += 200) {
    const page = await reads.rows(table, `${query}&limit=200&offset=${offset}`)
    all.push(...page)
    if (page.length < 200) break
  }
  return all
}

/** The reads the dry run needs: the bid, the active version's counts and lines, the estimate with its labor rows, set-aside rows and direct cost lines. */
export async function readBidLaborWorld(reads: LaborReads, p: BidLaborPayload): Promise<BidLaborWorld> {
  const [bidRows, versionRows, estimateRows] = await Promise.all([
    reads.rows('bids', `select=${BID_COLS}&id=eq.${p.bid_id}`),
    reads.rows('bid_versions', `select=id,sort_order&bid_id=eq.${p.bid_id}&order=sort_order.asc`),
    reads.rows('cost_estimates', `select=${ESTIMATE_COLS}&bid_id=eq.${p.bid_id}&limit=1`),
  ])
  const bid = (bidRows[0] as LaborBid | undefined) ?? null
  const versions = versionRows.map((v) => ({ id: String(v.id), sort_order: Number(v.sort_order) }))
  const versionId = p.version_id ?? pickActiveVersion({ savedVersionId: bid?.selected_bid_version_id ?? null, bidVersions: versions })
  const hasVersion = !p.version_id || versions.some((v) => v.id === p.version_id)
  const estimate = (estimateRows[0] as Estimate | undefined) ?? null
  if (!bid) return { bid, versionId, hasVersion, countRows: [], lines: [], estimate, laborRows: [], parked: [], direct: [] }
  const versionFilter = `bid_version_id=${versionId ? `eq.${versionId}` : 'is.null'}`
  const [countRows, lineRows] = await Promise.all([
    paged(reads, 'bids_count_rows', `select=${ROW_COLS}&bid_id=eq.${p.bid_id}&${versionFilter}&order=sequence_order.asc,id.asc`),
    paged(reads, 'bids_takeoff_rough_part_lines', `select=${LINE_COLS}&bid_id=eq.${p.bid_id}&${versionFilter}&order=count_row_id.asc,sequence_order.asc,id.asc`),
  ])
  let laborRows: Json[] = []
  let parkedRows: Json[] = []
  const direct: DirectRow[] = []
  if (estimate) {
    const tables = await Promise.all([
      paged(reads, 'cost_estimate_labor_rows', `select=${LABOR_ROW_COLS}&cost_estimate_id=eq.${estimate.id}&order=sequence_order.asc,id.asc`),
      paged(reads, 'cost_estimate_labor_rows_unmatched', `select=fixture&cost_estimate_id=eq.${estimate.id}&order=fixture.asc`),
      ...DIRECT_COST_KINDS.map((kind) => paged(reads, DIRECT_COST_KIND_TABLE[kind], `select=id,note,rough_in,top_out,trim_set,sequence_order&cost_estimate_id=eq.${estimate.id}&order=sequence_order.asc,id.asc`)),
    ])
    laborRows = tables[0] ?? []
    parkedRows = tables[1] ?? []
    DIRECT_COST_KINDS.forEach((kind, i) => {
      for (const r of tables[i + 2] ?? []) direct.push({ id: String(r.id), kind, note: typeof r.note === 'string' ? r.note : null, rough_in: Number(r.rough_in) || 0, top_out: Number(r.top_out) || 0, trim_set: Number(r.trim_set) || 0, sequence_order: Number(r.sequence_order) || 0 })
    })
  }
  return {
    bid, versionId, hasVersion, estimate,
    countRows: countRows.map((r) => ({ ...(r as CountRow), count: Number(r.count), sequence_order: Number(r.sequence_order) })),
    lines: lineRows.map((r) => ({ ...(r as TakeoffLine), quantity: Number(r.quantity), unit_price: Number(r.unit_price), sequence_order: Number(r.sequence_order), order_increment: r.order_increment == null ? null : Number(r.order_increment) })),
    laborRows: laborRows.map((r) => ({ ...(r as LaborRow), count: Number(r.count) || 0, rough_in_hrs_per_unit: Number(r.rough_in_hrs_per_unit) || 0, top_out_hrs_per_unit: Number(r.top_out_hrs_per_unit) || 0, trim_set_hrs_per_unit: Number(r.trim_set_hrs_per_unit) || 0, is_fixed: r.is_fixed === true, sequence_order: Number(r.sequence_order) || 0 })),
    parked: parkedRows.map((r) => String(r.fixture ?? '')),
    direct,
  }
}

// ── the dry run ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The count rows that are the job, the Labor tab's own filter (alternateAcceptance.ts jobScopeRows): every row until
 * the bid is won, then the base bid plus the alternates not declined (accepted beats declined; unanswered stays).
 */
export function jobScopeCountRows(rows: CountRow[], bid: Pick<LaborBid, 'outcome' | 'alternate_group_tags' | 'accepted_alternate_tags' | 'declined_alternate_tags'>): CountRow[] {
  if (bid.outcome !== 'won' && bid.outcome !== 'started_or_complete') return [...rows]
  const tags = bid.alternate_group_tags ?? []
  const within = (list: string[] | null, tag: string | null) => (list ?? []).some((t) => normalizeGroupTag(t) === normalizeGroupTag(tag))
  return rows.filter((r) => !(isAlternateRow(r, tags) && within(bid.declined_alternate_tags, r.group_tag) && !within(bid.accepted_alternate_tags, r.group_tag)))
}

/** The counted fixtures, as the sync groups them: by the exact name, counts summed, in the sheet's order. */
export function countedFixtures(rows: CountRow[]): Array<{ fixture: string; count: number }> {
  const byName = new Map<string, number>()
  for (const r of rows) byName.set(r.fixture ?? '', (byName.get(r.fixture ?? '') ?? 0) + (Number(r.count) || 0))
  return [...byName].map(([fixture, count]) => ({ fixture, count }))
}

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }
export type PlanLaborRow =
  | { status: 'mint'; n: number; reads: string; row: Json }
  | { status: 'change'; n: number; id: string; reads: string; patch: Json }
  | { status: 'unchanged'; n: number; id: string; reads: string }
  | { status: 'held'; n: number; reads: string; why: string }
export type PlanDirect =
  | { status: 'add'; n: number; table: string; reads: string; row: Json }
  | { status: 'change'; n: number; table: string; id: string; reads: string; patch: Json }
  | { status: 'remove'; n: number; table: string; id: string; reads: string }
  | { status: 'unchanged'; n: number; reads: string }
  | { status: 'held'; n: number; reads: string; why: string }

export function laborBidLabel(bid: { bid_number: string | null; project_name: string | null }): string {
  return [bid.bid_number?.trim() ? `b${bid.bid_number.trim()}` : '', bid.project_name?.trim() ?? ''].filter(Boolean).join(' ') || 'this bid'
}

const hoursWords = (r: { rough_in_hrs_per_unit: number; top_out_hrs_per_unit: number; trim_set_hrs_per_unit: number; kind: string; unit: string }): string =>
  r.kind === 'sub' ? 'a sub line, no hours' : `${r.rough_in_hrs_per_unit} · ${r.top_out_hrs_per_unit} · ${r.trim_set_hrs_per_unit} h ${r.kind === 'task' ? 'for the task' : r.unit === 'per_100ft' ? 'per 100 ft' : 'each'} (rough in · top out · trim set)`

/** The tab's "Direct cost of this bid" pieces at the bid's own rate, through its own kernel. */
export function laborCostWords(input: { laborRows: Array<Pick<LaborRow, 'count' | 'is_fixed' | 'kind' | 'unit' | 'rough_in_hrs_per_unit' | 'top_out_hrs_per_unit' | 'trim_set_hrs_per_unit'>>; estimate: Partial<Record<EstimateBox, number | null>>; direct: Array<Pick<DirectRow, 'kind' | 'rough_in' | 'top_out' | 'trim_set'>>; materials: number; distance: string | null; countRows: number }): Json {
  const rate = input.estimate.labor_rate ?? null
  const b = computeBidCostBreakdown({
    materialTotalRoughIn: input.materials, materialTotalTopOut: 0, materialTotalTrimSet: 0,
    laborRate: rate, laborRows: input.laborRows, distanceFromOffice: input.distance, costEstimate: input.estimate, countRowsLength: input.countRows,
    directCostRows: directCostRowsFromTables(Object.fromEntries(DIRECT_COST_KINDS.map((k) => [k, input.direct.filter((d) => d.kind === k)]))),
  })
  const rated = rate != null && rate > 0
  return {
    field_hours: hrs(b.totalLaborHours),
    labor: rated ? `${money(b.laborCost)} (${hrs(b.totalLaborHours)} × ${money(b.rate)})` : 'not stated: the bid has no labor rate, and the tab then prices labor at the company crew rate, which the seat does not compute',
    driving: b.drivingCost > 0 ? `${money(b.drivingCost)} (${Math.round(b.numTrips * 100) / 100} trips × ${money(b.ratePerMile)} a mile × ${b.distance} miles)` : money(0),
    travel: money(b.travelCost),
    other_direct: money(b.otherDirectCost),
    materials: money(b.totalMaterials),
    direct_cost_of_this_bid: rated ? money(b.totalCost) : `${money(b.totalCost)} without labor dollars`,
  }
}

/**
 * What the plan says and what the hash commits to: the estimate (made when the bid has none), each box before →
 * after, each labor row as mint, change, unchanged or held, each direct cost line, and the tab's cost line before and
 * after through its own kernel. A row or a line with a fault is held and the rest goes on; a plan with nothing ready
 * is refused.
 */
export function bidLaborDryRun(p: BidLaborPayload, world: BidLaborWorld): DryRun {
  const bid = world.bid
  if (!bid) return { ok: false, refused: `No bid ${p.bid_id} is visible to you — find_bid resolves a number or a name.` }
  const label = laborBidLabel(bid)
  if (!world.hasVersion) return { ok: false, refused: `${label} has no version ${p.version_id}: get_bid lists its versions, or leave version_id out.` }
  if (!bid.created_by) return { ok: false, refused: `${label} has no creator on record, and the database lets nobody write the labor of such a bid (can_access_bid_for_pricing). Nothing can be written until the bid has one.` }
  const scope = jobScopeCountRows(world.countRows, bid)
  const counted = countedFixtures(scope)
  if (!world.estimate && !counted.length) return { ok: false, refused: `${label} has no count rows, and the Labor tab makes a bid's estimate from its counts. Add them with plan_bid_counts first.` }
  const bidWords = ` on ${bid.bid_number?.trim() ? bid.bid_number.trim() : (bid.project_name ?? '').trim()}`

  // The estimate's boxes.
  const boxes: Array<{ box: string; before: number | null; after: number | null }> = []
  const estimatePatch: Json = {}
  const estimateAfter: Partial<Record<EstimateBox, number | null>> = {}
  for (const k of BOX_NAMES) estimateAfter[k] = world.estimate?.[k] == null ? null : Number(world.estimate[k])
  const estimateBefore = { ...estimateAfter }
  for (const k of BOX_NAMES) {
    if (!has(p.estimate as Json, k)) continue
    const after = p.estimate[k] ?? null
    if ((estimateBefore[k] ?? null) === after) continue
    boxes.push({ box: k, before: estimateBefore[k] ?? null, after })
    estimatePatch[k] = after
    estimateAfter[k] = after
  }

  // The labor rows.
  const seen = new Map<string, number[]>()
  for (const r of p.rows) if (r.fixture) seen.set(laborFixtureKey(r.fixture), [...(seen.get(laborFixtureKey(r.fixture)) ?? []), r.n])
  let seq = world.laborRows.length ? Math.max(...world.laborRows.map((r) => r.sequence_order)) : 0
  const rows: PlanLaborRow[] = []
  const laborAfter = world.laborRows.map((r) => ({ ...r }))
  for (const ask of p.rows) {
    const shown = ask.fixture || '(no fixture)'
    const hold = (why: string): void => { rows.push({ status: 'held', n: ask.n, reads: shown, why }) }
    if (!ask.fixture) { hold('a row names its fixture'); continue }
    if ((seen.get(laborFixtureKey(ask.fixture)) ?? []).length > 1) { hold(`rows ${(seen.get(laborFixtureKey(ask.fixture)) ?? []).join(' and ')} name the same fixture: a fixture has one labor row`); continue }
    if (ask.kind && !(LABOR_KINDS as readonly string[]).includes(ask.kind)) { hold(`kind is ${LABOR_KINDS.join(', ')}`); continue }
    if (ask.unit && !(LABOR_UNITS as readonly string[]).includes(ask.unit)) { hold(`unit is ${LABOR_UNITS.join(' or ')}`); continue }
    const bad = (['rough_in', 'top_out', 'trim_set'] as const).find((k) => ask[k] !== undefined && (!Number.isFinite(ask[k] as number) || (ask[k] as number) < 0))
    if (bad) { hold(`${bad} is hours, 0 or more`); continue }
    // The row by its exact name, else by the sync's loose key when one row or one counted name answers to it.
    const key = laborFixtureKey(ask.fixture)
    const exact = world.laborRows.filter((r) => r.fixture === ask.fixture)
    const loose = world.laborRows.filter((r) => laborFixtureKey(r.fixture) === key)
    const live = exact[0] ?? (loose.length === 1 ? loose[0] : null) ?? null
    const countedExact = counted.find((c) => c.fixture === ask.fixture) ?? null
    const countedLoose = counted.filter((c) => laborFixtureKey(c.fixture) === key)
    const countedHit = countedExact ?? (countedLoose.length === 1 ? countedLoose[0] ?? null : null)
    if (!live && loose.length > 1) { hold(`${loose.length} labor rows answer to that name (${loose.map((r) => r.fixture).join('; ')}): give the exact one`); continue }
    if (!live && !countedHit) { hold(countedLoose.length > 1 ? `${countedLoose.length} counted fixtures answer to that name (${countedLoose.map((c) => c.fixture).join('; ')}): give the exact one` : 'no count row wears that name, and the Labor tab sets aside the labor row of a fixture nobody counts: add it with plan_bid_counts first'); continue }
    const base = live ?? { rough_in_hrs_per_unit: 0, top_out_hrs_per_unit: 0, trim_set_hrs_per_unit: 0, kind: 'fixture', unit: 'each', is_fixed: false }
    const kind = ask.kind ?? (live ? live.kind : 'fixture')
    const isSub = kind === 'sub'
    const after = {
      rough_in_hrs_per_unit: isSub ? 0 : ask.rough_in ?? base.rough_in_hrs_per_unit,
      top_out_hrs_per_unit: isSub ? 0 : ask.top_out ?? base.top_out_hrs_per_unit,
      trim_set_hrs_per_unit: isSub ? 0 : ask.trim_set ?? base.trim_set_hrs_per_unit,
      kind,
      is_fixed: kind === 'task',
      // A task and a sub line read `each`, as the queue saves them; a fixture keeps its unit unless the ask names one.
      unit: kind === 'fixture' ? ask.unit ?? base.unit : 'each',
    }
    if (!isSub && after.rough_in_hrs_per_unit + after.top_out_hrs_per_unit + after.trim_set_hrs_per_unit <= 0) { hold('give hours above zero in a stage, or kind: "sub" for a line a sub carries'); continue }
    const source_note = isSub ? SUB_NOTE : kind === 'task' ? `fixed hours${bidWords}` : `typed${bidWords}`
    if (live) {
      const patch: Json = {}
      for (const k of ['rough_in_hrs_per_unit', 'top_out_hrs_per_unit', 'trim_set_hrs_per_unit', 'kind', 'is_fixed', 'unit'] as const) if (live[k] !== after[k]) patch[k] = after[k]
      if (!Object.keys(patch).length) { rows.push({ status: 'unchanged', n: ask.n, id: live.id, reads: `${live.fixture}: ${hoursWords(live)}` }); continue }
      patch.source = TYPED_SOURCE
      patch.source_note = source_note
      const idx = laborAfter.findIndex((r) => r.id === live.id)
      if (idx >= 0) laborAfter[idx] = { ...live, ...after, source: TYPED_SOURCE, source_note }
      rows.push({ status: 'change', n: ask.n, id: live.id, reads: `${live.fixture}: ${hoursWords(live)} → ${hoursWords(after)}`, patch })
      continue
    }
    if (world.parked.some((f) => f === countedHit?.fixture || laborFixtureKey(f) === key)) { hold('set-aside hours wait for this fixture: open the bid\'s Labor tab once so its sync takes them back, then plan again'); continue }
    seq += 1
    const fixture = countedHit?.fixture ?? ask.fixture
    const row = { cost_estimate_id: world.estimate?.id ?? null, fixture, count: countedHit?.count ?? 0, rough_in_hrs_per_unit: after.rough_in_hrs_per_unit, top_out_hrs_per_unit: after.top_out_hrs_per_unit, trim_set_hrs_per_unit: after.trim_set_hrs_per_unit, sequence_order: seq, is_fixed: after.is_fixed, kind: after.kind, unit: after.unit, source: TYPED_SOURCE, source_note }
    laborAfter.push({ id: `new-${ask.n}`, fixture, count: row.count, rough_in_hrs_per_unit: row.rough_in_hrs_per_unit, top_out_hrs_per_unit: row.top_out_hrs_per_unit, trim_set_hrs_per_unit: row.trim_set_hrs_per_unit, is_fixed: row.is_fixed, kind: row.kind, unit: row.unit, source: TYPED_SOURCE, source_note, sequence_order: seq })
    rows.push({ status: 'mint', n: ask.n, reads: `${fixture} ×${row.count}: ${hoursWords(after)} — a new labor row, as the tab's sync would make for this counted fixture`, row })
  }

  // The direct cost lines, keyed by their kind and what they are.
  const direct: PlanDirect[] = []
  const directAfter = world.direct.map((d) => ({ ...d }))
  const nextSeq: Partial<Record<DirectCostKind, number>> = {}
  const askedDirect = new Map<string, number[]>()
  for (const d of p.direct) askedDirect.set(`${d.kind}|${d.note.toLowerCase()}`, [...(askedDirect.get(`${d.kind}|${d.note.toLowerCase()}`) ?? []), d.n])
  for (const ask of p.direct) {
    const shown = `${ask.kind || '(no kind)'}: ${ask.note || '(no note)'}`
    const hold = (why: string): void => { direct.push({ status: 'held', n: ask.n, reads: shown, why }) }
    if (!(DIRECT_COST_KINDS as readonly string[]).includes(ask.kind)) { hold(`kind is ${DIRECT_COST_KINDS.join(', ')}`); continue }
    if (!ask.note) { hold('a direct cost line says what it is (note): that is how the seat finds it again'); continue }
    if ((askedDirect.get(`${ask.kind}|${ask.note.toLowerCase()}`) ?? []).length > 1) { hold(`lines ${(askedDirect.get(`${ask.kind}|${ask.note.toLowerCase()}`) ?? []).join(' and ')} are the same line`); continue }
    const bad = (['rough_in', 'top_out', 'trim_set'] as const).find((k) => ask[k] !== undefined && (!Number.isFinite(ask[k] as number) || (ask[k] as number) < 0))
    if (bad) { hold(`${bad} is dollars, 0 or more`); continue }
    const kind = ask.kind as DirectCostKind
    const table = DIRECT_COST_KIND_TABLE[kind]
    const matches = world.direct.filter((d) => d.kind === kind && (d.note ?? '').trim().toLowerCase() === ask.note.toLowerCase())
    if (matches.length > 1) { hold(`${matches.length} ${kind} lines already read "${ask.note}": change them on the Labor tab`); continue }
    const one = matches[0] ?? null
    const stageWords = (r: { rough_in: number; top_out: number; trim_set: number }) => `${money(r.rough_in)} · ${money(r.top_out)} · ${money(r.trim_set)} (rough in · top out · trim set)`
    if (ask.remove) {
      if (!one) { hold('no such line to remove'); continue }
      const idx = directAfter.findIndex((d) => d.id === one.id)
      if (idx >= 0) directAfter.splice(idx, 1)
      direct.push({ status: 'remove', n: ask.n, table, id: one.id, reads: `${kind}: ${one.note} — ${stageWords(one)} comes off` })
      continue
    }
    const after = { rough_in: ask.rough_in ?? one?.rough_in ?? 0, top_out: ask.top_out ?? one?.top_out ?? 0, trim_set: ask.trim_set ?? one?.trim_set ?? 0 }
    if (one) {
      const patch: Json = {}
      for (const k of ['rough_in', 'top_out', 'trim_set'] as const) if (one[k] !== after[k]) patch[k] = after[k]
      if (!Object.keys(patch).length) { direct.push({ status: 'unchanged', n: ask.n, reads: `${kind}: ${one.note} — ${stageWords(one)}` }); continue }
      const idx = directAfter.findIndex((d) => d.id === one.id)
      if (idx >= 0) directAfter[idx] = { ...one, ...after }
      direct.push({ status: 'change', n: ask.n, table, id: one.id, reads: `${kind}: ${one.note} — ${stageWords(one)} → ${stageWords(after)}`, patch })
      continue
    }
    const last = nextSeq[kind] ?? world.direct.filter((d) => d.kind === kind).reduce((m, d) => Math.max(m, d.sequence_order), 0)
    nextSeq[kind] = last + 1
    const row = { cost_estimate_id: world.estimate?.id ?? null, note: ask.note, ...after, sequence_order: last + 1 }
    directAfter.push({ id: `new-${ask.n}`, kind, note: ask.note, ...after, sequence_order: last + 1 })
    direct.push({ status: 'add', n: ask.n, table, reads: `${kind}: ${ask.note} — ${stageWords(after)}`, row })
  }

  const moving = boxes.length + rows.filter((r) => r.status === 'mint' || r.status === 'change').length + direct.filter((d) => d.status === 'add' || d.status === 'change' || d.status === 'remove').length
  if (!moving) {
    const held = [...rows.filter((r) => r.status === 'held'), ...direct.filter((d) => d.status === 'held')]
    return { ok: false, refused: `Nothing ready on ${label}.${held.length ? ` Held: ${held.map((h) => (h.status === 'held' ? `${h.reads} — ${h.why}` : '')).join('; ')}.` : ' Everything already reads that way.'}` }
  }

  const materials = materialsTotal(world.lines, world.countRows).total
  const cost = (labor: typeof laborAfter, est: Partial<Record<EstimateBox, number | null>>, dir: typeof directAfter) => laborCostWords({ laborRows: labor, estimate: est, direct: dir, materials, distance: bid.distance_from_office, countRows: world.countRows.length })
  const notCounted = counted.filter((c) => !laborAfter.some((r) => r.fixture === c.fixture)).map((c) => c.fixture)
  const after_write: string[] = []
  if (!world.estimate) after_write.push('The bid has no labor estimate yet: the apply makes it first, as the Labor tab does the first time it is opened on a counted bid.')
  after_write.push('Hours here read as typed on the tab, so the database\'s mint on a first sent date leaves them alone.')
  after_write.push('A labor row\'s count follows the Count Sheet through the Labor tab\'s own sync the next time it is opened; the seat does not move it.')
  if (notCounted.length) after_write.push(`${notCounted.length} counted ${notCounted.length === 1 ? 'fixture has' : 'fixtures have'} no labor row yet (${notCounted.slice(0, 8).join('; ')}${notCounted.length > 8 ? '; …' : ''}): the tab's sync mints ${notCounted.length === 1 ? 'it' : 'them'} from the labor book when it is opened, or give ${notCounted.length === 1 ? 'its' : 'their'} hours here.`)
  after_write.push('The bid\'s History records each change under your name.')
  const warnings: string[] = []
  if (bid.bid_date_sent) warnings.push(`${label} was sent on ${bid.bid_date_sent}: its labor is what the sent number was costed from.`)
  if ((estimateAfter.labor_rate ?? null) == null) warnings.push('The bid has no labor rate. The tab prices labor at the company crew rate then; set estimate.labor_rate to price it at the paper\'s rate.')

  return {
    ok: true,
    reply: {
      action: 'labor',
      bid: { id: bid.id, label, sent_on: bid.bid_date_sent },
      estimate: { id: world.estimate?.id ?? null, made: !world.estimate, boxes, patch: estimatePatch },
      counts: {
        boxes: boxes.length,
        rows_minted: rows.filter((r) => r.status === 'mint').length, rows_changed: rows.filter((r) => r.status === 'change').length, rows_unchanged: rows.filter((r) => r.status === 'unchanged').length, rows_held: rows.filter((r) => r.status === 'held').length,
        direct_added: direct.filter((d) => d.status === 'add').length, direct_changed: direct.filter((d) => d.status === 'change').length, direct_removed: direct.filter((d) => d.status === 'remove').length, direct_held: direct.filter((d) => d.status === 'held').length,
      },
      rows,
      direct,
      cost: { words: 'The Labor tab\'s "Direct cost of this bid", at the bid\'s own rate, through its own kernel.', before: cost(world.laborRows, estimateBefore, world.direct), after: cost(laborAfter, estimateAfter, directAfter) },
      after_write,
      warnings,
      not_done: [
        'the labor book: a new entry, an alias learned, Fill from book, calibration',
        'a labor row for a fixture nobody counts, and moving a row\'s count (the tab\'s sync does both)',
        'set-aside hours taken back or used for another fixture',
        'the distance from the office (plan_bid_update sets it) and the tax rate',
        'prices — the train\'s next pair',
      ],
    },
  }
}

/** The tab's cost line as the bid stands, for the apply's reply after the writes. */
export function laborCostFromWorld(world: BidLaborWorld): Json | null {
  if (!world.bid) return null
  const estimate: Partial<Record<EstimateBox, number | null>> = {}
  for (const k of BOX_NAMES) estimate[k] = world.estimate?.[k] == null ? null : Number(world.estimate[k])
  return laborCostWords({ laborRows: world.laborRows, estimate, direct: world.direct, materials: materialsTotal(world.lines, world.countRows).total, distance: world.bid.distance_from_office, countRows: world.countRows.length })
}

/** The apply's reply: what landed, what failed with its reason, and the cost line as it reads now. */
export function bidLaborAppliedWords(label: string, done: { estimate_made: boolean; boxes: number; rows_minted: number; rows_changed: number; direct_added: number; direct_changed: number; direct_removed: number }, failed: Array<{ what: string; why: string }>, held: number, costNow: Json | null): Json {
  const parts = [
    done.estimate_made ? 'the estimate made' : '', done.boxes ? `${done.boxes} box${done.boxes === 1 ? '' : 'es'} set` : '',
    done.rows_minted ? `${done.rows_minted} labor row${done.rows_minted === 1 ? '' : 's'} made` : '', done.rows_changed ? `${done.rows_changed} changed` : '',
    done.direct_added ? `${done.direct_added} direct cost line${done.direct_added === 1 ? '' : 's'} added` : '', done.direct_changed ? `${done.direct_changed} changed` : '', done.direct_removed ? `${done.direct_removed} removed` : '',
  ].filter(Boolean)
  return {
    label,
    landed: parts.length ? parts.join(', ') : 'nothing',
    ...done,
    failed,
    held_in_plan: held,
    cost_now: costNow,
    next: failed.length ? `${label}: ${parts.join(', ') || 'nothing'} landed and ${failed.length} did not (named in failed, each with its reason). Plan again for what is left.` : `${label}'s Labor tab reads as planned. Prices are the next pair.`,
  }
}
