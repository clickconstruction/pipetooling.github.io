/**
 * Guided cost-impact entry for the change-order editor.
 *
 * v2.1944: the "+ Added work" / "− Credit / removed work" chips append an
 * inline-editable line directly (one line per chip click) — the intermediate
 * prompt panel with its own "Add line" button is gone. This kernel keeps the
 * chip mode type, the standing credit-label convention, and the credit-line
 * predicate the editor uses to sign unit prices on the v2.1829 allowNegative
 * rails.
 */

export type CoCostPromptMode = 'add' | 'credit'

export const CO_CREDIT_LABEL_PREFIX = 'Credit — '

/**
 * Is this inline CO line a credit line? True when its stored price is already
 * negative, or its label follows the standing "Credit …" convention (the
 * credit chip prefills `CO_CREDIT_LABEL_PREFIX`). The editor shows credit
 * lines' unit price as a magnitude and stores it negative.
 */
export function isCoCreditLine(lineItem: string, unitPriceCents: number): boolean {
  if (unitPriceCents < 0) return true
  return /^credit\b/i.test(lineItem.trim())
}
