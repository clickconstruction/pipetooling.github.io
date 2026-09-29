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
  /** The takeoff count row the item came from (v2.4107); two rows sharing one were split from it (v2.4114). */
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
  /** The other tags split from the same count row (v2.4114) — "counted with WC-2", so nobody orders the count twice. */
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
  // v2.4114 · a row split from "WC 1&2" is WC-1 or WC-2: the tags the name spells out.
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
}

function stageDatesText(d: StageDates): string {
  const bits = STAGE_KEYS.filter((k) => d[k]).map((k) => `${PROCUREMENT_STAGE_LABELS[k]} ${shortDate(d[k])}`)
  return bits.length ? `required dates from the stage schedule (${bits.join(' · ')})` : 'required dates not set (no stage schedule on the job yet)'
}

const cell = 'padding:0.35rem 0.45rem; border-bottom:1px solid #e5e7eb; vertical-align:top; font-size:0.85rem'
const th = 'text-align:left; font-size:0.7em; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; border-bottom:1.5px solid #17191e; padding:0.3rem 0.45rem; white-space:nowrap'

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

/** The printed update: changed rows first, then the rest; the one line under the title. */
export function buildProcurementUpdateHtml(input: ProcurementUpdateInput): string {
  const changed = new Map(input.changes.map((c) => [c.key, c.text] as const))
  const ordered = [...input.rows].sort((a, b) => Number(changed.has(b.key)) - Number(changed.has(a.key)))
  const rowsHtml = ordered
    .map((r) => {
      const chg = changed.get(r.key)
      const bg = chg ? ' background:#fff8e1' : ''
      // Two lines per item: the tag and its dates, then the product on its own line across the
      // sheet — the product is always the longest thing on the row and wrapped the table otherwise.
      const top = `${cell}; border-bottom:none; padding-bottom:0.1rem`
      return `<tr>
        <td style="${top};${bg}; white-space:nowrap"><strong>${escapeHtml(r.tag ?? '—')}</strong></td>
        <td style="${top};${bg}; white-space:nowrap">${escapeHtml(submittalWord(r))}</td>
        <td style="${top};${bg}">${escapeHtml(shortDate(r.releasedOn) || '—')}</td>
        <td style="${top};${bg}">${escapeHtml(shortDate(r.orderedOn) || '—')}</td>
        <td style="${top};${bg}">${escapeHtml(r.poRef)}</td>
        <td style="${top};${bg}; white-space:nowrap">${escapeHtml(describeLeadTime(r.leadTimeDays) ?? '')}</td>
        <td style="${top};${bg}; white-space:nowrap">${r.expectedOn ? `<strong>${escapeHtml(shortDate(r.expectedOn))}</strong>${r.expectedSource === 'house' ? ' <span style="color:#6b7280">(house)</span>' : ''}` : '—'}</td>
        <td style="${top};${bg}">${escapeHtml(shortDate(r.requiredOn) || '—')}</td>
        <td style="${top};${bg}; white-space:nowrap${r.late ? '; color:#b91c1c; font-weight:700' : ''}">${escapeHtml(floatText(r))}</td>
        <td style="${top};${bg}; color:#4b5563">${escapeHtml(chg ?? '')}</td>
      </tr>
      <tr>
        <td colspan="10" style="${cell};${bg}; padding-top:0; padding-left:1.4rem; color:#4b5563; font-size:0.8rem">${escapeHtml(r.product)}${r.supplyHouse ? ` <span style="color:#9ca3af">· ${escapeHtml(r.supplyHouse)}</span>` : ''}</td>
      </tr>`
    })
    .join('')
  const since = input.sinceOn ? `since ${shortDate(input.sinceOn)}` : 'first update'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(input.bidLabel)} — Procurement log update</title><style>
  body { font-family: sans-serif; margin: 0.8in; color: #17191e; }
  table { width: 100%; border-collapse: collapse; }
  h1 { font-size: 1.25rem; margin: 0; }
  .sub { color: #6b7280; font-size: 0.85rem; margin: 0.15rem 0 0.9rem; }
  .line { margin: 0 0 0.9rem; font-size: 0.95rem; }
  .foot { color: #6b7280; font-size: 0.78rem; margin-top: 0.9rem; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${escapeHtml(input.bidLabel)} — Procurement log update</h1>
  <p class="sub">${escapeHtml(input.companyName)} · update ${input.updateNumber} · ${escapeHtml(shortDate(input.sentOn))} · ${escapeHtml(since)} · ${escapeHtml(stageDatesText(input.stageDates))}</p>
  ${input.line.trim() ? `<p class="line">${escapeHtml(input.line.trim())}</p>` : ''}
  <table>
    <thead><tr><th style="${th}">Tag · product</th><th style="${th}">Submittal</th><th style="${th}">Released</th><th style="${th}">Ordered</th><th style="${th}">PO</th><th style="${th}">Lead</th><th style="${th}">Expected</th><th style="${th}">Required</th><th style="${th}">Float</th><th style="${th}">${escapeHtml(input.sinceOn ? `Since ${shortDate(input.sinceOn)}` : 'Notes')}</th></tr></thead>
    <tbody>${rowsHtml || `<tr><td colspan="10" style="${cell}; color:#6b7280">No items on the log.</td></tr>`}</tbody>
  </table>
  <p class="foot">Changed rows first. Released = the reviewer's approval in the submittal room. Expected = order date + lead time unless the supply house gave a date. Required = the start of the stage the item belongs to on the schedule we were given; a negative float means the item lands after its stage starts.</p>
</body></html>`
}

/** The same update as plain text, for the email the estimator sends. */
export function procurementUpdateText(input: ProcurementUpdateInput): string {
  const lines: string[] = [`${input.bidLabel} — procurement log update ${input.updateNumber} (${shortDate(input.sentOn)}${input.sinceOn ? `, since ${shortDate(input.sinceOn)}` : ''})`, '']
  if (input.line.trim()) lines.push(input.line.trim(), '')
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
