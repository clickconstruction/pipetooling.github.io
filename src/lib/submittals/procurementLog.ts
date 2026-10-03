/**
 * The procurement log (Submittals → Procure, v2.4083).
 *
 * A GC's procurement log asks one question per long-lead product: is it released,
 * is it ordered, when does it land, and is that before we need it. Per row:
 *   released  = the review room's approval and its date (never typed);
 *   ordered   = typed once, with the PO;
 *   expected  = ordered + the lead time from the pick, unless the house gave a date;
 *   required  = the start of the stage the item belongs to, on the job's stage windows;
 *   float     = required − expected; order by = required − lead time while unordered.
 * Pure: dates are ISO `YYYY-MM-DD` strings, "today" is passed in, and a call's `at` is an
 * instant read as its day in the company's zone. The reads live in `./procurementLogIo.ts`;
 * the sheet and the text of an update are built here too.
 */
import { escapeHtml } from '../bidDocuments/htmlDoc'
import { isPlausibleDate } from '../dateBoxEntry'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { compareTags } from './buildSubmittalRows'
import { describeLeadTime } from './leadTime'
import { isCarrier } from './itemParts'
import { normalizeTag } from './parseFixtureSchedule'
import { tagsFromFixtureName } from './takeoffCandidates'
import type { TakeoffStage } from '../bids/bidTakeoffHelpers'
import { STAGE_KEYS, defaultSplitForFixture, effectiveSplit, indexStageSplits, type StageSplitRecord, type StageWeights } from '../bids/materialsByStage'
import type { StageDates } from '../../../supabase/functions/_shared/procurementStageDates.ts'
export type { StageDates } from '../../../supabase/functions/_shared/procurementStageDates.ts'

export type ProcurementStage = TakeoffStage
export const PROCUREMENT_STAGE_LABELS: Record<ProcurementStage, string> = { rough_in: 'Rough In', top_out: 'Top Out', trim_set: 'Trim Set' }

/* ────────────────────────────── dates ────────────────────────────── */

/** `YYYY-MM-DD` → a local Date at noon (no DST edge), or null. */
export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)
  return Number.isNaN(d.getTime()) ? null : d
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso)
  if (!d) return iso
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number | null {
  const da = parseIsoDate(a)
  const db = parseIsoDate(b)
  if (!da || !db) return null
  return Math.round((db.getTime() - da.getTime()) / 86_400_000)
}

/** "09/28" — the log's short date; '' for null. */
export function shortDate(iso: string | null | undefined): string {
  const d = parseIsoDate(iso)
  if (!d) return ''
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

/** "today" · "1 day ago" · "12 days ago" · "in 1 day" · "in 12 days" — a log date against today; '' when either does not read. */
export function daysAgoWords(iso: string | null | undefined, asOf: string): string {
  if (!iso) return ''
  const n = daysBetween(iso, asOf)
  if (n == null) return ''
  if (n === 0) return 'today'
  const days = `${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'}`
  return n > 0 ? `${days} ago` : `in ${days}`
}

/**
 * The year a date typed as month and day alone belongs to: the one that puts it nearest
 * `asOf` (12/20 typed in January is last month; 01/05 typed in December is next month).
 */
export function nearestYearFor(month: number, day: number, asOf: string): number {
  const today = parseIsoDate(asOf) ?? new Date()
  const y = today.getFullYear()
  let best = y
  let bestGap = Infinity
  for (const year of [y - 1, y, y + 1]) {
    const gap = Math.abs(new Date(year, month - 1, day, 12).getTime() - today.getTime())
    if (gap < bestGap) {
      best = year
      bestGap = gap
    }
  }
  return best
}

/**
 * A log date as its box shows it: "09/23" when that month and day, typed alone, would read
 * back as the same date (`nearestYearFor`), "09/23/27" when the year has to be said, and
 * every digit ("02/12/0001") for a year outside the log's window; '' for none.
 */
export function logDateRead(iso: string | null | undefined, asOf: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!m) return ''
  if (!isPlausibleDate(iso)) return `${m[2]}/${m[3]}/${m[1]}`
  return nearestYearFor(Number(m[2]), Number(m[3]), asOf) === Number(m[1]) ? `${m[2]}/${m[3]}` : `${m[2]}/${m[3]}/${m[1]!.slice(2)}`
}

export type TypedLogDate = { kind: 'empty' } | { kind: 'date'; iso: string } | { kind: 'bad' }

/**
 * A date as it is typed into the log: "9/23", "09-23", "9.23" or "0923" take the nearest
 * year (`nearestYearFor`); "9/23/27" and "9/23/2027" say their own. Nothing typed is empty;
 * a day that does not exist, or a year outside the window (`isPlausibleDate`), is bad and never saved.
 */
export function readTypedLogDate(text: string, asOf: string): TypedLogDate {
  const v = text.trim()
  if (v === '') return { kind: 'empty' }
  const m = /^(\d{1,2})\s*[/\-. ]\s*(\d{1,2})(?:\s*[/\-. ]\s*(\d{2}|\d{4}))?$/.exec(v) ?? /^(\d{2})(\d{2})()$/.exec(v)
  if (!m) return { kind: 'bad' }
  const month = Number(m[1])
  const day = Number(m[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return { kind: 'bad' }
  const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : nearestYearFor(month, day, asOf)
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return isPlausibleDate(iso) ? { kind: 'date', iso } : { kind: 'bad' }
}

/* ────────────────────────────── inputs ────────────────────────────── */

export type ProcurementDecisionKind = 'approved' | 'revise' | 'rejected'

export type ProcurementDecision = { kind: ProcurementDecisionKind; /** When the call was recorded: `reviewed_at`, an instant, never a bare day. */ at: string | null }

/**
 * The call a part's line reads (2026-10-02). Its own, when the GC called that part. A row no
 * part of which was called was called whole, so its call covers every part. Once any part has a
 * call of its own, the row's call is the roll-up of its parts — one part sent back sends the row
 * back — and says nothing about a part nobody called: that part is still open. Only an approved
 * roll-up (every part the GC sees approved) reaches further, to release the order-only parts
 * with their fixture.
 */
export function partLineDecision(input: {
  /** The GC sees this part; an order-only part is never called itself. */
  onSubmittal: boolean
  own: ProcurementDecision | null
  row: ProcurementDecision | null
  /** Some part the GC sees on this row carries a call of its own. */
  rowCalledByPart: boolean
}): ProcurementDecision | null {
  if (input.onSubmittal && input.own) return input.own
  if (!input.rowCalledByPart) return input.row
  return input.row?.kind === 'approved' ? input.row : null
}

/** A submittal row as the log reads it (the newest revision's items). */
export type ProcurementItemSource = {
  tag: string
  /** "A.O. Smith BTH-199" — the submitted product, else the specified one, else the label. */
  product: string
  supplyHouse: string | null
  leadTimeDays: number | null
  decision: ProcurementDecision | null
  /** The revision has been shared (a row with no decision is then "awaiting"). */
  shared: boolean
  /** The takeoff count row the item came from (v2.4107); two rows sharing one were split from it (v2.4118). */
  sourceCountRowId?: string | null
  /** 2026-10-01 · a part of the row: its procure key, the log's line for it from revision to revision. */
  partKey?: string | null
  /** The part's place on its row, so a tag's parts read in order. */
  partOrder?: number
  /** Bought, not on the GC's submittal (trim): released with its fixture, off the GC's copies. */
  orderOnly?: boolean
  /** 2026-10-02 · the whole fixture is order only: no GC call is waited for, so the line is ready to order as it stands. */
  noGc?: boolean
  /** How many to order: the fixtures counted × how many go on one. */
  quantity?: number | null
  /** The part's own stage, when it differs from the fixture's. */
  stage?: ProcurementStage | null
  /** The submittal row the line is for, so a tap on the line opens that row (2026-10-02). */
  itemId?: string | null
  /** The takeoff's fixture name and how many it counted ("WC 1&2", 10), for the tag's heading (2026-10-02). */
  fixture?: string | null
  fixtureCount?: number | null
  /** What the takeoff priced in this part's place, when it differs. */
  pricedLabel?: string | null
  /** The price-book assembly the part came out of, so By tag can set its parts in under it (2026-10-02). */
  assembly?: string | null
  /** A part added to its row by hand (a folded carrier), not from the takeoff. */
  addedByHand?: boolean
  /** A row with no product yet (a Missing row): the line reads the plans' words (2026-10-02). */
  noProduct?: boolean
  /** 2026-10-02 · the row was approved on this earlier revision and the newest no longer holds its tag (`rowsThatStand`): released there, still to order. */
  standsOnRev?: number | null
}

/** A `bid_procurement_items` row. */
export type ProcurementRecord = {
  id: string | null
  tag: string | null
  /** 2026-10-01 · the part this line is for (its procure key); null = the tag's own line or a hand row. */
  partKey?: string | null
  label: string
  leadTimeDays: number | null
  stage: ProcurementStage | null
  orderedOn: string | null
  poRef: string
  expectedOn: string | null
  deliveredOn: string | null
  note: string
  sortOrder: number
}

export type ProcurementStatus = 'delivered' | 'ordered' | 'released' | 'sent_back' | 'awaiting' | 'not_submitted'

export const PROCUREMENT_STATUS_LABELS: Record<ProcurementStatus, string> = {
  delivered: 'Delivered',
  ordered: 'Ordered',
  released: 'Released',
  sent_back: 'Sent back',
  awaiting: 'Awaiting review',
  not_submitted: 'Not on the submittal',
}

export type ProcurementRow = {
  /** The tag, or the hand row's id. */
  key: string
  tag: string | null
  isHand: boolean
  recordId: string | null
  product: string
  supplyHouse: string | null
  stage: ProcurementStage | null
  submittal: ProcurementDecisionKind | 'open' | 'none'
  submittalAt: string | null
  releasedOn: string | null
  orderedOn: string | null
  poRef: string
  leadTimeDays: number | null
  expectedOn: string | null
  expectedSource: 'house' | 'derived' | null
  requiredOn: string | null
  /** required − expected in days; null when either is missing or the item is delivered. */
  floatDays: number | null
  /** The last safe order date for a released, unordered row with a lead time. */
  orderBy: string | null
  deliveredOn: string | null
  note: string
  status: ProcurementStatus
  late: boolean
  /** The other tags split from the same count row (v2.4118) — "counted with WC-2", so nobody orders the count twice. */
  countedWith: string[]
  /** 2026-10-01 · the part this line is for; null on a tag's own line and a hand row. */
  partKey?: string | null
  /** Bought, not on the GC's submittal: kept off the GC's copies. */
  orderOnly?: boolean
  /** Its fixture is order only: ready to order with no GC call (`releasedOn` stays null — nobody released it). */
  noGc?: boolean
  /** How many to order, when the takeoff says. */
  quantity?: number | null
  /** The submittal row behind the line; null on a hand row. */
  itemId?: string | null
  fixture?: string | null
  fixtureCount?: number | null
  pricedLabel?: string | null
  assembly?: string | null
  addedByHand?: boolean
  noProduct?: boolean
  /** The earlier revision the row stands approved on; null when the newest revision holds it. */
  standsOnRev?: number | null
}

export type ProcurementLogInput = {
  items: ReadonlyArray<ProcurementItemSource>
  records: ReadonlyArray<ProcurementRecord>
  /** Each tag's stage from the takeoff (missing = unknown). */
  tagStage: Readonly<Record<string, ProcurementStage | undefined>>
  stageDates: StageDates
}

const emptyRecord = (tag: string | null, partKey: string | null = null): ProcurementRecord => ({ id: null, tag, partKey, label: '', leadTimeDays: null, stage: null, orderedOn: null, poRef: '', expectedOn: null, deliveredOn: null, note: '', sortOrder: 0 })

function rowFrom(source: ProcurementItemSource | null, rec: ProcurementRecord, stage: ProcurementStage | null, stageDates: StageDates, countedWith: string[] = []): ProcurementRow {
  const isHand = source == null
  const decision = source?.decision ?? null
  const submittal: ProcurementRow['submittal'] = source ? (decision ? decision.kind : source.shared ? 'open' : 'none') : 'none'
  // The call's day in the company's zone: the UTC date of `at` is tomorrow after 7 PM Central.
  const calledOn = decision?.at ? calendarYmdInAppTzFromIso(decision.at) || null : null
  const releasedOn = decision?.kind === 'approved' ? calledOn : null
  const leadTimeDays = isHand ? rec.leadTimeDays : source!.leadTimeDays
  const requiredOn = stage ? stageDates[stage] ?? null : null
  let expectedOn: string | null = null
  let expectedSource: ProcurementRow['expectedSource'] = null
  if (!rec.deliveredOn) {
    if (rec.expectedOn) {
      expectedOn = rec.expectedOn
      expectedSource = 'house'
    } else if (rec.orderedOn && leadTimeDays != null) {
      expectedOn = addDays(rec.orderedOn, leadTimeDays)
      expectedSource = 'derived'
    }
  }
  const floatDays = !rec.deliveredOn && expectedOn && requiredOn ? daysBetween(expectedOn, requiredOn) : null
  const orderBy = !rec.orderedOn && !rec.deliveredOn && leadTimeDays != null && requiredOn ? addDays(requiredOn, -leadTimeDays) : null
  const status: ProcurementStatus = rec.deliveredOn
    ? 'delivered'
    : rec.orderedOn
      ? 'ordered'
      : submittal === 'approved' || source?.noGc
        ? 'released'
        : submittal === 'revise' || submittal === 'rejected'
          ? 'sent_back'
          : submittal === 'open'
            ? 'awaiting'
            : 'not_submitted'
  return {
    key: source ? (source.partKey ? `part:${source.partKey}` : source.tag) : `hand:${rec.id ?? rec.label}`,
    tag: source ? source.tag : null,
    partKey: source?.partKey ?? null,
    itemId: source?.itemId ?? null,
    fixture: source?.fixture ?? null,
    fixtureCount: source?.fixtureCount ?? null,
    pricedLabel: source?.pricedLabel ?? null,
    assembly: source?.assembly ?? null,
    addedByHand: source?.addedByHand ?? false,
    noProduct: source?.noProduct ?? false,
    standsOnRev: source?.standsOnRev ?? null,
    orderOnly: source?.orderOnly ?? false,
    noGc: source?.noGc ?? false,
    quantity: source?.quantity ?? null,
    isHand,
    recordId: rec.id,
    product: source ? source.product : rec.label,
    supplyHouse: source?.supplyHouse ?? null,
    stage,
    submittal,
    submittalAt: calledOn,
    releasedOn,
    orderedOn: rec.orderedOn,
    poRef: rec.poRef,
    leadTimeDays,
    expectedOn,
    expectedSource,
    requiredOn,
    floatDays,
    orderBy,
    deliveredOn: rec.deliveredOn,
    note: rec.note,
    status,
    late: floatDays != null && floatDays < 0,
    countedWith,
  }
}

/**
 * The log: one row per submittal tag — or, for a row with parts (2026-10-01), one per part under
 * its tag, in the row's order — in tag order, then the hand rows (in their order). A tag whose
 * own line holds dates from before it had parts keeps that line too, so nothing typed is lost.
 */
export function buildProcurementLog(input: ProcurementLogInput): ProcurementRow[] {
  const byTag = new Map<string, ProcurementRecord>()
  const byPart = new Map<string, ProcurementRecord>()
  const hand: ProcurementRecord[] = []
  for (const r of input.records) {
    if (r.partKey) byPart.set(r.partKey, r)
    else if (r.tag) byTag.set(r.tag, r)
    else hand.push(r)
  }
  const byCountRow = new Map<string, string[]>()
  for (const it of input.items) if (it.sourceCountRowId && !(byCountRow.get(it.sourceCountRowId) ?? []).includes(it.tag)) byCountRow.set(it.sourceCountRowId, [...(byCountRow.get(it.sourceCountRowId) ?? []), it.tag])
  const tagsWithParts = new Set(input.items.filter((it) => it.partKey).map((it) => it.tag))
  const sources: ProcurementItemSource[] = [...input.items]
  // A tag's line from before its parts, holding something typed: kept as the fixture's own line.
  for (const tag of tagsWithParts) {
    const rec = byTag.get(tag)
    if (rec && (rec.orderedOn || rec.poRef || rec.expectedOn || rec.deliveredOn || rec.note)) {
      const first = input.items.find((it) => it.tag === tag)!
      sources.push({ tag, product: 'the fixture, as logged before its parts', supplyHouse: null, leadTimeDays: rec.leadTimeDays, decision: first.decision, shared: first.shared, sourceCountRowId: first.sourceCountRowId ?? null, partOrder: -1, itemId: first.itemId ?? null, standsOnRev: first.standsOnRev ?? null })
    }
  }
  const tagged = sources
    .sort((a, b) => compareTags(a.tag, b.tag) || (a.partOrder ?? 0) - (b.partOrder ?? 0))
    .map((it) => {
      const rec = it.partKey ? byPart.get(it.partKey) ?? emptyRecord(it.tag, it.partKey) : byTag.get(it.tag) ?? emptyRecord(it.tag)
      const countedWith = it.sourceCountRowId ? (byCountRow.get(it.sourceCountRowId) ?? []).filter((t) => t !== it.tag).sort(compareTags) : []
      return rowFrom(it, rec, it.stage ?? input.tagStage[it.tag] ?? null, input.stageDates, countedWith)
    })
  const handRows = hand.sort((a, b) => a.sortOrder - b.sortOrder).map((r) => rowFrom(null, r, r.stage, input.stageDates))
  return [...tagged, ...handRows]
}

/** The lines the GC's copies carry: every line but the parts bought as order only (2026-10-01). */
export function gcProcurementRows(rows: ReadonlyArray<ProcurementRow>): ProcurementRow[] {
  return rows.filter((r) => !r.orderOnly)
}

export type ProcurementLens = 'to_order' | 'by_tag' | 'by_house'

export type ProcurementSection = { key: string; title: string; note: string; rows: ProcurementRow[]; /** A fixture listing two carriers (2026-10-02). */ warn?: string; /** By tag: where the order-only parts start, after the GC's. */ orderOnlyFrom?: number }

/**
 * The log grouped three ways (2026-10-01). **To order**: what to buy now (released, not ordered;
 * by house, the soonest order-by first), then what waits on the GC, then what is on order, then
 * what has landed. **By tag**: one group per tag, its lines in the row's order. **By house**: one
 * group per house, a line with no house last.
 */
export function procurementSections(rows: ReadonlyArray<ProcurementRow>, lens: ProcurementLens): ProcurementSection[] {
  const byKey = (list: ProcurementRow[], keyOf: (r: ProcurementRow) => string) => {
    const out = new Map<string, ProcurementRow[]>()
    for (const r of list) out.set(keyOf(r), [...(out.get(keyOf(r)) ?? []), r])
    return out
  }
  if (lens === 'by_tag') {
    return [...byKey([...rows], (r) => (r.isHand ? 'Added by hand' : r.tag ?? '')).entries()].map(([k, list]) => {
      // The GC's parts first, then what is ordered but not sent to the GC (2026-10-02).
      const gc = list.filter((r) => !r.orderOnly)
      const orderOnly = list.filter((r) => r.orderOnly)
      const carriers = gc.filter((r) => r.partKey && isCarrier(r.product)).length
      return { key: `tag:${k}`, title: k, note: `${tagRollUp(list)}${list.length > 0 && list.every((r) => r.noGc) ? `${tagRollUp(list) ? ' · ' : ''}order only, no GC approval` : ''}`, rows: [...gc, ...orderOnly], ...(carriers > 1 ? { warn: 'Two carriers' } : {}), ...(gc.length > 0 && orderOnly.length > 0 ? { orderOnlyFrom: gc.length } : {}) }
    })
  }
  if (lens === 'by_house') {
    const houses = [...byKey([...rows], (r) => r.supplyHouse ?? '').entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
    return houses.map(([k, list]) => ({ key: `house:${k}`, title: k || 'No house yet', note: lineCount(list), rows: list }))
  }
  const toBuy = rows.filter((r) => r.status === 'released')
  const waiting = rows.filter((r) => r.status === 'awaiting' || r.status === 'sent_back' || r.status === 'not_submitted')
  const onOrder = rows.filter((r) => r.status === 'ordered')
  const landed = rows.filter((r) => r.status === 'delivered')
  const soonest = (a: ProcurementRow, b: ProcurementRow) => (a.orderBy ?? '9999').localeCompare(b.orderBy ?? '9999') || compareTags(a.tag ?? '', b.tag ?? '')
  const out: ProcurementSection[] = []
  const houses = [...byKey(toBuy, (r) => r.supplyHouse ?? '').entries()].map(([k, list]) => [k, list.sort(soonest)] as const).sort(([a, la], [b, lb]) => soonest(la[0]!, lb[0]!) || (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
  for (const [k, list] of houses) {
    const first = list.find((r) => r.orderBy)?.orderBy ?? null
    out.push({ key: `buy:${k}`, title: k ? `Order now · ${k}` : 'Order now · no house yet', note: `${lineCount(list)}${first ? ` · the first by ${shortDate(first)}` : ''}${k ? '' : ' · set a house to order'}`, rows: list })
  }
  if (waiting.length > 0) out.push({ key: 'waiting', title: 'Waiting on the GC', note: `${lineCount(waiting)} · not ordered until they approve it`, rows: waiting })
  if (onOrder.length > 0) out.push({ key: 'on_order', title: 'On order', note: lineCount(onOrder), rows: onOrder })
  if (landed.length > 0) out.push({ key: 'landed', title: 'Delivered', note: lineCount(landed), rows: landed })
  return out
}

function lineCount(list: ReadonlyArray<ProcurementRow>): string {
  return `${list.length} line${list.length === 1 ? '' : 's'}`
}

/** A tag's heading (2026-10-02): "WC 1&2 × 10 · 4 parts · 1 ordered · 1 on site". */
export function tagRollUp(list: ReadonlyArray<ProcurementRow>): string {
  const first = list.find((r) => r.fixture)
  const parts = list.filter((r) => r.partKey).length
  const onSite = list.filter((r) => r.deliveredOn).length
  const ordered = list.filter((r) => r.orderedOn && !r.deliveredOn).length
  return [
    first?.fixture ? `${first.fixture}${first.fixtureCount != null ? ` × ${first.fixtureCount}` : ''}` : '',
    parts > 0 ? `${parts} part${parts === 1 ? '' : 's'}` : list.length > 1 ? lineCount(list) : '',
    ordered > 0 ? `${ordered} ordered` : '',
    onSite > 0 ? `${onSite} on site` : '',
  ].filter(Boolean).join(' · ')
}

export type LineStatus = { tone: 'done' | 'late' | 'ordered' | 'act' | 'back' | 'waiting' | 'none'; text: string; sub: string }

/**
 * One line's status in a phrase, where the log used to draw seven date columns (2026-10-02):
 * on site, ordered (and when it arrives, red when that is after the stage needs it), released
 * and when to order by, sent back, waiting on the GC — or nothing on a draft, which the log
 * says once at its top. The sub line carries the PO and a note for the GC.
 */
export function lineStatus(r: ProcurementRow): LineStatus {
  const extra = (bits: Array<string | false | null | undefined>) => [...bits, r.note ? `note: ${r.note}` : ''].filter(Boolean).join(' · ')
  const po = r.poRef ? `PO ${r.poRef}` : ''
  if (r.deliveredOn) return { tone: 'done', text: `✓ On site ${shortDate(r.deliveredOn)}`, sub: extra([r.orderedOn && `ordered ${shortDate(r.orderedOn)}`, po]) }
  if (r.orderedOn) {
    if (r.late && r.expectedOn && r.floatDays != null) return { tone: 'late', text: `Arrives ${shortDate(r.expectedOn)}, ${-r.floatDays} d late`, sub: extra([`ordered ${shortDate(r.orderedOn)}`, r.requiredOn && `needed ${shortDate(r.requiredOn)}`, po]) }
    return { tone: 'ordered', text: r.expectedOn ? `Ordered · arrives ${shortDate(r.expectedOn)}` : `Ordered ${shortDate(r.orderedOn)}`, sub: extra([r.expectedOn && `ordered ${shortDate(r.orderedOn)}`, po]) }
  }
  if (r.status === 'released') return { tone: 'act', text: r.orderBy ? `Order by ${shortDate(r.orderBy)}` : r.noGc ? 'Ready to order' : 'Released, not ordered', sub: extra([r.noGc ? 'no GC approval needed' : r.releasedOn && `released ${shortDate(r.releasedOn)}`, r.requiredOn && `needed ${shortDate(r.requiredOn)}`]) }
  if (r.status === 'sent_back') return { tone: 'back', text: r.submittal === 'rejected' ? 'Rejected by the GC' : 'Sent back by the GC', sub: extra([]) }
  if (r.status === 'awaiting') return { tone: 'waiting', text: 'Waiting on the GC', sub: extra([]) }
  return { tone: 'none', text: '', sub: extra([]) }
}

/**
 * The door a line offers to the window where the office records what the GC said (2026-10-02):
 * only on a line the GC's answer still holds — waiting on it, not shared yet, or sent back — and
 * only for a part the GC sees. A hand line, an order-only part, a row with no product, and a line
 * that is released, ordered or delivered get none: the row's own Their answer button is there.
 */
export type AnswerDoor = 'enter' | 'change'
export const ANSWER_DOOR_WORDS: Record<AnswerDoor, string> = { enter: 'Enter their answer…', change: 'Change their answer…' }
export function answerDoor(r: ProcurementRow): AnswerDoor | null {
  if (r.isHand || !r.itemId || r.orderOnly || r.noGc) return null
  if (!r.partKey && r.noProduct) return null
  if (r.status === 'sent_back') return 'change'
  if (r.status === 'awaiting' || r.status === 'not_submitted') return 'enter'
  return null
}

export type OrderBlockers = { noLead: string[]; noHouse: string[]; noStage: string[]; noProduct: Array<{ key: string; tag: string; itemId: string | null }> }

/**
 * What still blocks ordering (2026-10-02, BP375: 0 of 46 parts had a lead time, 18 no house,
 * 8 no stage): the line keys missing each, over the lines not yet ordered (an ordered line has
 * its house). A row with no product is its own item. Hand lines are left out: they are typed
 * on the log itself.
 */
export function orderBlockers(rows: ReadonlyArray<ProcurementRow>): OrderBlockers {
  const out: OrderBlockers = { noLead: [], noHouse: [], noStage: [], noProduct: [] }
  for (const r of rows) {
    if (r.isHand || r.orderedOn || r.deliveredOn) continue
    if (!r.partKey && (r.noProduct || r.product === '(no product)')) {
      out.noProduct.push({ key: r.key, tag: r.tag ?? '', itemId: r.itemId ?? null })
      continue
    }
    if (r.leadTimeDays == null) out.noLead.push(r.key)
    if (!r.supplyHouse) out.noHouse.push(r.key)
    if (!r.stage) out.noStage.push(r.key)
  }
  return out
}

/** One of the three facts a line can be missing before it can be ordered. */
export type BlockerKind = 'lead' | 'house' | 'stage'
export const BLOCKER_KINDS: ReadonlyArray<BlockerKind> = ['lead', 'house', 'stage']
/** "5 parts with **no stage**": the words after the count. */
export const BLOCKER_WORDS: Record<BlockerKind, string> = { lead: 'no lead time', house: 'no house', stage: 'no stage' }

/** The line keys a blocker names. */
export function blockerKeys(b: OrderBlockers, kind: BlockerKind): string[] {
  return kind === 'lead' ? b.noLead : kind === 'house' ? b.noHouse : b.noStage
}

/**
 * The log narrowed to the lines one blocker names (Wendi, 2026-10-02: "5 parts have no stage but
 * doesnt say what parts they are"). No blocker picked, or one that names nothing any more, is the
 * whole log: a fixed line leaves the short list, and the last one fixed brings every line back.
 */
export function rowsForBlocker(rows: ReadonlyArray<ProcurementRow>, b: OrderBlockers, kind: BlockerKind | null): { rows: ProcurementRow[]; only: BlockerKind | null } {
  const keys = kind ? new Set(blockerKeys(b, kind)) : null
  if (!kind || !keys || keys.size === 0) return { rows: [...rows], only: null }
  return { rows: rows.filter((r) => keys.has(r.key)), only: kind }
}

export type HouseFold = { key: string; house: string | null; rows: ProcurementRow[]; parts: number; orderOnly: number }

/**
 * Lines folded one per house (2026-10-02, To order's *Waiting on the GC*: BP375's 44 waiting
 * lines became four): the named houses A–Z, then the lines with no house yet.
 */
export function foldByHouse(rows: ReadonlyArray<ProcurementRow>): HouseFold[] {
  const by = new Map<string, ProcurementRow[]>()
  for (const r of rows) by.set(r.supplyHouse ?? '', [...(by.get(r.supplyHouse ?? '') ?? []), r])
  return [...by.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
    .map(([k, list]) => ({ key: `fold:${k}`, house: k || null, rows: list, parts: list.length, orderOnly: list.filter((r) => r.orderOnly).length }))
}

/** "22 parts · 4 order only" · "18 parts · 10 order only · pick a house to order" */
export function houseFoldNote(f: HouseFold): string {
  return [`${f.parts} part${f.parts === 1 ? '' : 's'}`, f.orderOnly > 0 ? `${f.orderOnly} order only` : '', f.house ? '' : 'pick a house to order'].filter(Boolean).join(' · ')
}

/** No line has gone to the GC yet: the log says so once instead of on every line. */
export function logIsDraft(rows: ReadonlyArray<ProcurementRow>): boolean {
  // An order-only fixture's lines never go to the GC, so they say nothing about the draft (2026-10-02).
  const sent = rows.filter((r) => !r.isHand && !r.noGc)
  return sent.length > 0 && sent.every((r) => r.submittal === 'none')
}

export type ProcurementCounts = { released: number; ordered: number; delivered: number; late: number; awaiting: number; sentBack: number }

export function procurementCounts(rows: ReadonlyArray<ProcurementRow>): ProcurementCounts {
  const c: ProcurementCounts = { released: 0, ordered: 0, delivered: 0, late: 0, awaiting: 0, sentBack: 0 }
  for (const r of rows) {
    if (r.releasedOn) c.released += 1
    if (r.orderedOn) c.ordered += 1
    if (r.deliveredOn) c.delivered += 1
    if (r.late) c.late += 1
    if (r.status === 'awaiting') c.awaiting += 1
    if (r.status === 'sent_back') c.sentBack += 1
  }
  return c
}

/** "5 released · 4 ordered · 1 delivered · 2 behind schedule" */
export function procurementHeadline(rows: ReadonlyArray<ProcurementRow>): string {
  const c = procurementCounts(rows)
  const bits = [`${c.released} released`, `${c.ordered} ordered`, `${c.delivered} delivered`]
  if (c.late > 0) bits.push(`${c.late} behind schedule`)
  if (c.sentBack > 0) bits.push(`${c.sentBack} sent back`)
  return bits.join(' · ')
}

/** "12 d" · "−14 d" · "on site" · "order by 11/03" · "" */
export function floatText(r: Pick<ProcurementRow, 'floatDays' | 'deliveredOn' | 'orderBy'>): string {
  if (r.deliveredOn) return 'on site'
  if (r.floatDays != null) return `${r.floatDays < 0 ? '−' : ''}${Math.abs(r.floatDays)} d`
  if (r.orderBy) return `order by ${shortDate(r.orderBy)}`
  return ''
}

/** "Ordered 09/24" · "Delivered 09/26" · "Released 09/22" · "Sent back 09/22" · "Awaiting review" · "Not on the submittal" */
export function statusText(r: ProcurementRow): string {
  switch (r.status) {
    case 'delivered':
      return `Delivered ${shortDate(r.deliveredOn)}`
    case 'ordered':
      return `Ordered ${shortDate(r.orderedOn)}`
    case 'released':
      return `Released ${shortDate(r.releasedOn)}`
    case 'sent_back':
      return `Sent back${r.submittalAt ? ` ${shortDate(r.submittalAt)}` : ''}`
    default:
      return PROCUREMENT_STATUS_LABELS[r.status]
  }
}

/* ────────────────────────────── the stage of a tag ────────────────────────────── */

/** "(3) HS - HAND SINK" → "HS"; "WC-1 - WATER CLOSET" → "WC-1"; "3-COMP - 3 COMPARTMENT SINK" → "3-COMP". */
export function fixtureHead(name: string | null | undefined): string {
  return (name ?? '')
    .replace(/^\s*\(\d+\)\s*/, '')
    .split(/\s+[-–—]\s+/)[0]!
    .trim()
    .toUpperCase()
}

/** Does a takeoff fixture carry this submittal tag? By the normalized tag, else by the tag's letters alone (HS ↔ HS-1). */
export function tagMatchesFixture(tag: string, fixtureName: string | null | undefined): boolean {
  const head = fixtureHead(fixtureName)
  if (!head) return false
  const t = tag.trim().toUpperCase()
  const normHead = normalizeTag(head)
  if (normHead && normHead === t) return true
  if (head === t) return true
  const letters = t.replace(/[-\s]*\d+[A-Z]?$/, '')
  if (letters.length > 0 && head === letters) return true
  // v2.4118 · a row split from "WC 1&2" is WC-1 or WC-2: the tags the name spells out.
  return tagsFromFixtureName(fixtureName).includes(t)
}

/** The stage a split puts an item in: the heaviest, the earliest on a tie; null when unsplit. */
export function stageOfWeights(w: StageWeights | null | undefined): ProcurementStage | null {
  if (!w) return null
  let best: ProcurementStage | null = null
  let bestW = 0
  for (const k of STAGE_KEYS) {
    const v = Number(w[k]) || 0
    if (v > bestW) {
      best = k
      bestW = v
    }
  }
  return best
}

/* ────────────────────────────── the job's stage dates ────────────────────────────── */

export { stageDatesFromJob, stageOfStageName } from '../../../supabase/functions/_shared/procurementStageDates.ts'

/**
 * Each tag's stage from the takeoff: the count row that carries the tag (`tagMatchesFixture`),
 * its effective split (a hand or rule split on the fixture, else the name rule), the heaviest
 * stage. Tags with no fixture stay unknown. Pure — the app and the GC's room card both use it.
 */
export function tagStagesFrom(
  countRows: ReadonlyArray<{ id: string; fixture: string | null }>,
  splits: ReadonlyArray<StageSplitRecord>,
  tags: ReadonlyArray<string>,
): Record<string, ProcurementStage | undefined> {
  const out: Record<string, ProcurementStage | undefined> = {}
  if (tags.length === 0) return out
  const lookup = indexStageSplits(splits)
  for (const tag of tags) {
    const row = countRows.find((r) => tagMatchesFixture(tag, r.fixture))
    if (!row) continue
    const split = effectiveSplit(lookup, row.id)
    const weights = split.weights ?? defaultSplitForFixture(row.fixture)?.weights ?? null
    const stage = stageOfWeights(weights)
    if (stage) out[tag] = stage
  }
  return out
}

/* ────────────────────────────── updates ────────────────────────────── */

/** The rows as an update remembers them. */
export type ProcurementSnapshotRow = {
  key: string
  tag: string | null
  product: string
  status: ProcurementStatus
  releasedOn: string | null
  orderedOn: string | null
  poRef: string
  expectedOn: string | null
  expectedSource: 'house' | 'derived' | null
  requiredOn: string | null
  floatDays: number | null
  deliveredOn: string | null
  note: string
}

export function snapshotRows(rows: ReadonlyArray<ProcurementRow>): ProcurementSnapshotRow[] {
  return rows.map((r) => ({ key: r.key, tag: r.tag, product: r.product, status: r.status, releasedOn: r.releasedOn, orderedOn: r.orderedOn, poRef: r.poRef, expectedOn: r.expectedOn, expectedSource: r.expectedSource, requiredOn: r.requiredOn, floatDays: r.floatDays, deliveredOn: r.deliveredOn, note: r.note }))
}

export type ProcurementChange = { key: string; tag: string | null; product: string; text: string }

/** What changed since the last update, in the words the sheet leads with. No previous update → every row that has anything to say. */
export function diffProcurementLog(previous: ReadonlyArray<ProcurementSnapshotRow> | null, rows: ReadonlyArray<ProcurementRow>): ProcurementChange[] {
  const prevByKey = new Map((previous ?? []).map((p) => [p.key, p] as const))
  const out: ProcurementChange[] = []
  for (const r of rows) {
    const p = prevByKey.get(r.key)
    const bits: string[] = []
    if (!p) {
      if (previous) bits.push('added to the log')
      if (r.releasedOn) bits.push(`released ${shortDate(r.releasedOn)}`)
      if (r.orderedOn) bits.push(`ordered ${shortDate(r.orderedOn)}${r.poRef ? ` (PO ${r.poRef})` : ''}`)
      if (r.expectedOn) bits.push(`expected ${shortDate(r.expectedOn)}${r.expectedSource === 'house' ? ' (house)' : ''}`)
      if (r.deliveredOn) bits.push(`delivered ${shortDate(r.deliveredOn)}`)
      if (r.status === 'sent_back') bits.push('sent back')
      if (r.late) bits.push(`${Math.abs(r.floatDays ?? 0)} days behind`)
      if (r.note) bits.push(r.note)
    } else {
      if (r.releasedOn && !p.releasedOn) bits.push(`released ${shortDate(r.releasedOn)}`)
      if (!r.releasedOn && p.releasedOn && r.status === 'sent_back') bits.push('sent back; no longer released')
      else if (r.status === 'sent_back' && p.status !== 'sent_back') bits.push('sent back')
      if (r.orderedOn && !p.orderedOn) bits.push(`ordered ${shortDate(r.orderedOn)}${r.poRef ? ` (PO ${r.poRef})` : ''}`)
      if (r.expectedOn !== p.expectedOn && !r.deliveredOn) {
        if (r.expectedOn && p.expectedOn) bits.push(`expected ${shortDate(p.expectedOn)} → ${shortDate(r.expectedOn)}${r.expectedSource === 'house' ? ' (house)' : ''}`)
        else if (r.expectedOn) bits.push(`expected ${shortDate(r.expectedOn)}${r.expectedSource === 'house' ? ' (house)' : ''}`)
      }
      if (r.deliveredOn && !p.deliveredOn) bits.push(`delivered ${shortDate(r.deliveredOn)}`)
      if (r.late && (p.floatDays == null || p.floatDays >= 0)) bits.push(`now ${Math.abs(r.floatDays ?? 0)} days behind`)
      if (r.note !== p.note && r.note) bits.push(r.note)
    }
    if (bits.length > 0) out.push({ key: r.key, tag: r.tag, product: r.product, text: bits.join('; ') })
  }
  for (const p of previous ?? []) {
    if (!rows.some((r) => r.key === p.key)) out.push({ key: p.key, tag: p.tag, product: p.product, text: 'no longer on the log' })
  }
  return out
}

/* ────────────────────────────── the sheet and the text ────────────────────────────── */

/** "Sep 18" — the sheet's date, in words the GC reads; '' for null. */
export function monthDay(iso: string | null | undefined): string {
  const d = parseIsoDate(iso)
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
}

/** "September 29, 2026" — the sheet's heading date; '' for null. */
export function longDate(iso: string | null | undefined): string {
  const d = parseIsoDate(iso)
  return d ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
}

/** The company block at the head of the sheet — the test report's settings row (v2.4122). */
export type ProcurementSheetLetterhead = {
  companyName: string
  tagline: string
  phone: string
  mailingAddress: string
  /** The plumbing logo as a data URL (a print window cannot wait on an image); null draws the name alone. */
  logoDataUrl: string | null
}

export type ProcurementUpdateInput = {
  /** "B482 Shipley Do-Nuts (San Antonio)" */
  bidLabel: string
  companyName: string
  /** 1-based number of this update. */
  updateNumber: number
  sentOn: string
  /** The update before, for "since". */
  sinceOn: string | null
  rows: ReadonlyArray<ProcurementRow>
  changes: ReadonlyArray<ProcurementChange>
  line: string
  stageDates: StageDates
  /** v2.4122 · `print` = the log as it stands (no update number, no changes marked); default `update`. */
  kind?: 'print' | 'update'
  letterhead?: ProcurementSheetLetterhead | null
  projectAddress?: string | null
  /** The GC the sheet is addressed to. */
  gcName?: string | null
  /** The estimator who prepared it — signs that it is true and current. */
  preparedBy?: string | null
  /** The GC's review-room link, and the code that opens it (`payQrSvgMarkup`); the sheet points there. */
  roomUrl?: string | null
  roomQrSvg?: string | null
}

function stageDatesText(d: StageDates): string {
  const bits = STAGE_KEYS.filter((k) => d[k]).map((k) => `${PROCUREMENT_STAGE_LABELS[k]} ${shortDate(d[k])}`)
  return bits.length ? `required dates from the stage schedule (${bits.join(' · ')})` : 'required dates not set (no stage schedule on the job yet)'
}

/** "Rough In Oct 6 · Top Out Oct 27 · Trim Set Nov 17" — the schedule line in the GC's words; '' with no dates. */
export function stageDatesWords(d: StageDates): string {
  return STAGE_KEYS.filter((k) => d[k]).map((k) => `${PROCUREMENT_STAGE_LABELS[k]} ${monthDay(d[k])}`).join(' · ')
}

export function submittalWord(r: ProcurementRow): string {
  switch (r.submittal) {
    case 'approved':
      return `Approved ${shortDate(r.submittalAt)}`
    case 'revise':
      return `Revise ${shortDate(r.submittalAt)}`
    case 'rejected':
      return `Rejected ${shortDate(r.submittalAt)}`
    case 'open':
      return 'Awaiting review'
    default:
      return r.isHand ? 'n/a' : 'Not shared'
  }
}

/** The submittal column as the GC reads it: their decision, in their words. */
export function gcSubmittalWord(r: ProcurementRow): string {
  switch (r.submittal) {
    case 'approved':
      return `Approved ${monthDay(r.submittalAt)}`
    case 'revise':
      return `Returned for revision ${monthDay(r.submittalAt)}`
    case 'rejected':
      return `Rejected ${monthDay(r.submittalAt)}`
    case 'open':
      return 'Awaiting your approval'
    default:
      return r.isHand ? '—' : 'Not yet submitted'
  }
}

/** The last day the GC's approval can land and the item still make its stage: required − lead time; null without either. */
export function approveBy(r: Pick<ProcurementRow, 'requiredOn' | 'leadTimeDays'>): string | null {
  return r.requiredOn && r.leadTimeDays != null ? addDays(r.requiredOn, -r.leadTimeDays) : null
}

/** The schedule column in the GC's words: "15 days ahead" · "14 days behind" · "delivered Sep 26" · "we order by Oct 10" · "approve by Nov 10" · "needs approval now". */
export function gcScheduleWord(r: ProcurementRow, asOf: string): string {
  if (r.deliveredOn) return `delivered ${monthDay(r.deliveredOn)}`
  if (r.floatDays != null) {
    if (r.floatDays === 0) return 'on time'
    return `${Math.abs(r.floatDays)} day${Math.abs(r.floatDays) === 1 ? '' : 's'} ${r.floatDays < 0 ? 'behind' : 'ahead'}`
  }
  if (r.status === 'awaiting' || r.status === 'sent_back') {
    const by = approveBy(r)
    if (!by) return ''
    return by <= asOf ? 'needs approval now' : `approve by ${monthDay(by)}`
  }
  if (r.orderBy) return `we order by ${monthDay(r.orderBy)}`
  return ''
}

export type ProcurementAsk = { key: string; tag: string | null; product: string; text: string }

/**
 * What we need from you — the rows waiting on the GC, each with the date it must come by:
 * a row awaiting their approval, a row they returned, and a row that lands after its stage
 * starts (the supplier's date is the fact; the question is theirs). Tag order as given.
 */
export function procurementAsks(rows: ReadonlyArray<ProcurementRow>, asOf: string): ProcurementAsk[] {
  const out: ProcurementAsk[] = []
  for (const r of rows) {
    const stage = r.stage ? PROCUREMENT_STAGE_LABELS[r.stage] : null
    const by = approveBy(r)
    const byWord = by ? (by <= asOf ? 'needs your approval now' : `needs your approval by ${monthDay(by)}`) + (stage ? ` to make ${stage}` : '') : null
    let text = ''
    if (r.late && !r.deliveredOn) {
      text = `${r.expectedSource === 'house' ? 'the supplier says' : 'expected'} ${monthDay(r.expectedOn)}, ${Math.abs(r.floatDays ?? 0)} day${Math.abs(r.floatDays ?? 0) === 1 ? '' : 's'} after ${stage ?? 'the stage'} starts`
    } else if (r.status === 'sent_back') {
      text = `returned ${monthDay(r.submittalAt)}${byWord ? `; ${byWord}` : ''}`
    } else if (r.status === 'awaiting') {
      text = `awaiting your approval${byWord ? `; ${byWord}` : ''}`
    }
    if (!text) continue
    if (r.note) text += ` — ${r.note}`
    out.push({ key: r.key, tag: r.tag, product: r.product, text })
  }
  return out
}

export type ProcurementStageGroup = { stage: ProcurementStage | null; label: string; neededOn: string | null; rows: ProcurementRow[] }

/** The rows by stage in build order, a group only where rows are; rows with no stage last under "No stage yet". */
export function groupRowsByStage(rows: ReadonlyArray<ProcurementRow>, stageDates: StageDates): ProcurementStageGroup[] {
  const out: ProcurementStageGroup[] = []
  for (const k of STAGE_KEYS) {
    const rs = rows.filter((r) => r.stage === k)
    if (rs.length) out.push({ stage: k, label: PROCUREMENT_STAGE_LABELS[k], neededOn: stageDates[k] ?? null, rows: rs })
  }
  const rest = rows.filter((r) => !r.stage)
  if (rest.length) out.push({ stage: null, label: 'No stage yet', neededOn: null, rows: rest })
  return out
}

const cell = 'padding:0.4rem 0.45rem; border-bottom:1px solid #e5e7eb; vertical-align:top; font-size:0.82rem'
const th = 'text-align:left; font-size:0.66em; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; border-bottom:1.5px solid #17191e; padding:0.3rem 0.45rem; vertical-align:bottom'
/** The sheet's seven columns. Every stage prints as its own table, so the widths are fixed here to keep the columns in line down the page. */
const SHEET_COLUMNS: ReadonlyArray<readonly [label: string, widthPct: number]> = [['Item', 32], ['Submittal', 13], ['Ordered', 13], ['Lead time', 7], ['Expected on site', 12], ['Schedule', 11], ['Notes', 12]]
const sheetCols = `<colgroup>${SHEET_COLUMNS.map(([, w]) => `<col style="width:${w}%"/>`).join('')}</colgroup>`
const sheetLabels = `<tr>${SHEET_COLUMNS.map(([label]) => `<th style="${th}">${label}</th>`).join('')}</tr>`

/**
 * The printed sheet (v2.4122): a letter to the GC. The company block and the To/Project lines
 * the submittal cover prints, the rows grouped by stage with the stage's date once, *What we
 * need from you* above the table, every cell in the GC's words, the row's own note in Notes,
 * the room's code at the foot, and the estimator's line that it is true and current. An update
 * marks its changed rows (amber, a dot) and says since when; a print says *as of* and marks nothing.
 *
 * Each stage is its own table whose header is the stage's band and the column labels, so the
 * labels stand over every stage; a browser that repeats a table's header on a page break
 * (Chromium, Firefox) prints them on every page. Safari repeats no header, so a stage after the
 * first is kept on one page where it fits and carries its labels there with it.
 */
export function buildProcurementUpdateHtml(input: ProcurementUpdateInput): string {
  const kind = input.kind ?? 'update'
  // A first update has nothing to mark: every row is new to the GC, and the subtitle says so.
  const changed = kind === 'update' && input.sinceOn ? new Map(input.changes.map((c) => [c.key, c.text] as const)) : new Map<string, string>()
  const lh = input.letterhead
  const companyName = lh?.companyName.trim() || input.companyName
  const asks = procurementAsks(input.rows, input.sentOn)
  const line = input.line.trim()
  const groups = groupRowsByStage(input.rows, input.stageDates)
  const title = kind === 'print' ? 'Procurement log' : `Procurement log — update ${input.updateNumber}`
  const subtitle = kind === 'print'
    ? `Plumbing fixtures &amp; equipment · as of ${escapeHtml(longDate(input.sentOn))}`
    : `Plumbing fixtures &amp; equipment · ${escapeHtml(longDate(input.sentOn))} · ${input.sinceOn ? `changes since ${escapeHtml(longDate(input.sinceOn))} marked <span class="dot"></span>` : 'first update'}`
  const schedule = stageDatesWords(input.stageDates)

  const rowHtml = (r: ProcurementRow) => {
    const chg = changed.get(r.key)
    const bg = chg ? ' background:#fff8e1' : ''
    // The diff repeats a new note at its end; the note already prints, so the change line drops it.
    const chgLine = chg && r.note && chg.endsWith(r.note) ? chg.slice(0, -r.note.length).replace(/;\s*$/, '') : chg
    const ordered = r.orderedOn ? `${monthDay(r.orderedOn)}${r.poRef ? ` · PO ${escapeHtml(r.poRef)}` : ''}` : r.status === 'released' ? 'not yet' : '—'
    const expected = r.expectedOn && !r.deliveredOn ? `<strong>${monthDay(r.expectedOn)}</strong>${r.expectedSource === 'house' ? ' <span style="color:#6b7280">supplier’s date</span>' : ''}` : '—'
    const sched = gcScheduleWord(r, input.sentOn)
    const notes = [r.note ? escapeHtml(r.note) : '', chgLine ? `<span style="color:#6b7280">since ${escapeHtml(monthDay(input.sinceOn))}: ${escapeHtml(chgLine)}</span>` : ''].filter(Boolean).join('<br/>')
    return `<tr>
      <td style="${cell};${bg}">${chg ? '<span class="dot"></span>' : ''}${r.tag ? `<strong>${escapeHtml(r.tag)}</strong> ` : ''}${escapeHtml(r.product)}${r.supplyHouse ? ` <span style="color:#6b7280">· ${escapeHtml(r.supplyHouse)}</span>` : ''}</td>
      <td style="${cell};${bg}">${escapeHtml(gcSubmittalWord(r))}</td>
      <td style="${cell};${bg}">${ordered}</td>
      <td style="${cell};${bg}">${escapeHtml(describeLeadTime(r.leadTimeDays) ?? '—')}</td>
      <td style="${cell};${bg}">${expected}</td>
      <td style="${cell};${bg}${r.late ? '; color:#b91c1c; font-weight:700' : ''}">${escapeHtml(sched)}</td>
      <td style="${cell};${bg}; color:#4b5563">${notes}</td>
    </tr>`
  }
  const tablesHtml = groups
    .map((g, i) => {
      const behind = g.rows.filter((r) => r.late).length
      const head = `${escapeHtml(g.label)} <span style="font-weight:400; color:#4b5563">· ${g.neededOn ? `needed on site ${escapeHtml(monthDay(g.neededOn))} · ` : ''}${g.rows.length} item${g.rows.length === 1 ? '' : 's'}${behind ? `, ${behind} behind` : ''}</span>`
      const band = `<tr><th colspan="${SHEET_COLUMNS.length}" style="text-align:left; background:#f3f4f6; font-weight:700; padding:0.4rem 0.45rem; border-bottom:1px solid #d1d5db; font-size:0.85rem">${head}</th></tr>`
      // The first stage starts under the letter's opening and may run on; a later one moves whole to the next page where it fits.
      return `<table class="stage${i > 0 ? ' keep' : ''}">${sheetCols}<thead>${band}${sheetLabels}</thead><tbody>${g.rows.map(rowHtml).join('')}</tbody></table>`
    })
    .join('')
  const emptyHtml = `<table class="stage">${sheetCols}<thead>${sheetLabels}</thead><tbody><tr><td colspan="${SHEET_COLUMNS.length}" style="${cell}; color:#6b7280">No items on the log.</td></tr></tbody></table>`

  const asksHtml = asks.length || line
    ? `<div class="ask"><b>What we need from you</b><ul>${line ? `<li>${escapeHtml(line)}</li>` : ''}${asks.map((a) => `<li><strong>${escapeHtml(a.tag ?? a.product)}</strong>${a.tag ? ` ${escapeHtml(a.product)}` : ''} — ${escapeHtml(a.text)}</li>`).join('')}</ul></div>`
    : ''
  const companyLines = lh ? [lh.tagline.trim(), [lh.phone.trim(), lh.mailingAddress.trim()].filter(Boolean).join(' · ')].filter(Boolean) : []
  const letterheadHtml = `<div class="lh">${lh?.logoDataUrl ? `<img src="${lh.logoDataUrl}" alt="${escapeHtml(companyName)}" style="height:44px"/>` : `<b style="font-size:1.1rem">${escapeHtml(companyName)}</b>`}<div class="co"><b>${escapeHtml(companyName)}</b>${companyLines.map((l) => escapeHtml(l)).join('<br/>')}</div></div>`
  const metaHtml = `<div class="meta">
    <div><b>Project</b>${escapeHtml(input.bidLabel)}${input.projectAddress?.trim() ? `<br/>${escapeHtml(input.projectAddress.trim())}` : ''}</div>
    <div><b>To</b>${escapeHtml(input.gcName?.trim() || '—')}</div>
    <div><b>Schedule you gave us</b>${schedule ? escapeHtml(schedule) : 'no stage schedule yet — needed-on-site dates to follow'}</div>
    <div><b>From</b>${escapeHtml([input.preparedBy?.trim(), companyName, lh?.phone.trim()].filter(Boolean).join(' · '))}</div>
  </div>`
  const roomHtml = input.roomUrl
    ? `<div class="room">${input.roomQrSvg ?? ''}<div>This log lives at <b>${escapeHtml(input.roomUrl)}</b> — today’s dates, the cut sheets, and a place to approve or ask. Approving a row there records your name and email.</div></div>`
    : ''
  const signHtml = `<div class="sign"><div><div class="l">Verified true and current by ${escapeHtml([input.preparedBy?.trim(), companyName].filter(Boolean).join(', '))} — signature</div></div><div><div class="l">Date</div></div></div>`

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(input.bidLabel)} — ${escapeHtml(title)}</title><style>
  body { font-family: sans-serif; margin: 0.8in; color: #17191e; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.stage { margin-bottom: 0.7rem; }
  table.keep, tr, .sign { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  td { overflow-wrap: anywhere; }
  h1 { font-size: 1.25rem; margin: 0; }
  .sub { color: #4b5563; font-size: 0.85rem; margin: 0.15rem 0 0.9rem; }
  .lh { display: flex; justify-content: space-between; align-items: flex-start; gap: 1.5rem; border-bottom: 2px solid #17191e; padding-bottom: 0.7rem; margin-bottom: 1rem; }
  .lh .co { text-align: right; font-size: 0.78rem; line-height: 1.4; color: #374151; }
  .lh .co b { display: block; font-size: 0.85rem; color: #17191e; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem 1.5rem; font-size: 0.82rem; margin: 0 0 1rem; }
  .meta b { display: block; color: #6b7280; font-weight: 600; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .ask { border: 1px solid #f59e0b; background: #fffbeb; border-radius: 6px; padding: 0.6rem 0.9rem; margin: 0 0 1rem; font-size: 0.85rem; }
  .ask b { display: block; margin-bottom: 0.25rem; }
  .ask ul { margin: 0; padding-left: 1.1rem; } .ask li { margin: 0.15rem 0; }
  .dot { display: inline-block; width: 7px; height: 7px; background: #f59e0b; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
  .foot { color: #6b7280; font-size: 0.76rem; margin-top: 0.9rem; }
  .room { display: flex; gap: 0.9rem; align-items: center; margin-top: 1rem; font-size: 0.8rem; color: #4b5563; }
  .room svg { flex: none; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem 2.5rem; margin-top: 2.6rem; font-size: 0.8rem; }
  .sign .l { border-top: 1px solid #17191e; padding-top: 0.25rem; color: #4b5563; }
  @page { size: letter landscape; margin: 0.5in; }
  @media print { body { margin: 0; } }
</style></head><body>
  ${letterheadHtml}
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">${subtitle}</p>
  ${metaHtml}
  ${asksHtml}
  ${tablesHtml || emptyHtml}
  <p class="foot">Submittal = your reviewer’s decision on our submittal. Expected = our order date plus the supplier’s lead time, or the supplier’s own date where marked. Behind = the item lands after its stage starts, on the schedule you gave us.</p>
  ${roomHtml}
  ${signHtml}
</body></html>`
}

/** The same update as plain text, for the email the estimator sends. */
export function procurementUpdateText(input: ProcurementUpdateInput): string {
  const lines: string[] = [`${input.bidLabel} — procurement log update ${input.updateNumber} (${shortDate(input.sentOn)}${input.sinceOn ? `, since ${shortDate(input.sinceOn)}` : ''})`, '']
  if (input.line.trim()) lines.push(input.line.trim(), '')
  const asks = procurementAsks(input.rows, input.sentOn)
  if (asks.length > 0) {
    lines.push('What we need from you:')
    for (const a of asks) lines.push(`• ${a.tag ?? a.product}${a.tag ? ` ${a.product}` : ''}: ${a.text}`)
    lines.push('')
  }
  if (input.changes.length > 0) {
    lines.push('Changed since the last update:')
    for (const c of input.changes) lines.push(`• ${c.tag ?? c.product}${c.tag ? ` ${c.product}` : ''}: ${c.text}`)
    lines.push('')
  }
  lines.push('Every item:')
  for (const r of input.rows) {
    const bits = [statusText(r)]
    if (r.expectedOn && !r.deliveredOn) bits.push(`expected ${shortDate(r.expectedOn)}${r.expectedSource === 'house' ? ' (house)' : ''}`)
    if (r.requiredOn) bits.push(`required ${shortDate(r.requiredOn)}`)
    const f = floatText(r)
    if (f) bits.push(r.late ? `${f} — behind` : f)
    lines.push(`• ${r.tag ? `${r.tag} ` : ''}${r.product}: ${bits.join(', ')}`)
  }
  lines.push('', stageDatesText(input.stageDates).replace(/^r/, 'R') + '.')
  return lines.join('\n')
}
