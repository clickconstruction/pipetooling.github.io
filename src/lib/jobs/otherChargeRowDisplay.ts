/**
 * Other job charges, read as money (punch list #215, PR 1). Pure.
 *
 * An amount splits into its dollars and its cents so the cents can draw
 * smaller ("39,796" + ".70"), and a description that starts with `ESTIMATE`
 * splits into the chip and the text after it. The `ESTIMATE` prefix is the
 * cost-batch contract (`docs/COST_BATCHES.md`: an `other_charge` op is
 * admitted only when its description starts with it), so it stays in the
 * data; only the drawing changes.
 */
import { formatCurrency } from './jobFormMoney'

export type MoneyParts = { whole: string; cents: string }

/** 39796.7 → { whole: "39,796", cents: ".70" }; 0 → { whole: "0", cents: ".00" }. */
export function splitMoneyForDisplay(n: number): MoneyParts {
  return splitMoneyString(formatCurrency(Number.isFinite(n) ? n : 0)) ?? { whole: '0', cents: '.00' }
}

/**
 * An already-formatted money string ("14,115.35", "−40.00", "$1,250.00") into
 * dollars and cents; null for anything that is not one ("—", "…", "8.0 h").
 */
export function splitMoneyString(s: string): MoneyParts | null {
  const m = /^([−-]?\$?\d[\d,]*)(\.\d{2})$/.exec(s.trim())
  if (!m) return null
  return { whole: m[1] ?? '', cents: m[2] ?? '' }
}

/** `ESTIMATE`, then an optional dash or colon, then the text. Any case, as the batch function reads it (`upper(left(description, 8)) = 'ESTIMATE'`). */
const ESTIMATE_PREFIX_RE = /^ESTIMATE\b\s*(?:[—–:-]\s*)?/i

export type EstimateDescription = {
  estimate: boolean
  /** The matched prefix, kept verbatim so an edit can put it back: "ESTIMATE — ". */
  prefix: string
  /** The description after the prefix; the whole description when it is not an estimate. */
  rest: string
}

/** "ESTIMATE — Office overhead Q3 share" → estimate, prefix "ESTIMATE — ", rest "Office overhead Q3 share". */
export function splitEstimateDescription(description: string): EstimateDescription {
  const m = ESTIMATE_PREFIX_RE.exec(description)
  if (!m) return { estimate: false, prefix: '', rest: description }
  return { estimate: true, prefix: m[0], rest: description.slice(m[0].length) }
}

/** What the amount box shows while it is being typed in: the plain digits, no commas, cents kept. */
export function moneyDraftForEditing(n: number): string {
  if (!Number.isFinite(n) || n === 0) return ''
  return formatCurrency(n).replace(/,/g, '')
}
