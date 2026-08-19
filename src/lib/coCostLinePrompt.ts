import {
  computeEstimateLineExtendedCents,
  type EstimateLineItemNormalized,
} from './estimateLineItemNormalize'
import { formatSignedCentsUsd } from './estimateChangeOrder'

/**
 * Guided cost-impact entry for the change-order editor (CO train follow-up).
 * A new CO line starts from one of two prompts — "Added work" or
 * "Credit / removed work" — and this kernel owns the prompt's state shape,
 * validation, sign normalization onto the v2.1829 allowNegative rails, and
 * the live consequence copy ("= $2,840.00 added to contract").
 */

export type CoCostPromptMode = 'add' | 'credit'

export type CoCostPromptDraft = {
  mode: CoCostPromptMode
  /** What work is being added / credited — becomes the line_item label. */
  label: string
  /** What's included — fixtures, materials, labor… — becomes description. */
  description: string
  /** Raw user text for quantity; validated on submit. */
  quantityText: string
  /** Raw user text for unit price in dollars, always entered POSITIVE; mode applies the sign. */
  unitPriceText: string
}

export const CO_CREDIT_LABEL_PREFIX = 'Credit — '

export function emptyCoCostPromptDraft(mode: CoCostPromptMode): CoCostPromptDraft {
  return { mode, label: '', description: '', quantityText: '1', unitPriceText: '' }
}

function parseQuantity(text: string): number | null {
  const t = text.trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/** Dollars text → non-negative cents; the prompt collects magnitude only. */
function parseUnitPriceCents(text: string): number | null {
  const t = text.trim().replace(/^\$/, '').replace(/,/g, '')
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

export type CoCostPromptValidation =
  | { ok: true; line: EstimateLineItemNormalized }
  | { ok: false; error: string }

/** Signed unit price cents for the draft's mode (credit → negative). */
export function coCostPromptSignedUnitCents(draft: CoCostPromptDraft): number | null {
  const magnitude = parseUnitPriceCents(draft.unitPriceText)
  if (magnitude === null) return null
  return draft.mode === 'credit' ? -magnitude : magnitude
}

/**
 * Live consequence line under the prompt. Empty string until both numbers parse.
 * add:    "= $2,840.00 added to contract"
 * credit: "= −$390.00 credited back"
 */
export function coCostPromptConsequence(draft: CoCostPromptDraft): string {
  const qty = parseQuantity(draft.quantityText)
  const signedUnit = coCostPromptSignedUnitCents(draft)
  if (qty === null || signedUnit === null) return ''
  const ext = computeEstimateLineExtendedCents(qty, signedUnit, { allowNegative: true })
  if (draft.mode === 'credit') {
    return `= ${formatSignedCentsUsd(ext)} credited back`
  }
  return `= ${formatSignedCentsUsd(ext)} added to contract`
}

/** Credit labels get the standing prefix unless the writer already typed one. */
export function coCostPromptEffectiveLabel(draft: CoCostPromptDraft): string {
  const label = draft.label.trim()
  if (draft.mode !== 'credit' || label === '') return label
  if (/^credit\b/i.test(label)) return label
  return `${CO_CREDIT_LABEL_PREFIX}${label}`
}

export function validateCoCostPromptDraft(draft: CoCostPromptDraft): CoCostPromptValidation {
  const label = coCostPromptEffectiveLabel(draft)
  if (label === '') {
    return {
      ok: false,
      error: draft.mode === 'credit' ? 'Name the work being credited or removed.' : 'Name the work being added.',
    }
  }
  const quantity = parseQuantity(draft.quantityText)
  if (quantity === null) {
    return { ok: false, error: 'Quantity must be a number above zero.' }
  }
  const unit_price_cents = coCostPromptSignedUnitCents(draft)
  if (unit_price_cents === null) {
    return { ok: false, error: 'Enter a unit price (0 is allowed).' }
  }
  return {
    ok: true,
    line: {
      line_item: label,
      description: draft.description.trim(),
      quantity,
      unit_price_cents,
      amount_cents: computeEstimateLineExtendedCents(quantity, unit_price_cents, {
        allowNegative: true,
      }),
    },
  }
}
