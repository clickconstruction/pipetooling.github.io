import { marginOfMarkup } from './materialsCharged'

/**
 * Markup and margin, side by side (v2.6538): every place a markup on materials is typed shows the margin it makes on
 * the sale beside it, and either box can be the one typed in. The company and the job keep storing the markup over
 * cost, to two places; the margin is read from it, to one place, and written through it. 25% over cost is a 20%
 * margin on the sale. A margin of 100% or more has no markup, so the pair refuses it and says so instead of guessing.
 */

export type MarkupSide = 'markup' | 'margin'

export type MarkupPairState = {
  /** What the markup box shows. */
  markupText: string
  /** What the margin box shows. */
  marginText: string
  /** The markup over cost the pair stands for, to two places, or null when both boxes are blank or one refuses. */
  markupPct: number | null
  /** Why the typed number cannot stand, or null. */
  refusal: string | null
}

export const MARKUP_REFUSAL = 'A markup is 0 or more.'
export const MARGIN_REFUSAL = 'A margin on the sale is under 100%.'

const two = (n: number): number => Math.round(n * 100) / 100

/** The markup over cost a margin on the sale takes, to two places: a 20% margin is 25% over cost. Null at or past 100%. */
export function markupFromMargin(marginPct: number): number | null {
  if (!Number.isFinite(marginPct) || marginPct < 0 || marginPct >= 100) return null
  return two((marginPct / (100 - marginPct)) * 100)
}

/** The margin on the sale a markup makes, to one place: 25% over cost is a 20% margin. Null below 0. */
export function marginFromMarkup(markupPct: number): number | null {
  if (!Number.isFinite(markupPct) || markupPct < 0) return null
  return marginOfMarkup(markupPct)
}

const BLANK: MarkupPairState = { markupText: '', marginText: '', markupPct: null, refusal: null }

/** The pair as a stored markup draws it. */
export function pairFromMarkup(markupPct: number | null | undefined): MarkupPairState {
  if (markupPct == null || !Number.isFinite(markupPct) || markupPct < 0) return BLANK
  const pct = two(markupPct)
  return { markupText: String(pct), marginText: String(marginFromMarkup(pct) ?? 0), markupPct: pct, refusal: null }
}

/** The pair after a number is typed in one box: the other box follows, or the typed box refuses. */
export function pairTyped(side: MarkupSide, raw: string): MarkupPairState {
  const text = raw.trim()
  if (text === '') return BLANK
  const n = Number(text)
  if (side === 'markup') {
    if (!Number.isFinite(n) || n < 0) return { markupText: raw, marginText: '', markupPct: null, refusal: MARKUP_REFUSAL }
    const pct = two(n)
    return { markupText: raw, marginText: String(marginFromMarkup(pct) ?? 0), markupPct: pct, refusal: null }
  }
  const markup = markupFromMargin(n)
  if (markup == null) return { markupText: '', marginText: raw, markupPct: null, refusal: MARGIN_REFUSAL }
  return { markupText: String(markup), marginText: raw, markupPct: markup, refusal: null }
}

/** `25% over cost, a 20% margin on the sale`. */
export function markupMarginWords(markupPct: number): string {
  return `${two(markupPct)}% over cost, a ${marginFromMarkup(markupPct) ?? 0}% margin on the sale`
}

export type MarkupBar = {
  /** Dollars of materials the bar starts from. */
  cost: number
  /** What the customer pays for them, to the cent. */
  pays: number
  /** The markup in dollars, to the cent. */
  markup: number
  /** The cost's share of the sale, 0 to 100, one place. */
  costShare: number
  /** The margin's share of the sale, 0 to 100, one place. */
  marginShare: number
  /** `cost $1,000.00` · `+$250.00` · `cost, 80% of the sale` · `margin, 20% of the sale` · `the customer pays $1,250.00`. */
  words: { cost: string; markup: string; costShare: string; marginShare: string; pays: string }
}

const money = (n: number): string => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const cents = (n: number): number => Math.round(Math.round(n * 1000) / 10) / 100

/**
 * The bar under the pair: the cost and the markup as parts of what the customer pays, so the number is shown and not
 * told. With no markup the whole bar is cost and the words say at cost.
 */
export function markupBar(cost: number, markupPct: number | null): MarkupBar {
  const c = cents(Math.max(0, Number.isFinite(cost) ? cost : 0))
  const pct = markupPct != null && Number.isFinite(markupPct) && markupPct >= 0 ? markupPct : null
  const pays = pct == null ? c : cents(c * (1 + pct / 100))
  const markup = cents(pays - c)
  const marginShare = pct == null ? 0 : (marginFromMarkup(pct) ?? 0)
  const costShare = Math.round((100 - marginShare) * 10) / 10
  return {
    cost: c,
    pays,
    markup,
    costShare,
    marginShare,
    words: {
      cost: `cost ${money(c)}`,
      markup: pct == null ? 'at cost' : `+${money(markup)}`,
      costShare: pct == null ? 'cost, all of the sale' : `cost, ${costShare}% of the sale`,
      marginShare: pct == null ? 'no markup' : `margin, ${marginShare}% of the sale`,
      pays: `the customer pays ${money(pays)}`,
    },
  }
}
