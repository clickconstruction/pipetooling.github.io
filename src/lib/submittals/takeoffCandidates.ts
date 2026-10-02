/**
 * Submittals from the takeoff (v2.4107).
 *
 * A bid priced from a takeoff has no quote picks and often no pasted schedule, yet
 * the takeoff already names every product: the part lines under each fixture, with
 * the house they came from. This kernel turns the takeoff's fixtures into submittal
 * candidates — one per fixture, its parts as the product (v2.4292: every line in takeoff
 * order, trim left off by name; one line alone named flush valves and stops) — grouped so the
 * estimator prunes on one screen: fixtures and equipment (ticked), fixtures with no
 * part yet (offered), pipe and allowances (unticked; nobody submits pipe). Pure.
 *
 * Parts, not assemblies (Wendi, 2026-10-01): a line priced from a price-book assembly opens
 * into the parts inside it (nested assemblies too), each a piece of its own with its quantity
 * per fixture. Every piece is bought; trim is "order only" — on the procurement log, off the
 * GC's submittal — instead of off.
 */
import { compareTags } from './buildSubmittalRows'

export type TakeoffCountRow = { id: string; fixture: string | null; count: number }
export type TakeoffLine = {
  /** The part line's id — the key a piece is remembered by (v2.4292). */
  id?: string
  countRowId: string
  /** The line's place under its fixture on the takeoff; the estimator lists the fixture first. */
  sequenceOrder?: number
  partId: string | null
  sourceTemplateId: string | null
  quantity: number
  unitPrice: number
  sourceMaterialPartPriceId: string | null
}
export type TakeoffPart = { name: string; manufacturer?: string | null; partTypeName: string | null }
export type TakeoffHouse = { houseId: string; houseName: string }
/** One item inside a price-book assembly (`material_template_items`): a part, or another assembly. */
export type TakeoffAssemblyItem = { id: string; partId: string | null; nestedTemplateId: string | null; quantity: number; sequenceOrder: number }

export type CandidateGroup = 'fixtures' | 'no_part' | 'pipe_allowance'

export type TakeoffCandidate = {
  countRowId: string
  fixture: string
  count: number
  /** "WC-1, WC-2" — the tags read off the fixture name; '' when none could be read. */
  tagText: string
  tags: string[]
  /** The product: the switched-on pieces joined with " + ", or null when none is on (v2.4292). */
  product: string | null
  /** Every line under the fixture, in takeoff order, trim marked (v2.4292). */
  pieces: ProductPiece[]
  /** The estimator's stored pieces, when there are any; null = the default rule. */
  storedProductKeys: string[] | null
  /** The pieces that make the product, in takeoff order. */
  productKeys: string[]
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
  /** 2026-10-02 · how it sits on the draft now: a row the GC sees, an order-only row, or not on it (null / absent). */
  onAs?: 'gc' | 'order' | null
  /** 2026-10-02 · the bid remembers the fixture as order only: it comes on as a row the GC never sees. */
  storedOrderOnly?: boolean
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
  /** What is inside each assembly, by template id (nested assemblies included); a bundle not here stays one piece. */
  assemblies?: ReadonlyMap<string, ReadonlyArray<TakeoffAssemblyItem>> | null
  /** The house behind a catalog price row, by price id. */
  houses: ReadonlyMap<string, TakeoffHouse>
  choices?: ReadonlyMap<string, boolean> | null
  /** The estimator's stored splits by count row id (v2.4118). */
  splits?: ReadonlyMap<string, boolean> | null
  /** The estimator's stored pieces by count row id (v2.4292). */
  productKeys?: ReadonlyMap<string, ReadonlyArray<string>> | null
  /** Count rows already on the revision (their `source_count_row_id`). */
  alreadyOn?: ReadonlySet<string> | null
  /** The estimator's stored order-only picks by count row id (2026-10-02). */
  orderOnly?: ReadonlyMap<string, boolean> | null
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

/** One part under a fixture (v2.4292): a takeoff line, or a part inside the assembly a line was priced from. */
export type ProductPiece = {
  /** The part line's id; a part inside an assembly is keyed by its assembly item's id; else `<countRowId>:<n>`. */
  key: string
  label: string
  partId: string | null
  partTypeName: string | null
  /** Stops, supplies, traps, flanges and the like — order only by default: bought, but not on the GC's submittal. */
  trim: boolean
  houseId: string | null
  houseName: string | null
  /** How many go on one fixture: the line's quantity, times the assembly's for a part inside one. */
  quantity: number
  /** The takeoff line the piece came from. */
  lineId: string | null
  /** The assembly item, for a part inside an assembly. */
  templateItemId: string | null
  /** The assembly's name, for a part inside one. */
  assembly: string | null
  manufacturer: string | null
}

/**
 * Trim, read from the part's NAME, never its type: the price book files a stop under "Sink"
 * because it goes with sinks (v2.4292 — BP375's LAV2 named its angle stop as the product).
 * "ANG" and "LOOSEKEY" catch BrassCraft's stop names; a trap primer is a valve, not trim.
 */
export const TRIM_NAME = /\b(?:ANGLE\s*STOPS?|STOPS?|ANG|LOOSE\s*KEY|SUPPL(?:Y|IES)|P-?\s*TRAPS?|TRAPS?(?!\s*PRIMER)|TAIL\s*PIECES?|TAILPIECES?|FLANGES?|ESCUTCHEONS?|GRID\s*DRAINS?|WAX|BOLTS?|RISERS?)\b/i

/** A part's name with its maker first, once. */
function partLabel(p: TakeoffPart): string {
  return p.manufacturer && !p.name.toUpperCase().startsWith(p.manufacturer.toUpperCase()) ? `${p.manufacturer} ${p.name}` : p.name
}

/**
 * The parts inside an assembly, in its own order, nested assemblies opened, quantities multiplied
 * through. A cycle or a runaway depth stops the walk rather than looping.
 */
export function expandAssembly(
  templateId: string,
  assemblies: ReadonlyMap<string, ReadonlyArray<TakeoffAssemblyItem>>,
  multiplier = 1,
  path: ReadonlySet<string> = new Set(),
): Array<{ item: TakeoffAssemblyItem; partId: string; quantity: number }> {
  if (path.has(templateId) || path.size > 6) return []
  const items = [...(assemblies.get(templateId) ?? [])].sort((a, b) => a.sequenceOrder - b.sequenceOrder)
  const next = new Set(path).add(templateId)
  const out: Array<{ item: TakeoffAssemblyItem; partId: string; quantity: number }> = []
  for (const it of items) {
    const q = (Number(it.quantity) || 0) * multiplier
    if (it.partId) out.push({ item: it, partId: it.partId, quantity: q })
    else if (it.nestedTemplateId) out.push(...expandAssembly(it.nestedTemplateId, assemblies, q, next))
  }
  return out
}

/**
 * Every part under a fixture, in takeoff order: a part line by its name (maker first); an
 * assembly line opened into the parts inside it (when they were read), each its own piece; an
 * assembly whose insides were not read stays one piece by its name.
 */
export function productPiecesOf(
  countRowId: string,
  lines: ReadonlyArray<TakeoffLine>,
  parts: ReadonlyMap<string, TakeoffPart>,
  templates: ReadonlyMap<string, string>,
  houses: ReadonlyMap<string, TakeoffHouse> = new Map(),
  assemblies: ReadonlyMap<string, ReadonlyArray<TakeoffAssemblyItem>> = new Map(),
): ProductPiece[] {
  const ordered = lines.map((l, i) => ({ l, i })).sort((a, b) => (a.l.sequenceOrder ?? a.i) - (b.l.sequenceOrder ?? b.i) || a.i - b.i)
  const out: ProductPiece[] = []
  const used = new Set<string>()
  for (const { l, i } of ordered) {
    const house = l.sourceMaterialPartPriceId ? houses.get(l.sourceMaterialPartPriceId) ?? null : null
    const lineQty = Number(l.quantity) || 0
    const base = { houseId: house?.houseId ?? null, houseName: house?.houseName ?? null, lineId: l.id ?? null }
    if (l.partId) {
      const p = parts.get(l.partId)
      if (!p) continue
      const label = partLabel(p).trim()
      const key = l.id ?? `${countRowId}:${i}`
      used.add(key)
      out.push({ key, label, partId: l.partId, partTypeName: p.partTypeName, trim: TRIM_NAME.test(label), quantity: lineQty || 1, templateItemId: null, assembly: null, manufacturer: p.manufacturer ?? null, ...base })
      continue
    }
    if (!l.sourceTemplateId) continue
    const name = templates.get(l.sourceTemplateId) ?? null
    const inside = assemblies.has(l.sourceTemplateId) ? expandAssembly(l.sourceTemplateId, assemblies, lineQty || 1) : []
    const known = inside.filter((x) => parts.has(x.partId))
    if (known.length === 0) {
      // Not read (or empty): the assembly stays one piece by its name, as before.
      if (!name) continue
      const key = l.id ?? `${countRowId}:${i}`
      used.add(key)
      out.push({ key, label: name.trim(), partId: null, partTypeName: null, trim: false, quantity: lineQty || 1, templateItemId: null, assembly: null, manufacturer: null, ...base })
      continue
    }
    for (const x of known) {
      const p = parts.get(x.partId)!
      const label = partLabel(p).trim()
      // An assembly item's id keys the piece; the same item twice under one fixture keeps its line beside it.
      const key = used.has(x.item.id) ? `${l.id ?? `${countRowId}:${i}`}:${x.item.id}` : x.item.id
      used.add(key)
      out.push({ key, label, partId: x.partId, partTypeName: p.partTypeName, trim: TRIM_NAME.test(label), quantity: x.quantity, templateItemId: x.item.id, assembly: name, manufacturer: p.manufacturer ?? null, ...base })
    }
  }
  return out
}

/** The pieces the GC sees by default: everything that is not trim; when all of it is trim, the first line. The rest is order only. */
export function defaultProductKeys(pieces: ReadonlyArray<ProductPiece>): string[] {
  const on = pieces.filter((p) => !p.trim).map((p) => p.key)
  return on.length > 0 ? on : pieces.slice(0, 1).map((p) => p.key)
}

/** The product the pieces make: their names joined in takeoff order; the part and house of the first on piece that has them. */
export function productFromPieces(pieces: ReadonlyArray<ProductPiece>, keys: ReadonlyArray<string>): { product: string | null; partId: string | null; houseId: string | null; houseName: string | null } {
  const on = new Set(keys)
  const chosen = pieces.filter((p) => on.has(p.key))
  const priced = chosen.find((p) => p.houseId) ?? null
  return {
    product: chosen.length > 0 ? chosen.map((p) => p.label).join(' + ') : null,
    partId: chosen.find((p) => p.partId)?.partId ?? null,
    houseId: priced?.houseId ?? null,
    houseName: priced?.houseName ?? null,
  }
}

/** The candidate with these pieces making its product (the picker's chips, v2.4292). */
export function withProductKeys(c: TakeoffCandidate, keys: ReadonlyArray<string>): TakeoffCandidate {
  const valid = c.pieces.filter((p) => keys.includes(p.key)).map((p) => p.key)
  const made = productFromPieces(c.pieces, valid)
  return { ...c, productKeys: valid, product: made.product, partId: made.partId, supplyHouseId: made.houseId, supplyHouseName: made.houseName }
}

function groupOf(fixture: string, main: ProductPiece | null): CandidateGroup {
  if (PIPE_NAME.test(fixture)) return 'pipe_allowance'
  if (main && main.partTypeName && PIPE_TYPE.test(main.partTypeName) && !FIXTURE_TYPE.test(main.partTypeName)) return 'pipe_allowance'
  if (!main) return ALLOWANCE_NAME.test(fixture) ? 'pipe_allowance' : 'no_part'
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
    const pieces = productPiecesOf(row.id, byRow.get(row.id) ?? [], input.parts, input.templates, input.houses, input.assemblies ?? new Map())
    const defaults = defaultProductKeys(pieces)
    // A stored choice holds while any of its pieces is still on the takeoff; otherwise the rule decides again.
    // A key that named a whole assembly line (stored before assemblies opened) stands for that assembly's default parts.
    const storedRaw = input.productKeys?.get(row.id) ?? null
    const stored = storedRaw
      ? [...new Set(storedRaw.flatMap((k) => (pieces.some((p) => p.key === k) ? [k] : pieces.filter((p) => p.lineId === k && p.templateItemId && !p.trim).map((p) => p.key))))]
      : null
    const storedValid = stored ? pieces.filter((p) => stored.includes(p.key)).map((p) => p.key) : null
    const productKeys = stored && (storedValid!.length > 0 || storedRaw!.length === 0) ? storedValid! : defaults
    const made = productFromPieces(pieces, productKeys)
    const group = groupOf(fixture, pieces.find((p) => defaults.includes(p.key)) ?? null)
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
      product: made.product,
      pieces,
      storedProductKeys: storedRaw ? [...storedRaw] : null,
      productKeys,
      partId: made.partId,
      supplyHouseId: made.houseId,
      supplyHouseName: made.houseName,
      group,
      defaultTicked,
      storedTick,
      ticked: storedTick ?? defaultTicked,
      alreadyOn: input.alreadyOn?.has(row.id) ?? false,
      storedOrderOnly: input.orderOnly?.get(row.id) ?? false,
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
