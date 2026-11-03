/**
 * Materials charged (punch list #254, PR 1): every material line a job already holds — a supply-house invoice's share,
 * a tallied part, a typed material charge — at its cost plus the markup over cost, to the cent. A line may be passed
 * through at cost or left off by an adjustment on the job. With no markup set, every line is at cost and the result
 * says so, so a paper never prices materials in silence.
 */

export type MaterialLineKind = 'supply_invoice' | 'tally_part' | 'typed_charge'

/** A typed charge a cost batch wrote as an estimate (its description says `ESTIMATE` first) is never a material line: no estimate enters a charge. */
export function isEstimateCharge(description: string | null | undefined): boolean {
  return /^\s*ESTIMATE\b/i.test(description ?? '')
}

export const MATERIAL_LINE_KIND_WORDS: Record<MaterialLineKind, string> = {
  supply_invoice: 'supply-house invoice',
  tally_part: 'tallied part',
  typed_charge: 'typed material charge',
}

export type MaterialLineInput = {
  id: string
  kind: MaterialLineKind
  /** `Ferguson · invoice 3344372`, `3/4" copper elbow × 12`, the charge's description. */
  label: string
  /** YYYY-MM-DD, or null when the row has no date. */
  dateKey: string | null
  /** Dollars the company paid, this job's share. */
  cost: number
  /** An adjustment on the job: charged at cost. */
  passThrough?: boolean
  /** An adjustment on the job: not on the paper. */
  leftOff?: boolean
}

export type MaterialLineCharged = MaterialLineInput & {
  markup: number
  charged: number
  passedThrough: boolean
}

export type MaterialsChargedTotals = {
  lines: number
  cost: number
  markup: number
  charged: number
  passedThrough: number
  leftOff: number
}

export type MaterialsChargedResult = {
  /** The lines that count, in the order given. */
  lines: MaterialLineCharged[]
  /** The lines an adjustment left off, kept for the office copy. */
  leftOff: MaterialLineInput[]
  totals: MaterialsChargedTotals
  /** The markup in force, or null when none is set. */
  markupPct: number | null
  /** Why materials are at cost, or null. */
  why: string | null
}

/** To the cent, a half-cent rounding up: 12,258.725 is $12,258.73, whatever floating point made of the product. */
const cents = (n: number): number => Math.round(Math.round(n * 1000) / 10) / 100

/** Cost plus the markup, to the cent. */
export function chargedAtMarkup(cost: number, markupPct: number): number {
  return cents(cost * (1 + markupPct / 100))
}

/** `25% over cost is a 20% margin on the sale`: the margin the markup makes, as a percent of the sale, to one place. */
export function marginOfMarkup(markupPct: number): number {
  if (!(markupPct > 0)) return 0
  return Math.round((markupPct / (100 + markupPct)) * 1000) / 10
}

export function chargeMaterials(lines: ReadonlyArray<MaterialLineInput>, markupPct: number | null): MaterialsChargedResult {
  const pct = markupPct != null && Number.isFinite(markupPct) && markupPct >= 0 ? markupPct : null
  const out: MaterialLineCharged[] = []
  const leftOff: MaterialLineInput[] = []
  for (const l of lines) {
    if (l.leftOff) {
      leftOff.push(l)
      continue
    }
    const cost = cents(Math.max(0, l.cost))
    const passedThrough = Boolean(l.passThrough)
    const charged = passedThrough || pct == null ? cost : chargedAtMarkup(cost, pct)
    out.push({ ...l, cost, markup: cents(charged - cost), charged, passedThrough })
  }
  const totals: MaterialsChargedTotals = {
    lines: out.length,
    cost: cents(out.reduce((a, l) => a + l.cost, 0)),
    markup: cents(out.reduce((a, l) => a + l.markup, 0)),
    charged: cents(out.reduce((a, l) => a + l.charged, 0)),
    passedThrough: out.filter((l) => l.passedThrough).length,
    leftOff: leftOff.length,
  }
  return { lines: out, leftOff, totals, markupPct: pct, why: pct == null && out.length > 0 ? 'No markup on materials is set, so every material line is at cost.' : null }
}
