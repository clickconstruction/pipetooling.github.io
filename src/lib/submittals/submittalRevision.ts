/**
 * The Submittals tab's read/write shapes (Submittals stage 2b): the stored
 * revision and item rows ↔ the row-building kernel's inputs, the six tiles,
 * the sheet page lists, and the revision chip's words. Pure; the tab does the
 * fetching and writing.
 */
import type { Database } from '../../types/database'
import type { PreviousItem, SubmittalRowDraft } from './buildSubmittalRows'
import type { ProductStatus, ReasonKind } from './productStatus'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

export type SubmittalRevisionRow = Database['public']['Tables']['bid_submittals']['Row']
export type SubmittalItemRow = Database['public']['Tables']['bid_submittal_items']['Row']
export type SubmittalItemInsert = Database['public']['Tables']['bid_submittal_items']['Insert']

/** The private bucket: <bid_id>/<submittal_id>/<index>.pdf for vendor files, package-rev<N>.pdf for renders. */
export const SUBMITTALS_BUCKET = 'bid-submittals'

export type RevisionStatus = 'draft' | 'shared' | 'reviewed' | 'superseded'
export type ReviewDecision = 'approved' | 'revise' | 'rejected'

/** One vendor PDF dropped on a revision, as stored in `bid_submittals.source_files`. */
export type SourceFile = {
  /** Bucket path: <bid_id>/<submittal_id>/<index>.pdf */
  path: string
  houseId: string | null
  houseName: string | null
  /** The file's own name, for the strip. */
  name: string
  pages: number
  /** Set once "Done with this file" let the unused pages go (stage 3). */
  trimmedAt: string | null
}

const STATUSES: ReadonlySet<string> = new Set(['as_specified', 'superseded', 'equal', 'alternate', 'design_change', 'missing', 'accessory'])
const REASONS: ReadonlySet<string> = new Set(['lead_time', 'discontinued', 'in_stock', 'equal', 'cost', 'other'])
const DECISIONS: ReadonlySet<string> = new Set(['approved', 'revise', 'rejected'])

export function asStatus(v: string | null | undefined): ProductStatus {
  return v && STATUSES.has(v) ? (v as ProductStatus) : 'alternate'
}
export function asReason(v: string | null | undefined): ReasonKind | null {
  return v && REASONS.has(v) ? (v as ReasonKind) : null
}
export function asDecision(v: string | null | undefined): ReviewDecision | null {
  return v && DECISIONS.has(v) ? (v as ReviewDecision) : null
}

/** The jsonb column → typed files; anything malformed is dropped rather than trusted. */
export function parseSourceFiles(json: unknown): SourceFile[] {
  if (!Array.isArray(json)) return []
  const out: SourceFile[] = []
  for (const raw of json) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    if (typeof r.path !== 'string' || !r.path) continue
    out.push({
      path: r.path,
      houseId: typeof r.house_id === 'string' ? r.house_id : null,
      houseName: typeof r.house_name === 'string' ? r.house_name : null,
      name: typeof r.name === 'string' && r.name ? r.name : r.path.split('/').pop() ?? 'file.pdf',
      pages: typeof r.pages === 'number' && Number.isFinite(r.pages) && r.pages >= 0 ? Math.floor(r.pages) : 0,
      trimmedAt: typeof r.trimmed_at === 'string' ? r.trimmed_at : null,
    })
  }
  return out
}

/** Typed files → the jsonb column. */
export function serializeSourceFiles(files: ReadonlyArray<SourceFile>): Array<Record<string, unknown>> {
  return files.map((f) => ({ path: f.path, house_id: f.houseId, house_name: f.houseName, name: f.name, pages: f.pages, trimmed_at: f.trimmedAt }))
}

/** A stored item as the row kernel's "previous revision" input. */
export function itemToPrevious(item: SubmittalItemRow): PreviousItem {
  return {
    id: item.id,
    tag: item.tag,
    submittedModel: item.submitted_model,
    submittedLabel: item.submitted_label,
    status: asStatus(item.status),
    reasonKind: asReason(item.reason_kind),
    reasonNote: item.reason_note,
    leadTimeDays: item.lead_time_days,
    sheetFile: item.sheet_file,
    sheetPages: [...(item.sheet_pages ?? [])],
    reviewDecision: asDecision(item.review_decision),
    reviewNote: item.review_note,
  }
}

/** A built row as the insert for `bid_submittal_items`. */
export function draftToItemInsert(draft: SubmittalRowDraft, submittalId: string): SubmittalItemInsert {
  return {
    submittal_id: submittalId,
    tag: draft.tag,
    sequence_order: draft.sequenceOrder,
    specified_manufacturer: draft.specifiedManufacturer,
    specified_model: draft.specifiedModel,
    specified_description: draft.specifiedDescription,
    submitted_manufacturer: draft.submittedManufacturer,
    submitted_model: draft.submittedModel,
    submitted_label: draft.submittedLabel,
    supply_house_id: draft.supplyHouseId,
    source_quote_line_id: draft.sourceQuoteLineId,
    status: draft.status,
    reason_kind: draft.reasonKind,
    reason_note: draft.reasonNote,
    lead_time_days: draft.leadTimeDays,
    sheet_file: draft.sheetFile,
    sheet_pages: draft.sheetPages,
    sheet_source: draft.sheetPages.length > 0 ? 'estimator' : null,
    carried_from_item_id: draft.carriedFromItemId,
  }
}

/** A row wants a cut sheet unless nobody quoted it. */
export function needsSheet(item: Pick<SubmittalItemRow, 'status' | 'sheet_pages'>): boolean {
  return asStatus(item.status) !== 'missing' && (item.sheet_pages ?? []).length === 0
}

export type RevisionTiles = {
  rows: number
  tagged: number
  accessories: number
  asSpecified: number
  superseded: number
  equal: number
  alternates: number
  alternatesWithoutReason: number
  designChanges: number
  designChangesWithoutReason: number
  missing: number
  sheetsIn: number
  sheetsWanted: number
  sheetsNeeded: number
}

/** The six tiles at the top of the tab, from the revision's items. */
export function revisionTiles(items: ReadonlyArray<Pick<SubmittalItemRow, 'tag' | 'status' | 'reason_kind' | 'sheet_pages'>>): RevisionTiles {
  const t: RevisionTiles = { rows: items.length, tagged: 0, accessories: 0, asSpecified: 0, superseded: 0, equal: 0, alternates: 0, alternatesWithoutReason: 0, designChanges: 0, designChangesWithoutReason: 0, missing: 0, sheetsIn: 0, sheetsWanted: 0, sheetsNeeded: 0 }
  for (const it of items) {
    const status = asStatus(it.status)
    if (it.tag.trim() === '') t.accessories += 1
    else t.tagged += 1
    const reason = asReason(it.reason_kind)
    if (status === 'as_specified') t.asSpecified += 1
    else if (status === 'superseded') t.superseded += 1
    else if (status === 'equal') t.equal += 1
    else if (status === 'alternate') {
      t.alternates += 1
      if (reason === null) t.alternatesWithoutReason += 1
    } else if (status === 'design_change') {
      t.designChanges += 1
      if (reason === null) t.designChangesWithoutReason += 1
    } else if (status === 'missing') t.missing += 1
    if (status !== 'missing') {
      t.sheetsWanted += 1
      if ((it.sheet_pages ?? []).length > 0) t.sheetsIn += 1
      else t.sheetsNeeded += 1
    }
  }
  return t
}

/** "1-2, 5" / "3–4" / "7" → [1, 2, 5]; junk ignored; bounded by pageCount when given. */
export function parsePageRange(text: string, pageCount?: number): number[] {
  const out = new Set<number>()
  for (const part of text.split(/[,\s]+/)) {
    if (!part) continue
    const m = /^(\d+)\s*[-–—]\s*(\d+)$/.exec(part)
    if (m) {
      let a = Number(m[1])
      let b = Number(m[2])
      if (a > b) [a, b] = [b, a]
      for (let p = a; p <= b && p - a < 500; p++) out.add(p)
      continue
    }
    if (/^\d+$/.test(part)) out.add(Number(part))
  }
  return [...out].filter((p) => p >= 1 && (pageCount == null || p <= pageCount)).sort((a, b) => a - b)
}

/** [1, 2, 3, 5] → "p.1–3, 5"; [] → "". */
export function formatPages(pages: ReadonlyArray<number>): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b)
  if (sorted.length === 0) return ''
  const runs: string[] = []
  let start = sorted[0] ?? 0
  let prev = start
  for (const p of sorted.slice(1)) {
    if (p === prev + 1) {
      prev = p
      continue
    }
    runs.push(start === prev ? `${start}` : `${start}–${prev}`)
    start = p
    prev = p
  }
  runs.push(start === prev ? `${start}` : `${start}–${prev}`)
  return `p.${runs.join(', ')}`
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ })
}

export const REVISION_STATUS_LABELS: Record<RevisionStatus, string> = {
  draft: 'draft',
  shared: 'shared',
  reviewed: 'reviewed',
  superseded: 'superseded',
}

export function asRevisionStatus(v: string | null | undefined): RevisionStatus {
  return v === 'shared' || v === 'reviewed' || v === 'superseded' ? v : 'draft'
}

/** "Rev 3 · draft · Sep 15" (shared revisions date their share, drafts their creation). */
export function describeRevisionChip(rev: Pick<SubmittalRevisionRow, 'rev_number' | 'status' | 'created_at' | 'shared_at'>): string {
  const status = asRevisionStatus(rev.status)
  const when = formatShortDate(status === 'draft' ? rev.created_at : rev.shared_at ?? rev.created_at)
  return [`Rev ${rev.rev_number}`, REVISION_STATUS_LABELS[status], when].filter(Boolean).join(' · ')
}

/**
 * The header line under the title: "22 rows · 6 as specified · 1 superseded
 * · 8 alternates · 3 without a reason · 1 design change · 1 missing · 4
 * accessories · 14 of 22 sheets in".
 */
export function describeRevision(t: RevisionTiles): string {
  const parts: string[] = [`${t.rows} row${t.rows === 1 ? '' : 's'}`]
  if (t.asSpecified > 0) parts.push(`${t.asSpecified} as specified`)
  if (t.superseded > 0) parts.push(`${t.superseded} superseded`)
  if (t.equal > 0) parts.push(`${t.equal} equal`)
  if (t.alternates > 0) {
    parts.push(`${t.alternates} alternate${t.alternates === 1 ? '' : 's'}`)
    if (t.alternatesWithoutReason > 0) parts.push(`${t.alternatesWithoutReason} without a reason`)
  }
  if (t.designChanges > 0) parts.push(`${t.designChanges} design change${t.designChanges === 1 ? '' : 's'}`)
  if (t.missing > 0) parts.push(`${t.missing} missing`)
  if (t.accessories > 0) parts.push(`${t.accessories} accessor${t.accessories === 1 ? 'y' : 'ies'}`)
  if (t.sheetsWanted > 0) parts.push(`${t.sheetsIn} of ${t.sheetsWanted} sheets in`)
  return parts.join(' · ')
}
