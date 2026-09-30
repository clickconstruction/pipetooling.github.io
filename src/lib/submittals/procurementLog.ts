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
 * Pure: dates are ISO `YYYY-MM-DD` strings, "today" is passed in. The reads live in
 * `./procurementLogIo.ts`; the sheet and the text of an update are built here too.
 */
import { escapeHtml } from '../bidDocuments/htmlDoc'
import { compareTags } from './buildSubmittalRows'
import { describeLeadTime } from './leadTime'
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

/* ────────────────────────────── inputs ────────────────────────────── */

export type ProcurementDecisionKind = 'approved' | 'revise' | 'rejected'

/** A submittal row as the log reads it (the newest revision's items). */
export type ProcurementItemSource = {
  tag: string
  /** "A.O. Smith BTH-199" — the submitted product, else the specified one, else the label. */
  product: string
  supplyHouse: string | null
  leadTimeDays: number | null
  decision: { kind: ProcurementDecisionKind; at: string | null } | null
  /** The revision has been shared (a row with no decision is then "awaiting"). */
  shared: boolean
  /** The takeoff count row the item came from (v2.4107); two rows sharing one were split from it (v2.4118). */
  sourceCountRowId?: string | null
}

/** A `bid_procurement_items` row. */
export type ProcurementRecord = {
  id: string | null
  tag: string | null
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
}

export type ProcurementLogInput = {
  items: ReadonlyArray<ProcurementItemSource>
  records: ReadonlyArray<ProcurementRecord>
  /** Each tag's stage from the takeoff (missing = unknown). */
  tagStage: Readonly<Record<string, ProcurementStage | undefined>>
  stageDates: StageDates
}

const emptyRecord = (tag: string | null): ProcurementRecord => ({ id: null, tag, label: '', leadTimeDays: null, stage: null, orderedOn: null, poRef: '', expectedOn: null, deliveredOn: null, note: '', sortOrder: 0 })

function rowFrom(source: ProcurementItemSource | null, rec: ProcurementRecord, stage: ProcurementStage | null, stageDates: StageDates, countedWith: string[] = []): ProcurementRow {
  const isHand = source == null
  const decision = source?.decision ?? null
  const submittal: ProcurementRow['submittal'] = source ? (decision ? decision.kind : source.shared ? 'open' : 'none') : 'none'
  const releasedOn = decision?.kind === 'approved' && decision.at ? decision.at.slice(0, 10) : null
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
      : submittal === 'approved'
        ? 'released'
        : submittal === 'revise' || submittal === 'rejected'
          ? 'sent_back'
          : submittal === 'open'
            ? 'awaiting'
            : 'not_submitted'
  return {
    key: source ? source.tag : `hand:${rec.id ?? rec.label}`,
    tag: source ? source.tag : null,
    isHand,
    recordId: rec.id,
    product: source ? source.product : rec.label,
    supplyHouse: source?.supplyHouse ?? null,
    stage,
    submittal,
    submittalAt: decision?.at ? decision.at.slice(0, 10) : null,
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

/** The log: one row per submittal tag (in tag order), then the hand rows (in their order). */
export function buildProcurementLog(input: ProcurementLogInput): ProcurementRow[] {
  const byTag = new Map<string, ProcurementRecord>()
  const hand: ProcurementRecord[] = []
  for (const r of input.records) {
    if (r.tag) byTag.set(r.tag, r)
    else hand.push(r)
  }
  const byCountRow = new Map<string, string[]>()
  for (const it of input.items) if (it.sourceCountRowId) byCountRow.set(it.sourceCountRowId, [...(byCountRow.get(it.sourceCountRowId) ?? []), it.tag])
  const tagged = [...input.items]
    .sort((a, b) => compareTags(a.tag, b.tag))
    .map((it) => rowFrom(it, byTag.get(it.tag) ?? emptyRecord(it.tag), input.tagStage[it.tag] ?? null, input.stageDates, it.sourceCountRowId ? (byCountRow.get(it.sourceCountRowId) ?? []).filter((t) => t !== it.tag).sort(compareTags) : []))
  const handRows = hand.sort((a, b) => a.sortOrder - b.sortOrder).map((r) => rowFrom(null, r, r.stage, input.stageDates))
  return [...tagged, ...handRows]
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
const th = 'text-align:left; font-size:0.66em; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; border-bottom:1.5px solid #17191e; padding:0.3rem 0.45rem; white-space:nowrap'

/**
 * The printed sheet (v2.4122): a letter to the GC. The company block and the To/Project lines
 * the submittal cover prints, the rows grouped by stage with the stage's date once, *What we
 * need from you* above the table, every cell in the GC's words, the row's own note in Notes,
 * the room's code at the foot, and the estimator's line that it is true and current. An update
 * marks its changed rows (amber, a dot) and says since when; a print says *as of* and marks nothing.
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
      <td style="${cell};${bg}; white-space:nowrap">${ordered}</td>
      <td style="${cell};${bg}; white-space:nowrap">${escapeHtml(describeLeadTime(r.leadTimeDays) ?? '—')}</td>
      <td style="${cell};${bg}; white-space:nowrap">${expected}</td>
      <td style="${cell};${bg}; white-space:nowrap${r.late ? '; color:#b91c1c; font-weight:700' : ''}">${escapeHtml(sched)}</td>
      <td style="${cell};${bg}; color:#4b5563">${notes}</td>
    </tr>`
  }
  const bodyHtml = groups
    .map((g) => {
      const behind = g.rows.filter((r) => r.late).length
      const head = `${escapeHtml(g.label)} <span style="font-weight:400; color:#4b5563">· ${g.neededOn ? `needed on site ${escapeHtml(monthDay(g.neededOn))} · ` : ''}${g.rows.length} item${g.rows.length === 1 ? '' : 's'}${behind ? `, ${behind} behind` : ''}</span>`
      return `<tr><td colspan="7" style="background:#f3f4f6; font-weight:700; padding:0.4rem 0.45rem; border-bottom:1px solid #d1d5db; font-size:0.85rem">${head}</td></tr>${g.rows.map(rowHtml).join('')}`
    })
    .join('')

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
  table { width: 100%; border-collapse: collapse; }
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
  <table>
    <thead><tr><th style="${th}">Item</th><th style="${th}">Submittal</th><th style="${th}">Ordered</th><th style="${th}">Lead time</th><th style="${th}">Expected on site</th><th style="${th}">Schedule</th><th style="${th}">Notes</th></tr></thead>
    <tbody>${bodyHtml || `<tr><td colspan="7" style="${cell}; color:#6b7280">No items on the log.</td></tr>`}</tbody>
  </table>
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
