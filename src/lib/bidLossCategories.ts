/**
 * "Why we lost" loss categories + call-mode grouping + rollup (v2.1797).
 *
 * Single source for the `bids.loss_category` vocabulary (the migration comment
 * points here). `loss_reason` stays the free-text detail; these six buckets are
 * what the Followup tab's Why we lost lens records and rolls up.
 *
 * Pure module — no React, no Supabase.
 */

export type BidLossCategoryKey =
  | 'gc_lost'
  | 'price'
  | 'other_sub'
  | 'project_died'
  | 'no_bid'
  | 'no_answer'

export type BidLossCategory = {
  key: BidLossCategoryKey
  label: string
  /** Chip colors — theme tokens for neutrals, per repo theme rules. */
  chipBg: string
  chipFg: string
}

export const BID_LOSS_CATEGORIES: readonly BidLossCategory[] = [
  { key: 'gc_lost', label: 'GC lost the project', chipBg: 'var(--bg-muted)', chipFg: 'var(--text-700)' },
  { key: 'price', label: 'Price too high', chipBg: 'var(--bg-amber-100)', chipFg: 'var(--text-amber-800)' },
  { key: 'other_sub', label: 'Went with another sub', chipBg: 'var(--bg-violet-100)', chipFg: 'var(--text-indigo-800)' },
  { key: 'project_died', label: 'Project died / on hold', chipBg: 'var(--bg-emerald-tint)', chipFg: 'var(--text-emerald-800)' },
  { key: 'no_bid', label: 'Never finished bid', chipBg: 'var(--bg-red-tint)', chipFg: 'var(--text-red-800)' },
  { key: 'no_answer', label: 'No answer', chipBg: 'var(--bg-slate-tint)', chipFg: 'var(--text-700)' },
]

export function isBidLossCategoryKey(v: string | null | undefined): v is BidLossCategoryKey {
  return BID_LOSS_CATEGORIES.some((c) => c.key === v)
}

export function bidLossCategoryLabel(key: string | null | undefined): string | null {
  return BID_LOSS_CATEGORIES.find((c) => c.key === key)?.label ?? null
}

/**
 * Synonym map for {@link suggestLossCategoryFromNote}. Phrases are matched
 * case-insensitively as substrings of the free-text note. Order within a
 * category doesn't matter; keep phrases specific enough not to cross-match.
 */
const LOSS_NOTE_SYNONYMS: readonly { key: BidLossCategoryKey; phrases: readonly string[] }[] = [
  { key: 'gc_lost', phrases: ['not awarded', 'gc lost', 'gc didn', 'lost the project', 'lost the job', 'gc was not', 'wasn’t awarded', "wasn't awarded"] },
  { key: 'price', phrases: ['price', 'expensive', 'too high', 'cheaper', 'cost too', 'over budget', 'beat us on'] },
  { key: 'other_sub', phrases: ['another sub', 'other sub', 'another plumber', 'other plumber', 'competitor', 'went with someone', 'in-house', 'inhouse'] },
  { key: 'project_died', phrases: ['died', 'on hold', 'cancel', 'shelved', 'postponed', 'not moving forward', 'fell through'] },
  { key: 'no_bid', phrases: ['never finished', 'did not finish', "didn't finish", 'no bid', 'never sent', 'ran out of time', 'missed the deadline'] },
  { key: 'no_answer', phrases: ['no answer', 'no response', 'never heard', 'ghost', 'not responding', "won't return", 'wont return', 'no reply'] },
]

/**
 * Suggest a loss category from a free-text note ("gc not awarded" → gc_lost).
 * Returns a key ONLY when the note matches exactly one category — an ambiguous
 * note ("not awarded but they liked our price") suggests nothing, and callers
 * must never auto-apply a suggestion without a human tap.
 */
export function suggestLossCategoryFromNote(note: string | null | undefined): BidLossCategoryKey | null {
  const haystack = (note ?? '').trim().toLowerCase()
  if (!haystack) return null
  const matched = LOSS_NOTE_SYNONYMS.filter((s) => s.phrases.some((p) => haystack.includes(p)))
  return matched.length === 1 ? matched[0]!.key : null
}

/** Minimal lost-bid shape the call-mode grouping needs; the lens maps BidWithBuilder rows into this. */
export type LossTriageBid = {
  id: string
  /** Grouping key — builder/customer id, or the display name when no id exists. */
  builderKey: string
  builderName: string
  value: number
  category: string | null
}

export type LossTriageBuilderGroup = {
  builderKey: string
  builderName: string
  bids: LossTriageBid[]
  /** Bids still missing a category. */
  needsCount: number
  /** Total value of the bids still missing a category. */
  needsValue: number
}

/**
 * Group lost bids into the call-mode builder queue: builders with unexplained
 * bids first (most unexplained value first — the biggest conversations at the
 * top), fully-explained builders after, alphabetical within each band. Bid
 * order inside a group is preserved from the input.
 */
export function groupLossTriageByBuilder(bids: readonly LossTriageBid[]): LossTriageBuilderGroup[] {
  const byKey = new Map<string, LossTriageBuilderGroup>()
  for (const b of bids) {
    let g = byKey.get(b.builderKey)
    if (!g) {
      g = { builderKey: b.builderKey, builderName: b.builderName, bids: [], needsCount: 0, needsValue: 0 }
      byKey.set(b.builderKey, g)
    }
    g.bids.push(b)
    if (!isBidLossCategoryKey(b.category)) {
      g.needsCount += 1
      g.needsValue += Number.isFinite(b.value) ? b.value : 0
    }
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const aOpen = a.needsCount > 0 ? 1 : 0
    const bOpen = b.needsCount > 0 ? 1 : 0
    if (aOpen !== bOpen) return bOpen - aOpen
    if (a.needsValue !== b.needsValue) return b.needsValue - a.needsValue
    return a.builderName.localeCompare(b.builderName)
  })
}

export type LossRollupLine = {
  key: BidLossCategoryKey
  label: string
  count: number
  value: number
}

export type LossRollup = {
  lostCount: number
  lostValue: number
  uncategorizedCount: number
  uncategorizedValue: number
  lines: LossRollupLine[]
  /** lost / (won + lost), percent 0–100; null when nothing is decided. */
  lossRatePct: number | null
  /** Same, with gc_lost bids removed from both sides; null when nothing remains. */
  lossRateExclGcLostPct: number | null
}

/**
 * Roll lost bids up by category. `wonCount` counts decided wins (the app's
 * hit-rate convention: started_or_complete counts as won).
 */
export function buildLossRollup(
  lostBids: readonly Pick<LossTriageBid, 'value' | 'category'>[],
  wonCount: number,
): LossRollup {
  const byCat = new Map<BidLossCategoryKey, LossRollupLine>()
  for (const c of BID_LOSS_CATEGORIES) {
    byCat.set(c.key, { key: c.key, label: c.label, count: 0, value: 0 })
  }
  let lostValue = 0
  let uncategorizedCount = 0
  let uncategorizedValue = 0
  for (const b of lostBids) {
    const v = Number.isFinite(b.value) ? b.value : 0
    lostValue += v
    if (isBidLossCategoryKey(b.category)) {
      const line = byCat.get(b.category)!
      line.count += 1
      line.value += v
    } else {
      uncategorizedCount += 1
      uncategorizedValue += v
    }
  }
  const lostCount = lostBids.length
  const gcLost = byCat.get('gc_lost')!.count
  const decided = wonCount + lostCount
  const decidedExcl = decided - gcLost
  const lossRatePct = decided > 0 ? Math.round((lostCount / decided) * 100) : null
  const lossRateExclGcLostPct =
    decidedExcl > 0 ? Math.round(((lostCount - gcLost) / decidedExcl) * 100) : null
  const lines = Array.from(byCat.values()).sort((a, b) => b.count - a.count || b.value - a.value)
  return {
    lostCount,
    lostValue,
    uncategorizedCount,
    uncategorizedValue,
    lines,
    lossRatePct,
    lossRateExclGcLostPct,
  }
}

/**
 * The next bid to work in call mode: the first uncategorized bid after `fromIdx`
 * in the group, wrapping to the group's first uncategorized bid; null when the
 * group is fully categorized.
 */
export function nextLossTriageBidIndex(
  group: Pick<LossTriageBuilderGroup, 'bids'>,
  fromIdx: number,
): number | null {
  const later = group.bids.findIndex((b, i) => i > fromIdx && !isBidLossCategoryKey(b.category))
  if (later >= 0) return later
  const any = group.bids.findIndex((b) => !isBidLossCategoryKey(b.category))
  return any >= 0 ? any : null
}
