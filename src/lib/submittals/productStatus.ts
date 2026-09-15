/**
 * Product status (Submittals 1a — specified vs. submitted).
 *
 * Each submittal row pairs what the plan specified (from the fixture
 * schedule, see ./parseFixtureSchedule.ts) with what the supply house quoted.
 * This derives the status the reviewer sees — "As specified", "Alternate",
 * "Missing", … — from the two model numbers alone, lets a human override it
 * ("Superseded", "Equal", "Design change"), says which statuses need a stated
 * reason, and rolls the rows up into the one-line summary on the package.
 *
 * Model comparison ignores case, punctuation and anything from `#` on (TOTO's
 * `#01` is the finish, not the unit). A submitted model that is the specified
 * one plus a one- or two-letter suffix (B74-C vs B74-CH) counts as the same
 * unit but is flagged `near` so the reviewer confirms it. The manufacturer
 * never decides on its own — the model does.
 */

export type ProductStatus = 'as_specified' | 'superseded' | 'equal' | 'alternate' | 'design_change' | 'missing' | 'accessory'
export type StatusOverride = 'superseded' | 'equal' | 'design_change' | null
export type ReasonKind = 'lead_time' | 'discontinued' | 'in_stock' | 'equal' | 'cost' | 'other'

export type SpecifiedProduct = { manufacturer: string | null; model: string | null }
/** `label` is the quote line's text when make/model were not parsed. */
export type SubmittedProduct = { manufacturer: string | null; model: string | null; label: string | null }

export const STATUS_LABELS: Record<ProductStatus, string> = {
  as_specified: 'As specified',
  superseded: 'Superseded',
  equal: 'Equal',
  alternate: 'Alternate',
  design_change: 'Design change',
  missing: 'Missing',
  accessory: 'Accessory',
}

export const REASON_LABELS: Record<ReasonKind, string> = {
  lead_time: 'Lead time',
  discontinued: 'Discontinued',
  in_stock: 'In stock',
  equal: 'Equal',
  cost: 'Cost',
  other: 'Other',
}

/** Upper-case, everything from '#' on dropped (finish/color), non-alphanumerics dropped; '' when null. */
export function normalizeModel(model: string | null | undefined): string {
  if (!model) return ''
  const hash = model.indexOf('#')
  const base = hash >= 0 ? model.slice(0, hash) : model
  return base.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Normalized models equal, or one is the other plus a 1–2 letter suffix (B74C vs B74CH). */
export function sameUnitNear(a: string, b: string): boolean {
  const na = normalizeModel(a)
  const nb = normalizeModel(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na]
  const extra = long.length - short.length
  if (extra < 1 || extra > 2 || short.length < 3) return false
  return long.startsWith(short) && /^[A-Z]{1,2}$/.test(long.slice(short.length))
}

function hasProduct(p: { manufacturer: string | null; model: string | null; label?: string | null } | null | undefined): boolean {
  if (!p) return false
  return Boolean((p.manufacturer ?? '').trim() || (p.model ?? '').trim() || (p.label ?? '').trim())
}

/** The model-shaped tokens of an unparsed quote line ("TOTO CT708UVG#01 WALL HUNG" → CT708UVG#01). */
function labelTokens(label: string | null): string[] {
  if (!label) return []
  return label.split(/\s+/).filter((t) => /\d/.test(t) && /[A-Za-z]/.test(t) && t.length >= 3)
}

/**
 * no specified & submitted → accessory; specified & no submitted → missing;
 * an override wins when both exist; equal normalized models → as_specified;
 * sameUnitNear → as_specified with near=true; otherwise alternate.
 */
export function deriveProductStatus(input: {
  specified: SpecifiedProduct | null
  submitted: SubmittedProduct | null
  override?: StatusOverride
}): { status: ProductStatus; near: boolean } {
  const specified = hasProduct(input.specified) ? input.specified : null
  const submitted = hasProduct(input.submitted) ? input.submitted : null
  if (!specified && !submitted) return { status: 'missing', near: false }
  if (!specified) return { status: 'accessory', near: false }
  if (!submitted) return { status: 'missing', near: false }
  if (input.override) return { status: input.override, near: false }

  const spec = normalizeModel(specified.model)
  if (!spec) return { status: 'alternate', near: false }

  const candidates = submitted.model ? [submitted.model] : labelTokens(submitted.label)
  if (candidates.some((c) => normalizeModel(c) === spec)) return { status: 'as_specified', near: false }
  if (candidates.some((c) => sameUnitNear(c, specified.model ?? ''))) return { status: 'as_specified', near: true }
  return { status: 'alternate', near: false }
}

/** Alternates and design changes must say why. */
export function needsReason(status: ProductStatus): boolean {
  return status === 'alternate' || status === 'design_change'
}

export type StatusCounts = {
  total: number
  byStatus: Record<ProductStatus, number>
  alternatesWithoutReason: number
  designChangesWithoutReason: number
}

export function statusCounts(rows: ReadonlyArray<{ status: ProductStatus; reasonKind: ReasonKind | null }>): StatusCounts {
  const byStatus: Record<ProductStatus, number> = {
    as_specified: 0,
    superseded: 0,
    equal: 0,
    alternate: 0,
    design_change: 0,
    missing: 0,
    accessory: 0,
  }
  let alternatesWithoutReason = 0
  let designChangesWithoutReason = 0
  for (const row of rows) {
    byStatus[row.status] += 1
    if (row.status === 'alternate' && row.reasonKind === null) alternatesWithoutReason += 1
    if (row.status === 'design_change' && row.reasonKind === null) designChangesWithoutReason += 1
  }
  return { total: rows.length, byStatus, alternatesWithoutReason, designChangesWithoutReason }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * "6 as specified · 1 superseded · 1 equal · 8 alternates · 3 without a reason
 * · 1 design change · 1 missing · 4 accessories" — zero buckets omitted.
 */
export function statusSummaryLine(counts: StatusCounts): string {
  const parts: string[] = []
  const b = counts.byStatus
  if (b.as_specified > 0) parts.push(`${b.as_specified} as specified`)
  if (b.superseded > 0) parts.push(`${b.superseded} superseded`)
  if (b.equal > 0) parts.push(`${b.equal} equal`)
  if (b.alternate > 0) {
    parts.push(plural(b.alternate, 'alternate', 'alternates'))
    if (counts.alternatesWithoutReason > 0) parts.push(`${counts.alternatesWithoutReason} without a reason`)
  }
  if (b.design_change > 0) {
    parts.push(plural(b.design_change, 'design change', 'design changes'))
    if (counts.designChangesWithoutReason > 0) parts.push(`${counts.designChangesWithoutReason} without a reason`)
  }
  if (b.missing > 0) parts.push(`${b.missing} missing`)
  if (b.accessory > 0) parts.push(plural(b.accessory, 'accessory', 'accessories'))
  return parts.length > 0 ? parts.join(' · ') : 'No products yet'
}
