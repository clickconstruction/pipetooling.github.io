/**
 * Estimate Options — server-side kernel (v2.2460, Phase 2). Dependency-free so unit tests
 * import it directly from src/lib (the ctRosterDiff pattern); a parity test keeps it in step
 * with the client kernel `src/lib/estimates/estimateOptions.ts`.
 *
 * Options are written ONLY by the Phase 1 builder, so line items are always the normalized
 * shape — no legacy-shape handling here (the client kernel keeps that for its other inputs).
 */

export type EstimateOptionLine = {
  line_item: string
  description: string
  quantity: number
  unit_price_cents: number
  amount_cents: number
}

export type SharedEstimateOption = {
  key: string
  name: string
  description: string
  recommended: boolean
  line_items: EstimateOptionLine[]
}

export const MAX_ESTIMATE_OPTIONS = 4

function normalizeLine(x: unknown): EstimateOptionLine {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
  const quantity = Number(o.quantity)
  const unit = Number(o.unit_price_cents)
  const amount = Number(o.amount_cents)
  return {
    line_item: typeof o.line_item === 'string' ? o.line_item : '',
    description: typeof o.description === 'string' ? o.description : '',
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    unit_price_cents: Number.isFinite(unit) ? Math.round(unit) : 0,
    amount_cents: Number.isFinite(amount) ? Math.round(amount) : 0,
  }
}

/** Same contract as the client normalize: tolerant of junk, strict on keys, one recommended. */
export function normalizeSharedEstimateOptions(x: unknown): SharedEstimateOption[] {
  if (!Array.isArray(x)) return []
  const out: SharedEstimateOption[] = []
  for (const raw of x) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const key = typeof o.key === 'string' ? o.key.trim() : ''
    if (!key) continue
    if (out.some((p) => p.key === key)) continue
    out.push({
      key,
      name: typeof o.name === 'string' ? o.name : '',
      description: typeof o.description === 'string' ? o.description : '',
      recommended: o.recommended === true,
      line_items: Array.isArray(o.line_items) ? o.line_items.map(normalizeLine) : [],
    })
    if (out.length === MAX_ESTIMATE_OPTIONS) break
  }
  const firstRec = out.findIndex((o) => o.recommended)
  return out.map((o, i) => ({ ...o, recommended: i === (firstRec === -1 ? 0 : firstRec) }))
}

export function sharedEstimateOptionTotalCents(option: Pick<SharedEstimateOption, 'line_items'>): number {
  return option.line_items.reduce((sum, l) => sum + (Number(l.amount_cents) || 0), 0)
}

/**
 * The acceptance write. Null when the key names no option — the caller must refuse the
 * acceptance rather than freeze the wrong scope.
 */
export function freezeSharedAcceptedOption(
  options: SharedEstimateOption[],
  acceptedKey: string,
): { line_items_snapshot: EstimateOptionLine[]; total_cents: number; accepted_option_key: string } | null {
  const chosen = options.find((o) => o.key === acceptedKey)
  if (!chosen) return null
  return {
    line_items_snapshot: chosen.line_items,
    total_cents: sharedEstimateOptionTotalCents(chosen),
    accepted_option_key: chosen.key,
  }
}
