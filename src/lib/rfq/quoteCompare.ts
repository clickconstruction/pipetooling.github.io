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

export type CompareQuoteLine = {
  fixture: string
  unitPriceEachCents: number | null
  cantSupply: boolean
  alternateNote?: string | null
  picked?: boolean
}

export type CompareQuote = {
  id: string
  supplyHouseId: string
  houseName: string
  receivedAt: string
  validUntil?: string | null
  lines: CompareQuoteLine[]
}

export type CompareRowCell = {
  quoteId: string
  unitPriceEachCents: number | null
  cantSupply: boolean
  alternateNote?: string | null
  expired: boolean
  picked: boolean
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
}

export type QuoteComparison = {
  rows: CompareRow[]
  houses: HouseSummary[]
  /** Fixture names priced by every house — the apples-to-apples basis. */
  commonLineCount: number
  pickedTotalCents: number
}

const keyOf = (name: string) => name.trim().toLowerCase()

export function buildQuoteComparison(args: {
  quotes: ReadonlyArray<CompareQuote>
  currentQtyByName: ReadonlyMap<string, number>
  snapshotQtyByName?: ReadonlyMap<string, number>
  costBaselineEachCentsByName?: ReadonlyMap<string, number>
  lastQuotedEachCentsByName?: ReadonlyMap<string, number>
  rules?: ReadonlyArray<SpecSectionMatchRule>
  today?: string
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
    for (const q of houses) {
      const line = q.lines.find((l) => keyOf(l.fixture) === key)
      if (!line) continue
      const expired = isExpired(q)
      perHouse[q.supplyHouseId] = {
        quoteId: q.id,
        unitPriceEachCents: line.unitPriceEachCents,
        cantSupply: line.cantSupply,
        alternateNote: line.alternateNote ?? null,
        expired,
        picked: Boolean(line.picked),
      }
      if (!expired && !line.cantSupply && line.unitPriceEachCents != null && line.unitPriceEachCents < best) {
        best = line.unitPriceEachCents
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
    return {
      supplyHouseId: q.supplyHouseId,
      houseName: q.houseName,
      quotedLines: priced.length,
      totalLines: rows.length,
      expired: isExpired(q),
      commonLinesTotalCents: total == null ? null : Math.round(total),
    }
  })

  let pickedTotal = 0
  for (const r of rows) {
    for (const cell of Object.values(r.perHouse)) {
      if (cell.picked && cell.unitPriceEachCents != null && !cell.cantSupply) {
        pickedTotal += cell.unitPriceEachCents * r.qtyNow
      }
    }
  }

  return {
    rows,
    houses: houseSummaries,
    commonLineCount: houses.length > 1 ? pricedByAll.length : 0,
    pickedTotalCents: Math.round(pickedTotal),
  }
}
