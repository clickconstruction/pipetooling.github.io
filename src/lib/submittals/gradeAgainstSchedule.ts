/**
 * Grade the takeoff's rows against the plans' schedule (punch list #17's last code residual,
 * v2.4107). A row built from the takeoff reads **Proposed**: there was no schedule to compare it
 * to. When the schedule arrives later — typed, pasted, or read by the robot — this plans the
 * comparison for each Proposed row whose tag the schedule names: the specified product lands
 * on the row and its status becomes what `deriveProductStatus` says (As specified, Alternate),
 * the same rule the picks' rows get. A row the schedule does not name stays Proposed and is
 * listed. Nothing the estimator typed on a row is touched: parts, house, lead time, reason,
 * sheets. Pure; the tab writes it.
 */
import type { SpecifiedInput } from './buildSubmittalRows'
import { splitPartLabel, type SubmittalPartRow } from './itemParts'
import { deriveProductStatus, type ProductStatus } from './productStatus'
import { asStatus, type SubmittalItemRow } from './submittalRevision'
import { rowSplitTags } from './takeoffCandidates'

export type GradePlanRow = {
  itemId: string
  tag: string
  /** The schedule's tag the row was matched on ("WC-1" for a "WC-1, WC-2" row). */
  scheduleTag: string
  /** What the plans named, as the row will carry it. */
  specified: { manufacturer: string | null; model: string | null; description: string | null }
  /** What the row reads today: its parts the GC sees, else its product. */
  product: string
  from: ProductStatus
  to: ProductStatus
  /** The model is the specified one plus a letter or two: the estimator should look. */
  near: boolean
}
export type GradeSkip = { itemId: string; tag: string; why: 'not_on_schedule' | 'two_tags_differ' }
export type GradePlan = { rows: GradePlanRow[]; skipped: GradeSkip[] }

/** "WC-1" · "wc 1" · "WC1" read as one tag. */
export const normalizeTag = (tag: string): string => tag.toUpperCase().replace(/[^A-Z0-9]/g, '')

const hasSpec = (s: SpecifiedInput) => !!(s.manufacturer?.trim() || s.model?.trim())
const specKey = (s: SpecifiedInput) => `${(s.manufacturer ?? '').trim().toUpperCase()}|${(s.model ?? '').trim().toUpperCase()}`

/** What a row submits, for the comparison: the labels of the parts the GC sees, else the row's own product. */
export function rowProductWords(it: Pick<SubmittalItemRow, 'submitted_manufacturer' | 'submitted_model' | 'submitted_label'>, parts: ReadonlyArray<Pick<SubmittalPartRow, 'on_submittal' | 'label'>> = []): string {
  const gc = parts.filter((p) => p.on_submittal).map((p) => p.label.trim()).filter(Boolean)
  if (gc.length > 0) return gc.join(' + ')
  return [it.submitted_manufacturer, it.submitted_model].filter(Boolean).join(' ') || (it.submitted_label ?? '').trim()
}

/**
 * The rows the schedule can grade: every Proposed row, and every Missing row from the takeoff
 * that has no specified product yet (it takes the plans' product and stays Missing). The tag
 * on the schedule is the row's own, or any one of a split row's tags; two tags naming two
 * different products are left for the estimator.
 */
export function planScheduleGrade(items: ReadonlyArray<SubmittalItemRow>, specified: ReadonlyArray<SpecifiedInput>, partsByItem: ReadonlyMap<string, ReadonlyArray<SubmittalPartRow>> = new Map()): GradePlan {
  const byTag = new Map<string, SpecifiedInput>()
  for (const s of specified) {
    const k = normalizeTag(s.tag)
    if (k && !byTag.has(k)) byTag.set(k, s)
  }
  const rows: GradePlanRow[] = []
  const skipped: GradeSkip[] = []
  for (const it of items) {
    const status = asStatus(it.status)
    const hasSpecified = !!((it.specified_manufacturer ?? '').trim() || (it.specified_model ?? '').trim())
    const gradable = status === 'proposed' || (status === 'missing' && !!it.source_count_row_id && !hasSpecified)
    if (!gradable) continue
    const tags = [it.tag.trim(), ...rowSplitTags(it.tag)].filter(Boolean)
    const found = tags.map((t) => byTag.get(normalizeTag(t))).filter((s): s is SpecifiedInput => !!s)
    if (found.length === 0) {
      skipped.push({ itemId: it.id, tag: it.tag.trim() || it.specified_description || 'a row', why: 'not_on_schedule' })
      continue
    }
    if (new Set(found.filter(hasSpec).map(specKey)).size > 1) {
      skipped.push({ itemId: it.id, tag: it.tag.trim(), why: 'two_tags_differ' })
      continue
    }
    const s = found.find(hasSpec) ?? found[0]!
    const product = rowProductWords(it, partsByItem.get(it.id) ?? [])
    const d = deriveProductStatus({ specified: { manufacturer: s.manufacturer, model: s.model }, submitted: product ? { manufacturer: null, model: null, label: product } : null })
    // A schedule line with no product named leaves the row as it was: there is nothing to compare to.
    const to: ProductStatus = hasSpec(s) ? (product ? d.status : 'missing') : status
    rows.push({ itemId: it.id, tag: it.tag.trim(), scheduleTag: s.tag.trim(), specified: { manufacturer: s.manufacturer?.trim() || null, model: s.model?.trim() || null, description: s.description?.trim() || null }, product, from: status, to, near: d.near && to === 'as_specified' })
  }
  return { rows, skipped }
}

/** The patch a graded row takes: the plans' product and the status, nothing else. */
export function gradePatch(r: GradePlanRow): { specified_manufacturer: string | null; specified_model: string | null; specified_description: string | null; status: ProductStatus } {
  return { specified_manufacturer: r.specified.manufacturer, specified_model: r.specified.model, specified_description: r.specified.description, status: r.to }
}

/** "3 as specified · 2 alternates, say why · 1 still missing" */
export function gradeSummary(rows: ReadonlyArray<GradePlanRow>): string {
  const n = (st: ProductStatus) => rows.filter((r) => r.to === st).length
  const bits = [
    n('as_specified') > 0 ? `${n('as_specified')} as specified${rows.some((r) => r.near) ? ` (${rows.filter((r) => r.near).length} to check)` : ''}` : '',
    n('alternate') > 0 ? `${n('alternate')} alternate${n('alternate') === 1 ? '' : 's'}, say why` : '',
    n('missing') > 0 ? `${n('missing')} still missing` : '',
    n('proposed') > 0 ? `${n('proposed')} still proposed` : '',
  ].filter(Boolean)
  return bits.join(' · ')
}

/** The short form of what a row reads, for the plan's lines. */
export const productHead = (product: string): string => product.split(' + ').map((l) => splitPartLabel(l).head).join(' + ')
