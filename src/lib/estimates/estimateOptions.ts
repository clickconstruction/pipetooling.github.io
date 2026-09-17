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
 *
 * Add-ons (v2.3554, to-dos/estimate-options-approve-several/): each option carries a `kind`.
 * A **choice** is one of the alternatives — the customer picks exactly one, the ★ pre-selects
 * (everything above). An **add-on** rides along with whatever they choose — tick any, none
 * pre-ticked. An estimate whose options are all add-ons has nothing to choose between and
 * needs at least one tick. Acceptance freezes EVERY accepted option's lines, in offered order,
 * into the same two fields, and stamps the list in `accepted_option_keys`; the old single key
 * keeps the chosen choice (null when there was no choice group). A snapshot written before
 * kinds existed reads as all choices.
 */
import {
  normalizeEstimateLineItemsFromJson,
  type EstimateLineItemNormalized,
} from '../estimateLineItemNormalize'

export type EstimateOptionKind = 'choice' | 'add_on'

export type EstimateOption = {
  /** Stable id — survives renames; what `accepted_option_key(s)` records. */
  key: string
  name: string
  /** Customer-facing pitch under the name ("New 50-gal gas heater, 6-yr warranty…"). */
  description: string
  /** Exactly one option is recommended; it pre-selects on the customer page (choices only). */
  recommended: boolean
  /** v2.3554: one of the choices (pick exactly one) or an add-on (tick any). */
  kind: EstimateOptionKind
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

export function normalizeEstimateOptionKind(x: unknown): EstimateOptionKind {
  return x === 'add_on' ? 'add_on' : 'choice'
}

/**
 * Exactly one option comes back `recommended`: the first marked one wins, none marked → the
 * first option. When the estimate has any choice, the star must sit on a choice (it is what
 * pre-selects, and add-ons are never pre-selected) — a star on an add-on moves to the first
 * choice. An all-add-on estimate keeps its star on one add-on: that is the number the office
 * forecasts before the customer decides.
 */
function repairRecommended(options: EstimateOption[]): EstimateOption[] {
  if (options.length === 0) return options
  let rec = options.findIndex((o) => o.recommended)
  if (rec === -1) rec = 0
  const firstChoice = options.findIndex((o) => o.kind === 'choice')
  if (firstChoice !== -1 && options[rec]?.kind !== 'choice') rec = firstChoice
  return options.map((o, i) => ({ ...o, recommended: i === rec }))
}

/**
 * Parse `options_snapshot`. Tolerant of junk (returns [] for null/absent/invalid), strict on
 * identity: an entry without a non-empty string `key` is dropped — the key is what acceptance
 * records, so an unkeyed option must never reach a customer. Exactly one option comes back
 * `recommended` (see `repairRecommended`).
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
      kind: normalizeEstimateOptionKind(o.kind),
      line_items: normalizeEstimateLineItemsFromJson(o.line_items),
    })
    if (out.length === MAX_ESTIMATE_OPTIONS) break
  }
  return repairRecommended(out)
}

export function estimateOptionTotalCents(option: Pick<EstimateOption, 'line_items'>): number {
  return option.line_items.reduce((sum, l) => sum + (Number(l.amount_cents) || 0), 0)
}

/** The option the customer page pre-selects, and whose total the office sees pre-accept. */
export function recommendedEstimateOption(options: EstimateOption[]): EstimateOption | null {
  return options.find((o) => o.recommended) ?? options[0] ?? null
}

export function estimateChoiceOptions(options: EstimateOption[]): EstimateOption[] {
  return options.filter((o) => o.kind === 'choice')
}

export function estimateAddOnOptions(options: EstimateOption[]): EstimateOption[] {
  return options.filter((o) => o.kind === 'add_on')
}

/**
 * What the customer page starts with: the ★ choice, no add-ons. An all-add-on estimate starts
 * empty — nothing the customer never touched may end up in the freeze.
 */
export function defaultEstimateSelection(options: EstimateOption[]): string[] {
  const choices = estimateChoiceOptions(options)
  if (choices.length === 0) return []
  const rec = choices.find((o) => o.recommended) ?? choices[0]
  return [rec.key]
}

/**
 * One tap on a card. A choice replaces the other choice (radio); an add-on toggles
 * (checkbox). The result is in offered order; an unknown key changes nothing.
 */
export function toggleEstimateOptionSelection(options: EstimateOption[], selected: string[], key: string): string[] {
  const target = options.find((o) => o.key === key)
  if (!target) return selected
  const set = new Set(selected)
  if (target.kind === 'choice') {
    for (const o of options) if (o.kind === 'choice') set.delete(o.key)
    set.add(key)
  } else if (set.has(key)) {
    set.delete(key)
  } else {
    set.add(key)
  }
  return options.filter((o) => set.has(o.key)).map((o) => o.key)
}

export type EstimateSelectionVerdict = { ok: true } | { ok: false; reason: 'option_required' | 'option_unknown' }

/**
 * The rule acceptance enforces (client and server alike). A single-option estimate has no
 * selection to validate. Otherwise: every key must name an offered option; when the estimate
 * has choices exactly one of them must be picked; when it has none, at least one add-on must.
 */
export function isValidEstimateSelection(options: EstimateOption[], selected: string[]): EstimateSelectionVerdict {
  if (options.length < 2) return { ok: true }
  const keys = Array.from(new Set(selected))
  if (keys.some((k) => !options.some((o) => o.key === k))) return { ok: false, reason: 'option_unknown' }
  const choices = estimateChoiceOptions(options)
  if (choices.length > 0) {
    const picked = keys.filter((k) => choices.some((o) => o.key === k))
    return picked.length === 1 ? { ok: true } : { ok: false, reason: 'option_required' }
  }
  return keys.length >= 1 ? { ok: true } : { ok: false, reason: 'option_required' }
}

/** The customer-facing words for a refused selection. */
export function estimateSelectionProblemMessage(options: EstimateOption[], reason: 'option_required' | 'option_unknown'): string {
  if (reason === 'option_unknown') return 'That option is no longer offered on this estimate.'
  return estimateChoiceOptions(options).length > 0 ? 'Please choose an option first.' : 'Please tick at least one option first.'
}

/**
 * The field writes acceptance performs. Null when the key names no option — the caller must
 * refuse the acceptance rather than freeze the wrong scope. (The single-key form, kept for the
 * readers and tests that predate add-ons; `freezeAcceptedEstimateOptions` is the whole rule.)
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

export type EstimateOptionsFreeze = {
  /** Every accepted option's lines, in offered order — what the accepted document, the PDF and the job read. */
  line_items_snapshot: EstimateLineItemNormalized[]
  total_cents: number
  /** The accepted keys in offered order. */
  accepted_option_keys: string[]
  /** The chosen choice; null when the estimate had no choice group (all add-ons). */
  accepted_option_key: string | null
}

/**
 * The acceptance write for a selection (v2.3554). Null when the selection breaks the rule —
 * the caller refuses the acceptance rather than freeze the wrong scope.
 */
export function freezeAcceptedEstimateOptions(options: EstimateOption[], selected: string[]): EstimateOptionsFreeze | null {
  if (!isValidEstimateSelection(options, selected).ok) return null
  const set = new Set(selected)
  const accepted = options.filter((o) => set.has(o.key))
  if (accepted.length === 0) return null
  return {
    line_items_snapshot: accepted.flatMap((o) => o.line_items),
    total_cents: accepted.reduce((sum, o) => sum + estimateOptionTotalCents(o), 0),
    accepted_option_keys: accepted.map((o) => o.key),
    accepted_option_key: accepted.find((o) => o.kind === 'choice')?.key ?? null,
  }
}

export type EstimateSelectionSummary = {
  /** `"Replace 50-gal"` · `"Replace 50-gal" + 2 add-ons` · `"Kitchen rough-in"` · `3 options`. Empty when nothing is selected. */
  label: string
  totalCents: number
  /** How many options are selected. */
  count: number
  /** The choice, when one is selected. */
  choice: EstimateOption | null
  /** The selected add-ons, in offered order. */
  addOns: EstimateOption[]
}

/** The words for the Approve button, the confirm title, the staff email and the acceptance record. */
export function describeEstimateSelection(options: EstimateOption[], selected: string[]): EstimateSelectionSummary {
  const set = new Set(selected)
  const picked = options.filter((o) => set.has(o.key))
  const choice = picked.find((o) => o.kind === 'choice') ?? null
  const addOns = picked.filter((o) => o.kind === 'add_on')
  const totalCents = picked.reduce((sum, o) => sum + estimateOptionTotalCents(o), 0)
  const nameOf = (o: EstimateOption) => `"${o.name.trim() || 'Option'}"`
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

/** Mark exactly one option recommended. A star asked onto an add-on while choices exist stays put. */
export function setRecommendedEstimateOption(options: EstimateOption[], key: string): EstimateOption[] {
  const target = options.find((o) => o.key === key)
  if (!target) return options
  if (target.kind === 'add_on' && options.some((o) => o.kind === 'choice')) return options
  return options.map((o) => ({ ...o, recommended: o.key === key }))
}

/** Offer an option as a choice or an add-on; the star re-seats itself if the rule needs it. */
export function setEstimateOptionKind(options: EstimateOption[], key: string, kind: EstimateOptionKind): EstimateOption[] {
  if (!options.some((o) => o.key === key)) return options
  return repairRecommended(options.map((o) => (o.key === key ? { ...o, kind } : o)))
}
