/**
 * The office's read of an acceptance that offered options (v2.3556, PR 3 of
 * to-dos/estimate-options-approve-several/): what they took, of what was offered. Reads the
 * v2.3554 key list first and falls back to the single key every acceptance before add-ons
 * stamped, so the record for an old estimate reads exactly as it did.
 */
import { describeEstimateSelection, estimateOptionTotalCents, type EstimateOption } from './estimateOptions'

export type EstimateAcceptedRecord = {
  /** `Accepted "Replace 50-gal" + 2 add-ons · $5,740.00` — the strong line; null when the estimate had fewer than two options. */
  headline: string | null
  /** `(of 4 offered)` */
  offeredNote: string
  /** `Add-on: Water softener · $1,950.00`, in offered order. */
  addOnLines: string[]
  /** `Not chosen: Repair · $1,850.00`, in offered order. */
  notChosenLines: string[]
  /** The short form for a banner: `option "Replace 50-gal" + 2 add-ons`; null when there is nothing to name. */
  bannerNote: string | null
}

/** The keys an accepted row recorded: the list when present, else the single key. */
export function acceptedEstimateOptionKeys(row: { accepted_option_key?: string | null; accepted_option_keys?: string[] | null } | null | undefined): string[] {
  if (!row) return []
  if (Array.isArray(row.accepted_option_keys) && row.accepted_option_keys.length > 0) {
    return row.accepted_option_keys.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
  }
  return row.accepted_option_key ? [row.accepted_option_key] : []
}

export function describeAcceptedEstimateRecord(
  options: EstimateOption[],
  acceptedKeys: string[],
  formatMoney: (cents: number) => string,
  fallbackTotalCents: number,
): EstimateAcceptedRecord {
  const offeredNote = `(of ${options.length} offered)`
  if (options.length < 2) return { headline: null, offeredNote, addOnLines: [], notChosenLines: [], bannerNote: null }
  const summary = describeEstimateSelection(options, acceptedKeys)
  const nameOf = (o: EstimateOption) => o.name.trim() || 'Option'
  const accepted = new Set(acceptedKeys)
  const headline = summary.count > 0 ? `Accepted ${summary.label} · ${formatMoney(summary.totalCents)}` : `Accepted an option · ${formatMoney(fallbackTotalCents)}`
  const addOnLines = summary.addOns.map((o) => `Add-on: ${nameOf(o)} · ${formatMoney(estimateOptionTotalCents(o))}`)
  const notChosenLines = options.filter((o) => !accepted.has(o.key)).map((o) => `Not chosen: ${nameOf(o)} · ${formatMoney(estimateOptionTotalCents(o))}`)
  const bannerNote = summary.count > 0 ? `option ${summary.label}` : null
  return { headline, offeredNote, addOnLines, notChosenLines, bannerNote }
}
