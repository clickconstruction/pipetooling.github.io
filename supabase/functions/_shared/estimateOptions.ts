/**
 * Estimate Options — server-side kernel (v2.2460, Phase 2). Dependency-free so unit tests
 * import it directly from src/lib (the ctRosterDiff pattern); a parity test keeps it in step
 * with the client kernel `src/lib/estimates/estimateOptions.ts`.
 *
 * Options are written ONLY by the Phase 1 builder, so line items are always the normalized
 * shape — no legacy-shape handling here (the client kernel keeps that for its other inputs).
 *
 * Add-ons (v2.3554): each option carries a `kind` — a **choice** (pick exactly one, the ★
 * pre-selects) or an **add-on** (tick any, none pre-ticked). Acceptance freezes every accepted
 * option's lines in offered order into the same two fields, stamps the list in
 * `accepted_option_keys`, and keeps the chosen choice in `accepted_option_key` (null when the
 * estimate had no choice group). A snapshot written before kinds existed reads as all choices.
 */

export type EstimateOptionLine = {
  line_item: string
  description: string
  quantity: number
  unit_price_cents: number
  amount_cents: number
}

export type SharedEstimateOptionKind = 'choice' | 'add_on'

export type SharedEstimateOption = {
  key: string
  name: string
  description: string
  recommended: boolean
  kind: SharedEstimateOptionKind
  line_items: EstimateOptionLine[]
}

export const MAX_ESTIMATE_OPTIONS = 6

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

/** Same star rule as the client: one recommended; on a choice whenever the estimate has one. */
function repairRecommended(options: SharedEstimateOption[]): SharedEstimateOption[] {
  if (options.length === 0) return options
  let rec = options.findIndex((o) => o.recommended)
  if (rec === -1) rec = 0
  const firstChoice = options.findIndex((o) => o.kind === 'choice')
  if (firstChoice !== -1 && options[rec]?.kind !== 'choice') rec = firstChoice
  return options.map((o, i) => ({ ...o, recommended: i === rec }))
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
      kind: o.kind === 'add_on' ? 'add_on' : 'choice',
      line_items: Array.isArray(o.line_items) ? o.line_items.map(normalizeLine) : [],
    })
    if (out.length === MAX_ESTIMATE_OPTIONS) break
  }
  return repairRecommended(out)
}

export function sharedEstimateOptionTotalCents(option: Pick<SharedEstimateOption, 'line_items'>): number {
  return option.line_items.reduce((sum, l) => sum + (Number(l.amount_cents) || 0), 0)
}

/**
 * The acceptance write. Null when the key names no option — the caller must refuse the
 * acceptance rather than freeze the wrong scope. (Single-key form; `freezeSharedAcceptedOptions`
 * is the whole rule.)
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

export type SharedEstimateSelectionVerdict = { ok: true } | { ok: false; reason: 'option_required' | 'option_unknown' }

/**
 * The rule acceptance enforces: a single-option estimate has nothing to validate; every key
 * must name an offered option; with choices exactly one choice; without, at least one add-on.
 */
export function isValidSharedEstimateSelection(options: SharedEstimateOption[], selected: string[]): SharedEstimateSelectionVerdict {
  if (options.length < 2) return { ok: true }
  const keys = Array.from(new Set(selected))
  if (keys.some((k) => !options.some((o) => o.key === k))) return { ok: false, reason: 'option_unknown' }
  const choices = options.filter((o) => o.kind === 'choice')
  if (choices.length > 0) {
    const picked = keys.filter((k) => choices.some((o) => o.key === k))
    return picked.length === 1 ? { ok: true } : { ok: false, reason: 'option_required' }
  }
  return keys.length >= 1 ? { ok: true } : { ok: false, reason: 'option_required' }
}

export function sharedEstimateSelectionProblemMessage(
  options: SharedEstimateOption[],
  reason: 'option_required' | 'option_unknown',
): string {
  if (reason === 'option_unknown') return 'That option is no longer offered on this estimate.'
  return options.some((o) => o.kind === 'choice') ? 'Please choose an option first.' : 'Please tick at least one option first.'
}

export type SharedEstimateOptionsFreeze = {
  line_items_snapshot: EstimateOptionLine[]
  total_cents: number
  accepted_option_keys: string[]
  accepted_option_key: string | null
}

/** The acceptance write for a selection (v2.3554). Null when the selection breaks the rule. */
export function freezeSharedAcceptedOptions(options: SharedEstimateOption[], selected: string[]): SharedEstimateOptionsFreeze | null {
  if (!isValidSharedEstimateSelection(options, selected).ok) return null
  const set = new Set(selected)
  const accepted = options.filter((o) => set.has(o.key))
  if (accepted.length === 0) return null
  return {
    line_items_snapshot: accepted.flatMap((o) => o.line_items),
    total_cents: accepted.reduce((sum, o) => sum + sharedEstimateOptionTotalCents(o), 0),
    accepted_option_keys: accepted.map((o) => o.key),
    accepted_option_key: accepted.find((o) => o.kind === 'choice')?.key ?? null,
  }
}

export type SharedEstimateSelectionSummary = {
  label: string
  totalCents: number
  count: number
  choice: SharedEstimateOption | null
  addOns: SharedEstimateOption[]
}

/** `"Replace 50-gal"` · `"Replace 50-gal" + 2 add-ons` · `"Kitchen rough-in"` · `3 options`. */
export function describeSharedEstimateSelection(options: SharedEstimateOption[], selected: string[]): SharedEstimateSelectionSummary {
  const set = new Set(selected)
  const picked = options.filter((o) => set.has(o.key))
  const choice = picked.find((o) => o.kind === 'choice') ?? null
  const addOns = picked.filter((o) => o.kind === 'add_on')
  const totalCents = picked.reduce((sum, o) => sum + sharedEstimateOptionTotalCents(o), 0)
  const nameOf = (o: SharedEstimateOption) => `"${o.name.trim() || 'Option'}"`
  let label = ''
  if (choice) {
    label = addOns.length === 0 ? nameOf(choice) : `${nameOf(choice)} + ${addOns.length} add-on${addOns.length === 1 ? '' : 's'}`
  } else if (addOns.length === 1 && addOns[0]) {
    label = nameOf(addOns[0])
  } else if (addOns.length > 1) {
    label = `${addOns.length} options`
  }
  return { label, totalCents, count: picked.length, choice, addOns }
}
