/** Normalized estimate line (draft snapshot, public doc, catalog apply). */

export type EstimateLineItemNormalized = {
  line_item: string
  description: string
  quantity: number
  unit_price_cents: number
  amount_cents: number
}

export type EstimateLineNormalizeOptions = {
  /** Change orders (v2.1826+): credit lines carry negative prices — skip the ≥0 clamp. */
  allowNegative?: boolean
}

export function computeEstimateLineExtendedCents(
  quantity: number,
  unitPriceCents: number,
  opts?: EstimateLineNormalizeOptions
): number {
  const clamp = (n: number) => (opts?.allowNegative ? Math.round(n) : Math.max(0, Math.round(n)))
  const q = Number(quantity)
  if (!Number.isFinite(q) || q <= 0) {
    return clamp(unitPriceCents)
  }
  return clamp(q * unitPriceCents)
}

function parseEstimateQuantity(raw: unknown): number {
  if (raw === undefined || raw === null || String(raw).trim() === '') return 1
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 1
  return n
}

/** One element from `line_items_snapshot` JSON array; supports legacy `{ description, amount_cents }`. */
export function normalizeEstimateLineItemFromJsonElement(
  x: unknown,
  opts?: EstimateLineNormalizeOptions
): EstimateLineItemNormalized {
  const clamp = (n: number) => (opts?.allowNegative ? Math.round(n) : Math.max(0, Math.round(n)))
  const o = x as Record<string, unknown>
  const rawDesc = String(o.description ?? '')
  const qtyMissing = o.quantity === undefined || o.quantity === null
  const unitMissing = o.unit_price_cents === undefined || o.unit_price_cents === null

  let line_item: string
  let description: string
  let quantity: number
  let unit_price_cents: number

  if (qtyMissing && unitMissing) {
    line_item = ''
    description = rawDesc
    quantity = 1
    unit_price_cents = clamp(Number(o.amount_cents ?? 0))
  } else {
    line_item = String(o.line_item ?? '').trim()
    description = rawDesc
    quantity = parseEstimateQuantity(o.quantity)
    unit_price_cents = clamp(Number(o.unit_price_cents ?? 0))
    const legacyLineTotal = Math.max(0, Math.round(Number(o.amount_cents ?? 0)))
    if (unit_price_cents === 0 && legacyLineTotal > 0) {
      unit_price_cents = Math.max(0, Math.round(legacyLineTotal / quantity))
    }
  }

  const amount_cents = computeEstimateLineExtendedCents(quantity, unit_price_cents, opts)
  return { line_item, description, quantity, unit_price_cents, amount_cents }
}

export function normalizeEstimateLineItemsFromJson(
  raw: unknown,
  opts?: EstimateLineNormalizeOptions
): EstimateLineItemNormalized[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => normalizeEstimateLineItemFromJsonElement(x, opts))
}

export function sumNormalizedLineItems(lines: EstimateLineItemNormalized[]): number {
  return lines.reduce((s, r) => s + r.amount_cents, 0)
}
