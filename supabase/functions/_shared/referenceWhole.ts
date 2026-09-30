/**
 * The robot's reference is the WHOLE bid (v2.4199): the sent base plus every offered
 * with-and-without alternate's stamped add-on. The twin prices every row it imports —
 * alternates included — so its locked total is the whole; scoring it against the base alone
 * would read as an overshoot of exactly the alternate's price.
 *
 * Shared by twin-mcp (score_shadows, score_backtest), the client's Robot Board fallbacks
 * and the best-effort card. `score_locked_shadows` (the DB trigger path) mirrors the sum
 * in SQL — migration 20260930020000.
 */

export type ReferenceAddOn = { key: string; name: string; amount: number }

export type ReferenceWhole = {
  /** The whole: base + add-ons, or null when the bid has no value. */
  value: number | null
  /** The sent value as stored (`bids.bid_value`). */
  base: number | null
  addOns: ReferenceAddOn[]
}

const GROUP_KEY_PREFIX = 'group:'

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** The offered add-ons stamped on `bids.cover_letter_alt_texts` (`groups[key] = { offered?, amount? }`). */
export function offeredAddOnsFromAltTexts(raw: unknown): ReferenceAddOn[] {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return []
  const obj = raw as Record<string, unknown>
  const groups = obj.groups
  if (groups == null || typeof groups !== 'object' || Array.isArray(groups)) return []
  const sections = obj.sections != null && typeof obj.sections === 'object' && !Array.isArray(obj.sections) ? (obj.sections as Record<string, unknown>) : {}
  const out: ReferenceAddOn[] = []
  for (const [key, val] of Object.entries(groups as Record<string, unknown>)) {
    if (val == null || typeof val !== 'object' || Array.isArray(val)) continue
    const v = val as Record<string, unknown>
    if (v.offered === false) continue
    const amount = toNumber(v.amount)
    if (amount == null || amount <= 0) continue
    const section = sections[key]
    const label = section != null && typeof section === 'object' && typeof (section as Record<string, unknown>).label === 'string' ? ((section as Record<string, unknown>).label as string).trim() : ''
    const name = label || (key.startsWith(GROUP_KEY_PREFIX) ? key.slice(GROUP_KEY_PREFIX.length) : key)
    out.push({ key, name, amount: Math.round(amount * 100) / 100 })
  }
  return out
}

/** Base + offered add-ons. A bid with no value stays null whatever the add-ons say. */
export function referenceWhole(bidValue: unknown, altTexts: unknown): ReferenceWhole {
  const base = toNumber(bidValue)
  const addOns = offeredAddOnsFromAltTexts(altTexts)
  if (base == null) return { value: null, base: null, addOns }
  const value = Math.round((base + addOns.reduce((s, a) => s + a.amount, 0)) * 100) / 100
  return { value, base, addOns }
}

/** Just the number — the drop-in for `Number(bid.bid_value)`. */
export function referenceWholeValue(bidValue: unknown, altTexts: unknown): number | null {
  return referenceWhole(bidValue, altTexts).value
}

/** ' (base $10,524 + break room $2,717)' when there are add-ons; '' otherwise. */
export function referenceWholeLabel(whole: ReferenceWhole, fmt: (n: number) => string = (n) => n.toLocaleString()): string {
  if (whole.base == null || whole.addOns.length === 0) return ''
  return ` (base $${fmt(whole.base)}${whole.addOns.map((a) => ` + ${a.name} $${fmt(a.amount)}`).join('')})`
}
