/**
 * Submittals from the takeoff (v2.4107).
 *
 * A bid priced from a takeoff has no quote picks and often no pasted schedule, yet
 * the takeoff already names every product: the part lines under each fixture, with
 * the house they came from. This kernel turns the takeoff's fixtures into submittal
 * candidates — one per fixture, the part under it as the product — grouped so the
 * estimator prunes on one screen: fixtures and equipment (ticked), fixtures with no
 * part yet (offered), pipe and allowances (unticked; nobody submits pipe). Pure.
 */
import { compareTags } from './buildSubmittalRows'

export type TakeoffCountRow = { id: string; fixture: string | null; count: number }
export type TakeoffLine = {
  countRowId: string
  partId: string | null
  sourceTemplateId: string | null
  quantity: number
  unitPrice: number
  sourceMaterialPartPriceId: string | null
}
export type TakeoffPart = { name: string; manufacturer?: string | null; partTypeName: string | null }
export type TakeoffHouse = { houseId: string; houseName: string }

export type CandidateGroup = 'fixtures' | 'no_part' | 'pipe_allowance'

export type TakeoffCandidate = {
  countRowId: string
  fixture: string
  count: number
  /** "WC-1, WC-2" — the tags read off the fixture name; '' when none could be read. */
  tagText: string
  tags: string[]
  /** The product under the fixture, or null when nothing priced sits under it. */
  product: string | null
  partId: string | null
  supplyHouseId: string | null
  supplyHouseName: string | null
  group: CandidateGroup
  /** What the group ticks by default, before the estimator's own tick. */
  defaultTicked: boolean
  /** The estimator's stored tick, when there is one. */
  storedTick: boolean | null
  ticked: boolean
  /** Already a row on the revision being built onto. */
  alreadyOn: boolean
  /** The name spells out more than one tag (WC 1&2 → WC-1, WC-2), so the row may split (v2.4118). */
  canSplit: boolean
  /** The estimator's stored split, when there is one. */
  storedSplit: boolean | null
  /** One row per tag instead of one combined row. Only meaningful when `canSplit`. */
  split: boolean
}

export type TakeoffCandidatesInput = {
  countRows: ReadonlyArray<TakeoffCountRow>
  lines: ReadonlyArray<TakeoffLine>
  parts: ReadonlyMap<string, TakeoffPart>
  /** Assembly bundle names, by template id. */
  templates: ReadonlyMap<string, string>
  /** The house behind a catalog price row, by price id. */
  houses: ReadonlyMap<string, TakeoffHouse>
  choices?: ReadonlyMap<string, boolean> | null
  /** The estimator's stored splits by count row id (v2.4118). */
  splits?: ReadonlyMap<string, boolean> | null
  /** Count rows already on the revision (their `source_count_row_id`). */
  alreadyOn?: ReadonlySet<string> | null
}

const PIPE_NAME = /\bft\s+of\b|\bpipe\b|\btubing\b|\bconduit\b/i
const ALLOWANCE_NAME = /sawcut|incidental|allowance|permit|travel|rental|\bdsc\b|misc|mobilization|clean\s*up|freight|delivery/i
const PIPE_TYPE = /pipe|fitting|tubing/i
const FIXTURE_TYPE = /fixture|equipment|heater|sink|closet|lav|drain|valve\s*assembl|water\s*cooler|interceptor/i

/** "(3) HS - HAND SINK" → "HS"; "WC 1&2 - WATER CLOSET" → "WC 1&2"; the text before the first " - ". */
export function candidateHead(name: string | null | undefined): string {
  return (name ?? '')
    .replace(/^\s*\(\s*[\d.]+\s*\)\s*/, '')
    .split(/\s+[-–—]\s+/)[0]!
    .trim()
}

/**
 * The tags in a fixture name: "WC 1&2" → WC-1, WC-2; "LAV2" → LAV-2; "DWH1 & ET" → DWH-1;
 * "WHA-300" → WHA-300; "HB-3" → HB-3; "FD" → FD; "12\" DEEP MOP SINK" → none.
 */
export function tagsFromFixtureName(name: string | null | undefined): string[] {
  const head = candidateHead(name).toUpperCase()
  if (!head || PIPE_NAME.test(head)) return []
  const m = /^([A-Z]{1,5})\s*-?\s*(\d{1,3}[A-Z]?)((?:\s*(?:[&,/]|AND)\s*(?:[A-Z]{1,5}\s*-?\s*)?\d{1,3}[A-Z]?)*)/.exec(head)
  if (m) {
    const letters = m[1]!
    const tags = [`${letters}-${m[2]}`]
    const rest = m[3] ?? ''
    for (const x of rest.matchAll(/(?:([A-Z]{1,5})\s*-?\s*)?(\d{1,3}[A-Z]?)/g)) tags.push(`${x[1] ?? letters}-${x[2]}`)
    return [...new Set(tags)]
  }
  const letters = /^([A-Z]{1,5})(?:\s|$)/.exec(head)
  if (letters && !/^(FT|OF|IN|DEEP|MOP|THE|AND)$/.test(letters[1]!)) return [letters[1]!]
  return []
}

/** The one line that is the product under a fixture: a fixture-typed part first, else the priciest line; a bundle by its name. */
export function productLineOf(lines: ReadonlyArray<TakeoffLine>, parts: ReadonlyMap<string, TakeoffPart>, templates: ReadonlyMap<string, string>): { line: TakeoffLine; label: string; partTypeName: string | null } | null {
  let best: { line: TakeoffLine; label: string; partTypeName: string | null; score: number } | null = null
  for (const line of lines) {
    let label: string | null = null
    let partTypeName: string | null = null
    if (line.partId) {
      const p = parts.get(line.partId)
      if (!p) continue
      label = p.manufacturer && !p.name.toUpperCase().startsWith(p.manufacturer.toUpperCase()) ? `${p.manufacturer} ${p.name}` : p.name
      partTypeName = p.partTypeName
    } else if (line.sourceTemplateId) {
      label = templates.get(line.sourceTemplateId) ?? null
    }
    if (!label) continue
    const money = (Number(line.unitPrice) || 0) * (Number(line.quantity) || 0)
    const typed = partTypeName != null && FIXTURE_TYPE.test(partTypeName)
    const score = (typed ? 1_000_000_000 : 0) + money
    if (!best || score > best.score) best = { line, label, partTypeName, score }
  }
  return best ? { line: best.line, label: best.label, partTypeName: best.partTypeName } : null
}

function groupOf(fixture: string, product: ReturnType<typeof productLineOf>): CandidateGroup {
  if (PIPE_NAME.test(fixture)) return 'pipe_allowance'
  if (product && product.partTypeName && PIPE_TYPE.test(product.partTypeName) && !FIXTURE_TYPE.test(product.partTypeName)) return 'pipe_allowance'
  if (!product) return ALLOWANCE_NAME.test(fixture) ? 'pipe_allowance' : 'no_part'
  return 'fixtures'
}

const GROUP_ORDER: Record<CandidateGroup, number> = { fixtures: 0, no_part: 1, pipe_allowance: 2 }

export const GROUP_LABELS: Record<CandidateGroup, string> = {
  fixtures: 'Fixtures & equipment',
  no_part: 'No part on the takeoff yet',
  pipe_allowance: 'Pipe, sawcutting and allowances',
}

/** One candidate per takeoff fixture, grouped and ticked by the rule, then by the estimator's stored tick. */
export function takeoffCandidates(input: TakeoffCandidatesInput): TakeoffCandidate[] {
  const byRow = new Map<string, TakeoffLine[]>()
  for (const l of input.lines) byRow.set(l.countRowId, [...(byRow.get(l.countRowId) ?? []), l])
  const out: TakeoffCandidate[] = []
  for (const row of input.countRows) {
    const fixture = (row.fixture ?? '').trim()
    if (!fixture) continue
    const product = productLineOf(byRow.get(row.id) ?? [], input.parts, input.templates)
    const group = groupOf(fixture, product)
    const house = product?.line.sourceMaterialPartPriceId ? input.houses.get(product.line.sourceMaterialPartPriceId) ?? null : null
    const tags = tagsFromFixtureName(fixture)
    const defaultTicked = group === 'fixtures'
    const storedTick = input.choices?.get(row.id) ?? null
    const canSplit = tags.length > 1
    const storedSplit = input.splits?.get(row.id) ?? null
    out.push({
      countRowId: row.id,
      fixture,
      count: Number(row.count) || 0,
      tagText: tags.join(', '),
      tags,
      product: product?.label ?? null,
      partId: product?.line.partId ?? null,
      supplyHouseId: house?.houseId ?? null,
      supplyHouseName: house?.houseName ?? null,
      group,
      defaultTicked,
      storedTick,
      ticked: storedTick ?? defaultTicked,
      alreadyOn: input.alreadyOn?.has(row.id) ?? false,
      canSplit,
      storedSplit,
      split: canSplit && (storedSplit ?? false),
    })
  }
  return out.sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || (a.tags[0] && b.tags[0] ? compareTags(a.tags[0], b.tags[0]) : a.tags[0] ? -1 : b.tags[0] ? 1 : a.fixture.localeCompare(b.fixture)))
}

export type CandidateCounts = {
  total: number
  withProduct: number
  /** Candidates ticked. */
  ticked: number
  /** Submittal rows those ticks become — a split candidate counts once per tag. */
  rows: number
  /** Ticked candidates that split (v2.4118). */
  splitCount: number
  tickedWithProduct: number
  tickedToType: number
  leftOut: number
  alreadyOn: number
}

export function candidateCounts(cands: ReadonlyArray<TakeoffCandidate>, ticks?: ReadonlyMap<string, boolean>, splits?: ReadonlyMap<string, boolean>): CandidateCounts {
  const c: CandidateCounts = { total: 0, withProduct: 0, ticked: 0, rows: 0, splitCount: 0, tickedWithProduct: 0, tickedToType: 0, leftOut: 0, alreadyOn: 0 }
  for (const x of cands) {
    c.total += 1
    if (x.product) c.withProduct += 1
    if (x.alreadyOn) {
      c.alreadyOn += 1
      continue
    }
    const on = ticks ? (ticks.get(x.countRowId) ?? x.ticked) : x.ticked
    if (on) {
      c.ticked += 1
      const split = x.canSplit && (splits ? (splits.get(x.countRowId) ?? x.split) : x.split)
      const n = split ? x.tags.length : 1
      c.rows += n
      if (split) c.splitCount += 1
      if (x.product) c.tickedWithProduct += n
      else c.tickedToType += n
    } else c.leftOut += 1
  }
  return c
}

/** "11 rows will go on Rev 1 · 9 with a product, 2 to type · 1 split into 2 · 15 left out" */
export function candidateBar(c: CandidateCounts, revLabel: string): string {
  const bits = [`${c.rows} row${c.rows === 1 ? '' : 's'} will go on ${revLabel}`]
  if (c.rows > 0) bits.push(`${c.tickedWithProduct} with a product${c.tickedToType > 0 ? `, ${c.tickedToType} to type` : ''}`)
  if (c.splitCount > 0) bits.push(`${c.splitCount} split into ${c.rows - c.ticked + c.splitCount}`)
  if (c.leftOut > 0) bits.push(`${c.leftOut} left out`)
  if (c.alreadyOn > 0) bits.push(`${c.alreadyOn} already on it`)
  return bits.join(' · ')
}

/** The row a ticked candidate becomes: Proposed when it carries a product, Missing when it is to be typed. */
export function candidateToItemInsert(x: TakeoffCandidate, submittalId: string, sequenceOrder: number): {
  submittal_id: string
  tag: string
  sequence_order: number
  specified_description: string
  submitted_label: string | null
  supply_house_id: string | null
  status: 'proposed' | 'missing'
  sheet_pages: number[]
  source_count_row_id: string
} {
  return {
    submittal_id: submittalId,
    tag: x.tagText || x.fixture,
    sequence_order: sequenceOrder,
    specified_description: x.fixture,
    submitted_label: x.product,
    supply_house_id: x.supplyHouseId,
    status: x.product ? 'proposed' : 'missing',
    sheet_pages: [],
    source_count_row_id: x.countRowId,
  }
}

/** The rows a ticked candidate becomes: one, or one per tag when split (v2.4118) — same product, house and count row on each. */
export function candidateToItemInserts(x: TakeoffCandidate, submittalId: string, sequenceStart: number, split = x.split): ReturnType<typeof candidateToItemInsert>[] {
  if (!(split && x.canSplit)) return [candidateToItemInsert(x, submittalId, sequenceStart)]
  return x.tags.map((tag, i) => ({ ...candidateToItemInsert(x, submittalId, sequenceStart + i), tag }))
}

/**
 * The tags a submittal row's tag text lists, when it lists more than one: "WC-1, WC-2" · "WC-1 / WC-2" ·
 * "WC 1&2" → [WC-1, WC-2]; a single tag or none → []. The same reader the takeoff uses, so Split is
 * offered on the same names in both places (v2.4118).
 */
export function rowSplitTags(tagText: string | null | undefined): string[] {
  const text = (tagText ?? '').trim()
  if (!text) return []
  const fromName = tagsFromFixtureName(text)
  if (fromName.length > 1) return fromName
  const parts = text.split(/\s*(?:,|\/|&|\band\b)\s*/i).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return []
  const tags: string[] = []
  for (const p of parts) {
    // Each part must be a tag with a number (WC-2), never bare letters — "DWH1 & ET" is one heater with its tank.
    if (!/\d/.test(p)) return []
    const t = tagsFromFixtureName(p)
    if (t.length !== 1) return []
    tags.push(t[0]!)
  }
  return [...new Set(tags)].length === tags.length ? tags : []
}

export type SplitExample = { name: string; readsAs: string; canSplit: boolean; note: string | null }

/** How the rule reads this bid's own names — the "When a row can split" modal's table (v2.4118). */
export function splitExplanation(cands: ReadonlyArray<TakeoffCandidate>): SplitExample[] {
  return cands
    .filter((c) => c.group !== 'pipe_allowance')
    .map((c) => {
      const head = candidateHead(c.fixture)
      const m = /[&,/]\s*([A-Z]{1,5})\s*$/i.exec(head)
      const note = c.tags.length === 0
        ? 'no tag read; the name is the tag'
        : c.tags.length === 1 && m
          ? `“${m[1]!.toUpperCase()}” has no number, so it is not a second tag`
          : null
      return { name: c.fixture, readsAs: c.tags.length > 0 ? c.tags.join(', ') : c.fixture, canSplit: c.canSplit, note }
    })
}
