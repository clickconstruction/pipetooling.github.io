// Submittals from the dev seat (v2.6804 / 0.51.0). The owner, 2026-11-09: "I want to add dev mcp verbs to manage
// submittals so that if a person was talking to an agent like yourself the agent could load in submittals entries and
// let others know their status." Three things, all on Bids → Submittals' own tables and kernels:
//
//   get_submittals(bid)                               where every row and every line of the order log stands
//   plan_submittal_rows → apply_submittal_rows        rows onto the bid's draft revision, one or many, by tag
//   plan_submittal_log  → apply_submittal_log         ordered · PO · expected · delivered · note on the log's lines
//
// No RPC exists for any of it and none is owed: the tab writes bid_submittals, bid_submittal_items and
// bid_procurement_items as rows under RLS (is_pricing_sharer() AND can_access_bid_for_pricing), so the seat does too,
// as the dev — plan_job's shape (v2.6790). The dry run is this server's own read of the bid's submittal world, hashed
// with the payload; apply reads again and writes only when the hash still matches. Where a part stands is worked out
// by the tab's kernels, bundled from the kernel copy (scripts/edge-kernels.mjs): the rows that stand on an earlier
// revision, each row as the log's lines, the log, its four steps and its Next line. Pure: no env reads, no network;
// the reads come in through the composites' Reader, so the tests run over a fake
// (src/lib/devMcp/devMcpSubmittals.test.ts).

import { findBid, readAllRows, resolve, type Reader, type Row } from './devMcpComposites.ts'
import type { RowFilter } from './devMcpDoor.ts'
import { formatBidLedgerNumberLabel, formatJobLedgerNumberLabel } from './ledgerDisplayPrefixes.ts'
import { stageDatesFromJob, type StageDates } from './procurementStageDates.ts'
import type { StageSplitRecord } from './gcKernels/lib/bids/materialsByStage.ts'
import type { SubmittalPartRow } from './gcKernels/lib/submittals/itemParts.ts'
import { PROCUREMENT_STEP_LABELS, procurementNextLine, procurementSteps, stepOfRow } from './gcKernels/lib/submittals/procurementBoard.ts'
import { procurementItemSources, type ProcurementItemLike, type ProcurementSourceFacts } from './gcKernels/lib/submittals/procurementItemSources.ts'
import { buildProcurementLog, lineStatus, orderBlockers, tagStagesFrom, type ProcurementItemSource, type ProcurementRecord, type ProcurementRow, type ProcurementStage } from './gcKernels/lib/submittals/procurementLog.ts'
import { REASON_LABELS, STATUS_LABELS, STATUS_MEANINGS, deriveProductStatus, needsReason, type ProductStatus, type ReasonKind } from './gcKernels/lib/submittals/productStatus.ts'
import { revisionWasRead, rowsThatStand } from './gcKernels/lib/submittals/standingRows.ts'

export const SUBMITTAL_VERBS = ['plan_submittal_rows', 'apply_submittal_rows', 'plan_submittal_log', 'apply_submittal_log'] as const
export type SubmittalVerb = (typeof SUBMITTAL_VERBS)[number]

export function isSubmittalVerb(name: string): name is SubmittalVerb {
  return (SUBMITTAL_VERBS as readonly string[]).includes(name)
}

export const PRODUCT_STATUSES = Object.keys(STATUS_LABELS) as ProductStatus[]
export const REASON_KINDS = Object.keys(REASON_LABELS) as ReasonKind[]
export const SUBMITTAL_ROWS_MAX = 100
export const SUBMITTAL_LINES_MAX = 100
const TAG_MAX = 40
const NAME_MAX = 200
const NOTE_MAX = 500
const PO_MAX = 60
const LEAD_MAX = 730
const BID_REF_MAX = 120

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const HASH_RE = /^[0-9a-f]{64}$/

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const strOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v))
const numOrNull = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
const tagKey = (tag: string): string => tag.trim().toLowerCase()
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/** A real calendar day, YYYY-MM-DD. */
function isYmd(v: string): boolean {
  if (!YMD_RE.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

// ── the asks, shaped ─────────────────────────────────────────────────────────────────────────────────────────────

/** The row columns an ask may set; a key left out is left alone, null clears it. */
const ROW_TEXT_COLUMNS = ['specified_manufacturer', 'specified_model', 'specified_description', 'submitted_manufacturer', 'submitted_model', 'submitted_label'] as const
type RowTextColumn = (typeof ROW_TEXT_COLUMNS)[number]

export type RowAsk = { tag: string } & Partial<Record<RowTextColumn, string | null>> & {
  status?: ProductStatus
  reason_kind?: ReasonKind | null
  reason_note?: string | null
  lead_time_days?: number | null
  /** A supply house by name or id; null takes it off. */
  supply_house?: string | null
  order_only?: boolean
}
export type RowsPayload = { action: 'rows'; bid: string; rows: RowAsk[] }

const LOG_FACTS = ['ordered_on', 'po_ref', 'expected_on', 'delivered_on', 'note'] as const
type LogFact = (typeof LOG_FACTS)[number]
export type LineAsk = {
  /** The line's key as get_submittals lists it (a tag, part:<key> or hand:<id>). */
  line?: string
  /** Or the row's tag; with all_parts, every part line under it. */
  tag?: string
  all_parts?: boolean
  ordered_on?: string | null
  po_ref?: string
  expected_on?: string | null
  delivered_on?: string | null
  note?: string
}
export type LogPayload = { action: 'log'; bid: string; lines: LineAsk[] }
export type SubmittalPayload = RowsPayload | LogPayload

export type SubmittalInput = { ok: true; p: SubmittalPayload; target: string; planHash: string | null } | { ok: false; error: string }

const ROWS_SHAPE = `needs submittal — { bid (a bids.id, or text that finds one bid: "b398"), rows: [ up to ${SUBMITTAL_ROWS_MAX} of { tag (the plan's name for the fixture, "WC-1", under ${TAG_MAX}), specified?: { manufacturer?, model?, description? } (what the plans' schedule names), submitted?: { manufacturer?, model?, label? } (what you will install), status? (${PRODUCT_STATUSES.join(' | ')}; worked out from the two products when left out), reason_kind? (${REASON_KINDS.join(' | ')}), reason_note?, lead_time_days? (0–${LEAD_MAX}; 0 is in stock), supply_house? (a name or a supply_houses.id), order_only? (true: you buy it, the GC never sees it) } ] }. A tag already on the draft is changed, the fields you name only; null clears a field.`
const LOG_SHAPE = `needs log — { bid (a bids.id, or text that finds one bid), lines: [ up to ${SUBMITTAL_LINES_MAX} of { line (the line's key as get_submittals lists it) or tag (the row's tag; all_parts: true for every part under it), and at least one of ordered_on, expected_on, delivered_on (YYYY-MM-DD, null clears), po_ref (under ${PO_MAX}), note (for the GC, under ${NOTE_MAX}) } ] }.`

function planHashOf(verb: SubmittalVerb, input: Json): { ok: true; hash: string | null } | { ok: false; error: string } {
  if (!verb.startsWith('apply_')) return { ok: true, hash: null }
  const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
  if (!HASH_RE.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value ${verb.replace(/^apply_/, 'plan_')} replied with.` }
  return { ok: true, hash: h }
}

/** A text field of an ask: undefined when not named, null when cleared, the trimmed words otherwise; false when too long or not text. */
function textField(src: Json, key: string, max: number): string | null | undefined | false {
  if (!(key in src)) return undefined
  const v = src[key]
  if (v == null) return null
  if (typeof v !== 'string') return false
  const t = v.trim()
  if (t.length > max) return false
  return t || null
}

function rowAsk(raw: unknown, verb: string, n: number): RowAsk | string {
  const src = obj(raw)
  const where = `${verb}: row ${n}`
  if (!src) return `${where} is not an object.`
  const tag = typeof src.tag === 'string' ? src.tag.trim() : ''
  if (!tag || tag.length > TAG_MAX) return `${where} needs a tag, the plan's name for the fixture, under ${TAG_MAX} characters.`
  const ask: RowAsk = { tag }
  for (const [group, keys] of [['specified', ['manufacturer', 'model', 'description']], ['submitted', ['manufacturer', 'model', 'label']]] as const) {
    if (!(group in src)) continue
    const g = obj(src[group])
    if (!g) return `${where} (${tag}): ${group} is { ${keys.join('?, ')}? }.`
    for (const k of keys) {
      const v = textField(g, k, NAME_MAX)
      if (v === false) return `${where} (${tag}): ${group}.${k} is text under ${NAME_MAX} characters, or null.`
      if (v !== undefined) ask[`${group}_${k}` as RowTextColumn] = v
    }
  }
  if ('status' in src && src.status != null) {
    const s = str(src.status).trim().toLowerCase()
    if (!(PRODUCT_STATUSES as string[]).includes(s)) return `${where} (${tag}): status is one of ${PRODUCT_STATUSES.join(', ')}, or left out.`
    ask.status = s as ProductStatus
  }
  if ('reason_kind' in src) {
    if (src.reason_kind == null) ask.reason_kind = null
    else {
      const r = str(src.reason_kind).trim().toLowerCase()
      if (!(REASON_KINDS as string[]).includes(r)) return `${where} (${tag}): reason_kind is one of ${REASON_KINDS.join(', ')}, or null.`
      ask.reason_kind = r as ReasonKind
    }
  }
  const note = textField(src, 'reason_note', NOTE_MAX)
  if (note === false) return `${where} (${tag}): reason_note is text under ${NOTE_MAX} characters, or null.`
  if (note !== undefined) ask.reason_note = note
  if ('lead_time_days' in src) {
    if (src.lead_time_days == null) ask.lead_time_days = null
    else {
      const d = Number(src.lead_time_days)
      if (!Number.isInteger(d) || d < 0 || d > LEAD_MAX) return `${where} (${tag}): lead_time_days is a whole number of days, 0 to ${LEAD_MAX}, or null.`
      ask.lead_time_days = d
    }
  }
  const house = textField(src, 'supply_house', NAME_MAX)
  if (house === false) return `${where} (${tag}): supply_house is a house's name or id, or null.`
  if (house !== undefined) ask.supply_house = house
  if ('order_only' in src) {
    if (typeof src.order_only !== 'boolean') return `${where} (${tag}): order_only is true or false.`
    ask.order_only = src.order_only
  }
  return ask
}

function lineAsk(raw: unknown, verb: string, n: number): LineAsk | string {
  const src = obj(raw)
  const where = `${verb}: line ${n}`
  if (!src) return `${where} is not an object.`
  const line = typeof src.line === 'string' ? src.line.trim() : ''
  const tag = typeof src.tag === 'string' ? src.tag.trim() : ''
  if ((!line && !tag) || (line && tag)) return `${where} names one of line (the key get_submittals lists) or tag.`
  if (line.length > NAME_MAX || tag.length > TAG_MAX) return `${where}: the line or tag is too long.`
  const ask: LineAsk = line ? { line } : { tag }
  if (src.all_parts === true) {
    if (!tag) return `${where}: all_parts goes with a tag.`
    ask.all_parts = true
  }
  let facts = 0
  for (const k of ['ordered_on', 'expected_on', 'delivered_on'] as const) {
    if (!(k in src)) continue
    const v = src[k]
    if (v == null || v === '') ask[k] = null
    else if (typeof v === 'string' && isYmd(v.trim())) ask[k] = v.trim()
    else return `${where}: ${k} is a day as YYYY-MM-DD, or null to clear it.`
    facts += 1
  }
  for (const [k, max] of [['po_ref', PO_MAX], ['note', NOTE_MAX]] as const) {
    if (!(k in src)) continue
    const v = src[k]
    if (v != null && typeof v !== 'string') return `${where}: ${k} is text under ${max} characters.`
    const t = (v ?? '').trim()
    if (t.length > max) return `${where}: ${k} is text under ${max} characters.`
    ask[k] = t
    facts += 1
  }
  if (facts === 0) return `${where} names no fact: one of ${LOG_FACTS.join(', ')}.`
  return ask
}

/** plan_/apply_submittal_rows and plan_/apply_submittal_log's input, shaped. Nothing here reads the bid. */
export function submittalInput(verb: SubmittalVerb, input: Json): SubmittalInput {
  const hash = planHashOf(verb, input)
  if (!hash.ok) return hash
  const isRows = verb === 'plan_submittal_rows' || verb === 'apply_submittal_rows'
  const shape = `${verb} ${isRows ? ROWS_SHAPE : LOG_SHAPE}`
  const src = obj(isRows ? input.submittal : input.log)
  if (!src) return { ok: false, error: shape }
  const bid = typeof src.bid === 'string' ? src.bid.trim() : ''
  if (!bid || bid.length > BID_REF_MAX) return { ok: false, error: shape }
  const list = isRows ? src.rows : src.lines
  const max = isRows ? SUBMITTAL_ROWS_MAX : SUBMITTAL_LINES_MAX
  if (!Array.isArray(list) || list.length === 0 || list.length > max) return { ok: false, error: shape }
  if (isRows) {
    const rows: RowAsk[] = []
    const seen = new Set<string>()
    for (let i = 0; i < list.length; i++) {
      const ask = rowAsk(list[i], verb, i + 1)
      if (typeof ask === 'string') return { ok: false, error: ask }
      if (seen.has(tagKey(ask.tag))) return { ok: false, error: `${verb}: the tag ${ask.tag} is named twice. One row per tag.` }
      seen.add(tagKey(ask.tag))
      rows.push(ask)
    }
    return { ok: true, p: { action: 'rows', bid, rows }, target: bid, planHash: hash.hash }
  }
  const lines: LineAsk[] = []
  for (let i = 0; i < list.length; i++) {
    const ask = lineAsk(list[i], verb, i + 1)
    if (typeof ask === 'string') return { ok: false, error: ask }
    lines.push(ask)
  }
  return { ok: true, p: { action: 'log', bid, lines }, target: bid, planHash: hash.hash }
}

// ── the world the verbs read ─────────────────────────────────────────────────────────────────────────────────────

export type RevisionRow = { id: string; rev_number: number; status: string; title: string; note: string | null; shared_at: string | null; sent_outside_at: string | null; package_path: string | null; created_at: string }
export type ItemRow = ProcurementItemLike & {
  id: string
  submittal_id: string
  sequence_order: number
  status: string
  reason_kind: string | null
  reason_note: string | null
  order_only: boolean
  sheet_pages: number[]
  reviewed_by_name: string | null
}
export type HouseRow = { id: string; name: string; default_lead_time_days: number | null }

export type SubmittalWorld = {
  bid: { id: string; label: string; projectName: string }
  /** The newest job made from the bid, when there is one. */
  job: { id: string; label: string; name: string } | null
  /** Newest first. */
  revisions: RevisionRow[]
  /** Every revision's rows, in their order. */
  items: ItemRow[]
  parts: SubmittalPartRow[]
  records: ProcurementRecord[]
  houses: HouseRow[]
  countRows: Array<{ id: string; count: number; fixture: string | null }>
  splits: StageSplitRecord[]
  stageDates: StageDates
}

const REV_SELECT = 'id,rev_number,status,title,note,shared_at,sent_outside_at,package_path,created_at'
const ITEM_SELECT =
  'id,submittal_id,tag,sequence_order,specified_manufacturer,specified_model,specified_description,submitted_manufacturer,submitted_model,submitted_label,' +
  'supply_house_id,status,reason_kind,reason_note,lead_time_days,order_only,sheet_pages,source_count_row_id,review_decision,review_note,reviewed_at,reviewed_by_name'
const IDS_PER_READ = 100
const SPLIT_SOURCES: ReadonlySet<string> = new Set(['hand', 'rule', 'book', 'assembly'])

const revisionOf = (r: Row): RevisionRow => ({ id: str(r.id), rev_number: Number(r.rev_number) || 0, status: str(r.status), title: str(r.title), note: strOrNull(r.note), shared_at: strOrNull(r.shared_at), sent_outside_at: strOrNull(r.sent_outside_at), package_path: strOrNull(r.package_path), created_at: str(r.created_at) })
const itemOf = (r: Row): ItemRow => ({
  id: str(r.id),
  submittal_id: str(r.submittal_id),
  tag: str(r.tag),
  sequence_order: Number(r.sequence_order) || 0,
  specified_manufacturer: strOrNull(r.specified_manufacturer),
  specified_model: strOrNull(r.specified_model),
  specified_description: strOrNull(r.specified_description),
  submitted_manufacturer: strOrNull(r.submitted_manufacturer),
  submitted_model: strOrNull(r.submitted_model),
  submitted_label: strOrNull(r.submitted_label),
  supply_house_id: strOrNull(r.supply_house_id),
  status: str(r.status),
  reason_kind: strOrNull(r.reason_kind),
  reason_note: strOrNull(r.reason_note),
  lead_time_days: numOrNull(r.lead_time_days),
  order_only: r.order_only === true,
  sheet_pages: Array.isArray(r.sheet_pages) ? (r.sheet_pages as number[]) : [],
  source_count_row_id: strOrNull(r.source_count_row_id),
  review_decision: strOrNull(r.review_decision),
  review_note: strOrNull(r.review_note),
  reviewed_at: strOrNull(r.reviewed_at),
  reviewed_by_name: strOrNull(r.reviewed_by_name),
})
/** `procurementRecordFromRow` (src/lib/submittals/procurementLogIo.ts), over a row the door read. */
export const recordOf = (r: Row): ProcurementRecord => ({
  id: str(r.id),
  tag: strOrNull(r.tag),
  partKey: strOrNull(r.part_key),
  label: str(r.label),
  leadTimeDays: numOrNull(r.lead_time_days),
  stage: (strOrNull(r.stage) as ProcurementStage | null) ?? null,
  orderedOn: strOrNull(r.ordered_on),
  poRef: str(r.po_ref),
  expectedOn: strOrNull(r.expected_on),
  deliveredOn: strOrNull(r.delivered_on),
  note: str(r.note),
  sortOrder: Number(r.sort_order) || 0,
})

async function readIn(reader: Reader, table: string, select: string, column: string, ids: readonly string[]): Promise<Row[]> {
  const out: Row[] = []
  for (let i = 0; i < ids.length; i += IDS_PER_READ) {
    const { rows } = await readAllRows(reader, table, { select, filters: [{ column, op: 'in', value: ids.slice(i, i + IDS_PER_READ) }] })
    out.push(...rows)
  }
  return out
}

/**
 * The bid's submittal world, as Bids → Submittals reads it: the bid and the job made from it, every revision with its
 * rows and their parts, the order log's records, the supply houses, the takeoff's count rows and stage splits, and
 * the job's stage dates. `ref` is a bid id or text that finds exactly one bid. Throws on a refused read.
 */
export async function readSubmittalWorld(reader: Reader, ref: string): Promise<SubmittalWorld | { refused: string }> {
  const resolved = await resolve(ref, () => findBid(reader, ref) as Promise<{ matches: Row[] }>, 'bid')
  if ('refused' in resolved) return resolved
  const id = resolved.id
  const by = (column: string): RowFilter[] => [{ column, op: 'eq', value: id }]
  const [bidRows, prefixRows, jobRows, revRows, recordRows, houseRows, countRows, splitRows] = await Promise.all([
    reader.rows('bids', { select: 'id,bid_number,project_name,service_type_id', filters: by('id'), limit: 1 }),
    reader.rows('service_types', { select: 'id,ledger_job_prefix,ledger_bid_prefix', limit: 200 }),
    reader.rows('jobs_ledger', { select: 'id,hcp_number,click_number,job_name,service_type_id,created_at', filters: by('bid_id'), order: [{ column: 'created_at', ascending: false }], limit: 1 }),
    reader.rows('bid_submittals', { select: REV_SELECT, filters: by('bid_id'), order: [{ column: 'rev_number', ascending: false }], limit: 200 }),
    readAllRows(reader, 'bid_procurement_items', { select: 'id,tag,part_key,label,lead_time_days,stage,ordered_on,po_ref,expected_on,delivered_on,note,sort_order,created_at', filters: by('bid_id') }),
    readAllRows(reader, 'supply_houses', { select: 'id,name,default_lead_time_days', filters: [] }),
    readAllRows(reader, 'bids_count_rows', { select: 'id,count,fixture', filters: by('bid_id') }),
    readAllRows(reader, 'bid_takeoff_stage_splits', { select: 'id,count_row_id,line_id,part_id,rough_in,top_out,trim_set,source', filters: by('bid_id') }),
  ])
  const bid = bidRows[0]
  if (!bid) return { refused: `No bid ${id} — it does not exist, or RLS hides it from you.` }
  const prefixOf = (serviceTypeId: unknown) => prefixRows.find((p) => str(p.id) === str(serviceTypeId))
  const revisions = revRows.map(revisionOf)
  const itemRows = revisions.length > 0 ? await readIn(reader, 'bid_submittal_items', ITEM_SELECT, 'submittal_id', revisions.map((r) => r.id)) : []
  const items = itemRows.map(itemOf).sort((a, b) => a.sequence_order - b.sequence_order || a.id.localeCompare(b.id))
  const partRows = items.length > 0 ? await readIn(reader, 'bid_submittal_item_parts', '*', 'item_id', items.map((i) => i.id)) : []
  const job = jobRows[0] ?? null
  let stageDates: StageDates = {}
  if (job) {
    const jobBy: RowFilter[] = [{ column: 'job_id', op: 'eq', value: str(job.id) }]
    const [fixtures, windows] = await Promise.all([
      readAllRows(reader, 'jobs_ledger_fixtures', { select: 'id,name,stage_kind', filters: jobBy }),
      reader.rows('job_stage_windows', { select: 'fixture_id,window_start', filters: jobBy, limit: 200 }),
    ])
    stageDates = stageDatesFromJob(
      fixtures.rows.map((f) => ({ id: str(f.id), name: str(f.name), stage_kind: strOrNull(f.stage_kind) })),
      windows.map((w) => ({ fixture_id: str(w.fixture_id), window_start: strOrNull(w.window_start) })),
    )
  }
  return {
    bid: { id, label: formatBidLedgerNumberLabel(strOrNull(prefixOf(bid.service_type_id)?.ledger_bid_prefix), str(bid.bid_number)), projectName: str(bid.project_name) },
    job: job ? { id: str(job.id), label: formatJobLedgerNumberLabel(strOrNull(prefixOf(job.service_type_id)?.ledger_job_prefix), str(job.hcp_number).trim() || str(job.click_number).trim()), name: str(job.job_name) } : null,
    revisions,
    items,
    parts: (partRows as unknown as SubmittalPartRow[]).slice().sort((a, b) => a.sequence_order - b.sequence_order),
    records: recordRows.rows
      .slice()
      .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || str(a.created_at).localeCompare(str(b.created_at)))
      .map(recordOf),
    houses: houseRows.rows.map((h) => ({ id: str(h.id), name: str(h.name), default_lead_time_days: numOrNull(h.default_lead_time_days) })),
    countRows: countRows.rows.map((c) => ({ id: str(c.id), count: Number(c.count) || 0, fixture: strOrNull(c.fixture) })),
    splits: splitRows.rows.map((r) => ({
      countRowId: str(r.count_row_id),
      lineId: strOrNull(r.line_id),
      partId: strOrNull(r.part_id),
      weights: { rough_in: Number(r.rough_in), top_out: Number(r.top_out), trim_set: Number(r.trim_set) },
      source: (SPLIT_SOURCES.has(str(r.source)) ? str(r.source) : 'hand') as StageSplitRecord['source'],
    })),
    stageDates,
  }
}

// ── where everything stands: the tab's own kernels ───────────────────────────────────────────────────────────────

const REVISION_WORDS: Record<string, string> = { draft: 'draft', shared: 'shared with the GC', reviewed: 'reviewed', superseded: 'superseded' }
const DECISION_WORDS: Record<string, string> = { approved: 'Approved', revise: 'Revise', rejected: 'Rejected' }
const shortDay = (iso: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? `${m[2]}/${m[3]}` : ''
}

export type SubmittalBoard = {
  newest: RevisionRow | null
  /** The newest revision's rows. */
  rows: ItemRow[]
  /** The revision's number while it is a draft nobody has shared; null once shared, and with no revision. */
  draftRev: number | null
  sources: ProcurementItemSource[]
  log: ProcurementRow[]
}

const factsOf = (world: SubmittalWorld): ProcurementSourceFacts => ({
  houseNames: new Map(world.houses.map((h) => [h.id, h.name])),
  usualLead: new Map(world.houses.filter((h) => h.default_lead_time_days != null).map((h) => [h.id, h.default_lead_time_days!])),
  counts: new Map(world.countRows.map((c) => [c.id, c.count])),
  fixtures: new Map(world.countRows.filter((c) => c.fixture).map((c) => [c.id, c.fixture!])),
})

/**
 * The order log as the Procure step draws it (BidsSubmittalsTab → SubmittalProcurementPanel): the newest revision's
 * rows, the rows that stand approved on an earlier one (`rowsThatStand`), each as the log's lines
 * (`procurementItemSources`), then `buildProcurementLog` over the records, each tag's stage and the job's dates.
 * `records` lets a dry run draw the log as it will read after its writes.
 */
export function submittalBoard(world: SubmittalWorld, records: ReadonlyArray<ProcurementRecord> = world.records): SubmittalBoard {
  const newest = world.revisions[0] ?? null
  const rowsOf = (revId: string) => world.items.filter((i) => i.submittal_id === revId)
  const rows = newest ? rowsOf(newest.id) : []
  const facts = factsOf(world)
  const partsOf = (ids: ReadonlySet<string>) => world.parts.filter((p) => ids.has(p.item_id))
  let sources: ProcurementItemSource[] = []
  if (newest) {
    sources = procurementItemSources(rows, newest.status !== 'draft', partsOf(new Set(rows.map((r) => r.id))), facts)
    const earlier = world.revisions.slice(1)
    if (earlier.length > 0) {
      const earlierRows = earlier.map((r) => rowsOf(r.id))
      const earlierIds = new Set(earlierRows.flat().map((r) => r.id))
      // Approved whole, or part by part: a part the GC approved is released whatever the rest of its row says.
      const approvedParts = new Set(world.parts.filter((p) => earlierIds.has(p.item_id) && p.on_submittal && p.review_decision === 'approved').map((p) => p.item_id))
      const stands = rowsThatStand(
        [{ rev: newest.rev_number, rows }, ...earlier.map((r, i) => ({ rev: r.rev_number, rows: earlierRows[i] ?? [], asked: revisionWasRead(r.status) }))],
        (it) => it.review_decision === 'approved' || approvedParts.has(it.id),
      )
      if (stands.length > 0) {
        const revOf = new Map(stands.map((s) => [s.row.id, s.rev]))
        const standing = procurementItemSources(stands.map((s) => s.row), true, partsOf(new Set(stands.map((s) => s.row.id))), facts)
        sources = [...sources, ...standing.map((src) => ({ ...src, standsOnRev: src.itemId ? revOf.get(src.itemId) ?? null : null }))]
      }
    }
  }
  const tags = [...new Set(sources.map((s) => s.tag))]
  const tagStage = tagStagesFrom(world.countRows, world.splits, tags)
  return { newest, rows, draftRev: newest && newest.status === 'draft' ? newest.rev_number : null, sources, log: buildProcurementLog({ items: sources, records, tagStage, stageDates: world.stageDates }) }
}

const productWords = (manufacturer: string | null, model: string | null, fallback: string | null): string => [manufacturer, model].filter(Boolean).join(' ') || fallback || ''

/** One line of the log as the seat hands it back: its key (what plan_submittal_log takes), its step and its status in the tab's words. */
export function logLineOut(r: ProcurementRow): Json {
  const s = lineStatus(r)
  return {
    line: r.key,
    tag: r.tag,
    product: r.product,
    step: PROCUREMENT_STEP_LABELS[stepOfRow(r)],
    status: [s.text, s.sub].filter(Boolean).join(' · '),
    ...(r.standsOnRev != null ? { approved_on_rev: r.standsOnRev } : {}),
    ...(r.orderOnly ? { order_only: true } : {}),
    ...(r.isHand ? { added_by_hand: true } : {}),
    supply_house: r.supplyHouse,
    quantity: r.quantity ?? null,
    lead_time_days: r.leadTimeDays,
    stage: r.stage,
    order_by: r.orderBy,
    required_on: r.requiredOn,
    ordered_on: r.orderedOn,
    po_ref: r.poRef || null,
    expected_on: r.expectedOn,
    delivered_on: r.deliveredOn,
    late: r.late,
    note: r.note || null,
  }
}

function rowOut(it: ItemRow, world: SubmittalWorld): Json {
  const status = (PRODUCT_STATUSES as string[]).includes(it.status) ? (it.status as ProductStatus) : null
  const parts = world.parts.filter((p) => p.item_id === it.id)
  return {
    tag: it.tag,
    item_id: it.id,
    specified: productWords(it.specified_manufacturer, it.specified_model, it.specified_description) || null,
    submitted: productWords(it.submitted_manufacturer, it.submitted_model, it.submitted_label) || null,
    status: it.status,
    status_words: status ? `${STATUS_LABELS[status]}: ${STATUS_MEANINGS[status]}` : it.status,
    reason: it.reason_kind ? [REASON_LABELS[it.reason_kind as ReasonKind] ?? it.reason_kind, it.reason_note].filter(Boolean).join(' · ') : it.reason_note,
    lead_time_days: it.lead_time_days,
    supply_house: it.supply_house_id ? world.houses.find((h) => h.id === it.supply_house_id)?.name ?? it.supply_house_id : null,
    ...(it.order_only ? { order_only: true } : {}),
    cut_sheet_pages: it.sheet_pages.length,
    parts: parts.length,
    their_answer: it.review_decision ? { answer: DECISION_WORDS[it.review_decision] ?? it.review_decision, by: it.reviewed_by_name, on: it.reviewed_at ? it.reviewed_at.slice(0, 10) : null, note: it.review_note } : null,
  }
}

/** What get_submittals reads beside the world: the room, the updates sent, and Materials on site's own delivered rows. */
export type SubmittalExtras = {
  room: { status: string; shared_at: string | null; closed_at: string | null } | null
  people: Array<{ name: string; role: string | null; may_decide: boolean; open_count: number; last_seen_at: string | null; closed_at: string | null }>
  updates: Array<{ sent_at: string; sent_by_name: string; sent_to: string; line: string }>
  /** Null when the bid is not a job, or the read failed. `capped` when 200 or more rows came back. */
  onSite: { liveBoxes: number; deliveredRows: number; capped: boolean } | null
}

export async function readSubmittalExtras(reader: Reader, world: SubmittalWorld): Promise<SubmittalExtras> {
  const soft = async <T>(run: () => Promise<T>, otherwise: T): Promise<T> => {
    try {
      return await run()
    } catch {
      return otherwise
    }
  }
  const byBid: RowFilter[] = [{ column: 'bid_id', op: 'eq', value: world.bid.id }]
  const [roomRows, updates, onSite] = await Promise.all([
    soft(() => reader.rows('bid_submittal_rooms', { select: 'id,status,shared_at,closed_at', filters: byBid, limit: 1 }), [] as Row[]),
    soft(() => reader.rows('bid_procurement_updates', { select: 'sent_at,sent_by_name,sent_to,line', filters: byBid, order: [{ column: 'sent_at', ascending: false }], limit: 5 }), [] as Row[]),
    world.job
      ? soft(async () => {
          const jobBy: RowFilter[] = [{ column: 'job_id', op: 'eq', value: world.job!.id }]
          const [boxes, delivered] = await Promise.all([
            reader.rows('job_containers', { select: 'id,retired_at', filters: jobBy, limit: 200 }),
            reader.rows('job_material_movements', { select: 'id', filters: [...jobBy, { column: 'reason', op: 'eq', value: 'delivered' }], limit: 200 }),
          ])
          return { liveBoxes: boxes.filter((b) => !b.retired_at).length, deliveredRows: delivered.length, capped: boxes.length >= 200 || delivered.length >= 200 } as SubmittalExtras['onSite']
        }, null)
      : Promise.resolve(null),
  ])
  const room = roomRows[0] ?? null
  const people = room ? await soft(() => reader.rows('bid_submittal_people', { select: 'name,role,may_decide,open_count,last_seen_at,closed_at', filters: [{ column: 'room_id', op: 'eq', value: str(room.id) }], order: [{ column: 'created_at' }], limit: 100 }), [] as Row[]) : []
  return {
    room: room ? { status: str(room.status), shared_at: strOrNull(room.shared_at), closed_at: strOrNull(room.closed_at) } : null,
    people: people.map((p) => ({ name: str(p.name), role: strOrNull(p.role), may_decide: p.may_decide !== false, open_count: Number(p.open_count) || 0, last_seen_at: strOrNull(p.last_seen_at), closed_at: strOrNull(p.closed_at) })),
    updates: updates.map((u) => ({ sent_at: str(u.sent_at), sent_by_name: str(u.sent_by_name), sent_to: str(u.sent_to), line: str(u.line) })),
    onSite,
  }
}

const VERB_WORDS = {
  plan_submittal_rows: 'plan_submittal_rows({ submittal: { bid, rows: [{ tag, specified?, submitted?, status?, reason_kind?, reason_note?, lead_time_days?, supply_house?, order_only? }] } }) → apply_submittal_rows: rows onto the draft revision, added or changed by tag.',
  plan_submittal_log: 'plan_submittal_log({ log: { bid, lines: [{ line | tag (+ all_parts), ordered_on?, po_ref?, expected_on?, delivered_on?, note? }] } }) → apply_submittal_log: the order log\'s facts on a line.',
  telling_people: 'Nothing here emails, texts or posts to anyone. status_text is the status in plain words: read it back, or hand it to the person to paste where the team reads.',
}

/** "Rev 2 · shared with the GC · 6 rows · 2 approved, 1 sent back, 3 not answered". */
export function revisionLine(rev: RevisionRow, rows: ReadonlyArray<ItemRow>): string {
  const gc = rows.filter((r) => !r.order_only)
  const approved = gc.filter((r) => r.review_decision === 'approved').length
  const back = gc.filter((r) => r.review_decision === 'revise' || r.review_decision === 'rejected').length
  const open = gc.length - approved - back
  const answers = [approved > 0 ? `${approved} approved` : '', back > 0 ? `${back} sent back` : '', open > 0 ? `${open} not answered` : ''].filter(Boolean).join(', ')
  return [`Rev ${rev.rev_number}`, REVISION_WORDS[rev.status] ?? rev.status, plural(rows.length, 'row'), answers].filter(Boolean).join(' · ')
}

/**
 * The status in plain words, ready to paste into a message: where the submittal stands, the four steps, what is next,
 * then one line a part. Reads like the Procure step's top and its lines; nothing here is sent by the seat.
 */
export function statusText(world: SubmittalWorld, board: SubmittalBoard, today: string): string {
  const head = `${world.bid.label} ${world.bid.projectName} — submittals as of ${shortDay(today)}`.replace(/\s+/g, ' ')
  if (!board.newest) return `${head}\nNo submittal has been started on this bid.`
  const steps = procurementSteps(board.log, board.draftRev)
  const next = procurementNextLine(board.log, today, board.draftRev)
  const lines = board.log.map((r) => {
    const s = lineStatus(r)
    return `- ${[r.tag, r.product].filter(Boolean).join(' · ')}: ${PROCUREMENT_STEP_LABELS[stepOfRow(r)]}${s.text ? `, ${s.text}` : ''}`
  })
  return [
    head,
    `${revisionLine(board.newest, board.rows)}${board.draftRev != null ? '. The GC has not been sent this revision.' : '.'}`,
    steps.map((s) => `${s.label} ${s.count}${s.note ? ` (${s.note})` : ''}`).join(' · '),
    ...(next.length > 0 ? [`Next: ${next.join(' ')}`] : []),
    ...lines,
  ].join('\n')
}

/** get_submittals' reply. */
export function submittalsReply(world: SubmittalWorld, extras: SubmittalExtras, today: string): Json {
  const board = submittalBoard(world)
  const steps = procurementSteps(board.log, board.draftRev)
  const blockers = orderBlockers(board.log)
  const loggedDelivered = board.log.filter((r) => r.deliveredOn).length
  const newest = board.newest
  return {
    bid: { id: world.bid.id, label: world.bid.label, project_name: world.bid.projectName },
    job: world.job ? { id: world.job.id, label: world.job.label, name: world.job.name } : null,
    stands: newest ? revisionLine(newest, board.rows) : 'No submittal has been started on this bid.',
    revisions: world.revisions.map((r) => ({
      rev: r.rev_number,
      status: r.status,
      line: revisionLine(r, world.items.filter((i) => i.submittal_id === r.id)),
      shared_at: r.shared_at,
      sent_outside_at: r.sent_outside_at,
      has_package: !!r.package_path,
    })),
    working_revision: newest
      ? { rev: newest.rev_number, status: newest.status, takes_rows: newest.status === 'draft', why: newest.status === 'draft' ? 'a draft: plan_submittal_rows adds and changes its rows' : `Rev ${newest.rev_number} is ${REVISION_WORDS[newest.status] ?? newest.status}: start the next revision on Bids → Submittals (step 7, Resubmit) before loading rows` }
      : { rev: null, status: null, takes_rows: true, why: 'no revision yet: plan_submittal_rows makes Rev 1 as a draft' },
    rows: board.rows.map((it) => rowOut(it, world)),
    order_log: {
      steps: steps.map((s) => ({ step: s.label, parts: s.count, note: s.note || null })),
      next: procurementNextLine(board.log, today, board.draftRev).join(' ') || null,
      lines: board.log.map(logLineOut),
      missing_before_ordering: { no_lead_time: blockers.noLead.length, no_supply_house: blockers.noHouse.length, no_stage: blockers.noStage.length, no_product: blockers.noProduct.length, no_job_stage_dates: world.job ? Object.keys(world.stageDates).length === 0 : true },
      updates_sent: extras.updates,
    },
    room: extras.room ? { ...extras.room, people: extras.people } : null,
    delivered: {
      marked_on_the_log: loggedDelivered,
      materials_on_site: world.job ? (extras.onSite ? { live_boxes: extras.onSite.liveBoxes, delivered_rows: extras.onSite.capped ? `${extras.onSite.deliveredRows} or more` : extras.onSite.deliveredRows } : 'could not be read') : 'the bid is not a job yet',
      note: 'Two separate facts. The log\'s Delivered is a date the office types on a line; Materials on site counts parts into cages and boxes (read_on_site). Neither writes the other, so a part can read On site here with nothing in a box.',
    },
    status_text: statusText(world, board, today),
    verbs: VERB_WORDS,
  }
}

/** get_submittals: the bid's submittals as Bids → Submittals reads them, in one call. */
export async function getSubmittals(reader: Reader, ref: string, today: string) {
  const world = await readSubmittalWorld(reader, ref)
  if ('refused' in world) return world
  return submittalsReply(world, await readSubmittalExtras(reader, world), today)
}

// ── the dry runs ─────────────────────────────────────────────────────────────────────────────────────────────────

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }

type RowWrite = Json & { tag: string }
const ROW_FIELDS_OUT = ['specified_manufacturer', 'specified_model', 'specified_description', 'submitted_manufacturer', 'submitted_model', 'submitted_label', 'status', 'reason_kind', 'reason_note', 'lead_time_days', 'supply_house_id', 'order_only'] as const

/** A house by id, by its exact name, or by the one name that holds the words. */
export function findHouse(houses: ReadonlyArray<HouseRow>, ref: string): HouseRow | { refused: string } {
  const t = ref.trim()
  if (UUID_RE.test(t)) {
    const byId = houses.find((h) => h.id.toLowerCase() === t.toLowerCase())
    return byId ?? { refused: `no supply house ${t}` }
  }
  const lower = t.toLowerCase()
  const exact = houses.filter((h) => h.name.trim().toLowerCase() === lower)
  if (exact.length === 1) return exact[0]!
  const holds = houses.filter((h) => h.name.toLowerCase().includes(lower))
  if (holds.length === 1) return holds[0]!
  if (holds.length === 0) return { refused: `no supply house named "${t}" (read_rows on supply_houses lists them)` }
  return { refused: `"${t}" fits ${holds.length} supply houses: ${holds.slice(0, 6).map((h) => h.name).join(', ')}` }
}

/** The status a new row takes when none is given: the tab's own rule over the two products, Proposed when the plans named nothing. */
export function statusForNewRow(ask: RowAsk): ProductStatus {
  if (ask.status) return ask.status
  const specified = { manufacturer: ask.specified_manufacturer ?? null, model: ask.specified_model ?? null }
  const submitted = { manufacturer: ask.submitted_manufacturer ?? null, model: ask.submitted_model ?? null, label: ask.submitted_label ?? null }
  const hasSubmitted = !!(submitted.manufacturer || submitted.model || submitted.label)
  const hasSpecified = !!(specified.manufacturer || specified.model || ask.specified_description)
  if (!hasSpecified) return hasSubmitted ? 'proposed' : 'missing'
  if (!hasSubmitted) return 'missing'
  // A schedule that describes the fixture without a make or model cannot be matched: the row is an alternate until someone says otherwise.
  return deriveProductStatus({ specified: specified.manufacturer || specified.model ? specified : { manufacturer: null, model: ask.specified_description ?? null }, submitted }).status
}

const rowWords = (r: { status: string; specified: string; submitted: string }): string => {
  const status = (PRODUCT_STATUSES as string[]).includes(r.status) ? STATUS_LABELS[r.status as ProductStatus] : r.status
  return [r.submitted || '(no product)', status, r.specified ? `plans: ${r.specified}` : ''].filter(Boolean).join(' · ')
}

/**
 * plan_submittal_rows' dry run. Rows go onto the newest revision while it is a draft, or onto a Rev 1 the apply makes
 * when the bid has none; a revision the GC holds refuses the plan and names the tab's press. A tag already on the
 * draft is changed, the fields named only. What cannot be done is held with its reason and the rest goes on: a row
 * the GC answered, a row that carries parts (its product is its parts'), a supply house that cannot be found.
 */
export function rowsDryRun(p: RowsPayload, world: SubmittalWorld): DryRun {
  const newest = world.revisions[0] ?? null
  if (newest && newest.status !== 'draft') {
    return { ok: false, refused: `Rev ${newest.rev_number} on ${world.bid.label} is ${REVISION_WORDS[newest.status] ?? newest.status}, so its rows are the GC's to answer. Start the next revision on Bids → Submittals (step 7, Resubmit), then plan again: rows load onto a draft.` }
  }
  const existing = newest ? world.items.filter((i) => i.submittal_id === newest.id) : []
  const partCount = (itemId: string) => world.parts.filter((x) => x.item_id === itemId).length
  let seq = existing.reduce((m, i) => Math.max(m, i.sequence_order), 0)
  const inserts: RowWrite[] = []
  const patches: Array<{ id: string; tag: string; patch: Json }> = []
  const rows: Json[] = []
  const held: Array<{ tag: string; why: string }> = []
  const warnings: string[] = []
  let unchanged = 0
  for (const ask of p.rows) {
    const matches = existing.filter((i) => tagKey(i.tag) === tagKey(ask.tag))
    if (matches.length > 1) {
      held.push({ tag: ask.tag, why: `${matches.length} rows on Rev ${newest!.rev_number} carry this tag; change them on the tab` })
      continue
    }
    let houseId: string | null | undefined
    if (ask.supply_house !== undefined) {
      if (ask.supply_house === null) houseId = null
      else {
        const house = findHouse(world.houses, ask.supply_house)
        if ('refused' in house) {
          held.push({ tag: ask.tag, why: house.refused })
          continue
        }
        houseId = house.id
      }
    }
    const houseName = (id: string | null) => (id ? world.houses.find((h) => h.id === id)?.name ?? id : null)
    const row = matches[0]
    if (!row) {
      const status = statusForNewRow(ask)
      if (status === 'proposed' && (ask.specified_manufacturer || ask.specified_model || ask.specified_description)) {
        held.push({ tag: ask.tag, why: 'Proposed is for a row the plans named nothing for; this one has a specified product' })
        continue
      }
      seq += 1
      const insert: RowWrite = {
        tag: ask.tag,
        sequence_order: seq,
        specified_manufacturer: ask.specified_manufacturer ?? null,
        specified_model: ask.specified_model ?? null,
        specified_description: ask.specified_description ?? null,
        submitted_manufacturer: ask.submitted_manufacturer ?? null,
        submitted_model: ask.submitted_model ?? null,
        submitted_label: ask.submitted_label ?? null,
        status,
        reason_kind: ask.reason_kind ?? null,
        reason_note: ask.reason_note ?? null,
        lead_time_days: ask.lead_time_days ?? null,
        supply_house_id: houseId ?? null,
        order_only: ask.order_only === true,
        sheet_pages: [],
      }
      inserts.push(insert)
      if (needsReason(status) && !insert.reason_kind && !insert.reason_note) warnings.push(`${ask.tag} is ${STATUS_LABELS[status]} with no reason: the GC's page asks why.`)
      rows.push({
        tag: ask.tag,
        action: 'add',
        reads: rowWords({ status, specified: productWords(insert.specified_manufacturer as string | null, insert.specified_model as string | null, insert.specified_description as string | null), submitted: productWords(insert.submitted_manufacturer as string | null, insert.submitted_model as string | null, insert.submitted_label as string | null) }),
        status,
        status_means: STATUS_MEANINGS[status],
        supply_house: houseName(houseId ?? null),
        lead_time_days: insert.lead_time_days,
        ...(insert.order_only ? { order_only: true } : {}),
      })
      continue
    }
    if (row.review_decision) {
      held.push({ tag: ask.tag, why: `the GC answered this row (${DECISION_WORDS[row.review_decision] ?? row.review_decision}${row.reviewed_at ? ` ${shortDay(row.reviewed_at)}` : ''}); change it on the tab, where their answer is in view` })
      continue
    }
    const n = partCount(row.id)
    if (n > 0) {
      held.push({ tag: ask.tag, why: `the row carries ${plural(n, 'part')} and its product, house and lead time are read from them; edit it in the row's Edit window` })
      continue
    }
    const wanted: Json = {}
    for (const k of ROW_TEXT_COLUMNS) if (ask[k] !== undefined) wanted[k] = ask[k]
    if (ask.status !== undefined) wanted.status = ask.status
    if (ask.reason_kind !== undefined) wanted.reason_kind = ask.reason_kind
    if (ask.reason_note !== undefined) wanted.reason_note = ask.reason_note
    if (ask.lead_time_days !== undefined) wanted.lead_time_days = ask.lead_time_days
    if (houseId !== undefined) wanted.supply_house_id = houseId
    if (ask.order_only !== undefined) wanted.order_only = ask.order_only
    const before = row as unknown as Json
    const patch: Json = {}
    for (const k of ROW_FIELDS_OUT) if (k in wanted && (wanted[k] ?? null) !== (before[k] ?? null)) patch[k] = wanted[k]
    if (Object.keys(patch).length === 0) {
      unchanged += 1
      rows.push({ tag: row.tag, action: 'unchanged', reads: rowWords({ status: row.status, specified: productWords(row.specified_manufacturer, row.specified_model, row.specified_description), submitted: productWords(row.submitted_manufacturer, row.submitted_model, row.submitted_label) }) })
      continue
    }
    const after = { ...before, ...patch } as unknown as ItemRow
    if (after.status === 'proposed' && (after.specified_manufacturer || after.specified_model || after.specified_description)) {
      held.push({ tag: ask.tag, why: 'Proposed is for a row the plans named nothing for; this one has a specified product' })
      continue
    }
    patches.push({ id: row.id, tag: row.tag, patch })
    if (needsReason(after.status as ProductStatus) && !after.reason_kind && !after.reason_note) warnings.push(`${row.tag} is ${STATUS_LABELS[after.status as ProductStatus] ?? after.status} with no reason: the GC's page asks why.`)
    rows.push({
      tag: row.tag,
      action: 'change',
      changes: Object.fromEntries(Object.keys(patch).map((k) => [k === 'supply_house_id' ? 'supply_house' : k, k === 'supply_house_id' ? { from: houseName(row.supply_house_id), to: houseName(patch[k] as string | null) } : { from: before[k] ?? null, to: patch[k] }])),
      reads: rowWords({ status: after.status, specified: productWords(after.specified_manufacturer, after.specified_model, after.specified_description), submitted: productWords(after.submitted_manufacturer, after.submitted_model, after.submitted_label) }),
    })
  }
  if (inserts.length === 0 && patches.length === 0) {
    const why = held.length > 0 ? ` Held: ${held.map((h) => `${h.tag} (${h.why})`).join('; ')}.` : ''
    return { ok: false, refused: `Nothing to write on ${world.bid.label}: ${unchanged > 0 ? `${plural(unchanged, 'row')} already ${unchanged === 1 ? 'reads' : 'read'} that way.` : 'no row is ready.'}${why}` }
  }
  return {
    ok: true,
    reply: {
      action: 'rows',
      bid: { id: world.bid.id, label: world.bid.label, project_name: world.bid.projectName },
      revision: newest ? { id: newest.id, rev: newest.rev_number, status: newest.status, rows_now: existing.length, made_by_this_plan: false } : { id: null, rev: 1, status: 'draft', rows_now: 0, made_by_this_plan: true },
      will: [inserts.length > 0 ? `add ${plural(inserts.length, 'row')}` : '', patches.length > 0 ? `change ${plural(patches.length, 'row')}` : '', !newest ? 'make Rev 1 as a draft' : ''].filter(Boolean).join(', '),
      counts: { add: inserts.length, change: patches.length, unchanged, held: held.length },
      rows,
      held,
      warnings,
      writes: { make_revision: !newest, inserts, patches },
      not_done: [
        'the parts under a row, the cut sheet pages and the package PDF: the tab\'s Edit window and steps 3 and 4',
        'their answer (Approved, Revise, Rejected): step 6 on the tab',
        'sharing with the GC: nothing here is sent to anyone',
      ],
    },
  }
}

const LOG_COLUMN: Record<LogFact, keyof ProcurementRecord> = { ordered_on: 'orderedOn', po_ref: 'poRef', expected_on: 'expectedOn', delivered_on: 'deliveredOn', note: 'note' }
const WAITS_ON_THE_GC = new Set(['awaiting', 'sent_back', 'not_submitted'])

/**
 * plan_submittal_log's dry run: the order log's facts on its lines, as the Procure step's date boxes write them
 * (SubmittalProcurementPanel `write`: the record updated when the line has one, else made with the next sort order).
 * A line is named by its key or by its tag; a tag with several part lines needs all_parts or the part's own key.
 * The plan draws the log again with the facts in, so each line says where it stood and where it will stand.
 */
export function logDryRun(p: LogPayload, world: SubmittalWorld, today: string): DryRun {
  const board = submittalBoard(world)
  if (board.log.length === 0) return { ok: false, refused: `${world.bid.label} has no line on its order log: no submittal row and no line added by hand. plan_submittal_rows loads rows; get_submittals reads the bid.` }
  const held: Array<{ line: string; why: string }> = []
  const warnings: string[] = []
  const wanted = new Map<string, Partial<Record<LogFact, string | null>>>()
  for (const ask of p.lines) {
    const name = ask.line ?? ask.tag ?? ''
    let targets: ProcurementRow[]
    if (ask.line) {
      targets = board.log.filter((r) => r.key === ask.line)
      if (targets.length === 0) {
        held.push({ line: name, why: 'no line on the log has this key (get_submittals lists them)' })
        continue
      }
    } else {
      const under = board.log.filter((r) => !r.isHand && tagKey(r.tag ?? '') === tagKey(ask.tag ?? ''))
      if (under.length === 0) {
        held.push({ line: name, why: 'no row on the submittal carries this tag (get_submittals lists them)' })
        continue
      }
      if (under.length > 1 && !ask.all_parts) {
        held.push({ line: name, why: `${under.length} lines sit under this tag; pass all_parts: true for all of them, or one line's key: ${under.slice(0, 8).map((r) => `${r.key} (${r.product})`).join('; ')}` })
        continue
      }
      targets = under
    }
    const facts: Partial<Record<LogFact, string | null>> = {}
    for (const k of LOG_FACTS) if (ask[k] !== undefined) facts[k] = ask[k] as string | null
    const ahead = (['ordered_on', 'delivered_on'] as const).find((k) => typeof facts[k] === 'string' && (facts[k] as string) > today)
    if (ahead) {
      held.push({ line: name, why: `${ahead} ${facts[ahead]} is after today (${today}): it has not happened yet. expected_on is the day to come.` })
      continue
    }
    for (const t of targets) wanted.set(t.key, { ...(wanted.get(t.key) ?? {}), ...facts })
  }
  const recordOfRow = (r: ProcurementRow): ProcurementRecord | null => (r.recordId ? world.records.find((x) => x.id === r.recordId) ?? null : null)
  let nextSort = world.records.reduce((m, r) => Math.max(m, r.sortOrder), -1)
  const writes: Json[] = []
  const after: ProcurementRecord[] = world.records.map((r) => ({ ...r }))
  const touched: Array<{ row: ProcurementRow; patch: Json }> = []
  let unchanged = 0
  for (const row of board.log) {
    const facts = wanted.get(row.key)
    if (!facts) continue
    const rec = recordOfRow(row)
    const patch: Json = {}
    for (const k of LOG_FACTS) {
      if (!(k in facts)) continue
      const now = rec ? (rec[LOG_COLUMN[k]] as string | null) : k === 'po_ref' || k === 'note' ? '' : null
      const to = k === 'po_ref' || k === 'note' ? (facts[k] ?? '') : facts[k] ?? null
      if ((now ?? null) !== (to ?? null)) patch[k] = to
    }
    if (Object.keys(patch).length === 0) {
      unchanged += 1
      continue
    }
    const orderedAfter = 'ordered_on' in patch ? (patch.ordered_on as string | null) : rec?.orderedOn ?? null
    const deliveredAfter = 'delivered_on' in patch ? (patch.delivered_on as string | null) : rec?.deliveredOn ?? null
    if (orderedAfter && deliveredAfter && deliveredAfter < orderedAfter) warnings.push(`${row.key}: delivered ${deliveredAfter} is before ordered ${orderedAfter}.`)
    if (WAITS_ON_THE_GC.has(row.status) && (patch.ordered_on || patch.delivered_on)) warnings.push(`${row.key}: the GC has not approved this part (${PROCUREMENT_STEP_LABELS[stepOfRow(row)]}). The tab lets you mark it too; say so if it was bought ahead of their answer.`)
    if (rec) {
      writes.push({ line: row.key, record_id: rec.id, patch })
      const i = after.findIndex((x) => x.id === rec.id)
      after[i] = withFacts(after[i]!, patch)
    } else {
      nextSort += 1
      const insert: Json = { bid_id: world.bid.id, tag: row.tag, ...(row.partKey ? { part_key: row.partKey } : {}), sort_order: nextSort, ...patch }
      writes.push({ line: row.key, record_id: null, insert })
      after.push(withFacts({ id: `new:${row.key}`, tag: row.tag, partKey: row.partKey ?? null, label: '', leadTimeDays: null, stage: null, orderedOn: null, poRef: '', expectedOn: null, deliveredOn: null, note: '', sortOrder: nextSort }, patch))
    }
    touched.push({ row, patch })
  }
  if (writes.length === 0) {
    const why = held.length > 0 ? ` Held: ${held.map((h) => `${h.line} (${h.why})`).join('; ')}.` : ''
    return { ok: false, refused: `Nothing to write on ${world.bid.label}'s order log: ${unchanged > 0 ? `${plural(unchanged, 'line')} already ${unchanged === 1 ? 'reads' : 'read'} that way.` : 'no line is ready.'}${why}` }
  }
  const boardAfter = submittalBoard(world, after)
  const afterByKey = new Map(boardAfter.log.map((r) => [r.key, r]))
  const words = (r: ProcurementRow): string => {
    const s = lineStatus(r)
    return [PROCUREMENT_STEP_LABELS[stepOfRow(r)], s.text].filter(Boolean).join(': ')
  }
  const stepsOf = (b: SubmittalBoard) => procurementSteps(b.log, b.draftRev).map((s) => `${s.label} ${s.count}`).join(' · ')
  return {
    ok: true,
    reply: {
      action: 'log',
      bid: { id: world.bid.id, label: world.bid.label, project_name: world.bid.projectName },
      will: `write ${plural(writes.length, 'line')} of the order log`,
      counts: { write: writes.length, unchanged, held: held.length },
      lines: touched.map(({ row, patch }) => {
        const then = afterByKey.get(row.key)
        return { line: row.key, tag: row.tag, product: row.product, sets: patch, from: words(row), to: then ? words(then) : null }
      }),
      steps: { now: stepsOf(board), after: stepsOf(boardAfter) },
      next_after: procurementNextLine(boardAfter.log, today, boardAfter.draftRev).join(' ') || null,
      held,
      warnings,
      writes,
      not_done: [
        'Materials on site: a Delivered date here puts nothing in a cage or box (plan_delivery lands an invoice\'s lines on the job)',
        'the update to the GC: Send update… on the tab records and prints it; nothing here is sent to anyone',
        'a line added by hand, a part\'s lead time, house or stage: the tab\'s + Add item and Set…',
      ],
    },
  }
}

function withFacts(rec: ProcurementRecord, patch: Json): ProcurementRecord {
  const out = { ...rec }
  if ('ordered_on' in patch) out.orderedOn = patch.ordered_on as string | null
  if ('po_ref' in patch) out.poRef = str(patch.po_ref)
  if ('expected_on' in patch) out.expectedOn = patch.expected_on as string | null
  if ('delivered_on' in patch) out.deliveredOn = patch.delivered_on as string | null
  if ('note' in patch) out.note = str(patch.note)
  return out
}

/** The dry run for either pair. */
export function submittalDryRun(p: SubmittalPayload, world: SubmittalWorld, today: string): DryRun {
  return p.action === 'rows' ? rowsDryRun(p, world) : logDryRun(p, world, today)
}

// ── the writes, as the apply sends them ──────────────────────────────────────────────────────────────────────────

/** One table write of an apply: a POST of rows, or a PATCH by id. */
export type SubmittalWrite =
  | { kind: 'make_revision'; table: 'bid_submittals'; body: Json }
  | { kind: 'insert_rows'; table: 'bid_submittal_items'; body: Json[] }
  | { kind: 'patch_row'; table: 'bid_submittal_items'; id: string; body: Json; what: string }
  | { kind: 'insert_line'; table: 'bid_procurement_items'; body: Json; what: string }
  | { kind: 'patch_line'; table: 'bid_procurement_items'; id: string; body: Json; what: string }

/**
 * The writes a plan's reply commits to, in the order the apply sends them. `revisionId` is the draft's id, or null
 * when the plan makes Rev 1: the apply then fills the rows' submittal_id from the row the first write returns.
 */
export function submittalWrites(reply: Json, me: { userId: string }): SubmittalWrite[] {
  const w = obj(reply.writes)
  const out: SubmittalWrite[] = []
  if (reply.action === 'rows' && w) {
    const bid = obj(reply.bid)
    const revision = obj(reply.revision)
    if (w.make_revision === true) out.push({ kind: 'make_revision', table: 'bid_submittals', body: { bid_id: str(bid?.id), rev_number: 1, status: 'draft', created_by: me.userId } })
    const inserts = (Array.isArray(w.inserts) ? w.inserts : []) as Json[]
    if (inserts.length > 0) out.push({ kind: 'insert_rows', table: 'bid_submittal_items', body: inserts.map((r) => ({ submittal_id: strOrNull(revision?.id), ...r })) })
    for (const patch of (Array.isArray(w.patches) ? w.patches : []) as Json[]) out.push({ kind: 'patch_row', table: 'bid_submittal_items', id: str(patch.id), body: obj(patch.patch) ?? {}, what: str(patch.tag) })
    return out
  }
  for (const line of (Array.isArray(reply.writes) ? reply.writes : []) as Json[]) {
    if (line.record_id) out.push({ kind: 'patch_line', table: 'bid_procurement_items', id: str(line.record_id), body: obj(line.patch) ?? {}, what: str(line.line) })
    else out.push({ kind: 'insert_line', table: 'bid_procurement_items', body: obj(line.insert) ?? {}, what: str(line.line) })
  }
  return out
}

/** The apply's reply: what landed, what did not and why, and the next read. */
export function submittalAppliedWords(reply: Json, done: { landed: string[]; failed: Array<{ what: string; why: string }>; revisionId: string | null }): Json {
  const bid = obj(reply.bid)
  const label = str(bid?.label)
  return {
    bid_id: str(bid?.id),
    label,
    ...(reply.action === 'rows' ? { revision_id: done.revisionId } : {}),
    landed: done.landed,
    ...(done.failed.length > 0 ? { failed: done.failed, note: 'The writes are rows, one at a time, as on the tab: what landed stays, what failed did not. Plan again for the rest.' } : {}),
    next: `get_submittals { bid: "${label}" } reads it back as Bids → Submittals draws it.`,
  }
}
