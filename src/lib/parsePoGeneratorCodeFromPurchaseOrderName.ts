/** 5-digit PO Generator codes: 10000–99999 (word-boundary match). Omit shop-style NNNNN-N (not a generator token). */
const PO_GENERATOR_CODE = /\b(1\d{4}|[2-9]\d{4})\b(?!\-\d)/

/**
 * Extracts the first PO Generator-style code from a purchase order display name, if any.
 */
export function parsePoGeneratorCodeFromPurchaseOrderName(name: string): number | null {
  const m = name.match(PO_GENERATOR_CODE)
  if (!m) return null
  const n = parseInt(m[0], 10)
  if (Number.isNaN(n) || n < 10000 || n > 99999) return null
  return n
}
