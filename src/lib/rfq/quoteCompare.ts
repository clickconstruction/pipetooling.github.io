/**
 * Quote comparison kernel (RFQ Phase 1a, v2.2629 — docs/SUPPLY_HOUSE_RFQ_PLAN.md).
 *
 * Builds the compare grid from saved quotes. Honesty rules from the deep
 * review: unit prices recompute against CURRENT quantities (with a drift
 * badge when the RFQ snapshot qty differs); expired quotes stay visible but
 * are marked; the baseline is cost-side (current cost/unit or last-quoted),
 * NEVER the sale price book; totals come in two flavors — the picked total,
 * and an apples-to-apples total over lines every compared house quoted.
 * Latest quote per house wins; older ones are history the caller can show.
 */

import { classifySpecSection, type SpecSectionMatchRule } from '../classifySpecSection'
import { aggregateKit, expectedRoles, isStructured, type ComponentRole, type KitCell, type KitLineInput } from './quoteKits'

export type CompareQuoteLine = {
  fixture: string
  unitPriceEachCents: number | null
  cantSupply: boolean
  alternateNote?: string | null
  picked?: boolean
  /** Rung G (v2.2655): lines priced together as one package share a lotId + one total. */
  lotId?: string | null
  lotTotalCents?: number | null
  /** Price Matrix PR 1 (docs/PRICE_MATRIX_PLAN.md): kit roles, option groups, provenance, the robot's reason. */
  id?: string
  componentRole?: ComponentRole | null
  label?: string | null
  optionGroup?: string | null
  optionLabel?: string | null
  optionChosen?: boolean
  pageRef?: string | null
  pickReason?: string | null
}

export type CompareQuote = {
  id: string
  supplyHouseId: string
  houseName: string
  receivedAt: string
  validUntil?: string | null
  /** Order-level freight from the quote; null = the vendor never stated it (NOT free). */
  freightCents?: number | null
  lines: CompareQuoteLine[]
}

export type CompareRowCell = {
  quoteId: string
  unitPriceEachCents: number | null
  cantSupply: boolean
  alternateNote?: string | null
  expired: boolean
  picked: boolean
  lotId?: string | null
  lotTotalCents?: number | null
  /**
   * Price Matrix PR 1: how this house priced the fixture when the quote was
   * structured (a kit subtotal + roles, or size options). `unitPriceEachCents`
   * above is the kit's $/each (null while incomplete or a choice is pending),
   * so every existing reader keeps working; this carries the parts.
   */
  kit: KitCell | null
}

export type CompareRow = {
  fixture: string
  sectionCode: string | null
  qtyNow: number
  qtySnapshot: number | null
  /** True when the RFQ snapshot qty differs from the current count by >0.5%. */
  drift: boolean
  baselineEachCents: number | null
  baselineSource: 'cost' | 'last-quoted' | null
  perHouse: Record<string, CompareRowCell>
  /** House id with the lowest live (non-expired, priced) $/each, ties → first. */
  bestHouseId: string | null
}

export type HouseSummary = {
  supplyHouseId: string
  houseName: string
  quotedLines: number
  totalLines: number
  expired: boolean
  /** Sum over apples-to-apples lines (priced by EVERY compared house), cents. */
  commonLinesTotalCents: number | null
  /** Rung B (v2.2643): the latest quote's freight. null = not stated — ranked as 0 but labeled. */
  freightCents: number | null
  /** commonLinesTotalCents + (freight ?? 0) — the number that ranks houses honestly. */
  commonWithFreightCents: number | null
}

export type PickedFreight = { supplyHouseId: string; houseName: string; freightCents: number | null }

export type QuoteComparison = {
  rows: CompareRow[]
  houses: HouseSummary[]
  /** Fixture names priced by every house — the apples-to-apples basis. */
  commonLineCount: number
  /** Parts only, at CURRENT quantities. */
  pickedTotalCents: number
  /** Rung B: one freight entry per house with ≥1 pick (null freight = not stated). */
  pickedFreight: PickedFreight[]
  /** pickedTotalCents + every picked house's stated freight. */
  pickedTotalWithFreightCents: number
}

const keyOf = (name: string) => name.trim().toLowerCase()

let anonLineSeq = 0
/** The kit kernel's view of a compare line (ids are only needed to tell components apart). */
function toKitLine(l: CompareQuoteLine): KitLineInput {
  return {
    id: l.id ?? `line-${++anonLineSeq}`,
    fixture: l.fixture,
    unitPriceEachCents: l.unitPriceEachCents,
    cantSupply: l.cantSupply,
    componentRole: l.componentRole ?? null,
    label: l.label ?? null,
    optionGroup: l.optionGroup ?? null,
    optionLabel: l.optionLabel ?? null,
    optionChosen: l.optionChosen,
    pageRef: l.pageRef ?? null,
    picked: l.picked,
    pickReason: l.pickReason ?? null,
    lotId: l.lotId ?? null,
    lotTotalCents: l.lotTotalCents ?? null,
  }
}

export function buildQuoteComparison(args: {
  quotes: ReadonlyArray<CompareQuote>
  currentQtyByName: ReadonlyMap<string, number>
  snapshotQtyByName?: ReadonlyMap<string, number>
  costBaselineEachCentsByName?: ReadonlyMap<string, number>
  lastQuotedEachCentsByName?: ReadonlyMap<string, number>
  rules?: ReadonlyArray<SpecSectionMatchRule>
  today?: string
  /** Price Matrix PR 1: roles a rule says a fixture's kit must price, keyed like the qty maps ("a wall-hung WC needs a carrier"). */
  requiredRolesByName?: ReadonlyMap<string, ReadonlyArray<ComponentRole>>
}): QuoteComparison {
  // Latest quote per house wins.
  const latestByHouse = new Map<string, CompareQuote>()
  for (const q of [...args.quotes].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))) {
    latestByHouse.set(q.supplyHouseId, q)
  }
  const houses = [...latestByHouse.values()]
  const today = args.today ?? ''
  const isExpired = (q: CompareQuote) => Boolean(q.validUntil && today && q.validUntil < today)

  const names = new Map<string, string>()
  for (const q of houses) for (const l of q.lines) names.set(keyOf(l.fixture), l.fixture)

  const rows: CompareRow[] = []
  for (const [key, display] of names) {
    const qtyNow = args.currentQtyByName.get(key) ?? 0
    const qtySnapshot = args.snapshotQtyByName?.get(key) ?? null
    const perHouse: Record<string, CompareRowCell> = {}
    let bestHouseId: string | null = null
    let best = Number.POSITIVE_INFINITY
    // Every house's lines for this fixture, so a kit knows which roles the
    // other houses priced (a house that skipped the carrier is incomplete).
    const linesByHouse = houses.map((q) => q.lines.filter((l) => keyOf(l.fixture) === key))
    const structured = linesByHouse.some((ls) => isStructured(ls.map(toKitLine)))
    const expected = structured ? expectedRoles(linesByHouse.map((ls) => ls.map(toKitLine)), args.requiredRolesByName?.get(key) ?? []) : []
    for (let i = 0; i < houses.length; i++) {
      const q = houses[i]!
      const lines = linesByHouse[i]!
      const line = lines[0]
      if (!line) continue
      const expired = isExpired(q)
      const kit = structured ? aggregateKit(lines.map(toKitLine), expected) : null
      const cell: CompareRowCell = kit
        ? {
            quoteId: q.id,
            unitPriceEachCents: kit.kitEachCents,
            cantSupply: kit.cantSupply,
            alternateNote: lines.find((l) => l.alternateNote)?.alternateNote ?? null,
            expired,
            picked: kit.picked,
            lotId: kit.lotId,
            lotTotalCents: kit.lotTotalCents,
            kit,
          }
        : {
            quoteId: q.id,
            unitPriceEachCents: line.unitPriceEachCents,
            cantSupply: line.cantSupply,
            alternateNote: line.alternateNote ?? null,
            expired,
            picked: Boolean(line.picked),
            lotId: line.lotId ?? null,
            lotTotalCents: line.lotTotalCents ?? null,
            kit: null,
          }
      perHouse[q.supplyHouseId] = cell
      if (!expired && !cell.cantSupply && cell.unitPriceEachCents != null && cell.unitPriceEachCents < best) {
        best = cell.unitPriceEachCents
        bestHouseId = q.supplyHouseId
      }
    }
    const cost = args.costBaselineEachCentsByName?.get(key)
    const lastQuoted = args.lastQuotedEachCentsByName?.get(key)
    rows.push({
      fixture: display,
      sectionCode: args.rules
        ? (() => {
            const m = classifySpecSection(display, args.rules)
            return m.outcome === 'matched' ? m.sectionCode : null
          })()
        : null,
      qtyNow,
      qtySnapshot,
      drift: qtySnapshot != null && qtyNow > 0 && Math.abs(qtySnapshot - qtyNow) / qtyNow > 0.005,
      baselineEachCents: cost ?? lastQuoted ?? null,
      baselineSource: cost != null ? 'cost' : lastQuoted != null ? 'last-quoted' : null,
      perHouse,
      bestHouseId,
    })
  }
  rows.sort((a, b) => (a.sectionCode ?? '~').localeCompare(b.sectionCode ?? '~') || a.fixture.localeCompare(b.fixture))

  const pricedByAll = rows.filter((r) =>
    houses.length > 0 &&
    houses.every((q) => {
      const c = r.perHouse[q.supplyHouseId]
      return c && !c.cantSupply && c.unitPriceEachCents != null
    }),
  )

  const houseSummaries: HouseSummary[] = houses.map((q) => {
    const priced = rows.filter((r) => {
      const c = r.perHouse[q.supplyHouseId]
      return c && !c.cantSupply && c.unitPriceEachCents != null
    })
    const common = houses.length > 1 ? pricedByAll : priced
    const total =
      common.length === 0
        ? null
        : common.reduce((s, r) => s + (r.perHouse[q.supplyHouseId]?.unitPriceEachCents ?? 0) * r.qtyNow, 0)
    const freight = q.freightCents ?? null
    const commonCents = total == null ? null : Math.round(total)
    return {
      supplyHouseId: q.supplyHouseId,
      houseName: q.houseName,
      quotedLines: priced.length,
      totalLines: rows.length,
      expired: isExpired(q),
      commonLinesTotalCents: commonCents,
      freightCents: freight,
      commonWithFreightCents: commonCents == null ? null : commonCents + (freight ?? 0),
    }
  })

  let pickedTotal = 0
  const pickedHouseIds = new Set<string>()
  // A picked lot counts its total ONCE no matter how many lines it spans.
  const pickedLotIds = new Set<string>()
  for (const r of rows) {
    for (const [houseId, cell] of Object.entries(r.perHouse)) {
      if (!cell.picked || cell.cantSupply) continue
      if (cell.lotId != null && cell.lotTotalCents != null) {
        if (!pickedLotIds.has(cell.lotId)) {
          pickedLotIds.add(cell.lotId)
          pickedTotal += cell.lotTotalCents
        }
        pickedHouseIds.add(houseId)
      } else if (cell.unitPriceEachCents != null) {
        pickedTotal += cell.unitPriceEachCents * r.qtyNow
        pickedHouseIds.add(houseId)
      }
    }
  }
  // Freight counts ONCE per house you picked anything from; null stays null
  // (not stated ≠ free) but adds 0 to the arithmetic.
  const pickedFreight = houses
    .filter((q) => pickedHouseIds.has(q.supplyHouseId))
    .map((q) => ({ supplyHouseId: q.supplyHouseId, houseName: q.houseName, freightCents: q.freightCents ?? null }))
  const freightSum = pickedFreight.reduce((s, f) => s + (f.freightCents ?? 0), 0)

  return {
    rows,
    houses: houseSummaries,
    commonLineCount: houses.length > 1 ? pricedByAll.length : 0,
    pickedTotalCents: Math.round(pickedTotal),
    pickedFreight,
    pickedTotalWithFreightCents: Math.round(pickedTotal) + freightSum,
  }
}
