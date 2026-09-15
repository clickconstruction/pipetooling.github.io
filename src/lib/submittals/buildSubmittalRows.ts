/**
 * Submittal rows (Submittals 1a): one row per fixture tag on the plan's
 * schedule, paired with the supply-house quote line the estimator picked for
 * that fixture. The status comes from ./productStatus; the reason, lead time
 * and cut-sheet pages come from the pick or are carried from the previous
 * revision of the package; every row says how it differs from that revision.
 *
 * Matching is by fixture name (case/whitespace-insensitive) — several tags may
 * share one count row (WC-1 and WC-2 are both "Water closet") and each gets
 * the same pick. A pick whose fixture matches no tag becomes an accessory row
 * (tag '') after the tagged rows, in pick order.
 */
import { deriveProductStatus, normalizeModel } from './productStatus'
import type { ProductStatus, ReasonKind, StatusOverride } from './productStatus'

export type SpecifiedInput = {
  tag: string
  fixture: string | null
  manufacturer: string | null
  model: string | null
  description: string | null
}

export type PickInput = {
  fixture: string
  supplyHouseId: string | null
  houseName: string | null
  quoteLineId: string
  label: string | null
  alternateReasonKind: ReasonKind | null
  alternateReasonNote: string | null
  leadTimeDays: number | null
}

export type PreviousItem = {
  id: string
  tag: string
  submittedModel: string | null
  submittedLabel: string | null
  status: ProductStatus
  reasonKind: ReasonKind | null
  reasonNote: string | null
  leadTimeDays: number | null
  sheetFile: number | null
  sheetPages: number[]
  reviewDecision: 'approved' | 'revise' | 'rejected' | null
  reviewNote: string | null
}

export type ChangeNote = 'new row' | 'product changed' | 'status changed' | 'reason added' | 'now missing'

export type SubmittalRowDraft = {
  /** '' for an accessory (a pick with no specified tag). */
  tag: string
  sequenceOrder: number
  specifiedManufacturer: string | null
  specifiedModel: string | null
  specifiedDescription: string | null
  /** null in v1 — the quote line is not parsed into make/model. */
  submittedManufacturer: string | null
  /** The specified model when the pick's label contains it; else the label. */
  submittedModel: string | null
  submittedLabel: string | null
  supplyHouseId: string | null
  houseName: string | null
  sourceQuoteLineId: string | null
  status: ProductStatus
  near: boolean
  reasonKind: ReasonKind | null
  reasonNote: string | null
  leadTimeDays: number | null
  /** Carried from the previous revision only when the submitted product is unchanged. */
  sheetFile: number | null
  sheetPages: number[]
  carriedFromItemId: string | null
  changed: boolean
  changeNote: ChangeNote | null
}

function fixtureKey(fixture: string | null | undefined): string {
  return (fixture ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Does the quote line's text carry the specified model number? */
function labelContainsModel(label: string | null, model: string | null): boolean {
  const spec = normalizeModel(model)
  if (!spec || !label) return false
  const tokens = label.split(/\s+/).map((t) => normalizeModel(t))
  if (tokens.some((t) => t === spec)) return true
  return tokens.join('').includes(spec)
}

type TagParts = { prefix: string; num: number; rest: string }

function parseTag(tag: string): TagParts {
  const m = /^(.*?)(\d+)(.*)$/.exec(tag.trim())
  if (!m) return { prefix: tag.trim().toUpperCase(), num: -1, rest: '' }
  return { prefix: (m[1] ?? '').toUpperCase(), num: Number(m[2]), rest: (m[3] ?? '').toUpperCase() }
}

/** Natural: prefix alphabetical, then number numeric (WC-2 < WC-10); '' (accessories) last. */
export function compareTags(a: string, b: string): number {
  const ea = a.trim() === ''
  const eb = b.trim() === ''
  if (ea && eb) return 0
  if (ea) return 1
  if (eb) return -1
  const pa = parseTag(a)
  const pb = parseTag(b)
  if (pa.prefix !== pb.prefix) return pa.prefix < pb.prefix ? -1 : 1
  if (pa.num !== pb.num) return pa.num - pb.num
  if (pa.rest !== pb.rest) return pa.rest < pb.rest ? -1 : 1
  return a < b ? -1 : a > b ? 1 : 0
}

/** The rows the reviewer wants back. */
export function rowsSentBack(items: ReadonlyArray<PreviousItem>): PreviousItem[] {
  return items.filter((i) => i.reviewDecision === 'revise' || i.reviewDecision === 'rejected')
}

function noteFor(prev: PreviousItem | null, row: Pick<SubmittalRowDraft, 'submittedModel' | 'submittedLabel' | 'status' | 'reasonKind'>): ChangeNote | null {
  if (!prev) return 'new row'
  if (row.status === 'missing' && prev.status !== 'missing') return 'now missing'
  const prevProduct = normalizeModel(prev.submittedModel) || normalizeModel(prev.submittedLabel)
  const nextProduct = normalizeModel(row.submittedModel) || normalizeModel(row.submittedLabel)
  if (prevProduct !== nextProduct) return 'product changed'
  if (row.status !== prev.status) return 'status changed'
  if (prev.reasonKind === null && row.reasonKind !== null) return 'reason added'
  return null
}

export function buildSubmittalRows(args: {
  specified: SpecifiedInput[]
  picks: PickInput[]
  previous?: PreviousItem[]
  overrides?: Record<string, StatusOverride>
}): SubmittalRowDraft[] {
  const previous = args.previous ?? []
  const overrides = args.overrides ?? {}

  const pickByFixture = new Map<string, PickInput>()
  for (const pick of args.picks) {
    const key = fixtureKey(pick.fixture)
    if (key && !pickByFixture.has(key)) pickByFixture.set(key, pick)
  }
  const matchedFixtures = new Set<string>()
  const previousByTag = new Map<string, PreviousItem>()
  for (const item of previous) {
    if (item.tag.trim() === '') continue
    if (!previousByTag.has(item.tag)) previousByTag.set(item.tag, item)
  }
  const previousAccessories = previous.filter((i) => i.tag.trim() === '')

  const tagged: SubmittalRowDraft[] = []
  const sortedSpecified = [...args.specified].sort((a, b) => compareTags(a.tag, b.tag))
  for (const spec of sortedSpecified) {
    const key = fixtureKey(spec.fixture)
    const pick = key ? pickByFixture.get(key) ?? null : null
    if (pick) matchedFixtures.add(key)
    const prev = previousByTag.get(spec.tag) ?? null

    const isSpecModel = pick ? labelContainsModel(pick.label, spec.model) : false
    const submittedModel = pick ? (isSpecModel ? spec.model : pick.label) : null
    const submittedLabel = pick ? pick.label : null

    const { status, near } = deriveProductStatus({
      specified: { manufacturer: spec.manufacturer, model: spec.model },
      submitted: pick ? { manufacturer: null, model: isSpecModel ? spec.model : null, label: pick.label } : null,
      override: overrides[spec.tag] ?? null,
    })

    const reasonFromPick = pick?.alternateReasonKind ?? null
    const reasonKind = reasonFromPick ?? prev?.reasonKind ?? null
    const reasonNote = reasonFromPick ? pick?.alternateReasonNote ?? null : prev?.reasonNote ?? null
    const leadTimeDays = pick?.leadTimeDays ?? prev?.leadTimeDays ?? null

    const sameProduct = prev !== null && submittedModel !== null && normalizeModel(prev.submittedModel) === normalizeModel(submittedModel)
    const sheetFile = sameProduct ? prev.sheetFile : null
    const sheetPages = sameProduct ? [...prev.sheetPages] : []

    const partial = { submittedModel, submittedLabel, status, reasonKind }
    const changeNote = noteFor(prev, partial)
    tagged.push({
      tag: spec.tag,
      sequenceOrder: 0,
      specifiedManufacturer: spec.manufacturer,
      specifiedModel: spec.model,
      specifiedDescription: spec.description,
      submittedManufacturer: null,
      submittedModel,
      submittedLabel,
      supplyHouseId: pick?.supplyHouseId ?? null,
      houseName: pick?.houseName ?? null,
      sourceQuoteLineId: pick?.quoteLineId ?? null,
      status,
      near,
      reasonKind,
      reasonNote,
      leadTimeDays,
      sheetFile,
      sheetPages,
      carriedFromItemId: prev?.id ?? null,
      changed: changeNote !== null,
      changeNote,
    })
  }

  const accessories: SubmittalRowDraft[] = []
  for (const pick of args.picks) {
    if (matchedFixtures.has(fixtureKey(pick.fixture))) continue
    const label = pick.label
    const prev =
      previousAccessories.find((p) => normalizeModel(p.submittedLabel) === normalizeModel(label) || (normalizeModel(p.submittedModel) !== '' && normalizeModel(p.submittedModel) === normalizeModel(label))) ?? null
    const { status, near } = deriveProductStatus({ specified: null, submitted: { manufacturer: null, model: null, label } })
    const reasonFromPick = pick.alternateReasonKind
    const reasonKind = reasonFromPick ?? prev?.reasonKind ?? null
    const reasonNote = reasonFromPick ? pick.alternateReasonNote : prev?.reasonNote ?? null
    const leadTimeDays = pick.leadTimeDays ?? prev?.leadTimeDays ?? null
    const changeNote = noteFor(prev, { submittedModel: label, submittedLabel: label, status, reasonKind })
    accessories.push({
      tag: '',
      sequenceOrder: 0,
      specifiedManufacturer: null,
      specifiedModel: null,
      specifiedDescription: null,
      submittedManufacturer: null,
      submittedModel: label,
      submittedLabel: label,
      supplyHouseId: pick.supplyHouseId,
      houseName: pick.houseName,
      sourceQuoteLineId: pick.quoteLineId,
      status,
      near,
      reasonKind,
      reasonNote,
      leadTimeDays,
      sheetFile: prev?.sheetFile ?? null,
      sheetPages: prev ? [...prev.sheetPages] : [],
      carriedFromItemId: prev?.id ?? null,
      changed: changeNote !== null,
      changeNote,
    })
  }

  const rows = [...tagged, ...accessories]
  rows.forEach((row, i) => {
    row.sequenceOrder = i + 1
  })
  return rows
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "3 rows changed · 19 carried" · "22 new rows" · "Nothing changed · 22 carried". */
export function summarizeChanges(rows: ReadonlyArray<SubmittalRowDraft>): string {
  if (rows.length === 0) return 'No rows'
  const fresh = rows.filter((r) => r.changeNote === 'new row').length
  if (fresh === rows.length) return plural(fresh, 'new row', 'new rows')
  const changed = rows.filter((r) => r.changed).length
  const carried = rows.length - changed
  if (changed === 0) return `Nothing changed · ${carried} carried`
  return `${plural(changed, 'row changed', 'rows changed')} · ${carried} carried`
}
