/**
 * Other job charges, read as money (punch list #215, PR 1). Pure.
 *
 * A description that starts with `ESTIMATE` splits into the chip and the
 * text after it (an amount's dollars and cents split in `src/lib/moneyParts.ts`,
 * the app's one kernel for that, since v2.8374). The `ESTIMATE` prefix is the
 * cost-batch contract (`docs/COST_BATCHES.md`: an `other_charge` op is
 * admitted only when its description starts with it), so it stays in the
 * data; only the drawing changes.
 */
import { formatCurrency } from './jobFormMoney'

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
