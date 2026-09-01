/**
 * Estimate Options (v2.2457): one estimate can offer the customer several priced options —
 * Repair vs. Replace, Good / Better / Best — and the customer picks one on the acceptance
 * page before signing.
 *
 * Shape decision (owner-approved plan, 2026-08-28): options live INSIDE the single estimate
 * row (`estimates.options_snapshot` jsonb), not as sibling rows — one quote number, one
 * accept token, one signature. Acceptance freezes the chosen option's lines into
 * `line_items_snapshot` + `total_cents` and stamps `accepted_option_key`, so every
 * downstream consumer (accepted document, job creation, notify emails, Pipeline) keeps
 * reading the fields it always read. A null/absent snapshot is today's single-option
 * estimate — zero behavior change.
 *
 * Pre-acceptance, `line_items_snapshot`/`total_cents` hold the RECOMMENDED option (owner
 * decision 3), so list rows and Pipeline sums stay meaningful with no reader changes.
 */
import {
  normalizeEstimateLineItemsFromJson,
  type EstimateLineItemNormalized,
} from '../estimateLineItemNormalize'

export type EstimateOption = {
  /** Stable id — survives renames; what `accepted_option_key` records. */
  key: string
  name: string
  /** Customer-facing pitch under the name ("New 50-gal gas heater, 6-yr warranty…"). */
  description: string
  /** Exactly one option is recommended; it pre-selects on the customer page. */
  recommended: boolean
  line_items: EstimateLineItemNormalized[]
}

/**
 * Beyond this the customer page turns into a menu and chooses nothing. Originally 4 (owner
 * decision, v2.2457); raised to 6 when a customer asked for 5 separate options (2026-09-01).
 */
export const MAX_ESTIMATE_OPTIONS = 6

export function newEstimateOptionKey(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `opt-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
  }
}

/**
 * Parse `options_snapshot`. Tolerant of junk (returns [] for null/absent/invalid), strict on
 * identity: an entry without a non-empty string `key` is dropped — the key is what acceptance
 * records, so an unkeyed option must never reach a customer. Exactly one option comes back
 * `recommended` (the first marked one wins; none marked → the first option).
 */
export function normalizeEstimateOptionsFromJson(x: unknown): EstimateOption[] {
  if (!Array.isArray(x)) return []
  const out: EstimateOption[] = []
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
      line_items: normalizeEstimateLineItemsFromJson(o.line_items),
    })
    if (out.length === MAX_ESTIMATE_OPTIONS) break
  }
  const firstRec = out.findIndex((o) => o.recommended)
  return out.map((o, i) => ({ ...o, recommended: i === (firstRec === -1 ? 0 : firstRec) }))
}

export function estimateOptionTotalCents(option: Pick<EstimateOption, 'line_items'>): number {
  return option.line_items.reduce((sum, l) => sum + (Number(l.amount_cents) || 0), 0)
}

/** The option the customer page pre-selects, and whose total the office sees pre-accept. */
export function recommendedEstimateOption(options: EstimateOption[]): EstimateOption | null {
  return options.find((o) => o.recommended) ?? options[0] ?? null
}

/**
 * The field writes acceptance performs. Null when the key names no option — the caller must
 * refuse the acceptance rather than freeze the wrong scope.
 */
export function freezeAcceptedEstimateOption(
  options: EstimateOption[],
  acceptedKey: string,
): { line_items_snapshot: EstimateLineItemNormalized[]; total_cents: number; accepted_option_key: string } | null {
  const chosen = options.find((o) => o.key === acceptedKey)
  if (!chosen) return null
  return {
    line_items_snapshot: chosen.line_items,
    total_cents: estimateOptionTotalCents(chosen),
    accepted_option_key: chosen.key,
  }
}

/**
 * What saveDraft persists (owner decision 3): the snapshot itself, plus the recommended
 * option mirrored into the legacy fields so every existing reader shows the number you'd
 * forecast. `viewedKey`/`viewedLines` fold the editor's live lines (the option being edited)
 * back into the snapshot first.
 */
export function estimateOptionsDraftPersistFields(
  options: EstimateOption[],
  viewedKey: string | null,
  viewedLines: EstimateLineItemNormalized[],
): {
  options_snapshot: EstimateOption[] | null
  line_items_snapshot: EstimateLineItemNormalized[] | null
  total_cents: number | null
} {
  if (options.length === 0) return { options_snapshot: null, line_items_snapshot: null, total_cents: null }
  const synced = options.map((o) => (o.key === viewedKey ? { ...o, line_items: viewedLines } : o))
  const rec = recommendedEstimateOption(synced)
  return {
    options_snapshot: synced,
    line_items_snapshot: rec ? rec.line_items : [],
    total_cents: rec ? estimateOptionTotalCents(rec) : 0,
  }
}

/** Mark exactly one option recommended. */
export function setRecommendedEstimateOption(options: EstimateOption[], key: string): EstimateOption[] {
  if (!options.some((o) => o.key === key)) return options
  return options.map((o) => ({ ...o, recommended: o.key === key }))
}
